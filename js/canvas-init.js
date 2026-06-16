export const canvasState = {
  canvas: null,
  showGuides: true,
  hGuide: null,
  vGuide: null,
  vignetteRect: null,
  paperRect: null,
  paperShadowRect: null,
  baseW: 1480,
  baseH: 2100,
  autoCenter: true,
  handMode: false,
  spaceDown: false,
  multiSelectMode: false,
  multiSelectBuffer: [],
  clipboardData: null,
  clipboardShift: null,
  history: [],
  historyIndex: -1,
  historyLock: false,
};

const FABRIC_EXTRA_PROPS = [
  'id',
  'name',
  'rx',
  'ry',
  'strokeUniform',
  'shadow',
  'charSpacing',
  'textBackgroundColor',
  'paintFirst',
  'globalCompositeOperation',
  'cornerStyle',
  'selectable',
  'evented',
  '__origSrc',
  '__maskedSrc',
  'splitByGrapheme',
  'fontURL',
];

let fabricSerializationReady = false;

function ensureFabricSerializationProps() {
  if (fabricSerializationReady) return;
  if (!(window.fabric && window.fabric.Object)) return;

  const { Object: FabricObject } = window.fabric;
  const originalToObject = FabricObject.prototype.toObject;

  FabricObject.prototype.toObject = function patched(extraProperties) {
    const base = Array.isArray(extraProperties) ? extraProperties.slice() : [];
    FABRIC_EXTRA_PROPS.forEach((prop) => {
      if (!base.includes(prop)) base.push(prop);
    });
    return originalToObject.call(this, base);
  };

  fabricSerializationReady = true;
}

export function isFabricEditing() {
  const obj = canvasState.canvas?.getActiveObject?.();
  return !!(obj && (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') && obj.isEditing);
}

export function addOrUpdatePaper() {
  const canvas = canvasState.canvas;
  if (!canvas) return;

  const W = canvas.getWidth();
  const H = canvas.getHeight();

  try {
    if (!canvasState.paperRect) {
      canvasState.paperRect = new fabric.Rect({
        left: 0,
        top: 0,
        width: W,
        height: H,
        fill: '#ffffff',
        selectable: false,
        evented: false,
      });
      canvas.add(canvasState.paperRect);
    } else {
      canvasState.paperRect.set({ width: W, height: H });
      canvasState.paperRect.setCoords();
    }

    if (!canvasState.paperShadowRect) {
      canvasState.paperShadowRect = new fabric.Rect({
        left: 0,
        top: 0,
        width: W,
        height: H,
        fill: canvasState.paperRect.fill,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        shadow: new fabric.Shadow({
          color: 'rgba(0,0,0,0.25)',
          blur: 30,
          offsetX: 0,
          offsetY: 10,
        }),
      });
      canvas.add(canvasState.paperShadowRect);
    } else {
      canvasState.paperShadowRect.set({ width: W, height: H, fill: canvasState.paperRect.fill });
      canvasState.paperShadowRect.setCoords();
    }

    orderBackground();
  } catch (error) {
    console.error('Error updating paper background:', error);
  }
}

export function orderBackground() {
  const canvas = canvasState.canvas;
  if (!canvas) return;

  if (canvasState.paperShadowRect) canvas.moveTo(canvasState.paperShadowRect, 0);
  if (canvasState.paperRect) canvas.moveTo(canvasState.paperRect, 1);
  if (canvasState.vignetteRect) canvas.moveTo(canvasState.vignetteRect, 2);
  if (canvasState.hGuide) canvasState.hGuide.bringToFront();
  if (canvasState.vGuide) canvasState.vGuide.bringToFront();
}

export function updateDesignInfo() {
  const canvas = canvasState.canvas;
  if (!canvas) return;

  const ratio = canvasState.baseW / canvasState.baseH;
  const near = (a, b, eps = 0.003) => Math.abs(a - b) < eps;
  const isoA = near(ratio, 1 / Math.SQRT2) || near(ratio, Math.SQRT2);
  const tag = isoA ? ' (≈ ISO A 1:√2)' : '';
  const [, , , , x = 0, y = 0] = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
  const infoEl = document.getElementById('designInfo');
  if (infoEl) {
    infoEl.textContent = `Lienzo: ${canvasState.baseW}×${canvasState.baseH}px · relación ${ratio.toFixed(3)}${tag} · origen (${Math.round(x)}, ${Math.round(y)})`;
  }
}

export function updateSelInfo() {
  const canvas = canvasState.canvas;
  if (!canvas) return;

  const infoEl = document.getElementById('selInfo');
  if (!infoEl) return;

  const active = canvas.getActiveObject();
  if (!active) {
    infoEl.textContent = 'Selección: —';
    return;
  }

  const w = Math.round(active.getScaledWidth ? active.getScaledWidth() : active.width * (active.scaleX || 1));
  const h = Math.round(active.getScaledHeight ? active.getScaledHeight() : active.height * (active.scaleY || 1));
  const pctW = Math.round((w / canvasState.baseW) * 100);
  const pctH = Math.round((h / canvasState.baseH) * 100);
  infoEl.textContent = `Selección: ${w}×${h}px (${pctW}%×${pctH}%)`;
}

function handleTextboxScaling(opt = {}) {
  const target = opt?.target;
  if (!target || target.type !== 'textbox') return;

  const corner = opt.transform?.corner;
  if (!corner) return;

  const anchor = target.getPointByOrigin(
    opt.transform.originX,
    opt.transform.originY,
  );

  if (corner !== 'ml' && corner !== 'mr') return;

  const nextWidth = (target.width || 0) * (target.scaleX || 1);
  target.set({
    width: nextWidth,
    scaleX: 1,
    scaleY: 1,
  });
  target.initDimensions?.();
  if (anchor) {
    target.setPositionByOrigin(
      anchor,
      opt.transform.originX,
      opt.transform.originY,
    );
  }
  target.setCoords();
  if (opt.transform) {
    opt.transform.scaleX = opt.transform.scaleY = 1;
    if (opt.transform.original) {
      opt.transform.original.scaleX = opt.transform.original.scaleY = 1;
    }
  }
  target.canvas?.requestRenderAll();
  updateSelInfo();
}

function finalizeTextboxScaling(opt = {}) {
  const target = opt?.target;
  if (!target || target.type !== 'textbox') return;

  delete target.__baseTextScale;
  target.set({ scaleX: 1, scaleY: 1 });
  const canvas = target.canvas || canvasState.canvas;
  canvas?.requestRenderAll();
  updateSelInfo();
}

export function initCanvas({
  onDuplicate,
  onCloseFontPanel,
  onSelectionChange,
} = {}) {
  if (!(window.fabric && window.jspdf)) {
    alert('No se cargaron Fabric/jsPDF.');
    return null;
  }

  ensureFabricSerializationProps();

  let canvas;
  try {
    canvas = new fabric.Canvas('stage', {
      preserveObjectStacking: true,
      backgroundColor: 'transparent',
      selection: true,
    });
    canvas.setWidth(canvasState.baseW);
    canvas.setHeight(canvasState.baseH);
    canvasState.canvas = canvas;
  } catch (error) {
    console.error('Error initializing canvas:', error);
    alert('Error al inicializar el lienzo.');
    return null;
  }
  canvasState.history = [];
  canvasState.historyIndex = -1;
  canvasState.historyLock = false;
  canvasState.clipboardData = null;
  canvasState.clipboardShift = null;

  canvasState.hGuide = new fabric.Line([0, canvasState.baseH / 2, canvasState.baseW, canvasState.baseH / 2], {
    stroke: '#38bdf8',
    strokeWidth: 1,
    selectable: false,
    evented: false,
    excludeFromExport: true,
    visible: false,
  });
  canvasState.vGuide = new fabric.Line([canvasState.baseW / 2, 0, canvasState.baseW / 2, canvasState.baseH], {
    stroke: '#38bdf8',
    strokeWidth: 1,
    selectable: false,
    evented: false,
    excludeFromExport: true,
    visible: false,
  });
  canvas.add(canvasState.hGuide);
  canvas.add(canvasState.vGuide);

  addOrUpdatePaper();

  function isTypingInAForm() {
    const ae = document.activeElement;
    return !!(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable));
  }

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      if (typeof onDuplicate === 'function') onDuplicate();
      return;
    }

    if (isTypingInAForm() || isFabricEditing()) return;

    if (e.code === 'Space') {
      canvasState.spaceDown = true;
      canvas.defaultCursor = 'grab';
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      const act = canvas.getActiveObjects();
      if (!act || act.length === 0) return;
      act.forEach((o) => canvas.remove(o));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      canvasState.spaceDown = false;
      canvas.defaultCursor = 'default';
    }
  });

  canvas.on('object:moving', (opt) => {
    if (!canvasState.showGuides) {
      if (canvasState.hGuide) canvasState.hGuide.visible = false;
      if (canvasState.vGuide) canvasState.vGuide.visible = false;
      canvas.requestRenderAll();
      return;
    }
    const o = opt.target;
    const tol = 8;
    let snapped = false;
    const w = o.getScaledWidth ? o.getScaledWidth() : o.width * (o.scaleX || 1);
    const h = o.getScaledHeight ? o.getScaledHeight() : o.height * (o.scaleY || 1);
    const cx = (o.left || 0) + w / 2;
    const cy = (o.top || 0) + h / 2;
    if (Math.abs(cx - canvasState.baseW / 2) < tol) {
      o.left = (canvasState.baseW - w) / 2;
      if (canvasState.vGuide) canvasState.vGuide.visible = true;
      snapped = true;
    }
    if (Math.abs(cy - canvasState.baseH / 2) < tol) {
      o.top = (canvasState.baseH - h) / 2;
      if (canvasState.hGuide) canvasState.hGuide.visible = true;
      snapped = true;
    }
    if (Math.abs((o.left || 0) - 0) < tol) {
      o.left = 0;
      if (canvasState.vGuide) canvasState.vGuide.visible = true;
      snapped = true;
    }
    if (Math.abs(((o.left || 0) + w) - canvasState.baseW) < tol) {
      o.left = canvasState.baseW - w;
      if (canvasState.vGuide) canvasState.vGuide.visible = true;
      snapped = true;
    }
    if (Math.abs((o.top || 0) - 0) < tol) {
      o.top = 0;
      if (canvasState.hGuide) canvasState.hGuide.visible = true;
      snapped = true;
    }
    if (Math.abs(((o.top || 0) + h) - canvasState.baseH) < tol) {
      o.top = canvasState.baseH - h;
      if (canvasState.hGuide) canvasState.hGuide.visible = true;
      snapped = true;
    }
    if (!snapped) {
      if (canvasState.hGuide) canvasState.hGuide.visible = false;
      if (canvasState.vGuide) canvasState.vGuide.visible = false;
    }
  });

  canvas.on('mouse:up', () => {
    if (canvasState.hGuide?.visible || canvasState.vGuide?.visible) {
      if (canvasState.hGuide) canvasState.hGuide.visible = false;
      if (canvasState.vGuide) canvasState.vGuide.visible = false;
      canvas.requestRenderAll();
    }
  });

  canvas.on('selection:updated', updateSelInfo);
  canvas.on('selection:created', updateSelInfo);
  canvas.on('selection:cleared', updateSelInfo);

  canvas.on('object:scaling', handleTextboxScaling);
  canvas.on('object:scaled', finalizeTextboxScaling);

  if (typeof onCloseFontPanel === 'function') {
    canvas.on('text:editing:entered', onCloseFontPanel);
    canvas.on('mouse:down', onCloseFontPanel);
  }

  if (typeof onSelectionChange === 'function') {
    canvas.on('selection:updated', onSelectionChange);
    canvas.on('selection:created', onSelectionChange);
    canvas.on('selection:cleared', onSelectionChange);
  }

  updateDesignInfo();
  return canvas;
}
