# RUD Demo - High-Value User Recovery Engine

A fully functional demo of the **High-Value User Recovery Engine** with dummy data, interactive dashboard, and working recovery workflow.

## 📋 Project Structure

```
demo/
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── models.py              # Canonical data models
│   ├── dummy_data.py          # Dummy data generator
│   ├── orchestration.py       # Analysis & recommendation engine
│   └── requirements.txt        # Python dependencies
└── frontend/
    ├── index.html             # Dashboard UI
    ├── style.css              # Styling
    └── script.js              # Dashboard logic
```

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend

# Create virtual environment (optional but recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python3 main.py
```

The API will start at `http://localhost:8000`

### 2. Frontend Access

Simply open your browser and navigate to:
```
http://localhost:8000
```

The dashboard will load automatically and display:
- Real-time system statistics
- Detected risk flags
- Recommended recovery actions
- Recovery scenarios
- User profiles with detailed insights

## 📊 What's Included

### Dummy Data (50 Users with 4 Scenarios)

1. **Onboarding Dropouts** (10 users)
   - High-value users stuck in KYC verification
   - Open support tickets
   - Recovery focus: Priority support + workflow trigger

2. **Inactive High-Value Users** (15 users)
   - Users who became inactive after acquisition
   - No recent activity (>30 days)
   - Recovery focus: Personalized re-engagement campaigns

3. **Unresolved Support** (5 users)
   - High-value users with open support tickets
   - Priority escalation needed
   - Recovery focus: Ticket escalation + account flagging

4. **Abandoned High-Value** (5 users)
   - Users with high acquisition cost who disappeared
   - Valuable recovery opportunities
   - Recovery focus: Win-back campaigns

### Core Modules Demonstrated

✅ **Connector Layer** - Data ingestion from multiple systems
✅ **Normalization Layer** - Unified canonical data model
✅ **Orchestration Engine** - Pattern detection & analysis
✅ **Policy Layer** - Basic governance rules
✅ **Execution Layer** - Action approval & execution
✅ **Operator Interface** - Interactive dashboard
✅ **Conversion Recovery Engine** - Core use case scenarios

## 🎮 Dashboard Features

### Overview Tab
- User status distribution
- Risk severity breakdown
- Total recovery potential
- Action execution summary

### Risk Flags Tab
- Filter by risk type (onboarding, inactivity, support, abandoned)
- Filter by severity (critical, high, medium, low)
- View detailed risk descriptions
- Quick links to user profiles

### Actions Tab
- View recommended recovery actions
- Filter by status and priority
- Approve or execute pending actions
- See estimated recovery value

### Scenarios Tab
- Break down by recovery scenario type
- View affected user count per scenario
- Total recovery potential per scenario
- Severity distribution visualization

### Users Tab
- Search users by ID or email
- View associated risks and actions
- Access detailed user profiles with:
  - Account information
  - Wallet data
  - Acquisition campaign details
  - Active risk flags
  - Pending actions

## 🔌 API Endpoints

The backend provides the following RESTful API endpoints:

### Dashboard
- `GET /api/dashboard/stats` - High-level statistics
- `GET /api/health` - Health check

### Risk Detection
- `GET /api/risk-flags?flag_type=X&severity=Y&limit=100` - List risk flags
- `GET /api/scenarios` - Scenario breakdown

### Action Management
- `GET /api/actions?status=X&priority=Y&limit=100` - List actions
- `POST /api/actions/{action_id}/approve` - Approve action
- `POST /api/actions/{action_id}/execute` - Execute action

### Users
- `GET /api/users/{user_id}` - Detailed user profile

## 📈 Example Workflows

### Workflow 1: Onboarding Recovery
1. System detects user stuck in KYC for 7+ days
2. Flags user as HIGH severity with score > 75 (high-value)
3. Recommends: Priority support + workflow trigger
4. Operator approves/executes action
5. Support team receives high-priority ticket assignment

### Workflow 2: Inactive User Recovery
1. System detects user inactive for 30+ days with score > 70
2. Calculates CRITICAL severity if score > 85
3. Recommends: Personalized outreach campaign
4. Operator approves + schedules email/SMS sequence
5. Estimated recovery: $1400+ per user

### Workflow 3: Support Escalation
1. User has 3+ unresolved support tickets
2. Oldest ticket open > 3 days
3. Recommends: Escalate + flag as priority customer
4. Operator executes both actions
5. System routes to VIP support queue

## 🎯 Key Metrics Calculated

- **High-Value Score**: 0-100 scale based on acquisition source, CPA, activity patterns
- **Recovery Potential**: Estimated per-user lifetime value = score × multiplier (15-50x depending on scenario)
- **Scenario Impact**: Total recovery potential per recovery path
- **Action Priority**: Critical → High → Medium based on urgency + value

## 🔍 Customization

### Adjust Dummy Data
Edit `backend/dummy_data.py`:
- Change user counts in `generate_dummy_users()`
- Modify scoring thresholds
- Adjust timeframe windows
- Add new scenarios

### Modify Detection Rules
Edit `backend/orchestration.py`:
- Adjust thresholds (e.g., `days_in_onboarding > 7`)
- Change severity calculations
- Add new detection engines
- Modify action recommendations

### Style the Dashboard
Edit `frontend/style.css` or modify the color scheme:
```css
--primary: #6366f1;
--danger: #ef4444;
--success: #10b981;
```

## 🧪 Testing the Demo

### Test Scenario 1: Approve & Execute Actions
1. Go to "Actions" tab
2. Click "Approve" on a pending action
3. Click "Execute" on an approved action
4. Watch status update in real-time

### Test Scenario 2: Search & View Users
1. Go to "Users" tab
2. Search for a user ID
3. Click "View Details"
4. See complete profile with risks and actions

### Test Scenario 3: Filter & Analyze
1. Go to "Risk Flags" tab
2. Filter by severity (Critical)
3. View highest-priority recovery opportunities
4. Check "Scenarios" tab for impact analysis

## 📱 Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile-responsive design included

## 🛠️ Troubleshooting

### Port Already in Use
```bash
# Use a different port
python3 main.py --port 8001
```

### Module Not Found
```bash
# Ensure all dependencies are installed
pip install -r requirements.txt

# Check Python version (3.8+)
python3 --version
```

### Frontend Not Loading
- Check browser console for errors (F12)
- Ensure API is running on localhost:8000
- Clear browser cache and reload

## 📚 Architecture Insights

The demo showcases:
- **Non-invasive Integration**: Reads from multiple system APIs
- **Real-Time Intelligence**: Detects issues as data arrives
- **Multi-Path Recovery**: Different actions for different scenarios
- **Approval Workflow**: Prevents unwanted automated actions
- **Scalable Design**: Cloud-ready architecture

## 🎓 Learning Resources

Each module in `backend/`:
1. **models.py** - Learn canonical entity design
2. **dummy_data.py** - Understand scenario generation
3. **orchestration.py** - See pattern detection logic
4. **main.py** - Explore FastAPI patterns

Dashboard (`frontend/`):
- Real-time data loading
- Interactive filtering
- Modal patterns
- Responsive design

## 📞 Next Steps

1. **Customize for your use case** - Modify dummy data to match your business
2. **Connect real data sources** - Replace dummy_data.py with actual API integrations
3. **Extend detection rules** - Add more sophisticated pattern detection
4. **Implement approval workflow** - Connect to your approval system
5. **Action execution** - Integrate with your action systems

## 📄 License

Demo created for client presentation purposes.
