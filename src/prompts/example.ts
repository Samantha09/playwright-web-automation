/**
 * 示例：提示词定义 + registry 工厂
 *
 * 演示「内容(.md) + 类型安全定义(.ts) + registry 渲染」的完整用法，
 * 同时贴合本项目场景——从发现的表单生成登录测试用例（供未来 provider 模块消费）。
 *
 * contentDir 采用相对项目根的路径（与 utils/caseLoader 的约定一致）。
 */
import { definePrompt } from './define';
import { createRegistry } from './registry';
import { PromptRegistry } from './registry';

/** 最小示例：单文件 + 占位符替换 */
export const helloPrompt = definePrompt<{ name: string }>('example/hello', {
  role: 'stable',
});

/** 进阶示例：partials 组合（前置 script/base）+ 中英双语 */
export const generateCase = definePrompt<{
  pageUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
}>('script/generate', {
  partials: ['script/base'],
  role: 'stable',
});

/** 默认示例内容目录（相对项目根）。 */
export const DEFAULT_EXAMPLE_CONTENT_DIR = 'src/prompts/content';

/** 创建挂载了示例定义的 registry。contentDir 默认指向示例内容目录。 */
export function createExampleRegistry(
  contentDir: string = DEFAULT_EXAMPLE_CONTENT_DIR,
): PromptRegistry {
  return createRegistry({
    contentDir,
    definitions: [helloPrompt, generateCase],
  });
}
