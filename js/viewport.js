import { canvasState, updateDesignInfo, isFabricEditing } from './canvas-init.js';

const MIN_Z = 0.2;
const MAX_Z = 8;

export function updateZoomLabel() {
  const canvas = canvasState.canvas;
  if (!canvas) return;
  const label = document.getElementById('zoomLabel');
  if (label) {
    label.textContent = Math.round((canvas.getZoom() || 1) * 100) + '%';
  }
}

export function fitToViewport(scrollTop = false) {
  const canvas = canvasState.canvas;
  if (!canvas) return;

  const outer = document.getElementById('viewport');
  if (!outer) return;

  const rect = outer.getBoundingClientRect();
  const header = document.getElementById('deskBar');
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  const viewportW = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;

  const rawWidth = rect.width || outer.clientWidth || outer.offsetWidth || 0;
  const rawHeight = rect.height || outer.clientHeight || outer.offsetHeight || 0;

  const visibleWidth = Math.max(0, Math.min(rawWidth, viewportW - Math.max(rect.left, 0)));
  const visibleHeight = Math.max(0, Math.min(rawHeight, viewportH - Math.max(rect.top, headerBottom)));

  let ow = visibleWidth;
  if (ow <= 0) {
    ow = rawWidth > 0 ? Math.min(rawWidth, viewportW) : viewportW;
  }

  let oh = visibleHeight;
  if (oh <= 0) {
    const maxHeight = Math.max(0, viewportH - headerBottom);
    const basis = rawHeight > 0 ? rawHeight : maxHeight;
    oh = Math.min(basis, maxHeight || viewportH);
  }

  if (ow <= 0 || oh <= 0) {
    requestAnimationFrame(() => fitToViewport(scrollTop));
    return;
  }

  const M = 24;
  const w = canvas.getWidth();
  const h = canvas.getHeight();
  const s = Math.max(MIN_Z, Math.min(MAX_Z, Math.min((ow - M) / w, (oh - M) / h)));

  let tx = (ow - w * s) / 2;
  let ty = (oh - h * s) / 2;

  if (w * s > ow) tx = 0;
  if (scrollTop || h * s > oh) ty = 0;

  console.log('fitToViewport start', {
    zoom: canvas.getZoom(),
    outerTop: rect.top,
    headerBottom,
    tx,
    ty,
  });
  canvas.setViewportTransform([s, 0, 0, s, tx, ty]);
  console.log('transform', canvas.viewportTransform);
  const canvasTop = canvas.upperCanvasEl.getBoundingClientRect().top;
  const diff = headerBottom - canvasTop;
  updateZoomLabel();
  updateDesignInfo();
  if (scrollTop && Math.abs(diff) > 1) {
    console.log('scroll', {
      scrollY: window.scrollY,
      targetTop: window.scrollY + rect.top - headerBottom,
    });
    window.scrollBy(0, diff);
  }
}

export function zoomTo(newZ, centerPoint, recenter = false) {
  const canvas = canvasState.canvas;
  if (!canvas) return;

  const z = Math.max(MIN_Z, Math.min(MAX_Z, newZ));
  const cp = centerPoint || new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
  canvas.zoomToPoint(cp, z);
  if (recenter) {
    const outer = document.getElementById('viewport');
    if (outer) {
      const W = outer.clientWidth;
      const H = outer.clientHeight;
      const w = canvas.getWidth() * z;
      const h = canvas.getHeight() * z;
      const vpt = canvas.viewportTransform;
      if (vpt) {
        vpt[4] = (W - w) / 2;
        vpt[5] = (H - h) / 2;
        canvas.setViewportTransform(vpt);
      }
    }
  }
  updateZoomLabel();
  updateDesignInfo();
}

function clientToCanvasPoint(clientX, clientY) {
  const canvas = canvasState.canvas;
  if (!canvas) return new fabric.Point(clientX, clientY);
  const rect = canvas.upperCanvasEl.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const inv = fabric.util.invertTransform(canvas.viewportTransform);
  return fabric.util.transformPoint(new fabric.Point(x, y), inv);
}

export function setupPanAndPinch() {
  const canvas = canvasState.canvas;
  if (!canvas) return;

  const el = canvas.upperCanvasEl;
  let isDragging = false;
  let lastClient = { x: 0, y: 0 };
  let pinchActive = false;
  let lastDist = 0;
  let lastMid = { x: 0, y: 0 };

  canvas.on('mouse:down', (opt) => {
    const e = opt.e;
    const shouldPan = !isFabricEditing() && (canvasState.spaceDown || canvasState.handMode || !opt.target);
    if (shouldPan && !e.touches) {
      isDragging = true;
      canvas.selection = false;
      canvas.defaultCursor = 'grabbing';
      lastClient = { x: e.clientX, y: e.clientY };
    }
  });

  canvas.on('mouse:move', (opt) => {
    if (!isDragging) return;
    const e = opt.e;
    const vpt = canvas.viewportTransform;
    if (!vpt) return;
    vpt[4] += (e.clientX - lastClient.x);
    vpt[5] += (e.clientY - lastClient.y);
    lastClient = { x: e.clientX, y: e.clientY };
    canvas.requestRenderAll();
    updateDesignInfo();
  });

  const endDrag = () => {
    if (isDragging) {
      isDragging = false;
      canvas.selection = true;
      canvas.defaultCursor = (canvasState.handMode || canvasState.spaceDown) ? 'grab' : 'default';
    }
  };

  canvas.on('mouse:up', endDrag);

  function getDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  function getMid(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }

  el.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      pinchActive = true;
      canvasState.autoCenter = false;
      lastDist = getDist(e.touches);
      lastMid = getMid(e.touches);
    }
  }, { passive: false });

  el.addEventListener('touchmove', (e) => {
    if (pinchActive && e.touches.length === 2) {
      e.preventDefault();
      const mid = getMid(e.touches);
      const dist = getDist(e.touches);
      if (lastDist > 0) {
        const scale = dist / lastDist;
        const newZ = Math.max(MIN_Z, Math.min(MAX_Z, (canvas.getZoom() || 1) * scale));
        const midCanvas = clientToCanvasPoint(mid.x, mid.y);
        canvas.zoomToPoint(midCanvas, newZ);
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] += (mid.x - lastMid.x);
          vpt[5] += (mid.y - lastMid.y);
          canvas.setViewportTransform(vpt);
        }
        updateZoomLabel();
        updateDesignInfo();
      }
      lastDist = dist;
      lastMid = mid;
    }
  }, { passive: false });

  el.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      pinchActive = false;
    }
  }, { passive: false });

  canvas.on('mouse:wheel', (opt) => {
    const event = opt.e;
    let z = canvas.getZoom() || 1;
    z *= Math.pow(0.999, event.deltaY);
    z = Math.max(MIN_Z, Math.min(MAX_Z, z));
    const midCanvas = clientToCanvasPoint(event.clientX, event.clientY);
    canvasState.autoCenter = false;
    canvas.zoomToPoint(midCanvas, z);
    updateZoomLabel();
    updateDesignInfo();
    event.preventDefault();
    event.stopPropagation();
  });
}
