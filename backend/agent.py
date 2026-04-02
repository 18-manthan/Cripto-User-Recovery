"""
Agentic Chatbot - Converts natural language queries to SQL and back
Uses Groq LLM for intelligent query generation and response formatting
"""

import os
import json
from typing import Dict, List, Any, Optional
from datetime import datetime
from groq import Groq
from sqlalchemy import text, inspect
from database import SessionLocal
from models import UserProfile, Wallet, RiskFlag, SupportTicket, RecoveryAction, Campaign

# Initialize Groq client
client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

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
- acquisition_source: twitter, discord, affiliate, paid_ads, organic
- flag_type: onboarding_incomplete, inactivity, support_ticket, compliance, low_activity
- severity: critical, high, medium, low
- status (tickets): open, pending, resolved, escalated
- status (actions): pending, approved, executed, failed
- priority: critical, high, medium, low
- category (tickets): kyc_delay, withdrawal_issue, login_problem, transaction_error, compliance
- action_type: email_outreach, priority_support, workflow_trigger, account_review, incentive_offer
- channel: twitter, discord, affiliate, paid_ads, content, organic
"""

SYSTEM_PROMPT = """You are a SQL query generator for a High-Value User Recovery (RUD) system.

Database Schema:
- user_profiles: id, email, name, lifecycle_stage, estimated_ltv, first_seen_at, last_activity_at, country
- wallets: id, user_id, balance_usd, transaction_count, activity_score, last_activity_at
- risk_flags: id, user_id, flag_type, severity, description, detected_at, days_since_detection
- support_tickets: id, user_id, subject, status, priority, category, created_at, unresolved_days
- recovery_actions: id, user_id, action_type, status, priority, estimated_recovery_value, created_at
- campaigns: id, campaign_name, channel, spend_usd, conversions, revenue_usd, cpa, roi

Important values:
- lifecycle_stage: onboarding, active, inactive, churned, high_value
- severity: critical, high, medium, low
- status: open, pending, resolved, escalated, executed, approved, failed

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
"""


class RUDAgent:
    """Agent for querying the RUD database using natural language"""
    
    # Config for token optimization
    MAX_RESULTS_FOR_FORMATTING = 50  # Only send first 50 results to LLM
    MAX_RESULT_STRING_LENGTH = 2000  # Max characters for results JSON
    
    def __init__(self):
        self.client = client
        self.db = SessionLocal()
    
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
    
    def generate_sql(self, user_query: str) -> Dict[str, Any]:
        """Generate SQL query from natural language using Groq"""
        
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
            
            # Parse text-based format
            sql_query = None
            explanation = ""
            
            # Extract SQL between markers
            sql_start = response_text.find("SQL_START")
            sql_end = response_text.find("SQL_END")
            if sql_start != -1 and sql_end != -1:
                sql_query = response_text[sql_start + len("SQL_START"):sql_end].strip()
            
            # Extract explanation between markers
            exp_start = response_text.find("EXPLANATION_START")
            exp_end = response_text.find("EXPLANATION_END")
            if exp_start != -1 and exp_end != -1:
                explanation = response_text[exp_start + len("EXPLANATION_START"):exp_end].strip()
            
            # If no markers found, try to extract SQL directly
            if not sql_query:
                if "SELECT" in response_text.upper():
                    # Find SELECT and extract until LIMIT or end
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
            
            if sql_query:
                return {
                    "sql_query": sql_query,
                    "explanation": explanation or "Database query"
                }
            else:
                return {
                    "sql_query": None,
                    "error": "Could not extract SQL query",
                    "explanation": response_text[:200]
                }
        
        except Exception as e:
            return {
                "sql_query": None,
                "error": f"Error: {str(e)}"
            }
    
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
    
    def format_response(self, query_results: Dict[str, Any], user_query: str) -> str:
        """Format query results into a polite, human-like natural language response"""
        
        # Get results and limit to prevent token bloat
        results = query_results.get('results', [])
        row_count = query_results.get('row_count', 0)
        
        # Only format first N results
        results_to_format = results[:self.MAX_RESULTS_FOR_FORMATTING]
        
        # Convert to JSON string representation
        results_json = json.dumps(results_to_format, indent=1, default=str)
        if len(results_json) > self.MAX_RESULT_STRING_LENGTH:
            results_json = results_json[:self.MAX_RESULT_STRING_LENGTH] + "\n... (truncated)"
        
        # Create context for LLM to format nicely
        if row_count == 0:
            context = f"User asked: {user_query}\nResult: No data found for this query."
        else:
            context = f"User asked: {user_query}\n\nData found: {row_count} records\n{results_json}"
        
        # Use LLM to format into a polite, human-like response
        try:
            response = self.client.chat.completions.create(
                model="mixtral-8x7b-32768",
                messages=[
                    {
                        "role": "system",
                        "content": """You are a friendly and professional RUD (High-Value User Recovery) assistant. 
Your job is to answer questions about user data, risks, and recovery actions in a polite, conversational manner.

Guidelines:
1. Be warm and professional - speak like you're helping a colleague
2. Start with a brief, direct answer to their question
3. Provide key insights from the data (highlight important patterns)
4. If there are important findings, point them out
5. Be specific with numbers and facts
6. If appropriate, offer helpful next steps or recommendations
7. Keep it concise but informative
8. Use friendly language, not robotic

If no results found, offer helpful suggestions on how they could rephrase their query."""
                    },
                    {"role": "user", "content": context}
                ],
                temperature=0.7,
                max_tokens=700
            )
            
            return response.choices[0].message.content
        
        except Exception as e:
            # Polite fallback response
            if row_count == 0:
                return f"I looked into that for you, but unfortunately I didn't find any results matching '{user_query}'. \n\nWould you like to try a different query? You can ask about:\n• Risk flags (critical, high, medium, low severity)\n• User profiles and their stages\n• Recovery actions and statuses\n• Support tickets and issues"
            else:
                return f"Great! I found {row_count} record(s) for you:\n\n{results_json}\n\nLet me know if you'd like more details about any of these results!"
    
    def query(self, user_query: str) -> Dict[str, Any]:
        """Main query method - converts NL -> SQL -> Results -> NL"""
        
        # Step 1: Generate SQL
        sql_result = self.generate_sql(user_query)
        
        if "error" in sql_result or sql_result.get("sql_query") is None:
            polite_error = f"I apologize, but I had difficulty understanding your query. Could you please rephrase it? For example:\n• 'How many critical risk flags are there?'\n• 'Show me high-value users'\n• 'What recovery actions are pending?'"
            return {
                "success": False,
                "query": user_query,
                "response": polite_error,
                "error": sql_result.get("error", "Failed to generate SQL"),
                "explanation": sql_result.get("explanation", "")
            }
        
        sql_query = sql_result["sql_query"]
        
        # Step 2: Execute SQL
        execution_result = self.execute_sql(sql_query)
        
        if "error" in execution_result and not execution_result.get("success"):
            polite_error = f"I encountered a technical issue while processing your request. The issue was: {execution_result.get('error')}\n\nCould you try rephrasing your question?"
            return {
                "success": False,
                "query": user_query,
                "response": polite_error,
                "sql_query": sql_query,
                "error": execution_result.get("error")
            }
        
        # Step 3: Format response
        formatted_response = self.format_response(execution_result, user_query)
        
        return {
            "success": True,
            "query": user_query,
            "sql_query": sql_query,
            "row_count": execution_result.get("row_count", 0),
            "response": formatted_response,
            "raw_results": execution_result.get("results", [])
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
