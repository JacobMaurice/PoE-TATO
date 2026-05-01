#!/usr/bin/env python3
"""
scrape_change_id.py

Scrapes the current next_change_id from https://poe.ninja/stats and prints it
to stdout. Exits with code 1 on failure.

Usage (called from Node/shell):
    python3 scrape_change_id.py
"""

import json
import re
import sys
import urllib.request

POE_NINJA_STATS_URL = "https://poe.ninja/stats"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def scrape_next_change_id() -> str:
    req = urllib.request.Request(POE_NINJA_STATS_URL, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=10) as resp:
        html = resp.read().decode("utf-8")

    # poe.ninja is a Next.js app — the data lives in __NEXT_DATA__
    match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not match:
        raise ValueError("Could not find __NEXT_DATA__ script tag in poe.ninja/stats")

    next_data = json.loads(match.group(1))

    # Path: pageProps -> stats -> next_change_id  (adjust if poe.ninja restructures)
    try:
        change_id: str = next_data["props"]["pageProps"]["stats"]["next_change_id"]
    except KeyError:
        # Fallback: search the entire object for the key
        change_id = _deep_find(next_data, "next_change_id")
        if change_id is None:
            raise ValueError(
                f"next_change_id not found in __NEXT_DATA__. "
                f"Top-level keys: {list(next_data.get('props', {}).keys())}"
            )

    return change_id


def _deep_find(obj, key: str):
    """Recursively search a nested dict/list for the first occurrence of `key`."""
    if isinstance(obj, dict):
        if key in obj:
            return obj[key]
        for v in obj.values():
            result = _deep_find(v, key)
            if result is not None:
                return result
    elif isinstance(obj, list):
        for item in obj:
            result = _deep_find(item, key)
            if result is not None:
                return result
    return None


if __name__ == "__main__":
    try:
        change_id = scrape_next_change_id()
        print(change_id)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)