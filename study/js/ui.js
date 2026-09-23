/* もんだいメーカー：画面のかけら（どの画面からも使う小さな部品） */

function section(title, right, body){
  return '<section class="card">' +
    (title ? '<div class="hd"><h2>' + esc(title) + '</h2>' + (right ? '<span class="rt">' + esc(right) + '</span>' : '') + '</div>' : '') +
    body + '</section>';
}
function note(text){ return '<p class="note">' + text + '</p>'; }
function warnBox(text){ return '<div class="warn">' + text + '</div>'; }
function empty(text){ return '<div class="empty">' + esc(text) + '</div>'; }
function statBox(label, v){ return '<div class="stat"><div class="s">' + esc(label) + '</div><div class="v">' + esc(v) + '</div></div>'; }
function btn(label, act, opt){
  opt = opt || {};
  var d = '';
  Object.keys(opt.data || {}).forEach(function(k){ d += ' data-' + k + '="' + esc(opt.data[k]) + '"'; });
  return '<button type="button" class="btn' + (opt.cls ? ' ' + opt.cls : '') + '" data-act="' + esc(act) + '"' + d +
    (opt.dis ? ' disabled' : '') + '>' + label + '</button>';
}
function chips(list, cur, act, extraData){
  return '<div class="chips">' + list.map(function(c){
    var d = '';
    Object.keys(extraData || {}).forEach(function(k){ d += ' data-' + k + '="' + esc(extraData[k]) + '"'; });
    return '<button type="button" data-act="' + esc(act) + '" data-v="' + esc(c[0]) + '"' + d +
      ' class="' + (String(cur) === String(c[0]) ? 'on' : '') + '">' + esc(c[1]) + '</button>';
  }).join('') + '</div>';
}
/* 科目をえらぶ横ならび（すべて／科目なし もつけられる） */
function subChips(act, cur, withAll, extraData){
  var list = subs();
  var out = [];
  if(withAll) out.push(['', 'すべて']);
  list.forEach(function(s){ out.push([s.id, s.icon + ' ' + s.name]); });
  if(withAll && qsAll().some(function(q){ return !q.sub; })) out.push(['none', '科目なし']);
  if(!out.length) return '';
  var extra = '';
  Object.keys(extraData || {}).forEach(function(k){ extra += ' data-' + k + '="' + esc(extraData[k]) + '"'; });
  return '<div class="chips subchips">' + out.map(function(c){
    var col = c[0] && c[0] !== 'none' ? subColor(c[0]) : '';
    return '<button type="button" data-act="' + esc(act) + '" data-v="' + esc(c[0]) + '"' + extra +
      (col ? ' style="--c:' + col + '"' : '') +
      ' class="' + (String(cur) === String(c[0]) ? 'on' : '') + '">' + esc(c[1]) + '</button>';
  }).join('') + '</div>';
}
function noSubHtml(){
  return '<div class="empty">まだ科目がありません。<br>「科目」タブで、科目を足してください。</div>' +
    btn('🗂 科目をつくる', 'tab', { data:{ tab:'lib' }, cls:'ghost' });
}
function bar(pct, cls){
  return '<div class="bar' + (cls ? ' ' + cls : '') + '"><span style="width:' + clamp(Math.round(pct), 0, 100) + '%"></span></div>';
}
function nl2br(s){ return esc(s).replace(/\n/g, '<br>'); }
/* 出典・注意書き */
function srcLine(src){
  return src ? '<div class="src">出典：' + esc(src) + '</div>' : '';
}
/* かんたんな確認（はい／いいえ） */
function ask(msg){
  try{ return window.confirm(msg); }catch(e){ return false; }
}
