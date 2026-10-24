/* くらしの手帳：キャリアタブ（担当 career・関数は cr、クラスは cr- ではじめる） */
/* ============================== しくみ ==============================
   タブ「キャリア」（kmView('career')）。データは次のとおり（どれも同期する）。
   ・ロードマップ … S.kmData 'career:road' { items:[{ id, y 学年1〜4, t 項目, done 0/1 }], mt }
       はじめて直すまでは保存しない（見本 CR_ROAD を出すだけ。見るだけで中身を変えない）
   ・病院研究ノート … S.kmItems（mod:'career', type:'hosp'）{ name, city, pay, dorm:'あり'|'なし'|'', scholar, access, impr }
   ・見学・説明会 … S.kmItems（type:'visit'）{ date, hosp, kind:'見学'|'インターン'|'説明会', memo }
   ・資格・検定 … S.kmItems（type:'cert'）{ name, st:'goal'|'study'|'done', date } */

/* ============================== 決まり ============================== */
var CR_ROAD = [
  ['y1a', 1, '基礎看護学実習Ⅰ（病院・施設の見学）'],
  ['y1b', 1, '救命講習（BLS）を受ける'],
  ['y1c', 1, '看護師の働く場所（病院・訪問看護・保健など）を調べる'],
  ['y2a', 2, '基礎看護学実習Ⅱ（受け持ち実習）'],
  ['y2b', 2, '領域別実習の準備（予防接種・抗体価をそろえる）'],
  ['y2c', 2, '領域別実習を始める'],
  ['y2d', 2, '興味のある領域を考える'],
  ['y3a', 3, '領域別実習（成人・老年・小児・母性・精神・在宅 など）'],
  ['y3b', 3, '病院見学・インターンシップに行く'],
  ['y3c', 3, '奨学金（返済免除のあるもの）を調べる'],
  ['y3d', 3, '国家試験の勉強を始める'],
  ['y4a', 4, '統合実習'],
  ['y4b', 4, '就職活動（病院の採用試験・面接）'],
  ['y4c', 4, '卒業研究'],
  ['y4d', 4, '看護師国家試験（2月）'],
  ['y4e', 4, '免許の申請・就職の準備']
];
var CR_TABS = [['road', 'ロードマップ'], ['hosp', '病院研究'], ['visit', '見学・説明会'], ['cert', '資格・検定']];
var CR_VKIND = ['見学', 'インターン', '説明会'];
var CR_CST = [['goal', '目標'], ['study', '勉強中'], ['done', '取得済み']];
var crUi = { tab:'road', f:null };

/* ============================== 共通 ============================== */
function crItems(type){ return (S.kmItems || []).filter(function(x){ return x && x.mod === 'career' && x.type === type; }); }
function crItem(id){ return (S.kmItems || []).filter(function(x){ return x && x.mod === 'career' && x.id === id; })[0] || null; }
function crPut(type, rec){
  if(!Array.isArray(S.kmItems)) S.kmItems = [];
  rec.mod = 'career'; rec.type = type; rec.mt = Date.now();
  if(!rec.id) rec.id = uid('cr');
  for(var i = 0; i < S.kmItems.length; i++){ if(S.kmItems[i] && S.kmItems[i].id === rec.id){ S.kmItems[i] = rec; return rec.id; } }
  S.kmItems.push(rec);
  return rec.id;
}
function crCopy(o){ return JSON.parse(JSON.stringify(o == null ? null : o)); }
function crStr(v, n){ return String(v == null ? '' : v).trim().slice(0, n || 200); }
function crInp(k, label, v, ph, type, extra){
  return '<div><label class="f" for="cr_f_' + k + '">' + label + '</label><input' + (type ? ' type="' + type + '"' : '') + ' id="cr_f_' + k + '" class="cr-in" data-k="' + k + '" value="' + esc(v == null ? '' : v) + '"' +
    (ph ? ' placeholder="' + esc(ph) + '"' : '') + (extra || '') + '></div>';
}
function crArea(k, label, v, ph){
  return '<div class="field"><label class="f" for="cr_f_' + k + '">' + label + '</label><textarea id="cr_f_' + k + '" class="cr-in" data-k="' + k + '" rows="3"' +
    (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>' + esc(v == null ? '' : v) + '</textarea></div>';
}
function crPills(act, list, cur){
  return '<div class="pillrow">' + list.map(function(o){
    var val = Array.isArray(o) ? o[0] : o, lab = Array.isArray(o) ? o[1] : o;
    return '<button data-act="' + act + '" data-v="' + esc(val) + '" class="' + (cur === val ? 'on' : '') + '">' + esc(lab) + '</button>';
  }).join('') + '</div>';
}
function crFormBtns(save, delAct, id){
  return '<div class="pair" style="margin-top:10px"><button class="btn" data-act="' + save + '">保存する</button>' +
    '<button class="btn ghost" style="flex:0 0 auto;padding:11px 14px" data-act="cr-f-cancel">やめる</button></div>' +
    (id && delAct ? '<button class="mini" style="margin-top:8px" data-act="' + delAct + '" data-id="' + esc(id) + '">この記録を消す</button>' : '');
}
function crByDate(a, b){ return String(b.date || '').localeCompare(String(a.date || '')) || (b.mt || 0) - (a.mt || 0); }

/* ============================== ロードマップ ============================== */
function crRoad(){
  var d = (S.kmData || {})['career:road'];
  if(d && Array.isArray(d.items)) return d.items;
  return CR_ROAD.map(function(r){ return { id:r[0], y:r[1], t:r[2], done:0 }; });
}
function crRoadSave(items){
  S.kmData = S.kmData || {};
  S.kmData['career:road'] = { items:items, mt:Date.now() };
  touch('kmData');
}
function crRoadHtml(){
  var items = crRoad(), f = crUi.f && crUi.f.kind === 'road' ? crUi.f : null;
  var h = [1, 2, 3, 4].map(function(y){
    var its = items.filter(function(x){ return toNum(x.y) === y; });
    var dn = its.filter(function(x){ return x.done; }).length;
    return '<div class="cr-year"><div class="cr-yhd"><b>' + y + '年</b><span class="s">' + dn + '/' + its.length + '</span></div>' +
      (its.length ? its.map(function(x){
        return '<div class="cr-ms"><label class="cr-ck"><input type="checkbox" data-act="cr-road-ck" data-id="' + esc(x.id) + '"' + (x.done ? ' checked' : '') + '>' +
          '<span class="' + (x.done ? 'cr-done' : '') + '">' + esc(x.t) + '</span></label>' +
          '<button class="mini" data-act="cr-road-edit" data-id="' + esc(x.id) + '">直す</button></div>';
      }).join('') : '<div class="s">項目はありません。</div>') + '</div>';
  }).join('');
  if(f){
    h += '<div class="cr-form"><label class="f">学年</label>' + crPills('cr-f-y', [[1, '1年'], [2, '2年'], [3, '3年'], [4, '4年']].map(function(o){ return [String(o[0]), o[1]]; }), String(f.y)) +
      '<div class="field">' + crInp('t', '項目', f.t, '例：TOEICを受ける') + '</div>' +
      crFormBtns('cr-road-save', 'cr-road-del', f.id) + '</div>';
  }else{
    h += '<div class="pillrow" style="margin-top:8px"><button class="mini" data-act="cr-road-new">＋ 自分の項目を足す</button>' +
      ((S.kmData || {})['career:road'] ? '<button class="mini" data-act="cr-road-reset">見本にもどす</button>' : '') + '</div>';
  }
  h += '<p class="note">よくある流れの見本です。大学のカリキュラム（実習の時期など）に合わせて直してください。</p>';
  var all = items.length, done = items.filter(function(x){ return x.done; }).length;
  return section('ロードマップ', done + '/' + all + ' 済み', h);
}

/* ============================== 病院研究ノート ============================== */
var CR_HCOLS = [['city', '場所'], ['pay', '給料'], ['dorm', '寮'], ['scholar', '奨学金'], ['access', '立地'], ['impr', '感想']];
function crHospHtml(){
  var list = crItems('hosp').slice().sort(function(a, b){ return String(a.name || '').localeCompare(String(b.name || ''), 'ja'); });
  var f = crUi.f && crUi.f.kind === 'hosp' ? crUi.f : null;
  var h = '';
  if(f){
    h += '<div class="cr-form">' +
      '<div class="grid2">' + crInp('name', '病院の名前', f.name, '例：〇〇病院') + crInp('city', '場所（市町村）', f.city, '例：西宮市') + '</div>' +
      '<div class="field">' + crInp('pay', '給料メモ', f.pay, '例：初任給 25万円くらい・夜勤手当') + '</div>' +
      '<label class="f">寮</label>' + crPills('cr-f-dorm', [['あり', 'あり'], ['なし', 'なし'], ['', 'わからない']], f.dorm || '') +
      crArea('scholar', '奨学金メモ', f.scholar, '例：月5万円・3年働くと返済免除') +
      crArea('access', '立地メモ', f.access, '例：三田から電車で40分・大学から近い') +
      crArea('impr', '感想', f.impr, '例：雰囲気がよかった・教育が手厚い') +
      crFormBtns('cr-hosp-save', 'cr-hosp-del', f.id) + '</div>';
  }else{
    h += '<button class="mini" data-act="cr-hosp-new">＋ 病院を足す</button>';
  }
  if(list.length){
    h += '<div class="cr-scroll"><table class="cr-tbl"><thead><tr><th>病院</th>' + CR_HCOLS.map(function(c){ return '<th>' + c[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      list.map(function(x){
        return '<tr data-act="cr-hosp-edit" data-id="' + esc(x.id) + '" role="button"><th>' + esc(x.name || '—') + '</th>' +
          CR_HCOLS.map(function(c){ return '<td>' + esc(x[c[0]] || '') + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="note">表は横にずらして見られます。行を押すと直せます。給料・奨学金は、病院の募集要項で確かめてください。</p>';
  }else if(!f){
    h += '<div class="empty">気になる病院を足すと、ここで表にしてくらべられます。</div>';
  }
  return section('病院研究ノート', list.length ? list.length + '件' : null, h);
}

/* ============================== 見学・説明会 ============================== */
function crVisitHtml(){
  var list = crItems('visit').slice().sort(crByDate);
  var f = crUi.f && crUi.f.kind === 'visit' ? crUi.f : null;
  var hosps = crItems('hosp').map(function(x){ return x.name; }).filter(Boolean);
  var h = '';
  if(f){
    h += '<div class="cr-form"><div class="grid2">' + crInp('date', '日付', f.date, '', 'date') +
      crInp('hosp', '病院の名前', f.hosp, '例：〇〇病院', '', hosps.length ? ' list="cr_hosps"' : '') + '</div>' +
      (hosps.length ? '<datalist id="cr_hosps">' + hosps.map(function(n){ return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>' : '') +
      '<label class="f">種類</label>' + crPills('cr-f-vkind', CR_VKIND, f.kind2 || '見学') +
      crArea('memo', '感想メモ', f.memo, '例：新人教育の話がくわしかった') +
      crFormBtns('cr-visit-save', 'cr-visit-del', f.id) + '</div>';
  }else{
    h += '<button class="mini" data-act="cr-visit-new">＋ 記録を足す</button>';
  }
  var td = today();
  h += list.length ? list.map(function(x){
    return '<div class="row" data-act="cr-visit-edit" data-id="' + esc(x.id) + '" role="button" style="cursor:pointer"><div class="grow">' +
      '<div class="t">' + esc(x.hosp || '—') + '<span class="s">　' + esc(x.kind || '') + '</span></div>' +
      '<div class="s">' + (isYmd(x.date) ? ymdLabel(x.date) + (x.date > td ? '（これから）' : '') : '日付なし') + (x.memo ? '・' + esc(String(x.memo).slice(0, 50)) : '') + '</div></div>' +
      '<span class="s2">›</span></div>';
  }).join('') : (f ? '' : '<div class="empty">まだ記録がありません。</div>');
  return section('見学・説明会の記録', list.length ? list.length + '件' : null, h);
}

/* ============================== 資格・検定 ============================== */
function crCertHtml(){
  var order = { study:0, goal:1, done:2 };
  var list = crItems('cert').slice().sort(function(a, b){ return (order[a.st] || 0) - (order[b.st] || 0) || String(a.date || '').localeCompare(String(b.date || '')); });
  var f = crUi.f && crUi.f.kind === 'cert' ? crUi.f : null;
  var h = '';
  if(f){
    h += '<div class="cr-form"><div class="field">' + crInp('name', '名前', f.name, '例：BLSプロバイダー・TOEIC・看護師国家試験') + '</div>' +
      '<label class="f">状態</label>' + crPills('cr-f-st', CR_CST, f.st || 'goal') +
      '<div class="field">' + crInp('date', f.st === 'done' ? '取得日' : '目標日', f.date, '', 'date') + '</div>' +
      crFormBtns('cr-cert-save', 'cr-cert-del', f.id) + '</div>';
  }else{
    h += '<button class="mini" data-act="cr-cert-new">＋ 資格・検定を足す</button>';
  }
  var name = {}; CR_CST.forEach(function(c){ name[c[0]] = c[1]; });
  h += list.length ? list.map(function(x){
    var n = isYmd(x.date) && x.st !== 'done' ? daysFromToday(x.date) : null;
    return '<div class="row" data-act="cr-cert-edit" data-id="' + esc(x.id) + '" role="button" style="cursor:pointer"><div class="grow">' +
      '<div class="t">' + esc(x.name || '—') + '</div><div class="s">' + (isYmd(x.date) ? (x.st === 'done' ? '取得 ' : '目標 ') + ymdLabel(x.date) : '') +
      (n != null && n >= 0 ? '（あと' + n + '日）' : '') + '</div></div>' +
      '<span class="cr-st cr-' + esc(x.st || 'goal') + '">' + esc(name[x.st] || '目標') + '</span></div>';
  }).join('') : (f ? '' : '<div class="empty">まだありません。</div>');
  var got = list.filter(function(x){ return x.st === 'done'; }).length;
  return section('資格・検定', list.length ? '取得済み ' + got + '/' + list.length : null, h);
}

/* ============================== 画面 ============================== */
function crView(){
  var h = '<div class="pillrow cr-nav">' + CR_TABS.map(function(t){
    return '<button data-act="cr-tab" data-v="' + t[0] + '" class="' + (crUi.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
  }).join('') + '</div>';
  if(crUi.tab === 'hosp') return h + crHospHtml();
  if(crUi.tab === 'visit') return h + crVisitHtml();
  if(crUi.tab === 'cert') return h + crCertHtml();
  return h + crRoadHtml();
}

/* ============================== 操作 ============================== */
function crFormNew(kind, o){ crUi.f = Object.assign({}, o || {}, { kind:kind }); }
kmView('career', crView);
kmAction(function(act, t){
  if(act.indexOf('cr-') !== 0) return false;
  var v = t.dataset ? t.dataset.v : '', id = t.dataset ? t.dataset.id : '';
  var f = crUi.f, items, rec;
  switch(act){
    case 'cr-tab': crUi.tab = v || 'road'; crUi.f = null; render(); window.scrollTo(0, 0); return true;
    case 'cr-f-cancel': crUi.f = null; render(); return true;
    /* ロードマップ */
    case 'cr-road-ck':
      items = crCopy(crRoad());
      items.forEach(function(x){ if(x.id === id) x.done = x.done ? 0 : 1; });
      crRoadSave(items); commit(); return true;
    case 'cr-road-new': crFormNew('road', { id:'', y:1, t:'' }); render(); return true;
    case 'cr-road-edit':
      var r = crRoad().filter(function(x){ return x.id === id; })[0]; if(!r) return true;
      crFormNew('road', { id:r.id, y:r.y, t:r.t }); render(); return true;
    case 'cr-f-y': if(f){ f.y = toNum(v); render(); } return true;
    case 'cr-road-save':
      if(!f) return true;
      var tt = crStr(f.t, 80);
      if(!tt){ toast('項目を入れてください', true); return true; }
      items = crCopy(crRoad());
      var hit = items.filter(function(x){ return x.id === f.id; })[0];
      if(hit){ hit.t = tt; hit.y = Math.max(1, Math.min(4, toNum(f.y) || 1)); }
      else items.push({ id:uid('crr'), y:Math.max(1, Math.min(4, toNum(f.y) || 1)), t:tt, done:0 });
      crRoadSave(items); crUi.f = null; toast(hit ? '直しました' : '足しました'); commit(); return true;
    case 'cr-road-del':
      if(!confirm('この項目を消しますか？')) return true;
      crRoadSave(crRoad().filter(function(x){ return x.id !== id; })); crUi.f = null; toast('消しました'); commit(); return true;
    case 'cr-road-reset':
      if(!confirm('ロードマップを見本にもどしますか？（足した項目と済みの印は消えます）')) return true;
      crRoadSave(CR_ROAD.map(function(r){ return { id:r[0], y:r[1], t:r[2], done:0 }; })); toast('見本にもどしました'); commit(); return true;
    /* 病院研究 */
    case 'cr-hosp-new': crFormNew('hosp', { id:'', dorm:'' }); render(); return true;
    case 'cr-hosp-edit':
      var hp = crItem(id); if(!hp) return true;
      crFormNew('hosp', crCopy(hp)); render(); window.scrollTo(0, 0); return true;
    case 'cr-f-dorm': if(f){ f.dorm = v; render(); } return true;
    case 'cr-hosp-save':
      if(!f) return true;
      if(!crStr(f.name)){ toast('病院の名前を入れてください', true); return true; }
      rec = f.id && crItem(f.id) ? crCopy(crItem(f.id)) : {};
      rec.name = crStr(f.name, 60); rec.city = crStr(f.city, 40); rec.pay = crStr(f.pay, 200);
      rec.dorm = f.dorm === 'あり' || f.dorm === 'なし' ? f.dorm : '';
      rec.scholar = crStr(f.scholar, 500); rec.access = crStr(f.access, 500); rec.impr = crStr(f.impr, 1000);
      crPut('hosp', rec); crUi.f = null; toast('保存しました'); commit(); return true;
    case 'cr-hosp-del':
      if(!confirm('この病院のノートを消しますか？')) return true;
      removeItem('kmItems', id); crUi.f = null; toast('消しました'); commit(); return true;
    /* 見学・説明会（種類は kind2 で持つ。kind はフォームの見分けに使う） */
    case 'cr-visit-new': crFormNew('visit', { id:'', date:today(), kind2:'見学' }); render(); return true;
    case 'cr-visit-edit':
      var vs = crItem(id); if(!vs) return true;
      crFormNew('visit', { id:vs.id, date:vs.date, hosp:vs.hosp, kind2:vs.kind, memo:vs.memo }); render(); window.scrollTo(0, 0); return true;
    case 'cr-f-vkind': if(f){ f.kind2 = v; render(); } return true;
    case 'cr-visit-save':
      if(!f) return true;
      if(!isYmd(f.date)){ toast('日付を入れてください', true); return true; }
      if(!crStr(f.hosp)){ toast('病院の名前を入れてください', true); return true; }
      rec = f.id && crItem(f.id) ? crCopy(crItem(f.id)) : {};
      rec.date = f.date; rec.hosp = crStr(f.hosp, 60); rec.kind = CR_VKIND.indexOf(f.kind2) >= 0 ? f.kind2 : '見学'; rec.memo = crStr(f.memo, 1000);
      crPut('visit', rec); crUi.f = null; toast('保存しました'); commit(); return true;
    case 'cr-visit-del':
      if(!confirm('この記録を消しますか？')) return true;
      removeItem('kmItems', id); crUi.f = null; toast('消しました'); commit(); return true;
    /* 資格・検定 */
    case 'cr-cert-new': crFormNew('cert', { id:'', st:'goal' }); render(); return true;
    case 'cr-cert-edit':
      var ce = crItem(id); if(!ce) return true;
      crFormNew('cert', crCopy(ce)); render(); window.scrollTo(0, 0); return true;
    case 'cr-f-st': if(f){ f.st = v; render(); } return true;
    case 'cr-cert-save':
      if(!f) return true;
      if(!crStr(f.name)){ toast('名前を入れてください', true); return true; }
      rec = f.id && crItem(f.id) ? crCopy(crItem(f.id)) : {};
      rec.name = crStr(f.name, 60); rec.st = CR_CST.some(function(c){ return c[0] === f.st; }) ? f.st : 'goal'; rec.date = isYmd(f.date) ? f.date : '';
      crPut('cert', rec); crUi.f = null; toast('保存しました'); commit(); return true;
    case 'cr-cert-del':
      if(!confirm('この記録を消しますか？')) return true;
      removeItem('kmItems', id); crUi.f = null; toast('消しました'); commit(); return true;
  }
  return false;
});
/* 打っている字を覚えておく（同期などで描き直しても消えないように） */
function crKeep(e){
  var t = e.target;
  if(t && t.classList && t.classList.contains('cr-in') && crUi.f) crUi.f[t.dataset.k] = t.value;
}
document.addEventListener('input', crKeep);
document.addEventListener('change', crKeep);
