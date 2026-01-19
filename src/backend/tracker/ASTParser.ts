import { Project, SourceFile } from 'ts-morph';

export class ASTParser {
  private project: Project;

  constructor() {
    this.project = new Project({
      compilerOptions: {
        allowJs: true,
        noEmit: true,
      },
    });
  }

  public parse(code: string, filePath: string): SourceFile {
    // If the file already exists in the project, we update it.
    // Otherwise we create it.
    let sourceFile = this.project.getSourceFile(filePath);
    if (sourceFile) {
      sourceFile.replaceWithText(code);
    } else {
      sourceFile = this.project.createSourceFile(filePath, code, { overwrite: true });
    }
    return sourceFile;
  }

  public addFile(filePath: string): SourceFile {
      return this.project.addSourceFileAtPath(filePath);
  }

  public getSourceFile(filePath: string): SourceFile | undefined {
    let sourceFile = this.project.getSourceFile(filePath);
    if (!sourceFile) {
        try {
            sourceFile = this.project.addSourceFileAtPath(filePath);
        } catch (e) {
            // File might not exist or other error
            return undefined;
        }
    }
    return sourceFile;
  }

  public removeFile(filePath: string): void {
    const sourceFile = this.project.getSourceFile(filePath);
    if (sourceFile) {
      this.project.removeSourceFile(sourceFile);
    }
  }
}
