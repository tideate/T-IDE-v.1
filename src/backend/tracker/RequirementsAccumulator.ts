import { AnalysisResult, CodeAnalyzer, FirestoreCall } from './CodeAnalyzer';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface CollectionRequirement {
  name: string;
  fields: Set<string>;
  operations: Set<string>;
  sources: Set<string>;
}

export interface StoragePathRequirement {
  path: string;
  operations: Set<string>;
  sources: Set<string>;
}

export interface FunctionRequirement {
  name: string;
  sources: Set<string>;
}

export interface BackendRequirements {
  collections: CollectionRequirement[];
  authProviders: Set<string>;
  storagePaths: StoragePathRequirement[];
  functions: FunctionRequirement[];
  lastUpdated: Date;
}

// JSON-serializable version of BackendRequirements
interface BackendRequirementsJSON {
  collections: {
    name: string;
    fields: string[];
    operations: string[];
    sources: string[];
  }[];
  authProviders: string[];
  storagePaths: {
    path: string;
    operations: string[];
    sources: string[];
  }[];
  functions: {
    name: string;
    sources: string[];
  }[];
  lastUpdated: string;
}

export class RequirementsAccumulator {
  private requirements: BackendRequirements = {
    collections: [],
    authProviders: new Set(),
    storagePaths: [],
    functions: [],
    lastUpdated: new Date(),
  };

  constructor(private codeAnalyzer: CodeAnalyzer) {}

  public getRequirements(): BackendRequirements {
    return this.requirements;
  }

  public addAnalysisResult(result: AnalysisResult, sourceFile: string): void {
    // Merge Firestore calls
    for (const call of result.firestoreCalls) {
      if (call.collection === 'unknown') continue; // Skip unknown collections for now

      let collectionReq = this.requirements.collections.find(c => c.name === call.collection);
      if (!collectionReq) {
        collectionReq = {
          name: call.collection,
          fields: new Set(),
          operations: new Set(),
          sources: new Set(),
        };
        this.requirements.collections.push(collectionReq);
      }

      call.fields.forEach(f => collectionReq!.fields.add(f));
      collectionReq.operations.add(call.operation);
      collectionReq.sources.add(sourceFile);
    }

    // Merge Auth calls
    for (const call of result.authCalls) {
        if (call.provider !== 'unknown' && call.provider !== 'any') {
            this.requirements.authProviders.add(call.provider);
        }
    }

    // Merge Storage calls
    for (const call of result.storageCalls) {
        if (call.path === 'unknown') continue;

        let storageReq = this.requirements.storagePaths.find(s => s.path === call.path);
        if (!storageReq) {
            storageReq = {
                path: call.path,
                operations: new Set(),
                sources: new Set()
            };
            this.requirements.storagePaths.push(storageReq);
        }
        storageReq.operations.add(call.operation);
        storageReq.sources.add(sourceFile);
    }

    // Merge Function calls
    for (const call of result.functionCalls) {
        let funcReq = this.requirements.functions.find(f => f.name === call.functionName);
        if (!funcReq) {
            funcReq = {
                name: call.functionName,
                sources: new Set()
            };
            this.requirements.functions.push(funcReq);
        }
        funcReq.sources.add(sourceFile);
    }

    this.requirements.lastUpdated = new Date();
  }

  public async scanCodebase(srcPath: string): Promise<BackendRequirements> {
      // Use vscode.workspace.findFiles to avoid blocking the main thread with synchronous fs calls
      // and to respect .gitignore
      const files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx}', '**/node_modules/**');

      for (const uri of files) {
          const file = uri.fsPath;
          try {
              // Analyze file - CodeAnalyzer calls TS compiler API which might be sync,
              // but we are at least finding files async.
              // We could yield to the event loop here if needed.
              await new Promise(resolve => setTimeout(resolve, 0));

              const analysis = this.codeAnalyzer.analyzeFile(file);
              this.addAnalysisResult(analysis, file);
          } catch (e) {
              console.error(`Failed to analyze ${file}:`, e);
          }
      }
      return this.requirements;
  }

  public updateFile(filePath: string): void {
      // Remove old requirements from this file
      this.removeRequirementsFromFile(filePath);

      // Re-analyze
      try {
          const analysis = this.codeAnalyzer.analyzeFile(filePath);
          this.addAnalysisResult(analysis, filePath);
      } catch (e) {
          console.error(`Failed to update analysis for ${filePath}:`, e);
      }
  }

  private removeRequirementsFromFile(filePath: string): void {
      // Logic to remove entries where source == filePath
      // This is a bit tricky with the current structure since we aggregate.
      // We'd need to re-aggregate or decrement counts.
      // For sets, we can check if this is the only source.

      this.requirements.collections.forEach(c => {
          if (c.sources.has(filePath)) {
              c.sources.delete(filePath);
              // If no sources left, we could remove the collection, but maybe we keep it?
              // The checklist says "Remove old requirements from that file".
              // If a collection is ONLY used in this file, it should probably be removed.
          }
      });
      this.requirements.collections = this.requirements.collections.filter(c => c.sources.size > 0);

      // Same for others...
      this.requirements.storagePaths.forEach(s => {
          if (s.sources.has(filePath)) s.sources.delete(filePath);
      });
      this.requirements.storagePaths = this.requirements.storagePaths.filter(s => s.sources.size > 0);

      this.requirements.functions.forEach(f => {
          if (f.sources.has(filePath)) f.sources.delete(filePath);
      });
      this.requirements.functions = this.requirements.functions.filter(f => f.sources.size > 0);

      // Auth providers are just a set of strings, difficult to track source without changing structure.
      // For now, we accept auth providers might linger until full rescan.
  }

  public async save(filePath: string = '.tideate/backend-requirements.json'): Promise<void> {
      const json: BackendRequirementsJSON = {
          collections: this.requirements.collections.map(c => ({
              name: c.name,
              fields: Array.from(c.fields),
              operations: Array.from(c.operations),
              sources: Array.from(c.sources)
          })),
          authProviders: Array.from(this.requirements.authProviders),
          storagePaths: this.requirements.storagePaths.map(s => ({
              path: s.path,
              operations: Array.from(s.operations),
              sources: Array.from(s.sources)
          })),
          functions: this.requirements.functions.map(f => ({
              name: f.name,
              sources: Array.from(f.sources)
          })),
          lastUpdated: this.requirements.lastUpdated.toISOString()
      };

      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
  }

  public async load(filePath: string = '.tideate/backend-requirements.json'): Promise<void> {
      if (!fs.existsSync(filePath)) return;

      const content = fs.readFileSync(filePath, 'utf-8');
      const json: BackendRequirementsJSON = JSON.parse(content);

      this.requirements = {
          collections: json.collections.map(c => ({
              name: c.name,
              fields: new Set(c.fields),
              operations: new Set(c.operations),
              sources: new Set(c.sources)
          })),
          authProviders: new Set(json.authProviders),
          storagePaths: json.storagePaths.map(s => ({
              path: s.path,
              operations: new Set(s.operations),
              sources: new Set(s.sources)
          })),
          functions: json.functions.map(f => ({
              name: f.name,
              sources: new Set(f.sources)
          })),
          lastUpdated: new Date(json.lastUpdated)
      };
  }
}
