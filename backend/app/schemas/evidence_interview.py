from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.evidence_quality import EvidenceQualityResponse


class QuestionOption(BaseModel):
    """Option for single-choice interview questions."""
    label: str = Field(..., description="User-friendly display label")
    value: str = Field(..., description="Stored technical representation")


class EvidenceInterviewQuestion(BaseModel):
    """
    Deterministic follow-up question for improving citizen evidence completeness.
    Guided purely by missing observational dimensions without scientific speculation.
    """
    question_id: str = Field(..., description="Stable deterministic question identifier")
    field: str = Field(..., description="Report field targeted by this question")
    question: str = Field(..., description="The citizen-facing question text")
    answer_type: str = Field(..., description="'single_choice' or 'free_text'")
    options: Optional[List[QuestionOption]] = Field(
        default=None,
        description="Allowed options for single-choice questions",
    )


class EvidenceInterviewResponse(BaseModel):
    """Response containing targeted follow-up questions for a citizen report."""
    report_id: UUID = Field(..., description="UUID of the assessed report")
    questions: List[EvidenceInterviewQuestion] = Field(
        ...,
        description="Up to 2 prioritized follow-up questions to improve evidence completeness",
    )


class InterviewAnswerSubmission(BaseModel):
    """Single answer to an interview question."""
    question_id: str = Field(..., min_length=1, max_length=50, description="Question ID being answered")
    value: str = Field(..., min_length=1, max_length=5000, description="Citizen's answer value")

    model_config = ConfigDict(extra="forbid")


class EvidenceInterviewAnswersRequest(BaseModel):
    """Request payload containing answers to follow-up interview questions."""
    answers: List[InterviewAnswerSubmission] = Field(
        ...,
        min_length=1,
        max_length=10,
        description="List of question answers to apply",
    )

    model_config = ConfigDict(extra="forbid")


class EvidenceInterviewAnswersResponse(BaseModel):
    """Response after applying citizen interview answers."""
    report_id: UUID = Field(..., description="UUID of the updated report")
    updated_fields: List[str] = Field(..., description="List of report fields successfully updated")
    message: str = Field(
        default="Evidence interview answers successfully recorded.",
        description="Confirmation message",
    )
    evidence_quality: EvidenceQualityResponse = Field(
        ...,
        description="Recalculated evidence completeness assessment following updates",
    )
