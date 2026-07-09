import { DiscoveredForm, CandidateCase } from '../types/discovery';

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

  private generateLoginCase(form: DiscoveredForm, baseUrl: string): CandidateCase {
    const usernameField = form.fields.find((f) => f.role === 'username') || form.fields[0];
    const passwordField = form.fields.find((f) => f.role === 'password');
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
