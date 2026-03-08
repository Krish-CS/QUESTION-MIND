from pydantic import BaseModel
from typing import Optional, List

class StaffPermissions(BaseModel):
    canEditPattern: bool = False
    canGenerateQuestions: bool = True
    canApprove: bool = False

class AssignStaffRequest(BaseModel):
    staff_email: str
    staff_name: Optional[str] = None
    permissions: StaffPermissions

class UpdatePermissionsRequest(BaseModel):
    permissions: StaffPermissions

class StaffAssignmentResponse(BaseModel):
    id: str
    subject_id: str
    staff_email: str
    staff_name: Optional[str]
    can_edit_pattern: bool
    can_generate_questions: bool
    can_approve: bool
    is_active: bool
    
    class Config:
        from_attributes = True

class MySubjectAssignment(BaseModel):
    subjectId: str
    subjectName: str
    subjectCode: str
    subjectNature: Optional[str] = None
    subjectConfiguration: Optional[dict] = None
    canEditPattern: bool
    canGenerateQuestions: bool
    canApprove: bool

class FacultyListResponse(BaseModel):
    id: str
    email: str
    name: str
    department: Optional[str] = None
    
    class Config:
        from_attributes = True
