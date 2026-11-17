// Skill search: index building (build time) and ranking (in the browser).
//
// Plain JS with no dependencies so the same code runs in three places:
//   - src/pages/api/search-index.json.ts builds the index at build time
//   - the homepage search script ranks results in the browser
//   - scripts/test-search.js checks known queries in CI (npm run validate)
//
// Matching is per word, not per phrase: "custom domain name" matches a skill
// containing "custom", "domains" and "name" anywhere, in any order. Each query
// word scores by the best field it hits, so a hit in a skill's title or
// keywords outweighs the same word buried in its body. The body is the whole
// SKILL.md plus its references/ files; a word the body uses repeatedly is a
// topic of the skill and counts as much as one in its description.

/** How much a query word is worth when it matches in each field. */
export const FIELD_WEIGHTS = {
  title: 10,
  keywords: 8,
  name: 6,
  summary: 6,
  category: 3,
  description: 3,
  frequent: 3, // body words used throughout the skill: what it is about
  headings: 2,
  body: 1, // body words mentioned in passing
};
// A body word is a topic of the skill if it is used at least FREQUENT_MIN times
// and at least FREQUENT_RATE of all body words: four uses of "error" in a long
// skill is incidental, a word used throughout a short one is not.
const FREQUENT_MIN = 4;
const FREQUENT_RATE = 0.002;
// Text nobody curated for search: no typo forgiveness ("timer" is not "time").
const UNCURATED = new Set(['frequent', 'body']);
const FIELDS = Object.keys(FIELD_WEIGHTS);

// Words that carry no meaning in a query ("how do I add a ...").
const STOPWORDS = new Set(
  ('a an and are as at be but by can do does for from how i if in into is it its me my of on or our so ' +
    'that the their then there these this to use using want was we what when where which while who why ' +
    'will with without you your').split(' '),
);

/** Reduce plural/verb forms so "domains" matches "domain" and "queries" matches "query". */
export function stem(word) {
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 4 && /(ss|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

// Compound identifiers kept whole: fetch_root_key, mops.toml, mo:core, ic-wasm.
const COMPOUND = /[A-Za-z0-9]+(?:[_.:-][A-Za-z0-9]+)+/g;

/**
 * Split text into stemmed search terms. camelCase and snake_case identifiers
 * also yield their parts, so "StableBTreeMap" is found by "stable" and
 * "icrc1_transfer" by "transfer". Compound identifiers are also kept whole, so
 * "fetch_root_key" ranks the skill that uses it above one that merely has the
 * words fetch, root and key somewhere.
 */
export function tokenize(text) {
  const out = [];
  for (const m of String(text).match(COMPOUND) ?? []) {
    if (m.length >= 5 && /[a-z]/i.test(m)) out.push(m.toLowerCase());
  }
  for (const raw of String(text).split(/[^A-Za-z0-9]+/)) {
    if (!raw) continue;
    const parts = raw.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
    const words = parts.length > 1 ? [raw, ...parts] : [raw];
    for (const w of words) {
      const lw = w.toLowerCase();
      if (lw.length < 2 || STOPWORDS.has(lw)) continue;
      out.push(stem(lw));
    }
  }
  return out;
}

const unique = (arr) => [...new Set(arr)];
const normalizePhrase = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();

/** Markdown headings (#, ##, ###…) outside fenced code blocks. */
function extractHeadings(markdown) {
  const headings = [];
  let inFence = false;
  for (const line of String(markdown).split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    else if (!inFence) {
      const m = /^#{1,6}\s+(.*)$/.exec(line);
      if (m) headings.push(m[1]);
    }
  }
  return headings;
}

/**
 * Drop the routing sentences from a trigger description: "Do NOT use for X —
 * use other-skill instead", "For Y, use other-skill". They name topics the
 * skill does NOT cover, so indexing them makes it match the very searches it
 * redirects away from (wallet-integration matching "login").
 *
 * A sentence is routing if it says "do not use" / "not for", or names another
 * skill: a hyphenated skill id anywhere, or a one-word id after use/load/see.
 */
export function stripRouting(description, otherIds) {
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hyphenated = otherIds.filter((x) => x.includes('-')).map(esc);
  const single = otherIds.filter((x) => !x.includes('-')).map(esc);
  const patterns = [/\bdo not use\b/i, /\bnot for\b/i];
  if (hyphenated.length) patterns.push(new RegExp(`(^|[^a-z0-9-])(${hyphenated.join('|')})($|[^a-z0-9-])`, 'i'));
  if (single.length) patterns.push(new RegExp(`\\b(use|load|see)\\s+(the\\s+)?\`?(${single.join('|')})\\b`, 'i'));
  return String(description)
    .split(/(?<=[.;])\s+/)
    .filter((sentence) => !patterns.some((re) => re.test(sentence)))
    .join(' ');
}

/**
 * Build one index entry. Each field holds unique stemmed terms; a term is kept
 * only in the highest-weighted field it appears in, which keeps the index small
 * without changing scores (a word scores by its best field anyway).
 */
export function buildSearchDoc({ id, url, title, category, summary = '', keywords = '', description = '', body = '', references = [], external = false, skillIds = [] }) {
  body = [body, ...references].join('\n\n');
  description = stripRouting(description, skillIds.filter((s) => s !== id));
  const keywordList = String(keywords).split(',').map((k) => k.trim()).filter(Boolean);
  const raw = {
    title: tokenize(title),
    keywords: tokenize(keywordList.join(' ')),
    name: tokenize(id.replace(/-/g, ' ')),
    summary: tokenize(summary),
    category: tokenize(category),
    description: tokenize(description),
    headings: tokenize(extractHeadings(body).join(' ')),
    body: [],
    frequent: [],
  };
  const bodyTerms = tokenize(body);
  const counts = new Map();
  for (const t of bodyTerms) counts.set(t, (counts.get(t) ?? 0) + 1);
  const minUses = Math.max(FREQUENT_MIN, bodyTerms.length * FREQUENT_RATE);
  for (const [t, c] of counts) (c >= minUses ? raw.frequent : raw.body).push(t);
  const seen = new Set();
  const fields = {};
  for (const f of FIELDS) {
    const terms = unique(raw[f]).filter((t) => !seen.has(t));
    terms.forEach((t) => seen.add(t));
    if (terms.length) fields[f] = terms;
  }
  return {
    id,
    url,
    title,
    category,
    summary,
    ...(external ? { external: true } : {}),
    // Lowercased text for whole-phrase bonuses ("domain name" as typed).
    phrases: [title, summary, ...keywordList].map(normalizePhrase),
    description: normalizePhrase(description),
    fields,
  };
}

/** Levenshtein distance <= 1 (one typo: substitution, insertion or deletion). */
function withinOneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * How well one query term matches a field's terms: 1 exact, 0.8 prefix
 * (search-as-you-type: "dom" → "domain"), 0.5 one-typo, 0 none. Prefixes count
 * only for the word still being typed; a finished word "sign" must not match
 * "signature" or "signer". Typos are forgiven only in curated fields, not body
 * text, where a near-miss is nearly always a different word ("login" vs "logic").
 */
function termMatch(term, terms, allowPrefix, allowTypo) {
  if (!terms) return 0;
  let best = 0;
  for (const t of terms) {
    if (t === term) return 1;
    if (allowPrefix && term.length >= 3 && t.startsWith(term)) best = Math.max(best, 0.8);
    else if (allowTypo && best < 0.5 && term.length >= 5 && withinOneEdit(term, t)) best = 0.5;
  }
  return best;
}

/**
 * Rank docs for a query. Returns [{ doc, score, mention }]: ranked results
 * first (mention: false), then skills that only mention the query
 * (mention: true).
 *
 * Ranked results are skills that are ABOUT the query: at least one word hits
 * something above passing body text (title, keywords, summary, description,
 * headings, or a word the skill uses throughout).
 * - Every query word scores by the best field it matches (FIELD_WEIGHTS),
 *   times its rarity: a word found in few skills ("login") counts for more
 *   than one found in most ("agent"), so common words cannot carry a result.
 * - Skills matching fewer than half the query words are dropped; partial
 *   matches are penalised by coverage², so a skill matching every word wins.
 *   When some skill matches every word outside its body text, skills
 *   matching only some words are dropped entirely.
 * - A title or keyword equal to the whole query earns a bonus, and so does a
 *   multi-word query appearing verbatim in a title, summary or keyword, so
 *   "domain name" ranks the skill that lists exactly that first.
 * - Results scoring under 35% of the best result (before bonuses) are trimmed:
 *   a search that finds its answer should show that answer and its close
 *   alternatives, not the whole site.
 *
 * Mentions are every other skill whose text contains ALL the query words, only
 * in passing. They keep the skill text fully searchable ("timer" finds every
 * skill that touches timers) without crowding the skills about the query.
 */
export function searchDocs(docs, query, { limit = Infinity } = {}) {
  const qTerms = unique(tokenize(query));
  if (qTerms.length === 0) return [];
  const phrase = normalizePhrase(query);
  const multiWord = phrase.includes(' ');
  // Only the last word typed can be half-typed, and not once a space follows
  // it. "sign in" has no half-typed term: "in" is a stopword, "sign" is done.
  const lastTyped = /\s$/.test(query) ? [] : tokenize(String(query).split(/\s+/).pop());
  const prefixIdx = lastTyped.length ? qTerms.indexOf(lastTyped[lastTyped.length - 1]) : -1;

  // best[d][t]: weighted match of query term t in doc d (0 if absent).
  const best = docs.map((doc) =>
    qTerms.map((term, t) => {
      let b = 0;
      for (const f of FIELDS) {
        const w = FIELD_WEIGHTS[f];
        if (w <= b) break; // fields are in descending weight order
        b = Math.max(b, termMatch(term, doc.fields[f], t === prefixIdx, !UNCURATED.has(f)) * w);
      }
      return b;
    }),
  );
  // Rarity (IDF), normalised so a word in exactly one skill weighs 1.
  const n = docs.length;
  const idf = qTerms.map((_, t) => {
    const df = best.reduce((c, row) => c + (row[t] > 0 ? 1 : 0), 0);
    return df ? Math.log(1 + n / df) / Math.log(1 + n) : 0;
  });

  // If some skill matches every word outside its body text (title, keywords,
  // summary, description, headings), the query is understood: skills matching
  // only some of the words are noise ("agent login" ↛ "agent skills").
  const strongFloor = FIELD_WEIGHTS.headings;
  const understood = qTerms.length > 1 && best.some((row) => row.every((b) => b >= strongFloor));

  const ranked = [];
  const mentions = [];
  docs.forEach((doc, d) => {
    let score = 0;
    let matched = 0;
    qTerms.forEach((_, t) => {
      if (best[d][t] > 0) matched++;
      score += best[d][t] * idf[t];
    });
    if (matched === 0) return;
    const coverage = matched / qTerms.length;
    // Passing body mentions only: no word hits anything above body weight.
    if (best[d].every((b) => b <= FIELD_WEIGHTS.body)) {
      if (coverage === 1) mentions.push({ doc, score, mention: true });
      return;
    }
    if (coverage < 0.5 || (understood && coverage < 1)) return;
    score *= coverage * coverage;
    const base = score;
    // A keyword/title equal to the whole query ("login") beats one merely containing it ("agent login").
    if (doc.phrases.includes(phrase)) score += 6;
    if (multiWord && phrase.length >= 4) {
      if (doc.phrases.some((p) => p.includes(phrase))) score += 10;
      else if (doc.description.includes(phrase)) score += 4;
    }
    ranked.push({ doc, score, base });
  });
  // The noise floor uses scores before phrase bonuses: a bonus should reorder
  // results, not hide reasonable alternatives ("login" → org and agent sign-in too).
  const floor = Math.max(0, ...ranked.map((r) => r.base)) * 0.35;
  const byScore = (a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title);
  const kept = [];
  for (const r of ranked.sort(byScore)) {
    if (r.base >= floor) kept.push({ doc: r.doc, score: r.score, mention: false });
    // Trimmed results still contain every word: list them as mentions.
    else if (best[docs.indexOf(r.doc)].every((b) => b > 0)) mentions.push({ doc: r.doc, score: r.score, mention: true });
  }
  return [...kept, ...mentions.sort(byScore)].slice(0, limit);
}
