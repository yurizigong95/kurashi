/* くらしの手帳：写真・PDFを大きくして見る画面（指2本で拡大・縮小、2回たたくと拡大、ボタンでも）
   ============================================================================
   zoomOpen(items, at, title) … items は [{ src }（写真のデータ）|{ pid }（保存した写真）|{ pdf:pid, page }] のならび。
   ・PDF のページは、その場で細かい絵にしてから出す（拡大しても字がつぶれにくいように）。
   ・何枚もあるときは ‹ › か、拡大していないときに左右にはらうと、となりへ。 */
var ZV = { el:null, items:[], at:0, title:'', s:1, x:0, y:0, fit:1, nw:0, nh:0, ok:false,
           pts:{}, pinch:null, pan:null, tap:null, lastTap:null, tapTimer:null, seq:0, pdf:null, urls:{} };
var ZV_MAX = 6;                  /* いちばん大きくするとき（画面に合わせた大きさの何倍まで） */

function zoomOpen(items, at, title){
  items = (items || []).filter(function(it){ return it && (it.src || it.pid || it.pdf); });
  if(!items.length) return;
  zvBuild();
  ZV.items = items; ZV.at = Math.max(0, Math.min(items.length - 1, toNum(at) || 0)); ZV.title = String(title || '');
  ZV.el.classList.add('on');
  document.documentElement.classList.add('zv-on');
  zvShow();
}
/* 1枚の写真だけ */
function zoomPhoto(src, title){ zoomOpen([{ src:src }], 0, title); }
/* 保存したPDFを、ページごとに見る */
function zoomPdf(pid, page, title){
  zoomOpen([{ pdf:pid, page:Math.max(1, toNum(page) || 1) }], 0, title);
}
/* 押した写真と、そのとなりにならんでいる写真（同じ入れものの中）をまとめて見る */
function zoomFromEl(img, title){
  if(!img) return;
  var box = img.closest('.mphotos, .evthumbs, .sv-bd') || img.parentElement;
  var act = img.getAttribute('data-act');
  var sel = act ? 'img[data-act="' + act + '"]' : img.hasAttribute('data-sv') ? 'img[data-sv="zoom"]' : 'img';
  var list = box ? Array.prototype.slice.call(box.querySelectorAll(sel)) : [img];
  if(list.indexOf(img) < 0) list = [img];
  var items = list.map(function(el){
    var pid = el.getAttribute('data-id') || el.getAttribute('data-pid');
    return pid ? { pid:pid, alt:el.getAttribute('alt') || '' } : { src:el.getAttribute('src'), alt:el.getAttribute('alt') || '' };
  });
  zoomOpen(items, list.indexOf(img), title);
}
function zoomClose(){
  if(!ZV.el) return;
  ZV.el.classList.remove('on');
  document.documentElement.classList.remove('zv-on');
  ZV.seq++;
  clearTimeout(ZV.tapTimer);
  ZV.pts = {}; ZV.pinch = null; ZV.pan = null;
  var img = ZV.el.querySelector('.zv-img');
  img.removeAttribute('src');
  Object.keys(ZV.urls).forEach(function(k){ try{ URL.revokeObjectURL(ZV.urls[k]); }catch(e){} });
  ZV.urls = {};
  if(ZV.pdf && ZV.pdf.doc && ZV.pdf.doc.destroy) try{ ZV.pdf.doc.destroy(); }catch(e){}
  ZV.pdf = null;
}
function zoomIsOpen(){ return !!(ZV.el && ZV.el.classList.contains('on')); }

/* ===== 画面を作る（はじめて開いたときに1回） ===== */
function zvBuild(){
  if(ZV.el) return;
  var el = document.createElement('div');
  el.id = 'zview';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '大きくして見る');
  el.innerHTML = '<div class="zv-hd"><div class="zv-ttl"></div><div class="zv-no"></div>' +
      '<button type="button" class="zv-close" data-zv="close">とじる</button></div>' +
    '<div class="zv-stage"><img class="zv-img" alt="" draggable="false"><div class="zv-msg"></div>' +
      '<div class="zv-tip">指2本で広げると大きくなります・2回たたいても拡大</div></div>' +
    '<div class="zv-bar">' +
      '<button type="button" data-zv="prev" aria-label="前へ">‹</button>' +
      '<button type="button" data-zv="out" aria-label="小さく">－</button>' +
      '<button type="button" data-zv="fit" class="zv-pct" aria-label="画面に合わせる">100%</button>' +
      '<button type="button" data-zv="in" aria-label="大きく">＋</button>' +
      '<button type="button" data-zv="next" aria-label="次へ">›</button>' +
    '</div>';
  document.body.appendChild(el);
  ZV.el = el;
  el.addEventListener('click', function(e){
    var b = e.target.closest('[data-zv]');
    if(!b) return;
    e.stopPropagation();
    var k = b.getAttribute('data-zv');
    if(k === 'close') zoomClose();
    else if(k === 'prev') zvGo(-1);
    else if(k === 'next') zvGo(1);
    else if(k === 'in') zvZoomBy(1.6);
    else if(k === 'out') zvZoomBy(1 / 1.6);
    else if(k === 'fit') zvReset();
  });
  var st = el.querySelector('.zv-stage');
  st.addEventListener('pointerdown', zvDown);
  st.addEventListener('pointermove', zvMove);
  st.addEventListener('pointerup', zvUp);
  st.addEventListener('pointercancel', zvUp);
  st.addEventListener('wheel', function(e){
    if(!ZV.ok) return;
    e.preventDefault();
    var r = st.getBoundingClientRect();
    zvZoomAt(ZV.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), e.clientX - r.left, e.clientY - r.top);
  }, { passive:false });
  /* iPhone の画面ごとの拡大を止める（この画面の中で拡大する） */
  ['gesturestart', 'gesturechange', 'touchmove'].forEach(function(n){
    st.addEventListener(n, function(e){ e.preventDefault(); }, { passive:false });
  });
  document.addEventListener('keydown', function(e){
    if(!zoomIsOpen()) return;
    var k = e.key;
    if(k === 'Escape'){ zoomClose(); }
    else if(k === 'ArrowLeft'){ zvGo(-1); }
    else if(k === 'ArrowRight'){ zvGo(1); }
    else if(k === '+' || k === '='){ zvZoomBy(1.6); }
    else if(k === '-'){ zvZoomBy(1 / 1.6); }
    else if(k === '0'){ zvReset(); }
    else return;
    e.preventDefault(); e.stopPropagation();
  }, true);
  window.addEventListener('resize', function(){ if(zoomIsOpen() && ZV.ok){ var was = ZV.s <= ZV.fit * 1.01; zvMeasure(); if(was) zvReset(); else zvApply(); } });
}

/* ===== いまの1枚を出す ===== */
function zvItemCount(){
  var it = ZV.items[0];
  return (ZV.items.length === 1 && it && it.pdf && ZV.pdf) ? ZV.pdf.numPages : ZV.items.length;
}
function zvHead(){
  var n = zvItemCount(), no = (ZV.items.length === 1 && ZV.items[0].pdf) ? (ZV.items[0].page || 1) : ZV.at + 1;
  ZV.el.querySelector('.zv-ttl').textContent = ZV.title;
  ZV.el.querySelector('.zv-no').textContent = n > 1 ? no + ' / ' + n : '';
  ZV.el.querySelector('[data-zv="prev"]').disabled = !(n > 1 && no > 1);
  ZV.el.querySelector('[data-zv="next"]').disabled = !(n > 1 && no < n);
  ZV.el.classList.toggle('zv-one', n <= 1);
}
function zvMsg(t){
  var m = ZV.el.querySelector('.zv-msg');
  m.textContent = t || '';
  m.style.display = t ? '' : 'none';
}
async function zvShow(){
  var seq = ++ZV.seq, it = ZV.items[ZV.at], img = ZV.el.querySelector('.zv-img');
  ZV.ok = false;
  img.style.visibility = 'hidden';
  zvHead();
  zvMsg('ひらいています…');
  var src = null;
  try{
    if(it.src) src = it.src;
    else if(it.pid){
      src = await photoGet(it.pid);
      if(!src){ if(seq === ZV.seq) zvMsg('この写真は、まだこの端末に届いていません（写真を入れた端末で、くらしの手帳を開くと送られます）'); return; }
    }else if(it.pdf){
      src = await zvPdfPage(it.pdf, it.page || 1, seq);
      if(seq !== ZV.seq) return;
      zvHead();
    }
  }catch(e){
    if(seq === ZV.seq) zvMsg('ひらけませんでした：' + ((e && e.message) || e));
    return;
  }
  if(seq !== ZV.seq || !src) return;
  img.onload = function(){
    if(seq !== ZV.seq) return;
    ZV.nw = img.naturalWidth || 1; ZV.nh = img.naturalHeight || 1;
    img.style.width = ZV.nw + 'px'; img.style.height = ZV.nh + 'px';
    zvMeasure(); zvReset();
    img.style.visibility = '';
    zvMsg('');
    ZV.ok = true;
  };
  img.onerror = function(){ if(seq === ZV.seq) zvMsg('ひらけませんでした'); };
  img.alt = it.alt || ZV.title || '写真';
  img.src = src;
}
function zvGo(d){
  var it = ZV.items[0];
  if(ZV.items.length === 1 && it && it.pdf){
    var n = ZV.pdf ? ZV.pdf.numPages : 1, p = (it.page || 1) + d;
    if(p < 1 || p > n) return;
    it.page = p; zvShow(); return;
  }
  var at = ZV.at + d;
  if(at < 0 || at >= ZV.items.length) return;
  ZV.at = at; zvShow();
}

/* ===== PDF のページを、細かい絵にする ===== */
async function zvPdfPage(pid, page, seq){
  if(!ZV.pdf || ZV.pdf.pid !== pid){
    var data = await photoGet(pid);
    if(!data) throw new Error('このPDFは、まだこの端末に届いていません');
    var lib = await loadPdfJs();
    var doc = await lib.getDocument({ data:dataUrlToBytes(data) }).promise;
    ZV.pdf = { pid:pid, doc:doc, numPages:doc.numPages };
  }
  page = Math.max(1, Math.min(ZV.pdf.numPages, page));
  var key = pid + '#' + page;
  if(ZV.urls[key]) return ZV.urls[key];
  var pg = await ZV.pdf.doc.getPage(page);
  if(seq !== ZV.seq) return null;
  var vp1 = pg.getViewport({ scale:1 });
  var st = ZV.el.querySelector('.zv-stage');
  var dpr = Math.min(3, window.devicePixelRatio || 1);
  /* 画面に合わせた大きさの、だいたい3倍の細かさ（大きすぎると端末がこまるので、長い辺は4096まで） */
  var longSide = Math.min(4096, Math.max(1200, Math.max(st.clientWidth, st.clientHeight) * dpr * 3));
  var r = longSide / Math.max(vp1.width, vp1.height);
  var vp = pg.getViewport({ scale:r });
  var cv = document.createElement('canvas');
  cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  var ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  await pg.render({ canvasContext:ctx, viewport:vp }).promise;
  var url = await new Promise(function(res){
    if(cv.toBlob) cv.toBlob(function(b){ res(b ? URL.createObjectURL(b) : cv.toDataURL('image/jpeg', 0.92)); }, 'image/jpeg', 0.92);
    else res(cv.toDataURL('image/jpeg', 0.92));
  });
  cv.width = cv.height = 0;                       /* 絵にしたら、すぐに入れものを空ける（端末のメモリのため） */
  /* 覚えておくのは近くの3ページまで */
  var keys = Object.keys(ZV.urls);
  if(keys.length >= 3) keys.slice(0, keys.length - 2).forEach(function(k){ try{ URL.revokeObjectURL(ZV.urls[k]); }catch(e){} delete ZV.urls[k]; });
  ZV.urls[key] = url;
  return url;
}

/* ===== 大きさと場所 ===== */
function zvStage(){ var st = ZV.el.querySelector('.zv-stage'); return { w:st.clientWidth || 1, h:st.clientHeight || 1 }; }
function zvMeasure(){
  var b = zvStage();
  ZV.fit = Math.min(b.w / ZV.nw, b.h / ZV.nh, 3);
}
function zvMaxS(){ return Math.max(ZV.fit * ZV_MAX, 1.5); }
function zvClamp(){
  var b = zvStage(), cw = ZV.nw * ZV.s, ch = ZV.nh * ZV.s;
  ZV.x = cw <= b.w ? (b.w - cw) / 2 : Math.min(0, Math.max(b.w - cw, ZV.x));
  ZV.y = ch <= b.h ? (b.h - ch) / 2 : Math.min(0, Math.max(b.h - ch, ZV.y));
}
function zvApply(){
  var img = ZV.el.querySelector('.zv-img');
  img.style.transform = 'translate(' + ZV.x.toFixed(1) + 'px,' + ZV.y.toFixed(1) + 'px) scale(' + ZV.s.toFixed(5) + ')';
  var pct = ZV.el.querySelector('.zv-pct');
  if(pct) pct.textContent = Math.round(ZV.s / ZV.fit * 100) + '%';
  ZV.el.classList.toggle('zv-big', ZV.s > ZV.fit * 1.02);
}
function zvReset(){ ZV.s = ZV.fit; zvClamp(); zvApply(); }
function zvZoomAt(s2, px, py){
  s2 = Math.max(ZV.fit, Math.min(zvMaxS(), s2));
  ZV.x = px - (px - ZV.x) * (s2 / ZV.s);
  ZV.y = py - (py - ZV.y) * (s2 / ZV.s);
  ZV.s = s2;
  zvClamp(); zvApply();
}
function zvZoomBy(k){
  if(!ZV.ok) return;
  var b = zvStage();
  zvZoomAt(ZV.s * k, b.w / 2, b.h / 2);
}

/* ===== 指の動き ===== */
function zvPt(e){ var r = ZV.el.querySelector('.zv-stage').getBoundingClientRect(); return { x:e.clientX - r.left, y:e.clientY - r.top, t:Date.now() }; }
function zvTwo(){
  var ids = Object.keys(ZV.pts);
  if(ids.length < 2) return null;
  var a = ZV.pts[ids[0]], b = ZV.pts[ids[1]];
  return { d:Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), x:(a.x + b.x) / 2, y:(a.y + b.y) / 2 };
}
function zvDown(e){
  if(!ZV.ok) return;
  try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(err){}
  var p = zvPt(e);
  ZV.pts[e.pointerId] = p;
  var two = zvTwo();
  if(two){
    ZV.pinch = { d0:two.d, s0:ZV.s, cx:(two.x - ZV.x) / ZV.s, cy:(two.y - ZV.y) / ZV.s };
    ZV.pan = null; ZV.tap = null;
  }else{
    ZV.pan = { x0:ZV.x, y0:ZV.y, px:p.x, py:p.y };
    ZV.tap = { x:p.x, y:p.y, t:p.t, moved:false };
  }
}
function zvMove(e){
  if(!ZV.pts[e.pointerId]) return;
  var p = zvPt(e);
  ZV.pts[e.pointerId] = p;
  if(ZV.pinch){
    var two = zvTwo();
    if(!two) return;
    var s2 = Math.max(ZV.fit * 0.7, Math.min(zvMaxS(), ZV.pinch.s0 * two.d / ZV.pinch.d0));
    ZV.s = s2;
    ZV.x = two.x - ZV.pinch.cx * s2;
    ZV.y = two.y - ZV.pinch.cy * s2;
    if(s2 >= ZV.fit) zvClamp();
    zvApply();
    return;
  }
  if(ZV.pan){
    var dx = p.x - ZV.pan.px, dy = p.y - ZV.pan.py;
    if(ZV.tap && Math.hypot(dx, dy) > 10) ZV.tap.moved = true;
    if(ZV.s > ZV.fit * 1.02){
      ZV.x = ZV.pan.x0 + dx; ZV.y = ZV.pan.y0 + dy;
      zvClamp(); zvApply();
    }
  }
}
function zvUp(e){
  var p = ZV.pts[e.pointerId] ? zvPt(e) : null;
  delete ZV.pts[e.pointerId];
  if(ZV.pinch){
    if(Object.keys(ZV.pts).length < 2){
      ZV.pinch = null;
      if(ZV.s < ZV.fit) zvReset(); else { zvClamp(); zvApply(); }
      /* のこった指で、そのまま動かせる */
      var left = ZV.pts[Object.keys(ZV.pts)[0]];
      ZV.pan = left ? { x0:ZV.x, y0:ZV.y, px:left.x, py:left.y } : null;
      ZV.tap = null;
    }
    return;
  }
  var pan = ZV.pan, tap = ZV.tap;
  ZV.pan = null; ZV.tap = null;
  if(!p || e.type === 'pointercancel') return;
  /* 拡大していないときに左右にはらう：となりへ */
  if(pan && ZV.s <= ZV.fit * 1.02){
    var dx = p.x - pan.px, dy = p.y - pan.py;
    if(Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5){ zvGo(dx < 0 ? 1 : -1); return; }
  }
  if(tap && !tap.moved && p.t - tap.t < 350){
    var last = ZV.lastTap;
    if(last && p.t - last.t < 320 && Math.hypot(p.x - last.x, p.y - last.y) < 40){
      /* 2回たたいた：拡大 ⇔ もとの大きさ */
      clearTimeout(ZV.tapTimer); ZV.lastTap = null;
      if(ZV.s > ZV.fit * 1.02) zvReset(); else zvZoomAt(ZV.fit * 2.5, p.x, p.y);
      return;
    }
    ZV.lastTap = { x:p.x, y:p.y, t:p.t };
    /* 1回だけ：写真の外（暗いところ）をたたいたら、とじる（拡大していないとき） */
    var onImg = p.x >= ZV.x && p.x <= ZV.x + ZV.nw * ZV.s && p.y >= ZV.y && p.y <= ZV.y + ZV.nh * ZV.s;
    clearTimeout(ZV.tapTimer);
    if(!onImg && ZV.s <= ZV.fit * 1.02) ZV.tapTimer = setTimeout(function(){ ZV.lastTap = null; zoomClose(); }, 330);
  }
}
