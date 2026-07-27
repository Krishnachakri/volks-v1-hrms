import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './components/LoginView';
import { Header, PersonaRole } from './components/Header';
import { OperationalHomeDashboard } from './components/OperationalHomeDashboard';
import { AttendanceCalendarView } from './components/AttendanceCalendarView';
import { LeaveView } from './components/LeaveView';
import { ExpenseView } from './components/ExpenseView';
import { PayrollView } from './components/PayrollView';
import { TalentView } from './components/TalentView';
import { PeopleSidebar } from './components/PeopleSidebar';
import { Employee360 } from './components/Employee360';
import { LifecycleStudio } from './components/LifecycleStudio';
import { WorkforceIntegrity } from './components/WorkforceIntegrity';
import { InvestigationView } from './components/InvestigationView';
import { CommandDashboard } from './components/CommandDashboard';

export interface Person {
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

function MainLayout() {
  const { user, loading } = useAuth();

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

  // Sync activePersona with authenticated user role
  useEffect(() => {
    if (user) {
      const primaryRole = (user.roles && user.roles[0]) ? user.roles[0] : (user.role || 'EMPLOYEE');
      setActivePersonaState(primaryRole as PersonaRole);
    }
  }, [user]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [peopleLoading, setPeopleLoading] = useState<boolean>(true);
  const [peopleError, setPeopleError] = useState<string | null>(null);

  const fetchPeople = () => {
    setPeopleLoading(true);
    setPeopleError(null);
    fetch('http://localhost:4000/api/persons')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped: Person[] = data.map((p: any) => ({
            id: p.person_id || p.id,
            name: p.full_name || p.name || 'Employee',
            initials: (p.full_name || p.name || 'EM').split(' ').map((n: string) => n[0]).join('').toUpperCase(),
            role: p.designation || p.role || 'Team Member',
            title: p.designation || p.role || 'Team Member',
            dept: p.department || p.dept || 'Engineering',
            email: p.email || p.personal_email || '',
            joined: p.joined_date || p.joined || '2024-01-15',
            status: p.status || 'ACTIVE',
            state: p.status || 'ACTIVE',
            type: 'ON_ROLL',
            engagementType: p.engagement_type || p.engagementType || 'FULL_TIME',
            salary: p.salary || 1200000,
            manager: p.manager_name || 'Reporting Manager',
          }));
          setPeople(mapped);
          setSelectedPersonId((prev) => (prev && mapped.some((m) => m.id === prev) ? prev : mapped[0].id));
        } else {
          setPeople([]);
        }
      })
      .catch((err) => {
        setPeopleError(`Unable to load employee directory from backend API: ${err.message}`);
      })
      .finally(() => setPeopleLoading(false));
  };

  useEffect(() => {
    fetchPeople();
  }, []);

  const defaultPerson: Person = {
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

  const selectedPerson = people.find((p) => p.id === selectedPersonId) || people[0] || defaultPerson;

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

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {peopleError && (
          <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', color: '#E11D48', padding: '12px 24px', margin: '16px 32px 0 32px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: '700' }}>
            <span>⚠️ {peopleError}</span>
            <button onClick={fetchPeople} style={{ background: '#E11D48', color: '#FFFFFF', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '12px' }}>
              Retry Connection
            </button>
          </div>
        )}

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
        {activeTab === 'leave' && (() => {
          const activeUserPerson = (activePersona === 'MANAGER' || activePersona === 'HR_ADMIN' || activePersona === 'AUDITOR')
            ? (people.find((p) => p.id === 'p-102') || people[1])
            : selectedPerson;
          return <LeaveView person={activeUserPerson} persona={activePersona} />;
        })()}

        {/* PAY TAB */}
        {activeTab === 'pay' && (() => {
          const activeUserPerson = (activePersona === 'MANAGER' || activePersona === 'HR_ADMIN' || activePersona === 'AUDITOR')
            ? (people.find((p) => p.id === 'p-102') || people[1])
            : selectedPerson;
          return <PayrollView person={activeUserPerson} persona={activePersona} />;
        })()}

        {/* EXPENSES TAB */}
        {activeTab === 'expenses' && (() => {
          const activeUserPerson = (activePersona === 'MANAGER' || activePersona === 'HR_ADMIN' || activePersona === 'AUDITOR')
            ? (people.find((p) => p.id === 'p-102') || people[1])
            : selectedPerson;
          return <ExpenseView person={activeUserPerson} persona={activePersona} />;
        })()}

        {/* TALENT TAB */}
        {activeTab === 'talent' && (
          <TalentView person={selectedPerson || { id: 'p-101', name: 'Employee' }} persona={activePersona} />
        )}

        {/* LIFECYCLE TAB */}
        {activeTab === 'lifecycle' && (
          <LifecycleStudio person={selectedPerson} persona={activePersona} onOpenEvidence={() => {}} />
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

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          width: '100vw',
          background: '#0F172A',
          color: '#94A3B8',
          fontFamily: 'Inter, system-ui, sans-serif',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '900',
            color: '#FFFFFF',
            fontSize: '20px',
          }}
        >
          V
        </div>
        <div style={{ fontSize: '14px', fontWeight: '600' }}>Verifying VOLKS Authentication & Session Security...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return <MainLayout />;
}
