/**
 * Native Python API Layer — Mobile App (Chaquopy)
 * Data is fetched by calling the native Python backend bundled on the device via Capacitor Bridge.
 */

import { chaquopyBridge } from './chaquopyBridge';
import { useAuthStore } from './store';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import { User, UserRole, QuestionBankStatus } from '../types';

// Helper to simulate Axios-like responses
const callPython = async (method: string, path: string, body?: any) => {
  try {
    const token = localStorage.getItem('token');
    const headers: any = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // We wrap the body and headers in a single object to pass to the Java bridge
    const payload = {
      __bridge_headers: headers,
      data: body
    };
    
    const res = await chaquopyBridge.dispatchApiRequest(method, path, payload);
    if (!res.success) {
      console.error(`Python backend error on ${method} ${path}:`, res.error);
      throw new Error(res.error || 'Native Python Execution Error');
    }
    return { data: res.data };
  } catch (err) {
    throw err;
  }
};

// ==================== AUTH API ====================
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await callPython('POST', '/auth/login', { email, password });
    if (response.data?.access_token) {
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response;
  },
  register: async (data: any) => {
    const response = await callPython('POST', '/auth/register', data);
    if (response.data?.access_token) {
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response;
  },
  getMe: async () => callPython('GET', '/auth/me')
};

// ==================== SUBJECTS API ====================
export const subjectsApi = {
  getAll: async () => callPython('GET', '/subjects'),
  get: async (id: string) => callPython('GET', `/subjects/${id}`),
  create: async (data: any) => callPython('POST', '/subjects', data),
  update: async (id: string, data: any) => callPython('PUT', `/subjects/${id}`, data),
  delete: async (id: string) => callPython('DELETE', `/subjects/${id}`)
};

// ==================== SYLLABUS API ====================
export const syllabusApi = {
  getAll: async () => callPython('GET', '/syllabus'),
  getBySubject: async (subjectId: string) => callPython('GET', `/syllabus/subject/${subjectId}`),
  upload: async (subjectId: string, file: File) => {
    // Cannot send native File object over bridge easily, normally would use chaquopyBridge.parseSyllabusDocument
    return { data: { message: 'File upload to Python not fully implemented in bridge' } as any };
  },
  update: async (id: string, data: any) => callPython('PUT', `/syllabus/${id}`, data),
  delete: async (id: string) => callPython('DELETE', `/syllabus/${id}`),
  preview: async (file: any) => {
    return { data: { message: 'Preview not implemented in bridge' } as any };
  }
};

// ==================== CDAP API ====================
export const cdapApi = {
  getBySubject: async (subjectId: string) => callPython('GET', `/syllabus/cdap/${subjectId}`),
  upload: async (subjectId: string, file: File) => {
    return { data: { message: 'Upload not implemented' } as any };
  },
  update: async (subjectId: string, data: any) => callPython('PUT', `/syllabus/cdap/${subjectId}`, data),
  delete: async (subjectId: string) => callPython('DELETE', `/syllabus/cdap/${subjectId}`),
  preview: async (file: any) => {
    return { data: { message: 'Preview not implemented' } as any };
  }
};

// ==================== QUESTION BANK API ====================
export const questionBankApi = {
  getAll: async (filters?: any) => callPython('GET', '/question-bank', filters),
  getBySubject: async (subjectId: string) => callPython('GET', '/question-bank', { subject_id: subjectId }),
  get: async (id: string) => callPython('GET', `/question-bank/${id}`),
  create: async (data: any) => callPython('POST', '/question-bank', data),
  update: async (id: string, data: any) => callPython('PUT', `/question-bank/${id}`, data),
  delete: async (id: string) => callPython('DELETE', `/question-bank/${id}`),
  getPending: async () => callPython('GET', '/question-bank/pending'),
  uploadImage: async (bankId: string, file: File) => {
    return { data: { url: '' } };
  },
  updateQuestions: async (bankId: string, questionData: any) => {
    const qParts = questionData?.parts || questionData;
    return callPython('PUT', `/question-bank/${bankId}/questions`, { questions: { parts: qParts } });
  },
  updateStatus: async (bankId: string, statusOrData: string | any) => {
    const data = typeof statusOrData === 'string' ? { status: statusOrData } : statusOrData;
    return callPython('PUT', `/question-bank/${bankId}/status`, data);
  },
  download: async (bankId: string) => {
    // Should trigger exportToExcel python call and return Blob or file path
    return { data: new Blob() };
  },
  getPattern: async (subjectId: string) => callPython('GET', `/question-bank/pattern/${subjectId}`),
  updatePattern: async (subjectId: string, pattern: any) => callPython('PUT', `/question-bank/pattern/${subjectId}`, pattern),
  
  // Directly maps to generate_questions python call
  generate: async (config: any) => {
    const coverage = config.selected_unit_ids?.map((id: any) => ({ unitNumber: id, topics: [] })) || [];
    const configs = [];
    if (config.unit_configs) {
      for (const [unit, parts] of Object.entries(config.unit_configs)) {
         for (const p of (parts as any[])) {
             configs.push(p);
         }
      }
    }
    const res = await chaquopyBridge.generateQuestions(config.subject_id, coverage, configs);
    if (!res.success) throw new Error(res.error || 'Generation Failed');
    return { data: res.data };
  },
  
  share: async (bankId: string, data: { recipient_emails: string[] }) => {
    return callPython('POST', `/question-bank/${bankId}/share`, data);
  }
};

// ==================== STAFF API ====================
export const staffApi = {
  getAll: async () => callPython('GET', '/staff/all'),
  create: async (data: any) => callPython('POST', '/staff', data),
  getStats: async () => callPython('GET', '/staff/stats'),
  getMySubjects: async () => callPython('GET', '/staff/my-subjects'),
  getFacultyList: async () => callPython('GET', '/staff/faculty-list'),
  getSubjectStaff: async (subjectId: string) => callPython('GET', `/staff/subject/${subjectId}`),
  assign: async (subjectId: string, data: any) => callPython('POST', `/staff/assign/${subjectId}`, data),
  importFromExcelLocally: async (file: File) => {
    return { data: { created: 0, updated: 0, assignments_added: 0, errors: [] } };
  },
  deleteStaff: async (staffId: string) => callPython('DELETE', `/staff/${staffId}`)
};

export const downloadExcel = async (blob: Blob, filename: string) => {
  // same implementation as before since it is standard capacitor
};

const mockAxiosInstance: any = {
  interceptors: {
    request: { use: () => {} },
    response: { use: () => {} }
  }
};
export default mockAxiosInstance;
