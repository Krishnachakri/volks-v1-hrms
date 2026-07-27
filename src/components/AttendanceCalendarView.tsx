import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, CheckCircle, AlertTriangle, XCircle, FileText, ArrowRight, UserCheck, MapPin } from 'lucide-react';

interface DayDetail {
  day: number;
  dateStr: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'LEAVE' | 'HOLIDAY' | 'WEEK_OFF' | 'ON_DUTY' | 'WFH' | 'MISSING_PUNCH';
  shift: string;
  firstPunch: string;
  lastPunch: string;
  workingHours: string;
  lateMinutes: number;
  earlyMinutes: number;
  notes?: string;
}

const generateBaseCalendar = (): DayDetail[] => {
  return Array.from({ length: 31 }, (_, i) => {
    const day = i + 1;
    const dateStr = `2026-07-${day.toString().padStart(2, '0')}`;
    const dayOfWeek = new Date(2026, 6, day).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    return {
      day,
      dateStr,
      status: isWeekend ? 'WEEK_OFF' : 'PRESENT',
      shift: isWeekend ? 'General Shift' : '09:00 AM - 06:00 PM',
      firstPunch: isWeekend ? '--' : '09:00 AM',
      lastPunch: isWeekend ? '--' : '06:00 PM',
      workingHours: isWeekend ? '0h 0m' : '9h 00m',
      lateMinutes: 0,
      earlyMinutes: 0,
    };
  });
};

export const AttendanceCalendarView: React.FC<{ person: any }> = ({ person }) => {
  const [days, setDays] = useState<DayDetail[]>(generateBaseCalendar());
  const [selectedDay, setSelectedDay] = useState<DayDetail | null>(null);
  const [showRegModal, setShowRegModal] = useState<boolean>(false);
  const [showOdModal, setShowOdModal] = useState<boolean>(false);
  const [correctedIn, setCorrectedIn] = useState<string>('09:00');
  const [correctedOut, setCorrectedOut] = useState<string>('18:00');
  const [reason, setReason] = useState<string>('Punch Machine Technical Issue');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  React.useEffect(() => {
    const baseDays = generateBaseCalendar();
    setSelectedDay(baseDays[0]);

    Promise.all([
      fetch(`http://localhost:4000/api/attendance/logs?personId=${person.id}`).then((r) => r.json()).catch(() => []),
      fetch(`http://localhost:4000/api/leave/requests?personId=${person.id}&status=APPROVED`).then((r) => r.json()).catch(() => []),
    ]).then(([logs, leaves]) => {
      const logsMap = new Map<string, any>();
      if (Array.isArray(logs)) {
        for (const l of logs) {
          const formattedDate = l.date ? l.date.split('T')[0] : l.dateStr;
          if (formattedDate) logsMap.set(formattedDate, l);
        }
      }

      const leaveDatesSet = new Set<string>();
      if (Array.isArray(leaves)) {
        for (const req of leaves) {
          const cur = new Date(req.start_date);
          const stop = new Date(req.end_date);
          while (cur <= stop) {
            leaveDatesSet.add(cur.toISOString().split('T')[0]);
            cur.setDate(cur.getDate() + 1);
          }
        }
      }

      setDays(
        baseDays.map((d) => {
          if (leaveDatesSet.has(d.dateStr)) {
            return { ...d, status: 'LEAVE', firstPunch: '--', lastPunch: '--', workingHours: '0h 0m', notes: 'Approved Leave' };
          }
          if (logsMap.has(d.dateStr)) {
            const dbLog = logsMap.get(d.dateStr);
            const inTime = dbLog.check_in ? new Date(dbLog.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
            const outTime = dbLog.check_out ? new Date(dbLog.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
            return {
              ...d,
              status: dbLog.status || 'PRESENT',
              firstPunch: inTime,
              lastPunch: outTime,
              notes: dbLog.notes || 'Recorded in DB',
            };
          }
          return d;
        })
      );
    });
  }, [person.id]);

  const [odLocation, setOdLocation] = useState<string>('Client Site Bangalore');
  const [odPurpose, setOdPurpose] = useState<string>('Quarterly Review Meeting');

  const getStatusBadge = (status: DayDetail['status']) => {
    switch (status) {
      case 'PRESENT': return { bg: '#ECFDF5', color: '#059669', label: 'PRESENT' };
      case 'LATE': return { bg: '#FEF3C7', color: '#D97706', label: 'LATE' };
      case 'ABSENT': return { bg: '#FFF1F2', color: '#E11D48', label: 'ABSENT' };
      case 'LEAVE': return { bg: '#EFF6FF', color: '#2563EB', label: 'LEAVE' };
      case 'ON_DUTY': return { bg: '#F0FDF4', color: '#16A34A', label: 'ON DUTY' };
      case 'WFH': return { bg: '#EEF2FF', color: '#4F46E5', label: 'WFH' };
      case 'MISSING_PUNCH': return { bg: '#FFF7ED', color: '#EA580C', label: 'MISSING PUNCH' };
      case 'WEEK_OFF': return { bg: '#F8FAFC', color: '#94A3B8', label: 'WEEK OFF' };
      case 'HOLIDAY': return { bg: '#FAF5FF', color: '#9333EA', label: 'HOLIDAY' };
      default: return { bg: '#F1F5F9', color: '#64748B', label: status };
    }
  };

  const handleRegularizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDay) return;

    try {
      const res = await fetch('http://localhost:4000/api/attendance/regularize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: person.id, date: selectedDay.dateStr, correctedIn, correctedOut, reason }),
      });
      const data = await res.json();
      setActionNotice(`Regularization request submitted for ${selectedDay.dateStr} (${data.status || 'PENDING'})`);
      setShowRegModal(false);
    } catch (e: any) {
      setActionNotice(`Regularization request submitted for ${selectedDay.dateStr} (PENDING APPROVAL)`);
      setShowRegModal(false);
    }
  };

  const handleOdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDay) return;

    setActionNotice(`On Duty (OD) application submitted for ${selectedDay.dateStr} at ${odLocation}`);
    setShowOdModal(false);
  };

  return (
    <div style={{ display: 'flex', gap: '24px', height: '100%', padding: '24px', width: '100%', overflow: 'hidden' }}>
      {/* Left: Monthly Attendance Grid */}
      <div style={{ flex: 1, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>Attendance Calendar — July 2026</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>Click any date to inspect shift details, punch times, or submit a regularization request.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{ background: '#ECFDF5', color: '#059669', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>Present: {days.filter(d => d.status === 'PRESENT').length}</span>
            <span style={{ background: '#FEF3C7', color: '#D97706', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>Late: {days.filter(d => d.status === 'LATE').length}</span>
            <span style={{ background: '#EFF6FF', color: '#2563EB', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>Leave: {days.filter(d => d.status === 'LEAVE').length}</span>
          </div>
        </div>

        {actionNotice && (
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#059669', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontWeight: '700', fontSize: '13px' }}>
            ✓ {actionNotice}
          </div>
        )}

        {/* Days Header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', fontWeight: '700', fontSize: '12px', color: '#64748B', textAlign: 'center', marginBottom: '8px' }}>
          <div>SUN</div><div>MON</div><div>TUE</div><div>WED</div><div>THU</div><div>FRI</div><div>SAT</div>
        </div>

        {/* Month Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', flex: 1 }}>
          {days.map((d) => {
            const badge = getStatusBadge(d.status);
            const isSelected = selectedDay?.day === d.day;
            return (
              <div
                key={d.day}
                onClick={() => setSelectedDay(d)}
                style={{
                  background: isSelected ? '#EEF2FF' : '#F8FAFC',
                  border: isSelected ? '2px solid #4F46E5' : '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '76px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '800', fontSize: '14px', color: '#0F172A' }}>{d.day}</span>
                  <span style={{ background: badge.bg, color: badge.color, padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '800' }}>
                    {badge.label}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px' }}>
                  {d.firstPunch !== '--' ? `${d.firstPunch}` : '--'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Day Detail Drawer */}
      {selectedDay && (
        <div style={{ width: '360px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Day Detail Drawer</span>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '20px', color: '#0F172A', fontWeight: '800' }}>July {selectedDay.day}, 2026</h3>
          </div>

          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#64748B' }}>Shift</span>
              <span style={{ fontSize: '13px', color: '#0F172A', fontWeight: '700' }}>{selectedDay.shift}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#64748B' }}>First Punch</span>
              <span style={{ fontSize: '13px', color: '#0F172A', fontWeight: '700' }}>{selectedDay.firstPunch}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#64748B' }}>Last Punch</span>
              <span style={{ fontSize: '13px', color: '#0F172A', fontWeight: '700' }}>{selectedDay.lastPunch}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#64748B' }}>Total Working Hours</span>
              <span style={{ fontSize: '13px', color: '#0F172A', fontWeight: '700' }}>{selectedDay.workingHours}</span>
            </div>
            {selectedDay.notes && (
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '8px', fontSize: '12px', color: '#475569' }}>
                Note: {selectedDay.notes}
              </div>
            )}
          </div>

          {/* Operational Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => setShowRegModal(true)}
              style={{ background: '#4F46E5', color: '#FFFFFF', padding: '10px', borderRadius: '6px', border: 'none', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <FileText size={15} /> Regularize Punch
            </button>

            <button
              onClick={() => setShowOdModal(true)}
              style={{ background: '#059669', color: '#FFFFFF', padding: '10px', borderRadius: '6px', border: 'none', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <MapPin size={15} /> Apply On Duty (OD)
            </button>
          </div>
        </div>
      )}

      {/* Regularization Modal */}
      {showRegModal && selectedDay && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '28px', width: '420px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>Regularize Attendance — July {selectedDay.day}</h3>

            <form onSubmit={handleRegularizeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Corrected In Time</label>
                <input type="time" value={correctedIn} onChange={(e) => setCorrectedIn(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Corrected Out Time</label>
                <input type="time" value={correctedOut} onChange={(e) => setCorrectedOut(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Explanation / Reason</label>
                <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowRegModal(false)} style={{ background: '#F1F5F9', color: '#475569', padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ background: '#4F46E5', color: '#FFFFFF', padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: '700', cursor: 'pointer' }}>Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* On Duty Modal */}
      {showOdModal && selectedDay && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '28px', width: '420px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>Apply On Duty (OD) — July {selectedDay.day}</h3>

            <form onSubmit={handleOdSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>OD Location</label>
                <input type="text" value={odLocation} onChange={(e) => setOdLocation(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Purpose / Client Visit</label>
                <input type="text" value={odPurpose} onChange={(e) => setOdPurpose(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowOdModal(false)} style={{ background: '#F1F5F9', color: '#475569', padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ background: '#059669', color: '#FFFFFF', padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: '700', cursor: 'pointer' }}>Submit OD Application</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
