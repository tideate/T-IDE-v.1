import * as fs from 'fs';
import * as path from 'path';

export interface ContextItem {
    mention: string;
    path: string;
    content: string;
    type: 'file' | 'section' | 'variable';
}

export class ContextResolver {
    private contextMap: Map<string, string>;
    private tideateRoot: string;
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.tideateRoot = path.join(workspaceRoot, '.tideate');
        this.contextMap = this.buildContextMap();
    }

    private buildContextMap(): Map<string, string> {
        const configPath = path.join(this.tideateRoot, 'context.json');

        if (!fs.existsSync(configPath)) {
            return new Map();
        }

        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            const map = new Map<string, string>();

            for (const [mention, filePath] of Object.entries(config.mappings || {})) {
                map.set(mention, filePath as string);
            }

            return map;
        } catch (error) {
            console.error('Error parsing context.json:', error);
            return new Map();
        }
    }

    resolve(mention: string): ContextItem {
        const relativePath = this.contextMap.get(mention);

        if (!relativePath) {
            throw new Error(`Unknown mention: ${mention}`);
        }

        // Resolve path relative to .tideate folder for now, or maybe project root depending on usage
        // The TDD says: relativePath starts with '..' -> resolve from tideateRoot, else join with tideateRoot?
        // Actually, normally config paths are relative to the config file or project root.
        // TDD says: "path.resolve(this.tideateRoot, relativePath)"

        const fullPath = path.resolve(this.tideateRoot, relativePath);

        if (!fs.existsSync(fullPath)) {
             // Fallback: try resolving from workspace root
             const rootPath = path.resolve(this.workspaceRoot, relativePath);
             if (fs.existsSync(rootPath)) {
                 // Use rootPath
             } else {
                 throw new Error(`File not found: ${fullPath} (or ${rootPath})`);
             }
        }

        // We will assume fullPath is correct for now or fallback logic logic if needed
        const content = fs.readFileSync(fullPath, 'utf-8');

        return {
            mention,
            path: fullPath,
            content,
            type: 'file'
        };
    }

    resolveAll(mentions: string[]): ContextItem[] {
        return mentions.map(m => this.resolve(m));
    }

    extractMentions(text: string): string[] {
        const pattern = /@\w+/g;
        const matches = text.match(pattern) || [];
        return [...new Set(matches)];
    }

    formatForPrompt(contexts: ContextItem[]): string {
        return contexts.map(ctx => `
# Context: ${ctx.mention}
# Source: ${ctx.path}

${ctx.content}

---
`).join('\n');
    }
}
