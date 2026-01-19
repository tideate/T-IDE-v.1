import { FirebaseSpec } from '../spec/FirebaseSpecGenerator';

export interface HandoffPrompt {
  systemContext: string;
  taskDescription: string;
  specifications: string;
  constraints: string[];
  expectedOutputs: string[];
}

export class PromptFormatter {
    public formatHandoffPrompt(spec: FirebaseSpec): HandoffPrompt {
        return {
            systemContext: `You are an expert Firebase developer assisting with the backend configuration for the Tideate IDE project.`,
            taskDescription: `Please configure the Firebase backend according to the following specification. This includes Firestore schema, security rules, storage rules, and indexes.`,
            specifications: `
### Firestore Schema
${JSON.stringify(spec.firestoreSchema, null, 2)}

### Security Rules (Firestore)
\`\`\`
${spec.securityRules}
\`\`\`

### Security Rules (Storage)
\`\`\`
${spec.storageRules}
\`\`\`

### Indexes
${JSON.stringify(spec.indexes, null, 2)}
`,
            constraints: [
                "Ensure all security rules deny access by default unless explicitly allowed.",
                "Use Firebase v9 modular SDK conventions.",
                "Validate that indexes are optimized for the queries."
            ],
            expectedOutputs: [
                "Confirmation that the configuration is ready to be applied.",
                "Any suggestions for optimization."
            ]
        };
    }
}
