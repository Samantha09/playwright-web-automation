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

export interface DiscoveredApi {
  url: string;
  method: string;
  seenCount: number;
  sampleRequest?: unknown;
  sampleResponse?: unknown;
}

export interface DiscoveredPage {
  url: string;
  title?: string;
  links: string[];
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
