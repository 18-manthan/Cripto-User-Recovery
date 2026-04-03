"""
Agentic Chatbot - Converts natural language queries to SQL and back
Uses Groq LLM for intelligent query generation and response formatting
"""

import os
import json
import logging
import re
from typing import Any, Callable, Dict, List, Optional, Tuple, Union
from datetime import datetime
from groq import Groq
from groq import APIConnectionError, AuthenticationError, APITimeoutError, RateLimitError
from sqlalchemy import text, inspect
from database import SessionLocal
from models import UserProfile, Wallet, RiskFlag, SupportTicket, RecoveryAction, Campaign

# Initialize Groq client
client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
logger = logging.getLogger(__name__)

# Database schema information
DATABASE_SCHEMA = """
Database Schema for RUD System:

Tables:
1. user_profiles (id, email, name, acquisition_source, lifecycle_stage, estimated_ltv, first_seen_at, last_activity_at, country, source_system, external_id, last_synced_at)
2. wallets (id, user_id, blockchain, balance_usd, wallet_age_days, transaction_count, activity_score, last_activity_at, source_system, external_id, last_synced_at)
3. risk_flags (id, user_id, flag_type, severity, description, detected_at, days_since_detection, source_system, external_id, last_synced_at)
4. support_tickets (id, user_id, subject, status, priority, category, created_at, last_updated, unresolved_days, source_system, external_id, last_synced_at)
5. recovery_actions (id, user_id, action_type, status, priority, reason, created_at, executed_at, estimated_recovery_value, source_system, external_id, last_synced_at)
6. campaigns (id, campaign_name, channel, spend_usd, conversions, revenue_usd, created_at, cpa, roi, source_system, external_id, last_synced_at)

Key Relationships:
- user_profiles 1:1 wallets
- user_profiles 1:many risk_flags
- user_profiles 1:many support_tickets
- user_profiles 1:many recovery_actions

Important Field Values:
- lifecycle_stage: onboarding, active, inactive, churned, high_value
- acquisition_source: twitter, discord, affiliate, paid_ads, organic, referral, content
- flag_type: onboarding_incomplete, inactivity, support_unresolved, compliance_issue, low_activity, unusual_behavior
- severity: critical, high, medium, low
- status (tickets): open, pending, resolved, escalated
- status (actions): pending, approved, executed, failed
- priority: critical, high, medium, low
- category (tickets): kyc_delay, withdrawal_issue, login_problem, transaction_error, compliance, account_locked, API_issue
- action_type: email_outreach, priority_support, workflow_trigger, account_review, incentive_offer
- channel: twitter, discord, affiliate, paid_ads, content, organic
"""

SYSTEM_PROMPT = """You are a SQL query generator for a High-Value User Recovery (RUD) system.
Your goal is to convert natural language questions into precise SQL queries.

Database Schema:
- user_profiles: id, email, name, lifecycle_stage, estimated_ltv, first_seen_at, last_activity_at, country, acquisition_source
- wallets: id, user_id, blockchain, balance_usd, wallet_age_days, transaction_count, activity_score, last_activity_at
- risk_flags: id, user_id, flag_type, severity, description, detected_at, days_since_detection
- support_tickets: id, user_id, subject, status, priority, category, created_at, last_updated, unresolved_days
- recovery_actions: id, user_id, action_type, status, priority, reason, estimated_recovery_value, created_at, executed_at
- campaigns: id, campaign_name, channel, spend_usd, conversions, revenue_usd, created_at, cpa, roi

Join rules:
- user_profiles.id is the user identifier in the main user table
- wallets.user_id, risk_flags.user_id, support_tickets.user_id, and recovery_actions.user_id all reference user_profiles.id
- Never use user_profiles.user_id because that column does not exist

Important values:
- lifecycle_stage: onboarding, active, inactive, churned, high_value
- severity: critical, high, medium, low
- flag_type: onboarding_incomplete, inactivity, support_unresolved, compliance_issue, low_activity, unusual_behavior
- status (tickets): open, pending, resolved, escalated
- status (actions): pending, approved, executed, failed
- priority: critical, high, medium, low
- category (tickets): kyc_delay, withdrawal_issue, login_problem, transaction_error, compliance, account_locked, API_issue
- action_type: email_outreach, priority_support, workflow_trigger, account_review, incentive_offer
- acquisition_source: twitter, discord, affiliate, paid_ads, organic, referral, content

COMMON QUERY PATTERNS:
1. Risk Analysis: "How many critical risks?" → COUNT where severity='critical'
2. User Lookup: "Show me [user_id] profile" → JOIN user_profiles with related tables
3. High-Value Users: "High value users" → WHERE lifecycle_stage='high_value'
4. Recovery Actions: "Pending actions" → WHERE status='pending'
5. Support Tickets: "Unresolved tickets" → WHERE status != 'resolved'
6. Statistics: "Total recovery potential" → SUM(estimated_recovery_value)
7. Breakdown: "Break down risk types" → GROUP BY flag_type with COUNT

RESPOND EXACTLY IN THIS FORMAT (no other text):
SQL_START
SELECT ...
SQL_END

EXPLANATION_START
Brief description of the query
EXPLANATION_END

Rules:
- Use valid SQLite syntax
- SELECT queries only
- Add LIMIT 1000
- Use exact format above
- For counts: use COUNT(DISTINCT user_id) when counting users
- For summaries: use SUM, AVG, COUNT appropriately
- Join tables when needed to get related data
"""


class RUDAgent:
    """Agent for querying the RUD database using natural language"""
    
    # Config for token optimization
    MAX_RESULTS_FOR_FORMATTING = 50  # Only send first 50 results to LLM
    MAX_RESULT_STRING_LENGTH = 2000  # Max characters for results JSON
    
    def __init__(self):
        self.client = client
        self.db = SessionLocal()
        self.allowed_keywords = {
            "user", "users", "profile", "profiles", "wallet", "wallets", "risk", "risks",
            "flag", "flags", "severity", "support", "ticket", "tickets", "recovery",
            "action", "actions", "campaign", "campaigns", "revenue", "spend", "roi",
            "ltv", "value", "high_value", "high-value", "inactive", "churned", "active",
            "onboarding", "critical", "high", "medium", "low", "pending", "approved",
            "executed", "failed", "kyc", "withdrawal", "login", "compliance", "database",
            "data", "sql", "count", "list", "show", "find", "which", "who", "total",
            "average", "avg", "breakdown", "summary", "status", "stages", "country",
            "acquisition", "source", "sources", "potential", "users", "records",
            "plan", "help", "demo",
        }
        self.blocked_patterns = [
            r"\bcapital\b",
            r"\bweather\b",
            r"\bnews\b",
            r"\bmovie\b",
            r"\bsong\b",
            r"\bcricket\b",
            r"\bfootball\b",
            r"\bpolitics\b",
            r"\bwho is\b",
            r"\bwhat is\b.*\b(country|india|delhi|world|planet)\b",
        ]
        self.abuse_markers = {
            "dumb", "useless", "fuck", "fucking", "shit", "bitch", "asshole"
        }

    def _safe_text_response(self, user_query: str, text_response: str) -> Dict[str, Any]:
        """Return a safe non-tabular response payload for chat."""
        return {
            "success": True,
            "query": user_query,
            "row_count": 0,
            "response": json.dumps({"text": text_response, "data": []}, default=str),
            "context": text_response
        }

    def _normalize_query(self, user_query: str) -> str:
        return re.sub(r"\s+", " ", user_query.lower()).strip()

    def _tokenize_query(self, user_query: str) -> List[str]:
        return re.findall(r"[a-zA-Z_]+(?:-[a-zA-Z_]+)?", user_query.lower())

    def is_abusive(self, user_query: str) -> bool:
        """Check whether the message is abusive or insulting."""
        normalized = self._normalize_query(user_query)
        return any(marker in normalized for marker in self.abuse_markers)

    def is_relevant_data_query(self, user_query: str) -> bool:
        """Allow only RUD/data-oriented questions through to SQL generation."""
        normalized = self._normalize_query(user_query)
        tokens = set(self._tokenize_query(normalized))

        if any(re.search(pattern, normalized) for pattern in self.blocked_patterns):
            return False

        if not tokens:
            return False

        if any(token in self.allowed_keywords for token in tokens):
            return True

        id_like_match = re.search(
            r"\b(user|account|investor|trader|holder|proc|demo)_[a-z0-9_]+\b",
            normalized,
        )
        email_like_match = re.search(r"\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b", normalized)
        if id_like_match or email_like_match:
            return True

        return False

    def _extract_sql_and_explanation(self, response_text: str) -> Dict[str, Any]:
        """Extract SQL and explanation from model output."""
        sql_query = None
        explanation = ""

        sql_start = response_text.find("SQL_START")
        sql_end = response_text.find("SQL_END")
        if sql_start != -1 and sql_end != -1:
            sql_query = response_text[sql_start + len("SQL_START"):sql_end].strip()

        exp_start = response_text.find("EXPLANATION_START")
        exp_end = response_text.find("EXPLANATION_END")
        if exp_start != -1 and exp_end != -1:
            explanation = response_text[exp_start + len("EXPLANATION_START"):exp_end].strip()

        if not sql_query and "SELECT" in response_text.upper():
            lines = response_text.split('\n')
            sql_lines = []
            in_sql = False
            for line in lines:
                if "SELECT" in line.upper():
                    in_sql = True
                if in_sql:
                    sql_lines.append(line)
                    if "LIMIT" in line.upper():
                        break
            if sql_lines:
                sql_query = ' '.join(sql_lines).strip()
                explanation = response_text[:response_text.find("SELECT")].strip()[:100]

        return {
            "sql_query": sql_query,
            "explanation": explanation or "Database query"
        }
    
    def get_schema_info(self) -> str:
        """Get detailed schema information from the database"""
        inspector = inspect(self.db.get_bind())
        schema_info = "Database Tables and Columns:\n"
        
        for table_name in inspector.get_table_names():
            columns = inspector.get_columns(table_name)
            schema_info += f"\nTable: {table_name}\n"
            for col in columns:
                col_type = str(col['type'])
                nullable = "NULL" if col['nullable'] else "NOT NULL"
                schema_info += f"  - {col['name']}: {col_type} {nullable}\n"
        
        return schema_info
    
    def _groq_data_error(self, exc: Exception, where: str) -> Dict[str, Any]:
        """Map Groq/client failures to actionable messages for operators."""
        if isinstance(exc, APIConnectionError):
            return {
                "sql_query": None,
                "error": (
                    "AI service unreachable (network/VPN/firewall or Groq outage). "
                    "Check you can reach the internet, try disabling VPN, "
                    "and confirm GROQ_API_KEY is set on the server. "
                    f"({where})"
                ),
            }
        if isinstance(exc, AuthenticationError):
            return {
                "sql_query": None,
                "error": "Groq rejected the API key. Set a valid GROQ_API_KEY in the environment and restart the server.",
            }
        if isinstance(exc, RateLimitError):
            return {
                "sql_query": None,
                "error": "Groq rate limit reached. Wait a minute and try again, or use a tier with higher limits.",
            }
        if isinstance(exc, APITimeoutError):
            return {
                "sql_query": None,
                "error": "Groq request timed out. Try a shorter question or try again.",
            }
        return {
            "sql_query": None,
            "error": f"{where}: {exc}",
        }

    def generate_sql(self, user_query: str) -> Dict[str, Any]:
        """Generate SQL query from natural language using Groq"""
        if not (os.getenv("GROQ_API_KEY") or "").strip():
            return {
                "sql_query": None,
                "error": "GROQ_API_KEY is not set. Add it to the server environment (e.g. backend/.env) and restart.",
            }
        try:
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_query}
                ],
                temperature=0.1,
                max_tokens=400
            )
            
            response_text = response.choices[0].message.content.strip()
            parsed = self._extract_sql_and_explanation(response_text)

            if parsed["sql_query"]:
                return {
                    "sql_query": parsed["sql_query"],
                    "explanation": parsed["explanation"]
                }
            else:
                return {
                    "sql_query": None,
                    "error": "Could not extract SQL query",
                    "explanation": response_text[:200]
                }
        
        except Exception as e:
            return self._groq_data_error(e, "Groq generate_sql")

    def refine_sql(self, user_query: str, failed_sql: str, execution_error: str) -> Dict[str, Any]:
        """Ask the model to repair an invalid SQL query using the schema and runtime error."""
        try:
            schema_info = self.get_schema_info()
            prompt = f"""The previous SQL query failed against SQLite.

User question:
{user_query}

Failed SQL:
{failed_sql}

Execution error:
{execution_error}

Use this schema to repair the query:
{schema_info}

Return a corrected SQLite SELECT query in the exact required format.
Keep the intent of the original question.
Do not mention the error in the answer.
Remember:
- user_profiles.id is the user key
- related tables use user_id to reference user_profiles.id
- SELECT only
- include LIMIT 1000
"""
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.0,
                max_tokens=500
            )
            response_text = response.choices[0].message.content.strip()
            parsed = self._extract_sql_and_explanation(response_text)

            if parsed["sql_query"]:
                return {
                    "sql_query": parsed["sql_query"],
                    "explanation": parsed["explanation"]
                }

            return {
                "sql_query": None,
                "error": "Could not repair SQL query",
                "explanation": response_text[:200]
            }
        except Exception as e:
            err = self._groq_data_error(e, "Groq refine_sql")
            err["error"] = err.get("error") or f"Error refining SQL: {e}"
            return err
    
    def execute_sql(self, sql_query: str) -> Dict[str, Any]:
        """Execute SQL query safely"""
        try:
            # Prevent dangerous operations
            danger_keywords = ["DROP", "DELETE", "INSERT", "UPDATE", "CREATE", "ALTER"]
            if any(keyword in sql_query.upper() for keyword in danger_keywords):
                return {
                    "error": "Only SELECT queries are allowed",
                    "results": []
                }
            
            # Execute query
            result = self.db.execute(text(sql_query))
            rows = result.fetchall()
            
            # Convert rows to dictionaries
            columns = result.keys() if result.keys() else []
            results = []
            for row in rows:
                results.append(dict(zip(columns, row)))
            
            return {
                "success": True,
                "row_count": len(results),
                "results": results[:1000]  # Limit to 1000 rows
            }
        
        except Exception as e:
            return {
                "error": f"SQL Execution Error: {str(e)}",
                "results": []
            }

    def generate_generalized_answer(self, user_query: str) -> str:
        """Return a safe, non-technical fallback answer when exact SQL retrieval fails."""
        try:
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "system",
                        "content": """You are a helpful analytics assistant.
Give a safe fallback answer when exact database retrieval is unavailable.
Do not mention SQL, schemas, exceptions, or technical failures.
Keep it short, clear, and helpful.
If possible, restate what the user is asking about in business language and suggest a slightly broader phrasing they can use next."""
                    },
                    {
                        "role": "user",
                        "content": f"User question: {user_query}"
                    }
                ],
                temperature=0.3,
                max_tokens=120
            )
            return response.choices[0].message.content.strip()
        except Exception:
            return (
                f"I couldn't retrieve the exact result for '{user_query}' just now, "
                "but I can still help with broader user recovery questions like critical actions, "
                "high-value users, or risk summaries."
            )
    
    def format_response(self, query_results: Dict[str, Any], user_query: str) -> str:
        """Generate natural language response using LLM"""
        
        row_count = query_results.get('row_count', 0)
        results = query_results.get('results', [])
        
        # Handle no results case
        if row_count == 0:
            return f"I couldn't find any results matching your query '{user_query}'. This could mean the data doesn't exist yet or try rephrasing your question differently."
        
        # Build a summary of results for LLM
        results_summary = json.dumps(results[:10])  # Limit to first 10 for context
        
        # Use LLM to generate natural language response
        try:
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a courteous analyst for a high-value user recovery (RUD) demo in a crypto context. "
                            "Given the user's question and JSON result rows, summarize using ONLY numbers and facts in that JSON — "
                            "do not invent counts, users, or severities. "
                            "Be concise (1–3 sentences), warm and professional, not robotic (avoid 'Found X record(s)')."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"""User's question: "{user_query}"
                        Query returned {row_count} result(s).
                        Data: {results_summary}
                        
                        Provide a natural language response to the user's question."""
                    }
                ],
                temperature=0.7,
                max_tokens=200
            )
            
            return response.choices[0].message.content.strip()
        
        except Exception as e:
            # Fallback to generic response if LLM fails
            return f"I found {row_count} result(s) for your query about '{user_query}'."

    def is_greeting_or_meta(self, user_query: str) -> Optional[Dict[str, Any]]:
        """Check if query is a greeting or meta-question that doesn't need database query"""
        
        query_lower = self._normalize_query(user_query)

        # Casual / wellbeing / thanks — phrase match first (before SQL or stiff guardrails)
        _wellbeing = (
            "I'm doing well, thank you for asking — and I hope you're having a good day as well. "
            "I'm here to help you work through this RUD demo the way a retention or risk team might look at a crypto exchange or "
            "custody book: balances, activity, tickets, and who probably deserves a careful, personal touch. "
            "Whenever you're ready, ask about risk flags, a user id, recovery actions, or portfolio-style metrics."
        )
        _thanks = (
            "You're very welcome — happy to help. "
            "If you'd like to go deeper, we could look at high-value users at-risk, open compliance or withdrawal tickets, "
            "or recovery potential in this demo dataset."
        )
        phrase_replies: List[
            Tuple[re.Pattern[str], Union[str, Callable[[Any], str]]]
        ] = [
            (
                re.compile(r"^how(\s+are|\s+['']?re)\s+you(\s+doing)?\??$"),
                _wellbeing,
            ),
            (
                re.compile(
                    r"^(hi|hey|hello|yo)[,!. ]*\s*(there|buddy|friend|pal|mate)?\s*[!.?]*$"
                ),
                "Hello — good to connect. "
                "I'm here for this high-value user recovery workspace: on-chain-style balances and activity, risk flags, "
                "and the sort of follow-ups operators use when markets are noisy and churn is costly. "
                "What would you like to explore first — for example critical risks, inactive whales, or a named demo user?",
            ),
            (
                re.compile(r"^(what\'?s\s+up|sup)\??$"),
                "Not much on my side except being ready to help with your RUD data. "
                "Ask me about users, wallets, risk severity, tickets, or recovery actions — whatever fits what you're trying to prove in the demo.",
            ),
            (
                re.compile(r"^(good\s+(morning|afternoon|evening))\b"),
                lambda m: (
                    f"{m.group(1).capitalize()} — thank you for stopping by. "
                    "I'm here to support questions about this recovery dashboard: user health, flags, and next best actions. "
                    "Where would you like to start?"
                ),
            ),
            (
                re.compile(r"^thank(s| you)\b"),
                _thanks,
            ),
            (
                re.compile(r"^(cheers|appreciate it|much appreciated)\b"),
                _thanks,
            ),
        ]
        for pattern, reply in phrase_replies:
            m = pattern.search(query_lower)
            if m:
                text = reply(m) if callable(reply) else reply
                meta_payload = self._safe_text_response(user_query, text)
                meta_payload["is_meta"] = True
                return meta_payload
        
        # Greetings and meta questions
        greeting_responses = {
            # Greetings
            'hello': "Hello — I'm glad you're here. I can help you interpret this RUD demo like a trading or growth team reviewing at-risk accounts: who's dormant, who's flagged, and where recovery spend might earn its keep.",
            'hi': "Hi — lovely to hear from you. Ask me about users, risk flags, recovery actions, or campaign performance in this dataset, in whatever order suits you.",
            'hey': "Hey there. I'm tuned for this recovery console — think flows, balances, ticket queues, and who needs priority handling when volatility picks up.",
            'greetings': "Greetings. I'm here to make this demo database easy to read: summaries, lookups, and a clear picture of exposure and opportunity.",
            
            # Meta questions about my capabilities
            'what can you do': "I can help you with:\n• Risk analysis — critical and high-severity flags\n• User context — lifecycle, LTV, acquisition, geography\n• Wallet-style signals — balances, activity, throughput (as modeled here)\n• Recovery actions — pending, approved, and value at stake\n• Support tickets — backlog and categories such as KYC or withdrawals\n• Metrics — counts, breakdowns, and high-value segments",
            'what do you do': "I turn plain-language questions into SQL against this demo, then summarize what matters — similar to how teams interrogate a warehouse before deciding who to call or waive fees for. Ask naturally; I'll stay polite and data-grounded.",
            'help': "You might try:\n• 'How many critical risk flags are there?'\n• 'Show high-value inactive users'\n• 'Open compliance or withdrawal tickets'\n• 'Tell me about demo_elena_highvalue_withdrawal'\n\nI'll answer from the database and keep explanations steady and respectful.",
            'capabilities': "I focus on: risk severity, user and wallet snapshots, recovery pipelines, tickets, campaigns, and roll-ups — the operational side of keeping valuable traders and holders engaged.",
            'commands': "No special commands needed — just ask. Examples: critical risk count, pending actions, users above an LTV threshold, or a specific user id.",
            'examples': "For example:\n• Counts and breakdowns of flags or stages\n• Lists of users worth a white-glove path\n• A single-user snapshot with suggested (demo-only) next steps\n\nPick whatever helps your narrative.",
        }
        
        # Check for exact matches (for common greetings)
        for trigger, response in greeting_responses.items():
            if query_lower == trigger:
                meta_payload = self._safe_text_response(user_query, response)
                meta_payload["is_meta"] = True
                return meta_payload
        
        return None

    def handle_guardrails(self, user_query: str) -> Optional[Dict[str, Any]]:
        """Return a safe response for abusive or off-topic queries."""
        normalized = self._normalize_query(user_query)

        if self.is_abusive(normalized):
            return self._safe_text_response(
                user_query,
                "I'd like to keep things respectful — I'm here for your RUD demo questions. "
                "If you're open to it, we could look at users, risk flags, recovery actions, tickets, or campaign metrics instead."
            )

        if not self.is_relevant_data_query(normalized):
            return self._safe_text_response(
                user_query,
                "I specialise in this RUD workspace — think high-value user retention in a crypto-native context: "
                "balances and activity as we model them, ticket queues, risk flags, and recovery plays. "
                "I don't have much to add outside that, but if you point me at a metric, a segment, or a user id in this demo, "
                "I'll walk through it carefully with you."
            )

        return None
    
    def query(self, user_query: str, session_token: Optional[str] = None) -> Dict[str, Any]:
        """Playbooks (verified SQL), then NL→SQL; structured insights + session memory."""
        from playbooks import try_playbook, build_structured_extras, extract_user_id
        from chat_session import session_get, session_update, session_augment_query

        meta_response = self.is_greeting_or_meta(user_query)
        if meta_response:
            return meta_response

        guardrail_response = self.handle_guardrails(user_query)
        if guardrail_response:
            return guardrail_response

        session = session_get(session_token) if session_token else {}
        playbook_id: Optional[str] = None
        playbook_params: Dict[str, Any] = {}

        pb_sql, pb_id, pb_params = try_playbook(user_query, session)
        if pb_sql:
            sql_result = {"sql_query": pb_sql, "explanation": f"playbook:{pb_id}"}
            playbook_id = pb_id
            playbook_params = pb_params
        else:
            augmented = session_augment_query(session_token, user_query)
            sql_result = self.generate_sql(augmented)
        
        if "error" in sql_result or sql_result.get("sql_query") is None:
            polite_error = f"I apologize, but I had difficulty understanding your query. Could you please rephrase it? For example:\n• 'How many critical risk flags are there?'\n• 'Show me high-value users'\n• 'What recovery actions are pending?'\n\nOr ask for 'help' to see what I can do!"
            return {
                "success": False,
                "query": user_query,
                "response": polite_error,
                "error": sql_result.get("error", "Failed to generate SQL"),
                "explanation": sql_result.get("explanation", "")
            }
        
        sql_query = sql_result["sql_query"]

        # Step 2: Execute SQL, then attempt one repair pass if it fails
        attempted_sql = [sql_query]
        execution_result = self.execute_sql(sql_query)

        if "error" in execution_result and not execution_result.get("success"):
            logger.warning("Initial SQL failed for query '%s': %s", user_query, execution_result.get("error"))
            refined_result = self.refine_sql(
                user_query=user_query,
                failed_sql=sql_query,
                execution_error=execution_result.get("error", "")
            )

            refined_sql = refined_result.get("sql_query")
            if refined_sql and refined_sql not in attempted_sql:
                attempted_sql.append(refined_sql)
                refined_execution = self.execute_sql(refined_sql)
                if refined_execution.get("success"):
                    sql_query = refined_sql
                    execution_result = refined_execution
                else:
                    logger.warning(
                        "Refined SQL also failed for query '%s': %s",
                        user_query,
                        refined_execution.get("error")
                    )
                    execution_result = refined_execution

        if "error" in execution_result and not execution_result.get("success"):
            fallback_text = self.generate_generalized_answer(user_query)
            combined_response = {
                "text": fallback_text,
                "data": [],
                "insights": ["Query could not be executed; try rephrasing or check SQL below."],
                "suggested_actions": [],
                "playbook_id": playbook_id,
                "focus_user_id": playbook_params.get("user_id") or extract_user_id(user_query),
            }
            return {
                "success": True,
                "query": user_query,
                "sql_query": attempted_sql[-1],
                "row_count": 0,
                "response": json.dumps(combined_response, default=str),
                "context": fallback_text,
                "playbook_id": playbook_id,
            }
        
        raw_results = execution_result.get("results", [])
        if playbook_id:
            # No separate LLM "story" — avoids duplicate / contradictory prose; insights + table are canonical.
            formatted_response = ""
        else:
            formatted_response = self.format_response(execution_result, user_query)

        insights, suggested_actions = build_structured_extras(
            playbook_id, playbook_params, raw_results, user_query
        )

        focus = playbook_params.get("user_id")
        if not focus and raw_results:
            for row in raw_results:
                if isinstance(row, dict) and row.get("user_id"):
                    focus = row["user_id"]
                    break
        if not focus:
            focus = extract_user_id(user_query)
        if session_token:
            session_update(
                session_token,
                focus_user_id=focus,
                last_query=user_query,
                last_sql=sql_query,
                playbook_id=playbook_id,
            )

        combined_response = {
            "text": formatted_response,
            "data": raw_results,
            "insights": insights,
            "suggested_actions": suggested_actions,
            "playbook_id": playbook_id,
            "focus_user_id": focus,
        }
        combined_response_json = json.dumps(combined_response, default=str)

        return {
            "success": True,
            "query": user_query,
            "sql_query": sql_query,
            "row_count": execution_result.get("row_count", 0),
            "response": combined_response_json,
            "context": formatted_response,
            "playbook_id": playbook_id,
        }
    
    def close(self):
        """Close database session"""
        self.db.close()


# Global agent instance
_agent = None

def get_agent() -> RUDAgent:
    """Get or create the agent instance"""
    global _agent
    if _agent is None:
        _agent = RUDAgent()
    return _agent

def query_agent(user_query: str, session_token: Optional[str] = None) -> Dict[str, Any]:
    agent = get_agent()
    return agent.query(user_query, session_token=session_token)
