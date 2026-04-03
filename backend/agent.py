"""
Agentic Chatbot - Converts natural language queries to SQL and back
Uses Groq LLM for intelligent query generation and response formatting
"""

import os
import json
import logging
import re
from typing import Dict, List, Any, Optional
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
            "data", "sql", "count", "list", "show", "find", "which", "who", "how", "total",
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
            "chutiya", "chutiyaa", "madarchod", "bhosdike", "idiot", "stupid",
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
                        "content": """You are a helpful database assistant. When given a user's query and the results from that query, 
                        provide a natural, conversational response that:
                        1. Directly answers their question
                        2. Highlights key insights from the data
                        3. Is friendly and professional
                        4. Uses natural language (not "Found X records")
                        5. For single numeric values, just state the number naturally
                        6. For tables/lists, summarize what they show
                        Keep responses concise (1-3 sentences)."""
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
        
        # Greetings and meta questions
        greeting_responses = {
            # Greetings
            'hello': "👋 Hello! I'm your RUD AI Assistant. How can I help you with your user recovery data today?",
            'hi': "👋 Hi there! What would you like to know about your users and recovery actions?",
            'hey': "👋 Hey! Ask me anything about risk flags, users, or recovery actions.",
            'greetings': "👋 Greetings! I'm here to help you analyze your user recovery system.",
            
            # Meta questions about my capabilities
            'what can you do': "I can help you with:\n🔍 Risk Analysis - Find critical/high risks\n👥 User Profiles - Look up user details\n💎 High-Value Users - Identify top users at risk\n⚡ Recovery Actions - Check pending approvals\n📊 Statistics - Get aggregate metrics\n🎯 Strategy - Recommend recovery approaches",
            'what do you do': "I'm an AI assistant that converts your natural language questions into SQL queries and presents results beautifully. I can help with risk analysis, user profiles, recovery actions, and more!",
            'help': "You can ask me about:\n• Risk flags and severity levels\n• User profiles and lifecycle stages\n• Recovery actions and their status\n• Support tickets and issues\n• Statistics and breakdowns\n• Recovery strategies\n\nJust ask naturally like 'Show me critical risks' or 'How many users are inactive?'",
            'capabilities': "My capabilities include:\n✅ Risk Analysis (critical, high, medium, low)\n✅ User Lookups (by ID, email, or stage)\n✅ High-Value User Lists\n✅ Recovery Action Tracking\n✅ Support Ticket Monitoring\n✅ Statistical Analysis\n✅ Strategy Recommendations",
            'commands': "Just ask naturally! Examples:\n• 'How many critical risks?'\n• 'Show me high-value users'\n• 'What recovery actions are pending?'\n• 'List users with inactivity risks'\n• 'Show me abandoned users'\n• 'What's my total recovery potential?'",
            'examples': "Try asking:\n📊 'How many critical risk flags are there?'\n👥 'Show me user_onboarding_000 profile'\n💎 'Which users have the highest recovery potential?'\n⚡ 'What recovery actions are pending?'\n📈 'What's the total recovery potential?'\n🎯 'What recovery actions are approved?'",
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
                "I can help with RUD dashboard questions, but I can’t assist with abusive messages. Ask me about users, risk flags, recovery actions, support tickets, or campaign metrics."
            )

        if not self.is_relevant_data_query(normalized):
            return self._safe_text_response(
                user_query,
                "I’m focused only on your RUD data and recovery dashboard. Ask me about users, wallets, risk flags, support tickets, recovery actions, campaigns, or metrics like high-value users and critical priorities."
            )

        return None
    
    def query(self, user_query: str) -> Dict[str, Any]:
        """Main query method - converts NL -> SQL -> Results -> NL"""
        
        # Step 0: Check if this is a greeting or meta question
        meta_response = self.is_greeting_or_meta(user_query)
        if meta_response:
            return meta_response

        # Step 0.5: Apply topic and behavior guardrails before SQL generation
        guardrail_response = self.handle_guardrails(user_query)
        if guardrail_response:
            return guardrail_response
        
        # Step 1: Generate SQL
        sql_result = self.generate_sql(user_query)
        
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
                "data": []
            }
            return {
                "success": True,
                "query": user_query,
                "sql_query": attempted_sql[-1],
                "row_count": 0,
                "response": json.dumps(combined_response, default=str),
                "context": fallback_text
            }
        
        # Step 3: Generate natural language response
        formatted_response = self.format_response(execution_result, user_query)
        
        # Step 4: Convert raw results to JSON for frontend formatting
        raw_results = execution_result.get("results", [])
        results_json = json.dumps(raw_results, default=str)
        
        # Create a combined response: natural language + raw JSON for tables
        combined_response = {
            "text": formatted_response,
            "data": raw_results
        }
        combined_response_json = json.dumps(combined_response, default=str)
        
        return {
            "success": True,
            "query": user_query,
            "sql_query": sql_query,
            "row_count": execution_result.get("row_count", 0),
            "response": combined_response_json,  # Send both text and data
            "context": formatted_response  # Also keep formatted text for backward compatibility
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

def query_agent(user_query: str) -> Dict[str, Any]:
    """Simple function to query the agent"""
    agent = get_agent()
    return agent.query(user_query)
