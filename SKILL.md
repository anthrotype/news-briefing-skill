---
name: news-briefing
description: Generate daily news briefings covering world politics, economics, business, and technology. Use when the user asks for "news", "latest news", "what's happening", "news briefing", "news podcast", or similar requests for current events. Creates 10-15 minute summaries with expanded headlines section plus deep-dives into 3 selected articles from paywalled sources (Economist, FT, Guardian, NYT, Verge). Supports both audio (via TTS) and text-only modes.
args: "[--text-only] [--whatsapp] [--elevenreader] [--voice gpt-live-web-sol|gpt-live-codex-sol|moss-marc-filippino|aoede|aoede-pro|adam-stone|chris-brift|archer|emma|daniel|kokoro-aoede|qwen-newsreader|qwen-chris-brift|claude-buttery|claude-airy|claude-mellow|claude-glassy|claude-rounded]"
---

# News Briefing

Generate personalized daily news briefings by fetching headlines from 5 major news sources, selecting 3 compelling articles, and creating a podcast-style summary.

## Usage

Invoke this skill from the current harness (`/news-briefing` in Claude Code slash-command form, `$news-briefing` or an explicit skill mention in Codex).

- **Podcast mode (default)**: generate an MP3 with the ChatGPT web voice (`gpt-live-web-sol`), falling back to GPT-Live via Codex (`gpt-live-codex-sol`) when the web route is not available, then publish to the private podcast feed
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
- **ElevenReader mode**: `--elevenreader`, or whenever the user asks for ElevenReader - uploads the script to the user's ElevenReader library as text and does nothing else: no TTS here, no audio download, no podcast feed, no Spotify. The user listens in ElevenReader's own web or mobile reader. The voice is Penny Sol (the user's standing choice since 2026-10-31); the upload helper sets it as the account's default voice before uploading, so nothing needs choosing. Use it only when the user asks for ElevenReader; every other run keeps the default voice, `gpt-live-web-sol`.

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

Do **not** read the monthly `briefing-analysis-*.md` reports yet. They come in step 5, after the stories are chosen, so the month's familiar themes cannot pull the selection toward them.

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
- **Never repeat a recent deep-dive subject.** The 7-day URL check only catches the same article; a different article on the same story passes it. Compare each candidate against every `deep_dives` entry in `recent_summaries.json` (the whole file, not just yesterday). If the story matches one, skip it unless it has moved on substantially (a new finding, a new party, a decision, a reversal). If you still pick it, cover only what is new, and open with a short callback such as "we covered this last Friday; what's new is…". Do not retell the background.
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

**Never run scrapes in parallel.** `scrape-remote` and `scrape-snapshot` all drive the same Chrome, and concurrent navigations abort each other (`Navigation failed: net::ERR_ABORTED`; on 2026-10-08, six of seven backgrounded scrapes failed this way). `select-articles.js` already scrapes one article at a time. For any extra scrape (for example headline stories whose full text you want for the roundup), loop sequentially in one command, taking each URL from `references/last-headlines.json` by id (`jq -r --arg id N1 '.. | objects | select(.id? == $id) | .url'`). Do not background the calls with `&`, and do not issue several scrape tool calls in the same turn.

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

**Long view.** Only after the three deep dives are recorded (step 4.5) and you have listed the headline stories for the roundup, read the newest monthly analysis:

```bash
ls /Users/claude/.claude/skills/news-briefing/references/briefing-analysis-*.md | sort | tail -1
```

Read at least Sections 1 and 2 (executive summary and recurring themes). The `monthly-briefing-analysis` cron job writes one on the 23rd of each month; days after its end date are covered by `recent_summaries.json`. The report must not change either list: do not add, drop or promote a story because it continues a thread the report ranks highly. Novelty is chosen first, and context is added afterwards.

When a headline or deep dive continues a thread from the monthly analysis, give it one or two sentences of context from that arc. Examples: "the fourth disclosure of an AI agent escaping its test since July", or "Brent has not been this high since the Red Sea front opened in September". Use this to show where a story stands, not to retell it: the callback must be shorter than the news it frames, and at most one per story. Skip it when the connection is loose. The report is our own summary of past briefings, not a primary source. Attribute a date or figure taken from it ("as we reported in August"), or check it against today's articles or the web before stating it as fact. The fact-checker receives the report path (step 5.5) and will flag claims that match neither.

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

**Drama 3 speech tags (`--voice drama3-marc-filippino`).** This local engine uses the same clone presets as MOSS. Keep ordinary news narration untagged. For an intentional delivery change, put `[laughs]`, `[sighs]`, or `[whispers]` immediately before the relevant text. These are generation cues, not exact timing controls. Do not carry MOSS `[pause X.Ys]` or Fish S2 pause tags into a Drama 3 script. Use `---` for section breaks; `podcast-tts` inserts real silence. Speaker tags `<|speaker:0|>` through `<|speaker:15|>` select speakers, but this wrapper supplies only one clone reference per request. Use separate renders when each speaker needs a distinct reference. [Upstream tag and streaming guide](https://blaizzy.github.io/mlx-audio/models/tts/fish-drama3.html).

**Ming (`--voice ming-uk-george`, `ming-marc-filippino`, other `ming-<preset>`).** Local Ant Group Ming-3.0-tts 0.5B, faster than real time. It has no text normalisation, so a Ming script must write every number, date, currency amount and percentage out in words ("three point two per cent", not "3.2%"); abbreviations that should be expanded need the same treatment. Keep narration untagged; Ming's inline tags are capitalised (`[Sigh]`, `[Laughter]`), and the MOSS, Fish S2 and Drama 3 tags do not apply. Use `---` for section breaks.

**MOSS pause markers (moss/moss-lt engines).** MOSS-TTS v1.5's only documented bracket markup is an explicit-duration pause: `[pause 1.5s]`, `[pause 3s]` (model card: `[pause X.Ys]`). Verified locally through podcast-tts: durations are honored (3s requested → ~2.9s measured) and nothing is spoken. Usage:

- Section breaks stay `---`. MOSS never sees the separator — podcast-tts strips it at chunking and splices silence in at concatenation (1.75s at `---`, 0.7s at paragraph breaks, per `MOSS_GAPS`). Do not use `[long-break]`/`[break]` with MOSS.
- `[pause X.Ys]` may be used sparingly for intra-section dramatic beats (e.g. the editorial pivot, or after a punchy standalone sentence), **inline only** — keep it inside a paragraph's text, never alone on its own line (a bracket tag standing alone risks the same hallucination as Fish tags there; inferred from the [break] behavior, not separately tested).
- MOSS v1.5 has no documented emotion or sound-event tags ([laugh]/[music] belong to MOSS-TTSD, the separate dialogue model). Don't use them.
- When converting a script between engines: both fish-cloud and MOSS now use `---` for section breaks, so conversion is only about the inline tags — strip Fish's `[chuckling]`/`[emphasis]`/emotion tags going to MOSS, and drop MOSS's inline `[pause X.Ys]` going to Fish (Fish ignores it).

(Operational note: fish-cloud runs on a free API promotion expected to end late August 2026 and may be retired after that — MOSS is the safe long-term target among the local voices.)

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
- /Users/claude/.claude/skills/news-briefing/references/briefing-analysis-<start>-to-<end>.md (newest monthly analysis; background for long-view callbacks, lower authority than the articles)
```
If the scraped articles have already been deleted, say so in the prompt — the agent will fall back to web search.

**Claude Code harness**: invoke both with the Agent tool, `run_in_background: false` for each, so both complete before you proceed. Named agent types: `briefing-sub-editor` and `briefing-fact-checker` (definitions in `agents/` in this skill, registered via symlinks in `~/.claude/agents/`).

**Fallback** (agent type unavailable, or non-Claude harness): spawn general-purpose subagents instructed to read `agents/sub-editor.md` and `agents/fact-checker.md` respectively.

Apply corrections from both passes before proceeding to TTS. You are the author: accept or reject each finding on merit. Factual corrections from the fact-checker take precedence over style — if a sub-editor suggestion changes a fact, figure or quote, skip it. One round is enough; do not loop.

**When the fact-checker flags a claim as "NOT IN SOURCES" or "UNVERIFIABLE"**: do not simply cut the claim — search the web first to verify or correct it. A figure or fact that isn't in the scraped articles may still be accurate and worth keeping with the right number. Only cut if search also fails to confirm it.

### 6. Deliver Briefing

#### Podcast Mode (Default)

Generate the audio using `podcast-tts` and publish to the podcast feed. This works independently of the WhatsApp agent. Chunked engines (the default GPT-Live voices and MOSS included) take 10-17 minutes, so **run `podcast-tts` as a background job** (`run_in_background: true`, Bash `timeout: 3600000`) and resume from the completion notification. A foreground Bash call cannot wait that long: the harness caps it at 600000 ms, ignores a larger `timeout`, and moves the command to the background after 10 minutes (tested 2026-10-01 with an 11-minute command). Whichever way it starts, **verify the MP3 before publishing** (step 3).

1. **Confirm the corrected script** from step 5.5 is at `/tmp/briefing-script.txt` (**no style preamble needed** — the preset handles it). Only if you skipped sub-editing entirely, save it now:

```bash
cat > /tmp/briefing-script.txt << 'SCRIPT'
[Full podcast script here — just the content, no style instructions]
SCRIPT
```

2. **Announce the live stream URL** in the current chat *before* starting `podcast-tts` (skip this step for the GPT-Live voices, which are the default, see below: it applies only when you pick a `--live` voice such as MOSS). The URL is deterministic from the output filename — no need to wait for the script to print it. Just output the following as plain text — do NOT use `speak` or any other tool. Do NOT tag `@Cosimo` here; save the push notification for when the episode is fully published (step 7).

```text
🔴 Live now (give it ~10s for the first segment): https://cosimos-mac-studio.tail2af01f.ts.net/podcast/live/briefing-episode/
```

(Use `briefing-episode` as the basename — it must match the basename of the MP3 output path in the next step.)

3. **Generate the MP3** using `podcast-tts` and **capture the cost**. The default is the ChatGPT web voice, with GPT-Live via Codex as the fallback (see **GPT-Live voices** below for the commands, the fallback rule and the checks). The MOSS command below is for an explicitly requested `--voice moss-marc-filippino` or another `--live` voice: it passes `--live` so the run produces an HLS event-playlist alongside the final MP3. Run it as a background Bash job (`run_in_background: true`, `timeout: 3600000`). Shell variables do not survive between calls, so the output goes to a file:

```bash
TTS_OUTPUT=$(podcast-tts /tmp/briefing-episode.mp3 --voice moss-marc-filippino --live < /tmp/briefing-script.txt); echo "exit=$?"; echo "$TTS_OUTPUT" > /tmp/briefing-tts-output.txt
```

The cost line (`COST:...`) ends up in `/tmp/briefing-tts-output.txt`.

**Verify the MP3 before step 4.** `podcast-tts` writes the MP3 only at the very end ("Converting to MP3... Done"), so a killed run leaves no file, or a stale one from an earlier run. Check that the run exited 0, that the file is newer than the script, and that its duration is plausible for the word count:

```bash
python3 - <<'EOF'
import os, subprocess, sys
mp3, script = '/tmp/briefing-episode.mp3', '/tmp/briefing-script.txt'
if not os.path.exists(mp3) or os.path.getmtime(mp3) < os.path.getmtime(script):
    sys.exit('FAIL: no fresh MP3 (run died or MP3 is stale)')
words = len(open(script).read().split())
dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]))
exp = words / 2.75  # GPT-Live Sol (default): 2,275 words -> 775 s (2026-10-27); MOSS runs at words / 2.6 (2,084 words -> 792 s, 2026-10-01)
print(f'words={words} duration={dur:.0f}s expected~{exp:.0f}s')
sys.exit(0 if 0.8 * exp <= dur <= 1.25 * exp else 'FAIL: duration outside 80-125% of expected')
EOF
```

If it fails, do not publish: rerun `podcast-tts`. The band catches a killed or badly truncated run. It will not catch a lost final paragraph (about 10% of the audio), so also check that the Groq transcript in step 4 ends with the script's closing sentence.

The `--live` flag writes `index.m3u8` + fmp4 segments into `/Users/Shared/projects/static/podcast/live/briefing-episode/` as each TTS chunk is produced, so the link from step 2 starts streaming as soon as the first ~4s of audio is encoded. The final MP3 is still produced normally at `/tmp/briefing-episode.mp3` and gets published to the RSS feed in step 4 as before. After generation completes, the same live URL becomes a finished VOD that plays end-to-end.

Pass through the `--voice` flag from the user's args. Default is `gpt-live-web-sol` if not specified, with `gpt-live-codex-sol` as the automatic fallback (see **GPT-Live voices**); an explicit `--voice` is always honoured and never silently replaced. ElevenReader is not a TTS voice for briefings any more: when the user asks for it, use ElevenReader Mode below instead. The `claude-*` presets (buttery/airy/mellow/glassy/rounded) are Anthropic claude.ai TTS via OAuth: cloud, `--live` capable, no per-use cost observed so far (metering unestablished; podcast-tts logs usage per synthesis).

**Fish Audio cloud voices** (`--engine fish-cloud`, `fishcloud-*` presets, or `--voice economist-jason-palmer` etc.): Fish Audio S2.1 sends the entire script in one HTTP request and returns the complete audio when the server finishes — typically 2-3 minutes. Because it is a single-request engine:
- Skip step 2 — fish-cloud does not support `--live`, so there is no stream URL to announce.
- Do NOT pass `--live` in the `podcast-tts` command.
- **Run in the foreground** with a 600000ms timeout (it finishes well inside the 10-minute foreground cap). An earlier note (2026-08-01) said the harness killed background tasks before this single HTTP response landed and silently truncated the file; that was never diagnosed or retested, so keep fish-cloud in the foreground:

```bash
TTS_OUTPUT=$(podcast-tts /tmp/briefing-episode.mp3 --engine fish-cloud --voice economist-jason-palmer < /tmp/briefing-script.txt)
```

**GPT-Live voices** (`--voice gpt-live-web-sol`, ChatGPT web voice allowance; `--voice gpt-live-codex-sol`, Codex allowance). **These are the default**: when the user passes no `--voice`, use `gpt-live-web-sol`. Sol reads the script expressively and may change a word or add a short preamble, so the recording needs checking before it is published. Rules:
- **Fallback to Codex.** If the web route is not available, rerun the same script with `--voice gpt-live-codex-sol` (same command, same checks, no live stream). "Not available" means the web run cannot start (ChatGPT logged out, Chrome or CDP 9224 unreachable, voice allowance or session limit exhausted) or still fails after the one retry described under **Check the metadata**. Delete any leftover ChatGPT chat first, say in the notification which route produced the episode and why, and quote that route's cost line. If the Codex route fails too, report where each broke and ask before using another voice. Only an explicit `--voice` from the user overrides this order.
- **No live stream.** Skip step 2 and do NOT pass `--live`: the recording needs post-processing, so a live stream would carry the uncut audio. Run in the background (`timeout: 3600000`) without it:

```bash
TTS_OUTPUT=$(podcast-tts /tmp/briefing-episode.mp3 --voice gpt-live-web-sol < /tmp/briefing-script.txt); echo "exit=$?"; echo "$TTS_OUTPUT" > /tmp/briefing-tts-output.txt
```

- **Finish your own scraping first.** The web route drives the shared Chrome on CDP 9224, and other agents (Claudio wakes every 45 minutes and uses the browser) cannot be kept off it. The recorder re-selects its own tab before every command and retries when a call lands in another tab, so ordinary use by others is survived (fixed 2026-10-22; before that, any tab activity sent its polls to the wrong tab and the run died with `__podcastVoice is not defined`). Do not add your own browser work during a run. If it still fails with "reloaded or closed", the tab really was reloaded or closed: retry once.
- **Check the metadata.** `/tmp/briefing-episode.mp3.gpt-live.json` must show `completed: true`, `chatDeleted: true` (web route) and per-chunk capture times that match (`wallSeconds` against `audioSeconds`). A failed web run leaves its temporary ChatGPT chat and tab open: delete the chat before retrying, retry once, and if it fails again switch to the Codex fallback above. It died once after chunk 1 on 2026-10-21 (`__podcastVoice is not defined`) and the retry completed.
- **Check the audio, for faults only.** Cosimo trusts his ear over the recognisers and small natural phrasing changes from Sol are acceptable, so do not run several recognisers or chase word-level differences. Run `gpt_live_assemble.py /tmp/briefing-episode.mp3.raw --list` and compare each chunk's raw length with its text at about 2.75 words per second: a chunk far too short is a truncated section. On 2026-10-22 the Meta section stopped after 10.8 s of about 150 s, and the run still exited 0 with `completed: true`. Then read the Groq transcript of the MP3 (the one step 4 makes for the .srt; run `groq-transcribe` early and reuse it) for exactly three things: a leftover Sol lead-in at a chunk opening ("Let me shape that so it lands cleanly", "I'll take it slowly and let those beats land"; the automatic trimmer cuts only when it finds the script's first eight words), a missing section, and the closing sentence. A misread name or number is worth a fix, but only when it changes the meaning.
- **Fix a truncated section by re-recording it alone.** Write that section's paragraphs to a file, run `podcast-tts /tmp/briefing-section.mp3 --voice gpt-live-web-sol < file` (about 3 minutes), copy its `raw-0.wav` over `/tmp/briefing-episode.mp3.raw/raw-N.wav`, set that chunk's `rawSeconds` and `introCut` in `manifest.json` from the new run's manifest, and rebuild with `gpt_live_assemble.py` as below. The other chunks are untouched.
- **Edit the original recording, never the finished MP3.** `podcast-tts` keeps the lossless chunk recordings in `/tmp/briefing-episode.mp3.raw/`. To cut a lead-in, transcribe only the first 30 s of that `raw-N.wav` with Parakeet word timestamps (`/v1/audio/transcriptions`, model `parakeet-tdt-0.6b-v3`, `word_timestamps=true`) and set `introCut` to 0.18 s before the first real word. Write the spans into `/tmp/briefing-edits.json` (seconds of that raw chunk, cuts in silence, e.g. `{"3": {"introCut": 5.90}}`), then rebuild with `/Users/Shared/projects/oss/podcasting/gpt_live_assemble.py /tmp/briefing-episode.mp3.raw /tmp/briefing-episode.mp3 --edits /tmp/briefing-edits.json`. Every cut runs on the float recordings before the one MP3 encode. Say in the notification what you cut or changed. Format and details: `/Users/Shared/projects/oss/podcasting/GPT-LIVE.md`.
- **Duration check.** The `words / 2.6` calibration is for MOSS. Sol runs at about 2.75 words per second (2,137 words became 776 s on 2026-10-22; 2,033 became 718 s on 2026-10-21). The per-chunk length comparison above is the completeness test.
- **Cost line.** The web route prints the remaining voice allowance in `COST:`, not a dollar figure. Quote that in the notification. The Codex route prints an estimate.

**Waiting for TTS to complete:** Chunked engines (moss, kokoro, gemini, claude, etc.) typically take 10-17 minutes and support `--live`: run them as a background job (`run_in_background: true`, `timeout: 3600000`) and resume from the completion notification. Single-request engines (fish-cloud) complete in 2-5 minutes: run them in the foreground with a 600000ms timeout. The foreground cap is 600000 ms whatever `timeout` is requested. History: a background run died mid-job on 2026-05-31 for a cause nobody found (the agent invented one), and the rule was set to "always foreground" on 2026-08-12. That rule only worked because the harness moves a long foreground call to the background after 10 minutes. A 13m12s background run completed cleanly on 2026-10-01, and the MP3 check in step 3 covers the old failure.

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

# Step 5 runs in a separate shell: hand over the variables it needs
printf 'TITLE=%q\nDESCRIPTION=%q\nTRANSCRIPT_URL=%q\n' "$TITLE" "$DESCRIPTION" "$TRANSCRIPT_URL" > /tmp/briefing-meta.env

# Update recent summaries AFTER podcast-add-episode so the title check above sees no entry
# on a first-run day (and correctly adds a suffix only on genuine same-day reruns)
cd /Users/claude/.claude/skills/news-briefing && \
node scripts/update-recent-summaries.js '{
  "date": "YYYY-MM-DD",
  "headlines_topics": ["topic 1", "topic 2", "..."],
  "deep_dives": ["Article 1 subject", "Article 2 subject", "Article 3 subject"]
}'
```

Do not delete the temp files yet: step 5 still needs the MP3, and step 6 cleans up.

Show notes contain a link to the formatted script (hosted in `static/articles/`). The `--transcript` flag embeds a `<podcast:transcript>` element in the feed with accurate word-level timing so Podcasting 2.0 apps (e.g. AntennaPod) can show synchronised in-app transcripts. Articles older than 7 days are cleaned up automatically by the `read-article` script.

5. **Save to Spotify** (default — run every time unless user passes `--no-spotify`):

Run after every briefing:

```bash
# Upload to the "Daily Briefing" show on Spotify
source /tmp/briefing-meta.env   # TITLE, DESCRIPTION, TRANSCRIPT_URL from step 4
COVER_IMG="/Users/Shared/projects/static/podcast/cover-daily-briefing.jpg"
SPOTIFY_RESULT=$(save-to-spotify --json upload /tmp/briefing-episode.mp3 \
  --title "$TITLE" \
  --summary "$DESCRIPTION

Transcript: $TRANSCRIPT_URL" \
  --image "$COVER_IMG" \
  --show-id spotify:show:033dnvdmfbg1F8Ch3wd5sd \
  --language en 2>&1)
# Parse line by line: the CLI can print non-JSON lines (e.g. a <claude-code-hint .../> tag)
# alongside the JSON, and plain `jq` aborts on the first one. `fromjson?` skips them.
SPOTIFY_URI=$(echo "$SPOTIFY_RESULT" | jq -rR 'fromjson? | .episode_uri // empty')
if [ -n "$SPOTIFY_URI" ]; then
  SPOTIFY_EP_ID=$(echo "$SPOTIFY_URI" | sed 's/spotify:episode://')
  save-to-spotify --json episodes status "$SPOTIFY_EP_ID" --wait 2>&1 | jq -rR 'fromjson? | .readiness // empty'
else
  echo "Spotify upload failed: $SPOTIFY_RESULT"
fi
```

The show `spotify:show:033dnvdmfbg1F8Ch3wd5sd` ("Daily Briefing") is pre-created. Cover art is at `/Users/Shared/projects/static/podcast/cover-daily-briefing.jpg` (terracotta starburst, matching the podcast feed). Episodes are private to the user's Spotify library. If `save-to-spotify` is not on PATH or auth has expired, skip this step silently — don't block the briefing.

6. **Clean up** — after the Spotify upload (or after step 4 if you passed `--no-spotify`). Print the TTS cost first, then delete every temp file from this run (IMPORTANT: prevents stale files from confusing future sessions):

```bash
grep '^COST:' /tmp/briefing-tts-output.txt
rm -f /tmp/briefing-episode.mp3 /tmp/briefing-script.txt \
      /tmp/briefing-groq-transcript.md /tmp/briefing-groq-transcript.srt \
      /tmp/article1.md /tmp/article2.md /tmp/article3.md \
      /tmp/briefing-selection.env /tmp/briefing-selection.json \
      /tmp/briefing-meta.env /tmp/briefing-tts-output.txt \
      /tmp/briefing-edits.json /tmp/briefing-episode.mp3.gpt-live.json
rm -rf /tmp/briefing-episode.mp3.raw   # GPT-Live voices only: the lossless chunk recordings (150 to 300 MB)
```

7. **Notify the user — mandatory, every run**: Output plain text (do NOT use `speak` — it wastes TTS credits on a text notification; do NOT use `send_message_to_workspace` — it targets a different workspace, not the current chat). **Always include a push page: tag `@Cosimo` or call `notify_user`. This is never optional, even when the session looks interactive — Cosimo regularly steps away for the half hour a briefing takes, and the page is the only thing that tells him it finished. Do not reason that he is watching the chat; he isn't.** Include the episode title, a one-line summary of the three articles, and the TTS cost (the `COST:` line step 6 printed, e.g. "TTS cost: $0.12"). The user will see the episode in Apple Podcasts automatically — and the live URL from step 2 keeps working as a finished VOD until three newer episodes push it out (the 3-most-recent prune is built into `podcast-tts`).

**Voice presets**: Default is `gpt-live-web-sol` (ChatGPT web voice), falling back to `gpt-live-codex-sol` when the web route is not available; `moss-marc-filippino` (MOSS-TTS clone, free local Mac Studio) remains available on request. Pass `--voice` from the user's args through to `podcast-tts`. `claude-*` presets are Anthropic claude.ai TTS (cloud, `--live` capable). For ElevenReader see ElevenReader Mode.

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

#### ElevenReader Mode (--elevenreader)

When the user asks for ElevenReader (the GPT-Live default applies to every other run), the briefing goes into their ElevenReader library as text and nowhere else. They listen in ElevenReader's own web or mobile reader with the Penny Sol voice (the helper in step 2 enforces it). Do NOT render audio, do NOT download audio from ElevenReader, and do NOT publish to the podcast feed or Spotify. Podcast Mode's steps 2, 3 and 5 (live URL, TTS, Spotify) and the feed publication in step 4 do not apply.

Steps 0 to 5.5 run as usual, including the sub-edit and the fact-check, and step 4.5 still records the selection. Then:

1. Work out the title. Same rule as Podcast Mode step 4: `News Briefing - <Month D, YYYY>`, with a `(Morning)`, `(Afternoon)`, `(Evening)` or `(Late Edition)` suffix when `recent_summaries.json` already has an entry for today. Do this before the summary update in step 3 below.
2. Upload the script. ElevenReader names a read after the first line of its text, so the helper puts the title in as a heading and strips the `---` separators:

```bash
cd /Users/Shared/projects/oss/news-briefing-skill && \
uv run --project /Users/Shared/projects/oss/mcp-elevenreader \
  python scripts/upload-to-elevenreader.py /tmp/briefing-script.txt "$TITLE"
```

It first makes sure the account's default voice is Penny Sol, then prints `voice=` (or `voice set to penny-sol`), `read_id=`, `title=` and `words=`. Check that the title is the one you passed and that the word count is within a few words of the script's.
3. Record the day with `scripts/update-recent-summaries.js`, exactly as in Podcast Mode step 4, so tomorrow's briefing does not repeat today's stories.
4. Clean up: `rm -f /tmp/briefing-script.txt /tmp/article1.md /tmp/article2.md /tmp/article3.md /tmp/briefing-selection.env /tmp/briefing-selection.json /tmp/headline-*.md`.
5. Notify with a push page (tag `@Cosimo` or call `notify_user`): the title, a one-line summary of the three articles, and that it is in the ElevenReader library. There is no TTS cost line.

Never delete the read afterwards; it is the deliverable. The `er-*` presets remain in `podcast-tts` for ad-hoc use but are not part of this workflow. Voice clones are not available on ElevenReader any more (the ElevenLabs subscription ended), so the Marc Filippino clone does not work there; only stock and library voices do.

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
- Use `--elevenreader` to put the text in the ElevenReader library and nothing else (no audio, no feed, no Spotify)
- The `--voice` flag controls TTS: `gpt-live-web-sol` (default, falls back to `gpt-live-codex-sol`), `chris-brift` (ElevenLabs), `archer` (younger editorial), `adam-stone` (deeper), or `aoede` (Gemini, free)

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
- `--voice drama3-marc-filippino`: local Fish Audio Drama 3 4-bit with Marc's clone. Other `drama3-<preset>` voices include `gemma`, `gina`, and `jason-palmer`.
- `--voice ming-uk-george`: local Ming-3.0-tts 0.5B built-in British voice; also `ming-uk-charlotte` and `ming-<clone preset>` such as `ming-marc-filippino`. Write numbers as words.
- `--voice gpt-live-web-sol` (default): ChatGPT web voice, Sol. Falls back to `--voice gpt-live-codex-sol` (Codex allowance) when the web route is not available.
- `--voice moss-marc-filippino`: MOSS-TTS cloned Marc Filippino voice (free, local Mac Studio).
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

### scripts/upload-to-elevenreader.py
`uv run --project /Users/Shared/projects/oss/mcp-elevenreader python scripts/upload-to-elevenreader.py <script.txt> "<title>"` — uploads the briefing text to the ElevenReader library with the title as a heading and prints `voice=`, `read_id=`, `title=`, `words=`. It sets the account's default ElevenReader voice to Penny Sol first. No TTS, no audio download. Used by ElevenReader Mode.

### scripts/update-article-history.js
No arguments: records the three articles from `/tmp/briefing-selection.json` in `article-history.json` with today's date and prunes entries older than 7 days.

### references/broadcast-style.md
The script's style bible: Economist radio register distilled (July 2026) from the Economist style-guide plugin (`/Users/Shared/projects/oss/economist-style-guide-plugin`) and The Economist's "How to spot AI writing" corpus study. Read in full before writing the script (step 5). Its banned-patterns section is a dated snapshot of measured LLM tells — refresh it if the models' habits visibly change.

### agents/sub-editor.md
Custom subagent definition for the `briefing-sub-editor` (runs on Fable), registered via symlink at `~/.claude/agents/briefing-sub-editor.md`. Proofreads the draft against broadcast-style.md and returns numbered corrections; read-only by design — the author applies the edits. Invoked in step 5.5.

### references/briefing-analysis-*.md
Monthly thematic reports on the past month's briefings (themes ranked by frequency, how each developed, key dates and figures). Written on the 23rd by the `monthly-briefing-analysis` cron job (`/Users/Shared/projects/scripts/monthly-briefing-analysis`). Generated files, committed to the repo. Read the newest in step 5, only after the deep dives and headline stories are chosen, and use it for context only.

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
