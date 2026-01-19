import { Anthropic } from '@anthropic-ai/sdk';
import { LLMClient, LLMCompletionRequest, LLMCompletionResponse } from './LLMClient';

export class AnthropicClient implements LLMClient {
    private client: Anthropic;
    private model: string;

    constructor(apiKey?: string, model: string = 'claude-3-5-sonnet-20240620') {
        const key = apiKey || process.env.ANTHROPIC_API_KEY;
        if (!key) {
            throw new Error('Anthropic API key is required. Please set ANTHROPIC_API_KEY environment variable or pass it to the constructor.');
        }
        this.client = new Anthropic({ apiKey: key });
        this.model = model;
    }

    async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
        try {
            const message = await this.client.messages.create({
                model: this.model,
                max_tokens: request.maxTokens || 4096,
                temperature: request.temperature || 0,
                system: request.systemPrompt,
                messages: [
                    { role: 'user', content: request.userPrompt }
                ],
            });

            const contentBlock = message.content[0];
            let content = '';

            if (contentBlock.type === 'text') {
                content = contentBlock.text;
            } else {
                 // Fallback for other content types if necessary, though for now we expect text
                 content = JSON.stringify(contentBlock);
            }

            if (request.responseFormat === 'json') {
                // Basic JSON extraction if the model wraps it in markdown code blocks
                const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
                if (jsonMatch) {
                    content = jsonMatch[1];
                }

                // Validate JSON
                try {
                    JSON.parse(content);
                } catch (e) {
                    throw new Error('Failed to parse JSON response from LLM');
                }
            }

            return {
                content,
                usage: {
                    inputTokens: message.usage.input_tokens,
                    outputTokens: message.usage.output_tokens,
                },
                model: message.model,
            };
        } catch (error) {
            console.error('Anthropic API Error:', error);
            throw error;
        }
    }
}
