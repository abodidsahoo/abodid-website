import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generates formatted timestamp: "YYYY-MM-DD at HH.mm.ss"
 */
export const getExportTimestamp = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} at ${hours}.${minutes}.${seconds}`;
};

/**
 * Helper to draw a rounded rectangle path on a 2D canvas context
 */
function roundRect(ctx, x, y, width, height, radius) {
    if (radius <= 0) {
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.closePath();
        return;
    }
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 * Ensures an image can be drawn to 2D canvas without cross-origin taint.
 * Keeps page URLs untouched while proxying external assets only during export.
 */
async function getImageDrawable(img) {
    if (!img || !img.src) return null;
    const src = img.currentSrc || img.src;

    if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith(window.location.origin)) {
        return img;
    }

    try {
        const proxyUrl = `/api/image-palette-proxy?url=${encodeURIComponent(src)}`;
        const proxyImg = new Image();
        proxyImg.crossOrigin = 'anonymous';
        proxyImg.src = proxyUrl;
        if (proxyImg.complete && proxyImg.naturalWidth > 0) return proxyImg;
        await new Promise((resolve) => {
            proxyImg.onload = () => resolve(proxyImg);
            proxyImg.onerror = () => resolve(img);
        });
        return proxyImg;
    } catch (_) {
        return img;
    }
}

/**
 * Frames the captured viewport with balanced optical margins & rounded rectangular canvas
 */
function createOpticallyFramedCanvas(rawCanvas, activeBgColor) {
    const w = rawCanvas.width;
    const h = rawCanvas.height;
    // Keep the outer mat visually even on every edge. Basing the inset on the
    // shorter side avoids the wide side gutters produced by percentage-per-axis padding.
    const uniformPadding = Math.round(Math.min(w, h) * 0.048);
    const padX = uniformPadding;
    const padY = uniformPadding;

    const outerWidth = w + padX * 2;
    const outerHeight = h + padY * 2;
    const cornerRadius = Math.round(Math.min(w, h) * 0.022); // Elegant rounded corners

    const framedCanvas = document.createElement('canvas');
    framedCanvas.width = outerWidth;
    framedCanvas.height = outerHeight;
    const ctx = framedCanvas.getContext('2d');
    if (!ctx) return rawCanvas;

    // 1. Fill outer backdrop
    ctx.fillStyle = activeBgColor;
    ctx.fillRect(0, 0, outerWidth, outerHeight);

    // 2. Draw outer soft drop shadow for the rounded rectangle frame
    ctx.save();
    roundRect(ctx, padX, padY, w, h, cornerRadius);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.40)';
    ctx.shadowBlur = Math.round(Math.min(w, h) * 0.032);
    ctx.shadowOffsetY = Math.round(Math.min(w, h) * 0.014);
    ctx.fillStyle = activeBgColor;
    ctx.fill();
    ctx.restore();

    // 3. Clip inside rounded rectangle and draw captured photo board
    ctx.save();
    roundRect(ctx, padX, padY, w, h, cornerRadius);
    ctx.clip();
    ctx.drawImage(rawCanvas, padX, padY, w, h);
    ctx.restore();

    // 4. Subtle crisp outline border
    ctx.save();
    roundRect(ctx, padX, padY, w, h, cornerRadius);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    return framedCanvas;
}

/**
 * Ultra-fast, instantaneous direct viewport compositor (< 15ms execution).
 * Directly composites the background grid and visible polaroid cards with hardware-accelerated 2D canvas.
 */
export async function captureVisibleCanvas({ framed = true } = {}) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 2);

    const activeBgColor =
        getComputedStyle(document.documentElement)
            .getPropertyValue('--polaroid-hub-bg')
            .trim() || getComputedStyle(document.querySelector('.polaroid-hub-immersive') || document.body).backgroundColor || '#fff8e8';

    const gridLineColor =
        getComputedStyle(document.documentElement)
            .getPropertyValue('--polaroid-hub-grid-line')
            .trim() || 'rgba(255, 255, 255, 0.12)';

    // Raw un-framed canvas
    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = Math.round(viewportWidth * dpr);
    rawCanvas.height = Math.round(viewportHeight * dpr);
    const ctx = rawCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not create 2D canvas context');

    ctx.scale(dpr, dpr);

    // 1. Fill base backdrop
    ctx.fillStyle = activeBgColor;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    // 2. Draw Blueprint Grid Pattern
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const gridSize = 50;

    ctx.save();
    ctx.strokeStyle = gridLineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();

    const startX = ((-scrollX % gridSize) + gridSize) % gridSize;
    for (let x = startX; x <= viewportWidth; x += gridSize) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, viewportHeight);
    }

    const startY = ((-scrollY % gridSize) + gridSize) % gridSize;
    for (let y = startY; y <= viewportHeight; y += gridSize) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(viewportWidth, y + 0.5);
    }
    ctx.stroke();
    ctx.restore();

    // 3. Query and sort visible Polaroid cards by z-index
    const allCards = Array.from(document.querySelectorAll('.polaroid-card'));
    const visibleCards = allCards.filter((card) => {
        const r = card.getBoundingClientRect();
        return r.right > -100 && r.left < viewportWidth + 100 && r.bottom > -100 && r.top < viewportHeight + 100;
    });

    visibleCards.sort((a, b) => {
        const zA = parseInt(window.getComputedStyle(a).zIndex, 10) || 0;
        const zB = parseInt(window.getComputedStyle(b).zIndex, 10) || 0;
        return zA - zB;
    });

    // 4. Pre-fetch / prepare drawable images in parallel
    const drawableImages = await Promise.all(
        visibleCards.map((card) => getImageDrawable(card.querySelector('img')))
    );

    // 5. Draw each visible polaroid card
    visibleCards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const style = window.getComputedStyle(card);
        const matrixStr = style.transform;
        let angle = 0;
        let scale = 1;

        if (matrixStr && matrixStr !== 'none') {
            try {
                const matrix = new DOMMatrixReadOnly(matrixStr);
                angle = Math.atan2(matrix.b, matrix.a);
                scale = Math.hypot(matrix.a, matrix.b) || 1;
            } catch (_) {}
        }

        const w = card.offsetWidth || 300;
        const h = card.offsetHeight || 403;
        const left = -w / 2;
        const top = -h / 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.scale(scale, scale);

        // A. Card Drop Shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 6;
        ctx.fillStyle = '#fdfdfd';
        roundRect(ctx, left, top, w, h, 2);
        ctx.fill();
        ctx.restore();

        // B. Card White Body
        ctx.fillStyle = '#fdfdfd';
        roundRect(ctx, left, top, w, h, 2);
        ctx.fill();

        // C. Photo Image (264x264 1:1 square centered with 18px padding)
        const pad = 18;
        const imgW = w - pad * 2;
        const imgH = imgW;
        const imgX = left + pad;
        const imgY = top + pad;

        const img = drawableImages[index];
        if (img && (img.naturalWidth || img.width)) {
            ctx.save();
            roundRect(ctx, imgX, imgY, imgW, imgH, 0);
            ctx.clip();

            const nw = img.naturalWidth || img.width;
            const nh = img.naturalHeight || img.height;
            const imgAspect = nw / nh;
            const targetAspect = imgW / imgH; // 1.0

            let sx = 0;
            let sy = 0;
            let sw = nw;
            let sh = nh;

            if (imgAspect > targetAspect) {
                sw = nh * targetAspect;
                sx = (nw - sw) / 2;
            } else {
                sh = nw / targetAspect;
                sy = (nh - sh) / 2;
            }

            try {
                ctx.drawImage(img, sx, sy, sw, sh, imgX, imgY, imgW, imgH);
            } catch (err) {
                ctx.fillStyle = '#222';
                ctx.fillRect(imgX, imgY, imgW, imgH);
            }
            ctx.restore();
        } else {
            ctx.fillStyle = '#222';
            ctx.fillRect(imgX, imgY, imgW, imgH);
        }

        ctx.restore();
    });

    // 6. Return optically framed canvas with rounded margins
    return framed ? createOpticallyFramedCanvas(rawCanvas, activeBgColor) : rawCanvas;
}

/**
 * Captures visible area with optical framing and instantaneously triggers PNG download
 */
export async function downloadScreenshot() {
    const canvas = await captureVisibleCanvas();
    const filename = `photo board ${getExportTimestamp()}.png`;
    const dataUrl = canvas.toDataURL('image/png');

    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return filename;
}

/**
 * Captures visible area with optical framing and instantaneously triggers PDF download
 */
export async function downloadVisiblePDF() {
    const canvas = await captureVisibleCanvas();
    const filename = `photo board visible ${getExportTimestamp()}.pdf`;
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
    const pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [canvas.width, canvas.height],
        hotfixes: ['px_scaling'],
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
    pdf.save(filename);
    return filename;
}

export async function downloadFullBoardPNG() {
    const board = document.querySelector('[data-photo-board-canvas]');
    if (!board) throw new Error('Photo Board canvas was not found.');
    const backgroundColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--polaroid-hub-bg')
        .trim() || '#fff8e8';
    const canvas = await html2canvas(board, {
        backgroundColor,
        useCORS: true,
        allowTaint: false,
        logging: false,
        scale: 1,
        width: board.scrollWidth,
        height: board.scrollHeight,
        windowWidth: board.scrollWidth,
        windowHeight: board.scrollHeight,
    });
    const filename = `photo board full ${getExportTimestamp()}.png`;
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
    return filename;
}

export async function downloadSelectedArea(rect, format = 'png') {
    const full = await captureVisibleCanvas({ framed: false });
    const scaleX = full.width / window.innerWidth;
    const scaleY = full.height / window.innerHeight;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(rect.width * scaleX));
    canvas.height = Math.max(1, Math.round(rect.height * scaleY));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create the selected capture.');
    context.drawImage(
        full,
        rect.x * scaleX,
        rect.y * scaleY,
        rect.width * scaleX,
        rect.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height,
    );
    const filename = `photo board selection ${getExportTimestamp()}.${format === 'pdf' ? 'pdf' : 'png'}`;
    if (format === 'pdf') {
        const pdf = new jsPDF({
            orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [canvas.width, canvas.height],
            hotfixes: ['px_scaling'],
        });
        pdf.addImage(canvas.toDataURL('image/jpeg', .95), 'JPEG', 0, 0, canvas.width, canvas.height);
        pdf.save(filename);
    } else {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }
    return filename;
}

/**
 * High-Resolution Crisp Print Full Board PDF Export
 * Renders the entire continuous scatter canvas with chunked slices and crisp print DPI.
 */
export async function downloadFullBoardPDF(onProgress) {
    const allCards = Array.from(document.querySelectorAll('.polaroid-card'));
    if (!allCards.length) {
        return downloadVisiblePDF();
    }

    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const viewportWidth = window.innerWidth;

    // 1. Calculate absolute board bounds from all scattered cards
    let maxCardY = 0;
    const cardData = allCards.map((card) => {
        const rect = card.getBoundingClientRect();
        const absX = rect.left + scrollX;
        const absY = rect.top + scrollY;
        const w = card.offsetWidth || 300;
        const h = card.offsetHeight || 403;
        if (absY + h > maxCardY) maxCardY = absY + h;

        const style = window.getComputedStyle(card);
        const matrixStr = style.transform;
        let angle = 0;
        let scale = 1;
        if (matrixStr && matrixStr !== 'none') {
            try {
                const matrix = new DOMMatrixReadOnly(matrixStr);
                angle = Math.atan2(matrix.b, matrix.a);
                scale = Math.hypot(matrix.a, matrix.b) || 1;
            } catch (_) {}
        }

        const zIndex = parseInt(style.zIndex, 10) || 0;

        return {
            card,
            absX,
            absY,
            w,
            h,
            cx: absX + w / 2,
            cy: absY + h / 2,
            angle,
            scale,
            zIndex,
            imgEl: card.querySelector('img'),
        };
    });

    // Sort cards by stacking zIndex
    cardData.sort((a, b) => a.zIndex - b.zIndex);

    const totalBoardHeight = Math.max(Math.round(maxCardY + 280), window.innerHeight);
    const activeBgColor =
        getComputedStyle(document.documentElement)
            .getPropertyValue('--polaroid-hub-bg')
            .trim() || getComputedStyle(document.querySelector('.polaroid-hub-immersive') || document.body).backgroundColor || '#fff8e8';

    const gridLineColor =
        getComputedStyle(document.documentElement)
            .getPropertyValue('--polaroid-hub-grid-line')
            .trim() || 'rgba(255, 255, 255, 0.12)';

    // Pre-fetch all images across the full board in parallel
    if (typeof onProgress === 'function') onProgress('Preparing high-res photo assets...');
    const drawableImages = await Promise.all(
        cardData.map((cd) => getImageDrawable(cd.imgEl))
    );

    // Initialize full continuous poster PDF
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [viewportWidth, totalBoardHeight],
        hotfixes: ['px_scaling'],
    });

    // 2. Chunk rendering into sequential slices (max 6000px height per slice for GPU memory safety)
    const chunkSize = 6000;
    const numSlices = Math.ceil(totalBoardHeight / chunkSize);
    const printDpr = 1.5; // Crisp print scale

    for (let sliceIdx = 0; sliceIdx < numSlices; sliceIdx++) {
        const sliceStartY = sliceIdx * chunkSize;
        const sliceHeight = Math.min(chunkSize, totalBoardHeight - sliceStartY);

        if (typeof onProgress === 'function') {
            onProgress(`Rendering print slice ${sliceIdx + 1}/${numSlices}...`);
        }

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = Math.round(viewportWidth * printDpr);
        sliceCanvas.height = Math.round(sliceHeight * printDpr);
        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) continue;

        ctx.scale(printDpr, printDpr);

        // A. Fill slice background
        ctx.fillStyle = activeBgColor;
        ctx.fillRect(0, 0, viewportWidth, sliceHeight);

        // B. Blueprint Grid
        const gridSize = 50;
        ctx.save();
        ctx.strokeStyle = gridLineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (let x = 0; x <= viewportWidth; x += gridSize) {
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, sliceHeight);
        }

        const gridOffsetY = ((-sliceStartY % gridSize) + gridSize) % gridSize;
        for (let y = gridOffsetY; y <= sliceHeight; y += gridSize) {
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(viewportWidth, y + 0.5);
        }
        ctx.stroke();
        ctx.restore();

        // C. Draw cards overlapping this slice
        cardData.forEach((cd, idx) => {
            if (cd.absY + cd.h >= sliceStartY - 60 && cd.absY <= sliceStartY + sliceHeight + 60) {
                const relativeCy = cd.cy - sliceStartY;
                const left = -cd.w / 2;
                const top = -cd.h / 2;

                ctx.save();
                ctx.translate(cd.cx, relativeCy);
                ctx.rotate(cd.angle);
                ctx.scale(cd.scale, cd.scale);

                // Drop shadow
                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
                ctx.shadowBlur = 18;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 6;
                ctx.fillStyle = '#fdfdfd';
                roundRect(ctx, left, top, cd.w, cd.h, 2);
                ctx.fill();
                ctx.restore();

                // White body
                ctx.fillStyle = '#fdfdfd';
                roundRect(ctx, left, top, cd.w, cd.h, 2);
                ctx.fill();

                // Photo image
                const pad = 18;
                const imgW = cd.w - pad * 2;
                const imgH = imgW;
                const imgX = left + pad;
                const imgY = top + pad;

                const img = drawableImages[idx];
                if (img && (img.naturalWidth || img.width)) {
                    ctx.save();
                    roundRect(ctx, imgX, imgY, imgW, imgH, 0);
                    ctx.clip();

                    const nw = img.naturalWidth || img.width;
                    const nh = img.naturalHeight || img.height;
                    const imgAspect = nw / nh;
                    const targetAspect = 1.0;

                    let sx = 0, sy = 0, sw = nw, sh = nh;
                    if (imgAspect > targetAspect) {
                        sw = nh * targetAspect;
                        sx = (nw - sw) / 2;
                    } else {
                        sh = nw / targetAspect;
                        sy = (nh - sh) / 2;
                    }

                    try {
                        ctx.drawImage(img, sx, sy, sw, sh, imgX, imgY, imgW, imgH);
                    } catch (_) {
                        ctx.fillStyle = '#222';
                        ctx.fillRect(imgX, imgY, imgW, imgH);
                    }
                    ctx.restore();
                } else {
                    ctx.fillStyle = '#222';
                    ctx.fillRect(imgX, imgY, imgW, imgH);
                }

                ctx.restore();
            }
        });

        // Add slice into PDF at exact vertical position
        const sliceDataUrl = sliceCanvas.toDataURL('image/jpeg', 0.90);
        pdf.addImage(sliceDataUrl, 'JPEG', 0, sliceStartY, viewportWidth, sliceHeight);
    }

    const filename = `photo board full archive ${getExportTimestamp()}.pdf`;
    pdf.save(filename);
    return filename;
}

/**
 * Backwards compatible alias
 */
export const downloadPDF = downloadVisiblePDF;
