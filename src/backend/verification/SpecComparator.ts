import { FirestoreSchema } from '../spec/FirebaseSpecGenerator';

export interface SpecDiff {
    missingCollections: string[];
    extraCollections: string[];
    fieldMismatches: string[];
}

export class SpecComparator {
    public compareSpec(expected: FirestoreSchema, actual: FirestoreSchema): SpecDiff {
        const missingCollections: string[] = [];
        const extraCollections: string[] = [];
        const fieldMismatches: string[] = [];

        const expectedNames = new Set(expected.collections.map(c => c.name));
        const actualNames = new Set(actual.collections.map(c => c.name));

        for (const name of expectedNames) {
            if (!actualNames.has(name)) {
                missingCollections.push(name);
            }
        }

        for (const name of actualNames) {
            if (!expectedNames.has(name)) {
                extraCollections.push(name);
            }
        }

        // Deep compare fields if collection exists in both
        // ...

        return {
            missingCollections,
            extraCollections,
            fieldMismatches
        };
    }
}
