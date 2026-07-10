/**
 * Provider 模块公共导出。
 *
 * 目前实现 MiniMax（finbot 同款 Anthropic-compatible 端点），
 * LLMProvider 接口为后续接入 OpenAI / Claude 等预留扩展点。
 */
export type { LLMProvider, CompletionOptions, CompletionResult, CompletionUsage } from './types';
export { MiniMaxProvider, createMiniMaxProviderFromEnv } from './minimax';
