"""
Database seeding — coherent crypto retention narratives for RUD demo.

- Deterministic RNG for stable demos
- Named personas with realistic compliance/support/acquisition stories
- Procedural users: lifecycle-aware wallets & tickets, then rule-derived risk flags
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta
from typing import Any, Dict, List, Sequence, Tuple

from sqlalchemy.orm import Session

from database import SessionLocal, init_db
from models import UserProfile, Wallet, RiskFlag, SupportTicket, RecoveryAction, Campaign

# ---------------------------------------------------------------------------
# Canonical values (keep in sync with agent + main API)
# ---------------------------------------------------------------------------

SEED_RANDOM_STATE = 42

RISK_FLAG_TYPES = (
    "onboarding_incomplete",
    "inactivity",
    "support_unresolved",
    "compliance_issue",
    "low_activity",
    "unusual_behavior",
)

ACQUISITION_SOURCES = ["twitter", "discord", "affiliate", "paid_ads", "organic", "referral", "content"]
LIFECYCLE_STAGES = ["onboarding", "active", "inactive", "churned", "high_value"]
COUNTRIES = ["US", "UK", "DE", "SG", "JP", "AU", "CA", "NL", "FR", "CH", "HK", "UAE", "AE", "IN"]

TICKET_SUBJECTS = {
    "kyc_delay": "KYC verification pending — additional documentation required",
    "withdrawal_issue": "Withdrawal delayed / stuck in compliance review",
    "login_problem": "Cannot complete 2FA / device verification",
    "transaction_error": "On-chain deposit not credited after confirmations",
    "compliance": "AML review: source of funds verification",
    "account_locked": "Account access restricted pending review",
    "API_issue": "Trading API rate limits / webhook delivery failures",
}

ACTION_TYPES = [
    "email_outreach",
    "priority_support",
    "workflow_trigger",
    "account_review",
    "incentive_offer",
]

FLAG_TO_ACTION_CANDIDATES: Dict[str, Tuple[str, ...]] = {
    "compliance_issue": ("account_review", "priority_support", "workflow_trigger"),
    "onboarding_incomplete": ("workflow_trigger", "email_outreach", "priority_support"),
    "support_unresolved": ("priority_support", "workflow_trigger"),
    "inactivity": ("email_outreach", "incentive_offer", "priority_support"),
    "low_activity": ("incentive_offer", "account_review", "email_outreach"),
    "unusual_behavior": ("account_review", "workflow_trigger", "priority_support"),
}


# ---------------------------------------------------------------------------
# Demo personas — fixed IDs for repeatable executive demos
# ---------------------------------------------------------------------------

def _p(
    user_id: str,
    email: str,
    name: str,
    acquisition_source: str,
    lifecycle_stage: str,
    estimated_ltv: float,
    country: str,
    first_seen_days_ago: int,
    last_active_days_ago: int,
    wallet: Dict[str, Any],
    tickets: List[Dict[str, Any]],
) -> Dict[str, Any]:
    return {
        "id": user_id,
        "email": email,
        "name": name,
        "acquisition_source": acquisition_source,
        "lifecycle_stage": lifecycle_stage,
        "estimated_ltv": estimated_ltv,
        "country": country,
        "first_seen_days_ago": first_seen_days_ago,
        "last_active_days_ago": last_active_days_ago,
        "wallet": wallet,
        "tickets": tickets,
    }


DEMO_PERSONAS: List[Dict[str, Any]] = [
    _p(
        "demo_marcus_whale_kyc",
        "marcus.wei@institutional.sg",
        "Marcus Wei",
        "paid_ads",
        "onboarding",
        185_000.0,
        "SG",
        28,
        2,
        {
            "balance_usd": 520_000.0,
            "blockchain": "ethereum",
            "wallet_age_days": 510,
            "transaction_count": 12,
            "activity_score": 22.0,
            "last_tx_days_ago": 2,
        },
        [{
            "suffix": "kyc",
            "category": "kyc_delay",
            "status": "open",
            "priority": "critical",
            "days_old": 17,
            "subject": "Corporate KYC: UBO disclosure pending — legal escalation",
        }],
    ),
    _p(
        "demo_elena_highvalue_withdrawal",
        "elena.volkov@protonmail.com",
        "Elena Volkov",
        "discord",
        "inactive",
        92_000.0,
        "DE",
        340,
        62,
        {
            "balance_usd": 118_000.0,
            "blockchain": "arbitrum",
            "wallet_age_days": 620,
            "transaction_count": 214,
            "activity_score": 31.0,
            "last_tx_days_ago": 62,
        },
        [{
            "suffix": "wd",
            "category": "withdrawal_issue",
            "status": "escalated",
            "priority": "critical",
            "days_old": 12,
            "subject": "Large withdrawal held for compliance — user awaiting update",
        }],
    ),
    _p(
        "demo_james_active_healthy",
        "james.okonkwo@gmail.com",
        "James Okonkwo",
        "organic",
        "active",
        12_500.0,
        "US",
        400,
        1,
        {
            "balance_usd": 18_400.0,
            "blockchain": "ethereum",
            "wallet_age_days": 400,
            "transaction_count": 156,
            "activity_score": 78.0,
            "last_tx_days_ago": 1,
        },
        [{
            "suffix": "res",
            "category": "transaction_error",
            "status": "resolved",
            "priority": "low",
            "days_old": 30,
            "subject": "Minor deposit delay — resolved same day",
        }],
    ),
    _p(
        "demo_sofia_churned_compliance",
        "sofia.martins@outlook.com",
        "Sofia Martins",
        "affiliate",
        "churned",
        34_000.0,
        "NL",
        540,
        200,
        {
            "balance_usd": 900.0,
            "blockchain": "polygon",
            "wallet_age_days": 540,
            "transaction_count": 44,
            "activity_score": 8.0,
            "last_tx_days_ago": 200,
        },
        [{
            "suffix": "aml",
            "category": "compliance",
            "status": "pending",
            "priority": "high",
            "days_old": 45,
            "subject": "AML alert: velocity mismatch — case opened with vendor",
        }],
    ),
    _p(
        "demo_alex_highvalue_quiet",
        "alex.han@crypto-trader.io",
        "Alex Han",
        "twitter",
        "high_value",
        210_000.0,
        "AE",
        720,
        18,
        {
            "balance_usd": 340_000.0,
            "blockchain": "ethereum",
            "wallet_age_days": 700,
            "transaction_count": 890,
            "activity_score": 33.0,
            "last_tx_days_ago": 18,
        },
        [],
    ),
    _p(
        "demo_priya_onboarding_stuck",
        "priya.nair@web3.email",
        "Priya Nair",
        "paid_ads",
        "onboarding",
        48_000.0,
        "IN",
        14,
        1,
        {
            "balance_usd": 2_100.0,
            "blockchain": "solana",
            "wallet_age_days": 14,
            "transaction_count": 2,
            "activity_score": 18.0,
            "last_tx_days_ago": 1,
        },
        [{
            "suffix": "kyc2",
            "category": "kyc_delay",
            "status": "open",
            "priority": "high",
            "days_old": 6,
            "subject": "Individual KYC: liveness check failed twice",
        }],
    ),
    _p(
        "demo_omar_paidads_ticket_cluster",
        "omar.bakshi@blockchainmail.com",
        "Omar Bakshi",
        "paid_ads",
        "inactive",
        61_000.0,
        "UAE",
        180,
        41,
        {
            "balance_usd": 54_000.0,
            "blockchain": "ethereum",
            "wallet_age_days": 180,
            "transaction_count": 88,
            "activity_score": 28.0,
            "last_tx_days_ago": 41,
        },
        [
            {
                "suffix": "a",
                "category": "login_problem",
                "status": "open",
                "priority": "medium",
                "days_old": 9,
                "subject": "Device fingerprint mismatch — locked sessions",
            },
            {
                "suffix": "b",
                "category": "withdrawal_issue",
                "status": "open",
                "priority": "high",
                "days_old": 5,
                "subject": "Bridge withdrawal pending manual review",
            },
        ],
    ),
    _p(
        "demo_lisa_unusual_velocity",
        "lisa.tan@exchange-risk.demo",
        "Lisa Tan",
        "affiliate",
        "high_value",
        138_000.0,
        "SG",
        260,
        0,
        {
            "balance_usd": 95_000.0,
            "blockchain": "ethereum",
            "wallet_age_days": 260,
            "transaction_count": 2400,
            "activity_score": 71.0,
            "last_tx_days_ago": 0,
        },
        [{
            "suffix": "risk",
            "category": "compliance",
            "status": "open",
            "priority": "critical",
            "days_old": 2,
            "subject": "Trading velocity spike correlated with new API keys",
        }],
    ),
    _p(
        "demo_ken_referral_happy",
        "ken.morita@gmail.com",
        "Ken Morita",
        "referral",
        "active",
        8_200.0,
        "JP",
        200,
        0,
        {
            "balance_usd": 11_800.0,
            "blockchain": "optimism",
            "wallet_age_days": 200,
            "transaction_count": 120,
            "activity_score": 82.0,
            "last_tx_days_ago": 0,
        },
        [],
    ),
    _p(
        "demo_rachel_compliance_only",
        "rachel.green@protonmail.com",
        "Rachel Green",
        "content",
        "active",
        76_000.0,
        "CA",
        300,
        3,
        {
            "balance_usd": 102_000.0,
            "blockchain": "bitcoin",
            "wallet_age_days": 300,
            "transaction_count": 410,
            "activity_score": 68.0,
            "last_tx_days_ago": 3,
        },
        [{
            "suffix": "sof",
            "category": "compliance",
            "status": "open",
            "priority": "high",
            "days_old": 8,
            "subject": "Travel rule: counterparty VASP not responding — outbound paused",
        }],
    ),
    _p(
        "demo_tom_affiliate_drift",
        "tom.schmidt@outlook.com",
        "Tom Schmidt",
        "affiliate",
        "inactive",
        19_000.0,
        "DE",
        190,
        94,
        {
            "balance_usd": 6_200.0,
            "blockchain": "polygon",
            "wallet_age_days": 190,
            "transaction_count": 56,
            "activity_score": 19.0,
            "last_tx_days_ago": 94,
        },
        [],
    ),
    _p(
        "demo_nina_api_institutional",
        "nina.kowalski@api-partner.demo",
        "Nina Kowalski",
        "paid_ads",
        "high_value",
        164_000.0,
        "UK",
        410,
        1,
        {
            "balance_usd": 210_000.0,
            "blockchain": "ethereum",
            "wallet_age_days": 410,
            "transaction_count": 12_400,
            "activity_score": 88.0,
            "last_tx_days_ago": 1,
        },
        [{
            "suffix": "api",
            "category": "API_issue",
            "status": "pending",
            "priority": "critical",
            "days_old": 4,
            "subject": "FIX session: quoting engine lag — market-making desk impacted",
        }],
    ),
]


# ---------------------------------------------------------------------------
# Ticket & wallet helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.utcnow()


def build_ticket(user_id: str, spec: Dict[str, Any]) -> SupportTicket:
    now = _now()
    days_old = int(spec["days_old"])
    status = spec["status"]
    created = now - timedelta(days=days_old)
    last_delta = min(days_old - 1, max(0, days_old - 1)) if days_old > 0 else 0
    last_updated = now - timedelta(days=random.randint(0, max(0, last_delta))) if last_delta else created

    return SupportTicket(
        id=f"{user_id}_tkt_{spec['suffix']}",
        user_id=user_id,
        subject=spec.get("subject") or TICKET_SUBJECTS.get(spec["category"], "Support request"),
        status=status,
        priority=spec["priority"],
        category=spec["category"],
        created_at=created,
        last_updated=last_updated,
        unresolved_days=days_old if status in ("open", "pending", "escalated") else 0,
        source_system="demo_support",
        external_id=f"zendesk_{spec['suffix']}_{user_id[-6:]}",
        last_synced_at=now,
    )


def build_wallet(user_id: str, w: Dict[str, Any]) -> Wallet:
    now = _now()
    last_tx = now - timedelta(days=int(w["last_tx_days_ago"]))
    return Wallet(
        id=f"wallet_{user_id}",
        user_id=user_id,
        blockchain=w.get("blockchain", "ethereum"),
        balance_usd=float(w["balance_usd"]),
        wallet_age_days=int(w["wallet_age_days"]),
        transaction_count=int(w["transaction_count"]),
        activity_score=float(w["activity_score"]),
        last_activity_at=last_tx,
        source_system="demo_blockchain",
        external_id=f"chain_{user_id}",
        last_synced_at=now,
    )


def _days_since_activity(user: UserProfile) -> int:
    if not user.last_activity_at:
        return 999
    return max(0, (_now() - user.last_activity_at).days)


# ---------------------------------------------------------------------------
# Rule-based risk flags (cohort truthfulness)
# ---------------------------------------------------------------------------

def derive_risk_flags(user: UserProfile, wallet: Wallet, tickets: Sequence[SupportTicket]) -> List[RiskFlag]:
    """Populate flags from profile + wallet + tickets — no random flag types."""
    flags: List[RiskFlag] = []
    now = _now()
    uid = user.id
    fl = 0

    def add_flag(
        flag_type: str,
        severity: str,
        description: str,
        days_since: int,
    ) -> None:
        nonlocal fl
        if flag_type not in RISK_FLAG_TYPES:
            return
        detected = now - timedelta(days=days_since)
        flags.append(
            RiskFlag(
                id=f"{uid}_risk_{fl}",
                user_id=uid,
                flag_type=flag_type,
                severity=severity,
                description=description,
                detected_at=detected,
                days_since_detection=days_since,
                source_system="demo_orchestrator",
                external_id=f"orch_{uid}_{fl}",
                last_synced_at=now,
            )
        )
        fl += 1

    open_ops = [t for t in tickets if t.status in ("open", "pending", "escalated")]

    # Support cluster
    if open_ops:
        worst = max(open_ops, key=lambda t: t.unresolved_days)
        mx = worst.unresolved_days
        crit_tix = sum(1 for t in open_ops if t.priority == "critical")
        if mx >= 14 or crit_tix >= 1:
            sup_sev = "critical"
        elif mx >= 7:
            sup_sev = "high"
        elif mx >= 3:
            sup_sev = "medium"
        else:
            sup_sev = "low"
        detail = "; ".join(
            f"{t.subject[:60]}… ({t.id}, {t.unresolved_days}d)"
            for t in sorted(open_ops, key=lambda x: -x.unresolved_days)[:3]
        )
        add_flag(
            "support_unresolved",
            sup_sev,
            f"{len(open_ops)} unresolved ticket(s). Worst age {mx}d. {detail}",
            min(mx, 90),
        )

    # Compliance — AML / holds / high-LTV KYC stuck (regulatory narrative)
    comp_like = [
        t for t in open_ops
        if t.category in ("compliance", "withdrawal_issue")
        or "AML" in (t.subject or "").upper()
        or (
            t.category == "kyc_delay"
            and user.estimated_ltv >= 75_000
            and (t.unresolved_days >= 10 or t.priority == "critical")
        )
    ]
    if comp_like:
        worst_c = max(comp_like, key=lambda t: t.unresolved_days)
        days_c = worst_c.unresolved_days
        if worst_c.priority == "critical" or days_c >= 10 or user.estimated_ltv >= 100_000:
            csev = "critical"
        elif days_c >= 5:
            csev = "high"
        else:
            csev = "medium"
        add_flag(
            "compliance_issue",
            csev,
            f"Compliance exposure: {worst_c.subject} — ticket {worst_c.id}, {days_c}d open.",
            min(days_c, 120),
        )

    # Onboarding drop-off
    if user.lifecycle_stage == "onboarding":
        kyc_open = [t for t in open_ops if t.category == "kyc_delay"]
        if kyc_open:
            tk = kyc_open[0]
            days_k = tk.unresolved_days
            if days_k >= 14 or tk.priority == "critical":
                osev = "critical"
            elif days_k >= 7:
                osev = "high"
            else:
                osev = "medium"
            pct = max(15, 100 - min(85, days_k * 4))
            add_flag(
                "onboarding_incomplete",
                osev,
                f"User still in onboarding; KYC ticket {tk.id} open {days_k}d (~{pct}% journey complete estimate). LTV-at-risk ${user.estimated_ltv:,.0f}.",
                min(days_k, 60),
            )
        else:
            add_flag(
                "onboarding_incomplete",
                "medium",
                f"Lifecycle=onboarding with low wallet engagement (tx={wallet.transaction_count}, activity_score={wallet.activity_score:.0f}).",
                random.randint(3, 10),
            )

    # Inactivity / churn
    d_act = _days_since_activity(user)
    if user.lifecycle_stage in ("inactive", "churned") or d_act >= 50:
        if user.lifecycle_stage == "churned" or d_act >= 120:
            ise = "critical" if user.estimated_ltv >= 50_000 else "high"
        elif d_act >= 90:
            ise = "high"
        elif d_act >= 45:
            ise = "medium"
        else:
            ise = "low"
        add_flag(
            "inactivity",
            ise,
            f"No meaningful engagement for ~{d_act}d (lifecycle={user.lifecycle_stage}, est. LTV ${user.estimated_ltv:,.0f}).",
            min(d_act, 365),
        )

    # High-value going quiet (not already critical inactivity)
    if (
        user.estimated_ltv >= 80_000
        and wallet.activity_score < 42
        and user.lifecycle_stage in ("active", "high_value", "inactive")
        and not any(f.flag_type == "inactivity" and f.severity == "critical" for f in flags)
    ):
        add_flag(
            "low_activity",
            "high" if user.estimated_ltv >= 150_000 else "medium",
            f"High LTV (${user.estimated_ltv:,.0f}) but weak recent activity score ({wallet.activity_score:.0f}); balance ${wallet.balance_usd:,.0f}.",
            random.randint(5, 20),
        )

    # Unusual behavior — velocity / volume outliers
    if wallet.transaction_count >= 2000 and wallet.wallet_age_days < 400:
        add_flag(
            "unusual_behavior",
            "high",
            f"Elevated tx velocity: {wallet.transaction_count} txs over ~{wallet.wallet_age_days}d — review automation/API usage.",
            random.randint(1, 5),
        )

    return flags


# ---------------------------------------------------------------------------
# Recovery actions derived from flags
# ---------------------------------------------------------------------------

def derive_recovery_actions(user: UserProfile, flags: Sequence[RiskFlag]) -> List[RecoveryAction]:
    if not flags:
        return []

    now = _now()
    actions: List[RecoveryAction] = []
    used_types: set = set()

    sorted_flags = sorted(
        flags,
        key=lambda f: ({"critical": 0, "high": 1, "medium": 2, "low": 3}.get(f.severity, 4), f.days_since_detection),
    )

    for flag in sorted_flags:
        if len(actions) >= 2:
            break
        candidates = FLAG_TO_ACTION_CANDIDATES.get(flag.flag_type, ("email_outreach",))
        for atype in candidates:
            if atype in used_types:
                continue
            used_types.add(atype)

            base = max(750.0, min(85_000.0, user.estimated_ltv * (0.08 if flag.severity == "critical" else 0.04)))
            if flag.severity == "critical":
                status = "pending"
                apriority = "critical"
            elif flag.severity == "high":
                status = random.choice(["pending", "pending", "approved"])
                apriority = "high"
            else:
                status = random.choice(["pending", "approved", "executed"])
                apriority = "medium"

            created_days = min(flag.days_since_detection, 21)
            executed_at = None
            if status == "executed":
                executed_at = now - timedelta(days=random.randint(1, max(1, created_days)))

            actions.append(
                RecoveryAction(
                    id=f"{user.id}_act_{len(actions)}",
                    user_id=user.id,
                    action_type=atype,
                    status=status,
                    priority=apriority,
                    reason=f"Recommended {atype.replace('_', ' ')} for {flag.flag_type} ({flag.severity}): {flag.description[:120]}",
                    created_at=now - timedelta(days=created_days),
                    executed_at=executed_at,
                    estimated_recovery_value=base,
                    source_system="demo_orchestrator",
                    external_id=f"playbook_{user.id}_{len(actions)}",
                    last_synced_at=now,
                )
            )
            break

    return actions


# ---------------------------------------------------------------------------
# Procedural users (lifecycle-aware tickets + wallets)
# ---------------------------------------------------------------------------

_TICKET_CATS = list(TICKET_SUBJECTS.keys())


def generate_wallet_procedural(lifecycle: str, ltv: float, last_activity_at: datetime) -> Dict[str, Any]:
    now = _now()
    days_since = max(0, (now - last_activity_at).days)

    if lifecycle == "high_value":
        balance = max(5_000.0, random.uniform(ltv * 1.2, ltv * 7.0))
        tx_count = random.randint(120, 4_000)
        wallet_age = random.randint(180, 950)
        activity_score = min(100.0, 38 + tx_count / 120.0 + random.uniform(-6, 18))
    elif lifecycle == "active":
        balance = max(200.0, random.uniform(400.0, min(220_000.0, ltv * 18.0)))
        tx_count = random.randint(15, 450)
        wallet_age = random.randint(25, 520)
        activity_score = min(100.0, 52 + random.uniform(-12, 28))
    elif lifecycle == "onboarding":
        balance = max(0.0, random.uniform(0.0, min(8_000.0, ltv * 1.5)))
        tx_count = random.randint(0, 12)
        wallet_age = random.randint(5, 85)
        activity_score = min(100.0, 12 + tx_count * 4.0 + random.uniform(-4, 10))
    elif lifecycle in ("inactive", "churned"):
        balance = max(0.0, random.uniform(0.0, min(95_000.0, ltv * 4.0)))
        tx_count = random.randint(0, 180)
        wallet_age = random.randint(50, 720)
        activity_score = max(5.0, min(100.0, 22 + random.uniform(-12, 18)))
    else:
        balance = 1000.0
        tx_count = 10
        wallet_age = 100
        activity_score = 40.0

    return {
        "balance_usd": balance,
        "blockchain": random.choice(["ethereum", "polygon", "solana", "arbitrum", "optimism"]),
        "wallet_age_days": wallet_age,
        "transaction_count": tx_count,
        "activity_score": activity_score,
        "last_tx_days_ago": days_since,
    }


def generate_support_tickets_procedural(user_id: str, lifecycle: str, ltv: float) -> List[SupportTicket]:
    tickets: List[SupportTicket] = []
    r = random.random()

    if lifecycle == "onboarding" and r < 0.66:
        tickets.append(
            build_ticket(
                user_id,
                {
                    "suffix": "kyc",
                    "category": "kyc_delay",
                    "status": "open",
                    "priority": "critical" if ltv > 45_000 else "high",
                    "days_old": random.randint(3, 21),
                    "subject": None,
                },
            )
        )
    elif lifecycle in ("inactive", "high_value") and r < 0.36:
        cat = random.choice(["withdrawal_issue", "login_problem", "compliance", "transaction_error"])
        tickets.append(
            build_ticket(
                user_id,
                {
                    "suffix": "p1",
                    "category": cat,
                    "status": random.choice(["open", "open", "pending", "escalated"]),
                    "priority": random.choice(["critical", "high"]) if ltv > 55_000 else random.choice(["medium", "high"]),
                    "days_old": random.randint(2, 28),
                    "subject": None,
                },
            )
        )
    elif lifecycle == "churned" and r < 0.40:
        tickets.append(
            build_ticket(
                user_id,
                {
                    "suffix": "c1",
                    "category": "compliance",
                    "status": "pending",
                    "priority": "high",
                    "days_old": random.randint(18, 65),
                    "subject": None,
                },
            )
        )
    elif lifecycle == "active" and r < 0.13:
        tickets.append(
            build_ticket(
                user_id,
                {
                    "suffix": "a1",
                    "category": random.choice(_TICKET_CATS),
                    "status": "resolved",
                    "priority": "low",
                    "days_old": random.randint(8, 55),
                    "subject": None,
                },
            )
        )

    if len(tickets) == 1 and random.random() < 0.11 and lifecycle in ("inactive", "high_value", "churned"):
        tickets.append(
            build_ticket(
                user_id,
                {
                    "suffix": "p2",
                    "category": random.choice(["login_problem", "API_issue", "withdrawal_issue"]),
                    "status": "open",
                    "priority": "medium",
                    "days_old": random.randint(1, 12),
                    "subject": None,
                },
            )
        )

    return tickets


def insert_user_bundle(
    db: Session,
    *,
    user_id: str,
    email: str,
    name: str,
    acquisition_source: str,
    lifecycle_stage: str,
    estimated_ltv: float,
    country: str,
    first_seen_at: datetime,
    last_activity_at: datetime,
    wallet_data: Dict[str, Any],
    tickets: List[SupportTicket],
) -> None:
    now = _now()
    user = UserProfile(
        id=user_id,
        email=email,
        name=name,
        acquisition_source=acquisition_source,
        lifecycle_stage=lifecycle_stage,
        estimated_ltv=estimated_ltv,
        first_seen_at=first_seen_at,
        last_activity_at=last_activity_at,
        country=country,
        source_system="demo_platform",
        external_id=f"ext_{user_id}",
        last_synced_at=now,
    )
    wdata = dict(wallet_data)
    wdata["last_tx_days_ago"] = max(0, (_now() - last_activity_at).days)
    user.wallet = build_wallet(user_id, wdata)
    user.support_tickets = tickets
    user.risk_flags = derive_risk_flags(user, user.wallet, tickets)
    user.recovery_actions = derive_recovery_actions(user, user.risk_flags)
    db.add(user)


def seed_demo_personas(db: Session) -> None:
    now = _now()
    for pdata in DEMO_PERSONAS:
        first_seen = now - timedelta(days=pdata["first_seen_days_ago"])
        last_act = now - timedelta(days=pdata["last_active_days_ago"])
        tickets = [build_ticket(pdata["id"], spec) for spec in pdata["tickets"]]
        insert_user_bundle(
            db,
            user_id=pdata["id"],
            email=pdata["email"],
            name=pdata["name"],
            acquisition_source=pdata["acquisition_source"],
            lifecycle_stage=pdata["lifecycle_stage"],
            estimated_ltv=float(pdata["estimated_ltv"]),
            country=pdata["country"],
            first_seen_at=first_seen,
            last_activity_at=last_act,
            wallet_data=pdata["wallet"],
            tickets=tickets,
        )
    db.commit()
    print(f"✅ Seeded {len(DEMO_PERSONAS)} named demo personas")


def seed_campaigns(db: Session) -> None:
    campaigns_data = [
        ("campaign_twitter_001", "Twitter Growth Q1", "twitter", 50_000, 1200, 150_000),
        ("campaign_discord_001", "Discord Community Q1", "discord", 25_000, 800, 120_000),
        ("campaign_affiliate_001", "Affiliate Network Q1", "affiliate", 75_000, 3000, 400_000),
        ("campaign_paid_ads_001", "Paid Search — High Intent", "paid_ads", 100_000, 2000, 250_000),
        ("campaign_organic_001", "Organic Growth Q1", "organic", 0, 4000, 500_000),
        ("campaign_content_001", "Content Marketing Q1", "content", 30_000, 1500, 200_000),
    ]
    for camp_id, name, channel, spend, conversions, revenue in campaigns_data:
        cpa = spend / conversions if conversions > 0 else 0.0
        roi = (revenue - spend) / spend * 100 if spend > 0 else 0.0
        db.add(
            Campaign(
                id=camp_id,
                campaign_name=name,
                channel=channel,
                spend_usd=spend,
                conversions=conversions,
                revenue_usd=revenue,
                cpa=cpa,
                roi=roi,
                source_system="demo_marketing",
                external_id=f"ads_{camp_id}",
                last_synced_at=_now(),
            )
        )
    db.commit()
    print(f"✅ Created {len(campaigns_data)} campaigns")


def seed_procedural_users(db: Session, count: int) -> None:
    print(f"🌱 Seeding {count} procedural users (deterministic rules)…")
    now = _now()
    for i in range(count):
        user_id = f"proc_{i:06d}"
        lifecycle = random.choices(
            LIFECYCLE_STAGES,
            weights=[14, 38, 22, 14, 12],
        )[0]
        ltv_base = {"onboarding": 600, "active": 5200, "inactive": 4200, "churned": 900, "high_value": 28_000}
        ltv = max(0.0, ltv_base[lifecycle] + random.uniform(-800, 5500))
        account_age = random.randint(10, 720)
        first_seen = now - timedelta(days=account_age)
        if lifecycle == "active":
            days_since = random.choice([0, 0, 1, 2, 3, 5, 9, 14])
        else:
            days_since = random.randint(25, 200) if lifecycle in ("inactive", "churned") else random.randint(1, 45)
        last_activity = now - timedelta(days=days_since)

        tickets = generate_support_tickets_procedural(user_id, lifecycle, ltv)
        wdict = generate_wallet_procedural(lifecycle, ltv, last_activity)

        insert_user_bundle(
            db,
            user_id=user_id,
            email=f"{user_id}@rud-demo.local",
            name=f"Proc User {i}",
            acquisition_source=random.choice(ACQUISITION_SOURCES),
            lifecycle_stage=lifecycle,
            estimated_ltv=ltv,
            country=random.choice(COUNTRIES),
            first_seen_at=first_seen,
            last_activity_at=last_activity,
            wallet_data=wdict,
            tickets=tickets,
        )
        if (i + 1) % 50 == 0:
            db.commit()
            print(f"  ✓ {i + 1} procedural users…")
    db.commit()
    print(f"✅ Procedural seed complete ({count} users)")


def seed_users(db: Session, num_procedural: int = 388) -> None:
    """Personas first (fixed narratives), then coherent procedural rows."""
    random.seed(SEED_RANDOM_STATE)
    seed_demo_personas(db)
    seed_procedural_users(db, num_procedural)


def print_stats(db: Session) -> None:
    from sqlalchemy import func

    total_users = db.query(func.count(UserProfile.id)).scalar()
    total_wallets = db.query(func.count(Wallet.id)).scalar()
    high_value_users = db.query(func.count(UserProfile.id)).filter(UserProfile.lifecycle_stage == "high_value").scalar()
    critical_risks = db.query(func.count(RiskFlag.id)).filter(RiskFlag.severity == "critical").scalar()
    pending_actions_db = db.query(func.count(RecoveryAction.id)).filter(RecoveryAction.status == "pending").scalar()
    open_tickets = db.query(func.count(SupportTicket.id)).filter(SupportTicket.status == "open").scalar()

    print("\n📊 DATABASE STATISTICS:")
    print(f"  Total Users: {total_users}")
    print(f"  Wallets: {total_wallets}")
    print(f"  High-Value Users: {high_value_users}")
    print(f"  Critical Risk Flags: {critical_risks}")
    print(f"  Pending Recovery Actions: {pending_actions_db}")
    print(f"  Open Support Tickets: {open_tickets}")
    print(f"\n  Named demo IDs (sample): {', '.join(p['id'] for p in DEMO_PERSONAS[:4])}…")


if __name__ == "__main__":
    print("🚀 Starting database initialization…\n")
    init_db()
    db = SessionLocal()
    try:
        seed_campaigns(db)
        seed_users(db, num_procedural=388)
        print_stats(db)
        print("\n✅ Database seeding complete!")
    finally:
        db.close()
