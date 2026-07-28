import crypto from "node:crypto";

export const LINKEDIN_CONNECTION_COLUMNS = [
  "First Name",
  "Last Name",
  "URL",
  "Email Address",
  "Company",
  "Position",
  "Connected On",
];

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "yahoo.com",
  "yahoo.co.uk",
  "proton.me",
  "protonmail.com",
  "fastmail.com",
]);

const CATEGORY_RULES = [
  ["SEO", /\b(seo|search engine|search marketing|discoverability|metadata)\b/i],
  ["Education", /\b(university|college|school|education|teacher|lecturer|professor|academic|learning)\b/i],
  ["Research", /\b(research|scientist|phd|doctoral|fellow|laboratory|lab\b|archives?|humanities)\b/i],
  ["Culture", /\b(museum|gallery|heritage|culture|cultural|arts?\b|curator|archive)\b/i],
  ["Film & Media", /\b(film|cinema|video|media|broadcast|television|documentary|editor|producer)\b/i],
  ["Design", /\b(design|creative|ux\b|ui\b|architect|animation|illustrat|photograph)\b/i],
  ["Technology", /\b(software|engineer|developer|technology|tech\b|data|digital|ai\b|machine learning|product)\b/i],
  ["Marketing", /\b(marketing|content strateg|communications?|brand|growth|social media|public relations)\b/i],
  ["Business", /\b(founder|co-founder|entrepreneur|consultant|strategy|operations|business|sales|venture|invest)\b/i],
  ["Public & Nonprofit", /\b(government|council|charity|nonprofit|non-profit|foundation|ngo\b|public sector)\b/i],
  ["Healthcare", /\b(health|medical|doctor|hospital|clinical|pharma|biotech)\b/i],
];

const MONTHS = new Map([
  ["jan", 0],
  ["feb", 1],
  ["mar", 2],
  ["apr", 3],
  ["may", 4],
  ["jun", 5],
  ["jul", 6],
  ["aug", 7],
  ["sep", 8],
  ["oct", 9],
  ["nov", 10],
  ["dec", 11],
]);

const trim = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export function parseCsvRows(csvText) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const text = String(csvText ?? "").replace(/^\uFEFF/, "");

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (character === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows;
}

export function inspectLinkedInConnectionsCsv(csvText, preferredColumns = []) {
  const rows = parseCsvRows(csvText);
  const preferred = preferredColumns.map(trim).filter(Boolean);
  const exactHeaderIndex = rows.findIndex((row) => {
    const normalized = row.map(trim);
    return normalized.includes("First Name") && normalized.includes("Last Name");
  });
  const preferredHeaderIndex = preferred.length
    ? rows.findIndex((row) => {
        const normalized = new Set(row.map((value) => trim(value).toLowerCase()));
        return preferred.every((column) => normalized.has(column.toLowerCase()));
      })
    : -1;

  let headerIndex = preferredHeaderIndex >= 0 ? preferredHeaderIndex : exactHeaderIndex;
  if (headerIndex < 0) {
    const candidates = rows
      .slice(0, 60)
      .map((row, index) => {
        const columns = row.map(trim).filter(Boolean);
        const uniqueColumns = new Set(columns.map((column) => column.toLowerCase()));
        const canonicalMatches = LINKEDIN_CONNECTION_COLUMNS.filter(
          (column) => uniqueColumns.has(column.toLowerCase()),
        ).length;
        return {
          index,
          columns,
          score: canonicalMatches * 100 + uniqueColumns.size,
        };
      })
      .filter((candidate) => candidate.columns.length >= 2)
      .sort((left, right) => right.score - left.score);
    headerIndex = candidates[0]?.index ?? -1;
  }

  return {
    headerIndex,
    preambleRows: Math.max(0, headerIndex),
    detectedColumns: headerIndex >= 0 ? rows[headerIndex].map(trim).filter(Boolean) : [],
  };
}

export function normalizeLinkedInUrl(value) {
  const raw = trim(value);
  if (!raw) return null;

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!host.endsWith("linkedin.com")) return null;
    url.protocol = "https:";
    url.hostname = "www.linkedin.com";
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+/g, "/").replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function normalizeLinkedInDate(value) {
  const raw = trim(value);
  if (!raw) return null;
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return raw;

  const monthNameMatch = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (monthNameMatch) {
    const month = MONTHS.get(monthNameMatch[2].slice(0, 3).toLowerCase());
    if (month !== undefined) {
      const date = new Date(Date.UTC(
        Number(monthNameMatch[3]),
        month,
        Number(monthNameMatch[1]),
      ));
      if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    }
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export function inferWorkCategories(company, position) {
  const haystack = `${trim(position)} ${trim(company)}`.trim();
  if (!haystack) return [];
  return CATEGORY_RULES
    .filter(([, pattern]) => pattern.test(haystack))
    .map(([category]) => category)
    .slice(0, 4);
}

export function inferEmailType(email) {
  const normalized = trim(email).toLowerCase();
  if (!normalized) return "none";
  const domain = normalized.split("@")[1];
  if (!domain) return "unknown";
  return PERSONAL_EMAIL_DOMAINS.has(domain) ? "personal" : "work";
}

export function buildContactEmbeddingText(contact) {
  return [
    contact.full_name,
    contact.position || contact.source_position,
    contact.company || contact.source_company,
    [contact.city, contact.region, contact.country].filter(Boolean).join(", "),
    ...(contact.work_categories || []),
    ...(contact.expertise_keywords || []),
    ...(contact.tags || []),
    ...(contact.outreach_goals || []),
    contact.relationship_context,
    contact.notes,
    contact.public_summary,
  ]
    .map(trim)
    .filter(Boolean)
    .join(" | ")
    .slice(0, 8000);
}

function buildSourceKey({ linkedinUrl, firstName, lastName, company, position, connectedOn }) {
  if (linkedinUrl) return `linkedin:${sha256(linkedinUrl.toLowerCase())}`;
  const fallback = [firstName, lastName, company, position, connectedOn]
    .map((value) => trim(value).toLowerCase())
    .join("|");
  return `fallback:${sha256(fallback)}`;
}

function compareSourceRecord(left, right) {
  const fields = [
    "first_name",
    "last_name",
    "linkedin_url",
    "source_email",
    "source_company",
    "source_position",
    "connected_on",
  ];
  return fields.every((field) => trim(left?.[field]) === trim(right?.[field]));
}

export function sourceRecordChanged(existing, incoming) {
  return !compareSourceRecord(existing, incoming);
}

export function reconcileSourceDerivedFields(
  existing,
  incoming,
  detectedAt = new Date().toISOString(),
) {
  const updates = {};
  const conflicts = (
    existing?.incoming_conflicts
    && typeof existing.incoming_conflicts === "object"
    && !Array.isArray(existing.incoming_conflicts)
  )
    ? { ...existing.incoming_conflicts }
    : {};
  const fieldPairs = [
    ["source_email", "email"],
    ["source_company", "company"],
    ["source_position", "position"],
  ];

  for (const [sourceField, currentField] of fieldPairs) {
    const previousSource = trim(existing?.[sourceField]) || null;
    const incomingSource = trim(incoming?.[sourceField]) || null;
    const currentValue = trim(existing?.[currentField]) || null;
    const sourceChanged = previousSource !== incomingSource;
    const currentFollowedPreviousSource = !currentValue || currentValue === previousSource;

    if (sourceChanged && currentFollowedPreviousSource) {
      updates[currentField] = incomingSource;
      delete conflicts[sourceField];
    } else if (sourceChanged && currentValue !== incomingSource) {
      conflicts[sourceField] = {
        previousSource,
        incoming: incomingSource,
        current: currentValue,
        detectedAt,
      };
    } else if (currentValue === incomingSource) {
      delete conflicts[sourceField];
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, "email")) {
    updates.email_type = inferEmailType(updates.email);
  }

  const sourceWorkChanged = (
    trim(existing?.source_company) !== trim(incoming?.source_company)
    || trim(existing?.source_position) !== trim(incoming?.source_position)
  );
  if (sourceWorkChanged) {
    updates.work_categories = [...new Set([
      ...(Array.isArray(existing?.work_categories) ? existing.work_categories : []),
      ...inferWorkCategories(incoming?.source_company, incoming?.source_position),
    ])].slice(0, 20);
  }

  updates.incoming_conflicts = conflicts;
  return updates;
}

export function parseLinkedInConnectionsCsv(csvText, options = {}) {
  const rows = parseCsvRows(csvText);
  const requestedMapping = (
    options.columnMapping
    && typeof options.columnMapping === "object"
    && !Array.isArray(options.columnMapping)
  )
    ? options.columnMapping
    : {};
  const mappedSourceColumns = LINKEDIN_CONNECTION_COLUMNS
    .map((column) => trim(requestedMapping[column]))
    .filter(Boolean);
  const inspection = inspectLinkedInConnectionsCsv(csvText, mappedSourceColumns);
  const headerIndex = inspection.headerIndex;

  if (headerIndex < 0) {
    throw new Error("The file does not contain a LinkedIn Connections.csv header row.");
  }

  const detectedColumns = rows[headerIndex].map(trim);
  const columnIndex = new Map(detectedColumns.map((column, index) => [column.toLowerCase(), index]));
  const sourceColumnFor = (column) => trim(requestedMapping[column]) || column;
  const missingColumns = LINKEDIN_CONNECTION_COLUMNS.filter(
    (column) => !columnIndex.has(sourceColumnFor(column).toLowerCase()),
  );
  if (missingColumns.length) {
    throw new Error(`Missing expected columns: ${missingColumns.join(", ")}`);
  }

  const read = (row, column) => trim(row[columnIndex.get(sourceColumnFor(column).toLowerCase())]);
  const blankCounts = Object.fromEntries(LINKEDIN_CONNECTION_COLUMNS.map((column) => [column, 0]));
  const records = [];
  const errors = [];
  const seenKeys = new Set();
  let duplicateCount = 0;

  const dataRows = rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((value) => trim(value)));

  dataRows.forEach((row, dataIndex) => {
    const sourceRowNumber = headerIndex + dataIndex + 2;
    for (const column of LINKEDIN_CONNECTION_COLUMNS) {
      if (!read(row, column)) blankCounts[column] += 1;
    }

    const firstName = read(row, "First Name");
    const lastName = read(row, "Last Name");
    const rawLinkedinUrl = read(row, "URL");
    const linkedinUrl = normalizeLinkedInUrl(rawLinkedinUrl);
    const sourceEmail = read(row, "Email Address").toLowerCase() || null;
    const sourceCompany = read(row, "Company") || null;
    const sourcePosition = read(row, "Position") || null;
    const rawConnectedOn = read(row, "Connected On");
    const connectedOn = normalizeLinkedInDate(rawConnectedOn);
    const fullName = trim(`${firstName} ${lastName}`);

    if (!firstName && !lastName && !rawLinkedinUrl) {
      errors.push({
        row: sourceRowNumber,
        code: "missing_identity",
        message: "No name or LinkedIn URL was supplied.",
      });
      return;
    }

    if (rawLinkedinUrl && !linkedinUrl) {
      errors.push({
        row: sourceRowNumber,
        code: "invalid_linkedin_url",
        message: "The LinkedIn URL is malformed or is not a linkedin.com address.",
      });
      return;
    }

    if (sourceEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sourceEmail)) {
      errors.push({
        row: sourceRowNumber,
        code: "invalid_email",
        message: "The email address is malformed.",
      });
      return;
    }

    if (!connectedOn) {
      errors.push({
        row: sourceRowNumber,
        code: "invalid_connection_date",
        message: "The connection date could not be parsed.",
      });
      return;
    }

    const sourceRecordKey = buildSourceKey({
      linkedinUrl,
      firstName,
      lastName,
      company: sourceCompany,
      position: sourcePosition,
      connectedOn,
    });

    if (seenKeys.has(sourceRecordKey)) {
      duplicateCount += 1;
      errors.push({
        row: sourceRowNumber,
        code: "duplicate",
        message: "This person duplicates an earlier row in the uploaded file.",
      });
      return;
    }
    seenKeys.add(sourceRecordKey);

    const workCategories = inferWorkCategories(sourceCompany, sourcePosition);
    const emailType = inferEmailType(sourceEmail);
    const importSnapshot = {
      "First Name": firstName || null,
      "Last Name": lastName || null,
      URL: rawLinkedinUrl || null,
      "Email Address": sourceEmail,
      Company: sourceCompany,
      Position: sourcePosition,
      "Connected On": rawConnectedOn || null,
    };

    records.push({
      source_record_key: sourceRecordKey,
      first_name: firstName || null,
      last_name: lastName || null,
      full_name: fullName || linkedinUrl || "Unknown connection",
      linkedin_url: linkedinUrl,
      source_email: sourceEmail,
      source_company: sourceCompany,
      source_position: sourcePosition,
      connected_on: connectedOn,
      import_snapshot: importSnapshot,
      email: sourceEmail,
      company: sourceCompany,
      position: sourcePosition,
      work_categories: workCategories,
      confidence: {
        identity: linkedinUrl ? "linkedin_export_url" : "fallback_match",
        source: "LinkedIn Connections.csv",
      },
      has_email: Boolean(sourceEmail),
      email_type: emailType,
      newsletter_status: "not_subscribed",
      do_not_contact: false,
    });
  });

  return {
    sourceSha256: sha256(String(csvText ?? "")),
    preambleRows: headerIndex,
    detectedColumns,
    columnMapping: Object.fromEntries(
      LINKEDIN_CONNECTION_COLUMNS.map((column) => [column, sourceColumnFor(column)]),
    ),
    missingColumns,
    totalRows: dataRows.length,
    validRows: records.length,
    failedRows: errors.length - duplicateCount,
    duplicateCount,
    blankCounts,
    records: options.includeRecords === false ? undefined : records,
    errors,
  };
}

export function errorsToCsv(errors = []) {
  const escape = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    ["Row", "Code", "Message"],
    ...errors.map((error) => [error.row, error.code, error.message]),
  ]
    .map((row) => row.map(escape).join(","))
    .join("\n");
}
