/* くらしの手帳：AIが、アプリの中身をぜんぶ調べられるようにする */
/* ============================== 分野 ==============================
   AIそうだんは、はじめに渡す「要約」（chatContext）に加えて、下の道具で手帳の中身をいつでも調べられる。
   ・app_overview  … 目次（分野ごとの件数・今日と明日）
   ・get_app_data  … 分野を指定して読む（日付・ことば・件数でしぼれる）
   ・search_app    … ことばで、ぜんぶの分野をさがす
   S のすべてのキーは、どこかの分野に入れるか、AI_EXCLUDE に理由を書いて外す（テストで確かめる）。
   カギ・合言葉・同期の部屋の名前は、どの分野にも出さない。 */
var AI_SECTIONS = [
  { id:'events',    name:'予定',             keys:['events'] },
  { id:'exams',     name:'テスト・小テスト', keys:['exams','progress','examPlan'] },
  { id:'tasks',     name:'課題・やること',   keys:['tasks','taskLog','suggests'] },
  { id:'timetable', name:'時間割・学期',     keys:['terms','termsList','termId','termsDone','commute','biweek','holidays','breaks'] },
  { id:'courses',   name:'授業・出欠・成績', keys:['courseMeta','syllabus','grades','attendLog','attend','risyu'] },
  { id:'notes',     name:'メモ・お知らせ',   keys:['notes','memos','notices'] },
  { id:'money',     name:'お金・家計簿',     keys:['spends','plans','paid','statements','income','fixed','balances','payApplied'] },
  { id:'work',      name:'バイト',           keys:['shifts'] },
  { id:'health',    name:'健康',             keys:['health','healthLog','vaccines'] },
  { id:'study',     name:'暗記・勉強',       keys:['cards','studyLog','books','papers','abbrs','anatomy'] },
  { id:'kokushi',   name:'国試の問題と記録', keys:['kqs','kqLog'] },
  { id:'pet',       name:'おせわ（育てている子）', keys:['pets','petDays'] },
  { id:'chara',     name:'キャラクターのセリフ', keys:['charaTalk'] },
  { id:'transit',   name:'通学・交通',       keys:['transit','transitLog'] },
  { id:'reviews',   name:'ふりかえり',       keys:['dayReview','weekReview'] },
  { id:'anniv',     name:'誕生日・記念日',   keys:['annivs'] },
  { id:'more',      name:'足した機能の記録（生理周期・シフト希望・おせわの図鑑 など）', keys:['kmItems','kmData'] },
  { id:'ai',        name:'AIとの相談の記録', keys:['chat','chatRooms','chatMeta','chatQuick','aiMemo','aiFeedback','aiLog','aiUse'] },
  { id:'settings',  name:'設定（カギはのぞく）', keys:['settings','ui','cloud'] },
  { id:'trash',     name:'ゴミ箱（30日）',   keys:['trash'] }
];
/* 分野に入れないもの（中身ではない・大事なカギ） */
var AI_EXCLUDE = {
  meta:'同期のための時刻', deleted:'消したものの印', delAt:'消した時刻の印', revAt:'もどした時刻の印',
  ver:'データの版', backupAt:'バックアップした時刻'
};
/* 足した機能が出す数字（kmAiData）の分野：
   kmAiData(name, desc, fn, section) の4つめ・fn.section・KM.aiData[name].section のどれでもよい。
   分野がないとき・知らない分野のときは「暗記・勉強」に出す（前からの決まり）。 */
var C9_AI_DEFAULT_SEC = 'study';
if(typeof kmAiData === 'function' && typeof KM !== 'undefined'){
  kmAiData = (function(orig){
    return function(name, desc, fn, section){
      orig(name, desc, fn);
      if(section && KM.aiData[name]) KM.aiData[name].section = String(section);
    };
  })(kmAiData);
}
function c9AiSectionOf(ad){
  var s = String((ad && (ad.section || (ad.fn && ad.fn.section))) || '');
  return AI_SECTIONS.some(function(x){ return x.id === s; }) ? s : C9_AI_DEFAULT_SEC;
}
/* 足した機能が出している数字の名前の一覧（目次に出す） */
function c9AiExtras(){
  if(typeof KM === 'undefined') return [];
  return Object.keys(KM.aiData).sort().map(function(nm){
    var ad = KM.aiData[nm] || {};
    return { name:nm, desc:String(ad.desc || ''), section:c9AiSectionOf(ad) };
  });
}
/* ことばをくらべる形（ひらがな・カタカナ、全角・半角のちがいをなくす。検索の担当の c9Norm があればそれを使う） */
function c9AiNorm(s){
  if(typeof c9Norm === 'function') return c9Norm(s);
  s = String(s == null ? '' : s);
  try{ s = s.normalize('NFKC'); }catch(e){}
  return s.toLowerCase();
}
/* どの深さでも出さないキー（カギ・合言葉・同期の部屋） */
var AI_SECRET = /^(apiKey|geminiKey|deeplKey|token|shortKey|fbConfig|password|secret|vapid|webhook|discordUrl|gasUrl)$/i;
/* 設定の中だけで外すもの（room は同期の部屋の名前。授業の room＝教室 は外さない） */
var AI_SECRET_SETTINGS = ['room'];

function aiSan(v, depth){
  depth = depth || 0;
  if(v == null) return v;
  if(typeof v === 'string'){
    if(/^data:[^;]+;base64,/.test(v)) return '[画像・ファイル]';
    return v.length > 1500 ? v.slice(0, 1500) + '…（長いので省略）' : v;
  }
  if(typeof v !== 'object') return v;
  if(depth > 6) return '…';
  if(Array.isArray(v)) return v.map(function(x){ return aiSan(x, depth + 1); });
  var o = {};
  Object.keys(v).forEach(function(k){
    if(AI_SECRET.test(k)) return;
    if(k === 'photos' && Array.isArray(v[k])){ o.photos = v[k].length + '枚'; return; }
    if(k === 'by' || k === 'byAt') return;               /* どの端末で直したか（中身ではない） */
    o[k] = aiSan(v[k], depth + 1);
  });
  return o;
}
function aiItemDate(x){
  if(!x || typeof x !== 'object') return '';
  return String(x.date || x.due || x.start || x.from || x.first || x.last || '').slice(0, 10);
}
function aiItemText(x){ try{ return JSON.stringify(x); }catch(e){ return ''; } }
/* 1つの分野を読む。opt: { from, to, query, limit } */
function aiSectionData(id, opt){
  opt = opt || {};
  var sec = AI_SECTIONS.filter(function(s){ return s.id === id; })[0];
  if(!sec) return { error:'知らない分野です：' + id, sections:AI_SECTIONS.map(function(s){ return s.id; }) };
  var limit = Math.max(1, Math.min(200, toNum(opt.limit) || 60));
  var q = c9AiNorm(String(opt.query || '').trim());
  var from = isYmd(opt.from) ? opt.from : '', to = isYmd(opt.to) ? opt.to : '';
  var out = { section:id, name:sec.name, data:{} };
  sec.keys.forEach(function(k){
    var v = S[k];
    if(Array.isArray(v)){
      var list = v.filter(function(x){
        var d = aiItemDate(x);
        if((from || to) && isYmd(d)){ if(from && d < from) return false; if(to && d > to) return false; }
        if(q && c9AiNorm(aiItemText(x)).indexOf(q) < 0) return false;
        return true;
      });
      /* 日付があるものは近い順（これから→すぎた）に、ないものは新しい順に */
      var td = today();
      list = list.slice().sort(function(a, b){
        var da = aiItemDate(a), db = aiItemDate(b);
        if(isYmd(da) && isYmd(db)){
          var fa = da >= td, fb = db >= td;
          if(fa !== fb) return fa ? -1 : 1;
          return fa ? da.localeCompare(db) : db.localeCompare(da);
        }
        return (toNum(b && b.mt) || 0) - (toNum(a && a.mt) || 0);
      });
      out.data[k] = { total:v.length, shown:Math.min(limit, list.length), items:aiSan(list.slice(0, limit)) };
    }else if(v && typeof v === 'object'){
      var keys = Object.keys(v).filter(function(kk){
        if(AI_SECRET.test(kk)) return false;
        if((from || to) && /^\d{4}-\d{2}-\d{2}/.test(kk)){ var d2 = kk.slice(0, 10); if(from && d2 < from) return false; if(to && d2 > to) return false; }
        if(q && c9AiNorm(kk + aiItemText(v[kk])).indexOf(q) < 0) return false;
        return true;
      }).sort().reverse();
      var obj = {};
      keys.slice(0, limit * 3).forEach(function(kk){ obj[kk] = v[kk]; });
      out.data[k] = { total:Object.keys(v).length, shown:Math.min(keys.length, limit * 3), items:aiSan(obj) };
    }else{
      out.data[k] = aiSan(v);
    }
  });
  if(out.data.settings && out.data.settings.items) AI_SECRET_SETTINGS.forEach(function(k){ delete out.data.settings.items[k]; });
  /* 分野ごとに、画面で計算して出している大事な数字も足す */
  try{
    if(id === 'timetable'){
      out.today = today();
      out.courses = termCourses().map(function(c){ return { name:c.name, slots:c.slots, room:c.room || '', web:!!c.web, bi:!!c.bi, cr:c.cr }; });
      out.periods = PERIODS.map(function(p){ return { period:p, start:S.commute.periods[p - 1], end:S.commute.ends[p - 1] }; });
      out.nextDays = [];
      for(var i = 0; i < 14; i++){
        var d = shiftDate(today(), i);
        out.nextDays.push({ date:d, classes:classesForDate(d).map(function(c){ return { period:c.period, name:c.name, off:c.off || '' }; }) });
      }
    }
    if(id === 'courses') out.attendance = termCourses().map(function(c){ return Object.assign({ name:c.name }, attendOf(c.name)); });
    if(id === 'money' && typeof budget === 'function'){ var b = budget(); out.budget = { month:b.month, free:b.free, balance:b.balance, word:b.word }; }
    if(id === 'work' && typeof periodPay === 'function'){ var ym = openYm(); out.pay = { period:payPeriod(ym), count:shiftsInPeriod(ym).length, expect:periodPay(ym) }; }
    if(id === 'study' && typeof ankiDueList === 'function') out.today = { due:ankiDueList('').length, studied:ankiCountOn(today()), streak:ankiStreak() };
    if(id === 'pet' && typeof petNow === 'function'){ var pid = petActiveId(); out.now = { id:pid, state:aiSan(petNow(pid)), coins:petCoins() }; }
  }catch(e){ out.note = '一部の計算ができませんでした：' + (e && e.message || e); }
  /* 足した機能が出す数字（kmAiData） */
  if(typeof KM !== 'undefined'){
    Object.keys(KM.aiData).forEach(function(nm){
      var ad = KM.aiData[nm];
      if(c9AiSectionOf(ad) !== id) return;
      try{ out[nm] = aiSan(ad.fn(opt)); }catch(e){ out[nm] = { error:String(e && e.message || e) }; }
    });
  }
  return out;
}
/* 目次 */
function aiOverview(){
  var o = { today:today(), now:pad(new Date().getHours()) + ':' + pad(new Date().getMinutes()), sections:[] };
  AI_SECTIONS.forEach(function(s){
    var n = 0;
    s.keys.forEach(function(k){ var v = S[k]; n += Array.isArray(v) ? v.length : (v && typeof v === 'object') ? Object.keys(v).length : (v != null ? 1 : 0); });
    o.sections.push({ id:s.id, name:s.name, count:n });
  });
  try{
    o.todayClasses = classesForDate(today()).map(function(c){ return c.period + '限 ' + c.name + (c.off ? '（' + c.off + '）' : ''); });
    o.tomorrowClasses = classesForDate(shiftDate(today(), 1)).map(function(c){ return c.period + '限 ' + c.name + (c.off ? '（' + c.off + '）' : ''); });
  }catch(e){}
  /* 足した機能が出している数字（get_app_data で、その分野を読むと出てくる） */
  o.extras = c9AiExtras();
  if(o.extras.length) o.extrasNote = 'extras の数字は、get_app_data で section を指定して読むと、名前のところに出てきます。';
  return o;
}
/* ことばで、ぜんぶをさがす */
function aiSearchAll(query, limit){
  var q = c9AiNorm(String(query || '').trim());
  if(!q) return { error:'さがすことばがありません' };
  limit = Math.max(1, Math.min(80, toNum(limit) || 40));
  var hits = [];
  AI_SECTIONS.forEach(function(s){
    if(s.id === 'settings') return;
    s.keys.forEach(function(k){
      var v = S[k];
      var push = function(item, key){
        if(hits.length >= limit) return;
        var txt = aiItemText(item);
        var at = c9AiNorm(txt).indexOf(q);
        if(at < 0) return;
        hits.push({ section:s.id, key:k, id:(item && item.id) || key || '', date:aiItemDate(item),
          title:String((item && (item.title || item.name || item.q || item.text || item.subject)) || key || '').slice(0, 80),
          snippet:txt.slice(Math.max(0, at - 60), at + 140).replace(/data:[^"]+/g, '[画像]') });
      };
      if(Array.isArray(v)) v.forEach(function(x){ push(x); });
      else if(v && typeof v === 'object') Object.keys(v).forEach(function(kk){ if(!AI_SECRET.test(kk)) push(v[kk], kk); });
    });
  });
  return { query:query, count:hits.length, hits:hits };
}
/* 道具（Geminiの関数）。読むだけなので、「直接登録」がオフでも使う */
var AI_DATA_FUNCS = [
  { name:'app_overview', description:'手帳の目次を見る（分野ごとの件数、今日と明日の授業、足した機能が出している数字の名前と分野）。何があるか分からないとき、最初に使う。',
    parameters:{ type:'OBJECT', properties:{ detail:{ type:'BOOLEAN', description:'くわしく見るなら true（なくてもよい）' } } } },
  { name:'get_app_data', description:'手帳の中身を分野ごとに読む。予定・課題・お金・家計簿の明細・暗記カード・国試・メモの全文・おせわ・健康・設定など、アプリにあるものはぜんぶ読める。日付やことばでしぼれる。',
    parameters:{ type:'OBJECT', properties:{
      section:{ type:'STRING', enum:AI_SECTIONS.map(function(s){ return s.id; }), description:AI_SECTIONS.map(function(s){ return s.id + '=' + s.name; }).join('、') },
      from:{ type:'STRING', description:'この日から（YYYY-MM-DD）。なければ空' }, to:{ type:'STRING', description:'この日まで（YYYY-MM-DD）。なければ空' },
      query:{ type:'STRING', description:'ふくまれることばでしぼる。なければ空' }, limit:{ type:'NUMBER', description:'最大の件数（ふつう60）' } },
      required:['section'] } },
  { name:'search_app', description:'ことばで、手帳のぜんぶの分野をさがす（予定・課題・メモ・暗記カード・国試・家計簿・おせわ など）。',
    parameters:{ type:'OBJECT', properties:{ query:{ type:'STRING', description:'さがすことば' } }, required:['query'] } }
];
var AI_DATA_NAMES = AI_DATA_FUNCS.map(function(f){ return f.name; });
/* 答えは大きくなりすぎないように切る（AIに返す文） */
function aiDataRun(call){
  var a = call.args || {}, r;
  if(call.name === 'app_overview') r = aiOverview();
  else if(call.name === 'get_app_data') r = aiSectionData(a.section, a);
  else if(call.name === 'search_app') r = aiSearchAll(a.query, a.limit);
  else return null;
  var s = JSON.stringify(r);
  if(s.length > 40000) s = s.slice(0, 40000) + '…（多いので切りました。日付やことばでしぼって、もう一度読んでください）';
  return { result:s };
}
/* 分野の一覧（相談のはじめにAIへ渡す） */
function aiIndexText(){
  return AI_SECTIONS.map(function(s){
    var n = 0;
    s.keys.forEach(function(k){ var v = S[k]; n += Array.isArray(v) ? v.length : (v && typeof v === 'object') ? Object.keys(v).length : 0; });
    return s.id + '（' + s.name + '・' + n + '）';
  }).join('、');
}
