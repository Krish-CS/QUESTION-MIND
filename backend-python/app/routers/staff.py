from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from ..database import get_db
from ..models import StaffAssignment, Subject, User, UserRole
from ..schemas import AssignStaffRequest, UpdatePermissionsRequest, StaffAssignmentResponse, MySubjectAssignment, FacultyListResponse
from ..services.auth import get_current_user

router = APIRouter(prefix="/staff", tags=["Staff Management"])

@router.get("/faculty-list", response_model=List[FacultyListResponse])
async def get_faculty_list(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get all faculty members from the database"""
    # Get all users with FACULTY role (and optionally HOD for testing)
    faculty = db.query(User).filter(User.role.in_([UserRole.FACULTY, UserRole.HOD])).all()
    return [FacultyListResponse(
        id=f.id,
        email=f.email,
        name=f.name,
        department=f.department
    ) for f in faculty]

@router.get("/my-subjects", response_model=List[MySubjectAssignment])
async def get_my_subjects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get subjects assigned to current staff with full configuration"""
    assignments = db.query(StaffAssignment).filter(
        StaffAssignment.staff_email == user.email,
        StaffAssignment.is_active == True
    ).all()
    
    result = []
    for a in assignments:
        subject = db.query(Subject).filter(Subject.id == a.subject_id).first()
        if subject:
            result.append(MySubjectAssignment(
                subjectId=a.subject_id,
                subjectName=subject.name,
                subjectCode=subject.code,
                subjectNature=subject.nature,
                subjectConfiguration=subject.configuration,
                canEditPattern=a.can_edit_pattern,
                canGenerateQuestions=a.can_generate_questions,
                canApprove=a.can_approve
            ))
    
    return result

@router.get("/subject/{subject_id}", response_model=List[StaffAssignmentResponse])
async def get_subject_staff(
    subject_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get all staff assigned to a subject"""
    return db.query(StaffAssignment).filter(
        StaffAssignment.subject_id == subject_id,
        StaffAssignment.is_active == True
    ).all()

@router.post("/assign/{subject_id}", response_model=StaffAssignmentResponse)
async def assign_staff(
    subject_id: str,
    data: AssignStaffRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Assign staff to a subject"""
    if user.role != UserRole.HOD:
        raise HTTPException(status_code=403, detail="Only HOD can assign staff")
    
    # Check if already assigned
    existing = db.query(StaffAssignment).filter(
        StaffAssignment.subject_id == subject_id,
        StaffAssignment.staff_email == data.staff_email
    ).first()
    
    if existing:
        # Update existing
        existing.is_active = True
        existing.can_edit_pattern = data.permissions.canEditPattern
        existing.can_generate_questions = data.permissions.canGenerateQuestions
        existing.can_approve = data.permissions.canApprove
        existing.staff_name = data.staff_name or existing.staff_name
        db.commit()
        db.refresh(existing)
        return existing
    
    # Create new
    assignment = StaffAssignment(
        id=str(uuid.uuid4()),
        subject_id=subject_id,
        staff_email=data.staff_email,
        staff_name=data.staff_name,
        can_edit_pattern=data.permissions.canEditPattern,
        can_generate_questions=data.permissions.canGenerateQuestions,
        can_approve=data.permissions.canApprove,
        assigned_by=user.id
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment

@router.put("/assignment/{assignment_id}", response_model=StaffAssignmentResponse)
async def update_permissions(
    assignment_id: str,
    data: UpdatePermissionsRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Update staff permissions"""
    if user.role != UserRole.HOD:
        raise HTTPException(status_code=403, detail="Only HOD can update permissions")
    
    assignment = db.query(StaffAssignment).filter(StaffAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    assignment.can_edit_pattern = data.permissions.canEditPattern
    assignment.can_generate_questions = data.permissions.canGenerateQuestions
    assignment.can_approve = data.permissions.canApprove
    
    db.commit()
    db.refresh(assignment)
    return assignment

@router.delete("/assignment/{assignment_id}")
async def remove_staff(
    assignment_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Remove staff from subject"""
    if user.role != UserRole.HOD:
        raise HTTPException(status_code=403, detail="Only HOD can remove staff")
    
    assignment = db.query(StaffAssignment).filter(StaffAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    assignment.is_active = False
    db.commit()
    return {"message": "Staff removed"}
