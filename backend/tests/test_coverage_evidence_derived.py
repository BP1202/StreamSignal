"""
StreamSignal — Rigorous Evidence Coverage Calculation Tests
Proves that every displayed coverage number comes strictly from:
SignalCases + tracked dimensions + actual evidence in the database.
Zero UI constants. Zero synthetic guessing.

Verifies the user's exact specification:
1. 100 cases, 6 tracked dimensions -> 600 potential dimension slots.
2. If only 300 dimension slots are actually present in the database:
   Coverage = 50.0%
3. If a citizen fills an actually missing dimension:
   300 -> 301 present slots
   Coverage increases accordingly (50.17%).
4. If a citizen uploads another photo where media already exists:
   300 -> 300 present slots
   Coverage must NOT increase (remains exactly 50.0%).
5. Empty database -> 0 cases, 0 slots, 0.0% coverage.
"""

import uuid
from datetime import datetime, timezone
import pytest
from sqlalchemy.orm import Session

from app.models.report import Report
from app.models.media import ReportMedia
from app.services.evidence_gap_intelligence import (
    DIMENSION_LABEL,
    analyze_evidence_gaps,
    get_evidence_gap_detail,
)


def test_coverage_empty_database_strictly_zero(sync_test_db: Session):
    """Empty database must return 0 cases, 0 potential slots, 0 present slots, 0.0% coverage."""
    # Clean up any existing reports in test database
    sync_test_db.query(ReportMedia).delete()
    sync_test_db.query(Report).delete()
    sync_test_db.commit()

    result = analyze_evidence_gaps(sync_test_db, min_cases=1)

    assert result.total_cases_analyzed == 0
    assert result.total_potential_dimensions == 0
    assert result.total_dimensions_present == 0
    assert result.overall_coverage_percentage == 0.0
    assert result.overall_coverage_ratio == 0.0
    assert result.potential_coverage_per_dimension == 0.0


def test_coverage_100_cases_300_slots_is_50_percent(sync_test_db: Session):
    """
    100 SignalCases x 6 tracked dimensions = 600 potential evidence slots.
    If exactly 300 slots are present in DB:
    Coverage must be exactly 50.0%.
    """
    sync_test_db.query(ReportMedia).delete()
    sync_test_db.query(Report).delete()
    sync_test_db.commit()

    assert len(DIMENSION_LABEL) == 6, "Exactly 6 tracked dimensions expected."

    # Create 100 cases
    # 50 cases with all 6 dimensions present (including photo) -> 50 x 6 = 300 present slots
    # 50 cases with 0 dimensions present (all missing/empty/no media) -> 50 x 0 = 0 present slots
    # Total present = 300 out of 600 potential slots -> 50.0%
    reports = []
    for i in range(50):
        r = Report(
            id=uuid.uuid4(),
            latitude=24.5854 + (i * 0.001),
            longitude=73.7125 + (i * 0.001),
            description=f"Stream observation {i}",
            flow_condition="flowing",         # Present (1)
            water_appearance="clear",         # Present (2)
            odor="none",                      # Present (3)
            foam_observed=True,               # Present (4)
            dead_wildlife_observed=True,      # Present (5)
            observed_at=datetime.now(timezone.utc),
            status="SUBMITTED",
        )
        reports.append(r)

    for i in range(50, 100):
        r = Report(
            id=uuid.uuid4(),
            latitude=24.5854 + (i * 0.001),
            longitude=73.7125 + (i * 0.001),
            description=f"Stream observation {i}",
            flow_condition=None,              # Missing
            water_appearance=None,            # Missing
            odor=None,                        # Missing
            foam_observed=False,              # Missing (not affirmed)
            dead_wildlife_observed=False,     # Missing (not affirmed)
            observed_at=datetime.now(timezone.utc),
            status="SUBMITTED",
        )
        reports.append(r)

    sync_test_db.add_all(reports)
    sync_test_db.commit()

    # Add 1 photo for each of the first 50 reports (photo is present for reports 0-49)
    media_items = [
        ReportMedia(
            report_id=r.id,
            storage_key=f"photos/{r.id}/initial.jpg",
            original_filename="initial.jpg",
            content_type="image/jpeg",
            size_bytes=2048,
            sha256="a" * 64,
        )
        for r in reports[:50]
    ]
    sync_test_db.add_all(media_items)
    sync_test_db.commit()

    result = analyze_evidence_gaps(sync_test_db, min_cases=1)

    assert result.total_cases_analyzed == 100
    assert result.total_potential_dimensions == 600
    assert result.total_dimensions_present == 300
    assert result.overall_coverage_percentage == 50.0
    assert result.overall_coverage_ratio == 0.5


def test_coverage_uploading_photo_where_media_already_exists_does_not_increase_coverage(sync_test_db: Session):
    """
    User specification:
    'If they upload another photo where media already exists:
    300 -> 300
    coverage must not increase.'
    """
    sync_test_db.query(ReportMedia).delete()
    sync_test_db.query(Report).delete()
    sync_test_db.commit()

    # Create 100 cases
    # 50 cases have 6 dimensions present (including 1 photo each) -> 50 x 6 = 300 slots.
    # 50 cases have 0 dimensions present (all None/no media) -> 50 x 0 = 0 slots.
    # Total present = 300 / 600 = 50.0%.
    reports = []
    for i in range(50):
        r = Report(
            id=uuid.uuid4(),
            latitude=24.0 + (i * 0.01),
            longitude=73.0 + (i * 0.01),
            description=f"Complete observation {i}",
            flow_condition="moderate",
            water_appearance="turbid",
            odor="sulfuric",
            foam_observed=True,
            dead_wildlife_observed=True,
            observed_at=datetime.now(timezone.utc),
            status="SUBMITTED",
        )
        reports.append(r)

    for i in range(50, 100):
        r = Report(
            id=uuid.uuid4(),
            latitude=24.0 + (i * 0.01),
            longitude=73.0 + (i * 0.01),
            description=f"Bare observation {i}",
            flow_condition=None,
            water_appearance=None,
            odor=None,
            foam_observed=None,
            dead_wildlife_observed=None,
            observed_at=datetime.now(timezone.utc),
            status="SUBMITTED",
        )
        reports.append(r)

    sync_test_db.add_all(reports)
    sync_test_db.commit()

    # Add 1 photo to each of the first 50 reports
    media_items = []
    for r in reports[:50]:
        m = ReportMedia(
            report_id=r.id,
            storage_key=f"photos/{r.id}/initial.jpg",
            original_filename="initial.jpg",
            content_type="image/jpeg",
            size_bytes=2048,
            sha256="a" * 64,
        )
        media_items.append(m)

    sync_test_db.add_all(media_items)
    sync_test_db.commit()

    # Check baseline: exactly 300 present out of 600 -> 50.0%
    baseline = analyze_evidence_gaps(sync_test_db, min_cases=1)
    assert baseline.total_cases_analyzed == 100
    assert baseline.total_potential_dimensions == 600
    assert baseline.total_dimensions_present == 300
    assert baseline.overall_coverage_percentage == 50.0

    # NOW: Upload an additional photo to report 0 (which ALREADY has a photo)
    existing_report = reports[0]
    second_media = ReportMedia(
        report_id=existing_report.id,
        storage_key=f"photos/{existing_report.id}/second.jpg",
        original_filename="second.jpg",
        content_type="image/jpeg",
        size_bytes=4096,
        sha256="b" * 64,
    )
    third_media = ReportMedia(
        report_id=existing_report.id,
        storage_key=f"photos/{existing_report.id}/third.jpg",
        original_filename="third.jpg",
        content_type="image/jpeg",
        size_bytes=8192,
        sha256="c" * 64,
    )
    sync_test_db.add_all([second_media, third_media])
    sync_test_db.commit()

    # Re-evaluate coverage from the database:
    after_duplicate_photos = analyze_evidence_gaps(sync_test_db, min_cases=1)

    # Coverage MUST NOT increase! Present slots must remain 300!
    assert after_duplicate_photos.total_cases_analyzed == 100
    assert after_duplicate_photos.total_potential_dimensions == 600
    assert after_duplicate_photos.total_dimensions_present == 300, (
        f"Present dimensions must remain 300, got {after_duplicate_photos.total_dimensions_present}."
    )
    assert after_duplicate_photos.overall_coverage_percentage == 50.0, (
        f"Coverage must remain 50.0%, got {after_duplicate_photos.overall_coverage_percentage}%."
    )


def test_coverage_filling_missing_dimension_increases_count_from_300_to_301(sync_test_db: Session):
    """
    User specification:
    'If a citizen fills an actually missing dimension:
    300 -> 301
    coverage changes accordingly.'
    """
    sync_test_db.query(ReportMedia).delete()
    sync_test_db.query(Report).delete()
    sync_test_db.commit()

    # Start with 100 cases and exactly 300 present dimensions (50 complete x 6 = 300)
    reports = []
    for i in range(50):
        r = Report(
            id=uuid.uuid4(),
            latitude=24.0 + (i * 0.01),
            longitude=73.0 + (i * 0.01),
            description=f"Observation {i}",
            flow_condition="stagnant",
            water_appearance="green",
            odor="musty",
            foam_observed=True,
            dead_wildlife_observed=True,
            observed_at=datetime.now(timezone.utc),
            status="SUBMITTED",
        )
        reports.append(r)

    for i in range(50, 100):
        r = Report(
            id=uuid.uuid4(),
            latitude=24.0 + (i * 0.01),
            longitude=73.0 + (i * 0.01),
            description=f"Observation {i}",
            flow_condition=None,
            water_appearance=None,
            odor=None,
            foam_observed=False,
            dead_wildlife_observed=False,
            observed_at=datetime.now(timezone.utc),
            status="SUBMITTED",
        )
        reports.append(r)

    sync_test_db.add_all(reports)
    sync_test_db.commit()

    # Add photos for the first 50
    media_items = [
        ReportMedia(
            report_id=r.id,
            storage_key=f"photos/{r.id}/initial.jpg",
            original_filename="initial.jpg",
            content_type="image/jpeg",
            size_bytes=2048,
            sha256="a" * 64,
        )
        for r in reports[:50]
    ]
    sync_test_db.add_all(media_items)
    sync_test_db.commit()

    initial = analyze_evidence_gaps(sync_test_db, min_cases=1)
    assert initial.total_dimensions_present == 300
    assert initial.overall_coverage_percentage == 50.0

    # A citizen fills an actually missing dimension (photo on report 99 which had NO photos)
    case_without_photo = reports[99]
    first_photo = ReportMedia(
        report_id=case_without_photo.id,
        storage_key=f"photos/{case_without_photo.id}/evidence.jpg",
        original_filename="evidence.jpg",
        content_type="image/jpeg",
        size_bytes=3000,
        sha256="d" * 64,
    )
    sync_test_db.add(first_photo)
    sync_test_db.commit()

    # Re-evaluate
    after_fill = analyze_evidence_gaps(sync_test_db, min_cases=1)

    # 300 -> 301
    assert after_fill.total_dimensions_present == 301, (
        f"Present dimensions must be 301, got {after_fill.total_dimensions_present}."
    )
    expected_pct = round((301 / 600) * 100, 2)  # 50.17%
    assert after_fill.overall_coverage_percentage == expected_pct == 50.17


def test_coverage_gap_detail_matches_aggregate_counts(sync_test_db: Session):
    """Detail view for each dimension must precisely match the aggregate gap numbers."""
    sync_test_db.query(ReportMedia).delete()
    sync_test_db.query(Report).delete()
    sync_test_db.commit()

    # Create 10 cases: 4 have photos, 6 have flow_condition
    reports = []
    for i in range(10):
        r = Report(
            id=uuid.uuid4(),
            latitude=24.0,
            longitude=73.0,
            description=f"Detail test {i}",
            flow_condition="rapid" if i < 6 else None,
            water_appearance=None,
            odor=None,
            foam_observed=None,
            dead_wildlife_observed=None,
            observed_at=datetime.now(timezone.utc),
            status="SUBMITTED",
        )
        reports.append(r)

    sync_test_db.add_all(reports)
    sync_test_db.commit()

    # Add 2 photos to report 0, 1 photo to report 1, 1 photo to report 2, 1 photo to report 3
    # Total distinct reports with media = 4 (reports 0, 1, 2, 3)
    media_items = [
        ReportMedia(report_id=reports[0].id, storage_key="k1", original_filename="f1.jpg", content_type="image/jpeg", size_bytes=100, sha256="1"*64),
        ReportMedia(report_id=reports[0].id, storage_key="k2", original_filename="f2.jpg", content_type="image/jpeg", size_bytes=100, sha256="2"*64),
        ReportMedia(report_id=reports[1].id, storage_key="k3", original_filename="f3.jpg", content_type="image/jpeg", size_bytes=100, sha256="3"*64),
        ReportMedia(report_id=reports[2].id, storage_key="k4", original_filename="f4.jpg", content_type="image/jpeg", size_bytes=100, sha256="4"*64),
        ReportMedia(report_id=reports[3].id, storage_key="k5", original_filename="f5.jpg", content_type="image/jpeg", size_bytes=100, sha256="5"*64),
    ]
    sync_test_db.add_all(media_items)
    sync_test_db.commit()

    # Detail for photo
    detail_photo = get_evidence_gap_detail(sync_test_db, "photo")
    assert detail_photo is not None
    assert detail_photo.total_cases_analyzed == 10
    assert detail_photo.cases_with_evidence == 4
    assert detail_photo.cases_missing_evidence == 6
    assert len(detail_photo.affected_case_ids) == 6
    assert str(reports[0].id) not in detail_photo.affected_case_ids

    # Detail for flow_condition
    detail_flow = get_evidence_gap_detail(sync_test_db, "flow_condition")
    assert detail_flow is not None
    assert detail_flow.total_cases_analyzed == 10
    assert detail_flow.cases_with_evidence == 6
    assert detail_flow.cases_missing_evidence == 4
    assert len(detail_flow.affected_case_ids) == 4
