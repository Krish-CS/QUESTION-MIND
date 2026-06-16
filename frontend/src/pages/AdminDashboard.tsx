import React, { useEffect, useState } from 'react';
import { Users, Edit, RefreshCw, KeyRound, AlertCircle, Check, Upload, Loader2, Trash2, Plus, X, BookOpen, ShieldCheck } from 'lucide-react';
import api, { authApi } from '../lib/api';
import { Combobox } from '../components/Combobox';
import toast from 'react-hot-toast';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'users' | 'assignments'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  
  // Edit form state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('FACULTY');
  const [editDepartment, setEditDepartment] = useState('');
  
  // Create form state
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState('FACULTY');
  const [addDepartment, setAddDepartment] = useState('');
  const [creating, setCreating] = useState(false);
  
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Subject assignments state
  const [subjects, setSubjects] = useState<any[]>([]);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  
  // Modal state for assigning staff
  const [assigningSubject, setAssigningSubject] = useState<any | null>(null);
  const [selectedFaculty, setSelectedFaculty] = useState<any | null>(null);
  const [facultySearch, setFacultySearch] = useState('');
  const [showFacultyDropdown, setShowFacultyDropdown] = useState(false);
  
  const [canEditPattern, setCanEditPattern] = useState(false);
  const [canGenerateQuestions, setCanGenerateQuestions] = useState(true);
  const [canApprove, setCanApprove] = useState(false);
  const [assigning, setAssigning] = useState(false);
  
  const [uploadingAssignments, setUploadingAssignments] = useState(false);
  const assignmentFileInputRef = React.useRef<HTMLInputElement>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/auth/users');
      setUsers(response.data);
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignmentsData = async () => {
    setLoadingAssignments(true);
    try {
      const [subjectsRes, facultyRes] = await Promise.all([
        api.get('/subjects'),
        api.get('/staff/faculty-list')
      ]);
      setSubjects(subjectsRes.data);
      setFacultyList(facultyRes.data);
    } catch (err) {
      console.error('Failed to load assignments data', err);
      toast.error('Failed to load subjects or faculty list');
    } finally {
      setLoadingAssignments(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'assignments') {
      loadAssignmentsData();
    } else {
      loadUsers();
    }
  }, [activeTab]);

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditDepartment(user.department || '');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await authApi.createUser({
        name: addName,
        email: addEmail,
        password: addPassword,
        role: addRole,
        department: addDepartment || undefined,
      });
      toast.success('User created successfully and welcome email sent.');
      setIsAddingUser(false);
      // Reset fields
      setAddName('');
      setAddEmail('');
      setAddPassword('');
      setAddRole('FACULTY');
      setAddDepartment('');
      loadUsers();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await api.put(`/auth/users/${editingUser.id}`, {
        name: editName,
        email: editEmail,
        role: editRole,
        department: editDepartment
      });
      toast.success('User updated successfully');
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${userName}"? This cannot be undone.`)) {
      return;
    }
    try {
      await authApi.deleteUser(userId);
      toast.success('User deleted successfully.');
      loadUsers();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;
    try {
      await api.put(`/auth/users/${resettingUser.id}/reset-password`, {
        new_password: newPassword
      });
      toast.success('Password reset successfully and notification email sent.');
      setResettingUser(null);
      setNewPassword('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to reset password');
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      toast.error('Please select a valid .xlsx file.');
      return;
    }

    setUploading(true);
    try {
      const response = await authApi.bulkUploadUsers(file);
      toast.success(`Success! Created ${response.data.created_count} users and queued welcome emails. Skipped ${response.data.skipped_emails.length} duplicates.`);
      loadUsers();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to upload users.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Subject Assignment methods
  const handleAssignStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningSubject || !selectedFaculty) return;
    setAssigning(true);
    try {
      await api.post(`/staff/assign/${assigningSubject.id}`, {
        staff_email: selectedFaculty.email,
        staff_name: selectedFaculty.name,
        permissions: {
          canEditPattern,
          canGenerateQuestions,
          canApprove
        }
      });
      toast.success(`Assigned ${selectedFaculty.name} to ${assigningSubject.code}`);
      setAssigningSubject(null);
      setSelectedFaculty(null);
      setCanEditPattern(false);
      setCanGenerateQuestions(true);
      setCanApprove(false);
      loadAssignmentsData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to assign staff');
    } finally {
      setAssigning(false);
    }
  };

  const handleTogglePermission = async (
    subjectId: string,
    assignmentId: string, 
    permission: 'canEditPattern' | 'canGenerateQuestions' | 'canApprove', 
    currentValue: boolean
  ) => {
    try {
      const subject = subjects.find(s => s.id === subjectId);
      if (!subject) return;

      const assignment = subject.assigned_staff?.find((a: any) => a.id === assignmentId);
      if (!assignment) return;

      const permissions = {
        canEditPattern: permission === 'canEditPattern' ? !currentValue : assignment.can_edit_pattern,
        canGenerateQuestions: permission === 'canGenerateQuestions' ? !currentValue : assignment.can_generate_questions,
        canApprove: permission === 'canApprove' ? !currentValue : assignment.can_approve
      };

      await api.put(`/staff/assignment/${assignmentId}`, {
        permissions
      });
      toast.success('Permissions updated successfully');
      loadAssignmentsData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update permissions');
    }
  };

  const handleRemoveAssignment = async (assignmentId: string, staffName: string, subjectCode: string) => {
    if (!window.confirm(`Are you sure you want to remove ${staffName} from ${subjectCode}?`)) {
      return;
    }
    try {
      await api.delete(`/staff/assignment/${assignmentId}`);
      toast.success('Staff assignment removed successfully');
      loadAssignmentsData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove staff assignment');
    }
  };

  const handleBulkUploadAssignments = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      toast.error('Please select a valid .xlsx file.');
      return;
    }

    setUploadingAssignments(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/staff/import-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Success! Created ${response.data.created} accounts, updated ${response.data.updated}, added ${response.data.assignments_added} assignments. Errors: ${response.data.errors.length}`);
      loadAssignmentsData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to upload staff assignments.');
    } finally {
      setUploadingAssignments(false);
      if (assignmentFileInputRef.current) assignmentFileInputRef.current.value = '';
    }
  };

  // Filtered lists
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(assignmentSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(assignmentSearch.toLowerCase())
  );

  const filteredSubjects = subjects.filter(
    (s) =>
      s.name.toLowerCase().includes(assignmentSearch.toLowerCase()) ||
      s.code.toLowerCase().includes(assignmentSearch.toLowerCase())
  );

  const filteredFaculty = facultyList.filter(
    (f) =>
      !assigningSubject?.assigned_staff?.some((a: any) => a.staff_email === f.email) &&
      (f.name.toLowerCase().includes(facultySearch.toLowerCase()) ||
        f.email.toLowerCase().includes(facultySearch.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-pink-600 dark:text-pink-400 flex items-center gap-2">
            <Users className="w-9 h-9" />
            Admin Console
          </h1>
          <p className="text-purple-700 dark:text-purple-300 mt-1 font-medium">Manage user credentials and subject allocations</p>
        </div>

        {/* Global Action Buttons based on Tab */}
        <div className="flex gap-3 flex-wrap">
          {activeTab === 'users' ? (
            <>
              <button
                onClick={() => setIsAddingUser(true)}
                className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add User
              </button>
              <input 
                type="file" 
                accept=".xlsx" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleBulkUpload} 
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary flex items-center gap-2"
                disabled={uploading}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Bulk Upload Users
              </button>
              <button
                onClick={loadUsers}
                className="btn btn-secondary flex items-center gap-2"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </>
          ) : (
            <>
              <input 
                type="file" 
                accept=".xlsx" 
                className="hidden" 
                ref={assignmentFileInputRef} 
                onChange={handleBulkUploadAssignments} 
              />
              <button
                onClick={() => assignmentFileInputRef.current?.click()}
                className="btn btn-primary bg-gradient-to-r from-pink-500 to-purple-600 border-none text-white flex items-center gap-2 shadow-lg shadow-pink-500/20"
                disabled={uploadingAssignments}
              >
                {uploadingAssignments ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Import Staff Assignments
              </button>
              <button
                onClick={loadAssignmentsData}
                className="btn btn-secondary flex items-center gap-2"
                disabled={loadingAssignments}
              >
                <RefreshCw className={`w-4 h-4 ${loadingAssignments ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-pink-200 dark:border-slate-800">
        <button
          onClick={() => { setActiveTab('users'); setAssignmentSearch(''); }}
          className={`py-3 px-6 font-semibold border-b-4 text-sm transition-all flex items-center gap-2 ${
            activeTab === 'users'
              ? 'border-pink-500 text-pink-600 dark:text-pink-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          👤 User Accounts
        </button>
        <button
          onClick={() => { setActiveTab('assignments'); setAssignmentSearch(''); }}
          className={`py-3 px-6 font-semibold border-b-4 text-sm transition-all flex items-center gap-2 ${
            activeTab === 'assignments'
              ? 'border-pink-500 text-pink-600 dark:text-pink-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          📚 Subject Assignments
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative w-full md:w-96">
        <input
          type="text"
          value={assignmentSearch}
          onChange={(e) => setAssignmentSearch(e.target.value)}
          placeholder={activeTab === 'users' ? "Search users by name or email..." : "Search subjects..."}
          className="input w-full dark:!bg-slate-950 dark:!text-white dark:!border-slate-800"
        />
      </div>

      {/* activeTab === 'users' */}
      {activeTab === 'users' && (
        <div className="card overflow-hidden p-0 dark:!bg-slate-900 border-2 border-pink-200 dark:border-pink-900 shadow-xl shadow-pink-100/30 dark:shadow-black/40">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-slate-900 dark:to-slate-900 text-slate-700 dark:text-slate-300 font-semibold border-b border-pink-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-100 dark:divide-slate-800">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-pink-50/20 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{u.name}</td>
                    <td className="px-6 py-4 font-medium">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                        u.role === 'ADMIN' ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
                        u.role === 'HOD' ? 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' :
                        'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium">{u.department || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleEditClick(u)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition border-none bg-transparent"
                        title="Edit User"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setResettingUser(u)}
                        className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition border-none bg-transparent"
                        title="Reset Password"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id, u.name)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition ml-1 border-none bg-transparent"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* activeTab === 'assignments' */}
      {activeTab === 'assignments' && (
        <div className="grid grid-cols-1 gap-6">
          {loadingAssignments ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-pink-600 dark:text-pink-400 animate-spin" />
            </div>
          ) : filteredSubjects.length === 0 ? (
            <div className="card text-center p-12">
              <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-300 font-semibold">No subjects found matching "{assignmentSearch}"</p>
            </div>
          ) : (
            filteredSubjects.map((subject) => (
              <div key={subject.id} className="card p-6 dark:!bg-slate-900 border-2 border-pink-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-all">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-pink-100 dark:border-slate-800 pb-4 mb-4 gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {subject.name}
                      <span className="text-xs px-2 py-0.5 font-mono font-bold bg-pink-100 text-pink-700 rounded-md dark:bg-pink-900/30 dark:text-pink-300">
                        {subject.code}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Semester {subject.semester} • {subject.department || 'Gen'} Department • {subject.credits} Credits
                    </p>
                  </div>
                  <button
                    onClick={() => setAssigningSubject(subject)}
                    className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Assign Faculty
                  </button>
                </div>

                {/* Assigned staff list */}
                {(!subject.assigned_staff || subject.assigned_staff.length === 0) ? (
                  <p className="text-xs text-slate-500 italic py-2">No faculty assigned to this subject yet.</p>
                ) : (
                  <div className="space-y-3">
                    {subject.assigned_staff.map((staff: any) => (
                      <div key={staff.id} className="flex flex-col md:flex-row md:items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-pink-100 dark:border-slate-800 gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            {staff.staff_name}
                            <span className="text-xs font-normal text-slate-500 font-mono">({staff.staff_email})</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                          {/* Permissions Checkboxes */}
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                            <input
                              type="checkbox"
                              checked={staff.can_edit_pattern}
                              onChange={() => handleTogglePermission(subject.id, staff.id, 'canEditPattern', staff.can_edit_pattern)}
                              className="accent-pink-600"
                            />
                            Edit Pattern
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                            <input
                              type="checkbox"
                              checked={staff.can_generate_questions}
                              onChange={() => handleTogglePermission(subject.id, staff.id, 'canGenerateQuestions', staff.can_generate_questions)}
                              className="accent-pink-600"
                            />
                            Generate
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                            <input
                              type="checkbox"
                              checked={staff.can_approve}
                              onChange={() => handleTogglePermission(subject.id, staff.id, 'canApprove', staff.can_approve)}
                              className="accent-pink-600"
                            />
                            Approve
                          </label>

                          <button
                            onClick={() => handleRemoveAssignment(staff.id, staff.staff_name, subject.code)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition border-none bg-transparent ml-2"
                            title="Remove assignment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Add User Modal */}
      {isAddingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-pink-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Add Manual User</h2>
              <button onClick={() => setIsAddingUser(false)} className="text-slate-400 hover:text-slate-600 border-none bg-transparent">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input 
                  type="text" 
                  className="input" 
                  value={addName} 
                  onChange={e => setAddName(e.target.value)} 
                  placeholder="John Doe"
                  required 
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input 
                  type="email" 
                  className="input" 
                  value={addEmail} 
                  onChange={e => setAddEmail(e.target.value)} 
                  placeholder="john@example.com"
                  required 
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input 
                  type="password" 
                  className="input" 
                  value={addPassword} 
                  onChange={e => setAddPassword(e.target.value)} 
                  placeholder="••••••••"
                  required 
                />
              </div>
              <div>
                <label className="label">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {['FACULTY', 'HOD'].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setAddRole(role)}
                      className={`p-3 rounded-lg border text-sm transition-all font-medium ${addRole === role
                        ? 'bg-pink-50 border-pink-300 text-pink-700 shadow-sm dark:bg-pink-900/30 dark:border-pink-700 dark:text-pink-300'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'
                        }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Department</label>
                <Combobox
                  options={['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AI&DS', 'Admin Department']}
                  value={addDepartment}
                  onChange={(val) => setAddDepartment(val)}
                  placeholder="Select or type department..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsAddingUser(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600" disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-pink-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit User</h2>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 border-none bg-transparent">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input type="text" className="input" value={editName} onChange={e => setEditName(e.target.value)} required />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={editEmail} onChange={e => setEditEmail(e.target.value)} required />
              </div>
              <div>
                <label className="label">Role</label>
                {editingUser?.role === 'ADMIN' ? (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 text-sm font-bold text-center">
                    ADMIN (Cannot be modified)
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {['FACULTY', 'HOD'].map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setEditRole(role)}
                        className={`p-3 rounded-lg border text-sm transition-all font-medium ${editRole === role
                          ? 'bg-pink-50 border-pink-300 text-pink-700 shadow-sm dark:bg-pink-900/30 dark:border-pink-700 dark:text-pink-300'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'
                          }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="label">Department</label>
                <Combobox
                  options={['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AI&DS', 'Admin Department']}
                  value={editDepartment}
                  onChange={(val) => setEditDepartment(val)}
                  placeholder="Select or type department..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setEditingUser(null)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-pink-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-500" />
                Reset Password
              </h2>
              <button onClick={() => setResettingUser(null)} className="text-slate-400 hover:text-slate-600 border-none bg-transparent">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Set a new password for <strong>{resettingUser.name}</strong> ({resettingUser.email}).
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="label">New Password</label>
                <input 
                  type="text" 
                  className="input" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  placeholder="Enter new password"
                  required 
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setResettingUser(null)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary bg-amber-50 hover:bg-amber-600 border-amber-500">Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Staff Modal */}
      {assigningSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-pink-200 dark:border-slate-800 relative">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-pink-500" />
                Assign Staff to {assigningSubject.code}
              </h2>
              <button
                onClick={() => {
                  setAssigningSubject(null);
                  setSelectedFaculty(null);
                  setFacultySearch('');
                  setShowFacultyDropdown(false);
                }}
                className="text-slate-400 hover:text-slate-600 border-none bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignStaff} className="space-y-4">
              {/* Autocomplete Search input */}
              <div className="relative">
                <label className="label">Select Faculty Member</label>
                <input
                  type="text"
                  value={selectedFaculty ? `${selectedFaculty.name} (${selectedFaculty.email})` : facultySearch}
                  onChange={(e) => {
                    setFacultySearch(e.target.value);
                    setSelectedFaculty(null);
                    setShowFacultyDropdown(true);
                  }}
                  onFocus={() => setShowFacultyDropdown(true)}
                  placeholder="Type to search faculty..."
                  className="input w-full"
                  required={!selectedFaculty}
                />
                
                {showFacultyDropdown && facultySearch && !selectedFaculty && (
                  <div className="absolute z-[60] w-full mt-1 bg-white dark:bg-slate-900 border-2 border-pink-100 dark:border-slate-800 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {filteredFaculty.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setSelectedFaculty(f);
                          setFacultySearch('');
                          setShowFacultyDropdown(false);
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-pink-50 dark:hover:bg-slate-800 transition-colors text-sm border-none bg-transparent text-slate-800 dark:text-slate-200 flex flex-col"
                      >
                        <span className="font-semibold">{f.name}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{f.email}</span>
                      </button>
                    ))}
                    {filteredFaculty.length === 0 && (
                      <div className="p-3 text-center text-slate-500 text-sm">No faculty found</div>
                    )}
                  </div>
                )}
              </div>

              {/* Permissions */}
              <div className="space-y-3 pt-2">
                <label className="label">Assigned Permissions</label>
                
                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-pink-50 dark:border-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={canEditPattern}
                    onChange={(e) => setCanEditPattern(e.target.checked)}
                    className="accent-pink-600"
                  />
                  <div>
                    <p className="text-sm font-semibold">Edit Pattern</p>
                    <p className="text-xs text-slate-500">Allows modifying exam mark structures and BTL distributions</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-pink-50 dark:border-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={canGenerateQuestions}
                    onChange={(e) => setCanGenerateQuestions(e.target.checked)}
                    className="accent-pink-600"
                  />
                  <div>
                    <p className="text-sm font-semibold">Generate Questions</p>
                    <p className="text-xs text-slate-500">Allows generating question banks from Syllabus and CDAP</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-pink-50 dark:border-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={canApprove}
                    onChange={(e) => setCanApprove(e.target.checked)}
                    className="accent-pink-600"
                  />
                  <div>
                    <p className="text-sm font-semibold">Approve Banks</p>
                    <p className="text-xs text-slate-500">Allows final signing and approving generated banks</p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setAssigningSubject(null);
                    setSelectedFaculty(null);
                    setFacultySearch('');
                  }}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFaculty || assigning}
                  className="btn btn-primary bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs border-none shadow-md shadow-pink-500/20"
                >
                  {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign Faculty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
