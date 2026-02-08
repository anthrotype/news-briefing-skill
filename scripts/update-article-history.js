#!/usr/bin/env node

/**
 * Update article history with newly used articles
 * Usage: node update-article-history.js "URL1" "HEADLINE1" "URL2" "HEADLINE2" "URL3" "HEADLINE3"
 */

const fs = require('fs');
const path = require('path');

const historyPath = path.join(__dirname, '..', 'references', 'article-history.json');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 6) {
  console.error('Usage: node update-article-history.js "URL1" "HEADLINE1" "URL2" "HEADLINE2" "URL3" "HEADLINE3"');
  process.exit(1);
}

const newArticles = [
  { url: args[0], headline: args[1] },
  { url: args[2], headline: args[3] },
  { url: args[4], headline: args[5] }
];

// Read current history
const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));

// Add new articles with today's date
const today = new Date().toISOString().split('T')[0];
newArticles.forEach(article => {
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
