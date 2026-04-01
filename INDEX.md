# 🗺️ RUD Demo - Navigation Guide

> **Not sure where to start?** Follow the path based on what you need!

---

## 🎯 Quick Decision Tree

### "I just want to run the demo"
1. Read: [QUICKSTART.md](QUICKSTART.md) (2 min read)
2. Run: `./start.sh`
3. Open: http://localhost:8000
4. Done! ✅

### "I need to present this to a client"
1. Read: [DELIVERY_SUMMARY.md](DELIVERY_SUMMARY.md) (5 min overview)
2. Review: [PRESENTATION_GUIDE.md](PRESENTATION_GUIDE.md) (demo script + talking points)
3. Skim: [VISUAL_TOUR.md](VISUAL_TOUR.md) (what dashboard looks like)
4. Practice the demo
5. Done! ✅

### "I want to understand the code"
1. Read: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) (understand organization)
2. Read: [README.md](README.md) (technical details)
3. Browse: `backend/` files in this order:
   - `models.py` (data schema)
   - `dummy_data.py` (test data)
   - `orchestration.py` (logic)
   - `main.py` (API)
4. Review: `frontend/` files
5. Done! ✅

### "I want to customize the demo for my use case"
1. Start: [QUICKSTART.md](QUICKSTART.md) (get it running)
2. Edit: `backend/dummy_data.py` (change scenarios/data)
3. Adjust: `backend/orchestration.py` (change detection logic)
4. Refresh: Restart server, reload dashboard
5. Done! ✅

### "I want to see API examples"
1. Go to: [SAMPLE_DATA.md](SAMPLE_DATA.md)
2. See real API responses
3. See JSON examples
4. See KPI calculations
5. Done! ✅

### "I want to know what this demo delivers"
1. Read: [DELIVERY_SUMMARY.md](DELIVERY_SUMMARY.md)
2. Short overview of everything included
3. Key metrics and features
4. Success criteria
5. Done! ✅

---

## 📖 File Reading Guide

### Must-Read (Essential)
- **[QUICKSTART.md](QUICKSTART.md)** - How to launch (5 min)
- **[PRESENTATION_GUIDE.md](PRESENTATION_GUIDE.md)** - Demo script (10 min)

### Should-Read (Recommended)
- **[DELIVERY_SUMMARY.md](DELIVERY_SUMMARY.md)** - What you're getting (5 min)
- **[README.md](README.md)** - Technical guide (15 min)

### Could-Read (Optional)
- **[SAMPLE_DATA.md](SAMPLE_DATA.md)** - API examples (10 min)
- **[VISUAL_TOUR.md](VISUAL_TOUR.md)** - UI walkthrough (10 min)
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Code details (10 min)

---

## 🚀 Pre-Demo Preparation (30 minutes)

### Timeline:
- **0-5 min**: Read QUICKSTART.md
- **5-10 min**: Run `./start.sh`
- **10-20 min**: Read PRESENTATION_GUIDE.md
- **20-30 min**: Practice the demo once

### Checklist:
- [ ] Server running (`./start.sh` in one terminal)
- [ ] Dashboard loads at http://localhost:8000
- [ ] Can see stats: 50 users, 39 risks, 51 actions
- [ ] Can navigate all 5 tabs
- [ ] Can click "View User Profile" modals
- [ ] Familiar with demo talking points
- [ ] Know the 4 recovery scenarios

---

## 💡 For Different Audiences

### Your Boss / Executive
- Show: [DELIVERY_SUMMARY.md](DELIVERY_SUMMARY.md) (overview)
- Demo: The dashboard (live)
- Talk: ROI numbers, client readiness

### Your Client / Prospect
- Show: [PRESENTATION_GUIDE.md](PRESENTATION_GUIDE.md) (follow the script)
- Demo: Run it live, follow the flow
- Give: [README.md](README.md) for technical review

### A Developer
- Show: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) (codebase)
- Demo: Code walkthrough
- Review: Individual files in `backend/` and `frontend/`

### A Data Analyst
- Show: [SAMPLE_DATA.md](SAMPLE_DATA.md) (data examples)
- Demo: Risk flags and metrics
- Discuss: KPI calculations, recovery potential

---

## 📂 File Organization

```
ROOT FOLDER: /home/cis/Documents/Lucifer/RUD/demo/

├── START HERE → QUICKSTART.md
│
├── FOR PRESENTING → PRESENTATION_GUIDE.md
│
├── FOR UNDERSTANDING → README.md
│
├── REFERENCE DOCS
│   ├── DELIVERY_SUMMARY.md (what you're getting)
│   ├── PROJECT_STRUCTURE.md (code organization)
│   ├── SAMPLE_DATA.md (data examples)
│   ├── VISUAL_TOUR.md (UI description)
│   └── THIS FILE (navigation guide)
│
├── BACKEND CODE
│   ├── main.py (FastAPI server)
│   ├── orchestration.py (detection logic)
│   ├── models.py (data schema)
│   ├── dummy_data.py (test data)
│   └── requirements.txt (dependencies)
│
├── FRONTEND CODE
│   ├── index.html (dashboard)
│   ├── style.css (styling)
│   └── script.js (interactions)
│
└── LAUNCHER
    └── start.sh (one-command startup)
```

---

## ⏱️ Time Estimates

| Task | Time | Document |
|------|------|----------|
| Launch demo | 2 min | QUICKSTART.md |
| First run | 5 min | (running) |
| Full read-through | 20 min | README.md |
| Prepare for presentation | 15 min | PRESENTATION_GUIDE.md |
| Code review | 30 min | PROJECT_STRUCTURE.md |
| Live demo (to client) | 20 min | PRESENTATION_GUIDE.md |

---

## 🎬 Demo Preparation Workflow

```
┌─────────────────────────────────────────────┐
│ 1. Read QUICKSTART.md                       │
│    (understand launch process)              │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│ 2. Run: ./start.sh                          │
│    (get server running)                     │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│ 3. Open: http://localhost:8000              │
│    (verify dashboard loads)                 │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│ 4. Read PRESENTATION_GUIDE.md              │
│    (learn the demo script)                  │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│ 5. Practice the demo (15 min)               │
│    (walk through each tab, talking points)  │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│ 6. Ready for client presentation! ✅        │
└─────────────────────────────────────────────┘
```

---

## 🔄 If Something Goes Wrong

1. **Server won't start?**
   → Check [QUICKSTART.md](QUICKSTART.md) - Troubleshooting section

2. **Dashboard won't load?**
   → Check [QUICKSTART.md](QUICKSTART.md) - Test commands section

3. **How do I customize?**
   → Check [README.md](README.md) - Customization section

4. **Need code examples?**
   → Check [SAMPLE_DATA.md](SAMPLE_DATA.md)

5. **Forgot the demo script?**
   → Read [PRESENTATION_GUIDE.md](PRESENTATION_GUIDE.md)

---

## ✅ Pre-Presentation Checklist

Using this guide, ensure:

- [ ] Ran QUICKSTART.md
- [ ] Server is running
- [ ] Dashboard loads
- [ ] Read PRESENTATION_GUIDE.md
- [ ] Practiced the demo once
- [ ] Know the 4 scenarios
- [ ] Know the key metrics (50 users, 39 risks, $67K recovery)
- [ ] Familiar with all 5 dashboard tabs
- [ ] Can answer basic questions (see PRESENTATION_GUIDE.md)

---

## 📱 Mobile Access

The demo works on:
- ✅ Desktop browsers (1920x1080+)
- ✅ Tablet (landscape recommended)
- ✅ Mobile (responsive, but dashboard designed for desktop)

**Best experience**: Present on large monitor or TV

---

## 🌟 Pro Tips

1. **Maximize browser**: Full-screen for maximum impact
2. **Use notes**: Print PRESENTATION_GUIDE.md, keep it nearby
3. **Practice timing**: Each section ~4 minutes
4. **Have backup**: Screenshot/video if tech fails
5. **Know the flow**: Overview → Risk → Actions → Scenarios → Users

---

## 🎯 Navigation Summary

| If You Want To... | Read This | Time |
|-------------------|-----------|------|
| Just run the demo | QUICKSTART.md | 5 min |
| Present to client | PRESENTATION_GUIDE.md | 15 min |
| Understand code | PROJECT_STRUCTURE.md | 10 min |
| See data examples | SAMPLE_DATA.md | 10 min |
| View UI mockups | VISUAL_TOUR.md | 10 min |
| Full tech guide | README.md | 20 min |
| Quick overview | DELIVERY_SUMMARY.md | 5 min |

---

**👉 START HERE: [QUICKSTART.md](QUICKSTART.md)**

Then proceed to the file that matches your needs above.

Good luck! 🚀
