import { initCanvas, updateDesignInfo } from './canvas-init.js?v=20260626-1';
import { setupPanAndPinch, updateZoomLabel } from './viewport.js?v=20260626-1';
import {
  setHeaderHeight,
  injectGoogleFonts,
  populateFontSelect,
  buildFontPicker,
  closeFontPanelIfOpen,
  duplicateActive,
  syncShapeControlsFromSelection,
  setupUIHandlers,
} from './ui-handlers.js?v=20260626-1';

function startMiniCanva() {
  setHeaderHeight();
  injectGoogleFonts();
  populateFontSelect();
  buildFontPicker();

  initCanvas({
    onDuplicate: duplicateActive,
    onCloseFontPanel: closeFontPanelIfOpen,
    onSelectionChange: syncShapeControlsFromSelection,
  });

  setupPanAndPinch();
  updateDesignInfo();
  updateZoomLabel();

  setupUIHandlers();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', startMiniCanva, { once: true });
} else {
  startMiniCanva();
}
