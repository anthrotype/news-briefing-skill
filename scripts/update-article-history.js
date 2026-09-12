#!/usr/bin/env node

/**
 * Update article history with the deep-dive articles used today.
 *
 * Usage (normal): node update-article-history.js
 *   Reads the selection written by select-articles.js from
 *   /tmp/briefing-selection.json, so no URL is ever retyped.
 *
 * Legacy: node update-article-history.js "URL1" "HEADLINE1" "URL2" "HEADLINE2" "URL3" "HEADLINE3"
 */

const fs = require('fs');
const path = require('path');

const historyPath = path.join(__dirname, '..', 'references', 'article-history.json');
const SELECTION_FILE = '/tmp/briefing-selection.json';

const args = process.argv.slice(2);
let newArticles;
if (args.length === 0) {
  let selection;
  try {
    selection = JSON.parse(fs.readFileSync(SELECTION_FILE, 'utf8'));
  } catch (e) {
    console.error(`Error: cannot read ${SELECTION_FILE} -- run scripts/select-articles.js first (${e.message})`);
    process.exit(1);
  }
  newArticles = (selection.articles || []).map(a => ({ url: a.url, headline: a.headline }));
  if (newArticles.length !== 3 || newArticles.some(a => !a.url)) {
    console.error(`Error: ${SELECTION_FILE} does not contain 3 articles with URLs`);
    process.exit(1);
  }
} else if (args.length === 6) {
  newArticles = [
    { url: args[0], headline: args[1] },
    { url: args[2], headline: args[3] },
    { url: args[4], headline: args[5] }
  ];
} else {
  console.error('Usage: node update-article-history.js            (reads /tmp/briefing-selection.json)');
  console.error('   or: node update-article-history.js "URL1" "HEADLINE1" "URL2" "HEADLINE2" "URL3" "HEADLINE3"');
  process.exit(1);
}

// Read current history
const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));

// Add new articles with today's date (skip exact URL duplicates already recorded today)
const today = new Date().toISOString().split('T')[0];
newArticles.forEach(article => {
  const dup = history.articles.some(a => a.url === article.url && a.date === today);
  if (dup) {
    console.log(`  (already recorded today, skipping) ${article.url}`);
    return;
  }
  history.articles.push({
    url: article.url,
    headline: article.headline,
    date: today
  });
});

// Keep only last 7 days
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
history.articles = history.articles.filter(a => a.date >= sevenDaysAgo);

// Update timestamp
history.last_updated = new Date().toISOString();

// Write back
fs.writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n');

console.log('✓ Article history updated');
console.log(`  Total articles tracked: ${history.articles.length}`);
console.log(`  Oldest article: ${history.articles.length > 0 ? history.articles[0].date : 'N/A'}`);
