import { ShieldAlert, AlertTriangle, CheckCircle, ArrowRight, HelpCircle } from 'lucide-react';

interface WorkforceIntegrityProps {
  onOpenEvidence: (title: string, details: any) => void;
}

export const WorkforceIntegrity: React.FC<WorkforceIntegrityProps> = ({ onOpenEvidence }) => {
  const anomalies = [
    {
      id: 'AN-001',
      personName: 'Rahul Bose',
      severity: 'severe',
      ruleId: 'GHOST_ACCESS_TERMINATED',
      domain: 'ACCESS',
      title: 'Employment ended May 15 • System access remains ACTIVE',
      daysInconsistent: 71,
      potentialExposure: 'Corporate Finance & SSO Systems',
      explanation: 'Rahul Bose employment was terminated on May 15, 2026, but system user credentials are still ACTIVE. Per offboarding policy, access should be revoked immediately.',
      actionPreview: 'SET users.is_active = false WHERE person_id = Rahul Bose',
    },
    {
      id: 'AN-002',
      personName: 'Ananya Rao',
      severity: 'severe',
      ruleId: 'GHOST_ACCESS_TERMINATED',
      domain: 'ACCESS',
      title: 'Contract terminated June 30 • System access remains ACTIVE',
      daysInconsistent: 25,
      potentialExposure: 'Engineering Repos & AWS Cloud Infrastructure',
      explanation: 'Ananya Rao contract ended on June 30, 2026. Credentials remain active in system catalog.',
      actionPreview: 'SET users.is_active = false WHERE person_id = Ananya Rao',
    },
    {
      id: 'AN-003',
      personName: 'Vikram Shetty',
      severity: 'watch',
      ruleId: 'UNPAID_WORK_ACTIVE_ENGAGEMENT',
      domain: 'PAYROLL',
      title: 'Actively engaged • Payroll status INACTIVE (Bank details flagged)',
      daysInconsistent: 15,
      potentialExposure: 'Compliance & Wage Disbursement Violations',
      explanation: 'Vikram Shetty is actively engaged (Senior Analyst), but payroll disbursement is paused due to flagged bank account details.',
      actionPreview: 'SET payroll_records.is_active = true WHERE engagement_id = Vikram Shetty',
    },
  ];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto' }}>
      {/* Integrity Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '20px', fontWeight: 700, color: '#14171F', margin: 0 }}>
              Workforce Integrity — Organizational Observability
            </h2>
            <span style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '800' }}>
              STATIC_COMPLETE / DYNAMIC_PENDING (DEMO VISUALIZATION)
            </span>
          </div>
          <p style={{ fontSize: '12.5px', color: '#6B7280', marginTop: '4px' }}>
            Continuous invariant monitoring scanning for broken organizational truths across Identity, Access, and Payroll.
          </p>
        </div>
        <button
          onClick={() =>
            onOpenEvidence('Workforce Integrity Invariant Evaluation', {
              active_anomalies: anomalies.length,
              domains_scanned: ['IDENTITY', 'ACCESS', 'PAYROLL', 'COMPLIANCE'],
            })
          }
          style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#374151' }}
        >
          <HelpCircle size={14} color="#0E7C7B" /> Why am I seeing this?
        </button>
      </div>

      {/* Observability Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E4E0', borderRadius: '14px', padding: '16px 20px' }}>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: '28px', fontWeight: 700, color: '#14171F' }}>6</div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>Total Monitored Workforce Records</div>
        </div>
        <div style={{ background: '#FFFFFF', border: '1.5px solid #B23A48', borderRadius: '14px', padding: '16px 20px' }}>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: '28px', fontWeight: 700, color: '#B23A48' }}>2</div>
          <div style={{ fontSize: '12px', color: '#B23A48', fontWeight: 600, marginTop: '2px' }}>Severe Broken Truths (Immediate Risk)</div>
        </div>
        <div style={{ background: '#FFFFFF', border: '1.5px solid #C77D02', borderRadius: '14px', padding: '16px 20px' }}>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: '28px', fontWeight: 700, color: '#C77D02' }}>1</div>
          <div style={{ fontSize: '12px', color: '#C77D02', fontWeight: 600, marginTop: '2px' }}>Watch Item (Worth Reviewing)</div>
        </div>
      </div>

      {/* Inconsistent Organizational Truths Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B7280' }}>
          Active Broken Organizational Truths
        </div>

        {anomalies.map((an) => (
          <div
            key={an.id}
            style={{
              background: '#FFFFFF',
              border: `1.5px solid ${an.severity === 'severe' ? '#B23A48' : '#C77D02'}`,
              borderRadius: '14px',
              padding: '18px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {an.severity === 'severe' ? <ShieldAlert size={20} color="#B23A48" /> : <AlertTriangle size={20} color="#C77D02" />}
                <span style={{ fontFamily: 'Space Grotesk', fontSize: '16px', fontWeight: 700, color: '#14171F' }}>
                  {an.personName}
                </span>
                <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', background: an.severity === 'severe' ? '#FBEAEC' : '#FEF6E7', color: an.severity === 'severe' ? '#B23A48' : '#C77D02', fontWeight: 700 }}>
                  {an.domain} INCONSISTENCY
                </span>
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 600, color: '#B23A48', background: '#FBEAEC', padding: '4px 10px', borderRadius: '6px' }}>
                {an.daysInconsistent} DAYS INCONSISTENT
              </div>
            </div>

            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937' }}>
              {an.title}
            </div>

            <div style={{ fontSize: '12.5px', color: '#4B5563', background: '#F9FAFB', padding: '10px 14px', borderRadius: '8px', borderLeft: `3px solid ${an.severity === 'severe' ? '#B23A48' : '#C77D02'}` }}>
              <strong>Diagnosis:</strong> {an.explanation}<br />
              <strong>Potential Exposure:</strong> {an.potentialExposure}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', paddingTop: '10px', borderTop: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: '11px', fontFamily: 'IBM Plex Mono, monospace', color: '#6B7280' }}>
                Remediation Preview: {an.actionPreview}
              </div>
              <button
                onClick={() =>
                  onOpenEvidence(`7-Step Resolution Governance: ${an.personName}`, {
                    anomaly_id: an.id,
                    rule: an.ruleId,
                    remediation: an.actionPreview,
                    governance_steps: ['Detect', 'Explain', 'Recommend', 'Preview', 'Authorize', 'Execute', 'Audit'],
                  })
                }
                style={{ background: '#14171F', color: '#FFF', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                Investigate & Resolve Governance →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
