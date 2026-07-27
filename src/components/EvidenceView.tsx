import React from 'react';
import { FileText, ShieldCheck, Clock, User, CheckCircle2 } from 'lucide-react';

interface EvidenceViewProps {
  person: any;
  modalDetails?: any;
}

export const EvidenceView: React.FC<EvidenceViewProps> = ({ person, modalDetails }) => {
  const events = [
    {
      id: 'EVT-108',
      action: 'RETROACTIVE_CORRECTION',
      actor: 'HR Admin (krishna.chakri@volks.com)',
      validFrom: '2026-02-01',
      validTo: '2026-05-31',
      systemFrom: '2026-07-25 21:04:47.153Z',
      narrative: `${person.name} retroactive market adjustment applied for period starting Feb 1, 2026. Compensation updated to ₹8,50,000.`,
      diff: { valid_from: '2026-02-01', valid_to: '2026-05-31', compensation: 850000, reason: 'Retroactive Market Adjustment' },
    },
    {
      id: 'EVT-102',
      action: 'PROMOTE',
      actor: 'Ananya Rao (Engineering Manager)',
      validFrom: '2026-06-01',
      validTo: 'INFINITY',
      systemFrom: '2026-06-01 09:00:00.000Z',
      narrative: `${person.name} promoted to Software Engineer with compensation adjustment to ₹11,00,000.`,
      diff: { title: 'Software Engineer', compensation: 1100000, reason: 'Annual Performance Promotion' },
    },
    {
      id: 'EVT-089',
      action: 'CONVERT',
      actor: 'HR Admin (krishna.chakri@volks.com)',
      validFrom: '2026-02-01',
      validTo: '2026-05-31',
      systemFrom: '2026-02-01 10:15:00.000Z',
      narrative: `${person.name} converted from Intern to On-Roll (Associate Software Engineer). Engagement ID linked via converted_from_id.`,
      diff: { from_type: 'INTERN', to_type: 'ON_ROLL', start_date: '2026-02-01' },
    },
  ];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto' }}>
      {/* Evidence Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '20px', fontWeight: 700, color: '#14171F' }}>
            Evidence Trail — Attributable Historical Proof
          </h2>
          <p style={{ fontSize: '12.5px', color: '#6B7280', marginTop: '2px' }}>
            Answers "Why am I seeing this?" — Complete lineage of valid dates, system timestamps, actors, policies, and JSON diffs.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#E4F3F2', padding: '6px 12px', borderRadius: '20px', color: '#0E7C7B', fontSize: '12px', fontWeight: 600 }}>
          <ShieldCheck size={14} /> 100% Attributable Audit Proof
        </div>
      </div>

      {modalDetails && (
        <div style={{ background: '#F0EEFB', border: '1.5px solid #7C6FD6', borderRadius: '12px', padding: '16px 20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#7C6FD6', marginBottom: '6px' }}>
            Contextual Evidence Query: {modalDetails.title || 'Derived Truth Breakdown'}
          </div>
          <pre style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11.5px', color: '#374151', background: '#FFF', padding: '10px', borderRadius: '8px', overflowX: 'auto' }}>
            {JSON.stringify(modalDetails, null, 2)}
          </pre>
        </div>
      )}

      {/* Audit Event Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B7280' }}>
          Narrated Historical Event Log for {person.name}
        </div>

        {events.map((evt) => (
          <div
            key={evt.id}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E4E0',
              borderRadius: '14px',
              padding: '18px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={18} color="#0E7C7B" />
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 700, color: '#14171F' }}>
                  [{evt.id}]
                </span>
                <span style={{ fontSize: '11.5px', padding: '3px 10px', borderRadius: '12px', background: '#E4F3F2', color: '#0E7C7B', fontWeight: 700 }}>
                  {evt.action}
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={13} /> {evt.actor}
              </div>
            </div>

            <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#1F2937' }}>
              {evt.narrative}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#F9FAFB', padding: '10px 14px', borderRadius: '8px', fontSize: '11.5px', fontFamily: 'IBM Plex Mono, monospace' }}>
              <div>
                <span style={{ color: '#6B7280' }}>Valid Time Span:</span> <strong style={{ color: '#0E7C7B' }}>{evt.validFrom} → {evt.validTo}</strong>
              </div>
              <div>
                <span style={{ color: '#6B7280' }}>System Timestamp:</span> <strong style={{ color: '#7C6FD6' }}>{evt.systemFrom}</strong>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', marginTop: '4px' }}>
              Structural Mutation Diff (JSONB):
            </div>
            <pre style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', background: '#14171F', color: '#10B981', padding: '10px 14px', borderRadius: '8px', overflowX: 'auto' }}>
              {JSON.stringify(evt.diff, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
};
