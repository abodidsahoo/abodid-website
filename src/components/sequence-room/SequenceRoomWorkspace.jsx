import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './SequenceRoomWorkspace.css';
import PolaroidScatter from '../PolaroidScatter.jsx';
import SequenceRoomAuthModal from './SequenceRoomAuthModal.jsx';
import { supabase } from '../../lib/supabaseClient';
import {
    createBoard,
    deleteBoard,
    deleteBoardItems,
    duplicateBoard,
    fetchUserBoards,
    saveBoardLayout,
    setBoardSharing,
    uploadWorkingPhoto,
} from '../../lib/sequence-room/db';
import { createWorkingPhoto } from '../../lib/sequence-room/imageProcessing';
import {
    downloadFullBoardPNG,
    downloadFullBoardPDF,
    downloadSelectedArea,
    downloadScreenshot,
    downloadVisiblePDF,
} from '../../utils/sequenceRoomExport';

const MAX_BOARDS = 3;
const MAX_PHOTOS = 30;
const DESKTOP_MIN = 900;
const DEFAULT_BACKGROUND = '#fff8e8';
const DEFAULT_CUSTOM_BACKGROUND = '#ff7eb5';
const BOARD_BACKGROUNDS = [
    { id: 'light', label: 'Light', color: '#fff8e8' },
    { id: 'dark', label: 'Dark', color: '#15130f' },
];

const backgroundStorageKey = (boardId) => `sequence-room-background:${boardId || 'portfolio-demo'}`;
const customBackgroundStorageKey = (boardId) => `sequence-room-custom-background:${boardId || 'portfolio-demo'}`;
const isHexColor = (value) => /^#[0-9a-f]{6}$/i.test(value || '');
const isDarkColor = (color) => {
    if (!isHexColor(color)) return false;
    const red = parseInt(color.slice(1, 3), 16);
    const green = parseInt(color.slice(3, 5), 16);
    const blue = parseInt(color.slice(5, 7), 16);
    return ((red * 299 + green * 587 + blue * 114) / 1000) < 128;
};

const readStoredBackground = (boardId) => {
    if (typeof window === 'undefined') return DEFAULT_BACKGROUND;
    const saved = window.localStorage.getItem(backgroundStorageKey(boardId));
    return isHexColor(saved) ? saved : DEFAULT_BACKGROUND;
};

const readStoredCustomBackground = (boardId) => {
    if (typeof window === 'undefined') return DEFAULT_CUSTOM_BACKGROUND;
    const saved = window.localStorage.getItem(customBackgroundStorageKey(boardId));
    if (isHexColor(saved)) return saved;
    const active = window.localStorage.getItem(backgroundStorageKey(boardId));
    return isHexColor(active) && !BOARD_BACKGROUNDS.some((choice) => choice.color === active) ? active : DEFAULT_CUSTOM_BACKGROUND;
};

const colorPointFromHex = (hex) => {
    if (!isHexColor(hex)) return { x: .94, y: .5 };
    const red = parseInt(hex.slice(1, 3), 16) / 255;
    const green = parseInt(hex.slice(3, 5), 16) / 255;
    const blue = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    let hue = 0;
    if (delta) {
        if (max === red) hue = ((green - blue) / delta) % 6;
        else if (max === green) hue = (blue - red) / delta + 2;
        else hue = (red - green) / delta + 4;
        hue *= 60;
        if (hue < 0) hue += 360;
    }
    return { x: hue / 360, y: 1 - ((max + min) / 2) };
};

function InlineBackgroundPicker({ color, onChange }) {
    const canvasRef = useRef(null);
    const [point, setPoint] = useState(() => colorPointFromHex(color));

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        const hue = context.createLinearGradient(0, 0, canvas.width, 0);
        ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'].forEach((stop, index, colors) => hue.addColorStop(index / (colors.length - 1), stop));
        context.fillStyle = hue;
        context.fillRect(0, 0, canvas.width, canvas.height);
        const luminance = context.createLinearGradient(0, 0, 0, canvas.height);
        luminance.addColorStop(0, 'rgba(255,255,255,1)');
        luminance.addColorStop(.5, 'rgba(255,255,255,0)');
        luminance.addColorStop(1, 'rgba(0,0,0,1)');
        context.fillStyle = luminance;
        context.fillRect(0, 0, canvas.width, canvas.height);
    }, []);

    const choosePoint = useCallback((x, y) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const next = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
        const pixel = canvas.getContext('2d', { willReadFrequently: true }).getImageData(
            Math.min(canvas.width - 1, Math.round(next.x * canvas.width)),
            Math.min(canvas.height - 1, Math.round(next.y * canvas.height)),
            1,
            1,
        ).data;
        const nextColor = `#${[pixel[0], pixel[1], pixel[2]].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
        setPoint(next);
        onChange(nextColor);
    }, [onChange]);

    const chooseFromPointer = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        choosePoint((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
    };

    return (
        <div className="pb-inline-color-picker">
            <canvas
                ref={canvasRef}
                width="520"
                height="220"
                role="slider"
                tabIndex="0"
                aria-label="Choose a custom board background color"
                aria-valuetext={color}
                onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); chooseFromPointer(event); }}
                onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) chooseFromPointer(event); }}
                onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
                onPointerCancel={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
                onKeyDown={(event) => {
                    const step = event.shiftKey ? .08 : .02;
                    if (event.key === 'ArrowLeft') choosePoint(point.x - step, point.y);
                    else if (event.key === 'ArrowRight') choosePoint(point.x + step, point.y);
                    else if (event.key === 'ArrowUp') choosePoint(point.x, point.y - step);
                    else if (event.key === 'ArrowDown') choosePoint(point.x, point.y + step);
                    else return;
                    event.preventDefault();
                }}
            />
            <span className="pb-color-picker-point" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} aria-hidden="true" />
        </div>
    );
}

const errorMessage = (error, fallback) => {
    const message = error?.message || '';
    if (message.includes('FREE_BOARD_LIMIT')) return 'The free plan includes 3 boards. Delete one before creating another.';
    if (message.includes('FREE_PHOTO_LIMIT')) return 'This board already has the free-plan maximum of 30 photos.';
    if (message.includes('relation') && message.includes('does not exist')) return 'Sequence Room storage has not been migrated yet.';
    return message || fallback;
};

export default function SequenceRoomWorkspace({ demoItems = [], shareToken = '' }) {
    const [sessionResolved, setSessionResolved] = useState(Boolean(shareToken));
    const [user, setUser] = useState(null);
    const [boards, setBoards] = useState([]);
    const [activeBoard, setActiveBoard] = useState(null);
    const [sharedBoard, setSharedBoard] = useState(null);
    const [showingDemo, setShowingDemo] = useState(!shareToken);
    const [demoLayoutOverride, setDemoLayoutOverride] = useState(null);
    const [sharedError, setSharedError] = useState('');
    const [canvasItems, setCanvasItems] = useState([]);
    const canvasItemsRef = useRef([]);
    const [layoutRevision, setLayoutRevision] = useState(0);
    const [saveState, setSaveState] = useState('saved');
    const [authOpen, setAuthOpen] = useState(false);
    const [boardsOpen, setBoardsOpen] = useState(false);
    const [captureOpen, setCaptureOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [moreToolsOpen, setMoreToolsOpen] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [panelPosition, setPanelPosition] = useState(null);
    const [deleteMode, setDeleteMode] = useState(false);
    const [deleteSelection, setDeleteSelection] = useState([]);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [busy, setBusy] = useState('');
    const [uploadProgress, setUploadProgress] = useState(null);
    const [toast, setToast] = useState('');
    const [interactionCount, setInteractionCount] = useState(0);
    const [learned, setLearned] = useState({ drag: false, rotate: false, open: false });
    const [isNarrow, setIsNarrow] = useState(false);
    const [selectingArea, setSelectingArea] = useState(false);
    const [selectedAreaFormat, setSelectedAreaFormat] = useState('png');
    const [captureScope, setCaptureScope] = useState('current');
    const [captureFormat, setCaptureFormat] = useState('png');
    const [activeBackground, setActiveBackground] = useState(() => readStoredBackground('portfolio-demo'));
    const [customBackground, setCustomBackground] = useState(() => readStoredCustomBackground('portfolio-demo'));
    const [customPickerOpen, setCustomPickerOpen] = useState(false);
    const fileInputRef = useRef(null);
    const backgroundControlRef = useRef(null);
    const panelDragRef = useRef(null);
    const saveTimerRef = useRef(0);
    const toastTimerRef = useRef(0);
    const activeBoardIdRef = useRef(null);
    const customBackgroundRef = useRef(customBackground);

    const isShared = Boolean(shareToken);
    const hasPersonalBoard = Boolean(user && activeBoard && !isShared);
    const isPersonal = Boolean(hasPersonalBoard && !showingDemo);
    const displayedBoard = isShared ? sharedBoard : showingDemo ? null : activeBoard;

    useEffect(() => {
        activeBoardIdRef.current = activeBoard?.id || null;
    }, [activeBoard?.id]);

    const notify = useCallback((message) => {
        window.clearTimeout(toastTimerRef.current);
        setToast(message);
        toastTimerRef.current = window.setTimeout(() => setToast(''), 3600);
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        const previousBackground = root.style.getPropertyValue('--polaroid-hub-bg');
        const previousGrid = root.style.getPropertyValue('--polaroid-hub-grid-line');
        root.style.setProperty('--polaroid-hub-bg', activeBackground);
        root.style.setProperty('--polaroid-hub-grid-line', isDarkColor(activeBackground) ? 'rgba(255, 248, 232, 0.14)' : 'rgba(21, 19, 15, 0.09)');
        return () => {
            if (previousBackground) root.style.setProperty('--polaroid-hub-bg', previousBackground);
            else root.style.removeProperty('--polaroid-hub-bg');
            if (previousGrid) root.style.setProperty('--polaroid-hub-grid-line', previousGrid);
            else root.style.removeProperty('--polaroid-hub-grid-line');
        };
    }, [activeBackground]);

    useEffect(() => {
        const update = () => setIsNarrow(window.innerWidth < DESKTOP_MIN);
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    const openBoard = useCallback((board) => {
        const savedCustomBackground = readStoredCustomBackground(board.id);
        setShowingDemo(false);
        setActiveBackground(readStoredBackground(board.id));
        setCustomBackground(savedCustomBackground);
        customBackgroundRef.current = savedCustomBackground;
        setCustomPickerOpen(false);
        setActiveBoard(board);
        setCanvasItems(board.items || []);
        canvasItemsRef.current = board.items || [];
        setLayoutRevision((value) => value + 1);
        setBoardsOpen(false);
        setShareOpen(false);
        setDeleteMode(false);
        setDeleteSelection([]);
        setSaveState('saved');
    }, []);

    const openDemo = useCallback(({ reset = false } = {}) => {
        const savedCustomBackground = readStoredCustomBackground('portfolio-demo');
        if (reset) setDemoLayoutOverride(null);
        setActiveBackground(readStoredBackground('portfolio-demo'));
        setCustomBackground(savedCustomBackground);
        customBackgroundRef.current = savedCustomBackground;
        setCustomPickerOpen(false);
        setShowingDemo(true);
        setBoardsOpen(false);
        setShareOpen(false);
        setDeleteMode(false);
        setDeleteSelection([]);
        setLayoutRevision((value) => value + 1);
    }, []);

    useEffect(() => {
        if (!boardsOpen && !shareOpen) return undefined;
        const handleOutsideClick = (event) => {
            if (!event.target.closest('.pb-menu-wrap')) {
                setBoardsOpen(false);
                setShareOpen(false);
            }
        };
        window.addEventListener('pointerdown', handleOutsideClick);
        return () => window.removeEventListener('pointerdown', handleOutsideClick);
    }, [boardsOpen, shareOpen]);

    useEffect(() => {
        if (!customPickerOpen) return undefined;
        const boardKey = isPersonal ? activeBoard?.id : 'portfolio-demo';
        const saveOnOutsideClick = (event) => {
            if (backgroundControlRef.current?.contains(event.target)) return;
            const color = customBackgroundRef.current;
            window.localStorage.setItem(backgroundStorageKey(boardKey), color);
            window.localStorage.setItem(customBackgroundStorageKey(boardKey), color);
            setCustomPickerOpen(false);
            notify('Custom background saved.');
        };
        window.addEventListener('pointerdown', saveOnOutsideClick);
        return () => window.removeEventListener('pointerdown', saveOnOutsideClick);
    }, [customPickerOpen, isPersonal, activeBoard?.id, notify]);

    const loadPersonalBoards = useCallback(async () => {
        setBusy('Loading your boards');
        try {
            let nextBoards = await fetchUserBoards();
            if (!nextBoards.length) nextBoards = [await createBoard('Untitled Board')];
            setBoards(nextBoards);
            const firstBoardWithPhotos = nextBoards.find((board) => board.items?.length > 0);
            if (firstBoardWithPhotos) {
                openBoard(firstBoardWithPhotos);
            } else {
                setActiveBoard(nextBoards[0]);
                setShowingDemo(true);
                setLayoutRevision((value) => value + 1);
            }
        } catch (error) {
            notify(errorMessage(error, 'Your boards could not be loaded.'));
        } finally {
            setBusy('');
            setSessionResolved(true);
        }
    }, [notify, openBoard]);

    useEffect(() => {
        if (isShared) {
            fetch(`/api/sequence-room/share?token=${encodeURIComponent(shareToken)}`)
                .then(async (response) => {
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Shared board not found.');
                    setSharedBoard(data.board);
                    setActiveBackground(DEFAULT_BACKGROUND);
                    setCanvasItems(data.board.items || []);
                    canvasItemsRef.current = data.board.items || [];
                    setLayoutRevision((value) => value + 1);
                })
                .catch((error) => setSharedError(error.message))
                .finally(() => setSessionResolved(true));
            return undefined;
        }

        let alive = true;
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!alive) return;
            setUser(session?.user || null);
            if (!session?.user) setSessionResolved(true);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!alive) return;
            setUser(session?.user || null);
            if (!session?.user) {
                const savedCustomBackground = readStoredCustomBackground('portfolio-demo');
                setBoards([]);
                setActiveBoard(null);
                setShowingDemo(true);
                setDemoLayoutOverride(null);
                setActiveBackground(readStoredBackground('portfolio-demo'));
                setCustomBackground(savedCustomBackground);
                customBackgroundRef.current = savedCustomBackground;
                setCustomPickerOpen(false);
                setCanvasItems([]);
                setLayoutRevision((value) => value + 1);
                setSessionResolved(true);
            }
        });
        return () => {
            alive = false;
            subscription.unsubscribe();
        };
    }, [isShared, shareToken, loadPersonalBoards]);

    useEffect(() => {
        if (!isShared && user?.id) loadPersonalBoards();
    }, [isShared, user?.id, loadPersonalBoards]);

    useEffect(() => () => {
        window.clearTimeout(saveTimerRef.current);
        window.clearTimeout(toastTimerRef.current);
    }, []);

    const scheduleSave = useCallback((items, reason = 'layout', details = {}) => {
        if (!isPersonal) return;
        canvasItemsRef.current = items;
        setCanvasItems(items);
        setSaveState('saving');
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(async () => {
            const maxY = Math.max(0, ...canvasItemsRef.current.map((item) => Number(item.y || 0)));
            const logicalHeight = Math.min(12000, Math.max(activeBoard.logicalHeight, Math.ceil((maxY + 760) / 400) * 400));
            try {
                await saveBoardLayout(activeBoard.id, canvasItemsRef.current, {
                    logicalHeight,
                    ...details,
                });
                setActiveBoard((board) => board ? { ...board, logicalHeight, items: canvasItemsRef.current, ...details } : board);
                setBoards((current) => current.map((board) => board.id === activeBoard.id
                    ? { ...board, logicalHeight, items: canvasItemsRef.current, ...details }
                    : board));
                setSaveState('saved');
            } catch (error) {
                console.error(`Sequence Room ${reason} save failed:`, error);
                setSaveState('error');
                window.setTimeout(async () => {
                    if (!activeBoard?.id) return;
                    setSaveState('saving');
                    try {
                        await saveBoardLayout(activeBoard.id, canvasItemsRef.current, {
                            logicalHeight,
                            ...details,
                        });
                        setSaveState('saved');
                    } catch (retryError) {
                        console.error('Sequence Room autosave retry failed:', retryError);
                        setSaveState('error');
                    }
                }, 1800);
            }
        }, 650);
    }, [activeBoard, isPersonal]);

    const handleItemsChange = useCallback((items) => {
        canvasItemsRef.current = items;
        setCanvasItems(items);
    }, []);

    const handleGesture = useCallback((gesture) => {
        setLearned((current) => ({ ...current, [gesture]: true }));
        setInteractionCount((count) => count + 1);
    }, []);

    const handleTitleChange = (name) => {
        if (!activeBoard) return;
        setActiveBoard((board) => ({ ...board, name }));
        scheduleSave(canvasItemsRef.current, 'rename', { name });
    };

    const handleNewBoard = async () => {
        if (boards.length >= MAX_BOARDS) {
            notify('You have 3 boards. Delete one before creating another.');
            return;
        }
        setBusy('Creating board');
        try {
            const board = await createBoard('Untitled Board');
            setBoards((current) => [board, ...current]);
            openBoard(board);
        } catch (error) {
            notify(errorMessage(error, 'The board could not be created.'));
        } finally {
            setBusy('');
        }
    };

    const handleDuplicateBoard = async () => {
        if (!activeBoard) return;
        if (boards.length >= MAX_BOARDS) {
            notify('Duplicating would create board 4. Delete one first.');
            return;
        }
        setBusy('Duplicating board');
        try {
            const board = await duplicateBoard(activeBoard.id);
            setBoards((current) => [board, ...current]);
            openBoard(board);
            notify('Board duplicated. Both boards reuse the same photo assets.');
        } catch (error) {
            notify(errorMessage(error, 'The board could not be duplicated.'));
        } finally {
            setBusy('');
        }
    };

    const handleDeleteBoard = async () => {
        if (!activeBoard || !window.confirm(`Delete “${activeBoard.name}”? This cannot be undone.`)) return;
        setBusy('Deleting board');
        try {
            await deleteBoard(activeBoard.id);
            let remaining = boards.filter((board) => board.id !== activeBoard.id);
            if (!remaining.length) remaining = [await createBoard('Untitled Board')];
            setBoards(remaining);
            openBoard(remaining[0]);
        } catch (error) {
            notify(errorMessage(error, 'The board could not be deleted.'));
        } finally {
            setBusy('');
        }
    };

    const handleFiles = async (files) => {
        if (!user) {
            setAuthOpen(true);
            return;
        }
        if (!activeBoard) return;
        const available = MAX_PHOTOS - canvasItemsRef.current.length;
        if (available <= 0) {
            notify('This board already has 30 photos.');
            return;
        }
        const selected = Array.from(files || []).slice(0, available);
        if (!selected.length) return;
        setBusy('');
        setUploadProgress({ current: 0, total: selected.length, stage: 'Preparing photographs' });
        const added = [];
        try {
            for (let index = 0; index < selected.length; index += 1) {
                setUploadProgress({ current: index + 0.25, total: selected.length, stage: `Preparing ${index + 1} of ${selected.length}` });
                const working = await createWorkingPhoto(selected[index]);
                setUploadProgress({ current: index + 0.55, total: selected.length, stage: `Uploading ${index + 1} of ${selected.length}` });
                const existingCount = canvasItemsRef.current.length + added.length;
                const item = await uploadWorkingPhoto(activeBoard.id, working.blob, {
                    filename: working.filename,
                    width: working.width,
                    height: working.height,
                    x: ((existingCount % 4) - 1.5) * 265,
                    y: 170 + Math.floor(existingCount / 4) * 340,
                    rotation: ((existingCount % 5) - 2) * 2.8,
                    zIndex: existingCount + 20,
                });
                added.push(item);
                setUploadProgress({ current: index + 1, total: selected.length, stage: `${index + 1} of ${selected.length} ready` });
            }
            const next = [...canvasItemsRef.current, ...added];
            setCanvasItems(next);
            canvasItemsRef.current = next;
            setActiveBoard((board) => ({ ...board, items: next }));
            setBoards((current) => current.map((board) => board.id === activeBoard.id ? { ...board, items: next } : board));
            setLayoutRevision((value) => value + 1);
            setSaveState('saved');
            notify(`${added.length} photo${added.length === 1 ? '' : 's'} added. Originals stayed on this device.`);
        } catch (error) {
            notify(errorMessage(error, 'The photos could not be added.'));
        } finally {
            setBusy('');
            setUploadProgress(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const beginAddPhotos = () => {
        if (!user) {
            setAuthOpen(true);
            return;
        }
        if (!activeBoard) return;
        if (showingDemo) {
            const personalItems = activeBoard.items || [];
            setShowingDemo(false);
            setCanvasItems(personalItems);
            canvasItemsRef.current = personalItems;
            setLayoutRevision((value) => value + 1);
        }
        window.requestAnimationFrame(() => fileInputRef.current?.click());
    };

    const confirmDeleteItems = async () => {
        if (!deleteSelection.length) return;
        setDeleteConfirmOpen(false);

        if (showingDemo && !isShared) {
            const next = canvasItemsRef.current.filter((item) => !deleteSelection.includes(item.id));
            canvasItemsRef.current = next;
            setCanvasItems(next);
            setDemoLayoutOverride(next);
            setDeleteSelection([]);
            setDeleteMode(false);
            setLayoutRevision((value) => value + 1);
            notify('Photos hidden from this demo. Reload or reset the demo to bring them back.');
            return;
        }

        if (!activeBoard) return;
        const boardId = activeBoard.id;
        const selectedIds = [...deleteSelection];
        const previousItems = canvasItemsRef.current;
        const next = previousItems.filter((item) => !selectedIds.includes(item.id));

        canvasItemsRef.current = next;
        setCanvasItems(next);
        setActiveBoard((board) => board?.id === boardId ? { ...board, items: next } : board);
        setBoards((current) => current.map((board) => board.id === boardId ? { ...board, items: next } : board));
        setDeleteSelection([]);
        setDeleteMode(false);
        setLayoutRevision((value) => value + 1);
        setBusy('Finishing deletion…');

        try {
            await deleteBoardItems(boardId, selectedIds);
            notify('Photos removed from this board.');
        } catch (error) {
            if (activeBoardIdRef.current === boardId) {
                canvasItemsRef.current = previousItems;
                setCanvasItems(previousItems);
                setLayoutRevision((value) => value + 1);
            }
            setActiveBoard((board) => board?.id === boardId ? { ...board, items: previousItems } : board);
            setBoards((current) => current.map((board) => board.id === boardId ? { ...board, items: previousItems } : board));
            notify(errorMessage(error, 'The selected photos could not be deleted.'));
        } finally {
            setBusy('');
        }
    };

    const handleShare = async (enabled) => {
        if (!activeBoard) return;
        setBusy(enabled ? 'Creating share link' : 'Disabling link');
        try {
            const result = await setBoardSharing(activeBoard.id, enabled);
            setActiveBoard((board) => ({ ...board, sharingEnabled: enabled }));
            setBoards((current) => current.map((board) => board.id === activeBoard.id ? { ...board, sharingEnabled: enabled } : board));
            if (result.shareUrl) {
                await navigator.clipboard.writeText(result.shareUrl);
                notify('Private share link copied.');
            } else notify('The old share link has been disabled.');
            setShareOpen(false);
        } catch (error) {
            notify(errorMessage(error, 'Sharing could not be updated.'));
        } finally {
            setBusy('');
        }
    };

    const runCapture = async () => {
        setCaptureOpen(false);
        if (captureScope === 'custom') {
            setSelectedAreaFormat(captureFormat);
            setSelectingArea(true);
            notify('Draw a box around the area you want to export.');
            return;
        }
        setBusy('Rendering capture');
        try {
            if (captureScope === 'current' && captureFormat === 'png') await downloadScreenshot();
            if (captureScope === 'current' && captureFormat === 'pdf') await downloadVisiblePDF();
            if (captureScope === 'full' && captureFormat === 'png') await downloadFullBoardPNG();
            if (captureScope === 'full' && captureFormat === 'pdf') await downloadFullBoardPDF();
            notify('Capture downloaded.');
        } catch (error) {
            console.error('Sequence Room capture failed:', error);
            notify('Capture failed. Check that every image host allows export.');
        } finally {
            setBusy('');
        }
    };

    const changeBackground = (color) => {
        const boardKey = isPersonal ? activeBoard?.id : 'portfolio-demo';
        setCustomPickerOpen(false);
        setActiveBackground(color);
        window.localStorage.setItem(backgroundStorageKey(boardKey), color);
        notify('Board background updated. Exports will use this exact colour.');
    };

    const previewCustomBackground = useCallback((color) => {
        customBackgroundRef.current = color;
        setCustomBackground(color);
        setActiveBackground(color);
    }, []);

    const openCustomBackgroundPicker = () => {
        setActiveBackground(customBackgroundRef.current);
        setCustomPickerOpen(true);
    };

    const startPanelDrag = (event) => {
        if (event.button !== 0) return;
        const panel = event.currentTarget.closest('.pb-control-panel');
        const rect = panel?.getBoundingClientRect();
        if (!rect) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        panelDragRef.current = {
            pointerId: event.pointerId,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            width: rect.width,
            height: rect.height,
        };
        setPanelPosition({ left: rect.left, top: rect.top });
    };

    const movePanel = (event) => {
        const drag = panelDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const left = Math.max(8, Math.min(window.innerWidth - drag.width - 8, event.clientX - drag.offsetX));
        const top = Math.max(8, Math.min(Math.max(8, window.innerHeight - drag.height - 8), event.clientY - drag.offsetY));
        setPanelPosition({ left, top });
    };

    const endPanelDrag = (event) => {
        if (panelDragRef.current?.pointerId !== event.pointerId) return;
        panelDragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setBoardsOpen(false);
        notify('Signed out. The demo board is ready to play.');
    };

    const handleAuthSuccess = (nextUser) => {
        setUser(nextUser);
        setAuthOpen(false);
        notify('Signed in. Your saved boards are loading.');
    };

    if (!sessionResolved || (isShared && !sharedBoard && !sharedError)) {
        return <div className="pb-loading"><span>SEQUENCE ROOM</span><p>Restoring the board…</p></div>;
    }

    if (isShared && sharedError) {
        return <div className="pb-loading"><span>LINK UNAVAILABLE</span><p>{sharedError}</p><a href="/lab/sequence-room">Open the demo board</a></div>;
    }

    if (isNarrow && !isShared) {
        return (
            <div className="pb-mobile-gate">
                <span>SEQUENCE ROOM / DESKTOP</span>
                <h1>Give your photographs room.</h1>
                <p>Please open Sequence Room on a desktop to arrange and sequence photographs.</p>
                <a href="/lab">Back to the lab</a>
            </div>
        );
    }

    const layoutItems = showingDemo ? demoLayoutOverride : displayedBoard ? displayedBoard.items : null;
    const boardName = isShared ? sharedBoard?.name : showingDemo ? 'Portfolio demo board' : activeBoard?.name;
    const boardSaveState = isPersonal ? saveState : 'saved';
    const boardSaveLabel = isPersonal
        ? saveState === 'saving' ? 'Autosaving…' : saveState === 'error' ? 'Autosave needs attention' : 'Autosaved'
        : isShared ? 'Saved shared board' : 'Demo changes stay local';
    const boardSaveGlyph = boardSaveState === 'saved' ? '✓' : boardSaveState === 'saving' ? '…' : boardSaveState === 'error' ? '!' : '↺';
    const logicalHeight = showingDemo ? 2200 : displayedBoard?.logicalHeight || 2200;
    const uploadPercent = uploadProgress
        ? Math.max(4, Math.min(100, Math.round((uploadProgress.current / uploadProgress.total) * 100)))
        : 0;
    const userName = user?.user_metadata?.full_name
        || user?.user_metadata?.name
        || user?.email?.split('@')[0]
        || 'Sequence Room user';
    return (
        <div className={`pb-workspace ${isShared ? 'is-shared' : ''} ${isDarkColor(activeBackground) ? 'is-dark-background' : ''}`}>
            <header className="pb-header">
                <div className="pb-brand-group">
                    <a className="pb-back-button" href="/lab"><span aria-hidden="true">←</span> BACK TO LAB</a>
                    <div className="pb-title-wrap">
                        <span className="pb-menu-label">BOARD NAME</span>
                        <div className="pb-board-name-control">
                            {isPersonal ? (
                            <input value={activeBoard.name} onChange={(event) => handleTitleChange(event.target.value)} aria-label="Board name" maxLength={80} />
                            ) : <strong>{boardName}</strong>}
                            <span className={`pb-save-state is-${boardSaveState}`} role="status" aria-live="polite" aria-label={boardSaveLabel} title={boardSaveLabel}>
                                <span className="pb-save-state-icon" aria-hidden="true">{boardSaveGlyph}</span>
                            </span>
                        </div>
                    </div>
                </div>
                <div className="pb-center-brand">
                    <h1 className="pb-brand-title">SEQUENCE ROOM</h1>
                    <p className="pb-brand-subtitle">your analog photo sequencing workspace</p>
                </div>
            </header>

            {controlsVisible ? (
                <aside
                    className="pb-control-panel"
                    aria-label="Sequence Room controls"
                    style={panelPosition ? { left: panelPosition.left, top: panelPosition.top, right: 'auto' } : undefined}
                >
                    <div className="pb-panel-handle" onPointerDown={startPanelDrag} onPointerMove={movePanel} onPointerUp={endPanelDrag} onPointerCancel={endPanelDrag}>
                        <span><b aria-hidden="true">⠿</b> Controls</span>
                        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setControlsVisible(false)}>Hide</button>
                    </div>

                    <div className="pb-panel-primary">
                        <button className="pb-button pb-button-yellow" onClick={() => { setCaptureOpen((open) => !open); setMoreToolsOpen(false); setBoardsOpen(false); setShareOpen(false); }} aria-expanded={captureOpen}>Take a Screengrab</button>
                        <AnimatePresence>{captureOpen && (
                            <motion.div className="pb-capture-menu" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                <div className="pb-capture-scope" role="group" aria-label="Export view">
                                    <button className={captureScope === 'current' ? 'is-selected' : ''} aria-pressed={captureScope === 'current'} onClick={() => setCaptureScope('current')}>
                                        <strong>Current</strong>
                                        <small>On screen</small>
                                    </button>
                                    <button className={captureScope === 'full' ? 'is-selected' : ''} aria-pressed={captureScope === 'full'} onClick={() => setCaptureScope('full')}>
                                        <strong>Full Board</strong>
                                        <small>Everything</small>
                                    </button>
                                    <button className={captureScope === 'custom' ? 'is-selected' : ''} aria-pressed={captureScope === 'custom'} onClick={() => setCaptureScope('custom')}>
                                        <strong>Draw Area</strong>
                                        <small>Select freely</small>
                                    </button>
                                </div>
                                <div className="pb-capture-format-row">
                                    <div className="pb-format-toggle" role="group" aria-label="Export file type">
                                        <button className={captureFormat === 'png' ? 'is-selected' : ''} aria-pressed={captureFormat === 'png'} onClick={() => setCaptureFormat('png')}>PNG</button>
                                        <button className={captureFormat === 'pdf' ? 'is-selected' : ''} aria-pressed={captureFormat === 'pdf'} onClick={() => setCaptureFormat('pdf')}>PDF</button>
                                    </div>
                                    <button className="pb-capture-download" onClick={runCapture}>
                                        {captureScope === 'custom' ? 'Draw & Download' : 'Download'}
                                    </button>
                                </div>
                            </motion.div>
                        )}</AnimatePresence>

                    {!isShared && (
                        <div className="pb-add-photos-row">
                            <input ref={fileInputRef} hidden type="file" multiple accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif" onChange={(event) => handleFiles(event.target.files)} />
                            <button className="pb-button pb-button-pink" onClick={() => { setBoardsOpen(false); setShareOpen(false); beginAddPhotos(); }}>＋ Add Photos</button>
                        </div>
                    )}

                        {!user && !isShared && <button className="pb-button pb-signin-button" onClick={() => { setBoardsOpen(false); setShareOpen(false); setAuthOpen(true); }}>Sign In</button>}
                        {user && !isShared && (
                            <section className="pb-user-card" aria-label="Signed-in account">
                                <span className="pb-user-avatar" aria-hidden="true">{userName.charAt(0).toUpperCase()}</span>
                                <span className="pb-user-copy"><strong>{userName}</strong><small>{user.email}</small></span>
                                <button onClick={signOut}>Log Out</button>
                            </section>
                        )}
                        {isShared && <span className="pb-shared-note">Play freely — changes stay here</span>}
                    </div>

                    {!isShared && (
                        <div className="pb-panel-more">
                            <button className="pb-panel-disclosure" onClick={() => { setMoreToolsOpen((open) => { const next = !open; if (!next) { setBoardsOpen(false); setShareOpen(false); } return next; }); setCaptureOpen(false); }} aria-expanded={moreToolsOpen}>
                                <span>Board Tools</span><span aria-hidden="true">{moreToolsOpen ? '−' : '+'}</span>
                            </button>
                            <AnimatePresence>{moreToolsOpen && (
                                <motion.div className="pb-panel-secondary" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                    <div className="pb-background-control" ref={backgroundControlRef}>
                                        <span className="pb-menu-label">BACKGROUND</span>
                                        {customPickerOpen ? (
                                            <InlineBackgroundPicker color={customBackground} onChange={previewCustomBackground} />
                                        ) : (
                                            <div className="pb-background-options" role="group" aria-label="Board background colour">
                                                {BOARD_BACKGROUNDS.map((choice) => (
                                                    <button key={choice.id} className={activeBackground === choice.color ? 'is-selected' : ''} aria-label={choice.label} aria-pressed={activeBackground === choice.color} title={choice.label} onClick={() => changeBackground(choice.color)}>
                                                        <span className="pb-palette-swatch" style={{ background: choice.color }} aria-hidden="true" />
                                                        <small>{choice.label}</small>
                                                    </button>
                                                ))}
                                                <button className={activeBackground === customBackground ? 'is-selected' : ''} aria-label="Custom background" aria-pressed={activeBackground === customBackground} aria-expanded={customPickerOpen} title="Custom" onClick={openCustomBackgroundPicker}>
                                                    <span className="pb-palette-swatch" style={{ background: customBackground }} aria-hidden="true" />
                                                    <small>Custom</small>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <button className={`pb-button ${deleteMode ? 'pb-button-active' : ''}`} onClick={() => { setDeleteMode((value) => !value); setDeleteSelection([]); setBoardsOpen(false); setShareOpen(false); }}>Delete Photos</button>

                                    {user && <div className="pb-menu-wrap">
                                        <button className="pb-button pb-board-button" onClick={() => { setBoardsOpen((open) => !open); setShareOpen(false); }}>Saved Boards · {Math.max(boards.length, 1)} / 3</button>
                                        <AnimatePresence mode="wait">{boardsOpen && (
                                             <motion.div
                                                className="pb-popover pb-board-menu"
                                                initial={{ opacity: 0, x: 8 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 6 }}
                                                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                                            >
                                                <span className="pb-menu-label">YOUR BOARDS</span>
                                                <div className="pb-saved-board-list">
                                                    {boards.map((board) => <button key={board.id} className={!showingDemo && board.id === activeBoard.id ? 'is-current' : ''} onClick={() => openBoard(board)}><span><strong>{board.name || 'Untitled board'}</strong><small>{board.items.length} photos</small></span>{!showingDemo && board.id === activeBoard.id && <b>OPEN</b>}</button>)}
                                                </div>
                                                <button className="pb-new-board-action" onClick={handleNewBoard}>＋ New board</button>
                                                <div className="pb-menu-grid">
                                                    <button onClick={handleDuplicateBoard}>Duplicate</button>
                                                    <button className="is-danger" onClick={handleDeleteBoard}>Delete board</button>
                                                </div>
                                                <div className="pb-demo-board">
                                                    <span className="pb-menu-label">SHOWCASE</span>
                                                    <button className={showingDemo ? 'is-current' : ''} onClick={() => openDemo()}><span><strong>Portfolio demo</strong><small>{demoItems.length} photographs · Try the layout</small></span><b aria-hidden="true">↗</b></button>
                                                </div>
                                            </motion.div>
                                        )}</AnimatePresence>
                                    </div>}

                                    {isPersonal && <div className="pb-menu-wrap">
                                        <button className="pb-button pb-share-button" onClick={() => { setShareOpen((open) => !open); setBoardsOpen(false); }}>Share the Board</button>
                                        <AnimatePresence mode="wait">{shareOpen && (
                                            <motion.div
                                                className="pb-popover pb-share-menu"
                                                initial={{ opacity: 0, x: 8 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 6 }}
                                                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                                            >
                                                <span className="pb-menu-label">UNLISTED, READ-ONLY LINK</span>
                                                <p>Visitors can rearrange a local copy, but their changes never touch your board.</p>
                                                <button className="pb-share-action" onClick={() => handleShare(true)}>Create new link</button>
                                                {activeBoard.sharingEnabled && <button className="pb-link-danger" onClick={() => handleShare(false)}>Disable current link</button>}
                                            </motion.div>
                                        )}</AnimatePresence>
                                    </div>}
                                </motion.div>
                            )}</AnimatePresence>
                        </div>
                    )}
                </aside>
            ) : (
                <button className="pb-show-controls" onClick={() => setControlsVisible(true)}>Show Controls</button>
            )}

            {!isShared && !user && (
                <div className="pb-gesture-hints" aria-label="How to use Sequence Room">
                    {!learned.drag && <span><b>01</b> Drag to move</span>}
                    {!learned.rotate && <span><b>02</b> Corner: rotate · diagonal: resize</span>}
                    {!learned.open && <span><b>03</b> Click to open</span>}
                </div>
            )}

            <AnimatePresence>
                {deleteMode && (
                    <motion.div
                        className="pb-delete-bar"
                        initial={{ opacity: 0, y: 14, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: 14, x: '-50%' }}
                        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <span><strong>Select photographs</strong><small>{deleteSelection.length ? `${deleteSelection.length} selected` : 'Click a photo to mark it'}</small></span>
                        <button onClick={() => { setDeleteConfirmOpen(false); setDeleteMode(false); setDeleteSelection([]); }}>Cancel</button>
                        <button className="pb-delete-confirm" disabled={!deleteSelection.length} onClick={() => setDeleteConfirmOpen(true)}>Delete {deleteSelection.length || ''} photos</button>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {deleteConfirmOpen && (
                    <motion.div
                        className="pb-confirm-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setDeleteConfirmOpen(false)}
                    >
                        <motion.section
                            className="pb-confirm-dialog"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="pb-delete-confirm-title"
                            initial={{ y: 20, scale: .97 }}
                            animate={{ y: 0, scale: 1 }}
                            exit={{ y: 20, scale: .97 }}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => { if (event.key === 'Escape') setDeleteConfirmOpen(false); }}
                        >
                            <span className="pb-confirm-label">SEQUENCE ROOM / CONFIRM</span>
                            <h2 id="pb-delete-confirm-title">Delete {deleteSelection.length} photo{deleteSelection.length === 1 ? '' : 's'} from this board?</h2>
                            <p>This removes the selected {deleteSelection.length === 1 ? 'photograph' : 'photographs'} from the current board.</p>
                            <div className="pb-confirm-actions">
                                <button type="button" autoFocus onClick={() => setDeleteConfirmOpen(false)}>Keep photos</button>
                                <button type="button" className="pb-confirm-delete" onClick={confirmDeleteItems}>Delete {deleteSelection.length}</button>
                            </div>
                        </motion.section>
                    </motion.div>
                )}
            </AnimatePresence>

            <main className="pb-board-scroll" aria-label={boardName || 'Hitesh demo board'}>
                <PolaroidScatter
                    items={demoItems}
                    immersive
                    deepLinkParam="photo"
                    layoutItems={layoutItems}
                    layoutKey={`${showingDemo ? 'portfolio-demo' : displayedBoard?.id || 'shared-board'}:${layoutRevision}`}
                    logicalWidth={displayedBoard?.logicalWidth || 1440}
                    logicalHeight={logicalHeight}
                    selectionMode={deleteMode}
                    selectedItemIds={deleteSelection}
                    onSelectionChange={setDeleteSelection}
                    onItemsChange={handleItemsChange}
                    onCommit={scheduleSave}
                    onGesture={handleGesture}
                    readOnly={isShared && isNarrow}
                />
                {isPersonal && logicalHeight < 12000 && (
                    <button className="pb-extend-board" onClick={() => {
                        const nextHeight = Math.min(12000, logicalHeight + 800);
                        setActiveBoard((board) => ({ ...board, logicalHeight: nextHeight }));
                        scheduleSave(canvasItemsRef.current, 'resize', { logicalHeight: nextHeight });
                    }}>＋ Add more board space</button>
                )}
            </main>

            {selectingArea && <AreaSelector format={selectedAreaFormat} onCancel={() => setSelectingArea(false)} onDone={() => { setSelectingArea(false); notify('Selected area downloaded.'); }} />}
            <SequenceRoomAuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} onAuthSuccess={handleAuthSuccess} />
            <AnimatePresence>{uploadProgress && (
                <motion.div className="pb-upload-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <motion.section className="pb-upload-card" role="status" aria-live="polite" initial={{ y: 24, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: .97 }}>
                        <span className="pb-upload-label">SEQUENCE ROOM / UPLOAD</span>
                        <h2>Get ready to sequence your photos!</h2>
                        <p>{uploadProgress.stage}</p>
                        <div className="pb-progress-track" aria-label={`${uploadPercent}% uploaded`}>
                            <motion.div className="pb-progress-fill" animate={{ width: `${uploadPercent}%` }} transition={{ duration: .22, ease: 'easeOut' }} />
                        </div>
                        <div className="pb-progress-meta"><strong>{uploadPercent}%</strong><span>{Math.min(Math.floor(uploadProgress.current), uploadProgress.total)} / {uploadProgress.total} ready</span></div>
                    </motion.section>
                </motion.div>
            )}</AnimatePresence>
            <AnimatePresence>{(toast || busy) && <motion.div className="pb-toast" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}>{busy || toast}</motion.div>}</AnimatePresence>
        </div>
    );
}

function AreaSelector({ format, onCancel, onDone }) {
    const startRef = useRef(null);
    const [rect, setRect] = useState(null);

    useEffect(() => {
        const keydown = (event) => {
            if (event.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', keydown);
        return () => window.removeEventListener('keydown', keydown);
    }, [onCancel]);

    const pointerDown = (event) => {
        startRef.current = { x: event.clientX, y: event.clientY };
        setRect({ x: event.clientX, y: event.clientY, width: 0, height: 0 });
        event.currentTarget.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event) => {
        if (!startRef.current) return;
        const x = Math.min(startRef.current.x, event.clientX);
        const y = Math.min(startRef.current.y, event.clientY);
        setRect({ x, y, width: Math.abs(event.clientX - startRef.current.x), height: Math.abs(event.clientY - startRef.current.y) });
    };
    const pointerUp = async () => {
        startRef.current = null;
        if (!rect || rect.width < 20 || rect.height < 20) return;
        await downloadSelectedArea(rect, format);
        onDone();
    };

    return (
        <div className="pb-area-selector" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}>
            <div className="pb-area-instruction">Drag to select · Esc to cancel</div>
            <button onPointerDown={(event) => event.stopPropagation()} onClick={onCancel}>Cancel</button>
            {rect && <div className="pb-area-rect" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} />}
        </div>
    );
}
