import { DiscoveredForm, CandidateCase, PageStructure } from '../types/discovery';
import { slugify } from '../utils/slug';

const MAX_NAV_CANDIDATES = 8;

export class CandidateGenerator {
  generateFromForm(form: DiscoveredForm, baseUrl: string): CandidateCase[] {
    const cases: CandidateCase[] = [];
    const hasPassword = form.fields.some((f) => f.role === 'password');
    const hasSearch = form.fields.some((f) => f.role === 'search');

    if (hasPassword) {
      cases.push(this.generateLoginCase(form, baseUrl));
    }

    if (hasSearch) {
      cases.push(this.generateSearchCase(form, baseUrl));
    }

    return cases;
  }

  /** 从页面结构生成导航冒烟候选(点击导航链接 → 断言跳转/可见) */
  generateFromStructure(structure: PageStructure, pageUrl: string, baseUrl: string): CandidateCase[] {
    const entry = this.entryPath(pageUrl);
    const pageSlug = this.pageSlug(pageUrl);
    const cases: CandidateCase[] = [];
    const nav = structure.nav.slice(0, MAX_NAV_CANDIDATES);

    nav.forEach((item, i) => {
      const navPath = this.urlPath(item.href);
      const safeText = !!item.text && !item.text.includes('"');
      const steps: { action: string; params: Record<string, unknown> }[] = [
        { action: 'goto', params: { url: entry } },
      ];
      if (safeText) {
        steps.push({ action: 'click', params: { selector: `a:has-text("${item.text}")` } });
      } else if (navPath) {
        steps.push({ action: 'goto', params: { url: navPath } });
      }
      cases.push({
        id: `nav-${pageSlug}-${i + 1}`,
        name: `导航冒烟: ${item.text}`,
        confidence: 0.5,
        target: { baseUrl, entry },
        steps,
        assertions: [
          navPath ? { type: 'urlContains', expected: navPath } : { type: 'visible', selector: 'body' },
        ],
        source: 'heuristic-nav',
      });
    });
    return cases;
  }

  private entryPath(pageUrl: string): string {
    try {
      return new URL(pageUrl).pathname || '/';
    } catch {
      return '/';
    }
  }

  private pageSlug(pageUrl: string): string {
    try {
      return slugify(new URL(pageUrl).pathname) || 'root';
    } catch {
      return 'root';
    }
  }

  private urlPath(href: string): string | undefined {
    try {
      return new URL(href).pathname || undefined;
    } catch {
      return undefined;
    }
  }

  private generateLoginCase(form: DiscoveredForm, baseUrl: string): CandidateCase {
    const usernameField = form.fields.find((f) => f.role === 'username') || form.fields[0];
    const passwordField = form.fields.find((f) => f.role === 'password');
    const captchaField = form.fields.find((f) => f.role === 'captcha');
    const entry = new URL(form.pageUrl).pathname;

    return {
      id: `${form.id}-login`,
      name: `Login via ${form.id}`,
      confidence: form.confidence,
      target: { baseUrl, entry },
      steps: [
        { action: 'goto', params: { url: entry } },
        ...(usernameField
          ? [{ action: 'fill', params: { selector: usernameField.selector, value: '${USERNAME}' } }]
          : []),
        ...(passwordField
          ? [{ action: 'fill', params: { selector: passwordField.selector, value: '${PASSWORD}' } }]
          : []),
        ...(captchaField
          ? [{ action: 'fill', params: { selector: captchaField.selector, value: '${CAPTCHA}' } }]
          : []),
        ...(form.submitSelector
          ? [{ action: 'click', params: { selector: form.submitSelector } }]
          : []),
      ],
      assertions: [{ type: 'urlNotContains', expected: '/login' }],
      source: 'heuristic-login',
    };
  }

  private generateSearchCase(form: DiscoveredForm, baseUrl: string): CandidateCase {
    const searchField = form.fields.find((f) => f.role === 'search');
    const entry = new URL(form.pageUrl).pathname;

    return {
      id: `${form.id}-search`,
      name: `Search via ${form.id}`,
      confidence: form.confidence * 0.9,
      target: { baseUrl, entry },
      steps: [
        { action: 'goto', params: { url: entry } },
        ...(searchField
          ? [
              { action: 'fill', params: { selector: searchField.selector, value: 'test query' } },
              ...(form.submitSelector
                ? [{ action: 'click', params: { selector: form.submitSelector } }]
                : []),
            ]
          : []),
      ],
      assertions: [{ type: 'visible', selector: 'body' }],
      source: 'heuristic-search',
    };
  }
}
