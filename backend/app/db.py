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
"""


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        columns = {r["name"] for r in conn.execute("PRAGMA table_info(issues)")}
        if "image_url" not in columns:
            conn.execute("ALTER TABLE issues ADD COLUMN image_url TEXT")


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
