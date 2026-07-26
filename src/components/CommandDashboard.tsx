import React from 'react';
import { ArrowRight, ShieldAlert, Clock, Calendar, CheckCircle2, ChevronRight } from 'lucide-react';

interface CommandDashboardProps {
  onNavigate: (tab: string) => void;
  onOpenEvidence: (title: string, details: any) => void;
}

export const CommandDashboard: React.FC<CommandDashboardProps> = ({ onNavigate, onOpenEvidence }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '48px 64px', gap: '48px', maxWidth: '1200px', margin: '0 auto', width: '100%', background: '#F8FAFC', minHeight: '100%' }}>
      {/* Lead with Decision Headline & Enlarged Whitespace */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '32px' }}>
        <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', letterSpacing: '1.2px', textTransform: 'uppercase' }}>
          WORKFORCE OPERATING SYSTEM
        </span>
        <h1 style={{ margin: 0, fontSize: '38px', fontWeight: '800', color: '#0F172A', letterSpacing: '-1px' }}>
          2 workforce truths need attention.
        </h1>
        <p style={{ margin: 0, fontSize: '16px', color: '#475569', fontWeight: '500' }}>
          1 critical credential contradiction • 1 promotion workflow awaiting policy decision
        </p>
      </div>

      {/* Decision Surface 1: Access Contradiction Divergence Rail */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3', padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '800' }}>
              CRITICAL DIVERGENCE
            </span>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>Rahul Bose — Access Credential Breach</h3>
          </div>
          <button
            onClick={() => onNavigate('integrity')}
            style={{ background: '#E11D48', color: '#FFFFFF', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(225,29,72,0.2)' }}
          >
            Investigate Breach <ChevronRight size={16} />
          </button>
        </div>

        {/* TRUTH DIVERGENCE RAIL */}
        <div style={{ background: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#64748B' }}>TRUTH</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>Active</span>
              <div style={{ flex: 1, height: '3px', background: '#0F172A', position: 'relative' }}>
                <div style={{ position: 'absolute', right: '0', top: '-4px', width: '10px', height: '10px', borderRadius: '50%', background: '#E11D48' }} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#E11D48' }}>TERMINATED (May 15)</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#64748B' }}>ACCESS</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, height: '3px', background: '#E11D48', borderStyle: 'dashed' }} />
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#E11D48', background: '#FFF1F2', padding: '4px 10px', borderRadius: '6px' }}>
                ACTIVE TODAY (71 DAYS DIVERGENT)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Decision Surface 2: Promotion Future Rail */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ background: '#EEF2FF', color: '#3730A3', border: '1px solid #C7D2FE', padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '800' }}>
              PROPOSED FUTURE STATE
            </span>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>Krishna Chakri N — Promotion Proposal</h3>
          </div>
          <button
            onClick={() => onNavigate('admin')}
            style={{ background: '#4F46E5', color: '#FFFFFF', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(79,70,229,0.2)' }}
          >
            Review Policy Graph <ChevronRight size={16} />
          </button>
        </div>

        {/* FUTURE RAIL */}
        <div style={{ background: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#64748B' }}>CURRENT</span>
            <div style={{ fontSize: '14px', color: '#0F172A', fontWeight: '600' }}>
              Software Engineer • ₹850,000 / yr
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#4F46E5' }}>PROPOSED</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '14px', color: '#4F46E5', fontWeight: '800' }}>
                Senior Software Engineer • ₹1,100,000 / yr (+27%)
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '11px', fontWeight: '700' }}>
                <span style={{ color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: '4px' }}>Manager ✓</span>
                <span style={{ color: '#D97706', background: '#FFFBEB', padding: '2px 8px', borderRadius: '4px' }}>Dept Head ●</span>
                <span style={{ color: '#64748B', background: '#F1F5F9', padding: '2px 8px', borderRadius: '4px' }}>HR ○</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
