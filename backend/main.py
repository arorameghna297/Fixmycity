import os
import json
import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import google.generativeai as genai
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

# Load Environment Variables from higher level directory
load_dotenv(dotenv_path="../.env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="FixMyCity AI API")

# Setup CORS to allow React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
FIREBASE_CRED_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH", "serviceAccountKey.json")

# Initialize Gemini
if GEMINI_API_KEY and GEMINI_API_KEY != "your_google_gemini_api_key_here":
    genai.configure(api_key=GEMINI_API_KEY)
    # Using the flash model as standard recommendation
    model = genai.GenerativeModel('gemini-2.5-flash')
else:
    logger.warning("GEMINI_API_KEY missing or not configured correctly.")
    model = None

# Initialize Firebase
db = None
try:
    if os.path.exists(FIREBASE_CRED_PATH):
        cred = credentials.Certificate(FIREBASE_CRED_PATH)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        logger.info("Firebase initialized successfully.")
    else:
        logger.warning(f"Firebase credentials not found at {FIREBASE_CRED_PATH}. Using mock database for testing.")
except Exception as e:
    logger.error(f"Failed to initialize Firebase: {e}")

# Fallback dictionary for mock DB
mock_db = {}


class ComplaintResponse(BaseModel):
    id: str
    issue_type: str
    description: str
    location: str
    department: str
    status: str
    timestamp: str
    formal_complaint: str


def map_department(issue_type: str) -> str:
    """Decision Engine logic to map issues to specific departments."""
    issue_type_lower = issue_type.lower()
    
    mapping = {
        "pothole": "Municipal Corporation",
        "road": "Municipal Corporation",
        "garbage": "Sanitation Department",
        "trash": "Sanitation Department",
        "streetlight": "Electricity Board",
        "electricity": "Electricity Board",
        "water leakage": "Water Supply Department",
        "water": "Water Supply Department"
    }
    
    # Simple keyword match
    for key, dept in mapping.items():
        if key in issue_type_lower:
            return dept
            
    return "General Civic Body"


@app.post("/api/report", response_model=ComplaintResponse)
async def report_issue(
    file: UploadFile = File(...),
    location: Optional[str] = Form("Unknown Location"),
    extra_context: Optional[str] = Form("")
):
    """
    1. Receives image + location.
    2. Sends to Gemini Vision for parsing.
    3. Infers department via decision engine.
    4. Generates a formal complaint text via Gemini.
    5. Saves to Firebase (or Mock DB).
    """

    # Check if Gemini is configured
    if model is None:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured correctly.")

    try:
        # Read file bytes
        image_bytes = await file.read()
        
        # We need a format GenAI can read directly
        image_parts = [
            {
                "mime_type": file.content_type,
                "data": image_bytes
            }
        ]

        # STEP 3: Classification Prompts
        classification_prompt = f"""
        You are a civic issue classifier.
        Given this image, identify:
        1. Type of issue (pothole, garbage, streetlight, water leakage, etc.)
        2. Severity (low, medium, high)
        3. Short description
        
        {("Extra user context: " + extra_context) if extra_context else ""}

        Return ONLY a raw JSON format (no markdown codeblocks like ```json):
        {{
          "issue_type": "string",
          "severity": "string",
          "description": "string"
        }}
        """

        # Generate content for classification
        response = model.generate_content([classification_prompt, image_parts[0]])
        
        # Clean the response text from any markdown code blocks
        raw_text = response.text.replace('```json', '').replace('```', '').strip()
        result_json = json.loads(raw_text)
        
        issue_type = result_json.get("issue_type", "Unknown Issue")
        severity = result_json.get("severity", "medium")
        description = result_json.get("description", "No description provided.")
        
        # STEP 4: Decision Engine
        department = map_department(issue_type)
        if severity.lower() == "high":
            priority = "urgent"
        else:
            priority = "normal"
            
        # STEP 5: Auto-Generate Formal Complaint
        formal_prompt = f"""
        Generate a formal civic complaint.

        Issue: {issue_type}
        Description: {description}
        Location: {location}
        Priority: {priority}

        Make it concise and professional. Do not use placeholders like [Your Name].
        """
        
        formal_response = model.generate_content([formal_prompt])
        formal_complaint_text = formal_response.text.strip()
        
        # Build document payload
        doc_id = str(uuid.uuid4())
        timestamp_str = datetime.utcnow().isoformat() + "Z"
        
        complaint_data = {
            "id": doc_id,
            "issue_type": issue_type,
            "description": description,
            "location": location,
            "department": department,
            "priority": priority,
            "status": "pending",
            "timestamp": timestamp_str,
            "formal_complaint": formal_complaint_text
        }
        
        # STEP 7: FireBase Integration
        if db is not None:
            # We have an active Firestore connected
            db.collection("complaints").document(doc_id).set(complaint_data)
        else:
            # Fallback to in-memory store
            mock_db[doc_id] = complaint_data

        return complaint_data

    except Exception as e:
        logger.error(f"Error processing report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/complaints")
async def get_complaints():
    """
    Returns a list of all complaints.
    """
    try:
        if db is not None:
            complaint_docs = db.collection("complaints").order_by("timestamp", direction=firestore.Query.DESCENDING).get()
            return [doc.to_dict() for doc in complaint_docs]
        else:
            return list(mock_db.values())
    except Exception as e:
        logger.error(f"Error fetching complaints: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch complaints.")

# Mount the React static files
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")

    @app.get("/")
    def serve_react_app():
        return FileResponse(os.path.join(static_dir, "index.html"))
    
    # Optional: Catch-all route to serve index.html for React Router (if added later)
    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        if not full_path.startswith("api/"):
            return FileResponse(os.path.join(static_dir, "index.html"))
        raise HTTPException(status_code=404, detail="API route not found")
else:
    @app.get("/")
    def health_check():
        return {"status": "healthy", "service": "FixMyCity AI Backend", "note": "Static frontend not built."}
