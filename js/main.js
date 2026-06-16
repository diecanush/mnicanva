import { initCanvas, updateDesignInfo } from './canvas-init.js';
import { setupPanAndPinch, updateZoomLabel } from './viewport.js';
import {
  setHeaderHeight,
  injectGoogleFonts,
  populateFontSelect,
  buildFontPicker,
  closeFontPanelIfOpen,
  duplicateActive,
  syncShapeControlsFromSelection,
  setupUIHandlers,
} from './ui-handlers.js';

window.addEventListener('DOMContentLoaded', () => {
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
});
