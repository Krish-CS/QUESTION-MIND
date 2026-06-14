import os
import json
import traceback
from database import SessionLocal
from services.ai_service import ai_service
from services.excel_service import excel_service
from services.cdap_parser import cdap_parser
from services.syllabus_parser import syllabus_parser

# Mocking the dependency injection for routers if we want to call them
from routers import subjects, syllabus, question_bank, auth, staff

def generate_questions(subject_id, coverage, configs):
    try:
        # ai_service.generate_questions takes units (list), part_configs (list), subject_name, cdap_units (optional)
        # We need to adapt it. We'll just call ai_service methods.
        # coverage is a list of dicts: [{'unitNumber': 1, 'topics': [...]}]
        # configs is a list of dicts: [{'partName': 'Part A', ...}]
        # For simplicity, we just return ai_service.generate_questions(...)
        # Wait, ai_service generates questions per part. Let's do generate_full_question_bank
        db = SessionLocal()
        from models import Subject, CDAP
        subject = db.query(Subject).filter(Subject.id == subject_id).first()
        subj_name = subject.name if subject else "Subject"
        
        cdap = db.query(CDAP).filter(CDAP.subject_id == subject_id).first()
        cdap_units = cdap.units if cdap else None
        db.close()

        res = ai_service.generate_full_question_bank(coverage, configs, subj_name, cdap_units)
        return json.dumps({"success": True, "data": res})
    except Exception as e:
        return json.dumps({"success": False, "error": str(e) + "\n" + traceback.format_exc()})

def export_questions_excel(questions_list, output_path):
    try:
        # Map flat list to part-based dictionary
        # We assume all questions go to "Part A" by default if they don't specify a part
        questions_dict = {"Part A": []}
        for q in questions_list:
            part = q.get("part", "Part A")
            if part not in questions_dict:
                questions_dict[part] = []
            questions_dict[part].append(q)
            
        part_configs = [{"partName": part, "marksPerQuestion": 2} for part in questions_dict.keys()]
        
        # We extract subject name/code from the output_path or use defaults
        import os
        filename = os.path.basename(output_path)
        subject_code = filename.split('_')[0] if '_' in filename else "SUBJ"
        
        link_or_path = excel_service.generate_question_bank_excel(
            questions=questions_dict,
            subject_name="Question Bank",
            subject_code=subject_code,
            parts_config=part_configs
        )
        return json.dumps({"success": True, "filePath": link_or_path})
    except Exception as e:
        return json.dumps({"success": False, "error": str(e) + "\n" + traceback.format_exc()})

def parse_cdap_file(file_path):
    try:
        from services.google_drive_service import drive_service
        import os, tempfile
        
        # Check if it looks like a Drive File ID (alphanumeric, no slashes)
        if len(file_path) > 20 and '/' not in file_path and '\\' not in file_path:
            if drive_service.is_authenticated():
                file_bytes = drive_service.download_file(file_path)
                fd, temp_path = tempfile.mkstemp(suffix=".pdf")
                with os.fdopen(fd, 'wb') as f:
                    f.write(file_bytes)
                file_path = temp_path
                
        res = cdap_parser.parse_document(file_path)
        
        if 'temp_path' in locals():
            try: os.remove(temp_path)
            except: pass
            
        return json.dumps({"success": True, "data": res})
    except Exception as e:
        return json.dumps({"success": False, "error": str(e) + "\n" + traceback.format_exc()})

def parse_syllabus_file(file_path):
    try:
        from services.google_drive_service import drive_service
        import os, tempfile
        
        if len(file_path) > 20 and '/' not in file_path and '\\' not in file_path:
            if drive_service.is_authenticated():
                file_bytes = drive_service.download_file(file_path)
                fd, temp_path = tempfile.mkstemp(suffix=".pdf")
                with os.fdopen(fd, 'wb') as f:
                    f.write(file_bytes)
                file_path = temp_path
                
        res = syllabus_parser.parse_document(file_path)
        
        if 'temp_path' in locals():
            try: os.remove(temp_path)
            except: pass
            
        return json.dumps({"success": True, "data": res})
    except Exception as e:
        return json.dumps({"success": False, "error": str(e) + "\n" + traceback.format_exc()})

def dispatch_request(method, path, body):
    try:
        from fastapi.testclient import TestClient
        from main import app
        import json
        import traceback
        
        client = TestClient(app)
        headers = {}
        data = None
        
        if body and isinstance(body, dict):
            if "__bridge_headers" in body:
                headers = body.get("__bridge_headers", {})
                data = body.get("data")
            else:
                data = body

        req_kwargs = {"headers": headers}
        
        # Determine how to pass body/params
        # TestClient treats `json` as body, `params` as query string.
        if method.upper() in ["GET", "DELETE"]:
            req_kwargs["params"] = data
        else:
            req_kwargs["json"] = data
            
        full_path = "/api" + path if not path.startswith("/api") else path
            
        if method.upper() == "GET":
            response = client.get(full_path, **req_kwargs)
        elif method.upper() == "POST":
            response = client.post(full_path, **req_kwargs)
        elif method.upper() == "PUT":
            response = client.put(full_path, **req_kwargs)
        elif method.upper() == "DELETE":
            response = client.delete(full_path, **req_kwargs)
        else:
            return json.dumps({"success": False, "error": f"Unsupported method {method}"})
            
        if response.status_code >= 400:
            err_msg = response.text
            try:
                err_json = response.json()
                if "detail" in err_json:
                    err_msg = err_json["detail"]
            except Exception:
                pass
            return json.dumps({"success": False, "error": err_msg})
            
        return json.dumps({"success": True, "data": response.json()})
    except Exception as e:
        import traceback
        return json.dumps({"success": False, "error": str(e) + "\n" + traceback.format_exc()})
