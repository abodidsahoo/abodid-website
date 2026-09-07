import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import fs from "node:fs";

let env = process.env;
if (fs.existsSync(".env")) {
  const parsed = dotenv.parse(fs.readFileSync(".env"));
  env = { ...env, ...parsed };
}
if (fs.existsSync(".env.local")) {
  const parsedLocal = dotenv.parse(fs.readFileSync(".env.local"));
  env = { ...env, ...parsedLocal };
}

const accountId = env.R2_ACCOUNT_ID || "";
const accessKeyId = env.R2_ACCESS_KEY_ID || "";
const secretAccessKey = env.R2_SECRET_ACCESS_KEY || "";
const bucket = env.R2_BUCKET_NAME || "assets";
const endpoint = env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;
export const R2_PUBLIC_BASE_URL = (env.R2_PUBLIC_BASE_URL || "https://assets.abodid.com").replace(/\/$/, "");

const s3Client = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export async function uploadToR2({
  key,
  buffer,
  contentType,
  cacheControl = "public, max-age=31536000, immutable",
}: {
  key: string;
  buffer: Buffer;
  contentType: string;
  cacheControl?: string;
}) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: cacheControl,
  });

  await s3Client.send(command);
  const publicUrl = `${R2_PUBLIC_BASE_URL}/${key}`;
  return { key, publicUrl };
}
