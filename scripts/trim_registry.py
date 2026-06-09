#!/usr/bin/env python3
"""Trim content/registry.js for the min_version branch.

- Removes certifications / skillTracks whose id is in the remove sets.
- Removes domain blocks whose cert/track references a removed id.
- Prunes dangling `related: [...]` entries that point to removed topics.
Brace/bracket aware (respects single-quoted strings). PowerShell/Python only — never Node.
"""
import re, sys, io

PATH = "content/registry.js"

REMOVE_CERTS = {"cks", "kcsa", "aws-sap", "az-305"}
REMOVE_TRACKS = {
    "argocd", "security-tooling", "otel", "chaos-eng", "crossplane", "kyverno",
    "fluxcd", "kong", "cicd", "loki", "keda", "finops", "databases-k8s",
}
REMOVE_IDS = REMOVE_CERTS | REMOVE_TRACKS

with io.open(PATH, "r", encoding="utf-8") as f:
    src = f.read()


def find_matching(s, open_idx):
    """Return index of the bracket/brace matching the one at open_idx, string-aware."""
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


def array_span(s, key):
    """Return (start_of_[, end_of_]) for `key: [ ... ]`."""
    m = re.search(key + r"\s*:\s*\[", s)
    if not m:
        raise ValueError("key not found: " + key)
    open_idx = s.index("[", m.start())
    close_idx = find_matching(s, open_idx)
    return open_idx, close_idx


def top_objects(s, arr_open, arr_close):
    """Yield (obj_start, obj_end_inclusive) for each top-level { } object in array body."""
    i = arr_open + 1
    in_str = False
    quote = ""
    while i < arr_close:
        c = s[i]
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
            end = find_matching(s, i)
            yield (i, end)
            i = end + 1
            continue
        i += 1


def filter_array(s, key, remove_predicate):
    """Remove top-level objects from an array where remove_predicate(obj_text) is True."""
    arr_open, arr_close = array_span(s, key)
    objs = list(top_objects(s, arr_open, arr_close))
    # process right-to-left so indices stay valid
    for (o_start, o_end) in reversed(objs):
        obj_text = s[o_start:o_end + 1]
        if remove_predicate(obj_text):
            # extend end to swallow trailing comma + following whitespace/newline
            j = o_end + 1
            while j < len(s) and s[j] in " \t":
                j += 1
            if j < len(s) and s[j] == ",":
                j += 1
            # swallow trailing spaces and a single newline + indentation up to next token
            k = j
            while k < len(s) and s[k] in " \t":
                k += 1
            if k < len(s) and s[k] == "\n":
                k += 1
            # also drop a leading comment line immediately above (// ...) belonging to this obj
            start = o_start
            line_start = s.rfind("\n", 0, o_start) + 1
            prefix = s[line_start:o_start]
            # walk upward over consecutive comment lines (// ...) that decorate this block
            cur = line_start
            while True:
                prev_nl = s.rfind("\n", 0, cur - 1)
                prev_line_start = prev_nl + 1
                line = s[prev_line_start:cur - 1] if cur > 0 else ""
                if line.strip().startswith("//"):
                    cur = prev_line_start
                else:
                    break
            start = cur
            s = s[:start] + s[k:]
    return s


def id_in(obj_text, idset):
    m = re.search(r"id:\s*'([^']+)'", obj_text)
    return bool(m and m.group(1) in idset)


def refs_removed(obj_text):
    cm = re.search(r"cert:\s*\[([^\]]*)\]", obj_text)
    tm = re.search(r"track:\s*\[([^\]]*)\]", obj_text)
    ids = []
    for mm in (cm, tm):
        if mm:
            ids += re.findall(r"'([^']+)'", mm.group(1))
    return any(x in REMOVE_IDS for x in ids)


# 1) certifications
s = filter_array(src, "certifications", lambda o: id_in(o, REMOVE_CERTS))
# 2) skillTracks
s = filter_array(s, "skillTracks", lambda o: id_in(o, REMOVE_TRACKS))
# 3) domains
s = filter_array(s, "domains", refs_removed)

# 4) collect surviving topic paths
survive = set(re.findall(r"path:\s*'([^']+)'", s))

# 5) prune dangling related entries
def prune_related(m):
    inner = m.group(1)
    paths = re.findall(r"'([^']+)'", inner)
    kept = [p for p in paths if p in survive]
    if not kept:
        return ""  # drop whole related: [...]
    return "related: [" + ", ".join("'" + p + "'" for p in kept) + "]"

# related: [ ... ] then optional trailing comma/space cleanup
def related_repl(s):
    out = []
    i = 0
    pat = re.compile(r"related:\s*\[")
    while True:
        m = pat.search(s, i)
        if not m:
            out.append(s[i:])
            break
        out.append(s[i:m.start()])
        open_idx = s.index("[", m.start())
        close_idx = find_matching(s, open_idx)
        inner = s[open_idx + 1:close_idx]
        paths = re.findall(r"'([^']+)'", inner)
        kept = [p for p in paths if p in survive]
        after = close_idx + 1
        if kept:
            out.append("related: [" + ", ".join("'" + p + "'" for p in kept) + "]")
            i = after
        else:
            # drop the property; also remove a preceding ", " if present
            tail = out[-1]
            stripped = re.sub(r",\s*$", "", tail)
            out[-1] = stripped
            # skip a following ", " after the removed related
            j = after
            while j < len(s) and s[j] in " \t":
                j += 1
            if j < len(s) and s[j] == ",":
                j += 1
            i = j
    return "".join(out)

s = related_repl(s)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(s)

# report
cert_ct = len(re.findall(r"id:\s*'[^']+',\s*\n?\s*name", s))
print("domains remaining:", len(list(re.finditer(r"\btype:\s*'(cert|skill)'", s))))
print("certifications remaining:", len(re.findall(r"passScore:", s)))
print("skillTracks remaining:", len(re.findall(r"icon:\s*'[^']*',\s*$", s, re.M)))
print("topics remaining:", len(survive))
print("OK")
