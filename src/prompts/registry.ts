import { loadPrompts, assertNoDuplicates } from './loader';
import { substitutePlaceholders, composeBody } from './renderer';
import { normalizePromptText } from './normalize';
import { PromptDefinition, PromptFile, RegistryOptions, RenderOptions, RenderResult } from './types';

/**
 * 提示词注册中心：按 id 索引内容（按语言分组）与类型安全定义，
 * 提供纯函数式渲染入口。负责 I/O 与校验，渲染变换委托给 renderer。
 */
export class PromptRegistry {
  private byIdLang = new Map<string, Map<string, PromptFile>>();
  private defs = new Map<string, PromptDefinition>();
  private readonly defaultLang: string;

  constructor(opts: RegistryOptions) {
    this.defaultLang = opts.defaultLang ?? 'zh';

    const files = loadPrompts(opts.contentDir);
    assertNoDuplicates(files);
    for (const file of files) {
      let langMap = this.byIdLang.get(file.id);
      if (!langMap) {
        langMap = new Map();
        this.byIdLang.set(file.id, langMap);
      }
      langMap.set(file.lang, file);
    }

    for (const def of opts.definitions ?? []) {
      if (this.defs.has(def.id)) {
        throw new Error(`Duplicate prompt definition: ${def.id}`);
      }
      this.defs.set(def.id, def);
    }

    this.validateDefinitions();
  }

  /** 类型安全渲染：params 受定义泛型约束。 */
  render<T>(def: PromptDefinition<T>, params: T, opts?: RenderOptions): RenderResult;
  /** 动态按 id 渲染（弱类型，供 provider 等运行时调用）。 */
  render(id: string, params: Record<string, unknown>, opts?: RenderOptions): RenderResult;
  render(
    defOrId: PromptDefinition | string,
    params: Record<string, unknown>,
    opts?: RenderOptions,
  ): RenderResult {
    const id = typeof defOrId === 'string' ? defOrId : defOrId.id;
    const def = typeof defOrId === 'string' ? this.defs.get(defOrId) : defOrId;
    const file = this.resolveFile(id, opts?.lang);

    const body = substitutePlaceholders(file.body, params, id);

    const partialIds = def?.partials ?? [];
    const partialTexts: Record<string, string> = {};
    for (const partialId of partialIds) {
      const partialFile = this.resolveFile(partialId, opts?.lang);
      partialTexts[partialId] = substitutePlaceholders(partialFile.body, params, partialId);
    }

    const composed = def ? composeBody(body, partialTexts, def) : body;
    const text = normalizePromptText(composed);

    return { text, id, version: file.version, lang: file.lang };
  }

  has(id: string): boolean {
    return this.byIdLang.has(id);
  }

  list(): string[] {
    return [...this.byIdLang.keys()];
  }

  get(id: string, lang?: string): PromptFile {
    return this.resolveFile(id, lang);
  }

  private resolveFile(id: string, lang?: string): PromptFile {
    const langMap = this.byIdLang.get(id);
    if (!langMap) {
      throw new Error(`Unknown prompt id: ${id}`);
    }
    const wanted = lang ?? this.defaultLang;

    let file = langMap.get(wanted);
    if (!file) {
      file = langMap.get(this.defaultLang);
      if (file && wanted !== this.defaultLang) {
        console.warn(
          `Prompt <${id}> language "${wanted}" not found, falling back to "${this.defaultLang}"`,
        );
      }
    }
    if (!file) {
      file = langMap.values().next().value;
      if (file) {
        console.warn(
          `Prompt <${id}> falling back to only available language "${file.lang}"`,
        );
      }
    }
    if (!file) {
      throw new Error(`Prompt <${id}> has no content`);
    }
    return file;
  }

  private validateDefinitions(): void {
    for (const def of this.defs.values()) {
      if (!this.byIdLang.has(def.id)) {
        throw new Error(`Prompt definition <${def.id}> has no matching content file`);
      }
      if (def.version) {
        for (const file of this.byIdLang.get(def.id)!.values()) {
          if (file.version !== def.version) {
            throw new Error(
              `Prompt <${def.id}> version mismatch: definition ${def.version} vs content ${file.version} (${file.filePath})`,
            );
          }
        }
      }
      for (const partialId of def.partials ?? []) {
        if (!this.byIdLang.has(partialId)) {
          throw new Error(`Prompt <${def.id}> references unknown partial: ${partialId}`);
        }
      }
    }
  }
}

/** 工厂：创建 registry 实例（无隐藏全局状态，便于测试与多实例）。 */
export function createRegistry(opts: RegistryOptions): PromptRegistry {
  return new PromptRegistry(opts);
}
