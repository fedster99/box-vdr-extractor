// diagnostic.js - VDR & Deck Diagnostic content script (Box + DocSend)

(function() {
  console.clear();
  console.log('%c VDR/DECK DIAGNOSTIC ', 'background: #ff6600; color: white; font-size: 18px; padding: 10px;');

  console.log(`\nWindow: ${window.innerWidth}x${window.innerHeight}`);
  console.log(`Device pixel ratio: ${window.devicePixelRatio}`);

  const host = location.hostname;
  const isDocSend = host.includes('docsend.com');
  const isBox = host.includes('box.com');
  console.log(`Site: ${isDocSend ? 'DocSend' : isBox ? 'Box' : 'Unknown (' + host + ')'}`);

  if (isDocSend) {
    const indicator = document.querySelector('.toolbar-page-indicator');
    const match = indicator?.textContent?.match(/(\d+)\s*\/\s*(\d+)/);
    const imgs = document.querySelectorAll('img.preso-view.page-view[data-pagenum]');
    console.log(`Pages: ${match ? `${match[1]} / ${match[2]}` : (imgs.length || 'NOT FOUND')}`);
    console.log(`Page-view images in DOM: ${imgs.length}`);

    const sample = document.querySelector('img.preso-view.page-view[data-url*="page_data/"]');
    const dataUrl = sample?.getAttribute('data-url');
    console.log(`page_data endpoint: ${dataUrl ? dataUrl.replace(/\d+$/, '<N>') : 'NOT FOUND'}`);
    if (sample) {
      console.log(`Sample image natural size: ${sample.naturalWidth}x${sample.naturalHeight}`);
    }

    console.log('\n%c RECOMMENDATIONS ', 'background: #333; color: #0f0; padding: 5px;');
    if (dataUrl) {
      console.log('✅ page_data endpoint available — high-quality direct fetch will be used.');
    } else if (imgs.length) {
      console.log('⚠️ No page_data endpoint; will fall back to on-page image capture (may be cross-origin limited).');
    } else {
      console.log('❌ No slides found. Open a DocSend document and let it load.');
    }
    return;
  }

  // --- Box (default) ---
  const indicator = document.querySelector('span.bp-PageControlsForm-button-label');
  const match = indicator?.textContent?.match(/(\d+)\s*\/\s*(\d+)/);
  console.log(`Pages: ${match ? `${match[1]} / ${match[2]}` : 'NOT FOUND'}`);

  const thumbnailsOpen = !!document.querySelector('.bcpr-thumbnails-open');
  console.log(`Thumbnails open: ${thumbnailsOpen ? 'YES ⚠️' : 'NO ✅'}`);

  const canvas = document.querySelector('.canvasWrapper canvas');
  if (canvas) {
    console.log(`Canvas: ${canvas.width}x${canvas.height}`);
    const rect = canvas.getBoundingClientRect();
    console.log(`Display size: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
  } else {
    console.log('Canvas: NOT FOUND');
  }

  const viewer = document.querySelector('.bp-doc');
  if (viewer) {
    const rect = viewer.getBoundingClientRect();
    console.log(`Viewer: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
  }

  console.log('\n%c RECOMMENDATIONS ', 'background: #333; color: #0f0; padding: 5px;');
  if (thumbnailsOpen) console.log('⚠️ Close the thumbnail sidebar for higher resolution');
  if (canvas && canvas.width < 1000) {
    console.log('⚠️ Resolution is low. Try:');
    console.log('   - Maximize browser window');
    console.log('   - Close sidebars');
    console.log('   - Set browser zoom to 100%');
  }
  if (canvas && canvas.width >= 1000) console.log('✅ Good resolution! Ready to extract.');
})();
