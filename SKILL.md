---
name: news-briefing
description: Generate daily news briefings covering world politics, economics, business, and technology. Use when the user asks for "news", "latest news", "what's happening", "news briefing", "news podcast", or similar requests for current events. Creates 10-15 minute summaries with expanded headlines section plus deep-dives into 3 selected articles from paywalled sources (Economist, FT, Guardian, NYT, Verge). Supports both audio (via TTS) and text-only modes.
args: "[--text-only] [--whatsapp] [--voice aoede|aoede-pro|adam-stone|chris-brift|archer|emma|daniel|kokoro-aoede|qwen-newsreader|qwen-chris-brift]"
---

# News Briefing

Generate personalized daily news briefings by fetching headlines from 5 major news sources, selecting 3 compelling articles, and creating a podcast-style summary.

## Usage

- **Podcast mode (default)**: `/news-briefing` - Generates MP3 via Qwen3-TTS cloned Jason Palmer voice (free, local), publishes to private podcast feed
- **Voice choice**: `/news-briefing --voice aoede-pro` - Uses Gemini Pro model (2x cost, richer expressivity)
- **Voice choice**: `/news-briefing --voice adam-stone` - Uses ElevenLabs Adam Stone voice instead (1.2x, pricier)
- **Voice choice**: `/news-briefing --voice chris-brift` - Uses ElevenLabs Chris Brift voice
- **Voice choice**: `/news-briefing --voice archer` - Uses ElevenLabs Archer voice (younger editorial)
- **Voice choice**: `/news-briefing --voice emma` - Kokoro bf_emma, British female (free, local Mac Studio)
- **Voice choice**: `/news-briefing --voice daniel` - Kokoro bf_daniel, British male (free, local Mac Studio)
- **Voice choice**: `/news-briefing --voice kokoro-aoede` - Kokoro af_aoede, American female (free, local Mac Studio)
- **Voice choice**: `/news-briefing --voice qwen-chris-brift` - Qwen3-TTS cloned Chris Brift voice (free, local Mac Studio)
- **WhatsApp mode**: `/news-briefing --whatsapp` - Sends as WhatsApp voice message (legacy behavior)
- **Text-only mode**: `/news-briefing --text-only` - Saves transcript to file and sends file link (no TTS cost)

## Workflow

### 0. Confirm Today's Date

**Always check the actual London date/time before writing anything** — the system prompt date can be stale by a day or more:

```bash
TZ=Europe/London date '+%A, %B %-d, %Y'
```

Use this output as the authoritative date throughout the briefing (episode title, podcast script greeting, etc). Do not rely on the system prompt's `currentDate`.

### 1. Fetch Headlines

Run the headlines script to get current top stories with URLs from all 5 news sources:

```bash
cd /home/lupocos/projects/oss/news-briefing-skill && \
npx tsx scripts/get-news-with-urls.ts 2>/dev/null | \
node /home/claude/.claude/skills/news-briefing/scripts/save-and-diff-headlines.js
```

This returns annotated JSON with headlines and article URLs from:
- The Economist (politics, economics, international affairs)
- Financial Times (business, finance, economics)
- The Verge (technology, AI, consumer tech)
- The Guardian (UK/world politics, social issues)
- New York Times International (world news, US politics)

Each article has an `isNew` field (`true`/`false`) indicating whether its URL appeared in the previous day's fetch. The script also saves the current headlines to `references/last-headlines.json` for tomorrow's diff. On the very first run (no history yet), all articles are marked `isNew: true`.

**Important:** `isNew` is a mechanical URL-match — use it as a first filter, not the final word. Apply your own reasoning on top:
- A `isNew: true` article can still cover a story you already reported yesterday (e.g. a follow-up with a new URL on the same tariff threat or the same assassination attempt). Check whether the substance is genuinely different before including it.
- A `isNew: false` article could have been updated with significantly new information. If it's a major developing story with a clear new angle, it may still be worth mentioning.

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
- **Prefer `isNew: true` articles** — articles marked `isNew: false` were already in yesterday's fetch and should only be picked if they are clearly the best available option and represent a major ongoing story

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

The `scrape-remote` script uses the remote Chrome session (CDP on port **9224**, Mac Studio Chrome Beta) to bypass paywalls with the user's credentials. Port 9223 is the Crostini legacy fallback — do not use it unless Mac Studio is unreachable.

**Retry on failure:** If `scrape-remote` fails or returns empty/bot-challenge content (very short output, "just a moment", "verifying you are human"), restart the **Mac Studio** browser and retry:

```bash
mac-chrome-restart
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

**Before writing: decide on article order.**

Article selection is driven by quality and variety first — the editorial doesn't constrain what you pick. Once you have your 3 articles, decide which one most invites commentary: the one with the sharpest implication, the most interesting tension, or the most provocative angle. Place that article last, just before the editorial. The other two go first in whatever order feels natural.

If two or more articles happen to share a genuine thread — a tension, a paradox, an underlying logic — you can build the editorial around that connection. But this is a bonus when it emerges naturally, not something to engineer. The default is: one article, one good take.

Create a podcast script with this structure, using `---` on its own line to separate sections:

**Intro: Headlines Roundup (2-3 minutes)**
- Brief opening greeting with date (format as "February eighth, twenty twenty-six" to avoid TTS stumbling on "2026")
- Scan headlines across the 5 sources, using `isNew: true` as a starting signal for freshness — but apply your own judgement too: a `isNew: true` article can still be a follow-up on yesterday's story (same substance, new URL), and a `isNew: false` article may have a genuinely new angle worth mentioning
- Skip or omit headlines that cover ground already reported yesterday — whether `isNew: false` by URL or a `isNew: true` follow-up on the same story. If a headline is stale and has no new angle, leave it out entirely
- On slow news days (weekends, holidays) where many headlines repeat, it's fine to have a shorter roundup — fewer but fresher stories beats padding with yesterday's news
- Cover politics, economics, business, tech from the fresh headlines — paint the full picture of what's actually new today
- End with a preview of the 3 deep-dive articles **in the order you've chosen** (match the ordering below)

---

**Article 1 (3-4 minutes)** — standalone or loosely connected
- Context and background
- Key facts and developments
- Analysis and implications

---

**Article 2 (3-4 minutes)** — standalone or loosely connected
- Same structure as Article 1

---

**Article 3 (3-4 minutes)** — the one most worthy of editorial commentary (placed last)
- Same structure as Article 1
- End with a natural transition toward the editorial: a question, a tension, or an observation that sets up your take

---

**Editorial (2 minutes)**
- **No label, no announcement.** Don't say "Editorial", "Opinion", "And now for my take" or anything like that. Just continue naturally from the last article, as a radio presenter would — a new paragraph, a pivot in tone, and your thoughts begin. The listener will feel the shift without being told about it.
- Baseline: a genuine take on the last article — its deeper implication, an angle the reporting didn't fully develop, a contradiction it exposes
- Bonus: if a thread runs through two or more of today's articles, develop that — but only when it's genuinely there, not constructed
- Avoid mere summary. This is your analysis, your interpretation — a point of view, not a recap
- Close with a single sentence that lands: something memorable, not a formula

---

*(No separate outro needed — the editorial closes the episode.)*

**Total length: 12-17 minutes** (aim for ~1,600-2,100 words at 130-150 words/minute)

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

2. **Announce the live stream URL** in the current chat *before* starting `podcast-tts`. The URL is deterministic from the output filename — no need to wait for the script to print it. Send a short plain-text message tagging `@Cosimo` so they get a push notification and can tap the link to start listening within ~10s of generation kicking off:

```text
🔴 Live now (give it ~10s for the first segment): https://hetzner-ubuntu-4gb-nbg.tail2af01f.ts.net/podcast/live/briefing-episode/
@Cosimo
```

(Use `briefing-episode` as the basename — it must match the basename of the MP3 output path in the next step.)

3. **Generate the MP3** using `podcast-tts` with `--live` so it produces an HLS event-playlist alongside the final MP3, and **capture the cost**:

```bash
TTS_OUTPUT=$(podcast-tts /tmp/briefing-episode.mp3 --voice qwen-jason-palmer --live < /tmp/briefing-script.txt)
```

The `--live` flag writes `index.m3u8` + fmp4 segments into `/home/lupocos/projects/static/podcast/live/briefing-episode/` as each TTS chunk is produced, so the link from step 2 starts streaming as soon as the first ~4s of audio is encoded. The final MP3 is still produced normally at `/tmp/briefing-episode.mp3` and gets published to the RSS feed in step 4 as before. After generation completes, the same live URL becomes a finished VOD that plays end-to-end.

Pass through the `--voice` flag from the user's args. Default is `qwen-jason-palmer` if not specified.

The script prints per-chunk progress to stderr: `done in 8.4s | avg 8.1s/chunk | eta ~8m`. **Watch this output** to detect problems early:

- **Normal speed** (qwen-jason-palmer): ~8-12s per chunk. If the first few chunks land in that range, let it run.
- **Stuck**: if no `done in ...` line appears for >2 minutes after a `Generating chunk X/Y...` line, the oMLX server is likely stuck on that chunk.

**If TTS generation gets stuck:**
1. Kill the `podcast-tts` process
2. Retry with `--restart-omlx`, which unconditionally restarts oMLX and waits for it to be ready before sending the first chunk:

```bash
TTS_OUTPUT=$(podcast-tts /tmp/briefing-episode.mp3 --voice qwen-jason-palmer --restart-omlx < /tmp/briefing-script.txt)
```

The script prints a `COST:$X.XXXX` line to stdout. Extract it: `TTS_COST=$(echo "$TTS_OUTPUT" | grep '^COST:' | cut -d: -f2)`. Include this cost in the notification message to the user.

4. **Publish to the podcast feed** (with show notes linking to transcript + native SRT transcript):

```bash
TITLE="News Briefing - $(date +'%B %-d, %Y')"
DESCRIPTION="AI-curated daily news briefing: [brief summary of the 3 articles covered]"

# Save formatted script to static/articles/ (linked from show notes)
ARTICLES_DIR="/home/lupocos/projects/static/articles"
mkdir -p "$ARTICLES_DIR"
SLUG="news-briefing-$(date +%Y-%m-%d)"
cp /tmp/briefing-script.txt "$ARTICLES_DIR/${SLUG}.md"
chmod 644 "$ARTICLES_DIR/${SLUG}.md"
TRANSCRIPT_URL="https://hetzner-ubuntu-4gb-nbg.tail2af01f.ts.net/articles/${SLUG}.md"

# Generate timestamped SRT transcript via Groq Whisper (~4s for 15min audio at 200x realtime)
# This is the most reliable way to get accurate word-level timing for AntennaPod sync.
groq-transcribe /tmp/briefing-episode.mp3 /tmp/briefing-groq-transcript.md 2>&1 | grep -v "^$"
# (The .md output is discarded; we use our formatted script for show notes instead)

# Create lightweight show notes with link
cat > /tmp/briefing-shownotes.md << EOF
## $TITLE

[Read full transcript]($TRANSCRIPT_URL)
EOF

podcast-add-episode /tmp/briefing-episode.mp3 "$TITLE" "$DESCRIPTION" \
    --notes /tmp/briefing-shownotes.md \
    --transcript /tmp/briefing-groq-transcript.srt
rm -f /tmp/briefing-shownotes.md

# Clean up all temp files from this run (IMPORTANT: prevents stale files from confusing future sessions)
rm -f /tmp/briefing-episode.mp3 /tmp/briefing-script.txt \
      /tmp/briefing-groq-transcript.md /tmp/briefing-groq-transcript.srt \
      /tmp/article1.md /tmp/article2.md /tmp/article3.md
```

Show notes contain a link to the formatted script (hosted in `static/articles/`). The `--transcript` flag embeds a `<podcast:transcript>` element in the feed with accurate word-level timing so Podcasting 2.0 apps (e.g. AntennaPod) can show synchronised in-app transcripts. Articles older than 7 days are cleaned up automatically by the `read-article` script.

5. **Notify the user**: Post a **plain text message in the current chat** (do NOT use `speak`, do NOT use `send_message_to_workspace` — both waste credits). Tag `@Cosimo` for a push notification. Include the episode title, a one-line summary of the three articles, and the TTS cost (e.g. "TTS cost: $0.12"). The user will see the episode in Apple Podcasts automatically — and the live URL from step 2 keeps working as a finished VOD until three newer episodes push it out (the 3-most-recent prune is built into `podcast-tts`).

**Voice presets**: Default is `qwen-jason-palmer` (Qwen3-TTS clone, free local). Pass `--voice` from the user's args through to `podcast-tts`.

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
- **Article ordering**: place the article most worthy of editorial commentary last; order the other two naturally
- **Editorial**: take a genuine position on the last article. If a thread connects multiple articles, develop it — but variety in article selection comes first and the editorial adapts, not the other way around. Have a view.
- **`---` section separators**: put `---` on its own line between every section (intro, each article, editorial). `podcast-tts` uses these to split audio chunks cleanly at section boundaries rather than arbitrarily mid-paragraph

**Voice delivery (podcast/whatsapp modes):**
- `--voice qwen-jason-palmer` (default): Qwen3-TTS cloned Jason Palmer voice (free, local Mac Studio)
- `--voice aoede`: Gemini Flash, female British newsreader, cheap
- `--voice aoede-pro`: Gemini Pro, female British newsreader, 2x cost, richer expressivity
- `--voice adam-stone`: ElevenLabs, smooth/deep male, 1.2x speed, pricier
- `--voice chris-brift`: ElevenLabs, Chris Brift, 1.1x speed
- `--voice archer`: ElevenLabs, Archer (younger editorial tone)
- `--voice emma`: Kokoro bf_emma, British female (free, local Mac Studio)
- `--voice daniel`: Kokoro bf_daniel, British male (free, local Mac Studio)
- `--voice kokoro-aoede`: Kokoro af_aoede, American female (free, local Mac Studio)
- `--voice qwen-newsreader`: Qwen3-TTS, British RP male, instructed voice design (free, local Mac Studio)
- `--voice qwen-chris-brift`: Qwen3-TTS, cloned Chris Brift voice (free, local Mac Studio)
- Keep script under 2,100 words to stay within 17-minute limit (the editorial adds ~300 words)
- Short paragraphs = natural pauses for the TTS voice
- Avoid parentheticals - they sound awkward in audio

## Resources

### scripts/get-news-with-urls.ts
TypeScript script that connects to remote Chrome via CDP (port 9224, Mac Studio Chrome Beta), refreshes all 5 news tabs, and extracts headlines with article URLs. Returns JSON array with structure:
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
