#!/usr/bin/env python3
"""
Generate BSA schedule seed SQL from the first worksheet of the programme grid XLSX.

- Parses worksheet XML directly (no third-party dependencies).
- Builds events by day/time/room from the timetable grid.
- Removes speaker-name-only lines from title_display.
- Keeps all time handling in Manchester time (Europe/London).
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

COL_START = "C"
COL_END = "Y"
TIME_RANGE_RE = re.compile(r"^\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})(.*)$", re.S)

GENERIC_LABELS = {
    "BSA SPECIAL ACTIVITY",
    "EARLY CAREER FORUM EVENT",
    "MID-CAREER FORUM EVENT",
    "SOCIOLOGY JOURNAL EVENT",
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
    "CITY",
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
    "LIFECOURSE",
}


@dataclass
class DaySection:
    row_start: int
    row_end: int
    day: dt.date
    day_label: str
    room_row: int


@dataclass
class EventRow:
    day: dt.date
    start_time: str
    end_time: str
    session_block: Optional[str]
    kind: str
    theme_code: Optional[str]
    track: Optional[int]
    room_name: Optional[str]
    title_raw: str
    title_display: str
    sort_order: Optional[int]


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


def build_day_sections(rows: Dict[int, Dict[str, str]]) -> List[DaySection]:
    candidates: List[Tuple[int, dt.date, str]] = []

    for row_num in sorted(rows):
        label = rows[row_num].get("A", "")
        if re.search(r"\bApril\b\s+\d{4}", label, flags=re.I):
            if re.search(r"\b(Wednesday|Thursday|Friday)\b", label, flags=re.I):
                candidates.append((row_num, parse_day_from_label(label), label))

    sections: List[DaySection] = []
    max_row = max(rows)

    for idx, (row_num, day_date, day_label) in enumerate(candidates):
        next_start = candidates[idx + 1][0] if idx + 1 < len(candidates) else max_row + 1
        row_end = next_start - 1

        room_row = row_num
        if not rows.get(room_row, {}).get("C"):
            for probe in range(row_num - 2, row_num + 3):
                if rows.get(probe, {}).get("C") and rows.get(probe, {}).get("D"):
                    room_row = probe
                    break

        sections.append(
            DaySection(
                row_start=row_num,
                row_end=row_end,
                day=day_date,
                day_label=day_label,
                room_row=room_row,
            )
        )

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


def parse_theme_and_track(
    text: str,
    theme_name_to_code: Dict[str, str],
) -> Tuple[Optional[str], Optional[int]]:
    value = normalize_space(text)
    if not value:
        return None, None

    upper = value.upper()
    known_codes = set(theme_name_to_code.values())
    if re.fullmatch(r"[A-Z]{2,6}\d{0,2}", upper):
        # Guard against generic words (e.g. LUNCH) being misread as theme codes.
        # Accept if this is a known code, has an explicit numeric track suffix,
        # or is a short code token (<=4 chars like STS/MED/WEEL is handled below).
        if not (upper in known_codes or re.search(r"\d", upper) or len(upper) <= 4):
            return None, None
        match = re.match(r"^([A-Z]+)(\d+)?$", upper)
        if match:
            code = match.group(1)
            track = int(match.group(2)) if match.group(2) else None
            return code, track

    lookup = theme_name_to_code.get(normalize_theme_key(value))
    if lookup:
        return lookup, None

    return None, None


def looks_like_person_name(line: str) -> bool:
    cleaned = normalize_space(line)
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


def is_speaker_line(line: str) -> bool:
    raw = normalize_space(line)
    if not raw:
        return False

    lowered = raw.lower()
    if lowered.startswith("chair:"):
        return True
    if lowered.startswith("speaker:") or lowered.startswith("speakers:"):
        return True
    if lowered.startswith("presenter:") or lowered.startswith("presenters:"):
        return True
    if lowered.startswith("moderator:") or lowered.startswith("discussant:"):
        return True
    if re.match(r"^(dr|prof|mr|mrs|ms)\.?\s+", raw, flags=re.I):
        return True

    if "," in raw:
        first = raw.split(",", 1)[0].strip()
        if looks_like_person_name(first):
            return True

    return looks_like_person_name(raw)


def clean_title_display(text: str) -> str:
    lines = [normalize_space(line) for line in (text or "").splitlines() if normalize_space(line)]
    if not lines:
        return ""

    kept: List[str] = []
    for line in lines:
        special_match = re.match(r"^(SPECIAL EVENT\*?)(?:\b.*)?$", line, flags=re.I)
        if special_match:
            special_label = special_match.group(1).upper()
            kept.append(special_label)
            continue
        if line.lower().startswith("chair:"):
            continue
        if is_speaker_line(line) and not line.upper().startswith("SPECIAL EVENT"):
            continue
        kept.append(line)

    if not kept:
        return ""

    return " / ".join(kept)


def classify_kind(session_block: Optional[str], title: str, raw: str) -> str:
    text = f"{session_block or ''} {title} {raw}".lower()

    if any(token in text for token in ["refreshment", "lunch", "coffee", "break"]):
        return "break"

    if any(
        token in text
        for token in [
            "registration",
            "plenary",
            "presidential address",
            "reception",
            "social",
            "special activity",
            "special event",
            "forum event",
            "journal event",
            "publishers",
        ]
    ):
        return "special"

    return "session"


def choose_title_raw(base_raw: str, detail_values: List[str]) -> str:
    cleaned_details = [normalize_space(item) for item in detail_values if normalize_space(item)]

    # Explicit special-event override in detail rows.
    for detail in cleaned_details:
        if "SPECIAL EVENT" in detail.upper():
            return detail

    base_upper = normalize_space(base_raw).upper()
    if base_upper in GENERIC_LABELS:
        for detail in cleaned_details:
            if is_speaker_line(detail):
                continue
            if detail.lower().startswith("chair:"):
                continue
            return detail

    # For stream codes, keep stream label unless detail is clearly a non-person special label.
    if re.fullmatch(r"[A-Z]{2,6}\d{0,2}", normalize_space(base_raw).upper()):
        for detail in cleaned_details:
            low = detail.lower()
            if is_speaker_line(detail):
                continue
            if any(token in low for token in ["special event", "forum", "publishing", "panel"]):
                return detail

    return base_raw


def escape_sql(value: str) -> str:
    return value.replace("'", "''")


def london_timestamptz(date_value: dt.date, hhmm: str) -> str:
    hour, minute = hhmm.split(":")
    return f"'{date_value.isoformat()} {int(hour):02d}:{int(minute):02d}:00 Europe/London'::timestamptz"


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


def build_column_theme_hints(
    rows: Dict[int, Dict[str, str]],
    sections: List[DaySection],
    name_to_code: Dict[str, str],
) -> Dict[str, str]:
    counters: Dict[str, Counter] = defaultdict(Counter)
    columns = iter_cols(COL_START, COL_END)

    for section in sections:
        slot_rows = [
            r
            for r in range(section.row_start, section.row_end + 1)
            if r in rows and rows[r].get("B") and TIME_RANGE_RE.match(rows[r]["B"])
        ]
        for slot_row in slot_rows:
            block = extract_time_block(rows[slot_row]["B"])
            if not block:
                continue
            _start, _end, session_block = block
            if not session_block or "paper session" not in session_block.lower():
                continue

            row = rows.get(slot_row, {})
            for col in columns:
                raw = row.get(col)
                if not raw:
                    continue
                theme_code, _track = parse_theme_and_track(raw, name_to_code)
                if theme_code:
                    counters[col][theme_code] += 1

    hints: Dict[str, str] = {}
    for col, counter in counters.items():
        hints[col] = counter.most_common(1)[0][0]
    return hints


def generate_events(rows: Dict[int, Dict[str, str]]) -> Tuple[List[EventRow], Dict[str, str], Dict[str, str], Dict[dt.date, str]]:
    code_to_name, name_to_code = build_theme_maps(rows)
    sections = build_day_sections(rows)
    columns = iter_cols(COL_START, COL_END)
    col_index = {col: idx for idx, col in enumerate(columns, start=1)}

    day_label_map: Dict[dt.date, str] = {}
    room_names: Dict[str, str] = {}

    for section in sections:
        day_label_map[section.day] = section.day.strftime("%a %-d %b")
        room_row = rows.get(section.room_row, {})
        for col in columns:
            room = normalize_space(room_row.get(col, ""))
            if room:
                room_names[col] = room

    theme_hints = build_column_theme_hints(rows, sections, name_to_code)

    all_events: List[EventRow] = []

    for section in sections:
        slot_rows = [
            r
            for r in range(section.row_start, section.row_end + 1)
            if r in rows and rows[r].get("B") and TIME_RANGE_RE.match(rows[r]["B"])
        ]

        for idx, slot_row in enumerate(slot_rows):
            next_slot_row = slot_rows[idx + 1] if idx + 1 < len(slot_rows) else section.row_end + 1
            slot = extract_time_block(rows[slot_row]["B"])
            if not slot:
                continue

            start_time, end_time, session_block = slot
            slot_cells = rows.get(slot_row, {})

            for col in columns:
                base_raw = slot_cells.get(col)
                if not base_raw:
                    continue
                if normalize_space(base_raw).lower() == "leave empty":
                    continue

                room_name = room_names.get(col)
                if not room_name:
                    continue

                detail_values = [rows.get(r, {}).get(col, "") for r in range(slot_row + 1, next_slot_row)]
                chosen_raw = choose_title_raw(base_raw, detail_values)

                title_display = clean_title_display(chosen_raw)
                if not title_display and session_block:
                    title_display = clean_title_display(session_block)
                if not title_display:
                    title_display = "Conference Session"

                theme_code, track = parse_theme_and_track(base_raw, name_to_code)
                if not theme_code:
                    theme_code, track = parse_theme_and_track(chosen_raw, name_to_code)
                if not theme_code and session_block and "paper session" in session_block.lower():
                    hint_code = theme_hints.get(col)
                    if hint_code:
                        theme_code = hint_code

                kind = classify_kind(session_block, title_display, chosen_raw)

                all_events.append(
                    EventRow(
                        day=section.day,
                        start_time=start_time,
                        end_time=end_time,
                        session_block=session_block,
                        kind=kind,
                        theme_code=theme_code,
                        track=track,
                        room_name=room_name,
                        title_raw=normalize_space(chosen_raw),
                        title_display=title_display,
                        sort_order=col_index[col] * 10,
                    )
                )

    # Extra roundtable block from the lower table (first-sheet addendum).
    row125 = rows.get(125, {})
    row126 = rows.get(126, {})
    row127 = rows.get(127, {})
    note = row125.get("B", "")
    note_match = re.search(r"(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})", note)
    if note_match and row126 and row127:
        round_start, round_end = note_match.group(1), note_match.group(2)
        friday = dt.date(2026, 4, 10)
        for col in ["D", "E", "F", "G"]:
            table_name = normalize_space(row126.get(col, ""))
            stream_code = normalize_space(row127.get(col, "")).upper()
            if not table_name or not stream_code:
                continue

            room_name = f"Market Place Restaurant - {table_name}"
            theme_code, track = parse_theme_and_track(stream_code, name_to_code)
            all_events.append(
                EventRow(
                    day=friday,
                    start_time=round_start,
                    end_time=round_end,
                    session_block="Roundtable Presentations",
                    kind="session",
                    theme_code=theme_code,
                    track=track,
                    room_name=room_name,
                    title_raw="Roundtable Presentations",
                    title_display="Roundtable Presentations",
                    sort_order=400 + (ord(col) - ord("D")) * 10,
                )
            )

    # Deduplicate obvious print-layout duplicates by content signature.
    deduped: List[EventRow] = []
    seen = set()
    for event in sorted(
        all_events,
        key=lambda e: (e.day, e.start_time, e.end_time, e.sort_order or 9999, e.room_name or ""),
    ):
        signature = (
            event.day,
            event.start_time,
            event.end_time,
            event.session_block or "",
            event.title_display,
            event.kind,
            event.theme_code or "",
        )
        if signature in seen:
            continue
        seen.add(signature)
        deduped.append(event)

    return deduped, code_to_name, name_to_code, day_label_map


def to_sql(
    events: List[EventRow],
    code_to_name: Dict[str, str],
    day_labels: Dict[dt.date, str],
) -> str:
    used_days = sorted({event.day for event in events})
    used_themes = sorted({event.theme_code for event in events if event.theme_code})
    used_rooms = sorted({event.room_name for event in events if event.room_name})

    lines: List[str] = []
    lines.append("-- Generated from: Programme grid 2026 v4 - view only.xlsx (first worksheet)")
    lines.append("-- Timezone: Manchester (Europe/London)")
    lines.append("")
    lines.append("begin;")
    lines.append("")

    lines.append("insert into public.conference_days (day, label)")
    lines.append("values")
    day_values = []
    for day in used_days:
        label = day_labels.get(day, day.strftime("%a %-d %b"))
        day_values.append(f"  ('{day.isoformat()}', '{escape_sql(label)}')")
    lines.append(",\n".join(day_values))
    lines.append("on conflict (day) do update")
    lines.append("set label = excluded.label;")
    lines.append("")

    lines.append("insert into public.themes (code, name)")
    lines.append("values")
    theme_values = []
    for code in used_themes:
        name = code_to_name.get(code, code)
        theme_values.append(f"  ('{escape_sql(code)}', '{escape_sql(name)}')")
    lines.append(",\n".join(theme_values))
    lines.append("on conflict (code) do update")
    lines.append("set name = excluded.name;")
    lines.append("")

    lines.append("insert into public.rooms (name)")
    lines.append("values")
    room_values = [f"  ('{escape_sql(room)}')" for room in used_rooms]
    lines.append(",\n".join(room_values))
    lines.append("on conflict (name) do nothing;")
    lines.append("")

    day_list = ", ".join(f"'{day.isoformat()}'" for day in used_days)
    lines.append(f"delete from public.events where day in ({day_list});")
    lines.append("")

    lines.append(
        "insert into public.events (day, start_at, end_at, session_block, kind, theme_code, track, room_id, title_raw, title_display, sort_order)"
    )
    lines.append("values")

    event_values = []
    for event in events:
        session_block_sql = (
            f"'{escape_sql(event.session_block)}'" if event.session_block else "null"
        )
        theme_sql = f"'{escape_sql(event.theme_code)}'" if event.theme_code else "null"
        track_sql = str(event.track) if event.track is not None else "null"
        sort_sql = str(event.sort_order) if event.sort_order is not None else "null"
        room_sql = (
            f"(select id from public.rooms where name = '{escape_sql(event.room_name)}')"
            if event.room_name
            else "null"
        )

        event_values.append(
            "  (\n"
            f"    '{event.day.isoformat()}',\n"
            f"    {london_timestamptz(event.day, event.start_time)},\n"
            f"    {london_timestamptz(event.day, event.end_time)},\n"
            f"    {session_block_sql},\n"
            f"    '{event.kind}',\n"
            f"    {theme_sql},\n"
            f"    {track_sql},\n"
            f"    {room_sql},\n"
            f"    '{escape_sql(event.title_raw)}',\n"
            f"    '{escape_sql(event.title_display)}',\n"
            f"    {sort_sql}\n"
            "  )"
        )

    lines.append(",\n".join(event_values))
    lines.append(";")
    lines.append("")
    lines.append("commit;")

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate BSA seed SQL from programme XLSX")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("/Users/abodid/Downloads/Programme grid 2026 v4 - view only.xlsx"),
        help="Path to source XLSX",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("sql/bsa-schedule/seed/seed_2026-04-08_to_2026-04-10_from_programme_grid.sql"),
        help="Output SQL file",
    )
    args = parser.parse_args()

    rows = read_first_sheet_cells(args.input)
    events, code_to_name, _name_to_code, day_labels = generate_events(rows)

    sql = to_sql(events, code_to_name, day_labels)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(sql, encoding="utf-8")

    print(f"Generated {len(events)} events")
    print(f"Wrote: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
