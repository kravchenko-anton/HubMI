# HubMI

An app for reporting city problems on a map (missing crosswalks, dark streets, noisy bars) and upvoting the ones that matter.

- `backend/` — FastAPI + SQLite API
- `frontend/` — Expo (React Native) app

## Try it

Web: [seen-full-production.up.railway.app](https://seen-full-production.up.railway.app)

## Backend

```bash
cd backend
python -m venv .venv
```

Windows: `.venv\Scripts\activate`. macOS and Linux: `source .venv/bin/activate`.

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend

```bash
cd frontend
npm install
npx expo start
```

The app talks to the deployed API. For a local backend, set `API_BASE_URL` in `frontend/src/api/issues.ts` to `http://<your-computer-LAN-IP>:8000`.
