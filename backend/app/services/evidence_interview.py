from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.report import Report
from app.schemas.evidence_interview import (
    EvidenceInterviewQuestion,
    EvidenceInterviewResponse,
    InterviewAnswerSubmission,
    QuestionOption,
)
from app.services.evidence_quality import assess_evidence_quality

# Prioritized deterministic order for follow-up questions
INTERVIEW_PRIORITY_ORDER: List[str] = [
    "description",
    "water_appearance",
    "flow_condition",
    "odor",
]

# Maximum number of follow-up questions presented per interview turn
MAX_INTERVIEW_QUESTIONS: int = 2

# Deterministic question catalog targeting observable evidence
QUESTION_CATALOG: Dict[str, Dict[str, Any]] = {
    "description": {
        "question_id": "description",
        "field": "description",
        "question": "Can you describe what you observed in a little more detail?",
        "answer_type": "free_text",
        "options": None,
        "allowed_values": None,
    },
    "water_appearance": {
        "question_id": "water_appearance",
        "field": "water_appearance",
        "question": "What did the water or visible surface look like?",
        "answer_type": "single_choice",
        "options": [
            QuestionOption(label="Clear / Transparent", value="clear"),
            QuestionOption(label="Cloudy / Murky", value="cloudy"),
            QuestionOption(label="Green surface material / Algae-like layer", value="green_surface_material"),
            QuestionOption(label="Oily film / Iridescent sheen", value="oily_sheen"),
            QuestionOption(label="Unnatural foam or suds", value="foamy"),
            QuestionOption(label="Unusually dark / Brown / Black", value="dark_discolored"),
            QuestionOption(label="Other visible appearance", value="other"),
        ],
        "allowed_values": {
            "clear",
            "cloudy",
            "green_surface_material",
            "oily_sheen",
            "foamy",
            "dark_discolored",
            "other",
        },
    },
    "flow_condition": {
        "question_id": "flow_condition",
        "field": "flow_condition",
        "question": "How was the water moving when you observed it?",
        "answer_type": "single_choice",
        "options": [
            QuestionOption(label="Flowing normally", value="flowing"),
            QuestionOption(label="Slowly moving", value="slow"),
            QuestionOption(label="Stagnant / Standing water", value="stagnant"),
            QuestionOption(label="Completely dry stream bed", value="dry"),
            QuestionOption(label="Not sure", value="not_sure"),
        ],
        "allowed_values": {"flowing", "slow", "stagnant", "dry", "not_sure"},
    },
    "odor": {
        "question_id": "odor",
        "field": "odor",
        "question": "Did you notice any unusual smell?",
        "answer_type": "single_choice",
        "options": [
            QuestionOption(label="No unusual smell noticed", value="none_noticed"),
            QuestionOption(label="Musty or earthy", value="musty_earthy"),
            QuestionOption(label="Sewage-like or sulfur/rotten egg", value="sewage"),
            QuestionOption(label="Chemical or petroleum-like", value="chemical"),
            QuestionOption(label="Other unusual smell", value="other"),
            QuestionOption(label="Not sure", value="not_sure"),
        ],
        "allowed_values": {
            "none_noticed",
            "musty_earthy",
            "sewage",
            "chemical",
            "other",
            "not_sure",
        },
    },
}


def generate_interview_questions(report: Report) -> EvidenceInterviewResponse:
    """
    Selects up to 2 targeted follow-up questions based on the authoritative
    evidence-quality completeness assessment.
    Maintains deterministic selection, ordering, and question IDs.
    """
    quality_assessment = assess_evidence_quality(report)
    missing_set = set(quality_assessment.missing)

    selected_questions: List[EvidenceInterviewQuestion] = []

    for dim in INTERVIEW_PRIORITY_ORDER:
        if dim in missing_set and dim in QUESTION_CATALOG:
            q_def = QUESTION_CATALOG[dim]
            selected_questions.append(
                EvidenceInterviewQuestion(
                    question_id=q_def["question_id"],
                    field=q_def["field"],
                    question=q_def["question"],
                    answer_type=q_def["answer_type"],
                    options=q_def["options"],
                )
            )
            if len(selected_questions) >= MAX_INTERVIEW_QUESTIONS:
                break

    return EvidenceInterviewResponse(
        report_id=report.id,
        questions=selected_questions,
    )


def apply_interview_answers(
    report: Report,
    answers: List[InterviewAnswerSubmission],
    db: Session,
) -> Tuple[Report, List[str]]:
    """
    Validates citizen answers against the question catalog and applies updates
    directly to the linked Report model fields.
    Guarantees that protected fields (id, status, timestamps) cannot be modified.
    """
    updated_fields: List[str] = []

    for item in answers:
        q_id = item.question_id
        if q_id not in QUESTION_CATALOG:
            allowed_ids = ", ".join(QUESTION_CATALOG.keys())
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown question_id '{q_id}'. Allowed question IDs: {allowed_ids}",
            )

        q_def = QUESTION_CATALOG[q_id]

        if q_def["answer_type"] == "single_choice":
            if item.value not in q_def["allowed_values"]:
                allowed_opts = ", ".join(sorted(list(q_def["allowed_values"])))
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid value '{item.value}' for {q_id}. Allowed values: {allowed_opts}",
                )
            setattr(report, q_def["field"], item.value)
            updated_fields.append(q_def["field"])

        elif q_id == "description":
            cleaned = item.value.strip()
            if len(cleaned) < 3:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Description answer must contain at least 3 non-whitespace characters",
                )
            if len(cleaned) > 5000:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Description answer exceeds maximum allowed length of 5000 characters",
                )
            setattr(report, "description", cleaned)
            updated_fields.append("description")

    report.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(report)

    return report, updated_fields
