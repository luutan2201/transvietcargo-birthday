/**
 * AI Service abstraction (Phase 7 scaffolding). UI never calls a provider
 * directly — always through this interface, per 11. AI IMPLEMENTATION RULES
 * in the master build prompt. Concrete providers (Gemini, Claude, …) plug
 * in by implementing AIProviderAdapter; none are wired to a live API key
 * in this local-only build.
 */
export interface AIProviderAdapter {
  readonly name: string;
  generateText(prompt: string): Promise<string>;
}

export class NullAIProvider implements AIProviderAdapter {
  readonly name = 'none';
  async generateText(): Promise<string> {
    throw new Error('No AI provider is configured. Configure one in Settings > AI Providers.');
  }
}

class AIService {
  private provider: AIProviderAdapter = new NullAIProvider();

  setProvider(provider: AIProviderAdapter) {
    this.provider = provider;
  }

  getProviderName(): string {
    return this.provider.name;
  }

  generateText(prompt: string): Promise<string> {
    return this.provider.generateText(prompt);
  }
}

export const aiService = new AIService();
