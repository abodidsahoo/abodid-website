import sharp from "sharp";

const clamp = (value, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

export async function measureXRImageQuality(bytes, url = "") {
  const image = sharp(bytes, { animated: false }).rotate();
  const metadata = await image.metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);

  if (!width || !height) throw new Error("Image dimensions could not be read.");

  const [{ data, info }, stats] = await Promise.all([
    image
      .clone()
      .resize(64, 64, { fit: "inside", withoutEnlargement: true })
      .removeAlpha()
      .toColorspace("srgb")
      .raw()
      .toBuffer({ resolveWithObject: true }),
    image.clone().stats(),
  ]);

  let saturationTotal = 0;
  let samples = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset] || 0;
    const green = data[offset + 1] ?? red;
    const blue = data[offset + 2] ?? red;
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    saturationTotal += maximum === 0 ? 0 : (maximum - minimum) / maximum;
    samples += 1;
  }

  const colorfulness = samples ? saturationTotal / samples : 0;
  const pixelArea = width * height;
  const resolutionScore = clamp(
    Math.log2(pixelArea / (480 * 270) + 1) /
      Math.log2((1920 * 1080) / (480 * 270) + 1),
  );
  const entropyScore = clamp(Number(stats.entropy || 0) / 8);
  const score = Math.round(
    35 + resolutionScore * 30 + clamp(colorfulness) * 25 + entropyScore * 10,
  );

  return {
    url,
    width,
    height,
    pixelArea,
    colorfulness: Number(colorfulness.toFixed(4)),
    entropy: Number(Number(stats.entropy || 0).toFixed(4)),
    score: clamp(score, 1, 100),
  };
}
