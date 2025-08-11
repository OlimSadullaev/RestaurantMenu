const fs = require('fs');
const path = require('path');
const url = require('url');
const puppeteer = require('puppeteer');

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

function fileNameFromUrl(resourceUrl) {
  const { pathname } = new url.URL(resourceUrl);
  const base = path.basename(pathname);
  return base || `image-${Date.now()}`;
}

async function saveBuffer(filePath, buffer) {
  await ensureDir(path.dirname(filePath));
  await fs.promises.writeFile(filePath, buffer);
}

async function scrapeImages(startUrl, outDir) {
  await ensureDir(outDir);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
    ],
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 });

  const seen = new Set();
  const saved = new Set();

  page.on('response', async (response) => {
    try {
      const resourceUrl = response.url();
      if (seen.has(resourceUrl)) return;
      seen.add(resourceUrl);
      const ct = response.headers()['content-type'] || '';
      const isImage = /image\/(png|jpe?g|gif|webp|svg|ico)/i.test(ct) || /\.(png|jpe?g|gif|webp|svg|ico)(\?|#|$)/i.test(resourceUrl);
      if (!isImage) return;
      const buffer = await response.buffer();
      const name = fileNameFromUrl(resourceUrl);
      const filePath = path.join(outDir, name);
      await saveBuffer(filePath, buffer);
      saved.add(filePath);
      // console.log('Saved', name);
    } catch (err) {
      // ignore single resource failures
    }
  });

  await page.goto(startUrl, { waitUntil: ['domcontentloaded', 'networkidle2'] });

  // Try to scroll to trigger lazy-loaded assets
  const maxScrolls = 20;
  for (let i = 0; i < maxScrolls; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await delay(400);
  }

  // Also hover/tap common elements if present to trigger assets
  try {
    await delay(1000);
    const clickableSelectors = ['a', 'button', '[role="button"]'];
    for (const sel of clickableSelectors) {
      const elements = await page.$$(sel);
      for (const el of elements.slice(0, 5)) {
        try { await el.hover(); } catch {}
      }
    }
    await delay(1000);
  } catch {}

  await browser.close();
  return Array.from(saved);
}

(async () => {
  const startUrl = process.argv[2] || 'https://efendi.qrmenus.uz/';
  const outDir = process.argv[3] || path.resolve(__dirname, 'efendi-images');
  const saved = await scrapeImages(startUrl, outDir);
  console.log(`Saved ${saved.length} images to ${outDir}`);
})();