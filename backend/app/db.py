import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.getenv("HUBMI_DB", "hubmi.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS issues (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category    TEXT    NOT NULL,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    lat         REAL    NOT NULL,
    lng         REAL    NOT NULL,
    upvotes     INTEGER NOT NULL DEFAULT 0,
    image_url   TEXT,
    created_at  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_issues_lat_lng ON issues (lat, lng);
CREATE INDEX IF NOT EXISTS idx_issues_upvotes ON issues (upvotes DESC);
CREATE TABLE IF NOT EXISTS issue_votes (
    issue_id INTEGER NOT NULL,
    voter_id TEXT    NOT NULL,
    value    INTEGER NOT NULL CHECK (value IN (-1, 1)),
    PRIMARY KEY (issue_id, voter_id)
);
"""


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        columns = {r["name"] for r in conn.execute("PRAGMA table_info(issues)")}
        additions = {
            "image_url": "ALTER TABLE issues ADD COLUMN image_url TEXT",
            "solved_at": "ALTER TABLE issues ADD COLUMN solved_at TEXT",
            "solve_note": "ALTER TABLE issues ADD COLUMN solve_note TEXT NOT NULL DEFAULT ''",
            "solve_image_url": "ALTER TABLE issues ADD COLUMN solve_image_url TEXT",
        }
        for name, ddl in additions.items():
            if name not in columns:
                conn.execute(ddl)


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
