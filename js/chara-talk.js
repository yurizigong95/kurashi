/* くらしの手帳：キャラクターのセリフ（1ぴき1日200種類以上） */
/* ============================== セリフの素 ==============================
   ・組み合わせで、その日・その子だけのセリフを200種類以上つくる（AIがなくても動く）。
   ・AIが使えるときは、その日の予定や天気にあわせたセリフを、さらに200以上考えてもらう。 */
var CT_TIME = {
  morning:[
    'おはよう！', 'おはよ〜、よくねむれた？', '朝ごはん、ちゃんと食べた？', 'きょうもいい日になるといいね', 'ねぐせ、ついてない？',
    'お水を1ぱい飲もう', 'カーテンあけて、ひかりをあびよ', '持ちもの、たしかめた？', 'いってらっしゃいの準備、できた？', 'あと5分…ってなってない？',
    '朝のうちに、今日のやることを見ておこ', 'はみがき、わすれずにね', '今日の1限、何だっけ？', 'スマホの充電、たりてる？', 'おはようのストレッチしよ',
    '天気、たしかめた？', '学生証もった？', 'ゆっくり深呼吸してから出発しよ', '朝の空気、きもちいいね', '今日のもくひょう、ひとつ決めよ',
    '寝ぼけてない？顔あらった？', 'きょうもいっしょにがんばろ', '時間に余裕をもって出ようね', 'おべんとう、もった？', '朝ごはん、なに食べたの？'
  ],
  noon:[
    'こんにちは！', 'お昼ごはんの時間だね', 'ひとやすみしよ', '午前、おつかれさま', 'ちゃんと座って食べてる？',
    '午後の授業、ねむくならないようにね', '水分とってる？', 'ちょっと目を休めよ', 'おやつの時間かも', 'のびをしよ、ぐーっと',
    '午後もあとすこし！', 'お昼寝10分もいいよ', '次の授業の場所、たしかめた？', 'ノート、ちゃんと取れてる？', '甘いもの、ちょっとだけね',
    '外の空気、すいにいこ', 'がんばってるね、えらい', '午後の予定を見ておこ', 'つかれたら、むりしないでね', 'わからないところ、メモしておこ',
    'お昼のあとは、ちょっと歩こ', '友だちとおしゃべりした？', '空を見上げてみよ', '今日の半分、クリア！', 'あとでまとめて休もうね'
  ],
  evening:[
    'おつかれさま〜', '今日もよくがんばったね', 'おかえり！', '晩ごはん、なにかな？', 'お風呂でゆっくりしてね',
    '今日できたこと、数えてみよ', '明日の準備、少しだけしよ', '課題、ちょっとだけ進めよ', 'スマホばかり見すぎないでね', 'あたたかいものを飲も',
    '今日の授業、ふりかえろ', '洗濯もの、とりこんだ？', '明日の天気、見ておこ', 'がんばった自分をほめよ', 'ゆっくり夜ごはん食べてね',
    '今日のもくひょう、どうだった？', 'くつろぐ時間も大事だよ', 'おなかいっぱい？', 'バイトおつかれさま！', '明日の1限、何時だっけ？',
    'ストレッチして、からだをほぐそ', '部屋をちょっと片づけよ', '明日の持ちもの、そろえておこ', 'すきな音楽きいて、ひと休み', '今日もいっしょにいてくれてありがと'
  ],
  night:[
    'そろそろ寝よ…', 'ねむくない？', 'おやすみの準備、しよ', '夜ふかしはほどほどにね', 'あしたのためにも、はやく寝よ',
    '目をとじて、深呼吸', '明日の目覚まし、セットした？', '今日もおつかれさま', 'スマホの光、へらそ', 'いい夢みてね',
    'ふとん、あったかい？', 'ゆっくり休んでね', '寝る前に、お水ひとくち', 'また明日ね', 'ねむれないときは、ゆっくり呼吸しよ',
    '明日はきっといい日', '今日のことは、今日でおしまい', 'おやすみ、またあした', 'もう遅いよ、ねよ〜', '夜はゆっくり、からだを休めよ',
    '課題は明日の朝にしよ', '電気、けした？', '寝る前にストレッチしよ', 'しずかな夜だね', 'ぐっすりねむってね'
  ]
};
var CT_ANY = {
  cheer:[
    'ファイト！', 'いつもおうえんしてるよ', 'ゆっくりでだいじょうぶ', '一歩ずつでいいよ', 'できるよ、きっと',
    'がんばってるの、知ってるよ', 'むりはしないでね', 'ちいさなことからやってみよ', 'ここまでよくがんばったね', 'きょうの自分、はなまる',
    'ちょっと休んだら、また進も', 'できたこと、ちゃんとあるよ', 'あせらなくていいよ', 'そのままで大丈夫', 'すこしずつ、前に進んでるよ',
    'ひとりじゃないよ', 'こまったら、相談してね', 'じぶんのペースでいこ', '5分だけやってみよ', 'えらいえらい',
    'きょうもそばにいるよ', 'おつかれさまが言えるって、すてきだね', 'つかれたら、ぎゅーってしてあげる', '笑顔、すてきだよ', 'いっしょにがんばろ'
  ],
  care:[
    '水のんだ？', 'ちょっと休けいしよ', 'がんばりすぎないでね', '姿勢、まっすぐになってる？', '目がつかれたら、遠くを見よ',
    '手洗い、わすれずにね', 'ごはん、ちゃんと食べてね', 'ぐーっとのびをしよ', '肩の力、ぬいてこ', 'しっかり寝るのも大事なおしごとだよ',
    '深呼吸しよ。すー、はー', 'あったかくしてね', 'おなか、すいてない？', '外を少し歩くと、すっきりするよ', 'むりしないで、休んでいいよ',
    'くすりの時間、だいじょうぶ？', '体調はどう？', 'つかれたら、甘いもの少しね', 'ゆっくりお風呂に入ろ', '好きなことをする時間もつくろ'
  ],
  study:[
    '看護の勉強、えらいね', 'わからない用語は、すぐメモしよ', '授業のノート、見返そ', 'ちょっとだけ復習しよ', '覚えたことを声に出してみよ',
    'テスト勉強、ちょっとずつね', '図にしてみると、わかりやすいかも', '課題の締切、見ておこ', '5分だけ、単語カードやろ', 'まとめノート、いい感じ？',
    '友だちに説明できたら、ばっちり', '休けいをはさむと、覚えやすいよ', 'きょう習ったこと、ひとつ思い出してみよ', 'シラバス、見てみた？', 'レポート、下書きだけでもしよ',
    '集中タイム、はじめよっか', 'ペンの色、わけてみよ', 'わからないところは、先生に聞いてみよ', 'できた問題に、まるをつけよ', 'きょうの学び、ひとことで言うと？'
  ],
  cute:[
    'ねえねえ、きいて', 'えへへ', 'ちょっとだけ、なでてほしいな', 'きょうも会えてうれしい', 'るんるん',
    'のんびりいこ〜', 'ぽかぽか', 'ふわ〜ってしてる', 'おなかがぐーってなった', 'いっしょにいると、たのしいね',
    'ひみつ、おしえてあげよっか', 'ころころ〜', 'きょうはなにする？', 'ぎゅー！', 'えっへん',
    'ねむねむ…', 'わくわくするね', 'ぴかぴかの一日にしよ', 'しあわせ、みっけ', 'にこにこしよ'
  ],
  money:[
    '今月のお金、見ておこ', 'レシート、とっておいた？', '使ったお金、記録しよ', 'ちょっと節約してみる？', 'ほしいもの、よく考えてからね',
    'ポイント、たまってる？', '引き落としの日、たしかめよ', 'ごほうびは、計画的にね', '家計簿、えらいね', 'おさいふの中、たしかめた？'
  ],
  tips:[
    '手洗いは、指のあいだと手首までね', '水分は、こまめに少しずつ', '寝る前のスマホは、ほどほどに', '朝の光をあびると、目がさめやすいよ', '背すじをのばすと、呼吸が楽になるよ',
    'ノートは、あとで見返しやすく書こ', '予定は早めに入れると安心だよ', 'つかれた日は、早めに休もう', 'ストレッチは、ゆっくり伸ばそう', '笑うと、気分が軽くなるよ',
    '感染対策、きょうも大事にしよ', '寒い日は、首もとをあたためよ', '暑い日は、帽子と水分を', 'ポモドーロは25分集中＋5分休けい', 'わすれものは、前の晩にたしかめよ'
  ]
};
var CT_OPEN = ['', 'ねえ、', 'あのね、', 'そうそう、', 'えっとね、', 'ふふ、'];
var CT_END = ['', '♪', '！', '〜'];

/* きまった順でならべかえる（同じ日・同じ子なら同じ並び） */
function ctRand(seed){
  var s = seed % 2147483647; if(s <= 0) s += 2147483646;
  return function(){ s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
}
function ctShuffle(arr, seed){
  var a = arr.slice(), r = ctRand(seed);
  for(var i = a.length - 1; i > 0; i--){ var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function ctSeed(s){ return parseInt(hash53(String(s)).slice(0, 7), 36) || 1; }
function ctBucket(h){ return h < 5 ? 'night' : h < 11 ? 'morning' : h < 17 ? 'noon' : h < 22 ? 'evening' : 'night'; }
function ctTic(k, line){
  line = String(line || '');
  if(!k || !k.tic || !line) return line;
  var m = line.match(/(…|！|!|。|？|\?|♪|〜)$/);
  var end = m ? m[1] : '';
  return line.slice(0, line.length - end.length) + ' ' + k.tic + (end === '。' ? '' : (end || '！'));
}
/* その日の話題（予定・天気・季節） */
function ctDayTopics(ymd){
  var out = [], td = ymd;
  var a = td.split('-'), dow = new Date(+a[0], +a[1] - 1, +a[2]).getDay();
  out.push(['今日は', WDAY[dow], '曜日だね'].join(''));
  out.push((+a[1]) + '月' + (+a[2]) + '日、きょうもよろしくね');
  if(dow === 1) out.push('あたらしい1週間のはじまりだね');
  if(dow === 5) out.push('あと1日で週末だよ！');
  if(dow === 0 || dow === 6) out.push('おやすみの日、ゆっくりしてね', 'おでかけする？');
  var cls = (typeof classesForDate === 'function') ? classesForDate(td).filter(function(c){ return !c.off; }) : [];
  if(cls.length){
    out.push('今日は' + cls.length + 'コマあるね');
    cls.slice(0, 4).forEach(function(c){
      var n = shortName(c.name);
      out.push(n + 'の授業、がんばってね', n + '、どんなこと習うのかな', c.period + '限の' + n + '、わすれないでね');
    });
  }else out.push('今日は授業がない日だね', '授業のない日は、じぶんのペースでね');
  (S.exams || []).filter(function(x){ return isYmd(x.date) && x.date >= td && daysBetween(td, x.date) <= 14; }).slice(0, 3).forEach(function(x){
    var n = daysBetween(td, x.date), nm = x.subject ? shortName(x.subject) : 'テスト';
    out.push(n === 0 ? nm + 'のテスト、今日だね！' : nm + 'のテストまで、あと' + n + '日', nm + 'の勉強、すこしずつ進めよ');
  });
  (S.tasks || []).filter(function(t){ return !t.done && isYmd(t.due) && t.due >= td && daysBetween(td, t.due) <= 7; }).slice(0, 3).forEach(function(t){
    var n = daysBetween(td, t.due);
    out.push('「' + String(t.title).slice(0, 12) + '」の締切、' + (n === 0 ? '今日だよ' : 'あと' + n + '日だよ'));
  });
  if((S.shifts || []).some(function(w){ return w.date === td; })) out.push('今日はバイトだね、いってらっしゃい', 'バイト、むりしないでね');
  var m = +a[1];
  var season = m >= 3 && m <= 5 ? ['春だね、ぽかぽか', 'お花、さいてるかな', '新しいことをはじめたくなる季節'] :
               m >= 6 && m <= 8 ? ['暑いね、水分とってね', 'アイス食べたいな', '夏の空、きれいだね'] :
               m >= 9 && m <= 11 ? ['秋だね、すずしくなってきた', '食欲の秋だね', '紅葉、見にいきたいな'] :
               ['寒いね、あったかくしてね', 'こたつ、入りたいな', '冬の星、きれいだね'];
  out = out.concat(season);
  var fes = (typeof festivalOn === 'function') ? festivalOn(td) : '';
  if(fes && typeof CHARA_FES_LINE !== 'undefined' && CHARA_FES_LINE[fes]) out.push(CHARA_FES_LINE[fes]);
  try{
    var w = weather && weather.sanda;
    if(w && w.daily && w.daily.precipitation_probability_max){
      var pop = w.daily.precipitation_probability_max[0];
      if(pop >= 50) out.push('雨がふるかも。傘をもってね', '雨の日は、足もとに気をつけてね');
      else out.push('きょうは雨の心配、少なそうだね');
    }
  }catch(e){}
  return out;
}
/* その子らしい話題 */
function ctCharaLines(k){
  var like = k.like || 'おいしいもの';
  return [
    like + 'のこと、考えてた', 'きょうは' + like + 'の気分', like + 'の夢をみたよ', 'こんど' + like + 'をいっしょに…ね？', like + 'があると、がんばれる',
    k.name + 'です、よろしくね', k.name + 'だよ、きょうも見守ってるね', k.name + 'は、きみの味方だよ', k.desc + '、それが' + k.name + '！', k.name + 'と、いっしょにいこ',
    '名前をよんでくれると、うれしいな', 'きょうの' + k.name + '、ちょっとごきげん', k.name + 'も、いっしょにお勉強', k.name + 'も、ひとやすみ', k.name + 'は、ずっとそばにいるよ'
  ];
}
/* その日・その子のセリフぜんぶ（時間帯ごと） */
var ctCache = {};
function charaDayPool(id, ymd){
  ymd = ymd || today();
  var k = charaById(id);
  var ck = id + '|' + ymd + '|' + (k.tic || '') + '|' + (S.tasks || []).length + '|' + (S.exams || []).length;
  if(ctCache[ck]) return ctCache[ck];
  var seed = ctSeed(ck);
  var r = ctRand(seed);
  var pool = { morning:[], noon:[], evening:[], night:[], any:[] };
  Object.keys(CT_TIME).forEach(function(b){ pool[b] = CT_TIME[b].slice(); });
  var any = [];
  Object.keys(CT_ANY).forEach(function(g){ any = any.concat(CT_ANY[g]); });
  any = any.concat(ctCharaLines(k), ctDayTopics(ymd));
  /* 話しかけ方をかえて、ことばを増やす */
  var extra = [];
  ctShuffle(any, seed).slice(0, 60).forEach(function(s){
    var op = CT_OPEN[1 + Math.floor(r() * (CT_OPEN.length - 1))];
    if(!/^(ねえ|あのね|そうそう|えっとね|ふふ)/.test(s)) extra.push(op + s);
  });
  pool.any = any.concat(extra);
  /* AIが考えたセリフ */
  var ai = (S.charaTalk || {})[ymd + ':' + id];
  if(ai){
    ['morning', 'noon', 'evening', 'night', 'any'].forEach(function(b){
      (ai[b] || []).forEach(function(s){ if(typeof s === 'string' && s.length <= 60) pool[b].push(s); });
    });
  }
  var seen = {};
  Object.keys(pool).forEach(function(b){
    pool[b] = ctShuffle(pool[b], seed + b.length).filter(function(s){
      s = String(s).trim();
      if(!s || seen[s]) return false;
      seen[s] = 1; return true;
    }).map(function(s){
      var e = CT_END[Math.floor(r() * CT_END.length)];
      return ctTic(k, /[！!？?。♪〜…]$/.test(s) ? s : s + e);
    });
  });
  pool.total = Object.keys(seen).length;
  pool.ai = ai ? 1 : 0;
  ctCache = {}; ctCache[ck] = pool;
  return pool;
}
/* いまの時間に合うセリフを1つ */
function charaPoolLine(id, kind){
  var p = charaDayPool(id);
  var b = ctBucket(new Date().getHours());
  var list = kind === 'greet' ? p[b] : (Math.random() < .4 ? p[b] : p.any);
  if(!list || !list.length) list = p.any;
  return list[Math.floor(Math.random() * list.length)] || '';
}

/* ============================== AIがセリフを考える ============================== */
var ctAiBusy = {};
function charaTalkAiOn(){ return ((S.ui.chara || {}).aiTalk !== 0); }
async function charaTalkAi(id){
  if(!charaTalkAiOn() || !aiReady() || ctAiBusy[id]) return;
  var ymd = today(), key = ymd + ':' + id;
  if((S.charaTalk || {})[key]) return;
  var flag = KEY + ':ctai:' + key;
  try{ if(localStorage.getItem(flag)) return; localStorage.setItem(flag, '1'); }catch(e){ return; }
  ctAiBusy[id] = true;
  var k = charaById(id);
  try{
    var topics = ctDayTopics(ymd).slice(0, 14).join('／');
    var prompt = 'あなたは、手帳アプリのオリジナルキャラクター「' + k.name + '」（' + k.desc + '）のセリフを書く係です。\n' +
      '使う人：看護学部1年生。今日：' + ymd + '。今日の話題：' + topics + '\n' +
      (k.tic ? '口ぐせ「' + k.tic + '」は、ときどき文末に入れてよい（入れすぎない）。\n' : '') +
      (k.like ? '好きなもの：' + k.like + '\n' : '') +
      'ルール：1つ30文字以内。やさしく、かわいく、はげますことば。同じセリフをくり返さない。病気の診断・薬の量・お金の断定的な助言は書かない。実在の作品やキャラクターの名前は出さない。個人名は書かない。\n' +
      '次のJSONだけを返す：{"morning":[朝のセリフ50個],"noon":[昼のセリフ50個],"evening":[夕方〜夜のセリフ50個],"night":[深夜のセリフ40個],"any":[いつでも使えるセリフ40個]}';
    var j = parseJsonLoose(await aiGenerate({ tag:'charatalk', json:true, temperature:0.9, maxTokens:12000,
      contents:[{ role:'user', parts:[{ text:prompt }] }] }));
    var clean = function(a){
      return (Array.isArray(a) ? a : []).map(function(s){ return String(s || '').replace(/[\r\n]+/g, ' ').trim(); })
        .filter(function(s){ return s && s.length <= 40; }).slice(0, 60);
    };
    var entry = { morning:clean(j.morning), noon:clean(j.noon), evening:clean(j.evening), night:clean(j.night), any:clean(j.any), mt:Date.now() };
    var n = entry.morning.length + entry.noon.length + entry.evening.length + entry.night.length + entry.any.length;
    if(n < 20) throw new Error('セリフが少なすぎました');
    S.charaTalk = S.charaTalk || {};
    Object.keys(S.charaTalk).forEach(function(x){ if(x.slice(0, 10) !== ymd) delete S.charaTalk[x]; });
    S.charaTalk[key] = entry;
    touch('charaTalk');
    ctCache = {};
    persist(); pushRemote();
  }catch(e){
    logErr('キャラのセリフ', e.message);
  }finally{
    ctAiBusy[id] = false;
  }
}
/* 今日出てくる子（本人＋仲間）のぶんを、1日1回だけ */
function charaTalkAiToday(){
  if(TEST_MODE || typeof charaLevel !== 'function' || charaLevel() < 1) return;
  var ids = [charaNow().id];
  if(charaLevel() >= 5) ids = ids.concat(charaPals(2));
  ids.slice(0, 3).forEach(function(id, i){
    setTimeout(function(){ charaTalkAi(id); }, 20000 + i * 15000);
  });
}
setTimeout(charaTalkAiToday, 1000);
