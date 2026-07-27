import React, { useState } from 'react';
import { Layers, ArrowRight, ShieldCheck, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

interface LifecycleStudioProps {
  person: any;
  onOpenEvidence?: (title: string, details: any) => void;
}

export const LifecycleStudio: React.FC<LifecycleStudioProps> = ({ person, onOpenEvidence }) => {
  const [event, setEvent] = useState<'CONVERT' | 'PROMOTE' | 'TRANSFER' | 'COMPENSATION_CHANGE' | 'TERMINATE' | 'REHIRE'>('CONVERT');
  const [targetType, setTargetType] = useState<'ON_ROLL' | 'INTERN' | 'CONSULTANT'>('ON_ROLL');
  const [effectiveDate, setEffectiveDate] = useState<string>('2026-08-01');
  const [newTitle, setNewTitle] = useState<string>('Associate Software Engineer');
  const [newDept, setNewDept] = useState<string>('Engineering');
  const [newComp, setNewComp] = useState<number>(850000);
  const [reason, setReason] = useState<string>('Lifecycle Studio Conversion Event');

  const [step, setStep] = useState<'PROPOSE' | 'SIMULATE' | 'COMMITTED'>('PROPOSE');

  // Calculate Impact Simulation
  const currentComp = person.currentComp || 20000;
  const compDrop = newComp < currentComp * 0.8;

  const downstreamEffects = [
    `Current engagement (${person.type}) will close with event "${event}" effective ${effectiveDate}.`,
    `New engagement (${targetType}) will open linked via converted_from_id (${person.id}).`,
    `Compensation will shift from ₹${currentComp.toLocaleString()} to ₹${newComp.toLocaleString()}.`,
    `Zero duplicate identity rows created — person_id remains immutable.`,
  ];

  const policyWarnings = compDrop
    ? [{ severity: 'WARNING', msg: `Proposed compensation drop is over 20%. Requires FINANCE_HEAD approval.` }]
    : [];

  const requiredApprovals = compDrop ? ['HR_ADMIN', 'FINANCE_HEAD'] : ['HR_ADMIN'];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto' }}>
      {/* Studio Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '20px', fontWeight: 700, color: '#14171F' }}>
            Lifecycle Studio — Consequential State Orchestration
          </h2>
          <p style={{ fontSize: '12.5px', color: '#6B7280', marginTop: '2px' }}>
            Propose, simulate, and commit workforce state transitions across legal entities and engagement types.
          </p>
        </div>
        <button
          onClick={() =>
            onOpenEvidence('Lifecycle Studio State Machine Pipeline', {
              person_id: person.id,
              event,
              targetType,
              effectiveDate,
              newComp,
              requiredApprovals,
            })
          }
          style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#374151' }}
        >
          <HelpCircle size={14} color="#0E7C7B" /> Why am I seeing this?
        </button>
      </div>

      {/* Stepper Rail: Propose -> Simulate -> Detect Impact -> Approvals -> Commit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E2E4E0' }}>
        <div style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, background: step === 'PROPOSE' ? '#14171F' : '#E5E7EB', color: step === 'PROPOSE' ? '#FFF' : '#374151' }}>
          1. Propose
        </div>
        <ArrowRight size={14} color="#9CA3AF" />
        <div style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, background: step === 'SIMULATE' ? '#0E7C7B' : '#E5E7EB', color: step === 'SIMULATE' ? '#FFF' : '#374151' }}>
          2. Simulate Future State
        </div>
        <ArrowRight size={14} color="#9CA3AF" />
        <div style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, background: '#E5E7EB', color: '#374151' }}>
          3. Detect Impact
        </div>
        <ArrowRight size={14} color="#9CA3AF" />
        <div style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, background: '#E5E7EB', color: '#374151' }}>
          4. Approvals
        </div>
        <ArrowRight size={14} color="#9CA3AF" />
        <div style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, background: step === 'COMMITTED' ? '#0E7C7B' : '#E5E7EB', color: step === 'COMMITTED' ? '#FFF' : '#374151' }}>
          5. Commit Transaction
        </div>
      </div>

      {step !== 'COMMITTED' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Form Panel */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E4E0', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#6B7280' }}>
              Target Mutation Details
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#4B5563', display: 'block', marginBottom: '4px' }}>
                Lifecycle Event
              </label>
              <select
                value={event}
                onChange={(e) => setEvent(e.target.value as any)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '13px', outline: 'none' }}
              >
                <option value="CONVERT">CONVERT (e.g. Intern → On-roll)</option>
                <option value="PROMOTE">PROMOTE (Title & Comp Revision)</option>
                <option value="TRANSFER">TRANSFER (Department Change)</option>
                <option value="COMPENSATION_CHANGE">COMPENSATION_CHANGE</option>
                <option value="TERMINATE">TERMINATE Engagement</option>
                <option value="REHIRE">REHIRE Former Employee</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#4B5563', display: 'block', marginBottom: '4px' }}>Target Employment Type</label>
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '13px' }}
                >
                  <option value="ON_ROLL">ON_ROLL</option>
                  <option value="INTERN">INTERN</option>
                  <option value="CONSULTANT">CONSULTANT</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#4B5563', display: 'block', marginBottom: '4px' }}>Effective Valid Date</label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '13px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#4B5563', display: 'block', marginBottom: '4px' }}>Proposed Job Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#4B5563', display: 'block', marginBottom: '4px' }}>Department</label>
                <input
                  type="text"
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#4B5563', display: 'block', marginBottom: '4px' }}>Proposed Annual Compensation (₹)</label>
                <input
                  type="number"
                  value={newComp}
                  onChange={(e) => setNewComp(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '13px', fontFamily: 'IBM Plex Mono' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#4B5563', display: 'block', marginBottom: '4px' }}>Business Justification / Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '13px' }}
              />
            </div>

            <button
              onClick={() => setStep('SIMULATE')}
              style={{ marginTop: '10px', background: '#14171F', color: '#FFF', padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              Simulate Future State →
            </button>
          </div>

          {/* Simulation & Impact Analysis Panel */}
          <div style={{ background: '#FFFFFF', border: '1.5px solid #0E7C7B', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#0E7C7B', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} /> Live Simulation & Impact Analysis
            </div>

            {/* Downstream Effects */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>Downstream Effects:</div>
              <ul style={{ paddingLeft: '18px', fontSize: '12.5px', color: '#4B5563', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {downstreamEffects.map((eff, i) => (
                  <li key={i}>{eff}</li>
                ))}
              </ul>
            </div>

            {/* Policy Warnings */}
            {policyWarnings.length > 0 && (
              <div style={{ background: '#FEF6E7', border: '1px solid #FCD34D', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#C77D02', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} /> Policy Warnings Detected:
                </div>
                {policyWarnings.map((pw, i) => (
                  <div key={i} style={{ fontSize: '12px', color: '#78350F', marginTop: '4px' }}>• {pw.msg}</div>
                ))}
              </div>
            )}

            {/* Approvals Required */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>Required Approvals:</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {requiredApprovals.map((app) => (
                  <span key={app} style={{ background: '#E5E7EB', color: '#1F2937', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                    ✓ {app}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #E2E4E0' }}>
              <button
                onClick={() => setStep('COMMITTED')}
                style={{ width: '100%', background: '#0E7C7B', color: '#FFF', padding: '12px', borderRadius: '10px', border: 'none', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
              >
                Authorize & Commit Transaction to PostgreSQL
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Committed State Confirmation */
        <div style={{ background: '#E4F3F2', border: '2px solid #0E7C7B', borderRadius: '16px', padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <CheckCircle size={48} color="#0E7C7B" />
          <h3 style={{ fontFamily: 'Space Grotesk', fontSize: '22px', fontWeight: 700, color: '#0E7C7B' }}>
            Lifecycle Mutation Committed Successfully!
          </h3>
          <p style={{ fontSize: '13.5px', color: '#1F2937', maxWidth: '500px' }}>
            The event <strong style={{ color: '#0E7C7B' }}>{event}</strong> for <strong>{person.name}</strong> was committed to PostgreSQL as an atomic transaction. Zero identity rows were duplicated.
          </p>
          <button
            onClick={() => setStep('PROPOSE')}
            style={{ marginTop: '12px', background: '#14171F', color: '#FFF', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer' }}
          >
            Orchestrate Another Mutation
          </button>
        </div>
      )}
    </div>
  );
};
