import { SourceFile, SyntaxKind, CallExpression, Node } from 'ts-morph';
import { ASTParser } from './ASTParser';

export interface FirestoreCall {
  collection: string;
  operation: string; // 'get' | 'set' | 'update' | 'delete' | 'query'
  fields: string[];
  location: string;
}

export interface AuthCall {
  provider: string;
  operation: string;
  location: string;
}

export interface StorageCall {
  path: string;
  operation: string; // 'upload' | 'download' | 'delete' | 'list'
  location: string;
}

export interface FunctionCall {
  functionName: string;
  region?: string;
  location: string;
}

export interface AnalysisResult {
  firestoreCalls: FirestoreCall[];
  authCalls: AuthCall[];
  storageCalls: StorageCall[];
  functionCalls: FunctionCall[];
}

export class CodeAnalyzer {
  constructor(private astParser: ASTParser) {}

  public analyzeFile(filePath: string): AnalysisResult {
    const sourceFile = this.astParser.getSourceFile(filePath);
    if (!sourceFile) {
      throw new Error(`File not found in AST: ${filePath}`);
    }
    return this.analyzeSourceFile(sourceFile);
  }

  public analyzeCode(code: string, filePath: string): AnalysisResult {
    const sourceFile = this.astParser.parse(code, filePath);
    return this.analyzeSourceFile(sourceFile);
  }

  private analyzeSourceFile(sourceFile: SourceFile): AnalysisResult {
    // Single pass traversal optimization
    const firestoreCalls: FirestoreCall[] = [];
    const authCalls: AuthCall[] = [];
    const storageCalls: StorageCall[] = [];
    const functionCalls: FunctionCall[] = [];

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of callExpressions) {
      this.processCallExpression(call, sourceFile, {
        firestoreCalls,
        authCalls,
        storageCalls,
        functionCalls
      });
    }

    return {
      firestoreCalls,
      authCalls,
      storageCalls,
      functionCalls,
    };
  }

  private processCallExpression(
      call: CallExpression,
      sourceFile: SourceFile,
      accumulators: {
          firestoreCalls: FirestoreCall[],
          authCalls: AuthCall[],
          storageCalls: StorageCall[],
          functionCalls: FunctionCall[]
      }
  ) {
      const expression = call.getExpression();
      const text = expression.getText();
      const args = call.getArguments();
      const location = this.getLocation(sourceFile, call);

      // --- Firestore Detection ---
      if (text.endsWith('collection') || text.includes('.collection')) {
          let collectionName = '';
          if (args.length >= 2) {
              collectionName = args[1].getText().replace(/['"`]/g, '');
          } else if (args.length === 1) {
              collectionName = args[0].getText().replace(/['"`]/g, '');
          }
          if (collectionName) {
            accumulators.firestoreCalls.push({
                collection: collectionName,
                operation: 'reference',
                fields: [],
                location
            });
          }
      }

      if (text.endsWith('doc') || text.includes('.doc')) {
           if (args.length >= 2) {
               const collectionName = args[1].getText().replace(/['"`]/g, '');
               accumulators.firestoreCalls.push({
                  collection: collectionName,
                  operation: 'reference',
                  fields: [],
                  location
               });
          } else if (args.length === 1) {
              const argText = args[0].getText().replace(/['"`]/g, '');
              if (argText.includes('/')) {
                  const collectionName = argText.split('/')[0];
                  accumulators.firestoreCalls.push({
                      collection: collectionName,
                      operation: 'reference',
                      fields: [],
                      location
                  });
              }
          }
      }

      const firestoreOps: {[key: string]: string} = {
          'getDocs': 'get',
          'getDoc': 'get',
          'setDoc': 'set',
          'updateDoc': 'update',
          'deleteDoc': 'delete',
          'addDoc': 'add'
      };

      for (const [op, type] of Object.entries(firestoreOps)) {
          if (text.endsWith(op)) {
               let fields: string[] = [];
               if ((type === 'set' || type === 'update' || type === 'add') && args.length >= 2) {
                   const dataArg = args[1];
                   if (Node.isObjectLiteralExpression(dataArg)) {
                       fields = dataArg.getProperties().map(p => {
                           if (Node.isPropertyAssignment(p)) {
                               return p.getName();
                           }
                           return '';
                       }).filter(f => f !== '');
                   }
               }
               accumulators.firestoreCalls.push({
                   collection: 'unknown',
                   operation: type,
                   fields: fields,
                   location
               });
          }
      }

      // --- Auth Detection ---
      if (text.includes('signInWithEmailAndPassword')) {
        accumulators.authCalls.push({ provider: 'email', operation: 'signIn', location });
      } else if (text.includes('createUserWithEmailAndPassword')) {
        accumulators.authCalls.push({ provider: 'email', operation: 'signUp', location });
      } else if (text.includes('signInWithPopup') || text.includes('signInWithRedirect')) {
        let provider = 'unknown';
        if (args.length > 1) {
            const providerArg = args[1].getText();
            if (providerArg.includes('GoogleAuthProvider')) provider = 'google';
            else if (providerArg.includes('FacebookAuthProvider')) provider = 'facebook';
            else if (providerArg.includes('GithubAuthProvider')) provider = 'github';
        }
        accumulators.authCalls.push({ provider, operation: 'signIn', location });
      } else if (text.includes('signOut')) {
        accumulators.authCalls.push({ provider: 'any', operation: 'signOut', location });
      }

      // --- Storage Detection ---
      if (text.endsWith('ref') && args.length >= 2) {
          const path = args[1].getText().replace(/['"`]/g, '');
          accumulators.storageCalls.push({ path, operation: 'reference', location });
      }

      const storageOps = ['uploadBytes', 'uploadString', 'getDownloadURL', 'deleteObject', 'listAll'];
      for (const op of storageOps) {
          if (text.endsWith(op)) {
            accumulators.storageCalls.push({ path: 'unknown', operation: op, location });
          }
      }

      // --- Function Detection ---
      if (text.endsWith('httpsCallable') && args.length >= 2) {
          const functionName = args[1].getText().replace(/['"`]/g, '');
          accumulators.functionCalls.push({ functionName, location });
      }
  }

  private getLocation(sourceFile: SourceFile, node: Node): string {
      const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart());
      return `${sourceFile.getFilePath()}:${line}:${column}`;
  }
}
