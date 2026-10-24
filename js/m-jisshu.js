/* くらしの手帳：実習タブ（担当 jisshu・関数は jh、クラスは jh- ではじめる） */
/* ============================== しくみ ==============================
   タブ「実習」（kmView('jisshu')）。データは次のとおり。
   ・実習の登録 … S.kmItems（mod:'jisshu', type:'prog'）
       { name 実習名, from 開始日, to 終了日, place 場所, gather 集合時刻, travel 家から集合場所までの分（なくてもよい）,
         items:[{ id, t }] 持ち物, goals:{ 日付:今日の目標 }, checks:{ 日付:{ 持ち物id:1 } } }
   ・実習日誌 … S.kmItems（type:'diary'）{ date, progId, s, o, a, p, memo, self 自己評価1〜5 }
   ・バイタル練習記録 … S.kmItems（type:'vital'）{ date, who:'self'|'pair', bt 体温, pr 脈拍, rr 呼吸数, sbp, dbp 血圧, spo2, memo }
   ・看護技術チェックリスト … S.kmData 'jisshu:skills' { v:{ 項目id:0〜3 }, mt }（0 未経験・1 見学・2 実施・3 自立）
   ・受け持ちメモ … この端末の中だけ（localStorage KEY+':jisshuCare'）。S には入れない。
       → 同期（Firebase）・AI（aiCall・aidata の分野・相談の要約）・Discord・朝や週のまとめ・バックアップ（Google・書き出し）の
         どれも S（と payload）から作るので、受け持ちメモは入らない。この先も S・kmItems・kmData に移さないこと。
   実習の記録（日誌など）は患者さんのことを書きやすいので、AIに見せる前に名前らしい文字を伏せる（kmAiMask）。 */

/* ============================== 決まり ============================== */
var JH_ITEMS_DEF = ['記録用具（筆記用具・メモ帳）', 'バイタル測定セット（体温計・血圧計・秒針つき時計）', '聴診器', '実習着', '名札', '上履き（ナースシューズ）', '昼食・飲み物'];
var JH_SKILLS = [
  ['vital', 'バイタルサイン測定（体温・脈拍・呼吸・血圧・SpO2）'],
  ['hand', '感染予防：手指衛生（手洗い・手指消毒）'],
  ['ppe', '感染予防：個人防護具（PPE）の着脱'],
  ['env', '環境整備'],
  ['bed', 'ベッドメイキング（空床）'],
  ['sheet', '臥床患者のシーツ交換'],
  ['pos', '体位変換・ポジショニング'],
  ['wheel', '移動・移送の援助（車いす）'],
  ['walk', '移動・移送の援助（歩行介助・ストレッチャー）'],
  ['wipe', '清潔援助：全身清拭'],
  ['hair', '清潔援助：洗髪'],
  ['foot', '清潔援助：足浴・手浴'],
  ['mouth', '清潔援助：口腔ケア'],
  ['cloth', '寝衣交換'],
  ['meal', '食事援助'],
  ['excr', '排泄援助（床上排泄・おむつ交換）'],
  ['peri', '陰部洗浄'],
  ['phys', 'フィジカルアセスメント（呼吸音・腸蠕動音）'],
  ['safe', '安全の確保（転倒・転落の予防）'],
  ['report', '記録・報告（SBARなど）']
];
var JH_ST = [['未経験', ''], ['見学', 'see'], ['実施', 'do'], ['自立', 'own']];
var JH_TABS = [['home', '今日・実習'], ['diary', '日誌'], ['skills', '看護技術'], ['vital', 'バイタル練習'], ['care', '受け持ちメモ']];
var JH_AGES = ['乳幼児', '学童', '10代', '20代', '30代', '40代', '50代', '60代', '70代', '80代', '90代', '100歳以上'];
var JH_SEX = ['女性', '男性', 'その他・書かない'];
var JH_CARE_LS = KEY + ':jisshuCare';      /* 受け持ちメモ（この端末だけ） */
var jhUi = { tab:'home', f:null, goal:null, dList:false, vList:false };

/* ============================== 共通 ============================== */
function jhNum(v){
  var s = String(v == null ? '' : v).trim();
  try{ s = s.normalize('NFKC'); }catch(e){}
  if(!s) return '';
  var n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : '';
}
function jhHhmm(v){
  var s = String(v == null ? '' : v).trim();
  try{ s = s.normalize('NFKC'); }catch(e){}
  return /^\d{1,2}:\d{2}$/.test(s) && minutesOf(s) < 1440 ? hhmmOf(minutesOf(s)) : '';
}
function jhItems(type){ return (S.kmItems || []).filter(function(x){ return x && x.mod === 'jisshu' && x.type === type; }); }
function jhItem(id){ return (S.kmItems || []).filter(function(x){ return x && x.mod === 'jisshu' && x.id === id; })[0] || null; }
function jhPut(type, rec){
  if(!Array.isArray(S.kmItems)) S.kmItems = [];
  rec.mod = 'jisshu'; rec.type = type; rec.mt = Date.now();
  if(!rec.id) rec.id = uid('jh');
  for(var i = 0; i < S.kmItems.length; i++){ if(S.kmItems[i] && S.kmItems[i].id === rec.id){ S.kmItems[i] = rec; return rec.id; } }
  S.kmItems.push(rec);
  return rec.id;
}
function jhCopy(o){ return JSON.parse(JSON.stringify(o == null ? null : o)); }
function jhProgs(){ return jhItems('prog').slice().sort(function(a, b){ return String(a.from || '').localeCompare(String(b.from || '')); }); }
/* その日に行っている実習（期間の中の日） */
function jhCurrent(ymd){
  ymd = ymd || today();
  return jhProgs().filter(function(p){ return isYmd(p.from) && isYmd(p.to) && p.from <= ymd && ymd <= p.to; });
}
function jhProgName(id){ var p = jhItem(id); return p ? (p.name || '実習') : ''; }
/* 出発の目安：集合時刻 −（家からの分＋通学の設定の「余裕」）。家からの分が無いときは集合時刻だけ */
function jhLeave(p){
  var g = minutesOf(p && p.gather);
  if(g == null) return null;
  var tr = toNum(p.travel);
  if(!tr) return { gather:p.gather };
  var buf = toNum(S.commute && S.commute.buffer);
  return { gather:p.gather, leave:hhmmOf(g - tr - buf), travel:tr, buffer:buf };
}
function jhInp(k, label, v, ph, type, extra){
  return '<div><label class="f" for="jh_f_' + k + '">' + label + '</label><input' + (type ? ' type="' + type + '"' : '') + ' id="jh_f_' + k + '" class="jh-in" data-k="' + k + '" value="' + esc(v == null ? '' : v) + '"' +
    (ph ? ' placeholder="' + esc(ph) + '"' : '') + (extra || '') + '></div>';
}
function jhArea(k, label, v, ph, rows){
  return '<div class="field"><label class="f" for="jh_f_' + k + '">' + label + '</label><textarea id="jh_f_' + k + '" class="jh-in" data-k="' + k + '" rows="' + (rows || 3) + '"' +
    (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>' + esc(v == null ? '' : v) + '</textarea></div>';
}
function jhFormBtns(save, delAct, id){
  return '<div class="pair" style="margin-top:10px"><button class="btn" data-act="' + save + '">保存する</button>' +
    '<button class="btn ghost" style="flex:0 0 auto;padding:11px 14px" data-act="jh-f-cancel">やめる</button></div>' +
    (id && delAct ? '<button class="mini" style="margin-top:8px" data-act="' + delAct + '" data-id="' + esc(id) + '">この記録を消す</button>' : '');
}
function jhProgSelect(cur){
  var ps = jhProgs();
  return '<div><label class="f" for="jh_f_progId">実習</label><select id="jh_f_progId" class="jh-in" data-k="progId"><option value="">（えらばない）</option>' +
    ps.map(function(p){ return '<option value="' + esc(p.id) + '"' + (cur === p.id ? ' selected' : '') + '>' + esc(p.name || '実習') + '</option>'; }).join('') + '</select></div>';
}

/* ============================== 受け持ちメモ（この端末だけ） ==============================
   S にも kmItems にも kmData にも入れない。読み書きはこの2つの関数だけ。 */
function jhCareAll(){
  try{ var a = JSON.parse(localStorage.getItem(JH_CARE_LS) || '[]'); return Array.isArray(a) ? a.filter(function(x){ return x && x.id; }) : []; }
  catch(e){ return []; }
}
function jhCareSave(list){
  try{ localStorage.setItem(JH_CARE_LS, JSON.stringify(list)); return true; }
  catch(e){ toast('保存できませんでした（端末の空きが足りないかもしれません）', true); return false; }
}
/* イニシャルは、ローマ字と「.」「・」だけ（漢字・かなの名前を入れないように） */
function jhIniOk(s){
  s = String(s || '').trim();
  try{ s = s.normalize('NFKC'); }catch(e){}
  return /^[A-Za-z][A-Za-z.・ ]{0,5}$/.test(s) ? s.toUpperCase() : '';
}
var JH_CARE_WARN = '実名・患者ID・生年月日など、個人が特定できる情報は書かないでください';

/* ============================== 画面 ============================== */
function jhView(){
  var h = '<div class="pillrow jh-nav">' + JH_TABS.map(function(t){
    return '<button data-act="jh-tab" data-v="' + t[0] + '" class="' + (jhUi.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
  }).join('') + '</div>';
  if(jhUi.tab === 'diary') return h + jhDiaryHtml();
  if(jhUi.tab === 'skills') return h + jhSkillsHtml();
  if(jhUi.tab === 'vital') return h + jhVitalHtml();
  if(jhUi.tab === 'care') return h + jhCareHtml();
  return jhTodayHtml() + h + jhHomeHtml();
}
/* 今日の実習カード（実習期間の日だけ、タブの先頭に） */
function jhTodayHtml(){
  var td = today();
  return jhCurrent(td).map(function(p){
    var n = daysBetween(td, p.to), lv = jhLeave(p);
    var goal = (jhUi.goal && jhUi.goal.pid === p.id) ? jhUi.goal.v : ((p.goals || {})[td] || '');
    var ck = (p.checks || {})[td] || {}, items = Array.isArray(p.items) ? p.items : [];
    var done = items.filter(function(it){ return ck[it.id]; }).length;
    var inner = '<div class="jh-hd"><b>' + esc(p.name || '実習') + '</b><span class="s">' + (p.place ? esc(p.place) + '・' : '') +
      (n === 0 ? '今日が最終日' : 'あと' + n + '日') + '</span></div>' +
      (lv ? '<div class="jh-leave">' + (lv.leave
        ? '出発の目安 <b class="num">' + esc(lv.leave) + '</b><span class="s">（集合 ' + esc(lv.gather) + '・移動 ' + lv.travel + '分' + (lv.buffer ? '＋余裕 ' + lv.buffer + '分' : '') + '）</span>'
        : '集合 <b class="num">' + esc(lv.gather) + '</b>') + '</div>' : '') +
      '<label class="f" for="jh_goal_' + esc(p.id) + '">今日の目標</label>' +
      '<input id="jh_goal_' + esc(p.id) + '" class="jh-goal" data-pid="' + esc(p.id) + '" value="' + esc(goal) + '" placeholder="例：受け持ちの方のバイタルを時間内に測って報告する" maxlength="120">' +
      (items.length ? '<div class="jh-ckhd s">持ち物 ' + done + '/' + items.length + '</div><div class="jh-cks">' + items.map(function(it){
        return '<label class="jh-ck"><input type="checkbox" data-act="jh-ck" data-pid="' + esc(p.id) + '" data-iid="' + esc(it.id) + '"' + (ck[it.id] ? ' checked' : '') + '><span>' + esc(it.t) + '</span></label>';
      }).join('') + '</div>' : '') +
      '<div class="pillrow" style="margin-top:10px;margin-bottom:0"><button class="mini" data-act="jh-diary-today" data-pid="' + esc(p.id) + '">📝 今日の日誌</button></div>';
    return section('今日の実習', ymdLabel(td), inner);
  }).join('');
}
function jhHomeHtml(){
  var ps = jhProgs(), td = today(), f = jhUi.f && jhUi.f.kind === 'prog' ? jhUi.f : null;
  var h = '';
  if(f) h += jhProgFormHtml(f);
  if(!ps.length && !f) h += '<div class="empty">実習はまだ登録されていません。</div>';
  h += ps.map(function(p){
    var st = !isYmd(p.from) ? '' : td < p.from ? 'あと' + daysBetween(td, p.from) + '日で始まる' : td > p.to ? '終わった' : '実習中';
    return '<div class="row"><div class="grow"><div class="t">' + esc(p.name || '実習') + '</div>' +
      '<div class="s">' + [isYmd(p.from) ? ymdLabel(p.from) + '〜' + (isYmd(p.to) ? ymdLabel(p.to) : '') : '', p.place ? esc(p.place) : '', p.gather ? '集合 ' + esc(p.gather) : '', st].filter(Boolean).join('・') + '</div></div>' +
      '<button class="mini" data-act="jh-prog-edit" data-id="' + esc(p.id) + '">直す</button></div>';
  }).join('');
  if(!f) h += '<button class="mini" style="margin-top:8px" data-act="jh-prog-new">＋ 実習を登録</button>';
  return section('実習の登録', ps.length ? ps.length + '件' : null, h);
}
function jhProgFormHtml(f){
  var items = Array.isArray(f.items) ? f.items : [];
  return '<div class="jh-form">' +
    '<div class="field">' + jhInp('name', '実習名', f.name, '例：基礎看護学実習Ⅱ') + '</div>' +
    '<div class="grid2">' + jhInp('from', '開始日', f.from, '', 'date') + jhInp('to', '終了日', f.to, '', 'date') + '</div>' +
    '<div class="field">' + jhInp('place', '場所', f.place, '例：〇〇病院 5階東病棟') + '</div>' +
    '<div class="grid2">' + jhInp('gather', '集合時刻', f.gather, '08:30', 'time') + jhInp('travel', '家からの時間（分・なくてもよい）', f.travel, '例：60', '', ' inputmode="numeric"') + '</div>' +
    '<p class="note">家からの時間を入れると、集合時刻から「移動の分＋通学の設定の余裕」を引いて、出発の目安を出します。</p>' +
    '<label class="f">持ち物</label><div class="jh-items">' + items.map(function(it, i){
      return '<div class="pair jh-itrow"><input class="jh-it" data-i="' + i + '" id="jh_it_' + i + '" value="' + esc(it.t) + '" aria-label="持ち物">' +
        '<button class="mini" style="flex:0 0 auto" data-act="jh-f-item-del" data-i="' + i + '" aria-label="消す">✕</button></div>';
    }).join('') + '</div>' +
    '<button class="mini" data-act="jh-f-item-add">＋ 持ち物を足す</button>' +
    jhFormBtns('jh-prog-save', 'jh-prog-del', f.id) + '</div>';
}
/* 実習日誌（SOAP＋自由メモ＋自己評価） */
function jhDiaryHtml(){
  var f = jhUi.f && jhUi.f.kind === 'diary' ? jhUi.f : null;
  var list = jhItems('diary').slice().sort(function(a, b){ return String(b.date || '').localeCompare(String(a.date || '')) || (b.mt || 0) - (a.mt || 0); });
  var h = '<p class="note jh-warn">' + esc(JH_CARE_WARN) + '（イニシャル・年代くらいまでに）。</p>';
  if(f){
    h += '<div class="jh-form">' +
      '<div class="grid2">' + jhInp('date', '日付', f.date, '', 'date') + jhProgSelect(f.progId) + '</div>' +
      jhArea('s', 'S（主観的情報）', f.s, '話されたこと・訴え') +
      jhArea('o', 'O（客観的情報）', f.o, '観察したこと・測った値') +
      jhArea('a', 'A（アセスメント）', f.a, 'S・Oから考えたこと') +
      jhArea('p', 'P（計画）', f.p, '明日へのつなぎ・計画') +
      jhArea('memo', '自由メモ', f.memo, '学んだこと・指導されたこと・気づき') +
      '<label class="f">自己評価</label><div class="pillrow jh-stars">' + [1, 2, 3, 4, 5].map(function(n){
        return '<button data-act="jh-f-self" data-v="' + n + '" class="' + (toNum(f.self) === n ? 'on' : '') + '">' + '★'.repeat(n) + '</button>';
      }).join('') + '</div>' +
      jhFormBtns('jh-diary-save', 'jh-diary-del', f.id) + '</div>';
  }else{
    h += '<button class="mini" data-act="jh-diary-today">＋ 今日の日誌を書く</button>';
  }
  var show = jhUi.dList ? list : list.slice(0, 20);
  h += list.length ? '<div class="jh-list">' + show.map(function(d){
    var body = [d.s, d.o, d.a, d.p, d.memo].filter(function(x){ return String(x || '').trim(); })[0] || '';
    return '<div class="row" data-act="jh-diary-open" data-id="' + esc(d.id) + '" role="button" style="cursor:pointer"><div class="grow">' +
      '<div class="t">' + (isYmd(d.date) ? ymdLabel(d.date) : '日付なし') + (d.progId ? '<span class="s">　' + esc(jhProgName(d.progId) || '（消した実習）') + '</span>' : '') + '</div>' +
      '<div class="s">' + (toNum(d.self) ? '<span class="jh-star">' + '★'.repeat(toNum(d.self)) + '</span>　' : '') + esc(String(body).slice(0, 60)) + '</div></div><span class="s2">›</span></div>';
  }).join('') + '</div>' : (f ? '' : '<div class="empty">日誌はまだありません。</div>');
  if(list.length > 20) h += '<button class="mini" data-act="jh-diary-list">' + (jhUi.dList ? 'たたむ' : 'ぜんぶ見る（' + list.length + '件）') + '</button>';
  return section('実習日誌', list.length ? list.length + '日' : null, h);
}
/* 看護技術チェックリスト */
function jhSkillState(){ var d = (S.kmData || {})['jisshu:skills']; return (d && d.v && typeof d.v === 'object') ? d.v : {}; }
function jhSkillsHtml(){
  var v = jhSkillState(), cnt = [0, 0, 0, 0];
  JH_SKILLS.forEach(function(s){ cnt[Math.max(0, Math.min(3, toNum(v[s[0]])))]++; });
  var h = '<div class="jh-sum s">' + JH_ST.map(function(x, i){ return x[0] + ' ' + cnt[i]; }).join('・') + '</div>';
  h += JH_SKILLS.map(function(s){
    var cur = Math.max(0, Math.min(3, toNum(v[s[0]])));
    return '<div class="jh-sk"><div class="t">' + esc(s[1]) + '</div><div class="pillrow jh-skp">' + JH_ST.map(function(x, i){
      return '<button data-act="jh-sk" data-id="' + s[0] + '" data-v="' + i + '" class="' + (cur === i ? 'on' : '') + (x[1] ? ' jh-' + x[1] : '') + '">' + x[0] + '</button>';
    }).join('') + '</div></div>';
  }).join('');
  h += '<p class="note">基礎看護技術のよくある項目です。実習の手引き・技術到達度の表がある場合は、そちらを正としてください。</p>';
  return section('看護技術チェックリスト', '自立 ' + cnt[3] + '/' + JH_SKILLS.length, h);
}
/* バイタル練習記録 */
var JH_VF = [['bt', '体温（℃）', '36.5'], ['pr', '脈拍（回/分）', '72'], ['rr', '呼吸数（回/分）', '16'], ['sbp', '血圧 収縮期', '118'], ['dbp', '血圧 拡張期', '72'], ['spo2', 'SpO2（%）', '98']];
/* 目安から外れていそうな値に印（成人の一般的な目安。判断には使わない） */
function jhVOut(k, v){
  if(v === '' || v == null) return false;
  v = Number(v);
  return k === 'bt' ? (v >= 37.5 || v < 35.5) : k === 'pr' ? (v < 50 || v > 100) : k === 'rr' ? (v < 12 || v > 20) :
    k === 'sbp' ? (v >= 140 || v < 90) : k === 'dbp' ? (v >= 90) : k === 'spo2' ? (v < 95) : false;
}
function jhVitalHtml(){
  var f = jhUi.f && jhUi.f.kind === 'vital' ? jhUi.f : null;
  var list = jhItems('vital').slice().sort(function(a, b){ return String(b.date || '').localeCompare(String(a.date || '')) || (b.mt || 0) - (a.mt || 0); });
  var h = '<div class="bn amber jh-label"><span class="ic">🩺</span><span class="grow"><b>自分の練習用の記録</b>です（自分の値・練習相手の値）。患者さんの値は入れないでください。</span></div>';
  if(f){
    h += '<div class="jh-form"><div class="grid2">' + jhInp('date', '日付', f.date, '', 'date') +
      '<div><label class="f">だれの値</label><div class="pillrow">' + [['self', '自分'], ['pair', '練習相手']].map(function(o){
        return '<button data-act="jh-f-who" data-v="' + o[0] + '" class="' + ((f.who || 'self') === o[0] ? 'on' : '') + '">' + o[1] + '</button>';
      }).join('') + '</div></div></div>' +
      '<div class="grid3">' + JH_VF.map(function(x){ return jhInp(x[0], x[1], f[x[0]], x[2], '', ' inputmode="decimal"'); }).join('') + '</div>' +
      '<div class="field">' + jhInp('memo', 'メモ', f.memo, '例：測る前に5分安静にした') + '</div>' +
      jhFormBtns('jh-vital-save', 'jh-vital-del', f.id) + '</div>';
  }else{
    h += '<button class="mini" data-act="jh-vital-new">＋ 記録を足す</button>';
  }
  if(list.length){
    var show = jhUi.vList ? list : list.slice(0, 30);
    h += '<div class="jh-scroll"><table class="jh-tbl"><thead><tr><th>日付</th><th>だれ</th><th>体温</th><th>脈拍</th><th>呼吸</th><th>血圧</th><th>SpO2</th></tr></thead><tbody>' +
      show.map(function(x){
        var c = function(k, v){ return '<td class="num' + (jhVOut(k, x[k]) ? ' jh-out' : '') + '">' + esc(v) + '</td>'; };
        return '<tr data-act="jh-vital-edit" data-id="' + esc(x.id) + '" role="button"><td>' + (isYmd(x.date) ? esc(x.date.slice(5).replace('-', '/')) : '') + '</td>' +
          '<td>' + (x.who === 'pair' ? '相手' : '自分') + '</td>' + c('bt', x.bt === '' || x.bt == null ? '' : x.bt) + c('pr', x.pr == null ? '' : x.pr) + c('rr', x.rr == null ? '' : x.rr) +
          '<td class="num' + (jhVOut('sbp', x.sbp) || jhVOut('dbp', x.dbp) ? ' jh-out' : '') + '">' + esc((x.sbp !== '' && x.sbp != null ? x.sbp : '') + (x.dbp !== '' && x.dbp != null ? '/' + x.dbp : '')) + '</td>' +
          c('spo2', x.spo2 == null ? '' : x.spo2) + '</tr>';
      }).join('') + '</tbody></table></div>' +
      (list.length > 30 ? '<button class="mini" data-act="jh-vital-list">' + (jhUi.vList ? 'たたむ' : 'ぜんぶ見る（' + list.length + '件）') + '</button>' : '') +
      '<p class="note">色のついた値は、成人の一般的な目安から外れているものです（練習のふりかえり用。判断には使わないでください）。行を押すと直せます。</p>';
  }else if(!f){
    h += '<div class="empty">まだ記録がありません。</div>';
  }
  return section('バイタル練習記録', list.length ? list.length + '件' : null, h);
}
/* 受け持ちメモ（この端末だけ） */
function jhCareHtml(){
  var f = jhUi.f && jhUi.f.kind === 'care' ? jhUi.f : null;
  var list = jhCareAll().slice().sort(function(a, b){ return (b.mt || 0) - (a.mt || 0); });
  var h = '<div class="bn red jh-carewarn"><span class="ic">⚠</span><span class="grow"><b>' + esc(JH_CARE_WARN) + '。</b><br>' +
    'イニシャル・年代・性別とメモだけにしてください。</span></div>' +
    '<p class="note">受け持ちメモは<b>この端末の中だけ</b>に置きます。ほかの端末との同期・AI・Discord・朝や週のまとめ・バックアップには入りません。実習が終わったら消してください。</p>';
  if(f){
    h += '<div class="jh-form"><div class="grid2">' + jhInp('ini', 'イニシャル（ローマ字）', f.ini, '例：A.K', '', ' maxlength="6" autocomplete="off" autocapitalize="characters"') +
      '<div><label class="f" for="jh_f_age">年齢層</label><select id="jh_f_age" class="jh-in" data-k="age"><option value="">（えらぶ）</option>' +
      JH_AGES.map(function(a){ return '<option' + (f.age === a ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('') + '</select></div></div>' +
      '<label class="f">性別</label><div class="pillrow">' + JH_SEX.map(function(s){
        return '<button data-act="jh-f-sex" data-v="' + esc(s) + '" class="' + (f.sex === s ? 'on' : '') + '">' + esc(s) + '</button>';
      }).join('') + '</div>' +
      '<p class="note jh-warn">' + esc(JH_CARE_WARN) + '。</p>' +
      jhArea('memo', 'メモ', f.memo, '例：右片麻痺。午前は清拭、午後にリハビリ。', 5) +
      jhFormBtns('jh-care-save', 'jh-care-del', f.id) + '</div>';
  }else{
    h += '<button class="mini" data-act="jh-care-new">＋ 受け持ちメモを足す</button>';
  }
  h += list.length ? '<div class="jh-list">' + list.map(function(c){
    return '<div class="row" data-act="jh-care-edit" data-id="' + esc(c.id) + '" role="button" style="cursor:pointer"><div class="grow">' +
      '<div class="t">' + esc(c.ini || '—') + '<span class="s">　' + esc([c.age, c.sex].filter(Boolean).join('・')) + '</span></div>' +
      '<div class="s">' + esc(String(c.memo || '').slice(0, 60)) + '</div></div><span class="s2">›</span></div>';
  }).join('') + '</div>' +
    '<button class="mini" style="margin-top:8px" data-act="jh-care-clear">この端末の受け持ちメモをぜんぶ消す</button>' : (f ? '' : '<div class="empty">受け持ちメモはありません。</div>');
  return section('受け持ちメモ', 'この端末だけ', h);
}

/* ============================== 今日タブの帯 ==============================
   実習期間の日だけ（試験の帯と同じ流儀。today.js の viewDay から呼ぶ） */
function jhStrip(){
  var td = today();
  return jhCurrent(td).map(function(p){
    var n = daysBetween(td, p.to), goal = (p.goals || {})[td] || '';
    return '<div class="bn green jh-bn" data-act="go-exam" data-app="jisshu" role="button" style="cursor:pointer">' +
      '<span class="ic">🩺</span><span class="grow">実習中：<b>' + esc(p.name || '実習') + '</b>（' + (n === 0 ? '今日が最終日' : 'あと' + n + '日') + '）' +
      (goal ? '・今日の目標 ' + esc(goal) : '') + '</span><span class="s2">›</span></div>';
  }).join('');
}

/* ============================== 保存 ============================== */
function jhFormNew(kind, o){ jhUi.f = Object.assign({ kind:kind, id:'' }, o || {}); }
function jhProgSave(){
  var f = jhUi.f;
  var name = String(f.name || '').trim();
  if(!name){ toast('実習名を入れてください', true); return; }
  if(!isYmd(f.from) || !isYmd(f.to)){ toast('開始日と終了日を入れてください', true); return; }
  if(f.to < f.from){ toast('終了日が開始日より前になっています', true); return; }
  var old = f.id ? jhItem(f.id) : null;
  var rec = old ? jhCopy(old) : { goals:{}, checks:{} };
  rec.name = name.slice(0, 60); rec.from = f.from; rec.to = f.to;
  rec.place = String(f.place || '').trim().slice(0, 80);
  rec.gather = jhHhmm(f.gather);
  rec.travel = toNum(f.travel) > 0 ? Math.min(600, toNum(f.travel)) : '';
  rec.items = (f.items || []).map(function(it){ return { id:it.id || uid('jhi'), t:String(it.t || '').trim().slice(0, 60) }; }).filter(function(it){ return it.t; });
  jhPut('prog', rec);
  jhUi.f = null;
  toast(old ? '実習を直しました' : '実習を登録しました');
  commit();
}
function jhDiarySave(){
  var f = jhUi.f;
  if(!isYmd(f.date)){ toast('日付を入れてください', true); return; }
  var rec = f.id && jhItem(f.id) ? jhCopy(jhItem(f.id)) : {};
  rec.date = f.date; rec.progId = f.progId || '';
  ['s', 'o', 'a', 'p', 'memo'].forEach(function(k){ rec[k] = String(f[k] || '').slice(0, 3000); });
  rec.self = Math.max(0, Math.min(5, toNum(f.self)));
  jhPut('diary', rec);
  jhUi.f = null;
  toast('日誌を保存しました');
  commit();
}
function jhVitalSave(){
  var f = jhUi.f;
  if(!isYmd(f.date)){ toast('日付を入れてください', true); return; }
  var rec = f.id && jhItem(f.id) ? jhCopy(jhItem(f.id)) : {};
  rec.date = f.date; rec.who = f.who === 'pair' ? 'pair' : 'self';
  JH_VF.forEach(function(x){ rec[x[0]] = jhNum(f[x[0]]); });
  if(JH_VF.every(function(x){ return rec[x[0]] === ''; })){ toast('値を1つ以上入れてください', true); return; }
  rec.memo = String(f.memo || '').trim().slice(0, 200);
  jhPut('vital', rec);
  jhUi.f = null;
  toast('記録しました');
  commit();
}
function jhCareSaveForm(){
  var f = jhUi.f;
  var ini = jhIniOk(f.ini);
  if(!ini){ toast('イニシャルはローマ字で入れてください（例：A.K）', true); return; }
  var memo = String(f.memo || '').slice(0, 1000);
  /* 名前・電話番号・生年月日らしい文字があれば、保存の前にたしかめる */
  if(typeof rsMask === 'function' && rsMask(memo).n > 0 &&
     !confirm('メモに、名前・電話番号・生年月日・住所などらしい文字があります。\n' + JH_CARE_WARN + '。\nこのまま保存しますか？')) return;
  var list = jhCareAll().filter(function(x){ return x.id !== f.id; });
  list.push({ id:f.id || uid('jhc'), mt:Date.now(), ini:ini, age:JH_AGES.indexOf(f.age) >= 0 ? f.age : '', sex:JH_SEX.indexOf(f.sex) >= 0 ? f.sex : '', memo:memo });
  if(!jhCareSave(list)) return;
  jhUi.f = null;
  toast('この端末に保存しました');
  render();
}
function jhGoalSave(pid, v){
  var p = jhItem(pid);
  jhUi.goal = null;
  if(!p) return;
  var td = today(), rec = jhCopy(p);
  v = String(v || '').trim().slice(0, 120);
  rec.goals = rec.goals || {};
  if((rec.goals[td] || '') === v) return;
  if(v) rec.goals[td] = v; else delete rec.goals[td];
  jhPut('prog', rec);
  persist(); pushRemote();
}

/* ============================== 操作 ============================== */
kmView('jisshu', jhView);
kmAction(function(act, t){
  if(act.indexOf('jh-') !== 0) return false;
  var v = t.dataset ? t.dataset.v : '', id = t.dataset ? t.dataset.id : '';
  var f = jhUi.f;
  switch(act){
    case 'jh-tab': jhUi.tab = v || 'home'; jhUi.f = null; render(); window.scrollTo(0, 0); return true;
    case 'jh-f-cancel': jhUi.f = null; render(); return true;
    /* 実習の登録 */
    case 'jh-prog-new':
      jhFormNew('prog', { name:'', from:today(), to:shiftDate(today(), 4), place:'', gather:'08:30', travel:'',
        items:JH_ITEMS_DEF.map(function(s){ return { id:uid('jhi'), t:s }; }) });
      render(); return true;
    case 'jh-prog-edit':
      var p = jhItem(id); if(!p) return true;
      jhFormNew('prog', { id:p.id, name:p.name, from:p.from, to:p.to, place:p.place, gather:p.gather, travel:p.travel, items:jhCopy(p.items || []) });
      jhUi.tab = 'home'; render(); return true;
    case 'jh-f-item-add': if(f){ f.items = (f.items || []).concat([{ id:uid('jhi'), t:'' }]); render(); var el = document.getElementById('jh_it_' + (f.items.length - 1)); if(el) el.focus(); } return true;
    case 'jh-f-item-del': if(f && f.items){ f.items.splice(toNum(t.dataset.i), 1); render(); } return true;
    case 'jh-prog-save': if(f) jhProgSave(); return true;
    case 'jh-prog-del':
      if(!confirm('この実習を消しますか？（日誌・バイタルの記録は残ります）')) return true;
      removeItem('kmItems', id); jhUi.f = null; toast('消しました'); commit(); return true;
    /* 今日の持ち物 */
    case 'jh-ck':
      var pc = jhItem(t.dataset.pid); if(!pc) return true;
      var rc = jhCopy(pc), td = today();
      rc.checks = rc.checks || {};
      /* 古い日の印は、30日をすぎたら片づける */
      Object.keys(rc.checks).forEach(function(d){ if(d < shiftDate(td, -30)) delete rc.checks[d]; });
      var day = rc.checks[td] = rc.checks[td] || {};
      if(day[t.dataset.iid]) delete day[t.dataset.iid]; else day[t.dataset.iid] = 1;
      jhPut('prog', rc); commit(); return true;
    /* 日誌 */
    case 'jh-diary-today':
      var td2 = today(), pid = t.dataset.pid || ((jhCurrent(td2)[0] || {}).id) || '';
      var ex = jhItems('diary').filter(function(d){ return d.date === td2 && (!pid || d.progId === pid); })[0];
      jhUi.tab = 'diary';
      if(ex) jhFormNew('diary', jhCopy(ex)); else jhFormNew('diary', { date:td2, progId:pid, s:'', o:'', a:'', p:'', memo:'', self:0 });
      jhUi.f.kind = 'diary';
      render(); window.scrollTo(0, 0); return true;
    case 'jh-diary-open':
      var dd = jhItem(id); if(!dd) return true;
      jhFormNew('diary', jhCopy(dd)); jhUi.f.kind = 'diary'; render(); window.scrollTo(0, 0); return true;
    case 'jh-f-self': if(f){ f.self = toNum(f.self) === toNum(v) ? 0 : toNum(v); render(); } return true;
    case 'jh-diary-save': if(f) jhDiarySave(); return true;
    case 'jh-diary-del':
      if(!confirm('この日誌を消しますか？')) return true;
      removeItem('kmItems', id); jhUi.f = null; toast('消しました'); commit(); return true;
    case 'jh-diary-list': jhUi.dList = !jhUi.dList; render(); return true;
    /* 看護技術 */
    case 'jh-sk':
      var cur = jhCopy(jhSkillState()), n = Math.max(0, Math.min(3, toNum(v)));
      if(n) cur[id] = n; else delete cur[id];
      S.kmData = S.kmData || {};
      S.kmData['jisshu:skills'] = { v:cur, mt:Date.now() };
      touch('kmData'); commit(); return true;
    /* バイタル */
    case 'jh-vital-new': jhFormNew('vital', { date:today(), who:'self' }); render(); return true;
    case 'jh-vital-edit':
      var vv = jhItem(id); if(!vv) return true;
      jhFormNew('vital', jhCopy(vv)); jhUi.f.kind = 'vital'; render(); window.scrollTo(0, 0); return true;
    case 'jh-f-who': if(f){ f.who = v; render(); } return true;
    case 'jh-vital-save': if(f) jhVitalSave(); return true;
    case 'jh-vital-del':
      if(!confirm('この記録を消しますか？')) return true;
      removeItem('kmItems', id); jhUi.f = null; toast('消しました'); commit(); return true;
    case 'jh-vital-list': jhUi.vList = !jhUi.vList; render(); return true;
    /* 受け持ちメモ（この端末だけ。commit しない＝S は変えない） */
    case 'jh-care-new': jhFormNew('care', { ini:'', age:'', sex:'', memo:'' }); render(); return true;
    case 'jh-care-edit':
      var cc = jhCareAll().filter(function(x){ return x.id === id; })[0]; if(!cc) return true;
      jhFormNew('care', { id:cc.id, ini:cc.ini, age:cc.age, sex:cc.sex, memo:cc.memo }); render(); window.scrollTo(0, 0); return true;
    case 'jh-f-sex': if(f){ f.sex = f.sex === v ? '' : v; render(); } return true;
    case 'jh-care-save': if(f) jhCareSaveForm(); return true;
    case 'jh-care-del':
      if(!confirm('この受け持ちメモを消しますか？')) return true;
      jhCareSave(jhCareAll().filter(function(x){ return x.id !== id; })); jhUi.f = null; toast('消しました'); render(); return true;
    case 'jh-care-clear':
      if(!confirm('この端末の受け持ちメモを、ぜんぶ消しますか？（もとにもどせません）')) return true;
      try{ localStorage.removeItem(JH_CARE_LS); }catch(e){}
      jhUi.f = null; toast('ぜんぶ消しました'); render(); return true;
  }
  return false;
});
/* 打っている字を覚えておく（同期などで描き直しても消えないように） */
document.addEventListener('input', function(e){
  var t = e.target;
  if(!t || !t.classList) return;
  if(t.classList.contains('jh-in') && jhUi.f) jhUi.f[t.dataset.k] = t.value;
  if(t.classList.contains('jh-it') && jhUi.f && jhUi.f.items){ var it = jhUi.f.items[toNum(t.dataset.i)]; if(it) it.t = t.value; }
  if(t.classList.contains('jh-goal')) jhUi.goal = { pid:t.dataset.pid, v:t.value };
});
document.addEventListener('change', function(e){
  var t = e.target;
  if(!t || !t.classList) return;
  if(t.classList.contains('jh-in') && jhUi.f) jhUi.f[t.dataset.k] = t.value;
  if(t.classList.contains('jh-goal')) jhGoalSave(t.dataset.pid, t.value);
});

/* ============================== AIに見せる前に ==============================
   日誌などに書いた名前らしい文字・電話番号・くわしい年齢を伏せる（看護過程と同じ rsMask）。
   受け持ちメモは S に無いので、ここまで来ない。 */
if(typeof kmAiMask === 'function') kmAiMask('jisshu', function(s){ return typeof rsMask === 'function' ? rsMask(s).text : s; });
