#!/usr/bin/env node
// Reads current headlines JSON from stdin, assigns a stable short id to every
// article (E1..E5 Economist, F1.. FT, V1.. Verge, G1.. Guardian, N1.. NYT),
// diffs against last-headlines.json, annotates each article with isNew: true/false,
// saves current (with ids) as last-headlines.json, and writes annotated JSON to stdout.
//
// Later steps refer to articles by id only (see select-articles.js), so the model
// never retypes a URL.

const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const REFS_DIR = join(__dirname, '..', 'references');
const LAST_HEADLINES_FILE = join(REFS_DIR, 'last-headlines.json');

const SITE_PREFIX = {
  'The Economist': 'E',
  'Financial Times': 'F',
  'The Verge': 'V',
  'The Guardian': 'G',
  'New York Times': 'N',
};

function sitePrefix(site) {
  return SITE_PREFIX[site] || (site || 'X').replace(/^The /, '').charAt(0).toUpperCase();
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const current = JSON.parse(input);

  let previousUrls = new Set();
  try {
    const previous = JSON.parse(readFileSync(LAST_HEADLINES_FILE, 'utf8'));
    for (const source of previous) {
      for (const article of source.articles) {
        if (article.url) previousUrls.add(article.url);
      }
    }
  } catch (e) {
    // No previous file — everything is new
  }

  // Assign ids: site prefix + 1-based position within the site
  const withIds = current.map(source => {
    const prefix = sitePrefix(source.site);
    return {
      ...source,
      articles: source.articles.map((article, i) => ({
        id: `${prefix}${i + 1}`,
        ...article,
      })),
    };
  });

  // Annotate current headlines
  const annotated = withIds.map(source => ({
    ...source,
    articles: source.articles.map(article => ({
      ...article,
      isNew: !previousUrls.has(article.url),
    })),
  }));

  // Save current (with ids, without isNew) as last-headlines.json for next run
  // and for select-articles.js to resolve ids -> URLs
  writeFileSync(LAST_HEADLINES_FILE, JSON.stringify(withIds, null, 2));

  process.stdout.write(JSON.stringify(annotated, null, 2));
});
