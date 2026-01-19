import { LLMClient } from './LLMClient';
import { AnthropicClient } from './AnthropicClient';
import { MockLLMClient } from './MockLLMClient';

export class LLMClientFactory {
    static createClient(provider: 'anthropic' | 'mock' = 'anthropic'): LLMClient {
        if (provider === 'mock') {
            return new MockLLMClient();
        }

        let apiKey: string | undefined;
        try {
            // Dynamic import to avoid crash in non-VSCode environments
            const vscode = require('vscode');
            const config = vscode.workspace.getConfiguration('cline');
            // Logic to get API key if exposed in config (security risk, usually strictly env or secret)
        } catch (error) {
            // Likely running in a test environment without vscode module
        }

        return new AnthropicClient(apiKey);
    }
}
