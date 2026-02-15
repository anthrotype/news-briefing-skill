---
name: news-briefing
description: Generate daily news briefings covering world politics, economics, business, and technology. Use when the user asks for "news", "latest news", "what's happening", "news briefing", "news podcast", or similar requests for current events. Creates 10-15 minute summaries with expanded headlines section plus deep-dives into 3 selected articles from paywalled sources (Economist, FT, Guardian, NYT, Verge). Supports both audio (via TTS) and text-only modes.
args: "[--text-only] [--whatsapp] [--voice aoede|aoede-pro|adam-stone|chris-brift|archer]"
---

# News Briefing

Generate personalized daily news briefings by fetching headlines from 5 major news sources, selecting 3 compelling articles, and creating a podcast-style summary.

## Usage

- **Podcast mode (default)**: `/news-briefing` - Generates MP3 via ElevenLabs Chris Brift voice, publishes to private podcast feed
- **Voice choice**: `/news-briefing --voice aoede-pro` - Uses Gemini Pro model (2x cost, richer expressivity)
- **Voice choice**: `/news-briefing --voice adam-stone` - Uses ElevenLabs Adam Stone voice instead (1.2x, pricier)
- **Voice choice**: `/news-briefing --voice chris-brift` - Uses ElevenLabs Chris Brift voice
- **Voice choice**: `/news-briefing --voice archer` - Uses ElevenLabs Archer voice (younger editorial)
- **WhatsApp mode**: `/news-briefing --whatsapp` - Sends as WhatsApp voice message (legacy behavior)
- **Text-only mode**: `/news-briefing --text-only` - Saves transcript to file and sends file link (no TTS cost)

## Workflow

### 1. Fetch Headlines

Run the headlines script to get current top stories with URLs from all 5 news sources:

```bash
cd /home/lupocos/projects/oss/news-briefing-skill && \
npx tsx scripts/get-news-with-urls.ts 2>/dev/null
```

This returns JSON with headlines and article URLs from:
- The Economist (politics, economics, international affairs)
- Financial Times (business, finance, economics)
- The Verge (technology, AI, consumer tech)
- The Guardian (UK/world politics, social issues)
- New York Times International (world news, US politics)

### 2. Check Preferences

Read `references/preferences.md` to understand learned topic interests and article selection patterns. Use this to inform your choices in the next step.

### 2.5. Check Article History

Read `references/article-history.json` to see which articles were covered in the past 7 days. **Do NOT re-select articles that appear in this file.**

```bash
cat /home/claude/.claude/skills/news-briefing/references/article-history.json
```

The file contains an array of recently used articles with their URLs, headlines, and dates. Ensure your selections are fresh.

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

### 3.5. Update Article History

After selecting your 3 articles, **immediately update** `references/article-history.json` to record them. This prevents re-using the same articles in future briefings.

```bash
cd /home/claude/.claude/skills/news-briefing && \
node scripts/update-article-history.js \
  "ARTICLE_1_URL" "ARTICLE_1_HEADLINE" \
  "ARTICLE_2_URL" "ARTICLE_2_HEADLINE" \
  "ARTICLE_3_URL" "ARTICLE_3_HEADLINE"
```

**Important:** Replace the URLs and headlines with your actual selections. The script automatically:
- Adds the 3 articles with today's date
- Prunes articles older than 7 days
- Updates the timestamp

### 4. Scrape Articles

For each selected article, scrape the full content using the remote Chrome connection:

```bash
scrape-remote "https://www.ft.com/content/..." > /tmp/article1.md
scrape-remote "https://www.economist.com/..." > /tmp/article2.md
scrape-remote "https://www.theverge.com/..." > /tmp/article3.md
```

The `scrape-remote` script uses the remote Chrome session (CDP on port 9223) to bypass paywalls with the user's credentials.

**Retry on failure:** If `scrape-remote` fails or returns empty/bot-challenge content (very short output, "just a moment", "verifying you are human"), restart the remote browser and retry:

```bash
remote-chrome-restart
sleep 5
scrape-remote "https://..." > /tmp/article1.md
```

**Snapshot fallback:** If `scrape-remote` still fails after retry (especially for interactive/JS-heavy pages like Economist `/interactive/` articles), use the accessibility tree scraper:

```bash
scrape-snapshot "https://..." > /tmp/article1.md
```

This uses `agent-browser` to render the page and extract text from the accessibility tree. The output may contain chart labels and data annotations mixed in with article text — that's OK, the LLM will handle cleanup when writing the podcast script. For particularly noisy output, you can also capture a PDF for visual reference:

```bash
agent-browser pdf /tmp/article1-layout.pdf
```

Then read the PDF yourself to understand the article's visual layout and distinguish body text from chart noise.

If an article still fails after all fallbacks, skip it and pick an alternative from the headlines list. Do not block the entire briefing on one failed scrape.

### 5. Write Podcast Script

Create a podcast script with this structure:

**Intro: Headlines Roundup (2-3 minutes)**
- Brief opening greeting with date (format as "February eighth, twenty twenty-six" to avoid TTS stumbling on "2026")
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

### 6. Deliver Briefing

#### Podcast Mode (Default)

Generate the audio using `podcast-tts` and publish to the podcast feed. This works independently of the WhatsApp agent and can run as a background task.

1. **Save the script** to a temp file (**no style preamble needed** — the preset handles it):

```bash
cat > /tmp/briefing-script.txt << 'SCRIPT'
[Full podcast script here — just the content, no style instructions]
SCRIPT
```

2. **Generate the MP3** using `podcast-tts` and **capture the cost**:

```bash
# Default: Aoede preset (Gemini, British newsreader, cheap)
TTS_OUTPUT=$(podcast-tts /tmp/briefing-episode.mp3 --voice aoede < /tmp/briefing-script.txt)

# Adam Stone preset (ElevenLabs, smooth/deep, 1.2x speed, pricier)
TTS_OUTPUT=$(podcast-tts /tmp/briefing-episode.mp3 --voice adam-stone < /tmp/briefing-script.txt)
```

Pass through the `--voice` flag from the user's args. Default is `aoede` if not specified.

The script prints a `COST:$X.XXXX` line to stdout. Extract it: `TTS_COST=$(echo "$TTS_OUTPUT" | grep '^COST:' | cut -d: -f2)`. Include this cost in the notification message to the user.

3. **Publish to the podcast feed** (with show notes linking to transcript):

```bash
TITLE="News Briefing - $(date +'%B %-d, %Y')"
DESCRIPTION="AI-curated daily news briefing: [brief summary of the 3 articles covered]"

# Save transcript to static/articles/ (linked from show notes, not inlined in feed XML)
ARTICLES_DIR="/home/lupocos/projects/static/articles"
mkdir -p "$ARTICLES_DIR"
SLUG="news-briefing-$(date +%Y-%m-%d)"
cp /tmp/briefing-script.txt "$ARTICLES_DIR/${SLUG}.md"
chmod 644 "$ARTICLES_DIR/${SLUG}.md"
TRANSCRIPT_URL="https://hetzner-ubuntu-4gb-nbg.tail2af01f.ts.net/articles/${SLUG}.md"

# Create lightweight show notes with link
cat > /tmp/briefing-shownotes.md << EOF
## $TITLE

[Read full transcript]($TRANSCRIPT_URL)
EOF

podcast-add-episode /tmp/briefing-episode.mp3 "$TITLE" "$DESCRIPTION" --notes /tmp/briefing-shownotes.md
rm -f /tmp/briefing-shownotes.md
```

Show notes contain a link to the full transcript (hosted in `static/articles/`), keeping the feed XML lightweight. Articles older than 7 days are cleaned up automatically by the `read-article` script.

4. **Notify the user**: Send a WhatsApp message tagging `@Cosimo` (for push notification) confirming the episode is published. Include the episode title, a one-line summary, and the TTS cost (e.g. "TTS cost: $0.12"). The user will see it in Apple Podcasts automatically.

**Voice presets**: Default is `chris-brift` (ElevenLabs). Pass `--voice` from the user's args through to `podcast-tts`.

#### WhatsApp Mode (--whatsapp)

If the user passed `--whatsapp`, use the `speak` MCP tool instead to send as a voice message:

```typescript
mcp__whatsapp-agent-tools__speak({
  text: "Read this in a natural, engaging British newsreader style:\n\n[Full podcast script here...]",
  engine: "gemini",
  voiceId: "Aoede"
})
```

#### Text-Only Mode (--text-only)

Save the script to `static/articles/` and share the URL:

```bash
ARTICLES_DIR="/home/lupocos/projects/static/articles"
mkdir -p "$ARTICLES_DIR"
SLUG="news-briefing-$(date +%Y-%m-%d)"
TRANSCRIPT_FILE="$ARTICLES_DIR/${SLUG}.md"

cat > "$TRANSCRIPT_FILE" << 'EOF'
# News Briefing - [Date]

[Your full podcast script here...]

EOF

chmod 644 "$TRANSCRIPT_FILE"
echo "Transcript available at: https://hetzner-ubuntu-4gb-nbg.tail2af01f.ts.net/articles/${SLUG}.md"
```

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

**Mode selection:**
- Podcast mode (default) publishes to the private Apple Podcast feed via Tailscale
- Use `--whatsapp` for immediate voice message delivery (e.g. when user wants it NOW)
- Use `--text-only` to skip TTS entirely (fastest, no cost)
- The `--voice` flag controls TTS: `chris-brift` (ElevenLabs, default), `archer` (younger editorial), `adam-stone` (deeper), or `aoede` (Gemini, free)

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
- Write in podcast style even for text-only mode (conversational, engaging)

**Voice delivery (podcast/whatsapp modes):**
- `--voice aoede` (default): Gemini Flash, female British newsreader, cheap
- `--voice aoede-pro`: Gemini Pro, female British newsreader, 2x cost, richer expressivity
- `--voice adam-stone`: ElevenLabs, smooth/deep male, 1.2x speed, pricier
- `--voice chris-brift`: ElevenLabs, Chris Brift, 1.1x speed
- `--voice archer`: ElevenLabs, Archer (younger editorial tone)
- Keep script under 1,800 words to stay within 15-minute limit
- Short paragraphs = natural pauses for the TTS voice
- Avoid parentheticals - they sound awkward in audio

## Resources

### scripts/get-news-with-urls.ts
TypeScript script that connects to remote Chrome via CDP (port 9223), refreshes all 5 news tabs, and extracts headlines with article URLs. Returns JSON array with structure:
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

### references/article-history.json
Tracks articles used in the past 7 days to prevent repetition. Structure:
```json
{
  "articles": [
    {
      "url": "https://www.ft.com/content/...",
      "headline": "Article title",
      "date": "2026-02-08"
    }
  ],
  "last_updated": "2026-02-08T10:26:00.000Z"
}
```

**CRITICAL:** Always check this file before selecting articles and update it immediately after selection. Articles older than 7 days are automatically pruned.
