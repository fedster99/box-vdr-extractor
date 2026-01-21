// diagnostic.js - Box VDR Diagnostic content script

(function() {
  console.clear();
  console.log('%c BOX VDR DIAGNOSTIC ', 'background: #ff6600; color: white; font-size: 18px; padding: 10px;');

  // Window
  console.log(`\nWindow: ${window.innerWidth}x${window.innerHeight}`);
  console.log(`Device pixel ratio: ${window.devicePixelRatio}`);

  // Page indicator
  const indicator = document.querySelector('span.bp-PageControlsForm-button-label');
  const match = indicator?.textContent?.match(/(\d+)\s*\/\s*(\d+)/);
  console.log(`Pages: ${match ? `${match[1]} / ${match[2]}` : 'NOT FOUND'}`);

  // Thumbnails
  const thumbnailsOpen = !!document.querySelector('.bcpr-thumbnails-open');
  console.log(`Thumbnails open: ${thumbnailsOpen ? 'YES ⚠️' : 'NO ✅'}`);

  // Canvas
  const canvas = document.querySelector('.canvasWrapper canvas');
  if (canvas) {
    console.log(`Canvas: ${canvas.width}x${canvas.height}`);
    const rect = canvas.getBoundingClientRect();
    console.log(`Display size: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
  } else {
    console.log('Canvas: NOT FOUND');
  }

  // Viewer
  const viewer = document.querySelector('.bp-doc');
  if (viewer) {
    const rect = viewer.getBoundingClientRect();
    console.log(`Viewer: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
  }

  // Recommendations
  console.log('\n%c RECOMMENDATIONS ', 'background: #333; color: #0f0; padding: 5px;');
  
  if (thumbnailsOpen) {
    console.log('⚠️ Close the thumbnail sidebar for higher resolution');
  }
  
  if (canvas && canvas.width < 1000) {
    console.log('⚠️ Resolution is low. Try:');
    console.log('   - Maximize browser window');
    console.log('   - Close sidebars');
    console.log('   - Set browser zoom to 100%');
  }
  
  if (canvas && canvas.width >= 1000) {
    console.log('✅ Good resolution! Ready to extract.');
  }
})();
