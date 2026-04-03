"""
Verified SQL playbooks — high-accuracy paths for demo-critical intents.
Returns (sql, playbook_id, params dict) or (None, None, {}).
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

USER_ID_PATTERN = re.compile(
    r"\b(demo_[a-z0-9_]+|proc_\d{6}|(?:user|account|trader|investor|holder)(?:_[a-z0-9]+){1,4})\b",
    re.IGNORECASE,
)

USER_SNAPSHOT_SQL = """
SELECT up.id AS user_id, up.email, up.name, up.lifecycle_stage, up.estimated_ltv,
up.acquisition_source, up.country,
w.balance_usd, w.activity_score, w.transaction_count,
(SELECT COUNT(*) FROM risk_flags rf WHERE rf.user_id = up.id) AS risk_flag_count,
(SELECT COUNT(*) FROM risk_flags rf WHERE rf.user_id = up.id AND rf.severity = 'critical') AS critical_risks,
(SELECT COUNT(*) FROM support_tickets st WHERE st.user_id = up.id
 AND st.status IN ('open','pending','escalated')) AS open_tickets,
(SELECT COUNT(*) FROM recovery_actions ra WHERE ra.user_id = up.id AND ra.status = 'pending') AS pending_actions
FROM user_profiles up
LEFT JOIN wallets w ON w.user_id = up.id
WHERE up.id = '{user_id}'
LIMIT 1
""".strip()

CRITICAL_RISK_COUNT_SQL = """
SELECT COUNT(*) AS cnt FROM risk_flags WHERE severity = 'critical' LIMIT 1000
""".strip()

PENDING_ACTIONS_SQL = """
SELECT ra.id AS action_id, ra.user_id, ra.action_type, ra.status, ra.priority,
ra.estimated_recovery_value, ra.reason
FROM recovery_actions ra
WHERE ra.status = 'pending'
ORDER BY ra.priority DESC, ra.estimated_recovery_value DESC
LIMIT 25
""".strip()

HIGH_VALUE_AT_RISK_SQL = """
SELECT up.id AS user_id, up.email, up.name, up.lifecycle_stage, up.estimated_ltv,
up.acquisition_source,
(SELECT COUNT(*) FROM risk_flags rf WHERE rf.user_id = up.id AND rf.severity IN ('critical','high')) AS high_severity_risks
FROM user_profiles up
WHERE up.estimated_ltv >= 12000
AND up.lifecycle_stage IN ('inactive','onboarding','churned')
ORDER BY up.estimated_ltv DESC
LIMIT 40
""".strip()

COMPLIANCE_TICKETS_SQL = """
SELECT st.id AS ticket_id, st.user_id, st.category, st.status, st.priority, st.unresolved_days,
st.subject, up.estimated_ltv, up.acquisition_source
FROM support_tickets st
JOIN user_profiles up ON up.id = st.user_id
WHERE st.category IN ('compliance','kyc_delay','withdrawal_issue')
AND st.status IN ('open','pending','escalated')
ORDER BY st.priority DESC, st.unresolved_days DESC
LIMIT 35
""".strip()


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower()).strip()


def extract_user_id(text: str) -> Optional[str]:
    m = USER_ID_PATTERN.search(text)
    return m.group(1) if m else None


def try_playbook(query: str, session: Dict[str, Any]) -> Tuple[Optional[str], Optional[str], Dict[str, Any]]:
    n = _norm(query)

    uid = extract_user_id(query)
    if not uid:
        focus = session.get("focus_user_id")
        if focus and any(
            t in n
            for t in (
                "they",
                "them",
                "this user",
                "same user",
                "that user",
                "recovery plan",
                "next step",
                "for them",
            )
        ):
            uid = focus

    if uid:
        sql = USER_SNAPSHOT_SQL.format(user_id=uid.replace("'", "''"))
        return sql, "user_recovery_snapshot", {"user_id": uid}

    if re.search(r"\b(how many|count)\b.*\b(critical)\b.*\b(risk|flag)", n) or n == "critical risks":
        return CRITICAL_RISK_COUNT_SQL, "critical_risk_count", {}

    if ("pending" in n and "action" in n) or ("recovery" in n and "pending" in n and "action" in n):
        return PENDING_ACTIONS_SQL, "pending_recovery_actions", {}

    if ("high" in n and "value" in n and ("inactive" in n or "at risk" in n or "churn" in n or "drop" in n)):
        return HIGH_VALUE_AT_RISK_SQL, "high_value_at_risk", {}

    if "compliance" in n or ("kyc" in n and ("ticket" in n or "open" in n)):
        if "how many" in n:
            return None, None, {}
        return COMPLIANCE_TICKETS_SQL, "compliance_pressure", {}

    return None, None, {}


def build_structured_extras(
    playbook_id: Optional[str],
    params: Dict[str, Any],
    rows: List[Dict[str, Any]],
    user_query: str,
) -> Tuple[List[str], List[Dict[str, Any]]]:
    """Deterministic insights + suggested actions for operator UI."""
    insights: List[str] = []
    actions: List[Dict[str, Any]] = []

    if not rows:
        return (["No matching rows for this playbook run — user may not exist or filters returned empty."], [])

    if playbook_id == "user_recovery_snapshot":
        r = rows[0]
        uid = r.get("user_id") or params.get("user_id", "")
        insights.append(
            f"User **{r.get('name', uid)}** (`{uid}`) — stage **{r.get('lifecycle_stage')}**, plan LTV **${float(r.get('estimated_ltv') or 0):,.0f}**, source **{r.get('acquisition_source')}**."
        )
        bal = r.get("balance_usd")
        if bal is not None:
            insights.append(f"Wallet balance ~**${float(bal):,.0f}**, activity score **{float(r.get('activity_score') or 0):.0f}/100**, tx count **{r.get('transaction_count', 0)}**.")
        cr = int(r.get("critical_risks") or 0)
        tr = int(r.get("risk_flag_count") or 0)
        ot = int(r.get("open_tickets") or 0)
        pa = int(r.get("pending_actions") or 0)
        insights.append(f"Risk flags: **{tr}** total (**{cr}** critical). Open support tickets: **{ot}**. Pending recovery actions: **{pa}**.")
        if cr > 0:
            actions.append(
                {
                    "action_type": "priority_support",
                    "priority": "critical",
                    "user_id": uid,
                    "reason": "Critical risk flags — escalate to VIP support queue",
                }
            )
        if ot > 0:
            actions.append(
                {
                    "action_type": "workflow_trigger",
                    "priority": "high",
                    "user_id": uid,
                    "reason": "Unresolved tickets — trigger support/compliance workflow",
                }
            )
        if r.get("lifecycle_stage") == "onboarding" or int(r.get("open_tickets") or 0) > 0:
            actions.append(
                {
                    "action_type": "account_review",
                    "priority": "high",
                    "user_id": uid,
                    "reason": "Onboarding or ticket friction — schedule account review",
                }
            )
        if not actions:
            actions.append(
                {
                    "action_type": "email_outreach",
                    "priority": "medium",
                    "user_id": uid,
                    "reason": "Low friction — proactive retention outreach",
                }
            )

    elif playbook_id == "critical_risk_count":
        c = int(list(rows[0].values())[0]) if rows else 0
        insights.append(f"**{c}** risk flags are currently **critical** severity.")
        actions.append(
            {
                "action_type": "workflow_trigger",
                "priority": "critical",
                "user_id": None,
                "reason": "Triage critical flags cohort-wide in RUD Actions tab",
            }
        )

    elif playbook_id == "pending_recovery_actions":
        insights.append(f"Showing **{len(rows)}** pending recovery actions (top by priority and value).")
        if rows:
            top = rows[0]
            insights.append(
                f"Largest opportunity in this slice: **{top.get('action_type')}** for `{top.get('user_id')}` (~${float(top.get('estimated_recovery_value') or 0):,.0f})."
            )
            actions.append(
                {
                    "action_type": str(top.get("action_type", "account_review")),
                    "priority": str(top.get("priority", "high")),
                    "user_id": str(top.get("user_id")),
                    "reason": "Approve or simulate execution for top pending action",
                }
            )

    elif playbook_id == "high_value_at_risk":
        insights.append(f"**{len(rows)}** high-LTV users in **inactive / onboarding / churned** stages (cohort slice).")
        if rows:
            u = rows[0]["user_id"]
            insights.append(f"Top exposure by LTV: `{u}` — **${float(rows[0].get('estimated_ltv') or 0):,.0f}** with **{int(rows[0].get('high_severity_risks') or 0)}** high/critical risks.")
            actions.append(
                {
                    "action_type": "incentive_offer",
                    "priority": "high",
                    "user_id": str(u),
                    "reason": "Re-engage high-LTV user at risk of churn",
                }
            )

    elif playbook_id == "compliance_pressure":
        insights.append(f"**{len(rows)}** open compliance / KYC / withdrawal tickets in this view.")
        if rows:
            t = rows[0]
            insights.append(
                f"Hot lead: `{t.get('user_id')}` — **{t.get('category')}** ticket, **{t.get('unresolved_days')}** days open, LTV **${float(t.get('estimated_ltv') or 0):,.0f}**."
            )
            actions.append(
                {
                    "action_type": "account_review",
                    "priority": "critical" if (t.get("priority") == "critical") else "high",
                    "user_id": str(t.get("user_id")),
                    "reason": "Compliance pressure — legal/ops review and ticket prioritization",
                }
            )

    else:
        insights.append("Results retrieved; use the table below for detail. Ask a follow-up or name a user id for a tailored recovery plan.")

    return insights, actions
