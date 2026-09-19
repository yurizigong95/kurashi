/* くらしの手帳：おせわ・キャラの追加
   （着せかえショップ・進化の分かれ道・育てた子の図鑑・お部屋のもようがえ・今日タブの子・誕生日と記念日・天気・おさんぽ） */
/* ============================== データ ==============================
   ・子（S.pets[キャラID]）… wear:{ head, face, neck, body, hand }（着ている服）・worn:{ 服id:1 }（一度でも着た服）
                            pts:{ 道:点 }（育ち方）・path（おとなの道）・path2（マスターの道）・hatch（生まれた時刻）・gen（何代目）
   ・おせわ全体（S.pets._）… wall・floor（かべがみ・ゆか）・pos:{ かざりid:{ x, y } }（かざりを置いた場所。%）
   ・買ったもの … S.petDays['日|端末'].ppBuy = ['w:服', 'wall:id', 'floor:id', 'deco:id']
                 （日と端末ごとの記録なので、2台で同時に買っても消えない。使ったコインも同じ記録に入る）
   ・S.kmItems（mod:'petplus'）… type:'walk'（おさんぽの記録）・type:'grad'（卒業した子）。coins … そこでもらったコイン
   ・S.kmData … 'petplus:walk'（いまのおさんぽ。id が空なら、おさんぽしていない）
                'petplus:gift:日:しるし'（記念日のプレゼントを受けとった。coins）
   ・S.ui.petplus … { annivNotify:1 }（記念日の前の日に知らせる）
   ・S.annivs … { id, mt, name, date:'MM-DD'|'YYYY-MM-DD', kind:'birthday'|'anniv', who:'self'|'family'|'friend'|'other', memo }
   画面を描くだけでは S を変えない。コインは petPay（使う）と、記録から数える ppCoinsExtra（もらう）だけで動かす。 */

/* ============================== 着せかえ ============================== */
var PP_SLOTS = [['head', 'ぼうし・かみ'], ['face', 'めがね・かお'], ['neck', 'くび'], ['body', 'ふく'], ['hand', 'てにもつ']];
var PP_WEAR = [
  /* ぼうし・かみかざり */
  { id:'ribbonp',  slot:'head', name:'リボン（ピンク）',   icon:'🎀', price:50 },
  { id:'ribbonb',  slot:'head', name:'リボン（みずいろ）', icon:'🎀', price:50 },
  { id:'beret',    slot:'head', name:'からし色のベレー帽', icon:'🧢', price:80 },
  { id:'straw',    slot:'head', name:'むぎわらぼうし',     icon:'👒', price:90 },
  { id:'knit',     slot:'head', name:'ニットぼう',         icon:'🧶', price:90 },
  { id:'catears',  slot:'head', name:'ねこみみカチューシャ', icon:'🐱', price:100 },
  { id:'tophat',   slot:'head', name:'シルクハット',       icon:'🎩', price:150 },
  { id:'flowers',  slot:'head', name:'花かんむり',         icon:'🌼', price:110 },
  { id:'starpin',  slot:'head', name:'星のヘアピン',       icon:'⭐', price:40 },
  { id:'tiara',    slot:'head', name:'ティアラ',           icon:'👑', price:180 },
  { id:'nursecap', slot:'head', name:'ナースキャップ（十字）', icon:'🏥', price:120 },
  { id:'sakura',   slot:'head', name:'さくらのかみかざり', icon:'🌸', price:80,  months:[3, 4] },
  { id:'witch',    slot:'head', name:'まじょのぼうし',     icon:'🧙', price:120, months:[10] },
  { id:'santa',    slot:'head', name:'サンタぼうし',       icon:'🎅', price:120, months:[11, 12] },
  { id:'clover',   slot:'head', name:'四つ葉のピン',       icon:'🍀', price:0, walk:1 },
  /* めがね・かお */
  { id:'glasses',  slot:'face', name:'あかいまるめがね',   icon:'👓', price:70 },
  { id:'sunglass', slot:'face', name:'サングラス',         icon:'🕶️', price:100 },
  { id:'heartgl',  slot:'face', name:'ハートのめがね',     icon:'💗', price:120 },
  { id:'mask',     slot:'face', name:'マスク',             icon:'😷', price:40 },
  /* くび */
  { id:'bowtie',   slot:'neck', name:'ちょうネクタイ',     icon:'🎀', price:60 },
  { id:'scarf',    slot:'neck', name:'あおいマフラー',     icon:'🧣', price:90 },
  { id:'pearl',    slot:'neck', name:'パールのネックレス', icon:'📿', price:150 },
  { id:'bell',     slot:'neck', name:'すずのくびかざり',   icon:'🔔', price:60 },
  { id:'bandana',  slot:'neck', name:'バンダナ',           icon:'🟦', price:70 },
  { id:'shell',    slot:'neck', name:'貝がらのネックレス', icon:'🐚', price:0, walk:1 },
  /* ふく */
  { id:'apron',    slot:'body', name:'エプロン',           icon:'🍳', price:100 },
  { id:'nursewear',slot:'body', name:'ナースのエプロン',   icon:'🩺', price:130 },
  { id:'cape',     slot:'body', name:'ヒーローのマント',   icon:'🦸', price:140 },
  { id:'raincoat', slot:'body', name:'レインコート',       icon:'🧥', price:110 },
  { id:'sweater',  slot:'body', name:'セーター',           icon:'🧶', price:110 },
  { id:'tutu',     slot:'body', name:'ふりふりスカート',   icon:'🩰', price:130 },
  { id:'yukata',   slot:'body', name:'ゆかた',             icon:'👘', price:150, months:[7, 8] },
  { id:'santasuit',slot:'body', name:'サンタのふく',       icon:'🎄', price:160, months:[12] },
  /* てにもつ */
  { id:'balloon',  slot:'hand', name:'ふうせん',           icon:'🎈', price:50 },
  { id:'wand',     slot:'hand', name:'まほうのステッキ',   icon:'🪄', price:120 },
  { id:'bouquet',  slot:'hand', name:'花たば',             icon:'💐', price:90 },
  { id:'stetho',   slot:'hand', name:'ちょうしんき',       icon:'🩺', price:150 },
  { id:'lolli',    slot:'hand', name:'ぺろぺろキャンディ', icon:'🍭', price:40 },
  { id:'mitten',   slot:'hand', name:'てぶくろ',           icon:'🧤', price:80,  months:[12, 1, 2] },
  { id:'acorn',    slot:'hand', name:'どんぐりのかばん',   icon:'🌰', price:0, walk:1 }
];
var PP_WEAR_BY = {};
PP_WEAR.forEach(function(x){ PP_WEAR_BY[x.id] = x; });
var PP_WALK_WEAR = PP_WEAR.filter(function(x){ return x.walk; }).map(function(x){ return x.id; });

/* ============================== 進化の道 ============================== */
var PP_PATHS = [
  { id:'hakase',  name:'はかせ',   icon:'🎓', color:'#5B7FD6', hat:'megane',    prop:'book',   title:'ものしりはかせ',   title2:'だいはかせ',
    how:'暗記カード・おべんきょうクイズ・課題や暗記のミッション' },
  { id:'genki',   name:'げんき',   icon:'⚡', color:'#F08A2C', hat:'hachimaki', my:'ball',     title:'げんきっこ',       title2:'スーパーアスリート',
    how:'おさんぽ（歩数）・ほしキャッチ・ボールあそび・サラダ' },
  { id:'idol',    name:'アイドル', icon:'🎤', color:'#EE5FA0', hat:'star',      my:'mic',      title:'きらきらアイドル', title2:'トップアイドル',
    how:'きせかえ・もようがえ・おふろ・ケーキ' },
  { id:'nonbiri', name:'のんびり', icon:'🍵', color:'#3FAF83', hat:'leaf',      prop:'cup',    title:'のんびりや',       title2:'ひなたぼっこの名人',
    how:'おやつ・おひるね・なでなで・会いにくる' },
  { id:'nurse',   name:'ナース',   icon:'🩺', color:'#E35D7A', hat:'nurse',     prop:'stetho', title:'やさしいナース',   title2:'スーパーナース',
    how:'授業に出る・ごはん・おふろ・おくすり' }
];
var PP_PATH_BY = {};
PP_PATHS.forEach(function(x){ PP_PATH_BY[x.id] = x; });
/* 点が同じときの順（前からのおとなはナースキャップだったので、ナースを先に） */
var PP_PATH_TIE = ['nurse', 'hakase', 'genki', 'idol', 'nonbiri'];

/* ============================== もようがえ ============================== */
var PP_WALLS = [
  { id:'pinkdot',  name:'ピンクのみずたま', icon:'🩷', price:60 },
  { id:'mint',     name:'ミントのストライプ', icon:'💚', price:60 },
  { id:'lemon',    name:'レモンのチェック', icon:'💛', price:70 },
  { id:'sky',      name:'あおぞら',         icon:'☁️', price:80 },
  { id:'lavender', name:'ラベンダー',       icon:'💜', price:80 },
  { id:'log',      name:'ログハウス',       icon:'🪵', price:90 },
  { id:'night',    name:'ほしぞら',         icon:'🌌', price:120 },
  { id:'sakura',   name:'さくら',           icon:'🌸', price:100, months:[3, 4] }
];
var PP_FLOORS = [
  { id:'wood',   name:'フローリング', icon:'🟫', price:60 },
  { id:'tatami', name:'たたみ',       icon:'🟩', price:70 },
  { id:'tile',   name:'しろいタイル', icon:'⬜', price:70 },
  { id:'check',  name:'チェックのゆか', icon:'🏁', price:60 },
  { id:'carpet', name:'ピンクのじゅうたん', icon:'🟪', price:80 },
  { id:'grass',  name:'しばふ',       icon:'🌱', price:90 }
];
var PP_WALL_BY = {}, PP_FLOOR_BY = {};
PP_WALLS.forEach(function(x){ PP_WALL_BY[x.id] = x; });
PP_FLOORS.forEach(function(x){ PP_FLOOR_BY[x.id] = x; });
var PP_GRID = { cols:6, rows:4 };

/* ============================== おさんぽ ============================== */
var PP_WALK_MAX = 3;        /* 1日に行ける回数 */
var PP_WALK_LEN = 8;        /* 道のマスの数 */
var PP_WALK_MIN = 3;        /* 歩数がないときは、3分で1マス */
var PP_WALK_STEP = 400;     /* 400歩で1マス */
var PP_SPOTS = [
  { id:'park',     name:'公園',       icon:'🌳', photo:['ブランコでゆらゆらした', '四つ葉のクローバーをさがした', 'ベンチでひとやすみ'] },
  { id:'river',    name:'川ぞい',     icon:'🏞️', photo:['カモの親子が泳いでいた', '水がきらきらしていた', '石を3回はねさせた'] },
  { id:'shops',    name:'商店街',     icon:'🏪', photo:['コロッケのいいにおい', 'おみせのねこにあいさつ', 'くじびきで「またきてね」'] },
  { id:'bakery',   name:'パン屋さん', icon:'🥐', photo:['やきたてのメロンパン', 'パン屋さんがにっこり'] },
  { id:'shrine',   name:'神社',       icon:'⛩️', photo:['テストがうまくいきますように', 'おみくじは大吉！'] },
  { id:'library',  name:'図書館',     icon:'📚', photo:['どうぶつの図鑑を見た', 'しずかにページをめくった'] },
  { id:'hospital', name:'病院の前',   icon:'🏥', photo:['看護師さんがかっこよかった', '「いつかここで」とおもった'] },
  { id:'station',  name:'駅',         icon:'🚉', photo:['電車に手をふった', '駅の花だんがきれい'] },
  { id:'flowers',  name:'花だん',     icon:'🌷', photo:['ちょうちょが2ひき', 'いいにおいの花'] },
  { id:'hill',     name:'見晴らしの丘', icon:'⛰️', photo:['まちがぜんぶ見えた', '雲がうさぎのかたち'] },
  { id:'cafe',     name:'カフェ',     icon:'☕', photo:['まどから見たラテアート', 'あまいにおいでしあわせ'] },
  { id:'campus',   name:'大学',       icon:'🏫', photo:['キャンパスのいちょう並木', '学食のにおいがした'] }
];
var PP_SPOT_BY = {};
PP_SPOTS.forEach(function(x){ PP_SPOT_BY[x.id] = x; });

/* ============================== 天気 ============================== */
var PP_WX = {
  rain:  { icon:'☔', word:'雨',     line:'雨だね。かさと長ぐつで、じゅんびOK！' },
  snow:  { icon:'⛄', word:'雪',     line:'雪だ！ゆきだるま、つくったよ' },
  hot:   { icon:'🥵', word:'あつい', line:'あついね…うちわでぱたぱた。水分とってね' },
  cold:  { icon:'🧣', word:'さむい', line:'さむいね。マフラーでぬくぬく' },
  sunny: { icon:'☀️', word:'はれ',   line:'いいお天気！ごきげんだよ' },
  cloud: { icon:'☁️', word:'くもり', line:'くもりの日は、のんびりいこう' }
};
var PP_MOOD = { love:['だいすき', '😍'], happy:['ごきげん', '😊'], normal:['ふつう', '🙂'], sad:['さみしい', '🥺'], cry:['おなかぺこぺこ', '😢'],
  sweat:['よごれている', '🫧'], dizzy:['ぐあいがわるい', '🤒'], sleep:['ねむい', '😴'], sparkle:['おいわい', '🎉'] };
var PP_WHO = [['self', '自分'], ['family', '家族'], ['friend', '友だち'], ['other', 'そのほか']];

var ppDressSlot = 'all';   /* きせかえの絞りこみ */
var ppMoveSel = '';        /* もようがえで動かすかざり */
var ppAnEdit = '';         /* なおしている記念日 */

/* ============================== 小道具 ============================== */
function ppPrefs(){ return Object.assign({ annivNotify:0 }, (S.ui && S.ui.petplus) || {}); }
function ppItems(type){
  return (Array.isArray(S.kmItems) ? S.kmItems : []).filter(function(x){ return x && x.mod === 'petplus' && (!type || x.type === type); });
}
function ppData(){ return (S.kmData && typeof S.kmData === 'object' && !Array.isArray(S.kmData)) ? S.kmData : {}; }
function ppInSeason(x){ return typeof petInSeason === 'function' ? petInSeason(x) : true; }
function ppMonthsLabel(ms){ return (ms || []).map(function(m){ return m + '月'; }).join('・'); }
function ppHash(s){
  var h = 2166136261;
  s = String(s);
  for(var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function ppRnd(seed){
  var s = (seed % 2147483646) + 1;
  return function(){ s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
function ppYmdOf(ms){ var n = toNum(ms); return n > 0 ? toYmd(new Date(n)) : ''; }
function ppMd(ymd){ return isYmd(ymd) ? Number(ymd.slice(5, 7)) + '月' + Number(ymd.slice(8, 10)) + '日' : ''; }

/* ===== コイン（記録から数える。2台で同時にもらっても、ふえすぎない） ===== */
function ppCoinsExtra(){
  var n = 0;
  ppItems().forEach(function(x){ if(x.type === 'walk' || x.type === 'grad') n += toNum(x.coins); });
  var d = ppData();
  Object.keys(d).forEach(function(k){ if(k.indexOf('petplus:gift:') === 0 && d[k]) n += toNum(d[k].coins); });
  return n;
}
/* ===== 持ちもの（買った・見つけた） ===== */
function ppOwnedSet(){
  var set = {}, d = (typeof petDays === 'function') ? petDays() : {};
  Object.keys(d).forEach(function(k){ var r = d[k]; if(r && Array.isArray(r.ppBuy)) r.ppBuy.forEach(function(x){ set[x] = 1; }); });
  (petMeta().owned || []).forEach(function(x){ set['deco:' + x] = 1; });
  ppItems('walk').forEach(function(w){
    (Array.isArray(w.found) ? w.found : []).forEach(function(f){ if(f && f.kind === 'wear' && f.v) set['w:' + f.v] = 1; });
  });
  return set;
}
function ppOwned(key){ return !!ppOwnedSet()[key]; }
/* 買った記録（この端末・今日の記録に足す。使ったコインもここ＝petPay） */
function ppLogBuy(key){
  S.petDays = petDays();
  var k = today() + '|' + DEV.id;
  var o = Object.assign({}, S.petDays[k]);
  var list = Array.isArray(o.ppBuy) ? o.ppBuy.slice() : [];
  if(list.indexOf(key) < 0) list.push(key);
  o.ppBuy = list;
  o.mt = Date.now();
  S.petDays[k] = o;
  touch('petDays');
}
function ppBuy(key, price){
  if(ppOwned(key)) return true;
  if(!petPay(price)) return false;
  ppLogBuy(key);
  return true;
}

/* ============================== 絵 ============================== */
/* 顔や手の位置（キャラの形ごと）。自分の画像の子は、ふつうの形で */
function ppLayout(k){
  var f = (typeof chLayout === 'function' && k && !k.custom) ? chLayout(k) : null;
  return Object.assign({ eyeY:58, ex1:40, ex2:60, mouthY:66, top:27, armY:72, arms:true }, f || {});
}
function ppSt(L, w){ return ' stroke="' + L + '" stroke-width="' + (w || 1.8) + '" stroke-linejoin="round" stroke-linecap="round"'; }
function ppFlower(x, y, c, r){
  var o = '';
  for(var i = 0; i < 5; i++){ var a = i * 72 * Math.PI / 180; o += '<circle cx="' + (x + Math.cos(a) * r).toFixed(1) + '" cy="' + (y + Math.sin(a) * r).toFixed(1) + '" r="' + r + '" fill="' + c + '"/>'; }
  return o + '<circle cx="' + x + '" cy="' + y + '" r="' + (r * .8) + '" fill="#FFE07A"/>';
}
function ppStar(x, y, r, c, L){
  var p = [];
  for(var i = 0; i < 10; i++){ var a = (-90 + i * 36) * Math.PI / 180, rr = i % 2 ? r * .45 : r; p.push((x + rr * Math.cos(a)).toFixed(1) + ' ' + (y + rr * Math.sin(a)).toFixed(1)); }
  return '<path d="M' + p.join(' L') + ' Z" fill="' + c + '"' + ppSt(L, 1.2) + '/>';
}
function ppHeart(x, y, s, c, stroke){
  return '<path d="M' + x + ' ' + (y + 3.6 * s) + ' C' + (x - 6 * s) + ' ' + (y - .5 * s) + ' ' + (x - 3.6 * s) + ' ' + (y - 5.4 * s) + ' ' + x + ' ' + (y - 2 * s) +
    ' C' + (x + 3.6 * s) + ' ' + (y - 5.4 * s) + ' ' + (x + 6 * s) + ' ' + (y - .5 * s) + ' ' + x + ' ' + (y + 3.6 * s) + ' Z" fill="' + c + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="1.4"' : '') + '/>';
}
/* 服の絵（viewBox 0 0 100 100。キャラの絵と同じ場所に重ねる） */
function ppWearDraw(id, f, L){
  var s = ppSt(L), top = function(x){ return '<g transform="translate(0 ' + (f.top - 27) + ')">' + x + '</g>'; };
  var ey = f.eyeY, e1 = f.ex1, e2 = f.ex2, my = f.mouthY;
  var ny = Math.min(84, my + 13), by = Math.min(84, ny + 3), hy = f.arms ? f.armY : 74;
  switch(id){
    case 'ribbonp': case 'ribbonb':
      var rc = id === 'ribbonp' ? ['#F58CA8', '#E0607E'] : ['#8EC9F2', '#4F9ED6'];
      return top('<path d="M50 24 L38 16 L39 32 Z M50 24 L62 16 L61 32 Z" fill="' + rc[0] + '"' + s + '/><circle cx="50" cy="24" r="3.4" fill="' + rc[1] + '"' + s + '/>');
    case 'beret':
      return top('<ellipse cx="50" cy="25" rx="23" ry="8" transform="rotate(-8 50 25)" fill="#E3A93B"' + s + '/><path d="M48 17 q2 -5 5 -4" fill="none"' + ppSt(L, 2.2) + '/>');
    case 'straw':
      return top('<ellipse cx="50" cy="28" rx="34" ry="7.5" fill="#F3D58B"' + s + '/><path d="M34 28 Q34 12 50 12 Q66 12 66 28 Z" fill="#F3D58B"' + s + '/>' +
        '<path d="M34.5 24 Q50 27 65.5 24 L65.8 27.5 Q50 30 34.2 27.5 Z" fill="#7FB3E6"/>');
    case 'knit':
      return top('<path d="M29 31 Q29 9 50 9 Q71 9 71 31 Z" fill="#9FD3C7"' + s + '/><path d="M36 14 V30 M43 11 V30 M50 10 V30 M57 11 V30 M64 14 V30" stroke="#fff" stroke-width="1.2" opacity=".6"/>' +
        '<rect x="27" y="26" width="46" height="8" rx="4" fill="#6FB8A8"' + s + '/><circle cx="50" cy="8" r="5" fill="#fff"' + s + '/>');
    case 'catears':
      return top('<path d="M27 34 Q50 16 73 34" fill="none" stroke="#5A4A58" stroke-width="3"/><path d="M30 30 L32 13 L43 23 Z M70 30 L68 13 L57 23 Z" fill="#5A4A58"' + s + '/>' +
        '<path d="M33.5 25.5 L34.5 17.5 L39.5 22.5 Z M66.5 25.5 L65.5 17.5 L60.5 22.5 Z" fill="#F4A6B8"/>');
    case 'tophat':
      return top('<rect x="37" y="3" width="26" height="22" rx="2" fill="#3E3A48"' + s + '/><rect x="37" y="18" width="26" height="4.5" fill="#D9536B"/><ellipse cx="50" cy="26" rx="22" ry="4.5" fill="#3E3A48"' + s + '/>');
    case 'flowers':
      return top(ppFlower(30, 33, '#F8B9CB', 2.8) + ppFlower(40, 28, '#FFFFFF', 2.8) + ppFlower(50, 26, '#CDB8F6', 2.8) + ppFlower(60, 28, '#FFFFFF', 2.8) + ppFlower(70, 33, '#F8B9CB', 2.8));
    case 'starpin':
      return top(ppStar(68, 25, 6.5, '#F7D35B', L));
    case 'tiara':
      return top('<path d="M33 29 Q50 17 67 29" fill="none" stroke="#C9CED8" stroke-width="3" stroke-linecap="round"/><path d="M44 24 L50 10 L56 24 Z" fill="#E6EAF2"' + s + '/>' +
        '<circle cx="50" cy="18" r="2.6" fill="#8EC9F2"/><circle cx="40" cy="24.5" r="2" fill="#F58CA8"/><circle cx="60" cy="24.5" r="2" fill="#F58CA8"/>');
    case 'nursecap':
      return top('<path d="M33 30 L36 15 Q50 10 64 15 L67 30 Q50 25 33 30 Z" fill="#FFFFFF"' + s + '/><path d="M48 14 h4 v3.5 h3.5 v4 h-3.5 v3.5 h-4 v-3.5 h-3.5 v-4 h3.5 Z" fill="#F0587A"/>');
    case 'sakura':
      return top(ppFlower(66, 29, '#F8B9CB', 3.4) + ppFlower(57, 25, '#FBD3DF', 2.4));
    case 'witch':
      return top('<ellipse cx="50" cy="28" rx="31" ry="6" fill="#6C4F9E"' + s + '/><path d="M36 27 Q44 18 46 2 Q58 12 64 27 Z" fill="#6C4F9E"' + s + '/>' +
        '<path d="M37.5 24 Q50 22 62.5 24" fill="none" stroke="#F7C94F" stroke-width="3"/>');
    case 'santa':
      return top('<path d="M28 31 Q30 10 54 8 Q72 8 82 26 L76 30 Z" fill="#E0485A"' + s + '/><ellipse cx="52" cy="31" rx="27" ry="5.5" fill="#fff"' + s + '/><circle cx="82" cy="27" r="5" fill="#fff"' + s + '/>');
    case 'clover':
      return top('<path d="M66 32 Q64 36 62 38" stroke="#4E9A4B" stroke-width="1.6" fill="none"/>' +
        ppHeart(66, 22, .75, '#6CC46A') + '<g transform="rotate(90 66 27)">' + ppHeart(66, 22, .75, '#6CC46A') + '</g>' +
        '<g transform="rotate(180 66 27)">' + ppHeart(66, 22, .75, '#6CC46A') + '</g><g transform="rotate(270 66 27)">' + ppHeart(66, 22, .75, '#6CC46A') + '</g>');
    case 'glasses':
      return '<g fill="rgba(255,255,255,.25)" stroke="#D9536B" stroke-width="2"><circle cx="' + e1 + '" cy="' + ey + '" r="7"/><circle cx="' + e2 + '" cy="' + ey + '" r="7"/></g>' +
        '<path d="M' + (e1 + 7) + ' ' + (ey - 1) + ' Q50 ' + (ey - 4) + ' ' + (e2 - 7) + ' ' + (ey - 1) + '" fill="none" stroke="#D9536B" stroke-width="2"/>';
    case 'sunglass':
      return '<rect x="' + (e1 - 8) + '" y="' + (ey - 5) + '" width="16" height="10" rx="4" fill="#2E2A36"/><rect x="' + (e2 - 8) + '" y="' + (ey - 5) + '" width="16" height="10" rx="4" fill="#2E2A36"/>' +
        '<path d="M' + (e1 + 8) + ' ' + (ey - 2) + ' H' + (e2 - 8) + '" stroke="#2E2A36" stroke-width="2"/><path d="M' + (e1 - 5) + ' ' + (ey - 2) + ' l3 -2 M' + (e2 - 5) + ' ' + (ey - 2) + ' l3 -2" stroke="#fff" stroke-width="1.4" opacity=".7"/>';
    case 'heartgl':
      return ppHeart(e1, ey, 1.45, 'rgba(245,140,168,.78)', '#D9536B') + ppHeart(e2, ey, 1.45, 'rgba(245,140,168,.78)', '#D9536B') +
        '<path d="M' + (e1 + 8) + ' ' + (ey - 1) + ' H' + (e2 - 8) + '" stroke="#D9536B" stroke-width="1.8"/>';
    case 'mask':
      return '<path d="M' + (e1 - 10) + ' ' + (ey + 1) + ' L' + (e1 - 6) + ' ' + (my - 3) + ' M' + (e2 + 10) + ' ' + (ey + 1) + ' L' + (e2 + 6) + ' ' + (my - 3) + '" stroke="#D8DEE8" stroke-width="1.4"/>' +
        '<rect x="' + (e1 - 7) + '" y="' + (my - 7) + '" width="' + (e2 - e1 + 14) + '" height="13" rx="5" fill="#FFFFFF"' + s + '/>' +
        '<path d="M' + (e1 - 3) + ' ' + (my - 2) + ' H' + (e2 + 3) + ' M' + (e1 - 3) + ' ' + (my + 2) + ' H' + (e2 + 3) + '" stroke="#D8DEE8" stroke-width="1.2"/>';
    case 'bowtie':
      return '<path d="M50 ' + ny + ' L40 ' + (ny - 6) + ' L40 ' + (ny + 6) + ' Z M50 ' + ny + ' L60 ' + (ny - 6) + ' L60 ' + (ny + 6) + ' Z" fill="#D9536B"' + s + '/><circle cx="50" cy="' + ny + '" r="2.6" fill="#B8394F"' + s + '/>';
    case 'scarf':
      return '<path d="M24 ' + ny + ' Q50 ' + (ny + 12) + ' 76 ' + ny + '" fill="none" stroke="' + L + '" stroke-width="10" stroke-linecap="round"/>' +
        '<path d="M24 ' + ny + ' Q50 ' + (ny + 12) + ' 76 ' + ny + '" fill="none" stroke="#7FB3E6" stroke-width="7.5" stroke-linecap="round"/>' +
        '<path d="M62 ' + (ny + 5) + ' L66 ' + (ny + 16) + ' L72 ' + (ny + 14) + ' L68 ' + (ny + 3) + ' Z" fill="#7FB3E6"' + s + '/>';
    case 'pearl':
      var pr = '';
      for(var i = 0; i <= 8; i++){ var t = i / 8; pr += '<circle cx="' + (33 + 34 * t).toFixed(1) + '" cy="' + (ny - 2 + 8 * Math.sin(Math.PI * t)).toFixed(1) + '" r="2.3" fill="#FFFFFF" stroke="#C9C2D6" stroke-width=".9"/>'; }
      return pr;
    case 'bell':
      return '<path d="M33 ' + (ny - 2) + ' Q50 ' + (ny + 6) + ' 67 ' + (ny - 2) + '" stroke="#E0485A" stroke-width="4" fill="none" stroke-linecap="round"/>' +
        '<circle cx="50" cy="' + (ny + 5) + '" r="4.6" fill="#F7C94F"' + s + '/><path d="M47 ' + (ny + 6) + ' h6" stroke="' + L + '" stroke-width="1.2"/>';
    case 'bandana':
      return '<path d="M30 ' + (ny - 3) + ' Q50 ' + (ny + 2) + ' 70 ' + (ny - 3) + ' L50 ' + (ny + 13) + ' Z" fill="#6C8FD8"' + s + '/>' +
        '<circle cx="44" cy="' + (ny + 2) + '" r="1.2" fill="#fff"/><circle cx="56" cy="' + (ny + 2) + '" r="1.2" fill="#fff"/><circle cx="50" cy="' + (ny + 7) + '" r="1.2" fill="#fff"/>';
    case 'shell':
      return '<path d="M35 ' + (ny - 2) + ' Q50 ' + (ny + 6) + ' 65 ' + (ny - 2) + '" stroke="#C9A77A" stroke-width="1.4" fill="none"/>' +
        '<path d="M44 ' + (ny + 9) + ' Q50 ' + (ny - 1) + ' 56 ' + (ny + 9) + ' Z" fill="#FBD3C4"' + s + '/><path d="M50 ' + (ny + 1) + ' V' + (ny + 9) + ' M47 ' + (ny + 3) + ' L46 ' + (ny + 9) + ' M53 ' + (ny + 3) + ' L54 ' + (ny + 9) + '" stroke="#E0A08A" stroke-width=".9"/>';
    case 'apron':
      return '<path d="M38 ' + by + ' L62 ' + by + ' L66 91 L34 91 Z" fill="#FFFFFF"' + s + '/><rect x="45" y="' + (by + 5) + '" width="10" height="6" rx="2" fill="#F8C9D6"' + s + '/>';
    case 'nursewear':
      return '<path d="M36 ' + by + ' L64 ' + by + ' L68 91 L32 91 Z" fill="#FFFFFF"' + s + '/><path d="M48 ' + (by + 3) + ' h4 v3.5 h3.5 v4 h-3.5 v3.5 h-4 v-3.5 h-3.5 v-4 h3.5 Z" fill="#F0587A"/>';
    case 'cape':
      var cp = '<path d="M28 ' + (ny - 5) + ' Q13 74 15 95 L27 91 Q25 80 33 ' + ny + ' Z" fill="#D9536B"' + s + '/>';
      return cp + '<g transform="translate(100 0) scale(-1 1)">' + cp + '</g>';
    case 'raincoat':
      return '<path d="M30 ' + by + ' Q50 ' + (by - 4) + ' 70 ' + by + ' L76 92 L24 92 Z" fill="#F7D35B"' + s + '/><path d="M50 ' + (by - 2) + ' V92" stroke="' + L + '" stroke-width="1.2" opacity=".45"/>' +
        '<circle cx="53" cy="' + (by + 4) + '" r="1.3" fill="' + L + '"/><circle cx="53" cy="' + (by + 10) + '" r="1.3" fill="' + L + '"/>';
    case 'sweater':
      return '<path d="M24 ' + by + ' Q50 ' + (by + 4) + ' 76 ' + by + ' L78 91 Q50 95 22 91 Z" fill="#F2A7BD"' + s + '/>' +
        '<path d="M25 ' + (by + 5) + ' Q50 ' + (by + 9) + ' 75 ' + (by + 5) + '" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 2"/>';
    case 'tutu':
      return '<path d="M26 ' + by + ' L74 ' + by + ' L82 ' + (by + 10) + ' L18 ' + (by + 10) + ' Z" fill="#F8B9CB"' + s + '/>' +
        '<path d="M18 ' + (by + 10) + ' q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0" fill="none" stroke="#F58CA8" stroke-width="2"/>';
    case 'yukata':
      return '<path d="M28 ' + by + ' L72 ' + by + ' L74 92 L26 92 Z" fill="#4D5F86"' + s + '/><rect x="27" y="' + (by + 3) + '" width="46" height="6" fill="#F58CA8"' + s + '/>' +
        '<circle cx="35" cy="' + (by + 13) + '" r="1.6" fill="#fff"/><circle cx="50" cy="' + (by + 15) + '" r="1.6" fill="#fff"/><circle cx="65" cy="' + (by + 12) + '" r="1.6" fill="#fff"/>';
    case 'santasuit':
      return '<path d="M28 ' + by + ' L72 ' + by + ' L74 92 L26 92 Z" fill="#E0485A"' + s + '/><rect x="25" y="87" width="50" height="5" rx="2" fill="#fff"' + s + '/>' +
        '<path d="M50 ' + by + ' V87" stroke="#fff" stroke-width="3"/>';
    case 'balloon':
      return '<path d="M18 ' + hy + ' Q11 60 14 45" fill="none" stroke="' + L + '" stroke-width="1.2"/><ellipse cx="14" cy="33" rx="9" ry="11.5" fill="#8EC9F2"' + s + '/>' +
        '<path d="M11 27 q2 -3 5 -2" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>';
    case 'wand':
      return '<path d="M20 ' + (hy + 4) + ' L9 ' + (hy - 17) + '" stroke="#C9A77A" stroke-width="2.6" stroke-linecap="round"/>' + ppStar(8, hy - 20, 6.5, '#F7D35B', L);
    case 'bouquet':
      return '<path d="M12 ' + (hy - 6) + ' L17 ' + (hy + 12) + ' L24 ' + (hy - 6) + ' Z" fill="#A5D98F"' + s + '/>' +
        ppFlower(12, hy - 9, '#F8B9CB', 2.4) + ppFlower(19, hy - 12, '#FFFFFF', 2.4) + ppFlower(25, hy - 8, '#CDB8F6', 2.4);
    case 'stetho':
      return '<path d="M24 ' + (hy - 8) + ' Q10 ' + (hy + 2) + ' 14 ' + (hy + 14) + '" stroke="#6D8BB5" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
        '<circle cx="14" cy="' + (hy + 17) + '" r="4.2" fill="#D8E2EE" stroke="#6D8BB5" stroke-width="2"/>';
    case 'lolli':
      return '<path d="M19 ' + (hy + 4) + ' L14 ' + (hy - 14) + '" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M19 ' + (hy + 4) + ' L14 ' + (hy - 14) + '" stroke="' + L + '" stroke-width=".8" opacity=".4"/>' +
        '<circle cx="13" cy="' + (hy - 20) + '" r="7" fill="#F58CA8"' + s + '/><path d="M13 ' + (hy - 20) + ' m-4 0 a4 4 0 1 1 4 4 a2.4 2.4 0 1 1 -2 -3" fill="none" stroke="#fff" stroke-width="1.4"/>';
    case 'mitten':
      var mx = f.arms ? [20, 80] : [16, 84], mY = f.arms ? f.armY : 80;
      return mx.map(function(x){ return '<ellipse cx="' + x + '" cy="' + mY + '" rx="6.5" ry="5.5" fill="#E0485A"' + s + '/><rect x="' + (x - 6) + '" y="' + (mY + 3) + '" width="12" height="3.5" rx="1.5" fill="#fff"' + s + '/>'; }).join('');
    case 'acorn':
      return '<path d="M20 ' + (hy - 2) + ' Q14 ' + (hy + 4) + ' 12 ' + (hy + 10) + '" stroke="#9A6A3A" stroke-width="1.4" fill="none"/>' +
        '<ellipse cx="12" cy="' + (hy + 15) + '" rx="6" ry="6.5" fill="#C98A4B"' + s + '/><path d="M6 ' + (hy + 12) + ' Q12 ' + (hy + 6) + ' 18 ' + (hy + 12) + ' Z" fill="#7A5234"' + s + '/>';
    default: return '';
  }
}
/* 天気・進化の道で出す小物 */
function ppFxDraw(kind, f, L){
  var s = ppSt(L);
  switch(kind){
    case 'boots':
      return '<path d="M34 86 h9 v7 q0 3 -3 3 h-9 q-3 0 -3 -3 q0 -2 3 -2 h3 Z" fill="#F7C94F"' + s + '/><path d="M57 86 h9 v7 q0 3 -3 3 h-9 q-3 0 -3 -3 q0 -2 3 -2 h3 Z" fill="#F7C94F"' + s + '/>';
    case 'scarf':
      var ny = Math.min(84, f.mouthY + 13);
      return '<path d="M24 ' + ny + ' Q50 ' + (ny + 12) + ' 76 ' + ny + '" fill="none" stroke="' + L + '" stroke-width="10" stroke-linecap="round"/>' +
        '<path d="M24 ' + ny + ' Q50 ' + (ny + 12) + ' 76 ' + ny + '" fill="none" stroke="#E0607E" stroke-width="7.5" stroke-linecap="round"/>' +
        '<path d="M64 ' + (ny + 5) + ' L68 ' + (ny + 16) + ' L74 ' + (ny + 14) + ' L70 ' + (ny + 3) + ' Z" fill="#E0607E"' + s + '/>';
    case 'sweat':
      var ty = f.top;
      return '<path d="M22 ' + (ty + 8) + ' q-4 7 0 9 q4 -2 0 -9 Z" fill="#8CCBF2" stroke="#5B9BC8" stroke-width="1"/><path d="M80 ' + (ty + 14) + ' q-3.5 6 0 8 q3.5 -2 0 -8 Z" fill="#8CCBF2" stroke="#5B9BC8" stroke-width="1"/>';
    case 'fan':
      var hy = f.arms ? f.armY : 74;
      return '<path d="M19 ' + (hy + 6) + ' L13 ' + (hy - 6) + '" stroke="#9A6A3A" stroke-width="2.2" stroke-linecap="round"/><circle cx="11" cy="' + (hy - 14) + '" r="9" fill="#F7C0CF"' + s + '/>' +
        '<path d="M5 ' + (hy - 14) + ' h12 M11 ' + (hy - 20) + ' v12" stroke="#fff" stroke-width="1.2" opacity=".8"/>';
    case 'sun':
      return ppStar(12, 20, 4.5, '#F7C94F', '#E0A23A') + ppStar(89, 28, 3.5, '#F7C94F', '#E0A23A');
    case 'ball':
      return '<circle cx="82" cy="84" r="8" fill="#FFFFFF"' + s + '/><path d="M82 80 l3.4 2.5 -1.3 4 h-4.2 l-1.3 -4 Z" fill="#3E3A48"/><path d="M82 76 v4 M89 82 l-3.6 .5 M75 82 l3.6 .5 M79 91 l1 -4 M85 91 l-1 -4" stroke="#3E3A48" stroke-width="1"/>';
    case 'mic':
      return '<g transform="translate(70 58) rotate(18)"><rect x="4" y="9" width="4.5" height="17" rx="2" fill="#6B6B78"' + s + '/><circle cx="6.2" cy="6" r="6.5" fill="#C9CED8"' + s + '/>' +
        '<path d="M1.5 4 h9.5 M1 7.5 h10.5" stroke="#9AA2B2" stroke-width=".9"/></g>';
    default: return '';
  }
}
/* charaSvg の絵の中に重ねる（同じ viewBox なので、大きさ・うごきがそろう） */
function ppInject(html, svg, size){
  html = String(html || '');
  var i = html.lastIndexOf('</svg>');
  if(i >= 0) return html.slice(0, i) + '<g class="pp-ov">' + svg + '</g>' + html.slice(i);
  var ov = '<svg class="pp-ov" viewBox="0 0 100 100" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">' + svg + '</svg>';
  var j = html.lastIndexOf('</span>');
  return j >= 0 ? html.slice(0, j) + ov + html.slice(j) : html + ov;
}
/* おせわの子の見た目（pet.js の petSvg から呼ぶ。opt の帽子・持ちもの・表情を変えて、重ねる絵を返す） */
function ppLook(id, o, opt){
  if(!o || !o.stage) return null;
  var k = charaById(id), f = ppLayout(k), L = k.line || '#6E5A66';
  var wear = (o.wear && typeof o.wear === 'object' && !o.ppPlain) ? o.wear : {};
  /* 帽子を決めていないとき（あかちゃん）は、キャラの設定の帽子（季節のマフラー・めがねなど）がかぶさる */
  var hat0 = function(){ return (opt.hat !== undefined) ? opt.hat : (typeof charaHatNow === 'function' ? charaHatNow() : ''); };
  var lay = { body:'', neck:'', face:'', head:'', hand:'', fx:'', prop:'' };
  var cls = ['pp-rel'], after = '';
  /* 進化の道（おとな・マスター） */
  if(o.stage >= 3){
    var P = PP_PATH_BY[o.stage >= 4 ? (o.path2 || ppPathOf(id, o)) : ppPathOf(id, o)];
    if(P){
      cls.push('pp-path', 'pp-p-' + P.id);
      if(o.stage === 3) opt.hat = P.hat;
      if(!o.sleep){ if(P.prop) opt.prop = P.prop; else if(P.my){ opt.prop = ''; lay.prop = ppFxDraw(P.my, f, L); } }
      after += '<span class="pp-badge" style="--ppc:' + P.color + '" title="' + esc(P.name) + '">' + P.icon + '</span>';
    }
  }
  if(!o.ppPlain && !o.sleep){
    /* お祝いの日 */
    if(ppCelebToday().length){ opt.expr = 'sparkle'; opt.hat = 'party'; cls.push('pp-party'); }
    /* 天気 */
    var wx = ppWx();
    if(wx){
      cls.push('pp-wx-' + wx.kind);
      var g = function(x){ return '<g class="pp-fx-' + wx.kind + '">' + x + '</g>'; };
      if(wx.kind === 'rain'){ opt.prop = 'umbrella'; lay.prop = ''; lay.fx += g(ppFxDraw('boots', f, L)); }
      else if(wx.kind === 'snow'){ if(!wear.neck && hat0() !== 'scarf') lay.neck = g(ppFxDraw('scarf', f, L)); after += '<span class="pp-snowman" aria-hidden="true">⛄</span>'; }
      else if(wx.kind === 'cold'){ if(!wear.neck && hat0() !== 'scarf') lay.neck = g(ppFxDraw('scarf', f, L)); }
      else if(wx.kind === 'hot'){ lay.fx += g(ppFxDraw('sweat', f, L) + (wear.hand ? '' : ppFxDraw('fan', f, L))); }
      else if(wx.kind === 'sunny'){ if(opt.expr === 'normal') opt.expr = 'happy'; lay.fx += g(ppFxDraw('sun', f, L)); }
    }
  }
  /* 着せかえ */
  PP_SLOTS.forEach(function(sl){
    var it = PP_WEAR_BY[wear[sl[0]]];
    if(!it || it.slot !== sl[0]) return;
    lay[sl[0]] = '<g class="pp-w pp-w-' + it.id + '">' + ppWearDraw(it.id, f, L) + '</g>';
  });
  /* 着ている服と、キャラの帽子が重ならないように（ぼうし・めがね・マフラーが二重にならない） */
  if(wear.head && PP_WEAR_BY[wear.head]) opt.hat = '';
  if(wear.face && PP_WEAR_BY[wear.face] && hat0() === 'megane') opt.hat = '';
  if(wear.neck && PP_WEAR_BY[wear.neck] && hat0() === 'scarf') opt.hat = '';
  return { svg:lay.body + lay.neck + lay.face + lay.head + lay.hand + lay.prop + lay.fx, cls:cls.join(' '), after:after };
}

/* ============================== 進化の道 ============================== */
function ppSince(o){ return ppYmdOf(o && (o.hatch || o.born)) || '0000-00-00'; }
/* 道ごとの点（その子の育ち方＋生まれてからの勉強・歩数・おしゃれ） */
function ppPathScores(id, o){
  var pts = (o && o.pts && typeof o.pts === 'object') ? o.pts : {};
  var since = ppSince(o), cards = 0, steps = 0, cls = 0;
  var sl = S.studyLog || {};
  Object.keys(sl).forEach(function(k){ if(k.slice(0, 10) >= since) cards += toNum(sl[k] && sl[k].n); });
  var hl = S.healthLog || {};
  Object.keys(hl).forEach(function(k){ if(isYmd(k.slice(0, 10)) && k.slice(0, 10) >= since) steps += ppStepsOf(hl[k]) || 0; });
  var pd = (typeof petDays === 'function') ? petDays() : {};
  Object.keys(pd).forEach(function(k){ if(k.indexOf('m:') === 0 && k.slice(2) >= since && pd[k] && pd[k].got && pd[k].got['class']) cls++; });
  var own = ppOwnedSet(), wearOwn = Object.keys(own).filter(function(x){ return x.indexOf('w:') === 0; }).length;
  var worn = Object.keys((o && o.worn) || {}).length, deco = (petMeta().room || []).length;
  return {
    hakase:  (toNum(pts.hakase) || 0) + Math.floor(cards / 15),
    genki:   (toNum(pts.genki) || 0) + Math.floor(steps / 4000),
    idol:    (toNum(pts.idol) || 0) + Math.floor(wearOwn / 2) + worn + Math.floor(deco / 2),
    nonbiri: (toNum(pts.nonbiri) || 0),
    nurse:   (toNum(pts.nurse) || 0) + cls
  };
}
function ppPathBest(id, o){
  var sc = ppPathScores(id, o), best = PP_PATH_TIE[0];
  PP_PATH_TIE.forEach(function(p){ if(sc[p] > sc[best]) best = p; });
  return best;
}
/* いまの道（決まっていなければ、いまの育ち方からいちばん近い道） */
function ppPathOf(id, o){ return (o && PP_PATH_BY[o.path]) ? o.path : ppPathBest(id, o); }
/* おとな・マスターになったら、進む道を決める（petUpdate から。前からいる子も、次に世話したときに今の状態から決まる） */
function ppPathFix(id, save, stage){
  if(stage >= 3 && !PP_PATH_BY[save.path]){ save.path = ppPathBest(id, save); save.pathAt = Date.now(); }
  if(stage >= 4 && !PP_PATH_BY[save.path2]){ save.path2 = ppPathBest(id, save); }
}
function ppTitle(o, id){
  if(!o) return '';
  var st = (o.stage != null) ? o.stage : petStage(toNum(o.exp));
  if(st < 3) return '';
  if(st >= 4){ var P2 = PP_PATH_BY[o.path2] || PP_PATH_BY[ppPathOf(id, o)]; return P2 ? P2.title2 : ''; }
  var P = PP_PATH_BY[ppPathOf(id, o)];
  return P ? P.title : '';
}
function ppPathSection(id, o){
  if(!o || !o.stage) return '';
  var sc = ppPathScores(id, o), tot = 0;
  PP_PATHS.forEach(function(p){ tot += sc[p.id]; });
  var best = PP_PATH_BY[ppPathBest(id, o)], cur = PP_PATH_BY[ppPathOf(id, o)];
  var head;
  if(o.stage < 3) head = 'おとなになるとき、いちばん点が多い道にすすみます。' + (tot ? 'いまは <b>' + best.icon + ' ' + best.name + '</b> に近いよ。' : 'まだどの道にも決まっていません。');
  else if(o.stage === 3) head = 'いまの道：<b>' + cur.icon + ' ' + cur.name + '「' + cur.title + '」</b>' + (o.path ? '' : '（これまでの育ち方から）') +
    '。マスターになるときは、いまは「' + best.title2 + '」に近いよ。';
  else head = 'マスターの称号：<b>' + (PP_PATH_BY[o.path2] || cur).icon + '「' + esc(ppTitle(o, id)) + '」</b>（おとなのときは「' + cur.title + '」）';
  var rows = PP_PATHS.map(function(p){
    var pct = tot ? Math.round(sc[p.id] / tot * 100) : 0;
    return '<div class="pp-meter" style="--ppc:' + p.color + '"><span class="pp-mn">' + p.icon + ' ' + p.name + '</span>' +
      '<span class="pp-mbar" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="' + p.name + '" data-path="' + p.id + '"><i style="width:' + pct + '%"></i></span>' +
      '<span class="pp-mv num">' + pct + '%</span><span class="pp-mhow">' + esc(p.how) + '</span></div>';
  }).join('');
  var grad = o.stage >= 4 ? '<div class="pillrow" style="margin-top:10px"><button class="btn ghost" data-act="pp-grad">🎓 卒業させて、新しいたまごから育てる</button></div>' +
    '<p class="note">卒業した子は図鑑にのこります。卒業のお祝いに🪙100。</p>' : '';
  return section('進化の分かれ道', o.stage < 3 ? 'こども→おとな・おとな→マスター' : (cur ? cur.name + 'の道' : ''),
    '<div class="pp-phead">' + head + '</div>' + rows + grad);
}

/* ============================== 天気 ============================== */
function ppWx(){
  try{
    if(typeof weather === 'undefined' || !weather || weather.state !== 'ok') return null;
    var w = weather.sanda || weather.school;
    if(!w) return null;
    var cur = w.current || {}, d = w.daily || {};
    var first = function(a){ return (Array.isArray(a) && a.length && a[0] != null) ? Number(a[0]) : NaN; };
    var code = (cur.weather_code != null) ? Number(cur.weather_code) : first(d.weather_code);
    var temp = (cur.temperature_2m != null) ? Number(cur.temperature_2m) : NaN;
    var tmax = first(d.temperature_2m_max);
    var hot = (isFinite(tmax) && tmax >= 30) || (isFinite(temp) && temp >= 30);
    var cold = (isFinite(tmax) && tmax <= 10) || (isFinite(temp) && temp <= 5);
    var kind = '';
    if((code >= 71 && code <= 77) || code === 85 || code === 86) kind = 'snow';
    else if((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) kind = 'rain';
    else if(hot) kind = 'hot';
    else if(cold) kind = 'cold';
    else if(code >= 0 && code <= 1) kind = 'sunny';
    else if(code === 2 || code === 3 || code === 45 || code === 48) kind = 'cloud';
    if(!kind) return null;
    return Object.assign({ kind:kind, code:code, temp:isFinite(temp) ? Math.round(temp) : null }, PP_WX[kind]);
  }catch(e){ return null; }
}

/* ============================== 誕生日・記念日 ============================== */
/* 'MM-DD'・'YYYY-MM-DD'・'M/D' を読む */
function ppAnParse(date){
  var s = String(date || '').trim(), m;
  if((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) return { y:+m[1], m:+m[2], d:+m[3] };
  if((m = /^(\d{1,2})-(\d{1,2})$/.exec(s))) return { y:0, m:+m[1], d:+m[2] };
  if((m = /^(?:(\d{4})\/)?(\d{1,2})\/(\d{1,2})$/.exec(s))) return { y:+(m[1] || 0), m:+m[2], d:+m[3] };
  return null;
}
function ppAnValid(p){ return !!p && p.m >= 1 && p.m <= 12 && p.d >= 1 && p.d <= 31 && new Date(2000, p.m - 1, p.d).getDate() === p.d; }
/* その年の日付（2/29 は、うるう年でなければ 2/28） */
function ppAnOn(p, year){
  var d = p.d;
  if(p.m === 2 && d === 29 && new Date(year, 1, 29).getMonth() !== 1) d = 28;
  return year + '-' + pad(p.m) + '-' + pad(d);
}
function ppWhoName(w){ var x = PP_WHO.filter(function(a){ return a[0] === w; })[0]; return x ? x[1] : ''; }
function ppAnTitle(a){
  var nm = String(a.name || '').trim() || '記念日';
  if(a.kind === 'birthday'){
    if(a.who === 'self' && /^(自分|わたし|私|じぶん)$/.test(nm)) return 'あなたの誕生日';
    return /誕生日|たんじょうび/.test(nm) ? nm : nm + 'の誕生日';
  }
  return nm;
}
/* その日のお祝い（記念日・おせわの子のたんじょうび） */
function ppEventsOn(ymd){
  var out = [], y = Number(ymd.slice(0, 4));
  (Array.isArray(S.annivs) ? S.annivs : []).forEach(function(a){
    if(!a || !a.id) return;
    var p = ppAnParse(a.date);
    if(!ppAnValid(p) || ppAnOn(p, y) !== ymd) return;
    var n = p.y ? y - p.y : null;
    if(n != null && n < 0) return;
    var self = a.who === 'self' && a.kind === 'birthday';
    var title = self ? 'あなたの誕生日' : ppAnTitle(a);
    var sub = a.kind === 'birthday' ? (n ? n + 'さい' : '') : (n ? n + '年目' : '');
    out.push({ key:'an:' + a.id, ymd:ymd, src:'anniv', id:a.id, icon:a.kind === 'birthday' ? '🎂' : '💐', kind:a.kind || 'anniv', who:a.who || '',
      title:title + (sub ? '（' + sub + '）' : ''), memo:a.memo || '', coins:self ? 50 : 20,
      line:self ? 'おたんじょうびおめでとう！うまれてきてくれて、ありがとう'
        : a.kind === 'birthday' ? String(a.name || '') + 'に「おめでとう」を伝えてね'
        : 'きょうは' + String(a.name || '記念日') + '。すてきな日になりますように' });
  });
  Object.keys(petAll()).forEach(function(cid){
    if(cid === '_') return;
    var o = petNow(cid);
    if(!o || !o.stage) return;
    var b = ppYmdOf(o.hatch || o.born);
    if(!b) return;
    var nm = o.name || charaById(cid).name, days = daysBetween(b, ymd);
    if(days == null || days <= 0) return;
    var yrs = y - Number(b.slice(0, 4));
    if(yrs >= 1 && ymd.slice(5) === b.slice(5)){
      out.push({ key:'pet:' + cid + ':y' + yrs, ymd:ymd, src:'pet', id:cid, icon:'🥚', kind:'petbirthday', title:nm + 'のたんじょうび（' + yrs + 'さい）', coins:30,
        line:'きょうは、うまれた日！そだててくれて、ありがとう' });
    }
    if([100, 200, 300, 500, 1000].indexOf(days) >= 0){
      out.push({ key:'pet:' + cid + ':d' + days, ymd:ymd, src:'pet', id:cid, icon:'🎉', kind:'petdays', title:nm + 'が生まれて' + days + '日', coins:20,
        line:'生まれて' + days + '日！いつも、ありがとう' });
    }
  });
  return out;
}
function ppCelebToday(){ return ppEventsOn(today()); }
function ppNext(days){
  var out = [];
  for(var i = 0; i <= (days || 60); i++){
    var d = shiftDate(today(), i);
    ppEventsOn(d).forEach(function(ev){ ev.left = i; out.push(ev); });
  }
  return out;
}
function ppGiftKey(ev){ return 'petplus:gift:' + ev.ymd + ':' + ev.key; }
function ppGiftGot(ev){ var g = ppData()[ppGiftKey(ev)]; return !!(g && toNum(g.coins) > 0); }
/* 1つの記念日の、次の日（今日ならきょう） */
function ppAnNextYmd(a){
  var p = ppAnParse(a.date);
  if(!ppAnValid(p)) return '';
  var y = Number(today().slice(0, 4)), d = ppAnOn(p, y);
  return d >= today() ? d : ppAnOn(p, y + 1);
}

/* ============================== ひとこと ============================== */
function ppLine(id, o, mood){
  if(!o || !o.stage || o.sleep) return '';
  mood = mood || petMood(o);
  if(['dizzy', 'cry', 'sweat', 'sad', 'sleep'].indexOf(mood.expr) >= 0) return '';   /* 困っているときは、そちらを先に */
  var ev = ppCelebToday()[0];
  if(ev) return ev.line;
  var w = ppWalkNow();
  if(w && w.chara === id) return 'おさんぽ中！' + (PP_SPOT_BY[(w.route || [])[Math.max(0, ppWalkPos(w) - 1)]] || { name:'おうちのちかく' }).name + 'のあたりだよ';
  var wx = ppWx();
  if(wx) return wx.line;
  return '';
}

/* ============================== おさんぽ ============================== */
function ppStepsOf(r){
  if(r == null) return null;
  if(typeof r === 'number') return r;
  if(typeof r === 'object' && r.steps != null && r.steps !== '') return toNum(r.steps);
  return null;
}
function ppStepsOn(ymd){ return ppStepsOf((S.healthLog || {})[ymd]); }
function ppWalkNow(){ var w = ppData()['petplus:walk']; return (w && w.id && w.chara) ? w : null; }
function ppWalksOn(ymd){ return ppItems('walk').filter(function(x){ return x.ymd === ymd; }).length; }
function ppWalkLeft(){
  var w = ppWalkNow();
  return Math.max(0, PP_WALK_MAX - ppWalksOn(today()) - (w && w.ymd === today() ? 1 : 0));
}
function ppWalkPos(w){
  var mins = Math.max(0, (Date.now() - toNum(w.start)) / 60000);
  var p = Math.floor(mins / PP_WALK_MIN);
  var st = ppStepsOn(w.ymd);
  if(st != null){
    var base = toNum(w.steps0) >= 0 ? toNum(w.steps0) : 0;
    p = Math.max(p, Math.floor(Math.max(0, st - base) / PP_WALK_STEP));
  }
  return Math.max(0, Math.min(PP_WALK_LEN, p + toNum(w.bonus)));
}
/* i マスめで見つけるもの（おさんぽの id で決まる。途中で見ても、帰ってからも同じ） */
function ppWalkEvent(w, i){
  var r = ppRnd(ppHash(w.id + ':' + i));
  r(); var x = r();
  var spot = PP_SPOT_BY[(w.route || [])[i]] || PP_SPOTS[i % PP_SPOTS.length];
  if(x < .38){ var c = 3 + Math.floor(r() * 10); return { kind:'coin', v:c, spot:spot.id, text:spot.name + 'でコインを' + c + 'まい見つけた' }; }
  if(x < .58){
    var fid = ['onigiri', 'bread', 'straw', 'pudding', 'salad'][Math.floor(r() * 5)];
    var fd = PET_FOODS.filter(function(z){ return z.id === fid; })[0] || PET_FOODS[0];
    return { kind:'food', v:fd.id, spot:spot.id, text:spot.name + 'で' + fd.name + 'をもらった' };
  }
  if(x < .93) return { kind:'photo', v:spot.icon, spot:spot.id, text:spot.photo[Math.floor(r() * spot.photo.length)] };
  var wid = PP_WALK_WEAR[Math.floor(r() * PP_WALK_WEAR.length)], it = PP_WEAR_BY[wid];
  if(ppOwned('w:' + wid)) return { kind:'coin', v:15, spot:spot.id, text:it.name + 'をまた見つけた（コインにかえた）' };
  return { kind:'wear', v:wid, spot:spot.id, text:it.name + 'を見つけた！' };
}
function ppFoundIcon(f){
  if(f.kind === 'coin') return '🪙';
  if(f.kind === 'food'){ var fd = PET_FOODS.filter(function(z){ return z.id === f.v; })[0]; return fd ? fd.icon : '🍙'; }
  if(f.kind === 'wear') return (PP_WEAR_BY[f.v] || {}).icon || '👗';
  return '📷';
}
function ppWalkGo(){
  var id = petActiveId(), o = petNow(id);
  if(!o){ toast('先にたまごをもらってね', true); return; }
  if(!o.stage){ toast('生まれてから、おさんぽに行けます', true); return; }
  if(ppWalkNow()){ toast('いま、おさんぽ中です', true); return; }
  if(o.sleep){ toast('ねているよ。おこしてから行こう', true); return; }
  if(o.eng < 15){ toast('げんきがないみたい。ねかせてあげよう', true); return; }
  if(ppWalkLeft() <= 0){ toast('おさんぽは1日' + PP_WALK_MAX + '回まで。またあした行こう', true); return; }
  var wid = uid('ppw'), st = ppStepsOn(today());
  var r = ppRnd(ppHash(wid)), pool = PP_SPOTS.map(function(x){ return x.id; }), route = [];
  while(route.length < PP_WALK_LEN){
    if(!pool.length) pool = PP_SPOTS.map(function(x){ return x.id; });
    route.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  }
  S.kmData = ppData();
  S.kmData['petplus:walk'] = { id:wid, chara:id, ymd:today(), start:Date.now(), steps0:(st == null ? -1 : st),
    bonus:st ? Math.min(3, Math.floor(st / 2500)) : 0, route:route, mt:Date.now() };
  touch('kmData');
  commit();
  petSay('いってきます！' + (st ? '今日は' + st + '歩あるいたね' : ''), 'cheer');
}
function ppWalkEnd(){
  var w = ppWalkNow();
  if(!w) return;
  var p = ppWalkPos(w), found = [], coins = 0, foods = {};
  for(var i = 0; i < p; i++){
    var ev = ppWalkEvent(w, i);
    found.push(ev);
    if(ev.kind === 'coin') coins += toNum(ev.v);
    if(ev.kind === 'food') foods[ev.v] = (foods[ev.v] || 0) + 1;
  }
  var goal = p >= PP_WALK_LEN;
  if(goal) coins += 10;
  var st = ppStepsOn(w.ymd), base = toNum(w.steps0);
  var o = petNow(w.chara);
  /* 記録の id は、おさんぽの id から決める（2台でそれぞれ「かえる」を押しても、同期で1つになる＝コインが二重にならない） */
  var rid = 'km' + String(w.id).replace(/[^A-Za-z0-9_-]/g, '');
  S.kmItems = (Array.isArray(S.kmItems) ? S.kmItems : []).filter(function(x){ return !(x && x.id === rid); });
  S.kmItems.push({ id:rid, mt:Date.now(), mod:'petplus', type:'walk', ymd:w.ymd, chara:w.chara,
    name:(o && o.name) || charaById(w.chara).name, start:toNum(w.start), end:Date.now(), squares:p, goal:goal ? 1 : 0,
    route:(w.route || []).slice(0, p), found:found, coins:coins, steps:(st != null && base >= 0) ? Math.max(0, st - base) : null });
  if(Object.keys(foods).length) petMetaUpdate(function(mm){ Object.keys(foods).forEach(function(f){ mm.bag[f] = toNum(mm.bag[f]) + foods[f]; }); });
  S.kmData = ppData();
  S.kmData['petplus:walk'] = { id:'', mt:Date.now() };
  touch('kmData');
  if(o) petUpdate(w.chara, function(x){ x.joy += 8 + p; x.eng -= Math.min(25, 4 + p * 2); x.hun -= 5; x.exp += 2 + p; petPt(x, 'genki', 2 + p); });
  commit();
  petSay(p ? (goal ? 'ゴール！' : 'ただいま！') + p + 'マスあるいたよ。' + (coins ? 'コイン' + coins + 'まい' : '') : 'ただいま。またいこうね', goal ? 'sparkle' : 'happy');
}

/* ============================== 卒業 ============================== */
function ppGrad(){
  var id = petActiveId(), o = petNow(id), k = charaById(id);
  if(!o || o.stage < 4){ toast('なかよしマスターになった子が卒業できます', true); return; }
  var nm = o.name || k.name;
  if(!confirm(nm + 'を卒業させますか？\n図鑑にのこって、' + k.name + 'の新しいたまごから育てられます。')) return;
  var b = ppYmdOf(o.hatch || o.born);
  /* 記録の id は、その子（キャラと生まれた時刻）から決める（2台でそれぞれ卒業させても、同期で1つになる＝コインが二重にならない） */
  var gid = (toNum(o.born) || toNum(o.hatch)) ? 'kmg' + String(id).replace(/[^A-Za-z0-9_-]/g, '') + '-' + (toNum(o.born) || toNum(o.hatch)).toString(36) : uid('km');
  S.kmItems = (Array.isArray(S.kmItems) ? S.kmItems : []).filter(function(x){ return !(x && x.id === gid); });
  S.kmItems.push({ id:gid, mt:Date.now(), mod:'petplus', type:'grad', chara:id, name:nm, born:toNum(o.born), hatch:toNum(o.hatch),
    gradAt:Date.now(), gradYmd:today(), days:b ? (daysBetween(b, today()) || 0) + 1 : 0, exp:toNum(o.exp),
    path:o.path || ppPathOf(id, o), path2:o.path2 || o.path || ppPathOf(id, o), title:ppTitle(o, id), gen:toNum(o.gen) || 1,
    wear:Object.assign({}, o.wear || {}), coins:100 });
  S.pets[id] = { name:k.name, born:Date.now(), exp:0, hun:80, joy:70, cln:90, eng:90, sleep:0, at:Date.now(), mt:Date.now(), gen:(toNum(o.gen) || 1) + 1 };
  touch('pets');
  commit();
  petSay(nm + '、卒業おめでとう！新しいたまごが来たよ。コイン100まい', 'sparkle');
}

/* ============================== へや ============================== */
function ppRoomCls(m, o){
  return (petPanel === 'room' ? ' pp-edit' : '') + (ppCelebToday().length ? ' pp-cel' : '');
}
function ppRoomBg(m, o, id){
  var h = '', W = PP_WALL_BY[m.wall], F = PP_FLOOR_BY[m.floor];
  if(W) h += '<span class="pp-wall pp-wall-' + W.id + '" aria-hidden="true"></span>';
  if(F) h += '<span class="pp-floor pp-floor-' + F.id + '" aria-hidden="true"></span>';
  var wx = ppWx(), r = ppRnd(7), i;
  if(wx){
    if(wx.kind === 'rain' || wx.kind === 'snow'){
      h += '<span class="pp-fx pp-fx-' + wx.kind + '" aria-hidden="true">';
      for(i = 0; i < 14; i++) h += '<i style="left:' + Math.round(r() * 96 + 2) + '%;animation-delay:' + (r() * 3).toFixed(2) + 's"></i>';
      h += '</span>';
    }
    h += '<span class="pp-wxtag">' + wx.icon + ' ' + esc(wx.word) + (wx.temp != null ? ' ' + wx.temp + '℃' : '') + '</span>';
  }
  if(ppCelebToday().length){
    var cols = ['#F58CA8', '#F7C94F', '#8EC9F2', '#A5D98F', '#CDB8F6'];
    h += '<span class="pp-confetti" aria-hidden="true">';
    for(i = 0; i < 18; i++) h += '<i style="left:' + Math.round(r() * 96 + 2) + '%;animation-delay:' + (r() * 3).toFixed(2) + 's;background:' + cols[i % cols.length] + '"></i>';
    h += '</span>';
  }
  var w = ppWalkNow();
  if(w) h += '<span class="pp-walking">🚶 おさんぽ中（' + ppWalkPos(w) + '/' + PP_WALK_LEN + 'マス）</span>';
  if(petPanel === 'room' && ppMoveSel && (m.room || []).indexOf(ppMoveSel) >= 0){
    h += '<span class="pp-grid">';
    for(var ry = 0; ry < PP_GRID.rows; ry++) for(var cx = 0; cx < PP_GRID.cols; cx++){
      var x = Math.round((cx + .5) * 100 / PP_GRID.cols), y = Math.round((ry + .5) * 100 / PP_GRID.rows);
      h += '<button class="pp-cell" data-act="pp-cell" data-x="' + x + '" data-y="' + y + '" style="left:' + (cx * 100 / PP_GRID.cols) + '%;top:' + (ry * 100 / PP_GRID.rows) + '%" aria-label="ここに置く（よこ' + (cx + 1) + '・たて' + (ry + 1) + '）"></button>';
    }
    h += '</span>';
  }
  return h;
}
function ppPlace(did, x, y){
  x = Math.max(3, Math.min(97, Math.round(x))); y = Math.max(4, Math.min(96, Math.round(y)));
  petMetaUpdate(function(mm){ mm.pos = Object.assign({}, (mm.pos && typeof mm.pos === 'object') ? mm.pos : {}); mm.pos[did] = { x:x, y:y }; });
  commit();
}

/* ============================== 画面：パネル ============================== */
function ppPanel(kind, id, o){
  if(kind === 'dress') return ppDressView(id, o);
  if(kind === 'room') return ppRoomView(id, o);
  if(kind === 'walk') return ppWalkView(id, o);
  if(kind === 'dex') return ppDexView(id, o);
  if(kind === 'anniv') return ppAnnivView();
  return '';
}
/* 服だけの小さな絵（おみせ用） */
function ppWearPreview(it){
  var vb = { head:'15 0 70 42', face:'24 42 52 32', neck:'14 64 72 36', body:'8 62 84 38', hand:'0 30 42 64' }[it.slot];
  var f = ppLayout(null);
  return '<svg class="pp-wprev" viewBox="' + vb + '" width="46" height="30" aria-hidden="true" focusable="false">' + ppWearDraw(it.id, f, '#6E5A66') + '</svg>';
}
function ppDressView(id, o){
  if(!o || !o.stage) return section('👗 きせかえ', null, '<div class="empty">生まれてから着せかえできます。</div>');
  var wear = o.wear || {}, own = ppOwnedSet();
  var cur = PP_SLOTS.filter(function(sl){ return PP_WEAR_BY[wear[sl[0]]]; }).map(function(sl){
    var it = PP_WEAR_BY[wear[sl[0]]];
    return '<button class="mini" data-act="pp-wear" data-v="' + it.id + '">' + it.icon + ' ' + esc(it.name) + ' ×</button>';
  }).join('');
  var list = PP_WEAR.filter(function(it){
    if(ppDressSlot !== 'all' && it.slot !== ppDressSlot) return false;
    if(!own['w:' + it.id] && !it.walk && !ppInSeason(it)) return false;       /* 季節の限定品は、その月だけ */
    return true;
  });
  return section('👗 きせかえ', '🪙' + petCoins(),
    '<div class="pp-dresshead"><div class="pp-dpet">' + petSvg(id, o, 104) + '</div><div class="grow">' +
      '<div class="s2">いま着ているもの</div><div class="pillrow">' + (cur || '<span class="s">なにも着ていません</span>') + '</div>' +
      (cur ? '<button class="mini" data-act="pp-undress">ぜんぶはずす</button>' : '') + '</div></div>' +
    '<div class="pillrow pp-slots">' + [['all', 'ぜんぶ']].concat(PP_SLOTS).map(function(sl){
      return '<button data-act="pp-dslot" data-v="' + sl[0] + '" class="' + (ppDressSlot === sl[0] ? 'on' : '') + '">' + sl[1] + '</button>';
    }).join('') + '</div>' +
    '<div class="petlist pp-wlist">' + list.map(function(it){
      var has = !!own['w:' + it.id], on = wear[it.slot] === it.id;
      var st = on ? '着ている（おすとはずす）' : has ? 'もってる' : it.walk ? 'おさんぽで見つかる' : '🪙' + it.price + (it.months ? '・' + ppMonthsLabel(it.months) + '限定' : '');
      return '<button data-act="pp-wear" data-v="' + it.id + '" class="' + (on ? 'on' : '') + (it.walk && !has ? ' pp-lock' : '') + '">' +
        '<span class="pi">' + ppWearPreview(it) + '</span><span class="pn">' + esc(it.name) + '</span><span class="pp">' + esc(st) + '</span></button>';
    }).join('') + '</div>' +
    '<p class="note">買った服は、どの子にも着せられます。季節の限定品は、その月だけおみせに並びます。はじめて着る服は、アイドルの道の点になります。</p>');
}
function ppRoomView(id, o){
  var m = petMeta(), own = ppOwnedSet();
  var grid = function(list, act, cur, pre){
    return '<div class="petlist pp-rlist">' +
      '<button data-act="' + act + '" data-v="" class="' + (!cur ? 'on' : '') + '"><span class="pi"><span class="pp-sw pp-sw-none"></span></span><span class="pn">はじめの</span><span class="pp">' + (!cur ? 'つかってる' : '無料') + '</span></button>' +
      list.map(function(x){
        var has = !!own[pre + x.id], on = cur === x.id;
        if(!has && !on && !ppInSeason(x)) return '';
        return '<button data-act="' + act + '" data-v="' + x.id + '" class="' + (on ? 'on' : '') + '"><span class="pi"><span class="pp-sw pp-' + pre.replace(':', '') + '-' + x.id + '"></span></span>' +
          '<span class="pn">' + esc(x.name) + '</span><span class="pp">' + (on ? 'つかってる' : has ? 'もってる' : '🪙' + x.price + (x.months ? '・' + ppMonthsLabel(x.months) + '限定' : '')) + '</span></button>';
      }).join('') + '</div>';
  };
  var room = (m.room || []).map(function(did){ return PET_DECO.filter(function(d){ return d.id === did; })[0]; }).filter(Boolean);
  var moves = room.length
    ? '<div class="pillrow">' + room.map(function(d){
        return '<button data-act="pp-move" data-v="' + d.id + '" class="' + (ppMoveSel === d.id ? 'on' : '') + '">' + d.icon + ' ' + esc(d.name) + '</button>';
      }).join('') + '</div>' +
      '<p class="note">' + (ppMoveSel ? '上のへやの、置きたいマス目をタップしてね。' : 'うごかすかざりをえらんで、へやのマス目をタップ。かざりを指でドラッグしても動かせます。') + '</p>' +
      '<div class="pillrow"><button class="mini" data-act="pp-pos-reset">ぜんぶ、もとの場所にもどす</button></div>'
    : '<div class="empty" style="padding:6px 0">かざりはまだありません。「🛍️ おみせ」で買うと、ここで場所を変えられます。</div>';
  return section('🏠 もようがえ', '🪙' + petCoins(),
    '<div class="s2" style="margin:0 0 4px">かべがみ</div>' + grid(PP_WALLS, 'pp-wall', PP_WALL_BY[m.wall] ? m.wall : '', 'wall:') +
    '<div class="s2" style="margin:10px 0 4px">ゆか</div>' + grid(PP_FLOORS, 'pp-floor', PP_FLOOR_BY[m.floor] ? m.floor : '', 'floor:') +
    '<div class="s2" style="margin:10px 0 4px">かざりを置く場所</div>' + moves +
    '<p class="note">一度買ったかべがみ・ゆかは、いつでも無料で変えられます。</p>');
}
function ppWalkView(id, o){
  var w = ppWalkNow(), h = '';
  if(w){
    var p = ppWalkPos(w), route = w.route || [];
    var sq = [{ icon:'🏠', name:'おうち' }].concat(route.map(function(r){ return PP_SPOT_BY[r] || PP_SPOTS[0]; })).concat([{ icon:'🏁', name:'ゴール' }]);
    var last = sq.length - 1, at = p >= PP_WALK_LEN ? last : p;      /* いまいるマス（ぜんぶ歩いたらゴール） */
    h += '<div class="pp-route">' + sq.map(function(x, i){
      var done = i === last ? p >= PP_WALK_LEN : i <= p;
      return '<span class="pp-sq' + (done ? ' done' : '') + (i === at ? ' here' : '') + '">' +
        (i === at ? '<span class="pp-sqpet">' + charaSvg({ id:w.chara, size:30, expr:'happy', still:true, hat:'' }) + '</span>' : '') +
        '<span class="pp-sqi">' + x.icon + '</span><span class="pp-sqn">' + esc(x.name) + '</span></span>';
    }).join('') + '</div>';
    var found = [];
    for(var i = 0; i < p; i++) found.push(ppWalkEvent(w, i));
    var st = ppStepsOn(w.ymd);
    h += '<p class="pp-txt">いま <b>' + p + '/' + PP_WALK_LEN + 'マス</b>。' + (st != null ? '今日の歩数 ' + st + '歩（' + PP_WALK_STEP + '歩で1マス）' : '歩数の記録がないので、' + PP_WALK_MIN + '分で1マスすすみます') + '。</p>' +
      (found.length ? '<div class="pp-found">' + found.map(function(f){ return '<div class="row"><span class="pp-fi">' + ppFoundIcon(f) + '</span><div class="grow pp-txt">' + esc(f.text) + '</div></div>'; }).join('') + '</div>' : '') +
      '<div class="pillrow" style="margin-top:8px"><button class="btn" data-act="pp-walk-end">' + (p >= PP_WALK_LEN ? '🏁 ゴール！おうちにかえる' : '🏠 ここまでで、おうちにかえる') + '</button></div>';
  }else{
    var left = ppWalkLeft(), st2 = ppStepsOn(today());
    h += '<p class="pp-txt">公園・川・商店街…をめぐるすごろくです。' + (st2 != null ? '今日の歩数（' + st2 + '歩）と、あるいた時間で進みます。' : '歩数の記録がないときは、時間で進みます（' + PP_WALK_MIN + '分で1マス）。') +
      'とちゅうでコイン・食べもの・思い出の写真を見つけるよ。</p>' +
      '<div class="pillrow"><button class="btn" data-act="pp-walk-go"' + (left && o && o.stage ? '' : ' disabled') + '>🚶 おさんぽに行く（今日あと' + left + '回）</button></div>' +
      '<p class="note">歩数は、ショートカットの「健康」で送った記録（睡眠・歩数）を使います。おさんぽすると「げんき」の道の点がふえます。</p>';
  }
  var logs = ppItems('walk').slice().sort(function(a, b){ return toNum(b.end) - toNum(a.end); }).slice(0, 6);
  if(logs.length){
    h += '<div class="s2" style="margin:12px 0 4px">おさんぽの思い出</div>' + logs.map(function(x){
      var photos = (x.found || []).filter(function(f){ return f && f.kind === 'photo'; });
      return '<div class="row pp-wlog"><div class="grow"><div class="t">' + esc(ymdLabel(x.ymd)) + '　' + esc(x.name || '') + '</div>' +
        '<div class="s">' + toNum(x.squares) + 'マス' + (x.goal ? '・ゴール' : '') + (x.steps != null ? '・' + x.steps + '歩' : '') + '・🪙' + toNum(x.coins) + '</div>' +
        (photos.length ? '<div class="pp-photos">' + photos.map(function(f){ return '<span class="pp-photo"><b>' + esc(f.v || '📷') + '</b>' + esc((PP_SPOT_BY[f.spot] || {}).name || '') + '<br>' + esc(f.text) + '</span>'; }).join('') + '</div>' : '') +
        '</div></div>';
    }).join('');
  }
  return section('🚶 おさんぽ', 'きょう あと' + ppWalkLeft() + '回（1日' + PP_WALK_MAX + '回まで）', h);
}
/* 図鑑にのせる子（いま育てている子＋卒業した子） */
function ppKids(){
  var out = [];
  Object.keys(petAll()).forEach(function(cid){
    if(cid === '_') return;
    var o = petNow(cid);
    if(!o) return;
    out.push({ cur:1, chara:cid, name:o.name || charaById(cid).name, stage:o.stage,
      path:o.stage >= 3 ? ppPathOf(cid, o) : '', path2:o.stage >= 4 ? (o.path2 || ppPathOf(cid, o)) : '',
      born:ppYmdOf(o.hatch || o.born), title:ppTitle(o, cid), gen:toNum(o.gen) || 1 });
  });
  ppItems('grad').forEach(function(x){
    out.push({ cur:0, chara:x.chara, name:x.name, stage:4, path:x.path || '', path2:x.path2 || x.path || '', born:ppYmdOf(x.hatch || x.born),
      gradYmd:x.gradYmd || ppYmdOf(x.gradAt), days:toNum(x.days), title:x.title || '', gen:toNum(x.gen) || 1 });
  });
  return out;
}
function ppForms(){
  var f = [['s0', 0, ''], ['s1', 1, ''], ['s2', 2, '']];
  PP_PATHS.forEach(function(p){ f.push(['s3:' + p.id, 3, p.id]); });
  PP_PATHS.forEach(function(p){ f.push(['s4:' + p.id, 4, p.id]); });
  return f;
}
function ppFormSvg(cid, s, p, size){
  return petSvg(cid, { stage:s, path:p, path2:p, hun:80, joy:70, cln:80, eng:80, sleep:0, exp:PET_STAGES[s][0], ppPlain:1 }, size);
}
function ppDexView(id, o){
  var kids = ppKids(), met = {}, metChara = {};
  kids.forEach(function(x){
    metChara[x.chara] = 1;
    for(var s = 0; s <= Math.min(2, x.stage); s++) if(!met['s' + s]) met['s' + s] = x.chara;
    if(x.stage >= 3 && x.path && !met['s3:' + x.path]) met['s3:' + x.path] = x.chara;
    if(x.stage >= 4 && x.path2 && !met['s4:' + x.path2]) met['s4:' + x.path2] = x.chara;
  });
  var forms = ppForms(), nMet = forms.filter(function(f){ return met[f[0]]; }).length;
  var h = '<div class="s2" style="margin:0 0 4px">会ったすがた（' + nMet + '/' + forms.length + '）</div><div class="pp-dex">' + forms.map(function(f){
    var who = met[f[0]], P = PP_PATH_BY[f[2]];
    var label = f[1] < 3 ? PET_STAGES[f[1]][1] : (f[1] === 3 ? 'おとな・' + P.name : 'マスター・' + P.name);
    var ttl = f[1] === 3 ? P.title : f[1] === 4 ? P.title2 : '';
    return '<div class="pp-dcell' + (who ? '' : ' pp-sil') + '" data-form="' + f[0] + '">' + ppFormSvg(who || id, f[1], f[2], 50) +
      '<span class="pp-dn">' + (who ? esc(label) : '？？？') + '</span>' + (who && ttl ? '<span class="pp-dt">' + esc(ttl) + '</span>' : '') + '</div>';
  }).join('') + '</div>';
  var all = charaAllIds(), nC = all.filter(function(c){ return metChara[c]; }).length;
  h += '<div class="s2" style="margin:12px 0 4px">育てた子のしゅるい（' + nC + '/' + all.length + '）</div><div class="pp-dexc">' + all.map(function(c){
    var ok = !!metChara[c];
    return '<span class="pp-dc' + (ok ? '' : ' pp-sil') + '" title="' + (ok ? esc(charaById(c).name) : '？？？') + '">' + charaSvg({ id:c, size:34, still:true, hat:'', expr:ok ? 'happy' : 'normal' }) + '</span>';
  }).join('') + '</div>';
  h += '<div class="s2" style="margin:12px 0 4px">育てた子（' + kids.length + '）</div>' + (kids.length ? kids.map(function(x){
    var days = x.cur ? (x.born ? (daysBetween(x.born, today()) || 0) + 1 : 0) : x.days;
    return '<div class="row pp-kid"><span class="pp-kidimg">' + charaSvg({ id:x.chara, size:36, still:true, hat:'' }) + '</span><div class="grow">' +
      '<div class="t">' + esc(x.name) + (x.gen > 1 ? ' <span class="s2">' + x.gen + '代目</span>' : '') + '　<span class="s2">' + (x.cur ? '育てている' : '🎓 卒業') + '</span></div>' +
      '<div class="s">' + esc(PET_STAGES[x.stage][1]) + (x.title ? '「' + esc(x.title) + '」' : '') + '・育てた日数 ' + days + '日</div>' +
      '<div class="s2">' + (x.born ? '🎂 たんじょうび ' + ppMd(x.born) : '') + (x.gradYmd ? '・卒業 ' + esc(ymdLabel(x.gradYmd)) : '') + '</div></div></div>';
  }).join('') : '<div class="empty">まだいません。</div>');
  return section('📖 育てた子の図鑑', '', h);
}
function ppAnnivView(){
  var list = (Array.isArray(S.annivs) ? S.annivs : []).filter(function(a){ return a && a.id; });
  var ed = ppAnEdit ? list.filter(function(a){ return a.id === ppAnEdit; })[0] : null;
  var p = ed ? (ppAnParse(ed.date) || {}) : { m:Number(today().slice(5, 7)), d:Number(today().slice(8, 10)), y:0 };
  var opt = function(n0, n1, cur){ var s = ''; for(var i = n0; i <= n1; i++) s += '<option value="' + i + '"' + (i === cur ? ' selected' : '') + '>' + i + '</option>'; return s; };
  var form = '<label class="f" for="pp_an_name">だれの・なんの日</label><input id="pp_an_name" maxlength="40" placeholder="例：おかあさん／自分／はじめてのバイト" value="' + esc(ed ? ed.name : '') + '">' +
    '<div class="grid3 keep3"><div><label class="f" for="pp_an_m">月</label><select id="pp_an_m">' + opt(1, 12, p.m) + '</select></div>' +
      '<div><label class="f" for="pp_an_d">日</label><select id="pp_an_d">' + opt(1, 31, p.d) + '</select></div>' +
      '<div><label class="f" for="pp_an_y">年（なくてよい）</label><input id="pp_an_y" inputmode="numeric" maxlength="4" placeholder="2006" value="' + (p.y ? p.y : '') + '"></div></div>' +
    '<div class="grid2"><div><label class="f" for="pp_an_kind">しゅるい</label><select id="pp_an_kind"><option value="birthday"' + (!ed || ed.kind === 'birthday' ? ' selected' : '') + '>誕生日</option>' +
      '<option value="anniv"' + (ed && ed.kind !== 'birthday' ? ' selected' : '') + '>記念日</option></select></div>' +
      '<div><label class="f" for="pp_an_who">だれ</label><select id="pp_an_who">' + PP_WHO.map(function(w){ return '<option value="' + w[0] + '"' + ((ed ? ed.who : 'family') === w[0] ? ' selected' : '') + '>' + w[1] + '</option>'; }).join('') + '</select></div></div>' +
    '<label class="f" for="pp_an_memo">メモ（なくてよい）</label><input id="pp_an_memo" maxlength="80" placeholder="例：プレゼントはお花" value="' + esc(ed ? ed.memo || '' : '') + '">' +
    '<div style="margin-top:10px"><button class="btn" data-act="pp-an-save">' + (ed ? 'なおす' : '登録する') + '</button>' +
      (ed ? '<button class="btn ghost" style="margin-top:6px" data-act="pp-an-cancel">やめる</button>' : '') + '</div>';
  var rows = list.map(function(a){ return { a:a, next:ppAnNextYmd(a) }; }).sort(function(x, y){ return String(x.next || '9').localeCompare(String(y.next || '9')); }).map(function(x){
    var a = x.a, pp = ppAnParse(a.date), n = x.next ? daysFromToday(x.next) : null;
    return '<div class="row pp-anrow"><span class="pp-fi">' + (a.kind === 'birthday' ? '🎂' : '💐') + '</span><div class="grow"><div class="t">' + esc(ppAnTitle(a)) + '</div>' +
      '<div class="pp-txt">' + (ppAnValid(pp) ? pp.m + '月' + pp.d + '日' + (pp.y ? '（' + pp.y + '年）' : '') : '日付が読めません') + (a.who ? '・' + esc(ppWhoName(a.who)) : '') +
        (n != null ? '・' + (n === 0 ? '<b>きょう！</b>' : 'あと' + n + '日') : '') + (a.memo ? '・' + esc(a.memo) : '') + '</div></div>' +
      '<button class="mini" data-act="pp-an-edit" data-id="' + esc(a.id) + '">なおす</button><button class="mini" data-act="pp-an-del" data-id="' + esc(a.id) + '">消す</button></div>';
  }).join('');
  var next = ppNext(60).filter(function(ev){ return ev.src === 'pet'; }).slice(0, 5);
  var pr = ppPrefs();
  return section('🎂 誕生日・記念日', list.length ? list.length + 'こ' : '',
    form + '<div class="s2" style="margin:12px 0 4px">登録した日</div>' + (rows || '<div class="empty" style="padding:6px 0">まだありません。自分・家族・友だちの誕生日や、記念日を入れてみてね。</div>') +
    (next.length ? '<div class="s2" style="margin:12px 0 4px">おせわの子の記念日</div>' + next.map(function(ev){
      return '<div class="row"><span class="pp-fi">' + ev.icon + '</span><div class="grow"><div class="t">' + esc(ev.title) + '</div><div class="s">' + ymdLabel(ev.ymd) + (ev.left ? '・あと' + ev.left + '日' : '・きょう！') + '</div></div></div>';
    }).join('') : '') +
    '<div class="pillrow" style="margin-top:10px"><button data-act="pp-set" data-k="notify" class="' + (pr.annivNotify ? 'on' : '') + '">' +
      (pr.annivNotify ? '🔔 前の日に知らせる（オン）' : '🔕 前の日に知らせない') + '</button></div>' +
    '<p class="note">その日になると、今日タブにお祝いのカードが出て、おせわの子がお祝いします。小さなプレゼント（コイン）も1回もらえます。通知は、設定の「通知」がつながっているときに届きます。</p>');
}

/* ============================== 今日タブ ============================== */
function ppFeedPick(){
  var m = petMeta();
  var f = PET_FOODS.filter(function(x){ return toNum(m.bag[x.id]) > 0; })[0];
  return f ? { id:f.id, label:f.icon + ' ごはん', note:'もっている' + f.name + 'をあげる' } : { id:'onigiri', label:'🍙 ごはん', note:'おにぎりをあげる（🪙10）' };
}
function ppTodayCard(ctx){
  if(ctx && ctx.isToday === false) return '';
  var id = petActiveId(), o = petNow(id), k = charaById(id);
  if(!o){
    /* 「おせわ」のタブを出していない人には、さそわない */
    var tab = (S.ui && Array.isArray(S.ui.tabs)) ? S.ui.tabs.filter(function(x){ return Array.isArray(x) && x[0] === 'pet'; })[0] : null;
    if(tab && !tab[1]) return '';
    return secWrap('pp-pet', 'おせわの子', null, '<div class="row"><span class="pp-tmini">' + charaSvg({ id:id, size:40, expr:'happy', still:true }) + '</span>' +
      '<div class="grow pp-txt">' + esc(k.name) + 'のたまごをもらって、育ててみませんか？</div><button class="mini" data-act="go" data-app="pet">おせわへ</button></div>');
  }
  var mood = petMood(o), line = ppLine(id, o, mood) || mood.say;
  var title = ppTitle(o, id), fp = ppFeedPick();
  var btns = !o.stage ? '<button data-act="pet-warm">🔥 あたためる</button>'
    : '<button data-act="pet-pat">🤲 なでる</button><button data-act="pet-feed" data-v="' + fp.id + '" title="' + esc(fp.note) + '" aria-label="' + esc(fp.note) + '">' + esc(fp.label) + '</button>';
  var inner = '<div class="pp-today"><div class="pp-tpet" data-act="' + (o.stage ? 'pet-pat' : 'pet-warm') + '" role="button" aria-label="' + esc(o.name || k.name) + (o.stage ? 'をなでる' : 'をあたためる') + '">' + petSvg(id, o, 78) + '</div>' +
    '<div class="grow"><div class="t"><b>' + esc(o.name || k.name) + '</b>　<span class="s2">' + esc(PET_STAGES[o.stage][1]) + (title ? '・' + esc(title) : '') + '</span></div>' +
    (o.stage ? '<div class="s">💗 きげん ' + o.joy + '　🍙 おなか ' + o.hun + '　🪙 ' + petCoins() + '</div>' : '') +
    '<div class="pp-tline">' + esc(chTicFor(k, line)) + '</div>' +
    '<div class="petacts pp-tbtns">' + btns + '<button data-act="go" data-app="pet">おせわへ ›</button></div></div></div>';
  return secWrap('pp-pet', 'おせわの子', (PP_MOOD[mood.expr] || PP_MOOD.normal)[0], inner);
}
function ppAnnivCard(ctx){
  var ymd = (ctx && isYmd(ctx.ymd)) ? ctx.ymd : today(), isToday = ymd === today();
  var evs = ppEventsOn(ymd);
  var soon = isToday ? ppNext(7).filter(function(ev){ return ev.left > 0; }) : [];
  if(!evs.length && !soon.length) return '';
  var id = petActiveId(), o = petNow(id);
  var pet = (o && o.stage) ? petSvg(id, o, 64) : '<span class="pp-cake" aria-hidden="true">🎂</span>';
  var h = evs.map(function(ev){
    var got = ppGiftGot(ev);
    return '<div class="pp-celeb">' + (isToday ? '<span class="pp-confetti" aria-hidden="true">' + [8, 22, 38, 55, 70, 86].map(function(x, i){ return '<i style="left:' + x + '%;animation-delay:' + (i * .4) + 's;background:' + ['#F58CA8', '#F7C94F', '#8EC9F2'][i % 3] + '"></i>'; }).join('') + '</span>' : '') +
      '<div class="pp-cpet">' + (isToday ? pet : '<span class="pp-cake" aria-hidden="true">' + ev.icon + '</span>') + '</div><div class="grow">' +
      '<div class="t">' + ev.icon + ' ' + (isToday ? '' : 'あしたは ') + esc(ev.title) + '</div>' +
      '<div class="pp-txt">' + esc(isToday ? ev.line : 'わすれないでね' + (ev.memo ? '（' + ev.memo + '）' : '')) + '</div>' +
      (isToday ? (got ? '<div class="s2">✔ プレゼントをもらった（🪙' + ev.coins + '）</div>'
        : '<button class="mini" data-act="pp-gift" data-k="' + esc(ev.key) + '">🎁 プレゼントをうけとる（🪙' + ev.coins + '）</button>') : '') +
      '</div></div>';
  }).join('');
  if(soon.length){
    h += '<div class="s2" style="margin:8px 0 2px">もうすぐ</div>' + soon.slice(0, 5).map(function(ev){
      return '<div class="row"><span class="pp-fi">' + ev.icon + '</span><div class="grow"><div class="t">' + esc(ev.title) + '</div><div class="s">' + ymdLabel(ev.ymd) + '・あと' + ev.left + '日</div></div></div>';
    }).join('');
  }
  return secWrap('pp-anniv', 'お祝い・記念日', evs.length ? (isToday ? 'きょう' : 'あした') : 'もうすぐ', h);
}

/* ============================== 操作 ============================== */
function ppAnSave(){
  var name = String(val('pp_an_name') || '').trim().slice(0, 40);
  if(!name){ toast('だれの・なんの日かを入れてください', true); return; }
  var m = toNum(val('pp_an_m')), d = toNum(val('pp_an_d')), y = toNum(val('pp_an_y'));
  if(y && (y < 1900 || y > 2100)){ toast('年は4けたで入れてください（なければ空のまま）', true); return; }
  if(!ppAnValid({ m:m, d:d }) || (y && new Date(y, m - 1, d).getDate() !== d)){ toast('その日付はありません', true); return; }
  var date = (y ? y + '-' : '') + pad(m) + '-' + pad(d);
  var kind = val('pp_an_kind') === 'anniv' ? 'anniv' : 'birthday';
  var who = PP_WHO.some(function(w){ return w[0] === val('pp_an_who'); }) ? val('pp_an_who') : 'other';
  var memo = String(val('pp_an_memo') || '').trim().slice(0, 80);
  S.annivs = Array.isArray(S.annivs) ? S.annivs : [];
  var ed = ppAnEdit ? S.annivs.filter(function(a){ return a.id === ppAnEdit; })[0] : null;
  if(ed){ ed.name = name; ed.date = date; ed.kind = kind; ed.who = who; ed.memo = memo; ed.mt = Date.now(); }
  else S.annivs.push({ id:uid('an'), mt:Date.now(), name:name, date:date, kind:kind, who:who, memo:memo });
  ppAnEdit = '';
  commit();
  toast(ed ? 'なおしました' : '登録しました');
  if(typeof linksSoon === 'function') linksSoon();
}
function ppGift(key){
  var ev = ppCelebToday().filter(function(x){ return x.key === key; })[0];
  if(!ev){ toast('きょうのお祝いではありません', true); return; }
  if(ppGiftGot(ev)){ toast('プレゼントはもう受けとりました'); return; }
  S.kmData = ppData();
  S.kmData[ppGiftKey(ev)] = { coins:ev.coins, name:ev.title, mt:Date.now() };
  touch('kmData');
  var id = petActiveId(), o = petNow(id);
  if(o && o.stage) petUpdate(id, function(x){ x.joy += 10; });
  commit();
  petSay(ev.line + '（プレゼント🪙' + ev.coins + '）', 'sparkle');
}
function ppWear(v){
  var it = PP_WEAR_BY[v];
  if(!it) return;
  var id = petActiveId(), o = petNow(id);
  if(!o){ toast('先にたまごをもらってね', true); return; }
  if(!o.stage){ toast('生まれてから着られます', true); return; }
  var key = 'w:' + it.id, owned = ppOwned(key);
  if(o.wear && o.wear[it.slot] === it.id){
    petUpdate(id, function(x){ x.wear = Object.assign({}, x.wear); delete x.wear[it.slot]; });
    commit(); toast(it.name + 'をはずしました'); return;
  }
  if(!owned){
    if(it.walk){ toast('おさんぽのとちゅうで見つかる服です', true); return; }
    if(!ppInSeason(it)){ toast('いまは売っていません（' + ppMonthsLabel(it.months) + 'の限定品）', true); return; }
    if(!ppBuy(key, it.price)) return;
  }
  petUpdate(id, function(x){
    var first = !(x.worn && x.worn[it.id]);
    x.wear = Object.assign({}, x.wear); x.wear[it.slot] = it.id;
    x.worn = Object.assign({}, x.worn); x.worn[it.id] = 1;
    if(first) petPt(x, 'idol', 2);
    x.joy += owned ? 2 : 6;
  });
  commit();
  petSay((owned ? '' : 'かってくれて、ありがとう！') + it.name + '、にあう？', 'shy');
}
function ppRoomBuy(kind, v){
  var list = kind === 'wall' ? PP_WALL_BY : PP_FLOOR_BY, x = list[v];
  if(v && !x) return;
  if(x && !ppOwned(kind + ':' + v)){
    if(!ppInSeason(x)){ toast('いまは売っていません（' + ppMonthsLabel(x.months) + 'の限定品）', true); return; }
    if(!ppBuy(kind + ':' + v, x.price)) return;
    var id = petActiveId();
    if(petNow(id) && petNow(id).stage) petUpdate(id, function(o){ o.joy += 6; petPt(o, 'idol', 1); });
  }
  petMetaUpdate(function(mm){ mm[kind] = v || ''; });
  commit();
  toast(x ? x.name + 'にしました' : 'はじめのへやにもどしました');
}
kmAction(function(act, t){
  if(act.indexOf('pp-') !== 0) return false;
  var v = t.dataset.v != null ? t.dataset.v : (t.getAttribute('v') || '');
  if(act === 'pp-open'){
    appId = 'pet';
    petPanel = v || '';
    render(); window.scrollTo(0, 0);
    return true;
  }
  if(act === 'pp-wear'){ ppWear(v); return true; }
  if(act === 'pp-undress'){
    var uid0 = petActiveId();
    if(petNow(uid0)){ petUpdate(uid0, function(x){ x.wear = {}; }); commit(); toast('ぜんぶはずしました'); }
    return true;
  }
  if(act === 'pp-dslot'){ ppDressSlot = v || 'all'; render(); return true; }
  if(act === 'pp-wall'){ ppRoomBuy('wall', v); return true; }
  if(act === 'pp-floor'){ ppRoomBuy('floor', v); return true; }
  if(act === 'pp-move'){ ppMoveSel = (ppMoveSel === v) ? '' : v; render(); return true; }
  if(act === 'pp-cell'){
    if(!ppMoveSel) return true;
    var did = ppMoveSel; ppMoveSel = '';
    ppPlace(did, toNum(t.dataset.x), toNum(t.dataset.y));
    toast('ここに置きました');
    return true;
  }
  if(act === 'pp-pos-reset'){ ppMoveSel = ''; petMetaUpdate(function(mm){ mm.pos = {}; }); commit(); toast('もとの場所にもどしました'); return true; }
  if(act === 'pp-walk-go'){ ppWalkGo(); return true; }
  if(act === 'pp-walk-end'){ ppWalkEnd(); return true; }
  if(act === 'pp-grad'){ ppGrad(); return true; }
  if(act === 'pp-gift'){ ppGift(t.dataset.k || ''); return true; }
  if(act === 'pp-an-save'){ ppAnSave(); return true; }
  if(act === 'pp-an-edit'){ ppAnEdit = t.dataset.id || ''; appId = 'pet'; petPanel = 'anniv'; render(); return true; }
  if(act === 'pp-an-cancel'){ ppAnEdit = ''; render(); return true; }
  if(act === 'pp-an-del'){
    var a = (S.annivs || []).filter(function(x){ return x.id === t.dataset.id; })[0];
    if(!a || !confirm('「' + ppAnTitle(a) + '」を消しますか？')) return true;
    removeItem('annivs', a.id);
    if(ppAnEdit === a.id) ppAnEdit = '';
    commit(); toast('消しました');
    return true;
  }
  if(act === 'pp-set'){
    if(t.dataset.k === 'today'){
      S.ui.pageHide = S.ui.pageHide || {};
      S.ui.pageHide.today = Object.assign({}, S.ui.pageHide.today);
      S.ui.pageHide.today['pp-pet'] = S.ui.pageHide.today['pp-pet'] ? 0 : 1;
    }else if(t.dataset.k === 'notify'){
      S.ui.petplus = Object.assign({}, S.ui.petplus || {}, { annivNotify:ppPrefs().annivNotify ? 0 : 1 });
      if(typeof linksSoon === 'function') linksSoon();
    }else return true;
    touch('ui'); commit();
    return true;
  }
  return true;
});

/* ===== へやのかざりを指でうごかす（もようがえのとき） ===== */
(function(){
  if(typeof document === 'undefined') return;
  var drag = null;
  document.addEventListener('pointerdown', function(e){
    var t = e.target && e.target.closest ? e.target.closest('.petroom.pp-edit .pdeco[data-pp]') : null;
    if(!t) return;
    var room = t.closest('.petroom');
    drag = { el:t, id:t.dataset.pp, r:room.getBoundingClientRect(), moved:false, x:0, y:0 };
    try{ t.setPointerCapture(e.pointerId); }catch(err){}
    e.preventDefault();
  });
  document.addEventListener('pointermove', function(e){
    if(!drag || !drag.r.width) return;
    drag.x = Math.max(3, Math.min(97, (e.clientX - drag.r.left) / drag.r.width * 100));
    drag.y = Math.max(4, Math.min(96, (e.clientY - drag.r.top) / drag.r.height * 100));
    drag.el.style.left = drag.x + '%'; drag.el.style.top = drag.y + '%';
    drag.moved = true;
  });
  var end = function(){
    if(!drag) return;
    var d = drag; drag = null;
    if(!d.moved){ ppMoveSel = d.id; render(); return; }
    ppPlace(d.id, d.x, d.y);
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', function(){ if(drag){ drag = null; render(); } });
})();
/* おさんぽ中は、ときどき描き直して進みぐあいを見せる */
setInterval(function(){
  if(typeof TEST_MODE !== 'undefined' && TEST_MODE) return;
  if(typeof appId === 'undefined' || appId !== 'pet' || petPanel !== 'walk' || !ppWalkNow()) return;
  if(document.hidden || (typeof isTyping === 'function' && isTyping())) return;
  render();
}, 30000);

/* ============================== 差しこみ口に登録 ============================== */
kmPart('today', 'pp-anniv', 'お祝い・記念日', ppAnnivCard);
kmPart('today', 'pp-pet', 'おせわの子', ppTodayCard);
kmPart('tomo', 'pp-anniv', 'お祝い・記念日', ppAnnivCard);
/* お祝いは目立つように、朝のまとめのすぐ後ろへ（並べ替えは設定でできる） */
(function(){
  if(typeof PAGE_SECTIONS === 'undefined' || !Array.isArray(PAGE_SECTIONS.today)) return;
  var a = PAGE_SECTIONS.today, i = -1;
  a.forEach(function(x, j){ if(x[0] === 'pp-anniv') i = j; });
  if(i < 0) return;
  var it = a.splice(i, 1)[0], at = 0;
  a.forEach(function(x, j){ if(x[0] === 'brief') at = j + 1; });
  a.splice(at, 0, it);
})();

kmSettings({ id:'pp-set', title:'おせわの子・誕生日と記念日', after:'',
  note:function(){ return (Array.isArray(S.annivs) ? S.annivs.length : 0) + 'この記念日'; },
  html:function(){
    var hid = !!(S.ui.pageHide && S.ui.pageHide.today && S.ui.pageHide.today['pp-pet']), pr = ppPrefs();
    return '<div class="pillrow"><button data-act="pp-set" data-k="today" class="' + (hid ? '' : 'on') + '">' + (hid ? '今日タブにおせわの子を出さない' : '今日タブにおせわの子を出す') + '</button>' +
      '<button data-act="pp-set" data-k="notify" class="' + (pr.annivNotify ? 'on' : '') + '">' + (pr.annivNotify ? '記念日の前の日に知らせる' : '記念日の前の日は知らせない') + '</button></div>' +
      '<div class="pillrow" style="margin-top:6px"><button class="btn ghost" data-act="pp-open" data-v="anniv">🎂 誕生日・記念日を登録する</button></div>' +
      '<p class="note">おせわの子は、着せかえ・もようがえ・おさんぽ・図鑑もおせわタブでできます。</p>';
  } });

/* 記念日の前の日に知らせる（オンにした人だけ） */
kmJobs(function(add, prefs, now){
  if(!ppPrefs().annivNotify || typeof notifyAt !== 'function') return;
  for(var i = 1; i <= 8; i++){
    var ymd = shiftDate(today(), i);
    ppEventsOn(ymd).forEach(function(ev){
      add('pp-anniv-' + ymd + '-' + String(ev.key).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40), notifyAt(shiftDate(ymd, -1), prefs.dlTime || '20:00'),
        '🎂 あしたは' + ev.title, ((ev.memo ? ev.memo + '　' : '') + 'おせわの子もいっしょにお祝いするよ（今日タブ）').slice(0, 190));
    });
  }
});

/* ウィジェット・Discord用のまとめ */
kmSummary(function(s){
  var id = petActiveId(), o = petNow(id);
  if(!o) return;
  var k = charaById(id), mood = petMood(o), title = ppTitle(o, id);
  var mw = o.stage === 0 ? ['たまご', '🥚'] : o.sleep ? ['すやすや', '😴'] : (PP_MOOD[ppCelebToday().length ? 'sparkle' : mood.expr] || PP_MOOD.normal);
  s.pet = { name:o.name || k.name, stage:PET_STAGES[o.stage][1] + (title ? '・' + title : ''), mood:mw[0], emoji:mw[1],
    line:String(ppLine(id, o, mood) || mood.say || '').slice(0, 60) };
  var ev = ppCelebToday()[0];
  if(ev) s.pet.celeb = ev.title;
});

/* 全体検索 */
kmSearch(function(q){
  q = norm(String(q || '').trim());
  if(!q) return [];
  var out = [], hit = function(txt){ return norm(txt).indexOf(q) >= 0; };
  (Array.isArray(S.annivs) ? S.annivs : []).forEach(function(a){
    if(!a || !hit([a.name, a.memo, ppWhoName(a.who), a.kind === 'birthday' ? '誕生日 たんじょうび' : '記念日', ppAnTitle(a)].join(' '))) return;
    var p = ppAnParse(a.date), nx = ppAnNextYmd(a);
    out.push({ kind:'記念日', title:ppAnTitle(a), sub:(ppAnValid(p) ? p.m + '月' + p.d + '日' : '') + (nx ? '・あと' + daysFromToday(nx) + '日' : '') + (a.memo ? '・' + a.memo : ''),
      act:'pp-open', attrs:{ v:'anniv' } });
  });
  ppKids().forEach(function(x){
    if(!hit([x.name, charaById(x.chara).name, x.title, PET_STAGES[x.stage][1], 'おせわ'].join(' '))) return;
    out.push({ kind:'おせわ', title:x.name, sub:PET_STAGES[x.stage][1] + (x.title ? '「' + x.title + '」' : '') + (x.cur ? '' : '・卒業'), act:'pp-open', attrs:{ v:'dex' } });
  });
  ppItems('walk').forEach(function(w){
    (w.found || []).forEach(function(f){
      if(!f || f.kind !== 'photo' || !hit(f.text + ' ' + ((PP_SPOT_BY[f.spot] || {}).name || '') + ' おさんぽ')) return;
      out.push({ kind:'おさんぽ', title:f.text, sub:ymdLabel(w.ymd) + '・' + ((PP_SPOT_BY[f.spot] || {}).name || ''), act:'pp-open', attrs:{ v:'walk' } });
    });
  });
  PP_WEAR.forEach(function(it){
    if(hit(it.name + ' きせかえ')) out.push({ kind:'きせかえ', title:it.name, sub:ppOwned('w:' + it.id) ? 'もってる' : (it.walk ? 'おさんぽで見つかる' : '🪙' + it.price), act:'pp-open', attrs:{ v:'dress' } });
  });
  return out.slice(0, 40);
});

/* データの点検 */
kmCheck(function(){
  return (Array.isArray(S.annivs) ? S.annivs : []).filter(function(a){ return a && a.id && !ppAnValid(ppAnParse(a.date)); }).map(function(a){
    return { level:'warn', msg:'記念日「' + (a.name || '') + '」の日付（' + (a.date || 'なし') + '）が読めません。おせわタブの「🎂 記念日」でなおしてください。' };
  });
});

/* AIが読める計算結果 */
kmAiData('pp_pet', 'おせわの子のいま：進化の道（どの道に近いか％・決まった道・称号）、着ている服、持っている服・かべがみ・ゆか、部屋、今日のおさんぽ、卒業した子、コイン', function(){
  var own = ppOwnedSet(), m = petMeta(), w = ppWalkNow();
  var kids = Object.keys(petAll()).filter(function(c){ return c !== '_'; }).map(function(cid){
    var o = petNow(cid);
    if(!o) return null;
    var sc = ppPathScores(cid, o), tot = 0;
    PP_PATHS.forEach(function(p){ tot += sc[p.id]; });
    var meter = {};
    PP_PATHS.forEach(function(p){ meter[p.name] = tot ? Math.round(sc[p.id] / tot * 100) + '%' : '0%'; });
    var wear = {};
    PP_SLOTS.forEach(function(sl){ var it = PP_WEAR_BY[(o.wear || {})[sl[0]]]; if(it) wear[sl[1]] = it.name; });
    return { id:cid, name:o.name || charaById(cid).name, chara:charaById(cid).name, stage:PET_STAGES[o.stage][1], exp:o.exp,
      path:o.stage >= 3 ? (PP_PATH_BY[ppPathOf(cid, o)] || {}).name : '', pathDecided:!!o.path, nearestPath:(PP_PATH_BY[ppPathBest(cid, o)] || {}).name,
      title:ppTitle(o, cid), meter:meter, points:sc, wear:wear, birthday:ppMd(ppYmdOf(o.hatch || o.born)), gen:toNum(o.gen) || 1 };
  }).filter(Boolean);
  return {
    active:petActiveId(), coins:petCoins(), children:kids,
    owned:{ wear:PP_WEAR.filter(function(it){ return own['w:' + it.id]; }).map(function(it){ return it.name; }),
      walls:PP_WALLS.filter(function(x){ return own['wall:' + x.id]; }).map(function(x){ return x.name; }),
      floors:PP_FLOORS.filter(function(x){ return own['floor:' + x.id]; }).map(function(x){ return x.name; }) },
    room:{ wall:(PP_WALL_BY[m.wall] || { name:'はじめの' }).name, floor:(PP_FLOOR_BY[m.floor] || { name:'はじめの' }).name,
      deco:(m.room || []).map(function(d){ return (PET_DECO.filter(function(x){ return x.id === d; })[0] || { name:d }).name; }) },
    walk:{ today:ppWalksOn(today()), max:PP_WALK_MAX, now:w ? { squares:ppWalkPos(w), of:PP_WALK_LEN, chara:w.chara } : null,
      recent:ppItems('walk').slice(-5).map(function(x){ return { date:x.ymd, name:x.name, squares:x.squares, steps:x.steps, coins:x.coins,
        found:(x.found || []).map(function(f){ return f.text; }) }; }) },
    graduates:ppItems('grad').map(function(x){ return { name:x.name, chara:charaById(x.chara).name, title:x.title, days:x.days, graduated:x.gradYmd || ppYmdOf(x.gradAt) }; }),
    weather:ppWx() ? ppWx().word : null,
    paths:PP_PATHS.map(function(p){ return { name:p.name, title:p.title, master:p.title2, how:p.how }; })
  };
});
kmAiData('pp_anniv', '誕生日・記念日：今日のお祝い（プレゼントを受けとったか）と、これから60日のお祝い（おせわの子のたんじょうびをふくむ）', function(){
  var pick = function(ev){ return { date:ev.ymd, daysLeft:ev.left, title:ev.title, kind:ev.kind, who:ppWhoName(ev.who), memo:ev.memo || '' }; };
  return {
    today:ppCelebToday().map(function(ev){ var o = pick(ev); o.daysLeft = 0; o.giftReceived = ppGiftGot(ev); return o; }),
    next:ppNext(60).map(pick).slice(0, 40),
    notifyDayBefore:!!ppPrefs().annivNotify
  };
});
KM.aiData.pp_pet.section = 'pet';
KM.aiData.pp_anniv.section = 'anniv';

/* AIそうだん：記念日を登録する道具 */
kmChatTool({ name:'pp_add_anniv', description:'誕生日・記念日を手帳（おせわの記念日）に登録する。登録を頼まれたときだけ使う。その日になると、おせわの子がお祝いする。',
  parameters:{ type:'OBJECT', properties:{
    name:{ type:'STRING', description:'だれの・なんの日（例：おかあさん、つきあった日）' },
    date:{ type:'STRING', description:'MM-DD か YYYY-MM-DD（生まれた年が分かれば YYYY-MM-DD）' },
    kind:{ type:'STRING', enum:['birthday', 'anniv'], description:'birthday=誕生日 anniv=記念日' },
    who:{ type:'STRING', enum:['self', 'family', 'friend', 'other'], description:'self=自分 family=家族 friend=友だち other=そのほか' },
    memo:{ type:'STRING', description:'メモ。なければ空' } }, required:['name', 'date'] } },
  function(a){
    var p = ppAnParse(a.date);
    if(!a.name || !ppAnValid(p)) return { result:'名前か日付がありません（MM-DD か YYYY-MM-DD）' };
    var id = uid('an');
    S.annivs = Array.isArray(S.annivs) ? S.annivs : [];
    S.annivs.push({ id:id, mt:Date.now(), name:String(a.name).slice(0, 40), date:(p.y ? p.y + '-' : '') + pad(p.m) + '-' + pad(p.d),
      kind:a.kind === 'anniv' ? 'anniv' : 'birthday', who:PP_WHO.some(function(w){ return w[0] === a.who; }) ? a.who : 'other', memo:String(a.memo || '').slice(0, 80) });
    return { result:'登録しました', op:{ t:'add', list:'annivs', id:id, label:'記念日「' + a.name + '」（' + p.m + '月' + p.d + '日）' } };
  });
KM.chatTools[KM.chatTools.length - 1].write = true;
