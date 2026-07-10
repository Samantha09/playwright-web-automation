import { env } from '../utils/env';
import { CompletionOptions, CompletionResult, LLMProvider } from './types';

const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicTextContent {
  type: 'text';
  text: string;
}

interface AnthropicErrorContent {
  type?: string;
  error?: { type?: string; message?: string };
}

type AnthropicContent = AnthropicTextContent | AnthropicErrorContent;

interface AnthropicResponse {
  id?: string;
  type?: string;
  content?: AnthropicContent[];
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { type?: string; message?: string };
}

/**
 * MiniMax provider（使用 finbot 同款 Anthropic-compatible 端点）。
 *
 * 默认配置来自 finbot：
 * - baseUrl: https://api.minimaxi.com/anthropic
 * - model: MiniMax-M2.7
 * - auth: x-api-key header
 *
 * 不引入任何外部 HTTP 依赖，直接使用 Node.js 原生 fetch。
 */
export class MiniMaxProvider implements LLMProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = 'https://api.minimaxi.com/anthropic',
    private readonly defaultModel: string = 'MiniMax-M2.7',
    private readonly fetchImpl: typeof fetch = globalThis.fetch,
  ) {}

  async complete(prompt: string, options: CompletionOptions = {}): Promise<CompletionResult> {
    if (!this.apiKey) {
      throw new Error('MiniMaxProvider requires an API key');
    }

    const model = options.model ?? this.defaultModel;
    const maxTokens = options.maxTokens ?? 1024;
    const messages: AnthropicMessage[] = [{ role: 'user', content: prompt }];

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      messages,
    };
    if (options.system) body.system = options.system;
    if (options.temperature !== undefined) body.temperature = options.temperature;

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`MiniMax request failed: ${msg}`);
    }

    let data: AnthropicResponse;
    try {
      data = (await res.json()) as AnthropicResponse;
    } catch (err) {
      throw new Error(`MiniMax returned non-JSON response (status ${res.status})`);
    }

    if (!res.ok) {
      const errorMessage = data.error?.message ?? `HTTP ${res.status}`;
      throw new Error(`MiniMax error: ${errorMessage}`);
    }

    const text = data.content?.find((c): c is AnthropicTextContent => c.type === 'text')?.text ?? '';

    return {
      text,
      model: data.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
          }
        : undefined,
    };
  }
}

/** 使用 env.ts 中默认配置创建 MiniMax provider。 */
export function createMiniMaxProviderFromEnv(): MiniMaxProvider {
  return new MiniMaxProvider(env.MINIMAX_API_KEY, env.MINIMAX_BASE_URL, env.MINIMAX_MODEL);
}
