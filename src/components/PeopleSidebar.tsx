import React from 'react';
import { Users, AlertTriangle, ShieldAlert, CheckCircle } from 'lucide-react';

export interface PersonItem {
  id: string;
  name: string;
  initials: string;
  type: 'ON_ROLL' | 'INTERN' | 'CONSULTANT';
  state: 'ACTIVE' | 'TERMINATED' | 'SUSPENDED' | 'NOTICE' | 'PRE_HIRE';
  hasAnomaly?: 'severe' | 'watch' | null;
}

interface PeopleSidebarProps {
  people: PersonItem[];
  selectedPersonId: string;
  onSelectPerson: (id: string) => void;
  searchQuery: string;
}

const TYPE_META = {
  ON_ROLL: { label: 'On-roll', color: '#0E7C7B', bg: '#E4F3F2' },
  INTERN: { label: 'Intern', color: '#7C6FD6', bg: '#F0EEFB' },
  CONSULTANT: { label: 'Consultant', color: '#3B6FA0', bg: '#EBF2F8' },
};

export const PeopleSidebar: React.FC<PeopleSidebarProps> = ({
  people,
  selectedPersonId,
  onSelectPerson,
  searchQuery,
}) => {
  const filtered = people.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside style={{ width: '280px', background: '#FFFFFF', borderRight: '1px solid #E2E4E0', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Users size={13} /> Workforce Discovery ({filtered.length})
      </div>

      <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        {filtered.map((p) => {
          const isSelected = p.id === selectedPersonId;
          const meta = TYPE_META[p.type];

          return (
            <div
              key={p.id}
              onClick={() => onSelectPerson(p.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: '10px',
                cursor: 'pointer',
                background: isSelected ? '#14171F' : '#F9FAFB',
                border: isSelected ? '1px solid #14171F' : '1px solid #F3F4F6',
                color: isSelected ? '#FFFFFF' : '#14171F',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: meta.color,
                    color: '#FFF',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {p.initials}
                </div>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: isSelected ? '#FFF' : '#14171F' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: '11.5px', color: isSelected ? '#9CA3AF' : '#6B7280', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta.color }} />
                    {meta.label} • <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10.5px' }}>{p.state}</span>
                  </div>
                </div>
              </div>

              {p.hasAnomaly === 'severe' && (
                <span title="Severe Anomaly Detected">
                  <ShieldAlert size={16} color="#B23A48" />
                </span>
              )}
              {p.hasAnomaly === 'watch' && (
                <span title="Watch Item">
                  <AlertTriangle size={16} color="#C77D02" />
                </span>
              )}
              {!p.hasAnomaly && isSelected && <CheckCircle size={15} color="#0E7C7B" />}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
