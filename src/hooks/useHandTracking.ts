import { useEffect, useRef, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import type { Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export type OnboardingState =
    | 'requesting_camera'
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

export interface UseHandTrackingProps {
    onGesture?: (dx: number, dy: number, angle: number) => void;
    threshold?: number;
    gestureCooldownMs?: number;
    isActive?: boolean;
}

export const useHandTracking = ({
    onGesture,
    threshold = 150,
    gestureCooldownMs = 130,
    isActive = true
}: UseHandTrackingProps) => {
    const [onboardingState, setOnboardingState] = useState<OnboardingState>('requesting_camera');
    const [isTracking, setIsTracking] = useState(false);
    const [handDetected, setHandDetected] = useState(false);
    const [indexTipPoint, setIndexTipPoint] = useState<{ x: number; y: number } | null>(null);

    // Update ref whenever state changes
    useEffect(() => {
        onboardingStateRef.current = onboardingState;
        console.log('🔄 State updated:', onboardingState);
    }, [onboardingState]);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const handsRef = useRef<Hands | null>(null);
    const cameraRef = useRef<Camera | null>(null);

    const lastHandPosRef = useRef<HandPosition>({ x: 0, y: 0, timestamp: 0 });
    const handDetectionTimerRef = useRef<NodeJS.Timeout | null>(null);
    const calibrationStartRef = useRef<number | null>(null);
    const onboardingStateRef = useRef<OnboardingState>('requesting_camera');
    const handLossTimerRef = useRef<NodeJS.Timeout | null>(null);  // NEW: track hand loss duration
    const lastIndexTipEmitRef = useRef(0);
    const hasIndexTipPointRef = useRef(false);
    const lastGestureTriggerRef = useRef(0);
    const gestureThresholdRef = useRef(threshold);
    const gestureCooldownRef = useRef(gestureCooldownMs);

    useEffect(() => {
        gestureThresholdRef.current = threshold;
    }, [threshold]);

    useEffect(() => {
        gestureCooldownRef.current = gestureCooldownMs;
    }, [gestureCooldownMs]);

    // Initialize MediaPipe Hands
    useEffect(() => {
        if (!isActive || typeof window === 'undefined') return;

        const initializeHandTracking = async () => {
            try {
                // Request camera access
                console.log('📷 Step 1: Requesting camera permissions...');
                setOnboardingState('requesting_camera');

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: 1280,
                        height: 720,
                        facingMode: 'user'
                    }
                });

                console.log('✅ Step 2: Camera stream obtained!');

                if (!videoRef.current) return;
                videoRef.current.srcObject = stream;

                console.log('🔧 Step 3: Initializing MediaPipe Hands...');

                // Initialize MediaPipe Hands with optimal settings
                const hands = new Hands({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                    }
                });

                hands.setOptions({
                    maxNumHands: 1,
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
            if (cameraRef.current) {
                cameraRef.current.stop();
            }
            if (handsRef.current) {
                handsRef.current.close();
            }
            if (handDetectionTimerRef.current) {
                clearTimeout(handDetectionTimerRef.current);
            }

            // Stop video stream
            if (videoRef.current?.srcObject) {
                const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
                tracks.forEach(track => track.stop());
            }
        };
    }, [isActive]);

    // Process hand tracking results
    const onResults = (results: Results) => {
        // Draw landmarks on canvas for visual feedback
        if (canvasRef.current && results.image) {
            const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
            if (ctx) {
                // Set smaller internal resolution for performance during pixel processing
                const displayWidth = 480;
                const displayHeight = (results.image.height / results.image.width) * displayWidth;

                if (canvasRef.current.width !== displayWidth) {
                    canvasRef.current.width = displayWidth;
                    canvasRef.current.height = displayHeight;
                }

                // 1. Draw mirrored video feed
                ctx.save();
                ctx.scale(-1, 1);
                ctx.translate(-canvasRef.current.width, 0);
                ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);
                ctx.restore();

                // 2. APPLY STYLIZED LINE ART EFFECT (Thresholding)
                const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
                const data = imageData.data;
                const threshold = 100; // Adjust for "line art" sensitivity

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;

                    // High contrast B&W / Line art feel
                    // We want "just a bit" visible but mostly dark/minimal
                    const val = gray > threshold ? 45 : 15;
                    data[i] = data[i + 1] = data[i + 2] = val;
                }
                ctx.putImageData(imageData, 0, 0);

                // 3. Draw hand landmarks if detected
                if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                    const landmarks = results.multiHandLandmarks[0];
                    const w = canvasRef.current.width;
                    const h = canvasRef.current.height;
                    const now = Date.now();

                    // Helper to get pixel coords
                    const getCoords = (idx: number) => ({
                        x: (1 - landmarks[idx].x) * w,
                        y: landmarks[idx].y * h
                    });

                    // Track index tip in normalized preview space for UI guidance panel.
                    const tipPoint = {
                        x: Math.min(1, Math.max(0, 1 - landmarks[8].x)),
                        y: Math.min(1, Math.max(0, landmarks[8].y))
                    };
                    if (now - lastIndexTipEmitRef.current > 80) {
                        setIndexTipPoint(tipPoint);
                        lastIndexTipEmitRef.current = now;
                        hasIndexTipPointRef.current = true;
                    }

                    // Define hand connections for "finger outlines"
                    const connections = [
                        [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
                        [0, 5], [5, 6], [6, 7], [7, 8],       // Index
                        [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
                        [0, 13], [13, 14], [14, 15], [15, 16], // Ring
                        [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
                        [5, 9], [9, 13], [13, 17]             // Palm
                    ];

                    // Draw Connections (White Outlines)
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    connections.forEach(([i, j]) => {
                        const start = getCoords(i);
                        const end = getCoords(j);
                        ctx.moveTo(start.x, start.y);
                        ctx.lineTo(end.x, end.y);
                    });
                    ctx.stroke();

                    // Draw all landmarks (Yellow Dots)
                    landmarks.forEach((_, idx) => {
                        const { x, y } = getCoords(idx);
                        ctx.beginPath();
                        // Smaller joints
                        const isMain = [0, 4, 8, 12, 16, 20].includes(idx);
                        ctx.arc(x, y, isMain ? 3 : 2, 0, 2 * Math.PI);
                        ctx.fillStyle = '#FFD700'; // Bright Golden/Yellow
                        ctx.fill();

                        // Subtle glow
                        if (isMain) {
                            ctx.shadowBlur = 10;
                            ctx.shadowColor = '#FFD700';
                            ctx.fill();
                            ctx.shadowBlur = 0;
                        }
                    });

                    // Extra highlight for Index Tip (Control Point)
                    const tip = getCoords(8);
                    ctx.beginPath();
                    ctx.arc(tip.x, tip.y, 6, 0, 2 * Math.PI);
                    ctx.strokeStyle = '#FFD700';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }
        }

        // Hand detection logic - USE REF FOR CURRENT STATE
        const currentState = onboardingStateRef.current;

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            console.log('✅ Hand detected! Landmarks count:', results.multiHandLandmarks[0].length, 'Current state:', currentState);
            setHandDetected(true);

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
                trackHandGesture(results.multiHandLandmarks[0]);
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

    // Track hand gestures using index finger tip
    const trackHandGesture = (landmarks: any[]) => {
        if (!onGesture) return;
        const safeThreshold = Math.max(30, gestureThresholdRef.current);
        const safeGestureCooldown = Math.max(0, gestureCooldownRef.current);

        const indexTip = landmarks[8]; // Index finger tip
        const currentX = (1 - indexTip.x) * window.innerWidth; // Mirror X
        const currentY = indexTip.y * window.innerHeight;
        const now = Date.now();

        // Initialize position on first call
        if (lastHandPosRef.current.timestamp === 0) {
            console.log('🖐️ Initializing hand position:', { currentX, currentY });
            lastHandPosRef.current = { x: currentX, y: currentY, timestamp: now };
            return;
        }

        const dx = currentX - lastHandPosRef.current.x;
        const dy = currentY - lastHandPosRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        console.log('📏 Movement:', { dist: dist.toFixed(1), threshold: safeThreshold, willSpawn: dist > safeThreshold });

        if (dist > safeThreshold) {
            if (now - lastGestureTriggerRef.current < safeGestureCooldown) {
                // Consume movement while in cooldown so one long stroke doesn't produce repeated spawns.
                lastHandPosRef.current = { x: currentX, y: currentY, timestamp: now };
                return;
            }

            const angle = Math.atan2(dy, dx);
            console.log('🚀 GESTURE DETECTED! Spawning card with angle:', angle);
            onGesture(dx, dy, angle);
            lastGestureTriggerRef.current = now;

            lastHandPosRef.current = { x: currentX, y: currentY, timestamp: now };
        }
    };

    return {
        videoRef,
        canvasRef,
        onboardingState,
        isTracking,
        handDetected,
        indexTipPoint
    };
};
