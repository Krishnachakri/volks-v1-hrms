import React, { useState, useEffect } from 'react';
import { Layers, ArrowRight, ShieldCheck, AlertTriangle, CheckCircle, HelpCircle, UserCheck, FileText, Lock, RefreshCw, Briefcase, Award, LogOut, CheckSquare, PlusCircle } from 'lucide-react';
import { Person } from '../App';

interface LifecycleStudioProps {
  person: Person;
  persona?: string;
  onOpenEvidence?: (title: string, details: any) => void;
}

export const LifecycleStudio: React.FC<LifecycleStudioProps> = ({ person, persona = 'HR_ADMIN', onOpenEvidence }) => {
  const [activeTab, setActiveTab] = useState<'MOVEMENTS' | 'ONBOARDING' | 'OFFBOARDING' | 'REHIRE'>('MOVEMENTS');

  // Backend state
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [activeEngagement, setActiveEngagement] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [onboardingTasks, setOnboardingTasks] = useState<any[]>([]);
  const [probationReviews, setProbationReviews] = useState<any[]>([]);
  const [clearance, setClearance] = useState<any>(null);
  const [assignedAssets, setAssignedAssets] = useState<any[]>([]);
  const [userAccount, setUserAccount] = useState<any>(null);

  // Form states — Career Movement
  const [eventType, setEventType] = useState<'PROMOTE' | 'TRANSFER' | 'COMPENSATION_CHANGE' | 'CONVERT' | 'ROLE_CHANGE'>('PROMOTE');
  const [targetType, setTargetType] = useState<'ON_ROLL' | 'INTERN' | 'CONSULTANT'>('ON_ROLL');
  const [effectiveDate, setEffectiveDate] = useState<string>('2026-08-01');
  const [newTitle, setNewTitle] = useState<string>('Senior Software Engineer');
  const [newDept, setNewDept] = useState<string>('Engineering');
  const [newComp, setNewComp] = useState<number>(1200000);
  const [reason, setReason] = useState<string>('Performance Appraisal Promotion 2026');

  // Form states — Onboarding Task Creation
  const [newTaskName, setNewTaskName] = useState<string>('');
  const [newTaskCategory, setNewTaskCategory] = useState<string>('IT');

  // Form states — Probation Review
  const [probationDecision, setProbationDecision] = useState<'CONFIRM' | 'EXTEND_PROBATION' | 'TERMINATE'>('CONFIRM');
  const [probationFeedback, setProbationFeedback] = useState<string>('Meets all performance expectations during probation.');

  // Form states — Resignation
  const [resignationReason, setResignationReason] = useState<string>('Pursuing higher education / career advancement.');
  const [requestedLwd, setRequestedLwd] = useState<string>('2026-08-31');

  // Form states — Rehire
  const [rehireDate, setRehireDate] = useState<string>('2026-09-01');
  const [rehireType, setRehireType] = useState<'ON_ROLL' | 'INTERN' | 'CONSULTANT'>('ON_ROLL');
  const [rehireComp, setRehireComp] = useState<number>(1400000);

  const fetchLifecycleStatus = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`http://localhost:4000/api/lifecycle/status?personId=${person.id}`);
      const data = await res.json();
      if (res.ok) {
        setActiveEngagement(data.activeEngagement);
        setHistory(data.history || []);
        setOnboardingTasks(data.onboardingTasks || []);
        setProbationReviews(data.probationReviews || []);
        setClearance(data.clearance);
        setAssignedAssets(data.assignedAssets || []);
        setUserAccount(data.user);
      } else {
        setErrorMsg(data.error || 'Failed to load lifecycle status.');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLifecycleStatus();
  }, [person.id]);

  const handleCareerTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const actorPersonId = (persona === 'HR_ADMIN' || persona === 'MANAGER' || persona === 'AUDITOR') ? 'p-102' : person.id;
      const res = await fetch('http://localhost:4000/api/lifecycle/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: person.id,
          actorPersonId,
          actorRole: persona,
          eventType,
          targetType,
          effectiveDate,
          newTitle,
          newDept,
          newComp,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error);
      } else {
        setSuccessMsg(`Career transition '${eventType}' (v${data.version}) committed successfully!`);
        fetchLifecycleStatus();
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleAddOnboardingTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('http://localhost:4000/api/lifecycle/onboarding/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: person.id,
          actorPersonId: person.id,
          taskName: newTaskName.trim(),
          category: newTaskCategory,
          dueDate: '2026-08-15',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error);
      } else {
        setNewTaskName('');
        setSuccessMsg(`Onboarding task created!`);
        fetchLifecycleStatus();
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('http://localhost:4000/api/lifecycle/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error);
      } else {
        setSuccessMsg(`Task completed!`);
        fetchLifecycleStatus();
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleProbationReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('http://localhost:4000/api/lifecycle/probation/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: person.id,
          reviewerId: person.id,
          decision: probationDecision,
          feedback: probationFeedback,
          effectiveDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error);
      } else {
        setSuccessMsg(`Probation review '${probationDecision}' processed!`);
        fetchLifecycleStatus();
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleResignationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('http://localhost:4000/api/lifecycle/resign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: person.id,
          resignationReason,
          requestedLwd,
          noticeDays: 30,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error);
      } else {
        setSuccessMsg(`Resignation submitted! Employee entered NOTICE_PERIOD state.`);
        fetchLifecycleStatus();
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleClearanceToggle = async (key: string, val: boolean) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const payload: any = { personId: person.id };
      payload[key] = val;
      const res = await fetch('http://localhost:4000/api/lifecycle/clearance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error);
      } else {
        fetchLifecycleStatus();
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleFinalTermination = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('http://localhost:4000/api/lifecycle/terminate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: person.id,
          actorRole: persona,
          effectiveDate: '2026-08-31',
          reason: 'Offboarding Clearance Completed & Account Revocation',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error);
      } else {
        setSuccessMsg(`Employment TERMINATED successfully! Account access revoked (is_active = false).`);
        fetchLifecycleStatus();
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRehireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('http://localhost:4000/api/lifecycle/rehire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: person.id,
          actorRole: persona,
          rehireDate,
          newEmploymentType: rehireType,
          newComp: rehireComp,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error);
      } else {
        setSuccessMsg(`Employee REHIRED! Created NEW engagement (${data.newEngagementId}) and reactivated account.`);
        fetchLifecycleStatus();
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const currentState = activeEngagement?.state || 'ACTIVE';
  const completedTasksCount = onboardingTasks.filter((t) => t.is_completed).length;
  const onboardingCompletionPercent = onboardingTasks.length > 0 ? Math.round((completedTasksCount / onboardingTasks.length) * 100) : 100;

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto', background: '#F8FAFC' }}>
      {/* Header Banner */}
      <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Lifecycle Studio — {person.name}
            </h2>
            <span
              style={{
                background: currentState === 'TERMINATED' ? '#FEE2E2' : currentState === 'NOTICE_PERIOD' ? '#FEF3C7' : '#DCFCE7',
                color: currentState === 'TERMINATED' ? '#991B1B' : currentState === 'NOTICE_PERIOD' ? '#92400E' : '#166534',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              STATE: {currentState}
            </span>
            {userAccount && (
              <span
                style={{
                  background: userAccount.is_active ? '#E0F2FE' : '#F3F4F6',
                  color: userAccount.is_active ? '#075985' : '#4B5563',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                ACCOUNT: {userAccount.is_active ? 'ACTIVE' : 'DEACTIVATED'}
              </span>
            )}
          </div>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
            Bitemporal career events, onboarding task engine, probation reviews, multi-domain offboarding clearance & account revocation.
          </p>
        </div>

        {/* Sub-Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', background: '#F1F5F9', padding: '4px', borderRadius: '10px' }}>
          <button
            onClick={() => setActiveTab('MOVEMENTS')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'MOVEMENTS' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'MOVEMENTS' ? '#0F172A' : '#64748B',
              boxShadow: activeTab === 'MOVEMENTS' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            Career Movements
          </button>
          <button
            onClick={() => setActiveTab('ONBOARDING')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'ONBOARDING' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'ONBOARDING' ? '#0F172A' : '#64748B',
              boxShadow: activeTab === 'ONBOARDING' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            Onboarding & Probation
          </button>
          <button
            onClick={() => setActiveTab('OFFBOARDING')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'OFFBOARDING' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'OFFBOARDING' ? '#0F172A' : '#64748B',
              boxShadow: activeTab === 'OFFBOARDING' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            Resignation & Clearance
          </button>
          {currentState === 'TERMINATED' && (
            <button
              onClick={() => setActiveTab('REHIRE')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeTab === 'REHIRE' ? '#059669' : 'transparent',
                color: activeTab === 'REHIRE' ? '#FFFFFF' : '#64748B',
              }}
            >
              Rehire Former Employee
            </button>
          )}
        </div>
      </div>

      {/* Notifications Banner */}
      {errorMsg && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} /> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', color: '#166534', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}

      {/* TAB 1: CAREER MOVEMENTS */}
      {activeTab === 'MOVEMENTS' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Career Mutation Form */}
          <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={18} style={{ color: '#2563EB' }} /> Propose Career Mutation Event
            </h3>

            <form onSubmit={handleCareerTransition} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Mutation Event Type</label>
                <select
                  id="career-event-type-select"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                >
                  <option value="PROMOTE">PROMOTE (Title & Compensation Revision)</option>
                  <option value="TRANSFER">TRANSFER (Department Change)</option>
                  <option value="COMPENSATION_CHANGE">COMPENSATION_CHANGE</option>
                  <option value="CONVERT">CONVERT (Intern/Contract → On-roll)</option>
                  <option value="ROLE_CHANGE">ROLE_CHANGE (Title Revision)</option>
                </select>
              </div>

              {eventType === 'CONVERT' && (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Target Employment Type</label>
                  <select
                    id="target-type-select"
                    value={targetType}
                    onChange={(e) => setTargetType(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  >
                    <option value="ON_ROLL">ON_ROLL</option>
                    <option value="INTERN">INTERN</option>
                    <option value="CONSULTANT">CONSULTANT</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Effective Date</label>
                  <input
                    id="effective-date-input"
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Proposed Annual Salary (₹)</label>
                  <input
                    id="proposed-salary-input"
                    type="number"
                    value={newComp}
                    onChange={(e) => setNewComp(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Business Justification / Reason</label>
                <input
                  id="mutation-reason-input"
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <button
                type="button"
                id="submit-career-transition"
                onClick={handleCareerTransition}
                style={{ background: '#0F172A', color: '#FFFFFF', padding: '10px 16px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginTop: '6px' }}
              >
                Submit Career Mutation to Bitemporal Ledger →
              </button>
            </form>
          </div>

          {/* Bitemporal History Ledger */}
          <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} style={{ color: '#059669' }} /> Bitemporal Career History Ledger
            </h3>

            {history.length === 0 ? (
              <div style={{ padding: '20px', textTransform: 'uppercase', fontSize: '12px', color: '#94A3B8', textAlign: 'center' }}>
                No historical employment versions recorded yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {history.map((h, idx) => (
                  <div key={h.change_id || idx} style={{ background: idx === 0 ? '#F0FDF4' : '#F8FAFC', border: idx === 0 ? '1px solid #86EFAC' : '1px solid #E2E8F0', padding: '12px', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A' }}>Version v{h.version}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: h.valid_to ? '#64748B' : '#166534' }}>
                        {h.valid_to ? `Valid: ${h.valid_from} to ${h.valid_to}` : `Valid: ${h.valid_from} (Current)`}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#334155', fontWeight: 600 }}>
                      Compensation: ₹{Number(h.compensation).toLocaleString('en-IN')} / year
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      Reason: {h.reason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ONBOARDING & PROBATION */}
      {activeTab === 'ONBOARDING' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Onboarding Checklist Panel */}
          <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckSquare size={18} style={{ color: '#2563EB' }} /> Onboarding Task Checklist
              </h3>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563EB', background: '#EFF6FF', padding: '4px 8px', borderRadius: '8px' }}>
                {onboardingCompletionPercent}% Complete
              </span>
            </div>

            {/* Add Task Form (HR) */}
            <form onSubmit={handleAddOnboardingTask} style={{ display: 'flex', gap: '8px' }}>
              <input
                id="new-task-name-input"
                type="text"
                placeholder="Assign new onboarding task..."
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
              <button
                type="button"
                id="add-onboarding-task-btn"
                onClick={handleAddOnboardingTask}
                style={{ background: '#2563EB', color: '#FFFFFF', padding: '8px 14px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
              >
                Assign Task
              </button>
            </form>

            {/* Checklist Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {onboardingTasks.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No onboarding tasks assigned.</p>
              ) : (
                onboardingTasks.map((task) => (
                  <div key={task.task_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', background: task.is_completed ? '#F8FAFC' : '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: task.is_completed ? '#94A3B8' : '#0F172A', textDecoration: task.is_completed ? 'line-through' : 'none' }}>
                        {task.task_name}
                      </span>
                    </div>
                    {!task.is_completed ? (
                      <button
                        id={`complete-task-btn-${task.task_id}`}
                        onClick={() => handleCompleteTask(task.task_id)}
                        style={{ background: '#059669', color: '#FFFFFF', padding: '4px 10px', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Complete Task
                      </button>
                    ) : (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={14} /> Done
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Probation Review Panel */}
          <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserCheck size={18} style={{ color: '#D97706' }} /> Probation Review & Confirmation
            </h3>

            <form onSubmit={handleProbationReview} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Review Decision</label>
                <select
                  id="probation-decision-select"
                  value={probationDecision}
                  onChange={(e) => setProbationDecision(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                >
                  <option value="CONFIRM">CONFIRM (Confirm Employment & Set Active State)</option>
                  <option value="EXTEND_PROBATION">EXTEND_PROBATION (Extend by 3 Months)</option>
                  <option value="TERMINATE">TERMINATE (Separate During Probation)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Feedback & Review Summary</label>
                <textarea
                  id="probation-feedback-input"
                  rows={3}
                  value={probationFeedback}
                  onChange={(e) => setProbationFeedback(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <button
                type="button"
                id="submit-probation-review"
                onClick={handleProbationReview}
                style={{ background: '#D97706', color: '#FFFFFF', padding: '10px 16px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                Submit Probation Review →
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: RESIGNATION & CLEARANCE */}
      {activeTab === 'OFFBOARDING' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Employee Resignation Form */}
          <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LogOut size={18} style={{ color: '#DC2626' }} /> Submit Resignation Request
            </h3>

            <form onSubmit={handleResignationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Resignation Reason</label>
                <input
                  id="resignation-reason-input"
                  type="text"
                  value={resignationReason}
                  onChange={(e) => setResignationReason(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Requested Last Working Day (LWD)</label>
                <input
                  id="requested-lwd-input"
                  type="date"
                  value={requestedLwd}
                  onChange={(e) => setRequestedLwd(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <button
                type="button"
                id="submit-resignation-btn"
                onClick={handleResignationSubmit}
                style={{ background: '#DC2626', color: '#FFFFFF', padding: '10px 16px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                Submit Resignation (Enter NOTICE_PERIOD)
              </button>
            </form>

            {/* Assigned Assets Verification */}
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>Assigned Assets ({assignedAssets.length})</h4>
              {assignedAssets.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#059669', margin: 0 }}>✓ No unreturned assets assigned.</p>
              ) : (
                assignedAssets.map((asset) => (
                  <div key={asset.asset_id} style={{ fontSize: '12px', color: '#DC2626', fontWeight: 600 }}>
                    • {asset.asset_name} ({asset.serial_number})
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Offboarding Clearance & Account Revocation Panel */}
          <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} style={{ color: '#059669' }} /> Multi-Domain Exit Clearance Checkpoints
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { key: 'managerHandover', label: 'Manager Handover & KT' },
                { key: 'itAccessCleared', label: 'IT Access & Credentials' },
                { key: 'assetReturned', label: 'Asset Return Verification' },
                { key: 'financeDuesCleared', label: 'Finance & Expense Dues' },
                { key: 'leaveSettled', label: 'Leave Balance Settlement' },
                { key: 'payrollSettled', label: 'Final Payroll Settlement' },
              ].map((item) => {
                const isChecked = clearance ? Boolean(clearance[item.key]) : false;
                return (
                  <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      id={`clearance-${item.key}`}
                      checked={isChecked}
                      onChange={(e) => handleClearanceToggle(item.key, e.target.checked)}
                    />
                    {item.label}
                  </label>
                );
              })}
            </div>

            <button
              id="submit-termination-btn"
              onClick={handleFinalTermination}
              style={{ background: '#991B1B', color: '#FFFFFF', padding: '12px 16px', borderRadius: '8px', border: 'none', fontWeight: 800, fontSize: '13px', cursor: 'pointer', marginTop: 'auto' }}
            >
              Execute Final Termination & Revoke Account Access
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: REHIRE */}
      {activeTab === 'REHIRE' && (
        <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '600px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={18} style={{ color: '#059669' }} /> Rehire Former Employee
          </h3>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
            Rehire reuses person identity and creates a <strong>NEW employment engagement row</strong>, preserving historical terminated engagement intact.
          </p>

          <form onSubmit={handleRehireSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Rehire Start Date</label>
              <input
                id="rehire-date-input"
                type="date"
                value={rehireDate}
                onChange={(e) => setRehireDate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>New Annual Compensation (₹)</label>
              <input
                id="rehire-comp-input"
                type="number"
                value={rehireComp}
                onChange={(e) => setRehireComp(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', fontFamily: 'monospace' }}
              />
            </div>

            <button
              type="submit"
              id="submit-rehire-btn"
              style={{ background: '#059669', color: '#FFFFFF', padding: '10px 16px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
            >
              Execute Rehire (Create New Engagement) →
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
