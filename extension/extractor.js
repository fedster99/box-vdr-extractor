// extractor.js - Box VDR Extractor content script
// This runs in MAIN world so it can access page's window object

(async function() {
  'use strict';
  
  // Prevent double-run
  if (window.__boxVdrExtractorRunning) {
    console.log('Extractor already running!');
    return;
  }
  window.__boxVdrExtractorRunning = true;

  console.log('%c BOX VDR EXTRACTOR ', 'background: #00aa00; color: white; font-size: 16px; padding: 8px;');

  // Load jsPDF
  if (!window.jspdf) {
    console.log('Loading jsPDF...');
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    document.head.appendChild(script);
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      setTimeout(reject, 10000); // 10s timeout
    });
  }
  
  const { jsPDF } = window.jspdf;
  const captures = new Map();

  // Helpers
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  
  function humanDelay(minMs, maxMs) {
    const delay = minMs + Math.random() * (maxMs - minMs);
    return wait(Math.random() < 0.2 ? delay + 50 + Math.random() * 100 : delay);
  }

  function getPageIndicator() {
    const indicator = document.querySelector('span.bp-PageControlsForm-button-label');
    const match = indicator?.textContent?.match(/(\d+)\s*\/\s*(\d+)/);
    return match ? { current: parseInt(match[1]), total: parseInt(match[2]) } : null;
  }

  function getMainCanvas(pageNum) {
    return document.querySelector(`div.page[data-page-number="${pageNum}"] .canvasWrapper canvas`);
  }

  // Check prerequisites
  const indicator = getPageIndicator();
  if (!indicator) {
    console.error('❌ Cannot find page indicator!');
    window.__boxVdrExtractorRunning = false;
    return;
  }
  
  const totalPages = indicator.total;
  console.log(`📄 Found ${totalPages} pages`);

  // Check thumbnails
  if (document.querySelector('.bcpr-thumbnails-open')) {
    console.warn('⚠️ Thumbnail sidebar is open - consider closing for higher resolution');
  }

  // Check resolution
  const testCanvas = getMainCanvas(indicator.current);
  if (testCanvas) {
    console.log(`📐 Current resolution: ${testCanvas.width}x${testCanvas.height}`);
    if (testCanvas.width < 1000) {
      console.warn('⚠️ Resolution is low. Maximize window and close sidebars for better quality.');
    }
  }

  // Capture function
  async function capturePageByNumber(pageNum) {
    const pageDiv = document.querySelector(`div.page[data-page-number="${pageNum}"]`);
    if (!pageDiv) return null;
    
    pageDiv.scrollIntoView({ behavior: 'instant', block: 'center' });
    
    // Wait for canvas
    const startTime = Date.now();
    let canvas = null;
    
    while (Date.now() - startTime < 2000) {
      canvas = getMainCanvas(pageNum);
      if (canvas && canvas.width > 0) break;
      await wait(50);
    }
    
    await wait(100);
    canvas = getMainCanvas(pageNum);
    
    if (!canvas) return null;
    
    try {
      return {
        data: canvas.toDataURL('image/jpeg', 0.95),
        width: canvas.width,
        height: canvas.height
      };
    } catch (e) {
      console.error(`Capture error for page ${pageNum}:`, e.message);
      return null;
    }
  }

  // Main capture loop
  console.log('\n📸 Capturing pages...\n');
  
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    let cap = await capturePageByNumber(pageNum);
    
    if (!cap) {
      // Retry once
      await humanDelay(300, 500);
      cap = await capturePageByNumber(pageNum);
    }
    
    if (cap) {
      captures.set(pageNum, cap);
      console.log(`✅ Page ${pageNum}/${totalPages} — ${cap.width}x${cap.height}`);
    } else {
      console.error(`❌ Page ${pageNum}: Failed`);
    }
    
    await humanDelay(80, 180);
  }

  // Generate PDF
  console.log('\n📑 Building PDF...');
  
  if (captures.size === 0) {
    console.error('❌ No pages captured!');
    window.__boxVdrExtractorRunning = false;
    return;
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

  pdf.save(`Box_VDR_${totalPages}pages.pdf`);
  
  console.log(`\n%c ✅ COMPLETE! ${captures.size}/${totalPages} pages saved `, 
    'background: #00cc00; color: white; font-size: 14px; padding: 8px;');
  
  // Check for missed pages
  const missed = [];
  for (let i = 1; i <= totalPages; i++) {
    if (!captures.has(i)) missed.push(i);
  }
  if (missed.length > 0) {
    console.warn(`⚠️ Missed pages: ${missed.join(', ')}`);
  }
  
  window.__boxVdrExtractorRunning = false;
})();
