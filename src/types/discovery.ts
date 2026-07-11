export interface DiscoveredField {
  role: string;
  selector: string;
  label?: string;
  confidence: number;
}

export interface DiscoveredForm {
  id: string;
  pageUrl: string;
  formSelector?: string;
  confidence: number;
  fields: DiscoveredField[];
  submitSelector?: string;
}

/** 录制的 API 请求载荷样本(首次出现时存) */
export interface DiscoveredApi {
  url: string;
  method: string;
  seenCount: number;
  sampleRequest?: { body?: unknown };
  sampleResponse?: { status?: number; body?: unknown };
}

export interface DiscoveredPage {
  url: string;
  title?: string;
  /** 同源可爬取链接(向后兼容,爬取用) */
  links: string[];
  /** 页面结构模型(导航/标题/动作) */
  structure?: PageStructure;
  /** 页面截图相对路径(如 screenshots/home.png),相对 discovered 目录 */
  screenshot?: string;
}

export interface DiscoveredHeading {
  level: number;
  text: string;
}

export interface DiscoveredAction {
  kind: 'link' | 'button';
  text: string;
  selector: string;
  /** 仅 link 有 */
  href?: string;
}

export interface DiscoveredNavItem {
  text: string;
  /** 锚点导航的链接(SPA 菜单可能没有) */
  href?: string;
  /** 可点击选择器(SPA 菜单为 li/div,需用选择器点击) */
  selector?: string;
}

/** 页面结构:导航、标题大纲、可交互动作(表单由 DiscoveredForm 单独承载) */
export interface PageStructure {
  title?: string;
  nav: DiscoveredNavItem[];
  headings: DiscoveredHeading[];
  actions: DiscoveredAction[];
}

export interface CandidateCase {
  id: string;
  name: string;
  confidence: number;
  target: { baseUrl: string; entry: string };
  steps: { action: string; params: Record<string, unknown> }[];
  assertions: { type: string; selector?: string; expected?: unknown }[];
  source: string;
}
