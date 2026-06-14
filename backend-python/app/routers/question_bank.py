from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import uuid
import os
import shutil
import tempfile

from ..database import get_db
from ..models import QuestionBank, QuestionPattern, Subject, Syllabus, User, UserRole, StaffAssignment, CDAP
from ..models.question_bank import QuestionBankStatus
from ..schemas import (
    GenerateQuestionsRequest, UpdatePatternRequest, UpdateStatusRequest, UpdateQuestionsRequest,
    QuestionPatternResponse, QuestionBankResponse
)
from ..services.auth import get_current_user
from ..services.ai_service import ai_service, AIServiceError, AIService
from ..services.excel_service import excel_service
from ..services.email_service import send_share_notification


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
    
    # Both HOD and Staff see their own question banks by default, unless own_only is False
    if own_only:
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
    # Check permission - HOD and Faculty have full permissions
    if user.role not in [UserRole.HOD, UserRole.FACULTY]:
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

                raw_unit_parts = unit_cfg[unit_num_str]
                # Identify which parts in the raw unit config actually lack mcqCount (i.e. is undefined/None)
                lacks_mcq = {}
                for rp in raw_unit_parts:
                    p_name = rp.get("partName")
                    if p_name and rp.get("mcqCount") is None:
                        lacks_mcq[p_name] = True

                unit_parts = normalize_parts(raw_unit_parts)

                # Inherit mcqCount from global parts config ONLY when per-unit config lacks it entirely
                global_mcq_map = {p["partName"]: p.get("mcqCount", 0) for p in parts_data}
                for up in unit_parts:
                    p_name = up["partName"]
                    if lacks_mcq.get(p_name):
                        inherited = global_mcq_map.get(p_name, 0)
                        if inherited:
                            up["mcqCount"] = inherited
                            print(f"[QB]   Inherited mcqCount={inherited} for {p_name} from global config")

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

                unit_rows = []
                for unit in selected_units:
                    unit_num = unit.get("unitNumber")
                    if isinstance(part_counts, dict):
                        count = part_counts.get(unit_num, part_counts.get(str(unit_num), 0))
                    else:
                        count = 0
                    if count > 0:
                        unit_rows.append((unit, count))

                if not unit_rows:
                    questions[part_name] = part_results
                    print(f"[QB]   {part_name} total: {len(part_results)} questions")
                    continue

                q_counts = [count for _, count in unit_rows]
                mcq_total = min(sum(q_counts), max(0, int(part.get("mcqCount", 0) or 0)))
                mcq_allocations = AIService._allocate_exact_counts(q_counts, mcq_total)

                orig_dist = part.get("btlDistribution") or {}
                allowed_levels = [lvl for lvl in (part.get("allowedBTLLevels") or []) if lvl in orig_dist]
                per_level_allocations = {}
                for level, level_count in orig_dist.items():
                    if level_count and int(level_count) > 0 and (not allowed_levels or level in allowed_levels):
                        per_level_allocations[level] = AIService._allocate_exact_counts(q_counts, int(level_count))

                for idx, (unit, count) in enumerate(unit_rows):
                    unit_num = unit.get("unitNumber")
                    unit_btl_dist = {
                        level: alloc[idx]
                        for level, alloc in per_level_allocations.items()
                        if alloc[idx] > 0
                    } or None

                    unit_part_config = {
                        **part,
                        "questionCount": count,
                        "mcqCount": mcq_allocations[idx],
                        "btlDistribution": unit_btl_dist,
                    }
                    print(f"[QB]   {part_name} | Unit {unit_num}: {count} questions | "
                          f"mcq={mcq_allocations[idx]} btlDist={unit_btl_dist}")

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
    
    # Save question bank — automatically approved
    initial_status = QuestionBankStatus.APPROVED
    qb = QuestionBank(
        id=str(uuid.uuid4()),
        subject_id=subject.id,
        syllabus_id=syllabus.id,
        pattern_id=pattern.id if pattern else None,
        title=f"{subject.code} Question Bank",
        questions={"parts": questions},
        status=initial_status,
        generated_by=user.id,
        excel_path=excel_path
    )
    db.add(qb)
    db.commit()
    db.refresh(qb)
    
    # Auto-email the generated question bank to the user
    try:
        send_share_notification(
            recipients=[user.email],
            bank_title=f"{subject.code} Question Bank",
            subject_name=subject.name,
            subject_code=subject.code,
            sender_name="Krish Academia",
            excel_path=excel_path
        )
    except Exception as e:
        print(f"[QB] ⚠️ Failed to auto-email generated question bank to {user.email}: {e}")
    
    return qb

# ── Image upload ──────────────────────────────────────────────────────────────

@router.post("/upload-image")
async def upload_question_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    """Upload an image for a question to local storage. Returns a URL to reference in imageData."""
    allowed_types = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported image type. Use JPEG, PNG, GIF, or WebP.")

    ext = os.path.splitext(file.filename or ".png")[1] or ".png"
    filename = f"{uuid.uuid4().hex}{ext}"
    
    # Save directly to data/images folder
    dest_dir = "data/images"
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, filename)

    try:
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        # Return URL pointing to static files mount
        # e.g., /api/static/images/12345.png
        url = f"/api/static/images/{filename}"
        return {"url": url}
    except Exception as e:
        logger.error(f"Failed to save image: {e}")
        raise HTTPException(status_code=500, detail="Failed to save image locally.")


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

    # Only the creator, HOD, or Faculty can edit questions
    if qb.generated_by != user.id and user.role not in [UserRole.HOD, UserRole.FACULTY]:
        raise HTTPException(status_code=403, detail="You don't have permission to edit this question bank")

    # Save updated questions
    questions_dict = data.questions if isinstance(data.questions, dict) else dict(data.questions)
    qb.questions = questions_dict

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

@router.post("/{qb_id}/share")
async def share_question_bank(
    qb_id: str,
    data: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Share a question bank with one or more recipients.

    Body: { "recipient_emails": ["a@x.com", "b@x.com"] }

    Steps:
      1. Verify the caller is the creator, HOD, or Faculty
      2. Send a styled email to each recipient with the Excel attached
      3. Return { shared_with, email_result }
    """
    qb = db.query(QuestionBank).filter(QuestionBank.id == qb_id).first()
    if not qb:
        raise HTTPException(status_code=404, detail="Question bank not found")

    # Only creator, HOD, or Faculty can share
    if qb.generated_by != user.id and user.role not in [UserRole.HOD, UserRole.FACULTY]:
        raise HTTPException(status_code=403, detail="Only the creator or HOD can share this question bank")

    recipient_emails: list = data.get("recipient_emails", [])
    if not recipient_emails:
        raise HTTPException(status_code=400, detail="No recipient emails provided")

    # Get subject info
    subject = db.query(Subject).filter(Subject.id == qb.subject_id).first()
    subject_name = subject.name if subject else "Unknown Subject"
    subject_code = subject.code if subject else "SUBJ"

    # Get sender name
    sender = db.query(User).filter(User.id == user.id).first()
    sender_name = sender.name if sender else "A colleague"

    # ── Step 1: Send email notifications ─────────────────────────────────────
    email_result = send_share_notification(
        recipients=recipient_emails,
        bank_title=qb.title,
        subject_name=subject_name,
        subject_code=subject_code,
        sender_name=sender_name,
        excel_path=qb.excel_path if qb.excel_path and os.path.exists(qb.excel_path) else None,
    )

    return {
        "message": "Question bank shared successfully",
        "shared_with": email_result.get("sent", []),
        "failed": email_result.get("failed", []),
        "skipped_email": email_result.get("skipped", False),
        "bank_title": qb.title,
        "subject": f"{subject_code} — {subject_name}",
    }


@router.delete("/{qb_id}")

async def delete_question_bank(
    qb_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    qb = db.query(QuestionBank).filter(QuestionBank.id == qb_id).first()
    if not qb:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    # Only creator, HOD, or Faculty can delete
    if qb.generated_by != user.id and user.role not in [UserRole.HOD, UserRole.FACULTY]:
        raise HTTPException(status_code=403, detail="No permission to delete")
    
    db.delete(qb)
    db.commit()
    return {"message": "Question bank deleted"}
