import React, { useState } from 'react';
import { Clock, HelpCircle, AlertCircle, ArrowUpRight, CheckCircle2 } from 'lucide-react';

interface InvestigationViewProps {
  person: any;
  onOpenEvidence: (title: string, details: any) => void;
}

export const InvestigationView: React.FC<InvestigationViewProps> = ({ person = {}, onOpenEvidence }) => {
  const minDate = '2025-01-01';
  const maxDate = '2026-07-25';

  const [validDate, setValidDate] = useState<string>('2026-07-25');
  const [knownDate, setKnownDate] = useState<string>('2026-07-25');

  const personName = person?.name || person?.full_name || 'Krishna Chakri N';
  const currentSalary = person?.salary || person?.currentComp || 2400000;

  const isRetroactiveDivergence =
    personName === 'Krishna Chakri N' &&
    validDate >= '2026-02-01' &&
    validDate <= '2026-05-31' &&
    knownDate < '2026-06-01';

  const realityComp = isRetroactiveDivergence ? 850000 : currentSalary;
  const knownComp = isRetroactiveDivergence ? 800000 : currentSalary;

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '20px', fontWeight: 700, color: '#14171F' }}>
            Dual-Axis Time Machine — Investigation
          </h2>
          <p style={{ fontSize: '12.5px', color: '#6B7280', marginTop: '2px' }}>
            Investigate real-world workforce truth (<span style={{ color: '#0E7C7B', fontWeight: 600 }}>Reality</span>) vs historical system audit belief (<span style={{ color: '#7C6FD6', fontWeight: 600 }}>Knowledge</span>).
          </p>
        </div>
      </div>

      {/* Dual Axis Controls */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#0E7C7B', display: 'block', marginBottom: '6px' }}>
              AXIS 1: REALITY DATE (Valid-Time: {validDate})
            </label>
            <input
              type="range"
              min="1"
              max="31"
              value={parseInt(validDate.split('-')[2] || '25')}
              onChange={(e) => setValidDate(`2026-07-${e.target.value.padStart(2, '0')}`)}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#7C6FD6', display: 'block', marginBottom: '6px' }}>
              AXIS 2: SYSTEM AUDIT BELIEF (Transaction-Time: {knownDate})
            </label>
            <input
              type="range"
              min="1"
              max="31"
              value={parseInt(knownDate.split('-')[2] || '25')}
              onChange={(e) => setKnownDate(`2026-07-${e.target.value.padStart(2, '0')}`)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* State Metrics Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid #F3F4F6', paddingTop: '16px' }}>
          <div style={{ background: '#F4FBFB', border: '1px solid #BCEBEB', borderRadius: '8px', padding: '14px' }}>
            <span style={{ fontSize: '11px', color: '#0E7C7B', fontWeight: 700 }}>REAL-WORLD COMP (VALID-TIME)</span>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E7C7B', marginTop: '4px' }}>₹{realityComp.toLocaleString('en-IN')}</div>
          </div>

          <div style={{ background: '#F8F7FC', border: '1px solid #DDD9F7', borderRadius: '8px', padding: '14px' }}>
            <span style={{ fontSize: '11px', color: '#7C6FD6', fontWeight: 700 }}>SYSTEM AUDIT RECORD (TX-TIME)</span>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#7C6FD6', marginTop: '4px' }}>₹{knownComp.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
