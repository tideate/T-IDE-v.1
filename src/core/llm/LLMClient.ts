export interface LLMCompletionRequest {
    systemPrompt: string;
    userPrompt: string;
    responseFormat?: 'text' | 'json';
    maxTokens?: number;
    temperature?: number;
}

export interface LLMCompletionResponse {
    content: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
    model: string;
}

export interface LLMClient {
    complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
}
