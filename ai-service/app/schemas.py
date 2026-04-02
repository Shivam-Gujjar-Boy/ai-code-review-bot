"""Pydantic schemas for request/response validation."""
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from enum import Enum


class Severity(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Issue(BaseModel):
    """Represents a single code issue."""
    line: int = Field(..., description="Line number where the issue occurs")
    message: str = Field(..., description="Description of the issue")
    severity: Optional[Severity] = Field(None, description="Severity level")
    suggestion: Optional[str] = Field(None, description="Suggested fix")
    cwe: Optional[str] = Field(None, description="CWE ID for security issues")


class ReviewResult(BaseModel):
    """Complete code review result."""
    bugs: List[Issue] = Field(default_factory=list, description="List of bug issues")
    style: List[Issue] = Field(default_factory=list, description="List of style issues")
    security: List[Issue] = Field(default_factory=list, description="List of security issues")
    summary: str = Field(..., description="Overall summary of the review")
    score: int = Field(..., ge=0, le=100, description="Code quality score (0-100)")
    language: Optional[str] = Field(None, description="Detected programming language")


class ReviewRequest(BaseModel):
    """Request payload for code review."""
    code: str = Field(..., min_length=1, description="Code to review")
    language: Optional[str] = Field(None, description="Programming language (auto-detected if not provided)")


class StreamChunk(BaseModel):
    """A chunk of streamed review data."""
    type: Literal["start", "chunk", "complete", "error"]
    content: Optional[str] = None
    data: Optional[ReviewResult] = None
    error: Optional[str] = None
