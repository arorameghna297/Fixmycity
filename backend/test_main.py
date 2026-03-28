import pytest
from fastapi.testclient import TestClient
from main import app, map_department

client = TestClient(app)

def test_map_department_municipal():
    """Test that pothole issues route to the Municipal Corporation."""
    assert map_department("pothole") == "Municipal Corporation"
    assert map_department("Huge ROAD damage") == "Municipal Corporation"

def test_map_department_sanitation():
    """Test that garbage issues route to the Sanitation Department."""
    assert map_department("overflowing garbage bin") == "Sanitation Department"
    assert map_department("TRASH everywhere") == "Sanitation Department"

def test_map_department_electricity():
    """Test that electricity issues route to the Electricity Board."""
    assert map_department("broken streetlight") == "Electricity Board"

def test_map_department_fallback():
    """Test that unknown issues fall back to General Civic Body."""
    assert map_department("stray animals") == "General Civic Body"

def test_get_complaints_endpoint():
    """Test that the /api/complaints endpoint returns a 200 OK."""
    response = client.get("/api/complaints")
    assert response.status_code == 200
    # It should return a list (either empty or populated)
    assert isinstance(response.json(), list)

def test_health_check_or_static():
    """Test the root endpoint serving either health_check or static files."""
    response = client.get("/")
    assert response.status_code in [200, 404] # 200 if hitting health or static, depending on setup
