import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, CheckCircle, Clock, AlertTriangle, FileText, Send, UserCheck, PlusCircle, Check, X, ShieldAlert } from 'lucide-react';

interface LeaveBalance {
  leave_type: string;
  total_allowed: number;
  used: number;
}

interface LeaveRequest {
  request_id: string;
  person_id: string;
  full_name?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
  approved_by?: string;
  created_at: string;
}

interface LeaveViewProps {
  person: any;
  userRole?: string;
}

export const LeaveView: React.FC<LeaveViewProps> = ({ person, userRole = 'EMPLOYEE' }) => {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [leaveType, setLeaveType] = useState<string>('Earned Leave');
  const [startDate, setStartDate] = useState<string>('2026-08-10');
  const [endDate, setEndDate] = useState<string>('2026-08-12');
  const [reason, setReason] = useState<string>('Annual Family Vacation');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const personId = person?.person_id || 'p-101';
  const personName = person?.full_name || 'Krishna Chakri N';
  const isManagerOrAdmin = userRole === 'HR_ADMIN' || userRole === 'MANAGER' || (personName && personName.includes('Bhabha'));

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Balances
      const balRes = await fetch(`/api/leave/balances?personId=${personId}`);
      if (balRes.ok) {
        const balData = await balRes.json();
        setBalances(balData);
      }

      // Fetch Requests
      const reqRes = await fetch(`/api/leave/requests`);
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setRequests(reqData);
      }
    } catch (e: any) {
      console.error('Error loading leave data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [personId]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/leave/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId,
          leaveType,
          startDate,
          endDate,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || data.message || 'Failed to submit leave request.');
      } else {
        setSuccessMsg(`Leave request (${data.days} days) submitted successfully! Request ID: ${data.requestId}`);
        setShowApplyModal(false);
        fetchData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error submitting leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveReject = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/leave/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          approverId: personId,
          action,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || data.message || `Failed to ${action.toLowerCase()} leave request.`);
      } else {
        setSuccessMsg(`Request ${requestId} has been ${action === 'APPROVE' ? 'APPROVED' : 'REJECTED'}.`);
        fetchData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error updating leave request.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '24px', background: '#F8FAFC', minHeight: '100vh', gap: '24px' }}>
      
      {/* HEADER BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CalendarIcon size={24} color="#2563EB" />
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Leave Management & Time-Off Ledger</h1>
          </div>
          <p style={{ color: '#64748B', fontSize: '14px', margin: '4px 0 0 34px' }}>
            Apply for leave, manage entitlement balances, and approve time-off requests.
          </p>
        </div>
        <button
          onClick={() => { setErrorMsg(null); setShowApplyModal(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#2563EB', color: '#FFFFFF', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}
        >
          <PlusCircle size={18} /> Apply for Leave
        </button>
      </div>

      {/* NOTIFICATIONS */}
      {errorMsg && (
        <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', padding: '14px 18px', borderRadius: '8px', color: '#E11D48', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '600' }}>
          <ShieldAlert size={20} /> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '14px 18px', borderRadius: '8px', color: '#059669', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '600' }}>
          <CheckCircle size={20} /> {successMsg}
        </div>
      )}

      {/* LEAVE BALANCES GRID */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#334155', marginBottom: '12px' }}>Leave Entitlement Balances</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {balances.map((b) => {
            const remaining = b.total_allowed - b.used;
            const pct = Math.round((remaining / b.total_allowed) * 100);
            return (
              <div key={b.leave_type} style={{ background: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: '#1E293B' }}>{b.leave_type}</span>
                  <span style={{ background: '#EFF6FF', color: '#2563EB', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>{remaining} Days Left</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748B', marginBottom: '8px' }}>
                  <span>Used: <strong>{b.used}</strong></span>
                  <span>Total Entitlement: <strong>{b.total_allowed}</strong></span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: pct > 30 ? '#2563EB' : '#E11D48', borderRadius: '4px' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* LEAVE REQUESTS LEDGER TABLE */}
      <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#334155', margin: 0 }}>
            {isManagerOrAdmin ? 'All Employee Leave Requests & Pending Approvals' : 'My Leave Requests History'}
          </h2>
          <span style={{ fontSize: '13px', color: '#64748B' }}>Total: {requests.length} Requests</span>
        </div>

        {requests.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
            No leave requests submitted yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: '700' }}>
                  <th style={{ padding: '12px' }}>Request ID</th>
                  <th style={{ padding: '12px' }}>Employee</th>
                  <th style={{ padding: '12px' }}>Leave Type</th>
                  <th style={{ padding: '12px' }}>Date Range</th>
                  <th style={{ padding: '12px' }}>Days</th>
                  <th style={{ padding: '12px' }}>Reason</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  {isManagerOrAdmin && <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  let statusBg = '#FEF3C7';
                  let statusColor = '#D97706';
                  if (r.status === 'APPROVED') { statusBg = '#ECFDF5'; statusColor = '#059669'; }
                  if (r.status === 'REJECTED') { statusBg = '#FFF1F2'; statusColor = '#E11D48'; }

                  return (
                    <tr key={r.request_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: '700', color: '#334155' }}>{r.request_id.substring(0, 12)}</td>
                      <td style={{ padding: '12px', fontWeight: '600', color: '#0F172A' }}>{r.full_name || 'Krishna Chakri N'}</td>
                      <td style={{ padding: '12px', color: '#475569' }}>{r.leave_type}</td>
                      <td style={{ padding: '12px', color: '#475569' }}>{r.start_date} to {r.end_date}</td>
                      <td style={{ padding: '12px', fontWeight: '700', color: '#0F172A' }}>{r.days}</td>
                      <td style={{ padding: '12px', color: '#64748B', maxWidth: '200px' }}>{r.reason}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ background: statusBg, color: statusColor, padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700' }}>
                          {r.status}
                        </span>
                      </td>
                      {isManagerOrAdmin && (
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          {r.status === 'PENDING' ? (
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => handleApproveReject(r.request_id, 'APPROVE')}
                                style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Check size={14} /> Approve
                              </button>
                              <button
                                onClick={() => handleApproveReject(r.request_id, 'REJECT')}
                                style={{ background: '#E11D48', color: '#FFFFFF', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <X size={14} /> Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: '#94A3B8', fontSize: '12px' }}>Decided</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: APPLY FOR LEAVE */}
      {showApplyModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Apply for Time-Off</h2>
              <button onClick={() => setShowApplyModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleApplySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Leave Type</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                >
                  <option value="Earned Leave">Earned Leave (Paid)</option>
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  required
                  placeholder="Enter reason for leave request..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  style={{ background: '#F1F5F9', color: '#475569', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ background: '#2563EB', color: '#FFFFFF', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
