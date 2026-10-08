import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_health_endpoints():
    r1 = client.get("/health")
    assert r1.status_code == 200
    assert r1.json()["status"] == "healthy"

    r2 = client.get("/api/v1/health")
    assert r2.status_code == 200
    assert r2.json()["status"] == "healthy"


def test_auth_workflow():
    # 1. Register
    email = "tester@examintelligence.org"
    password = "SecurePassword123!"

    reg_resp = client.post("/api/v1/auth/register", json={"email": email, "password": password})
    # Either 201 or 422 if already registered
    assert reg_resp.status_code in (201, 422)

    # 2. Login
    login_resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert "access_token" in data
    token = data["access_token"]

    # 3. Get profile
    headers = {"Authorization": f"Bearer {token}"}
    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == email

    # 4. Analytics endpoint
    analytics_resp = client.get("/api/v1/analytics/dashboard", headers=headers)
    assert analytics_resp.status_code == 200
    analytics_data = analytics_resp.json()
    assert "total_documents" in analytics_data
    assert "questions_extracted" in analytics_data


def test_unauthorized_access():
    resp = client.get("/api/v1/documents")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"
