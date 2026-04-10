# RUD Demo (Cripto User Recovery)

Minimal instructions to run and update the demo on a VM.

## What this is
- **FastAPI backend** serving both the API and the static dashboard UI
- **Database**: SQLite (default) or Postgres (via `DATABASE_URL`)
- **AI chat**: uses OpenAI (`OPENAI_API_KEY`)

## VM URL
- Domain & Dashboard: `https://demo.rgcis.ai/`
- Domain & Dashboard: `http://20.106.186.70/`


## One-time setup on the VM
```bash
cd /opt/rud-demo/Cripto-User-Recovery/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -U pip setuptools wheel
pip install -r requirements.txt
python seed_db.py
```

## Run (manual)
```bash
cd /opt/rud-demo/Cripto-User-Recovery/backend
. .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Run (recommended: systemd + Nginx)
- `systemd` runs uvicorn on `127.0.0.1:8000`
- Nginx proxies `:80` → `127.0.0.1:8000`

## Update commands (run every time after repo changes)
```bash
cd /opt/rud-demo/Cripto-User-Recovery
git pull

cd backend
. .venv/bin/activate
pip install -r requirements.txt

# Only if schema/seed changed:
python seed_db.py

# If running under systemd:
sudo systemctl restart rud-demo
sudo systemctl status rud-demo --no-pager
```




