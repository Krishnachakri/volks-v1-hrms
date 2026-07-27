import React, { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle2, XCircle, AlertCircle, Plus, UserCheck, Shield, FileText } from 'lucide-react';
import { PersonaRole } from './Header';

interface LeaveBalance {
  leave_type: string;
  total_allowed: number;
  used: number;
  pending: number;
  available: number;
}

interface LeaveRequest {
  request_id: string;
  person_id: string;
  applicant_name?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reason: string;
  created_at: string;
  approved_by?: string;
  rejection_reason?: string;
}

interface LeaveViewProps {
  person: {
    id: string;
    name: string;
    role: string;
  };
  persona: PersonaRole;
}

export const LeaveView: React.FC<LeaveViewProps> = ({ person, persona }) => {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<LeaveRequest[]>([]);
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Modal State
  const [isApplyModalOpen, setIsApplyModalOpen] = useState<boolean>(false);
  const [leaveType, setLeaveType] = useState<string>('CASUAL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Rejection Dialog State
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const calculateDays = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
    const diffTime = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const calculatedDays = calculateDays(startDate, endDate);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Balances
      const balRes = await fetch(`http://localhost:4000/api/leave/balances?personId=${person.id}`);
      if (balRes.ok) {
        const balData = await balRes.json();
        setBalances(balData);
      }

      // 2. Fetch My Requests
      const reqRes = await fetch(`http://localhost:4000/api/leave/requests?personId=${person.id}`);
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setMyRequests(reqData);
      }

      // 3. Fetch Pending Approvals (for Manager/HR)
      if (persona === 'MANAGER' || persona === 'HR_ADMIN') {
        const pAppRes = await fetch(`http://localhost:4000/api/leave/requests?status=PENDING`);
        if (pAppRes.ok) {
          const pAppData = await pAppRes.json();
          setPendingApprovals(pAppData);
        }

        const allRes = await fetch(`http://localhost:4000/api/leave/requests`);
        if (allRes.ok) {
          const allData = await allRes.json();
          setAllRequests(allData);
        }
      }
    } catch (err: any) {
      console.error('Failed to load leave data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [person.id, persona]);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!startDate || !endDate) {
      setErrorMsg('Please select valid start and end dates.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setErrorMsg('End date cannot be prior to start date.');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Please provide a reason for leave application.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('http://localhost:4000/api/leave/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: person.id,
          leaveType,
          startDate,
          endDate,
          days: calculatedDays,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to submit leave request.');
      } else {
        setSuccessMsg(`Leave request (${data.requestId}) submitted successfully!`);
        setIsApplyModalOpen(false);
        setStartDate('');
        setEndDate('');
        setReason('');
        await fetchData();
      }
    } catch (err: any) {
      setErrorMsg('Server connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('http://localhost:4000/api/leave/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          approverPersonId: person.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to approve leave request.');
      } else {
        setSuccessMsg(`Leave request approved successfully.`);
        await fetchData();
      }
    } catch (err: any) {
      setErrorMsg('Server connection error while approving.');
    }
  };

  const handleReject = async (requestId: string) => {
    if (!rejectionReason.trim()) {
      setErrorMsg('Rejection reason is mandatory.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('http://localhost:4000/api/leave/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          approverPersonId: person.id,
          rejectionReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to reject leave request.');
      } else {
        setSuccessMsg(`Leave request rejected.`);
        setRejectingRequestId(null);
        setRejectionReason('');
        await fetchData();
      }
    } catch (err: any) {
      setErrorMsg('Server connection error while rejecting.');
    }
  };

  return (
    <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', background: '#F8FAFC' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', padding: '20px 24px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar style={{ color: '#4F46E5', width: '24px', height: '24px' }} />
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A' }}>Leave Management Studio</h1>
            <span style={{ background: persona === 'MANAGER' ? '#EEF2FF' : persona === 'HR_ADMIN' ? '#FEF3C7' : '#F1F5F9', color: persona === 'MANAGER' ? '#4F46E5' : persona === 'HR_ADMIN' ? '#D97706' : '#475569', fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase' }}>
              {persona} View
            </span>
          </div>
          <p style={{ color: '#64748B', fontSize: '13px', marginTop: '4px' }}>
            Authoritative persona-driven leave balances, approvals, and attendance mutations for <strong>{person.name}</strong>.
          </p>
        </div>

        {persona === 'EMPLOYEE' && (
          <button
            onClick={() => setIsApplyModalOpen(true)}
            id="apply-leave-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#4F46E5', color: '#FFFFFF', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)' }}
          >
            <Plus style={{ width: '18px', height: '18px' }} />
            Apply Leave
          </button>
        )}
      </div>

      {/* Notifications / Alerts */}
      {errorMsg && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
          <AlertCircle style={{ width: '18px', height: '18px', flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', color: '#065F46', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
          <CheckCircle2 style={{ width: '18px', height: '18px', flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Leave Balances Cards */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#1E293B', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock style={{ width: '18px', height: '18px', color: '#6366F1' }} />
          Leave Entitlements & Balances
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {balances.map((b) => (
            <div key={b.leave_type} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: '800', fontSize: '15px', color: '#0F172A' }}>{b.leave_type} LEAVE</span>
                <span style={{ background: '#EEF2FF', color: '#4F46E5', fontSize: '12px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px' }}>
                  {b.available} Days Available
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center', background: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '700' }}>ENTITLED</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>{b.total_allowed}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '700' }}>USED</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#EF4444' }}>{b.used}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '700' }}>PENDING</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#F59E0B' }}>{b.pending}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MANAGER & HR APPROVAL QUEUE */}
      {(persona === 'MANAGER' || persona === 'HR_ADMIN') && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserCheck style={{ width: '20px', height: '20px', color: '#4F46E5' }} />
              Pending Manager Approvals Queue ({pendingApprovals.length})
            </h2>
          </div>

          {pendingApprovals.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748B', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
              No pending leave requests requiring action.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingApprovals.map((req) => (
                <div key={req.request_id} id={`request-card-${req.request_id}`} style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px', background: '#FAFAFA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '15px', color: '#0F172A' }}>{req.applicant_name || req.person_id}</strong>
                      <span style={{ background: '#EEF2FF', color: '#4F46E5', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px' }}>
                        {req.leave_type}
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>Request ID: {req.request_id}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#334155', marginBottom: '4px' }}>
                      📅 <strong>{req.start_date}</strong> to <strong>{req.end_date}</strong> ({req.days} {req.days === 1 ? 'day' : 'days'})
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748B', fontStyle: 'italic' }}>
                      "{req.reason}"
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {rejectingRequestId === req.request_id ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Mandatory rejection reason..."
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', width: '220px' }}
                        />
                        <button
                          onClick={() => handleReject(req.request_id)}
                          style={{ background: '#EF4444', color: '#FFFFFF', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          Confirm Reject
                        </button>
                        <button
                          onClick={() => setRejectingRequestId(null)}
                          style={{ background: '#E2E8F0', color: '#334155', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleApprove(req.request_id)}
                          id={`approve-btn-${req.request_id}`}
                          style={{ background: '#10B981', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <CheckCircle2 style={{ width: '16px', height: '16px' }} />
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectingRequestId(req.request_id)}
                          id={`reject-btn-${req.request_id}`}
                          style={{ background: '#F3F4F6', color: '#EF4444', border: '1px solid #FCA5A5', padding: '8px 16px', borderRadius: '6px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <XCircle style={{ width: '16px', height: '16px' }} />
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MY REQUESTS TABLE */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText style={{ width: '20px', height: '20px', color: '#4F46E5' }} />
          My Submitted Leave Applications
        </h2>

        {myRequests.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748B', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
            No leave applications recorded. Click <strong>Apply Leave</strong> to submit one.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569', fontWeight: '700' }}>
                  <th style={{ padding: '12px' }}>Request ID</th>
                  <th style={{ padding: '12px' }}>Type</th>
                  <th style={{ padding: '12px' }}>Dates</th>
                  <th style={{ padding: '12px' }}>Duration</th>
                  <th style={{ padding: '12px' }}>Reason</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px' }}>Submitted Date</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map((r) => (
                  <tr key={r.request_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px', fontWeight: '700', fontFamily: 'monospace', color: '#0F172A' }}>{r.request_id}</td>
                    <td style={{ padding: '12px', fontWeight: '700' }}>{r.leave_type}</td>
                    <td style={{ padding: '12px' }}>{r.start_date} to {r.end_date}</td>
                    <td style={{ padding: '12px', fontWeight: '700' }}>{r.days} {r.days === 1 ? 'day' : 'days'}</td>
                    <td style={{ padding: '12px', color: '#475569' }}>{r.reason}</td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '800',
                          background: r.status === 'APPROVED' ? '#D1FAE5' : r.status === 'REJECTED' ? '#FEE2E2' : '#FEF3C7',
                          color: r.status === 'APPROVED' ? '#065F46' : r.status === 'REJECTED' ? '#991B1B' : '#92400E',
                        }}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: '#64748B' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* APPLY LEAVE MODAL */}
      {isApplyModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#FFFFFF', width: '100%', maxWidth: '520px', borderRadius: '16px', padding: '28px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar style={{ color: '#4F46E5', width: '20px', height: '20px' }} />
                Apply for Leave
              </h2>
              <button onClick={() => setIsApplyModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#64748B', cursor: 'pointer' }}>×</button>
            </div>

            <form onSubmit={handleApplyLeave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Leave Type *</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  id="leave-type-select"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', background: '#FFFFFF', fontWeight: '600' }}
                >
                  <option value="CASUAL">CASUAL LEAVE</option>
                  <option value="SICK">SICK LEAVE</option>
                  <option value="EARNED">EARNED LEAVE</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Start Date *</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    id="leave-start-date"
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>End Date *</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    id="leave-end-date"
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                  />
                </div>
              </div>

              {calculatedDays > 0 && (
                <div style={{ background: '#EEF2FF', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', color: '#4338CA', fontWeight: '700' }}>
                  Total Requested Duration: {calculatedDays} {calculatedDays === 1 ? 'day' : 'days'}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Reason *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  id="leave-reason"
                  placeholder="Provide context for manager approval..."
                  rows={3}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  style={{ background: '#F1F5F9', color: '#475569', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  id="submit-leave-app"
                  style={{ background: '#4F46E5', color: '#FFFFFF', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
