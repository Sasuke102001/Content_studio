import React, { useState, useEffect, useRef } from 'react';
import {
  DEFAULT_CUSTOM_PALETTE,
  FONT_OPTIONS,
  FONT_PAIRING_PRESETS,
  LAYOUT_DIRECTION_PRESETS,
  PALETTE_PRESETS,
  STYLE_STRENGTH_PRESETS
} from '../../shared/designOptions';
import type { ReelScript } from '../../shared/reelSchema';

interface WorkspaceViewProps {
  projectId: string;
  currentUser?: any;
  onBack: () => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({ projectId, currentUser, onBack }) => {
  const [project, setProject] = useState<any>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [activeRevision, setActiveRevision] = useState<any>(null);

  // Edit / Form states
  const [inputDirection, setInputDirection] = useState('');
  const [inputContext, setInputContext] = useState('');
  const [exportPdf, setExportPdf] = useState(true);
  const [lang, setLang] = useState('en');
  const [langStyle, setLangStyle] = useState('formal');
  const [ctaLangStyle, setCtaLangStyle] = useState('formal');
  const [customLangDirectives, setCustomLangDirectives] = useState('');
  const [palettePreset, setPalettePreset] = useState('brand_dark');
  const [fontPairingPreset, setFontPairingPreset] = useState('polynovea_default');
  const [headingFont, setHeadingFont] = useState('Clash Display');
  const [bodyFont, setBodyFont] = useState('Inter');
  const [layoutDirection, setLayoutDirection] = useState('editorial');
  const [styleStrength, setStyleStrength] = useState('balanced');
  const [artDirectionNotes, setArtDirectionNotes] = useState('');
  const [customPalette, setCustomPalette] = useState({ ...DEFAULT_CUSTOM_PALETTE });

  // Generation content states
  const [planContent, setPlanContent] = useState('');
  const [blogContent, setBlogContent] = useState('');
  const [blogHtmlContent, setBlogHtmlContent] = useState('');
  const [blogTab, setBlogTab] = useState<'markdown' | 'preview'>('markdown');
  const [threadTexts, setThreadTexts] = useState<string[]>([]);

  // Reel (AI Motion Reel) states
  const [reelScript, setReelScript] = useState<ReelScript | null>(null);
  const [reelVideoDataUrl, setReelVideoDataUrl] = useState('');
  const [reelRendering, setReelRendering] = useState(false);
  const [reelRenderProgress, setReelRenderProgress] = useState(0);

  // Helper to parse thread text copy blocks
  const parseThreadTexts = (html: string): string[] => {
    const texts: string[] = [];
    const regex = /<div[^>]*class="[^"]*thread-text-copy[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      // Decode HTML entities if Kimi returns any
      const doc = new DOMParser().parseFromString(match[1], 'text/html');
      texts.push(doc.body.textContent || doc.body.innerText || match[1].trim());
    }
    return texts;
  };

  // Slides and previews
  const [slideCount, setSlideCount] = useState(0);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [activeSlideBase64, setActiveSlideBase64] = useState('');

  // Correction states
  const [correctionText, setCorrectionText] = useState('');
  const [correctionTargetSlide, setCorrectionTargetSlide] = useState(1);
  const [isCorrecting, setIsCorrecting] = useState(false);

  // Engine progress and status
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [streamedOutput, setStreamedOutput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load project details and revision history
  const loadProjectData = async (targetRevisionId?: string) => {
    try {
      const proj = await window.api.projects.get(projectId);
      setProject(proj);

      const revList = await window.api.revisions.list(projectId);
      setRevisions(revList);

      if (revList.length === 0) {
        // Create an in-memory draft if no revision exists
        const mockDraft = {
          id: 'new-draft',
          status: 'draft',
          input_direction: '',
          input_context: '',
          version: 1
        };
        setActiveRevision(mockDraft);
        setInputDirection('');
        setInputContext('');
        setLang(proj.default_language || 'en');
        setLangStyle(proj.default_language_style || 'formal');
        setPalettePreset(proj.palette_preset || 'brand_dark');
        setFontPairingPreset(proj.font_pairing_preset || 'polynovea_default');
        setHeadingFont(proj.heading_font || 'Clash Display');
        setBodyFont(proj.body_font || 'Inter');
        setLayoutDirection(proj.layout_direction || 'editorial');
        setStyleStrength(proj.style_strength || 'balanced');
        setArtDirectionNotes(proj.art_direction_notes || '');
        try {
          setCustomPalette(
            proj.custom_palette_json
              ? { ...DEFAULT_CUSTOM_PALETTE, ...JSON.parse(proj.custom_palette_json) }
              : { ...DEFAULT_CUSTOM_PALETTE }
          );
        } catch {
          setCustomPalette({ ...DEFAULT_CUSTOM_PALETTE });
        }
      } else {
        // Select target revision or default to latest
        const current = targetRevisionId 
          ? revList.find(r => r.id === targetRevisionId) 
          : revList[0];
        
        const active = current || revList[0];
        setActiveRevision(active);
        
        // Prefill directions from selected revision
        setInputDirection(active.input_direction || '');
        setInputContext(active.input_context || '');
        
        // Load language overrides
        try {
          const overrides = JSON.parse(active.language_overrides || '{}');
          setLang(overrides.default_lang || proj.default_language || 'en');
          setLangStyle(overrides.default_style || proj.default_language_style || 'formal');
          setCtaLangStyle(overrides.cta_style || 'formal');
          setCustomLangDirectives(overrides.custom_directives || '');
        } catch (e) {
          setLang(proj.default_language || 'en');
          setLangStyle(proj.default_language_style || 'formal');
        }
        try {
          const styleOverrides = JSON.parse(active.style_overrides || '{}');
          setPalettePreset(styleOverrides.palette_preset || proj.palette_preset || 'brand_dark');
          setFontPairingPreset(
            styleOverrides.font_pairing_preset || proj.font_pairing_preset || 'polynovea_default'
          );
          setHeadingFont(styleOverrides.heading_font || proj.heading_font || 'Clash Display');
          setBodyFont(styleOverrides.body_font || proj.body_font || 'Inter');
          setLayoutDirection(styleOverrides.layout_direction || proj.layout_direction || 'editorial');
          setStyleStrength(styleOverrides.style_strength || proj.style_strength || 'balanced');
          setArtDirectionNotes(styleOverrides.art_direction_notes || proj.art_direction_notes || '');
          setCustomPalette(
            styleOverrides.custom_palette
              ? { ...DEFAULT_CUSTOM_PALETTE, ...styleOverrides.custom_palette }
              : proj.custom_palette_json
                ? { ...DEFAULT_CUSTOM_PALETTE, ...JSON.parse(proj.custom_palette_json) }
                : { ...DEFAULT_CUSTOM_PALETTE }
          );
        } catch (e) {
          setPalettePreset(proj.palette_preset || 'brand_dark');
          setFontPairingPreset(proj.font_pairing_preset || 'polynovea_default');
          setHeadingFont(proj.heading_font || 'Clash Display');
          setBodyFont(proj.body_font || 'Inter');
          setLayoutDirection(proj.layout_direction || 'editorial');
          setStyleStrength(proj.style_strength || 'balanced');
          setArtDirectionNotes(proj.art_direction_notes || '');
        }

        // Load specific outputs based on status
        if (active.status === 'plan_pending' || active.status === 'generating') {
          const plan = await window.api.plans.get(active.id);
          setPlanContent(plan ? plan.raw_markdown : '');
        } else if (active.status === 'completed') {
          const plan = await window.api.plans.get(active.id);
          setPlanContent(plan ? plan.raw_markdown : '');
          
          if (proj.mode === 'blog') {
            const output = await window.api.outputs.get(active.id);
            const markdownVal = output ? output.blog_text_content : '';
            setBlogContent(markdownVal);
            setThreadTexts([]);
            try {
              const revisionDir = await window.api.projects.getRevisionDir(projectId, active.id);
              const htmlFilePath = `${revisionDir}/blog.html`;
              const htmlContent = await window.api.outputs.readFile(htmlFilePath);
              setBlogHtmlContent(htmlContent);
            } catch (err) {
              console.error('Failed to read blog.html preview:', err);
              setBlogHtmlContent('');
            }
          } else if (proj.mode === 'reel') {
            try {
              const revisionDir = await window.api.projects.getRevisionDir(projectId, active.id);
              const reelScriptPath = `${revisionDir}/reel_script.json`;
              const reelScriptText = await window.api.outputs.readFile(reelScriptPath);
              setReelScript(reelScriptText ? JSON.parse(reelScriptText) : null);

              const mp4Path = `${revisionDir}/reel.mp4`;
              const mp4Exists = await window.api.outputs.fileExists(mp4Path);
              if (mp4Exists) {
                const dataUrl = await window.api.outputs.readFileBase64(mp4Path, 'video/mp4');
                setReelVideoDataUrl(dataUrl);
              } else {
                setReelVideoDataUrl('');
              }
            } catch (err) {
              console.error('Failed to load reel script/video:', err);
              setReelScript(null);
              setReelVideoDataUrl('');
            }
          } else {
            // Load slides image list & set active index to 0
            const revisionDir = await window.api.projects.getRevisionDir(projectId, active.id);
            const slidesDirPath = `${revisionDir}/slides`;
            const files = await window.api.outputs.listSlides(slidesDirPath);
            setSlideCount(files.length);
            setActiveSlideIndex(0);

            // Parse Threads copy blocks if mode is threads
            if (proj.mode === 'threads') {
              const output = await window.api.outputs.get(active.id);
              if (output && output.html_file_path) {
                const html = await window.api.outputs.readFile(output.html_file_path);
                setThreadTexts(parseThreadTexts(html));
              } else {
                setThreadTexts([]);
              }
            } else {
              setThreadTexts([]);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load project details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  // Load slide image whenever active index or active revision changes
  useEffect(() => {
    async function loadActiveSlide() {
      if (!activeRevision || activeRevision.status !== 'completed' || project?.mode === 'blog' || project?.mode === 'reel' || activeRevision.id === 'new-draft') {
        setActiveSlideBase64('');
        return;
      }
      try {
        const revisionDir = await window.api.projects.getRevisionDir(projectId, activeRevision.id);
        const slidesDirPath = `${revisionDir}/slides`;
        const files = await window.api.outputs.listSlides(slidesDirPath);
        if (files && files.length > 0) {
          const file = files[activeSlideIndex];
          if (file) {
            const filePath = `${slidesDirPath}/${file}`;
            const base64 = await window.api.outputs.readImageBase64(filePath);
            setActiveSlideBase64(base64);
            setSlideCount(files.length);
          }
        }
      } catch (err) {
        console.error('Failed to load slide preview:', err);
      }
    }
    loadActiveSlide();
  }, [activeSlideIndex, activeRevision?.id, project?.mode]);

  // Listen to engine progress events
  useEffect(() => {
    if (!activeRevision || activeRevision.id === 'new-draft') return;
    
    const unsubscribe = window.api.engine.onProgress((event, data) => {
      if (data.revisionId === activeRevision.id) {
        if (data.percentage !== undefined) setProgressPercent(data.percentage);
        if (data.message !== undefined) setProgressMessage(data.message);
        if (data.delta !== undefined) {
          setStreamedOutput(prev => prev + data.delta);
          
          // Auto-scroll progress log to bottom
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeRevision?.id]);

  // Listen to motion (AI Motion Reel) render progress events
  useEffect(() => {
    if (!activeRevision || activeRevision.id === 'new-draft') return;

    const unsubscribe = window.api.motion.onProgress((event, data) => {
      if (data.revisionId === activeRevision.id) {
        if (data.status === 'rendering' && data.progress !== undefined) {
          setReelRenderProgress(Math.round(data.progress * 100));
        } else if (data.status === 'completed') {
          setReelRenderProgress(100);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeRevision?.id]);

  // Handler to generate Outline (Phase 1)
  const handleGenerateOutline = async () => {
    if (!inputDirection.trim()) return;

    setRunning(true);
    setProgressPercent(0);
    setProgressMessage('Initializing Planner...');
    setStreamedOutput('');
    setErrorMessage('');
    let createdRevisionId: string | null = null;

    try {
      // 1. Create language overrides JSON config
      const languageOverrides = {
        default_lang: lang,
        default_style: langStyle,
        cta_style: ctaLangStyle,
        custom_directives: customLangDirectives
      };
      const styleOverrides = {
        palette_preset: palettePreset,
        font_pairing_preset: fontPairingPreset,
        heading_font: headingFont,
        body_font: bodyFont,
        layout_direction: layoutDirection,
        style_strength: styleStrength,
        art_direction_notes: artDirectionNotes,
        custom_palette: palettePreset === 'custom' ? customPalette : null
      };

      // 2. Write new revision row to DB
      const rev = await window.api.revisions.create(
        projectId, 
        inputDirection, 
        inputContext, 
        JSON.stringify(languageOverrides),
        JSON.stringify(styleOverrides)
      );
      createdRevisionId = rev.id;

      setActiveRevision(rev);
      
      // 3. Resolve output directories
      const revisionDir = await window.api.projects.getRevisionDir(projectId, rev.id);

      // 4. Update status in db to planning
      await window.api.revisions.updateStatus(rev.id, 'planning');
      
      // Reload revisions in sidebar
      const updatedList = await window.api.revisions.list(projectId);
      setRevisions(updatedList);

      // 5. Run Python planning script
      await window.api.engine.run({
        action: 'plan',
        mode: project.mode,
        projectDir: revisionDir,
        revisionId: rev.id,
        inputDirection: inputDirection,
        inputContext: inputContext,
        languageOverrides: languageOverrides,
        styleOverrides: styleOverrides
      });

      // 6. Read the generated plan markdown
      const planFilePath = `${revisionDir}/plan.md`;
      const planText = await window.api.outputs.readFile(planFilePath);
      setPlanContent(planText);

      // 7. Save plan to DB & update status to pending approval
      await window.api.plans.save(rev.id, planText);
      await window.api.revisions.updateStatus(rev.id, 'plan_pending');

      window.api.telemetry.log('outline_generated', {
        project_id: projectId,
        revision_id: rev.id,
        mode: project.mode,
        lang,
        lang_style: langStyle,
        palette_preset: palettePreset,
        layout_direction: layoutDirection,
        style_strength: styleStrength,
        font_pairing_preset: fontPairingPreset,
        prompt_word_count: inputDirection.trim().split(/\s+/).length,
        has_context: !!inputContext.trim()
      });

      // Reload project state to sync view
      await loadProjectData(rev.id);

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error occurred during outline generation.');
      if (createdRevisionId) {
        await window.api.revisions.updateStatus(createdRevisionId, 'failed', err.message);
        loadProjectData(createdRevisionId);
      } else if (activeRevision && activeRevision.id !== 'new-draft') {
        await window.api.revisions.updateStatus(activeRevision.id, 'failed', err.message);
        loadProjectData(activeRevision.id);
      }
    } finally {
      setRunning(false);
    }
  };

  // Handler to approve plan and generate final HTML/Blog content (Phase 2 & 3)
  const handleApproveAndGenerate = async () => {
    if (!activeRevision || activeRevision.id === 'new-draft') return;

    setRunning(true);
    setProgressPercent(0);
    setProgressMessage('Generating copy & formatting visual assets...');
    setStreamedOutput('');
    setErrorMessage('');

    try {
      const revisionDir = await window.api.projects.getRevisionDir(projectId, activeRevision.id);

      window.api.telemetry.log('plan_approved', {
        project_id: projectId,
        revision_id: activeRevision.id,
        mode: project.mode,
        plan_word_count: planContent.trim().split(/\s+/).length
      });

      // 1. Save and approve edited plan text
      await window.api.plans.save(activeRevision.id, planContent);
      await window.api.plans.approve(activeRevision.id);

      // 2. Set status to generating
      await window.api.revisions.updateStatus(activeRevision.id, 'generating');
      await loadProjectData(activeRevision.id);

      // 1. Get parsed language overrides if possible
      let overridesObj = {};
      try {
        overridesObj = JSON.parse(activeRevision.language_overrides || '{}');
      } catch (e) {}
      let styleOverridesObj = {
        palette_preset: palettePreset,
        font_pairing_preset: fontPairingPreset,
        heading_font: headingFont,
        body_font: bodyFont,
        layout_direction: layoutDirection,
        style_strength: styleStrength,
        art_direction_notes: artDirectionNotes,
        custom_palette: palettePreset === 'custom' ? customPalette : null
      };
      try {
        styleOverridesObj = JSON.parse(activeRevision.style_overrides || '{}');
      } catch (e) {}

      // 3. Spawns generator action
      await window.api.engine.run({
        action: 'generate',
        mode: project.mode,
        projectDir: revisionDir,
        revisionId: activeRevision.id,
        inputDirection: activeRevision.input_direction,
        inputContext: activeRevision.input_context,
        planContent: planContent,
        languageOverrides: overridesObj,
        styleOverrides: styleOverridesObj
      });

      if (project.mode === 'blog') {
        // Read generated blog text
        const blogFilePath = `${revisionDir}/blog.md`;
        const blogText = await window.api.outputs.readFile(blogFilePath);
        
        // Save to SQLite
        await window.api.outputs.save(activeRevision.id, undefined, blogText);
        setBlogContent(blogText);
        
        // Mark as completed
        await window.api.revisions.updateStatus(activeRevision.id, 'completed');
      } else if (project.mode === 'reel') {
        // Reel generation output: a Remotion scene-script JSON
        const reelScriptPath = `${revisionDir}/reel_script.json`;
        const reelScriptText = await window.api.outputs.readFile(reelScriptPath);
        if (!reelScriptText) {
          throw new Error('Reel generation finished but produced no scene script.');
        }
        let parsedReelScript: ReelScript;
        try {
          parsedReelScript = JSON.parse(reelScriptText);
        } catch (e) {
          throw new Error('Reel generation produced an invalid scene script (not valid JSON).');
        }
        setReelScript(parsedReelScript);
        setReelVideoDataUrl('');

        await window.api.outputs.save(activeRevision.id, reelScriptPath, undefined);

        // Mark as completed
        await window.api.revisions.updateStatus(activeRevision.id, 'completed');
      } else {
        // Carousel generation output
        const htmlFilePath = `${revisionDir}/carousel.html`;
        await window.api.outputs.save(activeRevision.id, htmlFilePath, undefined);

        // Update progress UI
        setProgressMessage('Exporting high-fidelity slides...');
        setProgressPercent(80);

        // 4. Run export to generate slides & PDFs
        await window.api.engine.run({
          action: 'export',
          mode: project.mode,
          projectDir: revisionDir,
          revisionId: activeRevision.id,
          inputDirection: activeRevision.input_direction,
          inputContext: activeRevision.input_context,
          exportPdf: project.mode === 'linkedin' ? exportPdf : false
        });

        // 5. Read slides directory to verify outputs
        const slidesDirPath = `${revisionDir}/slides`;
        const slideFiles = await window.api.outputs.listSlides(slidesDirPath);

        const slidesList = slideFiles.map((file, i) => ({
          slide_number: i + 1,
          eyebrow: '',
          headline: '',
          body: '',
          language: lang,
          language_style: langStyle
        }));
        await window.api.slides.save(activeRevision.id, slidesList);

        // Save artifacts references
        for (let i = 0; i < slideFiles.length; i++) {
          const file = slideFiles[i];
          const filePath = `${slidesDirPath}/${file}`;
          await window.api.artifacts.save(activeRevision.id, 'png_slide', filePath, i + 1);
        }

        if (project.mode === 'linkedin' && exportPdf) {
          const pdfFilePath = `${revisionDir}/Polynovea_linkedin_post.pdf`;
          await window.api.artifacts.save(activeRevision.id, 'linkedin_pdf', pdfFilePath);
        }

        // Mark as completed
        await window.api.revisions.updateStatus(activeRevision.id, 'completed');
      }

      window.api.telemetry.log('content_generated', {
        project_id: projectId,
        revision_id: activeRevision.id,
        mode: project.mode,
        export_pdf: project.mode === 'linkedin' ? exportPdf : false
      });

      await loadProjectData(activeRevision.id);

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error occurred during content generation.');
      window.api.telemetry.log('generation_failed', {
        project_id: projectId,
        revision_id: activeRevision.id,
        mode: project.mode,
        error: err.message
      });
      await window.api.revisions.updateStatus(activeRevision.id, 'failed', err.message);
      loadProjectData(activeRevision.id);
    } finally {
      setRunning(false);
    }
  };

  const handleSaveBlogDraft = async () => {
    if (!activeRevision || activeRevision.id === 'new-draft') return;
    try {
      setRunning(true);
      setProgressMessage('Saving blog draft...');
      
      // Call outputs:save-blog-draft through the API
      await window.api.outputs.saveBlogDraft(projectId, activeRevision.id, blogContent);
      
      // Read back the compiled html
      const revisionDir = await window.api.projects.getRevisionDir(projectId, activeRevision.id);
      const htmlFilePath = `${revisionDir}/blog.html`;
      const htmlContent = await window.api.outputs.readFile(htmlFilePath);
      setBlogHtmlContent(htmlContent);
      
      alert('Draft saved and preview updated!');
    } catch (err: any) {
      console.error(err);
      alert(`Failed to save draft: ${err.message || err}`);
    } finally {
      setRunning(false);
    }
  };

  const handleCreateNewVersion = () => {
    window.api.telemetry.log('version_iterated', {
      project_id: projectId,
      mode: project?.mode,
      from_revision_id: activeRevision?.id !== 'new-draft' ? activeRevision?.id : undefined,
      next_version: revisions.length > 0 ? revisions[0].version + 1 : 1
    });

    const mockDraft = {
      id: 'new-draft',
      status: 'draft',
      input_direction: inputDirection,
      input_context: inputContext,
      version: revisions.length > 0 ? revisions[0].version + 1 : 1
    };
    setActiveRevision(mockDraft);
    setErrorMessage('');
    setPlanContent('');
    setBlogContent('');
    setActiveSlideBase64('');
    setSlideCount(0);
    setReelScript(null);
    setReelVideoDataUrl('');
    setReelRenderProgress(0);
    // Reset all settings back to project-level defaults
    setLang(project?.default_language || 'en');
    setLangStyle(project?.default_language_style || 'formal');
    setCtaLangStyle('formal');
    setCustomLangDirectives('');
    setPalettePreset(project?.palette_preset || 'brand_dark');
    setFontPairingPreset(project?.font_pairing_preset || 'polynovea_default');
    setHeadingFont(project?.heading_font || 'Clash Display');
    setBodyFont(project?.body_font || 'Inter');
    setLayoutDirection(project?.layout_direction || 'editorial');
    setStyleStrength(project?.style_strength || 'balanced');
    setArtDirectionNotes(project?.art_direction_notes || '');
  };

  const handleOpenFolder = async () => {
    if (!activeRevision || activeRevision.id === 'new-draft') return;
    try {
      const revisionDir = await window.api.projects.getRevisionDir(projectId, activeRevision.id);
      await window.api.outputs.openFolder(revisionDir);
    } catch (err) {
      console.error('Failed to open output directory:', err);
    }
  };

  const handleOpenPdf = async () => {
    if (!activeRevision || activeRevision.id === 'new-draft') return;
    try {
      const revisionDir = await window.api.projects.getRevisionDir(projectId, activeRevision.id);
      const pdfFilePath = `${revisionDir}/Polynovea_linkedin_post.pdf`;
      await window.api.outputs.openFolder(pdfFilePath);
    } catch (err) {
      console.error('Failed to open PDF:', err);
    }
  };

  const handleOpenSlidesFolder = async () => {
    if (!activeRevision || activeRevision.id === 'new-draft') return;
    try {
      const revisionDir = await window.api.projects.getRevisionDir(projectId, activeRevision.id);
      const slidesDirPath = `${revisionDir}/slides`;
      await window.api.outputs.openFolder(slidesDirPath);
    } catch (err) {
      console.error('Failed to open slides directory:', err);
    }
  };

  const handleApplyCorrection = async () => {
    if (!activeRevision || activeRevision.id === 'new-draft' || !correctionText.trim()) return;

    const isAllSlides = correctionTargetSlide === 0;
    const targetSlides = isAllSlides
      ? Array.from({ length: slideCount }, (_, i) => i + 1)
      : [correctionTargetSlide];

    setIsCorrecting(true);
    setStreamedOutput('');
    setProgressPercent(0);

    try {
      const revisionDir = await window.api.projects.getRevisionDir(projectId, activeRevision.id);
      const styleOverridesObj = (() => {
        try { return JSON.parse(activeRevision.style_overrides || '{}'); } catch { return {}; }
      })();

      for (const slideNumber of targetSlides) {
        setProgressMessage(
          isAllSlides
            ? `Correcting slide ${slideNumber} of ${targetSlides.length}...`
            : `Correcting slide ${slideNumber}...`
        );

        await window.api.engine.run({
          action: 'correct',
          mode: project.mode,
          projectDir: revisionDir,
          revisionId: activeRevision.id,
          inputDirection: activeRevision.input_direction,
          inputContext: activeRevision.input_context,
          styleOverrides: styleOverridesObj,
          slideNumber,
          correctionInstruction: correctionText.trim()
        });

        window.api.telemetry.log('correction_applied', {
          project_id: projectId,
          revision_id: activeRevision.id,
          mode: project.mode,
          slide_number: slideNumber,
          instruction: correctionText.trim(),
          instruction_word_count: correctionText.trim().split(/\s+/).length
        });
      }

      // Reload slide images
      const slidesDirPath = `${revisionDir}/slides`;
      const files = await window.api.outputs.listSlides(slidesDirPath);
      setSlideCount(files.length);

      const displaySlideIndex = isAllSlides ? activeSlideIndex : correctionTargetSlide - 1;
      setActiveSlideIndex(displaySlideIndex);
      const correctedFile = files[displaySlideIndex];
      if (correctedFile) {
        const base64 = await window.api.outputs.readImageBase64(`${slidesDirPath}/${correctedFile}`);
        setActiveSlideBase64(base64);
      }

      setCorrectionText('');
    } catch (err: any) {
      console.error('Correction failed:', err);
      setErrorMessage(err.message || 'Correction failed.');
    } finally {
      setIsCorrecting(false);
      setStreamedOutput('');
    }
  };

  const handleRenderReel = async () => {
    if (!activeRevision || activeRevision.id === 'new-draft' || !reelScript) return;

    setReelRendering(true);
    setReelRenderProgress(0);
    setErrorMessage('');

    try {
      const revisionDir = await window.api.projects.getRevisionDir(projectId, activeRevision.id);
      const outputPath = `${revisionDir}/reel.mp4`;

      await window.api.motion.render({
        reelScript,
        outputPath,
        revisionId: activeRevision.id
      });

      const dataUrl = await window.api.outputs.readFileBase64(outputPath, 'video/mp4');
      setReelVideoDataUrl(dataUrl);

      window.api.telemetry.log('reel_rendered', {
        project_id: projectId,
        revision_id: activeRevision.id
      });
    } catch (err: any) {
      console.error('Reel render failed:', err);
      setErrorMessage(err.message || 'Reel rendering failed.');
    } finally {
      setReelRendering(false);
    }
  };

  const formatModeName = (m: string) => {
    switch(m) {
      case 'linkedin': return 'LinkedIn Carousel';
      case 'instagram': return 'Biz Instagram';
      case 'personal': return 'Founder Personal Brand';
      case 'threads': return 'Threads Sequence';
      case 'blog': return 'Blog Post';
      case 'reel': return 'AI Motion Reel';
      default: return m;
    }
  };

  const formatOutputSummary = (m: string) => {
    switch(m) {
      case 'linkedin': return '1:1 · 1080×1080 px · 7 slides · PNG + PDF';
      case 'instagram': return '4:5 · 1080×1350 px · 6 slides · PNG only';
      case 'personal': return '4:5 · 1080×1350 px · 5–7 slides · PNG only';
      case 'threads': return '4:5 · 1080×1350 px · 6 slides · PNG + text copy';
      case 'blog': return 'Markdown draft · styled HTML preview';
      case 'reel': return '9:16 · 1080×1920 · 5-20s MP4';
      default: return '';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Content copied to clipboard!');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '14px', color: 'var(--text-secondary)' }}>
        <div className="spinner" />
        <span style={{ fontSize: '13px', letterSpacing: '0.04em' }}>Loading workspace...</span>
      </div>
    );
  }

  const isBlog = project?.mode === 'blog';
  const isReel = project?.mode === 'reel';

  return (
    <div className="workspace-layout">
      {/* Revisions Sidebar */}
      <div className="workspace-sidebar">
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', fontSize: '12px', padding: '8px 12px' }}
            onClick={onBack}
          >
            Back to Dashboard
          </button>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '12px', fontSize: '12px', padding: '8px 12px' }}
            onClick={handleCreateNewVersion}
            disabled={running}
          >
            New Version
          </button>
        </div>

        <div style={{ flexGrow: 1, padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, paddingLeft: '8px', textTransform: 'uppercase' }}>
            Versions History
          </div>
          {activeRevision?.id === 'new-draft' && (
            <div className="nav-item active" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>v{activeRevision.version} (New Draft)</span>
              <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'var(--border-muted)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>Draft</span>
            </div>
          )}
          {revisions.map((rev) => {
            const isActive = activeRevision?.id === rev.id;
            let statusColor = '#52525B';
            if (rev.status === 'completed') statusColor = 'var(--success)';
            else if (rev.status === 'failed') statusColor = 'var(--error)';
            else if (rev.status === 'planning' || rev.status === 'generating') statusColor = 'var(--accent-violet)';
            else if (rev.status === 'plan_pending') statusColor = 'var(--accent-gold-muted)';

            return (
              <div 
                key={rev.id} 
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => !running && loadProjectData(rev.id)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>v{rev.version} Outline</span>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  background: statusColor,
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  textTransform: 'uppercase',
                }}>
                  {rev.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Workspace split view */}
      <div style={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* Left Control Panel */}
        <div className="workspace-panel-left">
          <div style={{ marginBottom: '24px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold-muted)', fontFamily: 'Clash Display' }}>
              {formatModeName(project?.mode)}
            </span>
            <h2 style={{ fontFamily: 'Clash Display', fontSize: '24px', margin: '4px 0 0 0', color: 'var(--text-primary)' }}>
              {project?.name}
            </h2>
          </div>

          {activeRevision?.status === 'draft' || activeRevision?.status === 'failed' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Output Format Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-disabled)', marginBottom: '3px' }}>Output Format</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{formatOutputSummary(project?.mode)}</div>
                </div>
                {project?.mode === 'linkedin' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: running ? 'default' : 'pointer', flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={exportPdf}
                      onChange={(e) => setExportPdf(e.target.checked)}
                      disabled={running}
                      style={{ accentColor: 'var(--accent-violet)', width: '14px', height: '14px' }}
                    />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Export PDF</span>
                  </label>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Core Prompt Directive</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '120px', resize: 'vertical' }}
                  value={inputDirection}
                  onChange={(e) => setInputDirection(e.target.value)}
                  placeholder="What is this post or carousel about? E.g., The 3 steps of customer acquisition in SaaS..."
                  disabled={running}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target Audience / Business Context (Optional)</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={inputContext}
                  onChange={(e) => setInputContext(e.target.value)}
                  placeholder="Product goals, call to action link, target tone overrides..."
                  disabled={running}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Language Style</label>
                  <select 
                    className="form-input form-select"
                    value={lang}
                    onChange={(e) => setLang(e.target.value)}
                    disabled={running}
                  >
                    <option value="en">English Only</option>
                    <option value="hi">Hindi (Devanagari)</option>
                    <option value="hi-Latn">Hinglish (Roman Mixed)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Base Tone</label>
                  <select 
                    className="form-input form-select"
                    value={langStyle}
                    onChange={(e) => setLangStyle(e.target.value)}
                    disabled={running}
                  >
                    <option value="formal">Analytical & Professional</option>
                    <option value="colloquial">Colloquial & Bold</option>
                    <option value="transliterated">Transliterated Hindi</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">CTA Slide Translation Override</label>
                  <select 
                    className="form-input form-select"
                    value={ctaLangStyle}
                    onChange={(e) => setCtaLangStyle(e.target.value)}
                    disabled={running}
                  >
                    <option value="formal">Same as Default Style</option>
                    <option value="hi-Latn">Colloquial Hinglish (Force conversion)</option>
                    <option value="hi">Pure Hindi (Force translation)</option>
                    <option value="en">Force English</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Custom Language Instructions (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={customLangDirectives}
                  onChange={(e) => setCustomLangDirectives(e.target.value)}
                  placeholder="E.g., Speak like a Mumbai tech marketer..."
                  disabled={running}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Palette System</label>
                <select
                  className="form-input form-select"
                  value={palettePreset}
                  onChange={(e) => setPalettePreset(e.target.value)}
                  disabled={running}
                >
                  {PALETTE_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <span className="form-hint">
                  {PALETTE_PRESETS.find((preset) => preset.id === palettePreset)?.description}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Font Pairing Preset</label>
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
                    disabled={running}
                  >
                    {FONT_PAIRING_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                  <span className="form-hint">
                    {FONT_PAIRING_PRESETS.find((preset) => preset.id === fontPairingPreset)?.description}
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Layout Direction</label>
                  <select
                    className="form-input form-select"
                    value={layoutDirection}
                    onChange={(e) => setLayoutDirection(e.target.value)}
                    disabled={running}
                  >
                    {LAYOUT_DIRECTION_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                  <span className="form-hint">
                    {LAYOUT_DIRECTION_PRESETS.find((preset) => preset.id === layoutDirection)?.description}
                  </span>
                </div>
              </div>

              {palettePreset === 'custom' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {Object.entries(customPalette).map(([key, value]) => (
                    <div className="form-group" key={key} style={{ marginBottom: 0 }}>
                      <label className="form-label">{key}</label>
                      <input
                        type="text"
                        className="form-input"
                        value={value}
                        onChange={(e) =>
                          setCustomPalette((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        placeholder="#000000"
                        disabled={running}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Heading Font</label>
                  <select
                    className="form-input form-select"
                    value={headingFont}
                    onChange={(e) => {
                      setHeadingFont(e.target.value);
                      setFontPairingPreset('custom');
                    }}
                    disabled={running}
                  >
                    {FONT_OPTIONS.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
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
                    disabled={running}
                  >
                    {FONT_OPTIONS.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
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
                  disabled={running}
                >
                  {STYLE_STRENGTH_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <span className="form-hint">
                  {STYLE_STRENGTH_PRESETS.find((preset) => preset.id === styleStrength)?.description}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Custom Visual Direction (Optional)</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '90px', resize: 'vertical' }}
                  value={artDirectionNotes}
                  onChange={(e) => setArtDirectionNotes(e.target.value)}
                  placeholder="Example: keep the brand palette, but make the layout feel more editorial and asymmetrical with stronger spacing."
                  disabled={running}
                />
              </div>

              {errorMessage && (
                <div style={{ color: 'var(--error)', fontSize: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', padding: '12px 14px', borderRadius: 'var(--radius-md)', wordBreak: 'break-word' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Error:</strong> {errorMessage}
                </div>
              )}

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', height: '48px', marginTop: '12px' }}
                onClick={handleGenerateOutline}
                disabled={running || !inputDirection.trim()}
              >
                {running ? 'Planning...' : 'Generate Outline Plan'}
              </button>
            </div>
          ) : (
            // Read-only parameters panel once plan is generated
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ padding: '16px', background: 'rgba(24,24,27,0.6)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-muted)', fontSize: '13px' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-disabled)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Active Prompt Parameters
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Direction:</strong>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{activeRevision?.input_direction}</p>
                </div>
                {activeRevision?.input_context && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong>Context:</strong>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{activeRevision?.input_context}</p>
                  </div>
                )}
                <div>
                  <strong>Language Configuration:</strong>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
                    Language: {lang.toUpperCase()} ({langStyle})
                  </p>
                </div>
                <div style={{ marginTop: '12px' }}>
                  <strong>Design Configuration:</strong>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
                    Palette: {PALETTE_PRESETS.find((preset) => preset.id === palettePreset)?.label || palettePreset}
                  </p>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
                    Layout: {LAYOUT_DIRECTION_PRESETS.find((preset) => preset.id === layoutDirection)?.label || layoutDirection}
                  </p>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
                    Style Strength: {STYLE_STRENGTH_PRESETS.find((preset) => preset.id === styleStrength)?.label || styleStrength}
                  </p>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
                    Fonts: {headingFont} / {bodyFont}
                  </p>
                  {artDirectionNotes && (
                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                      Art Direction: {artDirectionNotes}
                    </p>
                  )}
                </div>
              </div>

              {activeRevision?.status === 'completed' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                  {project.mode === 'linkedin' && (
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleOpenPdf}>
                      Open LinkedIn PDF
                    </button>
                  )}
                  {project.mode !== 'blog' && project.mode !== 'reel' && (
                    <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleOpenSlidesFolder}>
                      Open Slides PNGs Folder
                    </button>
                  )}
                  {project.mode === 'blog' && (
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => copyToClipboard(blogContent)}>
                      Copy Blog Copy
                    </button>
                  )}
                  <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleOpenFolder}>
                    Open Exports Directory
                  </button>
                  <button className="btn btn-secondary" style={{ width: '100%', border: '1px dashed var(--accent-gold-muted)' }} onClick={handleCreateNewVersion}>
                    Iterate (Create New Version)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Running Progress Bar display */}
          {(running || isCorrecting) && (
            <div className="progress-container">
              <div className="progress-label">
                <span>{progressMessage}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Right Preview / Editor Panel */}
        <div className="workspace-panel-right">
          
          {/* STATE: PLANNING OR GENERATING - Render live streamed output tokens */}
          {(running || isCorrecting) && streamedOutput && (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-disabled)', marginBottom: '12px' }}>
                Live AI Output
              </div>
              <div
                ref={scrollRef}
                style={{
                  flexGrow: 1,
                  width: '100%',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-muted)',
                  borderRadius: 'var(--radius-md)',
                  padding: '20px 24px',
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, Consolas, monospace',
                  fontSize: '12px',
                  lineHeight: '1.65',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {streamedOutput}
              </div>
            </div>
          )}

          {/* STATE: PLAN PENDING - User Reviews & Edits generated Outline before generating assets */}
          {!running && activeRevision?.status === 'plan_pending' && (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="plan-header">
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-disabled)', marginBottom: '6px' }}>
                    Step 2 of 3
                  </div>
                  <h3 style={{ fontFamily: 'Clash Display, sans-serif', fontSize: '20px', margin: 0, color: 'var(--accent-gold)' }}>
                    Review &amp; Refine Content Plan
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Edit the outline below, then approve to begin visual rendering.
                  </div>
                </div>
                <button className="btn btn-primary" onClick={handleApproveAndGenerate} style={{ flexShrink: 0 }}>
                  Approve &amp; Render
                </button>
              </div>
              <textarea
                className="plan-editor-textarea"
                value={planContent}
                onChange={(e) => setPlanContent(e.target.value)}
                placeholder="# Slide 1: Headline..."
                style={{ flexGrow: 1 }}
              />
            </div>
          )}

          {/* STATE: COMPLETED - Visual Carousel Slide Review or Blog Draft */}
          {!running && activeRevision?.status === 'completed' && (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {isBlog ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%', width: '100%' }}>
                  {/* Blog toolbar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-muted)', paddingBottom: '14px', marginBottom: '16px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className={`btn ${blogTab === 'markdown' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setBlogTab('markdown')}>
                        Markdown
                      </button>
                      <button className={`btn ${blogTab === 'preview' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setBlogTab('preview')}>
                        HTML Preview
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {blogTab === 'markdown' ? (
                        <>
                          <button className="btn btn-secondary" onClick={() => copyToClipboard(blogContent)}>Copy MD</button>
                          <button className="btn btn-primary" onClick={handleSaveBlogDraft}>Save Draft</button>
                        </>
                      ) : (
                        <button className="btn btn-secondary" onClick={() => copyToClipboard(blogHtmlContent)}>Copy HTML</button>
                      )}
                      <button className="btn btn-secondary" onClick={handleOpenFolder}>Open Folder</button>
                    </div>
                  </div>
                  {blogTab === 'markdown' ? (
                    <textarea
                      className="plan-editor-textarea"
                      value={blogContent}
                      onChange={(e) => setBlogContent(e.target.value)}
                      style={{ flexGrow: 1, resize: 'none', background: 'var(--bg-primary)' }}
                      placeholder="Write your blog post in markdown here..."
                    />
                  ) : (
                    <div style={{ flexGrow: 1, border: '1px solid var(--border-muted)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-primary)' }}>
                      <iframe srcDoc={blogHtmlContent} style={{ width: '100%', height: '100%', border: 'none' }} title="Blog Preview" />
                    </div>
                  )}
                </div>
              ) : isReel ? (
                <div className="carousel-preview-container">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-disabled)', marginBottom: '6px' }}>
                      Scene Script Ready
                    </div>
                    <h3 style={{ fontFamily: 'Clash Display, sans-serif', fontSize: '18px', fontWeight: 600, margin: '0 0 4px 0', color: 'var(--accent-gold)' }}>
                      {reelScript?.title || 'AI Motion Reel'}
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {reelScript?.eyebrow ? `${reelScript.eyebrow} · ` : ''}
                      {reelScript?.scenes?.length || 0} scenes · {reelScript?.durationInFrames || 0} frames @ {reelScript?.fps || 30}fps
                      {' '}({((reelScript?.durationInFrames || 0) / (reelScript?.fps || 30)).toFixed(1)}s)
                    </div>
                  </div>

                  {reelVideoDataUrl ? (
                    <div
                      className="slide-frame glass-card"
                      style={{
                        width: '270px',
                        height: '480px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--bg-card)',
                        padding: 0,
                      }}
                    >
                      <video
                        controls
                        src={reelVideoDataUrl}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'var(--radius-lg)' }}
                      />
                    </div>
                  ) : (
                    <div style={{ height: '480px', width: '270px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '0 16px' }}>
                      {reelRendering
                        ? <span><div className="spinner" style={{ margin: '0 auto 10px' }} /> Rendering reel...</span>
                        : 'No rendered video yet. Click "Render Full Reel" to generate the MP4.'}
                    </div>
                  )}

                  <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                      onClick={handleRenderReel}
                      disabled={reelRendering || !reelScript}
                    >
                      {reelRendering
                        ? `Rendering... ${reelRenderProgress}%`
                        : reelVideoDataUrl ? 'Re-render Full Reel' : 'Render Full Reel'}
                    </button>

                    {reelRendering && (
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${reelRenderProgress}%` }} />
                      </div>
                    )}

                    {reelVideoDataUrl && (
                      <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleOpenFolder}>
                        Open Reel Folder
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="carousel-preview-container">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-disabled)', marginBottom: '6px' }}>
                      Rendered Output
                    </div>
                    <h3 style={{ fontFamily: 'Clash Display, sans-serif', fontSize: '18px', fontWeight: 600, margin: '0 0 4px 0', color: 'var(--accent-gold)' }}>
                      High Fidelity Slide Preview
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Playwright browser render · {slideCount} slides
                    </div>
                  </div>

                  {activeSlideBase64 ? (
                    <div
                      className="slide-frame glass-card"
                      style={{
                        width: project?.mode === 'linkedin' ? '480px' : '384px',
                        height: '480px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--bg-card)',
                        padding: 0,
                      }}
                    >
                      <img
                        src={activeSlideBase64}
                        alt={`Slide ${activeSlideIndex + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'var(--radius-lg)' }}
                      />
                    </div>
                  ) : (
                    <div style={{ height: '480px', width: '480px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <div className="spinner" style={{ marginRight: '10px' }} /> Loading render...
                    </div>
                  )}

                  <div className="slide-controls">
                    <button className="btn btn-secondary" onClick={() => { const n = Math.max(0, activeSlideIndex - 1); setActiveSlideIndex(n); setCorrectionTargetSlide(n + 1); }} disabled={activeSlideIndex === 0}>
                      ← Prev
                    </button>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', minWidth: '80px', textAlign: 'center' }}>
                      {activeSlideIndex + 1} / {slideCount}
                    </span>
                    <button className="btn btn-secondary" onClick={() => { const n = Math.min(slideCount - 1, activeSlideIndex + 1); setActiveSlideIndex(n); setCorrectionTargetSlide(n + 1); }} disabled={activeSlideIndex === slideCount - 1}>
                      Next →
                    </button>
                  </div>

                  {/* Slide Correction Panel */}
                  <div style={{ width: '100%', maxWidth: '480px', marginTop: '8px' }}>
                    <div className="glass-card" style={{ padding: '18px 20px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-disabled)', marginBottom: '14px' }}>
                        Correct Slides
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'center' }}>
                        <label className="form-label" style={{ marginBottom: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>Target</label>
                        <select
                          className="form-input form-select"
                          style={{ flexGrow: 1, padding: '7px 10px' }}
                          value={correctionTargetSlide}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            setCorrectionTargetSlide(n);
                            if (n > 0) setActiveSlideIndex(n - 1);
                          }}
                          disabled={isCorrecting}
                        >
                          <option value={0}>All Slides ({slideCount})</option>
                          {Array.from({ length: slideCount }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                              Slide {i + 1}{i === activeSlideIndex ? ' (current)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        className="form-input"
                        style={{ width: '100%', minHeight: '80px', resize: 'vertical', fontSize: '13px', marginBottom: '12px' }}
                        value={correctionText}
                        onChange={(e) => setCorrectionText(e.target.value)}
                        placeholder={correctionTargetSlide === 0
                          ? "Describe the correction to apply to every slide — e.g. 'Reduce the body text size', 'Use the deep violet accent more consistently'..."
                          : "Describe the correction — e.g. 'Reduce the body text size', 'Fix the layout overlap in the bottom section', 'Change the chart labels to be clearer'..."}
                        disabled={isCorrecting}
                      />
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        onClick={handleApplyCorrection}
                        disabled={isCorrecting || !correctionText.trim()}
                      >
                        {isCorrecting ? (
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <div className="spinner" style={{ width: '14px', height: '14px' }} />
                            Applying Correction...
                          </span>
                        ) : correctionTargetSlide === 0 ? 'Apply to All Slides' : 'Apply Correction'}
                      </button>
                    </div>
                  </div>

                  {project.mode === 'threads' && threadTexts.length > 0 && (
                    <div style={{ marginTop: '24px', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ borderTop: '1px solid var(--border-muted)', paddingTop: '16px' }}>
                        <h4 style={{ fontFamily: 'Clash Display, sans-serif', fontSize: '14px', color: 'var(--accent-gold)', margin: '0 0 4px 0' }}>
                          Threads Post Sequence
                        </h4>
                        <span className="form-hint">Copy blocks individually to post sequentially</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                        {threadTexts.map((text, idx) => (
                          <div key={idx} className="thread-post-card">
                            <div style={{ fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', flexGrow: 1, lineHeight: '1.55' }}>
                              <strong style={{ color: 'var(--accent-gold-muted)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Post {idx + 1}</strong>
                              {"\n"}{text}
                            </div>
                            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '10px', flexShrink: 0 }} onClick={() => copyToClipboard(text)}>
                              Copy
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STATE: EMPTY / DRAFT */}
          {!running && activeRevision?.status === 'draft' && (
            <div className="rp-empty-state">
              <div className="rp-empty-icon">Ready</div>
              <h3 className="rp-empty-title">Synthesize Content Outline</h3>
              <p className="rp-empty-sub">
                Fill in your core prompt directive on the left, configure language and design options, then hit Generate.
              </p>
            </div>
          )}

          {/* STATE: FAILED */}
          {!running && activeRevision?.status === 'failed' && (
            <div className="glass-card rp-error-card">
              <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-disabled)', marginBottom: '8px' }}>
                Generation Failed
              </div>
              <h3 style={{ fontFamily: 'Clash Display, sans-serif', fontSize: '22px', fontWeight: 600, color: 'var(--error)', margin: '0 0 4px 0' }}>
                Something went wrong
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>
                Review the error below and create a new iteration draft to retry.
              </p>
              <div className="error-log">
                {activeRevision.error_message || errorMessage}
              </div>
              <button className="btn btn-primary" onClick={handleCreateNewVersion}>
                Create Iteration Draft
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
