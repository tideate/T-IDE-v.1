import { BackendRequirements } from '../tracker/RequirementsAccumulator';
import { CollectionSchema, FirestoreSchema, FirestoreIndex, FirebaseSpec } from './FirebaseSpecGenerator';
import { SecurityRulesGenerator } from './SecurityRulesGenerator';
import { TypeDefinitionGenerator } from './TypeDefinitionGenerator';

export class FirebaseSpecGenerator {
    private securityRulesGenerator = new SecurityRulesGenerator();
    private typeDefinitionGenerator = new TypeDefinitionGenerator();

    public generateFullSpec(requirements: BackendRequirements): FirebaseSpec {
        const firestoreSchema = this.generateFirestoreSchema(requirements);

        return {
            firestoreSchema,
            securityRules: this.securityRulesGenerator.generateFirestoreRules(firestoreSchema, requirements),
            storageRules: this.securityRulesGenerator.generateStorageRules(requirements),
            indexes: this.generateIndexes(requirements),
            typeDefinitions: this.typeDefinitionGenerator.generateTypeDefinitions(firestoreSchema),
            metadata: {
                generatedAt: new Date(),
                source: 'Tideate IDE Backend Intelligence'
            }
        };
    }

    private generateFirestoreSchema(requirements: BackendRequirements): FirestoreSchema {
        const collections: CollectionSchema[] = requirements.collections.map(req => {
            const fields: { [key: string]: string } = {};
            req.fields.forEach(field => {
                fields[field] = 'any'; // Default to any, could infer if we had more info
            });

            return {
                name: req.name,
                fields,
                subcollections: [] // Needs more logic to detect subcollections properly
            };
        });

        return { collections };
    }

    private generateIndexes(requirements: BackendRequirements): FirestoreIndex[] {
        // Placeholder logic for index generation
        // Real implementation needs to analyze 'orderBy' and 'where' combinations
        const indexes: FirestoreIndex[] = [];
        return indexes;
    }
}
