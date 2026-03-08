from pydantic import BaseModel
from typing import Optional, List, Dict
from enum import Enum
from datetime import datetime
from .subject import PartConfiguration

class QuestionBankStatus(str, Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class GenerateQuestionsRequest(BaseModel):
    subject_id: str
    syllabus_id: str
    pattern_id: Optional[str] = None
    custom_parts: Optional[List[PartConfiguration]] = None
    selected_unit_ids: Optional[List[int]] = None  # unit numbers to include (1-based); None = all units
    # { partName -> { unitNumber -> count } }  — explicit per-unit question allocation per part
    unit_question_counts: Optional[Dict[str, Dict[int, int]]] = None
    # { unitNumber -> [PartConfiguration] }  — full per-unit config (Individual mode)
    unit_configs: Optional[Dict[str, List[PartConfiguration]]] = None

class UpdatePatternRequest(BaseModel):
    parts: List[PartConfiguration]
    is_active: bool = True
    notes: Optional[str] = None
    unit_question_counts: Optional[Dict[str, Dict[int, int]]] = None
    # unit_configs: { unitNumber -> [PartConfiguration] }  full per-unit config for Individual mode
    unit_configs: Optional[Dict[str, List[PartConfiguration]]] = None

class UpdateStatusRequest(BaseModel):
    status: QuestionBankStatus
    rejection_reason: Optional[str] = None

class UpdateQuestionsRequest(BaseModel):
    questions: Dict  # expected shape: {"parts": {partName: [Question, ...]}}

class QuestionPatternResponse(BaseModel):
    id: str
    subject_id: str
    parts: List[dict]
    is_active: bool
    notes: Optional[str]
    unit_question_counts: Optional[Dict] = None
    unit_configs: Optional[Dict] = None

    class Config:
        from_attributes = True

class QuestionBankResponse(BaseModel):
    id: str
    subject_id: str
    syllabus_id: Optional[str]
    pattern_id: Optional[str]
    title: Optional[str]
    questions: Optional[dict]
    status: QuestionBankStatus
    rejection_reason: Optional[str]
    excel_path: Optional[str]
    generated_by_name: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
