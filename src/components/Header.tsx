import React from 'react';
import { Users, Clock, DollarSign, Award, Layers, ShieldCheck, Settings, Home, Search, Briefcase, Calendar } from 'lucide-react';

export type PersonaRole = 'EMPLOYEE' | 'MANAGER' | 'DEPARTMENT_HEAD' | 'HR_ADMIN' | 'AUDITOR';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  activePersona: PersonaRole;
  setActivePersona: (role: PersonaRole) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activePersona,
  setActivePersona,
  searchQuery,
  setSearchQuery,
}) => {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'people', label: 'People', icon: Users },
    { id: 'time', label: 'Time', icon: Clock },
    { id: 'leave', label: 'Leave', icon: Calendar },
    { id: 'pay', label: 'Pay', icon: DollarSign },
    { id: 'expenses', label: 'Expenses', icon: Briefcase },
    { id: 'talent', label: 'Talent', icon: Award },
    { id: 'lifecycle', label: 'Lifecycle', icon: Layers },
    { id: 'admin', label: 'Admin', icon: Settings },
    { id: 'integrity', label: 'Integrity', icon: ShieldCheck },
  ];

  return (
    <header
      style={{
        background: '#FFFFFF',
        color: '#0F172A',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
      }}
    >
      {/* Brand Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '900',
              color: '#FFFFFF',
              fontSize: '18px',
              boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)',
            }}
          >
            V
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '18px', letterSpacing: '-0.5px', lineHeight: '1', color: '#0F172A' }}>VOLKS</div>
            <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '600', letterSpacing: '0.5px' }}>WORKFORCE OS</div>
          </div>
        </div>

        {/* Global Navigation */}
        <nav style={{ display: 'flex', gap: '2px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                data-testid={`nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                style={{
                  background: isActive ? '#EEF2FF' : 'transparent',
                  border: 'none',
                  color: isActive ? '#4F46E5' : '#64748B',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontWeight: isActive ? '700' : '500',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={15} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right Controls: Search & Persona Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search employee or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              padding: '6px 12px 6px 30px',
              color: '#0F172A',
              fontSize: '12px',
              width: '180px',
            }}
          />
        </div>

        {/* Persona Switcher */}
        <select
          value={activePersona}
          onChange={(e) => setActivePersona(e.target.value as PersonaRole)}
          style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            color: '#0F172A',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          <option value="EMPLOYEE">Persona: Employee</option>
          <option value="MANAGER">Persona: Manager</option>
          <option value="HR_ADMIN">Persona: HR Admin</option>
          <option value="AUDITOR">Persona: Payroll & Auditor</option>
        </select>
      </div>
    </header>
  );
};
