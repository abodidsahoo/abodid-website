import { useEffect, useRef } from "react";

const FALLBACK_PALETTE = [
  "#e9e0d3",
  "#d2b894",
  "#9c7860",
  "#5f675c",
  "#2d3230",
];

const FLOW_FRAME_MS = 48;
const FLOW_LOOP_START = -0.3;
const FLOW_LOOP_SPAN = 1.62;
const FLOW_FRAGMENT_COUNT = 240;
const FLOW_TRACE_COUNT = 112;

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

const deterministicUnit = (index, salt = 0) => {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43_758.5453;
  return value - Math.floor(value);
};

const FLOW_FRAGMENTS = Array.from(
  { length: FLOW_FRAGMENT_COUNT },
  (_, index) => {
    const isWide = index % 23 === 0;
    const isSquare = !isWide && index % 9 === 0;
    const sourceIndex = index % 10;

    return {
      index,
      source:
        sourceIndex < 4
          ? "punctum"
          : sourceIndex < 8
            ? "image"
            : "colour",
      x: -0.1 + deterministicUnit(index, 3) * 1.2,
      start: deterministicUnit(index, 5) * FLOW_LOOP_SPAN,
      speed: 0.026 + deterministicUnit(index, 7) * 0.068,
      width: isWide
        ? 0.055 + deterministicUnit(index, 11) * 0.1
        : 0.007 + deterministicUnit(index, 13) * 0.04,
      height: isWide
        ? 0.012 + deterministicUnit(index, 17) * 0.05
        : 0.003 + deterministicUnit(index, 19) * 0.022,
      isSquare,
      drift: 0.002 + deterministicUnit(index, 23) * 0.016,
      driftSpeed: 0.24 + deterministicUnit(index, 29) * 0.72,
      phase: deterministicUnit(index, 31) * Math.PI * 2,
      alpha: 0.24 + deterministicUnit(index, 37) * 0.58,
      trail: 0.5 + deterministicUnit(index, 41) * 3.4,
    };
  },
);

const FLOW_TRACES = Array.from({ length: FLOW_TRACE_COUNT }, (_, index) => {
  const isVertical = index % 8 === 0;

  return {
    index,
    isVertical,
    x: -0.12 + deterministicUnit(index, 47) * 1.24,
    start: deterministicUnit(index, 53) * FLOW_LOOP_SPAN,
    speed: 0.035 + deterministicUnit(index, 59) * 0.085,
    width: isVertical
      ? 0.001 + deterministicUnit(index, 61) * 0.002
      : 0.025 + deterministicUnit(index, 67) * 0.34,
    height: isVertical
      ? 0.035 + deterministicUnit(index, 71) * 0.2
      : 0.0015 + deterministicUnit(index, 73) * 0.006,
    drift: 0.001 + deterministicUnit(index, 79) * 0.012,
    phase: deterministicUnit(index, 83) * Math.PI * 2,
    alpha: 0.12 + deterministicUnit(index, 89) * 0.42,
  };
});

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

const getFlowY = (start, speed, elapsedSeconds) =>
  FLOW_LOOP_START + ((start + elapsedSeconds * speed) % FLOW_LOOP_SPAN);

const drawWrappedRect = ({ context, x, y, width, height, canvasWidth }) => {
  context.fillRect(x, y, width, height);
  if (x < 0) context.fillRect(x + canvasWidth, y, width, height);
  if (x + width > canvasWidth) {
    context.fillRect(x - canvasWidth, y, width, height);
  }
};

const drawFlowTraces = ({
  context,
  colours,
  canvasWidth,
  canvasHeight,
  elapsedSeconds,
}) => {
  context.save();
  context.globalCompositeOperation = "screen";

  FLOW_TRACES.forEach((trace) => {
    const width = Math.max(1, trace.width * canvasWidth);
    const height = Math.max(1, trace.height * canvasHeight);
    const drift =
      Math.sin(elapsedSeconds * 0.45 + trace.phase) *
      trace.drift *
      canvasWidth;
    const x = trace.x * canvasWidth + drift;
    const y =
      getFlowY(trace.start, trace.speed, elapsedSeconds) * canvasHeight;
    if (y + height < -8 || y > canvasHeight + 8) return;

    context.globalAlpha = trace.alpha;
    context.fillStyle = colours[(trace.index * 3 + 1) % colours.length];
    drawWrappedRect({ context, x, y, width, height, canvasWidth });

    if (trace.isVertical) {
      context.globalAlpha = trace.alpha * 0.22;
      drawWrappedRect({
        context,
        x,
        y: y - height * 1.7,
        width,
        height: height * 1.7,
        canvasWidth,
      });
    }
  });

  context.restore();
};

const drawFlowFragments = ({
  context,
  sourceTexture,
  punctumTexture,
  colours,
  canvasWidth,
  canvasHeight,
  elapsedSeconds,
}) => {
  FLOW_FRAGMENTS.forEach((fragment) => {
    const width = Math.max(3, fragment.width * canvasWidth);
    const height = fragment.isSquare
      ? width
      : Math.max(2, fragment.height * canvasHeight);
    const drift =
      Math.sin(elapsedSeconds * fragment.driftSpeed + fragment.phase) *
      fragment.drift *
      canvasWidth;
    const x = fragment.x * canvasWidth + drift;
    const y =
      getFlowY(fragment.start, fragment.speed, elapsedSeconds) * canvasHeight;
    if (y + height < -8 || y > canvasHeight + 8) return;

    context.save();
    context.globalAlpha = fragment.alpha;

    if (fragment.source === "colour") {
      context.fillStyle = colours[(fragment.index * 7 + 2) % colours.length];
      drawWrappedRect({ context, x, y, width, height, canvasWidth });
    } else {
      const texture =
        fragment.source === "punctum" ? punctumTexture : sourceTexture;
      const drawFragment = (drawX) =>
        drawTile({
          context,
          image: texture.image,
          bounds: texture.bounds,
          colours,
          index: fragment.index + 20,
          x: drawX,
          y,
          width,
          height,
        });

      drawFragment(x);
      if (x < 0) drawFragment(x + canvasWidth);
      if (x + width > canvasWidth) drawFragment(x - canvasWidth);
    }

    context.globalCompositeOperation = "screen";
    context.globalAlpha = fragment.alpha * 0.18;
    context.fillStyle = colours[(fragment.index + 1) % colours.length];
    drawWrappedRect({
      context,
      x,
      y: y - height * fragment.trail,
      width: Math.max(1, Math.min(3, width * 0.12)),
      height: height * fragment.trail,
      canvasWidth,
    });
    context.restore();
  });
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
    let sourceTexture = null;
    let punctumTexture = null;
    let animationFrame = 0;
    let lastPaintedAt = 0;
    const startedAt = performance.now();
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const drawBackdrop = () => {
      context.fillStyle = "#08050f";
      context.fillRect(0, 0, canvasWidth, canvasHeight);

      const gradient = context.createLinearGradient(
        0,
        0,
        canvasWidth,
        canvasHeight,
      );
      colours.forEach((colour, index) => {
        gradient.addColorStop(
          colours.length === 1 ? 0 : index / (colours.length - 1),
          colour,
        );
      });
      context.save();
      context.globalAlpha = 0.18;
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvasWidth, canvasHeight);

      const vignette = context.createRadialGradient(
        canvasWidth * 0.5,
        canvasHeight * 0.42,
        canvasHeight * 0.08,
        canvasWidth * 0.5,
        canvasHeight * 0.5,
        canvasWidth * 0.72,
      );
      vignette.addColorStop(0, "rgba(8, 5, 15, 0.06)");
      vignette.addColorStop(1, "rgba(3, 2, 8, 0.62)");
      context.fillStyle = vignette;
      context.globalAlpha = 1;
      context.fillRect(0, 0, canvasWidth, canvasHeight);

      context.globalCompositeOperation = "screen";
      context.globalAlpha = 0.055;
      context.fillStyle = "#ffffff";
      for (let y = 0; y < canvasHeight; y += 8) {
        context.fillRect(0, y, canvasWidth, 1);
      }
      context.restore();
    };

    const paint = (now) => {
      if (!reduceMotion && now - lastPaintedAt < FLOW_FRAME_MS) {
        animationFrame = requestAnimationFrame(paint);
        return;
      }
      lastPaintedAt = now;
      drawBackdrop();

      if (imageReady && sourceTexture && punctumTexture) {
        const elapsedSeconds = reduceMotion ? 0 : (now - startedAt) / 1_000;
        const common = {
          context,
          colours,
          canvasWidth,
          canvasHeight,
          elapsedSeconds,
        };
        drawFlowTraces(common);
        drawFlowFragments({
          ...common,
          sourceTexture,
          punctumTexture,
        });
      }

      if (!reduceMotion) {
        animationFrame = requestAnimationFrame(paint);
      }
    };

    image.onload = () => {
      sourceTexture = {
        image,
        bounds: {
          x: 0,
          y: 0,
          width: image.naturalWidth,
          height: image.naturalHeight,
        },
      };
      punctumTexture = createPunctumTexture(image, polygon);
      imageReady = true;
      lastPaintedAt = 0;
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
