#!/usr/bin/env node
// Reads current headlines JSON from stdin, diffs against last-headlines.json,
// annotates each article with isNew: true/false, saves current as last-headlines.json,
// and writes annotated JSON to stdout.

const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const REFS_DIR = join(__dirname, '..', 'references');
const LAST_HEADLINES_FILE = join(REFS_DIR, 'last-headlines.json');

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

  // Annotate current headlines
  const annotated = current.map(source => ({
    ...source,
    articles: source.articles.map(article => ({
      ...article,
      isNew: !previousUrls.has(article.url),
    })),
  }));

  // Save current (un-annotated) as last-headlines.json for next run
  writeFileSync(LAST_HEADLINES_FILE, JSON.stringify(current, null, 2));

  process.stdout.write(JSON.stringify(annotated, null, 2));
});
