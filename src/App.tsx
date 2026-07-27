import React, { useState, useEffect } from 'react';
import { Header, PersonaRole } from './components/Header';
import { OperationalHomeDashboard } from './components/OperationalHomeDashboard';
import { AttendanceCalendarView } from './components/AttendanceCalendarView';
import { TalentView } from './components/TalentView';
import { PeopleSidebar } from './components/PeopleSidebar';
import { Employee360 } from './components/Employee360';
import { LifecycleStudio } from './components/LifecycleStudio';
import { WorkforceIntegrity } from './components/WorkforceIntegrity';
import { InvestigationView } from './components/InvestigationView';
import { CommandDashboard } from './components/CommandDashboard';
import { LeaveView } from './components/LeaveView';

interface Person {
  id: string;
  name: string;
  initials: string;
  role: string;
  title: string;
  dept: string;
  email: string;
  joined: string;
  status: 'ACTIVE' | 'TERMINATED' | 'SUSPENDED';
  state: 'ACTIVE' | 'TERMINATED' | 'SUSPENDED';
  type: 'ON_ROLL' | 'INTERN' | 'CONSULTANT';
  engagementType: string;
  salary: number;
  manager: string;
}

export function App() {
  const [activeTab, setActiveTabState] = useState<string>(() => {
    return localStorage.getItem('volks_active_tab') || 'home';
  });

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    localStorage.setItem('volks_active_tab', tab);
  };

  const [activePersona, setActivePersonaState] = useState<PersonaRole>(() => {
    return (localStorage.getItem('volks_active_persona') as PersonaRole) || 'EMPLOYEE';
  });

  const setActivePersona = (persona: PersonaRole) => {
    setActivePersonaState(persona);
    localStorage.setItem('volks_active_persona', persona);
  };

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');

  useEffect(() => {
    fetch('http://localhost:4000/api/persons')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped: Person[] = data.map((p: any) => ({
            id: p.person_id || p.id,
            name: p.full_name || p.name || 'Krishna Chakri N',
            initials: (p.full_name || p.name || 'KCN').split(' ').map((n: string) => n[0]).join('').toUpperCase(),
            role: p.designation || p.role || 'Staff Architect',
            title: p.designation || p.role || 'Staff Architect',
            dept: p.department || p.dept || 'Core Platform',
            email: p.email || p.personal_email || 'krishna.chakri@volks.com',
            joined: p.joined_date || p.joined || '2024-01-15',
            status: p.status || 'ACTIVE',
            state: p.status || 'ACTIVE',
            type: 'ON_ROLL',
            engagementType: p.engagement_type || p.engagementType || 'FULL_TIME',
            salary: p.salary || 2400000,
            manager: 'Rahul Bose',
          }));
          setPeople(mapped);
          setSelectedPersonId(mapped[0].id);
        }
      })
      .catch(() => {
        const fallback: Person[] = [
          { id: 'p-101', name: 'Krishna Chakri N', initials: 'KCN', role: 'Staff Architect', title: 'Staff Architect', dept: 'Core Platform', email: 'krishna.chakri@volks.com', joined: '2024-01-15', status: 'ACTIVE', state: 'ACTIVE', type: 'ON_ROLL', engagementType: 'FULL_TIME', salary: 2400000, manager: 'Rahul Bose' },
          { id: 'p-102', name: 'Rahul Bose', initials: 'RB', role: 'HR Operations Lead', title: 'HR Operations Lead', dept: 'People Ops', email: 'rahul.bose@volks.com', joined: '2024-03-01', status: 'ACTIVE', state: 'ACTIVE', type: 'ON_ROLL', engagementType: 'FULL_TIME', salary: 1800000, manager: 'Krishna Chakri N' },
        ];
        setPeople(fallback);
        setSelectedPersonId(fallback[0].id);
      });
  }, []);

  const selectedPerson = people.find((p) => p.id === selectedPersonId) || people[0] || {
    id: 'p-101',
    name: 'Krishna Chakri N',
    initials: 'KCN',
    role: 'Staff Architect',
    title: 'Staff Architect',
    dept: 'Core Platform',
    email: 'krishna.chakri@volks.com',
    joined: '2024-01-15',
    status: 'ACTIVE',
    state: 'ACTIVE',
    type: 'ON_ROLL',
    engagementType: 'FULL_TIME',
    salary: 2400000,
    manager: 'Rahul Bose',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', background: '#F8FAFC', color: '#0F172A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activePersona={activePersona}
        setActivePersona={setActivePersona}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <OperationalHomeDashboard
            persona={activePersona}
            person={selectedPerson}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {/* PEOPLE TAB */}
        {activeTab === 'people' && (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            <PeopleSidebar
              people={people}
              selectedPersonId={selectedPersonId}
              onSelectPerson={(id) => setSelectedPersonId(id)}
              searchQuery={searchQuery}
            />
            <Employee360 person={selectedPerson} />
          </div>
        )}

        {/* TIME TAB */}
        {activeTab === 'time' && (
          <AttendanceCalendarView person={selectedPerson} />
        )}

        {/* LEAVE TAB */}
        {activeTab === 'leave' && (
          <LeaveView person={selectedPerson} userRole={currentRole} />
        )}

        {/* PAY TAB */}
        {activeTab === 'pay' && (
          <div style={{ padding: '32px', width: '100%', background: '#FFFFFF', margin: '24px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Salary & Monthly Payroll — July 2026</h2>
            <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '20px' }}>Reference hrms-salary.png: Itemized Salary Structure & Monthly Payslip</p>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '20px', borderRadius: '8px', maxWidth: '500px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#64748B' }}>Basic Salary (50%)</span><strong>₹1,00,000</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#64748B' }}>HRA (30%)</span><strong>₹60,000</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#64748B' }}>Special Allowance</span><strong>₹40,000</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#E11D48' }}>PF Deduction (12% Cap)</span><strong style={{ color: '#E11D48' }}>-₹1,800</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#E11D48' }}>Professional Tax</span><strong style={{ color: '#E11D48' }}>-₹200</strong></div>
              <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '900', color: '#0F172A' }}>
                <span>Net Payable Salary</span>
                <span style={{ color: '#059669' }}>₹1,98,000</span>
              </div>
            </div>
          </div>
        )}

        {/* EXPENSES TAB */}
        {activeTab === 'expenses' && (
          <div style={{ padding: '32px', width: '100%', background: '#FFFFFF', margin: '24px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Reimbursements & Expense Claims</h2>
            <p style={{ color: '#64748B', fontSize: '14px' }}>Submit and track business expense claims.</p>
          </div>
        )}

        {/* TALENT TAB */}
        {activeTab === 'talent' && (
          <TalentView person={selectedPerson} />
        )}

        {/* LIFECYCLE TAB */}
        {activeTab === 'lifecycle' && (
          <LifecycleStudio person={selectedPerson} />
        )}

        {/* ADMIN TAB */}
        {activeTab === 'admin' && (
          <CommandDashboard onNavigate={(t) => setActiveTab(t)} onOpenEvidence={() => {}} />
        )}

        {/* INTEGRITY TAB (DUAL-AXIS TIME MACHINE RELOCATED HERE) */}
        {activeTab === 'integrity' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflowY: 'auto' }}>
            <WorkforceIntegrity onOpenEvidence={() => {}} />
            <InvestigationView person={selectedPerson} onOpenEvidence={() => {}} />
          </div>
        )}
      </main>
    </div>
  );
}
