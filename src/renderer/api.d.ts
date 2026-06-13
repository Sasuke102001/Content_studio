import type { ReelScript } from '../shared/reelSchema';

declare global {
interface Window {
  api: {
    settings: {
      saveCredential: (key: string, value: string) => Promise<boolean>;
      getCredential: (key: string) => Promise<string>;
      saveValue: (key: string, value: string) => Promise<boolean>;
      getValue: (key: string) => Promise<string>;
      list: () => Promise<Record<string, string>>;
      getDefaultOutputDir: () => Promise<string>;
    };
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
      ) => Promise<any>;
      list: () => Promise<any[]>;
      get: (id: string) => Promise<any>;
      delete: (id: string) => Promise<boolean>;
      getRevisionDir: (projectId: string, revisionId: string) => Promise<string>;
    };
    revisions: {
      create: (
        projectId: string,
        inputDirection: string,
        inputContext?: string,
        languageOverrides?: string,
        styleOverrides?: string
      ) => Promise<any>;
      list: (projectId: string) => Promise<any[]>;
      get: (id: string) => Promise<any>;
      updateStatus: (id: string, status: string, errorMessage?: string) => Promise<boolean>;
    };
    plans: {
      save: (revisionId: string, rawMarkdown: string) => Promise<any>;
      approve: (revisionId: string) => Promise<boolean>;
      get: (revisionId: string) => Promise<any>;
    };
    slides: {
      save: (revisionId: string, slidesList: any[]) => Promise<boolean>;
      get: (revisionId: string) => Promise<any[]>;
    };
    outputs: {
      save: (revisionId: string, htmlFilePath?: string, blogTextContent?: string) => Promise<any>;
      saveBlogDraft: (projectId: string, revisionId: string, markdownContent: string) => Promise<any>;
      get: (revisionId: string) => Promise<any>;
      readFile: (filePath: string) => Promise<string>;
      readImageBase64: (filePath: string) => Promise<string>;
      readFileBase64: (filePath: string, mimeType: string) => Promise<string>;
      fileExists: (filePath: string) => Promise<boolean>;
      openFolder: (folderPath: string) => Promise<boolean>;
      listSlides: (slidesDirPath: string) => Promise<string[]>;
    };
    artifacts: {
      save: (revisionId: string, type: string, filePath: string, slideNumber?: number) => Promise<any>;
      list: (revisionId: string) => Promise<any[]>;
    };
    engine: {
      run: (params: any) => Promise<void>;
      runDiagnostics: () => Promise<{ pythonAvailable: boolean, engineAvailable: boolean, playwrightAvailable: boolean, chromiumAvailable: boolean, error: string }>;
      repairChromium: () => Promise<boolean>;
      onProgress: (callback: (event: any, data: any) => void) => () => void;
    };
    motion: {
      render: (params: { reelScript: ReelScript, outputPath: string, revisionId: string }) => Promise<void>;
      onProgress: (callback: (event: any, data: any) => void) => () => void;
    };
    supabase: {
      authenticateAnonymous: () => Promise<{ authenticated: boolean, userId: string, isAnonymous: boolean }>;
      getStatus: () => Promise<{
        configured: boolean;
        authenticated: boolean;
        isAnonymous: boolean;
        userId: string;
        projectUrl: string;
        usingDefaults: boolean;
        error?: string;
      }>;
    };
    telemetry: {
      log: (eventName: string, payload?: Record<string, any>) => Promise<boolean>;
    };
    crm: {
      signIn: (email: string, password: string) => Promise<{
        id: string;
        email: string;
        full_name: string;
        role_key: 'master_admin' | 'admin' | 'manager' | 'member';
        access_token: string;
        refresh_token: string;
      }>;
      signOut: () => Promise<boolean>;
      getSession: () => Promise<{
        id: string;
        email: string;
        full_name: string;
        role_key: 'master_admin' | 'admin' | 'manager' | 'member';
        access_token: string;
        refresh_token: string;
      } | null>;
      createSupportTicket: (
        title: string,
        description: string,
        requestType: 'technical_support' | 'platform_feature',
        priority: 'low' | 'medium' | 'high' | 'urgent'
      ) => Promise<boolean>;
    };
  };
}
}
