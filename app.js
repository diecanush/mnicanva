if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

(() => {
  const $ = (s)=>document.querySelector(s);

  let canvas, showGuides=true, hGuide=null, vGuide=null, vignetteRect=null;
  let paperRect=null, paperShadowRect=null;

  const setHeaderHeight = (scrollTop=false) => {
    const el = document.getElementById('deskBar');
    document.documentElement.style.setProperty('--header-h', `${el?.offsetHeight || 0}px`);

    fitToViewport(scrollTop === true);

  };
  window.addEventListener('resize', setHeaderHeight);

  // ===== Dialog support detection =====
  function supportsDialog(){ return 'HTMLDialogElement' in window; }
  const hasDialog = supportsDialog();
  function openModal(el){ hasDialog ? el.showModal() : el.classList.add('open'); }
  function closeModal(el){ hasDialog ? el.close() : el.classList.remove('open'); }
  if(!hasDialog){
    const dlg = document.getElementById('cropModal');
    if(dlg){
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
  }

  // ====== Responsive desktop bar ======
  const mq = window.matchMedia('(min-width: 768px)');
  function toggleDeskBar(e){
    document.getElementById('deskBar').style.display = e.matches ? 'flex' : 'none';
    setHeaderHeight(true);
  }
  mq.addEventListener('change', toggleDeskBar);

  function syncDrawers(){
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    if(isDesktop){
      document.getElementById('leftPanel').classList.remove('open');
      document.getElementById('rightPanel').classList.remove('open');
    }
  }
  window.addEventListener('resize', syncDrawers);

  document.getElementById('btnOpenTools').addEventListener('click', ()=> {
    document.getElementById('leftPanel').classList.toggle('open');
    setTimeout(()=> { if(autoCenter) fitToViewport(true); }, 320);
  });
  document.getElementById('btnCloseTools').addEventListener('click', ()=> {
    document.getElementById('leftPanel').classList.remove('open');
    setTimeout(()=> { if(autoCenter) fitToViewport(true); }, 320);
  });
  document.getElementById('btnOpenHelp').addEventListener('click', ()=> {
    document.getElementById('rightPanel').classList.toggle('open');
    setTimeout(()=> { if(autoCenter) fitToViewport(true); }, 320);
  });
  document.getElementById('btnCloseHelp').addEventListener('click', ()=> {
    document.getElementById('rightPanel').classList.remove('open');
    setTimeout(()=> { if(autoCenter) fitToViewport(true); }, 320);
  });

  // ====== Aspect presets (incluye A4) ======
  const ASPECTS = {
    "1:1":   { w:1080, h:1080 },
    "4:3":   { w:1200, h:900 },
    "3:4":   { w:900,  h:1200 },
    "9:16":  { w:1080, h:1920 },
    "16:9":  { w:1920, h:1080 },
    // ISO 216 A4 (1:√2) base 10px/mm
    "A4P":   { w:2100, h:2970 }, // 210x297 mm
    "A4L":   { w:2970, h:2100 }, // 297x210 mm
    "A5P":   { w:1480, h:2100 },
    "A5L":   { w:2100, h:1480 }
  };
  let baseW=1480, baseH=2100;

  let autoCenter = true;
  let handMode   = false;
  let spaceDown  = false;

  // ===== Helpers edición de texto =====
  const isFabricEditing = () => {
    const obj = canvas?.getActiveObject?.();
    return !!(obj && (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') && obj.isEditing);
  };

  // ====== Fuentes (curado) ======
  const FONT_SET = [
    {name:'Inter',             family:`'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif`, gf:'Inter:wght@400;600'},
    {name:'Merriweather',      family:`'Merriweather', Georgia, serif`, gf:'Merriweather:wght@400;700'},
    {name:'Oswald',            family:`'Oswald', Arial, sans-serif`, gf:'Oswald:wght@400;600'},
    {name:'Lora',              family:`'Lora', Georgia, serif`, gf:'Lora:wght@400;600'},
    {name:'Montserrat',        family:`'Montserrat', Arial, Helvetica, sans-serif`, gf:'Montserrat:wght@500;700'},
    {name:'Playfair Display',  family:`'Playfair Display', Georgia, serif`, gf:'Playfair+Display:wght@400;700'},
    {name:'Space Mono',        family:`'Space Mono', ui-monospace, SFMono-Regular, Menlo, monospace`, gf:'Space+Mono:wght@400;700'},
    {name:'Abril Fatface',     family:`'Abril Fatface', 'Times New Roman', serif`, gf:'Abril+Fatface'},
    {name:'Dancing Script',    family:`'Dancing Script', 'Comic Sans MS', cursive`, gf:'Dancing+Script:wght@400;600'},
    {name:'Inconsolata',       family:`'Inconsolata', ui-monospace, Consolas, monospace`, gf:'Inconsolata:wght@400;700'}
  ];
  function injectGoogleFonts(){
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    const fams = FONT_SET.map(f=>f.gf).join('&family=');
    link.href = `https://fonts.googleapis.com/css2?family=${fams}&display=swap`;
    document.head.appendChild(link);
  }
  function populateFontSelect(){
    const sel = document.getElementById('selFont');
    if(!sel) return;
    sel.innerHTML = '';
    FONT_SET.forEach(f=>{
      const opt = document.createElement('option');
      opt.value = f.name;
      opt.textContent = f.name;
      opt.style.fontFamily = f.family;
      sel.appendChild(opt);
    });
    sel.value = 'Inter';
  }
  async function ensureFontLoaded(family){
    if (document.fonts && document.fonts.load){
      try{ await document.fonts.load(`16px "${family}"`); }catch{}
    }
  }

  // ==== cerrar el panel si está abierto ====
  function closeFontPanelIfOpen() {
    const host = document.getElementById('fontPicker');
    if (!host) return;
    const trig = host.querySelector('.fp-trigger');
    const panel = host.querySelector('.fp-panel');
    if (panel && panel.classList.contains('open')) {
      panel.classList.remove('open');
      trig && trig.setAttribute('aria-expanded', 'false');
    }
    if (document.activeElement === trig) trig.blur();
  }

  // ====== Font picker custom ======
  function buildFontPicker() {
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
    // Forzar legibilidad por si el CSS global está oscuro
    [trigger, panel].forEach(el=>{
      if(el){ el.style.background = '#fff'; el.style.color = '#0f172a'; el.style.borderColor = '#e5e7eb'; }
    });

    let items = [];
    let selectedIndex = 0;

    const renderList = () => {
      list.innerHTML = '';
      items = FONT_SET.map((f, idx) => ({...f, idx}));
      items.forEach((f, i) => {
        const el = document.createElement('div');
        el.className = 'fp-item';
        el.setAttribute('role', 'option');
        el.setAttribute('data-index', String(f.idx));
        el.innerHTML = `
          <span class="fp-name" style="font-family:${f.family}">${f.name}</span>
          <span class="fp-preview" style="font-family:${f.family}">Aa Bb Cc 0123</span>
        `;
        el.addEventListener('click', () => chooseByIndex(f.idx));
        el.addEventListener('mousemove', () => { selectedIndex = indexInFiltered(f.idx); updateActiveItem(); });
        list.appendChild(el);
      });
      selectedIndex = Math.min(selectedIndex, items.length - 1);
      if (selectedIndex < 0) selectedIndex = 0;
      updateActiveItem();
    };
    const indexInFiltered = (globalIdx) => items.findIndex(it => it.idx === globalIdx);
    const updateActiveItem = () => {
      [...list.children].forEach((el, i) => {
        el.setAttribute('aria-selected', i === selectedIndex ? 'true' : 'false');
      });
      const active = list.children[selectedIndex];
      if (active && active.scrollIntoView) {
        active.scrollIntoView({ block: 'nearest' });
      }
    };
    const openPanel = () => {
      // No abrir mientras se edita texto
      if (isFabricEditing()) return;
      trigger.setAttribute('aria-expanded', 'true');
      panel.classList.add('open');
      renderList();
    };
    const closePanel = () => {
      trigger.setAttribute('aria-expanded', 'false');
      panel.classList.remove('open');
      trigger.blur();
    };
    const applyFontToCanvas = async (familyName) => {
      await ensureFontLoaded(familyName);
      const obj = canvas?.getActiveObject?.();
      if (obj && (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox')) {
        obj.set('fontFamily', familyName);
        canvas.requestRenderAll();
      }
      const legacy = document.getElementById('selFont');
      if (legacy) legacy.value = familyName;
    };
    const chooseByIndex = async (globalIdx) => {
      const f = FONT_SET[globalIdx]; if (!f) return;
      current.textContent = f.name; current.style.fontFamily = f.family;
      await applyFontToCanvas(f.name);
      closePanel();
    };

    // Abrir/cerrar SOLO desde el botón (teclado accesible)
    trigger.addEventListener('keydown', (e) => {
      if (isFabricEditing()) return;
      const isOpen = panel.classList.contains('open');
      if (!isOpen && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault(); openPanel(); return;
      }
      if (isOpen && e.key === 'Escape') {
        e.preventDefault(); closePanel(); return;
      }
    });

    // Navegación cuando el panel ya está abierto (flechas, Enter)
    host.addEventListener('keydown', (e) => {
      if (isFabricEditing() || e.target?.tagName === 'TEXTAREA' || e.target?.isContentEditable) return;

      const isOpen = panel.classList.contains('open');
      if (!isOpen) return;

      if (e.key === 'Escape') { e.preventDefault(); closePanel(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex = Math.min(selectedIndex + 1, items.length - 1); updateActiveItem(); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); selectedIndex = Math.max(selectedIndex - 1, 0); updateActiveItem(); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        const globalIdx = items[selectedIndex]?.idx;
        if (globalIdx != null) chooseByIndex(globalIdx);
        return;
      }
    });

    trigger.addEventListener('click', () => {
      const isOpen = panel.classList.contains('open');
      if (isOpen) closePanel(); else openPanel();
    });
    document.addEventListener('click', (e) => { if (!host.contains(e.target)) closePanel(); });

    const def = FONT_SET[0];
    current.textContent = def.name; current.style.fontFamily = def.family;
    renderList();
  }

  // ====== Lienzo y fondo ======
  function addOrUpdatePaper(){
    const W = canvas.getWidth(), H = canvas.getHeight();
    if(!paperRect){
      paperRect = new fabric.Rect({ left:0, top:0, width:W, height:H, fill:'#ffffff', selectable:false, evented:false });
      canvas.add(paperRect);
    } else { paperRect.set({ width:W, height:H }); paperRect.setCoords(); }

    if(!paperShadowRect){
      paperShadowRect = new fabric.Rect({
        left:0, top:0, width:W, height:H, fill:paperRect.fill,
        selectable:false, evented:false, excludeFromExport:true,
        shadow: new fabric.Shadow({ color:'rgba(0,0,0,0.25)', blur:30, offsetX:0, offsetY:10 })
      });
      canvas.add(paperShadowRect);
    } else { paperShadowRect.set({ width:W, height:H, fill:paperRect.fill }); paperShadowRect.setCoords(); }

    orderBackground();
  }
  function orderBackground(){
    if (paperShadowRect) canvas.moveTo(paperShadowRect, 0);
    if (paperRect)       canvas.moveTo(paperRect, 1);
    if (vignetteRect)    canvas.moveTo(vignetteRect, 2);
    if (hGuide) hGuide.bringToFront();
    if (vGuide) vGuide.bringToFront();
  }

  function initCanvas(){
    if(!(window.fabric&&window.jspdf)){ alert('No se cargaron Fabric/jsPDF.'); return; }
    canvas=new fabric.Canvas('stage',{preserveObjectStacking:true, backgroundColor:'transparent', selection:true});
    canvas.setWidth(baseW); canvas.setHeight(baseH);

    hGuide=new fabric.Line([0,baseH/2,baseW,baseH/2],{stroke:'#38bdf8',strokeWidth:1,selectable:false,evented:false,excludeFromExport:true,visible:false});
    vGuide=new fabric.Line([baseW/2,0,baseW/2,baseH],{stroke:'#38bdf8',strokeWidth:1,selectable:false,evented:false,excludeFromExport:true,visible:false});
    canvas.add(hGuide); canvas.add(vGuide);

    addOrUpdatePaper();

    // Teclado seguro
    function isTypingInAForm(){
      const ae = document.activeElement;
      return !!(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable));
    }
    window.addEventListener('keydown',(e)=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){ e.preventDefault(); duplicateActive(); return; }

      // si estás escribiendo (form o i-text), no activar hand/atajos
      if (isTypingInAForm() || isFabricEditing()) return;

      if(e.code==='Space'){ spaceDown = true; canvas.defaultCursor = 'grab'; }

      if(e.key==='Delete'||e.key==='Backspace'){
        const act = canvas.getActiveObjects();
        if(!act || act.length===0) return;
        act.forEach(o=>canvas.remove(o));
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        e.preventDefault();
      }
    });
    window.addEventListener('keyup',(e)=>{ if(e.code==='Space'){ spaceDown = false; canvas.defaultCursor = 'default'; } });

    canvas.on('object:moving',(opt)=>{ if(!showGuides){ hGuide.visible=false; vGuide.visible=false; canvas.requestRenderAll(); return; }
      const o=opt.target, tol=8; let snapped=false;
      const w=o.getScaledWidth?o.getScaledWidth():(o.width*(o.scaleX||1));
      const h=o.getScaledHeight?o.getScaledHeight():(o.height*(o.scaleY||1));
      const cx=(o.left||0)+w/2, cy=(o.top||0)+h/2;
      if(Math.abs(cx-baseW/2)<tol){ o.left=(baseW-w)/2; vGuide.visible=true; snapped=true; }
      if(Math.abs(cy-baseH/2)<tol){ o.top=(baseH-h)/2; hGuide.visible=true; snapped=true; }
      if(Math.abs((o.left||0)-0)<tol){ o.left=0; vGuide.visible=true; snapped=true; }
      if(Math.abs(((o.left||0)+w)-baseW)<tol){ o.left=baseW-w; vGuide.visible=true; snapped=true; }
      if(Math.abs((o.top||0)-0)<tol){ o.top=0; hGuide.visible=true; snapped=true; }
      if(Math.abs(((o.top||0)+h)-baseH)<tol){ o.top=baseH-h; hGuide.visible=true; snapped=true; }
      if(!snapped){ hGuide.visible=false; vGuide.visible=false; }
    });
    canvas.on('mouse:up',()=>{ if(hGuide.visible||vGuide.visible){ hGuide.visible=false; vGuide.visible=false; canvas.requestRenderAll(); } });

    canvas.on('selection:updated',updateSelInfo);
    canvas.on('selection:created',updateSelInfo);
    canvas.on('selection:cleared',updateSelInfo);

    // cerrar picker al empezar a editar o tocar el lienzo
    canvas.on('text:editing:entered', closeFontPanelIfOpen);
    canvas.on('mouse:down', closeFontPanelIfOpen);

    // sync controles recuadro
    canvas.on('selection:updated', syncShapeControlsFromSelection);
    canvas.on('selection:created', syncShapeControlsFromSelection);

    setupPanAndPinch();
    updateDesignInfo();
    autoCenter = true;
    fitToViewport(true);
  }

  // ===== Panning & Pinch Zoom =====
  const MIN_Z = 0.2, MAX_Z = 8;
  function updateZoomLabel(){ document.getElementById('zoomLabel').textContent = Math.round((canvas.getZoom()||1)*100)+'%'; }
  function fitToViewport(scrollTop=false){
    const outer = document.getElementById('viewport');
    if(!outer||!canvas) return;
    const ow = outer.clientWidth;
    const oh = Math.min(outer.clientHeight, window.innerHeight);
    if(ow <= 0 || oh <= 0){
      requestAnimationFrame(()=>fitToViewport(scrollTop));
      return;
    }
    const M = 24;
    const w = canvas.getWidth(), h = canvas.getHeight();
    const s  = Math.max(MIN_Z, Math.min(MAX_Z, Math.min((ow - M)/w, (oh - M)/h)));

    let tx = (ow - w*s) / 2;
    let ty = (oh - h*s) / 2;

    // Anchor to top/left if scaled canvas exceeds the viewport
    if (w * s > ow) tx = 0;
    if (scrollTop || h * s > oh) ty = 0;

    canvas.setViewportTransform([s,0,0,s,tx,ty]);
    updateZoomLabel();
    updateDesignInfo();
    if (scrollTop) {
      const diff = outer.getBoundingClientRect().top;
      if (diff !== 0) window.scrollBy(0, diff);
    }

  }
  function zoomTo(newZ, centerPoint, recenter=false){
    const z = Math.max(MIN_Z, Math.min(MAX_Z, newZ));
    const cp = centerPoint || new fabric.Point(canvas.getWidth()/2, canvas.getHeight()/2);
    canvas.zoomToPoint(cp, z);
    if(recenter){
      const outer = document.getElementById('viewport');
      const W = outer.clientWidth, H = outer.clientHeight;
      const w = canvas.getWidth()*z, h = canvas.getHeight()*z;
      const vpt = canvas.viewportTransform; vpt[4] = (W - w)/2; vpt[5] = (H - h)/2;
      canvas.setViewportTransform(vpt);
    }
    updateZoomLabel();
    updateDesignInfo();
  }
  function clientToCanvasPoint(clientX, clientY){
    const rect = canvas.upperCanvasEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const inv = fabric.util.invertTransform(canvas.viewportTransform);
    return fabric.util.transformPoint(new fabric.Point(x,y), inv);
  }
  function setupPanAndPinch(){
    const el = canvas.upperCanvasEl;
    let isDragging=false, lastClient={x:0,y:0};
    let pinchActive=false, lastDist=0, lastMid={x:0,y:0};

    canvas.on('mouse:down', (opt)=>{
      const e=opt.e;
      const shouldPan = !isFabricEditing() && (spaceDown || handMode || (!opt.target));
      if(shouldPan && !e.touches){
        isDragging=true; canvas.selection=false; canvas.defaultCursor='grabbing';
        lastClient={x:e.clientX,y:e.clientY};
      }
    });
    canvas.on('mouse:move', (opt)=>{
      if(!isDragging) return;
      const e=opt.e;
      const vpt = canvas.viewportTransform;
      vpt[4] += (e.clientX - lastClient.x);
      vpt[5] += (e.clientY - lastClient.y);
      lastClient={x:e.clientX,y:e.clientY};
      canvas.requestRenderAll();
      updateDesignInfo();
    });
    const endDrag=()=>{ if(isDragging){ isDragging=false; canvas.selection=true; canvas.defaultCursor = (handMode||spaceDown)?'grab':'default'; } };
    canvas.on('mouse:up', endDrag);

    function getDist(touches){ const dx = touches[0].clientX - touches[1].clientX; const dy = touches[0].clientY - touches[1].clientY; return Math.hypot(dx,dy); }
    function getMid(touches){ return { x:(touches[0].clientX + touches[1].clientX)/2, y:(touches[0].clientY + touches[1].clientY)/2 }; }

    el.addEventListener('touchstart', (e)=>{ if(e.touches.length===2){ pinchActive=true; autoCenter=false; lastDist = getDist(e.touches); lastMid  = getMid(e.touches); } }, {passive:false});
    el.addEventListener('touchmove', (e)=>{ if(pinchActive && e.touches.length===2){ e.preventDefault(); const mid = getMid(e.touches); const dist= getDist(e.touches);
      if(lastDist>0){
        const scale = dist / lastDist;
        const newZ  = Math.max(MIN_Z, Math.min(MAX_Z, canvas.getZoom()*scale));
        const midCanvas = clientToCanvasPoint(mid.x, mid.y);
        canvas.zoomToPoint(midCanvas, newZ);
        const vpt = canvas.viewportTransform;
        vpt[4] += (mid.x - lastMid.x);
        vpt[5] += (mid.y - lastMid.y);
        canvas.setViewportTransform(vpt);
        updateZoomLabel();
        updateDesignInfo();
      }
      lastDist = dist; lastMid = mid; } }, {passive:false});
    el.addEventListener('touchend', (e)=>{ if(e.touches.length<2){ pinchActive=false; } }, {passive:false});

    canvas.on('mouse:wheel', (opt)=>{
      let z = canvas.getZoom();
      z *= Math.pow(0.999, opt.e.deltaY);
      z = Math.max(MIN_Z, Math.min(MAX_Z, z));
      const midCanvas = clientToCanvasPoint(opt.e.clientX, opt.e.clientY);
      autoCenter = false;
      canvas.zoomToPoint(midCanvas, z);
      updateZoomLabel();
      updateDesignInfo();
      opt.e.preventDefault(); opt.e.stopPropagation();
    });
  }

  function updateDesignInfo(){
    const ratio = baseW / baseH;
    const near = (a,b,eps=0.003)=> Math.abs(a-b) < eps;
    const isoA = near(ratio, 1/Math.SQRT2) || near(ratio, Math.SQRT2);
    const tag  = isoA ? ' (≈ ISO A 1:√2)' : '';
    const [,,, ,x, y] = canvas.viewportTransform || [1,0,0,1,0,0];
    document.getElementById('designInfo').textContent = `Lienzo: ${baseW}×${baseH}px · relación ${ratio.toFixed(3)}${tag} · origen (${Math.round(x)}, ${Math.round(y)})`;
  }
  function updateSelInfo(){
    const a=canvas.getActiveObject();
    if(!a){ document.getElementById('selInfo').textContent='Selección: —'; return; }
    const w=Math.round(a.getScaledWidth? a.getScaledWidth(): (a.width*(a.scaleX||1)));
    const h=Math.round(a.getScaledHeight? a.getScaledHeight(): (a.height*(a.scaleY||1)));
    const pctW = Math.round((w/baseW)*100), pctH = Math.round((h/baseH)*100);
    document.getElementById('selInfo').textContent=`Selección: ${w}×${h}px (${pctW}%×${pctH}%)`;
  }

  function setAspect(key){
    const {w,h}=ASPECTS[key];
    baseW = w; baseH = h;
    canvas.setWidth(w); canvas.setHeight(h);
    hGuide.set({x1:0,y1:h/2,x2:w,y2:h/2});
    vGuide.set({x1:w/2,y1:0,x2:w/2,y2:h});
    addOrUpdatePaper();
    canvas.requestRenderAll();
    autoCenter = true;
    requestAnimationFrame(() => fitToViewport(true));
    updateDesignInfo();
  }
  const setBg=(color)=>{ if(paperRect){ paperRect.set({ fill: color }); } if(paperShadowRect){ paperShadowRect.set({ fill: color }); } canvas.requestRenderAll(); };

  const duplicateActive=()=>{ const a=canvas.getActiveObject(); if(!a)return; a.clone((c)=>{ c.set({left:(a.left||0)+20, top:(a.top||0)+20}); canvas.add(c); canvas.setActiveObject(c); canvas.requestRenderAll(); }); };
  const bringToFront=()=>{ const o=canvas.getActiveObject(); if(!o)return; o.bringToFront(); hGuide.bringToFront(); vGuide.bringToFront(); canvas.requestRenderAll(); };
  const sendToBack=()=>{ const o=canvas.getActiveObject(); if(!o)return; o.sendToBack(); paperRect && paperRect.sendToBack(); paperShadowRect && paperShadowRect.sendToBack(); canvas.requestRenderAll(); };
  const bringForward=()=>{ const o=canvas.getActiveObject(); if(!o)return; o.bringForward(); canvas.requestRenderAll(); };
  const sendBackwards=()=>{ const o=canvas.getActiveObject(); if(!o)return; o.sendBackwards(); canvas.requestRenderAll(); };
  const removeActive=()=>{ const act=canvas.getActiveObjects(); act.forEach(o=>canvas.remove(o)); canvas.discardActiveObject(); canvas.requestRenderAll(); };

  function currentAlign(){ const a=document.querySelector('.btnAlign.active'); return a?.dataset?.align || 'left'; }
  function addText(){
    const it=new fabric.IText('Doble click para editar',{
      left:baseW/2, top:baseH/2, originX:'center', originY:'center',
      fontFamily:document.getElementById('selFont').value, fontSize:parseInt(document.getElementById('inpSize').value||'64',10),
      fill:document.getElementById('inpColor').value, textAlign:currentAlign(),
      stroke:parseInt(document.getElementById('inpStrokeWidth').value||'0',10)>0?document.getElementById('inpStrokeColor').value:undefined,
      strokeWidth:parseInt(document.getElementById('inpStrokeWidth').value||'0',10)
    });
    canvas.add(it); canvas.setActiveObject(it); canvas.requestRenderAll(); updateSelInfo();
  }
  function applyTextProps(){
    const obj=canvas.getActiveObject(); if(!obj||(obj.type!=='i-text'&&obj.type!=='text'&&obj.type!=='textbox'))return;
    obj.set({
      fontFamily:document.getElementById('selFont').value,
      fontSize:parseInt(document.getElementById('inpSize').value||'64',10),
      fill:document.getElementById('inpColor').value,
      stroke:parseInt(document.getElementById('inpStrokeWidth').value||'0',10)>0?document.getElementById('inpStrokeColor').value:undefined,
      strokeWidth:parseInt(document.getElementById('inpStrokeWidth').value||'0',10),
      textAlign:currentAlign()
    });
    canvas.requestRenderAll(); updateSelInfo();
  }

  function addImage(file){
    const r=new FileReader();
    r.onload=()=>{ fabric.Image.fromURL(r.result,(img)=>{
      const maxW=baseW*0.9, maxH=baseH*0.9;
      const s=Math.min(maxW/img.width, maxH/img.height, 1);
      img.set({left:baseW/2, top:baseH/2, originX:'center', originY:'center', scaleX:s, scaleY:s, cornerStyle:'circle'});
      if(!img.__origSrc) img.__origSrc = r.result;
      canvas.add(img); canvas.setActiveObject(img); canvas.requestRenderAll(); updateSelInfo();
    },{crossOrigin:'anonymous'}); };
    r.readAsDataURL(file);
  }

  // ===== Cropper =====
  let cropper=null, cropTarget=null;
  function parseAspect(v){ if(v==='free') return NaN; if(v.includes('/')){ const [a,b] = v.split('/').map(Number); return (b && !isNaN(a) && !isNaN(b)) ? (a/b) : NaN; } const n = Number(v); return isNaN(n)? NaN : n; }
  function startCrop(){
    const t = canvas.getActiveObject();
    if(!t || t.type!=='image'){ alert('Seleccioná una imagen primero.'); return; }
    cropTarget = t;
    const imgEl = document.getElementById('cropperImage');
    const orig = t.__origSrc || t._originalElement?.src || t.getElement?.().src || t.toDataURL({format:'png'});
    imgEl.src = orig;
    const dlg = document.getElementById('cropModal'); openModal(dlg);
    if (cropper) { cropper.destroy(); cropper = null; }
    cropper = new Cropper(imgEl, { viewMode:1, background:false, autoCrop:true, checkOrientation:false, responsive:true, dragMode:'move', autoCropArea:0.9 });
  }
  document.getElementById('cmClose').onclick = () => { if (cropper) { cropper.destroy(); cropper = null; } closeModal(document.getElementById('cropModal')); };
  document.getElementById('cmZoomIn').onclick  = ()=> cropper && cropper.zoom( 0.1);
  document.getElementById('cmZoomOut').onclick = ()=> cropper && cropper.zoom(-0.1);
  document.getElementById('cmRotate').onclick  = ()=> cropper && cropper.rotate(90);
  document.getElementById('cmReset').onclick   = ()=> cropper && cropper.reset();
  document.getElementById('cropAspect').onchange = (e)=>{ const r = parseAspect(e.target.value); cropper && cropper.setAspectRatio(r); };
  document.getElementById('cmApply').onclick = () => {
    if(!cropper || !cropTarget) return;
    const c = cropper.getCroppedCanvas({ imageSmoothingEnabled:true, imageSmoothingQuality:'high' });
    const dataURL = c.toDataURL('image/png');
    const center = cropTarget.getCenterPoint();
    const angle  = cropTarget.angle || 0;
    const dispW  = cropTarget.getScaledWidth();
    const dispH  = cropTarget.getScaledHeight();
    const idx    = canvas.getObjects().indexOf(cropTarget);
    if(!cropTarget.__origSrc) cropTarget.__origSrc = cropTarget._originalElement?.src || cropTarget.toDataURL({format:'png'});
    canvas.remove(cropTarget);
    fabric.Image.fromURL(dataURL, (img)=>{
      img.__origSrc = dataURL;
      img.set({ originX:'center', originY:'center', left:center.x, top:center.y, angle });
      const sx = dispW / img.width, sy = dispH / img.height;
      img.set({ scaleX:sx, scaleY:sy });
      if(idx >= 0){ canvas.insertAt(img, idx, true); } else { canvas.add(img); }
      canvas.setActiveObject(img); canvas.requestRenderAll();
    }, { crossOrigin:'anonymous' });
    cropTarget = null; cropper.destroy(); cropper = null; closeModal(document.getElementById('cropModal'));
  };

  // ===== Feather helpers =====
  function applyFeatherMaskToActive(px=40, shape='rect'){
    const t = canvas.getActiveObject();
    if(!t || t.type!=='image'){ alert('Seleccioná una imagen primero.'); return; }
    const src = t.__origSrc || t._originalElement?.src || t.toDataURL({format:'png'});
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      const res = document.createElement('canvas'); res.width=w; res.height=h;
      const rx = res.getContext('2d'); rx.imageSmoothingEnabled = true; rx.imageSmoothingQuality='high';
      rx.drawImage(img, 0, 0, w, h);
      const mask = document.createElement('canvas'); mask.width=w; mask.height=h;
      const mx = mask.getContext('2d'); mx.imageSmoothingEnabled = true; mx.imageSmoothingQuality='high';
      mx.fillStyle = '#fff'; mx.fillRect(0,0,w,h);
      if(px > 0){
        if(shape === 'circle'){
          const rMax = Math.min(w,h)/2;
          const rInner = Math.max(0, rMax - px);
          const cx = w/2, cy = h/2;
          const g = mx.createRadialGradient(cx,cy,rInner, cx,cy,rMax);
          g.addColorStop(0, 'rgba(255,255,255,1)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          mx.globalCompositeOperation = 'destination-in';
          mx.fillStyle = g;
          mx.beginPath(); mx.arc(cx,cy,rMax,0,Math.PI*2); mx.closePath(); mx.fill();
        } else {
          mx.globalCompositeOperation = 'destination-out';
          let g = mx.createLinearGradient(0,0,px,0);
          g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          mx.fillStyle = g; mx.fillRect(0,0,px,h);
          g = mx.createLinearGradient(w,0,w-px,0);
          g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          mx.fillStyle = g; mx.fillRect(w-px,0,px,h);
          g = mx.createLinearGradient(0,0,0,px);
          g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          mx.fillStyle = g; mx.fillRect(0,0,w,px);
          g = mx.createLinearGradient(0,h,0,h-px);
          g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          mx.fillStyle = g; mx.fillRect(0,h-px,w,px);
        }
      }
      rx.globalCompositeOperation = 'destination-in';
      rx.drawImage(mask, 0, 0);
      const dataURL = res.toDataURL('image/png');
      const center = t.getCenterPoint();
      const angle  = t.angle || 0;
      const dispW  = t.getScaledWidth();
      const dispH  = t.getScaledHeight();
      const idx    = canvas.getObjects().indexOf(t);
      if(!t.__origSrc) t.__origSrc = src;
      canvas.remove(t);
      fabric.Image.fromURL(dataURL, (img2)=>{
        img2.__origSrc = src;
        img2.__maskedSrc = dataURL;
        img2.set({ originX:'center', originY:'center', left:center.x, top:center.y, angle });
        const sx = dispW / img2.width, sy = dispH / img2.height;
        img2.set({ scaleX:sx, scaleY:sy });
        if(idx >= 0){ canvas.insertAt(img2, idx, true); } else { canvas.add(img2); }
        canvas.setActiveObject(img2); canvas.requestRenderAll();
      }, { crossOrigin:'anonymous' });
    };
    img.onerror = () => alert('No se pudo cargar la imagen para enmascarar.');
    img.src = src;
  }
  function removeFeatherMaskFromActive(){
    const t = canvas.getActiveObject();
    if(!t || t.type!=='image'){ alert('Seleccioná una imagen primero.'); return; }
    const src = t.__origSrc || t._originalElement?.src;
    if(!src){ alert('No hay original guardado para restaurar.'); return; }
    const center = t.getCenterPoint();
    const angle  = t.angle || 0;
    const dispW  = t.getScaledWidth();
    const dispH  = t.getScaledHeight();
    const idx    = canvas.getObjects().indexOf(t);
    canvas.remove(t);
    fabric.Image.fromURL(src, (img)=>{
      img.__origSrc = src;
      img.set({ originX:'center', originY:'center', left:center.x, top:center.y, angle });
      const sx = dispW / img.width, sy = dispH / img.height;
      img.set({ scaleX:sx, scaleY:sy });
      if(idx >= 0){ canvas.insertAt(img, idx, true); } else { canvas.add(img); }
      canvas.setActiveObject(img); canvas.requestRenderAll();
    }, { crossOrigin:'anonymous' });
  }

  // ===== Vignette (opcional) =====
  function hexToRgba(hex,a){ hex=hex.replace('#',''); if(hex.length===3){ hex=hex.split('').map(c=>c+c).join(''); } const n=parseInt(hex,16); const r=(n>>16)&255,g=(n>>8)&255,b=n&255; return `rgba(${r},${g},${b},${a})`; }
  function addOrUpdateVignette(color,strength){
    const rMax=Math.max(baseW,baseH)*0.75, rInner=Math.min(baseW,baseH)*0.25;
    const gradient=new fabric.Gradient({type:'radial',coords:{x1:baseW/2,y1:baseH/2,r1:rInner,x2:baseW/2,y2:baseH/2,r2:rMax},
      colorStops:[{offset:0,color:hexToRgba(color,0)},{offset:1,color:hexToRgba(color,Math.min(0.9,strength))}]});
    if(!vignetteRect){
      vignetteRect=new fabric.Rect({left:0,top:0,originX:'left',originY:'top',width:baseW,height:baseH,fill:gradient,selectable:false,evented:false});
      canvas.add(vignetteRect);
    } else {
      vignetteRect.set({left:0,top:0,width:baseW,height:baseH,fill:gradient});
      vignetteRect.setCoords();
    }
    orderBackground(); canvas.requestRenderAll();
  }
  function removeVignette(){ if(vignetteRect){ canvas.remove(vignetteRect); vignetteRect=null; canvas.requestRenderAll(); } }

  // ===== Export helpers =====
  function withNeutralVPT(fn){
    const prev = (canvas.viewportTransform || [1,0,0,1,0,0]).slice();
    canvas.setViewportTransform([1,0,0,1,0,0]);
    const out = fn();
    canvas.setViewportTransform(prev);
    return out;
  }
  function getScaleMultiplier(){
    const elM = document.getElementById('selScaleM');
    if(elM) return parseInt(elM.value || '2', 10);
    const el = document.getElementById('selScale');
    return parseInt((el && el.value) || '2', 10);
  }
  function isMono(){
    const cM = document.getElementById('chkMonoM');
    if(cM) return !!cM.checked;
    const c = document.getElementById('chkMono');
    return !!(c && c.checked);
  }
  function toGray(dataURL){
    return new Promise((ok,ko)=>{
      const img=new Image();
      img.onload=()=>{ const c=document.createElement('canvas'); c.width=img.width; c.height=img.height; const x=c.getContext('2d'); x.drawImage(img,0,0);
        const d=x.getImageData(0,0,c.width,c.height); const a=d.data;
        for(let i=0;i<a.length;i+=4){ const y=0.2126*a[i]+0.7152*a[i+1]+0.0722*a[i+2]; a[i]=a[i+1]=a[i+2]=y; }
        x.putImageData(d,0,0); ok(c.toDataURL('image/png')); }; img.onerror=ko; img.src=dataURL; });
  }

  async function exportPNG(){
    const mult = getScaleMultiplier();
    const data = withNeutralVPT(()=> canvas.toDataURL({ format:'png', left:0, top:0, width:baseW, height:baseH, multiplier:mult }));
    const out = isMono() ? await toGray(data) : data;
    const a=document.createElement('a'); a.href=out; a.download='diseño.png'; a.click();
  }
  async function exportPDF(){
    const mult = getScaleMultiplier();
    const data = withNeutralVPT(()=> canvas.toDataURL({ format:'png', left:0, top:0, width:baseW, height:baseH, multiplier:mult }));
    const out = isMono() ? await toGray(data) : data;
    const { jsPDF } = window.jspdf;
    const w = baseW * mult, h = baseH * mult;
    const pdf = new jsPDF({ unit: 'px', format: [w, h], orientation: (w >= h ? 'landscape' : 'portrait'), compress: true });
    pdf.addImage(out, 'JPEG', 0, 0, w, h, undefined, 'MEDIUM', 0.8);
    pdf.save('diseño.pdf');
  }

  // ===== Imprimir múltiple (auto layout + hints) =====
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
    const P = planLayout(format, 'portrait',  margin, copyW, imgRatio);
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
        row.parentElement.insertBefore(el, row.nextElementSibling); // justo debajo de la fila "Ancho / Copias"
      } else {
        (document.getElementById('rightPanel') || document.body).appendChild(el);
      }
    }
    return el;
  }
  function formatN(n, d=1) { return Number.isFinite(n) ? n.toFixed(d) : '—'; }
  function updatePrintHints() {
    const page = (document.getElementById('selPage')?.value) || 'a4';
    const userMargin = parseFloat(document.getElementById('inpMargin')?.value || '0');
    const MIN_MARGIN_MM = 3;
    const margin = (isNaN(userMargin) || userMargin <= 0) ? MIN_MARGIN_MM : userMargin;

    const copyW = parseFloat(document.getElementById('inpCopyW')?.value || '80');
    if (!Number.isFinite(copyW) || copyW <= 0) return;

    const imgRatio = baseH / baseW;
    const best = computeBestLayout(page, margin, copyW, imgRatio);
    const alt  = (best.orientation === 'landscape') ? planLayout(page, 'portrait',  margin, copyW, imgRatio)
                                                    : planLayout(page, 'landscape', margin, copyW, imgRatio);

    const hintsEl = ensurePrintHintsEl();
    const colsTargets = [2,3,4];
    const maxWForCols = colsTargets.map(n => {
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
        ${maxWForCols.map(s => `• ${s.n} columnas → ancho ≤ <strong>${formatN(s.w)}</strong> mm`).join('<br>')}
      </div>
    `;
  }

  async function printSheet(){
    const page = document.getElementById('selPage').value || 'a4';
    const userMargin = parseFloat(document.getElementById('inpMargin').value || '0');
    const MIN_MARGIN_MM = 3;
    const margin = (isNaN(userMargin) || userMargin <= 0) ? MIN_MARGIN_MM : userMargin;

    const copyW = parseFloat(document.getElementById('inpCopyW').value || '80');
    let copies  = parseInt(document.getElementById('inpCopies').value || '1', 10);
    if (!Number.isFinite(copyW) || copyW <= 0 || !Number.isFinite(copies) || copies <= 0) {
      alert('Parámetros no válidos.');
      return;
    }

    const mult = getScaleMultiplier();
    const data = withNeutralVPT(()=> canvas.toDataURL({ format:'png', left:0, top:0, width:baseW, height:baseH, multiplier:mult }));
    const out  = isMono() ? await toGray(data) : data;

    const imgRatio = baseH / baseW;
    const best = computeBestLayout(page, margin, copyW, imgRatio);
    if (best.total === 0) {
      alert('Con ese ancho y margen no entra ninguna copia en la hoja. Probá reducir el ancho o el margen.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit:'mm', format: page, orientation: best.orientation });

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

  // ===== Alinear en lienzo =====
  function alignCanvas(where){
    const o = canvas.getActiveObject();
    if (!o) return;
    o.setCoords();
    const br = o.getBoundingRect(true);

    let dx = 0, dy = 0;
    if (where === 'left')      dx = 0 - br.left;
    if (where === 'centerH')   dx = (baseW/2) - (br.left + br.width/2);
    if (where === 'right')     dx = baseW - (br.left + br.width);
    if (where === 'top')       dy = 0 - br.top;
    if (where === 'centerV')   dy = (baseH/2) - (br.top + br.height/2);
    if (where === 'bottom')    dy = baseH - (br.top + br.height);

    o.left = Math.round((o.left || 0) + dx);
    o.top  = Math.round((o.top  || 0) + dy);
    o.setCoords();
    canvas.requestRenderAll();
    updateSelInfo();
  }

  // ===== QR =====
  async function ensureQRLib(){
    if (window.QRCode || window.qrcode) return true;
    const urls = [
      'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
      'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js'
    ];
    for(const u of urls){
      try{
        await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=u; s.onload=()=>res(); s.onerror=()=>rej(); document.head.appendChild(s); });
        if(window.QRCode||window.qrcode) return true;
      }catch(e){}
    }
    return false;
  }
  function createQRDataURL(text, size=512, cb){
    if (window.QRCode && window.QRCode.toDataURL){
      window.QRCode.toDataURL(text, { width: size, margin: 1 }, cb);
    } else if (window.qrcode){
      try{ const qr=window.qrcode(0,'M'); qr.addData(text); qr.make(); const url=qr.createDataURL(8); cb(null,url); }catch(e){ cb(e); }
    } else { cb(new Error('Sin librería QR')); }
  }
  async function makeQR(url){
    const ok=await ensureQRLib();
    if(!ok){ alert('No se pudo cargar la librería de QR.'); return; }
    createQRDataURL(url,512,(err,d)=>{
      if(err||!d){ console.error('QR error:',err); alert('No se pudo generar el QR'); return; }
      fabric.Image.fromURL(d,(img)=>{ img.set({left:baseW/2, top:baseH/2, originX:'center', originY:'center', scaleX:.5, scaleY:.5}); canvas.add(img); canvas.setActiveObject(img); canvas.requestRenderAll(); updateSelInfo(); });
    });
  }

  // ===== Recuadros =====
  function addRect(){
    const w = Math.round(baseW * 0.45);
    const h = Math.round(baseH * 0.28);
    const fill   = (document.getElementById('shapeFill')?.value) || '#ffffff';
    const stroke = (document.getElementById('shapeStrokeColor')?.value) || '#111827';
    const sw     = parseFloat(document.getElementById('shapeStrokeWidth')?.value || '2') || 0;
    const r      = parseInt(document.getElementById('shapeCorner')?.value || '12',10) || 0;

    const rect = new fabric.Rect({
      left: baseW/2, top: baseH/2, originX:'center', originY:'center',
      width: w, height: h, rx: r, ry: r,
      fill, stroke, strokeWidth: sw,
      cornerStyle: 'circle'
    });
    canvas.add(rect); canvas.setActiveObject(rect);
    canvas.requestRenderAll();
  }
  function applyShapeProps(){
    const o = canvas.getActiveObject();
    if(!o || o.type !== 'rect') return;
    const fill   = (document.getElementById('shapeFill')?.value) || '#ffffff';
    const stroke = (document.getElementById('shapeStrokeColor')?.value) || '#111827';
    const sw     = parseFloat(document.getElementById('shapeStrokeWidth')?.value || '2') || 0;
    const r      = parseInt(document.getElementById('shapeCorner')?.value || '12',10) || 0;
    o.set({ fill, stroke, strokeWidth: sw, rx: r, ry: r });
    canvas.requestRenderAll();
  }
  function syncShapeControlsFromSelection(){
    const o = canvas.getActiveObject();
    if(!o || o.type !== 'rect') return;
    const fillEl   = document.getElementById('shapeFill');
    const strokeEl = document.getElementById('shapeStrokeColor');
    const swEl     = document.getElementById('shapeStrokeWidth');
    const rEl      = document.getElementById('shapeCorner');
    if(fillEl)   try{ fillEl.value   = fabric.Color.fromHex(o.fill || '#ffffff').toHex(); }catch{ fillEl.value = '#ffffff'; }
    if(strokeEl) try{ strokeEl.value = fabric.Color.fromHex(o.stroke || '#111827').toHex(); }catch{ strokeEl.value = '#111827'; }
    if(swEl)     swEl.value     = (o.strokeWidth ?? 0);
    if(rEl)      rEl.value      = (o.rx ?? 0);
  }

  // ===== Mobile Dock con pestañas =====
  let isMobileUI = false;
  let leftPH, rightPH;
  function buildMobileDockOnce(){
    const dock = document.getElementById('mobileDock');
    if (!dock || dock.dataset.ready === '1') return;
    dock.dataset.ready = '1';
    dock.innerHTML = `
      <div class="md-tabs">
        <button type="button" class="md-tab" data-tab="tools">Herramientas</button>
        <button type="button" class="md-tab" data-tab="help">Ayuda</button>
      </div>
      <div class="md-panels">
        <div class="md-panel" id="md-tools"></div>
        <div class="md-panel" id="md-help"></div>
      </div>
    `;
    const tabs = dock.querySelectorAll('.md-tab');
    tabs.forEach(btn=> btn.addEventListener('click', ()=> switchMobileTab(btn.dataset.tab)));
  }
  function switchMobileTab(which='tools'){
    const dock = document.getElementById('mobileDock');
    if (!dock || !isMobileUI) return;
    dock.querySelectorAll('.md-tab').forEach(b=> b.classList.toggle('active', b.dataset.tab===which));
    dock.querySelectorAll('.md-panel').forEach(p=> p.classList.toggle('active', (p.id === (which==='tools'?'md-tools':'md-help'))));
    if (typeof fitToViewport === 'function') requestAnimationFrame(()=>fitToViewport());
  }
  function enterMobileDock(){
    if (isMobileUI) return;
    const left = document.getElementById('leftPanel');
    const right = document.getElementById('rightPanel');
    const dock = document.getElementById('mobileDock');
    if (!left || !right || !dock) return;

    buildMobileDockOnce();
    if (!leftPH){ leftPH = document.createElement('div'); leftPH.id = 'leftPH'; left.parentNode.insertBefore(leftPH, left); }
    if (!rightPH){ rightPH = document.createElement('div'); rightPH.id = 'rightPH'; right.parentNode.insertBefore(rightPH, right); }

    dock.style.display = '';
    dock.querySelector('#md-tools').appendChild(left);
    dock.querySelector('#md-help').appendChild(right);

    switchMobileTab('tools');
    document.body.classList.add('mobile-docked');
    isMobileUI = true;
    requestAnimationFrame(()=>fitToViewport());
  }
  function exitMobileDock(){
    if (!isMobileUI) return;
    const left = document.getElementById('leftPanel');
    const right = document.getElementById('rightPanel');
    const dock = document.getElementById('mobileDock');
    if (leftPH && left)  leftPH.parentNode.insertBefore(left, leftPH);
    if (rightPH && right) rightPH.parentNode.insertBefore(right, rightPH);
    if (dock) dock.style.display = 'none';
    document.body.classList.remove('mobile-docked');
    isMobileUI = false;
    requestAnimationFrame(()=>fitToViewport());
  }
  function handleResponsivePanels(){
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    if (mobile) enterMobileDock(); else exitMobileDock();
    requestAnimationFrame(()=>fitToViewport(true));
  }
  function overrideOpenersForMobile(){
    const btnOpenTools = document.getElementById('btnOpenTools');
    const btnCloseTools = document.getElementById('btnCloseTools');
    const btnOpenHelp = document.getElementById('btnOpenHelp');
    const btnCloseHelp = document.getElementById('btnCloseHelp');

    const toTools = (e)=>{ if(isMobileUI){ e.preventDefault(); switchMobileTab('tools'); } };
    const toHelp  = (e)=>{ if(isMobileUI){ e.preventDefault(); switchMobileTab('help'); } };

    btnOpenTools?.addEventListener('click', toTools);
    btnCloseTools?.addEventListener('click', toTools);
    btnOpenHelp?.addEventListener('click', toHelp);
    btnCloseHelp?.addEventListener('click', toHelp);
  }

  // ===== DOMContentLoaded =====
  window.addEventListener('DOMContentLoaded', async ()=>{
    setHeaderHeight();
    injectGoogleFonts();
    populateFontSelect();
    buildFontPicker();

    initCanvas();
    toggleDeskBar(mq);

    // Formato
    document.getElementById('selAspect').addEventListener('change',(e)=> setAspect(e.target.value));
    document.getElementById('inpBg').addEventListener('input',(e)=> setBg(e.target.value));
    document.getElementById('btnNew').addEventListener('click', ()=>{
      canvas.getObjects().slice().forEach(o=>{
        if(o!==hGuide && o!==vGuide && o!==paperRect && o!==paperShadowRect) canvas.remove(o);
      });
      if(vignetteRect){ canvas.add(vignetteRect); }
      orderBackground();
      canvas.discardActiveObject(); canvas.requestRenderAll(); updateSelInfo();
      autoCenter = true;
      requestAnimationFrame(() => fitToViewport(true));
    });

    // Texto
    document.getElementById('btnText').addEventListener('click', addText);
    document.getElementById('fileImg').addEventListener('change',(e)=>{ const f=e.target.files&&e.target.files[0]; if(f) addImage(f); e.target.value=''; });
    document.querySelectorAll('.btnAlign').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('.btnAlign').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active'); btn.blur();
      });
    });
    document.getElementById('btnApplyText').addEventListener('click', applyTextProps);
    const selFont = document.getElementById('selFont');
    if (selFont){
      selFont.addEventListener('change', async (e)=>{
        const family = e.target.value;
        await ensureFontLoaded(family);
        const obj = canvas.getActiveObject();
        if (obj && (obj.type==='i-text' || obj.type==='text' || obj.type==='textbox')){
          obj.set('fontFamily', family);
          canvas.requestRenderAll();
        }
      });
    }

    // Cropper & feather
    document.getElementById('btnStartCrop').addEventListener('click', startCrop);
    const featherInput = document.getElementById('featherPx');
    const featherVal = document.getElementById('featherVal');
    featherInput.addEventListener('input', ()=> featherVal.textContent = featherInput.value + ' px');
    document.getElementById('btnApplyFeather').addEventListener('click', ()=> applyFeatherMaskToActive(parseInt(featherInput.value,10)||0, document.getElementById('featherShape').value));
    document.getElementById('btnRemoveFeather').addEventListener('click', removeFeatherMaskFromActive);

    // Capas
    document.getElementById('btnFront').addEventListener('click', bringToFront);
    document.getElementById('btnBack').addEventListener('click', sendToBack);
    document.getElementById('btnFwd').addEventListener('click', bringForward);
    document.getElementById('btnBwd').addEventListener('click', sendBackwards);
    document.getElementById('btnDup').addEventListener('click', duplicateActive);
    document.getElementById('btnDel').addEventListener('click', removeActive);

    // Alinear
    document.getElementById('alignLeft').addEventListener('click', ()=>alignCanvas('left'));
    document.getElementById('alignCenterH').addEventListener('click', ()=>alignCanvas('centerH'));
    document.getElementById('alignRight').addEventListener('click', ()=>alignCanvas('right'));
    document.getElementById('alignTop').addEventListener('click', ()=>alignCanvas('top'));
    document.getElementById('alignCenterV').addEventListener('click', ()=>alignCanvas('centerV'));
    document.getElementById('alignBottom').addEventListener('click', ()=>alignCanvas('bottom'));
    document.getElementById('chkGuides').addEventListener('change', (e)=>{ showGuides=e.target.checked; if(!showGuides){ hGuide.visible=false; vGuide.visible=false; canvas.requestRenderAll(); } });

    // Export/print
    document.getElementById('btnPNG').addEventListener('click', exportPNG);
    document.getElementById('btnPDF').addEventListener('click', exportPDF);
    document.getElementById('btnPrintSheet').addEventListener('click', printSheet);

    // Hints de impresión en vivo
    const hookPrintHints = () => {
      ['inpCopyW','inpMargin','selPage','inpCopies'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const evt = (el.tagName === 'SELECT') ? 'change' : 'input';
        el.addEventListener(evt, updatePrintHints);
      });
      updatePrintHints();
    };
    hookPrintHints();

    // QR
    document.getElementById('btnMakeWA').addEventListener('click', ()=>{
      const phone=(document.getElementById('waPhone')?.value||'').replace(/\D/g,''); const text=encodeURIComponent(document.getElementById('waMsg')?.value||'');
      if(!phone){ alert('Ingresá el teléfono (formato internacional sin +)'); return; }
      const url=`https://wa.me/${phone}${text?`?text=${text}`:''}`; makeQR(url);
    });
    document.getElementById('btnMakeURL').addEventListener('click', ()=>{
      const url=(document.getElementById('inURL')?.value||'').trim() || 'https://example.com'; makeQR(url);
    });

    // Recuadros
    document.getElementById('btnRect')?.addEventListener('click', addRect);
    document.getElementById('btnApplyShape')?.addEventListener('click', applyShapeProps);
    ['shapeFill','shapeStrokeColor','shapeStrokeWidth','shapeCorner'].forEach(id=>{
      const el = document.getElementById(id);
      el?.addEventListener('input', () => {
        const o = canvas.getActiveObject();
        if (!o || o.type !== 'rect') return;
        applyShapeProps();
      });
    });

    // HUD zoom
    document.getElementById('btnZoomInHUD').addEventListener('click', ()=> zoomTo(canvas.getZoom()*1.1));
    document.getElementById('btnZoomOutHUD').addEventListener('click', ()=> zoomTo(canvas.getZoom()/1.1));
    document.getElementById('btnZoomResetHUD').addEventListener('click', ()=> zoomTo(1, null, true));
    document.getElementById('btnZoomFitHUD').addEventListener('click', ()=> { autoCenter=true; fitToViewport(); });
    document.getElementById('btnHandHUD').addEventListener('click', ()=> { handMode = !handMode; canvas.skipTargetFind = handMode; canvas.defaultCursor = handMode ? 'grab' : 'default'; document.getElementById('btnHandHUD').classList.toggle('active', handMode); });

    // Fit inicial + cambios de tamaño de contenedor
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(()=> { if(autoCenter) fitToViewport(true); });
      ro.observe(document.getElementById('viewport'));
    } else {
      window.addEventListener('resize', ()=>{ if(autoCenter) fitToViewport(true); });
    }
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        autoCenter = true;
        fitToViewport(true); // asegura scroll al tope
      })
    );

    // Dock móvil
    handleResponsivePanels();
    overrideOpenersForMobile();
    window.addEventListener('resize', handleResponsivePanels);
  });

  // Exponer canvas
  window.__miniCanva = { get canvas(){ return canvas; } };
})();
