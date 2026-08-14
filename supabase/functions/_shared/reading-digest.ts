export type DigestCandidate = {
  title: string;
  source_name: string;
  publication_date: string;
  estimated_reading_minutes: number;
  url: string;
  why_it_matters: string;
  topic_names: string[];
  relevance_score: number;
  credibility_score: number;
  is_foundational?: boolean;
};

export type VerifiedDigestCandidate = DigestCandidate & {
  canonical_url: string;
  source_domain: string;
  normalized_title: string;
  rank_score: number;
  verification_status: "verified";
  http_status: number;
  content_type: string;
};

export const discoveryTooling = (provider: "openai" | "openrouter") =>
  provider === "openrouter"
    ? {
      tools: [{
        type: "openrouter:web_search",
        parameters: {
          engine: "auto",
          max_results: 8,
          max_total_results: 24,
          max_uses: 4,
          search_context_size: "low",
        },
      }],
      tool_choice: "auto",
      max_tool_calls: 6,
    }
    : {
      tools: [{ type: "web_search", search_context_size: "medium" }],
      tool_choice: "auto",
      max_tool_calls: 24,
    };

const escapeControlCharactersInJsonStrings = (value: string): string => {
  let result = "";
  let insideString = false;
  let escaped = false;

  for (const character of value) {
    if (!insideString) {
      result += character;
      if (character === '"') insideString = true;
      continue;
    }

    if (character === '"' && !escaped) {
      insideString = false;
      result += character;
      continue;
    }

    if (character === "\\" && !escaped) {
      escaped = true;
      result += character;
      continue;
    }

    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x1f) {
      const escape = character === "\b"
        ? "b"
        : character === "\t"
        ? "t"
        : character === "\n"
        ? "n"
        : character === "\f"
        ? "f"
        : character === "\r"
        ? "r"
        : `u${codePoint.toString(16).padStart(4, "0")}`;
      result += escaped ? escape : `\\${escape}`;
      escaped = false;
      continue;
    }

    result += character;
    escaped = false;
  }

  return result;
};

export const cleanJsonText = (raw: string): string => {
  if (!raw) return "";
  let text = raw.trim();

  if (text.includes("```")) {
    text = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  const firstBrace = text.search(/[\{\[]/);
  const lastBrace = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  // Models occasionally emit literal newlines, tabs, or other control
  // characters inside quoted values. JSON requires those characters to be
  // escaped, so repair only string contents while preserving valid whitespace.
  text = escapeControlCharactersInJsonStrings(text);

  // Remove single line comments and block comments
  text = text.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "$1");

  // Remove trailing commas before closing braces/brackets
  text = text.replace(/,\s*([}\]])/g, "$1");

  return text;
};

export const normalizeCandidates = (parsed: unknown): DigestCandidate[] => {
  if (!parsed || typeof parsed !== "object") return [];

  let rawList: unknown[] = [];
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.candidates)) rawList = obj.candidates;
    else if (Array.isArray(obj.results)) rawList = obj.results;
    else if (Array.isArray(obj.sources)) rawList = obj.sources;
    else if (Array.isArray(obj.articles)) rawList = obj.articles;
    else if (Array.isArray(obj.items)) rawList = obj.items;
    else if (Array.isArray(obj.readings)) rawList = obj.readings;
  }

  return rawList
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const title = String(row.title ?? row.name ?? "").trim();
      const url = String(row.url ?? row.link ?? row.canonical_url ?? "").trim();
      if (!title || !url) return null;

      const source_name =
        String(row.source_name ?? row.source ?? row.author ?? row.publisher ?? "").trim() ||
        domainFromUrl(url) ||
        "Web Source";
      const publication_date = isIsoDate(String(row.publication_date ?? row.date ?? ""))
        ? String(row.publication_date ?? row.date)
        : new Date().toISOString().slice(0, 10);
      const estimated_reading_minutes = Math.max(
        1,
        Math.min(180, Number(row.estimated_reading_minutes ?? row.reading_time ?? row.read_time ?? 5) || 5),
      );
      const why_it_matters = limitWords(
        String(row.why_it_matters ?? row.excerpt ?? row.summary ?? row.description ?? title),
      );
      const topic_names = Array.isArray(row.topic_names)
        ? (row.topic_names as unknown[]).map(String).filter(Boolean)
        : Array.isArray(row.topics)
        ? (row.topics as unknown[]).map(String).filter(Boolean)
        : ["General"];

      const relevance_score = Math.max(
        0,
        Math.min(100, Number(row.relevance_score ?? row.score ?? 75) || 75),
      );
      const credibility_score = Math.max(
        0,
        Math.min(100, Number(row.credibility_score ?? row.credibility ?? 80) || 80),
      );

      return {
        title,
        source_name,
        publication_date,
        estimated_reading_minutes,
        url,
        why_it_matters,
        topic_names: topic_names.length > 0 ? topic_names : ["General"],
        relevance_score,
        credibility_score,
      } as DigestCandidate;
    })
    .filter((candidate): candidate is DigestCandidate => candidate !== null);
};

const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
  "source",
]);

export const canonicalizeUrl = (input: string): string | null => {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;

    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.protocol = "https:";

    for (const key of [...url.searchParams.keys()]) {
      if (
        key.toLowerCase().startsWith("utm_") ||
        TRACKING_PARAMETERS.has(key.toLowerCase())
      ) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();

    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    return url.toString();
  } catch {
    return null;
  }
};

export const domainFromUrl = (input: string): string => {
  try {
    return new URL(input).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};

export const domainMatches = (
  domain: string,
  configuredDomain: string,
): boolean => {
  const left = domain.toLowerCase().replace(/^www\./, "");
  const right = configuredDomain.toLowerCase().replace(/^www\./, "");
  return left === right || left.endsWith(`.${right}`);
};

export const normalizeTitle = (title: string): string =>
  title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\b([a-z])\.([a-z])\./g, "$1$2")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenSet = (value: string) =>
  new Set(normalizeTitle(value).split(" ").filter(Boolean));

export const titleSimilarity = (a: string, b: string): number => {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / new Set([...left, ...right]).size;
};

export const wordCount = (value: string): number =>
  value.trim().split(/\s+/).filter(Boolean).length;

export const limitWords = (value: string, maximum = 20): string => {
  const sentence = value.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] ??
    "";
  const words = sentence.split(/\s+/).filter(Boolean).slice(0, maximum);
  if (!words.length) {
    return "Connects directly to Abodid's research and creative practice.";
  }
  const joined = words.join(" ").replace(/[,:;\-]+$/, "");
  return /[.!?]$/.test(joined) ? joined : `${joined}.`;
};

export const isIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
};

export const isRecentPublication = (
  publicationDate: string,
  now = new Date(),
): boolean => {
  const date = new Date(`${publicationDate}T00:00:00Z`);
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 18);
  return date >= cutoff;
};

export const filterTopicsForDay = <T extends { name: string }>(
  topics: T[],
  now = new Date(),
): T[] => {
  if (topics.length <= 1) return topics;
  const dayOfWeek = now.getUTCDay();
  const buckets = Math.min(topics.length, 7);
  const dayIndex = dayOfWeek % buckets;
  const filtered = topics.filter((_, index) => index % buckets === dayIndex);
  return filtered.length > 0 ? filtered : topics;
};

export const scoreCandidate = ({
  candidate,
  trusted,
  sourcePreference = 0,
  now = new Date(),
}: {
  candidate: DigestCandidate;
  trusted: boolean;
  sourcePreference?: number;
  now?: Date;
}): number => {
  const relevance = Math.max(
    0,
    Math.min(100, Number(candidate.relevance_score) || 0),
  );
  const credibility = Math.max(
    0,
    Math.min(100, Number(candidate.credibility_score) || 0),
  );
  const recent = isRecentPublication(candidate.publication_date, now)
    ? 100
    : 55;
  const trust = trusted ? 100 : 60;
  return Number(
    (relevance * 0.55 + credibility * 0.25 + recent * 0.12 + trust * 0.08 +
      sourcePreference).toFixed(2),
  );
};

export const selectExactlyFive = (
  candidates: VerifiedDigestCandidate[],
  _now = new Date(),
): VerifiedDigestCandidate[] => {
  const ranked = [...candidates].sort((a, b) => b.rank_score - a.rank_score);
  const selected: VerifiedDigestCandidate[] = [];
  const domainCounts = new Map<string, number>();

  // Pass 1: Enforce domain diversity (max 2 articles per domain)
  for (const candidate of ranked) {
    if (selected.length === 5) break;
    const domain = candidate.source_domain || domainFromUrl(candidate.canonical_url);
    const count = domainCounts.get(domain) ?? 0;
    if (count < 2 && !selected.some((item) => item.canonical_url === candidate.canonical_url)) {
      selected.push(candidate);
      domainCounts.set(domain, count + 1);
    }
  }

  // Pass 2: Fill remaining slots if fewer than 5 unique domains exist
  if (selected.length < 5) {
    for (const candidate of ranked) {
      if (selected.length === 5) break;
      if (!selected.some((item) => item.canonical_url === candidate.canonical_url)) {
        selected.push(candidate);
      }
    }
  }

  return selected;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const ordinalSuffix = (n: number): string => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  switch (v % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
};

const humanDateLong = (value: string): string => {
  const d = new Date(`${value}T00:00:00Z`);
  const day = d.getUTCDate();
  const month = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    timeZone: "UTC",
  }).format(d);
  const year = d.getUTCFullYear();
  return `${day}${ordinalSuffix(day)} ${month}, ${year}`;
};

const weekdayName = (value: string): string =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));

/** Subject line: "Abodid's Daily Reading - 4th August, 2026" */
export const digestSubject = (
  recipientName: string,
  digestDate: string,
): string => `${recipientName}'s Daily Reading - ${humanDateLong(digestDate)}`;

export const renderDigestHtml = ({
  items,
  recipientName,
  digestDate,
  isTest = false,
}: {
  items: VerifiedDigestCandidate[];
  recipientName: string;
  digestDate: string;
  isTest?: boolean;
}): string => {
  if (items.length < 1) {
    throw new Error("A digest must contain at least one reading.");
  }

  const readFirst = items[0];
  // "Abodid's Tuesday Readings"
  const emailTitle = `${escapeHtml(recipientName)}'s ${weekdayName(digestDate)} Reading`;
  const dateLabel = humanDateLong(digestDate);

  const rows = items
    .map(
      (item, idx) => `
      <tr><td style="padding:24px 0 0;border-top:1px solid #e8e5e0">
        <div style="margin-bottom:10px">
          <span style="font:700 10px/1.4 'Satoshi','Helvetica Neue',Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#64748b;background:#f1f5f9;padding:3px 9px;border-radius:20px;display:inline-block">${
            escapeHtml(item.source_domain || item.source_name)
          }</span>
          <span style="font:400 12px/1.4 'Satoshi','Helvetica Neue',Arial,sans-serif;color:#94a3b8;margin-left:8px">${
            item.estimated_reading_minutes
          } min read</span>
        </div>
        <h2 style="font:700 19px/1.35 'Satoshi','Helvetica Neue',Arial,sans-serif;margin:0 0 10px;color:#0f172a">
          <a href="${escapeHtml(item.url)}" style="color:#0f172a;text-decoration:none">${idx + 1}. ${escapeHtml(item.title)}</a>
        </h2>
        <p style="font:400 14px/1.65 'Satoshi','Helvetica Neue',Arial,sans-serif;color:#475569;margin:0 0 14px">${
          escapeHtml(item.why_it_matters)
        }</p>
        <a href="${escapeHtml(item.url)}" style="font:600 12px/1.4 'Satoshi','Helvetica Neue',Arial,sans-serif;color:#0f172a;text-decoration:none;display:inline-block;border:1.5px solid #cbd5e1;padding:7px 18px;border-radius:6px;background:#ffffff;margin-bottom:24px">Read Article →</a>
      </td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailTitle}</title>
  <style type="text/css">
    @font-face { font-family:'Satoshi'; font-style:normal; font-weight:400; src:url('https://abodid.com/fonts/satoshi/Satoshi-Regular.woff2') format('woff2'); }
    @font-face { font-family:'Satoshi'; font-style:normal; font-weight:500; src:url('https://abodid.com/fonts/satoshi/Satoshi-Medium.woff2') format('woff2'); }
    @font-face { font-family:'Satoshi'; font-style:normal; font-weight:700; src:url('https://abodid.com/fonts/satoshi/Satoshi-Bold.woff2') format('woff2'); }
    body, .body-bg { margin:0; padding:0; background:#f5f4f1 !important; }
    table { border-collapse:collapse; mso-table-lspace:0; mso-table-rspace:0; }
    img { border:0; display:block; }
    @media only screen and (max-width:640px) {
      .wrapper     { padding:12px 0 !important; }
      .card        { border-radius:0 !important; border-left:none !important; border-right:none !important; }
      .pad         { padding-left:20px !important; padding-right:20px !important; }
      .h1          { font-size:22px !important; line-height:1.25 !important; }
      .article-h2  { font-size:17px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f5f4f1;-webkit-font-smoothing:antialiased">

  <!--[if !gte mso 9]><!-->
  <!-- Preview text (hidden in most clients, visible as inbox snippet) -->
  <div aria-hidden="true" style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f5f4f1">
    I have curated these amazing articles for you to read today.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  <!--<![endif]-->

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f4f1">
    <tr>
      <td class="wrapper" align="center" style="padding:32px 16px;background:#f5f4f1">

        <!-- Email card (600px) -->
        <table role="presentation" class="card" width="600" cellpadding="0" cellspacing="0" border="0"
          style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e8e5e0;overflow:hidden">

          <!-- ── Header ── -->
          <tr>
            <td class="pad" style="padding:40px 44px 32px;border-bottom:2px solid #0f172a">
              <p style="margin:0 0 8px;font:700 10px/1.4 'Satoshi','Helvetica Neue',Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8">
                READER'S DIGEST &middot; ${dateLabel}
              </p>
              <h1 class="h1" style="margin:0 0 12px;font:700 28px/1.2 'Satoshi','Helvetica Neue',Arial,sans-serif;color:#0f172a">
                ${emailTitle}
              </h1>
              <p style="margin:0;font:400 15px/1.6 'Satoshi','Helvetica Neue',Arial,sans-serif;color:#475569">
                Hi ${escapeHtml(recipientName)}, here's a curated list of ${items.length} amazing articles for you to read.
              </p>
            </td>
          </tr>

          <!-- ── Articles ── -->
          <tr>
            <td class="pad" style="padding:0 44px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${rows}
              </table>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td class="pad" style="padding:28px 44px 40px;border-top:2px solid #0f172a">
              <p style="margin:0 0 6px;font:700 10px/1.4 'Satoshi','Helvetica Neue',Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8">Read first today</p>
              <a href="${escapeHtml(readFirst.url)}"
                style="font:700 17px/1.4 'Satoshi','Helvetica Neue',Arial,sans-serif;color:#0f172a;text-decoration:none;display:block;margin-bottom:20px">
                ${escapeHtml(readFirst.title)} →
              </a>
              <p style="margin:0;font:400 11px/1.5 'Satoshi','Helvetica Neue',Arial,sans-serif;color:#cbd5e1">
                Curated for ${escapeHtml(recipientName)} &middot; Sent via Resend
              </p>${isTest ? `
              <p style="margin:16px 0 0;padding-top:14px;border-top:1px solid #f1f5f9;font:400 11px/1.5 'Satoshi','Helvetica Neue',Arial,sans-serif;color:#cbd5e1">
                &#x1F9EA; This is a test preview — not a real delivery.
              </p>` : ""}
            </td>
          </tr>

        </table>
        <!-- /Email card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
};

export const shouldDeliverToday = (
  frequency: "daily" | "weekdays" | "weekly" | "paused",
  weeklyDeliveryDay: number,
  localDate: Date,
): boolean => {
  if (frequency === "paused") return false;
  if (frequency === "daily") return true;
  if (frequency === "weekdays") {
    return localDate.getUTCDay() >= 1 && localDate.getUTCDay() <= 5;
  }
  return localDate.getUTCDay() === weeklyDeliveryDay;
};
