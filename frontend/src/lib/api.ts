import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; name: string; role: string; department?: string }) =>
    api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
};

// Subjects API
export const subjectsApi = {
  getAll: () => api.get('/subjects'),
  get: (id: string) => api.get(`/subjects/${id}`),
  create: (data: any) => api.post('/subjects', data),
  update: (id: string, data: any) => api.put(`/subjects/${id}`, data),
  delete: (id: string) => api.delete(`/subjects/${id}`),
};

// Syllabus API
export const syllabusApi = {
  getAll: () => api.get('/syllabus'),
  getBySubject: (subjectId: string) => api.get(`/syllabus/subject/${subjectId}`),
  get: (id: string) => api.get(`/syllabus/${id}`),
  upload: (subjectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/syllabus/upload/${subjectId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  update: (id: string, data: any) => api.put(`/syllabus/${id}`, data),
  delete: (id: string) => api.delete(`/syllabus/${id}`),
};

// CDAP API (Course Delivery and Assessment Plan)
export const cdapApi = {
  getBySubject: (subjectId: string) => api.get(`/syllabus/cdap/${subjectId}`),
  upload: (subjectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/syllabus/cdap/upload/${subjectId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  preview: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/syllabus/cdap/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (subjectId: string) => api.delete(`/syllabus/cdap/${subjectId}`),
  update: (subjectId: string, data: any) => api.put(`/syllabus/cdap/${subjectId}`, data),
};

// Question Bank API
export const questionBankApi = {
  getAll: (params?: { status?: string; subject_id?: string; own_only?: boolean }) =>
    api.get('/question-bank', { params }),
  get: (id: string) => api.get(`/question-bank/${id}`),
  getPending: () => api.get('/question-bank/pending'),
  getPattern: (subjectId: string) => api.get(`/question-bank/pattern/${subjectId}`),
  updatePattern: (subjectId: string, data: any) =>
    api.put(`/question-bank/pattern/${subjectId}`, data),
  generate: (data: { subject_id: string; syllabus_id: string; pattern_id?: string; custom_parts?: any[]; selected_unit_ids?: number[]; unit_question_counts?: Record<string, Record<number, number>>; unit_configs?: Record<string, any[]> }) =>
    api.post('/question-bank/generate', data),
  updateStatus: (id: string, data: { status: string; rejection_reason?: string }) =>
    api.put(`/question-bank/${id}/status`, data),
  updateQuestions: (id: string, data: { questions: { parts: Record<string, any[]> } }) =>
    api.put(`/question-bank/${id}/questions`, data),
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ url: string }>('/question-bank/upload-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  download: (id: string) =>
    api.get(`/question-bank/${id}/download`, { responseType: 'blob' }),
  delete: (id: string) => api.delete(`/question-bank/${id}`),
};

// Staff API
export const staffApi = {
  getFacultyList: () => api.get('/staff/faculty-list'),
  getMySubjects: () => api.get('/staff/my-subjects'),
  getSubjectStaff: (subjectId: string) => api.get(`/staff/subject/${subjectId}`),
  assign: (subjectId: string, data: any) => api.post(`/staff/assign/${subjectId}`, data),
  updatePermissions: (assignmentId: string, data: any) =>
    api.put(`/staff/assignment/${assignmentId}`, data),
  remove: (assignmentId: string) => api.delete(`/staff/assignment/${assignmentId}`),
};

export default api;
