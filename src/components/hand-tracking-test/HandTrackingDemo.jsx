import React, { useState, useEffect, useRef } from 'react';
import { useHandTracking } from '../../hooks/useHandTracking';
import { useCardPhysics } from '../../hooks/useCardPhysics';
import CardStacker from '../CardStacker';

const HandTrackingDemo = ({ images }) => {
    const [handControlEnabled, setHandControlEnabled] = useState(false);
    const [calibrationProgress, setCalibrationProgress] = useState(0);

    console.log('🎬 HandTrackingDemo rendering with', images?.length || 0, 'images');

    // 1. Unified Physics
    const { stack, lastAction, containerRef, spawnCardFromGesture } = useCardPhysics({
        initialImages: images,
        isActive: true // Mouse always active in demo
    });

    // Create ref for gesture callback to always have latest spawn function
    const spawnRef = useRef(spawnCardFromGesture);
    useEffect(() => {
        spawnRef.current = spawnCardFromGesture;
    }, [spawnCardFromGesture]);

    // 2. Hand Tracking Hook
    const {
        videoRef,
        canvasRef,
        onboardingState,
    } = useHandTracking({
        onGesture: (dx, dy, angle) => {
            console.log('👋 Demo gesture!', { dx, dy, angle });
            spawnRef.current(dx, dy, angle);
        },
        threshold: 150,
        isActive: handControlEnabled
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
                            <span className="text">Activate Gesture Control</span>
                        </>
                    )}
                </button>

                {handControlEnabled && (
                    <div className="status-indicator">
                        <div className={`status-dot ${onboardingState === 'ready' ? 'ready' : 'waiting'}`} />
                        <span className="status-text">{getStatusMessage()}</span>
                        {onboardingState === 'calibrating' && (
                            <div className="calibration-track">
                                <div
                                    className="calibration-fill"
                                    style={{ width: `${calibrationProgress}%` }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Small Camera Preview Window */}
            {handControlEnabled && (
                <div className="camera-preview-window">
                    <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />
                    <canvas ref={canvasRef} className="preview-canvas" />
                    <div className="preview-status">
                        <div className="status-dot pulsing"></div>
                        <span>{getStatusMessage()}</span>
                    </div>
                </div>
            )}

            {/* Test Card Stacker - PASSIVE VERSION */}
            <CardStacker
                images={images}
                anchorX="50%"
                anchorY="50%"
                active={true}
                stack={stack}
                lastAction={lastAction}
                containerRef={containerRef}
            />

            <style>{`
                .hand-tracking-demo {
                    width: 100vw;
                    height: 100vh;
                    background-color: var(--color-text);
                    color: var(--color-primary-text);
                    font-family: var(--font-ui);
                    overflow: hidden;
                    position: relative;
                }

                .gesture-control-panel {
                    position: fixed;
                    top: 32px;
                    right: 32px;
                    z-index: 1000;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 16px;
                }

                .gesture-toggle {
                    background: color-mix(in srgb, var(--ui-shadow-color) 80%, transparent);
                    border: 1px solid color-mix(in srgb, var(--color-surface) 40%, transparent);
                    padding: 12px 24px;
                    color: var(--color-primary-text);
                    border-radius: 8px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-family: var(--font-ui);
                    transition: all 0.3s ease;
                    backdrop-filter: blur(10px);
                }

                .gesture-toggle:hover {
                    border-color: color-mix(in srgb, var(--color-surface) 80%, transparent);
                    background: color-mix(in srgb, var(--color-surface) 10%, transparent);
                }

                .gesture-toggle.active {
                    border-color: rgba(76, 175, 80, 0.6);
                    background: rgba(76, 175, 80, 0.1);
                }

                .status-indicator {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: color-mix(in srgb, var(--ui-shadow-color) 60%, transparent);
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    position: relative;
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }

                .status-dot.waiting { background: #ff9800; animation: pulse 1s infinite; }
                .status-dot.ready { background: #4caf50; }

                .calibration-track {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 2px;
                    background: color-mix(in srgb, var(--color-surface) 10%, transparent);
                    border-radius: 0 0 20px 20px;
                    overflow: hidden;
                }

                .calibration-fill {
                    height: 100%;
                    background: #4caf50;
                    transition: width 0.1s linear;
                }

                /* Small Camera Preview Window */
                .camera-preview-window {
                    position: fixed;
                    bottom: 32px;
                    right: 32px;
                    width: 240px;
                    height: 180px;
                    z-index: 1000;
                    background: color-mix(in srgb, var(--ui-shadow-color) 90%, transparent);
                    border: 1px solid color-mix(in srgb, var(--color-surface) 20%, transparent);
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 8px 32px color-mix(in srgb, var(--ui-shadow-color) 50%, transparent);
                    backdrop-filter: blur(10px);
                }

                .camera-preview-window video {
                    display: none;
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
                    padding: 8px 12px;
                    background: linear-gradient(to top, color-mix(in srgb, var(--ui-shadow-color) 80%, transparent), transparent);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.7rem;
                }

                .status-dot.pulsing {
                    animation: pulse 2s infinite;
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #4CAF50;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.2); }
                }
            `}</style>
        </div>
    );
};

export default HandTrackingDemo;
