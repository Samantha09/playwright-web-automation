/**
 * Provider 抽象层。
 *
 * 与 prompt 模块解耦：prompt 模块产出字符串；provider 模块负责把字符串发出去并取回结果。
 */

export interface CompletionOptions {
  /** 本次调用要使用的模型 ID，默认取 provider 构造时的模型 */
  model?: string;
  /** 最大生成 token 数 */
  maxTokens?: number;
  /** 系统提示词（ Anthropic Messages API 的顶层 system 字段） */
  system?: string;
  /** 采样温度 */
  temperature?: number;
}

export interface CompletionUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface CompletionResult {
  text: string;
  model?: string;
  usage?: CompletionUsage;
}

export interface LLMProvider {
  complete(prompt: string, options?: CompletionOptions): Promise<CompletionResult>;
}
