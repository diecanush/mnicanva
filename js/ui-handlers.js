import {
  canvasState,
  addOrUpdatePaper,
  orderBackground,
  updateDesignInfo,
  updateSelInfo,
} from './canvas-init.js';
import { fitToViewport, zoomTo, updateZoomLabel } from './viewport.js';

const $ = (selector) => document.querySelector(selector);

const ASPECTS = {
  '1:1':   { w: 1080, h: 1080 },
  '4:3':   { w: 1200, h: 900 },
  '3:4':   { w: 900,  h: 1200 },
  '9:16':  { w: 1080, h: 1920 },
  '16:9':  { w: 1920, h: 1080 },
  A4P:     { w: 2100, h: 2970 },
  A4L:     { w: 2970, h: 2100 },
  A5P:     { w: 1480, h: 2100 },
  A5L:     { w: 2100, h: 1480 },
};

const FONT_SET = [
  { name: 'Inter',            family: `'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif`, gf: 'Inter:wght@400;600' },
  { name: 'Merriweather',     family: `'Merriweather', Georgia, serif`, gf: 'Merriweather:wght@400;700' },
  { name: 'Oswald',           family: `'Oswald', Arial, sans-serif`, gf: 'Oswald:wght@400;600' },
  { name: 'Lora',             family: `'Lora', Georgia, serif`, gf: 'Lora:wght@400;600' },
  { name: 'Montserrat',       family: `'Montserrat', Arial, Helvetica, sans-serif`, gf: 'Montserrat:wght@500;700' },
  { name: 'Playfair Display', family: `'Playfair Display', Georgia, serif`, gf: 'Playfair+Display:wght@400;700' },
  { name: 'Space Mono',       family: `'Space Mono', ui-monospace, SFMono-Regular, Menlo, monospace`, gf: 'Space+Mono:wght@400;700' },
  { name: 'Abril Fatface',    family: `'Abril Fatface', 'Times New Roman', serif`, gf: 'Abril+Fatface' },
  { name: 'Dancing Script',   family: `'Dancing Script', 'Comic Sans MS', cursive`, gf: 'Dancing+Script:wght@400;600' },
  { name: 'Inconsolata',      family: `'Inconsolata', ui-monospace, Consolas, monospace`, gf: 'Inconsolata:wght@400;700' },
];

export function setHeaderHeight(scrollTop = false) {
  const el = document.getElementById('deskBar');
  document.documentElement.style.setProperty('--header-h', `${el?.offsetHeight || 0}px`);
  fitToViewport(scrollTop === true);
}

function supportsDialog() {
  return 'HTMLDialogElement' in window;
}

const hasDialog = supportsDialog();

function openModal(el) {
  if (!el) return;
  if (hasDialog) el.showModal(); else el.classList.add('open');
}

function closeModal(el) {
  if (!el) return;
  if (hasDialog) el.close(); else el.classList.remove('open');
}

function applyDialogFallback() {
  if (hasDialog) return;
  const dlg = document.getElementById('cropModal');
  if (!dlg) return;
  const wrap = document.createElement('div');
  wrap.id = dlg.id;
  wrap.className = 'modal-fallback';
  const content = document.createElement('div');
  content.className = 'modal-content';
  content.innerHTML = dlg.innerHTML;
  wrap.appendChild(content);
  dlg.replaceWith(wrap);
  document.body.classList.add('no-dialog');
}

const mq = window.matchMedia('(min-width: 768px)');

function toggleDeskBar(e) {
  const desk = document.getElementById('deskBar');
  if (desk) desk.style.display = e.matches ? 'flex' : 'none';
  setHeaderHeight(true);
}

function syncDrawers() {
  const isDesktop = window.matchMedia('(min-width: 768px)').matches;
  if (isDesktop) {
    document.getElementById('leftPanel')?.classList.remove('open');
    document.getElementById('rightPanel')?.classList.remove('open');
  }
}
function attachDrawerButtons() {
  const refreshViewport = () => {
    setTimeout(() => {
      if (canvasState.autoCenter) fitToViewport(true);
    }, 320);
  };

  document.getElementById('btnOpenTools')?.addEventListener('click', () => {
    document.getElementById('leftPanel')?.classList.toggle('open');
    refreshViewport();
  });
  document.getElementById('btnCloseTools')?.addEventListener('click', () => {
    document.getElementById('leftPanel')?.classList.remove('open');
    refreshViewport();
  });
  document.getElementById('btnOpenHelp')?.addEventListener('click', () => {
    document.getElementById('rightPanel')?.classList.toggle('open');
    refreshViewport();
  });
  document.getElementById('btnCloseHelp')?.addEventListener('click', () => {
    document.getElementById('rightPanel')?.classList.remove('open');
    refreshViewport();
  });
}

export function injectGoogleFonts() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  const fams = FONT_SET.map((f) => f.gf).join('&family=');
  link.href = `https://fonts.googleapis.com/css2?family=${fams}&display=swap`;
  document.head.appendChild(link);
}

export function populateFontSelect() {
  const sel = document.getElementById('selFont');
  if (!sel) return;
  sel.innerHTML = '';
  FONT_SET.forEach((f) => {
    const opt = document.createElement('option');
    opt.value = f.name;
    opt.textContent = f.name;
    opt.style.fontFamily = f.family;
    sel.appendChild(opt);
  });
  sel.value = 'Inter';
}

export async function ensureFontLoaded(family) {
  if (document.fonts && document.fonts.load) {
    try {
      await document.fonts.load(`16px "${family}"`);
    } catch (error) {
      console.warn('ensureFontLoaded error', error);
    }
  }
}

export function closeFontPanelIfOpen() {
  const host = document.getElementById('fontPicker');
  if (!host) return;
  const trig = host.querySelector('.fp-trigger');
  const panel = host.querySelector('.fp-panel');
  if (panel && panel.classList.contains('open')) {
    panel.classList.remove('open');
    if (trig) trig.setAttribute('aria-expanded', 'false');
  }
  if (document.activeElement === trig) trig.blur();
}

export function buildFontPicker() {
  const host = document.getElementById('fontPicker');
  if (!host) return;

  const legacySelect = document.getElementById('selFont');
  if (legacySelect) legacySelect.style.display = 'none';

  host.classList.add('font-picker');
  host.innerHTML = `
    <button type="button" class="fp-trigger" aria-haspopup="listbox" aria-expanded="false">
      <span class="fp-current">Inter</span>
      <span class="fp-caret">▾</span>
    </button>
    <div class="fp-panel" role="listbox" aria-label="Tipografías">
      <div class="fp-list" id="fpList"></div>
    </div>
  `;
  const trigger = host.querySelector('.fp-trigger');
  const current = host.querySelector('.fp-current');
  const panel = host.querySelector('.fp-panel');
  const list = host.querySelector('#fpList');
  [trigger, panel].forEach((el) => {
    if (el) {
      el.style.background = '#fff';
      el.style.color = '#0f172a';
      el.style.borderColor = '#e5e7eb';
    }
  });

  let items = [];
  let selectedIndex = 0;

  const indexInFiltered = (globalIdx) => items.findIndex((it) => it.idx === globalIdx);

  const updateActiveItem = () => {
    const active = list?.querySelector('.fp-item.active');
    if (active) active.classList.remove('active');
    const currentItem = items[selectedIndex];
    if (!currentItem) return;
    const next = list?.querySelector(`.fp-item[data-index="${currentItem.idx}"]`);
    if (next) next.classList.add('active');
  };

  const chooseByIndex = (globalIdx) => {
    const f = FONT_SET[globalIdx];
    if (!f) return;
    selectedIndex = indexInFiltered(globalIdx);
    if (selectedIndex < 0) selectedIndex = 0;
    if (current) {
      current.textContent = f.name;
      current.style.fontFamily = f.family;
    }
    const sel = document.getElementById('selFont');
    if (sel) sel.value = f.name;
    if (panel) panel.classList.remove('open');
    trigger?.setAttribute('aria-expanded', 'false');
    trigger?.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const renderList = () => {
    if (!list) return;
    list.innerHTML = '';
    items = FONT_SET.map((f, idx) => ({ ...f, idx }));
    items.forEach((f) => {
      const el = document.createElement('div');
      el.className = 'fp-item';
      el.setAttribute('role', 'option');
      el.setAttribute('data-index', String(f.idx));
      el.innerHTML = `
        <span class="fp-name" style="font-family:${f.family}">${f.name}</span>
        <span class="fp-preview" style="font-family:${f.family}">Aa Bb Cc 0123</span>
      `;
      el.addEventListener('click', () => chooseByIndex(f.idx));
      el.addEventListener('mousemove', () => {
        selectedIndex = indexInFiltered(f.idx);
        updateActiveItem();
      });
      list.appendChild(el);
    });
    selectedIndex = Math.min(selectedIndex, items.length - 1);
    if (selectedIndex < 0) selectedIndex = 0;
    updateActiveItem();
  };

  const openPanel = () => {
    panel?.classList.add('open');
    trigger?.setAttribute('aria-expanded', 'true');
    renderList();
  };

  const closePanel = () => {
    panel?.classList.remove('open');
    trigger?.setAttribute('aria-expanded', 'false');
  };

  trigger?.addEventListener('click', () => {
    const isOpen = panel?.classList.contains('open');
    if (isOpen) closePanel(); else openPanel();
  });

  document.addEventListener('click', (e) => {
    if (!host.contains(e.target)) closePanel();
  });

  trigger?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      selectedIndex = Math.min(items.length - 1, selectedIndex + 1);
      updateActiveItem();
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      selectedIndex = Math.max(0, selectedIndex - 1);
      updateActiveItem();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const globalIdx = items[selectedIndex]?.idx;
      if (globalIdx != null) chooseByIndex(globalIdx);
    }
  });

  const def = FONT_SET[0];
  if (current && def) {
    current.textContent = def.name;
    current.style.fontFamily = def.family;
  }
  renderList();
}
function setAspect(key) {
  const preset = ASPECTS[key];
  const canvas = canvasState.canvas;
  if (!preset || !canvas) return;

  canvasState.baseW = preset.w;
  canvasState.baseH = preset.h;
  canvas.setWidth(preset.w);
  canvas.setHeight(preset.h);
  canvasState.hGuide?.set({ x1: 0, y1: preset.h / 2, x2: preset.w, y2: preset.h / 2 });
  canvasState.vGuide?.set({ x1: preset.w / 2, y1: 0, x2: preset.w / 2, y2: preset.h });
  addOrUpdatePaper();
  canvas.requestRenderAll();
  canvasState.autoCenter = true;
  requestAnimationFrame(() => {
    canvas.requestRenderAll();
    requestAnimationFrame(() => {
      console.log('calling fitToViewport from setAspect');
      fitToViewport(true);
    });
  });
  updateDesignInfo();
}

function setBg(color) {
  if (canvasState.paperRect) {
    canvasState.paperRect.set({ fill: color });
  }
  if (canvasState.paperShadowRect) {
    canvasState.paperShadowRect.set({ fill: color });
  }
  canvasState.canvas?.requestRenderAll();
}

export function duplicateActive() {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const active = canvas.getActiveObject();
  if (!active) return;
  active.clone((clone) => {
    clone.set({
      left: (active.left || 0) + 20,
      top: (active.top || 0) + 20,
    });
    canvas.add(clone);
    canvas.setActiveObject(clone);
    canvas.requestRenderAll();
  });
}

function bringToFront() {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const obj = canvas.getActiveObject();
  if (!obj) return;
  obj.bringToFront();
  canvasState.hGuide?.bringToFront();
  canvasState.vGuide?.bringToFront();
  canvas.requestRenderAll();
}

function sendToBack() {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const obj = canvas.getActiveObject();
  if (!obj) return;
  obj.sendToBack();
  canvasState.paperRect?.sendToBack();
  canvasState.paperShadowRect?.sendToBack();
  canvas.requestRenderAll();
}

function bringForward() {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const obj = canvas.getActiveObject();
  if (!obj) return;
  obj.bringForward();
  canvas.requestRenderAll();
}

function sendBackwards() {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const obj = canvas.getActiveObject();
  if (!obj) return;
  obj.sendBackwards();
  canvas.requestRenderAll();
}

function removeActive() {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const act = canvas.getActiveObjects();
  act.forEach((o) => canvas.remove(o));
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}

function currentAlign() {
  const btn = document.querySelector('.btnAlign.active');
  return btn?.dataset?.align || 'left';
}

const TEXTBOX_CONTROL_VISIBILITY = {
  mt: false,
  mb: false,
  tl: false,
  tr: false,
  bl: false,
  br: false,
};

function applyTextboxControlVisibility(textbox) {
  if (!textbox || textbox.type !== 'textbox' || typeof textbox.setControlsVisibility !== 'function') return;
  textbox.setControlsVisibility({ ...TEXTBOX_CONTROL_VISIBILITY });
}

function normalizeColorToHex(color, fallback = null) {
  if (typeof color !== 'string') return fallback;
  const trimmed = color.trim();
  if (!trimmed) return fallback;

  const hex6 = trimmed.match(/^#?[0-9a-fA-F]{6}$/);
  if (hex6) {
    const value = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
    return `#${value.toLowerCase()}`;
  }

  const hex3 = trimmed.match(/^#?[0-9a-fA-F]{3}$/);
  if (hex3) {
    const raw = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
    const expanded = raw.split('').map((ch) => `${ch}${ch}`).join('');
    return `#${expanded.toLowerCase()}`;
  }

  return fallback;
}

function getTextBackgroundControls() {
  return {
    colorInput: document.getElementById('inpTextBg'),
    noneCheckbox: document.getElementById('chkTextBgNone'),
  };
}

function getTextBackgroundControlValues() {
  const { colorInput, noneCheckbox } = getTextBackgroundControls();
  const color = colorInput?.value || '#ffffff';
  const isNone = !!noneCheckbox?.checked;
  return { color, isNone };
}

function applyBackgroundColorToTextbox(textbox, { color, isNone }) {
  if (!textbox || textbox.type !== 'textbox') return;
  const backgroundColor = isNone ? '' : (color || '');
  textbox.set('backgroundColor', backgroundColor);
  if (typeof textbox.initDimensions === 'function') textbox.initDimensions();
  if (typeof textbox.setCoords === 'function') textbox.setCoords();
}

export function syncTextBackgroundControlsFromSelection() {
  const { colorInput, noneCheckbox } = getTextBackgroundControls();
  if (!colorInput || !noneCheckbox) return;

  const canvas = canvasState.canvas;
  const activeObject = canvas?.getActiveObject ? canvas.getActiveObject() : null;
  const activeObjects = canvas?.getActiveObjects ? canvas.getActiveObjects() : [];
  const hasSingleTextbox = !!activeObject && activeObject.type === 'textbox' && activeObjects.length === 1;

  let hasBackground = false;

  if (hasSingleTextbox) {
    const raw = activeObject.backgroundColor;
    if (raw !== undefined && raw !== null) {
      const str = `${raw}`.trim();
      if (str && str !== 'transparent') {
        let parsedColor = null;
        let alpha = 1;
        const { fabric } = window;
        if (fabric?.Color) {
          try {
            const color = new fabric.Color(str);
            alpha = typeof color.getAlpha === 'function' ? color.getAlpha() : 1;
            parsedColor = `#${color.toHex()}`;
          } catch (error) {
            parsedColor = normalizeColorToHex(str, null);
          }
        } else {
          parsedColor = normalizeColorToHex(str, null);
        }
        if (alpha > 0 && parsedColor) {
          hasBackground = true;
          colorInput.value = parsedColor;
          colorInput.dataset.lastColor = parsedColor;
        }
      }
    }
    noneCheckbox.checked = !hasBackground;
  } else {
    noneCheckbox.checked = false;
  }

  noneCheckbox.disabled = !hasSingleTextbox;
  colorInput.disabled = !hasSingleTextbox || noneCheckbox.checked;

  if (!hasSingleTextbox) {
    const stored = colorInput.dataset.lastColor;
    if (stored) {
      const normalized = normalizeColorToHex(stored, '#ffffff');
      if (normalized) colorInput.value = normalized;
    }
  }
}

function applyTextBackgroundToSelection() {
  const { color, isNone } = getTextBackgroundControlValues();
  const canvas = canvasState.canvas;
  const activeObject = canvas?.getActiveObject ? canvas.getActiveObject() : null;
  if (activeObject && activeObject.type === 'textbox') {
    applyBackgroundColorToTextbox(activeObject, { color, isNone });
    canvas.requestRenderAll();
  }
  if (!isNone && color) {
    const normalized = normalizeColorToHex(color, null);
    const { colorInput } = getTextBackgroundControls();
    if (colorInput && normalized) colorInput.dataset.lastColor = normalized;
  }
  syncTextBackgroundControlsFromSelection();
}

function addText() {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const { color: bgColor, isNone: bgNone } = getTextBackgroundControlValues();
  const textbox = new fabric.Textbox('Doble click para editar', {
    left: canvasState.baseW / 2,
    top: canvasState.baseH / 2,
    originX: 'center',
    originY: 'center',
    width: canvasState.baseW * 0.6,
    fontFamily: document.getElementById('selFont')?.value,
    fontSize: getFontSizeFromSlider(),
    fill: document.getElementById('inpColor')?.value,
    textAlign: currentAlign(),
    stroke: parseInt(document.getElementById('inpStrokeWidth')?.value || '0', 10) > 0 ? document.getElementById('inpStrokeColor')?.value : undefined,
    strokeWidth: parseInt(document.getElementById('inpStrokeWidth')?.value || '0', 10),
    backgroundColor: bgNone ? '' : bgColor,
  });
  applyTextboxControlVisibility(textbox);
  canvas.add(textbox);
  applyBackgroundColorToTextbox(textbox, { color: bgColor, isNone: bgNone });
  canvas.setActiveObject(textbox);
  textbox.enterEditing();
  textbox.hiddenTextarea?.focus();
  canvas.requestRenderAll();
  updateSelInfo();
  if (!bgNone) {
    const { colorInput } = getTextBackgroundControls();
    if (colorInput) colorInput.dataset.lastColor = normalizeColorToHex(bgColor, colorInput.value || '#ffffff');
  }
  syncTextBackgroundControlsFromSelection();
}

function applyTextProps() {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const obj = canvas.getActiveObject();
  if (!obj || (obj.type !== 'i-text' && obj.type !== 'text' && obj.type !== 'textbox')) return;
  obj.set({
    fontFamily: document.getElementById('selFont')?.value,
    fontSize: getFontSizeFromSlider(),
    fill: document.getElementById('inpColor')?.value,
    stroke: parseInt(document.getElementById('inpStrokeWidth')?.value || '0', 10) > 0 ? document.getElementById('inpStrokeColor')?.value : undefined,
    strokeWidth: parseInt(document.getElementById('inpStrokeWidth')?.value || '0', 10),
    textAlign: currentAlign(),
  });
  if (obj.type === 'textbox') {
    const bgValues = getTextBackgroundControlValues();
    applyBackgroundColorToTextbox(obj, bgValues);
    if (!bgValues.isNone && bgValues.color) {
      const { colorInput } = getTextBackgroundControls();
      if (colorInput) colorInput.dataset.lastColor = normalizeColorToHex(bgValues.color, colorInput.value || '#ffffff');
    }
    if (obj.splitByGrapheme) {
      obj.set('splitByGrapheme', false);
    }
  }
  canvas.requestRenderAll();
  syncTextBackgroundControlsFromSelection();
  updateSelInfo();
}

function clampFontSizeValue(value) {
  const numeric = Number.parseFloat(`${value}`);
  if (!Number.isFinite(numeric)) return null;
  let next = Math.round(numeric);

  const parseLimit = (limit) => {
    if (limit === undefined || limit === null || `${limit}`.trim() === '') return null;
    const parsed = Number.parseFloat(`${limit}`);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  };

  const sliderInput = document.getElementById('sizeSlider');
  const minCandidates = [];
  const maxCandidates = [];

  const sliderMin = parseLimit(sliderInput?.min);
  if (sliderMin !== null) minCandidates.push(sliderMin);

  const sliderMax = parseLimit(sliderInput?.max);
  if (sliderMax !== null) maxCandidates.push(sliderMax);

  if (minCandidates.length) next = Math.max(next, Math.max(...minCandidates));
  if (maxCandidates.length) next = Math.min(next, Math.min(...maxCandidates));

  return next;
}

function getFontSizeFromSlider(fallback = 64) {
  const slider = document.getElementById('sizeSlider');
  const rawValue = slider?.value ?? fallback;
  const normalized = clampFontSizeValue(rawValue);
  if (normalized !== null) return normalized;
  const fallbackNormalized = clampFontSizeValue(fallback);
  return fallbackNormalized !== null ? fallbackNormalized : 64;
}

function applyLiveFontSize(value) {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const normalized = clampFontSizeValue(value);
  if (normalized === null) return;

  const activeObject = canvas.getActiveObject ? canvas.getActiveObject() : null;
  if (!activeObject || activeObject.type !== 'textbox') return;

  activeObject.set('fontSize', normalized);
  if (typeof activeObject.initDimensions === 'function') activeObject.initDimensions();
  if (typeof activeObject.setCoords === 'function') activeObject.setCoords();
  canvas.requestRenderAll();
}

export function syncFontSizeControlsFromSelection() {
  const canvas = canvasState.canvas;
  const sliderInput = document.getElementById('sizeSlider');
  const valueEl = document.getElementById('sizeValue');
  const activeObject = canvas?.getActiveObject ? canvas.getActiveObject() : null;
  const activeObjects = canvas?.getActiveObjects ? canvas.getActiveObjects() : [];
  const hasSingleTextbox = !!activeObject && activeObject.type === 'textbox' && activeObjects.length === 1;

  let next = null;
  if (hasSingleTextbox && typeof activeObject.fontSize === 'number' && Number.isFinite(activeObject.fontSize)) {
    next = clampFontSizeValue(activeObject.fontSize);
  }
  if (next === null) {
    next = getFontSizeFromSlider();
  }

  if (sliderInput) {
    sliderInput.value = `${next}`;
    sliderInput.disabled = !hasSingleTextbox;
  }
  if (valueEl) valueEl.textContent = `${next} px`;
}

function addImage(file) {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const reader = new FileReader();
  reader.onload = () => {
    fabric.Image.fromURL(reader.result, (img) => {
      const maxW = canvasState.baseW * 0.9;
      const maxH = canvasState.baseH * 0.9;
      const s = Math.min(maxW / img.width, maxH / img.height, 1);
      img.set({
        left: canvasState.baseW / 2,
        top: canvasState.baseH / 2,
        originX: 'center',
        originY: 'center',
        scaleX: s,
        scaleY: s,
        cornerStyle: 'circle',
      });
      if (!img.__origSrc) img.__origSrc = reader.result;
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
      updateSelInfo();
    }, { crossOrigin: 'anonymous' });
  };
  reader.readAsDataURL(file);
}
let cropper = null;
let cropTarget = null;

function parseAspect(v) {
  if (v === 'free') return NaN;
  if (v.includes('/')) {
    const [a, b] = v.split('/').map(Number);
    return (b && !Number.isNaN(a) && !Number.isNaN(b)) ? (a / b) : NaN;
  }
  const n = Number(v);
  return Number.isNaN(n) ? NaN : n;
}

function startCrop() {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const target = canvas.getActiveObject();
  if (!target || target.type !== 'image') {
    alert('Seleccioná una imagen primero.');
    return;
  }
  cropTarget = target;
  const imgEl = document.getElementById('cropperImage');
  const orig = target.__origSrc
    || target._originalElement?.src
    || target.getElement?.().src
    || target.toDataURL({ format: 'png' });
  if (imgEl) imgEl.src = orig;
  openModal(document.getElementById('cropModal'));
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  cropper = new Cropper(imgEl, {
    viewMode: 1,
    background: false,
    autoCrop: true,
    checkOrientation: false,
    responsive: true,
    dragMode: 'move',
    autoCropArea: 0.9,
  });
}

function applyCrop() {
  const canvas = canvasState.canvas;
  if (!canvas || !cropper || !cropTarget) return;
  const c = cropper.getCroppedCanvas({ imageSmoothingEnabled: true, imageSmoothingQuality: 'high' });
  const dataURL = c.toDataURL('image/png');
  const center = cropTarget.getCenterPoint();
  const angle = cropTarget.angle || 0;
  const dispW = cropTarget.getScaledWidth();
  const dispH = cropTarget.getScaledHeight();
  const idx = canvas.getObjects().indexOf(cropTarget);
  const src = cropTarget.__origSrc || cropTarget._originalElement?.src || cropTarget.toDataURL({ format: 'png' });
  if (!cropTarget.__origSrc && src) cropTarget.__origSrc = src;
  canvas.remove(cropTarget);
  fabric.Image.fromURL(dataURL, (img) => {
    img.__origSrc = src;
    img.__maskedSrc = dataURL;
    img.set({ originX: 'center', originY: 'center', left: center.x, top: center.y, angle });
    const sx = dispW / img.width;
    const sy = dispH / img.height;
    img.set({ scaleX: sx, scaleY: sy });
    if (idx >= 0) {
      canvas.insertAt(img, idx, true);
    } else {
      canvas.add(img);
    }
    canvas.setActiveObject(img);
    canvas.requestRenderAll();
  }, { crossOrigin: 'anonymous' });
  cropTarget = null;
  cropper.destroy();
  cropper = null;
  closeModal(document.getElementById('cropModal'));
}

function cleanupCropper() {
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  cropTarget = null;
}
function applyFeatherMaskToActive(px = 40, shape = 'rect') {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const target = canvas.getActiveObject();
  if (!target || target.type !== 'image') {
    alert('Seleccioná una imagen primero.');
    return;
  }
  const baseSrc = target._originalElement?.src || target.toDataURL({ format: 'png' });
  const maskSrc = target.__maskedSrc || baseSrc;
  const origSrc = target.__origSrc || baseSrc;
  const img = new Image();
  img.onload = () => {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const res = document.createElement('canvas');
    res.width = w;
    res.height = h;
    const rx = res.getContext('2d');
    rx.imageSmoothingEnabled = true;
    rx.imageSmoothingQuality = 'high';
    rx.drawImage(img, 0, 0, w, h);
    const mask = document.createElement('canvas');
    mask.width = w;
    mask.height = h;
    const mx = mask.getContext('2d');
    mx.imageSmoothingEnabled = true;
    mx.imageSmoothingQuality = 'high';
    mx.fillStyle = '#fff';
    mx.fillRect(0, 0, w, h);
    if (px > 0) {
      if (shape === 'circle') {
        const rMax = Math.min(w, h) / 2;
        const rInner = Math.max(0, rMax - px);
        const cx = w / 2;
        const cy = h / 2;
        const g = mx.createRadialGradient(cx, cy, rInner, cx, cy, rMax);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        mx.globalCompositeOperation = 'destination-in';
        mx.fillStyle = g;
        mx.beginPath();
        mx.arc(cx, cy, rMax, 0, Math.PI * 2);
        mx.closePath();
        mx.fill();
      } else {
        mx.globalCompositeOperation = 'destination-out';
        let g = mx.createLinearGradient(0, 0, px, 0);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        mx.fillStyle = g;
        mx.fillRect(0, 0, px, h);
        g = mx.createLinearGradient(w, 0, w - px, 0);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        mx.fillStyle = g;
        mx.fillRect(w - px, 0, px, h);
        g = mx.createLinearGradient(0, 0, 0, px);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        mx.fillStyle = g;
        mx.fillRect(0, 0, w, px);
        g = mx.createLinearGradient(0, h, 0, h - px);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        mx.fillStyle = g;
        mx.fillRect(0, h - px, w, px);
      }
    }
    rx.globalCompositeOperation = 'destination-in';
    rx.drawImage(mask, 0, 0);
    const dataURL = res.toDataURL('image/png');
    const center = target.getCenterPoint();
    const angle = target.angle || 0;
    const dispW = target.getScaledWidth();
    const dispH = target.getScaledHeight();
    const idx = canvas.getObjects().indexOf(target);
    if (!target.__origSrc && origSrc) target.__origSrc = origSrc;
    canvas.remove(target);
    fabric.Image.fromURL(dataURL, (img2) => {
      img2.__origSrc = origSrc;
      img2.__maskedSrc = dataURL;
      img2.set({ originX: 'center', originY: 'center', left: center.x, top: center.y, angle });
      const sx = dispW / img2.width;
      const sy = dispH / img2.height;
      img2.set({ scaleX: sx, scaleY: sy });
      if (idx >= 0) {
        canvas.insertAt(img2, idx, true);
      } else {
        canvas.add(img2);
      }
      canvas.setActiveObject(img2);
      canvas.requestRenderAll();
    }, { crossOrigin: 'anonymous' });
  };
  img.onerror = () => alert('No se pudo cargar la imagen para enmascarar.');
  img.src = maskSrc;
}

function removeFeatherMaskFromActive() {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const target = canvas.getActiveObject();
  if (!target || target.type !== 'image') {
    alert('Seleccioná una imagen primero.');
    return;
  }
  const src = target.__origSrc || target._originalElement?.src;
  if (!src) {
    alert('No hay original guardado para restaurar.');
    return;
  }
  const center = target.getCenterPoint();
  const angle = target.angle || 0;
  const dispW = target.getScaledWidth();
  const dispH = target.getScaledHeight();
  const idx = canvas.getObjects().indexOf(target);
  canvas.remove(target);
  fabric.Image.fromURL(src, (img) => {
    img.__origSrc = src;
    img.set({ originX: 'center', originY: 'center', left: center.x, top: center.y, angle });
    const sx = dispW / img.width;
    const sy = dispH / img.height;
    img.set({ scaleX: sx, scaleY: sy });
    if (idx >= 0) {
      canvas.insertAt(img, idx, true);
    } else {
      canvas.add(img);
    }
    canvas.setActiveObject(img);
    canvas.requestRenderAll();
  }, { crossOrigin: 'anonymous' });
}

function hexToRgba(hex, a) {
  let clean = hex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map((c) => c + c).join('');
  const n = parseInt(clean, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function addOrUpdateVignette(color, strength) {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const rMax = Math.max(canvasState.baseW, canvasState.baseH) * 0.75;
  const rInner = Math.min(canvasState.baseW, canvasState.baseH) * 0.25;
  const gradient = new fabric.Gradient({
    type: 'radial',
    coords: { x1: canvasState.baseW / 2, y1: canvasState.baseH / 2, r1: rInner, x2: canvasState.baseW / 2, y2: canvasState.baseH / 2, r2: rMax },
    colorStops: [
      { offset: 0, color: hexToRgba(color, 0) },
      { offset: 1, color: hexToRgba(color, Math.min(0.9, strength)) },
    ],
  });
  if (!canvasState.vignetteRect) {
    canvasState.vignetteRect = new fabric.Rect({
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      width: canvasState.baseW,
      height: canvasState.baseH,
      fill: gradient,
      selectable: false,
      evented: false,
    });
    canvas.add(canvasState.vignetteRect);
  } else {
    canvasState.vignetteRect.set({ left: 0, top: 0, width: canvasState.baseW, height: canvasState.baseH, fill: gradient });
    canvasState.vignetteRect.setCoords();
  }
  orderBackground();
  canvas.requestRenderAll();
}

function removeVignette() {
  const canvas = canvasState.canvas;
  if (!canvasState.vignetteRect || !canvas) return;
  canvas.remove(canvasState.vignetteRect);
  canvasState.vignetteRect = null;
  canvas.requestRenderAll();
}
function withNeutralVPT(fn) {
  const canvas = canvasState.canvas;
  if (!canvas) return null;
  const prev = (canvas.viewportTransform || [1, 0, 0, 1, 0, 0]).slice();
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  const out = fn();
  canvas.setViewportTransform(prev);
  return out;
}

function getScaleMultiplier() {
  const elM = document.getElementById('selScaleM');
  if (elM) return parseInt(elM.value || '2', 10);
  const el = document.getElementById('selScale');
  return parseInt((el && el.value) || '2', 10);
}

function isMono() {
  const cM = document.getElementById('chkMonoM');
  if (cM) return !!cM.checked;
  const c = document.getElementById('chkMono');
  return !!(c && c.checked);
}

async function toGray(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const a = d.data;
      for (let i = 0; i < a.length; i += 4) {
        const y = 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2];
        a[i] = a[i + 1] = a[i + 2] = y;
      }
      ctx.putImageData(d, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = dataURL;
  });
}

async function exportPNG() {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const mult = getScaleMultiplier();
  const data = withNeutralVPT(() => canvas.toDataURL({
    format: 'png',
    left: 0,
    top: 0,
    width: canvasState.baseW,
    height: canvasState.baseH,
    multiplier: mult,
  }));
  const out = isMono() ? await toGray(data) : data;
  const a = document.createElement('a');
  a.href = out;
  a.download = 'diseño.png';
  a.click();
}

async function exportPDF() {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const mult = getScaleMultiplier();
  const data = withNeutralVPT(() => canvas.toDataURL({
    format: 'png',
    left: 0,
    top: 0,
    width: canvasState.baseW,
    height: canvasState.baseH,
    multiplier: mult,
  }));
  const out = isMono() ? await toGray(data) : data;
  const { jsPDF } = window.jspdf;
  const w = canvasState.baseW * mult;
  const h = canvasState.baseH * mult;
  const pdf = new jsPDF({
    unit: 'px',
    format: [w, h],
    orientation: (w >= h ? 'landscape' : 'portrait'),
    compress: true,
  });
  pdf.addImage(out, 'JPEG', 0, 0, w, h, undefined, 'MEDIUM', 0.8);
  pdf.save('diseño.pdf');
}

function getPageDims(format, orientation) {
  const { jsPDF } = window.jspdf;
  const tmp = new jsPDF({ unit: 'mm', format, orientation });
  const w = tmp.internal.pageSize.getWidth();
  const h = tmp.internal.pageSize.getHeight();
  return { w, h, orientation };
}

function planLayout(format, orientation, margin, copyW, imgRatio) {
  const { w: pageW, h: pageH } = getPageDims(format, orientation);
  const usableW = Math.max(0, pageW - margin * 2);
  const usableH = Math.max(0, pageH - margin * 2);
  const copyH = copyW * imgRatio;
  const cols = Math.max(0, Math.floor(usableW / copyW));
  const rows = Math.max(0, Math.floor(usableH / copyH));
  const total = cols * rows;
  const leftoverW = Math.max(0, usableW - cols * copyW);
  const leftoverH = Math.max(0, usableH - rows * copyH);
  const gapX = cols > 0 ? leftoverW / (cols + 1) : 0;
  const gapY = rows > 0 ? leftoverH / (rows + 1) : 0;
  const wasteArea = (usableW * usableH) - (cols * rows * copyW * copyH);
  return { format, orientation, pageW, pageH, usableW, usableH, margin, copyW, copyH, cols, rows, total, gapX, gapY, wasteArea };
}

function computeBestLayout(format, margin, copyW, imgRatio) {
  const L = planLayout(format, 'landscape', margin, copyW, imgRatio);
  const P = planLayout(format, 'portrait', margin, copyW, imgRatio);
  if (L.total > P.total) return L;
  if (P.total > L.total) return P;
  return (L.wasteArea <= P.wasteArea) ? L : P;
}

function ensurePrintHintsEl() {
  let el = document.getElementById('printHints');
  if (!el) {
    const copyInput = document.getElementById('inpCopyW');
    const row = copyInput ? copyInput.closest('.row') : null;
    el = document.createElement('div');
    el.id = 'printHints';
    el.style.fontSize = '12px';
    el.style.opacity = '0.9';
    el.style.marginTop = '6px';
    el.style.lineHeight = '1.3';
    if (row && row.parentElement) {
      row.parentElement.insertBefore(el, row.nextElementSibling);
    } else {
      (document.getElementById('rightPanel') || document.body).appendChild(el);
    }
  }
  return el;
}

function formatN(n, d = 1) {
  return Number.isFinite(n) ? n.toFixed(d) : '—';
}

function updatePrintHints() {
  const page = document.getElementById('selPage')?.value || 'a4';
  const userMargin = parseFloat(document.getElementById('inpMargin')?.value || '0');
  const MIN_MARGIN_MM = 3;
  const margin = (Number.isNaN(userMargin) || userMargin <= 0) ? MIN_MARGIN_MM : userMargin;
  const copyW = parseFloat(document.getElementById('inpCopyW')?.value || '80');
  if (!Number.isFinite(copyW) || copyW <= 0) return;
  const imgRatio = canvasState.baseH / canvasState.baseW;
  const best = computeBestLayout(page, margin, copyW, imgRatio);
  const alt = (best.orientation === 'landscape')
    ? planLayout(page, 'portrait', margin, copyW, imgRatio)
    : planLayout(page, 'landscape', margin, copyW, imgRatio);
  const hintsEl = ensurePrintHintsEl();
  const colsTargets = [2, 3, 4];
  const maxWForCols = colsTargets.map((n) => {
    const usableW = best.usableW;
    if (n <= 0 || usableW <= 0) return null;
    const w = Math.floor((usableW / n) * 10) / 10;
    return { n, w };
  }).filter(Boolean);
  hintsEl.innerHTML = `
    <div><strong>Orientación óptima:</strong> ${best.orientation === 'landscape' ? 'Horizontal' : 'Vertical'}</div>
    <div><strong>Tamaño copia:</strong> ${formatN(best.copyW)} × ${formatN(best.copyH)} mm</div>
    <div><strong>Por hoja (óptimo):</strong> ${best.cols} × ${best.rows} = <strong>${best.total}</strong></div>
    <div>Alternativa (${alt.orientation === 'landscape' ? 'Horizontal' : 'Vertical'}): ${alt.cols} × ${alt.rows} = ${alt.total}</div>
    <div style="margin-top:4px;"><em>Sugerencias de ancho para columnas (orientación óptima):</em><br>
      ${maxWForCols.map((s) => `• ${s.n} columnas → ancho ≤ <strong>${formatN(s.w)}</strong> mm`).join('<br>')}
    </div>
  `;
}

async function printSheet() {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const mult = getScaleMultiplier();
  const data = withNeutralVPT(() => canvas.toDataURL({
    format: 'png',
    left: 0,
    top: 0,
    width: canvasState.baseW,
    height: canvasState.baseH,
    multiplier: mult,
  }));
  const out = isMono() ? await toGray(data) : data;
  const page = document.getElementById('selPage')?.value || 'a4';
  const copies = parseInt(document.getElementById('inpCopies')?.value || '8', 10) || 1;
  const userMargin = parseFloat(document.getElementById('inpMargin')?.value || '0');
  const MIN_MARGIN_MM = 3;
  const margin = (Number.isNaN(userMargin) || userMargin <= 0) ? MIN_MARGIN_MM : userMargin;
  const copyW = parseFloat(document.getElementById('inpCopyW')?.value || '80');
  if (!Number.isFinite(copyW) || copyW <= 0) return;
  const imgRatio = canvasState.baseH / canvasState.baseW;
  const best = computeBestLayout(page, margin, copyW, imgRatio);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: page, orientation: best.orientation });
  let placed = 0;
  while (placed < copies) {
    for (let r = 0; r < best.rows && placed < copies; r++) {
      for (let c = 0; c < best.cols && placed < copies; c++) {
        const x = best.margin + best.gapX + c * (best.copyW + best.gapX);
        const y = best.margin + best.gapY + r * (best.copyH + best.gapY);
        pdf.addImage(out, 'PNG', +x.toFixed(2), +y.toFixed(2), +best.copyW.toFixed(2), +best.copyH.toFixed(2), undefined, 'FAST');
        placed++;
      }
    }
    if (placed < copies) pdf.addPage(page, best.orientation);
  }
  pdf.save('hoja_copias.pdf');
}
function alignCanvas(where) {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const obj = canvas.getActiveObject();
  if (!obj) return;
  obj.setCoords();
  const br = obj.getBoundingRect(true);
  let dx = 0;
  let dy = 0;
  if (where === 'left') dx = 0 - br.left;
  if (where === 'centerH') dx = (canvasState.baseW / 2) - (br.left + br.width / 2);
  if (where === 'right') dx = canvasState.baseW - (br.left + br.width);
  if (where === 'top') dy = 0 - br.top;
  if (where === 'centerV') dy = (canvasState.baseH / 2) - (br.top + br.height / 2);
  if (where === 'bottom') dy = canvasState.baseH - (br.top + br.height);
  obj.left = Math.round((obj.left || 0) + dx);
  obj.top = Math.round((obj.top || 0) + dy);
  obj.setCoords();
  canvas.requestRenderAll();
  updateSelInfo();
}

async function ensureQRLib() {
  if (window.QRCode || window.qrcode) return true;
  const urls = [
    'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
    'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js',
  ];
  for (const u of urls) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = u;
        s.onload = () => resolve();
        s.onerror = () => reject();
        document.head.appendChild(s);
      });
      if (window.QRCode || window.qrcode) return true;
    } catch (error) {
      console.warn('QR load error', error);
    }
  }
  return false;
}

function createQRDataURL(text, size = 512, cb) {
  if (window.QRCode && window.QRCode.toDataURL) {
    window.QRCode.toDataURL(text, { width: size, margin: 1 }, cb);
  } else if (window.qrcode) {
    try {
      const qr = window.qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      const url = qr.createDataURL(8);
      cb(null, url);
    } catch (error) {
      cb(error);
    }
  } else {
    cb(new Error('Sin librería QR'));
  }
}

async function makeQR(url) {
  const ok = await ensureQRLib();
  if (!ok) {
    alert('No se pudo cargar la librería de QR.');
    return;
  }
  createQRDataURL(url, 512, (err, data) => {
    if (err || !data) {
      console.error('QR error:', err);
      alert('No se pudo generar el QR');
      return;
    }
    const canvas = canvasState.canvas;
    if (!canvas) return;
    fabric.Image.fromURL(data, (img) => {
      img.set({
        left: canvasState.baseW / 2,
        top: canvasState.baseH / 2,
        originX: 'center',
        originY: 'center',
        scaleX: 0.5,
        scaleY: 0.5,
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
      updateSelInfo();
    });
  });
}
function addRect() {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const w = Math.round(canvasState.baseW * 0.45);
  const h = Math.round(canvasState.baseH * 0.28);
  const fill = document.getElementById('shapeFill')?.value || '#ffffff';
  const stroke = document.getElementById('shapeStrokeColor')?.value || '#111827';
  const sw = parseFloat(document.getElementById('shapeStrokeWidth')?.value || '2') || 0;
  const r = parseInt(document.getElementById('shapeCorner')?.value || '12', 10) || 0;
  const rect = new fabric.Rect({
    left: canvasState.baseW / 2,
    top: canvasState.baseH / 2,
    originX: 'center',
    originY: 'center',
    width: w,
    height: h,
    rx: r,
    ry: r,
    fill,
    stroke,
    strokeWidth: sw,
    cornerStyle: 'circle',
  });
  canvas.add(rect);
  canvas.setActiveObject(rect);
  canvas.requestRenderAll();
}

function applyShapeProps() {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const obj = canvas.getActiveObject();
  if (!obj || obj.type !== 'rect') return;
  const fill = document.getElementById('shapeFill')?.value || '#ffffff';
  const stroke = document.getElementById('shapeStrokeColor')?.value || '#111827';
  const sw = parseFloat(document.getElementById('shapeStrokeWidth')?.value || '2') || 0;
  const r = parseInt(document.getElementById('shapeCorner')?.value || '12', 10) || 0;
  obj.set({ fill, stroke, strokeWidth: sw, rx: r, ry: r });
  canvas.requestRenderAll();
}

export function syncShapeControlsFromSelection() {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const obj = canvas.getActiveObject();
  if (!obj || obj.type !== 'rect') return;
  const fillEl = document.getElementById('shapeFill');
  const strokeEl = document.getElementById('shapeStrokeColor');
  const swEl = document.getElementById('shapeStrokeWidth');
  const rEl = document.getElementById('shapeCorner');
  if (fillEl) {
    try { fillEl.value = fabric.Color.fromHex(obj.fill || '#ffffff').toHex(); } catch { fillEl.value = '#ffffff'; }
  }
  if (strokeEl) {
    try { strokeEl.value = fabric.Color.fromHex(obj.stroke || '#111827').toHex(); } catch { strokeEl.value = '#111827'; }
  }
  if (swEl) swEl.value = obj.strokeWidth ?? 0;
  if (rEl) rEl.value = obj.rx ?? 0;
}

export function syncOpacityControlFromSelection() {
  const control = document.getElementById('opacityControl');
  if (!control) return;
  const valueEl = document.getElementById('opacityValue');
  const canvas = canvasState.canvas;
  const activeObject = canvas?.getActiveObject ? canvas.getActiveObject() : null;
  const activeObjects = canvas?.getActiveObjects ? canvas.getActiveObjects() : [];
  const hasSingle = !!activeObject && activeObject.type !== 'activeSelection' && activeObjects.length === 1;

  let opacity = 1;
  if (hasSingle && typeof activeObject.opacity === 'number' && Number.isFinite(activeObject.opacity)) {
    opacity = activeObject.opacity;
  }

  const normalized = Math.min(1, Math.max(0, opacity));
  const percentage = Math.round(normalized * 100);

  control.value = `${percentage}`;
  control.disabled = !hasSingle;
  if (valueEl) valueEl.textContent = `${percentage}%`;
}
let isMobileUI = false;
let leftPH;
let rightPH;

function setMobileDockCollapsed(collapsed) {
  const dock = document.getElementById('mobileDock');
  const toggle = dock?.querySelector('.md-toggle');
  const content = dock?.querySelector('.md-content');
  if (dock) dock.classList.toggle('collapsed', collapsed);
  if (toggle) {
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.setAttribute('aria-label', collapsed ? 'Expandir panel móvil' : 'Contraer panel móvil');
    toggle.setAttribute('title', collapsed ? 'Expandir panel móvil' : 'Contraer panel móvil');
  }
  if (content) {
    content.setAttribute('aria-hidden', collapsed ? 'true' : 'false');
    if (collapsed) content.setAttribute('inert', ''); else content.removeAttribute('inert');
  }
  document.body.classList.toggle('collapsed', collapsed && isMobileUI);
}

function buildMobileDockOnce() {
  const dock = document.getElementById('mobileDock');
  if (!dock || dock.dataset.ready === '1') return;
  dock.dataset.ready = '1';
  dock.innerHTML = `
    <div class="md-top">
      <span class="md-title">Panel móvil</span>
      <button type="button" class="md-toggle" aria-expanded="true" aria-controls="mobileDockContent" aria-label="Contraer panel móvil" title="Contraer panel móvil">
        <span class="md-toggle-icon" aria-hidden="true">▾</span>
      </button>
    </div>
    <div class="md-content" id="mobileDockContent" aria-hidden="false">
      <div class="md-zoom"></div>
      <div class="md-tabs">
        <button type="button" class="md-tab" data-tab="tools">Herramientas</button>
        <button type="button" class="md-tab" data-tab="help">Ayuda</button>
      </div>
      <div class="md-panels">
        <div class="md-panel" id="md-tools"></div>
        <div class="md-panel" id="md-help"></div>
      </div>
    </div>
  `;
  const tabs = dock.querySelectorAll('.md-tab');
  tabs.forEach((btn) => btn.addEventListener('click', () => switchMobileTab(btn.dataset.tab)));
  dock.querySelector('.md-toggle')?.addEventListener('click', () => {
    const next = !dock.classList.contains('collapsed');
    setMobileDockCollapsed(next);
    requestAnimationFrame(() => fitToViewport());
  });
  setMobileDockCollapsed(false);
}

function switchMobileTab(which = 'tools') {
  const dock = document.getElementById('mobileDock');
  if (!dock || !isMobileUI) return;
  if (dock.classList.contains('collapsed')) setMobileDockCollapsed(false);
  dock.querySelectorAll('.md-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === which));
  dock.querySelectorAll('.md-panel').forEach((p) => p.classList.toggle('active', (p.id === (which === 'tools' ? 'md-tools' : 'md-help'))));
  requestAnimationFrame(() => fitToViewport());
}

function enterMobileDock() {
  if (isMobileUI) return;
  const left = document.getElementById('leftPanel');
  const right = document.getElementById('rightPanel');
  const dock = document.getElementById('mobileDock');
  if (!left || !right || !dock) return;
  buildMobileDockOnce();
  setMobileDockCollapsed(false);
  const zoomSlot = dock.querySelector('.md-zoom');
  const hud = document.querySelector('#deskBar .hud');
  if (hud && zoomSlot) zoomSlot.appendChild(hud);
  if (!leftPH) {
    leftPH = document.createElement('div');
    leftPH.id = 'leftPH';
    left.parentNode.insertBefore(leftPH, left);
  }
  if (!rightPH) {
    rightPH = document.createElement('div');
    rightPH.id = 'rightPH';
    right.parentNode.insertBefore(rightPH, right);
  }
  dock.style.display = '';
  dock.querySelector('#md-tools')?.appendChild(left);
  dock.querySelector('#md-help')?.appendChild(right);
  document.body.classList.add('mobile-docked');
  isMobileUI = true;
  setMobileDockCollapsed(false);
  switchMobileTab('tools');
  requestAnimationFrame(() => fitToViewport());
}

function exitMobileDock() {
  if (!isMobileUI) return;
  const left = document.getElementById('leftPanel');
  const right = document.getElementById('rightPanel');
  const dock = document.getElementById('mobileDock');
  const desk = document.getElementById('deskBar');
  const hud = dock?.querySelector('.hud');
  setMobileDockCollapsed(false);
  if (leftPH && left) leftPH.parentNode.insertBefore(left, leftPH);
  if (rightPH && right) rightPH.parentNode.insertBefore(right, rightPH);
  if (hud && desk) desk.appendChild(hud);
  if (dock) dock.style.display = 'none';
  document.body.classList.remove('mobile-docked');
  document.body.classList.remove('collapsed');
  isMobileUI = false;
  requestAnimationFrame(() => fitToViewport());
}

function handleResponsivePanels() {
  const mobile = window.matchMedia('(max-width: 767px)').matches;
  if (mobile) enterMobileDock(); else exitMobileDock();
  const canvas = canvasState.canvas;
  if (!canvas) return;
  requestAnimationFrame(() => {
    canvas.requestRenderAll();
    requestAnimationFrame(() => {
      console.log('calling fitToViewport from setAspect');
      fitToViewport(true);
    });
  });
}

function overrideOpenersForMobile() {
  const btnOpenTools = document.getElementById('btnOpenTools');
  const btnCloseTools = document.getElementById('btnCloseTools');
  const btnOpenHelp = document.getElementById('btnOpenHelp');
  const btnCloseHelp = document.getElementById('btnCloseHelp');
  const toTools = (e) => { if (isMobileUI) { e.preventDefault(); switchMobileTab('tools'); } };
  const toHelp = (e) => { if (isMobileUI) { e.preventDefault(); switchMobileTab('help'); } };
  btnOpenTools?.addEventListener('click', toTools);
  btnCloseTools?.addEventListener('click', toTools);
  btnOpenHelp?.addEventListener('click', toHelp);
  btnCloseHelp?.addEventListener('click', toHelp);
}

function initTouchMultiSelect() {
  const canvas = canvasState.canvas;
  const { fabric } = window;
  if (!canvas || !fabric || typeof fabric.ActiveSelection !== 'function') return;
  if (canvas.__miniCanvaTouchMultiSelect) return;
  canvas.__miniCanvaTouchMultiSelect = true;

  let lastTouchStartedOnObject = false;
  let lastPointerWasTouch = false;
  let syncingSelection = false;

  const isTouchLike = (event) => {
    if (!event) return false;
    if (event.touches && event.touches.length) return true;
    if (event.changedTouches && event.changedTouches.length) return true;
    const { pointerType, type } = event;
    if (typeof pointerType === 'string') return pointerType === 'touch';
    if (typeof pointerType === 'number') return pointerType === 2;
    return typeof type === 'string' && type.startsWith('touch');
  };

  const filterExisting = (items) => {
    if (!Array.isArray(items) || !items.length) return [];
    const existing = new Set(canvas.getObjects());
    return items.filter((obj) => existing.has(obj));
  };

  const applyBufferSelection = () => {
    if (!canvasState.multiSelectMode) return;
    const buffer = filterExisting(canvasState.multiSelectBuffer);
    canvasState.multiSelectBuffer = buffer;
    if (buffer.length === 0) {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      return;
    }
    if (buffer.length === 1) {
      canvas.setActiveObject(buffer[0]);
      canvas.requestRenderAll();
      return;
    }
    syncingSelection = true;
    const selection = new fabric.ActiveSelection(buffer, { canvas });
    canvas.setActiveObject(selection);
    canvas.requestRenderAll();
    syncingSelection = false;
  };

  canvas.on('mouse:down', (opt) => {
    const evt = opt?.e;
    const touch = isTouchLike(evt);
    lastPointerWasTouch = touch;
    if (!touch) {
      lastTouchStartedOnObject = false;
      return;
    }
    lastTouchStartedOnObject = !!opt?.target;
  });

  const mergeSelectionFromTouch = (opt) => {
    if (!canvasState.multiSelectMode || syncingSelection) return;
    const evt = opt?.e;
    if (!isTouchLike(evt)) return;

    const activeObjects = typeof canvas.getActiveObjects === 'function' ? canvas.getActiveObjects() : [];
    if (!activeObjects.length) return;

    const existing = filterExisting(canvasState.multiSelectBuffer);
    const merged = new Set(existing);
    let changed = false;
    activeObjects.forEach((obj) => {
      if (!merged.has(obj)) {
        merged.add(obj);
        changed = true;
      }
    });

    const nextBuffer = Array.from(merged);
    if (!changed && nextBuffer.length === existing.length) return;

    canvasState.multiSelectBuffer = nextBuffer;
    if (nextBuffer.length > 1) {
      syncingSelection = true;
      const selection = new fabric.ActiveSelection(nextBuffer, { canvas });
      canvas.setActiveObject(selection);
      canvas.requestRenderAll();
      syncingSelection = false;
    }
  };

  canvas.on('selection:created', mergeSelectionFromTouch);
  canvas.on('selection:updated', mergeSelectionFromTouch);

  canvas.on('selection:cleared', (opt) => {
    if (!canvasState.multiSelectMode) return;
    const evt = opt?.e;
    const touch = isTouchLike(evt) || lastPointerWasTouch;
    if (!touch) return;
    if (!lastTouchStartedOnObject && canvasState.multiSelectBuffer.length) {
      canvasState.multiSelectBuffer = [];
    }
  });

  canvas.on('object:removed', (opt) => {
    if (!Array.isArray(canvasState.multiSelectBuffer) || !canvasState.multiSelectBuffer.length) return;
    const removed = opt?.target;
    const filtered = filterExisting(canvasState.multiSelectBuffer).filter((obj) => obj && obj !== removed);
    if (filtered.length === canvasState.multiSelectBuffer.length) return;
    canvasState.multiSelectBuffer = filtered;
    if (!canvasState.multiSelectMode) return;
    applyBufferSelection();
  });
}
export function setupUIHandlers() {
  applyDialogFallback();
  window.addEventListener('resize', setHeaderHeight);
  window.addEventListener('resize', syncDrawers);
  mq.addEventListener('change', toggleDeskBar);
  toggleDeskBar(mq);
  attachDrawerButtons();

  document.getElementById('selAspect')?.addEventListener('change', (e) => setAspect(e.target.value));
  document.getElementById('inpBg')?.addEventListener('input', (e) => setBg(e.target.value));
  document.getElementById('btnNew')?.addEventListener('click', () => {
    const c = canvasState.canvas;
    if (!c) return;
    c.getObjects().slice().forEach((o) => {
      if (o !== canvasState.hGuide && o !== canvasState.vGuide && o !== canvasState.paperRect && o !== canvasState.paperShadowRect) c.remove(o);
    });
    if (canvasState.vignetteRect) c.add(canvasState.vignetteRect);
    orderBackground();
    c.discardActiveObject();
    c.requestRenderAll();
    updateSelInfo();
    canvasState.autoCenter = true;
    requestAnimationFrame(() => {
      c.requestRenderAll();
      requestAnimationFrame(() => {
        console.log('calling fitToViewport from setAspect');
        fitToViewport(true);
      });
    });
  });

  document.getElementById('btnText')?.addEventListener('click', addText);
  document.getElementById('fileImg')?.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) addImage(file);
    e.target.value = '';
  });
  document.querySelectorAll('.btnAlign').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btnAlign').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      btn.blur();
    });
  });
  document.getElementById('btnApplyText')?.addEventListener('click', applyTextProps);

  const textFillInput = document.getElementById('inpColor');
  const textStrokeColorInput = document.getElementById('inpStrokeColor');
  const textStrokeWidthInput = document.getElementById('inpStrokeWidth');

  const getActiveTextbox = () => {
    const canvas = canvasState.canvas;
    const active = canvas?.getActiveObject ? canvas.getActiveObject() : null;
    return active && active.type === 'textbox' ? active : null;
  };

  const normalizeStrokeWidthValue = (value) => {
    let numeric = Number.parseFloat(`${value}`);
    if (!Number.isFinite(numeric)) numeric = 0;
    numeric = Math.round(numeric);

    const parseLimit = (limit) => {
      if (limit === undefined || limit === null) return null;
      const trimmed = `${limit}`.trim();
      if (!trimmed) return null;
      const parsed = Number.parseFloat(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const min = parseLimit(textStrokeWidthInput?.min);
    if (min !== null) numeric = Math.max(numeric, min);

    const max = parseLimit(textStrokeWidthInput?.max);
    if (max !== null) numeric = Math.min(numeric, max);

    if (numeric < 0) numeric = 0;
    return numeric;
  };

  const comparableColor = (value) => {
    if (value === undefined || value === null) return undefined;
    return `${value}`.trim().toLowerCase();
  };

  const applyStrokeToTextbox = (textbox, { color, width } = {}) => {
    const prevStroke = textbox.stroke;
    const prevWidth = Number.isFinite(textbox.strokeWidth) ? textbox.strokeWidth : 0;

    let nextWidth = width;
    if (!Number.isFinite(nextWidth)) nextWidth = prevWidth;
    nextWidth = normalizeStrokeWidthValue(nextWidth);

    let nextStroke = color;
    if (nextStroke === undefined) nextStroke = prevStroke;

    if (nextWidth <= 0) {
      nextWidth = 0;
      nextStroke = undefined;
    }

    const strokeChanged = comparableColor(prevStroke) !== comparableColor(nextStroke);
    const widthChanged = prevWidth !== nextWidth;

    if (!strokeChanged && !widthChanged) return false;

    textbox.set({ stroke: nextStroke, strokeWidth: nextWidth });

    if (strokeChanged || widthChanged) {
      if (typeof textbox.initDimensions === 'function') textbox.initDimensions();
      if (typeof textbox.setCoords === 'function') textbox.setCoords();
    }

    return true;
  };

  const attachTextboxListener = (el, handler) => {
    if (!el) return;
    ['input', 'change'].forEach((evt) => el.addEventListener(evt, handler));
  };

  attachTextboxListener(textFillInput, () => {
    const canvas = canvasState.canvas;
    const textbox = getActiveTextbox();
    if (!canvas || !textbox || !textFillInput) return;
    const prevFill = comparableColor(textbox.fill);
    const nextFill = comparableColor(textFillInput.value);
    if (prevFill === nextFill) return;
    textbox.set('fill', textFillInput.value);
    canvas.requestRenderAll();
    updateSelInfo();
  });

  attachTextboxListener(textStrokeColorInput, () => {
    const canvas = canvasState.canvas;
    const textbox = getActiveTextbox();
    if (!canvas || !textbox || !textStrokeColorInput) return;
    const didChange = applyStrokeToTextbox(textbox, { color: textStrokeColorInput.value });
    if (!didChange) return;
    canvas.requestRenderAll();
    updateSelInfo();
  });

  attachTextboxListener(textStrokeWidthInput, () => {
    const canvas = canvasState.canvas;
    const textbox = getActiveTextbox();
    if (!canvas || !textbox || !textStrokeWidthInput) return;
    const normalizedWidth = normalizeStrokeWidthValue(textStrokeWidthInput.value);
    if (`${normalizedWidth}` !== textStrokeWidthInput.value) textStrokeWidthInput.value = `${normalizedWidth}`;
    const strokeColor = normalizedWidth > 0 ? textStrokeColorInput?.value ?? textbox.stroke : undefined;
    const didChange = applyStrokeToTextbox(textbox, { color: strokeColor, width: normalizedWidth });
    if (!didChange) return;
    canvas.requestRenderAll();
    updateSelInfo();
  });

  const textBackgroundInput = document.getElementById('inpTextBg');
  const textBackgroundNone = document.getElementById('chkTextBgNone');
  textBackgroundInput?.addEventListener('input', () => {
    applyTextBackgroundToSelection();
  });
  textBackgroundNone?.addEventListener('change', () => {
    applyTextBackgroundToSelection();
  });
  const selFont = document.getElementById('selFont');
  if (selFont) {
    selFont.addEventListener('change', async (e) => {
      const family = e.target.value;
      await ensureFontLoaded(family);
      const obj = canvasState.canvas?.getActiveObject();
      if (obj && (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox')) {
        obj.set('fontFamily', family);
        canvasState.canvas.requestRenderAll();
      }
    });
  }

  const fontSizeSlider = document.getElementById('sizeSlider');
  const fontSizeValue = document.getElementById('sizeValue');
  const reflectFontSize = (raw) => {
    const normalized = clampFontSizeValue(raw);
    if (normalized === null) return null;
    if (fontSizeSlider) fontSizeSlider.value = `${normalized}`;
    if (fontSizeValue) fontSizeValue.textContent = `${normalized} px`;
    return normalized;
  };

  fontSizeSlider?.addEventListener('input', () => {
    const normalized = reflectFontSize(fontSizeSlider.value);
    if (normalized === null) return;
    applyLiveFontSize(normalized);
  });

  document.getElementById('btnStartCrop')?.addEventListener('click', startCrop);
  const featherInput = document.getElementById('featherPx');
  const featherVal = document.getElementById('featherVal');
  featherInput?.addEventListener('input', () => { if (featherVal) featherVal.textContent = `${featherInput.value} px`; });
  document.getElementById('btnApplyFeather')?.addEventListener('click', () => {
    const shape = document.getElementById('featherShape')?.value;
    const px = parseInt(featherInput?.value || '0', 10) || 0;
    applyFeatherMaskToActive(px, shape);
  });
  document.getElementById('btnRemoveFeather')?.addEventListener('click', removeFeatherMaskFromActive);

  document.getElementById('btnFront')?.addEventListener('click', bringToFront);
  document.getElementById('btnBack')?.addEventListener('click', sendToBack);
  document.getElementById('btnFwd')?.addEventListener('click', bringForward);
  document.getElementById('btnBwd')?.addEventListener('click', sendBackwards);
  document.getElementById('btnDup')?.addEventListener('click', duplicateActive);
  document.getElementById('btnDel')?.addEventListener('click', removeActive);

  const canvas = canvasState.canvas;
  if (canvas) {
    canvas.on('object:added', (opt) => {
      const target = opt?.target;
      if (target?.type === 'textbox') {
        applyTextboxControlVisibility(target);
      }
    });
  }

  const opacityControl = document.getElementById('opacityControl');
  const opacityValue = document.getElementById('opacityValue');
  if (opacityControl) {
    opacityControl.addEventListener('input', () => {
      const canvas = canvasState.canvas;
      let raw = parseInt(opacityControl.value, 10);
      if (!Number.isFinite(raw)) raw = 0;
      const clamped = Math.min(100, Math.max(0, raw));
      if (`${clamped}` !== opacityControl.value) opacityControl.value = `${clamped}`;
      if (opacityValue) opacityValue.textContent = `${clamped}%`;

      if (!canvas) return;
      const activeObject = canvas.getActiveObject ? canvas.getActiveObject() : null;
      const activeObjects = canvas.getActiveObjects ? canvas.getActiveObjects() : [];
      const hasSingle = !!activeObject && activeObject.type !== 'activeSelection' && activeObjects.length === 1;
      opacityControl.disabled = !hasSingle;
      if (!hasSingle || !activeObject) return;

      const opacity = clamped / 100;
      activeObject.set({ opacity });
      canvas.requestRenderAll();
    });
  }

  const opacityCanvas = canvasState.canvas;
  if (opacityCanvas) {
    opacityCanvas.on('selection:created', syncOpacityControlFromSelection);
    opacityCanvas.on('selection:updated', syncOpacityControlFromSelection);
    opacityCanvas.on('selection:cleared', syncOpacityControlFromSelection);
  }
  syncOpacityControlFromSelection();

  const fontSizeCanvas = canvasState.canvas;
  if (fontSizeCanvas) {
    fontSizeCanvas.on('selection:created', syncFontSizeControlsFromSelection);
    fontSizeCanvas.on('selection:updated', syncFontSizeControlsFromSelection);
    fontSizeCanvas.on('selection:cleared', syncFontSizeControlsFromSelection);
  }
  syncFontSizeControlsFromSelection();

  const textBackgroundCanvas = canvasState.canvas;
  if (textBackgroundCanvas) {
    textBackgroundCanvas.on('selection:created', syncTextBackgroundControlsFromSelection);
    textBackgroundCanvas.on('selection:updated', syncTextBackgroundControlsFromSelection);
    textBackgroundCanvas.on('selection:cleared', syncTextBackgroundControlsFromSelection);
  }
  syncTextBackgroundControlsFromSelection();

  document.getElementById('alignLeft')?.addEventListener('click', () => alignCanvas('left'));
  document.getElementById('alignCenterH')?.addEventListener('click', () => alignCanvas('centerH'));
  document.getElementById('alignRight')?.addEventListener('click', () => alignCanvas('right'));
  document.getElementById('alignTop')?.addEventListener('click', () => alignCanvas('top'));
  document.getElementById('alignCenterV')?.addEventListener('click', () => alignCanvas('centerV'));
  document.getElementById('alignBottom')?.addEventListener('click', () => alignCanvas('bottom'));
  document.getElementById('chkGuides')?.addEventListener('change', (e) => {
    canvasState.showGuides = !!e.target.checked;
    if (!canvasState.showGuides) {
      if (canvasState.hGuide) canvasState.hGuide.visible = false;
      if (canvasState.vGuide) canvasState.vGuide.visible = false;
      canvasState.canvas?.requestRenderAll();
    }
  });

  document.getElementById('btnPNG')?.addEventListener('click', exportPNG);
  document.getElementById('btnPDF')?.addEventListener('click', exportPDF);
  document.getElementById('btnPrintSheet')?.addEventListener('click', printSheet);

  ['inpCopyW', 'inpMargin', 'selPage', 'inpCopies'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const evt = (el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(evt, updatePrintHints);
  });
  updatePrintHints();

  document.getElementById('btnMakeWA')?.addEventListener('click', () => {
    const phone = (document.getElementById('waPhone')?.value || '').replace(/\D/g, '');
    const text = encodeURIComponent(document.getElementById('waMsg')?.value || '');
    if (!phone) {
      alert('Ingresá el teléfono (formato internacional sin +)');
      return;
    }
    const url = `https://wa.me/${phone}${text ? `?text=${text}` : ''}`;
    makeQR(url);
  });
  document.getElementById('btnMakeURL')?.addEventListener('click', () => {
    const url = (document.getElementById('inURL')?.value || '').trim() || 'https://example.com';
    makeQR(url);
  });

  document.getElementById('btnRect')?.addEventListener('click', addRect);
  document.getElementById('btnApplyShape')?.addEventListener('click', applyShapeProps);
  ['shapeFill', 'shapeStrokeColor', 'shapeStrokeWidth', 'shapeCorner'].forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener('input', () => {
      const obj = canvasState.canvas?.getActiveObject();
      if (!obj || obj.type !== 'rect') return;
      applyShapeProps();
    });
  });

  document.getElementById('btnZoomInHUD')?.addEventListener('click', () => {
    const c = canvasState.canvas;
    if (!c) return;
    zoomTo((c.getZoom() || 1) * 1.1);
  });
  document.getElementById('btnZoomOutHUD')?.addEventListener('click', () => {
    const c = canvasState.canvas;
    if (!c) return;
    zoomTo((c.getZoom() || 1) / 1.1);
  });
  document.getElementById('btnZoomResetHUD')?.addEventListener('click', () => zoomTo(1, null, true));
  document.getElementById('btnZoomFitHUD')?.addEventListener('click', () => {
    canvasState.autoCenter = true;
    fitToViewport();
  });
  document.getElementById('btnHandHUD')?.addEventListener('click', () => {
    const c = canvasState.canvas;
    if (!c) return;
    canvasState.handMode = !canvasState.handMode;
    c.skipTargetFind = canvasState.handMode;
    c.defaultCursor = canvasState.handMode ? 'grab' : 'default';
    document.getElementById('btnHandHUD')?.classList.toggle('active', canvasState.handMode);
  });
  const btnMultiHUD = document.getElementById('btnMultiHUD');
  btnMultiHUD?.addEventListener('click', () => {
    const next = !canvasState.multiSelectMode;
    canvasState.multiSelectMode = next;
    canvasState.multiSelectBuffer = [];
    btnMultiHUD.classList.toggle('active', next);
  });

  if (canvasState.canvas) {
    initTouchMultiSelect();
  }

  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => { if (canvasState.autoCenter) fitToViewport(true); });
    const viewportEl = document.getElementById('viewport');
    if (viewportEl) ro.observe(viewportEl);
  } else {
    window.addEventListener('resize', () => { if (canvasState.autoCenter) fitToViewport(true); });
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      canvasState.autoCenter = true;
      fitToViewport(true);
    });
  });

  handleResponsivePanels();
  overrideOpenersForMobile();
  window.addEventListener('resize', handleResponsivePanels);

  document.getElementById('cmClose')?.addEventListener('click', () => {
    cleanupCropper();
    closeModal(document.getElementById('cropModal'));
  });
  document.getElementById('cmZoomIn')?.addEventListener('click', () => cropper && cropper.zoom(0.1));
  document.getElementById('cmZoomOut')?.addEventListener('click', () => cropper && cropper.zoom(-0.1));
  document.getElementById('cmRotate')?.addEventListener('click', () => cropper && cropper.rotate(90));
  document.getElementById('cmReset')?.addEventListener('click', () => cropper && cropper.reset());
  document.getElementById('cropAspect')?.addEventListener('change', (e) => {
    const ratio = parseAspect(e.target.value);
    if (cropper) cropper.setAspectRatio(ratio);
  });
  document.getElementById('cmApply')?.addEventListener('click', applyCrop);

  window.__miniCanva = { get canvas() { return canvasState.canvas; } };
}
