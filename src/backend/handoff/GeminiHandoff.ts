import { FirebaseSpec } from '../spec/FirebaseSpecGenerator';
import { PromptFormatter, HandoffPrompt } from './PromptFormatter';
import * as vscode from 'vscode'; // Assuming we can use vscode types, but might need to be careful if running in separate process

export class GeminiHandoff {
    private formatter = new PromptFormatter();

    public prepareHandoff(spec: FirebaseSpec): HandoffPrompt {
        return this.formatter.formatHandoffPrompt(spec);
    }

    public async copyToClipboard(prompt: HandoffPrompt): Promise<void> {
        const fullText = `
${prompt.systemContext}

${prompt.taskDescription}

${prompt.specifications}

Constraints:
${prompt.constraints.map(c => `- ${c}`).join('\n')}

Expected Outputs:
${prompt.expectedOutputs.map(o => `- ${o}`).join('\n')}
`;
        await vscode.env.clipboard.writeText(fullText);
    }

    public async openGeminiPanel(): Promise<void> {
        // This command ID depends on what extension provides the Gemini panel.
        // Assuming there is a generic command or we implement one.
        // For now, let's assume we show a message instructing the user.
        // Or if we have a specific command.

        // "One-click Gemini handoff" implies we might open a URL or a view.
        // Checklist says "Open Gemini panel ... (VS Code command)"
        // Maybe `workbench.view.extension.gemini-sidebar` or similar?
        // Let's just execute a command placeholder.

        // try {
        //     await vscode.commands.executeCommand('gemini.openChat');
        // } catch (e) {
        //     // Fallback
             vscode.window.showInformationMessage('Gemini Handoff prompt copied to clipboard. Please open your AI assistant.');
        // }
    }

    public async executeHandoff(spec: FirebaseSpec): Promise<void> {
        const prompt = this.prepareHandoff(spec);
        await this.copyToClipboard(prompt);
        await this.openGeminiPanel();
    }
}
