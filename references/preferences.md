# News Briefing Preferences

This file tracks learned preferences from user feedback to improve article selection over time.

## Topic Interests

### High Priority
- AI and technology industry dynamics
- Tech business strategy and economics
- AI safety, policy, and regulation
- **Technology's impact on society and culture** (and feedback loops)
- **Fintech** and financial services technology
- UK financial services and institutions

### Medium Priority
- UK and international politics
- Economic policy and financial markets
- Tech infrastructure and tools

### Lower Priority
- Consumer tech products (unless broader societal/cultural implications)
- Entertainment and media
- **Internal US politics** (unless broader international impact, especially UK/Italy)

## Article Selection Patterns

### Preferred Article Types
- In-depth analysis over breaking news
- Business strategy and industry dynamics
- Technical deep-dives with economic context
- Policy implications of technology
- International stories (UK, Europe, global implications)
- Avoid internal US politics unless clear international impact

### Source Diversity (IMPORTANT)
- **Always prefer 3 different sources** for deep-dive articles
- Only pick 2 from same source if other options are clearly inferior
- Variety of perspectives matters as much as topic quality

### Avoid
- **Product reviews** (consumer tech reviews, gadget launches, etc.)
- Celebrity/personality-focused stories
- Short breaking news without analysis
- **Subject-matter repetition**: Do not cover the same core company, individual, or developing story (e.g. SpaceX/Musk, a specific geopolitical conflict, or a particular company's ongoing drama) more than once in a 7-day window. The 7-day history check applies to the *substance* of the story, not just the specific article URL. A brief appearance in the previous day's headlines roundup is not equivalent to a deep dive: a genuinely new, substantive development remains eligible for a next-day deep dive. Distinguish a passing mention from prior substantive coverage. *Exception*: Genuinely historic, fast-moving breaking news of global significance (such as major geopolitical or macroeconomic crises) can be covered if there is a substantial new development, but ordinary corporate news or incremental follow-ups should be skipped.

## Coverage Balance Preferences

- Headlines roundup: 2-3 minutes (expanded from original 30 seconds)
- Deep-dive articles: 3-4 minutes each (trimmed from original 3-4 minutes)
- Total length: 10-15 minutes

## Feedback History

### 2026-07-11
- **Headline mention versus deep dive**: A topic or company briefly mentioned in one day's headlines remains eligible for a deep dive the next day when there is a genuinely new, substantive development. Do not treat a headline mention as seven-day topic coverage; apply the repetition rule to prior deep dives or repeated substantive treatment instead.

### 2026-06-19
- **Voice**: Switch from MOSS Jason Palmer to MOSS Marc Filippino (`moss-marc-filippino`) -- this is now the standing default. Skill SKILL.md already says `moss-marc-filippino` is the default; preferences.md was stale.

### 2026-02-08
- **Critical issue**: Reused 2 out of 3 articles from previous briefing (Economist dollar article, FT tech crash article)
- **Must check article-history.json** before selecting to avoid repeating articles from past 7 days
- TTS pronunciation issue: "2026" was read as "2020... 26" - use spelled-out format "twenty twenty-six" instead

### 2026-02-07
- Issue: Picked 2 articles from same source (FT) - should always aim for 3 different sources
- Emphasized: Source diversity is as important as topic quality

### 2026-02-13
- **First article (DOJ/Gail Slater antitrust) not very interesting** - internal US politics
- **Second and third articles were good**: NS&I (fintech interest + premium bonds holder) and Ring (owns Ring doorbell)
- Preference: Skip internal US political stories unless they have broader international repercussions
- Especially interested in connections to UK or Italian politics
- Interested in fintech and UK financial services (NS&I premium bonds customer)
- Voice: Adam Stone (ElevenLabs) worked well

### 2026-02-25
- Voice: Always use Aoede (explicitly stated preference)

### 2026-03-01
- **Praised dedicating an entire episode to a single historical event** (US-Israel war on Iran, Khamenei killed)
- When a genuinely historic, fast-moving story dominates all sources, it's better to go deep on that story from multiple angles than to force topic diversity
- Structure: headlines roundup covers the full breadth, deep-dives provide complementary angles on the same event (power vacuum, regional spread, geopolitical context)

### 2026-04-06
- Voice: Switch to Qwen Jason Palmer (`qwen-jason-palmer`) — free local Mac Studio voice, now preferred over Aoede

### 2026-02-05
- Liked: Musk/SpaceX + xAI merger, Google AI spending, chip market analysis
- All three AI-infrastructure focused articles worked well
- Requested: More room for broader headlines, trim deep-dives slightly
- Voice: Preferred default voice over Rachel (ElevenLabs API)

### 2026-05-10
- **Too thematically clustered**: all three articles (Caspian/Iran-Russia, Ukraine ceasefire/Putin, Tuapse oil strike) were from the same geopolitical theatre — not a Russia problem specifically, a variety problem
- **Ensure the 3 deep-dives span different domains**, even when one theme dominates the headlines. At least 1 should come from a clearly different area (science, economics, tech, UK/European domestic politics, etc.) — unless the story is a genuinely historic breaking event (cf. 2026-03-01 feedback)
- Good alternatives were available today: CAR-T cancer therapy (Guardian), Friedrich Merz (Economist), Hormuz energy market angle (FT/NYT)

### 2026-06-03
- **Avoid US political jargon**: "GOP" wasn't obvious to the listener. Use "Republicans" or "the Republican Party" instead. Generally spell out any US-specific acronyms or shorthand (e.g. don't assume familiarity with "DNC", "SCOTUS", etc.) — the audience is UK-based.

### 2026-06-04
- **Avoid subject/topic repetition**: Re-selected SpaceX/Musk IPO within a few days of two previous SpaceX/Musk briefings (May 29/30). Even though the article URL was different and contained new specific details, the core subject-matter was repetitive. Broadened the 7-day restriction rule to cover the core *topic and entity*, not just identical article URLs, while keeping a clear exception for fast-moving, globally significant historic breaking news.

### 2026-06-09
- **Voice**: Switch from Qwen Jason Palmer to MOSS Jason Palmer (`moss-jason-palmer`) — MOSS is now the default local TTS engine, user wants consistency
### 2026-06-18
- **Voice**: User requested Marc Filippino via ElevenReader TTS (`er-marc-filippino`) for this session
- **Spotify**: Skip by default — user rarely listens there, prefers Apple Podcasts. Only upload if user explicitly requests it (`--spotify` flag or direct ask)

### 2026-07-03
- **Too much UK focus for one episode**: Picked Cambridge/Cambridge innovation clusters (UK-framed), Starmer defence-cuts jobs analysis (UK politics), and Morgan McSweeney's resignation interview (UK politics) — two of three were literally the same Starmer/Burnham transition storyline, and the third leaned UK too.
- **Broaden the 2026-05-10 diversity rule beyond geopolitical theatre to country/domestic-focus clustering too**: even when stories come from different topic domains (politics, economics, tech) and different sources, three UK-centric deep-dives in one episode is still a variety problem. When multiple strong UK stories are available, prefer developing one of them in the headlines roundup (with a brief deep-dive) rather than using two full deep-dive slots on the same national storyline — leave room for at least one clearly non-UK/non-domestic-political story.
- **Selection order matters**: choose the 3 deep-dive articles for topic/theme/geography diversity first, independent of whether they connect to each other. Do NOT pick or favor an article because it links up nicely with another for the editorial — that's selection bias toward thematic clustering, which is exactly what this rule is trying to prevent. If a genuine thread happens to emerge naturally across the diversity-first picks (per SKILL.md's existing "bonus, not engineered" guidance), fine, use it in the editorial — but the thread must be a byproduct of good picks, never a selection criterion.
- **Don't force a cross-article thread in the editorial either**: if diversity-first picks don't share a genuine connection, that's fine and expected — default back to SKILL.md's baseline (one good take on the last/most editorial-worthy deep-dive, no cross-article link). A forced or stretched connection is worse than no connection.
