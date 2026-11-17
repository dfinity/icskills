// Header search, on every page. The search icon (or "/" or Cmd/Ctrl+K) opens a
// field beneath the header. While it holds a query, the page's own content is
// hidden and ranked results show in its place; clearing it (or Esc) restores
// the page. The query lives in ?q= so a search can be shared, bookmarked, or
// opened directly by an agent driving a browser.
//
// Ranking is in search-core.js; the index is /api/search-index.json, fetched
// the first time search is opened.

import { searchDocs, tokenize, type SearchDoc } from './search-core.js';

export function initSiteSearch(): void {
  const toggle = document.getElementById('search-toggle') as HTMLButtonElement | null;
  const panel = document.getElementById('site-search');
  const input = document.getElementById('skill-search') as HTMLInputElement | null;
  const results = document.getElementById('search-results');
  const list = document.getElementById('search-results-list');
  const count = document.getElementById('search-results-count');
  const empty = document.getElementById('search-empty');
  const mentions = document.getElementById('search-mentions');
  const mentionsHeading = document.getElementById('search-mentions-heading');
  const mentionsList = document.getElementById('search-mentions-list');
  const unavailable = document.getElementById('search-unavailable');
  const externalNotice = document.getElementById('search-external-notice');
  const main = document.getElementById('main');
  if (!toggle || !panel || !input || !results || !list || !count || !empty || !main) return;
  if (!mentions || !mentionsHeading || !mentionsList || !unavailable || !externalNotice) return;

  toggle.hidden = false;

  let docs: SearchDoc[] | null = null;
  let loading: Promise<boolean> | null = null;
  /**
   * Fetch the index once. Resolves true when it loaded. On failure it resolves
   * false and forgets the attempt, so the NEXT user action retries: never retry
   * automatically, or an outage turns every open tab into a request loop.
   */
  function loadIndex(): Promise<boolean> {
    loading ??= fetch('/api/search-index.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { docs: SearchDoc[] }) => { docs = data.docs; return true; })
      .catch(() => { loading = null; return false; });
    return loading;
  }

  /** Hide (or restore) everything in <main> except the results section. */
  function setPageHidden(hide: boolean) {
    for (const el of Array.from(main!.children) as HTMLElement[]) {
      if (el === results) continue;
      if (hide && !el.hidden) { el.hidden = true; el.dataset.searchHidden = ''; }
      else if (!hide && 'searchHidden' in el.dataset) { el.hidden = false; delete el.dataset.searchHidden; }
    }
  }

  function syncUrl(q: string) {
    const url = new URL(location.href);
    if (q) url.searchParams.set('q', q);
    else url.searchParams.delete('q');
    history.replaceState(history.state, '', url);
  }

  let current: SearchDoc[] = [];
  function render() {
    // Rank the raw text: a trailing space marks the last word as finished, so
    // "sign " must not prefix-match "signer". Trim only to test for emptiness
    // and for the URL.
    const raw = input!.value;
    const q = raw.trim();
    syncUrl(q);
    unavailable!.hidden = true;
    // Nothing searchable yet (one letter, or only words like "how to"): keep
    // the page rather than claim that no skill matches.
    if (tokenize(q).length === 0) {
      current = [];
      results!.hidden = true;
      setPageHidden(false);
      return;
    }
    if (!docs) {
      loadIndex().then((loaded) => {
        if (loaded) render();
        else showUnavailable();
      });
      return;
    }
    const hits = searchDocs(docs, raw);
    const ranked = hits.filter((h) => !h.mention).map((h) => h.doc);
    const mentioned = hits.filter((h) => h.mention).map((h) => h.doc);
    current = [...ranked, ...mentioned];
    list!.replaceChildren(...ranked.map(renderRow));
    count!.textContent = `${ranked.length} skill${ranked.length === 1 ? '' : 's'}`;
    mentionsList!.replaceChildren(...mentioned.map(renderMention));
    mentionsHeading!.textContent = `${ranked.length ? 'Also mentioned in' : 'Mentioned in'} ${mentioned.length} skill${mentioned.length === 1 ? '' : 's'}`;
    mentions!.hidden = mentioned.length === 0;
    empty!.hidden = current.length > 0;
    externalNotice!.hidden = !current.some((d) => d.external);
    results!.hidden = false;
    setPageHidden(true);
  }

  /** The index could not be fetched: say so, rather than claim nothing matches. */
  function showUnavailable() {
    if (!input!.value.trim()) return; // cleared while the request was in flight
    current = [];
    list!.replaceChildren();
    mentions!.hidden = true;
    empty!.hidden = true;
    externalNotice!.hidden = true;
    count!.textContent = '';
    unavailable!.hidden = false;
    results!.hidden = false;
    setPageHidden(true);
  }

  function open() {
    if (panel!.hidden) {
      panel!.hidden = false;
      toggle!.setAttribute('aria-expanded', 'true');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    input!.focus();
    loadIndex();
  }

  function close() {
    input!.value = '';
    render();
    panel!.hidden = true;
    toggle!.setAttribute('aria-expanded', 'false');
    toggle!.focus();
  }

  toggle.addEventListener('click', () => (panel.hidden ? open() : close()));
  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && current[0]) { e.preventDefault(); openDoc(current[0]); }
  });
  document.addEventListener('keydown', (e) => {
    // Esc closes search from anywhere while it is open, including after
    // tabbing from the field into the results.
    if (e.key === 'Escape' && !panel.hidden) { e.preventDefault(); close(); return; }
    const t = e.target as HTMLElement | null;
    const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const slash = e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey;
    const cmdK = e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey) && !e.altKey;
    if (slash || cmdK) { e.preventDefault(); open(); }
  });

  // Arriving with ?q= (shared link, agent, back/forward): show those results.
  const initial = new URLSearchParams(location.search).get('q');
  if (initial) {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    input.value = initial;
    render();
  }
}

function openDoc(doc: SearchDoc) {
  if (doc.external) window.open(doc.url, '_blank', 'noopener');
  else location.href = doc.url;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Compact row for a skill that only mentions the query in passing. */
function renderMention(doc: SearchDoc): HTMLLIElement {
  const li = el('li', { 'data-skill-id': doc.id });
  const attrs: Record<string, string> = { href: doc.url };
  if (doc.external) Object.assign(attrs, { target: '_blank', rel: 'noopener noreferrer' });
  li.append(el('a', attrs, doc.title), el('span', { class: 'mention-summary' }, doc.summary));
  return li;
}

/** Same markup as the homepage rows, so the clickable-row styles apply. */
function renderRow(doc: SearchDoc): HTMLLIElement {
  const external = !!doc.external;
  const li = el('li', { class: external ? 'skill-row community-skill-row' : 'skill-row', 'data-skill-id': doc.id });
  const title = el('div', { class: 'skill-title' });
  const linkAttrs: Record<string, string> = { href: doc.url };
  if (external) Object.assign(linkAttrs, { target: '_blank', rel: 'noopener noreferrer' });
  title.append(el('a', linkAttrs, doc.title));
  if (external) title.append(' ', el('span', { class: 'community-badge' }, 'community'));
  const links = el('div', { class: 'skill-links' });
  if (external) {
    links.append(el('a', { href: doc.url, target: '_blank', rel: 'noopener noreferrer' }, 'GitHub ↗'));
  } else {
    links.append(
      el('a', { href: doc.url }, 'Read'),
      el('a', { href: `${doc.url}SKILL.md`, rel: 'alternate', type: 'text/markdown' }, 'Markdown'),
      el('a', { href: `/api/skills/${doc.id}.json`, rel: 'alternate', type: 'application/json' }, 'JSON'),
    );
  }
  li.append(title, el('p', { class: 'skill-desc' }, doc.summary), links);
  return li;
}
