"""
In-memory chat session state per authenticated dashboard token.
Demo scope: focus user + last query/sql for follow-ups.
"""

from typing import Any, Dict, Optional

# token -> state
_SESSIONS: Dict[str, Dict[str, Any]] = {}


def session_get(token: str) -> Dict[str, Any]:
    if token not in _SESSIONS:
        _SESSIONS[token] = {
            "focus_user_id": None,
            "last_query": None,
            "last_sql": None,
            "playbook_id": None,
        }
    return _SESSIONS[token]


def session_update(token: str, **kwargs: Any) -> None:
    s = session_get(token)
    for k, v in kwargs.items():
        if v is not None or k in ("focus_user_id",):  # allow explicit clear with ""
            if v == "":
                s[k] = None
            else:
                s[k] = v


def session_augment_query(token: Optional[str], user_query: str) -> str:
    """Inject short context for the LLM when follow-up refers to last user."""
    if not token:
        return user_query
    s = session_get(token)
    focus = s.get("focus_user_id")
    if not focus:
        return user_query
    q = user_query.lower()
    follow_terms = (
        "they",
        "them",
        "this user",
        "same user",
        "that user",
        "recovery plan",
        "next step",
        "what should",
        "how can we",
        "help me with",
    )
    if any(t in q for t in follow_terms):
        return (
            f"[Session context: primary user_id is {focus}. Use this user when the question is ambiguous.]\n"
            f"{user_query}"
        )
    return user_query
