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
  } else {
    console.warn('⚠️ No page_data URL found — will fall back to capturing on-page images.');
  }

  // --- Capture strategies ----------------------------------------------------

  // Decode a blob into a dataURL + natural dimensions via an <img>.
  function blobToImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const reader = new FileReader();
        reader.onload = () => {
          URL.revokeObjectURL(url);
          resolve({ data: reader.result, width: img.naturalWidth, height: img.naturalHeight });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  // Fetch an image URL and decode it. Uses credentials:'same-origin' on
  // purpose: cookies are sent to docsend.com (authorizes page_data), but the
  // page_data endpoint 302-redirects to a *signed* CloudFront URL that responds
  // with `Access-Control-Allow-Origin: *`. A credentialed request against a
  // wildcard ACAO is rejected by the browser, so we must NOT send credentials
  // cross-origin — 'same-origin' drops them on the redirect, and the signed
  // query string authorizes the CloudFront request on its own.
  async function fetchImage(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      // Some DocSend variants return JSON pointing at the image URL.
      const json = await res.json();
      const imgUrl = json.imageUrl || json.url || json.image || json.src;
      if (!imgUrl) return null;
      const imgRes = await fetch(imgUrl, { credentials: 'same-origin' });
      if (!imgRes.ok) return null;
      return await blobToImage(await imgRes.blob());
    }
    return await blobToImage(await res.blob());
  }

  function getViewerImg(pageNum) {
    return document.querySelector(`img.preso-view.page-view[data-pagenum="${pageNum}"]`);
  }
  function resolvedSrc(img) {
    const src = img && (img.currentSrc || img.src) || '';
    return /^https?:/.test(src) && !/whitey|loader|loading|\.gif($|\?)/i.test(src) ? src : null;
  }

  // Drive the carousel to page N so DocSend resolves and lazy-loads its image,
  // then return that page's signed image URL once it's in place.
  async function resolvePageUrl(pageNum) {
    let img = getViewerImg(pageNum);
    if (img) img.scrollIntoView({ behavior: 'instant', block: 'center' });
    const next = document.querySelector('.right.carousel-control, .carousel-control.right');
    const start = Date.now();
    while (Date.now() - start < 5000) {
      img = getViewerImg(pageNum);
      const url = resolvedSrc(img);
      if (url) return url;
      if (next) next.click();
      await wait(150);
    }
    return resolvedSrc(getViewerImg(pageNum));
  }

  // Capture one page: prefer the signed URL already resolved on the live <img>
  // (guaranteed valid — the page just loaded it); fall back to the page_data
  // endpoint for pages the carousel hasn't materialized.
  async function capturePage(pageNum) {
    try {
      const url = await resolvePageUrl(pageNum);
      if (url) {
        const cap = await fetchImage(url);
        if (cap) return cap;
      }
    } catch (e) {
      console.warn(`page ${pageNum} via DOM url failed:`, e.message);
    }
    if (pageDataBase) {
      try {
        const cap = await fetchImage(pageDataBase + pageNum);
        if (cap) return cap;
      } catch (e) {
        console.warn(`page ${pageNum} via page_data failed:`, e.message);
      }
    }
    return null;
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
    await humanDelay(60, 140);
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
