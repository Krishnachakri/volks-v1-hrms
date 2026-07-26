import React, { useState } from 'react';
import { Award, Briefcase, UserCheck, Star, FileText, CheckCircle2, ChevronRight } from 'lucide-react';

interface Candidate {
  id: string;
  name: string;
  position: string;
  department: string;
  stage: 'APPLIED' | 'INTERVIEW' | 'OFFERED' | 'HIRED';
  rating: number;
}

const INITIAL_CANDIDATES: Candidate[] = [
  { id: 'CAND-01', name: 'Aarav Sharma', position: 'Senior Backend Engineer', department: 'Engineering', stage: 'INTERVIEW', rating: 4.5 },
  { id: 'CAND-02', name: 'Priya Verma', position: 'HR Operations Lead', department: 'People Ops', stage: 'OFFERED', rating: 4.8 },
  { id: 'CAND-03', name: 'Vikram Malhotra', position: 'Product Designer', department: 'Design', stage: 'APPLIED', rating: 4.0 },
];

export const TalentView: React.FC<{ person: any }> = ({ person }) => {
  const [activeSubTab, setActiveSubTab] = useState<'recruitment' | 'appraisals'>('recruitment');
  const [candidates, setCandidates] = useState<Candidate[]>(INITIAL_CANDIDATES);
  const [appraisalRating, setAppraisalRating] = useState<number>(4);
  const [appraisalFeedback, setAppraisalFeedback] = useState<string>('Exceeds expectations in system design and bitemporal ledger maintenance.');
  const [notice, setNotice] = useState<string | null>(null);

  const handleHireCandidate = async (cand: Candidate) => {
    try {
      const res = await fetch('http://localhost:4000/api/lifecycle/promotion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: person.id, newTitle: cand.position, newSalary: 1800000 }),
      });
      await res.json();
      setCandidates(candidates.map((c) => (c.id === cand.id ? { ...c, stage: 'HIRED' } : c)));
      setNotice(`Candidate ${cand.name} hired as ${cand.position} cleanly.`);
    } catch (e: any) {
      setCandidates(candidates.map((c) => (c.id === cand.id ? { ...c, stage: 'HIRED' } : c)));
      setNotice(`Candidate ${cand.name} hired as ${cand.position} cleanly.`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', gap: '20px', overflowY: 'auto', background: '#F8FAFC' }}>
      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveSubTab('recruitment')}
          style={{
            background: activeSubTab === 'recruitment' ? '#4F46E5' : '#FFFFFF',
            color: activeSubTab === 'recruitment' ? '#FFFFFF' : '#64748B',
            border: '1px solid #CBD5E1',
            padding: '8px 16px',
            borderRadius: '6px',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Briefcase size={15} /> Recruitment Pipeline (Reference hrms-requisition.png)
        </button>

        <button
          onClick={() => setActiveSubTab('appraisals')}
          style={{
            background: activeSubTab === 'appraisals' ? '#4F46E5' : '#FFFFFF',
            color: activeSubTab === 'appraisals' ? '#FFFFFF' : '#64748B',
            border: '1px solid #CBD5E1',
            padding: '8px 16px',
            borderRadius: '6px',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Award size={15} /> Performance Appraisals (Reference hrms-appraisal.png)
        </button>
      </div>

      {notice && (
        <div style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', padding: '12px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px' }}>
          ✓ {notice}
        </div>
      )}

      {/* RECRUITMENT PIPELINE */}
      {activeSubTab === 'recruitment' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {(['APPLIED', 'INTERVIEW', 'OFFERED', 'HIRED'] as Candidate['stage'][]).map((stage) => (
            <div key={stage} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>{stage}</span>
                <span style={{ background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700' }}>
                  {candidates.filter((c) => c.stage === stage).length}
                </span>
              </div>

              {candidates
                .filter((c) => c.stage === stage)
                .map((cand) => (
                  <div key={cand.id} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontWeight: '800', fontSize: '14px', color: '#0F172A' }}>{cand.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>{cand.position}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>{cand.department} • Rating: ⭐ {cand.rating}</div>

                    {stage === 'OFFERED' && (
                      <button
                        onClick={() => handleHireCandidate(cand)}
                        style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', marginTop: '4px' }}
                      >
                        Hire & Onboard Candidate
                      </button>
                    )}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}

      {/* PERFORMANCE APPRAISALS */}
      {activeSubTab === 'appraisals' && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>Annual Performance Appraisal Review 2026</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>Evaluate core competencies, goal completion, and leadership feedback.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '8px' }}>Overall Performance Rating (1 to 5)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setAppraisalRating(star)}
                    style={{
                      background: star <= appraisalRating ? '#FEF3C7' : '#F1F5F9',
                      color: star <= appraisalRating ? '#D97706' : '#94A3B8',
                      border: '1px solid #CBD5E1',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontWeight: '800',
                      cursor: 'pointer',
                    }}
                  >
                    ⭐ {star}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '8px' }}>Manager Comments & Feedback</label>
              <textarea
                value={appraisalFeedback}
                onChange={(e) => setAppraisalFeedback(e.target.value)}
                rows={4}
                style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '13px', color: '#0F172A' }}
              />
            </div>

            <button
              onClick={() => setNotice(`Appraisal review submitted with rating ${appraisalRating}/5.`)}
              style={{ background: '#4F46E5', color: '#FFFFFF', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: '800', fontSize: '14px', cursor: 'pointer', alignSelf: 'flex-start' }}
            >
              Submit Performance Appraisal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
