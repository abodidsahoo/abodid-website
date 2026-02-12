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
    isActive?: boolean;
}

export const useHandTracking = ({
    onGesture,
    threshold = 150,
    isActive = true
}: UseHandTrackingProps) => {
    const [onboardingState, setOnboardingState] = useState<OnboardingState>('requesting_camera');
    const [isTracking, setIsTracking] = useState(false);
    const [handDetected, setHandDetected] = useState(false);

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
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                canvasRef.current.width = results.image.width;
                canvasRef.current.height = results.image.height;

                // Draw mirrored video feed
                ctx.save();
                ctx.scale(-1, 1);
                ctx.translate(-canvasRef.current.width, 0);
                ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);
                ctx.restore();

                // Draw hand landmarks if detected
                if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                    const landmarks = results.multiHandLandmarks[0];

                    // Draw connections
                    ctx.strokeStyle = '#00FF00';
                    ctx.lineWidth = 2;

                    // Draw all landmarks as circles
                    landmarks.forEach(landmark => {
                        const x = (1 - landmark.x) * canvasRef.current!.width;
                        const y = landmark.y * canvasRef.current!.height;

                        ctx.beginPath();
                        ctx.arc(x, y, 5, 0, 2 * Math.PI);
                        ctx.fillStyle = '#00FF00';
                        ctx.fill();
                    });

                    // Highlight index finger tip (landmark 8)
                    const indexTip = landmarks[8];
                    const tipX = (1 - indexTip.x) * canvasRef.current.width;
                    const tipY = indexTip.y * canvasRef.current.height;

                    ctx.beginPath();
                    ctx.arc(tipX, tipY, 10, 0, 2 * Math.PI);
                    ctx.fillStyle = '#FF00FF';
                    ctx.fill();
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

        console.log('📏 Movement:', { dist: dist.toFixed(1), threshold, willSpawn: dist > threshold });

        if (dist > threshold) {
            const angle = Math.atan2(dy, dx);
            console.log('🚀 GESTURE DETECTED! Spawning card with angle:', angle);
            onGesture(dx, dy, angle);

            lastHandPosRef.current = { x: currentX, y: currentY, timestamp: now };
        }
    };

    return {
        videoRef,
        canvasRef,
        onboardingState,
        isTracking,
        handDetected
    };
};
