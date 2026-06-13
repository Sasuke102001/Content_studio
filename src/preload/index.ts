import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  settings: {
    saveCredential: (key: string, value: string) => ipcRenderer.invoke('settings:save-credential', key, value),
    getCredential: (key: string) => ipcRenderer.invoke('settings:get-credential', key),
    saveValue: (key: string, value: string) => ipcRenderer.invoke('settings:save-value', key, value),
    getValue: (key: string) => ipcRenderer.invoke('settings:get-value', key),
    list: () => ipcRenderer.invoke('settings:list'),
    getDefaultOutputDir: () => ipcRenderer.invoke('settings:get-default-output-dir')
  },
  projects: {
    create: (
      name: string,
      mode: string,
      defaultLang?: string,
      defaultLangStyle?: string,
      palettePreset?: string,
      fontPairingPreset?: string,
      headingFont?: string,
      bodyFont?: string,
      layoutDirection?: string,
      styleStrength?: string,
      artDirectionNotes?: string,
      customPaletteJson?: string
    ) =>
      ipcRenderer.invoke(
        'projects:create',
        name,
        mode,
        defaultLang,
        defaultLangStyle,
        palettePreset,
        fontPairingPreset,
        headingFont,
        bodyFont,
        layoutDirection,
        styleStrength,
        artDirectionNotes,
        customPaletteJson
      ),
    list: () => ipcRenderer.invoke('projects:list'),
    get: (id: string) => ipcRenderer.invoke('projects:get', id),
    delete: (id: string) => ipcRenderer.invoke('projects:delete', id),
    getRevisionDir: (projectId: string, revisionId: string) => 
      ipcRenderer.invoke('projects:get-revision-dir', projectId, revisionId)
  },
  revisions: {
    create: (
      projectId: string,
      inputDirection: string,
      inputContext?: string,
      languageOverrides?: string,
      styleOverrides?: string
    ) =>
      ipcRenderer.invoke(
        'revisions:create',
        projectId,
        inputDirection,
        inputContext,
        languageOverrides,
        styleOverrides
      ),
    list: (projectId: string) => ipcRenderer.invoke('revisions:list', projectId),
    get: (id: string) => ipcRenderer.invoke('revisions:get', id),
    updateStatus: (id: string, status: string, errorMessage?: string) => 
      ipcRenderer.invoke('revisions:update-status', id, status, errorMessage)
  },
  plans: {
    save: (revisionId: string, rawMarkdown: string) => ipcRenderer.invoke('plans:save', revisionId, rawMarkdown),
    approve: (revisionId: string) => ipcRenderer.invoke('plans:approve', revisionId),
    get: (revisionId: string) => ipcRenderer.invoke('plans:get', revisionId)
  },
  slides: {
    save: (revisionId: string, slidesList: any[]) => ipcRenderer.invoke('slides:save', revisionId, slidesList),
    get: (revisionId: string) => ipcRenderer.invoke('slides:get', revisionId)
  },
  outputs: {
    save: (revisionId: string, htmlFilePath?: string, blogTextContent?: string) => 
      ipcRenderer.invoke('outputs:save', revisionId, htmlFilePath, blogTextContent),
    saveBlogDraft: (projectId: string, revisionId: string, markdownContent: string) =>
      ipcRenderer.invoke('outputs:save-blog-draft', projectId, revisionId, markdownContent),
    get: (revisionId: string) => ipcRenderer.invoke('outputs:get', revisionId),
    readFile: (filePath: string) => ipcRenderer.invoke('outputs:read-file', filePath),
    readImageBase64: (filePath: string) => ipcRenderer.invoke('outputs:read-image-base64', filePath),
    readFileBase64: (filePath: string, mimeType: string) => ipcRenderer.invoke('outputs:read-file-base64', filePath, mimeType),
    fileExists: (filePath: string) => ipcRenderer.invoke('outputs:file-exists', filePath),
    openFolder: (folderPath: string) => ipcRenderer.invoke('outputs:open-folder', folderPath),
    listSlides: (slidesDirPath: string) => ipcRenderer.invoke('outputs:list-slides', slidesDirPath)
  },
  artifacts: {
    save: (revisionId: string, type: string, filePath: string, slideNumber?: number) => 
      ipcRenderer.invoke('artifacts:save', revisionId, type, filePath, slideNumber),
    list: (revisionId: string) => ipcRenderer.invoke('artifacts:list', revisionId)
  },
  engine: {
    run: (params: any) => ipcRenderer.invoke('engine:run', params),
    runDiagnostics: () => ipcRenderer.invoke('engine:run-diagnostics'),
    repairChromium: () => ipcRenderer.invoke('engine:repair-chromium'),
    onProgress: (callback: (event: any, data: any) => void) => {
      ipcRenderer.on('engine-progress', callback);
      return () => {
        ipcRenderer.removeListener('engine-progress', callback);
      };
    }
  },
  motion: {
    render: (params: any) => ipcRenderer.invoke('motion:render', params),
    onProgress: (callback: (event: any, data: any) => void) => {
      ipcRenderer.on('motion-progress', callback);
      return () => {
        ipcRenderer.removeListener('motion-progress', callback);
      };
    }
  },
  supabase: {
    authenticateAnonymous: () => ipcRenderer.invoke('supabase:authenticate-anonymous'),
    getStatus: () => ipcRenderer.invoke('supabase:get-status')
  },
  telemetry: {
    // Fire-and-forget — never await this in UI code
    log: (eventName: string, payload?: Record<string, any>) =>
      ipcRenderer.invoke('telemetry:log', eventName, payload ?? {})
  },
  crm: {
    signIn: (email: string, password: string) =>
      ipcRenderer.invoke('crm:sign-in', email, password),
    signOut: () =>
      ipcRenderer.invoke('crm:sign-out'),
    getSession: () =>
      ipcRenderer.invoke('crm:get-session'),
    createSupportTicket: (
      title: string,
      description: string,
      requestType: 'technical_support' | 'platform_feature',
      priority: 'low' | 'medium' | 'high' | 'urgent'
    ) => ipcRenderer.invoke('crm:create-support-ticket', title, description, requestType, priority)
  }
});
