import React, { useState, useEffect, useRef } from 'react';
import { useHandTracking } from '../../hooks/hand-tracking-test/useHandTracking';
import { useCardPhysics } from '../../hooks/hand-tracking-test/useCardPhysics';
import HandTrackingCardStacker from './HandTrackingCardStacker';

const HandTrackingDemo = ({ images }) => {
    const [handControlEnabled, setHandControlEnabled] = useState(false);
    const [calibrationProgress, setCalibrationProgress] = useState(0);

    console.log('🎬 HandTrackingDemo rendering with', images?.length || 0, 'images');

    const { stack, spawnCardFromGesture } = useCardPhysics({
        initialImages: images,
        isActive: true  // Mouse always active
    });

    // Create ref to always have latest spawn function
    const spawnRef = useRef(spawnCardFromGesture);
    useEffect(() => {
        spawnRef.current = spawnCardFromGesture;
    }, [spawnCardFromGesture]);

    const {
        videoRef,
        canvasRef,
        onboardingState,
        isTracking,
        handDetected
    } = useHandTracking({
        onGesture: (dx, dy, angle) => {
            console.log('👋 Hand gesture detected!', { dx, dy, angle });
            spawnRef.current(dx, dy, angle);
        },
        threshold: 150,
        isActive: handControlEnabled  // Only active when enabled
    });

    // Track calibration progress
    useEffect(() => {
        let interval;
        if (onboardingState === 'calibrating') {
            let progress = 0;
            interval = setInterval(() => {
                progress += 10;
                setCalibrationProgress(progress);
                if (progress >= 100) {
                    clearInterval(interval);
                }
            }, 100);
        } else {
            setCalibrationProgress(0);
        }
        return () => clearInterval(interval);
    }, [onboardingState]);

    const toggleHandControl = () => {
        setHandControlEnabled(!handControlEnabled);
    };

    const getStatusMessage = () => {
        switch (onboardingState) {
            case 'requesting_camera':
                return 'Requesting camera...';
            case 'waiting_for_hand':
                return 'Show your hand';
            case 'calibrating':
                return 'Calibrating...';
            case 'ready':
                return 'Gesture Control Active!';
            case 'hand_lost_temporarily':
                return 'Hand lost - return to view';
            default:
                return '';
        }
    };

    const isCalibrating = handControlEnabled && (
        onboardingState === 'requesting_camera' ||
        onboardingState === 'waiting_for_hand' ||
        onboardingState === 'calibrating'
    );

    return (
        <div className="hand-tracking-demo">
            {/* Gesture Control Button */}
            <div className="gesture-control-panel">
                <button
                    className={`gesture-toggle ${handControlEnabled ? 'active' : ''}`}
                    onClick={toggleHandControl}
                >
                    {handControlEnabled ? (
                        <>
                            <span className="icon">👋</span>
                            <span className="text">Gesture Control ON</span>
                        </>
                    ) : (
                        <>
                            <span className="icon">✋</span>
                            <span className="text">Click here to Activate Gesture Control</span>
                        </>
                    )}
                </button>
                {!handControlEnabled && (
                    <p className="gesture-hint">
                        Control the movement of cards with your hands
                    </p>
                )}
                {handControlEnabled && onboardingState === 'ready' && (
                    <p className="gesture-status active">
                        ✓ {getStatusMessage()}
                    </p>
                )}
            </div>

            {/* Small Camera Preview Window - Keep visible when hand control enabled */}
            {handControlEnabled && (
                <div className="camera-preview">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ display: 'none' }}
                    />
                    <canvas
                        ref={canvasRef}
                        className="preview-canvas"
                    />
                    <div className="preview-status">
                        <div className="status-dot pulsing"></div>
                        <span>{getStatusMessage()}</span>
                        {onboardingState === 'calibrating' && (
                            <div className="calibration-bar">
                                <div
                                    className="calibration-fill"
                                    style={{ width: `${calibrationProgress}%` }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Card Stacker - Always visible, works with both mouse and hand gestures */}
            <HandTrackingCardStacker
                images={images}
                anchorX="50%"
                anchorY="50%"
                active={true}
                stack={stack}
                lastAction="add"
            />

            <style>{`
                .hand-tracking-demo {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: #000;
                    overflow: hidden;
                }

                /* Gesture Control Panel */
                .gesture-control-panel {
                    position: fixed;
                    top: 32px;
                    right: 32px;
                    z-index: 50;
                    text-align: right;
                }

                .gesture-toggle {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 16px 28px;
                    font-size: 1rem;
                    font-weight: 600;
                    font-family: inherit;
                    background: rgba(255, 255, 255, 0.08);
                    border: 2px solid rgba(255, 255, 255, 0.2);
                    border-radius: 50px;
                    color: white;
                    cursor: pointer;
                    backdrop-filter: blur(10px);
                    transition: all 0.3s ease;
                    white-space: nowrap;
                }

                .gesture-toggle:hover {
                    background: rgba(255, 255, 255, 0.15);
                    border-color: rgba(255, 255, 255, 0.4);
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
                }

                .gesture-toggle.active {
                    background: rgba(76, 175, 80, 0.2);
                    border-color: rgba(76, 175, 80, 0.5);
                }

                .gesture-toggle.active:hover {
                    background: rgba(76, 175, 80, 0.3);
                }

                .gesture-toggle .icon {
                    font-size: 1.5rem;
                }

                .gesture-hint {
                    margin-top: 8px;
                    font-size: 0.85rem;
                    color: rgba(255, 255, 255, 0.6);
                    font-family: inherit;
                }

                .gesture-status {
                    margin-top: 8px;
                    font-size: 0.9rem;
                    color: rgba(76, 175, 80, 1);
                    font-family: inherit;
                    font-weight: 600;
                }

                /* Small Camera Preview Window */
                .camera-preview {
                    position: fixed;
                    bottom: 32px;
                    right: 32px;
                    width: 320px;
                    height: 240px;
                    z-index: 100;
                    background: rgba(0, 0, 0, 0.9);
                    border: 2px solid rgba(255, 255, 255, 0.2);
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(10px);
                }

                .preview-canvas {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .preview-status {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    padding: 12px 16px;
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
                    color: white;
                    font-size: 0.85rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #4CAF50;
                }

                .status-dot.pulsing {
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.2); }
                }

                .calibration-bar {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: rgba(255, 255, 255, 0.2);
                }

                .calibration-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #00BCD4, #4CAF50);
                    transition: width 0.1s linear;
                }

                @media (max-width: 768px) {
                    .gesture-control-panel {
                        top: 16px;
                        right: 16px;
                    }

                    .gesture-toggle {
                        padding: 12px 20px;
                        font-size: 0.9rem;
                    }

                    .gesture-toggle .icon {
                        font-size: 1.2rem;
                    }

                    .camera-preview {
                        bottom: 16px;
                        right: 16px;
                        width: 240px;
                        height: 180px;
                    }
                }
            `}</style>
        </div>
    );
};

export default HandTrackingDemo;
