import math
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload

from app.models.report import Report
from app.schemas.contextual_evidence import (
    PatternEchoMatch,
    PatternEchoResponse,
    PatternEchoStatus,
)
from app.services.media_observation import extract_media_observations
from app.services.storage import StorageBackend, get_storage

DEFAULT_SEARCH_RADIUS_METERS = 1000.0
DEFAULT_HISTORICAL_WINDOW_DAYS = 30
DEFAULT_MAX_SIMILAR_CASES = 5


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two geographic coordinates in decimal degrees.
    Uses the Haversine formula on a standard WGS84 spherical approximation.
    Returns distance in meters.
    """
    r = 6371000.0  # Mean radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def evaluate_pattern_echo(
    report: Report,
    db: Session,
    search_radius_meters: float = DEFAULT_SEARCH_RADIUS_METERS,
    historical_window_days: int = DEFAULT_HISTORICAL_WINDOW_DAYS,
    max_cases: int = DEFAULT_MAX_SIMILAR_CASES,
    storage: Optional[StorageBackend] = None,
) -> PatternEchoResponse:
    """
    Evaluates Pattern Echo historical contextual evidence for a report.

    Performs:
    1. Bounded spatial and temporal database querying to avoid full-table scans.
    2. Exact Haversine distance verification within search radius.
    3. Structured observation comparison (water appearance, flow, odor, affirmative booleans).
    4. Reuses Issue 8 media visual observation signals where images are attached.
    5. Deterministic ranking and plain-language explainability.
    6. Strictly communicates that similarity does not equal environmental causation.
    """
    if storage is None:
        storage = get_storage()

    # 1. Calculate geographic bounding box in degrees
    # ~111,139 meters per degree of latitude
    lat_delta = search_radius_meters / 111139.0
    cos_lat = max(math.cos(math.radians(report.latitude)), 0.01)
    lon_delta = search_radius_meters / (111139.0 * cos_lat)

    min_lat = report.latitude - lat_delta
    max_lat = report.latitude + lat_delta
    min_lon = report.longitude - lon_delta
    max_lon = report.longitude + lon_delta

    cutoff_date = report.observed_at - timedelta(days=historical_window_days)

    # 2. Bounded database query: strictly historical (observed_at < current), within time window & spatial box
    candidate_reports: List[Report] = (
        db.query(Report)
        .options(joinedload(Report.media))
        .filter(
            Report.id != report.id,
            Report.observed_at < report.observed_at,
            Report.observed_at >= cutoff_date,
            Report.latitude.between(min_lat, max_lat),
            Report.longitude.between(min_lon, max_lon),
        )
        .all()
    )

    # 3. Extract current report media visual observations once
    current_visual_types = set()
    for m in (getattr(report, "media", []) or []):
        for obs in extract_media_observations(m, storage=storage):
            current_visual_types.add(obs.observation_type)

    matches: List[PatternEchoMatch] = []

    # 4. Evaluate each candidate against similarity criteria
    candidate_scored_list = []
    for cand in candidate_reports:
        # Exact great circle distance
        dist_m = calculate_haversine_distance(
            report.latitude, report.longitude, cand.latitude, cand.longitude
        )
        if dist_m > search_radius_meters:
            continue

        matched_signals: List[str] = []
        similarity_explanation: List[str] = []

        dist_km = round(dist_m / 1000.0, 2)
        similarity_explanation.append(f"Reported within {dist_km} km of the current observation.")

        days_diff = max(0, (report.observed_at - cand.observed_at).days)
        similarity_explanation.append(f"Observed {days_diff} days earlier.")

        # Structured field matching
        if report.water_appearance and cand.water_appearance == report.water_appearance:
            matched_signals.append("same_water_appearance")
            similarity_explanation.append("Same reported water appearance.")

        if report.flow_condition and cand.flow_condition == report.flow_condition:
            matched_signals.append("same_flow_condition")
            similarity_explanation.append("Same reported flow condition.")

        if report.odor and cand.odor == report.odor:
            matched_signals.append("same_odor")
            similarity_explanation.append("Same reported odor.")

        # Positive boolean observations ONLY (False is not absence proof)
        if report.foam_observed is True and cand.foam_observed is True:
            matched_signals.append("same_positive_foam_observation")
            similarity_explanation.append("Shared positive observation of unnatural foam.")

        if report.litter_observed is True and cand.litter_observed is True:
            matched_signals.append("same_positive_litter_observation")
            similarity_explanation.append("Shared positive observation of visible litter/debris.")

        if report.dead_wildlife_observed is True and cand.dead_wildlife_observed is True:
            matched_signals.append("same_positive_dead_wildlife_observation")
            similarity_explanation.append("Shared positive observation of dead aquatic life.")

        # Reused Issue 8 visual observation signals
        cand_visual_types = set()
        for m in (getattr(cand, "media", []) or []):
            for obs in extract_media_observations(m, storage=storage):
                cand_visual_types.add(obs.observation_type)

        shared_visuals = sorted(
            list(current_visual_types & cand_visual_types),
            key=lambda vt: vt.value,
        )
        for vt in shared_visuals:
            signal_key = f"shared_{vt.value.lower()}"
            matched_signals.append(signal_key)
            similarity_explanation.append(f"Shared visual observation: {vt.value}.")

        # Candidate must have at least one matching observation signal
        if not matched_signals:
            continue

        # Deterministic scoring: higher signal count preferred, closer distance, more recent
        score = len(matched_signals) * 1000.0 - dist_m - (days_diff * 10.0)

        match_obj = PatternEchoMatch(
            report_id=cand.id,
            observed_at=cand.observed_at,
            distance_meters=round(dist_m, 1),
            days_difference=days_diff,
            matched_signals=matched_signals,
            similarity_explanation=similarity_explanation,
        )
        candidate_scored_list.append((score, dist_m, days_diff, str(cand.id), match_obj))

    # 5. Deterministic sorting: higher score, closer distance, fewer days, stable UUID
    candidate_scored_list.sort(key=lambda item: (-item[0], item[1], item[2], item[3]))
    top_matches = [item[4] for item in candidate_scored_list[:max_cases]]

    # 6. Response assembly
    if top_matches:
        status = PatternEchoStatus.AVAILABLE
        count = len(top_matches)
        summary = (
            f"{count} similar historical observation{' was' if count == 1 else 's were'} "
            f"found nearby within the selected time window."
        )
    else:
        status = PatternEchoStatus.NO_MATCHES
        summary = "No similar historical observations were found nearby within the selected time window."

    return PatternEchoResponse(
        report_id=report.id,
        status=status,
        search_radius_meters=search_radius_meters,
        historical_window_days=historical_window_days,
        matches=top_matches,
        summary=summary,
        interpretation_limit=(
            "Historical similarity indicates recurrence of reported observations only. "
            "It does not establish environmental cause, pollution, toxicity, health risk, or contamination."
        ),
    )
