import * as opentype from "opentype.js";

let defaultFontPromise: Promise<opentype.Font> | null = null;

async function parseFontResponse(response: Response): Promise<opentype.Font> {
  if (!response.ok) throw new Error(`Font request failed: ${response.status}`);
  return opentype.parse(await response.arrayBuffer());
}

export function loadDefaultFont(): Promise<opentype.Font> {
  if (!defaultFontPromise) {
    defaultFontPromise = fetch("/fonts/inconsolata-700.woff").then(parseFontResponse);
  }
  return defaultFontPromise;
}

export async function loadUploadedFont(file: File): Promise<opentype.Font> {
  return opentype.parse(await file.arrayBuffer());
}
