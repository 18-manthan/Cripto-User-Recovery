# RUD (High-Value User Recovery Engine) - AI Chat Feature Documentation

## Overview

This project now includes an **Agentic Chatbot** that allows users to ask natural language questions about the database. The system intelligently converts natural language queries to SQL, executes them, and presents results in a human-readable format.

## Architecture

### System Flow

```
User Query (Natural Language)
    ↓
[OpenAI] - NL to SQL Conversion
    ↓
SQL Query Execution (SQLite or Postgres)
    ↓
[OpenAI] - Results to Natural Language
    ↓
User Response (Natural Language)
```

## Components

### Backend (Python/FastAPI)

#### 1. **agent.py** - Core Agentic Logic
The agent module handles all NL↔SQL conversion and database operations.

**Key Classes:**
- `RUDAgent`: Main agent class that orchestrates the entire pipeline
  - `generate_sql()`: Converts natural language to SQL using OpenAI
  - `execute_sql()`: Safely executes SQL queries on the database
  - `format_response()`: Converts query results back to natural language
  - `query()`: Main orchestration method

**Features:**
- Database schema awareness - agent knows all tables and columns
- SQL safety validation - prevents dangerous operations (DROP, DELETE, etc.)
- Conversation history tracking - maintains context between queries
- Error handling and graceful fallbacks

#### 2. **main.py** - FastAPI Integration
New endpoint added: `POST /api/chat`

**Request Model:**
```json
{
    "query": "natural language question about the database"
}
```

**Response Model:**
```json
{
    "success": true,
    "query": "user's original query",
    "response": "natural language answer",
    "sql_query": "generated SQL (for reference)",
    "row_count": 42,
    "error": null
}
```

### Frontend (HTML/CSS/JavaScript)

#### 1. **Chat UI Panel** (index.html)
- New "AI Chat" navigation menu item
- Chat message display area with scrolling
- Input field with send button
- Support for markdown and code display

#### 2. **Chat JavaScript** (script.js)
Functions added:
- `setupChatInterface()`: Initializes chat event listeners
- `sendChatMessage()`: Sends user query to backend
- `createChatMessage()`: Renders messages in UI
- `escapeHtml()`: Prevents XSS attacks

#### 3. **Chat Styling** (style.css)
- Modern neon-themed chat interface matching the RUD design
- Animated typing indicator
- Syntax highlighting for SQL queries
- Responsive design for mobile
- Smooth animations and transitions

## Usage

### Setup

1. **Get OpenAI API Key**
   - Create an API key in your OpenAI account

2. **Configure Environment**
   - Copy `.env.example` to `.env`
   - Add your OpenAI API key:
     ```
     OPENAI_API_KEY=your_key_here
     OPENAI_MODEL=gpt-4o-mini
     ```
   - Configure Postgres (required):
     ```
     DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/DBNAME
     ```

3. **Install Dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

4. **Run the Server**
   ```bash
   cd backend
   python main.py
   ```

5. **Access Dashboard**
   - Open http://localhost:8000
   - Click "AI Chat" in the navigation menu

### Example Queries

The agent can answer various types of queries:

**User Statistics:**
- "How many users are in onboarding stage?"
- "Show me all high-value users"
- "Count users from each country"

**Risk Analysis:**
- "What are the critical risk flags?"
- "How many users have unresolved support tickets?"
- "Show me inactive users with high LTV"

**Recovery Actions:**
- "Which recovery actions have the highest estimated value?"
- "List all pending approval actions"
- "How many actions have been executed?"

**Campaign Performance:**
- "What's the ROI for each channel?"
- "Which campaign has the lowest CPA?"
- "Show me conversions by channel"

**Complex Queries:**
- "Find high-value users that became inactive in the last 30 days"
- "Show recovery actions grouped by user lifecycle stage with their total value"
- "List users with critical risk flags that haven't been contacted yet"

## How It Works

### 1. Query Generation
```python
# User asks: "How many critical risk flags are there?"
# Agent generates:
SELECT COUNT(*) as count FROM risk_flags WHERE severity = 'critical'
```

### 2. SQL Execution
- Query is validated for safety
- Executed against SQLite database
- Results are capped at 1000 rows to prevent huge datasets

### 3. Response Formatting
```python
# Raw results: [{"count": 42}]
# Agent formats to:
"I found 42 critical risk flags in the system. These represent the highest 
priority recovery opportunities that require immediate attention."
```

## Database Schema Reference

The agent has access to the following tables:

| Table | Key Columns |
|-------|------------|
| **user_profiles** | id, email, name, lifecycle_stage, estimated_ltv, first_seen_at, country |
| **wallets** | id, user_id, balance_usd, transaction_count, activity_score |
| **risk_flags** | id, user_id, flag_type, severity, description, days_since_detection |
| **support_tickets** | id, user_id, subject, status, priority, category, unresolved_days |
| **recovery_actions** | id, user_id, action_type, status, priority, estimated_recovery_value |
| **campaigns** | id, campaign_name, channel, spend_usd, conversions, revenue_usd, roi |

## Security Considerations

### Query Safety
- Only SELECT operations are permitted
- Prevents: DROP, DELETE, INSERT, UPDATE, CREATE, ALTER
- Queries are validated before execution

### API Key Protection
- Groq API key stored in environment variables
- Never transmitted to frontend
- All LLM calls happen server-side

### Data Privacy
- Results limited to 1000 rows
- No sensitive data exposed in error messages
- Chat history only stored in memory per session

## Advanced Features

### 1. Conversation Context
The agent maintains conversation history, allowing follow-up questions:
- User: "Show me critical risk flags"
- Agent: [displays results]
- User: "How many are from inactive users?"
- Agent: [understands context from previous query]

### 2. SQL Query Reference
Every chat response displays the generated SQL query in a collapsible section, allowing operators to:
- Verify the agent's logic
- Learn SQL patterns
- Create custom reports based on agent queries

### 3. Error Handling
- Graceful fallbacks if LLM fails
- Clear error messages
- Automatic retry mechanisms

## Troubleshooting

### "OPENAI_API_KEY not found"
- Ensure `.env` file exists in backend directory
- Set `OPENAI_API_KEY` environment variable
- Restart the server

### "Connection error to OpenAI"
- Check internet connection
- Verify API key is valid
- Check OpenAI service status

### Agent generates invalid SQL
- Try rephrasing the question
- Use more specific field names
- Ask simpler questions first

### No results returned
- Agent may have generated correct SQL that returns 0 rows
- Check if data exists for your query
- Try broader queries first

## Model Used

The chatbot uses Groq's **Mixtral-8x7b-32768** model:
- **Speed**: ~80 tokens/sec (very fast)
- **Context**: 32,768 tokens
- **Cost**: Free tier available
- **Performance**: Excellent for SQL generation and text processing

## Future Enhancements

Potential additions to the chat system:

1. **Data Visualization**: Generate charts from query results
2. **Scheduled Reports**: "Show me critical risks every Monday"
3. **Multi-turn Analysis**: Deeper exploration of specific user cohorts
4. **Custom Alerts**: "Notify me when X happens"
5. **Natural Language Explanations**: More detailed business insights
6. **Query Templates**: Save and reuse common queries
7. **Export Functionality**: Download results as CSV/PDF
8. **Analytics**: Track popular queries and insights

## Performance Notes

- Initial query: 2-5 seconds (includes LLM processing)
- Subsequent queries: 1-3 seconds (faster cold start)
- Response time depends on:
  - Database query complexity
  - Groq API latency
  - Result set size

## Support and Debugging

Enable verbose logging in `agent.py`:
```python
# Change in agent.py
echo=True  # Set to True in create_engine()
```

This will print all SQL queries being executed, helping identify issues.

---

**Built with**: FastAPI, OpenAI, SQLAlchemy, JavaScript
**Version**: 1.0.0
**Last Updated**: April 2, 2026
