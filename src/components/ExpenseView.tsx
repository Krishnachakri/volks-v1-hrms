import React, { useState, useEffect } from 'react';
import { Person } from '../App';
import { PersonaRole } from './Header';
import { DollarSign, Clock, CheckCircle2, AlertCircle, Plus, FileText, CreditCard } from 'lucide-react';

interface ExpenseClaim {
  claim_id: string;
  person_id: string;
  category: string;
  amount: string;
  description: string;
  receipt_url: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REIMBURSED';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  reimbursed_by: string | null;
  reimbursed_at: string | null;
  created_at: string;
  applicant_name?: string;
}

interface ExpenseSummary {
  pending_total: number;
  approved_total: number;
  reimbursed_total: number;
}

interface ExpenseViewProps {
  person: Person;
  persona: PersonaRole;
}

export const ExpenseView: React.FC<ExpenseViewProps> = ({ person, persona }) => {
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>({ pending_total: 0, approved_total: 0, reimbursed_total: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);

  // Form states
  const [category, setCategory] = useState<string>('TRAVEL');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [receiptUrl, setReceiptUrl] = useState<string>('/uploads/receipt_sample.pdf');

  // Rejection modal states
  const [rejectingClaimId, setRejectingClaimId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Notification banners
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch claims list
      let claimsUrl = 'http://localhost:4000/api/expenses/claims';
      if (persona === 'EMPLOYEE') {
        claimsUrl += `?personId=${person.id}`;
      }
      const claimsRes = await fetch(claimsUrl);
      if (claimsRes.ok) {
        const claimsData: ExpenseClaim[] = await claimsRes.json();
        setClaims(claimsData);
      }

      // 2. Fetch summary metrics
      const sumRes = await fetch(`http://localhost:4000/api/expenses/summary?personId=${person.id}`);
      if (sumRes.ok) {
        const sumData: ExpenseSummary = await sumRes.json();
        setSummary(sumData);
      }
    } catch (err) {
      console.error('Failed to fetch expense claims data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [person.id, persona]);

  const handleApplyExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const parsedAmt = parseFloat(amount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      setErrorMsg('Please enter a valid expense amount greater than ₹0.');
      return;
    }

    if (!description.trim()) {
      setErrorMsg('Please provide a detailed business description for this expense claim.');
      return;
    }

    try {
      const res = await fetch('http://localhost:4000/api/expenses/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: person.id,
          category,
          amount: parsedAmt,
          description: description.trim(),
          receiptUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to submit expense claim.');
      } else {
        setSuccessMsg(`Expense claim (${data.claimId}) submitted successfully!`);
        setIsSubmitModalOpen(false);
        setAmount('');
        setDescription('');
        await fetchData();
      }
    } catch (err) {
      setErrorMsg('Network error while submitting expense claim.');
    }
  };

  const handleApprove = async (claimId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('http://localhost:4000/api/expenses/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId,
          approverPersonId: person.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to approve expense claim.');
      } else {
        setSuccessMsg(`Expense claim approved successfully.`);
        await fetchData();
      }
    } catch (err) {
      setErrorMsg('Network error while approving claim.');
    }
  };

  const handleReject = async (claimId: string) => {
    if (!rejectionReason.trim()) {
      setErrorMsg('Mandatory rejection reason must be provided.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('http://localhost:4000/api/expenses/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId,
          approverPersonId: person.id,
          rejectionReason: rejectionReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to reject expense claim.');
      } else {
        setSuccessMsg(`Expense claim rejected.`);
        setRejectingClaimId(null);
        setRejectionReason('');
        await fetchData();
      }
    } catch (err) {
      setErrorMsg('Network error while rejecting claim.');
    }
  };

  const handleReimburse = async (claimId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('http://localhost:4000/api/expenses/reimburse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId,
          actorPersonId: person.id,
          actorRole: persona,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to reimburse expense claim.');
      } else {
        setSuccessMsg(`Expense claim reimbursed successfully.`);
        await fetchData();
      }
    } catch (err) {
      setErrorMsg('Network error while reimbursing claim.');
    }
  };

  const getStatusBadge = (status: ExpenseClaim['status']) => {
    switch (status) {
      case 'PENDING':
        return <span style={{ background: '#FEF3C7', color: '#D97706', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>PENDING</span>;
      case 'APPROVED':
        return <span style={{ background: '#E0E7FF', color: '#4338CA', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>APPROVED</span>;
      case 'REIMBURSED':
        return <span style={{ background: '#ECFDF5', color: '#059669', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>REIMBURSED</span>;
      case 'REJECTED':
        return <span style={{ background: '#FEE2E2', color: '#DC2626', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>REJECTED</span>;
      default:
        return <span style={{ background: '#F1F5F9', color: '#64748B', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>{status}</span>;
    }
  };

  const pendingClaims = claims.filter((c) => c.status === 'PENDING');
  const approvedClaims = claims.filter((c) => c.status === 'APPROVED');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Top Banner & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', padding: '20px 24px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <DollarSign size={24} style={{ color: '#059669' }} />
            Reimbursements & Expense Claims
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            {persona === 'EMPLOYEE' && `Viewing active expense ledger for ${person.name} (${person.role})`}
            {persona === 'MANAGER' && `Manager Approval & Verification Studio for ${person.name}`}
            {(persona === 'HR_ADMIN' || persona === 'AUDITOR') && `Organization Reimbursement & Finance Processing Ledger`}
          </p>
        </div>

        {persona === 'EMPLOYEE' && (
          <button
            id="submit-expense-btn"
            onClick={() => setIsSubmitModalOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #059669, #10B981)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
            }}
          >
            <Plus size={16} />
            Submit Expense Claim
          </button>
        )}
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', color: '#065F46', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div id="card-pending-expense" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Claims</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>₹{summary.pending_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div id="card-approved-expense" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#E0E7FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4338CA' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Approved (Unpaid)</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>₹{summary.approved_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div id="card-reimbursed-expense" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
            <CreditCard size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Reimbursed YTD</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>₹{summary.reimbursed_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      {/* MANAGER QUEUE VIEW */}
      {persona === 'MANAGER' && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} style={{ color: '#D97706' }} />
            Pending Manager Approvals Queue ({pendingClaims.length})
          </h2>

          {pendingClaims.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No pending expense claims requiring manager approval.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {pendingClaims.map((claim) => (
                <div key={claim.claim_id} id={`expense-card-${claim.claim_id}`} style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px', background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '14px', color: '#0F172A' }}>{claim.applicant_name || 'Employee'}</strong>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>Category: {claim.category}</div>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#059669' }}>₹{parseFloat(claim.amount).toLocaleString('en-IN')}</div>
                  </div>

                  <div style={{ fontSize: '13px', color: '#334155', background: '#FFFFFF', padding: '8px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', margin: '10px 0' }}>
                    "{claim.description}"
                  </div>

                  {claim.receipt_url && (
                    <div style={{ fontSize: '11px', color: '#4F46E5', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileText size={12} />
                      <a href={claim.receipt_url} target="_blank" rel="noopener noreferrer" style={{ color: '#4F46E5', textDecoration: 'underline' }}>View Attached Receipt</a>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                    <button
                      onClick={() => handleApprove(claim.claim_id)}
                      style={{ flex: 1, background: '#059669', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Approve Claim
                    </button>
                    <button
                      onClick={() => { setRejectingClaimId(claim.claim_id); setRejectionReason(''); }}
                      style={{ flex: 1, background: '#FFFFFF', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: '6px', padding: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Reject Claim
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* HR ADMIN / FINANCE REIMBURSEMENT QUEUE VIEW */}
      {(persona === 'HR_ADMIN' || persona === 'AUDITOR') && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={18} style={{ color: '#4338CA' }} />
            Approved Expense Reimbursement Processing Queue ({approvedClaims.length})
          </h2>

          {approvedClaims.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No approved expense claims waiting for reimbursement payout.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {approvedClaims.map((claim) => (
                <div key={claim.claim_id} id={`expense-card-${claim.claim_id}`} style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px', background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '14px', color: '#0F172A' }}>{claim.applicant_name || 'Employee'}</strong>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>Category: {claim.category}</div>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#4338CA' }}>₹{parseFloat(claim.amount).toLocaleString('en-IN')}</div>
                  </div>

                  <div style={{ fontSize: '13px', color: '#334155', background: '#FFFFFF', padding: '8px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', margin: '10px 0' }}>
                    "{claim.description}"
                  </div>

                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '12px' }}>
                    Approved at: {claim.approved_at ? new Date(claim.approved_at).toLocaleString() : 'Recently'}
                  </div>

                  <button
                    id="reimburse-claim-btn"
                    onClick={() => handleReimburse(claim.claim_id)}
                    style={{ width: '100%', background: '#4338CA', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <CreditCard size={14} />
                    Process Reimbursement Payout
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MY EXPENSE CLAIMS TABLE */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
          {persona === 'EMPLOYEE' ? 'My Expense Claims History' : 'All Organization Expense Claims Ledger'}
        </h2>

        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>Loading expense records...</div>
        ) : claims.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
            No expense claims found in database.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: '700' }}>
                  <th style={{ padding: '12px 16px' }}>Date</th>
                  <th style={{ padding: '12px 16px' }}>Applicant</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px' }}>Description</th>
                  <th style={{ padding: '12px 16px' }}>Amount</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Audit Timestamps</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim.claim_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 16px', color: '#64748B' }}>{new Date(claim.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0F172A' }}>{claim.applicant_name || person.name}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '600' }}>{claim.category}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>
                      {claim.description}
                      {claim.rejection_reason && (
                        <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '2px' }}>
                          Reason: {claim.rejection_reason}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '800', color: '#0F172A' }}>₹{parseFloat(claim.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '12px 16px' }}>{getStatusBadge(claim.status)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#64748B' }}>
                      {claim.approved_at && <div>Approved: {new Date(claim.approved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                      {claim.reimbursed_at && <div>Reimbursed: {new Date(claim.reimbursed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                      {!claim.approved_at && !claim.reimbursed_at && <div>Submitted</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SUBMIT CLAIM MODAL */}
      {isSubmitModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div id="submit-expense-app" style={{ background: '#FFFFFF', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>Submit Expense Claim</h2>
              <button onClick={() => setIsSubmitModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#64748B', cursor: 'pointer' }}>×</button>
            </div>

            <form onSubmit={handleApplyExpense} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Expense Category</label>
                <select
                  id="expense-category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#F8FAFC' }}
                >
                  <option value="TRAVEL">TRAVEL</option>
                  <option value="MEALS">MEALS</option>
                  <option value="SUPPLIES">SUPPLIES</option>
                  <option value="EQUIPMENT">EQUIPMENT</option>
                  <option value="CLIENT_ENTERTAINMENT">CLIENT_ENTERTAINMENT</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Amount (₹)</label>
                <input
                  id="expense-amount"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 1500.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Business Purpose / Description</label>
                <textarea
                  id="expense-description"
                  rows={3}
                  placeholder="Describe the business expense..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Receipt File Reference (PARTIAL Storage)</label>
                <input
                  id="expense-receipt-url"
                  type="text"
                  value={receiptUrl}
                  onChange={(e) => setReceiptUrl(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#F8FAFC' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: '700', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  id="submit-claim-btn"
                  type="submit"
                  style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: '#059669', color: '#FFFFFF', fontWeight: '700', cursor: 'pointer' }}
                >
                  Submit Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectingClaimId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px', border: '1px solid #E2E8F0' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', color: '#DC2626' }}>Reject Expense Claim</h3>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 16px 0' }}>Provide a mandatory rejection reason for audit records.</p>
            <input
              id="expense-reject-reason"
              type="text"
              placeholder="Mandatory rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setRejectingClaimId(null)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
              <button id="confirm-expense-reject-btn" onClick={() => handleReject(rejectingClaimId)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontWeight: '700', cursor: 'pointer' }}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
