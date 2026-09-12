#!/usr/bin/env node
/**
 * Select the 3 deep-dive articles BY ID and scrape them.
 *
 * Usage: node scripts/select-articles.js <id> <id> <id> [--force] [--no-scrape]
 *   e.g. node scripts/select-articles.js E2 F1 V3
 *
 * Ids come from the headlines JSON produced in step 1 (E1..E5 Economist,
 * F1.. FT, V1.. Verge, G1.. Guardian, N1.. NYT) and are resolved against
 * references/last-headlines.json. The model never types a URL: URLs are
 * copied from disk into /tmp/briefing-selection.env (ARTICLE_N_URL,
 * ARTICLE_N_HEADLINE, ARTICLE_N_SITE, ARTICLE_N_ID) and
 * /tmp/briefing-selection.json, which later steps source or read.
 *
 * Each article is scraped with scrape-remote into /tmp/articleN.md.
 * Exit codes: 0 all scraped, 2 one or more scrapes failed (details printed),
 * 1 bad input (unknown id, duplicate, or article already used in the last
 * 7 days -- override with --force).
 *
 * Why: on 2026-09-11 a 2-bit local model rewrote "2026/09/10" as
 * "2026-09-10" while retyping Economist URLs, got 404s, and spent an hour
 * hunting a phantom pipeline bug. Selecting by id removes the retyping.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REFS_DIR = path.join(__dirname, '..', 'references');
const HEADLINES_FILE = path.join(REFS_DIR, 'last-headlines.json');
const HISTORY_FILE = path.join(REFS_DIR, 'article-history.json');
const ENV_FILE = '/tmp/briefing-selection.env';
const JSON_FILE = '/tmp/briefing-selection.json';
const MIN_ARTICLE_BYTES = 800;
const SCRAPE_TIMEOUT_MS = 180000;

const args = process.argv.slice(2);
const force = args.includes('--force');
const noScrape = args.includes('--no-scrape');
const ids = args.filter(a => !a.startsWith('--')).map(a => a.toUpperCase());

function die(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

if (ids.length !== 3) {
  die(`expected exactly 3 article ids, got ${ids.length}. Usage: select-articles.js E2 F1 V3`);
}
if (new Set(ids).size !== ids.length) die(`duplicate ids: ${ids.join(' ')}`);

let headlines;
try {
  headlines = JSON.parse(fs.readFileSync(HEADLINES_FILE, 'utf8'));
} catch (e) {
  die(`cannot read ${HEADLINES_FILE} (run step 1 first): ${e.message}`);
}

const byId = new Map();
for (const source of headlines) {
  for (const a of source.articles || []) {
    if (a.id) byId.set(a.id.toUpperCase(), { site: source.site, headline: a.headline, url: a.url });
  }
}
if (byId.size === 0) {
  die(`${HEADLINES_FILE} has no article ids -- re-run step 1 (save-and-diff-headlines.js assigns them)`);
}

const selected = ids.map(id => {
  const a = byId.get(id);
  if (!a) die(`unknown id ${id}. Known ids: ${[...byId.keys()].join(' ')}`);
  if (!a.url) die(`${id} has no URL in ${HEADLINES_FILE}`);
  return { id, ...a };
});

// Refuse articles used as deep dives in the last 7 days unless --force
let history = { articles: [] };
try {
  history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
} catch (e) {
  // no history yet
}
const usedUrls = new Set((history.articles || []).map(a => a.url));
const reused = selected.filter(a => usedUrls.has(a.url));
if (reused.length && !force) {
  die(
    `already used as a deep dive in the last 7 days: ${reused.map(a => `${a.id} (${a.headline})`).join('; ')}. ` +
      'Pick different ids, or pass --force if this is deliberate.',
  );
}

// Write the selection files that later steps source/read
function shq(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}
const envLines = [];
selected.forEach((a, i) => {
  const n = i + 1;
  envLines.push(`ARTICLE_${n}_ID=${shq(a.id)}`);
  envLines.push(`ARTICLE_${n}_SITE=${shq(a.site)}`);
  envLines.push(`ARTICLE_${n}_HEADLINE=${shq(a.headline)}`);
  envLines.push(`ARTICLE_${n}_URL=${shq(a.url)}`);
  envLines.push(`ARTICLE_${n}_FILE=${shq(`/tmp/article${n}.md`)}`);
});
fs.writeFileSync(ENV_FILE, envLines.join('\n') + '\n');
fs.writeFileSync(
  JSON_FILE,
  JSON.stringify(
    {
      selected_at: new Date().toISOString(),
      articles: selected.map((a, i) => ({ ...a, file: `/tmp/article${i + 1}.md` })),
    },
    null,
    2,
  ) + '\n',
);

console.log('Selected:');
selected.forEach((a, i) => console.log(`  ${i + 1}. [${a.id}] ${a.site}: ${a.headline}\n     ${a.url}`));
console.log(`Selection written to ${ENV_FILE} and ${JSON_FILE}`);

if (noScrape) process.exit(0);

// Scrape each article
console.log('\nScraping:');
let failures = 0;
selected.forEach((a, i) => {
  const n = i + 1;
  const out = `/tmp/article${n}.md`;
  const res = spawnSync('scrape-remote', [a.url], {
    encoding: 'utf8',
    timeout: SCRAPE_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  });
  const stdout = res.stdout || '';
  const stderr = (res.stderr || '').trim().split('\n').filter(Boolean).slice(-2).join(' | ');
  const looksBlocked = /just a moment|verifying you are human|access denied/i.test(stdout.slice(0, 2000));
  let status;
  if (res.error) {
    status = `FAILED (${res.error.code === 'ETIMEDOUT' ? 'timeout' : res.error.message})`;
    failures++;
  } else if (res.status === 3) {
    status = 'BLOCKED by DataDome -- do not retry; pick a different article and re-run select-articles.js';
    failures++;
  } else if (res.status !== 0) {
    status = `FAILED (exit ${res.status}${stderr ? `: ${stderr}` : ''})`;
    failures++;
  } else if (stdout.length < MIN_ARTICLE_BYTES || looksBlocked) {
    status = `FAILED (${stdout.length} bytes${looksBlocked ? ', bot challenge' : ', too short'})`;
    failures++;
  } else {
    fs.writeFileSync(out, stdout);
    const title = (stdout.match(/^#\s+(.+)$/m) || [])[1] || '(no title)';
    status = `ok -> ${out} (${stdout.length} bytes) "${title}"`;
  }
  console.log(`  ${n}. [${a.id}] ${status}`);
  if (status.startsWith('FAILED')) {
    console.log(
      `     fallback: source ${ENV_FILE}; mac-chrome-restart; sleep 5; scrape-remote "$ARTICLE_${n}_URL" > ${out}\n` +
        `     or:       source ${ENV_FILE}; scrape-snapshot "$ARTICLE_${n}_URL" > ${out}\n` +
        `     or swap the article: re-run select-articles.js with a different id in slot ${n}`,
    );
  }
});

if (failures) {
  console.log(`\n${failures} of 3 scrapes failed. Fix them (see above) before updating article history.`);
  process.exit(2);
}
console.log('\nAll 3 articles scraped. Next: node scripts/update-article-history.js');
