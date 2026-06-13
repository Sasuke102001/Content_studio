import React, { useState, useEffect } from 'react';
import {
  DEFAULT_CUSTOM_PALETTE,
  FONT_OPTIONS,
  FONT_PAIRING_PRESETS,
  LAYOUT_DIRECTION_PRESETS,
  PALETTE_PRESETS,
  STYLE_STRENGTH_PRESETS
} from '../../shared/designOptions';

interface DashboardViewProps {
  currentUser: any;
  onOpenProject: (projectId: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ currentUser, onOpenProject, onOpenSettings, onLogout }) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [name, setName] = useState('');
  const [mode, setMode] = useState('instagram');
  const [lang, setLang] = useState('en');
  const [langStyle, setLangStyle] = useState('formal');
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [palettePreset, setPalettePreset] = useState('brand_dark');
  const [fontPairingPreset, setFontPairingPreset] = useState('polynovea_default');
  const [headingFont, setHeadingFont] = useState('Clash Display');
  const [bodyFont, setBodyFont] = useState('Inter');
  const [layoutDirection, setLayoutDirection] = useState('editorial');
  const [styleStrength, setStyleStrength] = useState('balanced');
  const [artDirectionNotes, setArtDirectionNotes] = useState('');
  const [customPalette, setCustomPalette] = useState({ ...DEFAULT_CUSTOM_PALETTE });

  const [setupState, setSetupState] = useState<'checking' | 'ready' | 'missing' | 'installing' | 'failed'>('checking');
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const [setupError, setSetupError] = useState('');

  // Load projects on mount
  const loadProjects = async () => {
    try {
      const list = await window.api.projects.list();
      setProjects(list);

      const status = await window.api.supabase.getStatus();
      setSupabaseReady(status.authenticated);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setSupabaseReady(false);
    } finally {
      setLoading(false);
    }
  };

  const checkDiagnostics = async () => {
    try {
      setSetupState('checking');
      const results = await window.api.engine.runDiagnostics();
      if (results.chromiumAvailable && results.playwrightAvailable) {
        setSetupState('ready');
        loadProjects();
      } else {
        setSetupState('missing');
        setSetupError(results.error || 'Chromium rendering engine is missing.');
        setLoading(false);
      }
    } catch (err: any) {
      setSetupState('failed');
      setSetupError(err.message || 'Failed to run diagnostics.');
      setLoading(false);
    }
  };

  useEffect(() => {
    checkDiagnostics();
  }, []);

  const handleInstall = async () => {
    setSetupState('installing');
    setInstallLogs(['Starting Chromium install/repair process...']);
    
    // Listen to progress events
    const unsubscribe = window.api.engine.onProgress((event: any, data: any) => {
      if (data && data.action === 'repair') {
        if (data.message) {
          setInstallLogs(prev => [...prev, data.message]);
        }
      }
    });

    try {
      const success = await window.api.engine.repairChromium();
      unsubscribe();
      if (success) {
        setInstallLogs(prev => [...prev, 'Chromium setup completed successfully! Verification in progress...']);
        // Verify again
        const results = await window.api.engine.runDiagnostics();
        if (results.chromiumAvailable && results.playwrightAvailable) {
          setSetupState('ready');
          loadProjects();
        } else {
          setSetupState('failed');
          setSetupError(results.error || 'Setup completed but verification failed.');
        }
      } else {
        setSetupState('failed');
        setSetupError('Playwright chromium installer exited with non-zero code.');
      }
    } catch (err: any) {
      unsubscribe();
      setSetupState('failed');
      setSetupError(err.message || 'An error occurred during Chromium installation.');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    try {
      const customPaletteJson =
        palettePreset === 'custom' ? JSON.stringify(customPalette) : undefined;
      const newProj = await window.api.projects.create(
        name,
        mode,
        lang,
        langStyle,
        palettePreset,
        fontPairingPreset,
        headingFont,
        bodyFont,
        layoutDirection,
        styleStrength,
        artDirectionNotes,
        customPaletteJson
      );
      window.api.telemetry.log('project_created', {
        project_id: newProj.id,
        mode,
        lang,
        lang_style: langStyle,
        palette_preset: palettePreset,
        font_pairing_preset: fontPairingPreset,
        layout_direction: layoutDirection,
        style_strength: styleStrength,
        has_art_direction: !!artDirectionNotes.trim()
      });

      setShowModal(false);
      setName('');
      setPalettePreset('brand_dark');
      setFontPairingPreset('polynovea_default');
      setHeadingFont('Clash Display');
      setBodyFont('Inter');
      setLayoutDirection('editorial');
      setStyleStrength('balanced');
      setArtDirectionNotes('');
      setCustomPalette({ ...DEFAULT_CUSTOM_PALETTE });
      // Navigate straight to the workspace for the new project
      onOpenProject(newProj.id);
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Avoid triggering open card
    if (!confirm('Are you sure you want to delete this project and all its revisions?')) return;
    try {
      await window.api.projects.delete(id);
      loadProjects();
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const formatModeName = (m: string) => {
    switch(m) {
      case 'linkedin': return 'LinkedIn Document';
      case 'instagram': return 'Biz Instagram';
      case 'personal': return 'Founder Personal Brand';
      case 'threads': return 'Threads Carousel';
      case 'blog': return 'Blog Post';
      case 'reel': return 'AI Motion Reel';
      default: return m;
    }
  };

  if (setupState === 'checking' || (setupState === 'ready' && loading)) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100vh',
        color: 'var(--text-secondary)',
        gap: '14px',
      }}>
        <div className="spinner" />
        <span style={{ fontSize: '13px', letterSpacing: '0.04em' }}>Initializing workspace...</span>
      </div>
    );
  }

  if (setupState !== 'ready') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '40px 20px',
        width: '100%',
      }}>
        <div style={{
          maxWidth: '520px',
          width: '100%',
          background: 'rgba(18, 18, 18, 0.9)',
          border: '1px solid var(--border-muted)',
          borderRadius: 'var(--radius-lg)',
          padding: '36px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
        }}>
          <h2 style={{
            fontFamily: 'Clash Display, sans-serif',
            fontSize: '22px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '10px',
            marginTop: 0,
          }}>
            Renderer Setup Required
          </h2>
          <p style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: '1.65',
            marginBottom: '28px',
            marginTop: 0,
          }}>
            PolyNovea requires Playwright's Chromium engine to export slide layouts to PNG and PDF. This is a one-time download (~150 MB).
          </p>

          {setupState === 'missing' && (
            <div>
              <div style={{
                background: 'rgba(124, 58, 237, 0.08)',
                border: '1px solid rgba(124, 58, 237, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                marginBottom: '24px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}>
                <strong style={{ color: 'var(--text-primary)' }}>Status:</strong> Chromium rendering engine is missing.
              </div>
              <button className="btn btn-primary" onClick={handleInstall} style={{ width: '100%' }}>
                Download & Configure Renderer
              </button>
            </div>
          )}

          {setupState === 'installing' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div className="spinner" />
                <span style={{ fontSize: '13px', color: 'var(--accent-violet)', fontWeight: 500 }}>
                  Downloading & configuring Chromium...
                </span>
              </div>
              <div style={{
                height: '180px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-muted)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                fontFamily: 'JetBrains Mono, Consolas, monospace',
                fontSize: '11px',
                color: 'var(--success)',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6',
              }}>
                {installLogs.map((log, idx) => <div key={idx}>{log}</div>)}
              </div>
            </div>
          )}

          {setupState === 'failed' && (
            <div>
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                color: 'var(--error)',
                fontSize: '13px',
                marginBottom: '24px',
                wordBreak: 'break-word',
              }}>
                <strong>Setup failed.</strong>
                <p style={{ marginTop: '8px', fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: '11px', opacity: 0.85 }}>
                  {setupError}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={checkDiagnostics} style={{ flex: 1 }}>
                  Re-check Diagnostics
                </button>
                <button className="btn btn-primary" onClick={handleInstall} style={{ flex: 1 }}>
                  Retry Setup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }


  return (
    <div className="content-panel">
      <div className="view-header">
        <div>
          <h2 className="view-title">Content Workspace</h2>
          <div className="view-subtitle">Generate premium outlines, slides, and copy</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {currentUser?.full_name && (
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {currentUser.full_name}
            </span>
          )}
          <button className="btn btn-secondary" onClick={onOpenSettings}>
            Settings
          </button>
          <button className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={onLogout}>
            Sign Out
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New Project
          </button>
        </div>
      </div>

      <div className="view-scroll-content">
        {!supabaseReady && (
          <div style={{
            marginBottom: '28px',
            padding: '14px 20px',
            background: 'rgba(239, 68, 68, 0.07)',
            border: '1px solid rgba(239, 68, 68, 0.22)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--error)',
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
          }}>
            <span><strong style={{ color: 'var(--text-primary)' }}>AI service not ready.</strong> Retrying internal connection. If this persists, check Settings → Diagnostics.</span>
            <button className="btn btn-secondary" style={{ padding: '6px 16px', fontSize: '11px', flexShrink: 0 }} onClick={loadProjects}>
              Retry
            </button>
          </div>
        )}

        {projects.length === 0 ? (
          <div style={{
            padding: '80px 40px',
            textAlign: 'center',
            background: 'rgba(24, 24, 27, 0.4)',
            border: '1px dashed var(--border-muted)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <h3 style={{ fontFamily: 'Clash Display, sans-serif', fontSize: '20px', fontWeight: 600, marginBottom: '10px', marginTop: 0, color: 'var(--accent-gold)' }}>
              Create your first project
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '360px', margin: '0 auto 28px auto', lineHeight: '1.65' }}>
              Select a visual mode, write a plain-English direction, and build your revision history.
            </p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              + New Project
            </button>
          </div>
        ) : (
          <div className="card-grid">
            {projects.map((proj) => (
              <div key={proj.id} className="card" onClick={() => onOpenProject(proj.id)}>
                <div className="card-tag">{formatModeName(proj.mode)}</div>
                <h3 className="card-title">{proj.name}</h3>
                
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Language: {proj.default_language.toUpperCase()} ({proj.default_language_style})
                </div>

                <div className="card-meta">
                  <span>Created: {new Date(proj.created_at).toLocaleDateString()}</span>
                  <span 
                    style={{ color: 'var(--error)', cursor: 'pointer' }}
                    onClick={(e) => handleDelete(e, proj.id)}
                  >
                    Delete
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">New Content Project</h3>
            </div>

            <form id="create-project-form" onSubmit={handleCreate} style={{ display: 'contents' }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Project Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Behavioral Science Launch"
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Platform Mode</label>
                  <select
                    className="form-input form-select"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    <option value="instagram">Instagram Company Page (4:5 Portrait PNGs)</option>
                    <option value="linkedin">LinkedIn Document Carousel (1:1 Square PNGs + PDF)</option>
                    <option value="threads">Threads Sequence (4:5 Slides + Text Copy)</option>
                    <option value="blog">Blog Post (Markdown + HTML Draft)</option>
                    <option value="reel">AI Motion Reel (9:16 Vertical MP4)</option>
                  </select>
                  <span className="form-hint">
                    {mode === 'instagram' && 'Outputs: 6 slides at 1080×1350 px (4:5). PNG files only.'}
                    {mode === 'linkedin' && 'Outputs: 7 slides at 1080×1080 px (1:1). PNG files + combined PDF.'}
                    {mode === 'threads' && 'Outputs: 6 slides at 1080×1350 px (4:5). PNGs + copyable text posts.'}
                    {mode === 'blog' && 'Outputs: Markdown draft + styled HTML preview file.'}
                    {mode === 'reel' && 'Outputs: a 1080×1920 vertical motion reel, 5-20s, rendered to MP4.'}
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Default Translation Style</label>
                  <select
                    className="form-input form-select"
                    value={lang}
                    onChange={(e) => setLang(e.target.value)}
                  >
                    <option value="en">English Only</option>
                    <option value="hi">Hindi (Devanagari script)</option>
                    <option value="hi-Latn">Hinglish (Colloquial mixed Hindi-English in Roman script)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Language Tone</label>
                  <select
                    className="form-input form-select"
                    value={langStyle}
                    onChange={(e) => setLangStyle(e.target.value)}
                  >
                    <option value="formal">Formal &amp; Analytical</option>
                    <option value="colloquial">Colloquial &amp; Dynamic</option>
                    <option value="transliterated">Transliterated Roman Hindi</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Palette System</label>
                  <select
                    className="form-input form-select"
                    value={palettePreset}
                    onChange={(e) => setPalettePreset(e.target.value)}
                  >
                    {PALETTE_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.label}</option>
                    ))}
                  </select>
                  <span className="form-hint">
                    {PALETTE_PRESETS.find((p) => p.id === palettePreset)?.description}
                  </span>
                </div>

                {palettePreset === 'custom' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
                    {Object.entries(customPalette).map(([key, value]) => (
                      <div className="form-group" key={key} style={{ marginBottom: 0 }}>
                        <label className="form-label">{key}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={value}
                          onChange={(e) => setCustomPalette((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder="#000000"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Font Pairing</label>
                    <select
                      className="form-input form-select"
                      value={fontPairingPreset}
                      onChange={(e) => {
                        const nextPreset = e.target.value;
                        setFontPairingPreset(nextPreset);
                        const preset = FONT_PAIRING_PRESETS.find((item) => item.id === nextPreset);
                        if (preset && nextPreset !== 'custom') {
                          setHeadingFont(preset.headingFont);
                          setBodyFont(preset.bodyFont);
                        }
                      }}
                    >
                      {FONT_PAIRING_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>{preset.label}</option>
                      ))}
                    </select>
                    <span className="form-hint">
                      {FONT_PAIRING_PRESETS.find((p) => p.id === fontPairingPreset)?.description}
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Layout Direction</label>
                    <select
                      className="form-input form-select"
                      value={layoutDirection}
                      onChange={(e) => setLayoutDirection(e.target.value)}
                    >
                      {LAYOUT_DIRECTION_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>{preset.label}</option>
                      ))}
                    </select>
                    <span className="form-hint">
                      {LAYOUT_DIRECTION_PRESETS.find((p) => p.id === layoutDirection)?.description}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Heading Font</label>
                    <select
                      className="form-input form-select"
                      value={headingFont}
                      onChange={(e) => {
                        setHeadingFont(e.target.value);
                        setFontPairingPreset('custom');
                      }}
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Body Font</label>
                    <select
                      className="form-input form-select"
                      value={bodyFont}
                      onChange={(e) => {
                        setBodyFont(e.target.value);
                        setFontPairingPreset('custom');
                      }}
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Style Strength</label>
                  <select
                    className="form-input form-select"
                    value={styleStrength}
                    onChange={(e) => setStyleStrength(e.target.value)}
                  >
                    {STYLE_STRENGTH_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.label}</option>
                    ))}
                  </select>
                  <span className="form-hint">
                    {STYLE_STRENGTH_PRESETS.find((p) => p.id === styleStrength)?.description}
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Custom Visual Direction <span style={{ color: 'var(--text-disabled)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                  <textarea
                    className="form-input"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    value={artDirectionNotes}
                    onChange={(e) => setArtDirectionNotes(e.target.value)}
                    placeholder="Example: Use the presentation palette, keep the typography restrained, but push the layouts to feel more editorial and asymmetrical."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
