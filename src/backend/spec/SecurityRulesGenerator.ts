import { BackendRequirements } from '../tracker/RequirementsAccumulator';
import { FirestoreSchema } from './FirebaseSpecGenerator';

export class SecurityRulesGenerator {
    public generateFirestoreRules(schema: FirestoreSchema, requirements: BackendRequirements): string {
        let rules = `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n`;

        // Helper function
        rules += `    function isAuthenticated() {\n      return request.auth != null;\n    }\n\n`;

        schema.collections.forEach(col => {
            rules += `    match /${col.name}/{document} {\n`;

            // Check operations
            const req = requirements.collections.find(c => c.name === col.name);
            if (req) {
                if (req.operations.has('get') || req.operations.has('list') || req.operations.has('query')) {
                    rules += `      allow read: if isAuthenticated();\n`;
                }
                if (req.operations.has('set') || req.operations.has('update') || req.operations.has('delete') || req.operations.has('add')) {
                    rules += `      allow write: if isAuthenticated();\n`;
                }
            } else {
                 // Default safe
                 rules += `      allow read, write: if isAuthenticated();\n`;
            }

            rules += `    }\n`;
        });

        rules += `  }\n}\n`;
        return rules;
    }

    public generateStorageRules(requirements: BackendRequirements): string {
        let rules = `rules_version = '2';\nservice firebase.storage {\n  match /b/{bucket}/o {\n`;

        requirements.storagePaths.forEach(pathReq => {
            // pathReq.path might be a specific file or a folder prefix
            // We need to handle wildcards.
            // If path is "images/user123.jpg", rule should probably be match /images/{allPaths=**}
            // Simple heuristic:

            const rulePath = pathReq.path.split('/').map(p => p.includes('{') ? p : `{${p}}`).join('/'); // Very naive
            // Better: just allow everything for now with auth check, or try to be specific.
            // Let's use a generic match for now as extracting exact rule paths from code strings is hard.

            rules += `    match /${pathReq.path} {\n`;
            rules += `      allow read, write: if request.auth != null;\n`;
            rules += `    }\n`;
        });

        // Default deny all others? Or default allow auth?
        // Checklist says "Default to restrictive rules (authenticated only)"

        rules += `  }\n}\n`;
        return rules;
    }
}
