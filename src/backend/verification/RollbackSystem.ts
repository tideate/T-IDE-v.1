import * as fs from 'fs';
import * as path from 'path';

export class RollbackSystem {
    private backupDir = '.tideate/backups';

    constructor() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    public async createBackendSnapshot(): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const snapshotId = `backup-${timestamp}`;
        const snapshotDir = path.join(this.backupDir, snapshotId);

        fs.mkdirSync(snapshotDir);

        // Copy critical files if they exist
        const filesToBackup = ['firebase.json', 'firestore.rules', 'storage.rules', 'firestore.indexes.json'];
        for (const file of filesToBackup) {
            if (fs.existsSync(file)) {
                fs.copyFileSync(file, path.join(snapshotDir, file));
            }
        }

        return snapshotId;
    }

    public async rollback(snapshotId: string): Promise<void> {
        const snapshotDir = path.join(this.backupDir, snapshotId);
        if (!fs.existsSync(snapshotDir)) {
            throw new Error(`Snapshot ${snapshotId} not found`);
        }

        const files = fs.readdirSync(snapshotDir);
        for (const file of files) {
            fs.copyFileSync(path.join(snapshotDir, file), file);
        }
    }
}
