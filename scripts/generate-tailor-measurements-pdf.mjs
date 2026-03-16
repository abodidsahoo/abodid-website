import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { tailorMeasurementsPage } from "../src/data/tailorMeasurements.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const outputPath = path.join(
  projectRoot,
  "public",
  tailorMeasurementsPage.pdfPath.replace(/^\//, ""),
);

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

const palette = {
  brandRed: [0.639, 0.0, 0.129],
  page: [0.961, 0.949, 0.929],
  surface: [0.995, 0.991, 0.982],
  surfaceAlt: [0.952, 0.932, 0.903],
  surfaceRow: [0.975, 0.965, 0.948],
  ink: [0.102, 0.129, 0.157],
  muted: [0.361, 0.427, 0.486],
  line: [0.844, 0.807, 0.757],
  lineStrong: [0.733, 0.673, 0.603],
  white: [1, 1, 1],
  whiteSoft: [0.972, 0.952, 0.94],
};

class PdfDocument {
  constructor() {
    this.pages = [];
  }

  addPage() {
    const page = { ops: [] };
    this.pages.push(page);
    return page;
  }

  rect(page, x, top, width, height, fill, stroke = null, lineWidth = 1) {
    const y = PAGE_HEIGHT - top - height;
    const parts = [];
    if (fill) parts.push(`${rgb(fill)} rg`);
    if (stroke) parts.push(`${rgb(stroke)} RG`);
    if (stroke) parts.push(`${lineWidth} w`);
    parts.push(`${num(x)} ${num(y)} ${num(width)} ${num(height)} re`);
    parts.push(fill && stroke ? "B" : fill ? "f" : "S");
    page.ops.push(parts.join("\n"));
  }

  line(page, x1, top1, x2, top2, color, lineWidth = 1) {
    const y1 = PAGE_HEIGHT - top1;
    const y2 = PAGE_HEIGHT - top2;
    page.ops.push(
      `${rgb(color)} RG\n${lineWidth} w\n${num(x1)} ${num(y1)} m\n${num(x2)} ${num(y2)} l\nS`,
    );
  }

  text(page, text, x, top, options = {}) {
    const {
      size = 12,
      color = palette.ink,
      font = "regular",
      align = "left",
      maxWidth = null,
      leading = 1.35,
    } = options;

    const lines = Array.isArray(text)
      ? text
      : wrapText(String(text), maxWidth, size, font);

    lines.forEach((lineText, index) => {
      const fontName = fontKey(font);
      const y = PAGE_HEIGHT - top - size - index * size * leading;
      const width = estimateTextWidth(lineText, size, font);
      const drawX =
        align === "right"
          ? x - width
          : align === "center"
            ? x - width / 2
            : x;

      page.ops.push(
        `BT\n${rgb(color)} rg\n/${fontName} ${num(size)} Tf\n1 0 0 1 ${num(drawX)} ${num(y)} Tm\n(${escapePdfText(lineText)}) Tj\nET`,
      );
    });

    return lines.length * size * leading;
  }

  save(filePath) {
    const objects = [];
    const reserveObject = () => {
      objects.push(null);
      return objects.length;
    };
    const setObject = (id, value) => {
      objects[id - 1] = value;
    };

    const catalogId = reserveObject();
    const pagesId = reserveObject();
    const regularFontId = reserveObject();
    const boldFontId = reserveObject();
    const monoFontId = reserveObject();

    const pageEntries = this.pages.map((page) => {
      const contentId = reserveObject();
      const pageId = reserveObject();
      return { page, contentId, pageId };
    });

    setObject(
      regularFontId,
      `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
    );
    setObject(
      boldFontId,
      `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`,
    );
    setObject(
      monoFontId,
      `<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>`,
    );

    pageEntries.forEach(({ page, contentId, pageId }) => {
      const stream = page.ops.join("\n");
      setObject(
        contentId,
        `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
      );
      setObject(
        pageId,
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R /F3 ${monoFontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      );
    });

    setObject(
      pagesId,
      `<< /Type /Pages /Count ${pageEntries.length} /Kids [${pageEntries
        .map(({ pageId }) => `${pageId} 0 R`)
        .join(" ")}] >>`,
    );
    setObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    let pdf = "%PDF-1.4\n%CODX\n";
    const offsets = [0];

    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf, "utf8"));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefStart = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += `0000000000 65535 f \n`;
    for (let index = 1; index <= objects.length; index += 1) {
      pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, pdf, "utf8");
  }
}

function fontKey(font) {
  if (font === "bold") return "F2";
  if (font === "mono") return "F3";
  return "F1";
}

function num(value) {
  return Number(value).toFixed(2).replace(/\.00$/, "");
}

function rgb(color) {
  return color.map((value) => num(value)).join(" ");
}

function escapePdfText(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function estimateTextWidth(text, size, font = "regular") {
  const factor = font === "mono" ? 0.6 : font === "bold" ? 0.56 : 0.52;
  return String(text).length * size * factor;
}

function wrapText(text, maxWidth, size, font = "regular") {
  if (!maxWidth) return [text];

  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (estimateTextWidth(next, size, font) <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function measureTextBlock(text, options = {}) {
  const {
    size = 12,
    font = "regular",
    maxWidth = null,
    leading = 1.35,
  } = options;
  const lines = wrapText(String(text), maxWidth, size, font);
  return {
    lines,
    height: lines.length * size * leading,
  };
}

function getPdfProfiles() {
  const abodid = tailorMeasurementsPage.profiles.find(
    (profile) => profile.name === "Abodid Sahoo",
  );
  const yashaswinee = tailorMeasurementsPage.profiles.find(
    (profile) => profile.name === "Yashaswinee Sahoo",
  );

  return [abodid, yashaswinee].filter(Boolean);
}

function drawCoverPage(doc, page) {
  const { title, contact } = tailorMeasurementsPage;
  const marginX = 58;
  const contentTop = 258;
  const titleBlock = measureTextBlock(title, {
    size: 40,
    font: "bold",
    maxWidth: 360,
    leading: 1.02,
  });
  const nameBlock = measureTextBlock(contact.name, {
    size: 18,
    font: "bold",
    maxWidth: 320,
    leading: 1.15,
  });
  const emailBlock = measureTextBlock(contact.email, {
    size: 12.2,
    maxWidth: 320,
    leading: 1.28,
  });
  const phoneBlock = measureTextBlock(contact.phone, {
    size: 12.2,
    maxWidth: 320,
    leading: 1.28,
  });

  doc.rect(page, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, palette.brandRed);
  doc.line(page, marginX, 128, PAGE_WIDTH - 58, 128, palette.whiteSoft, 1.2);

  doc.text(page, "COLLABORATION / TAILORING", marginX, 86, {
    size: 10.5,
    font: "mono",
    color: palette.whiteSoft,
  });

  doc.text(page, titleBlock.lines, marginX, contentTop, {
    size: 40,
    font: "bold",
    color: palette.white,
    leading: 1.02,
  });

  const contactTop = contentTop + titleBlock.height + 82;
  doc.text(page, nameBlock.lines, marginX, contactTop, {
    size: 18,
    font: "bold",
    color: palette.white,
    leading: 1.15,
  });
  doc.text(
    page,
    phoneBlock.lines,
    marginX,
    contactTop + nameBlock.height + 22,
    {
      size: 12.2,
      color: palette.whiteSoft,
      leading: 1.28,
    },
  );
  doc.text(
    page,
    emailBlock.lines,
    marginX,
    contactTop + nameBlock.height + 22 + phoneBlock.height + 10,
    {
      size: 12.2,
      color: palette.whiteSoft,
      leading: 1.28,
    },
  );

  doc.text(page, "01", PAGE_WIDTH - 74, PAGE_HEIGHT - 108, {
    size: 11,
    font: "mono",
    color: palette.whiteSoft,
    align: "right",
  });
}

function drawMeasurementsPage(doc, page, profile, pageNumber) {
  const marginX = 42;
  const contentX = 58;
  const contentWidth = PAGE_WIDTH - contentX * 2;
  const top = 38;

  doc.rect(page, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, palette.page);
  doc.rect(page, 0, 0, PAGE_WIDTH, 14, palette.brandRed);

  doc.text(page, "TAILOR MEASUREMENTS", contentX, top + 4, {
    size: 10,
    font: "mono",
    color: palette.muted,
  });
  doc.text(page, profile.name, contentX, top + 28, {
    size: 29,
    font: "bold",
    color: palette.ink,
  });
  doc.text(
    page,
    `${profile.height}  /  ${profile.bodyType}`,
    contentX,
    top + 68,
    {
      size: 10.2,
      color: palette.muted,
      maxWidth: 360,
      leading: 1.2,
    },
  );
  doc.line(page, contentX, 132, contentX + contentWidth, 132, palette.lineStrong, 0.9);
  doc.text(page, String(pageNumber).padStart(2, "0"), PAGE_WIDTH - 58, top + 10, {
    size: 10,
    font: "mono",
    color: palette.muted,
    align: "right",
  });

  const tableTop = 156;
  const labelWidth = 338;
  const rowHeight = 28;
  const headerHeight = 34;
  const tableHeight = headerHeight + profile.measurements.length * rowHeight;

  doc.rect(page, contentX, tableTop, contentWidth, tableHeight, palette.surface, palette.line);
  doc.rect(page, contentX, tableTop, contentWidth, headerHeight, palette.surfaceAlt, palette.line);
  doc.text(page, "Measurement", contentX + 16, tableTop + 12, {
    size: 9,
    font: "mono",
    color: palette.muted,
  });
  doc.text(page, "Dimension", contentX + contentWidth - 16, tableTop + 12, {
    size: 9,
    font: "mono",
    color: palette.muted,
    align: "right",
  });

  profile.measurements.forEach((measurement, index) => {
    const rowTop = tableTop + headerHeight + index * rowHeight;
    const fill = index % 2 === 0 ? palette.surfaceRow : palette.surface;
    doc.rect(page, contentX, rowTop, contentWidth, rowHeight, fill, palette.line, 0.6);

    const labelBlock = measureTextBlock(
      measurement.estimated ? `${measurement.label} [Estimated]` : measurement.label,
      {
        size: 10.3,
        maxWidth: labelWidth - 26,
        leading: 1.18,
      },
    );

    doc.text(page, labelBlock.lines, contentX + 16, rowTop + 8, {
      size: 10.3,
      color: measurement.estimated ? palette.estimate : palette.ink,
      leading: 1.18,
    });
    doc.text(page, measurement.value, contentX + contentWidth - 16, rowTop + 8, {
      size: 10.3,
      font: "bold",
      color: palette.ink,
      align: "right",
    });
  });

  const notesBlock = measureTextBlock(tailorMeasurementsPage.notes, {
    size: 9.2,
    maxWidth: contentWidth - 32,
    leading: 1.32,
  });
  const notesTop = tableTop + tableHeight + 24;
  const notesHeight = 18 + 16 + notesBlock.height + 18;

  doc.rect(page, contentX, notesTop, contentWidth, notesHeight, palette.surfaceAlt, palette.line);
  doc.text(page, "Notes", contentX + 16, notesTop + 16, {
    size: 9,
    font: "mono",
    color: palette.muted,
  });
  doc.text(page, notesBlock.lines, contentX + 16, notesTop + 38, {
    size: 9.2,
    color: palette.muted,
    leading: 1.32,
  });
}

const pdf = new PdfDocument();
const coverPage = pdf.addPage();
const profilePageOne = pdf.addPage();
const profilePageTwo = pdf.addPage();

const pdfProfiles = getPdfProfiles();

drawCoverPage(pdf, coverPage);
drawMeasurementsPage(pdf, profilePageOne, pdfProfiles[0], 2);
drawMeasurementsPage(pdf, profilePageTwo, pdfProfiles[1], 3);

pdf.save(outputPath);

console.log(`Generated ${path.relative(projectRoot, outputPath)}`);
