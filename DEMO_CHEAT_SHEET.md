# Quick Reference - Demo Commands & Facts

## Start Demo (2 commands)
```bash
cd /home/cis/Documents/Lucifer/RUD/demo/backend
python main.py
```
Then open: `http://localhost:8000`

---

## Quick Stats to Mention

| Metric | Number | 
|--------|--------|
| **Total Users** | 500 |
| **Risk Flags** | 653 |
| **Critical Severity** | 36 |
| **Total Recovery Value** | **$1.75M** |
| **Open Support Tickets** | 95 |
| **Recovery Actions** | 204 |
| **User Lifecycle Stages** | 5 |
| **Acquisition Sources** | 5 |

---

## Key Demo Points

### 1️⃣ Data Connection
- Shows system connected to: **Wallets, KYC, Support, CRM**
- Demo: 500 users from different acquisition channels unified

### 2️⃣ Risk Detection  
- **36 critical** compliance issues detected
- **120 high severity** engagement drops
- **217 medium** behavior flags
- **280 low** monitoring flags

### 3️⃣ Recovery Potential
- Each user has estimated recovery value
- Total $1.75M across current 500-user base
- Actions assigned: pending, approved, executed

### 4️⃣ Unified View
- Click any user → see:
  - Wallet activity
  - Compliance flags
  - Support tickets
  - Recommended recovery actions

### 5️⃣ Operator Interface
- Beautiful dashboard (crypto-themed)
- Live chat agent for queries
- Action approval interface

---

## Common Client Questions & Answers

**Q: How long did this take?**
A: 3 weeks. We built the foundation to show feasibility. Customization for your platform would be 3 months.

**Q: Can it integrate with our systems?**
A: Yes - any REST API, webhook, database, or file dump. In the demo we simulated data from multiple sources.

**Q: Where does it run?**
A: Your infrastructure - cloud, on-prem, VNet. You own and control all data.

**Q: Can it auto-execute actions?**
A: Yes. Three modes: Suggest (read-only), Approve (manual confirmation), Execute (automated with audit logs).

**Q: What's the ROI?**
A: Demo shows $1.75M recovery potential on 500 users. Your actual platform could be much larger.

**Q: How is compliance handled?**
A: Full audit trail, approval workflows, role-based access control. Every action is logged.

---

## Crypto Theme Highlights

The UI has been styled with a **professional crypto-aesthetic**:
- ✅ Neon green (#00ff41) primary color
- ✅ Dark background (#0a0e27) 
- ✅ Glowing effects on interactive elements
- ✅ Cyan accents for secondary actions
- ✅ Color-coded severity badges
- ✅ Modern, tech-forward appearance

**Why it matters:** Immediately recognizable as a platform built for crypto market. Shows you understand their industry.

---

## Live Testing During Demo

### User Profile Test
1. Go to "Users" tab
2. Click any user (e.g., "user_000000_early")
3. See:
   - Name & email
   - Lifecycle stage
   - Wallet info with blockchain
   - Associated risk flags
   - Support tickets
   - Recovery actions
4. Highlight: "All this data was in separate systems before"

### Risk Filtering Test
1. Go to "Risk Flags" tab
2. Change filter to "Critical Severity"
3. See 36 users at highest risk
4. Highlight: "System automatically identified these across 500 users"

### Chat Agent Test
1. Click chat toggle (bottom right - green glowing circle)
2. Ask: "Which high-value users are inactive?"
3. Agent responds with filtered results
4. Highlight: "Natural language interface for your ops team"

### API Health Check
```bash
curl http://localhost:8000/api/health
```
**Shows:** Database ready, core services healthy

---

## If Something Goes Wrong

### Server Won't Start
```bash
lsof -i :8000  # Check what's using port 8000
pkill -f "python main.py"  # Kill old process
cd /home/cis/Documents/Lucifer/RUD/demo/backend && python main.py
```

### Database Error
```bash
rm backend/rud_demo.db  # Delete database (will recreate with seed data)
python main.py  # Restart - automatically reseeds
```

### Frontend Not Loading CSS
- Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Clear browser cache

### API Endpoint Error
```bash
curl http://localhost:8000/api/dashboard/stats | python -m json.tool
```
Check if response shows user/risk/action counts

---

## Pricing/Positioning Script

**When they ask "What does this cost?"**

> "The demo is free - we built it to show capability. Here's how we structure custom work:
> 
> **Scoping**: 1 week, understand your systems → $15k
> **Custom Build**: 12 weeks, full integration, training → $120-180k  
> **Deployment**: Infrastructure setup, testing, go-live → $30-50k
> **Ongoing**: Maintenance, enhancements, support → $10-15k/month
> 
> By the end you own a proprietary platform that recovers millions annually."

---

## Follow-up Items

After demo, send them:
- [ ] Architecture diagram (PROJECT_STRUCTURE.md)
- [ ] Data model details (DATABASE_IMPLEMENTATION.md)  
- [ ] Feature list with custom offerings
- [ ] Technical team intro (set call with engineering)
- [ ] 2-week scoping proposal
- [ ] SOW template for custom build

---

## Remember

🎯 **Goal**: Show you can build what they need, for THEM, in THEIR infrastructure

💼 **Message**: "This is proof of concept. The real work is making it yours."

🚀 **Outcome**: 3-month engagement to build custom platform they own

---

**You've got this! 🚀**
