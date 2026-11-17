// Types for search-core.js (kept as plain JS so scripts/test-search.js can import it from Node).

export type SearchField = 'title' | 'keywords' | 'name' | 'summary' | 'category' | 'description' | 'frequent' | 'headings' | 'body';

export const FIELD_WEIGHTS: Record<SearchField, number>;

export interface SearchDocInput {
  id: string;
  url: string;
  title: string;
  category: string;
  summary?: string;
  /** Comma-separated. */
  keywords?: string;
  description?: string;
  /** Markdown body; headings are indexed separately from the rest. */
  body?: string;
  /** Text of the skill's references/ files, indexed as part of the body. */
  references?: string[];
  /** Lives outside this site (ecosystem skills). */
  external?: boolean;
  /** Every skill id; description sentences naming another skill are routing text and are not indexed. */
  skillIds?: string[];
}

export interface SearchDoc {
  id: string;
  url: string;
  title: string;
  category: string;
  summary: string;
  external?: true;
  phrases: string[];
  description: string;
  fields: Partial<Record<SearchField, string[]>>;
}

export interface SearchResult {
  doc: SearchDoc;
  score: number;
  /** True when the skill only mentions the query in passing (listed after ranked results). */
  mention: boolean;
}

export function stem(word: string): string;
export function stripRouting(description: string, otherIds: string[]): string;
export function tokenize(text: string): string[];
export function buildSearchDoc(input: SearchDocInput): SearchDoc;
export function searchDocs(docs: SearchDoc[], query: string, options?: { limit?: number }): SearchResult[];
