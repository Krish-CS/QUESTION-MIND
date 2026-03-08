import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { questionBankApi, subjectsApi } from '../lib/api';
import { useAuthStore } from '../lib/store';
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

  useEffect(() => {
    if (isHOD) {
      loadData();
    }
  }, [isHOD]);

  const loadData = async () => {
    try {
      const [pendingRes, approvedRes, subjectsRes] = await Promise.all([
        questionBankApi.getPending(),
        questionBankApi.getAll({ status: 'APPROVED', own_only: false }),
        subjectsApi.getAll(),
      ]);
      setPendingBanks(pendingRes.data);
      setApprovedBanks(approvedRes.data);
      setSubjects(subjectsRes.data);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await questionBankApi.updateStatus(id, { status: 'APPROVED' });
      setPendingBanks(pendingBanks.filter((b) => b.id !== id));
    } catch (err) {
      setError('Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectReason) return;

    try {
      await questionBankApi.updateStatus(rejectingId, {
        status: 'REJECTED',
        rejection_reason: rejectReason,
      });
      setPendingBanks(pendingBanks.filter((b) => b.id !== rejectingId));
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      setError('Failed to reject');
    }
  };

  const handleDownload = async (bank: QuestionBank) => {
    try {
      const response = await questionBankApi.download(bank.id);
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bank.title || 'question_bank'}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download');
    }
  };

  const getSubjectName = (subjectId: string) => {
    return subjects.find((s) => s.id === subjectId)?.name || 'Unknown';
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
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 dark:bg-rose-900 dark:border-rose-800 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('pending')}
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
        <div className="card dark:!bg-slate-900 p-6">
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
                  className="p-5 bg-white dark:bg-slate-900 border-2 border-pink-200 dark:border-pink-700 rounded-xl flex items-center justify-between hover:shadow-lg hover:border-pink-300 dark:hover:border-pink-600 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer group"
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{bank.title || 'Untitled'}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {getSubjectName(bank.subject_id)} •{' '}
                      {new Date(bank.created_at).toLocaleDateString()}
                    </p>
                    {bank.generated_by_name && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Submitted by {bank.generated_by_name}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setViewingBank(bank)}
                      className="btn btn-secondary p-2"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDownload(bank)}
                      className="btn btn-secondary p-2"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleApprove(bank.id)}
                      className="btn btn-success"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>

                    <button
                      onClick={() => setRejectingId(bank.id)}
                      className="btn btn-danger"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
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
        <div className="card dark:!bg-slate-900 p-6">
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
                  className="p-5 bg-white dark:bg-slate-900 border-2 border-green-200 dark:border-green-700 rounded-xl flex items-center justify-between hover:shadow-lg hover:border-green-300 dark:hover:border-green-600 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <p className="font-semibold text-slate-900 dark:text-white">{bank.title || 'Untitled'}</p>
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

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setViewingBank(bank)}
                      className="btn btn-secondary p-2"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDownload(bank)}
                      className="btn btn-secondary p-2"
                      title="Download"
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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md p-6 shadow-2xl border border-pink-200 dark:border-pink-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Reject Question Bank</h3>
            <textarea
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







