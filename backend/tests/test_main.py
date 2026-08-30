"""Tests for the main FastAPI application."""

from fastapi.testclient import TestClient

from app.main import app


def test_health_check():
    """Health endpoint returns expected fields."""
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "environment" in data
    assert "model_loaded" in data
    assert "model_stub" in data
    assert "scoring_engine" in data


def test_health_check_in_test_env():
    """In test environment, model should be in stub mode."""
    with TestClient(app) as client:
        response = client.get("/api/health")
    data = response.json()
    assert data["model_loaded"] is True
    assert data["model_stub"] is True
