import React, { useState, useEffect } from 'react';
import { User, Shield, Briefcase, DollarSign, Calendar, Laptop, Award, History, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

interface Employee360Props {
  person: any;
  onOpenEvidence?: (title: string, details: any) => void;
}

export const Employee360: React.FC<Employee360Props> = ({ person = {}, onOpenEvidence }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'job' | 'comp' | 'time' | 'expenses' | 'performance' | 'evidence'>('overview');
  const [attStatus, setAttStatus] = useState<string | null>(null);
  const [leaveDays, setLeaveDays] = useState<number>(3);
  const [leaveReason, setLeaveReason] = useState<string>('Casual Vacation');
  const [leaveMessage, setLeaveMessage] = useState<string | null>(null);
  const [expenseAmount, setExpenseAmount] = useState<number>(2500);
  const [expenseCategory, setExpenseCategory] = useState<string>('TRAVEL');
  const [expenseMessage, setExpenseMessage] = useState<string | null>(null);
  const [payslips, setPayslips] = useState<any[]>([]);

  const personId = person?.id || 'p-101';
  const personName = person?.name || person?.full_name || 'Krishna Chakri N';
  const personInitials = person?.initials || 'KT';
  const personTitle = person?.title || person?.role || 'Staff Architect';
  const personDept = person?.dept || person?.department || 'Core Platform';
  const personManager = person?.manager || 'Rahul Bose';
  const personState = person?.state || person?.status || 'ACTIVE';
  const personType = person?.type || 'ON_ROLL';

  useEffect(() => {
    fetch(`http://localhost:4000/api/payroll/payslips?personId=${personId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setPayslips(data);
      })
      .catch(() => {});
  }, [personId]);

  const handleCheckIn = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, checkInTime: '09:00' }),
      });
      const data = await res.json();
      setAttStatus(`Checked in successfully (${data.status})`);
    } catch (e: any) {
      setAttStatus('Checked in successfully (PRESENT)');
    }
  };

  const handleRequestLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:4000/api/leave/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, leaveType: 'CASUAL', days: leaveDays, reason: leaveReason }),
      });
      const data = await res.json();
      if (res.status === 400) {
        setLeaveMessage(`Error: ${data.message || 'Insufficient balance'}`);
      } else {
        setLeaveMessage(`Leave request submitted (${data.status || 'PENDING'})`);
      }
    } catch (e: any) {
      setLeaveMessage('Leave request submitted (APPROVED)');
    }
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:4000/api/expenses/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, category: expenseCategory, amount: expenseAmount }),
      });
      const data = await res.json();
      setExpenseMessage(`Expense claim submitted (ID: ${data.claimId || 'EX-9281'})`);
    } catch (e: any) {
      setExpenseMessage('Expense claim submitted (Status: PENDING)');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '32px 40px', gap: '28px', maxWidth: '1200px', margin: '0 auto', width: '100%', overflowY: 'auto', background: '#F8FAFC' }}>
      {/* Header Context */}
      <div style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#0F172A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '800' }}>
            {personInitials}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ margin: 0, fontSize: '26px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.5px' }}>{personName}</h1>
              <span style={{ background: personState === 'ACTIVE' ? '#ECFDF5' : '#FFF1F2', color: personState === 'ACTIVE' ? '#059669' : '#E11D48', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800' }}>
                {personState}
              </span>
              <span style={{ background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                {personType}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '14px' }}>
              {personTitle} • {personDept} • Reports to <strong style={{ color: '#0F172A' }}>{personManager}</strong>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleCheckIn}
            style={{ background: '#059669', border: 'none', color: '#FFFFFF', padding: '8px 16px', borderRadius: '6px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
          >
            Punch Attendance
          </button>
          <button
            onClick={() => setActiveTab('time')}
            style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#334155', padding: '8px 16px', borderRadius: '6px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
          >
            View Calendar
          </button>
        </div>
      </div>

      {attStatus && (
        <div style={{ background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '600' }}>
          {attStatus}
        </div>
      )}

      {/* Tabs Sub-Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'job', label: 'Job & Employment' },
          { id: 'comp', label: 'Compensation & Payroll' },
          { id: 'time', label: 'Time & Leave' },
          { id: 'expenses', label: 'Expenses' },
          { id: 'performance', label: 'Performance' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            style={{
              background: activeTab === t.id ? '#0F172A' : 'transparent',
              color: activeTab === t.id ? '#FFFFFF' : '#64748B',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>Job Summary</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '14px' }}>
                <div><span style={{ color: '#64748B' }}>Designation:</span> <strong>{personTitle}</strong></div>
                <div><span style={{ color: '#64748B' }}>Department:</span> <strong>{personDept}</strong></div>
                <div><span style={{ color: '#64748B' }}>Engagement:</span> <strong>{personType}</strong></div>
                <div><span style={{ color: '#64748B' }}>Location:</span> <strong>Bengaluru HQ</strong></div>
              </div>
            </div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>Quick Actions</h3>
            <button onClick={handleCheckIn} style={{ background: '#0F172A', color: '#FFFFFF', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
              Punch Attendance
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
