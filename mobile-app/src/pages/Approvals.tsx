import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { questionBankApi, subjectsApi, downloadExcel } from '../lib/api';
import { useAuthStore, useUiStore } from '../lib/store';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  Download,
  AlertCircle,
  X,
} from 'lucide-react';
import { QuestionBank, Subject } from '../types';
import QuestionBankViewModal from '../components/QuestionBankViewModal';

export default function Approvals() {
  const { user } = useAuthStore();
  const isHOD = user?.role === 'HOD';

  const [pendingBanks, setPendingBanks] = useState<QuestionBank[]>([]);
  const [approvedBanks, setApprovedBanks] = useState<QuestionBank[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewingBank, setViewingBank] = useState<QuestionBank | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const rejectReasonRef = useRef<HTMLTextAreaElement | null>(null);
  const mountedRef = useRef(true);
  const subjectNameById = useMemo(() => new Map(subjects.map(s => [s.id, s.name])), [subjects]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isHOD) {
      loadData();
    }
  }, [isHOD]);

  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(timeout);
  }, [error]);

  useEffect(() => {
    if (!rejectingId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setRejectingId(null);
        setRejectReason('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    rejectReasonRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rejectingId]);

  const loadData = async () => {
    try {
      const results = await Promise.allSettled([
        questionBankApi.getPending(),
        questionBankApi.getAll({ status: 'APPROVED', own_only: false }),
        subjectsApi.getAll(),
      ]);

      const getData = <T,>(res: PromiseSettledResult<{ data: T }>, fallback: T): T =>
        res.status === 'fulfilled' ? res.value.data : fallback;

      if (results.some(res => res.status === 'rejected')) {
        setError('Failed to load some data. Please retry.');
      }

      const pendingData = getData(results[0], [] as QuestionBank[]);
      const approvedData = getData(results[1], [] as QuestionBank[]);
      const subjectsData = getData(results[2], [] as Subject[]);

      if (!mountedRef.current) return;
      setPendingBanks(pendingData);
      setApprovedBanks(approvedData);
      setSubjects(subjectsData);
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err?.message || 'Failed to load data');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await questionBankApi.updateStatus(id, { status: 'APPROVED' });
      const approved = pendingBanks.find((b) => b.id === id);
      setPendingBanks(prev => prev.filter((b) => b.id !== id));
      if (approved) {
        setApprovedBanks(prev => [{ ...approved, status: 'APPROVED' }, ...prev]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectReason) return;

    try {
      await questionBankApi.updateStatus(rejectingId, {
        status: 'REJECTED',
        rejection_reason: rejectReason,
      });
      setPendingBanks(prev => prev.filter((b) => b.id !== rejectingId));
      setRejectingId(null);
      setRejectReason('');
    } catch (err: any) {
      setError(err?.message || 'Failed to reject');
    }
  };

  const { setGlobalLoading } = useUiStore();

  const handleDownload = async (bank: QuestionBank) => {
    setGlobalLoading(true, 'Generating and Downloading...');
    try {
      const response = await questionBankApi.download(bank.id);
      await downloadExcel(response.data, `${bank.title || 'question_bank'}.xlsx`);
    } catch (err: any) {
      setError(err?.message || 'Failed to download');
    } finally {
      setGlobalLoading(false);
    }
  };

  const getSubjectName = (subjectId: string) => {
    return subjectNameById.get(subjectId) || 'Unknown';
  };

  if (!isHOD) {
    return (
      <div className="card dark:!bg-slate-900 text-center py-12">
        <AlertCircle className="w-12 h-12 text-amber-600 dark:text-amber-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Access Restricted</h3>
        <p className="text-slate-600 dark:text-slate-300">Only HOD can access the approvals page</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-pink-600 dark:text-pink-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-pink-600 dark:text-pink-400">✔️ Question Bank Approvals</h1>
        <p className="text-purple-700 dark:text-purple-300 mt-1 font-medium">Review and manage question banks</p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 dark:bg-rose-900 dark:border-rose-800 dark:text-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <span className="flex-1 text-sm font-medium">{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-rose-600/70 hover:text-rose-600 dark:text-rose-200/70 dark:hover:text-rose-200 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700" role="tablist" aria-label="Approvals tabs">
        <button
          onClick={() => setActiveTab('pending')}
          id="approvals-tab-pending"
          role="tab"
          aria-selected={activeTab === 'pending'}
          aria-controls="approvals-panel-pending"
          className={`px-6 py-3 font-semibold transition-all relative ${activeTab === 'pending'
            ? 'text-pink-600 dark:text-pink-400'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
        >
          Pending ({pendingBanks.length})
          {activeTab === 'pending' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-600 to-purple-600"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          id="approvals-tab-approved"
          role="tab"
          aria-selected={activeTab === 'approved'}
          aria-controls="approvals-panel-approved"
          className={`px-6 py-3 font-semibold transition-all relative ${activeTab === 'approved'
            ? 'text-pink-600 dark:text-pink-400'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
        >
          Approved ({approvedBanks.length})
          {activeTab === 'approved' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-600 to-purple-600"></div>
          )}
        </button>
      </div>

      {/* Pending List */}
      {activeTab === 'pending' && (
        <div
          id="approvals-panel-pending"
          role="tabpanel"
          aria-labelledby="approvals-tab-pending"
          className="card dark:!bg-slate-900 p-6"
        >
          {pendingBanks.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">All Caught Up!</h3>
              <p className="text-slate-600 dark:text-slate-300">No question banks pending approval</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingBanks.map((bank) => (
                <div
                  key={bank.id}
                  onClick={() => setViewingBank(bank)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setViewingBank(bank);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-2 border-pink-200 dark:border-pink-700 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:shadow-lg hover:border-pink-300 dark:hover:border-pink-600 transition-all duration-300 cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{bank.title || 'Untitled'}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                      {getSubjectName(bank.subject_id)} •{' '}
                      {new Date(bank.created_at).toLocaleDateString()}
                    </p>
                    {bank.generated_by_name && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Submitted by {bank.generated_by_name}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setViewingBank(bank)}
                      className="btn btn-secondary p-2"
                      title="View"
                      aria-label="View question bank"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDownload(bank)}
                      className="btn btn-secondary p-2"
                      title="Download"
                      aria-label="Download question bank"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleApprove(bank.id)}
                      className="btn btn-success text-sm"
                      aria-label="Approve question bank"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">Approve</span>
                      <span className="sm:hidden">✓</span>
                    </button>

                    <button
                      onClick={() => setRejectingId(bank.id)}
                      className="btn btn-danger text-sm"
                      aria-label="Reject question bank"
                    >
                      <XCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">Reject</span>
                      <span className="sm:hidden">✕</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Approved List */}
      {activeTab === 'approved' && (
        <div
          id="approvals-panel-approved"
          role="tabpanel"
          aria-labelledby="approvals-tab-approved"
          className="card dark:!bg-slate-900 p-6"
        >
          {approvedBanks.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No Approved Banks</h3>
              <p className="text-slate-600 dark:text-slate-300">No question banks have been approved yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {approvedBanks.map((bank) => (
                <div
                  key={bank.id}
                  onClick={() => setViewingBank(bank)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setViewingBank(bank);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-2 border-green-200 dark:border-green-700 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:shadow-lg hover:border-green-300 dark:hover:border-green-600 transition-all duration-300 cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{bank.title || 'Untitled'}</p>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      {getSubjectName(bank.subject_id)} •{' '}
                      {new Date(bank.created_at).toLocaleDateString()}
                    </p>
                    {bank.generated_by_name && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Submitted by {bank.generated_by_name}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setViewingBank(bank)}
                      className="btn btn-secondary p-2"
                      title="View"
                      aria-label="View approved question bank"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDownload(bank)}
                      className="btn btn-secondary p-2"
                      title="Download"
                      aria-label="Download approved question bank"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View Modal */}
      {viewingBank && (
        <QuestionBankViewModal
          bank={viewingBank}
          subjectName={getSubjectName(viewingBank.subject_id)}
          onClose={() => setViewingBank(null)}
          onDownload={() => handleDownload(viewingBank)}
        />
      )}

      {/* Reject Modal */}
      {rejectingId && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => {
            setRejectingId(null);
            setRejectReason('');
          }}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-[95vw] sm:max-w-md p-6 shadow-2xl border border-pink-200 dark:border-pink-700"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="reject-modal-title" className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Reject Question Bank</h3>
            <label htmlFor="reject-reason" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Reason for rejection
            </label>
            <textarea
              id="reject-reason"
              ref={rejectReasonRef}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              className="input h-32 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectReason('');
                }}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason}
                className="btn btn-danger flex-1"
              >
                Reject
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}







