import { useEffect, useRef } from "react";

const FALLBACK_PALETTE = [
  "#e9e0d3",
  "#d2b894",
  "#9c7860",
  "#5f675c",
  "#2d3230",
];

const GLITCH_STEP_MS = 90;
const GLITCH_CYCLE_STEPS = 120;

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

const deterministicUnit = (index, salt = 0) => {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43_758.5453;
  return value - Math.floor(value);
};

const getNormalizedPolygon = (polygon) =>
  (
    Array.isArray(polygon) && polygon.length >= 3
      ? polygon
      : [
          { x: 0.35, y: 0.35 },
          { x: 0.65, y: 0.35 },
          { x: 0.65, y: 0.65 },
          { x: 0.35, y: 0.65 },
        ]
  ).map((point) => ({
    x: clamp(Number(point.x) || 0, 0, 1),
    y: clamp(Number(point.y) || 0, 0, 1),
  }));

const getPunctumBounds = (polygon, imageWidth, imageHeight) => {
  const points = getNormalizedPolygon(polygon);
  const xs = points.map((point) => clamp(Number(point.x) || 0, 0, 1));
  const ys = points.map((point) => clamp(Number(point.y) || 0, 0, 1));
  const minimumX = Math.min(...xs);
  const maximumX = Math.max(...xs);
  const minimumY = Math.min(...ys);
  const maximumY = Math.max(...ys);
  const rawWidth = Math.max(2, (maximumX - minimumX) * imageWidth);
  const rawHeight = Math.max(2, (maximumY - minimumY) * imageHeight);
  const padding = Math.max(1, Math.min(rawWidth, rawHeight) * 0.035);
  const x = clamp(minimumX * imageWidth - padding, 0, imageWidth - 2);
  const y = clamp(minimumY * imageHeight - padding, 0, imageHeight - 2);

  return {
    x,
    y,
    width: Math.min(imageWidth - x, rawWidth + padding * 2),
    height: Math.min(imageHeight - y, rawHeight + padding * 2),
  };
};

const createPunctumTexture = (image, polygon) => {
  const sourceBounds = getPunctumBounds(
    polygon,
    image.naturalWidth,
    image.naturalHeight,
  );
  const maximumTextureSide = 1_200;
  const scale = Math.min(
    1,
    maximumTextureSide / Math.max(sourceBounds.width, sourceBounds.height),
  );
  const texture = document.createElement("canvas");
  texture.width = Math.max(2, Math.ceil(sourceBounds.width * scale));
  texture.height = Math.max(2, Math.ceil(sourceBounds.height * scale));
  const textureContext = texture.getContext("2d");
  if (!textureContext) {
    return { image, bounds: sourceBounds };
  }

  textureContext.imageSmoothingEnabled = true;
  textureContext.imageSmoothingQuality = "high";
  textureContext.scale(scale, scale);
  textureContext.translate(-sourceBounds.x, -sourceBounds.y);
  const points = getNormalizedPolygon(polygon);
  textureContext.beginPath();
  points.forEach((point, index) => {
    const x = point.x * image.naturalWidth;
    const y = point.y * image.naturalHeight;
    if (index === 0) textureContext.moveTo(x, y);
    else textureContext.lineTo(x, y);
  });
  textureContext.closePath();
  textureContext.clip();
  textureContext.drawImage(image, 0, 0);

  return {
    image: texture,
    bounds: {
      x: 0,
      y: 0,
      width: texture.width,
      height: texture.height,
    },
  };
};

const cropSourceToAspect = (source, aspect) => {
  let width = source.width;
  let height = source.height;
  const sourceAspect = width / height;
  if (sourceAspect > aspect) {
    width = height * aspect;
  } else {
    height = width / aspect;
  }
  return {
    x: source.x + (source.width - width) / 2,
    y: source.y + (source.height - height) / 2,
    width,
    height,
  };
};

const getSourceFragment = (bounds, index, aspect) => {
  const scale = [0.3, 0.42, 0.54, 0.68][index % 4];
  const width = bounds.width * scale;
  const height = bounds.height * scale;
  const fragment = {
    x: bounds.x + (bounds.width - width) * deterministicUnit(index, 2),
    y: bounds.y + (bounds.height - height) * deterministicUnit(index, 7),
    width,
    height,
  };
  return cropSourceToAspect(fragment, Math.max(0.1, aspect));
};

const drawTile = ({
  context,
  image,
  bounds,
  colours,
  index,
  x,
  y,
  width,
  height,
  contain = false,
}) => {
  if (width < 2 || height < 2) return;
  const frame = Math.max(1, Math.min(3, Math.round(Math.min(width, height) * 0.025)));
  context.fillStyle = colours[index % colours.length];
  context.fillRect(
    Math.round(x),
    Math.round(y),
    Math.ceil(width),
    Math.ceil(height),
  );

  const innerX = x + frame;
  const innerY = y + frame;
  const innerWidth = Math.max(1, width - frame * 2);
  const innerHeight = Math.max(1, height - frame * 2);
  if (contain) {
    const scale = Math.min(
      innerWidth / bounds.width,
      innerHeight / bounds.height,
    );
    const destinationWidth = bounds.width * scale;
    const destinationHeight = bounds.height * scale;
    context.drawImage(
      image,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      innerX + (innerWidth - destinationWidth) / 2,
      innerY + (innerHeight - destinationHeight) / 2,
      destinationWidth,
      destinationHeight,
    );
    return;
  }

  const source = getSourceFragment(bounds, index, innerWidth / innerHeight);
  context.drawImage(
    image,
    source.x,
    source.y,
    source.width,
    source.height,
    innerX,
    innerY,
    innerWidth,
    innerHeight,
  );
};

const drawScatteredBackdrop = ({
  context,
  image,
  bounds,
  colours,
  canvasWidth,
  canvasHeight,
}) => {
  const columns = 9;
  const rows = 6;
  const cellWidth = canvasWidth / columns;
  const cellHeight = canvasHeight / rows;

  context.save();
  context.globalAlpha = 0.66;
  for (let index = 0; index < 34; index += 1) {
    const mapped = (index * 17 + 5) % (columns * rows);
    const column = mapped % columns;
    const row = Math.floor(mapped / columns);
    const isLarge = index % 11 === 0;
    const isWide = !isLarge && index % 6 === 0;
    const width = cellWidth * (isLarge ? 2.65 : isWide ? 1.7 : 0.94);
    const height = cellHeight * (isLarge ? 2.05 : index % 4 === 0 ? 0.56 : 0.9);
    drawTile({
      context,
      image,
      bounds,
      colours,
      index: index + 20,
      x: clamp(
        column * cellWidth +
          (deterministicUnit(index, 31) - 0.5) * cellWidth * 0.48,
        0,
        canvasWidth - width,
      ),
      y: clamp(
        row * cellHeight +
          (deterministicUnit(index, 37) - 0.5) * cellHeight * 0.42,
        0,
        canvasHeight - height,
      ),
      width,
      height,
      contain: isLarge,
    });
  }
  context.restore();
};

const drawGlitchOverlay = ({
  context,
  image,
  bounds,
  colours,
  canvasWidth,
  canvasHeight,
  step,
}) => {
  const stripHeight = canvasHeight / 17;
  for (let index = 0; index < 13; index += 1) {
    const height = Math.max(
      3,
      stripHeight * (index % 5 === 0 ? 1.35 : 0.38),
    );
    const width =
      canvasWidth * (index % 3 === 0 ? 0.72 : index % 3 === 1 ? 0.42 : 0.24);
    const jump =
      (((step + index * 3) % 9) - 4) * (canvasWidth * 0.018);
    const x =
      deterministicUnit(index + step, 13) *
        Math.max(1, canvasWidth - width) +
      jump;
    const y =
      deterministicUnit(index + step * 2, 17) *
      Math.max(1, canvasHeight - height);
    drawTile({
      context,
      image,
      bounds,
      colours,
      index: index + step + 70,
      x: clamp(x, 0, canvasWidth - width),
      y: clamp(y, 0, canvasHeight - height),
      width,
      height,
    });
  }

  for (let index = 0; index < 7; index += 1) {
    const size = canvasHeight * (index % 3 === 0 ? 0.16 : 0.085);
    drawTile({
      context,
      image,
      bounds,
      colours,
      index: index + step + 110,
      x: clamp(
        deterministicUnit(index + step, 19) * canvasWidth,
        0,
        canvasWidth - size,
      ),
      y: clamp(
        deterministicUnit(index + step, 23) * canvasHeight,
        0,
        canvasHeight - size,
      ),
      width: size,
      height: size,
      contain: index % 3 === 0,
    });
  }

  context.save();
  context.globalCompositeOperation = "screen";
  context.globalAlpha = 0.72;
  for (let index = 0; index < 9; index += 1) {
    context.fillStyle = colours[(step + index) % colours.length];
    const width =
      canvasWidth * (0.08 + deterministicUnit(index + step, 43) * 0.34);
    const height = index % 3 === 0 ? 3 : 1;
    context.fillRect(
      deterministicUnit(index + step, 47) * Math.max(1, canvasWidth - width),
      deterministicUnit(index + step, 53) * canvasHeight,
      width,
      height,
    );
  }
  context.restore();
};

export default function PunctumBuildCanvas({
  palette,
  width,
  height,
  active,
  imageUrl,
  polygon,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active || !imageUrl) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ratio = width > 0 && height > 0 ? width / height : 1.5;
    const canvasWidth = 960;
    const canvasHeight = Math.max(320, Math.round(canvasWidth / ratio));
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const colours = palette?.length ? palette : FALLBACK_PALETTE;
    const image = new Image();
    image.decoding = "async";
    let imageReady = false;
    let punctumTexture = null;
    let animationFrame = 0;
    let lastStep = -1;
    const startedAt = performance.now();
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const drawBackdrop = () => {
      context.fillStyle = colours[colours.length - 1];
      context.fillRect(0, 0, canvasWidth, canvasHeight);
      const seam = Math.max(2, Math.round(canvasWidth / 320));
      for (let index = 0; index < colours.length; index += 1) {
        context.fillStyle = colours[index];
        context.fillRect(
          index * (canvasWidth / colours.length),
          0,
          seam,
          canvasHeight,
        );
      }
    };

    const paint = (now) => {
      const step = reduceMotion
        ? 0
        : Math.floor((now - startedAt) / GLITCH_STEP_MS) %
          GLITCH_CYCLE_STEPS;
      if (!reduceMotion && step === lastStep) {
        animationFrame = requestAnimationFrame(paint);
        return;
      }
      lastStep = step;
      drawBackdrop();

      if (imageReady && punctumTexture) {
        const common = {
          context,
          image: punctumTexture.image,
          bounds: punctumTexture.bounds,
          colours,
          canvasWidth,
          canvasHeight,
        };
        drawScatteredBackdrop(common);
        if (!reduceMotion) drawGlitchOverlay({ ...common, step });
      }

      if (!reduceMotion) {
        animationFrame = requestAnimationFrame(paint);
      }
    };

    image.onload = () => {
      punctumTexture = createPunctumTexture(image, polygon);
      imageReady = true;
      lastStep = -1;
      if (reduceMotion) paint(performance.now());
    };
    image.src = imageUrl;
    animationFrame = requestAnimationFrame(paint);

    return () => {
      image.onload = null;
      cancelAnimationFrame(animationFrame);
    };
  }, [active, height, imageUrl, palette, polygon, width]);

  return (
    <canvas
      ref={canvasRef}
      className="punctum-world-pixels"
      aria-hidden="true"
    />
  );
}
