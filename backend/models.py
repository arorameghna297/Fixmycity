from pydantic import BaseModel, Field
from typing import Optional

class ComplaintResponse(BaseModel):
    """
    Standard Response Structure natively mapped to Google Cloud Firestore primitives.
    EFFICIENCY: Utilizes strict Pydantic parsing directives.
    """
    id: str = Field(..., description="Universally Secure Identifier String")
    issue_type: str = Field(..., description="Generative Classification")
    description: str = Field(..., description="Vision LLM detailed context mapping")
    location: str = Field(..., description="Geometric String Translation")
    department: str = Field(..., description="Authority Assigner Engine routing class")
    status: str = Field(default="pending")
    timestamp: str = Field(..., description="ISO8601 Cloud Function Offset")
    formal_complaint: str = Field(..., description="Generative Legal PDF text layer")
    severity_score: int = Field(default=5, ge=1, le=10)
    upvotes: int = Field(default=0, ge=0)


class StatusUpdateRequest(BaseModel):
    """
    Data payload model authorizing backend structural DB operations.
    """
    status: str = Field(..., description="String enumerable: pending, in_progress, resolved")
