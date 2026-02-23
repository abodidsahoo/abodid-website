import * as fs from "node:fs/promises";
import * as path from "node:path";

type ScanEntry = {
    id: string;
    selector: string;
    previewSelector: string;
    file: string;
    line: number;
    route: string;
    previewRoute: string;
    pageGroup: PageGroupId;
    routes: string[];
    focusArea: FocusAreaId;
    focusLabel: string;
    sample: string;
    fontFamily: string;
    fontSize: number;
    sizeUnit: "rem" | "em";
    fontWeight: number;
    color: string;
};

type FocusAreaId =
    | "header_menu"
    | "header_segments"
    | "card_stack"
    | "title_buttons"
    | "body_text"
    | "footer_titles"
    | "blog_content"
    | "page_sections"
    | "other";

type PageGroupId = "landing" | "blog" | "research" | "resources" | "experiments" | "other";

const FOCUS_AREAS = [
    { id: "header_menu", label: "Header Menu" },
    { id: "header_segments", label: "Header Segments" },
    { id: "card_stack", label: "Card Stack" },
    { id: "title_buttons", label: "Title / Buttons" },
    { id: "body_text", label: "Body Text" },
    { id: "footer_titles", label: "Footer Titles" },
    { id: "blog_content", label: "Blog Content" },
    { id: "page_sections", label: "Page Sections" },
    { id: "other", label: "Other" },
] as const;

const PAGE_GROUPS = [
    { id: "landing", label: "Landing" },
    { id: "blog", label: "Blog" },
    { id: "research", label: "Research" },
    { id: "resources", label: "Resources" },
    { id: "experiments", label: "Experiments" },
    { id: "other", label: "Other Pages" },
] as const;

const ROOT = path.join(process.cwd(), "src");
const PAGE_ROOT = path.join(ROOT, "pages");
const EXTS = [".astro", ".css", ".tsx", ".jsx", ".ts", ".js"];
const MAX_ITEMS = 260;

const toUnixPath = (value: string): string => value.replace(/\\/g, "/");

const routeFromPageFile = (absPath: string): string => {
    const normalized = toUnixPath(absPath);
    const normalizedRoot = toUnixPath(PAGE_ROOT) + "/";
    if (!normalized.startsWith(normalizedRoot)) return "";

    let route = normalized.slice(normalizedRoot.length);
    route = route.replace(/\.(astro|tsx|jsx|ts|js)$/i, "");
    route = route.replace(/\/index$/i, "");
    route = route.replace(/\[\.\.\.([^\]]+)\]/g, ":$1");
    route = route.replace(/\[([^\]]+)\]/g, ":$1");
    return `/${route}`.replace(/\/+/g, "/");
};

const hash = (value: string): string => {
    let h = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        h ^= value.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return Math.abs(h >>> 0).toString(36);
};

const findLine = (content: string, index: number): number =>
    content.slice(0, Math.max(0, index)).split("\n").length;

const snippet = (selector: string, body: string): string => {
    const compactBody = body.replace(/\s+/g, " ").trim();
    return `${selector} { ${compactBody.slice(0, 200)}${compactBody.length > 200 ? "..." : ""} }`;
};

const parseSize = (value: string): { size: number; unit: "rem" | "em" } => {
    const match = value.match(/(-?\d+(\.\d+)?)\s*(rem|em|px)?/i);
    if (!match) return { size: 1, unit: "rem" };
    const amount = Number(match[1]);
    const unit = (match[3] || "rem").toLowerCase();
    if (!Number.isFinite(amount)) return { size: 1, unit: "rem" };
    if (unit === "px") return { size: Math.max(0.5, Math.min(8, amount / 16)), unit: "rem" };
    if (unit === "em") return { size: Math.max(0.5, Math.min(8, amount)), unit: "em" };
    return { size: Math.max(0.5, Math.min(8, amount)), unit: "rem" };
};

const parseWeight = (value: string): number => {
    const match = value.match(/\d{3}/);
    if (!match) return 500;
    const numeric = Number(match[0]);
    if (!Number.isFinite(numeric)) return 500;
    return Math.max(100, Math.min(900, Math.round(numeric / 100) * 100));
};

const isFunctionalPreviewRoute = (route: string): boolean => {
    if (!route) return false;
    if (!route.startsWith("/")) return false;
    if (route.includes(":")) return false;
    if (route.startsWith("/api")) return false;
    if (route.startsWith("/admin")) return false;
    if (route.includes("/admin/")) return false;
    if (route.startsWith("/resources/auth")) return false;
    return true;
};

const toPreviewSelector = (selector: string): string => {
    const firstPart = selector.split(",")[0]?.trim() || "";
    if (!firstPart) return "";
    const withoutPseudo = firstPart.replace(/:{1,2}[a-zA-Z-]+(\([^)]*\))?/g, "").trim();
    return withoutPseudo || firstPart;
};

const toPreviewRoute = (route: string): string => {
    if (!route) return "/";
    const withoutParam = route.replace(/\/:[^/]+/g, "");
    if (!withoutParam || withoutParam === "") return "/";
    return withoutParam.startsWith("/") ? withoutParam : `/${withoutParam}`;
};

const pageGroupFromRoute = (route: string): PageGroupId => {
    const normalized = route.toLowerCase();
    if (normalized === "/" || normalized.startsWith("/index")) return "landing";
    if (normalized.startsWith("/blog")) return "blog";
    if (normalized.startsWith("/research")) return "research";
    if (normalized.startsWith("/resources")) return "resources";
    if (
        normalized.startsWith("/experiments") ||
        normalized.includes("test") ||
        normalized.includes("prototype") ||
        normalized.includes("demo")
    ) {
        return "experiments";
    }
    return "other";
};

const focusAreaFromSelector = (selector: string, route: string, file: string): FocusAreaId => {
    const s = selector.toLowerCase();
    const r = route.toLowerCase();
    const f = file.toLowerCase();

    if (/(^|[\s>.#])(header|nav|menu|fixed-nav|site-header|breadcrumbs?)([\s>.#]|$)/.test(s)) {
        if (/(btn|button|chip|tag|badge|toggle|icon|kicker|label|menu-btn)/.test(s)) return "header_segments";
        return "header_menu";
    }

    if (/(card|stack|tile|polaroid|panel|module|moodboard|showcase|grid-item)/.test(s)) return "card_stack";
    if (/(btn|button|cta|title|heading|kicker|label|tagline|hero-title)/.test(s)) return "title_buttons";
    if (/(^|[\s>.#])(footer|site-footer)([\s>.#]|$)/.test(s)) return "footer_titles";

    if (r.startsWith("/blog") || f.includes("/pages/blog/")) {
        if (/(content|article|post|markdown|prose|body|title|meta)/.test(s)) return "blog_content";
    }

    if (/(^|[\s>.#])(p|small|article|content|body|copy|text|prose|markdown)([\s>.#]|$)/.test(s)) return "body_text";
    if (/(section|hero|intro|split|band|feature|block|module)/.test(s)) return "page_sections";
    return "other";
};

const focusAreaLabel = (id: FocusAreaId): string =>
    FOCUS_AREAS.find((item) => item.id === id)?.label || "Other";

const shouldIncludeRule = (selector: string, fontFamily: string): boolean => {
    if (!selector) return false;
    if (selector.startsWith("@")) return false;
    if (selector.length > 180) return false;
    if (!fontFamily) return false;
    if (/^(:root|html|body|h1|h2|h3|h4|h5|h6|p|a|button|input|select|textarea)\b/i.test(selector)) {
        return false;
    }
    return true;
};

const normalizeImportTarget = (raw: string): string => raw.split("?")[0].split("#")[0];

const resolveImport = (fromFile: string, target: string, fileSet: Set<string>): string | null => {
    const cleaned = normalizeImportTarget(target);
    if (!cleaned.startsWith(".")) return null;

    const base = path.resolve(path.dirname(fromFile), cleaned);
    const candidates = [
        base,
        ...EXTS.map((ext) => `${base}${ext}`),
        ...EXTS.map((ext) => path.join(base, `index${ext}`)),
    ];

    for (const candidate of candidates) {
        const normalized = path.normalize(candidate);
        if (!normalized.startsWith(ROOT)) continue;
        if (!fileSet.has(normalized)) continue;
        return normalized;
    }
    return null;
};

const IMPORT_RE = /import\s+(?:[^'"]+?\s+from\s+)?["']([^"']+)["']/g;
const RULE_RE = /([^{}]+)\{([^{}]*)\}/gm;
const DECL_RE = (name: string): RegExp => new RegExp(`${name}\\s*:\\s*([^;]+);`, "i");
const ASTRO_STYLE_RE = /<style[^>]*>([\s\S]*?)<\/style>/gim;
const JSX_STYLE_RE = /<style[^>]*>\s*\{`([\s\S]*?)`\}\s*<\/style>/gim;

async function walk(dir: string, out: string[] = []): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === "node_modules") continue;
            await walk(full, out);
            continue;
        }
        if (!EXTS.includes(path.extname(entry.name).toLowerCase())) continue;
        out.push(full);
    }
    return out;
}

const extractStyleSegments = (content: string, ext: string): Array<{ css: string; offset: number }> => {
    if (ext === ".css") {
        return [{ css: content, offset: 0 }];
    }

    const segments: Array<{ css: string; offset: number }> = [];
    if (ext === ".astro") {
        let match = ASTRO_STYLE_RE.exec(content);
        while (match) {
            const css = match[1] || "";
            const start = content.indexOf(css, match.index);
            segments.push({ css, offset: Math.max(0, start) });
            match = ASTRO_STYLE_RE.exec(content);
        }
        ASTRO_STYLE_RE.lastIndex = 0;
        return segments;
    }

    if (ext === ".jsx" || ext === ".tsx" || ext === ".js" || ext === ".ts") {
        let match = JSX_STYLE_RE.exec(content);
        while (match) {
            const css = match[1] || "";
            const start = content.indexOf(css, match.index);
            segments.push({ css, offset: Math.max(0, start) });
            match = JSX_STYLE_RE.exec(content);
        }
        JSX_STYLE_RE.lastIndex = 0;
        return segments;
    }

    return segments;
};

const discoverPageDependencies = async (
    files: string[],
): Promise<{ pagesByFile: Map<string, string[]> }> => {
    const fileSet = new Set(files.map((item) => path.normalize(item)));
    const importsByFile = new Map<string, string[]>();
    for (const absFile of files) {
        const content = await fs.readFile(absFile, "utf8");
        const imports: string[] = [];
        let importMatch = IMPORT_RE.exec(content);
        while (importMatch) {
            const resolved = resolveImport(absFile, importMatch[1], fileSet);
            if (resolved) imports.push(resolved);
            importMatch = IMPORT_RE.exec(content);
        }
        importsByFile.set(absFile, imports);
        IMPORT_RE.lastIndex = 0;
    }

    const reverse = new Map<string, Set<string>>();
    Array.from(importsByFile.entries()).forEach(([from, targets]) => {
        for (const target of targets) {
            if (!reverse.has(target)) reverse.set(target, new Set());
            reverse.get(target)?.add(from);
        }
    });

    const pageFiles = files.filter((file) => toUnixPath(file).startsWith(`${toUnixPath(PAGE_ROOT)}/`));
    const pagesByFile = new Map<string, string[]>();

    for (const file of files) {
        const seen = new Set<string>();
        const queue = [file];
        while (queue.length > 0) {
            const current = queue.shift() as string;
            const parents = reverse.get(current);
            if (!parents) continue;
            for (const parent of Array.from(parents)) {
                if (seen.has(parent)) continue;
                seen.add(parent);
                queue.push(parent);
            }
        }

        const linkedPages = [file, ...Array.from(seen)]
            .filter((candidate) => pageFiles.includes(candidate))
            .map((candidate) => routeFromPageFile(candidate))
            .filter(Boolean);
        pagesByFile.set(file, Array.from(new Set(linkedPages)).sort((a, b) => a.localeCompare(b)));
    }

    return { pagesByFile };
};

export async function GET() {
    const files = await walk(ROOT);
    const { pagesByFile } = await discoverPageDependencies(files);
    const entries: ScanEntry[] = [];
    const seen = new Set<string>();

    for (const absFile of files) {
        const normalized = toUnixPath(absFile);
        if (normalized.endsWith("/styles/global.css")) continue;
        if (normalized.endsWith("/styles/satoshi.css")) continue;
        if (normalized.includes("/pages/api/")) continue;

        const content = await fs.readFile(absFile, "utf8");
        const ext = path.extname(absFile).toLowerCase();
        const segments = extractStyleSegments(content, ext);
        for (const segment of segments) {
            let ruleMatch = RULE_RE.exec(segment.css);
            while (ruleMatch) {
                const selectorRaw = (ruleMatch[1] || "").trim();
                const bodyRaw = (ruleMatch[2] || "").trim();
                if (!selectorRaw || !bodyRaw) {
                    ruleMatch = RULE_RE.exec(segment.css);
                    continue;
                }

                const fontFamily = (bodyRaw.match(DECL_RE("font-family"))?.[1] || "").trim();
                const fontSizeRaw = (bodyRaw.match(DECL_RE("font-size"))?.[1] || "").trim();
                const fontWeightRaw = (bodyRaw.match(DECL_RE("font-weight"))?.[1] || "").trim();
                const colorRaw = (bodyRaw.match(DECL_RE("color"))?.[1] || "").trim();

                if (!fontFamily) {
                    ruleMatch = RULE_RE.exec(segment.css);
                    continue;
                }

                const selectorParts = selectorRaw
                    .split(",")
                    .map((part) => part.trim())
                    .filter(Boolean);
                for (const selector of selectorParts) {
                    if (!shouldIncludeRule(selector, fontFamily)) continue;
                    const marker = `${normalized}:${selector}`;
                    if (seen.has(marker)) continue;
                    seen.add(marker);

                    const at = segment.offset + (ruleMatch.index || 0);
                    const line = findLine(content, at);
                    const pages = pagesByFile.get(absFile) || [];
                    const route = pages[0] || routeFromPageFile(absFile) || "";
                    const previewSelector = toPreviewSelector(selector);
                    const previewRoute = toPreviewRoute(route);
                    if (!isFunctionalPreviewRoute(previewRoute)) continue;
                    const pageGroup = pageGroupFromRoute(route || previewRoute);
                    const focusArea = focusAreaFromSelector(selector, route, normalized);
                    const parsedSize = parseSize(fontSizeRaw || "1rem");

                    entries.push({
                        id: `txt_${hash(marker)}`,
                        selector,
                        previewSelector,
                        file: normalized.replace(toUnixPath(process.cwd()), ""),
                        line,
                        route,
                        previewRoute,
                        pageGroup,
                        routes: pages,
                        focusArea,
                        focusLabel: focusAreaLabel(focusArea),
                        sample: snippet(selector, bodyRaw),
                        fontFamily,
                        fontSize: parsedSize.size,
                        sizeUnit: parsedSize.unit,
                        fontWeight: parseWeight(fontWeightRaw || "500"),
                        color: colorRaw || "var(--theme-color-accent)",
                    });
                }
                ruleMatch = RULE_RE.exec(segment.css);
            }
            RULE_RE.lastIndex = 0;
        }
    }

    const focusOrder = new Map(FOCUS_AREAS.map((item, index) => [item.id, index]));
    const sorted = entries.sort((a, b) => {
        const focusA = focusOrder.get(a.focusArea) ?? 999;
        const focusB = focusOrder.get(b.focusArea) ?? 999;
        if (focusA !== focusB) return focusA - focusB;
        const routeA = a.route || "zzz";
        const routeB = b.route || "zzz";
        if (routeA !== routeB) return routeA.localeCompare(routeB);
        if (a.selector !== b.selector) return a.selector.localeCompare(b.selector);
        return a.file.localeCompare(b.file);
    });

    const primary = sorted.filter((item) => item.focusArea !== "other");
    const secondary = sorted.filter((item) => item.focusArea === "other").slice(0, 28);
    const focused = [...primary, ...secondary].slice(0, MAX_ITEMS);

    const focusCounts = new Map<string, number>();
    const pageGroupCounts = new Map<string, number>();
    const routeCounts = new Map<string, number>();
    focused.forEach((item) => {
        focusCounts.set(item.focusArea, (focusCounts.get(item.focusArea) || 0) + 1);
        pageGroupCounts.set(item.pageGroup, (pageGroupCounts.get(item.pageGroup) || 0) + 1);
        if (item.previewRoute) {
            routeCounts.set(item.previewRoute, (routeCounts.get(item.previewRoute) || 0) + 1);
        }
    });

    const routes = Array.from(routeCounts.entries())
        .map(([route, count]) => ({
            route,
            count,
            pageGroup: pageGroupFromRoute(route),
        }))
        .sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.route.localeCompare(b.route);
        })
        .slice(0, 64);

    return new Response(
        JSON.stringify({
            scannedAt: new Date().toISOString(),
            count: focused.length,
            items: focused,
            filters: {
                focusAreas: FOCUS_AREAS.map((item) => ({
                    id: item.id,
                    label: item.label,
                    count: focusCounts.get(item.id) || 0,
                })).filter((item) => item.count > 0),
                pageGroups: PAGE_GROUPS.map((item) => ({
                    id: item.id,
                    label: item.label,
                    count: pageGroupCounts.get(item.id) || 0,
                })).filter((item) => item.count > 0),
                routes,
            },
        }),
        {
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "no-store",
            },
        },
    );
}
