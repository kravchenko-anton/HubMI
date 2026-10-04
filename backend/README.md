# HubMI backend

FastAPI server that stores city-problem reports in SQLite and returns the ones inside the map view.

```bash
python -m venv .venv
```

Windows: `.venv\Scripts\activate`. macOS and Linux: `source .venv/bin/activate`.

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs
