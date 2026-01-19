
import { ASTParser } from '../../../backend/tracker/ASTParser';
import { CodeAnalyzer } from '../../../backend/tracker/CodeAnalyzer';
import { expect } from 'chai';
import * as path from 'path';

describe('CodeAnalyzer', () => {
    let parser: ASTParser;
    let analyzer: CodeAnalyzer;

    beforeEach(() => {
        parser = new ASTParser();
        analyzer = new CodeAnalyzer(parser);
    });

    it('should detect Firestore collection calls', () => {
        const code = `
            import { collection, getDocs } from 'firebase/firestore';
            const colRef = collection(db, 'users');
            getDocs(colRef);
        `;
        const result = analyzer.analyzeCode(code, 'test.ts');
        expect(result.firestoreCalls).to.have.lengthOf(2);
        expect(result.firestoreCalls[0].collection).to.equal('users');
        expect(result.firestoreCalls[0].operation).to.equal('reference');
        expect(result.firestoreCalls[1].operation).to.equal('get');
    });

    it('should detect Auth calls', () => {
        const code = `
            import { signInWithEmailAndPassword } from 'firebase/auth';
            signInWithEmailAndPassword(auth, 'email', 'password');
        `;
        const result = analyzer.analyzeCode(code, 'test-auth.ts');
        expect(result.authCalls).to.have.lengthOf(1);
        expect(result.authCalls[0].operation).to.equal('signIn');
        expect(result.authCalls[0].provider).to.equal('email');
    });

    it('should detect Storage calls', () => {
        const code = `
            import { ref, uploadBytes } from 'firebase/storage';
            const storageRef = ref(storage, 'images/test.jpg');
            uploadBytes(storageRef, file);
        `;
        const result = analyzer.analyzeCode(code, 'test-storage.ts');
        expect(result.storageCalls).to.have.lengthOf(2);
        expect(result.storageCalls[0].path).to.equal('images/test.jpg');
        expect(result.storageCalls[1].operation).to.equal('uploadBytes');
    });
});
