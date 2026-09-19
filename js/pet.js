/* くらしの手帳：おせわ（キャラを育てる） */
/* ============================== データ ==============================
   S.pets = { _:{ active, bonus, spent, bag:{食べ物:数}, room:[かざり], pause, mt },
              <キャラID>:{ name, born, exp, hun, joy, cln, eng, sleep, at, mt } }
   ・おなか・きげん・きれい・げんき は、時間がたつと少しずつ下がる（見るだけでは書きかえない）。
   ・コインは、課題を終える・今日の評価・予定やメモを入れる（なかよし度）と、ミニゲームでふえる。
   S.petDays = { 'YYYY-MM-DD|端末ID':{ coins, spent, fed, study, mt }, 'm:YYYY-MM-DD':{ got:{ミッション:1}, mt } }
   ・あとから足したコインの出入りは、日と端末ごとに分けて記録する（2台で同時に使っても、同期で消えない）。
   ・きょうのミッション（授業・課題・暗記・おせわ・家計簿）をこなすと、ごほうびがもらえる。
   あとから足したもの（くわしくは js/m-petplus.js）
   ・子の記録 … pts:{ 道:点 }（育ち方）・path（おとなで決まった道）・path2（マスターの道）・wear:{ 場所:服 }・worn:{ 服:1 }・hatch（生まれた時刻）・gen
     （知らない項目も、petUpdate はそのまま残す）
   ・買ったもの（服・かべがみ・ゆか・かざり）は、日と端末ごとの記録（petDays）の ppBuy にも書く（2台で同時に買っても消えない）
   ・おさんぽ・卒業・お祝いでもらったコインは、S.kmItems / S.kmData の記録から数える（ppCoinsExtra） */
var PET_FOODS = [
  { id:'onigiri', name:'おにぎり', icon:'🍙', price:10, hun:30, joy:2 },
  { id:'bread',   name:'パン',     icon:'🍞', price:12, hun:32, joy:3 },
  { id:'salad',   name:'サラダ',   icon:'🥗', price:15, hun:22, joy:2, cln:5 },
  { id:'straw',   name:'いちご',   icon:'🍓', price:18, hun:15, joy:10 },
  { id:'pudding', name:'プリン',   icon:'🍮', price:25, hun:18, joy:16 },
  { id:'cake',    name:'ケーキ',   icon:'🍰', price:40, hun:22, joy:25 },
  { id:'fav',     name:'だいこうぶつ', icon:'💝', price:35, hun:30, joy:22 }
];
var PET_ITEMS = [
  { id:'medicine', name:'おくすり', icon:'💊', price:30 },
  { id:'ball',     name:'ボール',   icon:'⚽', price:45, toy:1 }
];
var PET_DECO = [
  { id:'rug',     name:'ラグ',       icon:'🟪', price:60,  x:50, y:88, big:1 },
  { id:'cushion', name:'クッション', icon:'🛋️', price:70,  x:16, y:78 },
  { id:'plant',   name:'観葉植物',   icon:'🪴', price:80,  x:88, y:70 },
  { id:'lamp',    name:'ランプ',     icon:'🪔', price:90,  x:12, y:40 },
  { id:'shelf',   name:'本だな',     icon:'📚', price:100, x:84, y:36 },
  { id:'window',  name:'まどの花',   icon:'🌷', price:80,  x:50, y:14 },
  { id:'garland', name:'星のかざり', icon:'✨', price:120, x:30, y:10 },
  { id:'bed',     name:'ベッド',     icon:'🛏️', price:150, x:78, y:86 },
  { id:'clock',   name:'とけい',     icon:'🕰️', price:70,  x:66, y:12 },
  { id:'music',   name:'レコード',   icon:'🎶', price:110, x:20, y:62 },
  /* もようがえで足した家具（months … その月だけ売っている） */
  { id:'chair',   name:'いす',       icon:'🪑', price:60,  x:30, y:78 },
  { id:'picture', name:'えのがくぶち', icon:'🖼️', price:90, x:14, y:18 },
  { id:'teddy',   name:'くまのぬいぐるみ', icon:'🧸', price:100, x:92, y:84 },
  { id:'mirror',  name:'かがみ',     icon:'🪞', price:90,  x:94, y:50 },
  { id:'fish',    name:'きんぎょばち', icon:'🐠', price:120, x:70, y:60 },
  { id:'cactus',  name:'サボテン',   icon:'🌵', price:50,  x:6,  y:84 },
  { id:'sunflower', name:'ひまわり', icon:'🌻', price:70,  x:40, y:62 },
  { id:'lantern', name:'ちょうちん', icon:'🏮', price:80,  x:44, y:8 },
  { id:'piano',   name:'ピアノ',     icon:'🎹', price:180, x:24, y:88 },
  { id:'tv',      name:'テレビ',     icon:'📺', price:150, x:60, y:40 },
  { id:'xmastree', name:'クリスマスツリー', icon:'🎄', price:150, x:8, y:62, months:[11, 12] },
  { id:'pumpkin', name:'かぼちゃのランタン', icon:'🎃', price:80, x:62, y:88, months:[10] },
  { id:'kadomatsu', name:'かどまつ', icon:'🎍', price:100, x:8, y:62, months:[12, 1] },
  { id:'koinobori', name:'こいのぼり', icon:'🎏', price:100, x:80, y:16, months:[4, 5] },
  { id:'furin',   name:'ふうりん',   icon:'🎐', price:60,  x:28, y:22, months:[7, 8] }
];
/* その月に売っているか（季節の限定品） */
function petInSeason(x){
  if(!x || !Array.isArray(x.months) || !x.months.length) return true;
  return x.months.indexOf(Number(today().slice(5, 7))) >= 0;
}
var PET_STAGES = [[0, 'たまご'], [10, 'あかちゃん'], [80, 'こども'], [250, 'おとな'], [600, 'なかよしマスター']];
var PET_STAGE_HAT = ['', '', 'beret', 'nurse', 'crown'];    /* 育つと、すがたが変わる（こども→ベレー帽、おとな→ナースキャップ、マスター→おうかん） */
var PET_STAGE_GIFT = [0, 20, 50, 100, 200];                  /* 育ったときのごほうびコイン */
var PET_RATE = { hun:4, joy:3, cln:2 };     /* 1時間に下がる量 */
var PET_STUDY_CAP = 30;                      /* 暗記でもらえるコインは1日30まで */
/* きょうのミッション（check … できたか。off … 今日はできない日） */
var PET_MISSIONS = [
  { id:'visit',   icon:'👋', name:'会いにくる',         coins:5,  check:function(){ return true; } },
  { id:'class',   icon:'🏫', name:'授業に出る（出席をつける）', coins:10,
    off:function(){ return typeof classesForDate === 'function' && !classesForDate(today()).filter(function(c){ return !c.off; }).length; },
    check:function(){
      var td = today(), log = S.attendLog || {};
      return Object.keys(log).some(function(n){ return (log[n] || []).some(function(x){ return x && x.date === td && (x.st === '出' || x.st === '遅'); }); });
    } },
  { id:'task',    icon:'✅', name:'課題を1つ終える',     coins:10,
    check:function(){ var td = today(); return (S.tasks || []).some(function(t){ return t.done && t.mt && toYmd(new Date(Number(t.mt))) === td; }); } },
  { id:'anki',    icon:'📚', name:'暗記カードを10まい',  coins:15,
    check:function(){ return typeof ankiCountOn === 'function' && ankiCountOn(today()) >= 10; } },
  { id:'care',    icon:'🍙', name:'ごはんをあげる',      coins:5,  check:function(){ return petDaySum('fed', today()) > 0; } },
  { id:'kakeibo', icon:'🧾', name:'家計簿をつける',      coins:5,
    check:function(){ var td = today(); return (S.spends || []).some(function(x){ return x.date === td || (x.mt && toYmd(new Date(Number(x.mt))) === td); }); } }
];
var PET_MISSION_ALL = 20;                    /* ぜんぶクリアのごほうび */

function petAll(){ return (S.pets && typeof S.pets === 'object') ? S.pets : {}; }
function petMeta(){ return Object.assign({ active:'', bonus:100, spent:0, bag:{}, room:[], pause:0 }, petAll()._ || {}); }
function petActiveId(){
  var m = petMeta();
  if(m.active && charaAllIds().indexOf(m.active) >= 0) return m.active;
  return charaNow().id;
}
function petCoins(){
  var m = petMeta();
  var earned = (typeof charaFriend === 'function' ? charaFriend().pts : 0) * 5;
  var extra = toNum(petPlus('ppCoinsExtra')) || 0;       /* おさんぽ・卒業・お祝いでもらったぶん */
  return Math.max(0, earned + (toNum(m.bonus) || 0) - (toNum(m.spent) || 0) + petDaySum('coins') - petDaySum('spent') + extra);
}
/* 足した機能（js/m-petplus.js）を呼ぶ。なければ ''。まちがいがあっても、おせわの画面はこわさない */
function petPlus(name){
  var f = (typeof window !== 'undefined') ? window[name] : null;
  if(typeof f !== 'function') return '';
  try{ return f.apply(null, Array.prototype.slice.call(arguments, 1)); }
  catch(e){ if(typeof kmErr === 'function') kmErr('おせわ＋ ' + name, e); return ''; }
}
/* 育ち方の点（進化の道）をふやす（o … petUpdate の中の子） */
function petPt(o, path, n){
  if(!path) return;
  o.pts = Object.assign({}, (o.pts && typeof o.pts === 'object') ? o.pts : {});
  o.pts[path] = (toNum(o.pts[path]) || 0) + (n == null ? 1 : n);
}
var PET_FOOD_PATH = { onigiri:'nurse', bread:'nurse', salad:'genki', straw:'nonbiri', pudding:'nonbiri', cake:'idol', fav:'nonbiri' };
var PET_MISSION_PATH = { visit:'nonbiri', 'class':'nurse', task:'hakase', anki:'hakase', care:'nurse', kakeibo:'hakase' };
/* ===== 日と端末ごとの記録 ===== */
function petDays(){ return (S.petDays && typeof S.petDays === 'object' && !Array.isArray(S.petDays)) ? S.petDays : {}; }
function petDayAdd(field, n){
  S.petDays = petDays();
  var k = today() + '|' + DEV.id;
  var o = Object.assign({}, S.petDays[k]);
  o[field] = (toNum(o[field]) || 0) + n;
  o.mt = Date.now();
  S.petDays[k] = o;
  touch('petDays');
}
/* ymd を渡すとその日だけ、渡さないと全部の合計 */
function petDaySum(field, ymd){
  var d = petDays(), n = 0;
  Object.keys(d).forEach(function(k){
    if(k.indexOf('m:') === 0) return;
    if(ymd && k.slice(0, 10) !== ymd) return;
    n += toNum(d[k] && d[k][field]) || 0;
  });
  return n;
}
function petMissionState(ymd){ return Object.assign({ got:{} }, petDays()['m:' + (ymd || today())] || {}); }
function petMissions(){
  var st = petMissionState();
  return PET_MISSIONS.map(function(x){
    var off = x.off ? !!x.off() : false;
    return { id:x.id, icon:x.icon, name:x.name, coins:x.coins, off:off, done:!off && !!x.check(), got:!!st.got[x.id] };
  });
}
function petMissionClaim(id){
  var list = petMissions(), mi = list.filter(function(x){ return x.id === id; })[0];
  var st = petMissionState();
  if(id === 'all'){
    if(st.got.all || !list.every(function(x){ return x.off || x.got; })) return 0;
    st.got = Object.assign({}, st.got, { all:1 });
    S.petDays = petDays(); S.petDays['m:' + today()] = { got:st.got, mt:Date.now() }; touch('petDays');
    petDayAdd('coins', PET_MISSION_ALL);
    return PET_MISSION_ALL;
  }
  if(!mi || mi.off || !mi.done || mi.got) return 0;
  st.got = Object.assign({}, st.got); st.got[id] = 1;
  S.petDays = petDays(); S.petDays['m:' + today()] = { got:st.got, mt:Date.now() }; touch('petDays');
  petDayAdd('coins', mi.coins);
  return mi.coins;
}
/* 暗記カードをやったごほうび（anki.js から呼ぶ） */
function petStudyReward(n){
  n = toNum(n);
  if(n <= 0) return 0;
  var coins = Math.max(0, Math.min(n, PET_STUDY_CAP - petDaySum('studyCoins', today())));
  if(coins){ petDayAdd('coins', coins); petDayAdd('studyCoins', coins); }
  var id = petActiveId();
  if(petNow(id) && petNow(id).stage > 0){
    petUpdate(id, function(o){ o.exp += Math.ceil(n / 5); o.joy += Math.min(15, n); petPt(o, 'hakase', Math.ceil(n / 10)); });
    petSay(n + 'まいもがんばったね！' + (coins ? 'コイン' + coins + 'まい' : ''), 'cheer');
  }
  return coins;
}
function petStage(exp){
  var s = 0;
  PET_STAGES.forEach(function(x, i){ if(exp >= x[0]) s = i; });
  return s;
}
/* いまの様子（保存はしない） */
function petNow(id){
  var p = petAll()[id];
  if(!p) return null;
  var o = Object.assign({ hun:70, joy:70, cln:80, eng:80, exp:0, sleep:0, at:Date.now() }, p);
  var hours = petMeta().pause ? 0 : Math.max(0, Math.min(96, (Date.now() - (Number(o.at) || Date.now())) / 3600000));
  var clamp = function(v){ return Math.max(0, Math.min(100, Math.round(v))); };
  o.hun = clamp(o.hun - PET_RATE.hun * hours * (o.sleep ? 0.5 : 1));
  o.joy = clamp(o.joy - PET_RATE.joy * hours);
  o.cln = clamp(o.cln - PET_RATE.cln * hours);
  o.eng = clamp(o.eng + (o.sleep ? 12 : -3) * hours);
  o.sick = (o.hun < 10 || o.cln < 10) ? 1 : 0;
  o.stage = petStage(o.exp);
  return o;
}
function petMood(o){
  if(!o) return { expr:'normal', say:'' };
  if(o.stage === 0) return { expr:'sleep', say:'たまごをあたためてね' };
  if(o.sleep) return { expr:'sleep', say:'すやすや…' };
  if(o.sick) return { expr:'dizzy', say:'ちょっと、ぐあいがわるいかも…' };
  if(o.hun < 25) return { expr:'cry', say:'おなかすいたよ〜' };
  if(o.cln < 25) return { expr:'sweat', say:'おふろに入りたいな' };
  if(o.eng < 20) return { expr:'sleep', say:'ねむたい…' };
  if(o.joy < 30) return { expr:'sad', say:'あそんでほしいな' };
  if(o.joy >= 85 && o.hun >= 60) return { expr:'love', say:'だいすき！' };
  if(o.joy >= 65) return { expr:'happy', say:'きょうもたのしいね' };
  return { expr:'normal', say:'なにしよっか？' };
}
/* 様子を変えて保存する（育ったら、ごほうびのコインを入れて、次のセリフで知らせる） */
var petLevelMsg = '';
var PET_CALC = { sick:1, stage:1 };        /* petNow が計算して足すもの（保存しない） */
function petUpdate(id, fn){
  S.pets = S.pets || {};
  var had = !!petAll()[id];
  var cur = petNow(id) || { name:charaById(id).name, born:Date.now(), hun:70, joy:70, cln:80, eng:80, exp:0, sleep:0 };
  var s0 = petStage(toNum(cur.exp));
  fn(cur);
  ['hun', 'joy', 'cln', 'eng'].forEach(function(k){ cur[k] = Math.max(0, Math.min(100, Math.round(cur[k]))); });
  /* 知らない項目（着せかえ・進化の道など）は、そのまま残す */
  var save = {};
  Object.keys(cur).forEach(function(k){ if(!PET_CALC[k] && cur[k] !== undefined && typeof cur[k] !== 'function') save[k] = cur[k]; });
  Object.assign(save, { name:cur.name || charaById(id).name, born:cur.born || Date.now(), exp:Math.max(0, Math.round(cur.exp)),
    hun:cur.hun, joy:cur.joy, cln:cur.cln, eng:cur.eng, sleep:cur.sleep ? 1 : 0, at:Date.now(), mt:Date.now() });
  var s1 = petStage(save.exp);
  if(s0 === 0 && s1 >= 1 && !save.hatch) save.hatch = Date.now();          /* たまごから生まれた日（たんじょうび） */
  var p0 = save.path || '';
  petPlus('ppPathFix', id, save, s1);                                       /* おとな・マスターになったら、進む道を決める */
  S.pets[id] = save;
  touch('pets');
  if(had && s1 > s0){
    var gift = 0;
    for(var s = s0 + 1; s <= s1; s++) gift += PET_STAGE_GIFT[s] || 0;
    if(gift) petDayAdd('coins', gift);
    var ttl = (s1 >= 3 && save.path && save.path !== p0) ? petPlus('ppTitle', save) : '';
    petLevelMsg = (s1 >= 2 ? PET_STAGES[s1][1] + 'になったよ！' : '') + (ttl ? '「' + ttl + '」の道にすすんだよ。' : '') + (gift ? 'ごほうび🪙' + gift : '');
  }
}
function petMetaUpdate(fn){
  S.pets = S.pets || {};
  var m = petMeta();
  m.bag = Object.assign({}, m.bag);
  m.room = (m.room || []).slice();
  fn(m);
  m.mt = Date.now();
  S.pets._ = m;
  touch('pets');
}
function petPay(price){
  if(petCoins() < price){ toast('コインがたりません（あと' + (price - petCoins()) + '）', true); return false; }
  petDayAdd('spent', price);
  return true;
}
var petLog = [];
function petSay(text, expr){
  if(petLevelMsg){ text = text + ' ' + petLevelMsg; petLevelMsg = ''; expr = 'sparkle'; }
  petLog.unshift({ t:Date.now(), text:text });
  petLog = petLog.slice(0, 6);
  if(typeof charaCheer === 'function' && charaLevel() >= 2) charaCheer(text, expr || 'happy', { short:1 });
  else toast(text);
}

/* ============================== 画面 ============================== */
var petPanel = '';        /* food / play / shop */
function petSvg(id, o, size){
  var mood = petMood(o);
  if(o.stage === 0){
    return '<span class="petegg" aria-hidden="true"><svg viewBox="0 0 100 100" width="' + size + '" height="' + size + '">' +
      '<ellipse cx="50" cy="56" rx="30" ry="38" fill="#FFF8EC" stroke="#C9A77A" stroke-width="2.6"/>' +
      '<path d="M26 50 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6" fill="none" stroke="' + (charaById(id).body || '#F7C8D6') + '" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="40" cy="72" r="4" fill="' + (charaById(id).cheek || '#F7A9BE') + '" opacity=".6"/><circle cx="62" cy="36" r="3" fill="' + (charaById(id).cheek || '#F7A9BE') + '" opacity=".6"/>' +
      '</svg></span>';
  }
  var scale = [0, .72, .86, 1, 1.08][o.stage] || 1;
  var opt = { id:id, size:Math.round(size * scale), expr:mood.expr, anim:o.sleep ? 'sway' : 'bounce', still:true,
              prop:o.sleep ? 'moon' : (o.stage >= 4 ? 'trophy' : '') };
  if(PET_STAGE_HAT[o.stage]) opt.hat = PET_STAGE_HAT[o.stage];
  /* 着せかえ・進化の道・天気・お祝い（js/m-petplus.js）。opt を変えて、上に重ねる絵を返す */
  var look = petPlus('ppLook', id, o, opt) || {};
  var html = charaSvg(opt);
  if(look.svg) html = petPlus('ppInject', html, look.svg, opt.size) || html;
  return '<span class="petstage s' + o.stage + (look.cls ? ' ' + look.cls : '') + '">' + html + (look.after || '') + '</span>';
}
function petBar(key, label, icon, v){
  var tone = v < 25 ? 'low' : v < 50 ? 'mid' : 'ok';
  return '<div class="pbar pb-' + tone + '"><span class="pbl">' + icon + ' ' + label + '</span>' +
    '<span class="pbt" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + v + '" aria-label="' + label + '"><i style="width:' + v + '%"></i></span>' +
    '<span class="pbv num">' + v + '</span>' + (v < 25 ? '<span class="pbw">!</span>' : '') + '</div>';
}
function viewPet(){
  var id = petActiveId(), o = petNow(id), m = petMeta(), k = charaById(id);
  var coins = petCoins();
  var h = '<div class="petpick chips">' + charaCfg().friends.slice(0, 40).map(function(cid){
    var has = !!petAll()[cid];
    return '<button data-act="pet-pick" data-id="' + esc(cid) + '" class="' + (cid === id ? 'on' : '') + '" title="' + esc(charaById(cid).name) + '">' +
      charaSvg({ id:cid, size:26, still:true, hat:'' }) + (has ? '' : '<em>new</em>') + '</button>';
  }).join('') + '</div>';
  if(!o){
    return h + section('おせわ', null,
      '<div class="petnew">' + charaSvg({ id:id, size:110, expr:'happy', anim:'bounce', still:true }) +
      '<p><b>' + esc(k.name) + '</b>のたまごをもらって、育ててみませんか？</p>' +
      '<p class="note">ごはん・おふろ・なでる・ミニゲームで育ちます。時間がたつとおなかがすくので、ときどき見に来てね。テスト期間は「おせわおやすみ」で時間を止められます。</p>' +
      '<button class="btn" data-act="pet-adopt" data-id="' + esc(id) + '">たまごをもらう</button></div>' +
      '<div class="pillrow" style="margin-top:10px;justify-content:center"><button data-act="pet-panel" data-v="anniv" class="' + (petPanel === 'anniv' ? 'on' : '') + '">🎂 誕生日・記念日</button>' +
        '<button data-act="pet-panel" data-v="dex" class="' + (petPanel === 'dex' ? 'on' : '') + '">📖 図鑑</button></div>') +
      ((petPanel === 'anniv' || petPanel === 'dex') ? petPlus('ppPanel', petPanel, id, null) : '');
  }
  var mood = petMood(o);
  var stageName = PET_STAGES[o.stage][1];
  var nextExp = PET_STAGES[o.stage + 1] ? PET_STAGES[o.stage + 1][0] : null;
  var title = o.stage >= 3 ? petPlus('ppTitle', o, id) : '';
  /* へや（かべがみ・ゆか・家具の場所は、もようがえで変えられる） */
  var deco = (m.room || []).map(function(did){
    var d = PET_DECO.filter(function(x){ return x.id === did; })[0];
    if(!d) return '';
    var pos = (m.pos && m.pos[did] && typeof m.pos[did] === 'object') ? m.pos[did] : null;
    var x = pos ? toNum(pos.x) : d.x, y = pos ? toNum(pos.y) : d.y;
    return '<span class="pdeco' + (d.big ? ' big' : '') + '" data-pp="' + esc(did) + '" style="left:' + x + '%;top:' + y + '%" aria-hidden="true">' + d.icon + '</span>';
  }).join('');
  h += '<section><div class="petroom' + (o.sleep ? ' night' : '') + (petPlus('ppRoomCls', m, o) || '') + '">' + (petPlus('ppRoomBg', m, o, id) || '') + deco +
    '<div class="petme" data-act="pet-pat" role="button" aria-label="' + esc(o.name || k.name) + 'をなでる">' +
      '<div class="chbubble">' + esc(chTicFor(k, petPlus('ppLine', id, o, mood) || mood.say)) + '</div>' + petSvg(id, o, 120) + '</div>' +
    (m.pause ? '<span class="ppause">おせわおやすみ中</span>' : '') +
    '<span class="pcoin" aria-label="コイン">🪙 <b class="num">' + coins + '</b></span></div>';
  h += '<div class="box"><div class="pethead"><div><div class="t"><b>' + esc(o.name || k.name) + '</b>　<span class="s2">' + stageName + (title ? '・' + esc(title) : '') + '</span></div>' +
    '<div class="s">育ち ' + o.exp + (nextExp ? ' / ' + nextExp + '（つぎは' + PET_STAGES[o.stage + 1][1] + '）' : '（さいこう！）') + '</div></div>' +
    '<button class="mini" data-act="pet-rename">名前</button></div>' +
    (o.stage === 0 ? '<p class="note">たまごは、あたためると生まれます（あと' + (10 - o.exp) + '）。</p>'
      : petBar('hun', 'おなか', '🍙', o.hun) + petBar('joy', 'きげん', '💗', o.joy) + petBar('cln', 'きれい', '🫧', o.cln) + petBar('eng', 'げんき', '⚡', o.eng)) +
    '<div class="petacts">' + (o.stage === 0
      ? '<button class="btn" data-act="pet-warm">🔥 あたためる</button>'
      : '<button data-act="pet-panel" data-v="food" class="' + (petPanel === 'food' ? 'on' : '') + '">🍙 ごはん</button>' +
        '<button data-act="pet-pat">🤲 なでる</button>' +
        '<button data-act="pet-panel" data-v="play" class="' + (petPanel === 'play' ? 'on' : '') + '">🎮 あそぶ</button>' +
        '<button data-act="pet-bath">🛁 おふろ</button>' +
        '<button data-act="pet-sleep">' + (o.sleep ? '☀️ おこす' : '🌙 ねかせる') + '</button>' +
        (o.sick ? '<button data-act="pet-med">💊 おくすり</button>' : '')) +
      '<button data-act="pet-panel" data-v="shop" class="' + (petPanel === 'shop' ? 'on' : '') + '">🛍️ おみせ</button></div>' +
    '<div class="petacts pp-acts">' + [['dress', '👗 きせかえ', 1], ['room', '🏠 もようがえ', 0], ['walk', '🚶 おさんぽ', 1], ['dex', '📖 図鑑', 0], ['anniv', '🎂 記念日', 0]]
      .filter(function(b){ return !(b[2] && o.stage === 0); })
      .map(function(b){ return '<button data-act="pet-panel" data-v="' + b[0] + '" class="' + (petPanel === b[0] ? 'on' : '') + '">' + b[1] + '</button>'; }).join('') + '</div>';
  if(petPanel === 'food'){
    h += '<div class="petlist">' + PET_FOODS.map(function(f){
      var have = toNum(m.bag[f.id]);
      var nm = f.id === 'fav' ? (k.like || 'だいこうぶつ') : f.name;
      return '<button data-act="pet-feed" data-v="' + f.id + '"><span class="pi">' + f.icon + '</span><span class="pn">' + esc(nm) + '</span>' +
        '<span class="pp">' + (have ? 'もってる ×' + have : '🪙' + f.price) + '</span></button>';
    }).join('') + '</div>';
  }
  if(petPanel === 'play'){
    h += '<div class="petlist">' +
      '<button data-act="pet-game" data-v="star"><span class="pi">⭐</span><span class="pn">ほしキャッチ</span><span class="pp">20びょう</span></button>' +
      '<button data-act="pet-game" data-v="memory"><span class="pi">🃏</span><span class="pn">おぼえてタッチ</span><span class="pp">ペアをさがす</span></button>' +
      '<button data-act="pet-game" data-v="quiz"><span class="pi">📝</span><span class="pn">おべんきょうクイズ</span><span class="pp">暗記カードから4択</span></button>' +
      (toNum(m.bag.ball) ? '<button data-act="pet-toy"><span class="pi">⚽</span><span class="pn">ボールであそぶ</span><span class="pp">きげん＋</span></button>' : '') +
      '</div><p class="note">ミニゲームでコインがもらえます。遊ぶと、げんきを少し使います。</p>';
  }
  if(petPanel === 'shop'){
    h += '<div class="s2" style="margin:8px 0 4px">食べもの・どうぐ（もちものに入ります）</div><div class="petlist">' +
      PET_FOODS.concat(PET_ITEMS).map(function(f){
        return '<button data-act="pet-buy" data-v="' + f.id + '"><span class="pi">' + f.icon + '</span><span class="pn">' + esc(f.id === 'fav' ? (k.like || f.name) : f.name) + '</span>' +
          '<span class="pp">🪙' + f.price + (toNum(m.bag[f.id]) ? '・×' + toNum(m.bag[f.id]) : '') + '</span></button>';
      }).join('') + '</div>' +
      '<div class="s2" style="margin:10px 0 4px">へやのかざり</div><div class="petlist">' + PET_DECO.map(function(d){
        var own = (m.room || []).indexOf(d.id) >= 0, bought = petDecoBought(d.id);
        if(!own && !bought && !petInSeason(d)) return '';           /* 季節の限定品は、その月だけ */
        return '<button data-act="pet-deco" data-v="' + d.id + '" class="' + (own ? 'on' : '') + '"><span class="pi">' + d.icon + '</span><span class="pn">' + d.name + '</span>' +
          '<span class="pp">' + (own ? 'かざってる' : bought ? 'もってる' : '🪙' + d.price + (d.months ? '・きせつ限定' : '')) + '</span></button>';
      }).join('') + '</div><p class="note">かべがみ・ゆか・家具を置く場所は「🏠 もようがえ」で変えられます。</p>';
  }
  h += '</div>';
  /* きせかえ・もようがえ・おさんぽ・図鑑・記念日（js/m-petplus.js） */
  if(['dress', 'room', 'walk', 'dex', 'anniv'].indexOf(petPanel) >= 0) h += petPlus('ppPanel', petPanel, id, o);
  /* きょうのミッション */
  if(o.stage > 0){
    var ms = petMissions(), stM = petMissionState();
    var allDone = ms.every(function(x){ return x.off || x.got; });
    h += section('きょうのミッション', ms.filter(function(x){ return x.got; }).length + '/' + ms.filter(function(x){ return !x.off; }).length,
      ms.map(function(x){
        return '<div class="row pmis' + (x.got ? ' got' : '') + '"><span class="pmi">' + x.icon + '</span><div class="grow"><div class="t">' + esc(x.name) + '</div>' +
          '<div class="s">' + (x.off ? '今日はなし' : '🪙' + x.coins) + '</div></div>' +
          (x.off ? '' : x.got ? '<span class="s2">✔ もらった</span>'
            : x.done ? '<button class="mini" data-act="pet-claim" data-v="' + x.id + '">受けとる</button>'
            : '<span class="s2">まだ</span>') + '</div>';
      }).join('') +
      '<div class="row pmis' + (stM.got.all ? ' got' : '') + '"><span class="pmi">🌈</span><div class="grow"><div class="t">ぜんぶクリア</div><div class="s">🪙' + PET_MISSION_ALL + '</div></div>' +
        (stM.got.all ? '<span class="s2">✔ もらった</span>' : allDone ? '<button class="mini" data-act="pet-claim" data-v="all">受けとる</button>' : '<span class="s2">まだ</span>') + '</div>');
  }
  /* 育ちかた */
  h += section('育ちかた', null, '<div class="pstages">' + PET_STAGES.map(function(s, i){
    var here = i === o.stage, past = i < o.stage;
    return '<div class="pst' + (here ? ' here' : past ? ' past' : '') + '"><div class="pstn">' + s[1] + '</div>' +
      '<div class="s2">' + (i ? '育ち' + s[0] : 'スタート') + (PET_STAGE_GIFT[i] ? '・🪙' + PET_STAGE_GIFT[i] : '') + '</div>' +
      (i === 3 ? '<div class="s2">育ち方で道が分かれる</div>'
        : PET_STAGE_HAT[i] ? '<div class="s2">' + esc((CHARA_HATS.filter(function(x){ return x.id === PET_STAGE_HAT[i]; })[0] || {}).name || '') + 'をかぶる</div>' : '') + '</div>';
  }).join('') + '</div>');
  /* 進化の道（いまどの道に近いか） */
  h += petPlus('ppPathSection', id, o) || '';
  h += section('コインのもらいかた', null,
    '<div class="row"><div class="grow s">課題を1つ終える</div><div class="t">🪙10</div></div>' +
    '<div class="row"><div class="grow s">今日の評価をもらう</div><div class="t">🪙15</div></div>' +
    '<div class="row"><div class="grow s">予定・メモを1つ入れる</div><div class="t">🪙5</div></div>' +
    '<div class="row"><div class="grow s">バイトのシフト2つ</div><div class="t">🪙5</div></div>' +
    '<div class="row"><div class="grow s">暗記カード1まい（1日' + PET_STUDY_CAP + 'まで）</div><div class="t">🪙1</div></div>' +
    '<div class="row"><div class="grow s">きょうのミッション</div><div class="t">🪙5〜' + PET_MISSION_ALL + '</div></div>' +
    '<div class="row"><div class="grow s">育って、すがたが変わる</div><div class="t">🪙20〜200</div></div>' +
    '<div class="row"><div class="grow s">ミニゲーム</div><div class="t">とれた数ぶん</div></div>' +
    '<div class="row"><div class="grow s">おさんぽで見つける</div><div class="t">🪙3〜12</div></div>' +
    '<div class="row"><div class="grow s">誕生日・記念日のプレゼント</div><div class="t">🪙20〜50</div></div>' +
    '<div class="row"><div class="grow s">マスターの子が卒業する</div><div class="t">🪙100</div></div>' +
    '<div class="pillrow" style="margin-top:8px"><button data-act="pet-pause" class="' + (m.pause ? 'on' : '') + '">' +
      (m.pause ? 'おせわおやすみ中（押すと再開）' : 'おせわおやすみ（テスト期間など）') + '</button></div>' +
    (petLog.length ? '<div class="s2" style="margin-top:8px">さいきん：' + petLog.map(function(l){ return esc(l.text); }).join('／') + '</div>' : ''));
  return h;
}
function chTicFor(k, line){ return (typeof ctTic === 'function') ? ctTic(k, line) : line; }

/* ============================== ミニゲーム ============================== */
var petGame = null;
function petGameEl(){
  var el = document.getElementById('petgame');
  if(!el){
    el = document.createElement('div');
    el.id = 'petgame';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    document.body.appendChild(el);
    el.addEventListener('click', function(e){
      var b = e.target.closest('[data-g]');
      if(!b || !petGame) return;
      if(b.dataset.g === 'close') petGameEnd(true);
      if(b.dataset.g === 'star') petStarHit(b);
      if(b.dataset.g === 'card') petCardFlip(b);
      if(b.dataset.g === 'quiz') petQuizPick(b);
    });
  }
  return el;
}
function petGameStart(kind){
  var id = petActiveId(), o = petNow(id);
  if(!o) return;
  if(o.sleep){ toast('ねているよ。おこしてからあそぼう', true); return; }
  if(o.eng < 10){ toast('げんきがないみたい。ねかせてあげよう', true); return; }
  if(kind === 'quiz' && !petQuizMake()){ toast('暗記カードが4まい以上あると遊べます（暗記タブで作れます）', true); return; }
  var el = petGameEl();
  el.classList.add('on');
  document.body.classList.add('petplaying');
  petGame = { kind:kind, id:id, score:0, t0:Date.now(), timers:[] };
  if(kind === 'star') petStarRun(el);
  else if(kind === 'quiz') petQuizRun(el);
  else petMemoryRun(el);
}
function petStarRun(el){
  var g = petGame, left = 20;
  el.innerHTML = '<div class="pgbox"><div class="pghd"><b>ほしキャッチ</b><span class="pgsc">⭐ <b id="pg_sc">0</b></span><span id="pg_tm">20</span>' +
    '<button data-g="close" class="mini">やめる</button></div><div class="pgfield" id="pg_field">' +
    '<div class="pgpet">' + charaSvg({ id:g.id, size:64, expr:'cheer', still:true }) + '</div></div>' +
    '<p class="note" style="text-align:center">落ちてくる ⭐ をタップ！ 💧 はさけてね</p></div>';
  var field = document.getElementById('pg_field');
  g.timers.push(setInterval(function(){
    left--;
    var tm = document.getElementById('pg_tm'); if(tm) tm.textContent = left;
    if(left <= 0) petGameEnd(false);
  }, 1000));
  g.timers.push(setInterval(function(){
    if(!petGame) return;
    var b = document.createElement('button');
    var bad = Math.random() < .18;
    b.className = 'pgstar' + (bad ? ' bad' : '');
    b.dataset.g = 'star';
    b.dataset.bad = bad ? '1' : '';
    b.setAttribute('aria-label', bad ? 'みず' : 'ほし');
    b.textContent = bad ? '💧' : (Math.random() < .15 ? '🌟' : '⭐');
    if(b.textContent === '🌟') b.dataset.big = '1';
    b.style.left = (5 + Math.random() * 82) + '%';
    b.style.animationDuration = (2 + Math.random() * 1.6).toFixed(2) + 's';
    b.addEventListener('animationend', function(){ b.remove(); });
    field.appendChild(b);
  }, 520));
}
function petStarHit(b){
  if(!petGame || b.dataset.done) return;
  b.dataset.done = '1';
  petGame.score = Math.max(0, petGame.score + (b.dataset.bad ? -2 : b.dataset.big ? 3 : 1));
  b.classList.add('hit');
  setTimeout(function(){ b.remove(); }, 250);
  var sc = document.getElementById('pg_sc'); if(sc) sc.textContent = petGame.score;
}
function petMemoryRun(el){
  var g = petGame;
  var pool = charaAllIds().filter(function(x){ return !charaById(x).custom; });
  var picks = ctShuffle(pool, Date.now() % 100000).slice(0, 6);
  var deck = ctShuffle(picks.concat(picks), (Date.now() >> 3) % 100000);
  g.deck = deck; g.open = []; g.found = {}; g.moves = 0; g.lock = false;
  el.innerHTML = '<div class="pgbox"><div class="pghd"><b>おぼえてタッチ</b><span class="pgsc">🃏 <b id="pg_sc">0</b>/6</span><span id="pg_tm">0</span>' +
    '<button data-g="close" class="mini">やめる</button></div>' +
    '<div class="pgcards">' + deck.map(function(cid, i){
      return '<button class="pgcard" data-g="card" data-i="' + i + '" aria-label="カード' + (i + 1) + '"><span class="back">?</span>' +
        '<span class="front">' + charaSvg({ id:cid, size:48, expr:'happy', still:true, hat:'' }) + '</span></button>';
    }).join('') + '</div><p class="note" style="text-align:center">同じ子のペアをさがしてね</p></div>';
  g.timers.push(setInterval(function(){
    var tm = document.getElementById('pg_tm');
    if(tm) tm.textContent = Math.floor((Date.now() - g.t0) / 1000) + 'びょう';
  }, 1000));
}
function petCardFlip(b){
  var g = petGame, i = toNum(b.dataset.i);
  if(g.lock || g.found[i] || g.open.indexOf(i) >= 0) return;
  b.classList.add('open');
  g.open.push(i);
  if(g.open.length < 2) return;
  g.moves++;
  var a = g.open[0], c = g.open[1];
  var cards = document.querySelectorAll('.pgcard');
  if(g.deck[a] === g.deck[c]){
    g.found[a] = g.found[c] = 1; g.open = [];
    g.score++;
    var sc = document.getElementById('pg_sc'); if(sc) sc.textContent = g.score;
    if(g.score >= 6) setTimeout(function(){ petGameEnd(false); }, 500);
  }else{
    g.lock = true;
    setTimeout(function(){
      if(cards[a]) cards[a].classList.remove('open');
      if(cards[c]) cards[c].classList.remove('open');
      g.open = []; g.lock = false;
    }, 800);
  }
}
function petGameEnd(quit){
  var g = petGame;
  if(!g) return;
  petGame = null;
  g.timers.forEach(function(t){ clearInterval(t); });
  var el = document.getElementById('petgame');
  if(el){ el.classList.remove('on'); el.innerHTML = ''; }
  document.body.classList.remove('petplaying');
  var coins = 0, joy = 0;
  if(g.kind === 'star'){ coins = g.score; joy = Math.min(30, g.score * 2); }
  else{
    var secs = (Date.now() - g.t0) / 1000;
    coins = g.score * 2 + (g.score >= 6 ? Math.max(0, 30 - Math.floor(secs / 4)) : 0);
    joy = g.score * 4;
  }
  if(g.kind === 'quiz'){ coins = g.score * 3; joy = g.score * 4; }
  if(quit && !g.score){ render(); return; }
  petUpdate(g.id, function(o){
    o.joy += joy; o.eng -= 10; o.exp += Math.ceil(coins / 2) + 2;
    if(g.kind === 'star') petPt(o, 'genki', 2 + Math.floor(g.score / 5));
    else if(g.kind === 'quiz') petPt(o, 'hakase', 1 + g.score);
    else { petPt(o, 'hakase', 1); petPt(o, 'genki', 1); }
  });
  petDayAdd('coins', coins);
  commit();
  petSay((g.kind === 'star' ? 'ほし ' + g.score + 'こ！' : g.kind === 'quiz' ? g.score + 'もん せいかい！' : 'ペア ' + g.score + 'こ！') + 'コイン' + coins + 'まいもらったよ', 'cheer');
}
/* ===== おべんきょうクイズ（暗記カードから4択） ===== */
var PET_QUIZ_N = 5;
function petQuizPool(){
  return (Array.isArray(S.cards) ? S.cards : []).filter(function(c){ return c && c.q && c.a; });
}
function petQuizMake(){
  var pool = petQuizPool();
  var answers = [];
  pool.forEach(function(c){ if(answers.indexOf(c.a) < 0) answers.push(c.a); });
  if(pool.length < 4 || answers.length < 4) return null;
  return ctShuffle(pool, Date.now() % 100000).slice(0, PET_QUIZ_N).map(function(c, i){
    var wrong = ctShuffle(answers.filter(function(a){ return a !== c.a; }), (Date.now() >> 2) % 100000 + i).slice(0, 3);
    var choices = ctShuffle(wrong.concat([c.a]), (Date.now() >> 4) % 100000 + i * 7);
    return { id:c.id, q:c.q, a:c.a, choices:choices };
  });
}
function petQuizRun(el){
  var g = petGame;
  g.qs = petQuizMake() || [];
  g.i = 0; g.lock = false;
  petQuizShow(el);
}
function petQuizShow(el){
  var g = petGame, q = g.qs[g.i];
  if(!q){ petGameEnd(false); return; }
  el.innerHTML = '<div class="pgbox"><div class="pghd"><b>おべんきょうクイズ</b><span class="pgsc">⭕ <b id="pg_sc">' + g.score + '</b>/' + g.qs.length + '</span>' +
    '<span id="pg_tm">' + (g.i + 1) + 'もんめ</span><button data-g="close" class="mini">やめる</button></div>' +
    '<div class="pgquiz"><div class="pgpet">' + charaSvg({ id:g.id, size:56, expr:'think', still:true }) + '</div>' +
    '<div class="pgq">' + esc(q.q) + '</div>' +
    q.choices.map(function(c, i){ return '<button class="pgch" data-g="quiz" data-i="' + i + '">' + esc(c) + '</button>'; }).join('') +
    '</div></div>';
}
function petQuizPick(b){
  var g = petGame;
  if(!g || g.lock) return;
  var q = g.qs[g.i], pick = q.choices[toNum(b.dataset.i)];
  var right = pick === q.a;
  g.lock = true;
  if(right) g.score++;
  if(typeof ankiLog === 'function') ankiLog(right);      /* クイズも暗記の枚数に数える */
  b.classList.add(right ? 'right' : 'wrong');
  if(!right){
    Array.prototype.forEach.call(document.querySelectorAll('.pgch'), function(x, i){ if(q.choices[i] === q.a) x.classList.add('right'); });
  }
  var sc = document.getElementById('pg_sc'); if(sc) sc.textContent = g.score;
  setTimeout(function(){
    if(!petGame) return;
    g.i++; g.lock = false;
    petQuizShow(document.getElementById('petgame'));
  }, right ? 700 : 1400);
}

/* ============================== 操作 ============================== */
function petAction(act, t){
  if(act.indexOf('pet-') !== 0) return false;
  var id = petActiveId(), k = charaById(id);
  var need = function(){ var o = petNow(id); if(!o){ toast('先にたまごをもらってね', true); } return o; };
  if(act === 'pet-pick'){ petMetaUpdate(function(m){ m.active = t.dataset.id; }); petPanel = ''; commit(); return true; }
  if(act === 'pet-adopt'){
    var aid = t.dataset.id || id;
    petUpdate(aid, function(o){ o.exp = 0; o.hun = 80; o.joy = 70; o.cln = 90; o.eng = 90; o.born = Date.now(); o.name = charaById(aid).name; });
    petMetaUpdate(function(m){ m.active = aid; });
    commit(); petSay('たまごをもらったよ。あたためてね', 'surprise'); return true;
  }
  if(act === 'pet-panel'){ petPanel = (petPanel === t.dataset.v) ? '' : t.dataset.v; render(); return true; }
  if(act === 'pet-claim'){
    var got = petMissionClaim(t.dataset.v);
    if(!got){ toast('まだ受けとれません', true); return true; }
    var po = petNow(id);
    if(po && po.stage > 0) petUpdate(id, function(x){ x.joy += 5; x.exp += 2; petPt(x, PET_MISSION_PATH[t.dataset.v], 2); });
    commit(); petSay('ミッションクリア！コイン' + got + 'まい', 'sparkle'); return true;
  }
  var o = need();
  if(!o) return true;
  if(act === 'pet-warm'){
    petUpdate(id, function(x){ x.exp += 5; });
    var born = petNow(id).stage > 0;
    commit(); petSay(born ? k.name + 'が生まれたよ！' : 'ぬくぬく…もうすこし', born ? 'sparkle' : 'sleep'); return true;
  }
  if(o.stage === 0){ toast('まだたまごだよ。あたためてね'); return true; }
  if(act === 'pet-pat'){
    if(o.sleep){ toast('ねているよ。そっとしておこう'); return true; }
    var last = petPatAt[id] || 0;
    if(Date.now() - last < 20000){ petSay('えへへ、くすぐったい', 'shy'); return true; }
    petPatAt[id] = Date.now();
    petUpdate(id, function(x){ x.joy += 5; x.exp += 1; petPt(x, 'nonbiri', 1); });
    commit(); petSay('なでなで、うれしい！', 'love'); return true;
  }
  if(act === 'pet-feed'){
    if(o.sleep){ toast('ねているよ。おきたらあげよう'); return true; }
    if(o.hun >= 95){ petSay('おなかいっぱい！', 'proud'); return true; }
    var f = PET_FOODS.filter(function(x){ return x.id === t.dataset.v; })[0];
    if(!f) return true;
    var m = petMeta();
    if(toNum(m.bag[f.id]) > 0) petMetaUpdate(function(mm){ mm.bag[f.id] = toNum(mm.bag[f.id]) - 1; });
    else if(!petPay(f.price)) return true;
    petUpdate(id, function(x){ x.hun += f.hun; x.joy += f.joy + (f.id === 'fav' ? 8 : 0); x.cln += (f.cln || 0); x.exp += 3; petPt(x, PET_FOOD_PATH[f.id], f.id === 'onigiri' || f.id === 'bread' ? 1 : 2); });
    petDayAdd('fed', 1);
    commit(); petSay((f.id === 'fav' ? (k.like || 'だいこうぶつ') : f.name) + '、おいしい！', 'eat'); return true;
  }
  if(act === 'pet-buy'){
    var it = PET_FOODS.concat(PET_ITEMS).filter(function(x){ return x.id === t.dataset.v; })[0];
    if(!it || !petPay(it.price)) return true;
    petMetaUpdate(function(mm){ mm.bag[it.id] = toNum(mm.bag[it.id]) + 1; });
    commit(); toast(it.name + 'を買いました'); return true;
  }
  if(act === 'pet-deco'){
    var d = PET_DECO.filter(function(x){ return x.id === t.dataset.v; })[0];
    if(!d) return true;
    var own = petMeta().room.indexOf(d.id) >= 0;
    if(own){ petMetaUpdate(function(mm){ mm.room = mm.room.filter(function(x){ return x !== d.id; }); }); commit(); toast('しまいました（また無料でかざれます）'); return true; }
    var bought = petDecoBought(d.id);
    if(!bought && !petInSeason(d)){ toast('いまは売っていません（きせつの限定品）', true); return true; }
    if(!bought && !petPay(d.price)) return true;
    if(!bought) petPlus('ppLogBuy', 'deco:' + d.id);      /* 買った記録（2台で同時に買っても消えない） */
    petMetaUpdate(function(mm){ mm.room.push(d.id); mm.owned = (mm.owned || []).filter(function(x){ return x !== d.id; }).concat([d.id]); });
    petUpdate(id, function(x){ x.joy += 6; if(!bought) petPt(x, 'idol', 1); });
    commit(); petSay(d.name + '、すてき！', 'sparkle'); return true;
  }
  if(act === 'pet-bath'){
    if(o.sleep){ toast('ねているよ'); return true; }
    petUpdate(id, function(x){ x.cln = 100; x.joy += 3; x.exp += 2; petPt(x, 'nurse', 1); petPt(x, 'idol', 1); });
    commit(); petSay('さっぱり！', 'happy'); return true;
  }
  if(act === 'pet-sleep'){
    petUpdate(id, function(x){ if(!x.sleep) petPt(x, 'nonbiri', 1); x.sleep = x.sleep ? 0 : 1; });
    commit(); petSay(o.sleep ? 'おはよう！' : 'おやすみなさい…', o.sleep ? 'happy' : 'sleep'); return true;
  }
  if(act === 'pet-med'){
    var mb = petMeta();
    if(toNum(mb.bag.medicine) > 0) petMetaUpdate(function(mm){ mm.bag.medicine = toNum(mm.bag.medicine) - 1; });
    else if(!petPay(30)) return true;
    petUpdate(id, function(x){ x.hun = Math.max(x.hun, 40); x.cln = Math.max(x.cln, 40); x.joy += 5; petPt(x, 'nurse', 3); });
    commit(); petSay('げんきになったよ、ありがとう', 'happy'); return true;
  }
  if(act === 'pet-toy'){
    if(o.sleep){ toast('ねているよ'); return true; }
    petUpdate(id, function(x){ x.joy += 15; x.eng -= 5; x.exp += 3; petPt(x, 'genki', 2); });
    commit(); petSay('ボール、たのしい！', 'cheer'); return true;
  }
  if(act === 'pet-game'){ petGameStart(t.dataset.v); return true; }
  if(act === 'pet-rename'){
    var nm = prompt('名前', o.name || k.name);
    if(nm == null) return true;
    petUpdate(id, function(x){ x.name = String(nm).trim().slice(0, 12) || k.name; });
    commit(); return true;
  }
  if(act === 'pet-pause'){
    /* 切りかえる前に、いまの様子をそのまま保存する（止めていた時間を、あとで数えないように） */
    Object.keys(petAll()).forEach(function(pid){ if(pid !== '_' && petAll()[pid]) petUpdate(pid, function(){}); });
    petMetaUpdate(function(mm){ mm.pause = mm.pause ? 0 : 1; });
    commit(); return true;
  }
  return true;
}
var petPatAt = {};
/* かざりを買ったことがあるか（前からの記録＋日と端末ごとの記録） */
function petDecoBought(did){
  return (petMeta().owned || []).indexOf(did) >= 0 || !!petPlus('ppOwned', 'deco:' + did);
}
