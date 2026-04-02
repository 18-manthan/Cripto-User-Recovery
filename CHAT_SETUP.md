# RUD AI Chat - Quick Start Guide

## What's New

Your RUD dashboard now has an **AI-powered chat interface** that lets you ask natural language questions about your data. The system automatically converts your questions to SQL, executes them, and gives you clear answers.

## Quick Setup (5 minutes)

### Step 1: Get Groq API Key
1. Go to https://console.groq.com/keys
2. Sign up (free) or sign in
3. Copy your API key

### Step 2: Configure Environment
1. In the backend folder, create a `.env` file:
```bash
GROQ_API_KEY=your_api_key_here
```

Or copy from the example:
```bash
cp .env.example .env
# Then edit .env and add your API key
```

### Step 3: Start the Server
```bash
cd backend
python3 main.py
```

### Step 4: Open Dashboard
- Go to http://localhost:8000
- Click "AI Chat" in the left menu
- Start asking questions!

## Example Questions to Try

```
💬 "How many critical risk flags are there?"
💬 "Show me all high-value inactive users"
💬 "What's the total recovery potential?"
💬 "List users from each country"
💬 "Which channels have the best ROI?"
💬 "Show me users with unresolved support tickets"
```

## How It Works (Under the Hood)

1. **You ask a question** → Agent reads your Natural Language
2. **NL to SQL** → Groq LLM converts to SQL (using database schema)
3. **SQL Execution** → Query runs against your SQLite database
4. **SQL to NL** → Results converted back to readable answer
5. **Display** → You see the answer + the SQL query used

## Key Features

✅ **Natural Language Processing** - Ask questions like you're talking to a human  
✅ **SQL Generation** - Agent generates correct SQL queries automatically  
✅ **Safety First** - Only SELECT queries allowed, no dangerous operations  
✅ **Conversation Context** - Agent remembers previous questions  
✅ **SQL Reference** - See generated SQL in collapsible details  
✅ **Fast** - Uses Groq for super-fast inference (80 tokens/sec)  

## Database Tables Available

The agent can query these 6 tables:

| Table | Purpose |
|-------|---------|
| **user_profiles** | User info, stage, LTV, acquisition source |
| **wallets** | Balance, transactions, activity score |
| **risk_flags** | Risk indicators and severity |
| **support_tickets** | Customer issues and status |
| **recovery_actions** | Planned/executed recovery steps |
| **campaigns** | Marketing performance by channel |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "GROQ_API_KEY not found" | Add it to `.env` file and restart |
| Agent can't find data | Try simpler questions first |
| "Invalid SQL syntax" | Rephrase using different wording |
| No API key free tier | Sign up at groq.com (free includes limits) |

## Pro Tips

🚀 **Ask specific questions** - "Top 10 users by LTV" works better than just "users"  
🚀 **Use SQL details** to learn patterns and create custom reports  
🚀 **Follow-up questions** work - agent remembers context  
🚀 **Mix filters** - combine user stage + risk severity + location  

## API Endpoint Reference

### Chat Endpoint
```
POST /api/chat
Content-Type: application/json

{
    "query": "your question here"
}

Response:
{
    "success": true,
    "query": "your question",
    "response": "natural language answer",
    "sql_query": "SELECT * FROM...",
    "row_count": 42,
    "error": null
}
```

## Security

- ✅ API key stays on server (never sent to frontend)
- ✅ Only SELECT queries allowed
- ✅ Results limited to 1000 rows
- ✅ Input validation prevents SQL injection

## Next Steps

1. Try the basic example queries above
2. Explore your data with different questions
3. Check the generated SQL to learn patterns
4. Create custom dashboards based on insights

## Need Help?

- Check the full README.md for detailed documentation
- See agent.py for code comments and implementation details
- Check browser console (F12) for debugging info
- Verify your Groq API key is valid

---

**Version**: 1.0.0  
**Built**: April 2026  
**Powered by**: Groq LLM + FastAPI
