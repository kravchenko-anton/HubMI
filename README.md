# HubMI

An app where people pin city problems on a map: a missing crosswalk, a dark street, a noisy bar, trash by a fence. Neighbors see those pins and vote for the ones that matter. A city office or a small business can open the map of their area and see what people are complaining about.

The demo data is real places in Kraków.

The project has two parts:

- [`frontend/`](frontend/README.md) — the phone and browser app. The map, the list of reports, and the “report this” form.
- [`backend/`](backend/README.md) — the server. It accepts reports, stores them, and returns the ones that fall inside the piece of the map on screen.

## What happens, step by step

1. A person opens the app and sees a map. The first view is the center of Kraków.
2. The app looks at the rectangle of the map that is on screen and asks the server: “give me the reports inside these coordinates.”
3. The server returns open reports, highest vote count first.
4. Nearby pins of the same category collapse into one cluster. Zooming in splits a cluster into separate pins.
5. A sheet slides up from the bottom: how many problems are in this area, how many were added today, and which one is closest.
6. Pulling the sheet up shows the list. Opening one report shows its photo, text, place, and votes.
7. A like adds one vote. A dislike takes a vote away. One person has one vote on one report. The number on screen never goes below zero. If dislikes pile up far enough, the pin disappears from the map.
8. The report button opens categories: lighting, road, trash, noise, and others. The person writes a short text, can take a photo, drops a pin, and sends it.
9. The server saves the report. The map refreshes, and the new pin shows up with the rest.
10. If the problem is already fixed, someone can mark it solved, with a short note and a photo. That report leaves the map and the list.

Votes are remembered on this phone. There is no email login. The app keeps a random voter id, and the server will not let that id vote twice on the same report.

## Run it locally

You need Python 3.11+, Node.js 20+, and the Expo Go app if you want to open it on a phone.

Server:

```bash
cd backend
python -m venv .venv
```

Windows: `.venv\Scripts\activate`. macOS and Linux: `source .venv/bin/activate`.

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The database file `hubmi.db` is created on startup and filled with the Kraków demo reports. Interactive docs: http://localhost:8000/docs

App:

```bash
cd frontend
npm install
npx expo start
```

Scan the QR code with Expo Go. Press `a`, `i`, or `w` for Android, iOS, or the browser.

Out of the box the app talks to the deployed server. To point it at your computer, change `API_BASE_URL` in `frontend/src/api/issues.ts` to `http://<your-computer-LAN-IP>:8000`. On a phone, `localhost` means the phone itself, so you need the computer’s address on the local network.

How the screens fit together, and what each server address does, is in the [backend README](backend/README.md) and the [frontend README](frontend/README.md).
