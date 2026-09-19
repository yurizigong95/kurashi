/* くらしの手帳：暗記カード（国試・テスト対策の一問一答） */
/* ============================== データ ==============================
   S.cards = [{ id, deck, q, a, src, due, ivl, ease, reps, lapses, last, first, mt }]
     ・deck … 科目名（授業の名前）か、自分で決めた名前
     ・due  … 次に出す日。ivl … 次までの日数。ease … 覚えやすさ（1.3〜3）。first … はじめて見た日
   S.studyLog = { 'YYYY-MM-DD|端末ID': { n, ok, mt } }
     ・その日に見た枚数。端末ごとに分けておき、2台で同時に勉強しても同期で消えないようにする */
var ANKI_NEW_PER_DAY = 20;          /* 1日に出す新しいカードの数 */
var ANKI_MAX_MAKE = 30;             /* AIが1回に作るカードの数 */
var ANKI_GRADES = [[0, 'もう一回', 'again'], [1, 'あやしい', 'hard'], [2, 'おぼえた', 'good'], [3, 'かんたん', 'easy']];
var ankiState = { mode:'', deck:'', queue:[], cur:'', show:false, done:0, ok:0, preview:null, busy:false, listDeck:'' };

function ankiCards(){ return Array.isArray(S.cards) ? S.cards : []; }
function ankiIsNew(c){ return !c.last; }
function ankiIsDue(c, ymd){ return !ankiIsNew(c) && String(c.due || '') <= (ymd || today()); }
function ankiNewToday(){ var td = today(); return ankiCards().filter(function(c){ return c.first === td; }).length; }
/* 今日出すカード（復習が先、新しいカードはあとで1日の数まで） */
function ankiDueList(deck, ymd){
  var list = ankiCards().filter(function(c){ return !deck || c.deck === deck; });
  var due = list.filter(function(c){ return ankiIsDue(c, ymd); })
    .sort(function(a, b){ return String(a.due).localeCompare(String(b.due)) || (toNum(a.mt) - toNum(b.mt)); });
  var room = Math.max(0, ANKI_NEW_PER_DAY - ankiNewToday());
  var fresh = list.filter(ankiIsNew).sort(function(a, b){ return toNum(a.mt) - toNum(b.mt); }).slice(0, room);
  return due.concat(fresh);
}
/* 科目ごとのまとまり */
function ankiDecks(){
  var m = {}, order = [];
  ankiCards().forEach(function(c){
    var d = c.deck || 'そのほか';
    if(!m[d]){ m[d] = { name:d, n:0, due:0, fresh:0 }; order.push(d); }
    m[d].n++;
    if(ankiIsNew(c)) m[d].fresh++;
    else if(ankiIsDue(c)) m[d].due++;
  });
  return order.sort().map(function(k){ return m[k]; });
}
/* 答えに合わせて、次に出す日を決める（SM-2 をやさしくしたもの） */
function ankiNext(c, g, ymd){
  ymd = ymd || today();
  var ease = Number(c.ease) || 2.5, ivl = toNum(c.ivl), reps = toNum(c.reps), lapses = toNum(c.lapses);
  if(g === 0){
    if(reps) lapses++;
    reps = 0; ivl = 0; ease = Math.max(1.3, ease - 0.2);
  }else if(!reps){
    ivl = g === 3 ? 3 : 1;
    if(g === 3) ease = Math.min(3, ease + 0.15);
    reps = 1;
  }else if(g === 1){
    ivl = Math.max(1, Math.round(ivl * 1.2)); ease = Math.max(1.3, ease - 0.15); reps++;
  }else if(g === 2){
    ivl = Math.max(ivl + 1, Math.round(ivl * ease)); reps++;
  }else{
    ivl = Math.max(ivl + 2, Math.round(ivl * ease * 1.3)); ease = Math.min(3, ease + 0.15); reps++;
  }
  ivl = Math.min(ivl, 365);
  return { ivl:ivl, ease:Math.round(ease * 100) / 100, reps:reps, lapses:lapses, due:shiftDate(ymd, ivl), last:ymd, first:c.first || ymd };
}

/* ===== 勉強の記録 ===== */
function ankiLog(ok){
  S.studyLog = (S.studyLog && typeof S.studyLog === 'object') ? S.studyLog : {};
  var k = today() + '|' + DEV.id;
  var o = Object.assign({ n:0, ok:0 }, S.studyLog[k]);
  o.n++; if(ok) o.ok++;
  o.mt = Date.now();
  S.studyLog[k] = o;
  touch('studyLog');
}
function ankiCountOn(ymd){
  var log = S.studyLog || {}, n = 0;
  Object.keys(log).forEach(function(k){ if(k.slice(0, 10) === ymd) n += toNum(log[k] && log[k].n); });
  return n;
}
function ankiStreak(){
  var d = today(), n = 0;
  if(!ankiCountOn(d)) d = shiftDate(d, -1);         /* 今日まだでも、きのうまで続いていれば数える */
  while(ankiCountOn(d) > 0 && n < 400){ n++; d = shiftDate(d, -1); }
  return n;
}

/* ===== AIでカードを作る ===== */
function ankiPrompt(max){
  var names = termCourses().map(function(c){ return c.name; });
  return 'あなたは看護学生の定期試験・看護師国家試験の対策を手伝う先生です。\n' +
    '渡した資料から、大事なことを一問一答の暗記カードにしてください。\n' +
    '・1枚に1つのことだけ。問いは短く、答えは1〜2行で。\n' +
    '・定義・正常値や基準値・観察のポイント・禁忌・根拠など、テストに出やすいものを優先する。\n' +
    '・資料に書いていないことは作らない。手書きで読めないところは、むりに作らない。\n' +
    '・患者さんの名前など、個人を特定できる情報はカードに入れない。\n' +
    '・多くても' + max + '枚まで。\n' +
    '・科目（deck）は、次の中からいちばん近いものを選ぶ。当てはまらなければ空文字：' + (names.join('／') || 'なし') + '\n' +
    'JSONだけで答える：{"deck":"科目名","cards":[{"q":"問い","a":"答え"}]}';
}
/* files … dataURL（写真・PDF）の一覧、text … 貼りつけた文章 */
async function ankiAiMake(files, text, max){
  max = max || ANKI_MAX_MAKE;
  var parts = [];
  (files || []).forEach(function(u){
    var m = String(u).match(/^data:([^;]+);base64,(.*)$/);
    if(m) parts.push({ inline_data:{ mime_type:m[1], data:m[2] } });
  });
  parts.push({ text:ankiPrompt(max) + (text ? '\n\n資料：\n' + String(text).slice(0, 30000) : '') });
  var out = await aiGenerate({ contents:[{ role:'user', parts:parts }], json:true, temperature:0.2, maxTokens:8192, tag:'anki' });
  var j = parseJsonLoose(out) || {};
  var seen = {};
  var cards = (Array.isArray(j.cards) ? j.cards : []).map(function(c){
    return { q:String(c && c.q || '').trim().slice(0, 300), a:String(c && c.a || '').trim().slice(0, 500), on:1 };
  }).filter(function(c){
    if(!c.q || !c.a || seen[c.q]) return false;
    seen[c.q] = 1; return true;
  }).slice(0, max);
  var deck = String(j.deck || '').trim();
  if(deck && typeof subjectMatch === 'function') deck = subjectMatch(deck);
  return { deck:deck, cards:cards };
}
/* できたカードをまとめて入れる */
function ankiAddMany(deck, list, src){
  S.cards = ankiCards();
  var now = Date.now(), n = 0;
  (list || []).forEach(function(c, i){
    if(!c || !c.q || !c.a) return;
    if(S.cards.some(function(x){ return x.deck === deck && x.q === c.q; })) return;
    S.cards.push({ id:uid('cd'), deck:deck || 'そのほか', q:String(c.q).slice(0, 300), a:String(c.a).slice(0, 500),
                   src:src || 'hand', due:'', ivl:0, ease:2.5, reps:0, lapses:0, last:'', first:'', mt:now + i });
    n++;
  });
  return n;
}
/* ファイルを選んで読む（写真は小さくする） */
function ankiPickFiles(){
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*,.pdf,application/pdf'; inp.multiple = true;
  inp.onchange = async function(){
    var files = Array.prototype.slice.call(inp.files || [], 0, 4);
    if(!files.length) return;
    try{
      var urls = [];
      for(var i = 0; i < files.length; i++){
        var f = files[i];
        if(/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)){
          if(f.size > 15 * 1024 * 1024) throw new Error('PDFは15MBまでです（' + f.name + '）');
          urls.push(await new Promise(function(res, rej){ var r = new FileReader(); r.onload = function(){ res(r.result); }; r.onerror = function(){ rej(new Error('読めませんでした')); }; r.readAsDataURL(f); }));
        }else{
          urls.push(await resizeImage(f, 1800, 0.82));
        }
      }
      ankiMakeFrom(urls, '');
    }catch(e){ toast(e.message, true); }
  };
  inp.click();
}
async function ankiMakeFrom(files, text){
  if(!aiReady()){ toast('先に設定タブでAI（Gemini）のキーを登録してください', true); return; }
  if(ankiState.busy) return;
  ankiState.busy = true; ankiState.preview = null; render();
  try{
    var r = await ankiAiMake(files, text);
    if(!r.cards.length) throw new Error('カードにできることが見つかりませんでした');
    ankiState.preview = r;
    toast(r.cards.length + '枚できました。見てから追加してください');
  }catch(e){
    toast('作れませんでした：' + e.message, true);
  }finally{
    ankiState.busy = false;
    if(isTyping()) renderLater(); else render();
  }
}

/* ===== 勉強する ===== */
/* 1枚ごとには同期しない（テンポよく進めても「書きこみすぎ防止」で止まらないよう、20秒ごと・終わったときにまとめて送る） */
var ankiPushTimer = null;
function ankiPushSoon(){
  clearTimeout(ankiPushTimer);
  ankiPushTimer = setTimeout(function(){ ankiPushTimer = null; pushRemote(); }, 20000);
}
function ankiPushNow(){ clearTimeout(ankiPushTimer); ankiPushTimer = null; commit(); }
function ankiStart(deck){
  var list = ankiDueList(deck || '');
  if(!list.length){ toast('今日の分は終わっています'); return; }
  ankiState.mode = 'study'; ankiState.deck = deck || '';
  ankiState.queue = list.map(function(c){ return c.id; });
  ankiState.cur = ankiState.queue.shift();
  ankiState.show = false; ankiState.done = 0; ankiState.ok = 0;
  render(); window.scrollTo(0, 0);
}
function ankiGrade(g){
  var c = ankiCards().filter(function(x){ return x.id === ankiState.cur; })[0];
  if(!c){ ankiState.cur = ankiState.queue.shift() || ''; render(); return; }
  Object.assign(c, ankiNext(c, g), { mt:Date.now() });
  ankiLog(g >= 2);
  ankiState.done++;
  if(g >= 2) ankiState.ok++;
  if(g === 0) ankiState.queue.push(c.id);            /* できなかったカードは、最後にもう一回 */
  ankiState.cur = ankiState.queue.shift() || '';
  ankiState.show = false;
  if(!ankiState.cur){
    ankiState.mode = 'done';
    if(typeof petStudyReward === 'function') petStudyReward(ankiState.done);
    ankiPushNow();
    return;
  }
  persist(); ankiPushSoon(); render();
}

/* ============================== 画面 ============================== */
function viewAnki(){
  if(ankiState.mode === 'study') return ankiStudyView();
  var h = '';
  if(ankiState.mode === 'done'){
    h += section('おつかれさま！', null,
      '<div class="ankidone"><div class="big">🎉</div><p><b>' + ankiState.done + '枚</b>見ました（おぼえた ' + ankiState.ok + '枚）。</p>' +
      '<p class="note">連続 <b>' + ankiStreak() + '日</b>。おせわの子にごほうびのコインが入りました。</p>' +
      '<button class="btn ghost" data-act="anki-home">もどる</button></div>');
  }
  var all = ankiCards(), due = ankiDueList(''), td = ankiCountOn(today());
  var nDue = due.filter(function(c){ return !ankiIsNew(c); }).length, nNew = due.length - nDue;
  h += section('今日の暗記', null,
    '<div class="grid3 keep3">' +
      '<div class="stat"><div class="s">復習</div><div class="v num">' + nDue + '</div></div>' +
      '<div class="stat"><div class="s">新しい</div><div class="v num">' + nNew + '</div></div>' +
      '<div class="stat"><div class="s">今日やった</div><div class="v num">' + td + '</div></div></div>' +
    '<div class="row"><div class="grow s">連続で勉強した日</div><div class="t num">' + ankiStreak() + '日</div></div>' +
    (all.length
      ? (due.length ? '<button class="btn" data-act="anki-start">はじめる（' + due.length + '枚）</button>'
                    : '<p class="note">今日の分はおわり！ 🎉 また明日。</p>')
      : '<p class="note">まだカードがありません。下の「カードを作る」から、講義資料の写真やPDFを読みこむと、AIが一問一答を作ります。</p>'));
  var decks = ankiDecks();
  if(decks.length){
    h += section('科目ごと', decks.length + '科目・' + all.length + '枚', decks.map(function(d){
      var n = ankiDueList(d.name).length;
      return '<div class="row"><div class="grow"><div class="t">' + esc(typeof shortName === 'function' ? shortName(d.name) : d.name) + '</div>' +
        '<div class="s">' + d.n + '枚・復習 ' + d.due + '・新しい ' + d.fresh + '</div></div>' +
        (n ? '<button class="mini" data-act="anki-start" data-deck="' + esc(d.name) + '">' + n + '枚やる</button>' : '') +
        '<button class="mini" data-act="anki-list" data-deck="' + esc(d.name) + '">一覧</button></div>';
    }).join(''));
  }
  if(ankiState.mode === 'list' && ankiState.listDeck) h += ankiListView(ankiState.listDeck);
  h += ankiMakeView();
  return h;
}
function ankiStudyView(){
  var c = ankiCards().filter(function(x){ return x.id === ankiState.cur; })[0];
  if(!c){ ankiState.mode = ''; return viewAnki(); }
  var left = ankiState.queue.length + 1;
  var h = '<section><div class="head"><h2>' + esc(ankiState.deck ? (typeof shortName === 'function' ? shortName(ankiState.deck) : ankiState.deck) : '今日の暗記') + '</h2>' +
    '<span>のこり ' + left + '枚</span></div>' +
    '<div class="box ankicard' + (ankiState.show ? ' open' : '') + '">' +
      '<div class="ankideck s2">' + esc(c.deck || '') + (ankiIsNew(c) ? '・<b>新しい</b>' : '') + '</div>' +
      '<div class="ankiq">' + esc(c.q) + '</div>' +
      (ankiState.show
        ? '<div class="ankia">' + esc(c.a) + '</div>' +
          '<div class="ankigrades">' + ANKI_GRADES.map(function(g){
            var nx = ankiNext(c, g[0]);
            return '<button data-act="anki-grade" data-v="' + g[0] + '" class="g-' + g[2] + '"><b>' + g[1] + '</b>' +
              '<span class="s">' + (g[0] === 0 ? 'このあと' : nx.ivl + '日後') + '</span></button>';
          }).join('') + '</div>'
        : '<button class="btn" data-act="anki-show">こたえを見る</button>') +
    '</div></section>' +
    '<div class="pillrow"><button data-act="anki-quit">やめる</button></div>';
  return h;
}
function ankiListView(deck){
  var list = ankiCards().filter(function(c){ return c.deck === deck; });
  return section('「' + (typeof shortName === 'function' ? shortName(deck) : deck) + '」のカード', list.length + '枚',
    (list.length ? list.map(function(c){
      return '<div class="row ankirow"><div class="grow"><div class="t">' + esc(c.q) + '</div><div class="s">' + esc(c.a) + '</div>' +
        '<div class="s2">' + (ankiIsNew(c) ? 'まだ見ていない' : '次は ' + esc(ymdLabel(c.due))) + '</div></div>' +
        '<button class="mini" data-act="anki-del" data-id="' + esc(c.id) + '">消す</button></div>';
    }).join('') : '<div class="empty">カードがありません。</div>') +
    '<div class="pillrow" style="margin-top:8px"><button data-act="anki-home">閉じる</button></div>');
}
function ankiDeckOptions(sel){
  var names = termCourses().map(function(c){ return c.name; });
  ankiDecks().forEach(function(d){ if(names.indexOf(d.name) < 0) names.push(d.name); });
  return '<option value="">（科目を選ぶ）</option>' + names.map(function(n){
    return '<option value="' + esc(n) + '"' + (n === sel ? ' selected' : '') + '>' + esc(n) + '</option>';
  }).join('');
}
function ankiMakeView(){
  var pv = ankiState.preview;
  var h = '';
  if(pv){
    h += section('できたカード（見てから追加）', pv.cards.filter(function(c){ return c.on; }).length + '枚を追加',
      '<div class="field"><label class="f" for="anki_pv_deck">科目</label><select id="anki_pv_deck">' + ankiDeckOptions(pv.deck) + '</select></div>' +
      '<div class="field"><label class="f" for="anki_pv_new">新しい科目名（上にないとき）</label><input id="anki_pv_new" placeholder="例：解剖生理学"></div>' +
      pv.cards.map(function(c, i){
        return '<label class="row ankirow"><input type="checkbox" data-act="anki-pv-toggle" data-i="' + i + '"' + (c.on ? ' checked' : '') + '>' +
          '<div class="grow"><div class="t">' + esc(c.q) + '</div><div class="s">' + esc(c.a) + '</div></div></label>';
      }).join('') +
      '<div class="pair" style="margin-top:8px"><button class="btn" data-act="anki-pv-add">チェックしたものを追加</button>' +
      '<button class="btn ghost" data-act="anki-pv-cancel" style="flex:0 0 auto">やめる</button></div>');
  }
  h += section('カードを作る', null,
    '<label class="f">AIで作る（講義資料・ノートの写真・PDF）</label>' +
    '<div class="pair"><button class="btn ghost" data-act="anki-ai-file"' + (ankiState.busy ? ' disabled' : '') + '>' +
      (ankiState.busy ? 'AIが作っています…' : '📄 写真・PDFをえらぶ（4つまで）') + '</button></div>' +
    '<div class="field" style="margin-top:8px"><label class="f" for="anki_text">または、文章を貼りつける</label>' +
      '<textarea id="anki_text" rows="3" placeholder="講義のまとめや、教科書の文章など"></textarea></div>' +
    '<button class="btn ghost" data-act="anki-ai-text"' + (ankiState.busy ? ' disabled' : '') + '>文章から作る</button>' +
    '<p class="note">⚠️ 実習記録など、<b>患者さんの情報が書いてある資料は読みこまないでください</b>。AI（Gemini）に送られます。</p>' +
    '<label class="f" style="margin-top:12px">自分で書く</label>' +
    '<div class="field"><select id="anki_deck">' + ankiDeckOptions(ankiState.deck) + '</select></div>' +
    '<div class="field"><input id="anki_newdeck" placeholder="新しい科目名（上にないとき）"></div>' +
    '<div class="field"><textarea id="anki_q" rows="2" placeholder="問い（例：成人の呼吸数の正常値は？）"></textarea></div>' +
    '<div class="field"><textarea id="anki_a" rows="2" placeholder="答え（例：12〜20回/分）"></textarea></div>' +
    '<button class="btn ghost" data-act="anki-add">カードを追加</button>');
  return h;
}

/* ============================== 操作 ============================== */
function ankiAction(act, t){
  if(act.indexOf('anki-') !== 0) return false;
  if(act === 'anki-start'){ ankiStart(t.dataset.deck || ''); return true; }
  if(act === 'anki-show'){ ankiState.show = true; render(); return true; }
  if(act === 'anki-grade'){ ankiGrade(toNum(t.dataset.v)); return true; }
  if(act === 'anki-quit'){
    var n = ankiState.done;
    ankiState.mode = n ? 'done' : ''; ankiState.queue = []; ankiState.cur = '';
    if(n && typeof petStudyReward === 'function') petStudyReward(n);
    ankiPushNow(); return true;
  }
  if(act === 'anki-home'){ ankiState.mode = ''; ankiState.listDeck = ''; render(); return true; }
  if(act === 'anki-list'){ ankiState.mode = 'list'; ankiState.listDeck = t.dataset.deck || ''; render(); return true; }
  if(act === 'anki-del'){
    removeItem('cards', t.dataset.id);
    commit(); toast('カードを消しました'); return true;
  }
  if(act === 'anki-ai-file'){ ankiPickFiles(); return true; }
  if(act === 'anki-ai-text'){
    var tx = val('anki_text').trim();
    if(tx.length < 20){ toast('もう少し長い文章を貼りつけてください', true); return true; }
    ankiMakeFrom([], tx); return true;
  }
  if(act === 'anki-pv-toggle'){
    var pv = ankiState.preview, i = toNum(t.dataset.i);
    if(pv && pv.cards[i]) pv.cards[i].on = t.checked ? 1 : 0;
    return true;
  }
  if(act === 'anki-pv-cancel'){ ankiState.preview = null; render(); return true; }
  if(act === 'anki-pv-add'){
    var p = ankiState.preview;
    if(!p) return true;
    var deck = val('anki_pv_new').trim() || val('anki_pv_deck') || p.deck || 'そのほか';
    var added = ankiAddMany(deck, p.cards.filter(function(c){ return c.on; }), 'ai');
    ankiState.preview = null;
    commit(); toast(added + '枚追加しました'); return true;
  }
  if(act === 'anki-add'){
    var q = val('anki_q').trim(), a = val('anki_a').trim();
    var dk = val('anki_newdeck').trim() || val('anki_deck') || 'そのほか';
    if(!q || !a){ toast('問いと答えを入れてください', true); return true; }
    ankiState.deck = dk;
    var n2 = ankiAddMany(dk, [{ q:q, a:a }], 'hand');
    ['anki_q', 'anki_a', 'anki_newdeck'].forEach(function(id){ var e = document.getElementById(id); if(e) e.value = ''; });
    commit(); toast(n2 ? 'カードを追加しました' : '同じカードがもうあります', !n2); return true;
  }
  return true;
}
