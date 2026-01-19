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
    return {
      firestoreCalls: this.detectFirestoreCalls(sourceFile),
      authCalls: this.detectAuthCalls(sourceFile),
      storageCalls: this.detectStorageCalls(sourceFile),
      functionCalls: this.detectFunctionCalls(sourceFile),
    };
  }

  private detectFirestoreCalls(sourceFile: SourceFile): FirestoreCall[] {
    const calls: FirestoreCall[] = [];
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of callExpressions) {
      const expression = call.getExpression();
      const text = expression.getText();
      const args = call.getArguments();

      // Basic detection logic - can be enhanced
      // collection('name')
      if (text.endsWith('collection') || text.includes('.collection')) {
        if (args.length >= 2) {
            // collection(db, 'name')
            const collectionName = args[1].getText().replace(/['"`]/g, '');
            calls.push({
                collection: collectionName,
                operation: 'reference',
                fields: [],
                location: this.getLocation(sourceFile, call),
            });
        } else if (args.length === 1) {
          const collectionName = args[0].getText().replace(/['"`]/g, '');
          calls.push({
            collection: collectionName,
            operation: 'reference',
            fields: [],
            location: this.getLocation(sourceFile, call),
          });
        }
      }

      // doc('collection/id')
      if (text.endsWith('doc') || text.includes('.doc')) {
          if (args.length >= 2) {
               // doc(db, 'collection', 'id')
               const collectionName = args[1].getText().replace(/['"`]/g, '');
               calls.push({
                  collection: collectionName,
                  operation: 'reference',
                  fields: [],
                  location: this.getLocation(sourceFile, call),
               });
          } else if (args.length === 1) {
              const argText = args[0].getText().replace(/['"`]/g, '');
              if (argText.includes('/')) {
                  const collectionName = argText.split('/')[0];
                  calls.push({
                      collection: collectionName,
                      operation: 'reference',
                      fields: [],
                      location: this.getLocation(sourceFile, call),
                  });
              }
          }
      }

      // Operations: getDocs, getDoc, setDoc, updateDoc, deleteDoc, addDoc
      const operationMap: {[key: string]: string} = {
          'getDocs': 'get',
          'getDoc': 'get',
          'setDoc': 'set',
          'updateDoc': 'update',
          'deleteDoc': 'delete',
          'addDoc': 'add'
      };

      for (const [op, type] of Object.entries(operationMap)) {
          if (text.endsWith(op)) {
               // Usually the first arg is the reference. We might need to trace it back,
               // but for now we capture the operation.
               // If we can find the collection from the reference variable, that would be ideal.
               // For this implementation, we might not link it perfectly without deeper flow analysis.
               // However, we can look for 'fields' in the data argument (usually 2nd for set/update/add).

               let fields: string[] = [];
               if ((type === 'set' || type === 'update' || type === 'add') && args.length >= 2) {
                   const dataArg = args[1]; // Usually 2nd arg
                   if (Node.isObjectLiteralExpression(dataArg)) {
                       fields = dataArg.getProperties().map(p => {
                           if (Node.isPropertyAssignment(p)) {
                               return p.getName();
                           }
                           return '';
                       }).filter(f => f !== '');
                   }
               }

               calls.push({
                   collection: 'unknown', // Hard to infer without flow analysis
                   operation: type,
                   fields: fields,
                   location: this.getLocation(sourceFile, call)
               });
          }
      }
    }

    // Clean up unknown collections if possible (future improvement)
    return calls;
  }

  private detectAuthCalls(sourceFile: SourceFile): AuthCall[] {
    const calls: AuthCall[] = [];
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of callExpressions) {
        const text = call.getExpression().getText();

        if (text.includes('signInWithEmailAndPassword')) {
            calls.push({ provider: 'email', operation: 'signIn', location: this.getLocation(sourceFile, call) });
        } else if (text.includes('createUserWithEmailAndPassword')) {
            calls.push({ provider: 'email', operation: 'signUp', location: this.getLocation(sourceFile, call) });
        } else if (text.includes('signInWithPopup') || text.includes('signInWithRedirect')) {
            // Check arguments for provider
            const args = call.getArguments();
            let provider = 'unknown';
            if (args.length > 1) {
                const providerArg = args[1].getText();
                if (providerArg.includes('GoogleAuthProvider')) provider = 'google';
                else if (providerArg.includes('FacebookAuthProvider')) provider = 'facebook';
                else if (providerArg.includes('GithubAuthProvider')) provider = 'github';
            }
             calls.push({ provider, operation: 'signIn', location: this.getLocation(sourceFile, call) });
        } else if (text.includes('signOut')) {
             calls.push({ provider: 'any', operation: 'signOut', location: this.getLocation(sourceFile, call) });
        }
    }
    return calls;
  }

  private detectStorageCalls(sourceFile: SourceFile): StorageCall[] {
    const calls: StorageCall[] = [];
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of callExpressions) {
        const text = call.getExpression().getText();
        const args = call.getArguments();

        if (text.endsWith('ref') && args.length >= 2) {
             // ref(storage, 'path')
             const path = args[1].getText().replace(/['"`]/g, '');
             calls.push({ path, operation: 'reference', location: this.getLocation(sourceFile, call) });
        }

        const ops = ['uploadBytes', 'uploadString', 'getDownloadURL', 'deleteObject', 'listAll'];
        for (const op of ops) {
            if (text.endsWith(op)) {
                calls.push({ path: 'unknown', operation: op, location: this.getLocation(sourceFile, call) });
            }
        }
    }
    return calls;
  }

  private detectFunctionCalls(sourceFile: SourceFile): FunctionCall[] {
    const calls: FunctionCall[] = [];
     const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of callExpressions) {
        const text = call.getExpression().getText();
        const args = call.getArguments();

        if (text.endsWith('httpsCallable') && args.length >= 2) {
            const functionName = args[1].getText().replace(/['"`]/g, '');
            calls.push({ functionName, location: this.getLocation(sourceFile, call) });
        }
    }
    return calls;
  }

  private getLocation(sourceFile: SourceFile, node: Node): string {
      const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart());
      return `${sourceFile.getFilePath()}:${line}:${column}`;
  }
}
