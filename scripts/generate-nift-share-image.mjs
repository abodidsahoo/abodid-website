import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] || resolve(root, 'public/images/workshops/nift-2026/boutique-cover-720.webp');
const font = (await readFile(resolve(root, 'public/fonts/satoshi/Satoshi-Variable.woff2'))).toString('base64');
const collage = (await sharp(source).resize({ width: 1100, withoutEnlargement: true }).webp({ quality: 92 }).toBuffer()).toString('base64');
const output = resolve(root, 'public/images/og/nift-workshop-feedback.jpg');
const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html lang="en"><head><style>
        @font-face{font-family:Satoshi;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:300 900}
        *{box-sizing:border-box}body{margin:0;background:#fffaf2;color:#2444ca;font-family:Satoshi,sans-serif}
        main{width:1200px;height:630px;padding:46px 56px;position:relative;overflow:hidden}
        header{display:flex;justify-content:space-between;align-items:center;font-size:27px;font-weight:850;letter-spacing:-1px}
        header span{font-size:15px;font-weight:650;letter-spacing:1px}
        .copy{position:absolute;left:56px;top:166px;width:565px}
        .eyebrow{font-size:17px;font-weight:750;letter-spacing:2px;margin:0 0 24px}
        h1{font-size:82px;line-height:.98;font-weight:850;letter-spacing:-5px;margin:0 0 28px}
        .note{font-size:25px;line-height:1.4;color:#343b4c;margin:0;max-width:440px}
        .collage{position:absolute;right:35px;top:126px;width:534px;height:420px;object-fit:contain}
        footer{position:absolute;left:56px;bottom:42px;font-size:16px;font-weight:700;letter-spacing:.4px}
        footer:before{content:'';display:inline-block;width:36px;height:5px;background:#ffe44f;vertical-align:middle;margin-right:12px}
    </style></head><body><main>
        <header>abodid.com<span>3 NOVEMBER 2026</span></header>
        <div class="copy"><p class="eyebrow">NIFT BHUBANESWAR</p><h1>Space &amp;<br>Materiality</h1><p class="note">Share your feedback.<br>Get the slides &amp; demo.</p></div>
        <img class="collage" src="data:image/webp;base64,${collage}" alt="">
        <footer>With Abodid Sahoo</footer>
    </main></body></html>`);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); });
    const screenshot = await page.screenshot({ type: 'png' });
    await mkdir(dirname(output), { recursive: true });
    await sharp(screenshot).jpeg({ quality: 90, mozjpeg: true }).toFile(output);
    console.log(output);
} finally { await browser.close(); }
