import os

os.environ["HUBMI_DB"] = "test_hubmi.db"
os.environ["HUBMI_SEED"] = "0"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def test_flow():
    if os.path.exists("test_hubmi.db"):
        os.remove("test_hubmi.db")
    with TestClient(app) as c:
        a = c.post("/issues", json={"category": "traffic", "title": "No crosswalk", "lat": 52.2297, "lng": 21.0122}).json()
        b = c.post("/issues", json={"category": "lighting", "title": "Dark street", "lat": 52.2300, "lng": 21.0130}).json()
        c.post("/issues", json={"category": "noise", "title": "Loud bar", "lat": 50.0, "lng": 19.9})

        c.post(f"/issues/{b['id']}/upvote")
        c.post(f"/issues/{b['id']}/upvote")
        c.post(f"/issues/{a['id']}/upvote")

        rect = c.get("/issues", params={"min_lat": 52.2, "max_lat": 52.3, "min_lng": 21.0, "max_lng": 21.1}).json()
        assert [i["id"] for i in rect] == [b["id"], a["id"]]

        similar = c.get("/issues/similar", params={"lat": 52.2298, "lng": 21.0123, "category": "traffic"}).json()
        assert [i["id"] for i in similar] == [a["id"]]

        assert c.post(f"/issues/{a['id']}/downvote").json()["upvotes"] == 0
        assert c.post(f"/issues/{a['id']}/downvote").json()["upvotes"] == -1

        for _ in range(9):
            c.post(f"/issues/{a['id']}/downvote")
        rect_params = {"min_lat": 52.2, "max_lat": 52.3, "min_lng": 21.0, "max_lng": 21.1}
        assert a["id"] in [i["id"] for i in c.get("/issues", params=rect_params).json()]  # at -10

        c.post(f"/issues/{a['id']}/downvote")  # -11: hidden
        assert a["id"] not in [i["id"] for i in c.get("/issues", params=rect_params).json()]
        similar = c.get("/issues/similar", params={"lat": 52.2298, "lng": 21.0123, "category": "traffic"}).json()
        assert similar == []
        assert c.get(f"/issues/{a['id']}").json()["upvotes"] == -11

        assert c.post(f"/issues/{b['id']}/upvote").json()["upvotes"] == 3
        assert c.delete(f"/issues/{b['id']}/upvote").json()["upvotes"] == 2

        assert c.post("/issues/9999/upvote").status_code == 404
        assert c.delete("/issues/9999/upvote").status_code == 404
        assert c.post("/issues/9999/downvote").status_code == 404
    os.remove("test_hubmi.db")
