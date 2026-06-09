#!/usr/bin/env python3
"""Validate structural integrity between content/registry.js and the content/ tree.

Checks:
  1. Every topic `path` in the registry resolves to content/<path>/topic.js.
  2. PT/EN parity — each topic.js has a sibling topic-en.js.
  3. Every `related: [...]` reference points to a path that exists in the registry.
  4. No orphan content folders — every content/<domain>/<topic>/topic.js is
     referenced by a registry path (folder == registry 1:1).
  5. Each `correct:` index inside a quiz stays a non-negative int (cheap sanity;
     range is enforced by validate_content.py).

Regex + brace-aware where needed — does NOT eval JS. PowerShell/Python only — never Node.

Usage:  python scripts/validate_registry.py
Exit code: 0 if no errors, 1 otherwise.
"""
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
REGISTRY = CONTENT / "registry.js"


def find_matching(s, open_idx):
    open_ch = s[open_idx]
    close_ch = {"[": "]", "{": "}"}[open_ch]
    depth = 0
    i = open_idx
    in_str = False
    quote = ""
    while i < len(s):
        c = s[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                in_str = False
        else:
            if c in ("'", '"', "`"):
                in_str = True
                quote = c
            elif c in "[{":
                depth += 1
            elif c in "]}":
                depth -= 1
                if depth == 0:
                    return i
        i += 1
    raise ValueError("no matching bracket")


def collect_related(src):
    """Yield (ref_path) for every entry inside every `related: [...]` array."""
    refs = []
    for m in re.finditer(r"related:\s*\[", src):
        open_idx = src.index("[", m.start())
        close_idx = find_matching(src, open_idx)
        inner = src[open_idx + 1:close_idx]
        refs.extend(re.findall(r"'([^']+)'", inner))
    return refs


def main():
    errors = []
    src = REGISTRY.read_text(encoding="utf-8")

    # registry topic paths (declaration order, deduped)
    paths = re.findall(r"path:\s*'([^']+)'", src)
    path_set = set(paths)

    # duplicate path detection
    seen = set()
    for p in paths:
        if p in seen:
            errors.append("duplicate registry path: %s" % p)
        seen.add(p)

    # 1 + 2: each path resolves and has EN sibling
    for p in sorted(path_set):
        pt = CONTENT / p / "topic.js"
        en = CONTENT / p / "topic-en.js"
        if not pt.exists():
            errors.append("missing content file: content/%s/topic.js" % p)
        if not en.exists():
            errors.append("missing EN file: content/%s/topic-en.js" % p)

    # 3: related refs resolve
    for ref in collect_related(src):
        if ref not in path_set:
            errors.append("dangling related ref: %s" % ref)

    # 4: orphan folders (any topic.js on disk not referenced by registry)
    disk_paths = set()
    for f in CONTENT.rglob("topic.js"):
        rel = f.parent.relative_to(CONTENT).as_posix()
        disk_paths.add(rel)
    for d in sorted(disk_paths - path_set):
        errors.append("orphan content folder (not in registry): content/%s" % d)

    # 5: correct indices are non-negative ints (cheap; full range check in content linter)
    for f in CONTENT.rglob("topic.js"):
        body = f.read_text(encoding="utf-8")
        for cm in re.finditer(r"correct:\s*([^,\n]+)", body):
            raw = cm.group(1).strip()
            if not re.fullmatch(r"\d+", raw):
                rel = f.parent.relative_to(CONTENT).as_posix()
                errors.append("non-integer correct in content/%s: '%s'" % (rel, raw))

    print("=" * 70)
    print("REGISTRY INTEGRITY REPORT")
    print("=" * 70)
    print("registry paths: %d   |   disk topic folders: %d" % (len(path_set), len(disk_paths)))

    if errors:
        print("\nERRORS (%d):" % len(errors))
        for e in errors:
            print("  x %s" % e)
    else:
        print("\nNo integrity errors. Registry and content tree are consistent. [OK]")

    print("\nSummary: %d error(s)." % len(errors))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
