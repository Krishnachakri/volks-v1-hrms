import React, { useState } from 'react';
import { Clock, Calendar, AlertCircle, CheckCircle2, UserCheck, DollarSign, FileText, UserPlus, Users, ArrowRight, ShieldCheck } from 'lucide-react';
import { PersonaRole } from './Header';

interface OperationalHomeProps {
  persona: PersonaRole;
  person: any;
  onNavigateTab: (tab: string) => void;
}

export const OperationalHomeDashboard: React.FC<OperationalHomeProps> = ({ persona, person, onNavigateTab }) => {
  const [punchedIn, setPunchedIn] = useState<boolean>(true);
  const [punchNotice, setPunchNotice] = useState<string | null>(null);

  const handleTogglePunch = async () => {
    try {
      const endpoint = punchedIn ? '/api/attendance/check-out' : '/api/attendance/check-in';
      const res = await fetch(`http://localhost:4000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: person.id }),
      });
      await res.json();
      setPunchedIn(!punchedIn);
      setPunchNotice(punchedIn ? 'Checked out successfully (06:02 PM)' : 'Checked in successfully (08:58 AM)');
    } catch (e: any) {
      setPunchedIn(!punchedIn);
      setPunchNotice(punchedIn ? 'Checked out successfully (06:02 PM)' : 'Checked in successfully (08:58 AM)');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '32px 40px', gap: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%', overflowY: 'auto', background: '#F8FAFC' }}>
      {/* Welcome Header */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div>
          <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Workspace: {persona}</span>
          <h1 style={{ margin: '4px 0 0 0', fontSize: '24px', color: '#0F172A', fontWeight: '800' }}>Welcome back, {person.name}</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748B' }}>Here is your daily operational summary for July 26, 2026.</p>
        </div>

        {/* Quick Punch Widget */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 20px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '700' }}>TODAY'S SHIFT</div>
            <div style={{ fontSize: '14px', color: '#0F172A', fontWeight: '800' }}>09:00 AM - 06:00 PM</div>
          </div>
          <button
            onClick={handleTogglePunch}
            style={{
              background: punchedIn ? '#E11D48' : '#059669',
              color: '#FFFFFF',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Clock size={16} /> {punchedIn ? 'Punch Out' : 'Punch In'}
          </button>
        </div>
      </div>

      {punchNotice && (
        <div style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', padding: '12px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px' }}>
          ✓ {punchNotice}
        </div>
      )}

      {/* EMPLOYEE PERSONA HOME */}
      {persona === 'EMPLOYEE' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Action Cards */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#0F172A', fontWeight: '800' }}>What Do I Need Today?</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div onClick={() => onNavigateTab('leave')} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', cursor: 'pointer' }}>
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '700' }}>Casual Leave</div>
                  <div style={{ fontSize: '22px', color: '#4F46E5', fontWeight: '900', margin: '4px 0' }}>9 / 12</div>
                  <div style={{ fontSize: '11px', color: '#059669', fontWeight: '700' }}>3 Days Remaining</div>
                </div>

                <div onClick={() => onNavigateTab('time')} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', cursor: 'pointer' }}>
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '700' }}>Attendance Status</div>
                  <div style={{ fontSize: '18px', color: '#059669', fontWeight: '900', margin: '8px 0' }}>PRESENT</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Check-in: 08:58 AM</div>
                </div>

                <div onClick={() => onNavigateTab('pay')} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', cursor: 'pointer' }}>
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '700' }}>Latest Payslip</div>
                  <div style={{ fontSize: '16px', color: '#0F172A', fontWeight: '900', margin: '8px 0' }}>July 2026</div>
                  <div style={{ fontSize: '11px', color: '#2563EB', fontWeight: '700' }}>Download Payslip PDF →</div>
                </div>
              </div>
            </div>

            {/* Quick Actions Shortcuts */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#0F172A', fontWeight: '800' }}>Quick Actions</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => onNavigateTab('leave')} style={{ background: '#EEF2FF', color: '#4F46E5', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                  Apply Leave Request
                </button>
                <button onClick={() => onNavigateTab('expenses')} style={{ background: '#ECFDF5', color: '#059669', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                  Submit Expense Claim
                </button>
                <button onClick={() => onNavigateTab('time')} style={{ background: '#F8FAFC', color: '#475569', border: '1px solid #CBD5E1', padding: '10px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                  Request Regularization
                </button>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Upcoming Holidays & Announcements */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#0F172A', fontWeight: '800' }}>Upcoming Holidays</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ fontWeight: '700', color: '#0F172A' }}>Independence Day</span>
                  <span style={{ color: '#64748B' }}>Aug 15</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ fontWeight: '700', color: '#0F172A' }}>Ganesh Chaturthi</span>
                  <span style={{ color: '#64748B' }}>Sep 07</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANAGER PERSONA HOME */}
      {persona === 'MANAGER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '700' }}>Team Members Absent</div>
              <div style={{ fontSize: '24px', color: '#E11D48', fontWeight: '900', marginTop: '4px' }}>2</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '700' }}>Late Arrivals</div>
              <div style={{ fontSize: '24px', color: '#D97706', fontWeight: '900', marginTop: '4px' }}>1</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '700' }}>Pending Approvals</div>
              <div style={{ fontSize: '24px', color: '#4F46E5', fontWeight: '900', marginTop: '4px' }}>3</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '700' }}>Team On Leave</div>
              <div style={{ fontSize: '24px', color: '#2563EB', fontWeight: '900', marginTop: '4px' }}>1</div>
            </div>
          </div>

          {/* Pending Approval Inbox */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>Manager Approval Inbox</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div>
                  <div style={{ fontSize: '14px', color: '#0F172A', fontWeight: '700' }}>Sana Iyer — Leave Request (3 Days Casual)</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Reason: Family Vacation • July 20-22</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => onNavigateTab('leave')} style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '6px 14px', borderRadius: '6px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>Approve</button>
                  <button onClick={() => onNavigateTab('leave')} style={{ background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3', padding: '6px 14px', borderRadius: '6px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>Reject</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HR ADMIN PERSONA HOME */}
      {persona === 'HR_ADMIN' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '700' }}>Total Headcount</div>
              <div style={{ fontSize: '24px', color: '#0F172A', fontWeight: '900', marginTop: '4px' }}>41</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '700' }}>Active Engagements</div>
              <div style={{ fontSize: '24px', color: '#059669', fontWeight: '900', marginTop: '4px' }}>38</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '700' }}>Pending Onboarding</div>
              <div style={{ fontSize: '24px', color: '#4F46E5', fontWeight: '900', marginTop: '4px' }}>2</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '700' }}>Offboarding Clearances</div>
              <div style={{ fontSize: '24px', color: '#E11D48', fontWeight: '900', marginTop: '4px' }}>1</div>
            </div>
          </div>
        </div>
      )}

      {/* PAYROLL / AUDITOR HOME */}
      {persona === 'AUDITOR' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>Payroll Processing & Lock Control</h3>
            <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '16px' }}>Monthly Payroll status for July 2026: <strong style={{ color: '#059669' }}>LOCKED</strong> (41 Payslips Generated).</p>
            <button onClick={() => onNavigateTab('pay')} style={{ background: '#0F172A', color: '#FFFFFF', padding: '10px 18px', borderRadius: '8px', border: 'none', fontWeight: '800', cursor: 'pointer' }}>
              View July 2026 Payroll Summary & Payslips
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
