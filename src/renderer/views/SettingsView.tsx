import React, { useEffect, useState } from 'react';
import { SETTINGS_KEYS, ADMIN_ROLES } from '../../shared/appConfig';

interface SettingsViewProps {
  currentUser: any;
  onBack: () => void;
}

const StatusDot: React.FC<{ ok: boolean | null }> = ({ ok }) => (
  <span style={{
    display: 'inline-block',
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: ok === null ? 'var(--text-disabled)' : ok ? 'var(--success)' : 'var(--error)',
    flexShrink: 0,
    boxShadow: ok ? '0 0 6px var(--success)' : ok === false ? '0 0 6px var(--error)' : 'none'
  }} />
);

const StatusRow: React.FC<{ label: string; ok: boolean | null; value?: string }> = ({ label, ok, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
    <StatusDot ok={ok} />
    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flexGrow: 1 }}>{label}</span>
    <span style={{
      fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 'var(--radius-sm)',
      background: ok === null ? 'rgba(255,255,255,0.05)' : ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
      color: ok === null ? 'var(--text-disabled)' : ok ? 'var(--success)' : 'var(--error)',
      border: `1px solid ${ok === null ? 'rgba(255,255,255,0.06)' : ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
    }}>
      {ok === null ? '—' : value || (ok ? 'Ready' : 'Missing')}
    </span>
  </div>
);

const roleLabel = (role: string) => {
  switch (role) {
    case 'master_admin': return 'Master Admin';
    case 'admin': return 'Admin';
    case 'manager': return 'Manager';
    default: return 'Member';
  }
};

export const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, onBack }) => {
  const isAdmin = ADMIN_ROLES.includes(currentUser?.role_key);

  // Admin-only state
  const [outputDir, setOutputDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [supabaseStatus, setSupabaseStatus] = useState<any>(null);
  const [connectingSupabase, setConnectingSupabase] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [repairLog, setRepairLog] = useState('');

  // Support ticket state
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketType, setTicketType] = useState<'technical_support' | 'platform_feature'>('technical_support');
  const [ticketPriority, setTicketPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketStatus, setTicketStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [ticketError, setTicketError] = useState('');

  const loadSupabaseStatus = async () => {
    try {
      const status = await window.api.supabase.getStatus();
      setSupabaseStatus(status);
    } catch (err: any) {
      setSupabaseStatus({ configured: false, authenticated: false, error: err?.message });
    }
  };

  const runDiagnostics = async () => {
    setDiagnosing(true);
    setDiagnosticResult(null);
    try {
      const res = await window.api.engine.runDiagnostics();
      setDiagnosticResult(res);
    } catch (err) {
      setDiagnosticResult({ pythonAvailable: false, engineAvailable: false, playwrightAvailable: false, chromiumAvailable: false, error: String(err) });
    } finally {
      setDiagnosing(false);
    }
  };

  const repairChromium = async () => {
    setRepairing(true);
    setRepairLog('Starting browser installation...\n');
    try {
      const unsubscribe = window.api.engine.onProgress((event: any, data: any) => {
        if (data.action === 'repair' && data.message) {
          setRepairLog(prev => prev + data.message);
        }
      });
      const success = await window.api.engine.repairChromium();
      unsubscribe();
      if (success) {
        setRepairLog(prev => prev + '\nInstallation completed.');
        await runDiagnostics();
      } else {
        setRepairLog(prev => prev + '\nInstallation failed.');
      }
    } catch (err: any) {
      setRepairLog(prev => prev + `\nError: ${err.message || err}`);
    } finally {
      setRepairing(false);
    }
  };

  useEffect(() => {
    async function load() {
      try {
        if (isAdmin) {
          const outDir = await window.api.settings.getValue(SETTINGS_KEYS.outputDir);
          const defaultOutDir = await window.api.settings.getDefaultOutputDir();
          setOutputDir(outDir || defaultOutDir);
          await loadSupabaseStatus();
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isAdmin]);

  const handleSavePath = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    try {
      await window.api.settings.saveValue(SETTINGS_KEYS.outputDir, outputDir);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleConnectSupabase = async () => {
    setConnectingSupabase(true);
    try {
      await window.api.supabase.authenticateAnonymous();
      await loadSupabaseStatus();
    } catch (err: any) {
      console.error(err);
    } finally {
      setConnectingSupabase(false);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketTitle.trim()) return;
    setTicketSubmitting(true);
    setTicketError('');
    try {
      await window.api.crm.createSupportTicket(
        ticketTitle.trim(),
        ticketDescription.trim(),
        ticketType,
        ticketPriority
      );
      setTicketStatus('success');
      setTicketTitle('');
      setTicketDescription('');
      setTicketType('technical_support');
      setTicketPriority('medium');
      setTimeout(() => { setTicketStatus('idle'); setShowTicketForm(false); }, 3000);
    } catch (err: any) {
      setTicketError(err.message || 'Failed to submit ticket.');
      setTicketStatus('error');
    } finally {
      setTicketSubmitting(false);
    }
  };

  const allDiagOk = diagnosticResult?.pythonAvailable && diagnosticResult?.engineAvailable
    && diagnosticResult?.playwrightAvailable && diagnosticResult?.chromiumAvailable;
  const needsRepair = diagnosticResult && (!diagnosticResult.playwrightAvailable || !diagnosticResult.chromiumAvailable);

  if (!isAdmin && loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '14px', color: 'var(--text-secondary)' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="content-panel">
      <div className="view-header">
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent-gold-muted)', fontFamily: 'Clash Display, sans-serif', fontWeight: 600 }}>
            PolyNovea Content Studio
          </span>
          <h2 className="view-title" style={{ marginTop: '4px' }}>Settings</h2>
        </div>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
      </div>

      <div className="view-scroll-content" style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── Profile ── */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-disabled)', marginBottom: '6px' }}>
              Account
            </div>
            <h3 style={{ fontFamily: 'Clash Display, sans-serif', fontSize: '16px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              Your Profile
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '18px' }}>
            <StatusRow label="Name" ok={true} value={currentUser?.full_name || '—'} />
            <StatusRow label="Email" ok={true} value={currentUser?.email || '—'} />
            <StatusRow label="Role" ok={true} value={roleLabel(currentUser?.role_key)} />
          </div>
        </div>

        {/* ── Contact Support ── */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-disabled)', marginBottom: '6px' }}>
              Help
            </div>
            <h3 style={{ fontFamily: 'Clash Display, sans-serif', fontSize: '16px', fontWeight: 600, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
              Contact Support
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
              Report a bug or request a feature. Your ticket goes directly to the PolyNovea team via the CRM.
            </p>
          </div>

          {!showTicketForm ? (
            <button className="btn btn-primary" style={{ fontSize: '13px' }} onClick={() => setShowTicketForm(true)}>
              + Raise a Ticket
            </button>
          ) : (
            <form onSubmit={handleSubmitTicket} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={ticketTitle}
                  onChange={e => setTicketTitle(e.target.value)}
                  placeholder="Brief description of the issue or request"
                  required
                  disabled={ticketSubmitting}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Type</label>
                  <select className="form-input form-select" value={ticketType} onChange={e => setTicketType(e.target.value as any)} disabled={ticketSubmitting}>
                    <option value="technical_support">Bug / Support</option>
                    <option value="platform_feature">Feature Request</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Priority</label>
                  <select className="form-input form-select" value={ticketPriority} onChange={e => setTicketPriority(e.target.value as any)} disabled={ticketSubmitting}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Description <span style={{ color: 'var(--text-disabled)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={ticketDescription}
                  onChange={e => setTicketDescription(e.target.value)}
                  placeholder="Steps to reproduce, expected vs actual behaviour, screenshots description..."
                  disabled={ticketSubmitting}
                />
              </div>

              {ticketStatus === 'error' && (
                <div style={{ fontSize: '12px', color: 'var(--error)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                  {ticketError}
                </div>
              )}
              {ticketStatus === 'success' && (
                <div style={{ fontSize: '12px', color: 'var(--success)', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                  Ticket submitted — the team will follow up in the CRM.
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary" disabled={ticketSubmitting || !ticketTitle.trim()}>
                  {ticketSubmitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowTicketForm(false); setTicketStatus('idle'); setTicketError(''); }} disabled={ticketSubmitting}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ── Admin-only sections ── */}
        {isAdmin && (
          <>
            {/* Export Path */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-disabled)', marginBottom: '6px' }}>
                  Output Configuration
                </div>
                <h3 style={{ fontFamily: 'Clash Display, sans-serif', fontSize: '16px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                  Export Directory
                </h3>
              </div>
              <form onSubmit={handleSavePath}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Default Output Path</label>
                  <input
                    type="text"
                    className="form-input"
                    value={outputDir}
                    onChange={e => setOutputDir(e.target.value)}
                    placeholder="e.g. D:\MyContent\PolyNovea"
                    required
                  />
                  <span className="form-hint">All revision HTML, PNG, and PDF exports will be written here.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button type="submit" className="btn btn-primary" disabled={saveStatus === 'saving'}>
                    {saveStatus === 'saving' ? 'Saving...' : 'Save Path'}
                  </button>
                  {saveStatus === 'saved' && <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 500 }}>Saved</span>}
                  {saveStatus === 'error' && <span style={{ fontSize: '12px', color: 'var(--error)', fontWeight: 500 }}>Save failed</span>}
                </div>
              </form>
            </div>

            {/* AI Service */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-disabled)', marginBottom: '6px' }}>
                  AI Backend
                </div>
                <h3 style={{ fontFamily: 'Clash Display, sans-serif', fontSize: '16px', fontWeight: 600, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  AI Service Connection
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
                  Server-side AI proxy. API keys stay on the backend — nothing is stored on this machine.
                </p>
              </div>
              {supabaseStatus ? (
                <div style={{ marginBottom: '18px', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <StatusRow label="Service configured" ok={supabaseStatus.configured ?? null} />
                  <StatusRow label="Session authenticated" ok={supabaseStatus.authenticated ?? null} />
                  <StatusRow label="Session type" ok={supabaseStatus.authenticated ?? null} value={supabaseStatus.isAnonymous ? 'Anonymous' : 'Identified'} />
                  {supabaseStatus.userId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0' }}>
                      <span style={{ width: '7px', flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', color: 'var(--text-disabled)', fontFamily: 'JetBrains Mono, Consolas, monospace', wordBreak: 'break-all' }}>
                        Session: {supabaseStatus.userId}
                      </span>
                    </div>
                  )}
                  {supabaseStatus.error && <div className="error-log" style={{ marginTop: '12px', fontSize: '11px' }}>{supabaseStatus.error}</div>}
                </div>
              ) : (
                <div style={{ padding: '16px 0', color: 'var(--text-disabled)', fontSize: '12px' }}>Checking service status...</div>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" style={{ fontSize: '12px' }} onClick={handleConnectSupabase} disabled={connectingSupabase}>
                  {connectingSupabase ? 'Refreshing...' : 'Refresh Session'}
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={loadSupabaseStatus}>
                  Recheck Status
                </button>
              </div>
            </div>

            {/* Rendering Engine */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-disabled)', marginBottom: '6px' }}>
                  Local Renderer
                </div>
                <h3 style={{ fontFamily: 'Clash Display, sans-serif', fontSize: '16px', fontWeight: 600, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  Rendering Engine & Diagnostics
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
                  Verify Python, engine script, and Playwright Chromium are all operational.
                </p>
              </div>
              {diagnosticResult && (
                <div style={{ marginBottom: '18px', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <StatusRow label="Python interpreter" ok={diagnosticResult.pythonAvailable} />
                  <StatusRow label="Engine CLI script" ok={diagnosticResult.engineAvailable} />
                  <StatusRow label="Playwright library" ok={diagnosticResult.playwrightAvailable} />
                  <StatusRow label="Chromium headless browser" ok={diagnosticResult.chromiumAvailable} />
                  {diagnosticResult.error && <div className="error-log" style={{ marginTop: '12px', fontSize: '11px' }}>{diagnosticResult.error}</div>}
                  {allDiagOk && (
                    <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--success)', fontWeight: 500 }}>
                      All systems operational.
                    </div>
                  )}
                </div>
              )}
              {repairing && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--accent-violet)', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="spinner" style={{ width: '12px', height: '12px' }} /> Installing Chromium...
                  </div>
                  <div className="error-log" style={{ color: 'var(--success)', maxHeight: '100px', overflowY: 'auto', fontSize: '10px' }}>{repairLog}</div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={runDiagnostics} disabled={diagnosing || repairing}>
                  {diagnosing ? <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div className="spinner" style={{ width: '12px', height: '12px' }} /> Checking...</span> : 'Run Diagnostics'}
                </button>
                {needsRepair && (
                  <button className="btn btn-primary" style={{ fontSize: '12px' }} onClick={repairChromium} disabled={diagnosing || repairing}>
                    Repair Browser
                  </button>
                )}
              </div>
            </div>

          </>
        )}

        <div style={{ padding: '0 4px 24px', fontSize: '11px', color: 'var(--text-disabled)', display: 'flex', gap: '20px' }}>
          <span>PolyNovea Content Studio</span>
          <span>·</span>
          <span>v{currentUser?.role_key === 'master_admin' || currentUser?.role_key === 'admin' ? 'Admin Build' : 'Team Build'}</span>
        </div>
      </div>
    </div>
  );
};
