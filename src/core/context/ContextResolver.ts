import * as fs from 'fs';
import * as path from 'path';

export interface ContextItem {
    mention: string;
    path: string;
    content: string;
    type: 'file' | 'section' | 'variable';
}

export class ContextResolutionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ContextResolutionError';
    }
}

export class ContextResolver {
    private contextMap: Map<string, string>;
    private tideateRoot: string;

    constructor(private workspaceRoot: string) {
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

            if (config.mappings) {
                for (const [mention, filePath] of Object.entries(config.mappings)) {
                    map.set(mention, filePath as string);
                }
            }

            return map;
        } catch (error) {
             console.error('Error parsing context.json:', error);
            return new Map();
        }
    }

    /**
     * Resolve a single @mention to file content
     * DETERMINISTIC: No AI involvement, direct file read
     */
    resolve(mention: string): ContextItem {
        const relativePath = this.contextMap.get(mention);

        if (!relativePath) {
            throw new ContextResolutionError(`Unknown mention: ${mention}`);
        }

        const fullPath = relativePath.startsWith('..')
            ? path.resolve(this.tideateRoot, relativePath)
            : path.join(this.tideateRoot, relativePath);

        if (!fs.existsSync(fullPath)) {
            // Fallback: try resolving from workspace root
             const rootPath = path.resolve(this.workspaceRoot, relativePath);
             if (fs.existsSync(rootPath)) {
                 // Use rootPath (logic needs valid path to be returned, here we just check existence)
                 // But wait, fullPath was constructed from tideateRoot.
                 // If relativePath is "src/foo.ts", tideateRoot join is ".tideate/src/foo.ts" which is wrong.
                 // So we should try workspaceRoot join first if it's not starting with ".."
                 // But TDD said mappings are in .tideate/context.json.

                 // If the mapping is "src/foo.ts", likely it means workspace root relative.
             }

             // For now, let's stick to the simpler logic:
             // If not found at fullPath, check if it exists relative to workspaceRoot
             const workspaceFullPath = path.resolve(this.workspaceRoot, relativePath);
             if (fs.existsSync(workspaceFullPath)) {
                 return {
                     mention,
                     path: workspaceFullPath,
                     content: fs.readFileSync(workspaceFullPath, 'utf-8'),
                     type: 'file'
                 };
             }

            throw new ContextResolutionError(`File not found: ${fullPath}`);
        }

        // Read raw content - NO AI PROCESSING
        const content = fs.readFileSync(fullPath, 'utf-8');

        return {
            mention,
            path: fullPath,
            content,
            type: 'file'
        };
    }

    /**
     * Resolve multiple @mentions
     */
    resolveAll(mentions: string[]): ContextItem[] {
        return mentions.map(m => this.resolve(m));
    }

    /**
     * Extract @mentions from text
     */
    extractMentions(text: string): string[] {
        const pattern = /@\w+/g;
        const matches = text.match(pattern) || [];
        return [...new Set(matches)];
    }

    /**
     * Format contexts for injection into AI prompt
     */
    formatForPrompt(contexts: ContextItem[]): string {
        return contexts.map(ctx => `
# Context: ${ctx.mention}
# Source: ${ctx.path}

${ctx.content}

---
`).join('\n');
    }

    /**
     * Get all available mentions
     */
    getAvailableMentions(): string[] {
        return Array.from(this.contextMap.keys());
    }
}
