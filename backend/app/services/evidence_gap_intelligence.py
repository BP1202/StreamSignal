"""
StreamSignal — Evidence Gap Intelligence Service (Issue 17)

Analyzes real persisted SignalCases from PostgreSQL to produce availability statistics
for configurable evidence dimensions. This service:

  1. Queries only REAL database records — zero synthetic/fake data.
  2. Returns empty results when the database is empty (no phantom gaps).
  3. Produces availability ratios, not confidence scores.
  4. Explicitly frames all output as "evidence availability" — not environmental claims.
  5. Generates precise epistemic statements per dimension.

Evidence Gap ≠ Evidence Quality:
  - An evidence gap means a value is absent/None from the persisted SignalCase record.
  - It does NOT mean the observation was low quality, wrong, or environmentally suspicious.
  - Researchers decide whether a gap is worth addressing through a MissionNeed.
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import func, case, select
from sqlalchemy.orm import Session

from app.models.report import Report
from app.models.media import ReportMedia
from app.schemas.evidence_gap import EvidenceGapDetail, EvidenceGapListResponse, EvidenceGapSummary

logger = logging.getLogger("streamsignal.evidence_gap")

# ──────────────────────────────────────────────────────────────────────────────
# Evidence dimension definitions
# Each entry maps a stable dimension ID → (SQL check fn, label)
# A case is "missing" this dimension when the SQL check evaluates to True/NULL.
# ──────────────────────────────────────────────────────────────────────────────
DIMENSION_LABEL = {
    "flow_condition": "Flow Condition",
    "water_appearance": "Water Appearance",
    "odor": "Odor Observation",
    "foam_observed": "Foam Observed",
    "dead_wildlife_observed": "Dead Wildlife Observed",
    "photo": "Photo / Media",
}


def _epistemic_statement(dimension_label: str, cases_missing: int, total: int) -> str:
    """Generates a dimension-specific, non-claim epistemic framing statement."""
    if total == 0:
        return (
            f"No SignalCases have been analyzed yet. "
            f"'{dimension_label}' availability statistics are unavailable."
        )
    ratio = cases_missing / total
    if ratio == 0.0:
        return (
            f"All analyzed SignalCases include a '{dimension_label}' value. "
            f"No availability gap detected for this dimension."
        )
    return (
        f"{cases_missing} of {total} analyzed SignalCases ({ratio:.0%}) "
        f"do not include a '{dimension_label}' value. "
        f"This is an evidence availability statistic only. "
        f"It does not establish environmental condition, contamination, or health impact."
    )


def analyze_evidence_gaps(
    db: Session,
    min_cases: int = 1,
) -> EvidenceGapListResponse:
    """
    Analyze evidence availability across all real SignalCases in PostgreSQL.
    Returns structured EvidenceGapListResponse.

    - If the database contains no cases, returns empty list with zero counts.
    - `min_cases` is a minimum threshold filter — gaps are only included
      when at least this many cases have been analyzed.
    """
    # Count total eligible SignalCases
    total_result = db.execute(select(func.count(Report.id)))
    total_cases = total_result.scalar_one() or 0

    analysis_timestamp = datetime.now(timezone.utc)

    if total_cases == 0:
        logger.info("Evidence gap analysis: no SignalCases in database, returning empty result.")
        return EvidenceGapListResponse(
            total_cases_analyzed=0,
            gaps=[],
            analysis_timestamp=analysis_timestamp,
        )

    # ── Per-dimension availability queries ──────────────────────────────────

    gaps: List[EvidenceGapSummary] = []

    # --- Scalar columns: flow_condition, water_appearance, odor ---
    scalar_dims = [
        ("flow_condition", "Flow Condition", Report.flow_condition),
        ("water_appearance", "Water Appearance", Report.water_appearance),
        ("odor", "Odor Observation", Report.odor),
    ]
    for dim_id, dim_label, col in scalar_dims:
        result = db.execute(
            select(
                func.count(Report.id).label("total"),
                func.sum(case((col.is_(None), 1), else_=0)).label("missing"),
                func.min(Report.created_at).label("first"),
                func.max(Report.created_at).label("last"),
            )
        )
        row = result.one()
        total = row.total or 0
        missing = row.missing or 0
        present = total - missing
        ratio = present / total if total > 0 else 0.0

        if total < min_cases:
            continue

        gaps.append(EvidenceGapSummary(
            dimension=dim_id,
            dimension_label=dim_label,
            total_cases_analyzed=total,
            cases_with_evidence=present,
            cases_missing_evidence=missing,
            availability_ratio=round(ratio, 4),
            affected_segment_ids=[],
            first_observed_at=row.first,
            last_observed_at=row.last,
        ))

    # --- Boolean columns: foam_observed, dead_wildlife_observed ---
    # For boolean dimensions, "missing" = NULL (never set), not False.
    # False = "citizen explicitly said no" = present evidence value.
    bool_dims = [
        ("foam_observed", "Foam Observed", Report.foam_observed),
        ("dead_wildlife_observed", "Dead Wildlife Observed", Report.dead_wildlife_observed),
    ]
    for dim_id, dim_label, col in bool_dims:
        result = db.execute(
            select(
                func.count(Report.id).label("total"),
                func.sum(case((col.is_(None), 1), else_=0)).label("missing"),
                func.min(Report.created_at).label("first"),
                func.max(Report.created_at).label("last"),
            )
        )
        row = result.one()
        total = row.total or 0
        missing = row.missing or 0
        present = total - missing
        ratio = present / total if total > 0 else 0.0

        if total < min_cases:
            continue

        gaps.append(EvidenceGapSummary(
            dimension=dim_id,
            dimension_label=dim_label,
            total_cases_analyzed=total,
            cases_with_evidence=present,
            cases_missing_evidence=missing,
            availability_ratio=round(ratio, 4),
            affected_segment_ids=[],
            first_observed_at=row.first,
            last_observed_at=row.last,
        ))

    # --- Photo / media dimension: based on related ReportMedia rows ---
    photo_result = db.execute(
        select(
            func.count(Report.id).label("total_cases"),
            func.count(ReportMedia.id).label("cases_with_media"),
            func.min(Report.created_at).label("first"),
            func.max(Report.created_at).label("last"),
        ).outerjoin(ReportMedia, ReportMedia.report_id == Report.id)
    )
    photo_row = photo_result.one()
    total_ph = photo_row.total_cases or 0
    present_ph = photo_row.cases_with_media or 0
    missing_ph = max(total_ph - present_ph, 0)
    ratio_ph = present_ph / total_ph if total_ph > 0 else 0.0

    if total_ph >= min_cases:
        gaps.append(EvidenceGapSummary(
            dimension="photo",
            dimension_label="Photo / Media",
            total_cases_analyzed=total_ph,
            cases_with_evidence=present_ph,
            cases_missing_evidence=missing_ph,
            availability_ratio=round(ratio_ph, 4),
            affected_segment_ids=[],
            first_observed_at=photo_row.first,
            last_observed_at=photo_row.last,
        ))

    logger.info(
        "Evidence gap analysis complete: %d cases, %d dimensions evaluated.",
        total_cases,
        len(gaps),
    )
    return EvidenceGapListResponse(
        total_cases_analyzed=total_cases,
        gaps=gaps,
        analysis_timestamp=analysis_timestamp,
    )


def get_evidence_gap_detail(
    db: Session,
    dimension: str,
) -> Optional[EvidenceGapDetail]:
    """
    Return detailed gap info for a single dimension, including affected case IDs.
    Returns None if the dimension is not recognized.
    """
    if dimension not in DIMENSION_LABEL:
        return None

    dim_label = DIMENSION_LABEL[dimension]

    if dimension == "photo":
        result = db.execute(
            select(
                Report.id,
                Report.created_at,
                ReportMedia.id.label("media_id"),
            ).outerjoin(ReportMedia, ReportMedia.report_id == Report.id)
        )
        rows = result.all()
        total = len(rows)
        present = sum(1 for r in rows if r.media_id is not None)
        missing = total - present
        affected = [str(r.id) for r in rows if r.media_id is None]
        times = [r.created_at for r in rows if r.created_at]
        first = min(times) if times else None
        last = max(times) if times else None

    else:
        col = getattr(Report, dimension)
        result = db.execute(
            select(Report.id, col.label("val"), Report.created_at)
        )
        rows = result.all()
        total = len(rows)
        missing = sum(1 for r in rows if r.val is None)
        present = total - missing
        affected = [str(r.id) for r in rows if r.val is None]
        times = [r.created_at for r in rows if r.created_at]
        first = min(times) if times else None
        last = max(times) if times else None

    ratio = present / total if total > 0 else 0.0
    return EvidenceGapDetail(
        dimension=dimension,
        dimension_label=dim_label,
        total_cases_analyzed=total,
        cases_with_evidence=present,
        cases_missing_evidence=missing,
        availability_ratio=round(ratio, 4),
        affected_case_ids=affected,
        affected_segment_ids=[],
        first_observed_at=first,
        last_observed_at=last,
        epistemic_statement=_epistemic_statement(dim_label, missing, total),
    )
