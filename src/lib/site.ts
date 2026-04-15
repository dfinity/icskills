// Site-wide constants. Everything trust-signalling (author, repo, license)
// is centralised so every page and structured-data blob cites the same source.

export const SITE = {
  url: 'https://skills.internetcomputer.org',
  name: 'Internet Computer Skills',
  shortName: 'ICP Skills',
  tagline: 'Agent-readable skill files for building on the Internet Computer.',
  description:
    'A curated database of agent-readable skills for building on the Internet Computer (ICP). ' +
    'Each skill captures correct dependency versions, configuration formats, and common pitfalls ' +
    'that prevent build failures. Maintained by DFINITY.',
  locale: 'en-US',
  author: {
    name: 'DFINITY Foundation',
    url: 'https://dfinity.org',
  },
  repo: {
    name: 'dfinity/icskills',
    url: 'https://github.com/dfinity/icskills',
  },
  license: {
    spdx: 'Apache-2.0',
    url: 'https://www.apache.org/licenses/LICENSE-2.0',
  },
} as const;

export function absUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return new URL(path, SITE.url).toString();
}
