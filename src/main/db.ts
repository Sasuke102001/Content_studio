import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

let db: Database.Database;

// Interface definitions
export interface Project {
    id: string;
    name: string;
    mode: string;
    default_language: string;
    default_language_style?: string;
    palette_preset?: string;
    font_pairing_preset?: string;
    heading_font?: string;
    body_font?: string;
    layout_direction?: string;
    style_strength?: string;
    art_direction_notes?: string;
    custom_palette_json?: string;
    created_at: string;
    updated_at: string;
}

export interface Revision {
    id: string;
    project_id: string;
    version: number;
    input_direction: string;
    input_context?: string;
    language_overrides?: string;
    style_overrides?: string;
    status: string;
    error_message?: string;
    created_at: string;
}

export interface RevisionPlan {
    id: string;
    revision_id: string;
    raw_markdown: string;
    approved_at?: string;
    created_at: string;
}

export interface RevisionSlide {
    id: string;
    revision_id: string;
    slide_number: number;
    eyebrow?: string;
    headline?: string;
    body?: string;
    language: string;
    language_style?: string;
    created_at: string;
}

export interface RevisionOutput {
    id: string;
    revision_id: string;
    html_file_path?: string;
    blog_text_content?: string;
    created_at: string;
}

export interface Artifact {
    id: string;
    revision_id: string;
    type: string;
    file_path: string;
    slide_number?: number;
    created_at: string;
}

export function initDatabase(dbPath?: string): Database.Database {
    if (db) return db;
    
    let targetPath = dbPath;
    if (!targetPath) {
        // Fallback to app userData folder
        const userDataPath = app.getPath('userData');
        if (!fs.existsSync(userDataPath)) {
            fs.mkdirSync(userDataPath, { recursive: true });
        }
        targetPath = path.join(userDataPath, 'polynovea.db');
    }
    
    db = new Database(targetPath);
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Create DB Tables
    db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            mode TEXT NOT NULL,
            default_language TEXT DEFAULT 'en',
            default_language_style TEXT,
            palette_preset TEXT DEFAULT 'brand_dark',
            font_pairing_preset TEXT DEFAULT 'polynovea_default',
            heading_font TEXT DEFAULT 'Clash Display',
            body_font TEXT DEFAULT 'Inter',
            layout_direction TEXT DEFAULT 'editorial',
            style_strength TEXT DEFAULT 'balanced',
            art_direction_notes TEXT,
            custom_palette_json TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS revisions (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            input_direction TEXT NOT NULL,
            input_context TEXT,
            language_overrides TEXT,
            style_overrides TEXT,
            status TEXT NOT NULL,
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS revision_plans (
            id TEXT PRIMARY KEY,
            revision_id TEXT NOT NULL,
            raw_markdown TEXT NOT NULL,
            approved_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(revision_id) REFERENCES revisions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS revision_slides (
            id TEXT PRIMARY KEY,
            revision_id TEXT NOT NULL,
            slide_number INTEGER NOT NULL,
            eyebrow TEXT,
            headline TEXT,
            body TEXT,
            language TEXT DEFAULT 'en',
            language_style TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(revision_id) REFERENCES revisions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS revision_outputs (
            id TEXT PRIMARY KEY,
            revision_id TEXT NOT NULL,
            html_file_path TEXT,
            blog_text_content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(revision_id) REFERENCES revisions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS artifacts (
            id TEXT PRIMARY KEY,
            revision_id TEXT NOT NULL,
            type TEXT NOT NULL,
            file_path TEXT NOT NULL,
            slide_number INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(revision_id) REFERENCES revisions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS telemetry_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_name TEXT NOT NULL,
            payload TEXT NOT NULL,
            synced INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Additive migrations for existing local SQLite databases.
    const projectColumns = db.prepare(`PRAGMA table_info(projects)`).all() as { name: string }[];
    const revisionColumns = db.prepare(`PRAGMA table_info(revisions)`).all() as { name: string }[];
    const projectColumnNames = new Set(projectColumns.map((column) => column.name));
    const revisionColumnNames = new Set(revisionColumns.map((column) => column.name));

    if (!projectColumnNames.has('palette_preset')) {
        db.exec(`ALTER TABLE projects ADD COLUMN palette_preset TEXT DEFAULT 'brand_dark'`);
    }
    if (!projectColumnNames.has('heading_font')) {
        db.exec(`ALTER TABLE projects ADD COLUMN heading_font TEXT DEFAULT 'Clash Display'`);
    }
    if (!projectColumnNames.has('body_font')) {
        db.exec(`ALTER TABLE projects ADD COLUMN body_font TEXT DEFAULT 'Inter'`);
    }
    if (!projectColumnNames.has('font_pairing_preset')) {
        db.exec(`ALTER TABLE projects ADD COLUMN font_pairing_preset TEXT DEFAULT 'polynovea_default'`);
    }
    if (!projectColumnNames.has('layout_direction')) {
        db.exec(`ALTER TABLE projects ADD COLUMN layout_direction TEXT DEFAULT 'editorial'`);
    }
    if (!projectColumnNames.has('style_strength')) {
        db.exec(`ALTER TABLE projects ADD COLUMN style_strength TEXT DEFAULT 'balanced'`);
    }
    if (!projectColumnNames.has('art_direction_notes')) {
        db.exec(`ALTER TABLE projects ADD COLUMN art_direction_notes TEXT`);
    }
    if (!projectColumnNames.has('custom_palette_json')) {
        db.exec(`ALTER TABLE projects ADD COLUMN custom_palette_json TEXT`);
    }
    if (!revisionColumnNames.has('style_overrides')) {
        db.exec(`ALTER TABLE revisions ADD COLUMN style_overrides TEXT`);
    }
    
    return db;
}

// =========================================================
// API Wrappers (IPC-compatible helpers)
// =========================================================

export const projectsApi = {
    create: (
        id: string,
        name: string,
        mode: string,
        defaultLang: string = 'en',
        defaultLangStyle?: string,
        palettePreset: string = 'brand_dark',
        fontPairingPreset: string = 'polynovea_default',
        headingFont: string = 'Clash Display',
        bodyFont: string = 'Inter',
        layoutDirection: string = 'editorial',
        styleStrength: string = 'balanced',
        artDirectionNotes?: string,
        customPaletteJson?: string
    ): Project => {
        const statement = db.prepare(`
            INSERT INTO projects (
                id, name, mode, default_language, default_language_style, palette_preset, font_pairing_preset, heading_font, body_font, layout_direction, style_strength, art_direction_notes, custom_palette_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        statement.run(
            id,
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
            artDirectionNotes || null,
            customPaletteJson || null
        );
        return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project;
    },
    
    list: (): Project[] => {
        return db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as Project[];
    },
    
    get: (id: string): Project | undefined => {
        return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
    },
    
    delete: (id: string): void => {
        db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    }
};

export const revisionsApi = {
    create: (
        id: string,
        projectId: string,
        inputDirection: string,
        inputContext?: string,
        languageOverrides?: string,
        styleOverrides?: string
    ): Revision => {
        // Calculate version number
        const row = db.prepare('SELECT MAX(version) as max_ver FROM revisions WHERE project_id = ?').get(projectId) as { max_ver: number | null };
        const nextVer = (row.max_ver || 0) + 1;
        
        const statement = db.prepare(`
            INSERT INTO revisions (id, project_id, version, input_direction, input_context, language_overrides, style_overrides, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')
        `);
        statement.run(id, projectId, nextVer, inputDirection, inputContext, languageOverrides, styleOverrides);
        
        // Update project timestamp
        db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);
        
        return db.prepare('SELECT * FROM revisions WHERE id = ?').get(id) as Revision;
    },
    
    listForProject: (projectId: string): Revision[] => {
        return db.prepare('SELECT * FROM revisions WHERE project_id = ? ORDER BY version DESC').all(projectId) as Revision[];
    },
    
    get: (id: string): Revision | undefined => {
        return db.prepare('SELECT * FROM revisions WHERE id = ?').get(id) as Revision | undefined;
    },
    
    updateStatus: (id: string, status: string, errorMessage?: string): void => {
        const statement = db.prepare(`
            UPDATE revisions 
            SET status = ?, error_message = ? 
            WHERE id = ?
        `);
        statement.run(status, errorMessage || null, id);
    }
};

export const plansApi = {
    save: (id: string, revisionId: string, rawMarkdown: string): RevisionPlan => {
        db.prepare('DELETE FROM revision_plans WHERE revision_id = ?').run(revisionId);
        const statement = db.prepare(`
            INSERT INTO revision_plans (id, revision_id, raw_markdown)
            VALUES (?, ?, ?)
        `);
        statement.run(id, revisionId, rawMarkdown);
        return db.prepare('SELECT * FROM revision_plans WHERE id = ?').get(id) as RevisionPlan;
    },
    
    approve: (revisionId: string): void => {
        db.prepare(`
            UPDATE revision_plans 
            SET approved_at = CURRENT_TIMESTAMP 
            WHERE revision_id = ?
        `).run(revisionId);
    },
    
    getForRevision: (revisionId: string): RevisionPlan | undefined => {
        return db.prepare('SELECT * FROM revision_plans WHERE revision_id = ?').get(revisionId) as RevisionPlan | undefined;
    }
};

export const slidesApi = {
    saveMany: (revisionId: string, slides: Omit<RevisionSlide, 'id' | 'revision_id' | 'created_at'>[]): void => {
        // Use a transaction for fast bulk inserts
        const deleteStmt = db.prepare('DELETE FROM revision_slides WHERE revision_id = ?');
        const insertStmt = db.prepare(`
            INSERT INTO revision_slides (id, revision_id, slide_number, eyebrow, headline, body, language, language_style)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const transaction = db.transaction((slidesList) => {
            deleteStmt.run(revisionId);
            for (const s of slidesList) {
                // Generate a quick stable ID for each slide
                const slideId = uuidv4();
                insertStmt.run(
                    slideId, 
                    revisionId, 
                    s.slide_number, 
                    s.eyebrow || null, 
                    s.headline || null, 
                    s.body || null, 
                    s.language || 'en', 
                    s.language_style || null
                );
            }
        });
        
        transaction(slides);
    },
    
    getForRevision: (revisionId: string): RevisionSlide[] => {
        return db.prepare('SELECT * FROM revision_slides WHERE revision_id = ? ORDER BY slide_number ASC').all() as RevisionSlide[];
    }
};

export const outputsApi = {
    save: (id: string, revisionId: string, htmlFilePath?: string, blogTextContent?: string): RevisionOutput => {
        db.prepare('DELETE FROM revision_outputs WHERE revision_id = ?').run(revisionId);
        const statement = db.prepare(`
            INSERT INTO revision_outputs (id, revision_id, html_file_path, blog_text_content)
            VALUES (?, ?, ?, ?)
        `);
        statement.run(id, revisionId, htmlFilePath || null, blogTextContent || null);
        return db.prepare('SELECT * FROM revision_outputs WHERE id = ?').get(id) as RevisionOutput;
    },
    
    getForRevision: (revisionId: string): RevisionOutput | undefined => {
        return db.prepare('SELECT * FROM revision_outputs WHERE revision_id = ?').get(revisionId) as RevisionOutput | undefined;
    }
};

export const artifactsApi = {
    save: (id: string, revisionId: string, type: string, filePath: string, slideNumber?: number): Artifact => {
        const statement = db.prepare(`
            INSERT INTO artifacts (id, revision_id, type, file_path, slide_number)
            VALUES (?, ?, ?, ?, ?)
        `);
        statement.run(id, revisionId, type, filePath, slideNumber !== undefined ? slideNumber : null);
        return db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id) as Artifact;
    },
    
    listForRevision: (revisionId: string): Artifact[] => {
        return db.prepare('SELECT * FROM artifacts WHERE revision_id = ? ORDER BY slide_number ASC').all() as Artifact[];
    }
};

export const settingsApi = {
    save: (key: string, value: string): void => {
        const statement = db.prepare(`
            INSERT INTO settings (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);
        statement.run(key, value);
    },
    
    get: (key: string): string | undefined => {
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
        return row ? row.value : undefined;
    },
    
    list: (): Record<string, string> => {
        const rows = db.prepare('SELECT * FROM settings').all() as { key: string, value: string }[];
        const settingsMap: Record<string, string> = {};
        for (const row of rows) {
            settingsMap[row.key] = row.value;
        }
        return settingsMap;
    }
};

export interface TelemetryQueueItem {
    id: number;
    event_name: string;
    payload: Record<string, any>;
}

export const telemetryApi = {
    enqueue: (eventName: string, payload: Record<string, any>): void => {
        db.prepare('INSERT INTO telemetry_queue (event_name, payload) VALUES (?, ?)').run(
            eventName,
            JSON.stringify(payload)
        );
    },

    getPending: (limit = 50): TelemetryQueueItem[] => {
        const rows = db.prepare(
            'SELECT id, event_name, payload FROM telemetry_queue WHERE synced = 0 ORDER BY created_at ASC LIMIT ?'
        ).all(limit) as { id: number; event_name: string; payload: string }[];
        return rows.map(r => ({ id: r.id, event_name: r.event_name, payload: JSON.parse(r.payload) }));
    },

    markSynced: (ids: number[]): void => {
        if (ids.length === 0) return;
        const placeholders = ids.map(() => '?').join(',');
        (db.prepare(`UPDATE telemetry_queue SET synced = 1 WHERE id IN (${placeholders})`) as any).run(...ids);
    },

    pruneOldSynced: (): void => {
        // Keep local queue tidy — remove synced events older than 7 days
        db.prepare(`DELETE FROM telemetry_queue WHERE synced = 1 AND created_at < datetime('now', '-7 days')`).run();
    }
};
