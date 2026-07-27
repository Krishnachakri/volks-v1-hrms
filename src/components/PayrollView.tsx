import React, { useState, useEffect } from 'react';
import { Person } from '../App';
import { PersonaRole } from './Header';
import { DollarSign, Clock, CheckCircle2, AlertCircle, Lock, Play, Eye, Printer, ShieldCheck, FileText } from 'lucide-react';

interface SalaryStructure {
  salary_id: string;
  person_id: string;
  basic: string;
  hra: string;
  allowances: string;
  deductions: string;
  net_salary: string;
  effective_from: string;
}

interface PayrollRun {
  run_id: string;
  month: string;
  month_days: number;
  total_employees: number;
  total_gross_paise: string;
  total_deductions_paise: string;
  total_net_paise: string;
  total_payout: string;
  status: 'DRAFT' | 'PREVIEWED' | 'PROCESSED' | 'LOCKED';
  processed_by: string | null;
  processed_at: string | null;
  locked_by: string | null;
  locked_at: string | null;
  created_at: string;
}

interface Payslip {
  payslip_id: string;
  run_id: string;
  person_id: string;
  month: string;
  basic_paise: string;
  hra_paise: string;
  allowances_paise: string;
  gross_paise: string;
  pf_deduction_paise: string;
  pt_deduction_paise: string;
  lop_days: number;
  lop_deduction_paise: string;
  total_deductions_paise: string;
  net_paise: string;
  gross_pay: string;
  net_pay: string;
  status: string;
  created_at: string;
  applicant_name?: string;
}

interface PreviewItem {
  person_id: string;
  name: string;
  basic: string;
  hra: string;
  allowances: string;
  gross_pay: string;
  pf_deduction: string;
  pt_deduction: string;
  lop_days: number;
  lop_deduction: string;
  total_deductions: string;
  net_pay: string;
}

interface PreviewData {
  month: string;
  monthDays: number;
  totalEmployees: number;
  totalGross: string;
  totalDeductions: string;
  totalNetPayout: string;
  exceptions: Array<{ person_id: string; name: string; date: string; issue: string }>;
  items: PreviewItem[];
}

interface PayrollViewProps {
  person: Person;
  persona: PersonaRole;
}

export const PayrollView: React.FC<PayrollViewProps> = ({ person, persona }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-07');
  const [structure, setStructure] = useState<SalaryStructure | null>(null);
  const [currentRun, setCurrentRun] = useState<PayrollRun | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [printablePayslip, setPrintablePayslip] = useState<Payslip | null>(null);

  // Notification Banners
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Salary Structure for active person
      const structRes = await fetch(`http://localhost:4000/api/payroll/structure?personId=${person.id}`);
      if (structRes.ok) {
        const structData: SalaryStructure = await structRes.json();
        setStructure(structData);
      }

      // 2. Fetch Payroll Run for selected month
      const runRes = await fetch(`http://localhost:4000/api/payroll/runs?month=${selectedMonth}`);
      if (runRes.ok) {
        const runsData: PayrollRun[] = await runRes.json();
        setCurrentRun(runsData.length > 0 ? runsData[0] : null);
      }

      // 3. Fetch Payslips
      let payslipsUrl = `http://localhost:4000/api/payroll/payslips?month=${selectedMonth}&actorRole=${persona}&actorPersonId=${person.id}`;
      if (persona === 'EMPLOYEE') {
        payslipsUrl += `&personId=${person.id}`;
      }
      const payslipsRes = await fetch(payslipsUrl, {
        headers: {
          'x-person-id': person.id,
          'x-user-role': persona,
        },
      });
      if (payslipsRes.ok) {
        const payslipsData: Payslip[] = await payslipsRes.json();
        setPayslips(payslipsData);
      }
    } catch (err) {
      console.error('Failed to fetch payroll data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [person.id, persona, selectedMonth]);

  // Stage 1: Preview Payroll Run
  const handlePreviewPayroll = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('http://localhost:4000/api/payroll/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          actorRole: persona,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to preview payroll run.');
      } else {
        setPreviewData(data);
        if (data.exceptions && data.exceptions.length > 0) {
          setErrorMsg(`Payroll Preview Warning: ${data.exceptions.length} unresolved attendance exception(s) detected.`);
        } else {
          setSuccessMsg(`Payroll Preview calculated for ${selectedMonth} (${data.totalEmployees} employees, Total Net: ₹${parseFloat(data.totalNetPayout).toLocaleString('en-IN')})`);
        }
        await fetchData();
      }
    } catch (err) {
      setErrorMsg('Network error while previewing payroll.');
    }
  };

  // Stage 2: Process Payroll Run
  const handleProcessPayroll = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('http://localhost:4000/api/payroll/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          actorPersonId: person.id,
          actorRole: persona,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to process payroll run.');
      } else {
        setSuccessMsg(`Payroll run for ${selectedMonth} processed successfully! Itemized payslips generated.`);
        setPreviewData(null);
        await fetchData();
      }
    } catch (err) {
      setErrorMsg('Network error while processing payroll.');
    }
  };

  // Stage 3: Lock Payroll Run
  const handleLockPayroll = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('http://localhost:4000/api/payroll/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          actorPersonId: person.id,
          actorRole: persona,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to lock payroll run.');
      } else {
        setSuccessMsg(`Payroll run for ${selectedMonth} is now LOCKED and immutable.`);
        await fetchData();
      }
    } catch (err) {
      setErrorMsg('Network error while locking payroll.');
    }
  };

  const activeEmployeePayslip = payslips.length > 0 ? payslips[0] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Top Banner & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', padding: '20px 24px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <DollarSign size={24} style={{ color: '#059669' }} />
            Salary & Monthly Payroll — {selectedMonth === '2026-07' ? 'July 2026' : (selectedMonth === '2026-06' ? 'June 2026' : (selectedMonth === '2026-02' ? 'February 2026' : selectedMonth))}
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            {persona === 'EMPLOYEE' && `Viewing itemized monthly payslip & earnings breakdown for ${person.name}`}
            {(persona === 'HR_ADMIN' || persona === 'AUDITOR' || persona === 'MANAGER') && `HR & Finance Monthly Payroll Processing Studio`}
          </p>
        </div>

        {/* Month Switcher Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B' }}>Pay Period:</label>
          <select
            id="payroll-month-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#F8FAFC', fontSize: '13px', fontWeight: '700', color: '#0F172A' }}
          >
            <option value="2026-07">July 2026 (31 Days)</option>
            <option value="2026-06">June 2026 (30 Days)</option>
            <option value="2026-02">February 2026 (28 Days)</option>
          </select>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', color: '#065F46', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 4-STAGE LIFECYCLE BAR FOR HR ADMIN / FINANCE / ADMIN */}
      {(persona === 'HR_ADMIN' || persona === 'FINANCE' || persona === 'AUDITOR' || persona === 'SYSTEM_ADMIN') && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Payroll Run Lifecycle State:</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['DRAFT', 'PREVIEWED', 'PROCESSED', 'LOCKED'].map((st) => {
                const isCurrent = (currentRun?.status || 'DRAFT') === st;
                return (
                  <span
                    key={st}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '800',
                      background: isCurrent ? (st === 'LOCKED' ? '#DC2626' : '#4338CA') : '#F1F5F9',
                      color: isCurrent ? '#FFFFFF' : '#64748B',
                    }}
                  >
                    {st}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Action Buttons Bar */}
          <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
            <button
              id="preview-payroll-btn"
              onClick={handlePreviewPayroll}
              disabled={currentRun?.status === 'LOCKED'}
              style={{
                flex: 1,
                background: currentRun?.status === 'LOCKED' ? '#94A3B8' : '#F59E0B',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: currentRun?.status === 'LOCKED' ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Eye size={16} />
              1. Preview Payroll Run
            </button>

            <button
              id="process-payroll-btn"
              onClick={handleProcessPayroll}
              disabled={currentRun?.status === 'LOCKED'}
              style={{
                flex: 1,
                background: currentRun?.status === 'LOCKED' ? '#94A3B8' : '#4338CA',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: currentRun?.status === 'LOCKED' ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Play size={16} />
              2. Process Payroll Run
            </button>

            <button
              id="lock-payroll-btn"
              onClick={handleLockPayroll}
              disabled={currentRun?.status === 'LOCKED' || (currentRun?.status !== 'PROCESSED' && currentRun?.status !== 'PREVIEWED')}
              style={{
                flex: 1,
                background: currentRun?.status === 'LOCKED' ? '#DC2626' : (currentRun?.status === 'PROCESSED' ? '#059669' : '#94A3B8'),
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: currentRun?.status === 'LOCKED' ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Lock size={16} />
              3. Lock Payroll Run
            </button>
          </div>
        </div>
      )}

      {/* EMPLOYEE PAYSLIP CARD VIEW */}
      {persona === 'EMPLOYEE' && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>
                Itemized Monthly Payslip — {selectedMonth}
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                Deterministic Integer Paise Calculation • Status: {activeEmployeePayslip?.status || 'PROCESSED'}
              </p>
            </div>

            <button
              id="print-payslip-btn"
              onClick={() => setPrintablePayslip(activeEmployeePayslip || {
                payslip_id: 'default-doc-1',
                run_id: 'default-run',
                person_id: person.id,
                month: selectedMonth,
                basic_paise: '10000000',
                hra_paise: '6000000',
                allowances_paise: '4000000',
                gross_paise: '20000000',
                pf_deduction_paise: '180000',
                pt_deduction_paise: '20000',
                lop_days: 0,
                lop_deduction_paise: '0',
                total_deductions_paise: '200000',
                net_paise: '19800000',
                gross_pay: '200000.00',
                net_pay: '198000.00',
                status: 'LOCKED',
                created_at: new Date().toISOString(),
                applicant_name: person.name,
              })}
              style={{
                background: '#F1F5F9',
                color: '#0F172A',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Printer size={14} />
              Printable Payslip Document (PARTIAL)
            </button>
          </div>

          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '24px', borderRadius: '10px', maxWidth: '600px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Earnings Breakdown</div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
              <span style={{ color: '#64748B' }}>Basic Salary (Base Component)</span>
              <strong>₹{activeEmployeePayslip ? (parseInt(activeEmployeePayslip.basic_paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '1,00,000.00'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
              <span style={{ color: '#64748B' }}>House Rent Allowance (HRA)</span>
              <strong>₹{activeEmployeePayslip ? (parseInt(activeEmployeePayslip.hra_paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '60,000.00'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
              <span style={{ color: '#64748B' }}>Special Allowances</span>
              <strong>₹{activeEmployeePayslip ? (parseInt(activeEmployeePayslip.allowances_paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '40,000.00'}</strong>
            </div>

            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '8px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
              <span>Gross Pay</span>
              <span>₹{activeEmployeePayslip ? (parseInt(activeEmployeePayslip.gross_paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '2,00,000.00'}</span>
            </div>

            <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569', margin: '20px 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Deductions & Policy Adjustments</div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
              <span style={{ color: '#E11D48' }}>Provident Fund Policy (12% Cap ₹1,800)</span>
              <strong style={{ color: '#E11D48' }}>-₹{activeEmployeePayslip ? (parseInt(activeEmployeePayslip.pf_deduction_paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '1,800.00'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
              <span style={{ color: '#E11D48' }}>Professional Tax (PT Policy)</span>
              <strong style={{ color: '#E11D48' }}>-₹{activeEmployeePayslip ? (parseInt(activeEmployeePayslip.pt_deduction_paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '200.00'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
              <span style={{ color: '#E11D48' }}>Loss of Pay (LOP: {activeEmployeePayslip?.lop_days || 0} days)</span>
              <strong style={{ color: '#E11D48' }}>-₹{activeEmployeePayslip ? (parseInt(activeEmployeePayslip.lop_deduction_paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</strong>
            </div>

            <div style={{ borderTop: '2px solid #CBD5E1', paddingTop: '12px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '17px', fontWeight: '900', color: '#0F172A' }}>
              <span>Net Payable Salary</span>
              <span style={{ color: '#059669' }}>₹{activeEmployeePayslip ? (parseInt(activeEmployeePayslip.net_paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '1,98,000.00'}</span>
            </div>
          </div>
        </div>
      )}

      {/* HR ADMIN ITMEMIZED PAYROLL RUN TABLE */}
      {(persona === 'HR_ADMIN' || persona === 'AUDITOR' || persona === 'MANAGER') && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
            Itemized Employee Payroll Ledger — {selectedMonth}
          </h2>

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>Calculating payroll ledger...</div>
          ) : payslips.length === 0 && (!previewData || previewData.items.length === 0) ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No processed payroll records for {selectedMonth}. Click "1. Preview Payroll Run" or "2. Process Payroll Run".
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: '700' }}>
                    <th style={{ padding: '12px 16px' }}>Employee</th>
                    <th style={{ padding: '12px 16px' }}>Basic</th>
                    <th style={{ padding: '12px 16px' }}>HRA</th>
                    <th style={{ padding: '12px 16px' }}>Allowances</th>
                    <th style={{ padding: '12px 16px' }}>Gross Pay</th>
                    <th style={{ padding: '12px 16px' }}>PF (12% Cap)</th>
                    <th style={{ padding: '12px 16px' }}>PT</th>
                    <th style={{ padding: '12px 16px' }}>LOP Days</th>
                    <th style={{ padding: '12px 16px' }}>LOP Deduction</th>
                    <th style={{ padding: '12px 16px' }}>Net Pay</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(previewData ? previewData.items : payslips.map(ps => ({
                    person_id: ps.person_id,
                    name: ps.applicant_name || person.name,
                    basic: (parseInt(ps.basic_paise) / 100).toFixed(2),
                    hra: (parseInt(ps.hra_paise) / 100).toFixed(2),
                    allowances: (parseInt(ps.allowances_paise) / 100).toFixed(2),
                    gross_pay: (parseInt(ps.gross_paise) / 100).toFixed(2),
                    pf_deduction: (parseInt(ps.pf_deduction_paise) / 100).toFixed(2),
                    pt_deduction: (parseInt(ps.pt_deduction_paise) / 100).toFixed(2),
                    lop_days: ps.lop_days,
                    lop_deduction: (parseInt(ps.lop_deduction_paise) / 100).toFixed(2),
                    total_deductions: (parseInt(ps.total_deductions_paise) / 100).toFixed(2),
                    net_pay: (parseInt(ps.net_paise) / 100).toFixed(2),
                    status: ps.status,
                  }))).map((item, idx) => (
                    <tr key={item.person_id || idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0F172A' }}>{item.name}</td>
                      <td style={{ padding: '12px 16px' }}>₹{parseFloat(item.basic).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 16px' }}>₹{parseFloat(item.hra).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 16px' }}>₹{parseFloat(item.allowances).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '700' }}>₹{parseFloat(item.gross_pay).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 16px', color: '#DC2626' }}>-₹{parseFloat(item.pf_deduction).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 16px', color: '#DC2626' }}>-₹{parseFloat(item.pt_deduction).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: item.lop_days > 0 ? '#DC2626' : '#64748B' }}>{item.lop_days}</td>
                      <td style={{ padding: '12px 16px', color: '#DC2626' }}>-₹{parseFloat(item.lop_deduction).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '800', color: '#059669' }}>₹{parseFloat(item.net_pay).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: currentRun?.status === 'LOCKED' ? '#FEE2E2' : '#ECFDF5', color: currentRun?.status === 'LOCKED' ? '#DC2626' : '#059669' }}>
                          {currentRun?.status || 'PROCESSED'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PRINTABLE PAYSLIP DOCUMENT MODAL */}
      {printablePayslip && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div id="printable-payslip-doc" style={{ background: '#FFFFFF', borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '640px', border: '1px solid #E2E8F0', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0F172A', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#0F172A' }}>VOLKS HRMS ENTERPRISE</h1>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>Official Salary Slip & Earnings Record</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Pay Period: {printablePayslip.month}</div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Doc Ref: {printablePayslip.payslip_id.substring(0, 8)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', background: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>
              <div><strong>Employee Name:</strong> {printablePayslip.applicant_name || person.name}</div>
              <div><strong>Employee ID:</strong> {person.id}</div>
              <div><strong>Designation:</strong> {person.title}</div>
              <div><strong>Department:</strong> {person.dept}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#059669', textTransform: 'uppercase' }}>Earnings</h4>
                <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>Basic:</span><span>₹{(parseInt(printablePayslip.basic_paise)/100).toLocaleString('en-IN')}</span></div>
                <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>HRA:</span><span>₹{(parseInt(printablePayslip.hra_paise)/100).toLocaleString('en-IN')}</span></div>
                <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>Allowances:</span><span>₹{(parseInt(printablePayslip.allowances_paise)/100).toLocaleString('en-IN')}</span></div>
                <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '4px', fontSize: '13px', fontWeight: '800', display: 'flex', justifyContent: 'space-between' }}><span>Total Gross:</span><span>₹{(parseInt(printablePayslip.gross_paise)/100).toLocaleString('en-IN')}</span></div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#DC2626', textTransform: 'uppercase' }}>Deductions</h4>
                <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>PF Policy:</span><span>-₹{(parseInt(printablePayslip.pf_deduction_paise)/100).toLocaleString('en-IN')}</span></div>
                <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>PT Policy:</span><span>-₹{(parseInt(printablePayslip.pt_deduction_paise)/100).toLocaleString('en-IN')}</span></div>
                <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>LOP ({printablePayslip.lop_days} days):</span><span>-₹{(parseInt(printablePayslip.lop_deduction_paise)/100).toLocaleString('en-IN')}</span></div>
                <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '4px', fontSize: '13px', fontWeight: '800', display: 'flex', justifyContent: 'space-between', color: '#DC2626' }}><span>Total Deductions:</span><span>-₹{(parseInt(printablePayslip.total_deductions_paise)/100).toLocaleString('en-IN')}</span></div>
              </div>
            </div>

            <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#065F46' }}>Net Payable Amount:</span>
              <span style={{ fontSize: '20px', fontWeight: '900', color: '#059669' }}>₹{(parseInt(printablePayslip.net_paise)/100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setPrintablePayslip(null)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontWeight: '700', cursor: 'pointer' }}>Close</button>
              <button onClick={() => window.print()} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: '#0F172A', color: '#FFFFFF', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Printer size={14} /> Print Document</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
