// popup.js - Box & DocSend VDR Extractor Chrome Extension

// Site adapters: how to detect each supported viewer and probe its readiness.
const SITES = {
  box: {
    label: 'Box VDR',
    match: (url) => url.includes('box.com'),
    extractor: 'extractor.js',
    // Runs in the page; returns { hasDoc, totalPages, resolution, warn }
    probe: () => {
      const indicator = document.querySelector('span.bp-PageControlsForm-button-label');
      const match = indicator?.textContent?.match(/(\d+)\s*\/\s*(\d+)/);
      const canvas = document.querySelector('.canvasWrapper canvas');
      const thumbnailsOpen = !!document.querySelector('.bcpr-thumbnails-open');
      return {
        hasDoc: !!match,
        totalPages: match ? parseInt(match[2]) : 0,
        resolution: canvas ? `${canvas.width}x${canvas.height}` : 'unknown',
        warn: thumbnailsOpen ? 'Thumbnails open — close the sidebar for higher quality!' : null
      };
    }
  },
  docsend: {
    label: 'DocSend Deck',
    match: (url) => url.includes('docsend.com'),
    extractor: 'docsend.js',
    probe: () => {
      const indicator = document.querySelector('.toolbar-page-indicator');
      const match = indicator?.textContent?.match(/(\d+)\s*\/\s*(\d+)/);
      const imgs = document.querySelectorAll('img.preso-view.page-view[data-pagenum]');
      const total = match ? parseInt(match[2]) : imgs.length;
      const sample = document.querySelector('img.preso-view.page-view');
      return {
        hasDoc: total > 0,
        totalPages: total,
        resolution: sample && sample.naturalWidth ? `${sample.naturalWidth}x${sample.naturalHeight}` : 'auto',
        warn: null
      };
    }
  }
};

function detectSite(url) {
  if (!url) return null;
  return Object.values(SITES).find(s => s.match(url)) || null;
}

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const titleEl = document.getElementById('title');
  const extractBtn = document.getElementById('extractBtn');
  const diagBtn = document.getElementById('diagBtn');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const site = detectSite(tab.url);

  if (!site) {
    statusEl.className = 'status error';
    statusEl.textContent = '❌ Not on a supported page. Open a Box VDR or DocSend document first.';
    return;
  }

  if (titleEl) titleEl.textContent = `📄 ${site.label} Extractor`;

  // Probe page readiness
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: site.probe
    });
    const state = results[0].result;

    if (!state.hasDoc) {
      statusEl.className = 'status error';
      statusEl.textContent = '❌ No document detected. Open the document in the viewer.';
      return;
    }

    if (state.warn) {
      statusEl.className = 'status warn';
      statusEl.innerHTML = `⚠️ ${state.warn}<br>${state.totalPages} pages (${state.resolution})`;
    } else {
      statusEl.className = 'status ok';
      statusEl.textContent = `✅ Ready: ${state.totalPages} pages at ${state.resolution}`;
    }
    extractBtn.disabled = false;

  } catch (e) {
    statusEl.className = 'status error';
    statusEl.textContent = '❌ Cannot access page. Refresh and try again.';
    console.error(e);
    return;
  }

  // Extract — inject the site-specific content script
  extractBtn.addEventListener('click', async () => {
    extractBtn.disabled = true;
    diagBtn.disabled = true;
    statusEl.className = 'status info';
    statusEl.textContent = '📸 Extracting... Check page console (F12)';

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [site.extractor],
        world: 'MAIN'
      });
      statusEl.className = 'status ok';
      statusEl.textContent = '✅ Extractor started! Check page for progress.';
    } catch (e) {
      statusEl.className = 'status error';
      statusEl.textContent = '❌ Error: ' + e.message;
      console.error(e);
    }

    extractBtn.disabled = false;
    diagBtn.disabled = false;
  });

  // Diagnostic
  diagBtn.addEventListener('click', async () => {
    statusEl.className = 'status info';
    statusEl.textContent = '🔍 Running diagnostic... Check console (F12)';
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['diagnostic.js'],
        world: 'MAIN'
      });
    } catch (e) {
      statusEl.className = 'status error';
      statusEl.textContent = '❌ Error: ' + e.message;
    }
  });
});
