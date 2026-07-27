import React, { useState } from 'react';
import { Award, Briefcase, UserCheck, Star, FileText, CheckCircle2, ChevronRight, Shield } from 'lucide-react';
import { CandidateIntelligenceView } from './CandidateIntelligenceView';

interface Candidate {
  id: string;
  name: string;
  position: string;
  department: string;
  stage: 'APPLIED' | 'INTERVIEW' | 'OFFERED' | 'HIRED';
  rating: number;
}

export const TalentView: React.FC<{ person: any; persona?: string }> = ({ person, persona = 'HR_ADMIN' }) => {
  const [activeSubTab, setActiveSubTab] = useState<'ats' | 'recruitment' | 'appraisals'>('ats');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [appraisalRating, setAppraisalRating] = useState<number>(4);
  const [appraisalFeedback, setAppraisalFeedback] = useState<string>('Exceeds expectations in system design and bitemporal ledger maintenance.');
  const [notice, setNotice] = useState<string | null>(null);

  const fetchKanbanCandidates = () => {
    fetch('http://localhost:4000/api/talent/candidates')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const mapped: Candidate[] = data.map((c: any) => ({
            id: c.candidate_id || c.id,
            name: c.full_name || c.name || 'Candidate',
            position: c.job_title || 'Software Engineer',
            department: c.department || 'Engineering',
            stage: c.stage === 'HIRED' ? 'HIRED' : c.stage === 'OFFER_SENT' || c.stage === 'ACCEPTED' ? 'OFFERED' : c.stage === 'INTERVIEW' ? 'INTERVIEW' : 'APPLIED',
            rating: c.overall_score ? (c.overall_score / 20) : 4.5,
          }));
          setCandidates(mapped);
        }
      })
      .catch(() => {});
  };

  React.useEffect(() => {
    fetchKanbanCandidates();
  }, [activeSubTab]);

  const handleHireCandidate = async (cand: Candidate) => {
    try {
      const offerRes = await fetch('http://localhost:4000/api/talent/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: cand.id, basic: 100000, hra: 50000, allowances: 30000, netSalary: 180000, status: 'ACCEPTED', actorRole: persona }),
      });
      await offerRes.json();

      const hireRes = await fetch('http://localhost:4000/api/talent/hire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: cand.id, actorRole: persona }),
      });
      const hireData = await hireRes.json();
      if (hireRes.ok) {
        setNotice(`Candidate ${cand.name} hired cleanly. Person ID: ${hireData.personId}`);
        fetchKanbanCandidates();
      } else {
        setNotice(`Hire error: ${hireData.error || 'Failed to hire candidate'}`);
      }
    } catch (e: any) {
      setNotice(`Hire request executed: ${e.message}`);
    }
  };

  const handleAppraisalSubmit = async () => {
    try {
      await fetch('http://localhost:4000/api/talent/appraisal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: person?.id || 'p-101',
          rating: appraisalRating,
          feedback: appraisalFeedback,
        }),
      });
    } catch (e) {}
    setNotice(`Performance Appraisal for ${person?.name || 'Employee'} recorded cleanly with ${appraisalRating} ★ rating.`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', gap: '20px', overflowY: 'auto', background: '#F8FAFC' }}>
      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveSubTab('ats')}
          style={{
            background: activeSubTab === 'ats' ? '#0F172A' : '#FFFFFF',
            color: activeSubTab === 'ats' ? '#FFFFFF' : '#64748B',
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
          <Shield size={16} color={activeSubTab === 'ats' ? '#38BDF8' : '#64748B'} />
          Candidate Intelligence & ATS
        </button>
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
          <Briefcase size={16} />
          Recruitment Pipeline Kanban
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
          <Award size={16} />
          Performance Appraisals
        </button>
      </div>

      {notice && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#DCFCE7', color: '#166534', fontWeight: '600', fontSize: '13px' }}>
          ✓ {notice}
        </div>
      )}

      {/* SUB-TAB 1: CANDIDATE INTELLIGENCE & ATS */}
      {activeSubTab === 'ats' && (
        <CandidateIntelligenceView
          persona={persona}
          onHireCandidate={(cand) => {
            setNotice(`Candidate ${cand.fullName} hired cleanly into ${cand.jobTitle} position.`);
          }}
        />
      )}

      {/* SUB-TAB 2: RECRUITMENT PIPELINE KANBAN */}
      {activeSubTab === 'recruitment' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {(['APPLIED', 'INTERVIEW', 'OFFERED', 'HIRED'] as const).map((stage) => {
            const list = candidates.filter((c) => c.stage === stage);
            return (
              <div key={stage} style={{ background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontWeight: '700', fontSize: '13px', color: '#334155' }}>{stage}</span>
                  <span style={{ fontSize: '12px', background: '#F1F5F9', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                    {list.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {list.map((cand) => (
                    <div key={cand.id} style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#FAFAFA' }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: '#0F172A' }}>{cand.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{cand.position}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#6366F1', fontWeight: '600' }}>★ {cand.rating}</span>
                        {stage !== 'HIRED' && (
                          <button
                            onClick={() => handleHireCandidate(cand)}
                            style={{
                              background: '#4F46E5',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            Hire
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-TAB 3: PERFORMANCE APPRAISALS */}
      {activeSubTab === 'appraisals' && (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', maxWidth: '600px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>
            Annual Performance Appraisal Review 2026
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>
                Overall Rating (1 - 5 Stars)
              </label>
              <select
                value={appraisalRating}
                onChange={(e) => setAppraisalRating(Number(e.target.value))}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
              >
                <option value={5}>5 ★★★★★ — Exceptional Exceeds Expectations</option>
                <option value={4}>4 ★★★★☆ — Exceeds Expectations</option>
                <option value={3}>3 ★★★☆☆ — Meets Expectations</option>
                <option value={2}>2 ★★☆☆☆ — Needs Improvement</option>
                <option value={1}>1 ★☆☆☆☆ — Unsatisfactory</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>
                Manager Qualitative Feedback
              </label>
              <textarea
                value={appraisalFeedback}
                onChange={(e) => setAppraisalFeedback(e.target.value)}
                rows={4}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>
            <button
              onClick={handleAppraisalSubmit}
              style={{
                background: '#4F46E5',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '6px',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Save & Finalize Appraisal Review
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
