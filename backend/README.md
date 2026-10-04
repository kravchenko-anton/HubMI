# HubMI backend

This is the app’s server. The phone does not keep the reports itself. It asks this server and gets a list back. The server is [FastAPI](https://fastapi.tiangolo.com/). The data lives in one SQLite file, `hubmi.db`. You do not install a separate database.

## What it is for

The server does four jobs:

1. It accepts a new report: category, title, text, coordinates, and a photo when there is one.
2. It returns the reports that fall inside the map rectangle. More votes means higher in the list.
3. It counts votes. Each person has one vote on one report: plus or minus.
4. It accepts a “this is fixed” mark. A solved report drops out of the public list.

## Start it, step by step

1. Install Python 3.11 or newer. Check with `python --version`.
2. Open the `backend` folder.
3. Create a separate environment so this project’s packages stay apart from the rest of your Python:

   ```bash
   python -m venv .venv
   ```

4. Turn it on.

   Windows:

   ```bash
   .venv\Scripts\activate
   ```

   macOS and Linux:

   ```bash
   source .venv/bin/activate
   ```

5. Install the libraries listed in `requirements.txt`:

   ```bash
   pip install -r requirements.txt
   ```

   That file pulls in FastAPI (the addresses), Uvicorn (the process that listens on a port), boto3 (sending photos to storage), and pytest (tests).

6. Start the server:

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   `--reload` restarts the server when you change the code. `--host 0.0.0.0` lets a phone on the same Wi-Fi reach this computer.

7. Open http://localhost:8000/docs. That page lists every address, and you can try each one from the browser.

Stop the server with `Ctrl+C` in the same terminal.

## What happens in the first second after startup

1. `hubmi.db` is created if it does not exist yet.
2. Two tables appear: `issues` (the reports) and `issue_votes` (who voted which way). If the file is an older database and a new column is missing, that column is added.
3. Unless `HUBMI_SEED` is set to `0`, the server refills the database with the demo reports from `seed/data/*.json`. Those are places in Kraków: a crosswalk, trash, lighting, wild boars, and so on.

Starting again with seeding left on wipes the reports table and writes the demo set again. Reports you sent from the app disappear after a restart. Rows in `issue_votes` are left as they are. To keep your own database, set `HUBMI_SEED=0` before you start the server.

Fill the database by hand, without starting the server:

```bash
python -m seed
```

Demo photos are paths like `/media/some-file.jpg`. The seeder checks that the file exists in `backend/media`. If a file is missing, seeding stops with an error.

## What one report contains

One row in the `issues` table:

| Field | What it is |
| --- | --- |
| `id` | The number. The database assigns it. |
| `category` | One of `traffic`, `lighting`, `noise`, `cleanliness`, `infrastructure`, `safety`, `other`. |
| `title` | A short title, 3 to 120 characters. |
| `description` | The details, up to 2000 characters. It can be empty. |
| `lat`, `lng` | Latitude and longitude of the pin. |
| `upvotes` | The vote total. A plus is +1, a minus is −1. The public response never shows a number below zero. |
| `image_url` | Path to the photo, for example `/media/abc.jpg`. It can be empty. |
| `created_at` | When the report was created, in UTC. |
| `solved_at` | When someone marked it solved. Empty means the report is still open. |
| `solve_note`, `solve_image_url` | The note and photo from the person who marked it fixed. |

The `issue_votes` table stores pairs of “report id + voter id”. The value is only `1` or `-1`. Voting again replaces the previous vote. It does not add a second one.

Coordinates are indexed so “everything inside this rectangle” stays fast. Votes are indexed too, because the list is sorted by them.

## How a report travels from the button to the database

Someone taps send on the map. The app makes two requests when there is a photo, and one request when there is not.

1. The photo goes to `POST /media`. The server checks that it is an image (JPEG, PNG, WebP, or HEIC) and that it is at most 8 MB. An empty file is rejected. The image gets a random name. In the normal setup it goes to Tigris object storage. With `HUBMI_MEDIA=local`, the file is written to `backend/media`. The response is a path like `/media/random-name.jpg`.
2. The report itself goes to `POST /issues`, together with that path, the category, the text, and the coordinates. The server inserts the row and returns it, already numbered, with zero votes.
3. When the person moves the map, the app calls `GET /issues` with four numbers: the bottom-left and top-right corners of the screen. The server keeps open reports inside that rectangle whose raw vote total is at least −10. Sort order: more votes first, and when the totals match, older reports first.
4. A like is `POST /issues/5/upvote` with the header `X-Voter-Id`. The header is a string of up to 80 characters. The app invents it and stores it locally. The server sets that person to `+1`. Taking the like back is `DELETE` on the same address.
5. A dislike is `POST /issues/5/downvote`. Taking it back is `DELETE`.
6. “This is fixed” is `POST /issues/5/solve` with a note and, if there is one, a photo path. Solving the same report twice is rejected with `409`.

You can still fetch one report by id after it is solved or hidden by dislikes: `GET /issues/5`.

## Votes, in plain words

Start from zero. Three different people tap plus, and the screen shows 3. A fourth person taps minus, and the screen shows 2, because their −1 was subtracted from the total.

If someone who already tapped plus then taps minus, their old plus is replaced. The total drops by 2: the plus is gone and a minus is there instead.

The number the app shows never goes below zero. The raw total in the database can. In the response the server sends `max(0, total)`.

A report is hidden only when the raw total falls below −10. Until then it stays on the map, even when the screen already shows zero. A few stray dislikes do not erase a pin. A large wave of “this is not here” does.

The same `X-Voter-Id` stores exactly one row per report. Tapping plus again does not raise the count a second time.

## Similar reports nearby

`GET /issues/similar` looks for open reports inside a radius around a point. The default radius is 200 meters, and the maximum is 5 kilometers. Each result includes `distance_m`. Higher vote totals come first, then closer reports.

This address exists so the app can say “someone already reported this nearby, vote for that one” before a new report is sent. The app does not call it yet. Sending a second pin for the same spot is allowed.

## Every address

| Method and path | What it does |
| --- | --- |
| `GET /categories` | The category names as strings. |
| `POST /issues` | Create a report. Response `201` and the report. |
| `GET /issues` | Reports inside `min_lat`, `min_lng`, `max_lat`, `max_lng`. Optional `category` and `limit` (1 to 500, default 100). |
| `GET /issues/similar` | Reports near `lat`, `lng`. |
| `GET /issues/{id}` | One report by number. Unknown number returns `404`. |
| `POST /issues/{id}/upvote` | A like. Requires the `X-Voter-Id` header. |
| `DELETE /issues/{id}/upvote` | Remove that voter’s like. It does not touch anyone else’s. |
| `POST /issues/{id}/downvote` | A dislike. Same header. |
| `DELETE /issues/{id}/downvote` | Remove that voter’s dislike. |
| `POST /media` | Upload an image in the form field `file`. |
| `GET /media/{name}` | Return the image. A local file is tried first, then storage. |
| `POST /issues/{id}/solve` | Mark it solved. Body: `note` and an optional `image_url`. |

Errors worth knowing:

- `400` — the rectangle is upside down, or the voter id is empty.
- `404` — there is no report or image with that name.
- `409` — the report is already marked solved.
- `413` — the image is larger than 8 MB.
- `415` — the file is not JPEG, PNG, WebP, or HEIC.
- `502` — the image could not be stored.

Other websites can call the server. CORS is open to every origin, which keeps the app and local development simple.

## Where photos go

By default the file goes to a Tigris bucket. Override the keys with environment variables instead of editing the code:

- `TIGRIS_ENDPOINT_URL`
- `TIGRIS_BUCKET`
- `TIGRIS_ACCESS_KEY_ID`
- `TIGRIS_SECRET_ACCESS_KEY`
- `TIGRIS_REGION`

To keep photos on this computer only:

```bash
# Windows PowerShell
$env:HUBMI_MEDIA = "local"

# macOS / Linux
export HUBMI_MEDIA=local
```

Then `GET /media/...` reads the file from `backend/media`.

## Other variables

| Variable | If you do not set it | What it does |
| --- | --- | --- |
| `HUBMI_DB` | `hubmi.db` in the current folder | Where the database file lives. |
| `HUBMI_SEED` | `1` | `0` skips refilling the database with demo data on startup. |
| `HUBMI_MEDIA` | Tigris storage | `local` writes images into `backend/media`. |
| `PORT` | `8000` in the start command | Hosts often inject the port. `railpack.json` passes it to Uvicorn. |

## Check that the server works

From the `backend` folder, with the environment turned on:

```bash
pytest
```

`tests/test_api.py` uses its own database, `test_hubmi.db`, turns seeding off, and walks the main path: create three reports, vote, query a rectangle, find a similar report, sink one report below −10 with dislikes, mark another solved, and upload a tiny JPEG. Test images are stored locally.

## Where each file lives

- `app/main.py` — every address, image checks, distance math, and votes.
- `app/db.py` — the database file, creating the tables, and adding new columns to an old database.
- `seed/__main__.py` — reads the JSON and writes the demo reports.
- `seed/data/` — demo text and coordinates, split by topic.
- `tests/test_api.py` — one end-to-end test of the main path.
- `railpack.json` — the command the host uses to start the server.
- `requirements.txt` — the Python libraries.
