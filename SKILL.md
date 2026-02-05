---
name: news-briefing
description: Generate daily audio news briefings covering world politics, economics, business, and technology. Use when the user asks for "news", "latest news", "what's happening", "news briefing", "news podcast", or similar requests for current events. Creates 10-15 minute audio summaries with expanded headlines section plus deep-dives into 3 selected articles from paywalled sources (Economist, FT, Guardian, NYT, Verge).
---

# News Briefing

Generate personalized daily audio news briefings by fetching headlines from 5 major news sources, selecting 3 compelling articles, and creating a podcast-style summary delivered via WhatsApp voice message.

## Workflow

### 1. Fetch Headlines

Run the headlines script to get current top stories with URLs from all 5 news sources:

```bash
cd /home/lupocos/projects/oss/dev-browser/skills/dev-browser && \
npx tsx /home/claude/.claude/skills/news-briefing/scripts/get-news-with-urls.ts 2>/dev/null
```

This returns JSON with headlines and article URLs from:
- The Economist (politics, economics, international affairs)
- Financial Times (business, finance, economics)
- The Verge (technology, AI, consumer tech)
- The Guardian (UK/world politics, social issues)
- New York Times International (world news, US politics)

### 2. Check Preferences

Read `references/preferences.md` to understand learned topic interests and article selection patterns. Use this to inform your choices in the next step.

### 3. Select Articles

Autonomously select 3 articles that:
- Align with learned preferences (AI/tech industry, business strategy, policy)
- Offer substantive analysis over breaking news
- Span different topics when possible (avoid 3 articles on same story)
- Come from different sources when possible (prefer variety)

**Selection criteria:**
- High priority: AI industry dynamics, tech business strategy, economic policy
- Medium priority: UK/international politics, financial markets, infrastructure
- Lower priority: Consumer product reviews, celebrity news, pure entertainment

### 4. Scrape Articles

For each selected article, scrape the full content using the remote Chrome connection:

```bash
scrape-remote "https://www.ft.com/content/..." > /tmp/article1.md
scrape-remote "https://www.economist.com/..." > /tmp/article2.md
scrape-remote "https://www.theverge.com/..." > /tmp/article3.md
```

The `scrape-remote` script uses dev-browser's remote Chrome session to bypass paywalls with the user's credentials.

### 5. Write Podcast Script

Create a podcast script with this structure:

**Intro: Headlines Roundup (2-3 minutes)**
- Brief opening greeting with date
- Quick scan of ALL major headlines across the 5 sources
- Cover politics, economics, business, tech - paint the full picture
- End with transition to the 3 deep-dive articles

**Article 1 (3-4 minutes)**
- Context and background
- Key facts and developments
- Analysis and implications
- Keep it conversational and engaging

**Article 2 (3-4 minutes)**
- Same structure as Article 1

**Article 3 (3-4 minutes)**
- Same structure as Article 1

**Outro (30 seconds)**
- Brief summary tying themes together
- Closing statement

**Total length: 10-15 minutes** (aim for ~1,300-1,800 words at 130-150 words/minute)

**Writing style:**
- Conversational, not stiff or formal
- Active voice, present tense where appropriate
- Write for audio: short sentences, clear transitions
- Avoid overuse of "however", "moreover" - vary connectors
- Include specific numbers and names (adds credibility)
- Build narrative tension: setup → development → implication

### 6. Send Audio

Use the `speak` MCP tool to convert the script to audio and send via WhatsApp:

```typescript
mcp__whatsapp-agent-tools__speak({
  text: "Full podcast script here..."
})
```

**Important:** Use the speak MCP tool, NOT direct ElevenLabs API calls. The speak tool uses the preferred default voice.

### 7. Capture Feedback

After sending, wait for user feedback. Common patterns:
- "Good picks today" → No action needed
- "Too much focus on X" → Update preferences.md
- "I already read that article about Y" → Note to avoid covering stories user explicitly mentions reading
- "More/less depth on Z topic" → Adjust coverage balance in preferences.md

When feedback is received, update `references/preferences.md` immediately:
- Add to "Feedback History" section with date
- Update topic priorities if patterns emerge
- Adjust article selection criteria if needed

## Tips

**Article selection:**
- Scan ALL headlines before deciding - don't just pick the first 3 interesting ones
- Look for stories with broader implications, not isolated events
- When in doubt, choose depth over breadth
- Tech/AI stories are high-value when they connect to business strategy or policy

**Podcast writing:**
- The headlines section should give a complete picture of the day's news
- Deep-dive articles should feel like storytelling, not summaries
- Use transition phrases between sections: "Speaking of...", "Meanwhile...", "This ties into..."
- End each article with "why this matters" - connect to bigger trends

**Voice delivery:**
- Keep script under 1,800 words to stay within 15-minute limit
- Short paragraphs = natural pauses for the TTS voice
- Avoid parentheticals - they sound awkward in audio

## Resources

### scripts/get-news-with-urls.ts
TypeScript script that connects to dev-browser, refreshes all 5 news tabs, and extracts headlines with article URLs. Returns JSON array with structure:
```json
[
  {
    "site": "Financial Times",
    "pageUrl": "https://www.ft.com/",
    "articles": [
      {
        "headline": "...",
        "url": "https://www.ft.com/content/..."
      }
    ]
  }
]
```

### references/preferences.md
Learned preferences from user feedback. Updated after each briefing based on user's response. Tracks:
- Topic interest priorities
- Preferred article types
- Coverage balance (headlines vs deep-dives)
- Voice preferences
- Feedback history with dates

Read this file at the start of each briefing to inform article selection.
