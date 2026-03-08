from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import uuid
import os
import shutil

from ..database import get_db
from ..models import QuestionBank, QuestionPattern, Subject, Syllabus, User, UserRole, StaffAssignment, CDAP
from ..models.question_bank import QuestionBankStatus
from ..schemas import (
    GenerateQuestionsRequest, UpdatePatternRequest, UpdateStatusRequest, UpdateQuestionsRequest,
    QuestionPatternResponse, QuestionBankResponse
)
from ..services.auth import get_current_user
from ..services.ai_service import ai_service, AIServiceError
from ..services.excel_service import excel_service

router = APIRouter(prefix="/question-bank", tags=["Question Bank"])

def normalize_parts(parts_raw: list) -> list:
    """Ensure all part configs are plain dicts with correct types for the AI service."""
    normalized = []
    for p in parts_raw:
        # Convert Pydantic model → dict if needed
        if hasattr(p, 'model_dump'):
            p = p.model_dump()
        elif hasattr(p, 'dict'):
            p = p.dict()
        else:
            p = dict(p)  # copy

        # Serialize BTL enum values to plain strings
        btl = p.get('allowedBTLLevels', [])
        p['allowedBTLLevels'] = [b.value if hasattr(b, 'value') else str(b) for b in btl]

        # defaultBTL enum → string
        if p.get('defaultBTL') and hasattr(p['defaultBTL'], 'value'):
            p['defaultBTL'] = p['defaultBTL'].value

        # mcqCount: None → 0
        if p.get('mcqCount') is None:
            p['mcqCount'] = 0

        # Ensure required numeric fields have sensible defaults
        p.setdefault('questionCount', 5)
        p.setdefault('marksPerQuestion', 2)
        p.setdefault('totalMarks', p['questionCount'] * p['marksPerQuestion'])
        p.setdefault('partName', 'Part')

        normalized.append(p)
    return normalized

@router.get("", response_model=List[QuestionBankResponse])
async def get_all_question_banks(
    status: str = None,
    subject_id: str = None,
    own_only: bool = True,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = db.query(QuestionBank).outerjoin(User, QuestionBank.generated_by == User.id)
    
    if status:
        query = query.filter(QuestionBank.status == status)
    if subject_id:
        query = query.filter(QuestionBank.subject_id == subject_id)
    
    # Both HOD and Staff see their own question banks by default
    # HOD can see all by setting own_only=False
    if user.role != UserRole.HOD or own_only:
        query = query.filter(QuestionBank.generated_by == user.id)
    
    banks = query.order_by(QuestionBank.created_at.desc()).all()
    
    # Add staff names
    result = []
    for bank in banks:
        bank_dict = QuestionBankResponse.from_orm(bank).dict()
        if bank.generated_by:
            creator = db.query(User).filter(User.id == bank.generated_by).first()
            if creator:
                bank_dict['generated_by_name'] = creator.name
        result.append(bank_dict)
    
    return result

@router.get("/pending", response_model=List[QuestionBankResponse])
async def get_pending_approvals(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role == UserRole.HOD:
        # HOD sees all pending approvals
        banks = db.query(QuestionBank).filter(
            QuestionBank.status == QuestionBankStatus.PENDING_APPROVAL
        ).all()
    elif user.role == UserRole.FACULTY:
        # Staff sees pending approvals only for subjects they have can_approve permission
        staff_assignments = db.query(StaffAssignment).filter(
            StaffAssignment.staff_email == user.email,
            StaffAssignment.is_active == True,
            StaffAssignment.can_approve == True
        ).all()
        
        subject_ids = [a.subject_id for a in staff_assignments]
        if not subject_ids:
            return []
        
        banks = db.query(QuestionBank).filter(
            QuestionBank.status == QuestionBankStatus.PENDING_APPROVAL,
            QuestionBank.subject_id.in_(subject_ids)
        ).all()
    else:
        raise HTTPException(status_code=403, detail="No permission to view pending approvals")
    
    # Add staff names
    result = []
    for bank in banks:
        bank_dict = QuestionBankResponse.from_orm(bank).dict()
        if bank.generated_by:
            creator = db.query(User).filter(User.id == bank.generated_by).first()
            if creator:
                bank_dict['generated_by_name'] = creator.name
        result.append(bank_dict)
    
    return result

@router.get("/pattern/{subject_id}", response_model=QuestionPatternResponse)
async def get_pattern(
    subject_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    pattern = db.query(QuestionPattern).filter(QuestionPattern.subject_id == subject_id).first()
    if not pattern:
        # Fall back to subject.configuration so pages stay in sync even before
        # a dedicated pattern row has been created
        subject = db.query(Subject).filter(Subject.id == subject_id).first()
        if subject and subject.configuration and subject.configuration.get("parts"):
            # Synthesize a pattern-like response from the subject configuration
            return {
                "id": f"subject-{subject_id}",
                "subject_id": subject_id,
                "parts": subject.configuration["parts"],
                "is_active": True,
                "notes": None,
                "unit_question_counts": None,
                "unit_configs": None,
            }
        raise HTTPException(status_code=404, detail="Pattern not found")
    return pattern


@router.put("/pattern/{subject_id}", response_model=QuestionPatternResponse)
async def update_pattern(
    subject_id: str,
    data: UpdatePatternRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Check permission
    if user.role != UserRole.HOD:
        assignment = db.query(StaffAssignment).filter(
            StaffAssignment.subject_id == subject_id,
            StaffAssignment.staff_email == user.email,
            StaffAssignment.is_active == True
        ).first()
        
        if not assignment or not assignment.can_edit_pattern:
            raise HTTPException(status_code=403, detail="No permission to edit pattern")
    
    # Check subject exists
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    # Get or create pattern
    pattern = db.query(QuestionPattern).filter(QuestionPattern.subject_id == subject_id).first()
    
    parts_data = [p.model_dump() if hasattr(p, 'model_dump') else p for p in data.parts]
    
    # Convert unit_configs values (lists of PartConfiguration) to plain dicts
    unit_configs_data = None
    if data.unit_configs:
        unit_configs_data = {
            k: [p.model_dump() if hasattr(p, 'model_dump') else p for p in v]
            for k, v in data.unit_configs.items()
        }
    
    if pattern:
        pattern.parts = parts_data
        pattern.is_active = data.is_active
        pattern.notes = data.notes
        pattern.unit_question_counts = data.unit_question_counts
        pattern.unit_configs = unit_configs_data
    else:
        pattern = QuestionPattern(
            id=str(uuid.uuid4()),
            subject_id=subject_id,
            parts=parts_data,
            is_active=data.is_active,
            notes=data.notes,
            unit_question_counts=data.unit_question_counts,
            unit_configs=unit_configs_data,
            created_by=user.id
        )
        db.add(pattern)
    
    db.commit()
    db.refresh(pattern)
    return pattern

@router.post("/generate", response_model=QuestionBankResponse)
async def generate_questions(
    data: GenerateQuestionsRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Get subject
    subject = db.query(Subject).filter(Subject.id == data.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    # Get syllabus
    syllabus = db.query(Syllabus).filter(Syllabus.id == data.syllabus_id).first()
    if not syllabus:
        raise HTTPException(status_code=404, detail="Syllabus not found")
    
    # Get CDAP for Part 1/Part 2 topic segregation
    cdap = db.query(CDAP).filter(CDAP.subject_id == data.subject_id).first()
    cdap_units = cdap.units if cdap else None
    
    # Get pattern
    pattern = db.query(QuestionPattern).filter(QuestionPattern.subject_id == data.subject_id).first()
    parts = data.custom_parts or (pattern.parts if pattern else subject.configuration.get('parts', []) if subject.configuration else [])
    
    if not parts:
        raise HTTPException(status_code=400, detail="No question pattern defined")
    
    parts_data = normalize_parts(parts)

    # Log normalized parts for debugging
    print("[QB] Normalized parts config:")
    for p in parts_data:
        print(f"  [{p['partName']}] count={p['questionCount']} marks={p['marksPerQuestion']} "
              f"btl={p['allowedBTLLevels']} mcq={p['mcqCount']}")

    # Filter syllabus units by selected unit IDs (if provided)
    all_units = syllabus.units or []
    if data.selected_unit_ids:
        selected_units = [
            u for u in all_units
            if u.get('unitNumber') in data.selected_unit_ids
        ]
        if not selected_units:
            raise HTTPException(status_code=400, detail="None of the selected units found in syllabus")
        print(f"[QB] Unit filter: {len(selected_units)}/{len(all_units)} units selected "
              f"(units: {[u.get('unitNumber') for u in selected_units]})")
    else:
        selected_units = all_units
        print(f"[QB] Using all {len(all_units)} units")

    unit_q_counts = data.unit_question_counts
    # Auto-use pattern's stored per-unit counts when not explicitly provided in the request
    if not unit_q_counts and pattern and getattr(pattern, 'unit_question_counts', None):
        unit_q_counts = pattern.unit_question_counts
    unit_q_counts = unit_q_counts or {}

    # Resolve unit_configs (full per-unit PartConfiguration[])
    unit_cfg = data.unit_configs
    if not unit_cfg and pattern and getattr(pattern, 'unit_configs', None):
        unit_cfg = pattern.unit_configs

    try:
        if unit_cfg:
            # ── INDIVIDUAL FULL CONFIG: each unit has its own complete PartConfiguration[] ──
            print("[QB] Mode: INDIVIDUAL FULL CONFIG (per-unit parts)")
            questions: dict = {}

            for unit in selected_units:
                unit_num_str = str(unit.get("unitNumber"))
                if unit_num_str not in unit_cfg:
                    print(f"[QB]   Unit {unit_num_str}: excluded by user")
                    continue  # user deleted/excluded this unit

                unit_parts = normalize_parts(unit_cfg[unit_num_str])
                print(f"[QB]   Unit {unit_num_str}: {len(unit_parts)} parts")
                for p in unit_parts:
                    print(f"     [{p['partName']}] count={p['questionCount']} marks={p['marksPerQuestion']} "
                          f"btl={p['allowedBTLLevels']} mcq={p['mcqCount']}")

                unit_questions = await ai_service.generate_full_question_bank(
                    syllabus_units=[unit],
                    parts=unit_parts,
                    subject_name=subject.name,
                    cdap_units=cdap_units,
                )
                for part_name, qs in unit_questions.items():
                    for q in qs:
                        q.setdefault("unit", unit.get("unitNumber"))
                    questions.setdefault(part_name, []).extend(qs)

        elif unit_q_counts:
            # ── INDIVIDUAL MODE: generate per-unit per-part, combine by part ──
            print("[QB] Mode: INDIVIDUAL (unit-wise question counts)")
            questions: dict = {}

            for part in parts_data:
                part_name = part["partName"]
                part_counts = unit_q_counts.get(part_name, {})
                part_results: list = []

                for unit in selected_units:
                    unit_num = unit.get("unitNumber")
                    count = part_counts.get(unit_num, 0) if isinstance(part_counts, dict) else 0
                    if count == 0:
                        continue

                    # Build a per-unit part config with the specific count
                    orig_total = part.get("questionCount", 1) or 1
                    mcq_scaled = round((part.get("mcqCount", 0) / orig_total) * count)

                    # Scale btlDistribution proportionally to the new unit count.
                    # E.g. if original dist is {BTL1:4, BTL2:6} for 10 Qs and this unit
                    # gets 3 Qs, scale to {BTL1:1, BTL2:2} (3/10 ratio).
                    orig_dist = part.get("btlDistribution") or {}
                    if orig_dist:
                        scaled_dist = {
                            k: round(v * count / orig_total)
                            for k, v in orig_dist.items() if v and int(v) > 0
                        }
                        # Remove zero-rounded entries; keep only active BTL levels
                        allowed = set(part.get("allowedBTLLevels") or [])
                        scaled_dist = {k: v for k, v in scaled_dist.items() if v > 0 and k in allowed}
                    else:
                        scaled_dist = None

                    unit_part_config = {
                        **part,
                        "questionCount": count,
                        "mcqCount": mcq_scaled,
                        "btlDistribution": scaled_dist,
                    }
                    print(f"[QB]   {part_name} | Unit {unit_num}: {count} questions | "
                          f"btlDist={scaled_dist}")

                    unit_questions = await ai_service.generate_questions(
                        syllabus_units=[unit],
                        part_config=unit_part_config,
                        subject_name=subject.name,
                        cdap_units=cdap_units,
                    )
                    for q in unit_questions:
                        q.setdefault("unit", unit_num)
                    part_results.extend(unit_questions)

                questions[part_name] = part_results
                print(f"[QB]   {part_name} total: {len(part_results)} questions")
        else:
            # ── COMBINED MODE: even distribution across selected units ──
            print("[QB] Mode: COMBINED (even distribution across selected units)")
            questions = await ai_service.generate_full_question_bank(
                syllabus_units=selected_units,
                parts=parts_data,
                subject_name=subject.name,
                cdap_units=cdap_units,
            )

    except AIServiceError as e:
        print(f"[QB] ⚠️  AIServiceError: {e}")
        raise HTTPException(
            status_code=503,
            detail=(
                "Sorry, all AI providers are currently unavailable or rate-limited. "
                "We were unable to generate the question bank. "
                "Please try again in a few minutes or try again tomorrow."
            ),
        )

    
    # Generate Excel with subject info and CDAP Part column
    excel_path = excel_service.generate_question_bank_excel(
        questions=questions,
        subject_name=subject.name,
        subject_code=subject.code,
        parts_config=parts_data,
        department=subject.department or "CSE",
        semester=subject.semester or 1,
        has_cdap=cdap is not None  # Flag to enable CDAP Part column
    )
    
    # Save question bank
    qb = QuestionBank(
        id=str(uuid.uuid4()),
        subject_id=subject.id,
        syllabus_id=syllabus.id,
        pattern_id=pattern.id if pattern else None,
        title=f"{subject.code} Question Bank",
        questions={"parts": questions},
        status=QuestionBankStatus.DRAFT,
        generated_by=user.id,
        excel_path=excel_path
    )
    db.add(qb)
    db.commit()
    db.refresh(qb)
    
    return qb

# ── Image upload ──────────────────────────────────────────────────────────────
IMAGES_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "question-images")

@router.post("/upload-image")
async def upload_question_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    """Upload an image for a question. Returns a URL to reference in imageData."""
    allowed_types = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported image type. Use JPEG, PNG, GIF, or WebP.")

    os.makedirs(IMAGES_DIR, exist_ok=True)

    ext = os.path.splitext(file.filename or ".png")[1] or ".png"
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(IMAGES_DIR, filename)

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    return {"url": f"/api/question-bank/images/{filename}"}


@router.get("/images/{filename}")
async def get_question_image(filename: str):
    """Serve an uploaded question image. Public endpoint — filenames are UUID-based."""
    # Prevent path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = os.path.join(IMAGES_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)


@router.put("/{qb_id}/questions", response_model=QuestionBankResponse)
async def update_questions(
    qb_id: str,
    data: UpdateQuestionsRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Update the questions in a question bank (creator or HOD only)."""
    qb = db.query(QuestionBank).filter(QuestionBank.id == qb_id).first()
    if not qb:
        raise HTTPException(status_code=404, detail="Question bank not found")

    # Only the creator or an HOD can edit questions
    if qb.generated_by != user.id and user.role != UserRole.HOD:
        raise HTTPException(status_code=403, detail="You don't have permission to edit this question bank")

    # Save updated questions
    questions_dict = data.questions if isinstance(data.questions, dict) else dict(data.questions)
    qb.questions = questions_dict

    # If the bank was pending/approved, reset to DRAFT so it goes through approval again
    if qb.status in [QuestionBankStatus.PENDING_APPROVAL, QuestionBankStatus.APPROVED]:
        qb.status = QuestionBankStatus.DRAFT
        qb.rejection_reason = None

    # Regenerate Excel
    try:
        subject = db.query(Subject).filter(Subject.id == qb.subject_id).first()
        parts_data: list = []

        # Try to load parts config from the associated pattern
        if qb.pattern_id:
            pattern = db.query(QuestionPattern).filter(QuestionPattern.id == qb.pattern_id).first()
            if pattern and pattern.parts:
                parts_data = normalize_parts(pattern.parts)

        # Fall back to subject configuration
        if not parts_data and subject and subject.configuration:
            cfg = subject.configuration
            if hasattr(cfg, 'model_dump'):
                cfg = cfg.model_dump()
            parts_data = normalize_parts(cfg.get('parts', []))

        if not parts_data:
            parts_data = []

        # Strip imageData (base64 blobs) before passing to excel service — handled separately
        parts_questions: dict = questions_dict.get('parts', {})

        # Delete old Excel file if it exists
        if qb.excel_path and os.path.exists(qb.excel_path):
            try:
                os.remove(qb.excel_path)
            except OSError:
                pass

        new_excel_path = excel_service.generate_question_bank_excel(
            questions=parts_questions,
            subject_name=subject.name if subject else "Unknown",
            subject_code=subject.code if subject else "SUBJ",
            parts_config=parts_data,
            department=subject.department or "CSE" if subject else "CSE",
            semester=subject.semester or 1 if subject else 1,
        )
        qb.excel_path = new_excel_path
    except Exception:
        # Excel regeneration is best-effort; don't fail the whole update
        pass

    db.commit()
    db.refresh(qb)
    return qb

@router.get("/{qb_id}", response_model=QuestionBankResponse)
async def get_question_bank(
    qb_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    qb = db.query(QuestionBank).filter(QuestionBank.id == qb_id).first()
    if not qb:
        raise HTTPException(status_code=404, detail="Question bank not found")
    return qb

@router.put("/{qb_id}/status")
async def update_status(
    qb_id: str,
    data: UpdateStatusRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    qb = db.query(QuestionBank).filter(QuestionBank.id == qb_id).first()
    if not qb:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    # Check permission for approval
    if data.status in [QuestionBankStatus.APPROVED, QuestionBankStatus.REJECTED]:
        # HOD cannot approve their own question banks
        if user.role == UserRole.HOD and qb.generated_by == user.id:
            raise HTTPException(status_code=403, detail="HOD cannot approve their own question banks")
        
        # Check if user has approval permission
        has_approval_permission = False
        
        # Staff with can_approve permission can approve
        if user.role == UserRole.FACULTY:
            assignment = db.query(StaffAssignment).filter(
                StaffAssignment.subject_id == qb.subject_id,
                StaffAssignment.staff_email == user.email,
                StaffAssignment.is_active == True,
                StaffAssignment.can_approve == True
            ).first()
            if assignment:
                has_approval_permission = True
        # HOD can approve (except their own)
        elif user.role == UserRole.HOD:
            has_approval_permission = True
        
        if not has_approval_permission:
            raise HTTPException(status_code=403, detail="You don't have permission to approve/reject question banks")
        
        qb.approved_by = user.id
    
    qb.status = data.status
    if data.rejection_reason:
        qb.rejection_reason = data.rejection_reason
    
    db.commit()
    return {"message": "Status updated"}

@router.get("/{qb_id}/download")
async def download_excel(
    qb_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    qb = db.query(QuestionBank).filter(QuestionBank.id == qb_id).first()
    if not qb:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    if not qb.excel_path or not os.path.exists(qb.excel_path):
        raise HTTPException(status_code=404, detail="Excel file not found")
    
    return FileResponse(
        qb.excel_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=os.path.basename(qb.excel_path)
    )

@router.delete("/{qb_id}")
async def delete_question_bank(
    qb_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    qb = db.query(QuestionBank).filter(QuestionBank.id == qb_id).first()
    if not qb:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    # Only creator or HOD can delete
    if qb.generated_by != user.id and user.role != UserRole.HOD:
        raise HTTPException(status_code=403, detail="No permission to delete")
    
    db.delete(qb)
    db.commit()
    return {"message": "Question bank deleted"}
