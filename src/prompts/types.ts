/**
 * 提示词管理模块 - 共享类型
 *
 * 设计参考 OpenClaw 的「内容/逻辑分离」：提示词正文是数据 (PromptFile)，
 * 类型安全与组合逻辑在定义层 (PromptDefinition)。
 */

/** 从 .md 文件加载的原始提示词（一个文件 = 一个 prompt 的一个语言版本） */
export interface PromptFile {
  /** 全局唯一标识，如 `script/generate`，来自 frontmatter */
  id: string;
  /** 语义化版本字符串，来自 frontmatter */
  version: string;
  /** 语言代码，如 `zh` / `en`，来自 frontmatter */
  lang: string;
  /** 可选标题，来自 frontmatter */
  title?: string;
  /** 提示词正文（已剥离 frontmatter），含 `{{var}}` 占位符 */
  body: string;
  /** 源文件绝对路径，用于报错定位 */
  filePath: string;
}

/**
 * 提示词定义（.ts 层）：携带类型安全的参数契约与组合逻辑。
 * 泛型 TParams 约束 render 时传入的参数。
 */
export interface PromptDefinition<TParams = Record<string, unknown>> {
  /** 对应 PromptFile 的 id */
  id: string;
  /** 可选：要前置的子 prompt id 列表（用相同 params 渲染后传入 compose） */
  partials?: string[];
  /** 可选：自定义组合逻辑；不提供时按 partials 顺序拼接 + 主体 */
  compose?: (body: string, partials: Record<string, string>) => string;
  /** 可选：缓存角色标记（为未来 stable/dynamic 缓存边界预留，当前不做缓存） */
  role?: 'stable' | 'dynamic';
  /** 可选：断言与内容 frontmatter 版本一致，不一致则报错 */
  version?: string;
  /** 仅用于在定义对象上保留泛型信息（运行时无意义） */
  readonly __params?: TParams;
}

/** 渲染选项 */
export interface RenderOptions {
  /** 期望的语言；缺失时回退到 registry 默认语言 */
  lang?: string;
}

/** 渲染产物：LLM-ready 的字符串 + 身份元数据 */
export interface RenderResult {
  text: string;
  id: string;
  version: string;
  lang: string;
}

/** createRegistry 的输入 */
export interface RegistryOptions {
  /** 提示词内容目录（递归读取 .md） */
  contentDir: string;
  /** 类型安全的定义列表 */
  definitions?: PromptDefinition[];
  /** 默认语言（请求语言缺失时回退），默认 `zh` */
  defaultLang?: string;
}
