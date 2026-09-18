/* くらしの手帳：キャラクター（出てくる場所・ことば・設定） */
/* ============================== 設定の読み出し ==============================
   S.ui.chara = { level, mode, main, friends, talk, hat, touch, custom:[{ id, pid, name, tic, note }] }
   ・絵は chara-art.js、データは chara-data.js、自分の画像から作るのは chara-make.js      */
function charaCustomList(){
  var c = (S.ui && S.ui.chara) || {};
  return Array.isArray(c.custom) ? c.custom.filter(function(x){ return x && x.id && x.pid; }) : [];
}
function charaAllIds(){
  return CHARAS.map(function(x){ return x.id; }).concat(charaCustomList().map(function(x){ return x.id; }));
}
function charaCfg(){
  var c = (S.ui && S.ui.chara) || {};
  var all = charaAllIds();
  var friends = Array.isArray(c.friends) ? c.friends.filter(function(id){ return all.indexOf(id) >= 0; }) : [];
  if(!friends.length) friends = all;
  var touchOk = CHARA_TOUCHES.some(function(t){ return t[0] === c.touch; });
  return {
    level: (c.level == null) ? 2 : Math.max(0, Math.min(5, Math.round(toNum(c.level)))),
    mode: (c.mode === 'daily' || c.mode === 'random') ? c.mode : 'one',
    main: (all.indexOf(c.main) >= 0) ? c.main : 'mochi',
    friends: friends,
    talk: c.talk ? 1 : 0,
    hat: c.hat || 'auto',
    touch: touchOk ? c.touch : 'line',
    custom: charaCustomList()
  };
}
function charaLevel(){ return charaCfg().level; }
function charaTouch(){ return charaCfg().touch; }
function charaById(id){
  var k = CHARAS.filter(function(x){ return x.id === id; })[0];
  if(k) return k;
  var u = charaCustomList().filter(function(x){ return x.id === id; })[0];
  if(u){
    return { id:u.id, custom:1, pid:u.pid, cat:'mine', name:u.name || '自分の子', tic:u.tic || '',
             like:u.like || '', desc:u.note || '自分の画像から作った子', line:'#6E5A66', cheek:'#F7A9BE' };
  }
  return CHARAS[0];
}
var __charaRandom = null;
/* 今日の子 */
function charaNow(){
  var c = charaCfg();
  if(c.mode === 'daily'){
    var d = new Date(); var n = Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
    return charaById(c.friends[n % c.friends.length]);
  }
  if(c.mode === 'random'){
    if(!__charaRandom || c.friends.indexOf(__charaRandom) < 0) __charaRandom = c.friends[Math.floor(Math.random() * c.friends.length)];
    return charaById(__charaRandom);
  }
  return charaById(c.main);
}
/* 今日のほかの仲間（毎日入れかわる） */
function charaPals(n){
  var c = charaCfg(), me = charaNow().id;
  var pool = (c.friends.length > 1 ? c.friends : charaAllIds()).filter(function(id){ return id !== me; });
  var seed = Number(today().replace(/-/g, '')) || 1, out = [];
  while(pool.length && out.length < n){
    seed = (seed * 16807) % 2147483647;
    out.push(pool.splice(seed % pool.length, 1)[0]);
  }
  return out;
}

/* ============================== なかよし度・着せかえ ============================== */
var __cf = null;
function charaFriend(){
  if(__cf && Date.now() - __cf.t < 3000) return __cf.v;
  var p = 0;
  (S.tasks || []).forEach(function(t){ if(t && t.done) p += 2; });
  Object.keys(S.dayReview || {}).forEach(function(k){ if((S.dayReview[k] || {}).grade) p += 3; });
  p += (S.events || []).length + (S.notes || []).length + Math.floor((S.shifts || []).length / 2);
  var lv = 0;
  CHARA_FRIEND_STEPS.forEach(function(s, i){ if(p >= s) lv = i; });
  var nx = CHARA_FRIEND_STEPS[lv + 1];
  var v = { pts:p, lv:lv, next:(nx == null) ? 0 : nx - p };
  __cf = { t:Date.now(), v:v };
  return v;
}
function charaHatInfo(id){ return CHARA_HATS.filter(function(h){ return h.id === id; })[0] || null; }
function charaHatOk(id){
  var h = charaHatInfo(id);
  return !!h && (h.season || charaFriend().lv >= h.lv);
}
var __chAuto = null;
function charaHatAuto(){
  if(__chAuto && Date.now() - __chAuto.t < 3000) return __chAuto.v;
  var td = today(), v = '';
  var exam = (S.exams || []).some(function(x){ return isYmd(x.date) && x.date >= td && daysFromToday(x.date) <= 1; });
  if(exam) v = 'hachimaki';
  else{
    var fes = (typeof festivalNow === 'function') ? festivalNow() : '';
    var map = { xmas:'santa', halloween:'witch', kodomo:'kabuto', sakura:'sakura', tanabata:'star', natsu:'straw',
                newyear:'ribbon', valentine:'ribbon', kouyou:'leaf', hinamatsuri:'flower' };
    var m = Number(td.slice(5, 7));
    v = map[fes] || ((m === 12 || m <= 2) ? 'scarf' : '');
  }
  __chAuto = { t:Date.now(), v:v };
  return v;
}
function charaHatNow(){
  var c = charaCfg();
  if(c.level < 1 || c.hat === 'none') return '';
  if(c.hat !== 'auto') return charaHatOk(c.hat) ? c.hat : '';
  return (c.level >= 4) ? charaHatAuto() : '';
}

/* ============================== ことば ============================== */
/* その子らしい語尾をつける（「あるよ！」→「あるよ にゃ！」） */
function chTic(line){
  var k = charaNow();
  line = String(line || '');
  if(!k.tic || !line) return line;
  var m = line.match(/(…|！|!|。|？|\?)$/);
  var end = m ? m[1] : '';
  return line.slice(0, line.length - end.length) + ' ' + k.tic + (end === '。' ? '' : (end || '！'));
}
function chPick(a){ return a[Math.floor(Math.random() * a.length)]; }
var CHARA_FES_LINE = {
  xmas:'メリークリスマス！', newyear:'あけましておめでとう！', halloween:'トリックオアトリート！', tanabata:'ねがいごと、なににする？',
  tsukimi:'お月見だんご、食べたいな', valentine:'チョコ、だれにあげる？', setsubun:'鬼は外〜！', hinamatsuri:'ひなまつりだね',
  kodomo:'こどもの日だね。こいのぼり見た？', natsu:'夏だね！水分とってね', sakura:'お花見日和かも', tsuyu:'雨の季節だね。足もと気をつけてね',
  kouyou:'紅葉がきれいな季節だね', holiday:'今日は祝日だね'
};
function charaLine(kind){
  var h = new Date().getHours(), td = today(), out = [], k = charaNow();
  var dow = new Date().getDay();
  /* 大事なことから */
  var dueToday = S.tasks.filter(function(t){ return !t.done && t.due === td; }).length;
  var dueTomo = S.tasks.filter(function(t){ return !t.done && t.due === shiftDate(td, 1); }).length;
  var late = S.tasks.filter(function(t){ return !t.done && isYmd(t.due) && t.due < td; }).length;
  var test = S.exams.filter(function(x){ return isYmd(x.date) && x.date >= td && daysFromToday(x.date) <= 3; })
    .sort(function(a, b){ return a.date.localeCompare(b.date); })[0];
  var risk = (typeof absenceRisks === 'function') ? absenceRisks()[0] : null;
  var rain = (typeof umbrellaInfo === 'function') ? umbrellaInfo() : null;
  var b = (typeof budget === 'function') ? budget() : null;
  if(late) out.push('しめきりをすぎた課題が' + late + 'こあるよ。いっしょに片づけよ');
  if(dueToday) out.push('今日しめきりの課題が' + dueToday + 'こあるよ！');
  if(test){ var n = daysFromToday(test.date); out.push((test.subject ? shortName(test.subject) + 'の' : '') + 'テスト、' + (n === 0 ? '今日だね。ファイト！' : 'あと' + n + '日だよ')); }
  if(risk) out.push(shortName(risk.name) + '、' + (risk.rest <= 0 ? 'もう休めないよ…' : 'あと1回休むとあぶないよ'));
  if(rain && rain.need) out.push('雨がふりそう。傘わすれないでね');
  if(b && b.level === 'bad') out.push('今月のお金、ちょっとピンチかも…');
  if(dueTomo && h >= 17) out.push('明日しめきりが' + dueTomo + 'こあるよ');
  if(kind === 'important') return out.length ? chTic(out[0]) : '';
  /* あいさつ */
  var greet = h < 5 ? ['夜ふかしさん、そろそろ寝よ…', 'ねむくない？むりしないでね']
            : h < 10 ? ['おはよう！今日もいっしょにがんばろ', 'おはよう。朝ごはん食べた？', 'おはよ〜。顔あらった？']
            : h < 14 ? ['こんにちは！ひとやすみしてる？', 'おひるごはん、なにたべた？']
            : h < 18 ? ['午後もあとすこし！', 'おやつの時間かも？', 'ちょっと甘いものほしくなるね']
            : h < 22 ? ['おつかれさま〜', '今日もえらかったね', 'お風呂でゆっくりしてね']
            : ['今日もおつかれさま。ゆっくり休んでね', 'あしたの準備、できた？'];
  var fes = (typeof festivalNow === 'function') ? festivalNow() : '';
  if(fes && CHARA_FES_LINE[fes]) greet.push(CHARA_FES_LINE[fes]);
  if(dow === 1 && h < 14) greet.push('あたらしい1週間。ゆっくりいこ');
  if(dow === 5) greet.push('あと1日で週末だよ！');
  if(dow === 0 || dow === 6) greet.push('おやすみの日、なにする？');
  var cls = (typeof schoolClassesForDate === 'function') ? schoolClassesForDate(td) : [];
  if(cls.length && h < 12) greet.push('今日は' + cls.length + 'コマだね。いってらっしゃい');
  if(cls.length && h >= 17) greet.push('授業おつかれさま！');
  var soft = ['水のんだ？', 'ちょっと休けいしよ', 'がんばりすぎないでね', 'できたことを数えてみよ', 'ぐーっとのびをしよ',
              '看護の勉強、えらいね', 'しっかり寝るのも大事なおしごとだよ', '深呼吸しよ。すー、はー', 'きょうもそばにいるよ'];
  if(k.like) soft.push(k.like + 'のこと考えてた', 'きょうは' + k.like + 'の気分');
  var m = Number(td.slice(5, 7));
  soft.push(m >= 3 && m <= 5 ? 'ぽかぽかしてきたね' : m >= 6 && m <= 8 ? 'あついね、日かげで休もう' : m >= 9 && m <= 11 ? '食欲の秋だね' : 'さむいね、あったかくしてね');
  if(test){ soft.push('テスト勉強、ちょっとずつね'); }
  if(b && b.level !== 'bad') soft.push('今月のお金、いい感じ！');
  var allDone = S.tasks.length && !S.tasks.some(function(t){ return !t.done; });
  if(allDone) out.push('やることぜんぶ終わってる！すごい！');
  if(kind === 'greet'){
    if(out.length && Math.random() < .6) return chTic(out[0]);
    if(typeof charaPoolLine === 'function' && Math.random() < .75) return charaPoolLine(k.id, 'greet');
    return chTic(chPick(greet));
  }
  if(typeof charaPoolLine === 'function' && !(out.length && Math.random() < .3)) return charaPoolLine(k.id, 'any');
  return chTic(chPick(out.concat(greet, soft)));
}
/* 操作に反応する（いっぱい以上） */
var CHARA_REACT = {
  'ev-save':['予定をしまったよ', 'happy'], 'memo-save':['メモしたよ', 'happy'], 'note-save':['メモしたよ', 'happy'],
  'paid':['お金の記録、えらい！', 'proud'], 'add-task':['課題を入れたよ。いっしょにがんばろ', 'cheer'],
  'add-exam':['テスト、応援してるよ！', 'cheer'], 'att-set':['出欠の記録、ばっちり', 'wink'],
  'add-income':['お金の記録、えらい！', 'sparkle'], 'add-fixed':['メモしておいたよ', 'happy'], 'save-stmt':['明細をしまったよ', 'happy'],
  'grade-save':['成績、記録したよ', 'proud'], 'add-plan':['予定のお金、入れたよ', 'happy'], 'add-bal':['残高をしまったよ', 'happy']
};
function charaReact(act){
  var r = CHARA_REACT[act];
  if(!r || charaLevel() < 4) return;
  charaCheer(r[0], r[1], { short:1 });
}
/* ============================== 出てくる場所 ============================== */
/* 今日の画面のあいさつ */
var __heroLine = { day:'', text:'' };
function charaHero(){
  var lv = charaLevel();
  if(lv < 1) return '';
  var td = today(), me = charaNow();
  if(__heroLine.day !== td + me.id){ __heroLine = { day:td + me.id, text:charaLine('greet') }; }
  var text = charaLine('important') || __heroLine.text;
  var prop = /雨/.test(text) ? 'umbrella' : /テスト|課題|勉強/.test(text) ? 'book' : /お金/.test(text) ? 'coin'
           : /すごい|えらかった/.test(text) ? 'trophy' : /寝よ|休んで/.test(text) ? 'moon' : /お風呂|ひとやすみ|休けい/.test(text) ? 'cup'
           : /お月見/.test(text) ? 'moon' : /さむい|雪/.test(text) ? 'snow' : /おやつ|甘い/.test(text) ? 'cake' : '';
  var expr = /ピンチ|あぶない|休めない|すぎた/.test(text) ? 'sweat' : /ファイト|がんばろ|いってらっしゃい/.test(text) ? 'cheer'
           : /すごい|おめでとう|クリスマス|トリック/.test(text) ? 'sparkle' : /寝よ|ねむく/.test(text) ? 'sleep'
           : /えらかった|えらいね/.test(text) ? 'love' : /おつかれ/.test(text) ? 'happy' : 'normal';
  var pals = (lv >= 5) ? charaPals(2).map(function(id, i){
    return charaSvg({ id:id, size:44, expr:(i ? 'wink' : 'happy'), anim:'float', still:true });
  }).join('') : '';
  return '<div class="chhero'+(pals ? ' withpals' : '')+'" data-act="chara-talk" role="button" aria-label="'+esc(me.name)+'と話す">'+
    '<div class="chbubble">'+esc(text)+'</div>'+
    (pals ? '<span class="chpals">'+pals+'</span>' : '')+
    charaSvg({ size:72, expr:expr, prop:prop, anim:'bounce' })+'</div>';
}
/* 何もない画面 */
function charaEmpty(){ return charaSvg({ size:64, expr:'sleep', anim:'sway', still:true }); }
/* 小さな顔（トーストや相談のアイコン） */
function charaFace(expr, size){ return charaSvg({ size:size || 24, expr:expr || 'normal', still:true }); }
/* 見出しの横の小さな子（いっぱい以上） */
function charaMini(expr){
  if(charaLevel() < 4) return '';
  return '<span class="chmini" aria-hidden="true">'+charaSvg({ size:22, expr:expr || 'happy', still:true })+'</span>';
}
/* お祝い・反応 */
var __cheerTimer = null;
function charaCheer(text, expr, opt){
  if(charaLevel() < 2) return;
  opt = opt || {};
  var box = document.getElementById('chpop');
  if(!box){ box = document.createElement('div'); box.id = 'chpop'; box.setAttribute('aria-hidden', 'true'); document.body.appendChild(box); }
  box.innerHTML = '<div class="chbubble">'+esc(chTic(text || 'おつかれさま！'))+'</div>'+
    charaSvg({ size:opt.short ? 70 : 96, expr:expr || 'cheer', prop:opt.short ? '' : 'star', anim:'jump', still:true });
  if(typeof photoFill === 'function') photoFill();
  box.className = opt.short ? 'short' : '';
  void box.offsetWidth; box.classList.add('on');
  clearTimeout(__cheerTimer);
  __cheerTimer = setTimeout(function(){ box.classList.remove('on'); }, opt.short ? 1500 : 1900);
}
/* いつも画面のすみにいる子（たっぷり以上） */
var __buddy = { shownDay:'', bubble:false, taps:0, tapAt:0 };
function charaBuddySig(){ return charaNow().id + '|' + charaHatNow() + '|' + charaTouch(); }
function charaBuddy(){
  var el = document.getElementById('buddy');
  var on = charaLevel() >= 3 && appId !== 'chat';
  if(!on){ if(el) el.remove(); return; }
  if(!el){
    el = document.createElement('button');
    el.id = 'buddy'; el.type = 'button';
    el.addEventListener('click', function(){
      var now = Date.now();
      __buddy.taps = (now - __buddy.tapAt < 1500) ? __buddy.taps + 1 : 1;
      __buddy.tapAt = now;
      if(__buddy.taps >= 3){ __buddy.bubble = true; charaBuddyDraw(chTic('なでなで、うれしい！'), 'love'); return; }
      __buddy.bubble = !__buddy.bubble;
      charaBuddyDraw(__buddy.bubble ? charaLine('any') : '');
    });
    document.body.appendChild(el);
  }
  el.setAttribute('aria-label', charaNow().name + 'と話す');
  var td = today();
  if(__buddy.shownDay !== td){
    __buddy.shownDay = td; __buddy.bubble = true;
    charaBuddyDraw(charaLine('greet'));
    setTimeout(function(){ if(__buddy.bubble){ __buddy.bubble = false; charaBuddyDraw(''); } }, 5000);
  }else if(!el.innerHTML || el.dataset.cid !== charaBuddySig()){
    charaBuddyDraw(__buddy.bubble ? charaLine('any') : '');
  }
  if(charaLevel() >= 5) charaWanderStart();
}
function charaBuddyDraw(text, expr){
  var el = document.getElementById('buddy'); if(!el) return;
  el.dataset.cid = charaBuddySig();
  el.innerHTML = (text ? '<span class="chbubble">'+esc(text)+'</span>' : '') +
    charaSvg({ size:58, expr:expr || (text ? 'happy' : 'normal'), anim:'float' });
  if(typeof photoFill === 'function') photoFill();
}
/* ときどき画面の下を歩く（めいっぱい） */
var __wander = null;
function charaWanderStart(){
  if(__wander) return;
  __wander = setInterval(charaWalk, 75000);
  setTimeout(charaWalk, 5000);
}
function charaWalk(){
  if(charaLevel() < 5 || document.hidden || appId === 'chat') return;
  if(typeof isTyping === 'function' && isTyping()) return;
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(document.getElementById('chwalk')) return;
  var id = chPick(charaPals(3).concat([charaNow().id]));
  var el = document.createElement('div');
  el.id = 'chwalk'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = charaSvg({ id:id, size:44, expr:chPick(['happy', 'normal', 'wink', 'eat', 'sparkle']), anim:'walk', still:true });
  el.addEventListener('animationend', function(ev){ if(ev.target === el) el.remove(); });
  document.body.appendChild(el);
  if(typeof photoFill === 'function') photoFill();
  setTimeout(function(){ if(el.parentNode) el.remove(); }, 13000);
}
/* キャラの口調で相談に答える（たっぷり以上、または設定でオン） */
function charaTalkRule(){
  var c = charaCfg();
  if(c.level < 1 || !(c.talk || c.level >= 3)) return '';
  var k = charaNow();
  return '\n【話し方】あなたは、このアプリのキャラクター「' + k.name + '」（' + k.desc + '）として話す。' +
    'やさしく、短めに、かわいらしく。' + (k.tic ? '文の終わりに、ときどき「' + k.tic + '」をつける（毎回ではない）。' : '') +
    (k.like ? '好きなものは「' + k.like + '」。' : '') +
    'ただし、お金・健康・締切などの大事な中身は正確に伝える。';
}

/* ============================== 設定画面 ============================== */
var charaCatNow = 'all';
function charaPill(act, v, on, label){
  return '<button data-act="'+act+'" data-v="'+esc(String(v))+'" class="'+(on ? 'on' : '')+'">'+label+'</button>';
}
function charaSettings(){
  var c = charaCfg(), now = charaNow();
  var h = '<label class="f">出てくる量（充実度）</label><div class="pillrow">'+
    CHARA_LEVELS.map(function(o){ return charaPill('chara-level', o[0], c.level === o[0], o[1]); }).join('')+'</div>'+
    '<p class="note" style="margin:-4px 0 10px">'+CHARA_LEVEL_NOTE[c.level]+'</p>';
  if(c.level > 0){
    h += '<label class="f">出し方</label><div class="pillrow">'+
      [['one','いつも同じ子'],['daily','日替わり'],['random','開くたびにランダム']].map(function(o){ return charaPill('chara-mode', o[0], c.mode === o[0], o[1]); }).join('')+'</div>'+
      '<label class="f">絵のタッチ</label><div class="pillrow">'+
      CHARA_TOUCHES.map(function(o){ return charaPill('chara-touch', o[0], c.touch === o[0], o[1]); }).join('')+'</div>';

    /* キャラクターを選ぶ */
    var total = CHARAS.length + c.custom.length;
    if(!CHARA_CATS.some(function(x){ return x[0] === charaCatNow; })) charaCatNow = 'all';
    var list = (charaCatNow === 'all') ? charaAllIds()
             : (charaCatNow === 'mine') ? c.custom.map(function(x){ return x.id; })
             : CHARAS.filter(function(x){ return x.cat === charaCatNow; }).map(function(x){ return x.id; });
    h += '<label class="f">キャラクター（'+total+'ひき）</label>'+
      '<p class="note" style="margin:-2px 0 6px">'+(c.mode === 'one' ? 'タップした子になります。' : 'チェックした子の中から出ます（いま'+c.friends.length+'ひき）。')+'</p>'+
      '<div class="pillrow chcats">'+CHARA_CATS.map(function(o){ return charaPill('chara-cat', o[0], charaCatNow === o[0], o[1]); }).join('')+'</div>';
    if(list.length){
      h += '<div class="chgrid">'+list.map(function(id){
        var k = charaById(id);
        var sel = (c.mode === 'one') ? (c.main === id) : (c.friends.indexOf(id) >= 0);
        return '<button data-act="chara-pick" data-id="'+esc(id)+'" class="'+(sel ? 'on' : '')+'" aria-pressed="'+(sel ? 'true' : 'false')+'">'+
          (c.mode !== 'one' ? '<span class="chk2">'+(sel ? '✓' : '')+'</span>' : '')+
          charaSvg({ id:id, size:56, expr:sel ? 'happy' : 'normal', still:true })+
          '<span class="chname">'+esc(k.name)+'</span><span class="chdesc">'+esc(k.desc)+'</span></button>';
      }).join('')+'</div>';
    }else{
      h += '<div class="empty" style="padding:10px 0">まだいません。下の「自分の画像から作る」で作れます。</div>';
    }
    h += '<div class="pillrow" style="margin-top:8px"><button data-act="chara-make">＋ 自分の画像から作る</button></div>';
    if(charaCatNow === 'mine' && c.custom.length){
      h += c.custom.map(function(u){
        return '<div class="row"><span class="chrowimg">'+charaSvg({ id:u.id, size:36, still:true })+'</span>'+
          '<div class="grow"><div class="t">'+esc(u.name || '自分の子')+'</div><div class="s">'+esc(u.tic ? '口ぐせ「'+u.tic+'」' : '口ぐせなし')+'</div></div>'+
          '<button class="mini" data-act="chara-edit" data-id="'+esc(u.id)+'">なおす</button>'+
          '<button class="mini" data-act="chara-del" data-id="'+esc(u.id)+'">消す</button></div>';
      }).join('');
    }
    h += '<p class="note" style="margin-top:4px">自分で描いた絵や写真を、切りぬいてキャラにできます。画像はこの手帳の中（と同期先）だけに入り、GitHubには置かれません。</p>';

    /* 着せかえ */
    var fr = charaFriend();
    h += '<label class="f" style="margin-top:12px">着せかえ</label>'+
      '<div class="chfriend"><span class="hearts">'+[1,2,3,4,5].map(function(i){ return '<i class="'+(fr.lv >= i ? 'on' : '')+'">♥</i>'; }).join('')+'</span>'+
      '<span>なかよし度 Lv'+fr.lv+'（'+fr.pts+'pt）'+(fr.next ? '・つぎまで '+fr.next+'pt' : '・さいこう！')+'</span></div>'+
      '<p class="note" style="margin:0 0 6px">課題を終える・今日の評価をもらう・予定やメモを入れると、なかよし度が上がって着せかえが増えます。</p>'+
      '<div class="hatgrid">'+
      [{ id:'auto', name:'季節におまかせ' }, { id:'none', name:'なし' }].concat(CHARA_HATS).map(function(x){
        var ok = (x.id === 'auto' || x.id === 'none') ? true : charaHatOk(x.id);
        var preview = (x.id === 'auto') ? charaHatAuto() : (x.id === 'none' ? '' : x.id);
        return '<button data-act="chara-hat" data-v="'+x.id+'" class="'+(c.hat === x.id ? 'on' : '')+(ok ? '' : ' locked')+'"'+(ok ? '' : ' aria-disabled="true"')+'>'+
          charaSvg({ id:now.id, size:44, hat:preview, still:true })+
          '<span class="hn">'+esc(x.name)+'</span>'+(ok ? '' : '<span class="lock">🔒 Lv'+x.lv+'</span>')+'</button>';
      }).join('')+'</div>'+
      (c.hat === 'auto' && c.level < 4 ? '<p class="note" style="margin-top:4px">「季節におまかせ」は、出てくる量が「いっぱい」以上のときに着がえます。</p>' : '');

    /* 表情 */
    h += '<label class="f" style="margin-top:12px">いまの子：'+esc(now.name)+'（表情'+CHARA_EXPRS.length+'しゅるい）</label>'+
      '<div class="chexpr">'+CHARA_EXPRS.map(function(e){
        return '<span class="chex" title="'+esc(e[1])+'">'+charaSvg({ id:now.id, size:42, expr:e[0], still:true })+'<em>'+esc(e[1])+'</em></span>';
      }).join('')+'</div>'+
      '<div class="pillrow" style="margin-top:8px">'+
        (typeof charaDayPool === 'function' ? '</div><p class="note">今日の'+esc(now.name)+'のセリフ：<b>'+charaDayPool(now.id).total+'種類</b>'+(charaDayPool(now.id).ai ? '（AIが考えたセリフ入り）' : '')+'</p><div class="pillrow">'+
          '<button data-act="chara-aitalk" class="'+(charaTalkAiOn() ? 'on' : '')+'">'+(charaTalkAiOn() ? 'AIが毎日セリフを考える（1日1〜3回）' : 'AIのセリフは使わない')+'</button></div><div class="pillrow">' : '')+
        '<button data-act="chara-talk">話しかけてみる</button>'+
        '<button data-act="chara-talkai" class="'+(c.talk || c.level >= 3 ? 'on' : '')+'">'+(c.level >= 3 ? '相談もこの子の口調（たっぷり以上では常にオン）' : '相談もこの子の口調で')+'</button>'+
      '</div>';
  }
  h += '<p class="note">用意した子は、どれもこのアプリのために作ったオリジナルのキャラクターです。</p>';
  return h;
}
function charaSet(patch){
  S.ui.chara = Object.assign({}, S.ui.chara || {}, patch);
  touch('ui');
}
function charaAction(act, t){
  if(act === 'chara-level'){ charaSet({ level:toNum(t.dataset.v) }); commit(); return true; }
  if(act === 'chara-mode'){ charaSet({ mode:t.dataset.v }); __charaRandom = null; commit(); return true; }
  if(act === 'chara-touch'){ charaSet({ touch:t.dataset.v }); commit(); return true; }
  if(act === 'chara-cat'){ charaCatNow = t.dataset.v; render(); return true; }
  if(act === 'chara-hat'){
    var v = t.dataset.v;
    if(v !== 'auto' && v !== 'none' && !charaHatOk(v)){
      var hi = charaHatInfo(v);
      toast('なかよし度Lv' + (hi ? hi.lv : '') + 'になると使えます', true); return true;
    }
    charaSet({ hat:v }); commit(); return true;
  }
  if(act === 'chara-pick'){
    var c = charaCfg(), id = t.dataset.id;
    if(c.mode === 'one'){ charaSet({ main:id }); toast(charaById(id).name + 'にしました'); }
    else{
      var f = c.friends.slice(), i = f.indexOf(id);
      if(i >= 0){ if(f.length <= 1){ toast('1ぴきは選んでください', true); return true; } f.splice(i, 1); }
      else f.push(id);
      charaSet({ friends:f });
    }
    commit(); return true;
  }
  if(act === 'chara-talk'){
    var line = charaLine('any');
    charaCheer(line, chPick(['happy', 'wink', 'love', 'sparkle', 'proud', 'shy']));
    if(charaLevel() < 2) toast(line);
    return true;
  }
  if(act === 'chara-talkai'){ charaSet({ talk: charaCfg().talk ? 0 : 1 }); commit(); return true; }
  if(act === 'chara-aitalk'){ charaSet({ aiTalk: charaTalkAiOn() ? 0 : 1 }); commit(); if(charaTalkAiOn()) charaTalkAiToday(); return true; }
  if(act === 'chara-make'){ if(typeof charaMakeOpen === 'function') charaMakeOpen(''); return true; }
  if(act === 'chara-edit'){ if(typeof charaMakeOpen === 'function') charaMakeOpen(t.dataset.id); return true; }
  if(act === 'chara-del'){ if(typeof charaMakeDelete === 'function') charaMakeDelete(t.dataset.id); return true; }
  return false;
}

/* 何もない画面の絵を、キャラクターにする（なしのときは前の絵） */
(function(){
  if(typeof ART === 'undefined') return;
  var base = ART.empty;
  try{
    Object.defineProperty(ART, 'empty', {
      configurable:true, enumerable:true,
      get:function(){ return charaLevel() >= 1 ? charaEmpty() : base; }
    });
  }catch(e){}
})();
