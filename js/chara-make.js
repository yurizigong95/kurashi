/* くらしの手帳：自分の画像からキャラを作る */
/* ============================== 画像のキャラの絵 ============================== */
function chImgFace(expr){
  if(expr === 'happy' || expr === 'cheer') return chSparkle();
  if(expr === 'shy' || expr === 'love') return '<ellipse cx="28" cy="72" rx="8" ry="4.5" fill="#F58CA8" opacity=".45"/><ellipse cx="72" cy="72" rx="8" ry="4.5" fill="#F58CA8" opacity=".45"/>';
  if(expr === 'sad' || expr === 'cry') return '<path d="M34 60 q-3.5 6 0 8 q3.5 -2 0 -8 Z M68 60 q-3.5 6 0 8 q3.5 -2 0 -8 Z" fill="#8CC8F0" stroke="#5B9BC8" stroke-width=".8"/>';
  return '';
}
function charaImgHtml(k, opt){
  var expr = opt.expr || 'normal', size = opt.size || 64;
  var hat = (opt.hat !== undefined) ? opt.hat : charaHatNow();
  var src = (typeof photoCache !== 'undefined' && photoCache[k.pid]) ? String(photoCache[k.pid]) : '';
  if(src && !/^data:image\/[a-z+.-]+;base64,[A-Za-z0-9+\/=]+$/.test(src)) src = '';
  var ov = chImgFace(expr) + ((hat === 'megane' || hat === 'hachimaki') ? '' : chHat(k, hat)) + chProp(opt.prop, k) + chMarks(k, expr);
  return '<span class="chara chimg ct-'+charaTouch()+' ex-'+expr+(opt.anim ? ' anim-'+opt.anim : '')+'" title="'+esc(k.name)+'" style="width:'+size+'px;height:'+size+'px">'+
    '<img alt="" '+(src ? 'src="'+src+'"' : 'data-pid="'+esc(k.pid)+'"')+' width="'+size+'" height="'+size+'" draggable="false">'+
    (ov ? '<svg viewBox="0 0 100 100" width="'+size+'" height="'+size+'" aria-hidden="true" focusable="false">'+ov+'</svg>' : '')+'</span>';
}
/* 自分の子の画像（写真の片づけで消さないように） */
function charaPhotoIds(){ return charaCustomList().map(function(u){ return u.pid; }); }

/* ============================== 切りぬき ============================== */
/* 四すみの色とつながっている部分を透明にする（白い背景のイラストなど） */
function charaCutBg(ctx, W, H, tol){
  tol = tol || 60;
  var im = ctx.getImageData(0, 0, W, H), d = im.data;
  var r = 0, g = 0, b = 0, n = 0;
  [0, W - 1, (H - 1) * W, H * W - 1].forEach(function(p){
    var i = p * 4;
    if(d[i + 3] > 200){ r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  });
  if(!n) return false;                       /* もう透明になっている */
  r /= n; g /= n; b /= n;
  var seen = new Uint8Array(W * H), gone = new Uint8Array(W * H), st = [], x, y, p, i;
  for(x = 0; x < W; x++){ st.push(x, (H - 1) * W + x); }
  for(y = 0; y < H; y++){ st.push(y * W, y * W + W - 1); }
  while(st.length){
    p = st.pop();
    if(seen[p]) continue;
    seen[p] = 1; i = p * 4;
    if(d[i + 3] >= 16 && Math.abs(d[i] - r) + Math.abs(d[i + 1] - g) + Math.abs(d[i + 2] - b) > tol) continue;
    d[i + 3] = 0; gone[p] = 1;
    x = p % W; y = (p - x) / W;
    if(x > 0) st.push(p - 1);
    if(x < W - 1) st.push(p + 1);
    if(y > 0) st.push(p - W);
    if(y < H - 1) st.push(p + W);
  }
  /* ふちを少しなめらかに */
  for(y = 1; y < H - 1; y++){
    for(x = 1; x < W - 1; x++){
      p = y * W + x;
      if(gone[p]) continue;
      if(gone[p - 1] || gone[p + 1] || gone[p - W] || gone[p + W]){ i = p * 4; d[i + 3] = Math.min(d[i + 3], 190); }
    }
  }
  ctx.putImageData(im, 0, 0);
  return true;
}
var chMake = null;
function charaMakeBox(){
  var m = chMake, side = Math.max(8, m.zoom / 100 * Math.min(m.iw, m.ih));
  var sx = Math.max(0, Math.min(m.iw - side, m.cx * m.iw - side / 2));
  var sy = Math.max(0, Math.min(m.ih - side, m.cy * m.ih - side / 2));
  return { sx:sx, sy:sy, side:side };
}
function charaMakeRender(){
  var m = chMake, bx = charaMakeBox();
  var out = document.createElement('canvas');
  out.width = out.height = 256;
  var ctx = out.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(m.src, bx.sx, bx.sy, bx.side, bx.side, 0, 0, 256, 256);
  if(m.bg) charaCutBg(ctx, 256, 256, 60);
  return out;
}

/* ============================== 作る画面 ============================== */
function charaMakeEl(){
  var el = document.getElementById('chmake');
  if(el) return el;
  el = document.createElement('div');
  el.id = 'chmake';
  el.addEventListener('click', function(e){
    if(e.target === el){ charaMakeClose(); return; }
    var b = e.target.closest('[data-mk]'); if(!b) return;
    var a = b.dataset.mk;
    if(a === 'close') charaMakeClose();
    else if(a === 'pick') charaMakeFile().click();
    else if(a === 'save') charaMakeSave();
  });
  el.addEventListener('input', function(e){
    var t = e.target; if(!chMake) return;
    if(t.id === 'chmk_zoom'){ chMake.zoom = toNum(t.value); charaMakeUpdate(); }
    else if(t.id === 'chmk_name') chMake.name = t.value;
    else if(t.id === 'chmk_tic') chMake.tic = t.value;
    else if(t.id === 'chmk_like') chMake.like = t.value;
    else if(t.id === 'chmk_note') chMake.note = t.value;
  });
  el.addEventListener('change', function(e){
    if(e.target.id === 'chmk_bg' && chMake){ chMake.bg = e.target.checked ? 1 : 0; charaMakeUpdate(); }
  });
  /* 四角を動かす */
  var drag = false;
  var move = function(e){
    var st = document.getElementById('chmk_stage');
    if(!st || !chMake || !chMake.src) return;
    var r = st.getBoundingClientRect();
    chMake.cx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    chMake.cy = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    charaMakeUpdate();
  };
  el.addEventListener('pointerdown', function(e){
    if(!e.target.closest('#chmk_stage')) return;
    drag = true; e.preventDefault();
    try{ e.target.setPointerCapture(e.pointerId); }catch(err){}
    move(e);
  });
  el.addEventListener('pointermove', function(e){ if(drag) move(e); });
  el.addEventListener('pointerup', function(){ drag = false; });
  el.addEventListener('pointercancel', function(){ drag = false; });
  document.body.appendChild(el);
  return el;
}
function charaMakeFile(){
  var f = document.getElementById('chmakefile');
  if(f){ f.value = ''; return f; }
  f = document.createElement('input');
  f.type = 'file'; f.accept = 'image/*'; f.id = 'chmakefile'; f.style.display = 'none';
  f.addEventListener('change', function(){ var file = f.files && f.files[0]; if(file) charaMakeLoad(file); });
  document.body.appendChild(f);
  return f;
}
function charaMakeLoad(file){
  var fr = new FileReader();
  fr.onload = function(){
    var im = new Image();
    im.onload = function(){ charaMakeSetImage(im, fr.result); };
    im.onerror = function(){ toast('画像を読みこめませんでした', true); };
    im.src = fr.result;
  };
  fr.readAsDataURL(file);
}
function charaMakeSetImage(im, orig){
  if(!chMake) return;
  var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
  var s = Math.min(1, 1400 / Math.max(w, h, 1));
  var cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w * s)); cv.height = Math.max(1, Math.round(h * s));
  cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
  chMake.src = cv; chMake.iw = cv.width; chMake.ih = cv.height; chMake.orig = orig;
  chMake.cx = .5; chMake.cy = .5;
  chMake.zoom = (Math.abs(w - h) / Math.max(w, h) < .15) ? 100 : 70;
  charaMakeDraw();
}
var __mkRaf = 0;
function charaMakeUpdate(){
  if(!chMake || !chMake.src) return;
  var bx = charaMakeBox(), box = document.getElementById('chmk_box');
  if(box){
    box.style.left = (bx.sx / chMake.iw * 100) + '%';
    box.style.top = (bx.sy / chMake.ih * 100) + '%';
    box.style.width = (bx.side / chMake.iw * 100) + '%';
    box.style.height = (bx.side / chMake.ih * 100) + '%';
  }
  if(__mkRaf) return;
  __mkRaf = (window.requestAnimationFrame || setTimeout)(function(){
    __mkRaf = 0;
    var pv = document.getElementById('chmk_prev');
    if(!pv || !chMake || !chMake.src) return;
    var ctx = pv.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.drawImage(charaMakeRender(), 0, 0);
  });
}
function charaMakeOpen(editId){
  var el = charaMakeEl();
  if(editId){
    var u = charaCustomList().filter(function(x){ return x.id === editId; })[0];
    if(!u) return;
    chMake = { edit:editId, pid:u.pid, name:u.name || '', tic:u.tic || '', like:u.like || '', note:u.note || '' };
  }else{
    if(charaCustomList().length >= 12){ toast('自分の子は12ひきまでです', true); return; }
    chMake = { edit:'', name:'', tic:'', like:'', note:'', src:null, bg:1, zoom:70, cx:.5, cy:.5 };
  }
  charaMakeDraw();
  el.classList.add('on');
  document.body.classList.add('chmaking');
  if(!editId) charaMakeFile().click();
}
function charaMakeClose(){
  var el = document.getElementById('chmake');
  if(el){ el.classList.remove('on'); el.innerHTML = ''; }
  document.body.classList.remove('chmaking');
  chMake = null;
}
function charaMakeDraw(){
  var m = chMake, el = charaMakeEl();
  if(!m) return;
  var fld = function(id, label, val, max, ph){
    return '<label class="f" for="'+id+'">'+label+'</label><input id="'+id+'" maxlength="'+max+'" value="'+esc(val || '')+'" placeholder="'+esc(ph)+'" autocomplete="off">';
  };
  var h = '<div class="chmk-card" role="dialog" aria-modal="true" aria-label="キャラを作る">'+
    '<div class="chmk-hd"><b>'+(m.edit ? 'キャラをなおす' : '自分の画像からキャラを作る')+'</b>'+
    '<button type="button" class="mini" data-mk="close" aria-label="閉じる">×</button></div><div class="chmk-bd">';
  if(m.edit){
    h += '<div class="chmk-now">'+charaSvg({ id:m.edit, size:96, expr:'happy', anim:'bounce', still:true })+'</div>';
  }else if(!m.src){
    h += '<button type="button" class="btn" data-mk="pick">画像をえらぶ</button>'+
      '<p class="note">自分で描いた絵や、ペット・ぬいぐるみの写真などを選んでください。白い背景の絵だと、きれいに切りぬけます。</p>';
  }else{
    h += '<p class="note" style="margin-top:0">使いたいところをタップ・なぞって、四角を動かしてください。</p>'+
      '<div class="chmk-stage" id="chmk_stage"><img src="'+esc(m.orig)+'" alt="" draggable="false"><div class="chmk-box" id="chmk_box"></div></div>'+
      '<label class="f" for="chmk_zoom">四角の大きさ</label><input type="range" id="chmk_zoom" min="10" max="100" value="'+m.zoom+'">'+
      '<label class="tg"><input type="checkbox" id="chmk_bg"'+(m.bg ? ' checked' : '')+'>まわりの背景（白など）を消す</label>'+
      '<div class="chmk-prev"><canvas id="chmk_prev" width="256" height="256"></canvas><span>できあがり</span></div>'+
      '<button type="button" class="mini" data-mk="pick" style="margin:6px 0 4px">画像をえらびなおす</button>';
  }
  if(m.edit || m.src){
    h += fld('chmk_name', '名前', m.name, 12, '例：うちの子') +
      fld('chmk_tic', '口ぐせ（なくてもOK）', m.tic, 8, '例：にゃ') +
      fld('chmk_like', '好きなもの（なくてもOK）', m.like, 16, '例：いちご') +
      fld('chmk_note', 'ひとこと紹介（なくてもOK）', m.note, 30, '例：いつもそばにいる子') +
      '<button type="button" class="btn" data-mk="save" style="margin-top:12px">'+(m.edit ? '保存する' : 'この子を仲間にする')+'</button>';
  }
  h += '<button type="button" class="btn ghost" data-mk="close" style="margin-top:8px">やめる</button></div></div>';
  el.innerHTML = h;
  if(typeof photoFill === 'function') photoFill();
  charaMakeUpdate();
}
async function charaMakeSave(){
  var m = chMake;
  if(!m) return;
  var info = { name:(m.name || '').trim() || '自分の子', tic:(m.tic || '').trim(), like:(m.like || '').trim(), note:(m.note || '').trim() };
  if(m.edit){
    charaSet({ custom:charaCustomList().map(function(u){ return u.id === m.edit ? Object.assign({}, u, info) : u; }) });
    commit(); charaMakeClose(); toast('なおしました');
    return;
  }
  if(!m.src){ toast('画像をえらんでください', true); return; }
  var url = charaMakeRender().toDataURL('image/png');
  var id = 'u' + Date.now().toString(36), pid = 'chimg_' + id;
  try{ await photoPut(pid, url); }
  catch(e){ logErr('キャラ作り', e.message); toast('保存できませんでした', true); return; }
  var c = charaCfg();
  var patch = { custom:charaCustomList().concat([Object.assign({ id:id, pid:pid }, info)]) };
  if(c.mode === 'one') patch.main = id;
  else patch.friends = c.friends.concat([id]);
  charaSet(patch);
  charaCatNow = 'mine';
  commit();
  charaMakeClose();
  toast(info.name + 'が仲間になりました');
  setTimeout(function(){ charaCheer('よろしくね！', 'love'); }, 300);
}
function charaMakeDelete(id){
  var u = charaCustomList().filter(function(x){ return x.id === id; })[0];
  if(!u) return;
  if(!confirm('「' + (u.name || '自分の子') + '」を消しますか？　もどせません。')) return;
  var patch = { custom:charaCustomList().filter(function(x){ return x.id !== id; }) };
  var raw = S.ui.chara || {};
  if(raw.main === id) patch.main = 'mochi';
  if(Array.isArray(raw.friends)) patch.friends = raw.friends.filter(function(x){ return x !== id; });
  charaSet(patch);
  photoDel(u.pid);
  commit();
  toast('消しました');
}
