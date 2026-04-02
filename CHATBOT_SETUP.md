# RUD ChatBot Integration Setup Guide

## What's Been Added

### Backend Changes
- **`chat.py`** - New chatbot module with:
  - `ChatBot` class: Handles natural language queries via Groq API
  - `ConversationManager` class: Manages multi-turn conversation context
  - System prompt for RUD-specific knowledge
  - Methods for processing queries and analyzing user data

- **`main.py`** Updates:
  - Added imports for chat functionality and UUID generation
  - Initialize ChatBot and ConversationManager on startup
  - Three new API endpoints:
    - `POST /api/chat` - Process natural language queries
    - `GET /api/chat/history` - Retrieve conversation history
    - `POST /api/chat/clear` - Clear conversation sessions

- **`requirements.txt`** - Added `groq>=1.1.0` dependency (fixed version compatibility)

### Frontend Changes
- **`index.html`** - Added floating chat widget HTML:
  - Chat toggle button (bottom-right corner)
  - Chat widget with header, messages, input area
  - Minimizable and closable UI

- **`style.css`** - Added comprehensive chat styling:
  - Floating toggle button with gradient background
  - Chat widget panel with smooth animations
  - Message bubbles for user/assistant messages
  - Input field with send button
  - Mobile responsive design
  - Custom scrollbar styling

- **`script.js`** - Added ChatWidget class:
  - `toggle()` - Open/close chat widget
  - `sendMessage()` - Send queries to backend
  - `addMessage()` - Display messages in conversation
  - Session management for multi-turn conversations
  - Auto-scroll to latest messages
  - Typing indicators and status display

## Environment Setup

### Step 1: Set GROQ API Key
```bash
export GROQ_API_KEY="your-groq-api-key-here"
```

Or add it to your `.env` file in the `backend/` directory.

### Step 2: Install Dependencies
```bash
cd /home/cis/Documents/Lucifer/RUD/demo/backend
pip install -r requirements.txt
```

### Step 3: Run the Application
```bash
python3 main.py
```

The API will start at `http://localhost:8000` with the dashboard and floating chat widget.

## Usage

### For Users
1. Open the dashboard at `http://localhost:8000`
2. Click the 💬 button in the bottom-right corner
3. Ask natural language questions like those listed below

### Example Queries

#### Risk Analysis
- "How many critical risks do we have?"
- "Show me all high severity risks"
- "What is the onboarding delay issue?"
- "List users with inactivity risks"
- "Which users have unresolved support tickets?"
- "Show me all abandoned users"
- "How many medium severity risks exist?"

#### User Profiles & Lookup
- "Show me user_onboarding_000 profile"
- "Get profile for user_inactive_001"
- "Show profile of user_abandoned_004"
- "What's the status of user_support_002?"
- "Can you pull up user_onboarding_005?"

#### High-Value & Priority Users
- "Show me high value users"
- "List high value users with risks"
- "Which users have the highest recovery potential?"
- "Show me critical priority users"
- "Who are the most valuable users at risk?"

#### Recovery Actions
- "What recovery actions are pending?"
- "Show me all approved recovery actions"
- "List recovery actions for pending approval"
- "How many actions have been executed?"
- "What are the recommended recovery actions?"

#### Statistics & Metrics
- "What's the total recovery potential?"
- "How many users are in the system?"
- "What's the average recovery value per action?"
- "Break down the risk types"
- "Show me the severity breakdown"
- "What's our total recovery potential?"

#### Recovery Strategies & Recommendations
- "What's the best strategy for onboarding dropouts?"
- "How should we recover inactive users?"
- "What actions help with support issues?"
- "Recommend recovery for abandoned users"
- "What's the highest impact recovery action?"
- "Prioritize recovery actions for me"

#### Multi-turn Conversations
- "Show me critical risks" 
  → "How many of them are in the onboarding stage?"
  → "What's the recovery potential for those users?"

- "List pending actions"
  → "Which user has the highest value?"
  → "What's recommended for that user?"

### For Developers
- Chat queries are processed through Groq's LLM API
- Context includes current dashboard stats and risk flags
- Conversations are stored in-memory with session IDs
- Multi-turn conversations maintain history automatically
- The chatbot has access to real data functions (get_user_profile, get_risk_flags, get_recovery_actions)


## Features

✅ Natural language understanding via Groq LLM
✅ Multi-turn conversations with context
✅ Real-time analysis of dashboard data
✅ Floating widget UI (minimizable/closable)
✅ Typing indicators and status messages
✅ Session-based conversation management
✅ Mobile responsive design
✅ Error handling with fallback messages

## API Endpoints

### Chat Query
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How many users at critical risk?",
    "session_id": "optional-session-id"
  }'
```

Response:
```json
{
  "session_id": "session_xxx",
  "response": "Based on the current data, there are 12 users at critical risk...",
  "timestamp": "2026-04-01T..."
}
```

### Get Conversation History
```bash
curl http://localhost:8000/api/chat/history?session_id=session_xxx
```

### Clear Session
```bash
curl -X POST http://localhost:8000/api/chat/clear \
  -H "Content-Type: application/json" \
  -d '{"session_id": "session_xxx"}'
```

## Troubleshooting

### "ChatBot service not initialized" error
- Make sure `GROQ_API_KEY` environment variable is set
- Check logs for initialization messages

### Chat widget not appearing
- Verify JavaScript is enabled in browser
- Check browser console for errors
- Ensure `script.js` is loading correctly

### No response from chatbot
- Verify GROQ API key is valid
- Check network requests in browser DevTools
- Ensure backend is running (`http://localhost:8000/api/health`)

## Next Steps

1. Get GROQ API key from https://console.groq.com
2. Set environment variable: `export GROQ_API_KEY="your-key"`
3. Run the application
4. Open dashboard and click the chat button
5. Start asking questions!
