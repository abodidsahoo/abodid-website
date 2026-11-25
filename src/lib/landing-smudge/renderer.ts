import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector4,
  VideoTexture,
  WebGLRenderer,
} from "three";
import { smudgeMediaUrl } from "./media";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uMedia;
  uniform vec2 uSize;
  uniform vec4 uCrop;
  uniform vec2 uPointer;
  uniform vec2 uPull;
  uniform float uRadius;
  uniform float uOpacity;
  varying vec2 vUv;

  vec4 readMedia(vec2 uv) {
    return texture2D(uMedia, vec2(uv.x, 1.0 - uv.y));
  }

  void main() {
    vec2 point = vec2(vUv.x, 1.0 - vUv.y) * uSize;
    vec2 uv = (point - uCrop.xy) / uCrop.zw;
    vec2 mediaEdge = min(uv, 1.0 - uv) * uCrop.zw;
    vec2 frameEdge = min(point, uSize - point);
    vec2 edge = min(mediaEdge, frameEdge);
    float clipping = smoothstep(0.0, 18.0, min(edge.x, edge.y));
    float falloff = 1.0 - smoothstep(0.0, uRadius, distance(point, uPointer));
    float mask = falloff * falloff * clipping;
    if (mask < 0.002) discard;

    vec2 shift = uPull * mask / uCrop.zw;
    vec2 warped = uv - shift;
    vec4 color = readMedia(warped) * 0.56
      + readMedia(warped + shift * 0.36) * 0.22
      + readMedia(warped - shift * 0.36) * 0.22;
    gl_FragColor = vec4(color.rgb, color.a * clamp(mask * uOpacity * 2.5, 0.0, 1.0));
  }
`;

type Media = HTMLImageElement | HTMLVideoElement;
type Hover = {
  host: HTMLElement;
  media: Media;
  source: string;
  point: Vector2;
  pendingPull: Vector2;
  texture?: Texture;
  contain: boolean;
  strength: number;
};

const sourceOf = (media: Media) => media.currentSrc || media.src;

export function createLandingSmudge() {
  const uniforms = {
    uMedia: { value: null as Texture | null },
    uSize: { value: new Vector2() },
    uCrop: { value: new Vector4() },
    uPointer: { value: new Vector2() },
    uPull: { value: new Vector2() },
    uRadius: { value: 0 },
    uOpacity: { value: 0 },
  };
  const pull = new Vector2();
  const point = new Vector2();
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 2);
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({
    vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const failedSources = new WeakMap<Media, string>();
  let graphicsUnavailable = false;
  let renderer: WebGLRenderer | undefined;
  let hover: Hover | undefined;
  let frameId = 0;
  let lastFrame = 0;

  function clear() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    lastFrame = 0;
    hover?.texture?.dispose();
    uniforms.uMedia.value = null;
    renderer?.domElement.remove();
    hover = undefined;
    pull.set(0, 0);
  }

  function graphicsFailed() {
    graphicsUnavailable = true;
    clear();
  }

  function getRenderer() {
    if (renderer) return renderer;
    renderer = new WebGLRenderer({
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
    });
    renderer.setClearColor(0, 0);
    renderer.debug.onShaderError = graphicsFailed;
    renderer.domElement.className = "landing-smudge-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.addEventListener("webglcontextlost", graphicsFailed);
    return renderer;
  }

  function schedule() {
    if (!frameId) frameId = requestAnimationFrame(draw);
  }

  function draw(time: number) {
    frameId = 0;
    const state = hover;
    if (!state?.texture || !state.host.isConnected || sourceOf(state.media) !== state.source) {
      clear();
      return;
    }

    const dt = lastFrame ? Math.min((time - lastFrame) / 1000, 0.05) : 1 / 60;
    lastFrame = time;
    pull.lerp(state.pendingPull, 1 - Math.exp(-22 * dt));
    state.pendingPull.multiplyScalar(Math.exp(-10 * dt));
    point.lerp(state.point, 1 - Math.exp(-27 * dt));
    const speed = pull.length();
    if (speed < 0.012 && state.pendingPull.length() < 0.012) {
      clear();
      return;
    }

    const { host, media } = state;
    const width = host.clientWidth;
    const height = host.clientHeight;
    const bounds = host.getBoundingClientRect();
    const frame = media.getBoundingClientRect();
    const mediaWidth = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
    const mediaHeight = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
    if (!width || !height || !mediaWidth || !mediaHeight) {
      clear();
      return;
    }

    // Match the centre crop, including the thumbnail's existing hover zoom.
    const scale = (state.contain ? Math.min : Math.max)(frame.width / mediaWidth, frame.height / mediaHeight);
    const cropWidth = mediaWidth * scale;
    const cropHeight = mediaHeight * scale;
    const left = bounds.left + host.clientLeft;
    const top = bounds.top + host.clientTop;
    uniforms.uCrop.value.set(
      frame.left - left + (frame.width - cropWidth) / 2,
      frame.top - top + (frame.height - cropHeight) / 2,
      cropWidth, cropHeight,
    );
    uniforms.uPointer.value.set(point.x - left, point.y - top);
    uniforms.uPull.value.copy(pull).multiplyScalar(Math.min(width, height) * state.strength);
    uniforms.uRadius.value = Math.min(138, Math.min(width, height) * 0.38);
    uniforms.uOpacity.value = Math.min(speed * 3, 1);
    uniforms.uMedia.value = state.texture;

    try {
      const gl = getRenderer();
      const canvas = gl.domElement;
      const firstFrame = canvas.parentElement !== host;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25, 960 / Math.max(width, height));
      if (pixelRatio !== gl.getPixelRatio()) gl.setPixelRatio(pixelRatio);
      if (width !== uniforms.uSize.value.x || height !== uniforms.uSize.value.y || firstFrame) {
        gl.setSize(width, height, false);
        uniforms.uSize.value.set(width, height);
      }
      gl.render(scene, camera);
      if (graphicsUnavailable) return;
      if (firstFrame) {
        // Check the first upload once. Subsequent frames avoid synchronous GPU queries.
        const context = gl.getContext();
        if (context.getError() !== context.NO_ERROR) throw new Error("Texture upload failed");
        host.append(canvas);
      }
      schedule();
    } catch {
      if (!renderer) graphicsUnavailable = true;
      failedSources.set(media, state.source);
      clear();
    }
  }

  async function prepareTexture(state: Hover) {
    try {
      if (state.media instanceof HTMLVideoElement) {
        state.texture = new VideoTexture(state.media);
      } else {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = smudgeMediaUrl(state.source);
        await image.decode();
        if (hover !== state) return;
        state.texture = new Texture(image);
      }
      // Upload the current video frame even when the decoder is paused.
      state.texture.needsUpdate = true;
      // DOM images and decoded video use display-encoded samples. The custom
      // shader moves these samples without lighting or a second color conversion.
      schedule();
    } catch {
      failedSources.set(state.media, state.source);
      if (hover === state) clear();
    }
  }

  function move(host: HTMLElement, event: PointerEvent, previous?: PointerEvent) {
    if (graphicsUnavailable || !previous) return;
    const media = host.querySelector<Media>("img, video");
    if (!media) return;
    const source = sourceOf(media);
    if (!source || failedSources.get(media) === source) return;
    const elapsed = Math.max((event.timeStamp - previous.timeStamp) / 1000, 1 / 240);
    const dx = event.clientX - previous.clientX;
    const dy = event.clientY - previous.clientY;
    if (!dx && !dy) return;

    if (hover?.host !== host || hover.media !== media || hover.source !== source) {
      clear();
      if (media instanceof HTMLVideoElement) {
        if (media.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        if (!media.crossOrigin && new URL(source, location.href).origin !== location.origin) return;
      } else if (!media.complete || media.naturalWidth < 2) {
        return;
      }

      point.set(event.clientX, event.clientY);
      hover = {
        host, media, source,
        point: point.clone(),
        pendingPull: new Vector2(),
        contain: getComputedStyle(media).objectFit === "contain",
        strength: host.dataset.smudge === "portrait" ? 0.070 : 0.085,
      };
      void prepareTexture(hover);
    }

    hover.point.set(event.clientX, event.clientY);
    hover.pendingPull.set(dx, dy).divideScalar(elapsed * 950).clampLength(0, 1.35);
    if (hover.texture) schedule();
  }

  return {
    move,
    clear,
    settle() {
      if (hover?.texture) hover.pendingPull.set(0, 0);
      else clear();
    },
    dispose() {
      clear();
      geometry.dispose();
      material.dispose();
      if (renderer) {
        renderer.domElement.removeEventListener("webglcontextlost", graphicsFailed);
        renderer.dispose();
        renderer.forceContextLoss();
      }
    },
  };
}
