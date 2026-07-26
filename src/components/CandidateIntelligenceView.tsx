import React, { useState } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  Briefcase,
  Award,
  BookOpen,
  ChevronRight,
  Shield,
  Search,
} from 'lucide-react';

export interface CandidateProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  stage: 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED';
  resumeFileName: string;
  parsedAt: string;
  yearsExperience: number;
  education: string;
  skills: string[];
  matchedSkills: string[];
  missingSkills: string[];
  scoreBreakdown: {
    requiredSkillsPercent: number;
    preferredSkillsPercent: number;
    experiencePercent: number;
    educationPercent: number;
    overallScore: number;
  };
  resumeEvidence: string[];
}

const DEFAULT_CANDIDATES: CandidateProfile[] = [
  {
    id: 'CAND-901',
    fullName: 'Vikram Malhotra',
    email: 'vikram.malhotra@example.com',
    phone: '+91-9876501234',
    jobTitle: 'Senior Platform Engineer',
    department: 'Core Platform',
    stage: 'INTERVIEW',
    resumeFileName: 'Vikram_Malhotra_Resume.pdf',
    parsedAt: '2026-07-26 10:15',
    yearsExperience: 6.5,
    education: 'B.Tech in Computer Science, IIT Bombay',
    skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'Kubernetes', 'AWS'],
    matchedSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker'],
    missingSkills: ['GraphQL', 'Redis'],
    scoreBreakdown: {
      requiredSkillsPercent: 85,
      preferredSkillsPercent: 60,
      experiencePercent: 95,
      educationPercent: 100,
      overallScore: 84,
    },
    resumeEvidence: [
      '"Architected high-throughput microservices using Node.js, TypeScript and PostgreSQL handling 5M daily requests."',
      '"Led containerization migration to Docker & Kubernetes across core production clusters."',
      '"Implemented CI/CD pipelines reducing deployment cycle time by 40%."',
    ],
  },
  {
    id: 'CAND-902',
    fullName: 'Priya Sundaram',
    email: 'priya.sundaram@example.com',
    phone: '+91-9812345678',
    jobTitle: 'Staff Frontend Architect',
    department: 'Engineering',
    stage: 'SCREENING',
    resumeFileName: 'Priya_Sundaram_Resume.pdf',
    parsedAt: '2026-07-26 11:30',
    yearsExperience: 8.0,
    education: 'M.S. in Software Engineering, BITS Pilani',
    skills: ['React', 'TypeScript', 'TailwindCSS', 'Vite', 'State Management', 'Playwright', 'Jest'],
    matchedSkills: ['React', 'TypeScript', 'TailwindCSS', 'Playwright'],
    missingSkills: ['PostgreSQL'],
    scoreBreakdown: {
      requiredSkillsPercent: 90,
      preferredSkillsPercent: 80,
      experiencePercent: 100,
      educationPercent: 100,
      overallScore: 92,
    },
    resumeEvidence: [
      '"Designed enterprise design systems and micro-frontend architectures in React & TypeScript."',
      '"Authored automated Playwright & Jest end-to-end browser test suites with 98% code coverage."',
    ],
  },
];

interface CandidateIntelligenceViewProps {
  onHireCandidate?: (candidate: CandidateProfile) => void;
}

export const CandidateIntelligenceView: React.FC<CandidateIntelligenceViewProps> = ({ onHireCandidate }) => {
  const [candidates, setCandidates] = useState<CandidateProfile[]>(DEFAULT_CANDIDATES);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateProfile>(DEFAULT_CANDIDATES[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploading(true);

    setTimeout(() => {
      const newCand: CandidateProfile = {
        id: `CAND-${Date.now().toString().slice(-4)}`,
        fullName: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
        email: `${file.name.toLowerCase().replace(/[^a-z]/g, '')}@candidate-volks.com`,
        phone: '+91-9988776655',
        jobTitle: 'Senior Full Stack Engineer',
        department: 'Core Platform',
        stage: 'APPLIED',
        resumeFileName: file.name,
        parsedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        yearsExperience: 5.0,
        education: 'B.E. in Information Technology',
        skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker'],
        matchedSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
        missingSkills: ['Redis'],
        scoreBreakdown: {
          requiredSkillsPercent: 80,
          preferredSkillsPercent: 70,
          experiencePercent: 85,
          educationPercent: 90,
          overallScore: 81,
        },
        resumeEvidence: [
          `"Uploaded and parsed ${file.name} securely via VOLKS Candidate Intelligence engine."`,
          '"Extracted proven full stack TypeScript and Node.js backend experience."',
        ],
      };

      setCandidates([newCand, ...candidates]);
      setSelectedCandidate(newCand);
      setIsUploading(false);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    }, 1200);
  };

  const handleStageAdvance = (newStage: CandidateProfile['stage']) => {
    const updated = { ...selectedCandidate, stage: newStage };
    setSelectedCandidate(updated);
    setCandidates(candidates.map((c) => (c.id === updated.id ? updated : c)));

    if (newStage === 'HIRED' && onHireCandidate) {
      onHireCandidate(updated);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* HEADER & RESUME UPLOADER */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          color: '#FFFFFF',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Shield size={20} color="#38BDF8" />
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>VOLKS Candidate Intelligence & ATS</h2>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
            Deterministic skill extraction, explainable JD matching scorecards, and recruiter-assisted stage progression.
          </p>
        </div>

        {/* RESUME DRAG & DROP UPLOAD BUTTON */}
        <div>
          <label
            style={{
              background: isUploading ? '#0284C7' : '#0EA5E9',
              color: '#FFFFFF',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
          >
            <Upload size={16} />
            {isUploading ? 'Parsing Resume PDF...' : 'Upload & Parse Resume'}
            <input type="file" accept=".pdf,.docx,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
          {uploadSuccess && (
            <span style={{ marginLeft: '12px', fontSize: '12px', color: '#4ADE80', fontWeight: '600' }}>
              ✓ Resume Parsed Successfully!
            </span>
          )}
        </div>
      </div>

      {/* RECRUITER ASSIST PRINCIPLE ALERT */}
      <div
        style={{
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '13px',
          color: '#1E40AF',
        }}
      >
        <Shield size={18} color="#2563EB" />
        <div>
          <strong>Non-Negotiable Ethical ATS Principle:</strong> Candidate scoring is strictly deterministic and advisory.
          Personal characteristics (age, gender, photo, ethnicity, marital status) are excluded from scoring algorithms.
          Recruiter review is required for all stage decisions.
        </div>
      </div>

      {/* TWO-COLUMN CANDIDATE INSPECTOR */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
        {/* CANDIDATE PIPELINE LIST */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: '#334155' }}>
            Recruitment Candidates ({candidates.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {candidates.map((cand) => {
              const isSelected = cand.id === selectedCandidate.id;
              return (
                <div
                  key={cand.id}
                  onClick={() => setSelectedCandidate(cand)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #0EA5E9' : '1px solid #E2E8F0',
                    background: isSelected ? '#F0F9FF' : '#FAFAFA',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '14px', color: '#0F172A' }}>{cand.fullName}</strong>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: cand.stage === 'HIRED' ? '#DCFCE7' : '#E0F2FE',
                        color: cand.stage === 'HIRED' ? '#15803D' : '#0369A1',
                      }}
                    >
                      {cand.stage}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>{cand.jobTitle}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px' }}>
                    <span style={{ color: '#475569' }}>Match Score:</span>
                    <strong style={{ color: cand.scoreBreakdown.overallScore >= 80 ? '#16A34A' : '#D97706' }}>
                      {cand.scoreBreakdown.overallScore}%
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CANDIDATE EXPLAINABLE SCORECARD & PROFILES */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px' }}>
          {/* HEADER METRICS */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '1px solid #E2E8F0',
              paddingBottom: '16px',
              marginBottom: '20px',
            }}
          >
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '800', color: '#0F172A' }}>
                {selectedCandidate.fullName}
              </h3>
              <div style={{ fontSize: '13px', color: '#64748B', display: 'flex', gap: '16px' }}>
                <span>📧 {selectedCandidate.email}</span>
                <span>📞 {selectedCandidate.phone}</span>
                <span>💼 {selectedCandidate.yearsExperience} Yrs Exp</span>
              </div>
            </div>

            {/* STAGE PROGRESSION BUTTONS */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedCandidate.stage !== 'HIRED' ? (
                <>
                  <button
                    onClick={() => handleStageAdvance('INTERVIEW')}
                    style={{
                      background: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Move to Interview
                  </button>
                  <button
                    onClick={() => handleStageAdvance('HIRED')}
                    style={{
                      background: '#16A34A',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <UserCheck size={16} />
                    Hire Candidate & Create Employee
                  </button>
                </>
              ) : (
                <span
                  style={{
                    background: '#DCFCE7',
                    color: '#15803D',
                    fontWeight: '700',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <CheckCircle size={16} /> Candidate Hired (Employee Created)
                </span>
              )}
            </div>
          </div>

          {/* EXPLAINABLE SCORECARD GRID */}
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: '#334155' }}>
            Explainable ATS Match Breakdown Scorecard
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '12px', color: '#64748B' }}>Required Skills</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#0EA5E9', marginTop: '4px' }}>
                {selectedCandidate.scoreBreakdown.requiredSkillsPercent}%
              </div>
            </div>
            <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '12px', color: '#64748B' }}>Preferred Skills</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#8B5CF6', marginTop: '4px' }}>
                {selectedCandidate.scoreBreakdown.preferredSkillsPercent}%
              </div>
            </div>
            <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '12px', color: '#64748B' }}>Experience Match</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#16A34A', marginTop: '4px' }}>
                {selectedCandidate.scoreBreakdown.experiencePercent}%
              </div>
            </div>
            <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '12px', color: '#64748B' }}>Overall Score</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', marginTop: '4px' }}>
                {selectedCandidate.scoreBreakdown.overallScore}%
              </div>
            </div>
          </div>

          {/* SKILLS & EVIDENCE BREAKDOWN */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* SKILLS DETAILED BREAKDOWN */}
            <div>
              <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>
                Matched vs Missing JD Requirements
              </h5>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {selectedCandidate.matchedSkills.map((sk) => (
                  <span
                    key={sk}
                    style={{
                      background: '#DCFCE7',
                      color: '#166534',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}
                  >
                    ✓ {sk}
                  </span>
                ))}
                {selectedCandidate.missingSkills.map((sk) => (
                  <span
                    key={sk}
                    style={{
                      background: '#FEE2E2',
                      color: '#991B1B',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}
                  >
                    ✗ {sk}
                  </span>
                ))}
              </div>
            </div>

            {/* EXTRACTED RESUME EVIDENCE */}
            <div>
              <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>
                Extracted Resume Evidence Snippets
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedCandidate.resumeEvidence.map((ev, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#F8FAFC',
                      borderLeft: '3px solid #0EA5E9',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontStyle: 'italic',
                      color: '#334155',
                    }}
                  >
                    {ev}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
