#!/usr/bin/env node
/**
 * Appends a daily summary entry to references/recent_summaries.json,
 * then prunes entries older than 7 days.
 *
 * Usage:
 *   node update-recent-summaries.js '<json>'
 *
 * JSON shape:
 *   {
 *     "date": "2026-06-18",
 *     "headlines_topics": ["topic 1", "topic 2", ...],
 *     "deep_dives": ["Article 1 topic", "Article 2 topic", "Article 3 topic"]
 *   }
 */

const fs = require('fs');
const path = require('path');

const REFS_DIR = path.join(__dirname, '..', 'references');
const FILE = path.join(REFS_DIR, 'recent_summaries.json');
const MAX_DAYS = 7;

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: update-recent-summaries.js \'{"date":"YYYY-MM-DD","headlines_topics":[...],"deep_dives":[...]}\'');
  process.exit(1);
}

let entry;
try {
  entry = JSON.parse(arg);
} catch (e) {
  console.error('Invalid JSON:', e.message);
  process.exit(1);
}

if (!entry.date || !Array.isArray(entry.headlines_topics) || !Array.isArray(entry.deep_dives)) {
  console.error('Entry must have: date (string), headlines_topics (array), deep_dives (array)');
  process.exit(1);
}

let data = { summaries: [], last_updated: '' };
if (fs.existsSync(FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    console.error('Warning: could not parse existing file, starting fresh:', e.message);
  }
}

// Remove any existing entry for the same date (replace/update)
data.summaries = data.summaries.filter(s => s.date !== entry.date);

// Append new entry
data.summaries.push(entry);

// Sort by date ascending
data.summaries.sort((a, b) => a.date.localeCompare(b.date));

// Prune entries older than MAX_DAYS
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - MAX_DAYS);
const cutoffStr = cutoff.toISOString().slice(0, 10);
data.summaries = data.summaries.filter(s => s.date >= cutoffStr);

data.last_updated = new Date().toISOString();

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
console.log(`✓ recent_summaries.json updated — ${data.summaries.length} entries (${data.summaries[0]?.date} to ${data.summaries[data.summaries.length - 1]?.date})`);
