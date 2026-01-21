// popup.js - Box VDR Extractor Chrome Extension

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const extractBtn = document.getElementById('extractBtn');
  const diagBtn = document.getElementById('diagBtn');

  // Check if we're on a Box page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url || !tab.url.includes('box.com')) {
    statusEl.className = 'status error';
    statusEl.textContent = '❌ Not on a Box page. Navigate to a Box VDR document first.';
    return;
  }

  // Check page state by injecting a simple check function
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const indicator = document.querySelector('span.bp-PageControlsForm-button-label');
        const match = indicator?.textContent?.match(/(\d+)\s*\/\s*(\d+)/);
        const canvas = document.querySelector('.canvasWrapper canvas');
        const thumbnailsOpen = !!document.querySelector('.bcpr-thumbnails-open');
        
        return {
          hasPageIndicator: !!match,
          totalPages: match ? parseInt(match[2]) : 0,
          resolution: canvas ? `${canvas.width}x${canvas.height}` : 'unknown',
          thumbnailsOpen
        };
      }
    });
    
    const state = results[0].result;
    
    if (!state.hasPageIndicator) {
      statusEl.className = 'status error';
      statusEl.textContent = '❌ No document open. Open a document in the Box preview.';
      return;
    }
    
    if (state.thumbnailsOpen) {
      statusEl.className = 'status warn';
      statusEl.innerHTML = `⚠️ Thumbnails open (${state.resolution})<br>Close sidebar for higher quality!`;
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

  // Extract button - inject the content script file
  extractBtn.addEventListener('click', async () => {
    extractBtn.disabled = true;
    diagBtn.disabled = true;
    statusEl.className = 'status info';
    statusEl.textContent = '📸 Extracting... Check page console (F12)';
    
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['extractor.js'],
        world: 'MAIN'  // Run in page context to access window objects
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

  // Diagnostic button
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
