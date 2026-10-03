# HubMI

An app for reporting problems in the city (missing crosswalks, dark streets, noisy bars) and upvoting the ones that matter.

- `backend/` – FastAPI + SQLite API
- `frontend/` – Expo (React Native) mobile app

## Run locally

### Backend

Requires Python 3.11+.

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The database (`hubmi.db`) is created and seeded with demo issues on startup. API docs: http://localhost:8000/docs

Run tests with `pytest`.

### Frontend

Requires Node.js 20+ and the Expo Go app on your phone (or an Android/iOS emulator).

```bash
cd frontend
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `a` / `i` / `w` for Android, iOS, or web.

By default the app talks to the deployed API. To use your local backend, set `API_BASE_URL` in `frontend/src/api/issues.ts` to `http://<your-computer-LAN-IP>:8000`.
