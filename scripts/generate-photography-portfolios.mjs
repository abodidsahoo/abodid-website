import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(
  projectRoot,
  "src",
  "data",
  "photographyPortfolios.generated.json",
);
const tempOutputDir = path.join(
  "/tmp",
  "personal-site-photography-portfolios",
);

const BUCKET = "misc";
const STORAGE_PREFIX = "photography-portfolios";
const MAX_PAGE_EDGE = 1000;
const IMAGE_FETCH_CONCURRENCY = 8;
const RESUMABLE_CHUNK_SIZE = 6 * 1024 * 1024;
const REMOTE_UPLOAD_SOFT_LIMIT = 180 * 1024 * 1024;
const EXTERNAL_DOWNLOAD_OVERRIDES = {
  [`${STORAGE_PREFIX}/collections/abodid-complete-photography-portfolio.pdf`]:
    "https://drive.google.com/file/d/1bU6WqxZvVAakmhWrQwXGhVNtiUdm9DMO/view?usp=sharing",
};
const publicDownloadRoot = path.join(
  projectRoot,
  "public",
  "downloads",
);

dotenv.config({ path: path.resolve(projectRoot, ".env") });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function normalizeUrl(url) {
  return typeof url === "string" ? url.trim() : "";
}

function formatTag(value) {
  return String(value)
    .trim()
    .split(/\s+/)
    .map((segment) => {
      if (/^[A-Z0-9-]+$/.test(segment)) return segment;
      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
    })
    .join(" ");
}

function splitGenreTokens(value) {
  if (typeof value !== "string") return [];
  return value
    .split(/[|,/]+/g)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[|,/]+/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function pushUniqueLabel(labels, seen, value) {
  const normalized = normalizeUrl(value).toLowerCase();
  if (!normalized || seen.has(normalized)) return;
  seen.add(normalized);
  labels.push(value);
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

function buildPublicUrl(storagePath, downloadName) {
  const encodedPath = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const query = downloadName
    ? `?download=${encodeURIComponent(downloadName)}`
    : "";
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${encodedPath}${query}`;
}

function buildLocalDownloadUrl(storagePath) {
  const webPath = path.posix.join("/downloads", storagePath);
  return webPath;
}

function getDirectStorageUploadEndpoint() {
  const projectId = new URL(supabaseUrl).hostname.split(".")[0];
  return `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`;
}

function encodeTusMetadata(entries) {
  return Object.entries(entries)
    .map(([key, value]) => `${key} ${Buffer.from(String(value)).toString("base64")}`)
    .join(",");
}

async function uploadPdfResumable(storagePath, fileName, pdfBuffer) {
  const endpoint = getDirectStorageUploadEndpoint();
  const { error: removeError } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (
    removeError &&
    !String(removeError.message || "").toLowerCase().includes("not found")
  ) {
    throw removeError;
  }

  const creationResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "x-upsert": "true",
      "tus-resumable": "1.0.0",
      "upload-length": String(pdfBuffer.length),
      "upload-metadata": encodeTusMetadata({
        bucketName: BUCKET,
        objectName: storagePath,
        contentType: "application/pdf",
        cacheControl: "3600",
      }),
    },
  });

  if (!creationResponse.ok) {
    const details = await creationResponse.text();
    throw new Error(
      `Failed to start resumable upload for ${fileName}: ${creationResponse.status} ${details}`,
    );
  }

  const location = creationResponse.headers.get("location");
  if (!location) {
    throw new Error(`Missing upload location for ${fileName}`);
  }

  const uploadUrl = new URL(location, endpoint).toString();
  let offset = 0;
  let lastLoggedPercent = 0;

  while (offset < pdfBuffer.length) {
    const nextOffset = Math.min(offset + RESUMABLE_CHUNK_SIZE, pdfBuffer.length);
    const chunkBuffer = pdfBuffer.subarray(offset, nextOffset);
    const patchResponse = await fetch(uploadUrl, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "content-type": "application/offset+octet-stream",
        "tus-resumable": "1.0.0",
        "upload-offset": String(offset),
      },
      body: chunkBuffer,
    });

    if (!patchResponse.ok) {
      const details = await patchResponse.text();
      throw new Error(
        `Failed resumable chunk upload for ${fileName}: ${patchResponse.status} ${details}`,
      );
    }

    const uploadedOffset = Number(patchResponse.headers.get("upload-offset"));
    if (!Number.isFinite(uploadedOffset) || uploadedOffset <= offset) {
      throw new Error(`Invalid upload offset while uploading ${fileName}`);
    }

    offset = uploadedOffset;
    const percent = Math.floor((offset / pdfBuffer.length) * 100);
    if (percent >= lastLoggedPercent + 10 || offset === pdfBuffer.length) {
      lastLoggedPercent = percent;
      console.log(`Uploading ${fileName}: ${percent}%`);
    }
  }

  return buildPublicUrl(storagePath, fileName);
}

function extractProjectImageUrls(project) {
  const urls = [];
  const seen = new Set();

  const addUrl = (value) => {
    const normalized = normalizeUrl(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    urls.push(normalized);
  };

  addUrl(project.cover_image);

  for (const entry of Array.isArray(project.gallery_images)
    ? project.gallery_images
    : []) {
    addUrl(typeof entry === "string" ? entry : entry?.url);
  }

  return urls;
}

function scalePage(width, height) {
  const longestEdge = Math.max(width, height);
  const scale =
    longestEdge > MAX_PAGE_EDGE ? MAX_PAGE_EDGE / longestEdge : 1;

  return {
    width: Number((width * scale).toFixed(2)),
    height: Number((height * scale).toFixed(2)),
  };
}

function pdfNumber(value) {
  return Number(value).toFixed(2).replace(/\.00$/, "");
}

function buildStreamObject(dictionary, streamBuffer) {
  const header = Buffer.from(
    `${dictionary.replace(/>>$/, "")} /Length ${streamBuffer.length} >>\nstream\n`,
    "binary",
  );
  const footer = Buffer.from("\nendstream", "binary");
  return Buffer.concat([header, streamBuffer, footer]);
}

function buildPdfBuffer(title, images) {
  const objects = [];
  const reserveObject = () => {
    objects.push(null);
    return objects.length;
  };
  const setObject = (id, value) => {
    objects[id - 1] = Buffer.isBuffer(value)
      ? value
      : Buffer.from(String(value), "binary");
  };

  const catalogId = reserveObject();
  const pagesId = reserveObject();
  const infoId = reserveObject();

  const pageEntries = images.map(() => ({
    imageId: reserveObject(),
    contentId: reserveObject(),
    pageId: reserveObject(),
  }));

  pageEntries.forEach((entry, index) => {
    const image = images[index];
    const page = scalePage(image.width, image.height);
    const colorSpace =
      image.colorSpace === "gray" ? "/DeviceGray" : "/DeviceRGB";

    const imageObject = buildStreamObject(
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter /DCTDecode >>`,
      image.jpegBuffer,
    );

    const contentStream = Buffer.from(
      `q\n${pdfNumber(page.width)} 0 0 ${pdfNumber(page.height)} 0 0 cm\n/Im0 Do\nQ\n`,
      "binary",
    );

    const contentObject = buildStreamObject("<< >>", contentStream);

    setObject(entry.imageId, imageObject);
    setObject(entry.contentId, contentObject);
    setObject(
      entry.pageId,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pdfNumber(page.width)} ${pdfNumber(page.height)}] /Resources << /ProcSet [/PDF /ImageB /ImageC] /XObject << /Im0 ${entry.imageId} 0 R >> >> /Contents ${entry.contentId} 0 R >>`,
    );
  });

  setObject(
    pagesId,
    `<< /Type /Pages /Count ${pageEntries.length} /Kids [${pageEntries
      .map((entry) => `${entry.pageId} 0 R`)
      .join(" ")}] >>`,
  );
  setObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  setObject(
    infoId,
    `<< /Title (${String(title).replace(/[()\\]/g, "")}) /Author (Abodid Sahoo) /Producer (Codex) >>`,
  );

  let offset = 0;
  const offsets = [0];
  const segments = [Buffer.from("%PDF-1.7\n%\xFF\xFF\xFF\xFF\n", "binary")];
  offset += segments[0].length;

  objects.forEach((objectBuffer, index) => {
    offsets.push(offset);
    const wrapped = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`, "binary"),
      objectBuffer,
      Buffer.from("\nendobj\n", "binary"),
    ]);
    segments.push(wrapped);
    offset += wrapped.length;
  });

  const xrefStart = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  segments.push(Buffer.from(xref, "binary"));

  return Buffer.concat(segments);
}

async function fetchAllPhotographyProjects() {
  const { data, error } = await supabase
    .from("photography")
    .select(
      "id, title, slug, cover_image, gallery_images, category, tags, published, sort_order, created_at",
    )
    .eq("published", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function fetchAllPhotoStories() {
  const { data, error } = await supabase
    .from("photo_stories")
    .select("photo_url, is_art, is_commercial, genre");

  if (error) throw error;
  return data || [];
}

async function loadImageForPdf(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }

  const originalBuffer = Buffer.from(await response.arrayBuffer());
  const image = sharp(originalBuffer, { limitInputPixels: false });
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Missing image dimensions for ${url}`);
  }

  const isGray = ["b-w", "grey", "gray"].includes(metadata.space || "");
  const canEmbedOriginalJpeg =
    metadata.format === "jpeg" &&
    (metadata.orientation || 1) === 1 &&
    !metadata.hasAlpha &&
    (metadata.space === "srgb" || metadata.space === "rgb" || isGray);

  if (canEmbedOriginalJpeg) {
    return {
      url,
      width: metadata.width,
      height: metadata.height,
      colorSpace: isGray ? "gray" : "rgb",
      jpegBuffer: originalBuffer,
    };
  }

  const transformed = await image
    .rotate()
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .jpeg({
      quality: 100,
      chromaSubsampling: "4:4:4",
      mozjpeg: false,
    })
    .toBuffer();

  const normalizedMetadata = await sharp(transformed).metadata();

  if (!normalizedMetadata.width || !normalizedMetadata.height) {
    throw new Error(`Missing normalized image dimensions for ${url}`);
  }

  return {
    url,
    width: normalizedMetadata.width,
    height: normalizedMetadata.height,
    colorSpace: "rgb",
    jpegBuffer: transformed,
  };
}

async function uploadPdf(storagePath, fileName, pdfBuffer) {
  if (pdfBuffer.length > RESUMABLE_CHUNK_SIZE) {
    return uploadPdfResumable(storagePath, fileName, pdfBuffer);
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      cacheControl: "3600",
      upsert: true,
    });

  if (error) throw error;

  return buildPublicUrl(storagePath, fileName);
}

async function publishPdf(storagePath, fileName, pdfBuffer) {
  const externalDownloadUrl = EXTERNAL_DOWNLOAD_OVERRIDES[storagePath];
  if (externalDownloadUrl) {
    console.log(`Using external download for ${fileName}: ${externalDownloadUrl}`);
    return externalDownloadUrl;
  }

  const localOutputPath = path.join(publicDownloadRoot, storagePath);

  if (pdfBuffer.length > REMOTE_UPLOAD_SOFT_LIMIT) {
    await fs.mkdir(path.dirname(localOutputPath), { recursive: true });
    await fs.writeFile(localOutputPath, pdfBuffer);
    console.log(
      `Stored ${fileName} in public/downloads because it exceeds the remote upload ceiling.`,
    );
    return buildLocalDownloadUrl(storagePath);
  }

  try {
    return await uploadPdf(storagePath, fileName, pdfBuffer);
  } catch (error) {
    const errorText = String(error?.message || error);
    if (errorText.includes("413") || errorText.toLowerCase().includes("maximum size exceeded")) {
      await fs.mkdir(path.dirname(localOutputPath), { recursive: true });
      await fs.writeFile(localOutputPath, pdfBuffer);
      console.log(
        `Stored ${fileName} in public/downloads after remote upload hit a size ceiling.`,
      );
      return buildLocalDownloadUrl(storagePath);
    }
    throw error;
  }
}

function buildProjectLabels(project, projectImages, storyByUrl) {
  const labels = [];
  const seen = new Set();
  const hasArt = projectImages.some(
    (url) => Boolean(storyByUrl.get(url)?.is_art),
  );
  const hasCommercial = projectImages.some(
    (url) => Boolean(storyByUrl.get(url)?.is_commercial),
  );

  if (hasArt) pushUniqueLabel(labels, seen, "Art");
  if (hasCommercial) pushUniqueLabel(labels, seen, "Commercial");

  for (const url of projectImages) {
    for (const token of splitGenreTokens(storyByUrl.get(url)?.genre)) {
      pushUniqueLabel(labels, seen, formatTag(token));
    }
  }

  for (const value of toStringArray(project.category)) {
    pushUniqueLabel(labels, seen, value);
  }

  for (const value of toStringArray(project.tags)) {
    pushUniqueLabel(labels, seen, value);
  }

  return labels.slice(0, 6);
}

async function main() {
  console.log("Fetching photography metadata from Supabase...");

  const [projects, photoStories] = await Promise.all([
    fetchAllPhotographyProjects(),
    fetchAllPhotoStories(),
  ]);

  const storyByUrl = new Map(
    photoStories
      .map((row) => [normalizeUrl(row.photo_url), row])
      .filter(([url]) => Boolean(url)),
  );

  const projectRecords = projects.map((project) => {
    const imageUrls = extractProjectImageUrls(project);
    return {
      ...project,
      imageUrls,
    };
  });

  const allImageUrls = Array.from(
    new Set(projectRecords.flatMap((project) => project.imageUrls)),
  );
  const artUrls = Array.from(
    new Set(
      photoStories
        .filter((row) => row.is_art)
        .map((row) => normalizeUrl(row.photo_url))
        .filter(Boolean),
    ),
  );
  const commercialUrls = Array.from(
    new Set(
      photoStories
        .filter((row) => row.is_commercial)
        .map((row) => normalizeUrl(row.photo_url))
        .filter(Boolean),
    ),
  );

  console.log(
    `Found ${projectRecords.length} series, ${allImageUrls.length} unique images, ${artUrls.length} art-tagged images, and ${commercialUrls.length} commercial-tagged images.`,
  );

  const imageCache = new Map();
  const allImages = await mapWithConcurrency(
    allImageUrls,
    IMAGE_FETCH_CONCURRENCY,
    async (url, index) => {
      const prepared = await loadImageForPdf(url);
      imageCache.set(url, prepared);

      if ((index + 1) % 25 === 0 || index === allImageUrls.length - 1) {
        console.log(
          `Prepared ${index + 1}/${allImageUrls.length} images for PDF export...`,
        );
      }

      return prepared;
    },
  );

  if (allImages.length !== allImageUrls.length) {
    throw new Error("Image cache did not hydrate correctly.");
  }

  await fs.mkdir(tempOutputDir, { recursive: true });

  const collectionDefinitions = [
    {
      id: "art",
      title: "Art Portfolio",
      description:
        "Art-tagged photographs drawn from the wider portfolio, centered on experimentation, exhibitions, and image-making as a visual language.",
      labels: ["Art", "Experimental", "Exhibition"],
      fileName: "abodid-art-portfolio.pdf",
      storagePath: `${STORAGE_PREFIX}/collections/abodid-art-portfolio.pdf`,
      imageUrls: artUrls,
    },
    {
      id: "commercial",
      title: "Commercial Portfolio",
      description:
        "Commercial-tagged photographs spanning fashion, events, commissioned portraiture, and work shaped for collaborators and clients.",
      labels: ["Commercial", "Fashion", "Events"],
      fileName: "abodid-commercial-portfolio.pdf",
      storagePath: `${STORAGE_PREFIX}/collections/abodid-commercial-portfolio.pdf`,
      imageUrls: commercialUrls,
    },
    {
      id: "complete",
      title: "Complete Portfolio",
      description:
        "The full 404-image photography archive across experimental work, fashion-led frames, events, portraits, and street observation.",
      labels: ["Experimental", "Fashion", "Events", "Street"],
      fileName: "abodid-complete-photography-portfolio.pdf",
      storagePath: `${STORAGE_PREFIX}/collections/abodid-complete-photography-portfolio.pdf`,
      imageUrls: allImageUrls,
    },
  ];

  const collectionManifest = [];
  for (const collection of collectionDefinitions) {
    console.log(
      `Generating ${collection.title} (${collection.imageUrls.length} images)...`,
    );

    const pdfImages = collection.imageUrls.map((url) => imageCache.get(url));
    const pdfBuffer = buildPdfBuffer(collection.title, pdfImages);
    const localPath = path.join(tempOutputDir, collection.fileName);

    await fs.writeFile(localPath, pdfBuffer);
    const downloadUrl = await publishPdf(
      collection.storagePath,
      collection.fileName,
      pdfBuffer,
    );

    collectionManifest.push({
      id: collection.id,
      title: collection.title,
      description: collection.description,
      labels: collection.labels,
      imageCount: collection.imageUrls.length,
      downloadName: collection.fileName,
      downloadUrl,
    });

    console.log(`Uploaded ${collection.title} to ${collection.storagePath}`);
  }

  const storyManifest = [];
  for (const project of projectRecords) {
    const fileName = `abodid-${project.slug}.pdf`;
    const storagePath = `${STORAGE_PREFIX}/stories/${fileName}`;
    const pdfTitle = `${project.title} Portfolio`;

    console.log(`Generating ${project.title} (${project.imageUrls.length} images)...`);

    const pdfImages = project.imageUrls.map((url) => imageCache.get(url));
    const pdfBuffer = buildPdfBuffer(pdfTitle, pdfImages);
    const localPath = path.join(tempOutputDir, fileName);
    const labels = buildProjectLabels(project, project.imageUrls, storyByUrl);

    await fs.writeFile(localPath, pdfBuffer);
    const downloadUrl = await publishPdf(storagePath, fileName, pdfBuffer);

    storyManifest.push({
      slug: project.slug,
      title: project.title,
      projectHref: `/photography/${project.slug}`,
      coverImage: normalizeUrl(project.cover_image) || project.imageUrls[0] || "",
      imageCount: project.imageUrls.length,
      downloadName: fileName,
      downloadUrl,
      labels,
      hasArt: project.imageUrls.some(
        (url) => Boolean(storyByUrl.get(url)?.is_art),
      ),
      hasCommercial: project.imageUrls.some(
        (url) => Boolean(storyByUrl.get(url)?.is_commercial),
      ),
    });

    console.log(`Uploaded ${project.title} to ${storagePath}`);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    summary: {
      seriesCount: projectRecords.length,
      totalImages: allImageUrls.length,
      artImageCount: artUrls.length,
      commercialImageCount: commercialUrls.length,
    },
    collections: collectionManifest,
    stories: storyManifest,
  };

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Manifest written to ${manifestPath}`);
  console.log(`Temporary PDFs saved to ${tempOutputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
