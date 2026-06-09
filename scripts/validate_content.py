#!/usr/bin/env python3
"""Validate every content/**/topic.js against the platform's content schema.

Enforces the rules the /kubernetes-add-topic skill defines:
  - quiz: >=5 questions; each has question, options (>=2, none empty),
          correct (int within options range), explanation; reference recommended (warning).
  - flashcards: >=6; each has non-empty front and back.
  - lab: present; has duration; steps >=3; each step has title, instruction, verify.
  - troubleshooting: >=2; each has title, difficulty (easy|medium|hard), symptom,
          diagnosis, solution.

Brace/quote-aware parser (handles ', ", ` and escapes) — does NOT eval JS.
PowerShell/Python only — never Node.

Usage:  python scripts/validate_content.py [--warnings]
Exit code: 0 if no errors (warnings allowed), 1 if any error.
"""
import re, sys, glob
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
SHOW_WARNINGS = "--warnings" in sys.argv or "-w" in sys.argv

DIFFICULTIES = {"easy", "medium", "hard"}

# ── thresholds (from the skill spec) ──
MIN_QUIZ = 5
MIN_FLASHCARDS = 6
MIN_LAB_STEPS = 3
MIN_TROUBLESHOOTING = 2


def find_matching(s, open_idx):
    """Index of the bracket/brace matching the one at open_idx, string-aware."""
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
    raise ValueError("no matching bracket from index %d" % open_idx)


def top_level_key_span(body, key):
    """Find `key:` at depth 0 of an object body; return (val_start, val_end_inclusive).

    Value may be an array [...], object {...}, template `...`, or scalar up to comma.
    Returns None if key not present at top level.
    """
    i = 0
    depth = 0
    in_str = False
    quote = ""
    n = len(body)
    pat = re.compile(r"(^|[\s,{])" + re.escape(key) + r"\s*:")
    while i < n:
        c = body[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                in_str = False
            i += 1
            continue
        if c in ("'", '"', "`"):
            in_str = True
            quote = c
            i += 1
            continue
        if c in "[{":
            depth += 1
            i += 1
            continue
        if c in "]}":
            depth -= 1
            i += 1
            continue
        if depth == 0:
            m = pat.match(body, max(0, i - 1))
            if m and body[m.end() - 1] == ":":
                # advance to first non-space after ':'
                j = m.end()
                while j < n and body[j] in " \t\r\n":
                    j += 1
                if j >= n:
                    return None
                if body[j] in "[{":
                    end = find_matching(body, j)
                    return (j, end)
                if body[j] in ("'", '"', "`"):
                    q = body[j]
                    k = j + 1
                    while k < n:
                        if body[k] == "\\":
                            k += 2
                            continue
                        if body[k] == q:
                            break
                        k += 1
                    return (j, k)
                # scalar: read until comma/newline at depth 0
                k = j
                while k < n and body[k] not in ",\n":
                    k += 1
                return (j, k - 1)
        i += 1
    return None


def iter_top_objects(arr_text):
    """arr_text is '[ ... ]'. Yield each top-level { ... } object substring."""
    inner_open = 0
    close = len(arr_text) - 1
    i = inner_open + 1
    in_str = False
    quote = ""
    while i < close:
        c = arr_text[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                in_str = False
            i += 1
            continue
        if c in ("'", '"', "`"):
            in_str = True
            quote = c
        elif c == "{":
            end = find_matching(arr_text, i)
            yield arr_text[i:end + 1]
            i = end + 1
            continue
        i += 1


def field_value(obj_text, key):
    """Return raw value span text for key inside obj_text, or None."""
    body = obj_text[1:-1] if obj_text.startswith("{") else obj_text
    span = top_level_key_span(body, key)
    if not span:
        return None
    return body[span[0]:span[1] + 1]


def is_nonempty_str(val):
    if val is None:
        return False
    v = val.strip()
    if len(v) >= 2 and v[0] in "'\"`" and v[-1] == v[0]:
        return len(v) > 2 and v[1:-1].strip() != ""
    return v not in ("", "''", '""', "``", "[]", "null", "undefined")


def count_array_items(arr_text):
    """Count top-level elements (objects or strings) in an array span."""
    return len(list(iter_top_objects(arr_text))) if arr_text else 0


def validate_topic(path, errors, warnings):
    rel = Path(path).relative_to(ROOT).as_posix()
    src = Path(path).read_text(encoding="utf-8")

    # locate the content object: first '= {' assignment
    m = re.search(r"=\s*\{", src)
    if not m:
        errors.append((rel, "no content object found"))
        return
    obj_open = src.index("{", m.start())
    obj_close = find_matching(src, obj_open)
    body = src[obj_open + 1:obj_close]

    def err(msg):
        errors.append((rel, msg))

    def warn(msg):
        warnings.append((rel, msg))

    # ── quiz ──
    qspan = top_level_key_span(body, "quiz")
    if not qspan:
        err("missing quiz")
    else:
        quiz_text = body[qspan[0]:qspan[1] + 1]
        questions = list(iter_top_objects(quiz_text))
        if len(questions) < MIN_QUIZ:
            err("quiz has %d questions (min %d)" % (len(questions), MIN_QUIZ))
        for idx, q in enumerate(questions):
            if not is_nonempty_str(field_value(q, "question")):
                err("quiz[%d] empty/missing question" % idx)
            opts = field_value(q, "options")
            if not opts or not opts.startswith("["):
                err("quiz[%d] missing options array" % idx)
                opt_count = 0
            else:
                opt_items = list(iter_top_strings(opts))
                opt_count = len(opt_items)
                if opt_count < 2:
                    err("quiz[%d] has <2 options" % idx)
                if any(o.strip() in ("''", '""', "``", "") for o in opt_items):
                    err("quiz[%d] has an empty option" % idx)
            corr = field_value(q, "correct")
            if corr is None:
                err("quiz[%d] missing correct" % idx)
            else:
                try:
                    ci = int(corr.strip())
                    if opt_count and not (0 <= ci < opt_count):
                        err("quiz[%d] correct=%d out of range (0..%d)" % (idx, ci, opt_count - 1))
                except ValueError:
                    err("quiz[%d] correct is not an int" % idx)
            if not is_nonempty_str(field_value(q, "explanation")):
                err("quiz[%d] missing explanation" % idx)
            if not is_nonempty_str(field_value(q, "reference")):
                warn("quiz[%d] missing reference (study hint)" % idx)

    # ── flashcards ──
    fspan = top_level_key_span(body, "flashcards")
    if not fspan:
        err("missing flashcards")
    else:
        fc_text = body[fspan[0]:fspan[1] + 1]
        cards = list(iter_top_objects(fc_text))
        if len(cards) < MIN_FLASHCARDS:
            err("flashcards has %d (min %d)" % (len(cards), MIN_FLASHCARDS))
        for idx, c in enumerate(cards):
            if not is_nonempty_str(field_value(c, "front")):
                err("flashcards[%d] empty front" % idx)
            if not is_nonempty_str(field_value(c, "back")):
                err("flashcards[%d] empty back" % idx)

    # ── lab ──
    lspan = top_level_key_span(body, "lab")
    if not lspan:
        err("missing lab")
    else:
        lab_text = body[lspan[0]:lspan[1] + 1]
        if lab_text.startswith("{"):
            if not is_nonempty_str(field_value(lab_text, "duration")):
                warn("lab missing duration")
            lab_body = lab_text[1:-1]
            sspan = top_level_key_span(lab_body, "steps")
            if not sspan:
                err("lab missing steps")
            else:
                steps_text = lab_body[sspan[0]:sspan[1] + 1]
                steps = list(iter_top_objects(steps_text))
                if len(steps) < MIN_LAB_STEPS:
                    err("lab has %d steps (min %d)" % (len(steps), MIN_LAB_STEPS))
                for idx, st in enumerate(steps):
                    if not is_nonempty_str(field_value(st, "title")):
                        err("lab.step[%d] missing title" % idx)
                    if not is_nonempty_str(field_value(st, "instruction")):
                        err("lab.step[%d] missing instruction" % idx)
                    if not is_nonempty_str(field_value(st, "verify")):
                        err("lab.step[%d] missing verify" % idx)
        else:
            err("lab is not an object")

    # ── troubleshooting ──
    tspan = top_level_key_span(body, "troubleshooting")
    if not tspan:
        err("missing troubleshooting")
    else:
        ts_text = body[tspan[0]:tspan[1] + 1]
        scenarios = list(iter_top_objects(ts_text))
        if len(scenarios) < MIN_TROUBLESHOOTING:
            err("troubleshooting has %d (min %d)" % (len(scenarios), MIN_TROUBLESHOOTING))
        for idx, sc in enumerate(scenarios):
            if not is_nonempty_str(field_value(sc, "title")):
                err("troubleshooting[%d] missing title" % idx)
            diff = field_value(sc, "difficulty")
            dv = (diff or "").strip().strip("'\"`")
            if dv not in DIFFICULTIES:
                err("troubleshooting[%d] difficulty='%s' invalid" % (idx, dv))
            if not is_nonempty_str(field_value(sc, "symptom")):
                err("troubleshooting[%d] missing symptom" % idx)
            if not is_nonempty_str(field_value(sc, "solution")):
                err("troubleshooting[%d] missing solution" % idx)


def iter_top_strings(arr_text):
    """Yield each top-level string literal in an array span '[ ... ]'."""
    i = 1
    close = len(arr_text) - 1
    while i < close:
        c = arr_text[i]
        if c in ("'", '"', "`"):
            q = c
            k = i + 1
            while k < close:
                if arr_text[k] == "\\":
                    k += 2
                    continue
                if arr_text[k] == q:
                    break
                k += 1
            yield arr_text[i:k + 1]
            i = k + 1
            continue
        if c in "[{":
            i = find_matching(arr_text, i) + 1
            continue
        i += 1


def main():
    files = sorted(glob.glob(str(CONTENT / "**" / "topic.js"), recursive=True))
    errors, warnings = [], []
    for f in files:
        try:
            validate_topic(f, errors, warnings)
        except Exception as e:
            errors.append((Path(f).relative_to(ROOT).as_posix(), "PARSE FAILURE: %s" % e))

    print("=" * 70)
    print("CONTENT HEALTH REPORT  —  %d topics scanned" % len(files))
    print("=" * 70)

    if errors:
        print("\nERRORS (%d):" % len(errors))
        by_file = {}
        for rel, msg in errors:
            by_file.setdefault(rel, []).append(msg)
        for rel in sorted(by_file):
            print("  %s" % rel)
            for msg in by_file[rel]:
                print("      x %s" % msg)
    else:
        print("\nNo errors. All topics meet the schema. [OK]")

    if SHOW_WARNINGS and warnings:
        print("\nWARNINGS (%d):" % len(warnings))
        by_file = {}
        for rel, msg in warnings:
            by_file.setdefault(rel, []).append(msg)
        for rel in sorted(by_file):
            print("  %s" % rel)
            for msg in by_file[rel]:
                print("      ! %s" % msg)
    elif warnings:
        print("\n%d warnings (run with --warnings to list)." % len(warnings))

    print("\nSummary: %d error(s), %d warning(s) across %d topics."
          % (len(errors), len(warnings), len(files)))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
