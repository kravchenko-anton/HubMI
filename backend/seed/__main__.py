"""Reset the database and fill it with Kraków sample issues.

Usage: python -m seed
"""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.db import DB_PATH, get_conn, init_db
from app.main import IssueCreate

DATA_DIR = Path(__file__).parent / "data"

# Issues with photos; they always end up as the most upvoted ones.
FEATURED = [
    {
        "category": "traffic",
        "title": "No crosswalk at the KFC entrance",
        "description": "People cross the road between the KFC parking lot and the bus stop every day, "
        "but there is no zebra crossing or traffic island. Cars come fast around the bend.",
        "lat": 50.021520,
        "lng": 19.916480,
        "image_url": "/media/no-cross-walk.jpg",
        "days_ago": 120,
    },
    {
        "category": "cleanliness",
        "title": "Garbage bags dumped on the grass by the fence",
        "description": "Someone left a pile of black bin bags, cardboard and a broken chair on the lawn "
        "next to the estate fence. It has been there for weeks and keeps growing.",
        "lat": 50.090480,
        "lng": 19.927550,
        "image_url": "/media/waste-on-grass.jpg",
        "days_ago": 21,
    },
]
FEATURED_LEAD = (120, 75)


def load_generated() -> list[dict]:
    items = []
    for path in sorted(DATA_DIR.glob("*.json")):
        items.extend(json.loads(path.read_text(encoding="utf-8")))
    return items


def main() -> None:
    generated = load_generated()
    top = max((i["upvotes"] for i in generated), default=0)
    featured = [dict(f, upvotes=top + lead) for f, lead in zip(FEATURED, FEATURED_LEAD)]

    now = datetime.now(timezone.utc)
    rows = []
    for item in featured + generated:
        issue = IssueCreate(**item)
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
