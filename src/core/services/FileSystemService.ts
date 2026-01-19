import * as fs from 'fs';
import * as path from 'path';

export class FileSystemService {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    private resolvePath(filePath: string): string {
        return path.resolve(this.workspaceRoot, filePath);
    }

    async readFile(filePath: string): Promise<string> {
        const fullPath = this.resolvePath(filePath);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        return fs.promises.readFile(fullPath, 'utf-8');
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        const fullPath = this.resolvePath(filePath);
        await this.createDirectory(path.dirname(filePath));
        await fs.promises.writeFile(fullPath, content, 'utf-8');
    }

    async deleteFile(filePath: string): Promise<void> {
        const fullPath = this.resolvePath(filePath);
        if (fs.existsSync(fullPath)) {
            await fs.promises.unlink(fullPath);
        }
    }

    async exists(filePath: string): Promise<boolean> {
        const fullPath = this.resolvePath(filePath);
        return fs.existsSync(fullPath);
    }

    async createDirectory(dirPath: string): Promise<void> {
        const fullPath = this.resolvePath(dirPath);
        if (!fs.existsSync(fullPath)) {
            await fs.promises.mkdir(fullPath, { recursive: true });
        }
    }
}
