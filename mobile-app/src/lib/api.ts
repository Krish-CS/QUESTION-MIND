/**
 * Local API Layer - 100% STANDALONE Mobile App
 * All data stored locally in localStorage / IndexedDB
 * NO network calls to external backend server
 * Runs PDF/DOCX/Excel parsers locally via JavaScript (pdfjs-dist, mammoth, xlsx)
 */

import { CDAPParser } from './parsers/cdapParser';
import { SyllabusParser } from './parsers/syllabusParser';
import { aiService } from './aiService';
import { Syllabus, CDAP, QuestionBank, QuestionBankStatus, User, UserRole } from '../types';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';


// Helper to manage localStorage
const DB = {
  get<T>(key: string, defaultValue: T): T {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultValue;
  },
  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

const SUPPORTED_UPLOAD_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'xls'];
const VALID_BANK_STATUSES: QuestionBankStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'];

// Seed default HOD user if none exists
if (!localStorage.getItem('token')) {
  localStorage.setItem('token', 'local_jwt_token_for_mobile_edge');
  localStorage.setItem('user', JSON.stringify({
    id: "1",
    email: 'hod@krishacademia.com',
    name: 'Academic Head (HOD)',
    role: 'HOD'
  }));
}

// Dummy Axios wrapper for backward compatibility
const mockAxiosInstance: any = {
  interceptors: {
    request: { use: () => {} },
    response: { use: () => {} }
  }
};

// ==================== AUTH API ====================
export const authApi = {
  login: async (email: string, password: string) => {
    const user: User = { id: "1", email, name: 'Academic Head (HOD)', role: 'HOD' as UserRole };
    localStorage.setItem('token', 'local_jwt_token_for_mobile_edge');
    localStorage.setItem('user', JSON.stringify(user));
    return { data: { access_token: 'local_jwt_token_for_mobile_edge', user } };
  },
  register: async (data: any) => {
    const user: User = { id: "1", email: data.email, name: data.name, role: data.role as UserRole };
    localStorage.setItem('token', 'local_jwt_token_for_mobile_edge');
    localStorage.setItem('user', JSON.stringify(user));
    return { data: { access_token: 'local_jwt_token_for_mobile_edge', user } };
  },
  getMe: async () => {
    const user = DB.get<User>('user', { id: "1", email: 'hod@krishacademia.com', name: 'Academic Head (HOD)', role: 'HOD' as UserRole });
    return { data: user };
  }
};

// ==================== SUBJECTS API ====================
export const subjectsApi = {
  getAll: async () => {
    const subjects = DB.get<any[]>('qm_subjects', []);
    return { data: subjects };
  },
  get: async (id: string) => {
    const subjects = DB.get<any[]>('qm_subjects', []);
    const subject = subjects.find(s => s.id === id);
    if (!subject) throw new Error("Subject not found");
    return { data: subject };
  },
  create: async (data: any) => {
    const subjects = DB.get<any[]>('qm_subjects', []);
    const newSubject = {
      ...data,
      id: data.code || `SUB_${Date.now()}`,
      created_at: new Date().toISOString()
    };
    subjects.push(newSubject);
    DB.set('qm_subjects', subjects);
    return { data: newSubject };
  },
  update: async (id: string, data: any) => {
    const subjects = DB.get<any[]>('qm_subjects', []);
    const idx = subjects.findIndex(s => s.id === id);
    if (idx === -1) throw new Error("Subject not found");
    subjects[idx] = { ...subjects[idx], ...data };
    DB.set('qm_subjects', subjects);
    return { data: subjects[idx] };
  },
  delete: async (id: string) => {
    let subjects = DB.get<any[]>('qm_subjects', []);
    subjects = subjects.filter(s => s.id !== id);
    DB.set('qm_subjects', subjects);
    return { data: { success: true } };
  }
};

// ==================== SYLLABUS API ====================
export const syllabusApi = {
  getAll: async () => {
    const syllabuses = DB.get<any[]>('qm_syllabuses', []);
    return { data: syllabuses };
  },
  getBySubject: async (subjectId: string) => {
    const syllabuses = DB.get<any[]>('qm_syllabuses', []);
    const syl = syllabuses.find(s => s.subject_id === subjectId);
    return { data: syl || null };
  },
  upload: async (subjectId: string, file: File) => {
    try {
      console.log(`[Syllabus] Parsing file: ${file.name} (${file.size} bytes)`);
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !SUPPORTED_UPLOAD_EXTENSIONS.includes(ext)) {
        throw new Error('Unsupported file type. Please upload a PDF, DOCX, or Excel file.');
      }

      // Use the upgraded JS parser — handles PDF, DOCX, and Excel locally
      const units = await SyllabusParser.parseFile(file);

      console.log(`[Syllabus] Extracted ${units.length} units from ${file.name}`);

      const syllabuses = DB.get<any[]>('qm_syllabuses', []);
      const newSyl = {
        id: `SYL_${Date.now()}`,
        subject_id: subjectId,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        units: units,
        parsed: true,
        success: true
      };
      // Overwrite existing syllabus for subject if it exists
      const filtered = syllabuses.filter(s => s.subject_id !== subjectId);
      filtered.push(newSyl);
      DB.set('qm_syllabuses', filtered);
      return { data: newSyl };
    } catch (error) {
      console.error('Syllabus upload error:', error);
      throw error;
    }
  },
  update: async (id: string, data: any) => {
    const syllabuses = DB.get<any[]>('qm_syllabuses', []);
    const idx = syllabuses.findIndex(s => s.id === id);
    if (idx === -1) throw new Error("Syllabus not found");
    syllabuses[idx] = { ...syllabuses[idx], ...data };
    DB.set('qm_syllabuses', syllabuses);
    return { data: syllabuses[idx] };
  },
  delete: async (id: string) => {
    let syllabuses = DB.get<any[]>('qm_syllabuses', []);
    syllabuses = syllabuses.filter(s => s.id !== id);
    DB.set('qm_syllabuses', syllabuses);
    return { data: { success: true } };
  },
  preview: async (file: any) => {
    try {
      if (file instanceof File) {
        const units = await SyllabusParser.parseFile(file);
        return { data: { units, success: true } };
      }
      return { data: { success: true } };
    } catch (error) {
      return { data: { error: String(error), success: false } };
    }
  }
};

// ==================== QUESTION BANK API ====================
export const questionBankApi = {
  getAll: async (filters?: any) => {
    const banks = DB.get<any[]>('qm_question_banks', []);
    let result = banks;
    if (filters?.status) {
      result = result.filter(b => b.status === filters.status);
    }
    if (filters?.subject_id) {
      result = result.filter(b => b.subject_id === filters.subject_id);
    }
    if (typeof filters?.offset === 'number') {
      result = result.slice(filters.offset);
    }
    if (typeof filters?.limit === 'number') {
      result = result.slice(0, filters.limit);
    }
    return { data: result };
  },
  getBySubject: async (subjectId: string) => {
    const banks = DB.get<any[]>('qm_question_banks', []);
    return { data: banks.filter(b => b.subject_id === subjectId) };
  },
  get: async (id: string) => {
    const banks = DB.get<any[]>('qm_question_banks', []);
    const bank = banks.find(b => b.id === id);
    if (!bank) throw new Error("Question bank not found");
    return { data: bank };
  },
  create: async (data: any) => {
    const banks = DB.get<any[]>('qm_question_banks', []);
    const newBank = {
      ...data,
      id: `QB_${Date.now()}`,
      status: 'DRAFT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    banks.push(newBank);
    DB.set('qm_question_banks', banks);
    return { data: newBank };
  },
  update: async (id: string, data: any) => {
    const banks = DB.get<any[]>('qm_question_banks', []);
    const idx = banks.findIndex(b => b.id === id);
    if (idx === -1) throw new Error("Question bank not found");
    banks[idx] = { ...banks[idx], ...data, updated_at: new Date().toISOString() };
    DB.set('qm_question_banks', banks);
    return { data: banks[idx] };
  },
  delete: async (id: string) => {
    let banks = DB.get<any[]>('qm_question_banks', []);
    banks = banks.filter(b => b.id !== id);
    DB.set('qm_question_banks', banks);
    return { data: { success: true } };
  },
  getPending: async () => {
    const banks = DB.get<any[]>('qm_question_banks', []);
    return { data: banks.filter(b => b.status === 'PENDING_APPROVAL') };
  },
  uploadImage: async (bankId: string, file: File) => {
    const reader = new FileReader();
    return new Promise((resolve: any) => {
      reader.onload = () => {
        resolve({ data: { url: reader.result as string, success: true } });
      };
      reader.readAsDataURL(file);
    });
  },
  updateQuestions: async (bankId: string, questionData: any) => {
    const banks = DB.get<any[]>('qm_question_banks', []);
    const idx = banks.findIndex(b => b.id === bankId);
    if (idx === -1) throw new Error('Question bank not found');
    const qParts = questionData?.parts || questionData;
    if (!qParts) throw new Error('Invalid questions payload');
    banks[idx].questions = { parts: qParts };
    banks[idx].parts = qParts; // defensively also keep parts
    DB.set('qm_question_banks', banks);
    return { data: { id: bankId, questions: banks[idx]?.questions, success: true } };
  },
  updateStatus: async (bankId: string, statusOrData: string | any) => {
    const banks = DB.get<any[]>('qm_question_banks', []);
    const idx = banks.findIndex(b => b.id === bankId);
    if (idx === -1) throw new Error('Question bank not found');
    const nextStatus = typeof statusOrData === 'string' ? statusOrData : statusOrData?.status;
    if (!VALID_BANK_STATUSES.includes(nextStatus as QuestionBankStatus)) {
      throw new Error('Invalid question bank status');
    }
    banks[idx].status = nextStatus;
    if (typeof statusOrData === 'object' && statusOrData?.rejection_reason) {
      banks[idx].rejection_reason = statusOrData.rejection_reason;
    }
    DB.set('qm_question_banks', banks);
    return { data: { success: true } };
  },
  download: async (bankId: string) => {
    // Use the JS-based ExcelGeneratorService for download
    const banks = DB.get<any[]>('qm_question_banks', []);
    const bank = banks.find(b => b.id === bankId);
    if (!bank) throw new Error('Question bank not found');
    const subjects = DB.get<any[]>('qm_subjects', []);
    const subject = subjects.find(s => s.id === bank?.subject_id);

    // Import ExcelGeneratorService dynamically
    let ExcelGeneratorService: any;
    try {
      ({ ExcelGeneratorService } = await import('./excelGenerator'));
    } catch (error) {
      console.error('Failed to load Excel generator:', error);
      throw new Error('Failed to load Excel generator');
    }

    const qParts = bank?.questions?.parts || bank?.parts || {};
    const allQuestions: any[] = [];
    for (const [_partName, questions] of Object.entries(qParts)) {
      if (Array.isArray(questions)) {
        allQuestions.push(...questions);
      }
    }

    const blob = ExcelGeneratorService.generateQuestionPaper(
      allQuestions,
      qParts,
      {
        title: `${subject?.name || 'Subject'} Question Bank`,
        subject: subject?.name || 'Subject',
        totalMarks: 100,
        duration: '3 Hours',
        includeAnswers: true,
        includeUnitInfo: true,
      }
    );

    return { data: blob };
  },
  getPattern: async (subjectId: string) => {
    const patterns = DB.get<any[]>('qm_patterns', []);
    const pattern = patterns.find(p => p.bank_id === subjectId);
    return { data: pattern || { parts: [], unit_configs: {} } };
  },
  updatePattern: async (subjectId: string, pattern: any) => {
    const patterns = DB.get<any[]>('qm_patterns', []);
    const idx = patterns.findIndex(p => p.bank_id === subjectId);
    if (idx === -1) {
      patterns.push({ id: `PAT_${Date.now()}`, bank_id: subjectId, ...pattern });
    } else {
      patterns[idx] = { ...patterns[idx], ...pattern };
    }
    DB.set('qm_patterns', patterns);
    return { data: { success: true } };
  },
  generate: async (config: any) => {
    try {
      console.log('[Generate] Starting client-side offline question bank generation...');
      const subject = await subjectsApi.get(config.subject_id);
      const syllabus = await syllabusApi.getBySubject(config.subject_id);
      let syllabusUnits: any[] = syllabus.data?.units || [];

      // Filter to only selected units if provided (combined mode with subset)
      if (config.selected_unit_ids && config.selected_unit_ids.length > 0) {
        syllabusUnits = syllabusUnits.filter((u: any) => config.selected_unit_ids.includes(u.unitNumber));
      }

      const cdaps = DB.get<any[]>('qm_cdap', []);
      const cdap = cdaps.find(c => c.subject_id === config.subject_id);
      const cdapUnits = cdap ? cdap.units : null;

      const patterns = DB.get<any[]>('qm_patterns', []);
      const pattern = patterns.find(p => p.bank_id === config.subject_id);
      const parts = pattern ? pattern.parts : [];

      let questionsData: Record<string, any[]>;

      // Individual mode: generate per-unit using unit_configs
      if (config.unit_configs && Object.keys(config.unit_configs).length > 0) {
        console.log('[Generate] Using individual unit_configs mode');
        questionsData = {};
        for (const part of parts) {
          const partName = part.partName || 'Part';
          questionsData[partName] = [];
        }

        // For each selected unit, generate using its specific part configs
        for (const [unitNum, unitParts] of Object.entries(config.unit_configs)) {
          const unitData = syllabusUnits.find((u: any) => String(u.unitNumber) === String(unitNum));
          const unitArr = unitData ? [unitData] : [];

          for (let i = 0; i < (unitParts as any[]).length; i++) {
            const unitPart = (unitParts as any[])[i];
            const partName = unitPart.partName || parts[i]?.partName || `Part ${i + 1}`;
            if (!questionsData[partName]) questionsData[partName] = [];

            if (unitPart.questionCount > 0 && unitArr.length > 0) {
              const unitQuestions = await aiService.generateQuestions(
                unitArr,
                unitPart,
                subject.data.name,
                cdapUnits
              );
              questionsData[partName].push(...unitQuestions);
            }
          }
        }
      } else {
        // Combined mode: distribute questions across all selected units
        console.log('[Generate] Using combined mode');
        questionsData = await aiService.generateFullQuestionBank(
          syllabusUnits,
          parts,
          subject.data.name,
          cdapUnits
        );
      }

      const newBank: QuestionBank = {
        id: `QB_${Date.now()}`,
        subject_id: config.subject_id,
        title: `${subject.data.name} Question Bank`,
        questions: { parts: questionsData as any },
        status: 'DRAFT' as QuestionBankStatus,
        created_at: new Date().toISOString()
      };

      const banks = DB.get<any[]>('qm_question_banks', []);
      banks.push(newBank);
      DB.set('qm_question_banks', banks);

      return { data: newBank };
    } catch (error: any) {
      console.error('[Generate] Local generation failed:', error);
      throw error;
    }
  },

  /**
   * Share a question bank via native Android/iOS Share Sheet.
   * Generates the Excel on-device and opens the OS share dialog.
   */
  share: async (bankId: string, data: { recipient_emails: string[] }) => {
    const banks = DB.get<any[]>('qm_question_banks', []);
    const bank = banks.find(b => b.id === bankId);
    if (!bank) throw new Error('Question bank not found');

    const subjects = DB.get<any[]>('qm_subjects', []);
    const subject = subjects.find(s => s.id === bank.subject_id);
    const subjectName = subject?.name || 'Question Bank';
    const filename = `${subject?.code || 'QB'}_${subjectName.replace(/\s+/g, '_')}.xlsx`;

    let ExcelGeneratorService: any;
    try {
      ({ ExcelGeneratorService } = await import('./excelGenerator'));
    } catch {
      throw new Error('Excel generator not available');
    }

    const qParts = bank?.questions?.parts || bank?.parts || {};
    const allQuestions: any[] = [];
    for (const [_p, qs] of Object.entries(qParts)) {
      if (Array.isArray(qs)) allQuestions.push(...qs);
    }

    const blob: Blob = ExcelGeneratorService.generateQuestionPaper(
      allQuestions, qParts,
      { title: subjectName + ' Question Bank', subject: subjectName, totalMarks: 100, duration: '3 Hours', includeAnswers: true, includeUnitInfo: true }
    );

    if (Capacitor.isNativePlatform()) {
      const toBase64 = (b: Blob): Promise<string> => new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onerror = rej;
        reader.onload = () => res((reader.result as string).split(',')[1]);
        reader.readAsDataURL(b);
      });
      const base64Data = await toBase64(blob);
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });
      await Share.share({
        title: `${subjectName} Question Bank`,
        text: data.recipient_emails.length > 0 ? `Sharing with: ${data.recipient_emails.join(', ')}` : 'Question Bank',
        url: writeResult.uri,
        dialogTitle: 'Share Question Bank',
      });
    } else {
      const file = new File([blob], filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename, text: 'Share Question Bank' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      }
    }

    return { data: { message: 'Shared via native share sheet', shared_with: data.recipient_emails, drive_link: null } };
  },
};


// ==================== CDAP API ====================
export const cdapApi = {
  getBySubject: async (subjectId: string) => {
    const cdaps = DB.get<any[]>('qm_cdap', []);
    const cdap = cdaps.find(c => c.subject_id === subjectId);
    return { data: cdap || null };
  },
  upload: async (subjectId: string, file: File) => {
    try {
      console.log(`[CDAP] Parsing file: ${file.name} (${file.size} bytes)`);
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !SUPPORTED_UPLOAD_EXTENSIONS.includes(ext)) {
        throw new Error('Unsupported file type. Please upload a PDF, DOCX, or Excel file.');
      }

      // Use the upgraded JS parser — handles PDF, DOCX, and Excel locally
      const units = await CDAPParser.parseFile(file);

      console.log(`[CDAP] Extracted ${units.length} units from ${file.name}`);

      const cdaps = DB.get<any[]>('qm_cdap', []);
      const newCdap = {
        id: `CDAP_${Date.now()}`,
        subject_id: subjectId,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        units: units,
        parsed: true,
        success: true
      };
      const filtered = cdaps.filter(c => c.subject_id !== subjectId);
      filtered.push(newCdap);
      DB.set('qm_cdap', filtered);
      return { data: newCdap };
    } catch (error) {
      console.error('CDAP upload error:', error);
      throw error;
    }
  },
  delete: async (subjectId: string) => {
    let cdaps = DB.get<any[]>('qm_cdap', []);
    cdaps = cdaps.filter(c => c.subject_id !== subjectId);
    DB.set('qm_cdap', cdaps);
    return { data: { success: true } };
  },
  update: async (subjectId: string, data: any) => {
    const cdaps = DB.get<any[]>('qm_cdap', []);
    const idx = cdaps.findIndex(c => c.subject_id === subjectId);
    if (idx === -1) throw new Error("CDAP not found");
    cdaps[idx] = { ...cdaps[idx], ...data };
    DB.set('qm_cdap', cdaps);
    return { data: cdaps[idx] };
  },
  preview: async (file: any) => {
    try {
      if (file instanceof File) {
        const units = await CDAPParser.parseFile(file);
        return { data: { units, success: true } };
      }
      return { data: { success: true } };
    } catch (error) {
      return { data: { error: String(error), success: false } };
    }
  }
};

// ==================== STAFF API ====================
export const staffApi = {
  getAll: async () => {
    const staff = DB.get<any[]>('qm_staff', []);
    return { data: staff };
  },
  create: async (data: any) => {
    const staff = DB.get<any[]>('qm_staff', []);
    const newStaff = {
      ...data,
      id: `STAFF_${Date.now()}`,
      created_at: new Date().toISOString()
    };
    staff.push(newStaff);
    DB.set('qm_staff', staff);
    return { data: newStaff };
  },
  getStats: async () => {
    const banks = DB.get<any[]>('qm_question_banks', []);
    const subjects = DB.get<any[]>('qm_subjects', []);
    return { 
      data: {
        total_questions: banks.reduce((s, b) => s + Object.values(b.parts || {}).reduce((sum, v: any) => sum + (v.length || 0), 0), 0),
        total_banks: banks.length,
        pending_approvals: banks.filter(b => b.status === 'PENDING_APPROVAL').length,
        total_subjects: subjects.length
      } 
    };
  },
  getMySubjects: async () => {
    const subjects = DB.get<any[]>('qm_subjects', []);
    return { data: subjects };
  },
  getFacultyList: async () => {
    const staff = DB.get<any[]>('qm_staff', []);
    return { data: staff };
  },
  getSubjectStaff: async (subjectId: string) => {
    const staff = DB.get<any[]>('qm_staff', []);
    // 1. Get explicit assignment objects
    const assignments = staff.filter(s => s.subject_id === subjectId);
    const assignedEmails = new Set(assignments.map(a => (a.staff_email || '').toLowerCase()));
    
    // 2. Get faculty objects who have this subject in assigned_subjects
    const importedFaculty = staff.filter(s => 
      s.role === 'FACULTY' && 
      Array.isArray(s.assigned_subjects) && 
      s.assigned_subjects.includes(subjectId)
    );
    
    // 3. For any imported faculty not explicitly assigned, synthesize an assignment
    const synthesized = importedFaculty
      .filter(f => !assignedEmails.has((f.email || '').toLowerCase()))
      .map(f => ({
        id: `SYNTH_${f.id}`,
        subject_id: subjectId,
        staff_email: f.email,
        staff_name: f.name,
        can_edit_pattern: false,
        can_generate_questions: true,
        can_approve: false,
        is_active: true
      }));
      
    return { data: [...assignments, ...synthesized] };
  },
  assign: async (subjectId: string, data: any) => {
    const staff = DB.get<any[]>('qm_staff', []);
    const email = (data.staff_email || '').toLowerCase();
    const existingIdx = staff.findIndex(s => s.subject_id === subjectId && (s.staff_email || '').toLowerCase() === email);
    if (existingIdx >= 0) {
      staff[existingIdx] = {
        ...staff[existingIdx],
        ...data,
        subject_id: subjectId
      };
    } else {
      staff.push({
        ...data,
        subject_id: subjectId,
        id: `ASSIGN_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
      });
    }
    DB.set('qm_staff', staff);
    return { data: { success: true } };
  },

  /**
   * HOD: bulk-import staff from a parsed xlsx.utils.sheet_to_json array.
   * Parses the File client-side using the 'xlsx' npm package.
   * Creates staff records in qm_staff localStorage.
   */
  importFromExcelLocally: async (file: File) => {
    const xlsx = await import('xlsx');
    const ab = await file.arrayBuffer();
    const wb = xlsx.read(ab, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = xlsx.utils.sheet_to_json(ws, { defval: '' });

    let created = 0, updated = 0, assignments_added = 0;
    const errors: string[] = [];
    const staff = DB.get<any[]>('qm_staff', []);
    const subjects = DB.get<any[]>('qm_subjects', []);

    // Normalise header keys to lowercase
    const normalise = (row: any) => {
      const n: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        n[k.toLowerCase().trim()] = String(v).trim();
      }
      return n;
    };

    rows.forEach((rawRow, i) => {
      const row = normalise(rawRow);
      const name  = row['name'] || row['staff_name'] || row['staff name'] || '';
      const email = row['email'] || row['staff_email'] || row['staff email'] || '';
      const subjRaw = row['subjects'] || row['subject'] || '';

      if (!name && !email) return;
      if (!name) { errors.push(`Row ${i + 2}: missing name`); return; }
      if (!email || !email.includes('@')) { errors.push(`Row ${i + 2}: invalid/missing email`); return; }

      const existingIdx = staff.findIndex(s => s.email === email);
      let staffEntry: any;
      if (existingIdx >= 0) {
        staff[existingIdx] = { ...staff[existingIdx], name };
        staffEntry = staff[existingIdx];
        updated++;
      } else {
        staffEntry = {
          id: `STAFF_${Date.now()}_${i}`,
          name, email,
          role: 'FACULTY',
          assigned_subjects: [],
          created_at: new Date().toISOString(),
        };
        staff.push(staffEntry);
        created++;
      }

      if (subjRaw) {
        const codes = subjRaw.split(/[,;]+/).map((c: string) => c.trim()).filter(Boolean);
        codes.forEach((code: string) => {
          const subject = subjects.find(s => s.code === code || s.id === code);
          if (!subject) { errors.push(`Row ${i + 2}: subject code '${code}' not found`); return; }
          if (!staffEntry.assigned_subjects) staffEntry.assigned_subjects = [];
          if (!staffEntry.assigned_subjects.includes(subject.id)) {
            staffEntry.assigned_subjects.push(subject.id);
            assignments_added++;
          }
        });
      }
    });

    DB.set('qm_staff', staff);
    return { data: { created, updated, assignments_added, errors } };
  },

  deleteStaff: async (staffId: string) => {
    let staff = DB.get<any[]>('qm_staff', []);
    staff = staff.filter(s => s.id !== staffId);
    DB.set('qm_staff', staff);
    return { data: { success: true } };
  },
};


export const downloadExcel = async (blob: Blob, filename: string) => {
  // Artificial delay to ensure the beautiful download animation plays for at least 2 seconds
  await new Promise(r => setTimeout(r, 2000));

  if (Capacitor.isNativePlatform()) {
    try {
      // 1. Request notification permissions
      try {
        const check = await LocalNotifications.checkPermissions();
        if (check.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }
      } catch (permError) {
        console.warn('[downloadExcel] Permission check/request failed:', permError);
      }

      // 2. Convert Blob to Base64
      const blobToBase64 = (b: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = reject;
          reader.onload = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(b);
        });
      };
      
      const dataUrl = await blobToBase64(blob);
      const base64Data = dataUrl.split(',')[1];

      // 3. Write file to Documents directory (or Cache directory if fallback is needed)
      let fileUri = '';
      try {
        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });
        fileUri = writeResult.uri;
        console.log('[downloadExcel] Saved to Documents folder:', fileUri);
      } catch (writeError) {
        console.warn('[downloadExcel] Failed to write to Documents, trying Cache:', writeError);
        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true
        });
        fileUri = writeResult.uri;
        console.log('[downloadExcel] Saved to Cache folder:', fileUri);
      }

      // 4. Trigger local notification
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: 'Download Complete',
              body: `Successfully downloaded ${filename}. Tap to open.`,
              id: Math.floor(Math.random() * 1000000),
              sound: 'default',
              actionTypeId: 'OPEN_FILE',
              extra: {
                filePath: fileUri
              }
            }
          ]
        });
      } catch (notifError) {
        console.error('[downloadExcel] Local notification scheduling failed:', notifError);
      }

      // Automatically opening or sharing is removed. The user must tap the notification to open.
      return;
    } catch (err) {
      console.error('[downloadExcel] Capacitor download failed, falling back to browser logic:', err);
    }
  }

  const file = new File([blob], filename, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
        text: 'Download Question Bank Excel'
      });
      return;
    } catch (shareError) {
      console.warn('Share sheet cancelled or failed, falling back to direct download:', shareError);
    }
  }

  // Fallback to standard anchor tag download
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  try {
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
  } finally {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
};

export default mockAxiosInstance;
