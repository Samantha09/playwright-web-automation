import { PromptDefinition } from './types';

/**
 * 类型安全的提示词定义助手。
 *
 * 泛型 TParams 约束该 prompt 的参数形状，使后续 `registry.render(def, params)`
 * 在编译期对 params 做类型检查（OpenClaw 式「渲染器保持类型契约」的轻量版）。
 *
 * @example
 *   export const generateScript = definePrompt<{ topic: string; style: string }>(
 *     'script/generate',
 *     { role: 'stable' },
 *   );
 */
export function definePrompt<TParams = Record<string, unknown>>(
  id: string,
  def: Omit<PromptDefinition<TParams>, 'id' | '__params'> = {},
): PromptDefinition<TParams> {
  return { id, ...def };
}
