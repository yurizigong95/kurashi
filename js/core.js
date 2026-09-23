/* くらしの手帳：定数・祝日・小道具・状態・集計 */
/* ============================== 定数 ============================== */
var ACCOUNTS = {
  smbc:    { id:'smbc',    bank:'三井住友銀行', card:'オリコ',     cls:'smbc' },
  rakuten: { id:'rakuten', bank:'楽天銀行',     card:'楽天カード', cls:'rakuten' }
};
var SEED = [
  { id:'p_futon',  name:'ふとん', accountId:'smbc',    count:6,  monthly:32321, firstAmount:null, start:'2026-09' },
  { id:'p_ipad',   name:'iPad',   accountId:'smbc',    count:6,  monthly:15300, firstAmount:null, start:'2026-10' },
  { id:'p_iphone', name:'iPhone', accountId:'rakuten', count:24, monthly:8116,  firstAmount:8132, start:'2026-09' }
];
/* ===== テストモード =====
   ・URLに ?test=1 をつけたとき
   ・パソコンの中（localhost / 127.0.0.1）で開いたとき（?real=1 で本番あつかい）
   本物のデータ（この端末の保存・同期・Google）には一切さわらない。 */
var TEST_MODE = (function(){
  try{
    var q = location.search || '';
    if(/[?&]test=1\b/.test(q)) return true;
    if(/[?&]real=1\b/.test(q)) return false;
    return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  }catch(e){ return false; }
})();
/* テストでは ?dev=名前 ごとに別の端末として保存場所を分ける */
var TEST_DEV = (function(){ try{ var m = String(location.search).match(/[?&]dev=([A-Za-z0-9_-]{1,20})/); return m ? m[1] : ''; }catch(e){ return ''; } })();
var KEY = TEST_MODE ? 'shiharai:v1:test' + (TEST_DEV ? ':' + TEST_DEV : '') : 'shiharai:v1';
var DATA_VER = 17;
var APP_BUILD = '2026-09-23b';   /* 端末ごとの版を見分けるための番号 */
/* 同期の初期設定（設定タブからいつでも変えられます） */
var DEFAULT_ROOM = TEST_MODE ? 'test-room' : '8b7f4e6et9jhxded';
var DEFAULT_FB = '{"apiKey":"AIzaSyAdXfCOY2Fk4wDXr38j4ompBHaBLEPRWww","authDomain":"kurashi-59562.firebaseapp.com","projectId":"kurashi-59562","storageBucket":"kurashi-59562.firebasestorage.app","messagingSenderId":"203275210981","appId":"1:203275210981:web:327cf32ad4aa6ebc6b040c"}';
var imgKey = function(id){ return (TEST_MODE ? 'shiharai:test:img:' : 'shiharai:img:') + id; };

var COLORS = [
  {id:'c1', name:'サンゴ',   v:'#E2664B'}, {id:'c2', name:'オレンジ', v:'#E08A2E'},
  {id:'c3', name:'イエロー', v:'#C79A18'}, {id:'c4', name:'グリーン', v:'#4E9A5B'},
  {id:'c5', name:'ミント',   v:'#3FA89A'}, {id:'c6', name:'スカイ',   v:'#3D8FC4'},
  {id:'c7', name:'ブルー',   v:'#4C68C0'}, {id:'c8', name:'パープル', v:'#8163B8'},
  {id:'c9', name:'ピンク',   v:'#D25F94'}, {id:'c10',name:'グレー',   v:'#7A8290'}
];
function colorOf(id){
  for(var i=0;i<COLORS.length;i++) if(COLORS[i].id===id) return COLORS[i].v;
  return COLORS[9].v;
}
var KINDS = [
  {id:'task',  name:'課題',    hex:'#F5A3C0', fg:'#3B1F2B', tab:'ToDo'},
  {id:'quiz',  name:'小テスト',hex:'#FFD9A0', fg:'#4A3410', tab:'授業'},
  {id:'exam',  name:'大テスト',hex:'#B0311A', fg:'#FFFFFF', tab:'授業'},
  {id:'kousa', name:'考査',    hex:'#0D2B7A', fg:'#FFFFFF', tab:'授業'},
  {id:'work',  name:'バイト',  hex:'#A8DCF7', fg:'#12324A', tab:'お金 › バイト'},
  {id:'imp',   name:'重要',    hex:'#F0C8F5', fg:'#3E1B45', tab:'予定 › 重要'},
  {id:'other', name:'その他',  hex:'#D4F0B5', fg:'#213D14', tab:'カレンダーだけ'}
];
/* 描いている間だけ使う、使い回しの置き場（描き終わったら捨てる） */
var __rc = null;
function rcache(key, fn){
  if(!__rc) return fn();
  if(!Object.prototype.hasOwnProperty.call(__rc, key)) __rc[key] = fn();
  return __rc[key];
}
/* 自分で足した・直した種類を反映する */
function kindsAll(){ return rcache('kinds', kindsAllRaw); }
function kindsAllRaw(){
  var base = KINDS.map(function(k){ return Object.assign({}, k); });
  var my = (S.ui && Array.isArray(S.ui.kinds)) ? S.ui.kinds : null;
  if(!my) return base;
  var map = {}; base.forEach(function(k){ map[k.id] = k; });
  var out = [];
  my.forEach(function(m){
    if(m.del) return;
    var b = map[m.id];
    if(b){ out.push(Object.assign({}, b, { name:m.name||b.name, hex:m.hex||b.hex, fg:m.fg||b.fg })); }
    else if(m.custom){ out.push({ id:m.id, name:m.name||'予定', hex:m.hex||'#D4F0B5', fg:m.fg||'#213D14', tab:'カレンダー' }); }
  });
  base.forEach(function(b){ if(!my.some(function(m){ return m.id===b.id; })) out.push(b); });
  return out.length ? out : base;
}
function kindOf(id){
  var all = kindsAll();
  for(var i=0;i<all.length;i++) if(all[i].id===id) return all[i];
  for(var j=0;j<KINDS.length;j++) if(KINDS[j].id===id) return KINDS[j];
  return all[all.length-1] || KINDS[KINDS.length-1];
}
function defaultKind(){ var a = kindsAll(); return (a[0] && a[0].id) || 'task'; }
function kindHex(id){ return kindOf(id).hex; }
function kindFg(id){ return kindOf(id).fg; }
/* 期間内に起きる日をすべて返す（多すぎないよう上限つき） */

var THEMES = [
  {id:'pink',     name:'ピンク',   sw:['#EAD0D7','#D9738F']},
  {id:'peach',    name:'ピーチ',   sw:['#F4DDD2','#E0876A']},
  {id:'sakura',   name:'桜',       sw:['#F9E8EE','#C06090']},
  {id:'coral',    name:'コーラル', sw:['#F5D6D0','#D8695A']},
  {id:'lavender', name:'ラベンダー',sw:['#E3DCF1','#8E74C9']},
  {id:'lilac',    name:'ライラック',sw:['#EED9EA','#B36AA8']},
  {id:'mint',     name:'ミント',   sw:['#D9EEE4','#3E9B78']},
  {id:'sky',      name:'スカイ',   sw:['#DAE8F5','#4E8BC4']},
  {id:'lemon',    name:'レモン',   sw:['#F5EFD3','#C9A63A']},
  {id:'cream',    name:'クリーム', sw:['#F7F1E6','#B98A46']},
  {id:'mono',     name:'モノ',     sw:['#ECECEF','#5A5A66']},
  {id:'navy',     name:'紺',       sw:['#EDF1F6','#3C5A8A']},
  {id:'dark',     name:'ダーク',   sw:['#1B1720','#E38BA8']},
  {id:'custom',   name:'自分の色', sw:['#E8C8E8','#9B6BB5'], custom:1 }
];
/* 画面のスタイル（形や質感。色のテーマとは別に選べる） */
var UI_STYLES = [
  { id:'glass',   name:'すりガラス',       tag:'いつもの', desc:'いままでの、やわらかいガラス' },
  { id:'liquid',  name:'リキッドグラス',   tag:'おすすめ', desc:'水のように透きとおるガラス。ふちが光り、背景の色がにじみます' },
  { id:'aurora',  name:'ゆめかわオーロラ', tag:'おしゃれ', desc:'パステルのオーロラと、虹色のふち' },
  { id:'fuwa',    name:'ふわもこ',         tag:'かわいい', desc:'水玉の背景と、ぬいぐるみのようなステッチ' },
  { id:'clay',    name:'ねんど',           tag:'かわいい', desc:'ぷにっとした粘土のような立体' },
  { id:'pop',     name:'ぷっくりポップ',   tag:'かわいい', desc:'くっきりした線と影。シールのよう' },
  { id:'note',    name:'手帳',             tag:'おしゃれ', desc:'方眼ノートとマスキングテープ、蛍光ペン' },
  { id:'neumo',   name:'ふんわり立体',     tag:'おしゃれ', desc:'背景と同じ色で、浮き出たような形' },
  { id:'minimal', name:'すっきり',         tag:'見やすい', desc:'白くて平ら。文字が読みやすく、電池にもやさしい' }
];
function uiStyleNow(){
  var id = S.ui.style || 'glass';
  return UI_STYLES.filter(function(s){ return s.id === id; })[0] || UI_STYLES[0];
}
/* 文字の形（フォント）。gf は Google Fonts の名前で、選んだときだけ読みこむ。
   読みこむ前や電波がないときは、いつもの文字（FONT_BASE）で出る */
var FONT_BASE = '"Hiragino Maru Gothic ProN","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic Medium",sans-serif';   /* app.css の body と同じ */
var UI_FONTS = [
  { id:'std',     name:'いつもの',       tag:'いつもの', desc:'いままでの文字。iPhoneでは丸ゴシックになります', css:'' },
  { id:'bizud',   name:'UDゴシック',     tag:'見やすい', desc:'小さくても読みまちがえにくい文字', gf:'BIZ+UDPGothic:wght@400;700', css:'"BIZ UDPGothic"' },
  { id:'zenmaru', name:'やさしい丸文字', tag:'かわいい', desc:'角がまるくて、すっきり読める文字', gf:'Zen+Maru+Gothic:wght@400;500;700', css:'"Zen Maru Gothic"' },
  { id:'mplus',   name:'ころころ丸文字', tag:'かわいい', desc:'ころんと丸い、元気な文字', gf:'M+PLUS+Rounded+1c:wght@400;500;700;800', css:'"M PLUS Rounded 1c"' },
  { id:'kiwi',    name:'ほっこり',       tag:'かわいい', desc:'ふっくらして、あたたかい文字', gf:'Kiwi+Maru:wght@400;500', css:'"Kiwi Maru"' },
  { id:'klee',    name:'えんぴつ',       tag:'おしゃれ', desc:'えんぴつで書いたような、ていねいな手書き', gf:'Klee+One:wght@400;600', css:'"Klee One"' },
  { id:'yomogi',  name:'ゆる手書き',     tag:'かわいい', desc:'ペンでさらっと書いた、ゆるい手書き', gf:'Yomogi', css:'"Yomogi"' },
  { id:'hachi',   name:'まるもじ',       tag:'かわいい', desc:'手紙に書くような、まるっこい文字', gf:'Hachi+Maru+Pop', css:'"Hachi Maru Pop"' },
  { id:'mincho',  name:'明朝',           tag:'おしゃれ', desc:'本のような、上品な文字', gf:'Shippori+Mincho:wght@400;500;700;800', css:'"Shippori Mincho"' }
];
function uiFontNow(){
  var id = S.ui.font || 'std';
  return UI_FONTS.filter(function(f){ return f.id === id; })[0] || UI_FONTS[0];
}
function uiFontStack(f){ return f.css ? f.css + ',' + FONT_BASE : FONT_BASE; }
/* Google Fonts を読みこむ（1回だけ）。テストのときはネットに出ない */
function loadUiFont(f){
  if(!f || !f.gf || TEST_MODE || document.getElementById('gf-' + f.id)) return;
  var l = document.createElement('link');
  l.id = 'gf-' + f.id; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=' + f.gf + '&display=swap';
  document.head.appendChild(l);
}
/* 自分で選んだ色から、明るさ違いを作る */
function hexToRgb(h){ h=String(h||'').replace('#',''); if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return { r:parseInt(h.slice(0,2),16)||0, g:parseInt(h.slice(2,4),16)||0, b:parseInt(h.slice(4,6),16)||0 }; }
function rgbStr(c,a){ return 'rgba('+c.r+','+c.g+','+c.b+','+a+')'; }
function mix(c, t, k){ return { r:Math.round(c.r+(t.r-c.r)*k), g:Math.round(c.g+(t.g-c.g)*k), b:Math.round(c.b+(t.b-c.b)*k) }; }
function hexStr(c){ return '#'+[c.r,c.g,c.b].map(function(v){ return pad2(Math.max(0,Math.min(255,v)).toString(16)); }).join(''); }
function pad2(x){ return x.length<2 ? '0'+x : x; }
function applyCustomTheme(){
  var base = S.ui.customColor || '#E8C8E8';
  var c = hexToRgb(base);
  var white = {r:255,g:255,b:255}, black = {r:0,g:0,b:0};
  var paper  = mix(c, white, .38);
  var accent = mix(c, black, .32);
  var accent2= mix(c, white, .18);
  var ink    = mix(c, black, .78);
  var sub    = mix(c, black, .45);
  var st = document.body.style;
  st.setProperty('--paper', hexStr(paper));
  st.setProperty('--tint1', rgbStr(c, .72));
  st.setProperty('--tint2', rgbStr(mix(c, white, .35), .68));
  st.setProperty('--tint3', rgbStr(mix(c, {r:255,g:220,b:200}, .45), .50));
  st.setProperty('--accent', hexStr(accent));
  st.setProperty('--accent2', hexStr(accent2));
  st.setProperty('--ink', hexStr(ink));
  st.setProperty('--sub', hexStr(sub));
  st.setProperty('--holi', hexStr(mix(c, {r:200,g:40,b:80}, .6)));
  st.setProperty('--glasstint', rgbStr(accent2, .16));
  st.setProperty('--glasstint2', rgbStr(accent, .09));
}
function clearCustomTheme(){
  var st = document.body.style;
  ['--paper','--tint1','--tint2','--tint3','--accent','--accent2','--ink','--sub','--holi','--glasstint','--glasstint2']
    .forEach(function(k){ st.removeProperty(k); });
}
/* 文字の大きさ（css/app.css の body[data-fs] と同じ。sys は端末の「文字の大きさ」の設定に合わせる） */
var FONTS = [{id:'xs',name:'とても小さい',px:13},{id:'s',name:'小さい',px:14},{id:'m',name:'ふつう',px:15},
             {id:'l',name:'大きい',px:17},{id:'xl',name:'とても大きい',px:19.5},{id:'sys',name:'システムに合わせる',px:0}];
function c9FsNow(){ var id = S.ui.fs || 'm'; return FONTS.filter(function(f){ return f.id === id; })[0] || FONTS[2]; }
var WDAY = ['日','月','火','水','木','金','土'];
var DEEPGREEN = '#14532D';

/* ============================== 日本の祝日 ============================== */
var _holCache = {};
function nthMonday(y, m, n){            /* m は 1〜12 */
  var d = new Date(y, m-1, 1);
  var first = 1 + ((8 - d.getDay()) % 7);   /* その月の最初の月曜 */
  return new Date(y, m-1, first + (n-1)*7);
}
function holidaysOf(y){
  if(_holCache[y]) return _holCache[y];
  var h = {};
  var put = function(d, name){ h[toYmd(d)] = name; };
  var fixed = [[1,1,'元日'],[2,11,'建国記念の日'],[2,23,'天皇誕生日'],[4,29,'昭和の日'],
    [5,3,'憲法記念日'],[5,4,'みどりの日'],[5,5,'こどもの日'],[8,11,'山の日'],
    [11,3,'文化の日'],[11,23,'勤労感謝の日']];
  fixed.forEach(function(f){ put(new Date(y, f[0]-1, f[1]), f[2]); });
  put(nthMonday(y,1,2),  '成人の日');
  put(nthMonday(y,7,3),  '海の日');
  put(nthMonday(y,9,3),  '敬老の日');
  put(nthMonday(y,10,2), 'スポーツの日');
  /* 春分・秋分（1980〜2099年で使える式） */
  var t = y - 1980;
  put(new Date(y, 2, Math.floor(20.8431 + 0.242194*t - Math.floor(t/4))), '春分の日');
  put(new Date(y, 8, Math.floor(23.2488 + 0.242194*t - Math.floor(t/4))), '秋分の日');

  /* 振替休日：日曜と重なったら、次の祝日でない日 */
  Object.keys(h).slice().sort().forEach(function(k){
    var a = k.split('-'), d = new Date(+a[0], +a[1]-1, +a[2]);
    if(d.getDay() !== 0) return;
    var n = new Date(d); var guard = 0;
    do { n.setDate(n.getDate()+1); guard++; } while(h[toYmd(n)] && guard < 10);
    if(!h[toYmd(n)]) h[toYmd(n)] = '振替休日';
  });
  /* 国民の休日：祝日と祝日にはさまれた平日 */
  Object.keys(h).slice().sort().forEach(function(k){
    var a = k.split('-'), d = new Date(+a[0], +a[1]-1, +a[2]);
    var mid = new Date(d); mid.setDate(mid.getDate()+1);
    var nxt = new Date(d); nxt.setDate(nxt.getDate()+2);
    if(h[toYmd(mid)] || !h[toYmd(nxt)]) return;
    if(mid.getDay() === 0 || mid.getDay() === 6) return;
    h[toYmd(mid)] = '国民の休日';
  });
  _holCache[y] = h;
  return h;
}
function holidayName(ymd){
  if(!isYmd(ymd)) return '';
  return holidaysOf(+ymd.slice(0,4))[ymd] || '';
}

/* ============================== 小道具 ============================== */
var yen = function(n){ return '¥' + Math.round(n||0).toLocaleString('ja-JP'); };
var pad = function(n){ return String(n).padStart(2,'0'); };
var toYm = function(d){ return d.getFullYear() + '-' + pad(d.getMonth()+1); };
var toYmd = function(d){ return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); };
var thisYm = function(){ return toYm(new Date()); };
var today = function(){ return toYmd(new Date()); };
var addMonths = function(ym,n){ var a=ym.split('-').map(Number); return toYm(new Date(a[0], a[1]-1+n, 1)); };
var ymLabel = function(ym){ var a=ym.split('-'); return a[0]+'年'+Number(a[1])+'月'; };
var ymShort = function(ym){ var a=ym.split('-'); return a[0].slice(2)+'/'+a[1]; };
var isYm = function(s){ return /^\d{4}-\d{2}$/.test(s||''); };
var isYmd = function(s){ return /^\d{4}-\d{2}-\d{2}$/.test(s||''); };
function ymdLabel(s){
  if(!isYmd(s)) return s||'';
  var a=s.split('-'), d=new Date(+a[0], +a[1]-1, +a[2]);
  return Number(a[1])+'月'+Number(a[2])+'日（'+WDAY[d.getDay()]+'）';
}
function daysBetween(a,b){
  if(!isYmd(a)||!isYmd(b)) return null;
  var x=a.split('-'), y=b.split('-');
  var d1=new Date(+x[0],+x[1]-1,+x[2]), d2=new Date(+y[0],+y[1]-1,+y[2]);
  return Math.round((d2-d1)/86400000);
}
function daysFromToday(d){ return daysBetween(today(), d); }
function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
var el = function(h){ var d=document.createElement('div'); d.innerHTML=h.trim(); return d.firstChild; };
var randCode = function(){ var s='', a='abcdefghijkmnpqrstuvwxyz23456789'; for(var i=0;i<16;i++) s+=a[Math.floor(Math.random()*a.length)]; return s; };
function norm(s){ s=String(s); try{ s=s.normalize('NFKC'); }catch(e){} return s.toLowerCase(); }
var uid = function(p){ return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); };
var toNum = function(v){ var n = parseInt(String(v==null?'':v).replace(/[^0-9-]/g,''),10); return isNaN(n)?0:n; };
function val(id){ var e=document.getElementById(id); return e ? e.value : ''; }
function minutesOf(hhmm){
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm||'').trim());
  return m ? (+m[1])*60 + (+m[2]) : null;
}
function hhmmOf(min){
  while(min < 0) min += 1440;
  min = Math.floor(min) % 1440;
  return pad(Math.floor(min/60)) + ':' + pad(min%60);
}

/* その日の時給（平日か土日かで自動で変わる） */
function isWeekend(ymd){
  if(!isYmd(ymd)) return false;
  var a = ymd.split('-'), w = new Date(+a[0], +a[1]-1, +a[2]).getDay();
  return w === 0 || w === 6;
}
function autoWage(ymd){
  return isWeekend(ymd) ? (toNum(S.settings.wageWeekend)||0) : (toNum(S.settings.wageWeekday)||0);
}
/* 月と日だけから、いちばん近い年を選ぶ */
function guessYear(m, d){
  var now = new Date();
  var t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var best = now.getFullYear(), score = Infinity;
  [now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].forEach(function(yy){
    var dt = new Date(yy, m-1, d);
    if(dt.getMonth() !== m-1) return;
    var diff = Math.abs((dt - t0) / 86400000);
    var sc = (dt < t0) ? diff * 1.8 : diff;   /* これからの日を優先する */
    if(sc < score){ score = sc; best = yy; }
  });
  return best;
}
function mdToYmd(m, d){
  m = toNum(m); d = toNum(d);
  if(m < 1 || m > 12 || d < 1 || d > 31) return '';
  var y = guessYear(m, d);
  var dt = new Date(y, m-1, d);
  if(dt.getMonth() !== m-1) return '';
  return toYmd(dt);
}
/* 月・日だけを選ぶ入力欄 */
function mdPicker(idBase, ymd, label, allowEmpty){
  var m = isYmd(ymd) ? +ymd.slice(5,7) : 0;
  var d = isYmd(ymd) ? +ymd.slice(8,10) : 0;
  var mo = '', da = '', i;
  if(allowEmpty) mo += '<option value="">—</option>';
  for(i=1;i<=12;i++) mo += '<option value="'+i+'"'+(m===i?' selected':'')+'>'+i+'月</option>';
  if(allowEmpty) da += '<option value="">—</option>';
  /* 日にちの横に曜日も出す */
  var curM = m || (new Date().getMonth()+1);
  for(i=1;i<=31;i++){
    var ym0 = mdToYmd(curM, i);
    var w = '';
    if(isYmd(ym0)){
      var a0 = ym0.split('-'), dd = new Date(+a0[0], +a0[1]-1, +a0[2]);
      if(dd.getDate() === i) w = '（'+WDAY[dd.getDay()]+'）';
    }
    da += '<option value="'+i+'"'+(d===i?' selected':'')+'>'+i+'日'+w+'</option>';
  }
  return '<label class="f">'+esc(label)+'</label>'+
    '<div class="pair" style="margin-bottom:11px">'+
      '<select id="'+idBase+'_m" data-md="'+idBase+'">'+mo+'</select>'+
      '<select id="'+idBase+'_d" data-md="'+idBase+'">'+da+'</select>'+
    '</div>';
}
/* 月を変えたら、日にちの曜日も付け直す */
function refreshMd(idBase){
  var ms = document.getElementById(idBase+'_m'), ds = document.getElementById(idBase+'_d');
  if(!ms || !ds) return;
  var mv = toNum(ms.value); if(!mv) return;
  var keep = ds.value;
  var allowEmpty = ds.options.length && ds.options[0].value === '';
  var da = allowEmpty ? '<option value="">—</option>' : '';
  for(var i=1;i<=31;i++){
    var ym0 = mdToYmd(mv, i), w = '';
    if(isYmd(ym0)){
      var a0 = ym0.split('-'), dd = new Date(+a0[0], +a0[1]-1, +a0[2]);
      if(dd.getDate() === i) w = '（'+WDAY[dd.getDay()]+'）';
    }
    da += '<option value="'+i+'"'+(String(i)===keep?' selected':'')+'>'+i+'日'+w+'</option>';
  }
  ds.innerHTML = da;
}
function readMd(idBase){
  var m = val(idBase+'_m'), d = val(idBase+'_d');
  if(!m || !d) return '';
  return mdToYmd(m, d);
}

/* ===== バイトの給料：毎月15日締め・25日払い ===== */
function minRate(ymd){
  return isWeekend(ymd) ? (Number(S.settings.minWeekend)||0) : (Number(S.settings.minWeekday)||0);
}
/* その日が属する締め期間の「締め月」を返す（16日〜翌15日 → 翌月が締め月） */
function closeYmOf(ymd){
  if(!isYmd(ymd)) return thisYm();
  var y = +ymd.slice(0,4), m = +ymd.slice(5,7), d = +ymd.slice(8,10);
  if(d >= 16) m += 1;
  if(m > 12){ m = 1; y += 1; }
  return y + '-' + pad(m);
}
/* 締め月 ym の期間（前月16日〜当月15日）と支払日（当月25日） */
function payPeriod(ym){
  var a = ym.split('-'), y = +a[0], m = +a[1];
  var pm = m - 1, py = y;
  if(pm < 1){ pm = 12; py -= 1; }
  return { from: py+'-'+pad(pm)+'-16', to: y+'-'+pad(m)+'-15', payDay: y+'-'+pad(m)+'-25', ym: ym };
}
function shiftsInPeriod(ym){
  var p = payPeriod(ym);
  return S.shifts.filter(function(x){ return isYmd(x.date) && x.date >= p.from && x.date <= p.to; })
    .sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); });
}
function periodPay(ym){
  return shiftsInPeriod(ym).reduce(function(a,x){ return a + shiftPay(x); }, 0);
}
/* 今まさに集計中の締め期間（16日以降なら次の締め月） */
function openYm(){ return closeYmOf(today()); }

/* ===== 乗り継ぎの計算 ===== */
function trTime(pair){ return { dep:pair[0], arr:pair[1], d:minutesOf(pair[0]), a:minutesOf(pair[1]) }; }
/* 目標の到着時刻までに着ける便のうち、いちばん遅いものを返す */
function lastArrivalBy(table, limitMin){
  var best = null;
  table.forEach(function(p){
    var t = trTime(p);
    if(t.a <= limitMin && (!best || t.a > best.a || (t.a === best.a && t.d > best.d))) best = t;
  });
  return best;
}
/* 指定時刻以降に出る便のうち、いちばん早いものを返す */
function firstDepartureFrom(table, fromMin){
  var best = null;
  table.forEach(function(p){
    var t = trTime(p);
    if(t.d >= fromMin && (!best || t.d < best.d)) best = t;
  });
  return best;
}
function sortedDeps(table){
  return table.map(trTime).sort(function(a,b){ return a.d - b.d; });
}
/* 行きの1案：目標着時刻から逆算してバスと電車を選ぶ */
function goPlanFor(arriveByMin){
  var train = lastArrivalBy(tbl('trainGo'), arriveByMin);
  if(!train) return null;
  var margin = toNum(S.transit.sannomiyaTransfer) || 10;
  var bus = lastArrivalBy(tbl('busGo'), train.d - margin);
  return { train:train, bus:bus, arriveBy:arriveByMin };
}
/* 行き：本命と、バスを1本・2本遅らせた場合 */
function goPlans(arriveByMin, classStartMin){
  var margin = toNum(S.transit.sannomiyaTransfer) || 10;
  var base = goPlanFor(arriveByMin);
  if(!base) return [];
  var buses = sortedDeps(tbl('busGo'));
  var bi = -1;
  if(base.bus) for(var i=0;i<buses.length;i++) if(buses[i].d === base.bus.d) bi = i;
  var out = [{ bus:base.bus, train:base.train, tag:'おすすめ', ok:true }];
  [1,2].forEach(function(k){
    var b = (bi >= 0) ? buses[bi + k] : null;
    if(!b) return;
    var tr = firstDepartureFrom(tbl('trainGo'), b.a + margin);
    if(!tr) return;
    out.push({ bus:b, train:tr, tag:'バス'+k+'本あと',
      ok: (classStartMin == null) ? true : (tr.a <= classStartMin) });
  });
  return out;
}
/* 自分で足したダイヤも合わせて使う */
function tbl(name, ymd){
  var d = ymd || today();
  var a = d.split('-');
  var dow = new Date(+a[0], +a[1]-1, +a[2]).getDay();
  var holiday = (dow === 0 || dow === 6 || !!holidayName(d));
  /* 平日と休日でダイヤを使い分ける */
  var pick = holiday
    ? { busGo:(typeof BUS_GO_HD!=='undefined'?BUS_GO_HD:null),
        trainGo:(typeof TRAIN_GO_HD!=='undefined'?TRAIN_GO_HD:null),
        trainBack:(typeof TRAIN_BACK_HD!=='undefined'?TRAIN_BACK_HD:null),
        busBack:(typeof BUS_BACK_HD!=='undefined'?BUS_BACK_HD:null) }[name]
    : { busGo:(typeof BUS_GO_WD!=='undefined'?BUS_GO_WD:null),
        trainGo:(typeof TRAIN_GO_WD!=='undefined'?TRAIN_GO_WD:null),
        trainBack:(typeof TRAIN_BACK_WD!=='undefined'?TRAIN_BACK_WD:null),
        busBack:(typeof BUS_BACK_WD!=='undefined'?BUS_BACK_WD:null),
        busWork:(typeof BUS_WORK_WD!=='undefined'?BUS_WORK_WD:null) }[name];
  var base = pick || ({ busGo:BUS_GO, trainGo:TRAIN_GO, trainBack:TRAIN_BACK, busBack:BUS_BACK, busWork:BUS_WORK }[name] || []);
  var extra = ((S.transit.custom||{})[name]) || [];
  /* 自分で足した便もまぜて、出る時刻の順にならべる（次の便さがしが正しく動くように） */
  return base.concat(extra.filter(function(p){ return p && minutesOf(p[0])!=null && minutesOf(p[1])!=null; }))
    .slice().sort(function(x, y){ return minutesOf(x[0]) - minutesOf(y[0]); });
}
/* バイトの日：大学を出て、開始に間に合う便（本命・1本前・1本後） */
function workPlans(leaveAfterMin, arriveByMin){
  var margin = toNum(S.transit.sannomiyaTransfer) || 10;
  var trains = sortedDeps(tbl('trainBack')).filter(function(t){ return t.d >= leaveAfterMin; });
  var out = [];
  trains.forEach(function(t){
    var b = firstDepartureFrom(tbl('busWork'), t.a + margin);
    if(!b) return;
    out.push({ train:t, bus:b, ok: b.a <= arriveByMin });
  });
  if(!out.length) return [];
  var idx = -1;
  for(var i=out.length-1;i>=0;i--){ if(out[i].ok){ idx=i; break; } }   /* 間に合う中でいちばん遅い */
  if(idx < 0) idx = 0;
  var pick = [];
  if(out[idx-1]) pick.push(Object.assign({tag:'1本前'}, out[idx-1]));
  pick.push(Object.assign({tag:'ちょうど'}, out[idx]));
  if(out[idx+1]) pick.push(Object.assign({tag:'1本後'}, out[idx+1]));
  return pick;
}
/* 帰り：鳴尾を出たい時刻から、1本前・本命・1本後 */
function backPlans(departAfterMin){
  var all = sortedDeps(tbl('trainBack'));
  var idx = -1;
  for(var i=0;i<all.length;i++){ if(all[i].d >= departAfterMin){ idx = i; break; } }
  if(idx < 0) return [];
  var margin = toNum(S.transit.sannomiyaTransfer) || 10;
  var mk = function(t, tag){
    if(!t) return null;
    return { train:t, bus:firstDepartureFrom(tbl('busBack'), t.a + margin), tag:tag };
  };
  return [mk(all[idx-1],'1本前'), mk(all[idx],'ちょうど'), mk(all[idx+1],'1本後')].filter(Boolean);
}

/* ===== 学期と科目 ===== */
function termsAll(){
  if(!S.termsList) S.termsList = TERMS_DEFAULT.map(function(t){ return { id:t.id, year:t.year, label:t.label, courses:t.courses.slice() }; });
  return S.termsList;
}
function termOf(id){ return termsAll().filter(function(t){ return t.id===id; })[0] || termsAll()[0]; }
function curTerm(){ return termOf(S.termId); }
/* 今の学期の科目（時間割用の形） */
function termCourses(){
  var t = curTerm();
  return (t.courses||[]).map(function(c){
    return { name:c.name, code:c.code||'', slotText:c.slots||'', slots:parseSlots(c.slots||''),
      cat:c.cat||'', cr:Number(c.cr)||0, room:c.room||'', req:c.req?1:0, bi:c.bi?1:0, en:!!c.en, web:c.web?1:0 };
  });
}
function courseByName(name){ return termCourses().filter(function(c){ return c.name===name; })[0] || null; }
function courseReq(name){
  var cm = S.courseMeta[name] || {}, c = courseByName(name);
  return (cm.req != null) ? (cm.req?1:0) : (c ? c.req : 0);
}
function courseRoom(name){
  var cm = S.courseMeta[name] || {}, c = courseByName(name);
  return cm.room || (c ? c.room : '') || '';
}
function courseAlias(name){ var cm = S.courseMeta[name] || {}; return cm.alias || ''; }
function courseColor(name){ return courseReq(name) ? '#B0311A' : '#0D2B7A'; }

/* 授業の変更（休講・遠隔・補講） */
function changesOn(ymd){ return S.holidays.filter(function(h){ return h.date===ymd; }); }
function changeType(h){ return h.type || 'cancel'; }
function isCancelled(name, ymd){
  return changesOn(ymd).some(function(h){ return changeType(h)==='cancel' && (h.course===name || h.course==='*'); });
}
function isOnlineOn(name, ymd){
  return changesOn(ymd).some(function(h){ return changeType(h)==='online' && (h.course===name || h.course==='*'); });
}
function makeupsOn(ymd){
  return changesOn(ymd).filter(function(h){ return changeType(h)==='makeup'; });
}
/* 隔週：基準日を設定した科目は、基準日から2週ごとに「ある週」 */
function biweekOn(name, ymd){
  var c = courseByName(name);
  if(!c || !c.bi) return true;
  var anchor = S.biweek[name];
  if(!isYmd(anchor)) return true;      /* 基準日が無ければ毎週あるものとして扱う */
  var d = daysBetween(anchor, ymd);
  if(d === null) return true;
  var w = Math.floor(d / 7);
  return ((w % 2) + 2) % 2 === 0;
}
/* その日に実際にある授業（休講・隔週を考慮） */
function classesForDate(ymd){
  if(!isYmd(ymd)) return [];
  var a = ymd.split('-'), dch = WDAY[new Date(+a[0], +a[1]-1, +a[2]).getDay()];
  var map = {};
  termCourses().forEach(function(c){ c.slots.forEach(function(sl){ map[sl.d+sl.p] = c; }); });
  var out = [];
  var holOn = changesOn(ymd).some(function(h){ return changeType(h)==='holclass'; });   /* この日は授業あり */
  var inBreak = (S.breaks||[]).some(function(b){ return ymd >= b.from && ymd <= b.to; });
  var isHol = (!!holidayName(ymd) || inBreak) && !S.settings.classOnHoliday && !holOn;
  PERIODS.forEach(function(p){
    var c = map[dch+p]; if(!c) return;
    var off = isHol ? 'holiday' : isCancelled(c.name, ymd) ? 'cancel' : (!biweekOn(c.name, ymd) ? 'biweek' : '');
    var web = c.web || (isOnlineOn(c.name, ymd) ? 1 : 0);
    out.push({ period:p, name:c.name, room:courseRoom(c.name), web:web, req:courseReq(c.name), bi:c.bi, off:off,
               online: isOnlineOn(c.name, ymd) ? 1 : 0 });
  });
  /* 補講はその日に足す */
  makeupsOn(ymd).forEach(function(h){
    var pd = toNum(h.period) || 1;
    if(out.some(function(x){ return x.period===pd; })) return;
    out.push({ period:pd, name:h.course, room:h.room||courseRoom(h.course), web:0,
               req:courseReq(h.course), bi:0, off:'', makeup:1 });
  });
  out.sort(function(a,b){ return a.period-b.period; });
  return out;
}
function schoolClassesForDate(ymd){
  return classesForDate(ymd).filter(function(c){ return !c.web && !c.off; });
}

/* 出欠（日付つき） */
function attendOf(name){
  var log = S.attendLog[name] || [];
  var abRaw = log.filter(function(x){ return x.st==='欠'; }).length;
  var late = log.filter(function(x){ return x.st==='遅'; }).length;
  var pres = log.filter(function(x){ return x.st==='出'; }).length;
  var cm = S.courseMeta[name] || {};
  var base = ATTEND_BASE[name] || {};
  var total = toNum(cm.total) || toNum(base.total) || 15;
  /* 判定基準欠席回数：自分で入れた値 → 学務システムの値 → 目安 */
  var limit = toNum(cm.evalAbsent) || toNum(base.limit) || Math.ceil(total/3);
  /* 遅刻・早退3回で欠席1回として数える */
  var ab = abRaw + Math.floor(late / 3);
  return { ab:ab, abRaw:abRaw, late:late, pres:pres, total:total, limit:limit, log:log,
           fromBase: !toNum(cm.evalAbsent) && !!base.limit };
}
function setAttend(name, ymd, st){
  var log = S.attendLog[name] || [];
  log = log.filter(function(x){ return x.date!==ymd; });
  if(st) log.push({ date:ymd, st:st });
  log.sort(function(a,b){ return a.date.localeCompare(b.date); });
  S.attendLog[name] = log; touch('attendLog');
}

/* 削除の取り消し */
var undoBuf = null;
function removeWithUndo(list, id, label){
  var obj = (S[list]||[]).filter(function(x){ return x.id===id; })[0];
  if(obj){
    S.trash = S.trash || [];
    S.trash.unshift({ list:list, obj:JSON.parse(JSON.stringify(obj)), at:Date.now() });
    if(S.trash.length > 200) S.trash = S.trash.slice(0, 200);
  }
  removeItem(list, id);
  undoBuf = { list:list, obj:obj, at:Date.now() };
  toastUndo((label||'削除しました'), function(){
    if(!undoBuf || !undoBuf.obj) return;
    markRevived(undoBuf.obj.id);
    undoBuf.obj.mt = Date.now();
    S[undoBuf.list] = S[undoBuf.list] || [];
    if(!S[undoBuf.list].some(function(x){ return x.id === undoBuf.obj.id; })) S[undoBuf.list].push(undoBuf.obj);
    undoBuf = null; toast('元に戻しました'); commit();
  });
}
/* ===== どの操作でも「取り消す」 =====
   ボタンを押す前の中身を覚えておき、中身が変わったら、出したお知らせに「取り消す」をつける。
   （削除のときは、前からある「取り消す」をそのまま使う） */
var UNDO_LISTS = ['spends','income','fixed','balances','events','tasks','exams','health','shifts','holidays','notes','notices','breaks','plans','statements'];
var UNDO_KEYS = ['attend','courseMeta','memos','payApplied','attendLog','grades','biweek','termsDone','progress','taskLog',
                 'syllabus','dayReview','terms','commute','transit','termsList','chatQuick','risyu','termId'];
/* 押しただけで、ほとんど何も変えない操作（覚えておく手間をはぶく） */
var UNDO_SKIP = /^(go|fold|cal-(prev|next|today|day|mode|view|filter|mset|addopen)|km-|cw-|kind-(pick|mode)|subj-pick|tt-(week|weekset|terms|subj-past)|course-(open|back)|ev-(open|close|kind|pri|how|photo|edit|edit-from-detail|reset)|chat-(room|att|q|send|speak|stop|sum)|voice-|quick-edit|work-(prev|next|now)|fd-|dl-|photo-(pick|list|close)|memo-photo-view|go-|today-toggle|range|toggle-|wstyle|manual|cancel-stmt|cam|pick|syl-(ai|cancel)|shift-ocr$|shift-ocr-cancel|gas-|storage-recount|errlog-copy|note-(open|back)|dev-rename|sync-|export|import|ics|chara-(talk|cat|make|edit)|kb-(ym|cat|all|csv|csv-cancel)|link-copy|inbox-pull|summary-push|tasks-sync|place-check|share-(day|item|note|chat)|nt-(on|off|test|push)|chat-web|talk-start|att-ask|wkrev-hist|radar-[a-z]+|warn-reload|pet-(panel|game|rename)|anki-[a-z-]+|qz-[a-z-]+|perf-run|files-check|ver-[a-z]+|sentry-test|copy-text|gas-(manifest|setup))$/;
var UNDO_LABEL = { 'task-done':'完了にしました', 'task-undone':'未完了にもどしました', 'paid':'支払いの印を変えました',
  'prog-step':'進みぐあいを変えました', 'att-set':'出欠を記録しました', 'ot-plus':'時間を直しました',
  'sub-toggle':'小項目を変えました', 'note-check':'チェックを変えました', 'kind-up':'順番を変えました', 'kind-down':'順番を変えました',
  'pg-up':'順番を変えました', 'pg-down':'順番を変えました' };
function undoSnap(){
  var o = {};
  UNDO_LISTS.forEach(function(k){ o[k] = S[k]; });
  UNDO_KEYS.forEach(function(k){ o[k] = S[k]; });
  o.paid = S.paid;
  o.settings = S.settings;
  o.ui = { kinds:S.ui.kinds, tabs:S.ui.tabs, theme:S.ui.theme, pageOrder:S.ui.pageOrder, pageHide:S.ui.pageHide,
           subOrder:S.ui.subOrder, subHide:S.ui.subHide, customColor:S.ui.customColor };
  try{ return JSON.stringify(o); }catch(e){ return null; }
}
function undoable(act, fn){
  if(!act || UNDO_SKIP.test(act)){ fn(); return; }
  var before = undoSnap();
  var watch = window.__undoWatch = { toasts:[], hasUndo:false };
  try{ fn(); }
  finally{ window.__undoWatch = null; }
  if(!before || watch.hasUndo) return;
  var after = undoSnap();
  if(after === before) return;
  var label = watch.toasts.length ? watch.toasts[watch.toasts.length - 1] : UNDO_LABEL[act];
  if(!label) return;                       /* 何も知らせない小さな操作には出さない */
  toastUndo(label, function(){
    undoRestore(before);
    toast('元に戻しました');
    applyUi(); commit();
  });
}
function undoRestore(snap){
  var old = JSON.parse(snap), now = Date.now();
  UNDO_LISTS.forEach(function(k){
    var was = Array.isArray(old[k]) ? old[k] : [];
    var wasMap = {};
    was.forEach(function(x){ if(x && x.id) wasMap[x.id] = x; });
    /* その操作で増えたものは消す */
    (S[k] || []).slice().forEach(function(x){ if(x && x.id && !wasMap[x.id]) removeItem(k, x.id); });
    /* 変わったもの・消えたものは、前の中身にもどす（同期で負けないよう時刻を新しくする） */
    var cur = S[k] || [];
    was.forEach(function(o){
      if(!o || !o.id) return;
      var i = -1;
      for(var j = 0; j < cur.length; j++){ if(cur[j].id === o.id){ i = j; break; } }
      if(i < 0){ markRevived(o.id); o.mt = now; cur.push(o); }
      else if(JSON.stringify(cur[i]) !== JSON.stringify(o)){ o.mt = now; cur[i] = o; }
    });
    S[k] = cur;
  });
  UNDO_KEYS.forEach(function(k){ if(old[k] !== undefined) S[k] = old[k]; });
  /* 支払い済みの印は時刻つき */
  var op = old.paid || {};
  Object.keys(S.paid).concat(Object.keys(op)).forEach(function(k){
    var a = normPaid(op[k]), b = normPaid(S.paid[k]);
    var av = a ? a.v : 0, bv = b ? b.v : 0;
    if(av !== bv) S.paid[k] = { v:av, t:now };
  });
  if(old.settings){
    Object.keys(old.settings).forEach(function(k){
      if(k === 'room' || k === 'fbConfig') return;
      S.settings[k] = old.settings[k];
    });
  }
  if(old.ui) Object.keys(old.ui).forEach(function(k){ if(old.ui[k] !== undefined) S.ui[k] = old.ui[k]; });
  if(old.risyu) S.risyu.updatedAt = now;
}
/* ゴミ箱から元に戻す */
/* 前のバックアップから30日たったか */
/* 終わった予定の写真を、日が変わったら片付ける（設定で切れる） */
function cleanDonePhotos(){
  if(S.ui.autoClean === 0) return 0;   /* 設定でオフにしたときだけ止まる */
  var td = today(), n = 0, kill = [];
  S.tasks.forEach(function(t){
    if(t.done && isYmd(t.due) && t.due < td && (t.photos||[]).length){
      t.photos.forEach(function(pid){ kill.push(pid); });
      t.photos = []; t.cleaned = 1; t.mt = Date.now(); n++;
    }
  });
  if(kill.length && typeof photoDel === 'function'){
    kill.forEach(function(pid){ photoDel(pid); });
  }
  if(n) persist();
  return n;
}
function needBackup(){
  var last = toNum(S.backupAt);
  if(!last) return true;
  return (Date.now() - last) > 30*24*3600*1000;
}
function trashRestore(i){
  var t = (S.trash||[])[i];
  if(!t) return;
  markRevived(t.obj.id);
  S[t.list] = S[t.list] || [];
  if(!S[t.list].some(function(x){ return x.id === t.obj.id; })){
    t.obj.mt = Date.now();
    S[t.list].push(t.obj);
  }
  S.trash.splice(i, 1);
  toast('元に戻しました'); commit();
}
function trashLabel(t){
  var o = t.obj || {};
  var names = { events:'予定', tasks:'課題', exams:'テスト', shifts:'バイト', notes:'メモ',
                income:'収入', fixed:'固定費', balances:'口座', health:'健康', holidays:'授業の変更',
                notices:'お知らせ', breaks:'長いお休み', spends:'家計簿', cards:'暗記カード', kmItems:'足した機能の記録' };
  var amt = (t.list === 'spends' && o.amount) ? '　' + yen(Math.abs(Number(o.amount) || 0)) + (isYmd(o.date) ? '（' + o.date + '）' : '') : '';
  return (names[t.list] || t.list) + '：' + String(o.title || o.subject || o.name || o.q || o.text || '（無題）').slice(0, 60) + amt;
}
function toastUndo(text, fn){
  if(window.__undoWatch) window.__undoWatch.hasUndo = true;
  var t = document.getElementById('toast');
  if(!t) return;
  var face2 = (typeof charaLevel === 'function' && charaLevel() >= 2) ? charaFace('normal', 22) : '';
  t.innerHTML = face2 + '<span>' + esc(text) + '</span>' + ' <button id="undoBtn" style="margin-left:10px;border:1px solid rgba(255,255,255,.5);background:none;color:inherit;border-radius:999px;padding:2px 10px;font:inherit;font-size:.9em">取り消す</button>';
  t.className = 'on' + (face2 ? ' withch' : '');
  clearTimeout(toastTimer);
  var btn = document.getElementById('undoBtn');
  if(btn) btn.onclick = function(){ t.className=''; fn(); };
  toastTimer = setTimeout(function(){ t.className=''; }, 6000);
}
/* お知らせ（表示したバナーを記録） */
function notice_(text, level){
  /* 同じ日の同じお知らせは、どの端末でも同じidにする（同期で2つにならないように） */
  var id = (typeof hash53 === 'function') ? 'nz_' + hash53(today() + '|' + text) : uid('nz');
  if(S.notices.some(function(n){ return n.id === id; })) return;
  var last = S.notices[S.notices.length-1];
  if(last && last.text === text && Date.now() - (last.mt||0) < 3600000) return;
  S.notices.push({ id:id, text:text, level:level||'info', mt:Date.now() });
  if(S.notices.length > 200) S.notices = S.notices.slice(-200);
}

/* 季節（seasonNow）と AIの話し方（AI_TONES・toneRule など）は、後ろのほうで1つだけ定義している */

/* ===== テストの進捗 ===== */
var PROG3 = [['0','まだ','○'],['1','勉強中','◐'],['2','できた','●']];
var PROG5 = [['0','まだ','○'],['1','少し','◔'],['2','半分','◑'],['3','あと少し','◕'],['4','できた','●']];
function progScale(){ return (S.ui.progScale===5) ? PROG5 : PROG3; }
function progOf(id){ var v = S.progress ? S.progress[id] : null; return (v==null) ? 0 : toNum(v); }
function progIcon(id){
  var sc = progScale(), v = Math.min(progOf(id), sc.length-1);
  return sc[v] ? sc[v][2] : '○';
}
function progLabel(id){
  var sc = progScale(), v = Math.min(progOf(id), sc.length-1);
  return sc[v] ? sc[v][1] : '';
}
function setProg(id, v){ S.progress = S.progress || {}; S.progress[id] = toNum(v); touch('progress'); }

/* 科目名の照合：末尾の「(2)」のような番号と、空白だけは無視する。
   Ⅰ・Ⅱ・Ⅲ や I・II のちがいは区別する（基礎看護技術演習Ⅰ と Ⅱ は別の科目） */
function subjKey(n){
  return String(n||'')
    .replace(/[（(]\s*\d+\s*[)）]\s*$/, '')   /* 末尾の (数字) */
    .replace(/[\s\u3000]+/g, '')              /* 空白（全角も） */
    .trim();
}
function sameSubject(a, b){
  if(!a || !b) return false;
  if(a === b) return true;
  var ka = subjKey(a), kb = subjKey(b);
  if(!ka || !kb) return false;
  return ka === kb;
}
/* 学務システムの「全授業回数」と「判定基準欠席回数」 */
var ATTEND_BASE = {
  '臨床病態栄養学':        { total:15, limit:4 },
  '初期演習Ⅱ（生活と看護）': { total:15, limit:4 },
  '成人看護学概論':        { total:8,  limit:2 },
  '医学英語':              { total:15, limit:4 },
  '母性看護学概論':        { total:8,  limit:2 },
  '基礎看護技術演習Ⅰ':     { total:32, limit:7 },
  '基礎看護技術演習Ⅱ':     { total:30, limit:7 },
  '看護応用統計学':        { total:15, limit:4 },
  '小児看護学概論':        { total:8,  limit:2 }
};

/* ===== メモ ===== */
function memoOf(k){
  var m = S.memos[k];
  return (m && typeof m === 'object') ? m : { text:'', mt:0 };
}
function memoBox(k, title){
  var m = memoOf(k);
  var photos = m.photos || [];
  var thumbs = photos.map(function(id){
    var src = null;
    try{ src = localStorage.getItem('shiharai:memoimg:'+id); }catch(e){}
    if(!src) return '';
    return '<div class="mphoto"><img src="'+src+'" alt="メモの写真" data-act="memo-photo-view" data-id="'+id+'">'+
      '<button class="mini" data-act="memo-photo-del" data-k="'+k+'" data-id="'+id+'">×</button></div>';
  }).join('');
  return section('メモ', m.mt ? '更新 '+new Date(m.mt).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) : null,
    '<textarea id="memo_'+k+'" placeholder="'+esc(title)+'">'+esc(m.text)+'</textarea>'+
    (thumbs ? '<div class="mphotos">'+thumbs+'</div>' : '')+
    '<div class="pair" style="margin-top:8px">'+
      '<button class="btn ghost" data-act="memo-save" data-k="'+k+'">保存</button>'+
      '<button class="btn ghost" data-act="memo-photo" data-k="'+k+'">写真を足す</button></div>');
}
var memoTarget = '';

function planRows(p){
  var out=[], start = isYm(p.start) ? p.start : thisYm();
  for(var i=0;i<p.count;i++) out.push({
    planId:p.id, name:p.name, accountId:p.accountId,
    month:addMonths(start,i), index:i+1, count:p.count,
    amount:(i===0 && p.firstAmount) ? p.firstAmount : p.monthly
  });
  return out;
}
function daysUntil(day){
  var now=new Date(), t0=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  var t=new Date(now.getFullYear(),now.getMonth(),day);
  if(t<t0) t=new Date(now.getFullYear(),now.getMonth()+1,day);
  return Math.round((t-t0)/86400000);
}
async function resizeImage(file,maxSide,quality){
  var dataUrl = await new Promise(function(res,rej){ var r=new FileReader(); r.onload=function(){res(r.result);}; r.onerror=function(){rej(new Error('read'));}; r.readAsDataURL(file); });
  var img = await new Promise(function(res,rej){ var i=new Image(); i.onload=function(){res(i);}; i.onerror=function(){rej(new Error('img'));}; i.src=dataUrl; });
  var sc=Math.min(1,maxSide/Math.max(img.width,img.height));
  var cv=document.createElement('canvas');
  cv.width=Math.round(img.width*sc); cv.height=Math.round(img.height*sc);
  cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
  return cv.toDataURL('image/jpeg',quality);
}

/* ============================== 状態 ============================== */
var RISYU_DEFAULT = {
  selected: [], earned:{ kyoyo:0, topic:0, lang:0, langEn:0, info:0, health:0, pe:0 }, otherCr:16, updatedAt:0
};
var PERIOD_DEFAULT = [
  ['09:00','10:30'], ['10:45','12:15'], ['13:05','14:35'],
  ['14:50','16:20'], ['16:30','18:00'], ['18:10','19:40']
];
var COMMUTE_DEFAULT = {
  walk:8, bus:45, change:15, train:35, toSchool:10, buffer:10,
  periods: PERIOD_DEFAULT.map(function(x){ return x[0]; }),
  ends:    PERIOD_DEFAULT.map(function(x){ return x[1]; })
};
var TAB_DEFS = [
  ['today','今日'],['tt','時間割'],['course','授業'],['cal','予定'],['todo','ToDo'],['anki','暗記'],['study','勉強'],
  ['money','お金'],['chat','相談'],['notes','メモ'],['pet','おせわ'],['news','お知らせ'],['risyu','履修'],['set','⚙']
];
var TODAY_SECTIONS = [
  ['digest','今すぐ確認'],['banners','お知らせ'],['classes','今日の授業'],['transit','行き方・帰り方'],
  ['events','今日の予定'],['todo','やること'],['weather','天気'],['tomorrow','明日'],['next10','これから10日間'],['money','今月のお金'],['memo','メモ']
];
var WEEK_SECTIONS = [
  ['strip','週のカレンダー'],['must','大事なこと'],['tasks','今週の課題'],['changes','授業の変更'],['work','バイト'],['days','日ごとの予定']
];
/* 各ページで並べ替え・表示切替ができる項目 */
var PAGE_SECTIONS = {
  today: [['brief','朝のまとめ'],['weather','天気'],['items','今日の持ち物'],['events','今日の予定'],['classes','今日の授業'],['transit','行き方・帰り方'],['unkou','運行情報'],['find','時間を決めて調べる'],['review','今日のふりかえり'],['leave','出発の記録'],['memo','メモ']],
  tomo:  [['weather','天気'],['items','明日の持ち物'],['events','明日の予定'],['classes','明日の授業'],['transit','行き方・帰り方'],['memo','メモ']],
  kind:  [['picker','種類を選ぶ'],['list','予定の一覧']],
  week:  [['review','先週のふりかえり'],['days','日ごとの一覧'],['notes','週の連絡事項']],
  life:  [['money','今月のお金'],['banners','お知らせ'],['next10','これから10日間']],
  cal:   [['summary','月のまとめ'],['grid','カレンダー'],['selday','選んだ日の予定'],['ics','Googleカレンダー']],
  calweek:[['grid','週の予定']],
  tt:    [['grid','時間割'],['notes','週の連絡事項'],['subj','科目ごとの予定（ぜんぶ）'],['cancel','休講・遠隔・補講の登録']],
  course:[['list','科目一覧'],['add','科目を追加']],
  todoitem:[['prog','進みぐあい'],['time','かかった時間'],['how','出し方'],['sub','小項目'],['memo','メモ']],
  money: [['ready','ご用意額'],['free','自由に使えるお金'],['spend','今月の家計簿'],['flow','お金の流れ（図）'],['fuyou','扶養の壁'],['yearchart','年間の給与'],['balchart','残高の推移'],['outlook','この先の見通し']],
  in:    [['income','毎月の収入'],['fixed','固定費・サブスク'],['balance','口座の残高']],
  work:  [['ocr','シフト表の写真から登録'],['period','今の締め期間'],['next','次の給料の見込み']],
  todo:  [['late','期限切れ'],['open','やること'],['add','追加']]
};
/* サブタブの定義（並べ替え・非表示ができる） */
var SUBTAB_DEFS = {
  today: [['today','今日'],['tomo','明日'],['week','今週'],['life','くらし']],
  cal:   [['cal','月'],['week','週'],['kind','種類別'],['add','追加'],['health','健康']],
  todo:  [['open','やること']],
  money: [['home','ホーム'],['kakeibo','家計簿'],['schedule','予定'],['chart','グラフ'],['stmt','明細'],['in','収支'],['work','バイト']],
  risyu: [['tt','抽選シミュ'],['plans','履修案']]
};
function subTabs(app){
  S.ui.subOrder = S.ui.subOrder || {}; S.ui.subHide = S.ui.subHide || {};
  var defs = SUBTAB_DEFS[app] || [];
  var names = {}; defs.forEach(function(x){ names[x[0]] = x[1]; });
  var cur = Array.isArray(S.ui.subOrder[app]) ? S.ui.subOrder[app].slice() : defs.map(function(x){ return x[0]; });
  defs.forEach(function(x){ if(cur.indexOf(x[0])<0) cur.push(x[0]); });
  cur = cur.filter(function(id){ return names[id]; });
  /* 並べ替えたことがあるときだけ、整えた並びを書きもどす（見るだけで「直した」にしない） */
  if(Array.isArray(S.ui.subOrder[app]) && S.ui.subOrder[app].join(',') !== cur.join(',')) S.ui.subOrder[app] = cur;
  return cur.map(function(id){ return [id, names[id]]; });
}
function subVisible(app){
  return subTabs(app).filter(function(t){ return !(S.ui.subHide[app] && S.ui.subHide[app][t[0]]); });
}
function pageOrder(page){
  S.ui.pageOrder = S.ui.pageOrder || {};
  var defs = (PAGE_SECTIONS[page]||[]).map(function(x){ return x[0]; });
  var cur = S.ui.pageOrder[page];
  if(!Array.isArray(cur)) return defs.slice();          /* 並べ替えていなければ、いつもの順 */
  cur = cur.slice();
  /* 新しく増えた項目は、本来の場所（ひとつ前の項目のすぐ後ろ）に入れる */
  defs.forEach(function(id, i){
    if(cur.indexOf(id) >= 0) return;
    var at = 0;
    for(var j = i - 1; j >= 0; j--){ var p = cur.indexOf(defs[j]); if(p >= 0){ at = p + 1; break; } }
    cur.splice(at, 0, id);
  });
  cur = cur.filter(function(id){ return defs.indexOf(id)>=0; });
  /* 中身が変わったときだけ書き替える（見るだけで「直した」にしない） */
  if(cur.join(',') !== (S.ui.pageOrder[page] || []).join(',')) S.ui.pageOrder[page] = cur;
  return cur;
}
function pageHidden(page, id){
  S.ui.pageHide = S.ui.pageHide || {};
  return !!(S.ui.pageHide[page] && S.ui.pageHide[page][id]);
}
/* 足した機能のデータ（どれも同期する）
   一覧（id と mt を持つ）… kqs 国試の問題／books 教科書／vaccines 予防接種・健診／abbrs 自分で足した略語／
                            annivs 誕生日・記念日／anatomy 解剖図の穴うめ／papers 保存した論文
   表（名前→中身）       … kqLog 国試の答えた記録／healthLog 睡眠・歩数／examPlan テスト範囲の計画
   足した機能の汎用の置き場 … kmItems 一覧（{ id, mt, mod:'機能名', type:'種類', … }）／kmData 表（キー＝'機能名:名前'） */
var EXTRA_LISTS = ['kqs','books','vaccines','abbrs','annivs','anatomy','papers','kmItems'];
var EXTRA_MAPS = ['kqLog','healthLog','examPlan','kmData'];
var UI_DEFAULT = { theme:'pink', fs:'m', weather:1,
  tabs:[['today',1],['tt',1],['course',1],['cal',1],['todo',1],['anki',1],['study',1],['money',1],['chat',1],['notes',1],['pet',1],['news',0],['risyu',0],['set',1]],
  todayOrder: TODAY_SECTIONS.map(function(x){ return x[0]; }),
  todayClosed: {}, pageOrder:{}, pageHide:{}, subOrder:{}, subHide:{}, setOpen:{}, customColor:'#E8C8E8', autoClean:1 };
var S = {
  plans: SEED.slice(), statements: [], paid: {}, deleted: [],
  risyu: JSON.parse(JSON.stringify(RISYU_DEFAULT)),
  income: [], fixed: [], balances: [], events: [], tasks: [], exams: [], health: [], shifts: [],
  courseMeta: {}, memos: {}, payApplied: {}, progress: {},
  transitLog: [], taskLog: {}, syllabus: {}, chat: [], chatMeta: {}, aiLog: {}, dayReview: {}, trash: [], backupAt: 0, breaks: [],
  aiUse: {}, aiFeedback: [], aiMemo: [], chatRooms: {},
  chatQuick: null,          /* よく使う相談（null＝はじめの見本を出す） */
  spends: [], pets: {}, weekReview: {}, charaTalk: {},
  cloud: {},                /* Googleへのバックアップ・カレンダーの記録（端末どうしで共有） */
  delAt: {}, revAt: {},
  attendLog: {}, grades: {}, holidays: [], biweek: {}, notes: [], notices: [],
  cards: [], studyLog: {}, petDays: {},   /* 暗記カード・勉強した枚数・おせわの毎日の記録 */
  suggests: [],                           /* AIが見つけた課題の候補（見てから追加する） */
  kqs: [], books: [], vaccines: [], abbrs: [], annivs: [], anatomy: [], papers: [], kmItems: [],   /* EXTRA_LISTS */
  kqLog: {}, healthLog: {}, examPlan: {}, kmData: {},                                         /* EXTRA_MAPS */
  termsList: null, termId: '2026-2', termsDone: {},
  transit: { sannomiyaTransfer:10, workBuffer:10, fav:[], custom:{ busGo:[], trainGo:[], trainBack:[], busBack:[], busWork:[] } },
  attend: {}, terms: { first:{} },
  commute: JSON.parse(JSON.stringify(COMMUTE_DEFAULT)),
  ui: JSON.parse(JSON.stringify(UI_DEFAULT)),
  meta: { attend:0, terms:0, commute:0, ui:0, courseMeta:0, memos:0, transit:0, payApplied:0, attendLog:0, grades:0, biweek:0, termsList:0, termsDone:0, progress:0, transitLog:0, taskLog:0, syllabus:0 },
  ver: DATA_VER,
  settings: { smbcDay:27, rakutenDay:27, room:DEFAULT_ROOM, fbConfig:DEFAULT_FB, apiKey:'', geminiKey:'', geminiModel:'', aiTone:'friendly', aiLen:'normal', aiStyle:'bullet', regDeadline:'', minWeekday:18.6, minWeekend:23.3, fare:1280, shop:'デリフランス', payBankId:'' }
};
var appId='today', payTab='home', risyuTab='tt', calTab='cal';
var draft=null, notice=null, showPlanForm=false, hidePast=true, chartRange=12;
var rIncludeOcc=false;
var pick={ d:'月', p:1, cat:'all', q:'' };
var calYm=thisYm(), calSel=today(), calView='month', calEdit=null, calQ='';
var workYm='';
var todayTab='today', weekOffset=0;
var calFilter={ task:1, quiz:1, exam:1, kousa:1, work:1, imp:1, other:1, health:1, pay:1, cls:0 };
var evDraft = null;
var weather={ state:'idle', sanda:null, school:null, alert:'', msg:'' };

/* ===== エラーの記録（設定 › エラーの記録 で見られる） ===== */
var ERRLOG_KEY = KEY + ':errlog';
function errLogAll(){
  try{ var a = JSON.parse(localStorage.getItem(ERRLOG_KEY) || '[]'); return Array.isArray(a) ? a : []; }catch(e){ return []; }
}
function logErr(where, msg){
  try{
    var a = errLogAll();
    var m = String(msg == null ? '' : msg).slice(0, 400);
    var last = a[a.length - 1];
    /* 同じエラーが続くときは、回数だけ数える */
    if(last && last.w === where && last.m === m && Date.now() - last.t < 10*60*1000){ last.c = (last.c||1) + 1; last.t = Date.now(); }
    else a.push({ t:Date.now(), w:String(where||''), m:m, b:APP_BUILD, c:1 });
    if(a.length > 100) a = a.slice(-100);
    localStorage.setItem(ERRLOG_KEY, JSON.stringify(a));
  }catch(e){}
  try{ if(window.console) console.warn('[' + where + '] ' + msg); }catch(e){}
}
window.addEventListener('error', function(ev){
  var src = ev && ev.filename ? String(ev.filename).split('/').pop() + ':' + ev.lineno : '';
  logErr('画面', (ev && ev.message || 'エラー') + (src ? '（' + src + '）' : ''));
});
window.addEventListener('unhandledrejection', function(ev){
  var r = ev && ev.reason;
  logErr('画面', '処理の失敗：' + (r && r.message || r || ''));
});

/* ===== この端末の名前と、同期の記録（この端末だけに置く） ===== */
function guessDeviceName(){
  var ua = String(navigator.userAgent || '');
  if(/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if(/iPhone/.test(ua)) return 'iPhone';
  if(/Android/.test(ua)) return /Mobile/.test(ua) ? 'Androidスマホ' : 'Androidタブレット';
  if(/Macintosh/.test(ua)) return 'Mac';
  if(/Windows/.test(ua)) return 'パソコン';
  return '端末';
}
var DEV = (function(){
  var k = KEY + ':device', o = null;
  try{ o = JSON.parse(localStorage.getItem(k) || 'null'); }catch(e){}
  if(!o || !o.id){
    o = { id:'d' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name:guessDeviceName() };
    try{ localStorage.setItem(k, JSON.stringify(o)); }catch(e){}
  }
  return o;
})();
function saveDevice(){ try{ localStorage.setItem(KEY + ':device', JSON.stringify(DEV)); }catch(e){} }
function deviceName(id){
  if(!id) return '';
  if(id === DEV.id) return (DEV.name || 'この端末') + '（この端末）';
  var all = {};
  try{ all = (typeof syncState !== 'undefined' && syncState.devices) || JSON.parse(localStorage.getItem(KEY + ':devices') || '{}'); }catch(e){}
  return (all[id] && all[id].name) || 'ほかの端末';
}
var SYNC_LOCAL = (function(){
  var o = null;
  try{ o = JSON.parse(localStorage.getItem(KEY + ':synclocal') || 'null'); }catch(e){}
  o = Object.assign({ applied:{}, photoSync:1, legacyAt:0, seenBuild:'' }, o || {});
  if(!o.applied || typeof o.applied !== 'object') o.applied = {};
  return o;
})();
function saveSyncLocal(){ try{ localStorage.setItem(KEY + ':synclocal', JSON.stringify(SYNC_LOCAL)); }catch(e){} }

try{
  var raw = localStorage.getItem(KEY);
  if(raw){
    var d0 = JSON.parse(raw);
    S = Object.assign({}, S, d0);
    S.settings = Object.assign({ smbcDay:27, rakutenDay:27, room:DEFAULT_ROOM, fbConfig:DEFAULT_FB, apiKey:'', geminiKey:'', geminiModel:'', aiTone:'friendly', aiLen:'normal', aiStyle:'bullet', regDeadline:'', minWeekday:18.6, minWeekend:23.3, fare:1280, shop:'デリフランス', payBankId:'' }, d0.settings||{});
    S.risyu = Object.assign(JSON.parse(JSON.stringify(RISYU_DEFAULT)), d0.risyu||{});
    S.risyu.earned = Object.assign({ kyoyo:0, topic:0, lang:0, langEn:0, info:0, health:0, pe:0 }, (d0.risyu&&d0.risyu.earned)||{});
    if(!Array.isArray(S.risyu.selected)) S.risyu.selected = [];
    ['income','fixed','balances','events','tasks','exams','health','shifts','deleted'].forEach(function(k){
      if(!Array.isArray(S[k])) S[k] = [];
    });
    S.attend = (d0.attend && typeof d0.attend==='object') ? d0.attend : {};
    S.terms = Object.assign({ first:{} }, d0.terms||{});
    if(!S.terms.first || typeof S.terms.first!=='object') S.terms.first = {};
    S.commute = Object.assign(JSON.parse(JSON.stringify(COMMUTE_DEFAULT)), d0.commute||{});
    if(!Array.isArray(S.commute.periods) || S.commute.periods.length!==6) S.commute.periods = COMMUTE_DEFAULT.periods.slice();
    if(!Array.isArray(S.commute.ends) || S.commute.ends.length!==6) S.commute.ends = COMMUTE_DEFAULT.ends.slice();
    S.ui = Object.assign(JSON.parse(JSON.stringify(UI_DEFAULT)), d0.ui||{});
    S.meta = Object.assign({ attend:0, terms:0, commute:0, ui:0, courseMeta:0, memos:0, transit:0, payApplied:0 }, d0.meta||{});
    /* 履修表を反映したので、抽選で選んでいた科目は時間割に入った扱いにする */
    if((Number(d0.ver)||0) < 5){
      S.risyu.selected = [];
      S.risyu.otherCr = 14;
    }
    if((Number(d0.ver)||0) < 7 && (S.ui.theme === 'navy' || !S.ui.theme)) S.ui.theme = 'pink';
    if(S.ui.theme === 'ocean') S.ui.theme = 'sky';
    if(!THEMES.some(function(t){ return t.id===S.ui.theme; })) S.ui.theme = 'pink';
    if((Number(d0.ver)||0) < 9 && S.ui.pageOrder){ delete S.ui.pageOrder.today; }   /* 今日の並びを新しい既定に */
    /* 同期の設定はアプリに組み込んだものに合わせる */
    S.settings.room = DEFAULT_ROOM;
    S.settings.fbConfig = DEFAULT_FB;
    if((Number(d0.ver)||0) < 8 && Array.isArray(S.termsList)){
      S.termsList.forEach(function(t){
        if(t.id === '2026-2'){ t.year = 1; t.label = '1年 後期（2026年 2学期）'; }
      });
    }
    if((Number(d0.ver)||0) < 6){
      /* 課題やテストの色は種類で固定になったので、古い色指定は外す */
      (S.tasks||[]).forEach(function(t){ delete t.color; });
      (S.exams||[]).forEach(function(x){ delete x.color; });
      (S.shifts||[]).forEach(function(w){ delete w.color; });
      (S.events||[]).forEach(function(e){ delete e.color; });
    }
    S.ver = DATA_VER;
    S.courseMeta = (d0.courseMeta && typeof d0.courseMeta==='object') ? d0.courseMeta : {};
    S.memos = (d0.memos && typeof d0.memos==='object') ? d0.memos : {};
    S.payApplied = (d0.payApplied && typeof d0.payApplied==='object') ? d0.payApplied : {};
    S.progress = (d0.progress && typeof d0.progress==='object') ? d0.progress : {};
    S.transitLog = Array.isArray(d0.transitLog) ? d0.transitLog : [];
    S.taskLog = (d0.taskLog && typeof d0.taskLog==='object') ? d0.taskLog : {};
    S.syllabus = (d0.syllabus && typeof d0.syllabus==='object') ? d0.syllabus : {};
    S.chat = Array.isArray(d0.chat) ? d0.chat : [];
    S.chatMeta = (d0.chatMeta && typeof d0.chatMeta==='object') ? d0.chatMeta : {};
    S.aiLog = (d0.aiLog && typeof d0.aiLog==='object') ? d0.aiLog : {};
    S.dayReview = (d0.dayReview && typeof d0.dayReview==='object') ? d0.dayReview : {};
    S.trash = Array.isArray(d0.trash) ? d0.trash : [];
    S.breaks = Array.isArray(d0.breaks) ? d0.breaks : [];
    S.backupAt = toNum(d0.backupAt);
    /* 30日より古いゴミ箱は自動で消す */
    var lim30 = Date.now() - 30*24*3600*1000;
    S.trash = S.trash.filter(function(x){ return toNum(x.at) > lim30; });
    S.aiUse = (d0.aiUse && typeof d0.aiUse==='object') ? d0.aiUse : {};
    S.aiFeedback = Array.isArray(d0.aiFeedback) ? d0.aiFeedback : [];
    S.aiMemo = Array.isArray(d0.aiMemo) ? d0.aiMemo : [];
    S.dayReview = (d0.dayReview && typeof d0.dayReview==='object') ? d0.dayReview : {};
    S.trash = Array.isArray(d0.trash) ? d0.trash : [];
    S.breaks = Array.isArray(d0.breaks) ? d0.breaks : [];
    S.backupAt = toNum(d0.backupAt);
    /* 30日より古いゴミ箱は自動で消す */
    var lim30 = Date.now() - 30*24*3600*1000;
    S.trash = S.trash.filter(function(x){ return toNum(x.at) > lim30; });
    S.chatRooms = (d0.chatRooms && typeof d0.chatRooms==='object') ? d0.chatRooms : {};
    S.transit = Object.assign({ sannomiyaTransfer:10, workBuffer:10, fav:[], custom:{} }, d0.transit||{});
    if(!Array.isArray(S.transit.fav)) S.transit.fav = [];
    S.transit.custom = Object.assign({ busGo:[], trainGo:[], trainBack:[], busBack:[], busWork:[] }, S.transit.custom||{});
    S.attendLog = (d0.attendLog && typeof d0.attendLog==='object') ? d0.attendLog : {};
    S.grades = (d0.grades && typeof d0.grades==='object') ? d0.grades : {};
    S.holidays = Array.isArray(d0.holidays) ? d0.holidays : [];
    S.biweek = (d0.biweek && typeof d0.biweek==='object') ? d0.biweek : {};
    S.notes = Array.isArray(d0.notes) ? d0.notes : [];
    S.notices = Array.isArray(d0.notices) ? d0.notices : [];
    S.termsList = Array.isArray(d0.termsList) ? d0.termsList : null;
    S.termId = d0.termId || '2026-2';
    S.termsDone = (d0.termsDone && typeof d0.termsDone==='object') ? d0.termsDone : {};
    S.cloud = (d0.cloud && typeof d0.cloud==='object' && !Array.isArray(d0.cloud)) ? d0.cloud : {};
    S.delAt = (d0.delAt && typeof d0.delAt==='object') ? d0.delAt : {};
    S.revAt = (d0.revAt && typeof d0.revAt==='object') ? d0.revAt : {};
    S.chatQuick = Array.isArray(d0.chatQuick) ? d0.chatQuick : null;
    S.spends = Array.isArray(d0.spends) ? d0.spends : [];
    ['pets','weekReview','charaTalk','studyLog','petDays'].forEach(function(k){ S[k] = (d0[k] && typeof d0[k]==='object' && !Array.isArray(d0[k])) ? d0[k] : {}; });
    S.cards = Array.isArray(d0.cards) ? d0.cards : [];
    S.suggests = Array.isArray(d0.suggests) ? d0.suggests : [];
    if(!Array.isArray(S.ui.tabs)) S.ui.tabs = UI_DEFAULT.tabs.map(function(x){ return x.slice(); });
    TAB_DEFS.forEach(function(t){ if(!S.ui.tabs.some(function(x){ return x[0]===t[0]; })) S.ui.tabs.push([t[0], t[0]==='news'||t[0]==='risyu' ? 0 : 1]); });
    /* 暗記・勉強タブは、ToDoのうしろに入れる（あとから足した人も、⚙のうしろにならないように） */
    [['anki','todo'],['study','anki']].forEach(function(pr){
      var i = S.ui.tabs.findIndex(function(x){ return x[0]===pr[0]; });
      var j = S.ui.tabs.findIndex(function(x){ return x[0]==='set'; });
      if(i > j && j >= 0){
        var it = S.ui.tabs.splice(i,1)[0];
        var k = S.ui.tabs.findIndex(function(x){ return x[0]===pr[1]; });
        S.ui.tabs.splice(k >= 0 ? k+1 : S.ui.tabs.findIndex(function(x){ return x[0]==='set'; }), 0, it);
      }
    });
    EXTRA_LISTS.forEach(function(k){ S[k] = Array.isArray(d0[k]) ? d0[k] : []; });
    EXTRA_MAPS.forEach(function(k){ S[k] = (d0[k] && typeof d0[k]==='object' && !Array.isArray(d0[k])) ? d0[k] : {}; });
    /* そうだんタブは、お金のうしろに入れる */
    (function(){
      var i = S.ui.tabs.findIndex(function(x){ return x[0]==='chat'; });
      var j = S.ui.tabs.findIndex(function(x){ return x[0]==='money'; });
      if(i > j+1 && j >= 0){ var it = S.ui.tabs.splice(i,1)[0]; S.ui.tabs.splice(j+1, 0, it); }
    })();
    if(!Array.isArray(S.ui.todayOrder)) S.ui.todayOrder = UI_DEFAULT.todayOrder.slice();
    TODAY_SECTIONS.forEach(function(x){ if(S.ui.todayOrder.indexOf(x[0])<0) S.ui.todayOrder.push(x[0]); });
    if(!S.ui.todayClosed || typeof S.ui.todayClosed!=='object') S.ui.todayClosed = {};
    if(!S.ui.pageOrder || typeof S.ui.pageOrder!=='object') S.ui.pageOrder = {};
    if(!S.ui.pageHide || typeof S.ui.pageHide!=='object') S.ui.pageHide = {};
    if(!S.ui.subTabs || typeof S.ui.subTabs!=='object') S.ui.subTabs = {};
    if(!Array.isArray(S.ui.myColors)) S.ui.myColors = [];
    if(!S.ui.weekClosed || typeof S.ui.weekClosed!=='object') S.ui.weekClosed = {};
    if(!S.ui.weekHide || typeof S.ui.weekHide!=='object') S.ui.weekHide = {};
    /* 以前の「今日」の並び設定は「くらし」に引き継ぐ */
    if(S.ui.pageOrder && S.ui.pageOrder.today && !S.ui.pageOrder.life){
      var oldT = S.ui.pageOrder.today.filter(function(id){ return ['weather','banners','money','memo'].indexOf(id)>=0; });
      if(oldT.length) S.ui.pageOrder.life = oldT;
      delete S.ui.pageOrder.today;
    }
    if(!S.ui.subOrder || typeof S.ui.subOrder!=='object') S.ui.subOrder = {};
    if(!S.ui.subHide || typeof S.ui.subHide!=='object') S.ui.subHide = {};
    /* 古い1画面1メモを、複数メモの形に移す */
    if(d0.memos && typeof d0.memos==='object' && !Array.isArray(d0.memos) && !S.notes.length){
      Object.keys(d0.memos).forEach(function(k){
        var m = d0.memos[k]; if(!m || (!m.text && !(m.photos||[]).length)) return;
        S.notes.push({ id:uid('nt'), title:({today:'今日',money:'お金',risyu:'履修',work:'バイト'})[k]||k, body:m.text||'',
          pinned:0, checks:[], photos:m.photos||[], link:null, mt:m.mt||Date.now() });
      });
    }
    var os = d0.settings || {};
    if(S.settings.minWeekday == null || !Number(S.settings.minWeekday)){
      var ow = toNum(os.wageWeekday) || toNum(os.wage);
      if(ow) S.settings.minWeekday = Math.round(ow/60*10)/10;
    }
    if(S.settings.minWeekend == null || !Number(S.settings.minWeekend)){
      var ow2 = toNum(os.wageWeekend);
      if(ow2) S.settings.minWeekend = Math.round(ow2/60*10)/10;
    }
  }
}catch(e){
  /* 読みこめなかったときは、上書きして消してしまわないよう、元のデータを別に取っておく */
  try{
    var rawBad = localStorage.getItem(KEY);
    if(rawBad) localStorage.setItem(KEY + ':broken:' + Date.now(), rawBad);
  }catch(e2){}
  logErr('起動', '保存したデータを読みこめませんでした（元のデータは別に取ってあります）：' + (e && e.message || e));
}

/* ===== 直した時刻を自動で記録する =====
   どこで直しても同期でちゃんと新しい方が残るように、
   保存のたびに「中身が変わったところ」の時刻をつけておく。      */
var __syncSig = {};
function syncSigOf(k){
  try{
    /* 設定は、端末ごとの鍵（APIキーなど）の変化では「直した」にしない */
    if(k === 'settings' && typeof syncSettingsOf === 'function') return JSON.stringify(syncSettingsOf());
    return JSON.stringify(S[k]);
  }catch(e){ return null; }
}
function syncSigRefresh(){
  if(typeof META_KEYS === 'undefined' || !Array.isArray(META_KEYS)) return;
  META_KEYS.forEach(function(k){ __syncSig[k] = syncSigOf(k); });
}
function autoTouch(){
  if(typeof META_KEYS === 'undefined' || !Array.isArray(META_KEYS)) return;
  META_KEYS.forEach(function(k){
    var s = syncSigOf(k);
    if(s === null) return;
    if(__syncSig[k] === undefined){ __syncSig[k] = s; return; }   /* はじめは記録だけ */
    if(__syncSig[k] !== s){ __syncSig[k] = s; S.meta[k] = Date.now(); }
  });
}
/* ===== どの端末で直したかを、1件ずつ記録する ===== */
var __itemSig = null;
var STAMP_LISTS = ['spends','income','fixed','balances','events','tasks','exams','health','shifts','holidays','notes','notices','breaks','plans','cards','suggests'].concat(EXTRA_LISTS);
function itemSigAll(){
  var all = {};
  STAMP_LISTS.forEach(function(k){
    var m = {};
    (Array.isArray(S[k]) ? S[k] : []).forEach(function(x){ if(x && x.id) m[x.id] = JSON.stringify(x); });
    all[k] = m;
  });
  return all;
}
function stampItems(){
  if(!__itemSig){ __itemSig = itemSigAll(); return; }     /* はじめは記録だけ */
  var now = Date.now();
  STAMP_LISTS.forEach(function(k){
    var prev = __itemSig[k] || {}, next = {};
    (Array.isArray(S[k]) ? S[k] : []).forEach(function(x){
      if(!x || !x.id) return;
      var s = JSON.stringify(x);
      if(prev[x.id] !== s){
        x.by = DEV.id; x.byAt = now;
        if(!x.mt || (prev[x.id] && Number(x.mt) < now - 1000)) x.mt = now;   /* 時刻をつけ忘れた直し方も、同期で負けないように */
        s = JSON.stringify(x);
      }
      next[x.id] = s;
    });
    __itemSig[k] = next;
  });
}
function itemSigRefresh(){ __itemSig = itemSigAll(); }
function persist(){
  autoTouch();
  try{ stampItems(); }catch(e){}
  if(typeof gasCalSoon === 'function') gasCalSoon();     /* 予定が変わっていたら、少しあとでGoogleカレンダーへ */
  try{ localStorage.setItem(KEY, JSON.stringify(S)); }
  catch(e){
    logErr('保存', 'この端末に保存できませんでした：' + (e && e.message || e));
    toast('この端末に保存できませんでした。設定 › 容量から整理してください。', true);
  }
}
if(!S.settings.room){ S.settings.room = DEFAULT_ROOM || randCode(); persist(); }

/* いまの季節（3〜5春、6〜8夏、9〜11秋、12〜2冬） */
function seasonNow(){
  var m = new Date().getMonth() + 1;
  return (m>=3&&m<=5) ? 'spring' : (m>=6&&m<=8) ? 'summer' : (m>=9&&m<=11) ? 'autumn' : 'winter';
}
var SEASON_THEME = { spring:'sakura', summer:'mint', autumn:'peach', winter:'sky' };
/* 時間帯（6つに分ける） */
function timeBandNow(){
  var h = new Date().getHours();
  if(h < 5)  return 'night';     /* 深夜 */
  if(h < 8)  return 'dawn';      /* 明け方 */
  if(h < 11) return 'morning';   /* 朝 */
  if(h < 16) return 'noon';      /* 昼 */
  if(h < 19) return 'evening';   /* 夕方 */
  if(h < 23) return 'dusk';      /* 夜 */
  return 'night';
}
var BAND_NAME = { dawn:'明け方', morning:'朝', noon:'昼', evening:'夕方', dusk:'夜', night:'深夜' };
var SEASON_NAME  = { spring:'春', summer:'夏', autumn:'秋', winter:'冬' };
function applyUi(){
  /* 前の版の「季節で色を変える」設定も、季節モードとして扱う */
  var mode = S.ui.bgMode || ((S.ui.season || S.ui.seasonTheme) ? 'season' : 'fixed');
  var th = (mode === 'season' || mode === 'mix') ? (SEASON_THEME[seasonNow()] || 'pink') : (S.ui.theme || 'pink');
  document.body.setAttribute('data-theme', th);
  var fsId = c9FsNow().id;
  document.body.setAttribute('data-fs', fsId);
  document.documentElement.setAttribute('data-fs', fsId);     /* 「システムに合わせる」は html の大きさも使う */
  var stl = uiStyleNow().id;
  if(stl !== 'glass') document.body.setAttribute('data-style', stl); else document.body.removeAttribute('data-style');
  var fnt = uiFontNow();
  if(fnt.css){ document.body.setAttribute('data-font', fnt.id); document.body.style.setProperty('--ff', uiFontStack(fnt)); loadUiFont(fnt); }
  else { document.body.removeAttribute('data-font'); document.body.style.removeProperty('--ff'); }
  if(th === 'custom') applyCustomTheme(); else clearCustomTheme();
  document.body.setAttribute('data-season', (mode==='season'||mode==='mix') ? seasonNow() : '');
  /* 行事のかざりは、背景の設定とは別に選べる */
  var fes = (S.ui.fesMode === 0) ? '' : (festivalNow() || '');
  document.body.setAttribute('data-fes', fes);
  document.body.setAttribute('data-band', (mode==='time'||mode==='mix') ? timeBandNow() : '');
  if(typeof applyDecor==='function'){ var hd=document.getElementById('decor'); if(hd) hd.dataset.key=''; applyDecor(); }
}
/* 季節の行事（背景がすこし変わる） */
/* その日の行事をさがす（日付が近いほど優先） */
function festivalOn(ymd){
  var d = isYmd(ymd) ? ymd : today();
  var a = d.split('-');
  var m = +a[1], dd = +a[2];
  /* 期間で決まるもの */
  if(m===12 && dd>=18 && dd<=25) return 'xmas';
  if((m===12 && dd>=26) || (m===1 && dd<=5)) return 'newyear';
  if(m===10 && dd>=25 && dd<=31) return 'halloween';
  if(m===2 && dd>=10 && dd<=14) return 'valentine';
  if(m===2 && dd===3) return 'setsubun';
  if(m===3 && dd===3) return 'hinamatsuri';
  if(m===3 && dd>=25) return 'sakura';
  if(m===4 && dd<=10) return 'sakura';
  if(m===5 && dd>=3 && dd<=5) return 'kodomo';
  if(m===6 && dd>=1 && dd<=30) return (dd>=5 && dd<=25) ? 'tsuyu' : '';
  if(m===7 && dd>=1 && dd<=7) return 'tanabata';
  if(m===7 && dd>=20) return 'natsu';
  if(m===8 && dd<=20) return 'natsu';
  if(m===9 && dd>=10 && dd<=20) return 'tsukimi';
  if(m===11 && dd>=10 && dd<=30) return 'kouyou';
  /* 祝日そのもの */
  if(holidayName(d)) return 'holiday';
  return '';
}
function festivalNow(){ return festivalOn(today()); }
var FES_NAME = { xmas:'クリスマス', newyear:'お正月', halloween:'ハロウィン', valentine:'バレンタイン',
  setsubun:'節分', hinamatsuri:'ひなまつり', sakura:'桜の季節', kodomo:'こどもの日', tsuyu:'梅雨',
  tanabata:'七夕', natsu:'真夏', tsukimi:'お月見', kouyou:'紅葉', holiday:'祝日' };
/* いま文字を入力しているか（入力中は勝手に画面を描き直さない） */
var imeOn = false;
document.addEventListener('compositionstart', function(){ imeOn = true; });
document.addEventListener('compositionend', function(){ imeOn = false; });
function isTyping(){
  if(imeOn) return true;                 /* 日本語を変換している最中 */
  var a = document.activeElement;
  if(!a) return false;
  if(/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)){
    if(a.type === 'checkbox' || a.type === 'color' || a.type === 'file') return false;
    return true;
  }
  return false;
}
var renderPending = false;
/* 入力が終わったら、あとで描き直す */
function renderLater(){
  renderPending = true;
}
document.addEventListener('focusout', function(){
  setTimeout(function(){
    if(renderPending && !isTyping()){ renderPending = false; render(); }
  }, 120);
});
function commit(){ persist(); pushRemote(); render(); }
function touch(k){ S.meta[k] = Date.now(); }

var toastTimer=null;
function toast(text, bad){
  if(window.__undoWatch && !bad) window.__undoWatch.toasts.push(String(text));
  var t = document.getElementById('toast');
  if(!t) return;
  /* キャラクターがいるときは、小さな顔をそえる */
  var face = (typeof charaLevel === 'function' && charaLevel() >= 2) ? charaFace(bad ? 'sad' : 'happy', 22) : '';
  t.innerHTML = face + '<span>' + esc(text) + '</span>';
  t.className = 'on' + (bad ? ' bad' : '') + (face ? ' withch' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.className = bad?'bad':''; }, 2600);
}

/* 支払い済みは値＋更新時刻 */
function normPaid(p){
  if(p === true) return { v:1, t:0 };
  if(p === false || p == null) return null;
  if(typeof p === 'object') return { v: p.v ? 1 : 0, t: Number(p.t)||0 };
  return { v:1, t:0 };
}
function isPaid(k){ var p = normPaid(S.paid[k]); return !!(p && p.v); }
function setPaid(k, on){ S.paid[k] = { v: on?1:0, t: Date.now() }; }

/* ============================== 集計 ============================== */
function derive(){
  var rows = S.plans.reduce(function(a,p){ return a.concat(planRows(p)); }, []);
  var set = {};
  rows.forEach(function(r){ set[r.month]=1; });
  S.statements.forEach(function(s){ if(s.billingMonth) set[s.billingMonth]=1; });
  set[thisYm()]=1;
  var months = Object.keys(set).sort();
  var byMonth = {};
  months.forEach(function(m){ byMonth[m] = { smbc:{plan:0,stmt:0,rows:[],stmts:[]}, rakuten:{plan:0,stmt:0,rows:[],stmts:[]} }; });
  rows.forEach(function(r){ var g=byMonth[r.month]; if(!g||!g[r.accountId]) return; g[r.accountId].plan+=r.amount; g[r.accountId].rows.push(r); });
  S.statements.forEach(function(s){ var g=byMonth[s.billingMonth]; if(!g||!g[s.accountId]) return; g[s.accountId].stmt += Number(s.amount)||0; g[s.accountId].stmts.push(s); });
  var monthTotal = function(m){ var g=byMonth[m]; if(!g) return 0; return g.smbc.plan+g.smbc.stmt+g.rakuten.plan+g.rakuten.stmt; };
  return { rows:rows, months:months, byMonth:byMonth, monthTotal:monthTotal };
}
function sumBy(arr, f){ return (arr||[]).reduce(function(a,x){ return a + (Number(f(x))||0); }, 0); }
function budget(){
  var d = derive(), cur = thisYm();
  var pay = d.monthTotal(cur);
  var fx  = sumBy(S.fixed, function(x){ return x.amount; });
  var inc = sumBy(S.income, function(x){ return x.amount; });
  var bal = sumBy(S.balances, function(x){ return x.amount; });
  var have = bal + inc;                 /* 口座にあるお金＋今月入るお金 */
  var out  = pay + fx;                  /* 今月出ていくお金 */
  var free = have - out;
  var rate = have > 0 ? free / have : (free >= 0 ? 1 : -1);
  var level, word;
  if(have === 0){ level='none'; word='口座残高か収入を登録すると判定できます'; }
  else if(free < 0){ level='bad';  word='今月は足りません'; }
  else if(rate < .12){ level='warn'; word='かなりギリギリです'; }
  else if(rate < .3){ level='ok';   word='やりくりすれば大丈夫'; }
  else { level='good'; word='余裕があります'; }
  return { pay:pay, fixed:fx, income:inc, balance:bal, have:have, free:free,
           level:level, word:word, month:cur };
}

