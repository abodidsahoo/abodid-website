import { useEffect, useRef, useState } from 'react';
import handsModule, { type Results } from '@mediapipe/hands';
import cameraUtilsModule from '@mediapipe/camera_utils';
import type {
    AnnotatedPrediction as TensorFlowHandposePrediction,
    HandPose as TensorFlowHandposeModel,
} from '@tensorflow-models/handpose';

const { Hands } = handsModule;
const { Camera } = cameraUtilsModule;
const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
const PINCH_ENGAGE_THRESHOLD = 0.34;
const PINCH_RELEASE_THRESHOLD = 0.5;
const PINCH_SCALE_DEADBAND = 0.012;
const PINCH_RELEASE_CONFIRM_MS = 72;
const FINGER_GESTURE_THRESHOLD_RATIO = 0.84;
const FINGER_GESTURE_COOLDOWN_RATIO = 0.9;
const FINGER_GESTURE_MIN_THRESHOLD = 18;
const FINGER_GESTURE_MIN_COOLDOWN = 56;
const FINGER_GESTURE_DISTANCE_GAIN = 1.08;
const FINGER_GESTURE_SPEED_WEIGHT = 11;
const FINGER_GESTURE_VECTOR_BLEND = 0.34;
const FINGER_GESTURE_PATH_DECAY = 0.52;
const FINGER_GESTURE_PATH_GAIN = 1.02;
const FINGER_GESTURE_RESIDUAL_AFTER_TRIGGER = 0.28;
const PREVIEW_DISPLAY_WIDTH = 480;
const PREVIEW_THRESHOLD_CUTOFF = 100;
const TENSORFLOW_CAMERA_WIDTH = 640;
const TENSORFLOW_CAMERA_HEIGHT = 480;
const TENSORFLOW_DETECTION_MAX_WIDTH = 480;
const DOT_MATRIX_STEP = 4;
const DOT_MATRIX_RADIUS_MIN = 0.45;
const DOT_MATRIX_RADIUS_MAX = 2.15;
const DOT_MATRIX_CONTRAST = 1.38;
const DOT_MATRIX_SHADOW_TONE = { r: 168, g: 34, b: 22 };
const DOT_MATRIX_HIGHLIGHT_TONE = { r: 247, g: 242, b: 232 };
const DOT_MATRIX_BACKGROUND = '#030303';
const LANDMARK_STROKE = 'rgba(247, 242, 232, 0.9)';
const LANDMARK_FILL = '#fff7ec';
const LANDMARK_ACCENT = '#ff6a1f';
const TAU = Math.PI * 2;

type PreviewMode = 'threshold' | 'dot-matrix';
type HandTrackingEngine = 'mediapipe' | 'tensorflow';

interface HandLandmark {
    x: number;
    y: number;
    z?: number;
}

interface HandIdentityFrame {
    x: number;
    y: number;
    timestamp: number;
}

interface HandFrame {
    id: string;
    landmarks: HandLandmark[];
    center: { x: number; y: number };
    pinchPoint: { x: number; y: number };
    palmSpan: number;
    pinchDistance: number;
    normalizedPinchDistance: number;
    movement: number;
    timestamp: number;
}

interface RgbTone {
    r: number;
    g: number;
    b: number;
}

type PinchEndReason = 'release' | 'hand_lost';
type PinchMode = 'dual-hand-distance' | 'single-hand-horizontal';

const distanceBetween = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

const getMidpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
});

const getPalmSpan = (landmarks: HandLandmark[]) =>
    Math.max(
        distanceBetween(landmarks[5], landmarks[17]),
        distanceBetween(landmarks[0], landmarks[9]),
        0.08,
    );

const getHandCenter = (landmarks: HandLandmark[]) => ({
    x: (
        landmarks[0].x +
        landmarks[5].x +
        landmarks[9].x +
        landmarks[17].x
    ) / 4,
    y: (
        landmarks[0].y +
        landmarks[5].y +
        landmarks[9].y +
        landmarks[17].y
    ) / 4,
});

const getFingerClusterCenter = (landmarks: HandLandmark[]) => ({
    x: (
        landmarks[8].x +
        landmarks[12].x +
        landmarks[16].x +
        landmarks[20].x
    ) / 4,
    y: (
        landmarks[8].y +
        landmarks[12].y +
        landmarks[16].y +
        landmarks[20].y
    ) / 4,
});

const getExtendedFingerCount = (landmarks: HandLandmark[]) => {
    const wrist = landmarks[0];
    const fingerPairs: Array<[number, number]> = [
        [8, 6],
        [12, 10],
        [16, 14],
        [20, 18],
    ];

    return fingerPairs.reduce((count, [tipIndex, pipIndex]) => {
        const tipDistance = distanceBetween(landmarks[tipIndex], wrist);
        const pipDistance = distanceBetween(landmarks[pipIndex], wrist);
        return count + (tipDistance > (pipDistance * 1.12) ? 1 : 0);
    }, 0);
};

const isOpenHandFrame = (landmarks: HandLandmark[]) =>
    getExtendedFingerCount(landmarks) >= 3;

export type OnboardingState =
    | 'requesting_camera'
    | 'loading_model'
    | 'waiting_for_hand'
    | 'calibrating'
    | 'ready'
    | 'hand_lost_temporarily'  // NEW: temporary loss, don't reset immediately
    | 'error';

export interface HandPosition {
    x: number;
    y: number;
    timestamp: number;
}

export interface HandMotionMetrics {
    x: number;
    y: number;
    normalizedX: number;
    normalizedY: number;
    dx: number;
    dy: number;
    dt: number;
    distance: number;
    speed: number;
    angle: number;
    timestamp: number;
}

export interface HandPinchMetrics {
    phase: 'start' | 'move' | 'end';
    isPinching: boolean;
    distance: number;
    normalizedDistance: number;
    scale: number;
    deltaScale: number;
    strength: number;
    timestamp: number;
    pairDetected?: boolean;
    endedBy?: PinchEndReason;
    mode?: PinchMode;
    x?: number;
    y?: number;
    normalizedX?: number;
    normalizedY?: number;
    dx?: number;
    dy?: number;
    travelX?: number;
    travelY?: number;
}

export interface UseHandTrackingProps {
    onGesture?: (dx: number, dy: number, angle: number) => void;
    onHandMove?: (metrics: HandMotionMetrics) => void;
    onPinchChange?: (metrics: HandPinchMetrics) => void;
    threshold?: number;
    gestureCooldownMs?: number;
    isActive?: boolean;
    motionSource?: 'index' | 'hand' | 'fingerCluster';
    gestureMotionSource?: 'index' | 'hand' | 'fingerCluster';
    requireOpenHand?: boolean;
    gestureMode?: 'default' | 'finger' | 'hand';
    pinchMode?: PinchMode;
    pinchHorizontalTravelPx?: number;
    pinchEngageThreshold?: number;
    pinchReleaseThreshold?: number;
    pinchIntentHoldMs?: number;
    previewMode?: PreviewMode;
    engine?: HandTrackingEngine;
    tensorflowModelType?: 'lite' | 'full';
}

const smoothstep = (edge0: number, edge1: number, value: number) => {
    if (edge0 === edge1) return value < edge0 ? 0 : 1;
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - (2 * t));
};

const mixTone = (from: RgbTone, to: RgbTone, amount: number) => ({
    r: Math.round(from.r + ((to.r - from.r) * amount)),
    g: Math.round(from.g + ((to.g - from.g) * amount)),
    b: Math.round(from.b + ((to.b - from.b) * amount)),
});

const drawThresholdPreview = (
    ctx: CanvasRenderingContext2D,
    sourceCtx: CanvasRenderingContext2D,
    width: number,
    height: number,
) => {
    const imageData = sourceCtx.getImageData(0, 0, width, height);
    const { data } = imageData;

    for (let index = 0; index < data.length; index += 4) {
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const gray = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
        const value = gray > PREVIEW_THRESHOLD_CUTOFF ? 45 : 15;
        data[index] = value;
        data[index + 1] = value;
        data[index + 2] = value;
    }

    ctx.putImageData(imageData, 0, 0);
};

const drawDotMatrixPreview = (
    ctx: CanvasRenderingContext2D,
    sourceCtx: CanvasRenderingContext2D,
    width: number,
    height: number,
) => {
    const imageData = sourceCtx.getImageData(0, 0, width, height);
    const { data } = imageData;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = DOT_MATRIX_BACKGROUND;
    ctx.fillRect(0, 0, width, height);

    for (let y = 0; y < height; y += DOT_MATRIX_STEP) {
        for (let x = 0; x < width; x += DOT_MATRIX_STEP) {
            const sampleX = Math.min(width - 1, x);
            const sampleY = Math.min(height - 1, y);
            const pixelIndex = ((sampleY * width) + sampleX) * 4;
            const r = data[pixelIndex];
            const g = data[pixelIndex + 1];
            const b = data[pixelIndex + 2];
            const luminance = ((0.2126 * r) + (0.7152 * g) + (0.0722 * b)) / 255;
            const contrasted = clamp((((luminance - 0.5) * DOT_MATRIX_CONTRAST) + 0.5), 0, 1);
            const density = smoothstep(0.04, 0.96, contrasted);
            const highlightMix = smoothstep(0.5, 0.92, contrasted);
            const tone = mixTone(DOT_MATRIX_SHADOW_TONE, DOT_MATRIX_HIGHLIGHT_TONE, highlightMix);
            const radius =
                DOT_MATRIX_RADIUS_MIN +
                ((DOT_MATRIX_RADIUS_MAX - DOT_MATRIX_RADIUS_MIN) * density);
            const alpha = 0.16 + (density * 0.82);

            ctx.beginPath();
            ctx.fillStyle = `rgba(${tone.r}, ${tone.g}, ${tone.b}, ${alpha})`;
            ctx.arc(
                x + (DOT_MATRIX_STEP * 0.5),
                y + (DOT_MATRIX_STEP * 0.5),
                radius,
                0,
                TAU,
            );
            ctx.fill();
        }
    }
};

export const useHandTracking = ({
    onGesture,
    onHandMove,
    onPinchChange,
    threshold = 150,
    gestureCooldownMs = 130,
    isActive = true,
    motionSource = 'index',
    gestureMotionSource,
    requireOpenHand = false,
    gestureMode = 'default',
    pinchMode = 'dual-hand-distance',
    pinchHorizontalTravelPx,
    pinchEngageThreshold,
    pinchReleaseThreshold,
    pinchIntentHoldMs,
    previewMode = 'threshold',
    engine = 'mediapipe',
    tensorflowModelType = 'full',
}: UseHandTrackingProps) => {
    const [onboardingState, setOnboardingState] = useState<OnboardingState>('requesting_camera');
    const [isTracking, setIsTracking] = useState(false);
    const [handDetected, setHandDetected] = useState(false);
    const [indexTipPoint, setIndexTipPoint] = useState<{ x: number; y: number } | null>(null);
    const [isOpenHandDetected, setIsOpenHandDetected] = useState(false);

    // Update ref whenever state changes
    useEffect(() => {
        onboardingStateRef.current = onboardingState;
        console.log('🔄 State updated:', onboardingState);
    }, [onboardingState]);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const handsRef = useRef<Hands | null>(null);
    const cameraRef = useRef<Camera | null>(null);
    const detectorRef = useRef<TensorFlowHandposeModel | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const previewAnimationFrameRef = useRef<number | null>(null);
    const detectionBufferCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const lastHandPosRef = useRef<HandPosition>({ x: 0, y: 0, timestamp: 0 });
    const handDetectionTimerRef = useRef<NodeJS.Timeout | null>(null);
    const calibrationStartRef = useRef<number | null>(null);
    const onboardingStateRef = useRef<OnboardingState>('requesting_camera');
    const handLossTimerRef = useRef<NodeJS.Timeout | null>(null);  // NEW: track hand loss duration
    const lastIndexTipEmitRef = useRef(0);
    const hasIndexTipPointRef = useRef(false);
    const lastGestureTriggerRef = useRef(0);
    const lastTrackedHandIdRef = useRef<string | null>(null);
    const lastGesturePosRef = useRef<HandPosition>({ x: 0, y: 0, timestamp: 0 });
    const fingerGestureDxRef = useRef(0);
    const fingerGestureDyRef = useRef(0);
    const fingerGesturePathRef = useRef(0);
    const pinchActiveRef = useRef(false);
    const pinchStartDistanceRef = useRef(0);
    const pinchLastScaleRef = useRef(1);
    const pinchLastDistanceRef = useRef(0);
    const pinchLastNormalizedDistanceRef = useRef(1);
    const pinchHandIdsRef = useRef<string[]>([]);
    const pinchReleaseStartedAtRef = useRef<number | null>(null);
    const handIdentityFramesRef = useRef<Record<string, HandIdentityFrame>>({});
    const gestureThresholdRef = useRef(threshold);
    const gestureCooldownRef = useRef(gestureCooldownMs);
    const motionSourceRef = useRef<'index' | 'hand' | 'fingerCluster'>(motionSource);
    const gestureMotionSourceRef = useRef<'index' | 'hand' | 'fingerCluster'>(
        gestureMotionSource ?? motionSource,
    );
    const onGestureRef = useRef(onGesture);
    const onHandMoveRef = useRef(onHandMove);
    const onPinchChangeRef = useRef(onPinchChange);
    const requireOpenHandRef = useRef(requireOpenHand);
    const gestureModeRef = useRef<'default' | 'finger' | 'hand'>(gestureMode);
    const pinchModeRef = useRef<PinchMode>(pinchMode);
    const pinchHorizontalTravelPxRef = useRef<number | null>(pinchHorizontalTravelPx ?? null);
    const pinchEngageThresholdRef = useRef<number | null>(pinchEngageThreshold ?? null);
    const pinchReleaseThresholdRef = useRef<number | null>(pinchReleaseThreshold ?? null);
    const pinchIntentHoldMsRef = useRef<number | null>(pinchIntentHoldMs ?? null);
    const pinchStartPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const pinchLastPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const pinchIntentStartedAtRef = useRef<number | null>(null);
    const pinchIntentHandIdRef = useRef<string | null>(null);
    const previewModeRef = useRef<PreviewMode>(previewMode);
    const previewBufferCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const engineRef = useRef<HandTrackingEngine>(engine);
    const tensorflowModelTypeRef = useRef<'lite' | 'full'>(tensorflowModelType);

    useEffect(() => {
        gestureThresholdRef.current = threshold;
    }, [threshold]);

    useEffect(() => {
        previewModeRef.current = previewMode;
    }, [previewMode]);

    useEffect(() => {
        engineRef.current = engine;
    }, [engine]);

    useEffect(() => {
        tensorflowModelTypeRef.current = tensorflowModelType;
    }, [tensorflowModelType]);

    useEffect(() => {
        gestureCooldownRef.current = gestureCooldownMs;
    }, [gestureCooldownMs]);

    useEffect(() => {
        onGestureRef.current = onGesture;
    }, [onGesture]);

    useEffect(() => {
        onHandMoveRef.current = onHandMove;
    }, [onHandMove]);

    useEffect(() => {
        onPinchChangeRef.current = onPinchChange;
    }, [onPinchChange]);

    useEffect(() => {
        motionSourceRef.current = motionSource;
    }, [motionSource]);

    useEffect(() => {
        gestureMotionSourceRef.current = gestureMotionSource ?? motionSource;
    }, [gestureMotionSource, motionSource]);

    useEffect(() => {
        requireOpenHandRef.current = requireOpenHand;
    }, [requireOpenHand]);

    useEffect(() => {
        gestureModeRef.current = gestureMode;
    }, [gestureMode]);

    useEffect(() => {
        pinchModeRef.current = pinchMode;
    }, [pinchMode]);

    useEffect(() => {
        pinchHorizontalTravelPxRef.current = pinchHorizontalTravelPx ?? null;
    }, [pinchHorizontalTravelPx]);

    useEffect(() => {
        pinchEngageThresholdRef.current = pinchEngageThreshold ?? null;
    }, [pinchEngageThreshold]);

    useEffect(() => {
        pinchReleaseThresholdRef.current = pinchReleaseThreshold ?? null;
    }, [pinchReleaseThreshold]);

    useEffect(() => {
        pinchIntentHoldMsRef.current = pinchIntentHoldMs ?? null;
    }, [pinchIntentHoldMs]);

    const resetTrackingState = () => {
        lastHandPosRef.current = { x: 0, y: 0, timestamp: 0 };
        lastGesturePosRef.current = { x: 0, y: 0, timestamp: 0 };
        lastGestureTriggerRef.current = 0;
        lastTrackedHandIdRef.current = null;
        resetFingerGestureTracking();
        pinchActiveRef.current = false;
        pinchStartDistanceRef.current = 0;
        pinchLastScaleRef.current = 1;
        pinchLastDistanceRef.current = 0;
        pinchLastNormalizedDistanceRef.current = 1;
        pinchHandIdsRef.current = [];
        pinchReleaseStartedAtRef.current = null;
        pinchStartPointRef.current = { x: 0, y: 0 };
        pinchLastPointRef.current = { x: 0, y: 0 };
        pinchIntentStartedAtRef.current = null;
        pinchIntentHandIdRef.current = null;
        handIdentityFramesRef.current = {};
        lastIndexTipEmitRef.current = 0;
        if (hasIndexTipPointRef.current) {
            setIndexTipPoint(null);
            hasIndexTipPointRef.current = false;
        }
        setIsOpenHandDetected(false);
    };

    // Initialize hand tracking engine
    useEffect(() => {
        if (!isActive || typeof window === 'undefined') return;
        let cancelled = false;

        const waitForVideoMetadata = async (video: HTMLVideoElement) => {
            if (video.readyState >= 1 && video.videoWidth > 0 && video.videoHeight > 0) {
                return;
            }

            await new Promise<void>((resolve, reject) => {
                const handleLoadedMetadata = () => {
                    cleanup();
                    resolve();
                };
                const handleError = () => {
                    cleanup();
                    reject(new Error('Video metadata could not be loaded.'));
                };
                const cleanup = () => {
                    video.removeEventListener('loadedmetadata', handleLoadedMetadata);
                    video.removeEventListener('error', handleError);
                };

                video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
                video.addEventListener('error', handleError, { once: true });
            });
        };

        const initializeHandTracking = async () => {
            try {
                // Request camera access
                console.log('📷 Step 1: Requesting camera permissions...');
                setOnboardingState('requesting_camera');

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width:
                            engineRef.current === 'tensorflow'
                                ? TENSORFLOW_CAMERA_WIDTH
                                : 1280,
                        height:
                            engineRef.current === 'tensorflow'
                                ? TENSORFLOW_CAMERA_HEIGHT
                                : 720,
                        facingMode: 'user'
                    }
                });

                console.log('✅ Step 2: Camera stream obtained!');

                if (!videoRef.current) return;
                videoRef.current.srcObject = stream;
                await waitForVideoMetadata(videoRef.current);
                await videoRef.current.play().catch(() => undefined);
                if (cancelled) return;

                if (engineRef.current === 'tensorflow') {
                    console.log('🔧 Step 3: Initializing TensorFlow.js hand detector...');
                    setOnboardingState('loading_model');

                    const drawLoadingPreview = () => {
                        if (cancelled || detectorRef.current) return;

                        const video = videoRef.current;
                        if (
                            video &&
                            video.readyState >= 2 &&
                            video.videoWidth > 0 &&
                            video.videoHeight > 0
                        ) {
                            processTrackingFrame(video, []);
                        }

                        previewAnimationFrameRef.current = window.requestAnimationFrame(drawLoadingPreview);
                    };

                    previewAnimationFrameRef.current = window.requestAnimationFrame(drawLoadingPreview);

                    const [
                        handposeModule,
                        tfModule,
                    ] = await Promise.all([
                        import('@tensorflow-models/handpose'),
                        import('@tensorflow/tfjs-core'),
                        import('@tensorflow/tfjs-converter'),
                        import('@tensorflow/tfjs-backend-webgl'),
                        import('@tensorflow/tfjs-backend-cpu'),
                    ]).then(([handposeImport, tfImport]) => [
                        handposeImport,
                        tfImport,
                    ]);

                    await tfModule.ready();
                    try {
                        const webglReady = await tfModule.setBackend('webgl');
                        if (!webglReady) {
                            await tfModule.setBackend('cpu');
                        }
                    } catch (backendError) {
                        console.warn('⚠️ TensorFlow.js WebGL backend was unavailable:', backendError);
                        await tfModule.setBackend('cpu');
                    }
                    await tfModule.ready();

                    const detector = await handposeModule.load({
                        maxContinuousChecks: 64,
                        detectionConfidence: 0.72,
                        iouThreshold: 0.3,
                        scoreThreshold: 0.75,
                    });

                    detectorRef.current = detector;
                    console.log('✅ Step 4: TensorFlow.js detector configured!');
                    if (previewAnimationFrameRef.current !== null) {
                        window.cancelAnimationFrame(previewAnimationFrameRef.current);
                        previewAnimationFrameRef.current = null;
                    }
                    setOnboardingState('waiting_for_hand');

                    const detectFrame = async () => {
                        if (cancelled) return;

                        const video = videoRef.current;
                        const detectorInstance = detectorRef.current;
                        if (
                            !video ||
                            !detectorInstance ||
                            video.readyState < 2 ||
                            video.videoWidth === 0 ||
                            video.videoHeight === 0
                        ) {
                            animationFrameRef.current = window.requestAnimationFrame(() => {
                                void detectFrame();
                            });
                            return;
                        }

                        try {
                            let detectionSource: CanvasImageSource = video;
                            const detectionWidth = Math.min(
                                TENSORFLOW_DETECTION_MAX_WIDTH,
                                video.videoWidth,
                            );
                            const detectionHeight = Math.max(
                                1,
                                Math.round(
                                    (video.videoHeight / Math.max(video.videoWidth, 1)) *
                                    detectionWidth,
                                ),
                            );

                            if (
                                video.videoWidth > TENSORFLOW_DETECTION_MAX_WIDTH &&
                                detectionWidth > 0 &&
                                detectionHeight > 0
                            ) {
                                if (!detectionBufferCanvasRef.current) {
                                    detectionBufferCanvasRef.current = document.createElement('canvas');
                                }

                                const detectionCanvas = detectionBufferCanvasRef.current;
                                const detectionCtx = detectionCanvas.getContext('2d');

                                if (detectionCtx) {
                                    if (
                                        detectionCanvas.width !== detectionWidth ||
                                        detectionCanvas.height !== detectionHeight
                                    ) {
                                        detectionCanvas.width = detectionWidth;
                                        detectionCanvas.height = detectionHeight;
                                    }

                                    detectionCtx.drawImage(
                                        video,
                                        0,
                                        0,
                                        detectionWidth,
                                        detectionHeight,
                                    );
                                    detectionSource = detectionCanvas;
                                }
                            }

                            const hands = await detectorInstance.estimateHands(
                                detectionSource,
                                false,
                            );
                            if (cancelled) return;
                            const handFrames = buildHandFramesFromTensorFlow(
                                hands,
                                detectionWidth,
                                detectionHeight,
                            );
                            processTrackingFrame(video, handFrames);
                        } catch (estimationError) {
                            console.error('❌ TensorFlow.js estimation error:', estimationError);
                            if (!cancelled) {
                                setOnboardingState('error');
                            }
                            return;
                        }

                        animationFrameRef.current = window.requestAnimationFrame(() => {
                            void detectFrame();
                        });
                    };

                    animationFrameRef.current = window.requestAnimationFrame(() => {
                        void detectFrame();
                    });
                    return;
                }

                console.log('🔧 Step 3: Initializing MediaPipe Hands...');

                // Initialize MediaPipe Hands with optimal settings
                const hands = new Hands({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                    }
                });

                hands.setOptions({
                    maxNumHands: 2,
                    modelComplexity: 1,
                    minDetectionConfidence: 0.7,
                    minTrackingConfidence: 0.7
                });

                hands.onResults(onResults);
                handsRef.current = hands;

                console.log('✅ Step 4: MediaPipe Hands configured!');

                // Initialize camera
                if (videoRef.current) {
                    const camera = new Camera(videoRef.current, {
                        onFrame: async () => {
                            if (videoRef.current && handsRef.current) {
                                await handsRef.current.send({ image: videoRef.current });
                            }
                        },
                        width: 1280,
                        height: 720
                    });

                    await camera.start();
                    cameraRef.current = camera;
                    console.log('✅ Step 5: Camera started! Transitioning to waiting_for_hand');
                    setOnboardingState('waiting_for_hand');
                }

            } catch (error) {
                console.error('❌ Camera initialization error:', error);
                setOnboardingState('error');
            }
        };

        initializeHandTracking();

        return () => {
            // Cleanup
            cancelled = true;
            if (animationFrameRef.current !== null) {
                window.cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            if (previewAnimationFrameRef.current !== null) {
                window.cancelAnimationFrame(previewAnimationFrameRef.current);
                previewAnimationFrameRef.current = null;
            }
            if (cameraRef.current) {
                cameraRef.current.stop();
            }
            if (handsRef.current) {
                handsRef.current.close();
            }
            detectorRef.current = null;
            detectionBufferCanvasRef.current = null;
            if (handDetectionTimerRef.current) {
                clearTimeout(handDetectionTimerRef.current);
            }
            if (handLossTimerRef.current) {
                clearTimeout(handLossTimerRef.current);
                handLossTimerRef.current = null;
            }

            // Stop video stream
            if (videoRef.current?.srcObject) {
                const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
                tracks.forEach((track) => track.stop());
                videoRef.current.srcObject = null;
            }
            resetTrackingState();
        };
    }, [isActive, engine, tensorflowModelType]);

    const buildHandFramesFromLandmarks = (
        hands: Array<{ id: string; landmarks: HandLandmark[] }>,
    ) => {
        const seenIds = new Set<string>();
        const now = Date.now();

        const frames = hands.map(({ id, landmarks }) => {
            const center = getHandCenter(landmarks);
            const previous = handIdentityFramesRef.current[id];
            const movement = previous ? distanceBetween(center, previous) : 0;

            handIdentityFramesRef.current[id] = {
                x: center.x,
                y: center.y,
                timestamp: now,
            };
            seenIds.add(id);

            const palmSpan = getPalmSpan(landmarks);
            const pinchDistance = distanceBetween(landmarks[4], landmarks[8]);
            const pinchPoint = getMidpoint(landmarks[4], landmarks[8]);

            return {
                id,
                landmarks,
                center,
                pinchPoint,
                palmSpan,
                pinchDistance,
                normalizedPinchDistance: pinchDistance / palmSpan,
                movement,
                timestamp: now,
            } satisfies HandFrame;
        });

        Object.keys(handIdentityFramesRef.current).forEach((id) => {
            if (!seenIds.has(id)) {
                delete handIdentityFramesRef.current[id];
            }
        });

        return frames;
    };

    const buildHandFrames = (results: Results) => {
        const multiHandLandmarks = results.multiHandLandmarks ?? [];
        const handedness = (results as Results & { multiHandedness?: any[] }).multiHandedness ?? [];
        const hands = multiHandLandmarks.map((landmarks, index) => {
            const handednessEntry = handedness[index];
            const handednessLabel =
                (Array.isArray(handednessEntry) ? handednessEntry[0]?.label : handednessEntry?.label) ??
                null;
            return {
                id:
                typeof handednessLabel === 'string' && handednessLabel.length > 0
                    ? handednessLabel.toLowerCase()
                    : `hand-${index}`,
                landmarks: landmarks as HandLandmark[],
            };
        });

        return buildHandFramesFromLandmarks(hands);
    };

    const buildHandFramesFromTensorFlow = (
        hands: TensorFlowHandposePrediction[],
        imageWidth: number,
        imageHeight: number,
    ) => {
        const safeWidth = Math.max(1, imageWidth);
        const safeHeight = Math.max(1, imageHeight);
        const normalizedHands = hands
            .map((hand, index) => {
                const landmarks = (hand.landmarks ?? []).slice(0, 21).map((keypoint) => ({
                    x: clamp((keypoint?.[0] ?? 0) / safeWidth, 0, 1),
                    y: clamp((keypoint?.[1] ?? 0) / safeHeight, 0, 1),
                    z: typeof keypoint?.[2] === 'number' ? keypoint[2] : undefined,
                }));

                if (landmarks.length < 21) return null;

                return {
                    id: index === 0 ? 'primary' : `hand-${index}`,
                    landmarks,
                };
            })
            .filter((hand): hand is { id: string; landmarks: HandLandmark[] } => hand !== null);

        return buildHandFramesFromLandmarks(normalizedHands);
    };

    const getPrimaryHandFrame = (handFrames: HandFrame[]) => {
        if (handFrames.length === 0) return null;

        if (lastTrackedHandIdRef.current) {
            const previousHand = handFrames.find((handFrame) => (
                handFrame.id === lastTrackedHandIdRef.current
            ));
            if (previousHand) return previousHand;
        }

        return handFrames[0];
    };

    const resetPinchTracking = () => {
        pinchActiveRef.current = false;
        pinchStartDistanceRef.current = 0;
        pinchLastScaleRef.current = 1;
        pinchLastDistanceRef.current = 0;
        pinchLastNormalizedDistanceRef.current = 1;
        pinchHandIdsRef.current = [];
        pinchReleaseStartedAtRef.current = null;
        pinchStartPointRef.current = { x: 0, y: 0 };
        pinchLastPointRef.current = { x: 0, y: 0 };
        pinchIntentStartedAtRef.current = null;
        pinchIntentHandIdRef.current = null;
    };

    const resetFingerGestureTracking = () => {
        fingerGestureDxRef.current = 0;
        fingerGestureDyRef.current = 0;
        fingerGesturePathRef.current = 0;
    };

    const endActivePinch = (endedBy: PinchEndReason) => {
        if (!pinchActiveRef.current) return false;

        onPinchChangeRef.current?.({
            phase: 'end',
            isPinching: false,
            distance: pinchLastDistanceRef.current,
            normalizedDistance: pinchLastNormalizedDistanceRef.current,
            scale: pinchLastScaleRef.current,
            deltaScale: 0,
            strength: 0,
            timestamp: Date.now(),
            pairDetected: false,
            endedBy,
            mode: pinchModeRef.current,
            x: pinchLastPointRef.current.x,
            y: pinchLastPointRef.current.y,
        });
        resetPinchTracking();
        return false;
    };

    const getImageSourceDimensions = (imageSource: CanvasImageSource) => {
        if (imageSource instanceof HTMLVideoElement) {
            return {
                width: imageSource.videoWidth || imageSource.clientWidth || 640,
                height: imageSource.videoHeight || imageSource.clientHeight || 480,
            };
        }

        const source = imageSource as CanvasImageSource & {
            width?: number;
            height?: number;
        };

        return {
            width: source.width ?? 640,
            height: source.height ?? 480,
        };
    };

    // Process hand tracking results
    const processTrackingFrame = (
        imageSource: CanvasImageSource,
        handFrames: HandFrame[],
    ) => {
        const primaryHandFrame = getPrimaryHandFrame(handFrames);

        // Draw landmarks on canvas for visual feedback
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
            if (ctx) {
                if (!previewBufferCanvasRef.current) {
                    previewBufferCanvasRef.current = document.createElement('canvas');
                }

                const previewBufferCanvas = previewBufferCanvasRef.current;
                const previewBufferCtx = previewBufferCanvas.getContext('2d', {
                    willReadFrequently: true,
                });

                if (previewBufferCtx) {
                    // Set smaller internal resolution for performance during pixel processing
                    const displayWidth = PREVIEW_DISPLAY_WIDTH;
                    const sourceDimensions = getImageSourceDimensions(imageSource);
                    const displayHeight =
                        (sourceDimensions.height / Math.max(sourceDimensions.width, 1)) *
                        displayWidth;

                    if (
                        canvasRef.current.width !== displayWidth ||
                        canvasRef.current.height !== displayHeight
                    ) {
                        canvasRef.current.width = displayWidth;
                        canvasRef.current.height = displayHeight;
                    }

                    if (
                        previewBufferCanvas.width !== displayWidth ||
                        previewBufferCanvas.height !== displayHeight
                    ) {
                        previewBufferCanvas.width = displayWidth;
                        previewBufferCanvas.height = displayHeight;
                    }

                    previewBufferCtx.save();
                    previewBufferCtx.scale(-1, 1);
                    previewBufferCtx.translate(-displayWidth, 0);
                    previewBufferCtx.drawImage(imageSource, 0, 0, displayWidth, displayHeight);
                    previewBufferCtx.restore();

                    if (previewModeRef.current === 'dot-matrix') {
                        drawDotMatrixPreview(ctx, previewBufferCtx, displayWidth, displayHeight);
                    } else {
                        drawThresholdPreview(ctx, previewBufferCtx, displayWidth, displayHeight);
                    }

                    // 3. Draw hand landmarks if detected
                    if (handFrames.length > 0) {
                        const w = canvasRef.current.width;
                        const h = canvasRef.current.height;
                        const now = Date.now();
                        const trackedHand = primaryHandFrame ?? handFrames[0];
                        const tipPoint = {
                            x: Math.min(1, Math.max(0, 1 - trackedHand.landmarks[8].x)),
                            y: Math.min(1, Math.max(0, trackedHand.landmarks[8].y))
                        };

                        if (now - lastIndexTipEmitRef.current > 80) {
                            setIndexTipPoint(tipPoint);
                            lastIndexTipEmitRef.current = now;
                            hasIndexTipPointRef.current = true;
                        }

                        const connections = [
                            [0, 1], [1, 2], [2, 3], [3, 4],
                            [0, 5], [5, 6], [6, 7], [7, 8],
                            [0, 9], [9, 10], [10, 11], [11, 12],
                            [0, 13], [13, 14], [14, 15], [15, 16],
                            [0, 17], [17, 18], [18, 19], [19, 20],
                            [5, 9], [9, 13], [13, 17]
                        ];

                        handFrames.forEach((handFrame) => {
                            const { landmarks } = handFrame;
                            const getCoords = (idx: number) => ({
                                x: (1 - landmarks[idx].x) * w,
                                y: landmarks[idx].y * h
                            });

                            ctx.strokeStyle = LANDMARK_STROKE;
                            ctx.lineWidth = previewModeRef.current === 'dot-matrix' ? 1.2 : 1.5;
                            ctx.beginPath();
                            connections.forEach(([i, j]) => {
                                const start = getCoords(i);
                                const end = getCoords(j);
                                ctx.moveTo(start.x, start.y);
                                ctx.lineTo(end.x, end.y);
                            });
                            ctx.stroke();

                            landmarks.forEach((_, idx) => {
                                const { x, y } = getCoords(idx);
                                const isMain = [0, 4, 8, 12, 16, 20].includes(idx);

                                ctx.beginPath();
                                ctx.arc(x, y, isMain ? 3 : 2, 0, TAU);
                                ctx.fillStyle = isMain ? LANDMARK_ACCENT : LANDMARK_FILL;
                                ctx.fill();

                                if (isMain) {
                                    ctx.shadowBlur = 10;
                                    ctx.shadowColor = LANDMARK_ACCENT;
                                    ctx.fill();
                                    ctx.shadowBlur = 0;
                                }
                            });
                        });

                        const trackedTipX = (1 - trackedHand.landmarks[8].x) * w;
                        const trackedTipY = trackedHand.landmarks[8].y * h;
                        ctx.beginPath();
                        ctx.arc(trackedTipX, trackedTipY, 6, 0, TAU);
                        ctx.strokeStyle = LANDMARK_ACCENT;
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }
                }
            }
        }

        // Hand detection logic - USE REF FOR CURRENT STATE
        const currentState = onboardingStateRef.current;

        if (handFrames.length > 0 && primaryHandFrame) {
            console.log('✅ Hand detected! Landmarks count:', primaryHandFrame.landmarks.length, 'Current state:', currentState);
            setHandDetected(true);
            setIsOpenHandDetected(isOpenHandFrame(primaryHandFrame.landmarks));

            // Clear hand loss timer if hand returns during grace period
            if (handLossTimerRef.current) {
                console.log('✨ Hand returned! Clearing grace period timer');
                clearTimeout(handLossTimerRef.current);
                handLossTimerRef.current = null;
            }

            // State machine for onboarding
            if (currentState === 'waiting_for_hand') {
                console.log('🔄 Transitioning: waiting_for_hand → calibrating');
                setOnboardingState('calibrating');
                calibrationStartRef.current = Date.now();
            } else if (currentState === 'calibrating') {
                const calibrationTime = Date.now() - (calibrationStartRef.current || 0);
                console.log(`⏱️  Calibrating... ${calibrationTime}ms / 1000ms`);
                if (calibrationTime > 1000) { // 1 second of stable hand detection
                    console.log('🎉 Calibration complete! Transitioning to READY');
                    setOnboardingState('ready');
                    setIsTracking(true);
                }
            } else if (currentState === 'hand_lost_temporarily') {
                // Hand returned during grace period! Resume tracking immediately
                console.log('✨ Hand returned! Restoring ready state instantly');
                setOnboardingState('ready');
                setIsTracking(true);
            } else if (currentState === 'ready') {
                // Track hand movement for gestures
                trackHandGesture(primaryHandFrame, handFrames);
            }

            // Reset timeout
            if (handDetectionTimerRef.current) {
                clearTimeout(handDetectionTimerRef.current);
            }

            handDetectionTimerRef.current = setTimeout(() => {
                console.log('⚠️ Hand detection timeout - marking as not detected');
                setHandDetected(false);
            }, 100);

        } else {
            console.log('❌ No hand detected in this frame, Current state:', currentState);
            setHandDetected(false);
            setIsOpenHandDetected(false);
            lastTrackedHandIdRef.current = null;
            endActivePinch('hand_lost');
            if (hasIndexTipPointRef.current) {
                setIndexTipPoint(null);
                hasIndexTipPointRef.current = false;
            }

            // If hand is lost while ready, give them 3 seconds before showing prompt
            if (currentState === 'ready') {
                console.log('⚠️ Hand lost while ready - starting grace period');
                setOnboardingState('hand_lost_temporarily');

                // Clear any existing timer
                if (handLossTimerRef.current) {
                    clearTimeout(handLossTimerRef.current);
                }

                // After 3 seconds of no hand, reset to waiting
                handLossTimerRef.current = setTimeout(() => {
                    if (onboardingStateRef.current === 'hand_lost_temporarily') {
                        console.log('⏰ Grace period expired - resetting to waiting_for_hand');
                        setOnboardingState('waiting_for_hand');
                        setIsTracking(false);
                        calibrationStartRef.current = null;
                    }
                }, 3000);  // 3 second grace period
            } else if (currentState === 'calibrating') {
                // During calibration, reset immediately
                console.log('❌ Hand lost during calibration! Resetting to waiting_for_hand');
                setOnboardingState('waiting_for_hand');
                setIsTracking(false);
                calibrationStartRef.current = null;
            } else if (currentState === 'hand_lost_temporarily') {
                // Stay in temporary loss state, timer is already running
            }
        }
    };

    const onResults = (results: Results) => {
        const handFrames = buildHandFrames(results);

        if (results.image) {
            processTrackingFrame(results.image, handFrames);
        }
    };

    const updatePinchGesture = (
        handFrames: HandFrame[],
        primaryHandFrame: HandFrame | null,
    ) => {
        if (!onPinchChangeRef.current) return false;

        const getPinchStrength = (normalizedPinchDistance: number) => clamp(
            (PINCH_RELEASE_THRESHOLD - normalizedPinchDistance) /
                Math.max(PINCH_RELEASE_THRESHOLD - PINCH_ENGAGE_THRESHOLD, 0.001),
            0,
            1,
        );

        if (pinchModeRef.current === 'single-hand-horizontal') {
            if (!primaryHandFrame) {
                return endActivePinch('hand_lost');
            }

            const engageThreshold = clamp(
                pinchEngageThresholdRef.current ?? PINCH_ENGAGE_THRESHOLD,
                0.08,
                0.5,
            );
            const releaseThreshold = clamp(
                Math.max(
                    engageThreshold + 0.04,
                    pinchReleaseThresholdRef.current ?? PINCH_RELEASE_THRESHOLD,
                ),
                engageThreshold + 0.04,
                0.7,
            );
            const intentHoldMs = Math.max(0, pinchIntentHoldMsRef.current ?? 0);
            const pinchX = (1 - primaryHandFrame.pinchPoint.x) * window.innerWidth;
            const pinchY = primaryHandFrame.pinchPoint.y * window.innerHeight;
            const normalizedX = Math.min(1, Math.max(0, 1 - primaryHandFrame.pinchPoint.x));
            const normalizedY = Math.min(1, Math.max(0, primaryHandFrame.pinchPoint.y));
            const strength = getPinchStrength(primaryHandFrame.normalizedPinchDistance);
            const activeHandId = pinchHandIdsRef.current[0] ?? null;

            if (!pinchActiveRef.current) {
                if (primaryHandFrame.normalizedPinchDistance > engageThreshold) {
                    pinchIntentStartedAtRef.current = null;
                    pinchIntentHandIdRef.current = null;
                    return false;
                }

                if (pinchIntentHandIdRef.current !== primaryHandFrame.id) {
                    pinchIntentHandIdRef.current = primaryHandFrame.id;
                    pinchIntentStartedAtRef.current = primaryHandFrame.timestamp;
                    return false;
                }

                if (pinchIntentStartedAtRef.current === null) {
                    pinchIntentStartedAtRef.current = primaryHandFrame.timestamp;
                    return false;
                }

                if (
                    primaryHandFrame.timestamp - pinchIntentStartedAtRef.current <
                    intentHoldMs
                ) {
                    return false;
                }

                pinchActiveRef.current = true;
                pinchHandIdsRef.current = [primaryHandFrame.id];
                pinchStartDistanceRef.current = primaryHandFrame.pinchDistance;
                pinchLastScaleRef.current = 1;
                pinchLastDistanceRef.current = primaryHandFrame.pinchDistance;
                pinchLastNormalizedDistanceRef.current = primaryHandFrame.normalizedPinchDistance;
                pinchReleaseStartedAtRef.current = null;
                pinchStartPointRef.current = { x: pinchX, y: pinchY };
                pinchLastPointRef.current = { x: pinchX, y: pinchY };
                pinchIntentStartedAtRef.current = null;
                pinchIntentHandIdRef.current = null;

                onPinchChangeRef.current({
                    phase: 'start',
                    isPinching: true,
                    distance: primaryHandFrame.pinchDistance,
                    normalizedDistance: primaryHandFrame.normalizedPinchDistance,
                    scale: 1,
                    deltaScale: 0,
                    strength,
                    timestamp: primaryHandFrame.timestamp,
                    pairDetected: false,
                    mode: pinchModeRef.current,
                    x: pinchX,
                    y: pinchY,
                    normalizedX,
                    normalizedY,
                    dx: 0,
                    dy: 0,
                    travelX: 0,
                    travelY: 0,
                });
                return true;
            }

            const activeHand = activeHandId
                ? handFrames.find((handFrame) => handFrame.id === activeHandId) ?? null
                : null;

            if (!activeHand) {
                return endActivePinch('hand_lost');
            }

            if (activeHand.normalizedPinchDistance >= releaseThreshold) {
                if (pinchReleaseStartedAtRef.current === null) {
                    pinchReleaseStartedAtRef.current = activeHand.timestamp;
                }

                if (
                    activeHand.timestamp - pinchReleaseStartedAtRef.current >=
                    PINCH_RELEASE_CONFIRM_MS
                ) {
                    return endActivePinch('release');
                }

                return true;
            }

            pinchReleaseStartedAtRef.current = null;

            const activePinchX = (1 - activeHand.pinchPoint.x) * window.innerWidth;
            const activePinchY = activeHand.pinchPoint.y * window.innerHeight;
            const activeNormalizedX = Math.min(1, Math.max(0, 1 - activeHand.pinchPoint.x));
            const activeNormalizedY = Math.min(1, Math.max(0, activeHand.pinchPoint.y));
            const travelX = activePinchX - pinchStartPointRef.current.x;
            const travelY = activePinchY - pinchStartPointRef.current.y;
            const dx = activePinchX - pinchLastPointRef.current.x;
            const dy = activePinchY - pinchLastPointRef.current.y;
            const horizontalTravelRange = Math.max(
                48,
                pinchHorizontalTravelPxRef.current ?? Math.max(window.innerWidth * 0.26, 180),
            );
            const rawScale = clamp(
                1 + (
                    travelX /
                    horizontalTravelRange
                ),
                0.55,
                1.9,
            );
            const scale =
                Math.abs(rawScale - pinchLastScaleRef.current) <= PINCH_SCALE_DEADBAND
                    ? pinchLastScaleRef.current
                    : rawScale;
            const deltaScale = scale - pinchLastScaleRef.current;

            pinchLastScaleRef.current = scale;
            pinchLastDistanceRef.current = activeHand.pinchDistance;
            pinchLastNormalizedDistanceRef.current = activeHand.normalizedPinchDistance;
            pinchLastPointRef.current = { x: activePinchX, y: activePinchY };

            onPinchChangeRef.current({
                phase: 'move',
                isPinching: true,
                distance: activeHand.pinchDistance,
                normalizedDistance: activeHand.normalizedPinchDistance,
                scale,
                deltaScale,
                strength: getPinchStrength(activeHand.normalizedPinchDistance),
                timestamp: activeHand.timestamp,
                pairDetected: false,
                mode: pinchModeRef.current,
                x: activePinchX,
                y: activePinchY,
                normalizedX: activeNormalizedX,
                normalizedY: activeNormalizedY,
                dx,
                dy,
                travelX,
                travelY,
            });

            return true;
        }

        if (handFrames.length < 2) {
            return endActivePinch('hand_lost');
        }

        const getPairMetrics = (pair: HandFrame[]) => {
            const pairDistance = Math.max(
                distanceBetween(pair[0].pinchPoint, pair[1].pinchPoint),
                0.01,
            );
            const averagePalmSpan = Math.max(
                (pair[0].palmSpan + pair[1].palmSpan) / 2,
                0.08,
            );

            return {
                pairDistance,
                normalizedDistance: pairDistance / averagePalmSpan,
                strength: (
                    getPinchStrength(pair[0].normalizedPinchDistance) +
                    getPinchStrength(pair[1].normalizedPinchDistance)
                ) / 2,
                timestamp: Math.max(pair[0].timestamp, pair[1].timestamp),
            };
        };
        const resolveActivePair = () => {
            if (pinchHandIdsRef.current.length !== 2) {
                return null;
            }

            const pair = pinchHandIdsRef.current
                .map((id) => handFrames.find((handFrame) => handFrame.id === id) ?? null)
                .filter((handFrame): handFrame is HandFrame => handFrame !== null);

            return pair.length === 2 ? pair : null;
        };
        const getEngagedPair = () => (
            handFrames
                .filter((handFrame) => handFrame.normalizedPinchDistance <= PINCH_ENGAGE_THRESHOLD)
                .sort((a, b) => a.id.localeCompare(b.id))
                .slice(0, 2)
        );

        if (!pinchActiveRef.current) {
            const engagedPair = getEngagedPair();

            if (engagedPair.length < 2) {
                return false;
            }

            const { pairDistance, normalizedDistance, strength, timestamp } =
                getPairMetrics(engagedPair);
            pinchActiveRef.current = true;
            pinchHandIdsRef.current = engagedPair.map((handFrame) => handFrame.id);
            pinchStartDistanceRef.current = pairDistance;
            pinchLastScaleRef.current = 1;
            pinchLastDistanceRef.current = pairDistance;
            pinchLastNormalizedDistanceRef.current = normalizedDistance;
            pinchReleaseStartedAtRef.current = null;
            onPinchChangeRef.current({
                phase: 'start',
                isPinching: true,
                distance: pairDistance,
                normalizedDistance,
                scale: 1,
                deltaScale: 0,
                strength,
                timestamp,
                pairDetected: true,
            });
            return true;
        }

        const activePair = resolveActivePair();

        if (!activePair) {
            return endActivePinch('hand_lost');
        }

        const releaseTimestamp = Math.max(activePair[0].timestamp, activePair[1].timestamp);
        if (activePair.some((handFrame) => (
            handFrame.normalizedPinchDistance >= PINCH_RELEASE_THRESHOLD
        ))) {
            if (pinchReleaseStartedAtRef.current === null) {
                pinchReleaseStartedAtRef.current = releaseTimestamp;
            }

            if (
                releaseTimestamp - pinchReleaseStartedAtRef.current >=
                PINCH_RELEASE_CONFIRM_MS
            ) {
                return endActivePinch('release');
            }

            return true;
        }
        pinchReleaseStartedAtRef.current = null;

        const { pairDistance, normalizedDistance, strength, timestamp } =
            getPairMetrics(activePair);
        const rawScale = clamp(
            pairDistance / Math.max(pinchStartDistanceRef.current, 0.01),
            0.55,
            1.9,
        );
        const scale =
            Math.abs(rawScale - pinchLastScaleRef.current) <= PINCH_SCALE_DEADBAND
                ? pinchLastScaleRef.current
                : rawScale;
        const deltaScale = scale - pinchLastScaleRef.current;

        pinchLastScaleRef.current = scale;
        pinchLastDistanceRef.current = pairDistance;
        pinchLastNormalizedDistanceRef.current = normalizedDistance;

        onPinchChangeRef.current({
            phase: 'move',
            isPinching: true,
            distance: pairDistance,
            normalizedDistance,
            scale,
            deltaScale,
            strength,
            timestamp,
            pairDetected: true,
        });

        return true;
    };

    // Track gestures using either the fingertip cluster or the whole hand.
    const trackHandGesture = (primaryHandFrame: HandFrame, handFrames: HandFrame[]) => {
        const isPinching = updatePinchGesture(handFrames, primaryHandFrame);
        const safeThreshold = Math.max(30, gestureThresholdRef.current);
        const safeGestureCooldown = Math.max(0, gestureCooldownRef.current);
        const activeGestureMode = gestureModeRef.current;
        const resolveMotionPoint = (source: 'index' | 'hand' | 'fingerCluster') => {
            if (source === 'hand') return primaryHandFrame.center;
            if (source === 'fingerCluster') return getFingerClusterCenter(primaryHandFrame.landmarks);
            return primaryHandFrame.landmarks[8];
        };
        const movementPoint = resolveMotionPoint(motionSourceRef.current);
        const gesturePoint = resolveMotionPoint(gestureMotionSourceRef.current);
        const openHandDetected = isOpenHandFrame(primaryHandFrame.landmarks);
        const currentX = (1 - movementPoint.x) * window.innerWidth; // Mirror X
        const currentY = movementPoint.y * window.innerHeight;
        const normalizedX = Math.min(1, Math.max(0, 1 - movementPoint.x));
        const normalizedY = Math.min(1, Math.max(0, movementPoint.y));
        const gestureCurrentX = (1 - gesturePoint.x) * window.innerWidth;
        const gestureCurrentY = gesturePoint.y * window.innerHeight;
        const now = Date.now();

        setIsOpenHandDetected(openHandDetected);

        // Initialize position on first call
        if (
            lastHandPosRef.current.timestamp === 0 ||
            lastTrackedHandIdRef.current !== primaryHandFrame.id
        ) {
            console.log('🖐️ Initializing hand position:', { currentX, currentY });
            lastTrackedHandIdRef.current = primaryHandFrame.id;
            lastHandPosRef.current = { x: currentX, y: currentY, timestamp: now };
            lastGesturePosRef.current = { x: gestureCurrentX, y: gestureCurrentY, timestamp: now };
            resetFingerGestureTracking();
            onHandMoveRef.current?.({
                x: currentX,
                y: currentY,
                normalizedX,
                normalizedY,
                dx: 0,
                dy: 0,
                dt: 0,
                distance: 0,
                speed: 0,
                angle: 0,
                timestamp: now,
            });
            return;
        }

        const dx = currentX - lastHandPosRef.current.x;
        const dy = currentY - lastHandPosRef.current.y;
        const dt = Math.max(now - lastHandPosRef.current.timestamp, 1);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const speed = dist / dt;
        const gestureFrameDx = gestureCurrentX - lastGesturePosRef.current.x;
        const gestureFrameDy = gestureCurrentY - lastGesturePosRef.current.y;
        const gestureFrameDt = Math.max(now - lastGesturePosRef.current.timestamp, 1);
        const gestureFrameDistance = Math.sqrt(
            (gestureFrameDx * gestureFrameDx) + (gestureFrameDy * gestureFrameDy),
        );
        const gestureFrameSpeed = gestureFrameDistance / gestureFrameDt;

        onHandMoveRef.current?.({
            x: currentX,
            y: currentY,
            normalizedX,
            normalizedY,
            dx,
            dy,
            dt,
            distance: dist,
            speed,
            angle,
            timestamp: now,
        });

        if (isPinching) {
            resetFingerGestureTracking();
            lastHandPosRef.current = { x: currentX, y: currentY, timestamp: now };
            lastGesturePosRef.current = { x: gestureCurrentX, y: gestureCurrentY, timestamp: now };
            return;
        }

        if (requireOpenHandRef.current && !openHandDetected) {
            resetFingerGestureTracking();
            lastHandPosRef.current = { x: currentX, y: currentY, timestamp: now };
            lastGesturePosRef.current = { x: gestureCurrentX, y: gestureCurrentY, timestamp: now };
            return;
        }

        if (!onGestureRef.current) {
            resetFingerGestureTracking();
            lastHandPosRef.current = { x: currentX, y: currentY, timestamp: now };
            lastGesturePosRef.current = { x: gestureCurrentX, y: gestureCurrentY, timestamp: now };
            return;
        }

        const gestureThreshold = activeGestureMode === 'finger'
            ? Math.max(
                FINGER_GESTURE_MIN_THRESHOLD,
                Math.round(safeThreshold * FINGER_GESTURE_THRESHOLD_RATIO),
            )
            : safeThreshold;
        const gestureCooldown = activeGestureMode === 'finger'
            ? Math.max(
                FINGER_GESTURE_MIN_COOLDOWN,
                Math.round(safeGestureCooldown * FINGER_GESTURE_COOLDOWN_RATIO),
            )
            : safeGestureCooldown;
        if (activeGestureMode === 'finger') {
            fingerGestureDxRef.current =
                (fingerGestureDxRef.current * FINGER_GESTURE_VECTOR_BLEND) + gestureFrameDx;
            fingerGestureDyRef.current =
                (fingerGestureDyRef.current * FINGER_GESTURE_VECTOR_BLEND) + gestureFrameDy;
            fingerGesturePathRef.current =
                (fingerGesturePathRef.current * FINGER_GESTURE_PATH_DECAY) +
                (gestureFrameDistance * FINGER_GESTURE_DISTANCE_GAIN);
        } else {
            resetFingerGestureTracking();
        }

        const gestureDx = activeGestureMode === 'finger'
            ? fingerGestureDxRef.current
            : dx;
        const gestureDy = activeGestureMode === 'finger'
            ? fingerGestureDyRef.current
            : dy;
        const gestureAngle = Math.atan2(gestureDy, gestureDx);
        const gesturePower = activeGestureMode === 'finger'
            ? (fingerGesturePathRef.current * FINGER_GESTURE_PATH_GAIN) + (gestureFrameSpeed * FINGER_GESTURE_SPEED_WEIGHT)
            : gestureFrameDistance;

        console.log('📏 Movement:', {
            dist: dist.toFixed(1),
            power: gesturePower.toFixed(1),
            threshold: gestureThreshold,
            mode: activeGestureMode,
            willSpawn: gesturePower > gestureThreshold,
        });

        if (gesturePower > gestureThreshold) {
            if (now - lastGestureTriggerRef.current < gestureCooldown) {
                // Consume movement while in cooldown so one long stroke doesn't produce repeated spawns.
                lastHandPosRef.current = { x: currentX, y: currentY, timestamp: now };
                lastGesturePosRef.current = { x: gestureCurrentX, y: gestureCurrentY, timestamp: now };
                return;
            }

            console.log('🚀 GESTURE DETECTED! Spawning card with angle:', gestureAngle);
            onGestureRef.current(gestureDx, gestureDy, gestureAngle);
            lastGestureTriggerRef.current = now;
            if (activeGestureMode === 'finger') {
                fingerGestureDxRef.current *= FINGER_GESTURE_RESIDUAL_AFTER_TRIGGER;
                fingerGestureDyRef.current *= FINGER_GESTURE_RESIDUAL_AFTER_TRIGGER;
                fingerGesturePathRef.current *= FINGER_GESTURE_RESIDUAL_AFTER_TRIGGER;
            }

            lastHandPosRef.current = { x: currentX, y: currentY, timestamp: now };
            lastGesturePosRef.current = { x: gestureCurrentX, y: gestureCurrentY, timestamp: now };
            return;
        }

        lastHandPosRef.current = { x: currentX, y: currentY, timestamp: now };
        lastGesturePosRef.current = { x: gestureCurrentX, y: gestureCurrentY, timestamp: now };
    };

    return {
        videoRef,
        canvasRef,
        onboardingState,
        isTracking,
        handDetected,
        indexTipPoint,
        isOpenHandDetected,
    };
};
