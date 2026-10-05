import io
import math
from datetime import datetime, timezone
from typing import List, Optional
from PIL import Image, ImageFilter

from app.models.media import ReportMedia
from app.models.report import Report
from app.schemas.evidence_contract import EvidenceClass
from app.schemas.media_observation import (
    MediaObservationSupport,
    MediaVisualObservations,
    ReportMediaObservationsResponse,
    VisualObservation,
    VisualObservationType,
)
from app.services.storage import StorageBackend, get_storage

# Deterministic presentation ordering for observation types
OBSERVATION_ORDER = [
    VisualObservationType.IMAGE_TOO_DARK,
    VisualObservationType.IMAGE_TOO_BLURRY,
    VisualObservationType.INSUFFICIENT_WATER_VISIBILITY,
    VisualObservationType.WATER_SURFACE_VISIBLE,
    VisualObservationType.GREEN_VISUAL_REGION,
    VisualObservationType.DARK_OR_BROWN_DISCOLORATION,
    VisualObservationType.FOAM_LIKE_SURFACE_PATTERN,
    VisualObservationType.VISIBLE_LITTER,
]

_OBSERVATION_CACHE = {}


def extract_media_observations(
    media: ReportMedia,
    storage: Optional[StorageBackend] = None,
) -> List[VisualObservation]:
    """
    Extracts conservative, non-diagnostic visual signals from media bytes using Pillow.
    Ensures that observations describe only directly observable characteristics (E2_OBSERVED)
    with explicit uncertainty boundaries and zero diagnostic/causal overclaiming.
    """
    cache_key = (media.id, getattr(media, "sha256", None))
    if cache_key in _OBSERVATION_CACHE:
        return _OBSERVATION_CACHE[cache_key]

    # This service analyzes still images only. Do not label valid video as a corrupt image.
    if not media.content_type.startswith("image/"):
        return []

    if storage is None:
        storage = get_storage()

    support = MediaObservationSupport(
        media_id=media.id,
        sha256=media.sha256,
        content_type=media.content_type,
    )

    try:
        data = storage.read(media.storage_key)
        with Image.open(io.BytesIO(data)) as raw_img:
            img = raw_img.convert("RGB")
            width, height = img.size
    except Exception:
        return [
            VisualObservation(
                observation_id=f"{media.id}-insufficient-water-visibility",
                media_id=media.id,
                observation_type=VisualObservationType.INSUFFICIENT_WATER_VISIBILITY,
                evidence_class=EvidenceClass.E2_OBSERVED,
                description="The image payload could not be decoded or loaded for visual analysis.",
                uncertainty="Data read failure or corrupt media payload prevents visual feature extraction.",
                support=support,
            )
        ]

    # Extreme low resolution safeguard
    if width < 20 or height < 20:
        return [
            VisualObservation(
                observation_id=f"{media.id}-insufficient-water-visibility",
                media_id=media.id,
                observation_type=VisualObservationType.INSUFFICIENT_WATER_VISIBILITY,
                evidence_class=EvidenceClass.E2_OBSERVED,
                description="Image dimensions are too small for reliable visual signal extraction.",
                uncertainty="Insufficient pixel resolution prevents distinguishing surface features.",
                support=support,
            )
        ]

    # Standardized 100x100 grid for deterministic sampling
    grid = img.resize((100, 100), Image.Resampling.BILINEAR)
    pixels = [grid.getpixel((x, y)) for y in range(100) for x in range(100)]
    total_pixels = len(pixels)

    # 1. Luminance & Darkness analysis
    luminance_vals = [0.299 * r + 0.587 * g + 0.114 * b for r, g, b in pixels]
    mean_luminance = sum(luminance_vals) / total_pixels

    is_too_dark = mean_luminance < 25.0

    # 2. Pixel color categorization
    green_count = 0
    brown_count = 0
    foam_count = 0

    for r, g, b in pixels:
        # Green-dominant region
        if g > 55 and g > 1.2 * r and g > 1.15 * b:
            green_count += 1
        # Dark or brownish sediment discoloration
        elif (
            50 < r < 185
            and 40 < g < 155
            and b < 110
            and r > b + 15
            and g > b + 5
            and abs(r - g) <= 55
        ):
            brown_count += 1
        # Foam-like high-brightness neutral surface patch
        elif (
            r >= 210
            and g >= 210
            and b >= 210
            and abs(r - g) <= 20
            and abs(g - b) <= 20
            and abs(r - b) <= 20
        ):
            foam_count += 1

    green_pct = (green_count / total_pixels) * 100.0
    brown_pct = (brown_count / total_pixels) * 100.0
    foam_pct = (foam_count / total_pixels) * 100.0

    observations: List[VisualObservation] = []

    # Emit IMAGE_TOO_DARK
    if is_too_dark:
        observations.append(
            VisualObservation(
                observation_id=f"{media.id}-image-too-dark",
                media_id=media.id,
                observation_type=VisualObservationType.IMAGE_TOO_DARK,
                evidence_class=EvidenceClass.E2_OBSERVED,
                description="Image exhibits very low overall brightness, limiting visual observation of the water body.",
                uncertainty="Insufficient illumination may obscure surface characteristics and color fidelity.",
                support=support,
            )
        )
        if mean_luminance < 12.0:
            observations.append(
                VisualObservation(
                    observation_id=f"{media.id}-insufficient-water-visibility",
                    media_id=media.id,
                    observation_type=VisualObservationType.INSUFFICIENT_WATER_VISIBILITY,
                    evidence_class=EvidenceClass.E2_OBSERVED,
                    description="Severe darkness precludes observation of any water surface area.",
                    uncertainty="Visual inspection is prevented by extreme underexposure.",
                    support=support,
                )
            )

    # If lighting is adequate, evaluate surface characteristics
    if not is_too_dark:
        # WATER_SURFACE_VISIBLE
        if green_pct >= 15.0 or brown_pct >= 15.0 or foam_pct >= 2.0 or (30.0 <= mean_luminance <= 220.0):
            observations.append(
                VisualObservation(
                    observation_id=f"{media.id}-water-surface-visible",
                    media_id=media.id,
                    observation_type=VisualObservationType.WATER_SURFACE_VISIBLE,
                    evidence_class=EvidenceClass.E2_OBSERVED,
                    description="A coherent water surface area is visibly discernible in the image.",
                    uncertainty="Surface reflections, ripples, or lighting variations may limit depth perception and exact water boundaries.",
                    support=support,
                )
            )

        # GREEN_VISUAL_REGION
        if green_pct >= 15.0:
            observations.append(
                VisualObservation(
                    observation_id=f"{media.id}-green-visual-region",
                    media_id=media.id,
                    observation_type=VisualObservationType.GREEN_VISUAL_REGION,
                    evidence_class=EvidenceClass.E2_OBSERVED,
                    description="A green-colored visual region is present in the submitted image.",
                    uncertainty="Color may be affected by lighting, camera processing, aquatic vegetation, or surface reflection.",
                    support=support,
                )
            )

        # DARK_OR_BROWN_DISCOLORATION
        if brown_pct >= 15.0:
            observations.append(
                VisualObservation(
                    observation_id=f"{media.id}-dark-or-brown-discoloration",
                    media_id=media.id,
                    observation_type=VisualObservationType.DARK_OR_BROWN_DISCOLORATION,
                    evidence_class=EvidenceClass.E2_OBSERVED,
                    description="A dark or brownish discoloration region is present in the submitted image.",
                    uncertainty="Brown or dark coloration may stem from natural sediment, tannins, suspended particles, or shadows.",
                    support=support,
                )
            )

        # FOAM_LIKE_SURFACE_PATTERN
        if 2.0 <= foam_pct <= 45.0:
            observations.append(
                VisualObservation(
                    observation_id=f"{media.id}-foam-like-surface-pattern",
                    media_id=media.id,
                    observation_type=VisualObservationType.FOAM_LIKE_SURFACE_PATTERN,
                    evidence_class=EvidenceClass.E2_OBSERVED,
                    description="A high-brightness, foam-like surface pattern is present in the submitted image.",
                    uncertainty="Foam-like appearance can be caused by natural turbulence, organic decay, wind action, or surface glare; origin cannot be determined visually.",
                    support=support,
                )
            )

    # Sort observations deterministically according to controlled order
    observations.sort(key=lambda o: OBSERVATION_ORDER.index(o.observation_type))
    _OBSERVATION_CACHE[cache_key] = observations
    return observations


def extract_report_media_observations(
    report: Report,
    storage: Optional[StorageBackend] = None,
) -> ReportMediaObservationsResponse:
    """
    Extracts structured visual observations for all media linked to a report,
    preserving deterministic order and traceability.
    """
    if storage is None:
        storage = get_storage()

    media_items = sorted(
        getattr(report, "media", []) or [],
        key=lambda m: (m.created_at or datetime.min.replace(tzinfo=timezone.utc), str(m.id)),
    )

    media_results: List[MediaVisualObservations] = []
    for media in media_items:
        obs_list = extract_media_observations(media=media, storage=storage)
        media_results.append(
            MediaVisualObservations(
                media_id=media.id,
                observations=obs_list,
            )
        )

    return ReportMediaObservationsResponse(
        report_id=report.id,
        media=media_results,
    )
