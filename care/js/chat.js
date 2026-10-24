/* かんご実習メーカー：「AI壁打ち」タブ
   事例の中身（状況メモ・情報整理・アセスメント・看護問題・看護計画・評価）をAIにわたして相談する。
   看護問題の候補出し・看護計画のレビューなどに使う。学習用の架空事例だけをあつかう。 */

var cv = { busy:0, ctrl:null, scroll:0 };
var CHAT_KEEP = 20;              /* AIにわたす、さいごのやりとりの数 */

function chatSystem(c){
  return 'あなたは、看護学生が「看護過程」（情報収集・アセスメント・看護問題・看護計画・実施・評価）を学ぶのを手伝う、やさしい指導者です。\n' +
    '次の事例は、学習用の【架空の事例（ペーパーペイシェント）】です。実在の患者さんではありません。\n' +
    'きまり：\n' +
    '・日本語で、看護学生にわかることばで答える。長くなりすぎないよう、見出しや箇条書きで整理する。\n' +
    '・答えをすべて出すより、根拠（事例のどの情報からそう考えたか）を示し、学生が自分で考えを深められる問いかけも1つ添える。\n' +
    '・看護問題は、看護診断（NANDA-I など）の形にこだわりすぎず、「〜に関連した〜」のような書き方の例を示してよい。\n' +
    '・医学的な診断や、薬の量などの具体的な指示はしない。数値や手順は「教科書・指導者に確認してください」と添える。\n' +
    '・相談の中に、実在の人の名前や病院名など、本物の患者情報らしいものがあったら、それにはふれず、架空の事例にしてほしいと伝える。\n\n' +
    '===== 事例 =====\n' + caseText(c);
}

function chatView(){
  var c = curCase();
  var h = '';
  if(!c) return section(null, null, empty('事例がありません。「事例」タブで作ってください。') + btn('📚 事例へ', 'tab', { data:{ tab:'cases' }, cls:'ghost' }));
  h += '<div class="casepick"><select data-act="ch-pick" aria-label="事例をえらぶ"' + (cv.busy ? ' disabled' : '') + '>' + cases().map(function(x){
    return '<option value="' + esc(x.id) + '"' + (x.id === c.id ? ' selected' : '') + '>' + esc(x.name || '（名前なし）') + '</option>';
  }).join('') + '</select></div>';
  if(!aiReady()){
    h += section('AIのキーがまだありません', null,
      '<div class="s">くらしの手帳（設定 › AIそうだん）で Gemini のキーを入れると、ここでも<b>自動で</b>使います。' +
      'このアプリの「設定」で入れることもできます。</div>' +
      btn('⚙️ 設定へ', 'tab', { cls:'ghost', data:{ tab:'set' } }));
  }
  var ch = chatOf(c.id, false), msgs = (ch && ch.msgs) || [];
  h += '<div class="chatlog" id="chatlog">' +
    (msgs.length ? msgs.map(function(m){
      return '<div class="msg ' + (m.r === 'u' ? 'me' : 'ai') + (m.err ? ' err' : '') + '"><div class="bub">' + chatHtml(m.t) + '</div></div>';
    }).join('') : '<div class="empty">「' + esc(c.name || '事例') + '」について、AIと考えてみましょう。<br>下のボタンからえらぶか、聞きたいことを書いてください。</div>') +
    (cv.busy ? '<div class="msg ai"><div class="bub wait"><span class="dots"><i></i><i></i><i></i></span> 考えています…</div></div>' : '') +
  '</div>';
  h += '<div class="asks">' + D_ASK.map(function(a){
    return '<button type="button" data-act="ch-ask" data-v="' + esc(a[0]) + '"' + (cv.busy ? ' disabled' : '') + '>' + esc(a[1]) + '</button>';
  }).join('') + '</div>';
  h += '<div class="chatin">' +
    '<textarea id="ch_in" rows="2" placeholder="聞きたいことを書く（事例の中身は自動でAIにわたします）"' + (cv.busy ? ' disabled' : '') + '>' + esc(inVal('ch_in', '')) + '</textarea>' +
    (cv.busy ? btn('やめる', 'ch-stop', { cls:'ghost' }) : btn('送る', 'ch-send', { cls:'main' })) +
  '</div>';
  h += '<div class="minirow">' +
    (msgs.length ? '<button type="button" data-act="ch-clear"' + (cv.busy ? ' disabled' : '') + '>この事例の会話を消す</button>' : '') +
    '<button type="button" data-act="ch-ctx">AIにわたす中身を見る</button>' +
  '</div>';
  if(S.ui.ctxOpen) h += section('AIにわたす中身', null, '<pre>' + esc(caseText(c)) + '</pre>' +
    note('この事例の中身と、さいごの' + CHAT_KEEP + 'このやりとりを、毎回 Gemini（Google）にわたします。'));
  h += note('AIの答えは、まちがうことがあります。<b>教科書・先生・実習指導者に確かめて</b>から使ってください。');
  return h;
}
/* AIの答えを、見やすくする（**太字**・見出し・箇条書きだけ） */
function chatHtml(t){
  return String(t || '').split('\n').map(function(line){
    var s = esc(line).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    if(/^#{1,4}\s/.test(line)) return '<b class="mh">' + s.replace(/^#{1,4}\s/, '') + '</b>';
    if(/^\s*[-*・]\s/.test(line)) return '<span class="li">' + s.replace(/^\s*[-*・]\s/, '・') + '</span>';
    return s;
  }).join('<br>');
}
function chatAfter(){
  if(view.tab !== 'chat' || !cv.scroll) return;
  cv.scroll = 0;
  var log = document.getElementById('chatlog');
  if(log && log.lastElementChild) try{ log.lastElementChild.scrollIntoView({ block:'end' }); }catch(e){}
}

async function chatSend(text){
  var c = curCase();
  text = String(text || '').trim();
  if(!c || !text || cv.busy) return;
  if(!aiReady()){ toast('先に「設定」で、GeminiのAPIキーを入れてください', true); return; }
  var ch = chatOf(c.id, true);
  ch.msgs.push({ r:'u', t:text, at:Date.now() });
  ch.mt = Date.now();
  saveNow();
  cv.busy = 1; cv.scroll = 1;
  cv.ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  render();
  var hist = ch.msgs.filter(function(m){ return !m.err; }).slice(-CHAT_KEEP);
  while(hist.length && hist[0].r !== 'u') hist.shift();       /* はじめは、こちらからの言葉にする */
  try{
    var res = await aiCall({
      system:chatSystem(c),
      contents:hist.map(function(m){ return { role:m.r === 'u' ? 'user' : 'model', parts:[{ text:m.t }] }; }),
      temperature:0.6, maxTokens:4096, signal:cv.ctrl ? cv.ctrl.signal : undefined, tag:'care-chat'
    });
    var out = String(res.text || '').trim() || '（答えがからでした。聞き方を変えて、もう一度ためしてください）';
    ch = chatOf(c.id, true);
    ch.msgs.push({ r:'m', t:out, at:Date.now() });
    ch.mt = Date.now();
  }catch(e){
    ch = chatOf(c.id, true);
    var msg = (e && /abort/i.test(String(e.name || e.message))) ? 'とちゅうでやめました' : aiErrText(e && e.message);
    ch.msgs.push({ r:'m', t:'⚠️ ' + msg, at:Date.now(), err:1 });
    ch.mt = Date.now();
  }finally{
    cv.busy = 0; cv.ctrl = null; cv.scroll = 1;
    if(ch.msgs.length > 200) ch.msgs = ch.msgs.slice(-200);
    saveNow();
    if(view.tab === 'chat' && !isTyping()) render();
    else if(view.tab === 'chat') syRender();
  }
}

onView('chat', chatView);

onAct('ch-pick', function(d, el){ setCur(el.value); saveSoon(); cv.scroll = 1; render(); });
onAct('ch-send', function(){
  var t = String(elVal('ch_in') || '').trim();
  if(!t){ toast('聞きたいことを書いてください', true); return; }
  inClear('ch_in');
  var el = document.getElementById('ch_in');
  if(el){ el.value = ''; el.blur(); }
  chatSend(t);
});
onAct('ch-ask', function(d){
  var a = D_ASK.filter(function(x){ return x[0] === d.v; })[0];
  if(a) chatSend(a[2]);
});
onAct('ch-stop', function(){ if(cv.ctrl) try{ cv.ctrl.abort(); }catch(e){} });
onAct('ch-clear', function(){
  var c = curCase(), ch = c && chatOf(c.id, false);
  if(!ch || !ask('この事例のAIとの会話を消します。よろしいですか？')) return;
  /* ほかの端末でも消えるように「消した」しるしをのこす（次に話すと、新しく作りなおす） */
  S.chats = S.chats.filter(function(x){ return x !== ch; });
  if(typeof syDead === 'function') syDead(ch.id);
  saveNow();
  render();
});
onAct('ch-ctx', function(){ S.ui.ctxOpen = S.ui.ctxOpen ? 0 : 1; saveSoon(); render(); });
