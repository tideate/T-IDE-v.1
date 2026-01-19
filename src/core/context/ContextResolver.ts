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
        if (!workspaceRoot) {
            throw new Error('Workspace root is required for ContextResolver');
        }
        this.tideateRoot = path.join(workspaceRoot, '.tideate');
        this.contextMap = this.buildContextMap();
    }

    private buildContextMap(): Map<string, string> {
        const configPath = path.join(this.tideateRoot, 'context.json');

        if (!fs.existsSync(configPath)) {
            return new Map();
        }

        try {
            const content = fs.readFileSync(configPath, 'utf-8');
            if (!content) return new Map();

            const config = JSON.parse(content);
            const map = new Map<string, string>();

            if (config && config.mappings) {
                for (const [mention, filePath] of Object.entries(config.mappings)) {
                    if (typeof filePath === 'string') {
                        map.set(mention, filePath);
                    }
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

        // Fix path resolution logic to be more robust
        let fullPath: string;

        // 1. Try resolving relative to .tideate directory (standard behavior from TDD)
        if (relativePath.startsWith('..')) {
             fullPath = path.resolve(this.tideateRoot, relativePath);
        } else {
             fullPath = path.join(this.tideateRoot, relativePath);
        }

        if (!fs.existsSync(fullPath)) {
            // 2. Fallback: try resolving from workspace root if not found in .tideate
            // This handles cases where mapping points directly to src/ files
            const workspaceFullPath = path.resolve(this.workspaceRoot, relativePath);
            if (fs.existsSync(workspaceFullPath)) {
                fullPath = workspaceFullPath;
            } else {
                throw new ContextResolutionError(`File not found: ${fullPath} (or ${workspaceFullPath})`);
            }
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
        if (!mentions) return [];
        return mentions.map(m => this.resolve(m));
    }

    /**
     * Extract @mentions from text
     */
    extractMentions(text: string): string[] {
        if (!text) return [];
        const pattern = /@\w+/g;
        const matches = text.match(pattern) || [];
        return [...new Set(matches)];
    }

    /**
     * Format contexts for injection into AI prompt
     */
    formatForPrompt(contexts: ContextItem[]): string {
        if (!contexts || contexts.length === 0) return '';
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
