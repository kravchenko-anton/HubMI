"""Reset the database and fill it with Kraków sample issues from seed/data/*.json.

Usage: python -m seed
"""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.db import DB_PATH, get_conn, init_db
from app.main import MEDIA_DIR, IssueCreate

DATA_DIR = Path(__file__).parent / "data"


def load_items() -> list[dict]:
    items = []
    for path in sorted(DATA_DIR.glob("*.json")):
        items.extend(json.loads(path.read_text(encoding="utf-8")))
    return items


def main() -> None:
    now = datetime.now(timezone.utc)
    rows = []
    for item in load_items():
        issue = IssueCreate(**item)
        if issue.image_url and not (MEDIA_DIR / Path(issue.image_url).name).is_file():
            raise FileNotFoundError(f"Missing image for seed issue {issue.title!r}: {issue.image_url}")
        created_at = (now - timedelta(days=item["days_ago"])).isoformat()
        rows.append((issue.category.value, issue.title, issue.description, issue.lat, issue.lng,
                     item["upvotes"], issue.image_url, created_at))

    init_db()
    with get_conn() as conn:
        conn.execute("DELETE FROM issues")
        conn.execute("DELETE FROM sqlite_sequence WHERE name = 'issues'")
        conn.executemany(
            "INSERT INTO issues (category, title, description, lat, lng, upvotes, image_url, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            rows,
        )
    print(f"Seeded {len(rows)} issues into {DB_PATH}")


if __name__ == "__main__":
    main()
