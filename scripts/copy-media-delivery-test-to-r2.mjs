import fs from "node:fs";
import { createHash } from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

let env = { ...process.env };
if (fs.existsSync(".env")) Object.assign(env, dotenv.parse(fs.readFileSync(".env")));
if (fs.existsSync(".env.local")) {
  Object.assign(env, dotenv.parse(fs.readFileSync(".env.local")));
}

const required = (name) => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const supabase = createClient(
  required("PUBLIC_SUPABASE_URL"),
  env.SUPABASE_SERVICE_ROLE_KEY || required("PUBLIC_SUPABASE_ANON_KEY"),
);

const r2Bucket = env.R2_BUCKET_NAME || "assets";
const r2PublicBase = (env.R2_PUBLIC_BASE_URL || "https://assets.abodid.com").replace(
  /\/$/,
  "",
);
const r2 = new S3Client({
  region: "auto",
  endpoint:
    env.R2_ENDPOINT ||
    `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  },
});

const files = [
  {
    bucket: "films",
    path: "videos/Showreel 2025 compressed.mp4",
    key: "videos/showreel-2025-compressed.mp4",
    contentType: "video/mp4",
  },
  {
    bucket: "misc",
    path: "video-clips/Obsidian_Timelapse.mp4",
    key: "videos/obsidian-timelapse.mp4",
    contentType: "video/mp4",
  },
  {
    bucket: "blog",
    path: "articles/if-siri-finally-becomes-a-good-listener-the-future-is-bright/apple-events/siri-app-actions-mac.jpg",
    key: "documents/thumbnails/siri-app-actions-mac.jpg",
    contentType: "image/jpeg",
  },
  {
    bucket: "research",
    path: "covers/1769636977430_msh94w5fk.jpg",
    key: "documents/thumbnails/research-1769636977430-msh94w5fk.jpg",
    contentType: "image/jpeg",
  },
  {
    bucket: "research",
    path: "covers/1769634589720_dz93s7tr8.jpg",
    key: "documents/thumbnails/research-1769634589720-dz93s7tr8.jpg",
    contentType: "image/jpeg",
  },
  {
    bucket: "page-assets",
    path: "og-images/1768884087671_0himmkhnc.jpg",
    key: "documents/thumbnails/page-preview-1768884087671-0himmkhnc.jpg",
    contentType: "image/jpeg",
  },
];

const results = [];

for (const file of files) {
  const { data, error } = await supabase.storage.from(file.bucket).download(file.path);
  if (error || !data) {
    throw new Error(`Could not download ${file.bucket}/${file.path}: ${error?.message}`);
  }

  const body = Buffer.from(await data.arrayBuffer());
  const sha256 = createHash("sha256").update(body).digest("hex");

  await r2.send(
    new PutObjectCommand({
      Bucket: r2Bucket,
      Key: file.key,
      Body: body,
      ContentType: file.contentType,
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: {
        source: `supabase-${file.bucket}`,
        sha256,
      },
    }),
  );

  const uploaded = await r2.send(
    new HeadObjectCommand({ Bucket: r2Bucket, Key: file.key }),
  );
  if (uploaded.ContentLength !== body.length) {
    throw new Error(`Size verification failed for ${file.key}`);
  }

  results.push({
    source: `${file.bucket}/${file.path}`,
    destination: `${r2PublicBase}/${file.key}`,
    bytes: body.length,
    sha256,
  });
}

console.log(JSON.stringify({ copied: results.length, files: results }, null, 2));

