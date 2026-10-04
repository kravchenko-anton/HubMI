import math
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
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
CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
}
MAX_IMAGE_BYTES = 8_000_000

# Temporary. Remove these and set TIGRIS_* env vars instead.
TIGRIS_ENDPOINT = "https://t3.storageapi.dev"
TIGRIS_BUCKET = "contained-keg-dma4z0ggpei"
TIGRIS_ACCESS_KEY = "tid_PhtIXXWuduVkloTXKtjpKWplaToOSGbZziqCTDuyznZk_MGKvS"
TIGRIS_SECRET_KEY = "tsec_E4lNR-oEOkZGoQ4x9CoHk-6WsISm9i4o9nyuD4_og9WUzN9fZ-oJsz5jC7u+BJsIYATHJZ"
TIGRIS_REGION = "auto"


def image_suffix(content_type: str | None, filename: str | None, data: bytes) -> str | None:
    suffix = IMAGE_TYPES.get((content_type or "").split(";")[0].strip().lower())
    if suffix is None:
        guessed = Path(filename or "").suffix.lower()
        if guessed == ".jpeg":
            guessed = ".jpg"
        if guessed in CONTENT_TYPES:
            suffix = guessed
    if suffix is None:
        if data.startswith(b"\xff\xd8\xff"):
            suffix = ".jpg"
        elif data.startswith(b"\x89PNG\r\n\x1a\n"):
            suffix = ".png"
        elif len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP":
            suffix = ".webp"
        elif b"ftyp" in data[:32]:
            suffix = ".heic"
    return suffix


def tigris_client():
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=os.getenv("TIGRIS_ENDPOINT_URL", TIGRIS_ENDPOINT),
        aws_access_key_id=os.getenv("TIGRIS_ACCESS_KEY_ID", TIGRIS_ACCESS_KEY),
        aws_secret_access_key=os.getenv("TIGRIS_SECRET_ACCESS_KEY", TIGRIS_SECRET_KEY),
        region_name=os.getenv("TIGRIS_REGION", TIGRIS_REGION),
    )


def store_image(data: bytes, suffix: str) -> str:
    name = f"{uuid.uuid4().hex}{suffix}"
    if os.getenv("HUBMI_MEDIA") == "local":
        (MEDIA_DIR / name).write_bytes(data)
    else:
        tigris_client().put_object(
            Bucket=os.getenv("TIGRIS_BUCKET", TIGRIS_BUCKET),
            Key=name,
            Body=data,
            ContentType=CONTENT_TYPES[suffix],
        )
    return f"/media/{name}"


@app.get("/media/{name}")
def read_media(name: str):
    if name != Path(name).name:
        raise HTTPException(404, "Image not found")
    path = MEDIA_DIR / name
    if path.is_file():
        return FileResponse(path)
    if os.getenv("HUBMI_MEDIA") == "local":
        raise HTTPException(404, "Image not found")
    from botocore.exceptions import ClientError

    try:
        obj = tigris_client().get_object(Bucket=os.getenv("TIGRIS_BUCKET", TIGRIS_BUCKET), Key=name)
    except ClientError as error:
        raise HTTPException(404, "Image not found") from error
    return Response(content=obj["Body"].read(), media_type=obj.get("ContentType") or "application/octet-stream")


@app.post("/media", response_model=MediaUpload, status_code=201)
async def upload_media(file: UploadFile = File(...)):
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty image")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image is too large")
    suffix = image_suffix(file.content_type, file.filename, data)
    if suffix is None:
        raise HTTPException(415, "Upload a JPEG, PNG, WebP, or HEIC image")
    try:
        image_url = store_image(data, suffix)
    except Exception as error:
        raise HTTPException(502, "Could not store the image") from error
    return MediaUpload(image_url=image_url)


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
