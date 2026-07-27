import { useState, useMemo } from "react";
import { Clock, AlertTriangle, ShieldAlert, Users, ChevronRight, CheckCircle2 } from "lucide-react";

const DAY = 86400000;
const TODAY = "2026-07-25";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const toDay = (d) => Math.floor(Date.parse(d + "T00:00:00Z") / DAY);
const toDate = (day) => new Date(day * DAY).toISOString().slice(0, 10);
const pretty = (d) => {
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
};

const TYPE_META = {
  INTERN: { label: "Intern", color: "#7C6FD6" },
  ON_ROLL: { label: "On-roll", color: "#0E7C7B" },
  CONSULTANT: { label: "Consultant", color: "#3B6FA0" },
};
const STATUS_META = {
  ACTIVE: { color: "#0E7C7B", bg: "#E4F3F2" },
  ENDED: { color: "#6B7280", bg: "#EDEEF0" },
  TERMINATED: { color: "#B23A48", bg: "#FBEAEC" },
};

const PEOPLE = [
  {
    id: "P-001", name: "Krishna Chakri N", initials: "KCN",
    changes: [
      { date: "2025-08-01", type: "INTERN", status: "ENDED", title: "Software Intern", dept: "Engineering", manager: "Meera Nair", comp: 20000, access: "ACTIVE", payroll: "ACTIVE", reason: "Hired as intern" },
      { date: "2026-02-01", type: "ON_ROLL", status: "ACTIVE", title: "Associate Software Engineer", dept: "Engineering", manager: "Ananya Rao", comp: 800000, access: "ACTIVE", payroll: "ACTIVE", reason: "Converted intern \u2192 on-roll" },
      { date: "2026-06-01", type: "ON_ROLL", status: "ACTIVE", title: "Software Engineer", dept: "Engineering", manager: "Ananya Rao", comp: 1100000, access: "ACTIVE", payroll: "ACTIVE", reason: "Promotion" },
    ],
  },
  {
    id: "P-002", name: "Ananya Rao", initials: "AR",
    changes: [
      { date: "2025-01-15", type: "CONSULTANT", status: "ACTIVE", title: "Engineering Manager (Contract)", dept: "Engineering", manager: "CTO Office", comp: 150000, access: "ACTIVE", payroll: "ACTIVE", reason: "Contract start" },
      { date: "2026-06-30", type: "CONSULTANT", status: "TERMINATED", title: "Engineering Manager (Contract)", dept: "Engineering", manager: "CTO Office", comp: 150000, access: "ACTIVE", payroll: "INACTIVE", reason: "Contract ended" },
    ],
  },
  {
    id: "P-003", name: "Vikram Shetty", initials: "VS",
    changes: [
      { date: "2024-04-10", type: "ON_ROLL", status: "ACTIVE", title: "Senior Analyst", dept: "Finance", manager: "Rahul Bose", comp: 950000, access: "ACTIVE", payroll: "ACTIVE", reason: "Hired on-roll" },
      { date: "2026-07-10", type: "ON_ROLL", status: "ACTIVE", title: "Senior Analyst", dept: "Finance", manager: "Rahul Bose", comp: 950000, access: "ACTIVE", payroll: "INACTIVE", reason: "Bank details flagged, payroll paused" },
    ],
  },
  {
    id: "P-004", name: "Sana Iyer", initials: "SI",
    changes: [
      { date: "2025-11-03", type: "INTERN", status: "ENDED", title: "Design Intern", dept: "Product", manager: "Meera Nair", comp: 18000, access: "ACTIVE", payroll: "ACTIVE", reason: "Hired as intern" },
      { date: "2026-05-04", type: "ON_ROLL", status: "ACTIVE", title: "UX Designer", dept: "Product", manager: "Meera Nair", comp: 700000, access: "ACTIVE", payroll: "ACTIVE", reason: "Converted intern \u2192 on-roll" },
    ],
  },
  {
    id: "P-005", name: "Rahul Bose", initials: "RB",
    changes: [
      { date: "2022-03-01", type: "ON_ROLL", status: "ACTIVE", title: "Finance Lead", dept: "Finance", manager: "CTO Office", comp: 1600000, access: "ACTIVE", payroll: "ACTIVE", reason: "Hired on-roll" },
      { date: "2026-05-15", type: "ON_ROLL", status: "TERMINATED", title: "Finance Lead", dept: "Finance", manager: "CTO Office", comp: 1600000, access: "ACTIVE", payroll: "INACTIVE", reason: "Employment terminated" },
    ],
  },
  {
    id: "P-006", name: "Meera Nair", initials: "MN",
    changes: [
      { date: "2026-04-01", type: "INTERN", status: "ACTIVE", title: "Operations Intern", dept: "People", manager: "Ananya Rao", comp: 22000, access: "ACTIVE", payroll: "ACTIVE", reason: "Hired as intern" },
    ],
  },
];

function snapshotAt(person, day) {
  let result = null;
  for (const c of person.changes) if (toDay(c.date) <= day) result = c;
  return result;
}

function anomalyFor(person) {
  const s = snapshotAt(person, toDay(TODAY));
  if (!s) return null;
  if (s.status !== "ACTIVE" && s.access === "ACTIVE") {
    return {
      severity: "severe",
      label: "Access live after engagement ended",
      why: `${person.name}'s engagement was marked ${s.status.toLowerCase()} on ${pretty(s.date)}, but system access is still ACTIVE. Per offboarding policy, access should be revoked the same day.`,
    };
  }
  if (s.status === "ACTIVE" && s.payroll === "INACTIVE") {
    return {
      severity: "watch",
      label: "Payroll inactive while actively engaged",
      why: `${person.name} is actively engaged (since ${pretty(s.date)}) but payroll is INACTIVE. They may be working without being paid.`,
    };
  }
  if (s.status === "ACTIVE" && s.access === "INACTIVE") {
    return {
      severity: "watch",
      label: "Access revoked while engagement active",
      why: `${person.name}'s engagement is active but system access is INACTIVE, effective ${pretty(s.date)}. They may be locked out of required tools.`,
    };
  }
  return null;
}

export default function Continuum() {
  const [tab, setTab] = useState("timeline");
  const [personId, setPersonId] = useState(PEOPLE[0].id);
  const person = PEOPLE.find((p) => p.id === personId);
  const minDay = toDay(person.changes[0].date);
  const maxDay = toDay(TODAY);
  const [scrub, setScrub] = useState(maxDay);

  const snap = useMemo(() => snapshotAt(person, scrub), [person, scrub]);
  const anomalies = useMemo(() => PEOPLE.map((p) => ({ p, a: anomalyFor(p) })).filter((x) => x.a), []);

  const selectPerson = (id) => {
    setPersonId(id);
    setScrub(toDay(TODAY));
  };

  return (
    <div className="cnt-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .cnt-root { font-family: 'Inter', sans-serif; background: #F6F7F5; color: #14171F; min-height: 100%; padding: 24px; box-sizing: border-box; }
        .cnt-mono { font-family: 'IBM Plex Mono', monospace; }
        .cnt-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
        .cnt-brand { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 22px; letter-spacing: 0.02em; }
        .cnt-tagline { font-size: 12.5px; color: #6B7280; margin-top: 2px; }
        .cnt-tabs { display: flex; gap: 4px; background: #EDEEF0; padding: 4px; border-radius: 10px; }
        .cnt-tab { padding: 7px 14px; font-size: 13px; font-weight: 600; border-radius: 7px; cursor: pointer; border: none; background: transparent; color: #6B7280; display: flex; align-items: center; gap: 6px; }
        .cnt-tab.active { background: #14171F; color: #fff; }
        .cnt-grid { display: grid; grid-template-columns: 260px 1fr; gap: 16px; }
        .cnt-panel { background: #fff; border: 1px solid #E2E4E0; border-radius: 14px; padding: 16px; }
        .cnt-panel-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #6B7280; margin-bottom: 12px; }
        .cnt-person { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 9px; cursor: pointer; margin-bottom: 4px; }
        .cnt-person:hover { background: #F6F7F5; }
        .cnt-person.active { background: #14171F; }
        .cnt-person.active .cnt-pname, .cnt-person.active .cnt-prole { color: #fff; }
        .cnt-avatar { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 700; color: #fff; flex-shrink: 0; }
        .cnt-pname { font-size: 13.5px; font-weight: 600; }
        .cnt-prole { font-size: 11.5px; color: #6B7280; }
        .cnt-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; margin-right: 5px; }
        .cnt-stamp { border: 1.5px dashed #C9CCC6; border-radius: 14px; padding: 20px; margin-top: 4px; }
        .cnt-stamp-date { font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.08em; }
        .cnt-stamp-title { font-family: 'Space Grotesk', sans-serif; font-size: 21px; font-weight: 600; margin: 4px 0 10px; }
        .cnt-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; margin-top: 8px; }
        .cnt-field-label { font-size: 10.5px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; }
        .cnt-field-value { font-size: 13.5px; font-weight: 500; margin-top: 2px; }
        .cnt-pill { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .cnt-scrubber-wrap { margin-top: 20px; }
        .cnt-track-labels { display: flex; justify-content: space-between; font-size: 11px; color: #6B7280; margin-bottom: 6px; }
        .cnt-range { width: 100%; accent-color: #0E7C7B; }
        .cnt-segments { display: flex; height: 8px; border-radius: 4px; overflow: hidden; margin-top: 10px; }
        .cnt-anomaly-summary { display: flex; gap: 16px; margin-bottom: 16px; }
        .cnt-stat { background: #fff; border: 1px solid #E2E4E0; border-radius: 14px; padding: 14px 18px; flex: 1; }
        .cnt-stat-num { font-family: 'Space Grotesk', sans-serif; font-size: 26px; font-weight: 700; }
        .cnt-stat-label { font-size: 12px; color: #6B7280; margin-top: 2px; }
        .cnt-card { background: #fff; border: 1px solid #E2E4E0; border-radius: 14px; padding: 16px; margin-bottom: 12px; }
        .cnt-card.severe { border-left: 4px solid #B23A48; }
        .cnt-card.watch { border-left: 4px solid #C77D02; }
        .cnt-card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .cnt-card-label { font-weight: 600; font-size: 14px; }
        .cnt-why { font-size: 13px; color: #40454F; line-height: 1.5; background: #F6F7F5; border-radius: 9px; padding: 10px 12px; margin-top: 6px; }
        .cnt-clean { display: flex; align-items: center; gap: 8px; color: #0E7C7B; font-size: 13px; font-weight: 500; padding: 10px 4px; }
      `}</style>

      <div className="cnt-header">
        <div>
          <div className="cnt-brand">CONTINUUM</div>
          <div className="cnt-tagline">One identity, every version of it, on record \u2014 workforce time machine</div>
        </div>
        <div className="cnt-tabs">
          <button className={`cnt-tab ${tab === "timeline" ? "active" : ""}`} onClick={() => setTab("timeline")}>
            <Clock size={14} /> Time Travel
          </button>
          <button className={`cnt-tab ${tab === "anomalies" ? "active" : ""}`} onClick={() => setTab("anomalies")}>
            <AlertTriangle size={14} /> Anomaly Watch
          </button>
        </div>
      </div>

      {tab === "timeline" && (
        <div className="cnt-grid">
          <div className="cnt-panel">
            <div className="cnt-panel-title"><Users size={12} style={{ verticalAlign: -1, marginRight: 5 }} />People</div>
            {PEOPLE.map((p) => {
              const s = snapshotAt(p, toDay(TODAY));
              const meta = TYPE_META[s.type];
              return (
                <div key={p.id} className={`cnt-person ${p.id === personId ? "active" : ""}`} onClick={() => selectPerson(p.id)}>
                  <div className="cnt-avatar" style={{ background: meta.color }}>{p.initials}</div>
                  <div>
                    <div className="cnt-pname">{p.name}</div>
                    <div className="cnt-prole"><span className="cnt-dot" style={{ background: meta.color }} />{meta.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cnt-panel">
            <div className="cnt-panel-title">Record as of selected date</div>

            {!snap ? (
              <div className="cnt-stamp">
                <div className="cnt-stamp-date cnt-mono">{pretty(toDate(scrub))}</div>
                <div className="cnt-stamp-title">Not yet with the organization</div>
              </div>
            ) : (
              <div className="cnt-stamp">
                <div className="cnt-stamp-date cnt-mono">AS OF {pretty(toDate(scrub))}</div>
                <div className="cnt-stamp-title">{snap.title}</div>
                <span className="cnt-pill" style={{ background: TYPE_META[snap.type].color + "22", color: TYPE_META[snap.type].color }}>
                  {TYPE_META[snap.type].label}
                </span>{" "}
                <span className="cnt-pill" style={{ background: STATUS_META[snap.status].bg, color: STATUS_META[snap.status].color }}>
                  {snap.status}
                </span>
                <div className="cnt-field-row">
                  <div><div className="cnt-field-label">Department</div><div className="cnt-field-value">{snap.dept}</div></div>
                  <div><div className="cnt-field-label">Manager</div><div className="cnt-field-value">{snap.manager}</div></div>
                  <div><div className="cnt-field-label">Compensation</div><div className="cnt-field-value cnt-mono">\u20b9{snap.comp.toLocaleString("en-IN")}</div></div>
                  <div><div className="cnt-field-label">Effective reason</div><div className="cnt-field-value">{snap.reason}</div></div>
                  <div><div className="cnt-field-label">System access</div><div className="cnt-field-value" style={{ color: snap.access === "ACTIVE" ? "#0E7C7B" : "#B23A48" }}>{snap.access}</div></div>
                  <div><div className="cnt-field-label">Payroll</div><div className="cnt-field-value" style={{ color: snap.payroll === "ACTIVE" ? "#0E7C7B" : "#B23A48" }}>{snap.payroll}</div></div>
                </div>
              </div>
            )}

            <div className="cnt-scrubber-wrap">
              <div className="cnt-track-labels">
                <span className="cnt-mono">{pretty(toDate(minDay))}</span>
                <span className="cnt-mono">Drag to travel in time \u2192</span>
                <span className="cnt-mono">{pretty(TODAY)}</span>
              </div>
              <input
                type="range" className="cnt-range" min={minDay} max={maxDay} value={scrub}
                list={`ticks-${person.id}`}
                onChange={(e) => setScrub(Number(e.target.value))}
              />
              <datalist id={`ticks-${person.id}`}>
                {person.changes.map((c) => <option key={c.date} value={toDay(c.date)} />)}
              </datalist>

              <div className="cnt-segments">
                {person.changes.map((c, i) => {
                  const next = person.changes[i + 1] ? toDay(person.changes[i + 1].date) : maxDay;
                  const width = ((next - toDay(c.date)) / (maxDay - minDay)) * 100;
                  return <div key={c.date} title={`${c.reason} \u2014 ${pretty(c.date)}`} style={{ width: `${width}%`, background: TYPE_META[c.type].color }} />;
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "anomalies" && (
        <div>
          <div className="cnt-anomaly-summary">
            <div className="cnt-stat"><div className="cnt-stat-num">{PEOPLE.length}</div><div className="cnt-stat-label">Total records</div></div>
            <div className="cnt-stat"><div className="cnt-stat-num" style={{ color: "#B23A48" }}>{anomalies.filter((a) => a.a.severity === "severe").length}</div><div className="cnt-stat-label">Severe \u2014 needs action today</div></div>
            <div className="cnt-stat"><div className="cnt-stat-num" style={{ color: "#C77D02" }}>{anomalies.filter((a) => a.a.severity === "watch").length}</div><div className="cnt-stat-label">Worth a look</div></div>
          </div>

          <div className="cnt-panel">
            <div className="cnt-panel-title">Records in an inconsistent state, right now</div>
            {anomalies.map(({ p, a }) => (
              <div key={p.id} className={`cnt-card ${a.severity}`}>
                <div className="cnt-card-head">
                  {a.severity === "severe" ? <ShieldAlert size={17} color="#B23A48" /> : <AlertTriangle size={17} color="#C77D02" />}
                  <span className="cnt-card-label">{p.name}</span>
                  <ChevronRight size={13} color="#9CA0A8" />
                  <span style={{ fontSize: 13, color: "#6B7280" }}>{a.label}</span>
                </div>
                <div className="cnt-why">{a.why}</div>
              </div>
            ))}
            {PEOPLE.filter((p) => !anomalyFor(p)).map((p) => (
              <div key={p.id} className="cnt-clean"><CheckCircle2 size={15} /> {p.name} \u2014 record is consistent</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
