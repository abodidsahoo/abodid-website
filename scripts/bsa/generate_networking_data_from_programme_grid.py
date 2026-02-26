#!/usr/bin/env python3
"""
Generate networking directory data from the first worksheet of the BSA programme grid.

Output JSON structure:
{
  timezone: "Europe/London",
  topics: [
    { id, label, kind, code?, people: [..], count }
  ],
  total_people
}
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

COL_START = "C"
COL_END = "Y"
TIME_RANGE_RE = re.compile(r"^\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})(.*)$", re.S)

TOPIC_LABEL_OVERRIDES = {
    "BSA SPECIAL ACTIVITY": "BSA Special Activity",
    "EARLY CAREER FORUM EVENT": "Early Career Forum Event",
    "MID-CAREER FORUM EVENT": "Mid-Career Forum Event",
    "SOCIOLOGY JOURNAL EVENT": "Sociology Journal Event",
    "SPECIAL EVENT": "Special Event",
}

NON_NAME_TOKENS = {
    "ROUND",
    "TABLE",
    "PRESENTATION",
    "PRESENTATIONS",
    "PAPER",
    "SESSION",
    "SPECIAL",
    "EVENT",
    "STREAM",
    "PLENARY",
    "PLENARIES",
    "PRESIDENTIAL",
    "ADDRESS",
    "REGISTRATION",
    "REFRESHMENTS",
    "LUNCH",
    "RECEPTION",
    "PUBLISHERS",
    "FORUM",
    "SOCIOLOGY",
    "JOURNAL",
    "SOCIAL",
    "ENVIRONMENT",
    "SOCIETY",
    "FAMILIES",
    "RELATIONSHIPS",
    "RACE",
    "ETHNICITY",
    "MIGRATION",
    "SCIENCE",
    "TECHNOLOGY",
    "DIGITAL",
    "STUDIES",
    "THEORY",
    "CULTURE",
    "MEDIA",
    "SPORT",
    "FOOD",
    "WORK",
    "EMPLOYMENT",
    "ECONOMIC",
    "LIFE",
    "RIGHTS",
    "VIOLENCE",
    "CRIME",
    "METHODOLOGICAL",
    "INNOVATIONS",
    "CITIES",
    "MOBILITIES",
    "PLACE",
    "SPACE",
    "EMERGING",
    "THEMES",
    "MEDICINE",
    "HEALTH",
    "ILLNESS",
    "DIVISIONS",
    "IDENTITIES",
    "MONOGRAPH",
    "PUBLISHING",
    "PANEL",
    "EXPLORING",
    "GLOBAL",
    "CHALLENGES",
    "SOLIDARITIES",
    "COMMONALITIES",
    "INTERNATIONAL",
    "UNIVERSITY",
}


def col_to_num(col: str) -> int:
    total = 0
    for ch in col:
        total = total * 26 + (ord(ch) - 64)
    return total


def num_to_col(value: int) -> str:
    out = ""
    n = value
    while n > 0:
        n, rem = divmod(n - 1, 26)
        out = chr(65 + rem) + out
    return out


def iter_cols(start: str, end: str) -> List[str]:
    return [num_to_col(i) for i in range(col_to_num(start), col_to_num(end) + 1)]


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\r", " ").replace("\n", " ")).strip()


def normalize_theme_key(text: str) -> str:
    base = normalize_space(text).lower()
    base = base.replace("&", " and ")
    base = re.sub(r"[^a-z0-9]+", " ", base)
    return re.sub(r"\s+", " ", base).strip()


def parse_shared_strings(archive: zipfile.ZipFile) -> List[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []

    sst = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    values: List[str] = []
    for si in sst.findall("m:si", NS):
        values.append("".join((t.text or "") for t in si.findall(".//m:t", NS)))
    return values


def resolve_first_sheet_target(archive: zipfile.ZipFile) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    sheets = workbook.find("m:sheets", NS)
    first_sheet = list(sheets)[0]
    rel_id = first_sheet.attrib[f"{{{NS['r']}}}id"]

    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    rel_map = {item.attrib["Id"]: item.attrib["Target"] for item in rels}

    target = rel_map[rel_id]
    if not target.startswith("xl/"):
        target = "xl/" + target
    return target.replace("xl/xl/", "xl/")


def read_first_sheet_cells(xlsx_path: Path) -> Dict[int, Dict[str, str]]:
    with zipfile.ZipFile(xlsx_path) as archive:
        shared = parse_shared_strings(archive)
        sheet_target = resolve_first_sheet_target(archive)
        sheet = ET.fromstring(archive.read(sheet_target))

    data: Dict[int, Dict[str, str]] = {}
    sheet_data = sheet.find("m:sheetData", NS)

    for row in sheet_data.findall("m:row", NS):
        row_num = int(row.attrib["r"])
        row_values: Dict[str, str] = {}

        for cell in row.findall("m:c", NS):
            ref = cell.attrib["r"]
            match = re.match(r"([A-Z]+)(\d+)$", ref)
            if not match:
                continue
            col = match.group(1)
            ctype = cell.attrib.get("t")
            v = cell.find("m:v", NS)
            is_node = cell.find("m:is", NS)

            value = ""
            if ctype == "s" and v is not None:
                idx = int(v.text)
                value = shared[idx] if idx < len(shared) else ""
            elif ctype == "inlineStr" and is_node is not None:
                value = "".join((t.text or "") for t in is_node.findall(".//m:t", NS))
            elif v is not None:
                value = v.text or ""

            if value.strip():
                row_values[col] = value.strip()

        if row_values:
            data[row_num] = row_values

    return data


def parse_day_from_label(label: str) -> dt.date:
    match = re.search(
        r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})",
        label,
        flags=re.I,
    )
    if not match:
        raise ValueError(f"Could not parse day label: {label}")

    day = int(match.group(2))
    month_name = match.group(3)
    year = int(match.group(4))

    month = dt.datetime.strptime(month_name[:3], "%b").month
    return dt.date(year, month, day)


def build_day_sections(rows: Dict[int, Dict[str, str]]) -> List[Tuple[int, int, dt.date]]:
    candidates: List[Tuple[int, dt.date]] = []

    for row_num in sorted(rows):
        label = rows[row_num].get("A", "")
        if re.search(r"\bApril\b\s+\d{4}", label, flags=re.I):
            if re.search(r"\b(Wednesday|Thursday|Friday)\b", label, flags=re.I):
                candidates.append((row_num, parse_day_from_label(label)))

    sections: List[Tuple[int, int, dt.date]] = []
    max_row = max(rows)

    for idx, (row_start, day_date) in enumerate(candidates):
        next_start = candidates[idx + 1][0] if idx + 1 < len(candidates) else max_row + 1
        sections.append((row_start, next_start - 1, day_date))

    return sections


def extract_time_block(cell_value: str) -> Optional[Tuple[str, str, Optional[str]]]:
    match = TIME_RANGE_RE.match(cell_value or "")
    if not match:
        return None

    start_time = match.group(1)
    end_time = match.group(2)
    remainder = normalize_space(match.group(3) or "")
    session_block = remainder or None
    return start_time, end_time, session_block


def build_theme_maps(rows: Dict[int, Dict[str, str]]) -> Tuple[Dict[str, str], Dict[str, str]]:
    code_to_name: Dict[str, str] = {}
    name_to_code: Dict[str, str] = {}

    for row_num in [4, 5, 6, 7]:
        row = rows.get(row_num, {})
        for name_col, code_col in [("B", "C"), ("D", "E"), ("F", "G"), ("H", "I")]:
            name = normalize_space(row.get(name_col, ""))
            code = normalize_space(row.get(code_col, "")).upper()
            if not name or not code:
                continue
            if not re.fullmatch(r"[A-Z]{2,6}", code):
                continue
            code_to_name[code] = name
            name_to_code[normalize_theme_key(name)] = code

    return code_to_name, name_to_code


def parse_theme(text: str, name_to_code: Dict[str, str]) -> Tuple[Optional[str], Optional[int]]:
    value = normalize_space(text)
    if not value:
        return None, None

    upper = value.upper()
    known_codes = set(name_to_code.values())

    if re.fullmatch(r"[A-Z]{2,6}\d{0,2}", upper):
        if not (upper in known_codes or re.search(r"\d", upper) or len(upper) <= 4):
            return None, None
        match = re.match(r"^([A-Z]+)(\d+)?$", upper)
        if match:
            code = match.group(1)
            track = int(match.group(2)) if match.group(2) else None
            return code, track

    code = name_to_code.get(normalize_theme_key(value))
    if code:
        return code, None

    return None, None


def build_column_theme_hints(
    rows: Dict[int, Dict[str, str]],
    day_sections: List[Tuple[int, int, dt.date]],
    name_to_code: Dict[str, str],
) -> Dict[str, str]:
    counters: Dict[str, Counter] = defaultdict(Counter)
    columns = iter_cols(COL_START, COL_END)

    for day_start, day_end, _day in day_sections:
        slot_rows = [
            r
            for r in range(day_start, day_end + 1)
            if r in rows and rows[r].get("B") and TIME_RANGE_RE.match(rows[r]["B"])
        ]

        for slot_row in slot_rows:
            slot = extract_time_block(rows[slot_row]["B"])
            if not slot:
                continue
            _start, _end, session_block = slot
            if not session_block or "paper session" not in session_block.lower():
                continue

            for col in columns:
                base_value = rows.get(slot_row, {}).get(col)
                if not base_value:
                    continue
                code, _track = parse_theme(base_value, name_to_code)
                if code:
                    counters[col][code] += 1

    hints: Dict[str, str] = {}
    for col, counter in counters.items():
        hints[col] = counter.most_common(1)[0][0]
    return hints


def looks_like_person_name(text: str) -> bool:
    cleaned = normalize_space(text)
    if not cleaned:
        return False

    if re.search(r"[^A-Za-z'\-\s]", cleaned):
        return False

    tokens = re.findall(r"[A-Za-z][A-Za-z'\-]*", cleaned)
    if not (2 <= len(tokens) <= 5):
        return False

    if any(token.upper() in NON_NAME_TOKENS for token in tokens):
        return False

    if not all(token[0].isupper() for token in tokens):
        return False

    return True


def extract_names_from_cell(value: str) -> List[str]:
    out: List[str] = []
    if not value:
        return out

    lines = [line.strip() for line in value.replace("\r", "").split("\n")]

    for raw_line in lines:
        line = normalize_space(raw_line)
        if not line:
            continue

        lower = line.lower()
        if lower.startswith("chair:"):
            continue

        special_match = re.match(r"^SPECIAL EVENT\*?\s*(.*)$", line, flags=re.I)
        if special_match:
            remainder = normalize_space(special_match.group(1))
            if remainder:
                line = remainder
            else:
                continue

        if "," in line:
            candidate = normalize_space(line.split(",", 1)[0])
            if looks_like_person_name(candidate):
                out.append(candidate)
                continue

        if looks_like_person_name(line):
            out.append(line)

    # stable dedupe while preserving appearance order
    seen = set()
    deduped = []
    for name in out:
        if name in seen:
            continue
        seen.add(name)
        deduped.append(name)
    return deduped


def normalize_topic_label(raw: str) -> str:
    text = normalize_space(raw)
    upper = text.upper()
    if upper in TOPIC_LABEL_OVERRIDES:
        return TOPIC_LABEL_OVERRIDES[upper]
    return text


def topic_from_slot(
    base_value: str,
    session_block: Optional[str],
    name_to_code: Dict[str, str],
    code_to_name: Dict[str, str],
    column_theme_hint: Optional[str],
) -> Optional[Tuple[str, str, str, Optional[str]]]:
    base = normalize_space(base_value)
    if not base:
        return None
    if base.lower() == "leave empty":
        return None

    theme_code, _track = parse_theme(base, name_to_code)
    if theme_code:
        label = code_to_name.get(theme_code, theme_code)
        return (f"theme:{theme_code}", label, "theme", theme_code)

    upper = base.upper()
    if upper.startswith("SPECIAL EVENT"):
        return ("special:special-event", "Special Event", "special", None)

    if upper in TOPIC_LABEL_OVERRIDES:
        label = TOPIC_LABEL_OVERRIDES[upper]
        return (f"special:{label.lower().replace(' ', '-')}", label, "special", None)

    if session_block:
        session = normalize_space(session_block)
        if session.lower() in {"plenary", "stream plenaries", "presidential address"}:
            return (f"session:{session.lower().replace(' ', '-')}", session, "session", None)
        if "round table" in session.lower():
            return ("session:roundtable-presentations", "Roundtable Presentations", "session", None)

    # If cell itself is a presenter's name:
    # map paper-session cells to the dominant theme for that room/column.
    if session_block and looks_like_person_name(base.split(",", 1)[0].strip()):
        if "paper session" in session_block.lower() and column_theme_hint:
            label = code_to_name.get(column_theme_hint, column_theme_hint)
            return (f"theme:{column_theme_hint}", label, "theme", column_theme_hint)
        session = normalize_space(session_block)
        if session:
            return (f"session:{session.lower().replace(' ', '-')}", session, "session", None)

    return None


def add_name(topic_map: Dict[str, Dict[str, object]], topic: Tuple[str, str, str, Optional[str]], name: str) -> None:
    topic_id, label, kind, code = topic
    if topic_id not in topic_map:
        topic_map[topic_id] = {
            "id": topic_id,
            "label": label,
            "kind": kind,
            "code": code,
            "people_set": set(),
        }
    topic_map[topic_id]["people_set"].add(name)


def generate_networking_data(rows: Dict[int, Dict[str, str]]) -> Dict[str, object]:
    code_to_name, name_to_code = build_theme_maps(rows)
    day_sections = build_day_sections(rows)
    columns = iter_cols(COL_START, COL_END)
    column_theme_hints = build_column_theme_hints(rows, day_sections, name_to_code)

    topic_map: Dict[str, Dict[str, object]] = {}

    for day_start, day_end, _day in day_sections:
        slot_rows = [
            r
            for r in range(day_start, day_end + 1)
            if r in rows and rows[r].get("B") and TIME_RANGE_RE.match(rows[r]["B"])
        ]

        for idx, slot_row in enumerate(slot_rows):
            next_slot = slot_rows[idx + 1] if idx + 1 < len(slot_rows) else day_end + 1
            slot = extract_time_block(rows[slot_row]["B"])
            if not slot:
                continue
            _start, _end, session_block = slot

            for col in columns:
                base_value = rows.get(slot_row, {}).get(col)
                if not base_value:
                    continue

                topic = topic_from_slot(
                    base_value,
                    session_block,
                    name_to_code,
                    code_to_name,
                    column_theme_hints.get(col),
                )
                if not topic:
                    continue

                names: List[str] = []
                names.extend(extract_names_from_cell(base_value))
                for detail_row in range(slot_row + 1, next_slot):
                    detail_value = rows.get(detail_row, {}).get(col)
                    if detail_value:
                        names.extend(extract_names_from_cell(detail_value))

                for name in names:
                    add_name(topic_map, topic, name)

    # Add dedicated roundtable table (rows 125-132).
    row126 = rows.get(126, {})
    row127 = rows.get(127, {})
    if row126 and row127:
        for col in ["D", "E", "F", "G"]:
            table_name = normalize_space(row126.get(col, ""))
            stream_code = normalize_space(row127.get(col, "")).upper()
            if not table_name or not stream_code:
                continue

            theme_code, _track = parse_theme(stream_code, name_to_code)
            if theme_code:
                topic = (
                    f"theme:{theme_code}",
                    code_to_name.get(theme_code, theme_code),
                    "theme",
                    theme_code,
                )
            else:
                topic = (
                    "session:roundtable-presentations",
                    "Roundtable Presentations",
                    "session",
                    None,
                )

            for row_num in [128, 129, 130, 131]:
                cell_value = rows.get(row_num, {}).get(col)
                if not cell_value:
                    continue
                for name in extract_names_from_cell(cell_value):
                    add_name(topic_map, topic, name)

    topics: List[Dict[str, object]] = []
    all_people: Set[str] = set()

    for topic_id, payload in topic_map.items():
        people_sorted = sorted(payload["people_set"], key=lambda item: item.casefold())
        if not people_sorted:
            continue

        for name in people_sorted:
            all_people.add(name)

        topic_obj = {
            "id": payload["id"],
            "label": payload["label"],
            "kind": payload["kind"],
            "people": people_sorted,
            "count": len(people_sorted),
        }
        if payload.get("code"):
            topic_obj["code"] = payload["code"]

        topics.append(topic_obj)

    topics.sort(key=lambda item: (item["label"].casefold(), item["id"]))

    return {
        "timezone": "Europe/London",
        "location": "Manchester",
        "generated_from": "Programme grid 2026 v4 - view only.xlsx (first worksheet)",
        "generated_at": dt.datetime.now(dt.UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "topics": topics,
        "topic_count": len(topics),
        "total_people": len(all_people),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate networking JSON from programme XLSX")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("/Users/abodid/Downloads/Programme grid 2026 v4 - view only.xlsx"),
        help="Path to source XLSX",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("src/data/bsa-networking.json"),
        help="Output JSON path",
    )
    args = parser.parse_args()

    rows = read_first_sheet_cells(args.input)
    payload = generate_networking_data(rows)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Generated topics: {payload['topic_count']}")
    print(f"Total unique people: {payload['total_people']}")
    print(f"Wrote: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
