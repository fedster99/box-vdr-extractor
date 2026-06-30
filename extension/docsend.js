// docsend.js - DocSend Deck Extractor content script
// Runs in MAIN world. Unlike Box (which renders pages to <canvas>), DocSend
// renders each slide as an <img class="preso-view page-view"> and exposes a
// same-origin "page_data/N" endpoint that returns the full-resolution JPEG.
// We fetch those directly (no canvas re-encode, no scroll/lazy-load races),
// and fall back to capturing the live <img> via canvas if fetching fails.

(async function() {
  'use strict';

  if (window.__docsendExtractorRunning) {
    console.log('DocSend extractor already running!');
    return;
  }
  window.__docsendExtractorRunning = true;

  console.log('%c DOCSEND DECK EXTRACTOR ', 'background: #3984FF; color: white; font-size: 16px; padding: 8px;');

  // Load jsPDF
  if (!window.jspdf) {
    console.log('Loading jsPDF...');
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    document.head.appendChild(script);
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      setTimeout(reject, 10000);
    });
  }
  const { jsPDF } = window.jspdf;

  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  function humanDelay(minMs, maxMs) {
    const delay = minMs + Math.random() * (maxMs - minMs);
    return wait(Math.random() < 0.2 ? delay + 50 + Math.random() * 100 : delay);
  }

  function finish() { window.__docsendExtractorRunning = false; }

  // --- Discover total page count ---
  function getTotalPages() {
    const indicator = document.querySelector('.toolbar-page-indicator');
    const match = indicator?.textContent?.match(/(\d+)\s*\/\s*(\d+)/);
    if (match) return parseInt(match[2], 10);
    // Fallback: count rendered page-view imgs
    const imgs = document.querySelectorAll('img.preso-view.page-view[data-pagenum]');
    return imgs.length || 0;
  }

  // --- Build the page_data/N base URL ---
  // Each slide <img> carries data-url=".../page_data/<N>". We strip the trailing
  // number to derive a base we can request for every page, even ones not yet
  // rendered into the DOM by the lazy carousel.
  function getPageDataBase() {
    const img = document.querySelector('img.preso-view.page-view[data-url*="page_data/"]');
    const url = img?.getAttribute('data-url');
    if (!url) return null;
    return url.replace(/\/page_data\/\d+.*$/, '/page_data/');
  }

  const totalPages = getTotalPages();
  if (!totalPages) {
    console.error('❌ Could not determine page count. Is a DocSend document open?');
    return finish();
  }
  console.log(`📄 Found ${totalPages} pages`);

  const pageDataBase = getPageDataBase();
  if (pageDataBase) {
    console.log(`🔗 page_data endpoint: ${pageDataBase}<N>`);
  }

  // --- Capture strategies ----------------------------------------------------

  // Decode a blob into a dataURL + natural dimensions via an <img>. DocSend
  // serves page images as `binary/octet-stream`, so we normalize the blob to
  // image/jpeg — otherwise the FileReader data URL carries the wrong MIME and
  // jsPDF can choke on it.
  function blobToImage(blob) {
    const typed = blob.type && blob.type.startsWith('image/')
      ? blob : new Blob([blob], { type: 'image/jpeg' });
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(typed);
      const img = new Image();
      img.onload = () => {
        const reader = new FileReader();
        reader.onload = () => {
          URL.revokeObjectURL(url);
          resolve({ data: reader.result, width: img.naturalWidth, height: img.naturalHeight });
        };
        reader.onerror = reject;
        reader.readAsDataURL(typed);
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  // Capture one page via the page_data endpoint.
  //
  // page_data/N returns JSON: { imageUrl, directImageUrl, documentLinks, ... }.
  // imageUrl is a freshly-signed CloudFront URL. We must fetch a FRESH one each
  // time: the URL DocSend already loaded into the <img> is cached by the browser
  // *without* CORS headers (the <img> load wasn't a CORS request), so re-fetching
  // that exact URL is blocked. A newly-signed URL isn't in that cache, so
  // CloudFront serves it with proper CORS headers and the fetch succeeds.
  //
  // credentials:'same-origin' sends cookies to docsend.com (authorizes
  // page_data) but not to CloudFront (which authorizes via the signed query
  // string), avoiding the "wildcard ACAO + credentials" rejection.
  async function fetchPage(pageNum) {
    const res = await fetch(pageDataBase + pageNum, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const json = await res.json();
    const imgUrl = json.imageUrl || json.directImageUrl || json.url || json.image;
    if (!imgUrl) return null;
    const imgRes = await fetch(imgUrl, { credentials: 'same-origin' });
    if (!imgRes.ok) return null;
    return await blobToImage(await imgRes.blob());
  }

  async function capturePage(pageNum) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const cap = await fetchPage(pageNum);
        if (cap) return cap;
      } catch (e) {
        if (attempt === 0) { await humanDelay(200, 400); continue; }
        console.warn(`page ${pageNum} failed:`, e.message);
      }
    }
    return null;
  }

  if (!pageDataBase) {
    console.error('❌ No page_data endpoint found — cannot extract this document.');
    return finish();
  }

  // --- Main capture loop ---
  console.log('\n📸 Capturing pages...\n');
  const captures = new Map();

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const cap = await capturePage(pageNum);

    if (cap) {
      captures.set(pageNum, cap);
      console.log(`✅ Page ${pageNum}/${totalPages} — ${cap.width}x${cap.height}`);
    } else {
      console.error(`❌ Page ${pageNum}: Failed`);
    }
    await humanDelay(40, 90);
  }

  // --- Build PDF ---
  console.log('\n📑 Building PDF...');
  if (captures.size === 0) {
    console.error('❌ No pages captured!');
    return finish();
  }

  const first = captures.get(1) || captures.values().next().value;
  const pdf = new jsPDF({
    orientation: first.width > first.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [first.width, first.height]
  });

  const sortedKeys = [...captures.keys()].sort((a, b) => a - b);
  sortedKeys.forEach((pageNum, index) => {
    const page = captures.get(pageNum);
    if (index > 0) {
      pdf.addPage([page.width, page.height], page.width > page.height ? 'landscape' : 'portrait');
    }
    pdf.addImage(page.data, 'JPEG', 0, 0, page.width, page.height);
  });

  pdf.save(`DocSend_Deck_${totalPages}pages.pdf`);

  console.log(`\n%c ✅ COMPLETE! ${captures.size}/${totalPages} pages saved `,
    'background: #00cc00; color: white; font-size: 14px; padding: 8px;');

  const missed = [];
  for (let i = 1; i <= totalPages; i++) if (!captures.has(i)) missed.push(i);
  if (missed.length) console.warn(`⚠️ Missed pages: ${missed.join(', ')}`);

  finish();
})();
