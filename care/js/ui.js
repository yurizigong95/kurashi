/* かんご実習メーカー：画面のかけら（どの画面からも使う小さな部品） */

function section(title, right, body, cls){
  return '<section class="card' + (cls ? ' ' + cls : '') + '">' +
    (title ? '<div class="hd"><h2>' + esc(title) + '</h2>' + (right ? '<span class="rt">' + esc(right) + '</span>' : '') + '</div>' : '') +
    body + '</section>';
}
function note(text){ return '<p class="note">' + text + '</p>'; }
function warnBox(text){ return '<div class="warn">' + text + '</div>'; }
function empty(text){ return '<div class="empty">' + esc(text) + '</div>'; }
function statBox(label, v){ return '<div class="stat"><div class="s">' + esc(label) + '</div><div class="v">' + esc(v) + '</div></div>'; }
function dataAttrs(o){
  var d = '';
  Object.keys(o || {}).forEach(function(k){ d += ' data-' + k + '="' + esc(o[k]) + '"'; });
  return d;
}
function btn(label, act, opt){
  opt = opt || {};
  return '<button type="button" class="btn' + (opt.cls ? ' ' + opt.cls : '') + '" data-act="' + esc(act) + '"' + dataAttrs(opt.data) +
    (opt.dis ? ' disabled' : '') + '>' + label + '</button>';
}
function chips(list, cur, act, extraData){
  return '<div class="chips">' + list.map(function(c){
    return '<button type="button" data-act="' + esc(act) + '" data-v="' + esc(c[0]) + '"' + dataAttrs(extraData) +
      ' class="' + (String(cur) === String(c[0]) ? 'on' : '') + '">' + esc(c[1]) + '</button>';
  }).join('') + '</div>';
}
/* 打つたびに中身へ入れる欄（看護過程の書きこみ用）。data は、どこに入れるかの印 */
function liveArea(act, data, value, ph, rows){
  return '<textarea data-act="' + esc(act) + '" data-live="1"' + dataAttrs(data) + ' rows="' + (rows || 4) + '"' +
    ' placeholder="' + esc(ph || '') + '">' + esc(value || '') + '</textarea>';
}
function liveInput(act, data, value, ph, type){
  return '<input type="' + (type || 'text') + '" data-act="' + esc(act) + '" data-live="1"' + dataAttrs(data) +
    ' value="' + esc(value || '') + '" placeholder="' + esc(ph || '') + '">';
}
function nl2br(s){ return esc(s).replace(/\n/g, '<br>'); }
/* かんたんな確認（はい／いいえ） */
function ask(msg){
  try{ return window.confirm(msg); }catch(e){ return false; }
}
/* textarea を中身に合わせてのばす */
function autoGrow(el){
  if(!el || el.tagName !== 'TEXTAREA') return;
  el.style.height = 'auto';
  el.style.height = Math.min(Math.max(el.scrollHeight + 2, 64), 640) + 'px';
}
function afterRender(){
  Array.prototype.forEach.call(document.querySelectorAll('textarea[data-live]'), autoGrow);
  if(typeof chatAfter === 'function') chatAfter();
}
if(typeof document !== 'undefined'){
  document.addEventListener('input', function(ev){ if(ev.target && ev.target.dataset && ev.target.dataset.live) autoGrow(ev.target); });
}
