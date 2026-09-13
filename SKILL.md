---
name: news-briefing
description: Generate daily news briefings covering world politics, economics, business, and technology. Use when the user asks for "news", "latest news", "what's happening", "news briefing", "news podcast", or similar requests for current events. Creates 10-15 minute summaries with expanded headlines section plus deep-dives into 3 selected articles from paywalled sources (Economist, FT, Guardian, NYT, Verge). Supports both audio (via TTS) and text-only modes.
args: "[--text-only] [--whatsapp] [--voice moss-marc-filippino|er-marc-filippino|aoede|aoede-pro|adam-stone|chris-brift|archer|emma|daniel|kokoro-aoede|qwen-newsreader|qwen-chris-brift|claude-buttery|claude-airy|claude-mellow|claude-glassy|claude-rounded]"
---

# News Briefing

Generate personalized daily news briefings by fetching headlines from 5 major news sources, selecting 3 compelling articles, and creating a podcast-style summary.

## Usage

Invoke this skill from the current harness (`/news-briefing` in Claude Code slash-command form, `$news-briefing` or an explicit skill mention in Codex).

- **Podcast mode (default)**: generate an MP3 via MOSS-TTS cloned Marc Filippino voice (free, local), then publish to the private podcast feed
- **Voice choice**: `--voice aoede-pro` - Uses Gemini Pro model (2x cost, richer expressivity)
- **Voice choice**: `--voice adam-stone` - Uses ElevenLabs Adam Stone voice instead (1.2x, pricier)
- **Voice choice**: `--voice chris-brift` - Uses ElevenLabs Chris Brift voice
- **Voice choice**: `--voice archer` - Uses ElevenLabs Archer voice (younger editorial)
- **Voice choice**: `--voice emma` - Kokoro bf_emma, British female (free, local Mac Studio)
- **Voice choice**: `--voice daniel` - Kokoro bf_daniel, British male (free, local Mac Studio)
- **Voice choice**: `--voice kokoro-aoede` - Kokoro af_aoede, American female (free, local Mac Studio)
- **Voice choice**: `--voice qwen-chris-brift` - Qwen3-TTS cloned Chris Brift voice (free, local Mac Studio)
- **Voice choice**: `--voice claude-buttery` (also claude-airy/mellow/glassy/rounded) - Anthropic claude.ai TTS via OAuth (cloud; 16 kHz source so narrower-band than the local 24-48 kHz engines; metering unestablished — usage is logged per synthesis; supports --live)
- **WhatsApp mode**: `--whatsapp` - Sends as WhatsApp voice message (legacy behavior)
- **Text-only mode**: `--text-only` - Saves transcript to file and sends file link (no TTS cost)

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
cd /Users/Shared/projects/oss/news-briefing-skill && \
PATH="/opt/homebrew/opt/node@25/bin:/opt/homebrew/bin:$PATH" npx tsx scripts/get-news-with-urls.ts 2>/dev/null | \
node /Users/claude/.claude/skills/news-briefing/scripts/save-and-diff-headlines.js
```

This returns annotated JSON with headlines and article URLs from:
- The Economist (politics, economics, international affairs)
- Financial Times (business, finance, economics)
- The Verge (technology, AI, consumer tech)
- The Guardian (UK/world politics, social issues)
- New York Times International (world news, US politics)

Each article has an `isNew` field (`true`/`false`) indicating whether its URL appeared in the previous day's fetch. The script also saves the current headlines to `references/last-headlines.json` for tomorrow's diff. On the very first run (no history yet), all articles are marked `isNew: true`.

Each article also carries a short `id` (`E1`..`E5` Economist, `F1`.. FT, `V1`.. Verge, `G1`.. Guardian, `N1`.. NYT). **From here on, refer to articles by id only and never retype a URL**: step 3.5 resolves ids to URLs from disk, and every later command that needs a URL reads it from `/tmp/briefing-selection.env`. (A 2-bit local model once rewrote `2026/09/10` as `2026-09-10` while retyping Economist URLs, got 404s, and spent an hour hunting a phantom pipeline bug.)

The script closes the news tabs it opened once headlines were retrieved; tabs that were already open are reused and left alone, and a tab whose site returned no headlines stays open for inspection.

**Important:** `isNew` is a mechanical URL-match — use it as a first filter, not the final word. Apply your own reasoning on top:
- A `isNew: true` article can still cover a story you already reported yesterday (e.g. a follow-up with a new URL on the same tariff threat or the same assassination attempt). Check whether the substance is genuinely different before including it.
- A `isNew: false` article could have been updated with significantly new information. If it's a major developing story with a clear new angle, it may still be worth mentioning.

### 2. Check Preferences

Read `references/preferences.md` to understand learned topic interests and article selection patterns. Use this to inform your choices in the next step.

### 2.5. Check Article History and Recent Summaries

Run both checks in parallel:

```bash
cat /Users/claude/.claude/skills/news-briefing/references/article-history.json
cat /Users/claude/.claude/skills/news-briefing/references/recent_summaries.json
```

**Article history** (`article-history.json`): lists every article URL used as a deep-dive in the past 7 days. Do NOT re-select any article that appears here.

**Recent summaries** (`recent_summaries.json`): one entry per day with the headline topics covered and the 3 deep-dive subjects. Use this to:
- Avoid repeating headline topics that have dominated the roundup all week (e.g. if Iran has led the intro every day, say less about it today even if it's still in the headlines)
- Spot thematic drift — if the past few deep-dives have all been geopolitics or all been tech, weight today's picks toward variety
- Notice developing threads worth brief callback ("as we covered earlier this week...")

**Same-day rerun detection:** If today's date already has an entry in `recent_summaries.json`, another agent has already run the briefing today. This is expected and fine — treat it like any other rerun:
- The `headlines_topics` and `deep_dives` arrays in today's entry show what the earlier briefing covered. Treat these exactly like yesterday's topics when deciding what to skip or mention lightly.
- Article history already contains the earlier briefing's deep-dive URLs, so the normal 7-day dedup check will prevent you from reusing those articles.
- Note this for the title suffix in step 6 — you'll need to disambiguate the episode title.

### 3. Select Articles

Autonomously select 3 articles that:
- Align with learned preferences (AI/tech industry, business strategy, policy)
- Offer substantive analysis over breaking news
- Span different topics when possible (avoid 3 articles on same story)
- Come from different sources when possible (prefer variety)
- **Prefer `isNew: true` articles** — articles marked `isNew: false` were already in yesterday's fetch and should only be picked if they are clearly the best available option and represent a major ongoing story
- **On a same-day rerun:** avoid the topics and deep-dive subjects listed in today's existing `recent_summaries` entry. Treat them the same as yesterday's coverage — don't repeat, or if a story is unavoidable, approach it from a clearly different angle.

**Selection criteria:**
- High priority: AI industry dynamics, tech business strategy, economic policy
- Medium priority: UK/international politics, financial markets, infrastructure
- Lower priority: Consumer product reviews, celebrity news, pure entertainment

### 3.5. Select and Scrape (by id)

Pass the three ids from the headlines JSON to `select-articles.js`. It resolves them to URLs from `references/last-headlines.json`, refuses any article already used as a deep dive in the last 7 days, writes the selection to `/tmp/briefing-selection.env` (`ARTICLE_N_ID/SITE/HEADLINE/URL/FILE`) and `/tmp/briefing-selection.json`, and scrapes each article with `scrape-remote` into `/tmp/article1.md`, `/tmp/article2.md`, `/tmp/article3.md`:

```bash
cd /Users/claude/.claude/skills/news-briefing && \
node scripts/select-articles.js E2 F1 V3
```

Exit 0 means all three scraped. Exit 2 means one or more scrapes failed: the output names the slot and prints the exact fallback commands (see step 4). Exit 1 is bad input (unknown id, duplicate, or an article already in the 7-day history — `--force` overrides the history check only when a reuse is deliberate).

**Do not type URLs anywhere in this workflow.** When a later command needs one, `source /tmp/briefing-selection.env` and use `$ARTICLE_N_URL`.

### 4. Fix Failed Scrapes

`scrape-remote` uses the remote Chrome session (CDP on port **9224**, Mac Studio Chrome Beta) to bypass paywalls with the user's credentials. Port 9223 is the Crostini legacy fallback — do not use it unless Mac Studio is unreachable.

If `select-articles.js` reported a failed slot, work through these in order, always taking the URL from the env file:

**Retry on failure:** If the scrape failed or returned empty/bot-challenge content (very short output, "just a moment", "verifying you are human"), restart the **Mac Studio** browser and retry:

```bash
source /tmp/briefing-selection.env
mac-chrome-restart
sleep 5
scrape-remote "$ARTICLE_2_URL" > /tmp/article2.md
```

**Snapshot fallback:** If `scrape-remote` still fails after retry (especially for interactive/JS-heavy pages like Economist `/interactive/` articles), use the accessibility tree scraper:

```bash
source /tmp/briefing-selection.env
scrape-snapshot "$ARTICLE_2_URL" > /tmp/article2.md
```

This uses `agent-browser` to render the page and extract text from the accessibility tree. The output may contain chart labels and data annotations mixed in with article text — that's OK, the LLM will handle cleanup when writing the podcast script. For particularly noisy output, you can also capture a PDF for visual reference:

```bash
agent-browser pdf /tmp/article1-layout.pdf
```

Then read the PDF yourself to understand the article's visual layout and distinguish body text from chart noise.

**DataDome block (NYT and others):** If `scrape-remote` exits with the message "Blocked by DataDome bot protection", do **not** retry — retrying won't help. Skip immediately and pick the next best candidate from the headlines list. NYT scraping is intermittent rather than categorically broken (deep-dive scrapes succeeded on 2026-09-10 and 2026-09-13), so do not pre-judge an NYT candidate out of a slot — but a genuine block is terminal for that article.

If an article still fails after all fallbacks, swap it: re-run `select-articles.js` with a different id in that slot (the other two are re-scraped too, which is cheap). Do not block the entire briefing on one failed scrape.

### 4.5. Record the Selection

Once all three `/tmp/articleN.md` files exist, record the deep dives in `references/article-history.json` so future briefings don't reuse them. The script reads `/tmp/briefing-selection.json`; it takes no arguments:

```bash
cd /Users/claude/.claude/skills/news-briefing && node scripts/update-article-history.js
```

It adds the 3 articles with today's date, prunes entries older than 7 days and updates the timestamp. Run it after the swaps are settled, not before — otherwise a swapped-out article gets recorded as used.

### 5. Write Podcast Script

**Before writing anything: read `references/broadcast-style.md` in full.** It defines the register for the entire script — an Economist radio voice (think The Intelligence) — plus a dated list of banned AI-prose patterns. It governs word choice, sentence shape, honorifics, attribution and rhythm. The TTS pronunciation rules later in this section still win on how numbers, dates and currencies are written out. While reading the scraped articles, collect one or two direct quotes per article worth speaking aloud, with named speakers — the style calls for letting people talk in their own words, and quotes can only be gathered now.

**Before writing: decide on article order.**

Article selection is driven by quality and variety first — the editorial doesn't constrain what you pick. Once you have your 3 articles, decide which one most invites commentary: the one with the sharpest implication, the most interesting tension, or the most provocative angle. Place that article last, just before the editorial. The other two go first in whatever order feels natural.

If two or more articles happen to share a genuine thread — a tension, a paradox, an underlying logic — you can build the editorial around that connection. But this is a bonus when it emerges naturally, not something to engineer. The default is: one article, one good take.

Create a podcast script with this structure, using `---` on its own line to separate sections:

**Intro: Headlines Roundup (2-3 minutes)**
- Brief opening greeting with date (format as "February eighth, twenty twenty-six" to avoid TTS stumbling on "2026")
- **Same-day rerun: time-of-day label must match the episode title suffix.** Before writing the greeting, compute the label from the actual London hour — the same logic used in step 6 to set the title suffix: before noon → "morning", noon–17:00 → "afternoon", 17:00–22:00 → "evening", after 22:00 → "late edition". Use that exact word in the opening line ("Good morning / afternoon / evening"). Do NOT guess based on whether this feels like a "second run" — the hour is the source of truth for both the script and the title.
- Scan headlines across the 5 sources, using `isNew: true` as a starting signal for freshness — but apply your own judgement too: a `isNew: true` article can still be a follow-up on yesterday's story (same substance, new URL), and a `isNew: false` article may have a genuinely new angle worth mentioning
- Skip or omit headlines that cover ground already reported yesterday — whether `isNew: false` by URL or a `isNew: true` follow-up on the same story. If a headline is stale and has no new angle, leave it out entirely
- On slow news days (weekends, holidays) where many headlines repeat, it's fine to have a shorter roundup — fewer but fresher stories beats padding with yesterday's news
- Cover politics, economics, business, tech from the fresh headlines — paint the full picture of what's actually new today
- End with a preview of the 3 deep-dive articles **in the order you've chosen** (match the ordering below)

**MANDATORY HEADLINES FACT-CHECK — do this before writing a single sentence of the intro:**

For every story you plan to mention in the headlines roundup, verify against the raw headlines JSON:
1. **Who** — is the subject of your sentence actually the subject of that headline? Don't conflate actors across stories.
2. **What** — does the action or claim you're attributing match what the headline says? Don't invent or strengthen claims.
3. **Where** — does the geography match? A story about Moscow is not "In the Middle East." A story about London is not "In Europe." Check before using any geographic label.
4. **Which source** — confirm the article is actually in today's headlines list, not a half-remembered story from earlier in the session.
5. **Job titles and roles** — if the headline does not state someone's title, do not supply one from memory. Political titles in particular go stale; calling a former official by an old role (or worse, demoting a sitting head of government to a junior post) is the kind of error that makes the briefing untrustworthy. If you are unsure of a person's current role, name them and describe what they announced or did — the action is what matters, not the title.

If you cannot trace a specific claim directly back to a headline URL in the fetched data, **cut it**. The headlines roundup is the one section where factual accuracy is non-negotiable — the listener trusts it to be true. Getting it wrong is not a style problem, it is a failure of the briefing's core function. When in doubt, say less.

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
- Governed by `references/broadcast-style.md` (mandatory read, above) — Economist radio register, Orwell rules, honorifics, banned AI-prose patterns
- Build narrative tension: setup → development → implication
- Present tense where appropriate

**TTS pronunciation — expand all abbreviations and symbols before saving the script.** Local TTS engines (MOSS, Kokoro, Qwen) read text literally and will mispronounce shorthand:
- Currency + unit abbreviations: `£4.7bn` → "four point seven billion pounds"; `$2tn` → "two trillion dollars"; `€500m` → "five hundred million euros"; `4m` → "four million"
- Standalone suffixes: `bn` → "billion"; `tn` → "trillion"; `m` → "million" — applies whether or not a currency symbol precedes it
- Currency symbols: `£` → "pounds"; `$` → "dollars"; `€` → "euros"
- Percentages written as `%` are usually fine, but verify if the engine stumbles
- Dates: already covered above (spell out month + day + year in words)
- Acronyms meant to be read as words (NATO, NASA) are fine; letter-by-letter acronyms (GOP, SCOTUS, DNC) should be expanded to their full names for a UK audience anyway

**Fish Audio delivery tags (fish-cloud engine only).** S2.1 has no working pause markup: `[break]`, `[long-break]` and `[pause]` are swallowed without producing any silence (measured and ear-confirmed 2026-08-28 — a tagged clip is no longer than an untagged one, and ten stacked `[long-break]`s degenerate into hallucinated speech). Section pauses come from `podcast-tts` instead, which since 2026-08-28 issues one cloud request per section and splices real silence between them. Write fish-cloud scripts like any other:

- **Section breaks**: use `---` on its own line, exactly as for every other engine. `podcast-tts` splits there and splices 1.75s of silence. A `[long-break]` alone on a line is also accepted as a section separator, for compatibility with scripts written before this changed — but `---` is the form to write now.
- **Intra-section pauses**: there is no mechanism for one. A standalone `[break]` is consumed and ignored (Fish's own inter-paragraph gap is already ~0.6s, so isolating a paragraph into its own request would add about a quarter-second and reset the clone conditioning). If a beat genuinely needs to land, make it a `---` section break or write it into the sentence structure.
- **Emphasis**: put `[emphasis]` immediately before a key phrase to stress it — e.g. `[emphasis] a hundred and forty-one thousand evaluation runs`.
- **Tone cues**: use `[chuckling]` at the start of a sentence for dry/wry moments; use `[confident]` for declarative assertions the presenter owns. The canonical S2 forms are `[whispering]` and `[chuckling]`; empirically `[chuckle]` also works; `[excited]` is flaky. These emotion and tone tags do work — it is only the pause markers that are inert.
- Do NOT insert these tags for other engines. On MOSS they are not read aloud literally, but they misbehave: inline within a sentence they become pauses or odd vocalizations ("[chuckling]" produced a sigh), and isolated on their own line — exactly where the section-break conversion puts them — MOSS hallucinates speech-like noises (observed on the Aug 1 episode re-run). On other engines assume they are read aloud.

**MOSS pause markers (moss/moss-lt engines, the default).** MOSS-TTS v1.5's only documented bracket markup is an explicit-duration pause: `[pause 1.5s]`, `[pause 3s]` (model card: `[pause X.Ys]`). Verified locally through podcast-tts: durations are honored (3s requested → ~2.9s measured) and nothing is spoken. Usage:

- Section breaks stay `---`. MOSS never sees the separator — podcast-tts strips it at chunking and splices silence in at concatenation (1.75s at `---`, 0.7s at paragraph breaks, per `MOSS_GAPS`). Do not use `[long-break]`/`[break]` with MOSS.
- `[pause X.Ys]` may be used sparingly for intra-section dramatic beats (e.g. the editorial pivot, or after a punchy standalone sentence), **inline only** — keep it inside a paragraph's text, never alone on its own line (a bracket tag standing alone risks the same hallucination as Fish tags there; inferred from the [break] behavior, not separately tested).
- MOSS v1.5 has no documented emotion or sound-event tags ([laugh]/[music] belong to MOSS-TTSD, the separate dialogue model). Don't use them.
- When converting a script between engines: both fish-cloud and MOSS now use `---` for section breaks, so conversion is only about the inline tags — strip Fish's `[chuckling]`/`[emphasis]`/emotion tags going to MOSS, and drop MOSS's inline `[pause X.Ys]` going to Fish (Fish ignores it).

(Operational note: fish-cloud runs on a free API promotion expected to end late August 2026 and may be retired after that — MOSS is the default and the safe long-term target.)

### 5.5. Sub-Edit and Fact-Check the Draft

Save the finished draft to `/tmp/briefing-script.txt`, then launch the sub-editor and fact-checker **in parallel** — they are independent and can both run at the same time:

**Sub-editor** (`briefing-sub-editor`, Fable): checks style only — house register, banned patterns, TTS hazards. Prompt: the draft's path plus the target TTS engine.

**Fact-checker** (`briefing-fact-checker`, Sonnet 5): checks factual accuracy against the source articles, headlines JSON, and the web. Prompt example:
```
Fact-check the draft at /tmp/briefing-script.txt.
Sources:
- /tmp/briefing-script.txt
- /tmp/article1.md, /tmp/article2.md, /tmp/article3.md (scraped deep-dive articles)
- /Users/claude/.claude/skills/news-briefing/references/last-headlines.json (today's headlines)
```
If the scraped articles have already been deleted, say so in the prompt — the agent will fall back to web search.

**Claude Code harness**: invoke both with the Agent tool, `run_in_background: false` for each, so both complete before you proceed. Named agent types: `briefing-sub-editor` and `briefing-fact-checker` (definitions in `agents/` in this skill, registered via symlinks in `~/.claude/agents/`).

**Fallback** (agent type unavailable, or non-Claude harness): spawn general-purpose subagents instructed to read `agents/sub-editor.md` and `agents/fact-checker.md` respectively.

Apply corrections from both passes before proceeding to TTS. You are the author: accept or reject each finding on merit. Factual corrections from the fact-checker take precedence over style — if a sub-editor suggestion changes a fact, figure or quote, skip it. One round is enough; do not loop.

**When the fact-checker flags a claim as "NOT IN SOURCES" or "UNVERIFIABLE"**: do not simply cut the claim — search the web first to verify or correct it. A figure or fact that isn't in the scraped articles may still be accurate and worth keeping with the right number. Only cut if search also fails to confirm it.

### 6. Deliver Briefing

#### Podcast Mode (Default)

Generate the audio using `podcast-tts` and publish to the podcast feed. This works independently of the WhatsApp agent. **Always run in the foreground** — a background run was killed mid-job for unknown reasons; foreground with `timeout: 1200000` has proven reliable.

1. **Confirm the corrected script** from step 5.5 is at `/tmp/briefing-script.txt` (**no style preamble needed** — the preset handles it). Only if you skipped sub-editing entirely, save it now:

```bash
cat > /tmp/briefing-script.txt << 'SCRIPT'
[Full podcast script here — just the content, no style instructions]
SCRIPT
```

2. **Announce the live stream URL** in the current chat *before* starting `podcast-tts`. The URL is deterministic from the output filename — no need to wait for the script to print it. Just output the following as plain text — do NOT use `speak` or any other tool. Do NOT tag `@Cosimo` here; save the push notification for when the episode is fully published (step 6).

```text
🔴 Live now (give it ~10s for the first segment): https://cosimos-mac-studio.tail2af01f.ts.net/podcast/live/briefing-episode/
```

(Use `briefing-episode` as the basename — it must match the basename of the MP3 output path in the next step.)

3. **Generate the MP3** using `podcast-tts` with `--live` so it produces an HLS event-playlist alongside the final MP3, and **capture the cost**:

```bash
TTS_OUTPUT=$(podcast-tts /tmp/briefing-episode.mp3 --voice moss-marc-filippino --live < /tmp/briefing-script.txt)
```

The `--live` flag writes `index.m3u8` + fmp4 segments into `/Users/Shared/projects/static/podcast/live/briefing-episode/` as each TTS chunk is produced, so the link from step 2 starts streaming as soon as the first ~4s of audio is encoded. The final MP3 is still produced normally at `/tmp/briefing-episode.mp3` and gets published to the RSS feed in step 4 as before. After generation completes, the same live URL becomes a finished VOD that plays end-to-end.

Pass through the `--voice` flag from the user's args. Default is `moss-marc-filippino` if not specified. Use `er-marc-filippino` when the user explicitly asks for ElevenReader (faster, cloud-based, flat-rate Ultra subscription, but no `--live` streaming). The `claude-*` presets (buttery/airy/mellow/glassy/rounded) are Anthropic claude.ai TTS via OAuth: cloud, `--live` capable, no per-use cost observed so far (metering unestablished; podcast-tts logs usage per synthesis).

**ElevenReader voices** (`er-*` presets): When the voice is an ElevenReader preset, also pass `--keep-read --title "$TITLE"` so the document stays in the ElevenReader library as a secondary consumption channel via their mobile app. ElevenReader is a batch engine (no `--live` streaming), so skip the live URL announcement in step 2. Example:

```bash
TTS_OUTPUT=$(podcast-tts /tmp/briefing-episode.mp3 --voice er-marc-filippino --keep-read --title "$TITLE" < /tmp/briefing-script.txt)
```

**Fish Audio cloud voices** (`--engine fish-cloud`, `fishcloud-*` presets, or `--voice economist-jason-palmer` etc.): Fish Audio S2.1 sends the entire script in one HTTP request and returns the complete audio when the server finishes — typically 2-3 minutes. Because it is a single-request engine:
- Skip step 2 — fish-cloud does not support `--live`, so there is no stream URL to announce.
- Do NOT pass `--live` in the `podcast-tts` command.
- **Always run in foreground** (not background). The Claude Code harness kills background tasks before a multi-minute HTTP response completes, which silently truncates the file. Use a 1200000ms timeout:

```bash
TTS_OUTPUT=$(podcast-tts /tmp/briefing-episode.mp3 --engine fish-cloud --voice economist-jason-palmer < /tmp/briefing-script.txt)
```

**Waiting for TTS to complete:** All engines run in the foreground Bash tool with a 1200000ms timeout. Do not use `run_in_background` — a background run was killed mid-job; foreground is reliable. Chunked engines (moss, kokoro, gemini, claude, etc.) typically take 10-17 minutes and support `--live`; single-request engines (fish-cloud, elevenreader) complete in 2-5 minutes. Both run in the foreground.

Do not poll segment counts or process status in a loop of individual shell calls. The script prints per-chunk progress to stderr, e.g. `done in 8.4s | avg 8.1s/chunk | eta ~8m`; inspect that output only after completion/failure notification or when the user explicitly asks for status.

4. **Publish to the podcast feed** (with show notes linking to transcript + native SRT transcript):

```bash
# Title suffix for same-day reruns — check if today already has a summaries entry
TODAY=$(TZ=Europe/London date +%Y-%m-%d)
EXISTING_ENTRY=$(python3 -c "
import json, sys
data = json.load(open('/Users/claude/.claude/skills/news-briefing/references/recent_summaries.json'))
print('yes' if any(s['date'] == '$TODAY' for s in data['summaries']) else 'no')
" 2>/dev/null)

if [ "$EXISTING_ENTRY" = "yes" ]; then
  HOUR=$(TZ=Europe/London date +%H)
  if   [ "$HOUR" -lt 12 ]; then SUFFIX=" (Morning)"
  elif [ "$HOUR" -lt 17 ]; then SUFFIX=" (Afternoon)"
  elif [ "$HOUR" -lt 22 ]; then SUFFIX=" (Evening)"
  else                           SUFFIX=" (Late Edition)"
  fi
else
  SUFFIX=""
fi

TITLE="News Briefing - $(TZ=Europe/London date +'%B %-d, %Y')${SUFFIX}"
DESCRIPTION="AI-curated daily news briefing: [brief summary of the 3 articles covered]"

# Save formatted script to static/articles/ (linked from show notes)
# Include a timestamp in the slug to avoid overwriting a same-day earlier briefing's transcript
ARTICLES_DIR="/Users/Shared/projects/static/articles"
mkdir -p "$ARTICLES_DIR"
SLUG="news-briefing-$(TZ=Europe/London date +%Y-%m-%d)$([ -n "$SUFFIX" ] && TZ=Europe/London date +-%H%M)"
cp /tmp/briefing-script.txt "$ARTICLES_DIR/${SLUG}.md"
chmod 644 "$ARTICLES_DIR/${SLUG}.md"
TRANSCRIPT_URL="https://cosimos-mac-studio.tail2af01f.ts.net/articles/${SLUG}.md"

# Generate timestamped SRT transcript via Groq Whisper (~4s for 15min audio at 200x realtime)
# This is the most reliable way to get accurate word-level timing for AntennaPod sync.
groq-transcribe /tmp/briefing-episode.mp3 /tmp/briefing-groq-transcript.md 2>&1 | grep -v "^$"
# (The .md output is discarded; we use our formatted script for show notes instead)

# Create show notes with transcript link and deep-dive article URLs.
# The ARTICLE_N_* variables come from select-articles.js (step 3.5) — never retype them.
source /tmp/briefing-selection.env
cat > /tmp/briefing-shownotes.md << EOF
## $TITLE

[Read full transcript]($TRANSCRIPT_URL)

**Deep dives:**
- $ARTICLE_1_HEADLINE: $ARTICLE_1_URL
- $ARTICLE_2_HEADLINE: $ARTICLE_2_URL
- $ARTICLE_3_HEADLINE: $ARTICLE_3_URL
EOF

podcast-add-episode /tmp/briefing-episode.mp3 "$TITLE" "$DESCRIPTION" \
    --notes /tmp/briefing-shownotes.md \
    --transcript /tmp/briefing-groq-transcript.srt
rm -f /tmp/briefing-shownotes.md

# Update recent summaries AFTER podcast-add-episode so the title check above sees no entry
# on a first-run day (and correctly adds a suffix only on genuine same-day reruns)
cd /Users/claude/.claude/skills/news-briefing && \
node scripts/update-recent-summaries.js '{
  "date": "YYYY-MM-DD",
  "headlines_topics": ["topic 1", "topic 2", "..."],
  "deep_dives": ["Article 1 subject", "Article 2 subject", "Article 3 subject"]
}'

# Clean up all temp files from this run (IMPORTANT: prevents stale files from confusing future sessions)
rm -f /tmp/briefing-episode.mp3 /tmp/briefing-script.txt \
      /tmp/briefing-groq-transcript.md /tmp/briefing-groq-transcript.srt \
      /tmp/article1.md /tmp/article2.md /tmp/article3.md \
      /tmp/briefing-selection.env /tmp/briefing-selection.json
```

Show notes contain a link to the formatted script (hosted in `static/articles/`). The `--transcript` flag embeds a `<podcast:transcript>` element in the feed with accurate word-level timing so Podcasting 2.0 apps (e.g. AntennaPod) can show synchronised in-app transcripts. Articles older than 7 days are cleaned up automatically by the `read-article` script.

5. **Save to Spotify** (default — run every time unless user passes `--no-spotify`):

Run after every briefing:

```bash
# Upload to the "Daily Briefing" show on Spotify
COVER_IMG="/Users/Shared/projects/static/podcast/cover-daily-briefing.jpg"
SPOTIFY_RESULT=$(save-to-spotify --json upload /tmp/briefing-episode.mp3 \
  --title "$TITLE" \
  --summary "$DESCRIPTION

Transcript: $TRANSCRIPT_URL" \
  --image "$COVER_IMG" \
  --show-id spotify:show:033dnvdmfbg1F8Ch3wd5sd \
  --language en 2>&1)
SPOTIFY_URI=$(echo "$SPOTIFY_RESULT" | jq -r '.episode_uri // empty')
if [ -n "$SPOTIFY_URI" ]; then
  SPOTIFY_EP_ID=$(echo "$SPOTIFY_URI" | sed 's/spotify:episode://')
  save-to-spotify --json episodes status "$SPOTIFY_EP_ID" --wait 2>&1 | jq -r '.readiness'
fi
```

The show `spotify:show:033dnvdmfbg1F8Ch3wd5sd` ("Daily Briefing") is pre-created. Cover art is at `/Users/Shared/projects/static/podcast/cover-daily-briefing.jpg` (terracotta starburst, matching the podcast feed). Episodes are private to the user's Spotify library. If `save-to-spotify` is not on PATH or auth has expired, skip this step silently — don't block the briefing.

6. **Notify the user**: Just output plain text (do NOT use `speak` — it wastes TTS credits on a text notification; do NOT use `send_message_to_workspace` — it targets a different workspace, not the current chat). Tag `@Cosimo` for a push notification. Include the episode title, a one-line summary of the three articles, and the TTS cost (e.g. "TTS cost: $0.12"). The user will see the episode in Apple Podcasts automatically — and the live URL from step 2 keeps working as a finished VOD until three newer episodes push it out (the 3-most-recent prune is built into `podcast-tts`).

**Voice presets**: Default is `moss-marc-filippino` (MOSS-TTS clone, free local Mac Studio). Pass `--voice` from the user's args through to `podcast-tts`. Use `er-marc-filippino` when the user wants ElevenReader (faster, cloud, no `--live`); `claude-*` presets are Anthropic claude.ai TTS (cloud, `--live` capable).

#### WhatsApp Mode (--whatsapp)

If the user passed `--whatsapp`, use the available WhatsApp voice/TTS tool instead to send as a voice message. In WCA, this is the `speak` MCP tool:

```typescript
mcp__whatsapp-agent-tools__speak({
  text: "Read this in a natural, engaging British newsreader style:\n\n[Full podcast script here...]",
  engine: "moss",
  voiceId: "marc-filippino"
})
```

#### Text-Only Mode (--text-only)

Save the script to `static/articles/` and share the URL:

```bash
ARTICLES_DIR="/Users/Shared/projects/static/articles"
mkdir -p "$ARTICLES_DIR"
SLUG="news-briefing-$(date +%Y-%m-%d)"
TRANSCRIPT_FILE="$ARTICLES_DIR/${SLUG}.md"

cat > "$TRANSCRIPT_FILE" << 'EOF'
# News Briefing - [Date]

[Your full podcast script here...]

EOF

chmod 644 "$TRANSCRIPT_FILE"
echo "Transcript available at: https://cosimos-mac-studio.tail2af01f.ts.net/articles/${SLUG}.md"
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
- Podcast mode (default) publishes to the private Apple Podcast feed via Tailscale and uploads to Spotify. Pass `--no-spotify` to skip Spotify upload.
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
- Transitions between sections are turns of thought, not signposts — see broadcast-style.md
- End each article with "why this matters" - connect to bigger trends
- Write in the broadcast-style.md register even for text-only mode
- **Article ordering**: place the article most worthy of editorial commentary last; order the other two naturally
- **Editorial**: take a genuine position on the last article. If a thread connects multiple articles, develop it — but variety in article selection comes first and the editorial adapts, not the other way around. Have a view.
- **`---` section separators**: put `---` on its own line between every section (intro, each article, editorial). `podcast-tts` uses these to split audio chunks cleanly at section boundaries rather than arbitrarily mid-paragraph. This now applies to fish-cloud too — it used to be the exception, but it splits and splices at `---` like the rest (see Fish Audio delivery tags above)

**Voice delivery (podcast/whatsapp modes):**
- `--voice moss-marc-filippino` (default): MOSS-TTS cloned Marc Filippino voice (free, local Mac Studio). Use `er-marc-filippino` for ElevenReader (cloud, faster, no live streaming).
- `--voice claude-buttery` (or claude-airy/mellow/glassy/rounded): Anthropic claude.ai TTS via OAuth (cloud, `--live` capable, 16 kHz source — narrower-band than local engines; multilingual with no extra flags).
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
TypeScript script that connects to remote Chrome via CDP (port 9224, Mac Studio Chrome Beta), opens or refreshes the 5 news homepages, extracts headlines with article URLs, then closes the tabs it opened for every site whose headlines were retrieved (pre-existing tabs are reused and left open). Piped through `save-and-diff-headlines.js`, which adds the `id` and `isNew` fields. Returns JSON array with structure:
```json
[
  {
    "site": "Financial Times",
    "pageUrl": "https://www.ft.com/",
    "articles": [
      {
        "id": "F1",
        "headline": "...",
        "url": "https://www.ft.com/content/...",
        "isNew": true
      }
    ]
  }
]
```

### scripts/select-articles.js
`node scripts/select-articles.js E2 F1 V3` — resolves three article ids against `references/last-headlines.json`, rejects ids already in the 7-day history (`--force` to override), writes `/tmp/briefing-selection.env` and `/tmp/briefing-selection.json`, and scrapes each article to `/tmp/articleN.md` with `scrape-remote` (`--no-scrape` to only write the selection). Exit 0 all scraped, 2 some scrape failed (fallback commands printed), 1 bad input. Exists so that no URL is ever retyped by the model.

### scripts/update-article-history.js
No arguments: records the three articles from `/tmp/briefing-selection.json` in `article-history.json` with today's date and prunes entries older than 7 days.

### references/broadcast-style.md
The script's style bible: Economist radio register distilled (July 2026) from the Economist style-guide plugin (`/Users/Shared/projects/oss/economist-style-guide-plugin`) and The Economist's "How to spot AI writing" corpus study. Read in full before writing the script (step 5). Its banned-patterns section is a dated snapshot of measured LLM tells — refresh it if the models' habits visibly change.

### agents/sub-editor.md
Custom subagent definition for the `briefing-sub-editor` (runs on Fable), registered via symlink at `~/.claude/agents/briefing-sub-editor.md`. Proofreads the draft against broadcast-style.md and returns numbered corrections; read-only by design — the author applies the edits. Invoked in step 5.5.

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

**CRITICAL:** Always check this file before selecting articles (`select-articles.js` also enforces it) and update it via `update-article-history.js` once the scrapes are settled (step 4.5). Articles older than 7 days are automatically pruned.
