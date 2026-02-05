#!/usr/bin/env npx tsx
/**
 * Extract headlines WITH URLs from 5 pinned news tabs in dev-browser
 */

import { chromium } from "playwright";

interface NewsItem {
  headline: string;
  url: string;
}

interface NewsHeadlines {
  site: string;
  pageUrl: string;
  articles: NewsItem[];
}

interface NewsSite {
  name: string;
  url: string;
  urlPattern: string;
}

const NEWS_SITES: NewsSite[] = [
  { name: "The Verge", url: "https://www.theverge.com", urlPattern: "theverge.com" },
  { name: "The Economist", url: "https://www.economist.com", urlPattern: "economist.com" },
  { name: "Financial Times", url: "https://www.ft.com", urlPattern: "ft.com/" },
  { name: "The Guardian", url: "https://www.theguardian.com/uk", urlPattern: "theguardian.com/uk" },
  { name: "New York Times", url: "https://www.nytimes.com/international", urlPattern: "nytimes.com/international" },
];

async function ensureTabsOpen(browser: any): Promise<void> {
  const contexts = browser.contexts();
  const pagesBySite = new Map<string, any>();

  for (const context of contexts) {
    for (const page of context.pages()) {
      const url = page.url();
      for (const site of NEWS_SITES) {
        if (url.includes(site.urlPattern)) {
          pagesBySite.set(site.name, page);
          break;
        }
      }
    }
  }

  for (const site of NEWS_SITES) {
    const existingPage = pagesBySite.get(site.name);

    if (existingPage) {
      console.error(`Refreshing ${site.name}...`);
      try {
        await existingPage.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
        await existingPage.waitForTimeout(2000);
      } catch (err) {
        console.error(`  Warning: Failed to refresh ${site.name}, continuing anyway`);
      }
    } else {
      console.error(`Opening ${site.name}...`);
      const context = contexts[0];
      if (context) {
        const page = await context.newPage();
        await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(2000);
      }
    }
  }
}

async function extractHeadlines(): Promise<NewsHeadlines[]> {
  const browser = await chromium.connectOverCDP("http://localhost:9223");

  await ensureTabsOpen(browser);

  const contexts = browser.contexts();
  const results: NewsHeadlines[] = [];

  for (const context of contexts) {
    for (const page of context.pages()) {
      const url = page.url();

      // The Verge
      if (url.includes("theverge.com") && !url.includes("service-worker")) {
        const articles = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          const topStoriesEl = elements.find(el => el.textContent?.trim() === 'Top Stories');

          if (!topStoriesEl) return [];

          let container = topStoriesEl.parentElement;
          for (let i = 0; i < 2 && container; i++) {
            container = container.parentElement;
          }
          if (!container) return [];

          const seen = new Set();
          const stories = Array.from(container.querySelectorAll('a'))
            .map(a => ({
              headline: a.textContent?.trim() || '',
              url: a.href
            }))
            .filter(item => {
              if (!item.headline || seen.has(item.headline)) return false;
              if (item.headline.includes('Comment Icon Bubble') || item.headline === 'Top Stories') return false;
              if (item.headline.length < 15 || item.headline.length > 200) return false;
              seen.add(item.headline);
              return true;
            })
            .slice(0, 5);

          return stories;
        });
        results.push({ site: "The Verge", pageUrl: url, articles });
      }

      // The Economist
      if (url.includes("economist.com") && !url.includes("push-worker")) {
        const articles = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[data-analytics*="headline"]'));
          return links
            .map((a) => ({
              headline: a.innerText?.trim() || '',
              url: (a as HTMLAnchorElement).href
            }))
            .filter((item) => item.headline && item.headline.length > 15)
            .slice(0, 5);
        });
        results.push({ site: "The Economist", pageUrl: url, articles });
      }

      // Financial Times
      if (url === "https://www.ft.com/") {
        const articles = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*="/content/"]'));
          return links
            .map((a) => ({
              headline: a.innerText?.trim() || '',
              url: (a as HTMLAnchorElement).href
            }))
            .filter((item) => item.headline && item.headline.length > 20 && item.headline.length < 200 && !item.headline.includes("\n"))
            .slice(0, 5);
        });
        results.push({ site: "Financial Times", pageUrl: url, articles });
      }

      // The Guardian
      if (url.includes("theguardian.com/uk")) {
        const articles = await page.evaluate(() => {
          const containers = Array.from(document.querySelectorAll('[data-link-name="article"]'));
          return containers
            .map((container) => {
              const link = container.querySelector('a');
              return {
                headline: container.textContent?.trim().replace(/\s+/g, " ") || '',
                url: link ? (link as HTMLAnchorElement).href : ''
              };
            })
            .filter((item) => item.headline && item.url && item.headline.length > 20 && item.headline.length < 200)
            .slice(0, 5);
        });
        results.push({ site: "The Guardian", pageUrl: url, articles });
      }

      // New York Times
      if (url.includes("nytimes.com/international")) {
        const articles = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*="/2026/"]'));
          return links
            .map((a) => {
              const h3 = a.querySelector("h3");
              const headline = h3?.innerText?.trim() || a.innerText?.trim() || '';
              return {
                headline,
                url: (a as HTMLAnchorElement).href
              };
            })
            .filter((item) => item.headline && item.headline.length > 20 && item.headline.length < 200 && !item.headline.includes("\n"))
            .slice(0, 5);
        });
        results.push({ site: "New York Times", pageUrl: url, articles });
      }
    }
  }

  await browser.close();

  return results;
}

// Main execution
(async () => {
  const allNews = await extractHeadlines();
  console.log(JSON.stringify(allNews, null, 2));
})();
