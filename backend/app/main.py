import math
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.db import get_conn, init_db

EARTH_RADIUS_M = 6_371_000
MEDIA_DIR = Path(__file__).resolve().parent.parent / "media"
HIDDEN_BELOW = -10


class Category(str, Enum):
    traffic = "traffic"  # e.g. missing crosswalk
    lighting = "lighting"  # e.g. dark street
    noise = "noise"  # e.g. loud bar
    cleanliness = "cleanliness"
    infrastructure = "infrastructure"
    safety = "safety"
    other = "other"


class IssueCreate(BaseModel):
    category: Category
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=2000)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    image_url: str | None = Field(default=None, max_length=500)


class Issue(IssueCreate):
    id: int
    upvotes: int
    created_at: datetime
    solved_at: datetime | None = None
    solve_note: str = ""
    solve_image_url: str | None = None


class IssueSolve(BaseModel):
    note: str = Field(default="", max_length=2000)
    image_url: str | None = Field(default=None, max_length=500)


class MediaUpload(BaseModel):
    image_url: str


class SimilarIssue(Issue):
    distance_m: float


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    if os.getenv("HUBMI_SEED", "1") == "1":
        from seed.__main__ import main as seed_db

        seed_db()
    yield


app = FastAPI(title="HubMI", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
MEDIA_DIR.mkdir(exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def fetch_issue(issue_id: int) -> Issue:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM issues WHERE id = ?", (issue_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Issue not found")
    return Issue(**dict(row))


@app.get("/categories", response_model=list[str])
def list_categories():
    return [c.value for c in Category]


@app.post("/issues", response_model=Issue, status_code=201)
def create_issue(payload: IssueCreate):
    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO issues (category, title, description, lat, lng, image_url, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (payload.category.value, payload.title, payload.description, payload.lat, payload.lng,
             payload.image_url, now),
        )
        issue_id = cur.lastrowid
    return fetch_issue(issue_id)


@app.get("/issues", response_model=list[Issue])
def query_issues(
    min_lat: float = Query(ge=-90, le=90),
    min_lng: float = Query(ge=-180, le=180),
    max_lat: float = Query(ge=-90, le=90),
    max_lng: float = Query(ge=-180, le=180),
    category: Category | None = None,
    limit: int = Query(100, ge=1, le=500),
):
    """Issues inside the map rectangle, most upvoted first."""
    if min_lat > max_lat or min_lng > max_lng:
        raise HTTPException(400, "min values must be <= max values")
    sql = (
        "SELECT * FROM issues WHERE solved_at IS NULL AND upvotes >= ?"
        " AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?"
    )
    params: list = [HIDDEN_BELOW, min_lat, max_lat, min_lng, max_lng]
    if category:
        sql += " AND category = ?"
        params.append(category.value)
    sql += " ORDER BY upvotes DESC, created_at ASC LIMIT ?"
    params.append(limit)
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [Issue(**dict(r)) for r in rows]


@app.get("/issues/similar", response_model=list[SimilarIssue])
def similar_issues(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    category: Category | None = None,
    radius_m: float = Query(200, gt=0, le=5000),
    limit: int = Query(10, ge=1, le=50),
):
    """Nearby issues to show before submitting a new one, to avoid duplicates."""
    dlat = math.degrees(radius_m / EARTH_RADIUS_M)
    dlng = dlat / max(math.cos(math.radians(lat)), 1e-6)
    sql = (
        "SELECT * FROM issues WHERE solved_at IS NULL AND upvotes >= ?"
        " AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?"
    )
    params: list = [HIDDEN_BELOW, lat - dlat, lat + dlat, lng - dlng, lng + dlng]
    if category:
        sql += " AND category = ?"
        params.append(category.value)
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()

    results = []
    for r in rows:
        d = haversine_m(lat, lng, r["lat"], r["lng"])
        if d <= radius_m:
            results.append(SimilarIssue(**dict(r), distance_m=round(d, 1)))
    results.sort(key=lambda i: (-i.upvotes, i.distance_m))
    return results[:limit]


@app.get("/issues/{issue_id}", response_model=Issue)
def get_issue(issue_id: int):
    return fetch_issue(issue_id)


def change_votes(issue_id: int, delta: int) -> Issue:
    with get_conn() as conn:
        cur = conn.execute("UPDATE issues SET upvotes = upvotes + ? WHERE id = ?", (delta, issue_id))
    if cur.rowcount == 0:
        raise HTTPException(404, "Issue not found")
    return fetch_issue(issue_id)


@app.post("/issues/{issue_id}/upvote", response_model=Issue)
def upvote_issue(issue_id: int):
    return change_votes(issue_id, 1)


@app.delete("/issues/{issue_id}/upvote", response_model=Issue)
def remove_upvote(issue_id: int):
    """Removes a like given earlier with POST /issues/{id}/upvote."""
    return change_votes(issue_id, -1)


@app.post("/issues/{issue_id}/downvote", response_model=Issue)
def downvote_issue(issue_id: int):
    """Removes one vote; the count can go negative and hides the issue below HIDDEN_BELOW."""
    return change_votes(issue_id, -1)


IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heic",
}
MAX_IMAGE_BYTES = 8_000_000


@app.post("/media", response_model=MediaUpload, status_code=201)
async def upload_media(file: UploadFile = File(...)):
    suffix = IMAGE_TYPES.get((file.content_type or "").lower())
    if suffix is None:
        guessed = Path(file.filename or "").suffix.lower()
        suffix = guessed if guessed in {".jpg", ".jpeg", ".png", ".webp", ".heic"} else None
    if suffix == ".jpeg":
        suffix = ".jpg"
    if suffix is None:
        raise HTTPException(415, "Upload a JPEG, PNG, WebP, or HEIC image")
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty image")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image is too large")
    name = f"{uuid.uuid4().hex}{suffix}"
    (MEDIA_DIR / name).write_bytes(data)
    return MediaUpload(image_url=f"/media/{name}")


@app.post("/issues/{issue_id}/solve", response_model=Issue)
def solve_issue(issue_id: int, payload: IssueSolve):
    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        row = conn.execute("SELECT solved_at FROM issues WHERE id = ?", (issue_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "Issue not found")
        if row["solved_at"]:
            raise HTTPException(409, "Issue is already solved")
        conn.execute(
            "UPDATE issues SET solved_at = ?, solve_note = ?, solve_image_url = ? WHERE id = ?",
            (now, payload.note, payload.image_url, issue_id),
        )
    return fetch_issue(issue_id)
