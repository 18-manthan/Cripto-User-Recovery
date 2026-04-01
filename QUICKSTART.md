# ✅ RUD Demo - Launch Checklist & Quick Commands

## Pre-Demo Checklist (5 minutes)

### System Preparation
- [ ] Latest Python 3.8+ installed
- [ ] Internet connectivity (for documentation only)
- [ ] Port 8000 available (or alternative port)
- [ ] Modern web browser (Chrome, Firefox, Safari, Edge)
- [ ] Screen resolution 1920x1080+ (optimal viewing)

### Code Readiness
- [ ] Demo files located at `/home/cis/Documents/Lucifer/RUD/demo/`
- [ ] All files present (README, docs, backend/, frontend/)
- [ ] Backend Python files intact
- [ ] Frontend HTML/CSS/JS files intact

### Client Preparation
- [ ] Presentation slides ready
- [ ] Browser open and clear
- [ ] Demo environment tested
- [ ] Backup demo ready (screenshots/videos)

---

## ⚡ Quick Start Commands

### Option 1: Using the Launcher Script (Recommended)
```bash
cd /home/cis/Documents/Lucifer/RUD/demo
./start.sh
```
Then open browser: `http://localhost:8000`

### Option 2: Manual Setup
```bash
# Navigate to backend
cd /home/cis/Documents/Lucifer/RUD/demo/backend

# Create virtual environment (first time only)
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server
python3 main.py
```

### Option 3: Direct (No Virtual Environment)
```bash
cd /home/cis/Documents/Lucifer/RUD/demo/backend
pip install -r requirements.txt
python3 main.py
```

### Open Dashboard
```bash
# In any browser, navigate to:
http://localhost:8000

# Or directly open address:
http://localhost:8000/
```

---

## 🎯 Demo Flow (20 minutes)

### 0-2 min: Setup & Introduction
```
"This is the RUD system - High-Value User Recovery Engine"
"It automatically identifies high-value users at risk of churn"
"Let me show you what it found in a test dataset of 50 users"
```

### 2-4 min: System Overview
- Show **Overview tab**
- Point to key stats: "50 users, 39 risks detected, $67K potential recovery"
- Highlight: "This all happens in real-time, automatically"

### 4-8 min: Risk Detection
- Go to **Risk Flags tab**
- "The system found 4 types of risks:"
  1. Show a Critical severity flag
  2. Show an onboarding delay case
  3. Show unresolved support example
- Click "View User Profile" on one
- "Complete unified view across systems"

### 8-14 min: Recovery Actions
- Go to **Actions tab**
- "For each risk, the system recommends a specific action"
- Filter Status: Pending (show the queue of work)
- Click "Approve" on an action
- "In your system, this would require manager verification"
- Click "Execute"
- "Action sent to your systems (CRM, email, support, etc.)"

### 14-18 min: Impact Analysis
- Go to **Scenarios tab**
- "Each recovery path is analyzed separately"
- Show recovery potential per scenario
- "If we act on all 51 recommendations, we recover $67K"
- Go to **Users tab**
- Search and show user profile with all related data

### 18-20 min: Questions & Next Steps
- "Questions?"
- "Here's what full implementation looks like:"
  - Real data connectors (your APIs)
  - Approval workflow integration
  - Action execution to your systems
  - Performance dashboards

---

## 🧪 Test Commands (Verify Everything Works)

### 1. Check Backend Health
```bash
curl http://localhost:8000/api/health
```
**Expected**: `{"status":"healthy","demo_ready":true}`

### 2. Get Dashboard Stats
```bash
curl http://localhost:8000/api/dashboard/stats | python3 -m json.tool
```
**Expected**: 50 users, 39 risks, 51 actions, $67,582 recovery potential

### 3. List Critical Risk Flags
```bash
curl "http://localhost:8000/api/risk-flags?severity=critical&limit=5"
```
**Expected**: Array of 5+ critical severity flags

### 4. Get Scenarios
```bash
curl http://localhost:8000/api/scenarios | python3 -m json.tool
```
**Expected**: 4 scenario types with counts and recovery potential

### 5. View User Details
```bash
# List all user IDs first, then pick one
curl "http://localhost:8000/api/risk-flags?limit=1" | grep user_id
```
**Expected**: JSON with complete user profile

---

## 🛑 Troubleshooting

### Port Already in Use
```bash
# Find what's using port 8000
lsof -i :8000

# Kill the process
kill -9 <PID>

# Or use different port (edit main.py line uvicorn.run)
python3 main.py  # Add --port 8001 parameter
```

### Module Import Errors
```bash
# Ensure you're in virtual environment or have deps installed
pip install fastapi uvicorn pydantic python-dateutil

# Check versions
python3 -m pip show fastapi
```

### Dashboard Not Loading
```bash
# Check browser console for errors (F12)
# Check backend is running:
curl http://localhost:8000/

# Clear browser cache (Ctrl+Shift+Del)
# Hard refresh (Ctrl+Shift+R)
```

### Data Not Appearing
```bash
# Wait 2-3 seconds for initialization
# Check server logs for initialization message
# Restart server if needed
```

---

## 📊 What to Show During Demo

### Talking Points
✅ "Automatically detects high-value users at risk"
✅ "Works across fragmented systems (CRM, wallet, support, ads)"
✅ "Real-time pattern detection and intelligence"
✅ "Customizable recovery actions"
✅ "Non-invasive - requires approval before execution"
✅ "Shows estimated recovery value for each action"
✅ "Complete audit trail of all actions"

### Demo Data Highlights
- **Inactive High-Value**: 15 users, 112+ days inactive, score 85+, $27K recovery potential
- **Onboarding Dropouts**: 10 users stuck in KYC for 7-12 days, $11K potential
- **Unresolved Support**: 5 users with open tickets 3+ days, $6K potential
- **Abandoned Premium**: 5 users lost after acquisition, $21K potential

### Impact to Emphasize
- Revenue recovery: From $0 (no action) to $67K (full execution)
- Efficiency: Automates detection and recommendation of 51 actions
- Insight: Unified view of users across all systems
- Control: Approval-gated execution prevents mistakes

---

## 💡 Answering Client Questions

### "Can this scale to 1 million users?"
"Yes. This demo shows the logic in-memory. In production, we use databases. The architecture scales horizontally."

### "How fast is the detection?"
"Sub-second for data retrieval. Analysis happens in real-time as updates arrive. Dashboard updates every 5-10 seconds."

### "What if I don't want automation?"
"Every action path has approval gates. You can review before execution. Or configure suggest-only mode."

### "How much does it cost?"
"That's a business discussion. This demo focuses on capability. Implementation costs depend on your systems."

### "Can it work with our data?"
"Absolutely. We'll create data connectors for your specific systems during implementation."

---

## 📁 Files for Client Handoff

**Share these documents:**
```
README.md              ← Full technical guide
PRESENTATION_GUIDE.md  ← What you used for the demo
SAMPLE_DATA.md         ← Data examples
PROJECT_STRUCTURE.md   ← What's in the code
```

**Optional: Full code for review**
```
backend/main.py        ← API server (production-quality)
backend/orchestration.py ← Detection logic
frontend/index.html    ← Dashboard UI
```

---

## 🎬 Recording the Demo

If you want to record this for non-live presentations:

```bash
# On Linux/Mac with ffmpeg:
ffmpeg -f x11grab -i :0 -c:v libx264 demo.mp4

# On macOS with QuickTime:
# Cmd+Space → QuickTime → New Screen Recording

# On Windows with OBS Studio:
# Free, open source, professional quality
```

---

## 📞 Support & Questions

### If Something Goes Wrong
1. Check the troubleshooting section above
2. Review backend logs (server output)
3. Check browser console (F12)
4. Restart the server
5. Clear browser cache

### If Client Asks for Custom Data
1. Edit `backend/dummy_data.py`
2. Modify the user generation, scenarios, or metrics
3. Restart the server
4. New data loads automatically

### If Want to Show Real Data
1. Comment out dummy_data initialization
2. Create a `data_loader.py` that pulls from your sources
3. Load data from your APIs instead
4. Same demo logic applies

---

## ✨ Pro Tips

1. **Maximize Window**: Full-screen browser for maximum impact
2. **Slow Internet Demo**: Entire system works offline (no external APIs)
3. **Power Outage**: Keep phone as backup (document screenshots)
4. **Multiple Monitors**: Show demo on one, notes on another
5. **Practice Run**: Do a full run-through before client meeting
6. **Backup Plan**: Have screenshots/video ready if tech fails

---

## 🚀 Success Criteria

You'll know the demo was successful if the client says:

- ✅ "This is exactly what we need"
- ✅ "How fast can you implement this?"
- ✅ "Can you show how this would work with our data?"
- ✅ "What's the next step?"
- ✅ "Can you start this month?"

---

## 📋 Post-Demo Actions

- [ ] Send them the GitHub link to demo (if available)
- [ ] Share PROJECT_STRUCTURE.md for code review
- [ ] Schedule technical deep-dive (next 1-2 weeks)
- [ ] Email summary with key statistics
- [ ] Get answers to: "What defines high-value user?"
- [ ] Confirm: Which systems need integration first?
- [ ] Timeline discussion for full implementation

---

**You're all set! The demo shows a fully functional recovery system. It's professional, working code that solves the exact problem they're facing. Good luck! 🎯**
