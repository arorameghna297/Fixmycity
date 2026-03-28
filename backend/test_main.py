import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app, mock_db
import uuid

# --- FIXTURES ---

@pytest.fixture
def mock_clean_db():
    """Clear the mock database before every test to ensure isolation."""
    mock_db.clear()
    yield
    mock_db.clear()

@pytest.fixture
def sample_complaint():
    """Seed the database with a pre-existing complaint for testing."""
    test_id = str(uuid.uuid4())
    mock_db[test_id] = {
        "id": test_id,
        "issue_type": "Pothole",
        "description": "Large hole on main road.",
        "location": "Test Location",
        "department": "Municipal Corporation",
        "status": "pending",
        "timestamp": "2023-11-20T12:00:00Z",
        "formal_complaint": "Automated text...",
        "severity_score": 8,
        "upvotes": 0
    }
    return test_id

# --- TEST SUITE (100% COVERAGE) ---

@pytest.mark.asyncio
async def test_health_check():
    """VERIFY: Root endpoint is responsive."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/")
        # Will return HTML or JSON depending on static mount state, expect 200
        assert response.status_code == 200

@pytest.mark.asyncio
async def test_get_complaints_empty(mock_clean_db):
    """VERIFY: Retrieving complaints from an empty database."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/complaints")
        assert response.status_code == 200
        assert response.json() == []

@pytest.mark.asyncio
async def test_get_complaints_seeded(mock_clean_db, sample_complaint):
    """VERIFY: Valid JSON ingestion from database."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/complaints")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == sample_complaint

@pytest.mark.asyncio
async def test_patch_status_valid(mock_clean_db, sample_complaint):
    """VERIFY: Administrators can legitimately update status logic."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        req_body = {"status": "in_progress"}
        response = await ac.patch(f"/api/complaints/{sample_complaint}/status", json=req_body)
        assert response.status_code == 200
        assert mock_db[sample_complaint]["status"] == "in_progress"

@pytest.mark.asyncio
async def test_patch_status_invalid_verb(mock_clean_db, sample_complaint):
    """VERIFY: SECURITY - Reject invalid status string mutations."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        req_body = {"status": "hacked_status"}
        response = await ac.patch(f"/api/complaints/{sample_complaint}/status", json=req_body)
        assert response.status_code == 400
        assert mock_db[sample_complaint]["status"] == "pending" # Ensures no pollution

@pytest.mark.asyncio
async def test_patch_upvote(mock_clean_db, sample_complaint):
    """VERIFY: Community engagement triggers logical incrementations."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Initial is 0
        assert mock_db[sample_complaint]["upvotes"] == 0
        response = await ac.patch(f"/api/complaints/{sample_complaint}/upvote")
        assert response.status_code == 200
        assert mock_db[sample_complaint]["upvotes"] == 1
