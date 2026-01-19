import { FirestoreSchema } from './FirebaseSpecGenerator';

export class TypeDefinitionGenerator {
    public generateTypeDefinitions(schema: FirestoreSchema): string {
        let output = `// Auto-generated Firebase Type Definitions\n\n`;

        schema.collections.forEach(col => {
            const interfaceName = this.capitalize(col.name);
            output += `export interface ${interfaceName} {\n`;

            if (Object.keys(col.fields).length === 0) {
                 output += `  [key: string]: any;\n`;
            } else {
                for (const [field, type] of Object.entries(col.fields)) {
                    output += `  ${field}: ${type};\n`;
                }
            }
            output += `}\n\n`;
        });

        return output;
    }

    private capitalize(s: string): string {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
}
