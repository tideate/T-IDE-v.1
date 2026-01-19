import { LLMClient, LLMCompletionRequest, LLMCompletionResponse } from './LLMClient';

export class MockLLMClient implements LLMClient {
    private mockResponses: Map<string, string>;
    private defaultResponse: string;

    constructor(mockResponses: Map<string, string> = new Map(), defaultResponse: string = 'Mock response') {
        this.mockResponses = mockResponses;
        this.defaultResponse = defaultResponse;
    }

    async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
        let content = this.defaultResponse;

        // Simple matching logic for mocks
        for (const [key, value] of this.mockResponses.entries()) {
            if (request.userPrompt.includes(key) || request.systemPrompt.includes(key)) {
                content = value;
                break;
            }
        }

        if (request.responseFormat === 'json') {
             // Ensure the mock response is valid JSON if requested
             try {
                 JSON.parse(content);
             } catch (e) {
                 // If not valid JSON, wrap it in a simple JSON object
                 content = JSON.stringify({ message: content });
             }
        }

        return {
            content,
            usage: {
                inputTokens: 10,
                outputTokens: 10,
            },
            model: 'mock-model',
        };
    }

    addMockResponse(trigger: string, response: string) {
        this.mockResponses.set(trigger, response);
    }
}
