#!/usr/bin/env python3
"""Upload a briefing script to the ElevenReader library as a read. No TTS, no audio download.

ElevenReader names a read after the first line of its text, so the title goes in as a
heading line. The read stays in the library for the user to play in ElevenReader's own
web or mobile app, with whatever voice and expressiveness they pick there.

Run it inside the mcp-elevenreader project environment:

    uv run --project /Users/Shared/projects/oss/mcp-elevenreader \
        python scripts/upload-to-elevenreader.py /tmp/briefing-script.txt "News Briefing - October 12, 2026"

Before uploading it makes sure the account's default voice is Penny Sol (Cosimo's standing
choice since 2026-10-31), so a new read opens with that voice.

Prints voice=..., read_id=... and title=... on success.
"""
import re
import sys

sys.path.insert(0, "/Users/Shared/projects/oss/mcp-elevenreader")
import elevenreader_tts as er  # noqa: E402

VOICE = "penny-sol"


def ensure_voice():
    want = er.VOICE_ALIASES[VOICE]
    have = er.server.get_config().get("default_voice_id")
    if have != want:
        er.server.update_config(default_voice_id=want)
        print(f"voice set to {VOICE} (was {have})")
    else:
        print(f"voice={VOICE}")


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    path, title = sys.argv[1], sys.argv[2]
    ensure_voice()
    text = open(path, encoding="utf-8").read()
    text = re.sub(r"^\s*---\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    read = er.add_text(f"{title}\n\n{text}", title)
    read_id = read.get("read_id") or read.get("id")
    if not read_id:
        sys.exit(f"upload failed: {read}")
    done = er.wait_ready(read_id)
    print(f"read_id={read_id}")
    print(f"title={done.get('title')}")
    print(f"words={done.get('word_count')}")


if __name__ == "__main__":
    main()
