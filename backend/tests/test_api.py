import os

os.environ["HUBMI_DB"] = "test_hubmi.db"
os.environ["HUBMI_SEED"] = "0"
os.environ["HUBMI_MEDIA"] = "local"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import MEDIA_DIR, app  # noqa: E402


def test_flow():
    if os.path.exists("test_hubmi.db"):
        os.remove("test_hubmi.db")
    with TestClient(app) as c:
        a = c.post("/issues", json={"category": "traffic", "title": "No crosswalk", "lat": 52.2297, "lng": 21.0122}).json()
        b = c.post("/issues", json={"category": "lighting", "title": "Dark street", "lat": 52.2300, "lng": 21.0130}).json()
        c.post("/issues", json={"category": "noise", "title": "Loud bar", "lat": 50.0, "lng": 19.9})

        def vote(issue_id, voter, method="POST", direction="upvote"):
            return c.request(method, f"/issues/{issue_id}/{direction}", headers={"X-Voter-Id": voter})

        assert vote(b["id"], "b-1").json()["upvotes"] == 1
        assert vote(b["id"], "b-1").json()["upvotes"] == 1
        assert vote(b["id"], "b-2").json()["upvotes"] == 2
        assert vote(a["id"], "a-up").json()["upvotes"] == 1

        rect = c.get("/issues", params={"min_lat": 52.2, "max_lat": 52.3, "min_lng": 21.0, "max_lng": 21.1}).json()
        assert [i["id"] for i in rect] == [b["id"], a["id"]]

        similar = c.get("/issues/similar", params={"lat": 52.2298, "lng": 21.0123, "category": "traffic"}).json()
        assert [i["id"] for i in similar] == [a["id"]]

        assert vote(a["id"], "a-up", direction="downvote").json()["upvotes"] == 0
        assert vote(a["id"], "a-up", direction="downvote").json()["upvotes"] == 0
        assert vote(a["id"], "a-up", method="DELETE", direction="downvote").json()["upvotes"] == 0

        assert vote(a["id"], "fresh", direction="downvote").json()["upvotes"] == 0
        assert vote(a["id"], "fresh", direction="downvote").json()["upvotes"] == 0
        for i in range(9):
            vote(a["id"], f"down-{i}", direction="downvote")
        rect_params = {"min_lat": 52.2, "max_lat": 52.3, "min_lng": 21.0, "max_lng": 21.1}
        assert a["id"] in [i["id"] for i in c.get("/issues", params=rect_params).json()]  # raw -10

        vote(a["id"], "down-9", direction="downvote")  # raw -11: hidden
        assert a["id"] not in [i["id"] for i in c.get("/issues", params=rect_params).json()]
        similar = c.get("/issues/similar", params={"lat": 52.2298, "lng": 21.0123, "category": "traffic"}).json()
        assert similar == []
        assert c.get(f"/issues/{a['id']}").json()["upvotes"] == 0

        assert vote(b["id"], "b-3").json()["upvotes"] == 3
        assert vote(b["id"], "b-3", method="DELETE").json()["upvotes"] == 2

        missing = {"X-Voter-Id": "missing"}
        assert c.post("/issues/9999/upvote", headers=missing).status_code == 404
        assert c.delete("/issues/9999/upvote", headers=missing).status_code == 404
        assert c.post("/issues/9999/downvote", headers=missing).status_code == 404
        assert c.delete("/issues/9999/downvote", headers=missing).status_code == 404

        fixed = c.post(
            f"/issues/{b['id']}/solve",
            json={"note": "Light is back", "image_url": "/media/fixed.jpg"},
        ).json()
        assert fixed["solve_note"] == "Light is back"
        assert fixed["solve_image_url"] == "/media/fixed.jpg"
        assert fixed["solved_at"]
        assert b["id"] not in [i["id"] for i in c.get("/issues", params=rect_params).json()]
        similar = c.get("/issues/similar", params={"lat": 52.23, "lng": 21.013, "category": "lighting"}).json()
        assert similar == []
        assert c.get(f"/issues/{b['id']}").json()["solved_at"]
        assert c.post(f"/issues/{b['id']}/solve", json={}).status_code == 409
        assert c.post("/issues/9999/solve", json={}).status_code == 404

        uploaded = c.post(
            "/media",
            files={"file": ("shot.jpg", b"\xff\xd8\xff\xd9", "image/jpeg")},
        )
        assert uploaded.status_code == 201
        image_url = uploaded.json()["image_url"]
        assert image_url.startswith("/media/")
        assert image_url.endswith(".jpg")
        (MEDIA_DIR / image_url.rsplit("/", 1)[-1]).unlink(missing_ok=True)
    os.remove("test_hubmi.db")
