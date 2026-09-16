/* くらしの手帳：キャラクター（オリジナル） */
/* ============================== キャラクター ==============================
   このアプリだけのオリジナルの子たち（既存の作品のキャラクターではありません）。
   ・種類：13ひき。いつも同じ子／日替わり／ランダム を選べる
   ・出てくる量（充実度）：なし／ちょっと／ふつう／たっぷり
     ちょっと … 今日の画面のあいさつ・何もない画面
     ふつう   … ＋お知らせ（トースト）・課題が終わったときのお祝い・相談のアイコン
     たっぷり … ＋画面のすみにいつもいる子（タップすると話す）・キャラの口調で相談に答える */
var CHARAS = [
  { id:'mochi',  name:'もちうさ',   ears:'bunny',   body:'#FFFFFF', line:'#6E5A66', inner:'#F8C9D6', cheek:'#F7A9BE', tic:'',     desc:'白くてもちもち。やさしいうさぎ' },
  { id:'koro',   name:'ころハム',   ears:'hamster', body:'#F3C58E', line:'#7A5234', inner:'#F7B6A6', cheek:'#F29A8E', belly:'#FFF6EC', tic:'ハムッ', desc:'ほっぺに夢をつめこむハムスター' },
  { id:'puku',   name:'ぷくねこ',   ears:'cat',     body:'#D9D6E3', line:'#5C586E', inner:'#F4C3D2', cheek:'#F2A7BD', stripes:1, whisker:1, tic:'にゃ', desc:'ねむたがりのしましまねこ' },
  { id:'kuma',   name:'くまっこ',   ears:'bear',    body:'#C8966B', line:'#5E3F27', inner:'#E8C2A0', cheek:'#EFA08C', muzzle:'#F2DDC6', tic:'くま', desc:'はちみつが好きな小さなくま' },
  { id:'penta',  name:'ぺんた',     ears:'none',    body:'#4D5F86', line:'#2E3A55', inner:'#FFFFFF', cheek:'#F4A6B8', face:'#FFFFFF', beak:'#F3A73B', tic:'ぺん', desc:'よちよち歩きのペンギン' },
  { id:'hiyo',   name:'ひよぴ',     ears:'tuft',    body:'#FCE17A', line:'#8A6A1E', inner:'#F8C94F', cheek:'#F6A38E', beak:'#F39A3B', tic:'ぴよ', desc:'元気いっぱいのひよこ' },
  { id:'komugi', name:'こむぎ',     ears:'shiba',   body:'#E9A965', line:'#6E4424', inner:'#FFF3E4', cheek:'#F29A8A', muzzle:'#FFF3E4', tic:'わん', desc:'しっぽをふる、きなこ色の犬' },
  { id:'ponpoko',name:'ぽんぽこ',   ears:'bear',    body:'#B8966E', line:'#5A4330', inner:'#8C6A4A', cheek:'#E99A86', mask:'#7A5C40', belly:'#F1E2CB', tic:'ぽこ', desc:'はっぱで化けるのが下手なたぬき' },
  { id:'panda',  name:'ぱんだん',   ears:'bear',    body:'#FFFFFF', line:'#3E3A40', inner:'#3E3A40', earFill:'#3E3A40', armFill:'#3E3A40', cheek:'#F5A9BA', mask:'#3E3A40', tic:'',     desc:'ささが大好き、のんびりパンダ' },
  { id:'meeko',  name:'めえこ',     ears:'sheep',   body:'#FFF4E6', line:'#7A6552', inner:'#F4D7C2', cheek:'#F4A9A0', wool:'#FFFFFF', tic:'めぇ', desc:'ふわふわの毛につつまれたひつじ' },
  { id:'pyonta', name:'ぴょんた',   ears:'frog',    body:'#9ED99A', line:'#3E6B3B', inner:'#FFFFFF', cheek:'#F4A3A3', belly:'#E9F7DA', tic:'けろ', desc:'雨の日がうれしいかえる' },
  { id:'fuwa',   name:'ふわおば',   ears:'ghost',   body:'#F4F1FF', line:'#6D63A0', inner:'#E3DDFF', cheek:'#F5B3CB', tic:'〜ふわ', desc:'夜にちょっとだけ出てくるおばけ' },
  { id:'kon',    name:'こんちゃん', ears:'fox',     body:'#F2A15E', line:'#74421F', inner:'#FFF1E2', cheek:'#F29387', muzzle:'#FFF4E8', tic:'こん', desc:'しっぽがじまんのこぎつね' }
];
var CHARA_LEVELS = [[0,'なし'],[1,'ちょっと'],[2,'ふつう'],[3,'たっぷり']];
function charaCfg(){
  var c = (S.ui && S.ui.chara) || {};
  return {
    level: (c.level == null) ? 2 : Math.max(0, Math.min(3, Math.round(toNum(c.level)))),
    mode: c.mode || 'one',
    main: c.main || 'mochi',
    friends: (Array.isArray(c.friends) && c.friends.length) ? c.friends : CHARAS.map(function(x){ return x.id; }),
    talk: c.talk ? 1 : 0
  };
}
function charaLevel(){ return charaCfg().level; }
function charaById(id){ return CHARAS.filter(function(x){ return x.id === id; })[0] || CHARAS[0]; }
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

/* ===== 絵（SVG） ===== */
function chEars(k){
  var L = k.line, B = k.earFill || k.body, I = k.inner;
  var st = ' stroke="'+L+'" stroke-width="2.6" stroke-linejoin="round"';
  switch(k.ears){
    case 'bunny':
      return '<ellipse cx="37" cy="20" rx="7" ry="17" transform="rotate(-9 37 20)" fill="'+B+'"'+st+'/>'+
             '<ellipse cx="63" cy="20" rx="7" ry="17" transform="rotate(9 63 20)" fill="'+B+'"'+st+'/>'+
             '<ellipse cx="37" cy="22" rx="3.2" ry="11" transform="rotate(-9 37 22)" fill="'+I+'"/>'+
             '<ellipse cx="63" cy="22" rx="3.2" ry="11" transform="rotate(9 63 22)" fill="'+I+'"/>';
    case 'bear':
      return '<circle cx="27" cy="33" r="9.5" fill="'+B+'"'+st+'/><circle cx="73" cy="33" r="9.5" fill="'+B+'"'+st+'/>'+
             '<circle cx="27" cy="34" r="4.8" fill="'+I+'"/><circle cx="73" cy="34" r="4.8" fill="'+I+'"/>';
    case 'hamster':
      return '<circle cx="27" cy="37" r="7.5" fill="'+B+'"'+st+'/><circle cx="73" cy="37" r="7.5" fill="'+B+'"'+st+'/>'+
             '<circle cx="27" cy="38" r="3.8" fill="'+I+'"/><circle cx="73" cy="38" r="3.8" fill="'+I+'"/>';
    case 'cat':
      return '<path d="M20 47 L25 17 L44 31 Z" fill="'+B+'"'+st+'/><path d="M80 47 L75 17 L56 31 Z" fill="'+B+'"'+st+'/>'+
             '<path d="M25.5 40 L27.5 24 L37 31 Z" fill="'+I+'"/><path d="M74.5 40 L72.5 24 L63 31 Z" fill="'+I+'"/>';
    case 'shiba':
      return '<path d="M20 46 Q21 20 28 16 Q36 22 44 31 Z" fill="'+B+'"'+st+'/><path d="M80 46 Q79 20 72 16 Q64 22 56 31 Z" fill="'+B+'"'+st+'/>'+
             '<path d="M26 40 Q27 26 29 23 Q34 27 38 32 Z" fill="'+I+'"/><path d="M74 40 Q73 26 71 23 Q66 27 62 32 Z" fill="'+I+'"/>';
    case 'fox':
      return '<path d="M18 48 L22 10 L45 30 Z" fill="'+B+'"'+st+'/><path d="M82 48 L78 10 L55 30 Z" fill="'+B+'"'+st+'/>'+
             '<path d="M24 40 L25.5 19 L38 30 Z" fill="'+I+'"/><path d="M76 40 L74.5 19 L62 30 Z" fill="'+I+'"/>';
    case 'frog':
      return '<circle cx="34" cy="33" r="11" fill="'+B+'"'+st+'/><circle cx="66" cy="33" r="11" fill="'+B+'"'+st+'/>';
    case 'sheep':
      var w = k.wool || '#fff', o = '';
      [[26,34],[36,25],[50,22],[64,25],[74,34],[19,46],[81,46]].forEach(function(p){
        o += '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="9" fill="'+w+'"'+st+'/>';
      });
      return o;
    case 'tuft':
      return '<path d="M47 27 Q46 18 50 16 M50 27 Q51 17 56 17 M53 27 Q57 21 60 22" fill="none" stroke="'+L+'" stroke-width="2.4" stroke-linecap="round"/>';
    default:
      return '';
  }
}
function chBody(k){
  var st = ' stroke="'+k.line+'" stroke-width="2.6" stroke-linejoin="round"';
  if(k.ears === 'ghost'){
    return '<path d="M50 22 C72 22 84 38 84 58 L84 86 Q80 80 75 86 Q70 92 65 86 Q60 80 55 86 Q50 92 45 86 Q40 80 35 86 Q30 92 25 86 Q20 80 16 86 L16 58 C16 38 28 22 50 22 Z" fill="'+k.body+'" fill-opacity=".96"'+st+'/>';
  }
  var o = '<path d="M50 27 C73 27 86 42 86 62 C86 80 70 90 50 90 C30 90 14 80 14 62 C14 42 27 27 50 27 Z" fill="'+k.body+'"'+st+'/>';
  if(k.face) o += '<ellipse cx="50" cy="66" rx="27" ry="21" fill="'+k.face+'"/>';
  if(k.belly) o += '<ellipse cx="50" cy="75" rx="19" ry="13" fill="'+k.belly+'"/>';
  if(k.muzzle) o += '<ellipse cx="50" cy="69" rx="11" ry="7.5" fill="'+k.muzzle+'"/>';
  if(k.stripes) o += '<path d="M44 33 L45 38 M50 31 L50 37 M56 33 L55 38" stroke="'+k.line+'" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>';
  if(k.mask){
    o += '<ellipse cx="39" cy="58" rx="7.5" ry="6" transform="rotate(-18 39 58)" fill="'+k.mask+'"/>'+
         '<ellipse cx="61" cy="58" rx="7.5" ry="6" transform="rotate(18 61 58)" fill="'+k.mask+'"/>';
  }
  return o;
}
function chFace(k, expr){
  var L = k.line, o = '';
  var eyeY = (k.ears === 'frog') ? 33 : 58;
  var ex1 = (k.ears === 'frog') ? 34 : 40, ex2 = (k.ears === 'frog') ? 66 : 60;
  var onMask = !!k.mask && k.mask !== k.body;
  var eyeC = onMask ? '#FFFFFF' : L;
  var dot = function(x, y, r){
    return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+eyeC+'"/>'+
      (onMask ? '' : '<circle cx="'+(x+1.1)+'" cy="'+(y-1.2)+'" r="'+(r*0.32)+'" fill="#fff"/>');
  };
  var arcUp = function(x, y){ return '<path d="M'+(x-4)+' '+(y+1)+' Q'+x+' '+(y-4.5)+' '+(x+4)+' '+(y+1)+'" fill="none" stroke="'+eyeC+'" stroke-width="2.6" stroke-linecap="round"/>'; };
  var arcDn = function(x, y){ return '<path d="M'+(x-4)+' '+(y-1)+' Q'+x+' '+(y+3)+' '+(x+4)+' '+(y-1)+'" fill="none" stroke="'+eyeC+'" stroke-width="2.4" stroke-linecap="round"/>'; };
  if(expr === 'happy' || expr === 'cheer'){ o += arcUp(ex1, eyeY) + arcUp(ex2, eyeY); }
  else if(expr === 'sleep'){ o += arcDn(ex1, eyeY) + arcDn(ex2, eyeY); }
  else if(expr === 'wink'){ o += arcUp(ex1, eyeY) + dot(ex2, eyeY, 3.3); }
  else if(expr === 'surprise'){ o += dot(ex1, eyeY, 4) + dot(ex2, eyeY, 4); }
  else if(expr === 'sad'){
    o += dot(ex1, eyeY + 1, 3) + dot(ex2, eyeY + 1, 3) +
      '<path d="M'+(ex1-5)+' '+(eyeY-6)+' L'+(ex1+3)+' '+(eyeY-4)+' M'+(ex2+5)+' '+(eyeY-6)+' L'+(ex2-3)+' '+(eyeY-4)+'" stroke="'+L+'" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M'+(ex1+1)+' '+(eyeY+5)+' q-2.4 4 0 5.6 q2.4 -1.6 0 -5.6 Z" fill="#8CC8F0"/>';
  }
  else { o += dot(ex1, eyeY, 3.3) + dot(ex2, eyeY, 3.3); }

  /* ほっぺ */
  var cy = (k.ears === 'frog') ? 62 : 67;
  o += '<ellipse cx="'+((k.ears === 'frog') ? 28 : 30)+'" cy="'+cy+'" rx="5.2" ry="3.2" fill="'+k.cheek+'" opacity=".8"/>'+
       '<ellipse cx="'+((k.ears === 'frog') ? 72 : 70)+'" cy="'+cy+'" rx="5.2" ry="3.2" fill="'+k.cheek+'" opacity=".8"/>';

  /* くち・はな・くちばし */
  var my = (k.ears === 'frog') ? 58 : 66;
  if(k.beak){
    o += '<path d="M46 '+(my-1)+' L54 '+(my-1)+' L50 '+(my+4)+' Z" fill="'+k.beak+'" stroke="'+L+'" stroke-width="1.4" stroke-linejoin="round"/>';
  }else if(k.ears === 'frog'){
    o += (expr === 'happy' || expr === 'cheer')
      ? '<path d="M38 '+my+' Q50 '+(my+10)+' 62 '+my+'" fill="#F47C8C" stroke="'+L+'" stroke-width="2.2" stroke-linejoin="round"/>'
      : '<path d="M40 '+my+' Q50 '+(my+6)+' 60 '+my+'" fill="none" stroke="'+L+'" stroke-width="2.2" stroke-linecap="round"/>';
  }else{
    if(k.muzzle || k.ears === 'bear' || k.ears === 'shiba' || k.ears === 'fox') o += '<ellipse cx="50" cy="'+(my)+'" rx="2.6" ry="1.9" fill="'+L+'"/>';
    var my2 = my + ((k.muzzle || k.ears === 'bear' || k.ears === 'shiba' || k.ears === 'fox') ? 2.6 : 0);
    if(expr === 'happy' || expr === 'cheer'){
      o += '<path d="M45 '+my2+' Q50 '+(my2+7)+' 55 '+my2+' Z" fill="#F47C8C" stroke="'+L+'" stroke-width="1.8" stroke-linejoin="round"/>';
    }else if(expr === 'surprise'){
      o += '<ellipse cx="50" cy="'+(my2+2)+'" rx="2.6" ry="3.3" fill="'+L+'"/>';
    }else if(expr === 'sad'){
      o += '<path d="M46 '+(my2+3)+' Q50 '+my2+' 54 '+(my2+3)+'" fill="none" stroke="'+L+'" stroke-width="2" stroke-linecap="round"/>';
    }else if(expr === 'sleep'){
      o += '<circle cx="50" cy="'+(my2+1.5)+'" r="1.7" fill="'+L+'"/>';
    }else{
      o += '<path d="M46 '+my2+' Q48 '+(my2+3)+' 50 '+my2+' Q52 '+(my2+3)+' 54 '+my2+'" fill="none" stroke="'+L+'" stroke-width="1.9" stroke-linecap="round"/>';
    }
  }
  if(k.whisker){
    o += '<path d="M22 63 L31 64 M22 69 L31 68 M78 63 L69 64 M78 69 L69 68" stroke="'+L+'" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>';
  }
  if(expr === 'sleep'){
    o += '<text x="80" y="30" font-size="13" font-weight="700" fill="'+L+'" opacity=".7" font-family="sans-serif">z</text>'+
         '<text x="88" y="20" font-size="9" font-weight="700" fill="'+L+'" opacity=".5" font-family="sans-serif">z</text>';
  }
  return o;
}
function chArms(k, expr){
  if(k.ears === 'ghost') return '';
  var st = ' fill="'+(k.armFill || k.body)+'" stroke="'+k.line+'" stroke-width="2.4"';
  if(expr === 'cheer'){
    return '<ellipse cx="16" cy="50" rx="5.5" ry="8" transform="rotate(-30 16 50)"'+st+'/>'+
           '<ellipse cx="84" cy="50" rx="5.5" ry="8" transform="rotate(30 84 50)"'+st+'/>';
  }
  return '<ellipse cx="20" cy="72" rx="5.5" ry="4.5"'+st+'/><ellipse cx="80" cy="72" rx="5.5" ry="4.5"'+st+'/>';
}
function chProp(prop, k){
  var L = k.line;
  switch(prop){
    case 'book':  return '<g transform="translate(62 70)"><rect x="0" y="0" width="22" height="16" rx="2" fill="#7FB3E6" stroke="'+L+'" stroke-width="1.8"/><path d="M11 0 V16" stroke="'+L+'" stroke-width="1.4"/></g>';
    case 'umbrella': return '<g transform="translate(62 44)"><path d="M0 12 Q12 -6 24 12 Z" fill="#8EC9F2" stroke="'+L+'" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 12 V30 Q12 34 8 33" fill="none" stroke="'+L+'" stroke-width="1.8" stroke-linecap="round"/></g>';
    case 'coin':  return '<g transform="translate(66 70)"><circle cx="9" cy="9" r="9" fill="#F6C94A" stroke="'+L+'" stroke-width="1.8"/><text x="9" y="13" text-anchor="middle" font-size="10" font-weight="800" fill="'+L+'" font-family="sans-serif">¥</text></g>';
    case 'star':  return '<path d="M80 12 l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="#F7D35B" stroke="'+L+'" stroke-width="1.2" stroke-linejoin="round"/>';
    case 'heart': return '<path d="M82 18 c-2.5-4-9-3-9 2 c0 4 5 7 9 10 c4-3 9-6 9-10 c0-5-6.5-6-9-2z" fill="#F58CA8" stroke="'+L+'" stroke-width="1.2"/>';
    case 'cup':   return '<g transform="translate(64 72)"><path d="M0 0 H16 V8 Q16 15 8 15 Q0 15 0 8 Z" fill="#F3E3D3" stroke="'+L+'" stroke-width="1.8"/><path d="M16 3 Q21 3 21 7 Q21 10 16 10" fill="none" stroke="'+L+'" stroke-width="1.6"/><path d="M5 -3 q-2 -3 0 -6 M10 -3 q-2 -3 0 -6" stroke="'+L+'" stroke-width="1.2" fill="none" opacity=".5"/></g>';
    case 'pencil':return '<g transform="translate(66 60) rotate(35)"><rect x="0" y="0" width="6" height="22" rx="1" fill="#F7C95B" stroke="'+L+'" stroke-width="1.6"/><path d="M0 22 L3 28 L6 22 Z" fill="#F3DDC0" stroke="'+L+'" stroke-width="1.4" stroke-linejoin="round"/></g>';
    case 'moon':  return '<path d="M84 10 a8 8 0 1 0 6 12 a6.5 6.5 0 1 1 -6 -12z" fill="#F7E08A" stroke="'+L+'" stroke-width="1.2"/>';
    default: return '';
  }
}
function chSparkle(){
  var s = function(x, y, r, c){ return '<path d="M'+x+' '+(y-r)+' Q'+x+' '+y+' '+(x+r)+' '+y+' Q'+x+' '+y+' '+x+' '+(y+r)+' Q'+x+' '+y+' '+(x-r)+' '+y+' Q'+x+' '+y+' '+x+' '+(y-r)+'Z" fill="'+c+'"/>'; };
  return s(10, 22, 5, '#F7C94F') + s(90, 30, 4, '#F58CA8') + s(14, 86, 3.5, '#8EC9F2');
}
/* opt: { size, expr, prop, anim, id } */
function charaSvg(opt){
  opt = opt || {};
  var k = opt.id ? charaById(opt.id) : charaNow();
  var expr = opt.expr || 'normal', size = opt.size || 64;
  var svg = '<svg viewBox="0 0 100 100" width="'+size+'" height="'+size+'" aria-hidden="true" focusable="false">'+
    (expr === 'cheer' ? chSparkle() : '')+
    chEars(k)+chBody(k)+
    chFace(k, expr)+chArms(k, expr)+chProp(opt.prop, k)+'</svg>';
  return '<span class="chara'+(opt.anim ? ' anim-'+opt.anim : '')+'" title="'+esc(k.name)+'">'+svg+'</span>';
}

/* ===== ことば ===== */
/* その子らしい語尾をつける（「あるよ！」→「あるよ にゃ！」） */
function chTic(line){
  var k = charaNow();
  line = String(line || '');
  if(!k.tic || !line) return line;
  var m = line.match(/(…|！|!|。|？|\?)$/);
  var end = m ? m[1] : '';
  return line.slice(0, line.length - end.length) + ' ' + k.tic + (end === '。' ? '' : (end || '！'));
}
function charaLine(kind){
  var h = new Date().getHours(), td = today(), out = [];
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
            : h < 10 ? ['おはよう！今日もいっしょにがんばろ', 'おはよう。朝ごはん食べた？']
            : h < 14 ? ['こんにちは！ひとやすみしてる？', 'おひるごはん、なにたべた？']
            : h < 18 ? ['午後もあとすこし！', 'おやつの時間かも？']
            : h < 22 ? ['おつかれさま〜', '今日もえらかったね']
            : ['今日もおつかれさま。ゆっくり休んでね', 'あしたの準備、できた？'];
  var soft = ['水のんだ？', 'ちょっと休けいしよ', 'がんばりすぎないでね', 'できたことを数えてみよ', 'ぐーっとのびをしよ'];
  var allDone = S.tasks.length && !S.tasks.some(function(t){ return !t.done; });
  if(allDone) out.push('やることぜんぶ終わってる！すごい！');
  if(kind === 'greet') return chTic(out.length && Math.random() < .6 ? out[0] : greet[Math.floor(Math.random() * greet.length)]);
  var pool = out.concat(greet, soft);
  return chTic(pool[Math.floor(Math.random() * pool.length)]);
}

/* ===== 出てくる場所 ===== */
/* 今日の画面のあいさつ */
var __heroLine = { day:'', text:'' };
function charaHero(){
  if(charaLevel() < 1) return '';
  var td = today();
  if(__heroLine.day !== td + charaNow().id){ __heroLine = { day:td + charaNow().id, text:charaLine('greet') }; }
  var imp = charaLine('important');
  var text = imp || __heroLine.text;
  var prop = /雨/.test(text) ? 'umbrella' : /テスト|課題/.test(text) ? 'book' : /お金/.test(text) ? 'coin' : /すごい|えらかった/.test(text) ? 'star' : /寝よ|休んで/.test(text) ? 'moon' : '';
  var expr = /ピンチ|あぶない|休めない|すぎた/.test(text) ? 'sad' : /すごい|ファイト|がんばろ/.test(text) ? 'happy' : /寝よ|ねむく/.test(text) ? 'sleep' : 'normal';
  return '<div class="chhero" data-act="chara-talk" role="button" aria-label="'+esc(charaNow().name)+'と話す">'+
    '<div class="chbubble">'+esc(text)+'</div>'+
    charaSvg({ size:72, expr:expr, prop:prop, anim:'bounce' })+'</div>';
}
/* 何もない画面 */
function charaEmpty(){ return charaSvg({ size:64, expr:'sleep', anim:'sway' }); }
/* 小さな顔（トーストや相談のアイコン） */
function charaFace(expr, size){ return charaSvg({ size:size || 24, expr:expr || 'normal' }); }
/* お祝い */
var __cheerTimer = null;
function charaCheer(text, expr){
  if(charaLevel() < 2) return;
  var box = document.getElementById('chpop');
  if(!box){ box = document.createElement('div'); box.id = 'chpop'; box.setAttribute('aria-hidden', 'true'); document.body.appendChild(box); }
  box.innerHTML = '<div class="chbubble">'+esc(chTic(text || 'おつかれさま！'))+'</div>'+charaSvg({ size:96, expr:expr || 'cheer', prop:'star', anim:'jump' });
  box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
  clearTimeout(__cheerTimer);
  __cheerTimer = setTimeout(function(){ box.classList.remove('on'); }, 1900);
}
/* いつも画面のすみにいる子（たっぷりのとき） */
var __buddy = { shownDay:'', bubble:false };
function charaBuddy(){
  var el = document.getElementById('buddy');
  var on = charaLevel() >= 3 && appId !== 'chat';
  if(!on){ if(el) el.remove(); return; }
  if(!el){
    el = document.createElement('button');
    el.id = 'buddy'; el.type = 'button';
    el.addEventListener('click', function(){
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
  }else if(!el.innerHTML || el.dataset.cid !== charaNow().id){
    charaBuddyDraw(__buddy.bubble ? charaLine('any') : '');
  }
}
function charaBuddyDraw(text){
  var el = document.getElementById('buddy'); if(!el) return;
  el.dataset.cid = charaNow().id;
  el.innerHTML = (text ? '<span class="chbubble">'+esc(text)+'</span>' : '') +
    charaSvg({ size:58, expr:text ? 'happy' : 'normal', anim:'float' });
}
/* キャラの口調で相談に答える（たっぷり、または設定でオン） */
function charaTalkRule(){
  var c = charaCfg();
  if(c.level < 1 || !(c.talk || c.level >= 3)) return '';
  var k = charaNow();
  return '\n【話し方】あなたは、このアプリのキャラクター「' + k.name + '」（' + k.desc + '）として話す。' +
    'やさしく、短めに、かわいらしく。' + (k.tic ? '文の終わりに、ときどき「' + k.tic + '」をつける（毎回ではない）。' : '') +
    'ただし、お金・健康・締切などの大事な中身は正確に伝える。';
}

/* ===== 設定画面 ===== */
function charaSettings(){
  var c = charaCfg(), now = charaNow();
  var h = '<label class="f">出てくる量</label><div class="pillrow">'+
    CHARA_LEVELS.map(function(o){
      return '<button data-act="chara-level" data-v="'+o[0]+'" class="'+(c.level===o[0]?'on':'')+'">'+o[1]+'</button>';
    }).join('')+'</div>'+
    '<p class="note" style="margin:-4px 0 10px">'+
      ['キャラクターは出ません。',
       '今日の画面のあいさつと、何もない画面に出ます。',
       '＋お知らせ・課題が終わったときのお祝い・相談のアイコンにも出ます。',
       '＋画面のすみにいつもいて、タップすると話します。相談もキャラの口調で答えます。'][c.level]+'</p>';
  if(c.level > 0){
    h += '<label class="f">出し方</label><div class="pillrow">'+
      [['one','いつも同じ子'],['daily','日替わり'],['random','開くたびにランダム']].map(function(o){
        return '<button data-act="chara-mode" data-v="'+o[0]+'" class="'+(c.mode===o[0]?'on':'')+'">'+o[1]+'</button>';
      }).join('')+'</div>'+
      '<p class="note" style="margin:-4px 0 10px">'+(c.mode === 'one' ? '下から好きな子を選んでください。' : 'チェックした子の中から出ます（'+c.friends.length+'ひき）。')+'</p>'+
      '<div class="chgrid">'+CHARAS.map(function(k){
        var sel = (c.mode === 'one') ? (c.main === k.id) : (c.friends.indexOf(k.id) >= 0);
        return '<button data-act="chara-pick" data-id="'+k.id+'" class="'+(sel?'on':'')+'" aria-pressed="'+(sel?'true':'false')+'">'+
          (c.mode !== 'one' ? '<span class="chk2">'+(sel?'✓':'')+'</span>' : '')+
          charaSvg({ id:k.id, size:56, expr: sel ? 'happy' : 'normal' })+
          '<span class="chname">'+esc(k.name)+'</span><span class="chdesc">'+esc(k.desc)+'</span></button>';
      }).join('')+'</div>'+
      '<label class="f" style="margin-top:10px">いまの子：'+esc(now.name)+'</label>'+
      '<div class="chexpr">'+['normal','happy','wink','surprise','sleep','sad','cheer'].map(function(e){
        return charaSvg({ id:now.id, size:44, expr:e });
      }).join('')+'</div>'+
      '<div class="pillrow" style="margin-top:8px">'+
        '<button data-act="chara-talk">話しかけてみる</button>'+
        '<button data-act="chara-talkai" class="'+(c.talk || c.level >= 3 ? 'on' : '')+'">'+(c.level >= 3 ? '相談もこの子の口調（たっぷりでは常にオン）' : '相談もこの子の口調で')+'</button>'+
      '</div>';
  }
  h += '<p class="note">どの子も、このアプリのために作ったオリジナルのキャラクターです。</p>';
  return h;
}
function charaSet(patch){
  S.ui.chara = Object.assign({}, S.ui.chara || {}, patch);
  touch('ui');
}
function charaAction(act, t){
  if(act === 'chara-level'){ charaSet({ level:toNum(t.dataset.v) }); commit(); return true; }
  if(act === 'chara-mode'){ charaSet({ mode:t.dataset.v }); __charaRandom = null; commit(); return true; }
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
  if(act === 'chara-talk'){ charaCheer(charaLine('any'), 'happy'); if(charaLevel() < 2) toast(charaLine('any')); return true; }
  if(act === 'chara-talkai'){ charaSet({ talk: charaCfg().talk ? 0 : 1 }); commit(); return true; }
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
