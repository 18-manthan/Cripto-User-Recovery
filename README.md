# Investor Intelligence Platform (Demo)

Minimal instructions to run and update the demo on a VM.

## What this is
- **FastAPI backend** serving both the API and the static dashboard UI
- **Dual portals**: Operations (CRM, marketing, integration hub, workflows, alerts, investors, AI) and Investor (dashboard, portfolio, documents, connected accounts, assistant)
- **Database**: Postgres (via `DATABASE_URL`)
- **AI chat**: uses **Groq** (`GROQ_API_KEY`) via OpenAI-compatible API; optional OpenAI fallback
- **Branding**: edit `frontend/demo-branding.js` to re-skin copy without code changes
- **Client demo script**: [CLIENT_DEMO_SCRIPT.md](CLIENT_DEMO_SCRIPT.md)

## VM URL
- Domain & Dashboard: `https://demo.rgcis.ai/`
- Domain & Dashboard: `http://20.106.186.70/`


## One-time setup on the VM
```bash
cd /opt/rud-demo/demo/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -U pip setuptools wheel
pip install -r requirements.txt
python seed_db.py --refresh
```

## Run (manual)
```bash
cd /opt/rud-demo/demo/backend
. .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Run (recommended: systemd + Nginx)
- `systemd` runs uvicorn on `127.0.0.1:8000`
- Nginx proxies `:80` → `127.0.0.1:8000`

## Update commands (run every time after repo changes)
```bash
cd /opt/rud-demo/demo
git pull

cd backend
. .venv/bin/activate
pip install -r requirements.txt

# After seed/narrative changes (Phase 6+):
python seed_db.py --refresh

# If running under systemd:
sudo systemctl restart rud-demo
sudo systemctl status rud-demo --no-pager
```




