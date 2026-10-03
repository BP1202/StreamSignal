"""
StreamSignal — FHIR R4 Bundle & Resource Schemas (Track 7 Interoperability)
Defines deterministic, standards-aligned models for FHIR R4 Bundle exports.
Strictly maps real StreamSignal evidence to:
- Location
- QuestionnaireResponse
- Observation (Citizen & Machine separated)
- Media (Safe metadata & sha256)
- Task (Human review workflow requested)
- Provenance (Authoritative Evidence Lineage mapping)
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict


class FHIRCoding(BaseModel):
    system: Optional[str] = None
    code: Optional[str] = None
    display: Optional[str] = None


class FHIRCodeableConcept(BaseModel):
    coding: List[FHIRCoding] = Field(default_factory=list)
    text: Optional[str] = None


class FHIRReference(BaseModel):
    reference: str = Field(..., description="Internal or external resource reference (e.g. Location/loc-123)")
    display: Optional[str] = None


class FHIRPosition(BaseModel):
    longitude: float
    latitude: float


class FHIRLocation(BaseModel):
    resourceType: str = "Location"
    id: str
    status: str = "active"
    name: str = "Freshwater Observation Site"
    description: Optional[str] = None
    position: FHIRPosition


class FHIRQuestionAnswer(BaseModel):
    valueString: Optional[str] = None
    valueBoolean: Optional[bool] = None


class FHIRQuestionItem(BaseModel):
    linkId: str
    text: str
    answer: List[FHIRQuestionAnswer] = Field(default_factory=list)


class FHIRQuestionnaireResponse(BaseModel):
    resourceType: str = "QuestionnaireResponse"
    id: str
    status: str = "completed"
    subject: Optional[FHIRReference] = None
    authored: str
    author: Optional[FHIRReference] = None
    item: List[FHIRQuestionItem] = Field(default_factory=list)


class FHIRAnnotation(BaseModel):
    text: str


class FHIRObservation(BaseModel):
    resourceType: str = "Observation"
    id: str
    status: str = "preliminary"
    category: List[FHIRCodeableConcept] = Field(default_factory=list)
    code: FHIRCodeableConcept
    subject: Optional[FHIRReference] = None
    effectiveDateTime: Optional[str] = None
    performer: List[FHIRReference] = Field(default_factory=list)
    valueString: Optional[str] = None
    interpretation: List[FHIRCodeableConcept] = Field(default_factory=list)
    note: List[FHIRAnnotation] = Field(default_factory=list)
    derivedFrom: List[FHIRReference] = Field(default_factory=list)


class FHIRAttachment(BaseModel):
    contentType: str
    url: str
    size: Optional[int] = None
    hash: Optional[str] = None
    title: Optional[str] = None


class FHIRMedia(BaseModel):
    resourceType: str = "Media"
    id: str
    status: str = "completed"
    type: FHIRCodeableConcept
    subject: Optional[FHIRReference] = None
    createdDateTime: Optional[str] = None
    content: FHIRAttachment


class FHIRTask(BaseModel):
    resourceType: str = "Task"
    id: str
    status: str = "requested"  # requested, in-progress, completed, rejected
    intent: str = "order"
    code: FHIRCodeableConcept
    description: str
    focus: Optional[FHIRReference] = None
    authoredOn: str
    lastModified: str
    requester: Optional[FHIRReference] = None


class FHIRProvenanceAgent(BaseModel):
    type: Optional[FHIRCodeableConcept] = None
    who: FHIRReference


class FHIRProvenance(BaseModel):
    resourceType: str = "Provenance"
    id: str
    target: List[FHIRReference]
    recorded: str
    activity: Optional[FHIRCodeableConcept] = None
    agent: List[FHIRProvenanceAgent] = Field(default_factory=list)


class FHIRBundleEntry(BaseModel):
    fullUrl: str
    resource: Dict[str, Any]


class FHIRBundle(BaseModel):
    resourceType: str = "Bundle"
    id: str
    type: str = "collection"
    timestamp: str
    total: int
    entry: List[FHIRBundleEntry] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")
