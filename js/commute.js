/* くらしの手帳：授業の取り出し・出発時刻・天気・交通 */
/* ============================== 授業の取り出し ============================== */
/* 後期の時間割（登録済み＋抽選で選んだ科目）を 曜日+限 で引けるようにする */
function laterTermMap(){
  var m = {};
  FIXED.forEach(function(f){
    f.slots.forEach(function(s){
      m[s.d+s.p] = { name:f.name, kind:'fixed', room:f.room||'', req:f.req, bi:f.bi, web:f.web, cr:f.cr };
    });
  });
  rSelected().forEach(function(c){
    c.slots.forEach(function(s){ m[s.d+s.p] = { name:c.name, kind:'sel', code:c.code, room:'', req:0 }; });
  });
  return m;
}
function courseList(){
  var out = [], seen = {};
  FIXED.forEach(function(f){ if(!seen[f.name]){ seen[f.name]=1; out.push({ key:f.name, name:f.name }); } });
  rSelected().forEach(function(c){ if(!seen[c.name]){ seen[c.name]=1; out.push({ key:c.name, name:c.name }); } });
  return out;
}
function classesOn(dayChar){
  var m = laterTermMap(), out = [];
  PERIODS.forEach(function(p){
    var c = m[dayChar+p];
    if(c) out.push({ period:p, name:c.name, room:c.room||'', web:c.web?1:0, req:c.req, bi:c.bi });
  });
  return out;
}
/* 通学が必要な授業だけ（WEBの遠隔授業は家で受けるので除く） */
function schoolClassesOn(dayChar){
  return classesOn(dayChar).filter(function(c){ return !c.web; });
}

/* ============================== 出発時刻 ============================== */
function commuteTotal(){
  var c = S.commute;
  return toNum(c.walk)+toNum(c.bus)+toNum(c.change)+toNum(c.train)+toNum(c.toSchool)+toNum(c.buffer);
}
function departureFor(period){
  var start = minutesOf(S.commute.periods[period-1]);
  if(start == null) return null;
  var total = commuteTotal();
  return { leave: hhmmOf(start - total), start: hhmmOf(start), total: total,
           prevDay: (start - total) < 0 };   /* 通学が長すぎて前日にまわる場合 */
}

/* ============================== 天気 ============================== */
var SANDA = { lat:34.8883, lon:135.2264, name:'三田' };
var SCHOOL = { lat:34.7188, lon:135.3606, name:'西宮' };
function weatherWord(code){
  if(code===0) return '快晴';
  if(code<=2) return '晴れ';
  if(code===3) return 'くもり';
  if(code===45||code===48) return '霧';
  if(code>=51&&code<=57) return '霧雨';
  if(code>=61&&code<=67) return '雨';
  if(code>=71&&code<=77) return '雪';
  if(code>=80&&code<=82) return 'にわか雨';
  if(code>=85&&code<=86) return 'にわか雪';
  if(code>=95) return '雷雨';
  return '';
}
async function loadWeather(){
  if(!S.ui.weather){ weather.state='off'; return; }
  weather.state = 'loading';
  var url = function(p){
    return 'https://api.open-meteo.com/v1/forecast?latitude='+p.lat+'&longitude='+p.lon+
      '&current=temperature_2m,weather_code,precipitation'+
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,snowfall_sum,precipitation_sum'+
      '&hourly=visibility,snowfall,weather_code,precipitation_probability&timezone=Asia%2FTokyo&forecast_days=2';
  };
  try{
    var res = await Promise.all([fetch(url(SANDA)), fetch(url(SCHOOL))]);
    if(!res[0].ok || !res[1].ok) throw new Error('status');
    var js = await Promise.all([res[0].json(), res[1].json()]);
    weather.sanda = js[0]; weather.school = js[1];
    weather.state = 'ok';
    weather.alert = busAlert(js[0]);
  }catch(e){
    weather.state = 'ng';
    weather.msg = '天気を取れませんでした';
  }
  if(appId === 'today'){ if(isTyping()) renderLater(); else render(); }
}
function busAlert(w){
  try{
    var d = w.daily, h = w.hourly;
    var code = d.weather_code[0];
    var snowSum = Number(d.snowfall_sum ? d.snowfall_sum[0] : 0) || 0;
    var lowVis = false, snowHour = false;
    if(h && h.time){
      for(var i=0;i<h.time.length && i<12;i++){
        var hh = Number(String(h.time[i]).slice(11,13));
        if(hh < 5 || hh > 11) continue;               /* 通学時間帯だけ見る */
        if(Number(h.visibility[i]) < 1000) lowVis = true;
        if(Number(h.snowfall[i]) > 0) snowHour = true;
      }
    }
    if(snowSum > 0 || snowHour || (code>=71&&code<=77) || code===85 || code===86)
      return '雪の予報です。三田からのバスが遅れることがあります。早めに出るか、電車への振り替えも考えてください。';
    if(lowVis || code===45 || code===48)
      return '朝は霧が出そうです。三田の山あいは見通しが悪くなり、バスが遅れることがあります。';
    if(code>=95) return '雷雨の予報です。バス・電車とも遅れる可能性があります。';
    return '';
  }catch(e){ return ''; }
}
function umbrellaInfo(){
  if(weather.state !== 'ok') return null;
  try{
    var a = weather.sanda, b = weather.school;
    var pa = a.daily.precipitation_probability_max ? a.daily.precipitation_probability_max[0] : 0;
    var pb = b.daily.precipitation_probability_max ? b.daily.precipitation_probability_max[0] : 0;
    var pop = Math.max(Number(pa)||0, Number(pb)||0);
    var rain = Math.max(Number((a.daily.precipitation_sum||[0])[0])||0, Number((b.daily.precipitation_sum||[0])[0])||0);
    /* 通学時間帯（6〜20時）にいちばん降りそうな時間 */
    var peak = null;
    [a,b].forEach(function(w){
      var h = w.hourly;
      if(!h || !h.time) return;
      for(var i=0;i<h.time.length;i++){
        var hh = Number(String(h.time[i]).slice(11,13));
        if(hh < 6 || hh > 20) continue;
        var v = Number(h.precipitation_probability[i]) || 0;
        if(!peak || v > peak.v) peak = { v:v, at:String(h.time[i]).slice(11,16) };
      }
    });
    var need = pop >= 50 || rain >= 1;
    var maybe = !need && pop >= 30;
    return { pop:pop, rain:rain, peak:peak, need:need, maybe:maybe };
  }catch(e){ return null; }
}
function weatherCard(){
  if(weather.state === 'loading') return '<div class="s2 wx" style="margin-top:6px">天気を確認しています…</div>';
  if(weather.state === 'ng') return '<div class="s2 wx" style="margin-top:6px">天気は取れませんでした</div>';
  if(weather.state !== 'ok') return '';
  try{
    var a = weather.sanda, b = weather.school;
    var u = umbrellaInfo();
    var cur = a.current ? Math.round(a.current.temperature_2m) : null;
    var curB = b.current ? Math.round(b.current.temperature_2m) : null;
    var h = '<div class="wxrow">'+
      wxCell('三田（家）', a, cur) +
      wxCell('西宮（大学）', b, curB) + '</div>';
    if(u){
      var cls = u.need ? 'red' : u.maybe ? 'amber' : 'green';
      var msg = u.need ? '<b>傘を持って行ってください。</b>'
              : u.maybe ? '雨が降るかもしれません。折りたたみ傘があると安心です。'
              : '傘は要りません。';
      h += '<div class="bn '+cls+'" style="margin:10px 0 0"><span class="ic">'+(u.need?'☔':u.maybe?'🌂':'☀')+'</span>'+
        '<span>'+msg+'　降水'+u.pop+'%'+(u.peak && u.peak.v>=30 ? '（'+u.peak.at+'ごろがいちばん高い）' : '')+'</span></div>';
    }
    h += rainGraph(a);
    return h;
  }catch(e){ return ''; }
}
/* 時間別の降水確率グラフ（6〜21時） */
function rainGraph(w){
  try{
    var h = w.hourly, td = today(), out = [];
    for(var i=0;i<h.time.length;i++){
      var t = String(h.time[i]); if(t.slice(0,10) !== td) continue;
      var hh = Number(t.slice(11,13)); if(hh < 6 || hh > 21) continue;
      out.push({ h:hh, v:Number(h.precipitation_probability[i])||0 });
    }
    if(!out.length) return '';
    return '<div class="rg">'+out.map(function(x){
      var col = x.v>=60 ? 'var(--rakuten)' : x.v>=30 ? 'var(--warn)' : 'var(--e6)';
      return '<div class="rgc"><div class="rgb" style="height:'+Math.max(3, Math.round(x.v*0.4))+'px;background:'+col+'"></div><div class="rgl">'+x.h+'</div></div>';
    }).join('')+'</div><div class="s2">時間ごとの降水確率（%）</div>';
  }catch(e){ return ''; }
}
/* 明日の雨予報（1本早い便を勧める） */
function tomorrowRain(){
  if(weather.state !== 'ok') return null;
  try{
    var w = weather.sanda, d = w.daily;
    if(!d.time || d.time.length < 2) return null;
    var pop = Number(d.precipitation_probability_max[1]) || 0;
    return { pop:pop, need: pop >= 50 };
  }catch(e){ return null; }
}
function wxCell(label, w, cur){
  var d = w.daily;
  var mx = Math.round(d.temperature_2m_max[0]), mn = Math.round(d.temperature_2m_min[0]);
  return '<div class="wxcell"><div class="k">'+esc(label)+'</div>'+
    '<div class="now">'+(cur!=null?cur+'℃':'—')+'</div>'+
    '<div class="k">'+esc(weatherWord(d.weather_code[0]))+'　最高'+mx+'／最低'+mn+'</div></div>';
}

/* ============================== 交通・乗り換え ============================== */
/* 通学する次の日 */
function nextSchoolDay(){
  for(var i=1;i<=14;i++){
    var d = shiftDate(today(), i);
    if(schoolClassesForDate(d).length) return { date:d, inDays:i };
  }
  return null;
}
function transitFor(ymd){
  if(schoolClassesForDate(ymd).length) return transitBody(ymd);
  if(ymd !== today()) return '';
  var nx = nextSchoolDay();
  return nx ? transitBody(nx.date) : '';
}
function transitCard(){
  var td = today();
  var cls = schoolClassesForDate(td);
  var header = '';
  var target = td;
  if(!cls.length){
    var nx = nextSchoolDay();
    if(!nx) return '';
    target = nx.date;
    header = '';
  }
  return header + transitBody(target);
}
function transitBody(ymd){
  var cls = schoolClassesForDate(ymd);
  if(!cls.length) return '';
  var first = cls[0], last = cls[cls.length-1];
  var startMin = minutesOf(S.commute.periods[first.period-1]);
  var endMin   = minutesOf(S.commute.ends[last.period-1]);
  if(startMin == null || endMin == null) return '';

  var shift = S.shifts.filter(function(w){ return w.date === ymd && minutesOf(w.start) != null; })[0];
  var isToday = (ymd === today());
  var nowMin = (new Date()).getHours()*60 + (new Date()).getMinutes();
  /* 今日なら時間で出し分け。授業開始までは「行き」、始まったら「帰り」 */
  var mode = 'go';
  if(isToday && nowMin >= startMin) mode = 'back';

  var line = function(p, kind){
    var busTxt = p.bus ? (p.bus.dep+' 発 → '+p.bus.arr+' 着') : 'この時間のバスは未登録';
    var head = kind==='go'
      ? '<span class="trtag'+(p.ok?'':' ng')+'">'+esc(p.tag)+'</span>'
      : '<span class="trtag'+(p.tag==='ちょうど'?' on':'')+'">'+esc(p.tag)+'</span>';
    var rows = kind==='go'
      ? '<div class="trline"><span class="trk">バス</span><span>弥生ヶ丘五丁目 '+busTxt+'</span></div>'+
        '<div class="trline"><span class="trk">電車</span><span>三ノ宮 '+p.train.dep+' 発 → 鳴尾 '+p.train.arr+' 着</span></div>'
      : '<div class="trline"><span class="trk">電車</span><span>鳴尾 '+p.train.dep+' 発 → 三ノ宮 '+p.train.arr+' 着</span></div>'+
        '<div class="trline"><span class="trk">バス</span><span>三ノ宮 '+busTxt+'</span></div>';
    var favKey = kind+':'+(p.bus?p.bus.dep:'')+':'+p.train.dep;
    var isFav = (S.transit.fav||[]).indexOf(favKey) >= 0;
    return '<div class="trplan'+(kind==='go'&&!p.ok?' ng':'')+'">'+head+
      '<button class="mini" style="float:right" data-act="tr-fav" data-key="'+favKey+'">'+(isFav?'★':'☆')+'</button>'+rows+
      (kind==='go'&&!p.ok?'<div class="trwarn">'+first.period+'限に間に合いません</div>':'')+'</div>';
  };

  var h = '';
  var rainTomorrow = tomorrowRain();
  var isTomorrow = (ymd === shiftDate(today(),1));
  var rn = umbrellaInfo();
  if((isTomorrow && rainTomorrow && rainTomorrow.need) || (ymd===today() && rn && rn.need)){
    h += '<div class="bn amber"><span class="ic">☔</span><span>雨の予報です。バスが遅れがちなので、15分早めに着く便を出しています。</span></div>';
  }
  var offs = classesForDate(ymd).filter(function(c){ return c.off; });

  if(mode === 'go'){
      var rainNow = umbrellaInfo();
    var early = (isTomorrow && rainTomorrow && rainTomorrow.need) || (ymd===today() && rainNow && rainNow.need);
    var gos = goPlans(startMin - 30 - (early ? 15 : 0), startMin);
    h += section(isToday ? '大学への行き方' : '次に大学へ行く日の行き方', ymdLabel(ymd),
      '<div class="stat" style="margin-bottom:12px">'+
        '<div class="k">最初は'+first.period+'限 '+S.commute.periods[first.period-1]+'開始（'+esc(first.room||'')+'）</div>'+
        '<div class="v">'+hhmmOf(startMin-30)+' までに鳴尾・武庫川女子大前へ</div></div>'+
      (gos.length ? gos.map(function(p){ return line(p,'go'); }).join('') : '<div class="empty">この時間のダイヤは未登録です。</div>')+
      (offs.length ? '<p class="note">'+offs.map(function(c){ return c.name+'（'+(c.off==='cancel'?'休講':'隔週で今週なし')+'）'; }).join('、')+' を除いて計算しています。</p>' : ''));
    return h;
  }

  /* 帰り：バイトがある日はバイト先まで、なければ家まで */
  if(shift){
    var need = minutesOf(shift.start) - (toNum(S.transit.workBuffer)||10);
    var wps = workPlans(endMin + 20, need);
    h += section('バイトへの行き方', esc(shift.title||S.settings.shop||'バイト')+' '+shift.start+'〜',
      '<div class="stat" style="margin-bottom:12px">'+
        '<div class="k">'+last.period+'限 '+S.commute.ends[last.period-1]+'終わり</div>'+
        '<div class="v">'+shift.start+' までにイオンモール神戸北へ</div></div>'+
      (wps.length ? wps.map(function(p){
        return '<div class="trplan'+(p.ok?'':' ng')+'"><span class="trtag'+(p.ok?' on':' ng')+'">'+esc(p.tag)+'</span>'+
          '<div class="trline"><span class="trk">電車</span><span>鳴尾・武庫川女子大前 '+p.train.dep+' 発 → 神戸三宮 '+p.train.arr+' 着</span></div>'+
          '<div class="trline"><span class="trk">バス</span><span>三ノ宮 '+p.bus.dep+' 発 → イオンモール神戸北 '+p.bus.arr+' 着</span></div>'+
          (p.ok?'':'<div class="trwarn">開始に間に合いません</div>')+'</div>';
      }).join('') : '<div class="empty">この時間のダイヤは未登録です。</div>')+
      '<p class="note">開始の'+(toNum(S.transit.workBuffer)||10)+'分前までに着く便を選んでいます。</p>');
    return h;
  }

  var backs = backPlans(endMin + 20);
  h += section('帰り方', ymdLabel(ymd),
    '<div class="stat" style="margin-bottom:12px">'+
      '<div class="k">'+last.period+'限 '+S.commute.ends[last.period-1]+'終わり</div>'+
      '<div class="v">'+hhmmOf(endMin+20)+' に鳴尾を出る</div></div>'+
    (backs.length ? backs.map(function(p){ return line(p,'back'); }).join('') : '<div class="empty">この時間のダイヤは未登録です。</div>'));
  return h;
}

/* ===== 時刻を決めて調べる（寄り道・自由な行き先） ===== */
var findFrom = 'home', findTo = 'univ', findTime = '', findMode = 'dep', findDate = '';
var PLACES = { home:'家（弥生ヶ丘五丁目）', sannomiya:'三ノ宮', univ:'鳴尾・武庫川女子大前', work:'イオンモール神戸北' };
function findCard(){
  var now = new Date();
  var tm = findTime || '';   /* 最初は空のまま */
  var pick = function(id, cur, act){
    return '<select data-act="'+act+'" id="'+id+'">'+Object.keys(PLACES).map(function(k){
      return '<option value="'+k+'"'+(cur===k?' selected':'')+'>'+esc(PLACES[k])+'</option>';
    }).join('')+'</select>';
  };
  var res = tm ? findRoute(findFrom, findTo, tm, findMode) : '';
  return secWrap('find', '時間を決めて調べる', null,
    '<div class="pillrow" style="margin-bottom:9px">'+
      '<button class="mini" data-act="fd-preset" data-v="work">バイト（三ノ宮→イオン）</button>'+
      '<button class="mini" data-act="fd-preset" data-v="go">通学（家→大学）</button>'+
      '<button class="mini" data-act="fd-preset" data-v="back">帰り（大学→家）</button>'+
    '</div>'+
    '<div class="pair" style="margin-bottom:11px">'+
      '<div><label class="f">どこから</label>'+pick('fd_from', findFrom, 'fd-from')+'</div>'+
      '<div><label class="f">どこまで</label>'+pick('fd_to', findTo, 'fd-to')+'</div></div>'+
    '<div class="pillrow">'+
      '<button data-act="fd-mode" data-v="dep" class="'+(findMode==='dep'?'on':'')+'">この時刻に出る</button>'+
      '<button data-act="fd-mode" data-v="arr" class="'+(findMode==='arr'?'on':'')+'">この時刻までに着く</button>'+
    '</div>'+
    '<div class="pillrow" style="margin-top:6px">'+
      '<button data-act="fd-day" data-v="" class="'+(!findDate?'on':'')+'">今日</button>'+
      '<button data-act="fd-day" data-v="'+shiftDate(today(),1)+'" class="'+(findDate===shiftDate(today(),1)?'on':'')+'">明日</button>'+
      '<span class="s2" style="margin-left:auto">'+
        ((function(){ var d=findDate||today(); var a=d.split('-');
          var dw=new Date(+a[0],+a[1]-1,+a[2]).getDay();
          return (dw===0||dw===6||holidayName(d)) ? '休日のダイヤ' : '平日のダイヤ'; })())+'</span>'+
    '</div>'+
    '<div class="timerow fdrow" style="margin-top:8px">'+
      '<input id="fd_h" class="tnum" inputmode="numeric" maxlength="2" placeholder="--" value="'+esc(tm?tm.split(':')[0]:'')+'">'+
      '<span class="tsep">：</span>'+
      '<input id="fd_m" class="tnum" inputmode="numeric" maxlength="2" placeholder="--" value="'+esc(tm?tm.split(':')[1]:'')+'">'+
      '<button class="btn fdgo" data-act="fd-go">調べる</button></div>'+
    '<div id="fd_result">'+(res || '<div class="empty">時刻を入れて「調べる」を押してください。<br>'+
      '<span class="s2">空のまま押すと、いまの時刻でさがします。</span></div>')+'</div>');
}
/* 経路をさがす（おすすめ＋1本あと＋2本あと） */
function findRoute(from, to, hhmm, mode){
  if(from === to) return '<div class="msg ng">出発地と行き先が同じです。</div>';
  var base = minutesOf(hhmm);
  if(base == null) return '';
  var margin = toNum(S.transit.sannomiyaTransfer) || 10;

  var build = function(startIdx){
    var legs = routeLegs(from, to);
    if(!legs) return null;
    var first = legs[0].table;
    if(startIdx >= first.length) return null;
    var cur = [first[startIdx]];
    var t = minutesOf(first[startIdx].arr);
    for(var i = 1; i < legs.length; i++){
      var nx = firstAfter(legs[i].table, t + margin);
      if(!nx) return null;
      cur.push(nx); t = minutesOf(nx.arr);
    }
    return { legs: legs, found: cur, dep: minutesOf(cur[0].dep), arr: t };
  };
  var legs0 = routeLegs(from, to);
  if(!legs0) return '<div class="msg ng">このあいだの時刻表はまだ入っていません。</div>';

  var cands = [];
  for(var k = 0; k < legs0[0].table.length; k++){
    var r = build(k);
    if(!r) continue;
    if(mode === 'arr'){
      if(r.arr > base) continue;
      if(base - r.arr > FIND_WINDOW) continue;
    }else{
      if(r.dep < base) continue;
      if(r.dep - base > FIND_WINDOW) continue;
    }
    cands.push(r);
  }
  if(!cands.length){
    return '<div class="msg ng">'+(mode==='arr' ? 'この時刻までに着ける便が見つかりませんでした。' : 'この時刻より後の便が見つかりませんでした。')+'<br>'+
      '<span class="s2">ダイヤを入れていない時間帯かもしれません。別の時刻でためしてください。</span></div>';
  }
  if(mode === 'arr'){
    cands.sort(function(a,b){ return b.dep - a.dep; });   /* 遅く出られる順 */
  }else{
    cands.sort(function(a,b){ return a.dep - b.dep; });   /* 早く出る順 */
  }
  var top = cands.slice(0, 3);
  var labels = mode === 'arr' ? ['おすすめ', '1本まえ', '2本まえ'] : ['おすすめ', '1本あと', '2本あと'];

  return '<div class="routes">' + top.map(function(r, i){
    var total = r.arr - r.dep; if(total < 0) total += 1440;
    return '<div class="rt'+(i===0?' best':'')+'">'+
      '<div class="rthd"><span class="rtag'+(i===0?' on':'')+'">'+labels[i]+'</span>'+
        '<span class="rtime">'+r.found[0].dep+'<span class="ar">→</span>'+hhmmOf(r.arr)+'</span>'+
        '<span class="rmin">'+total+'分</span></div>'+
      r.legs.map(function(L, j){
        var f = r.found[j];
        return '<div class="rtleg"><span class="rkind">'+esc(L.kind)+'</span>'+
          '<span class="rname">'+esc(L.name)+(f.kind?'<span class="rtype">'+esc(f.kind)+'</span>':'')+'</span>'+
          '<span class="rtimes">'+f.dep+' → '+f.arr+'</span></div>';
      }).join('')+
      '</div>';
  }).join('') + '</div>';
}
function routeLegs(from, to, ymd){
  /* ymd … その日のダイヤで（なければ「時間を決めて調べる」で選んだ日） */
  var T = function(k){ return tbl(k, ymd || findDate || today()).map(function(p){ return { dep:p[0], arr:p[1], kind:p[2]||'' }; }); };
  if(from==='home' && to==='univ')      return [{kind:'バス', name:'弥生ヶ丘五丁目→三ノ宮', table:T('busGo')},   {kind:'電車', name:'三ノ宮→鳴尾', table:T('trainGo')}];
  if(from==='univ' && to==='home')      return [{kind:'電車', name:'鳴尾→三ノ宮', table:T('trainBack')},        {kind:'バス', name:'三ノ宮→三田', table:T('busBack')}];
  if(from==='home' && to==='sannomiya') return [{kind:'バス', name:'弥生ヶ丘五丁目→三ノ宮', table:T('busGo')}];
  if(from==='sannomiya' && to==='home') return [{kind:'バス', name:'三ノ宮→三田', table:T('busBack')}];
  if(from==='sannomiya' && to==='univ') return [{kind:'電車', name:'三ノ宮→鳴尾', table:T('trainGo')}];
  if(from==='univ' && to==='sannomiya') return [{kind:'電車', name:'鳴尾→三ノ宮', table:T('trainBack')}];
  if(from==='sannomiya' && to==='work') return [{kind:'バス', name:'三ノ宮→イオンモール神戸北', table:T('busWork')}];
  if(from==='univ' && to==='work')      return [{kind:'電車', name:'鳴尾→三ノ宮', table:T('trainBack')},        {kind:'バス', name:'三ノ宮→イオンモール神戸北', table:T('busWork')}];
  if(from==='home' && to==='work')      return [{kind:'バス', name:'弥生ヶ丘五丁目→三ノ宮', table:T('busGo')},   {kind:'バス', name:'三ノ宮→イオンモール神戸北', table:T('busWork')}];
  return null;
}
/* 探した時刻から離れすぎている便は出さない（実データのない時間帯を見分ける） */
var FIND_WINDOW = 150;   /* 2時間半 */
function firstAfter(table, min){
  for(var i=0;i<table.length;i++){
    var d = minutesOf(table[i].dep);
    if(d >= min) return (d - min > FIND_WINDOW) ? null : table[i];
  }
  return null;
}
function lastBefore(table, min){
  var best = null;
  for(var i=0;i<table.length;i++){ if(minutesOf(table[i].arr) <= min) best = table[i]; }
  if(best && (min - minutesOf(best.arr) > FIND_WINDOW)) return null;
  return best;
}

/* ===== 遅れたとき・乗りそこねたとき ===== */
var dly = { route:'', what:'miss', leg:0, idx:-1, min:10 };
var DLY_ROUTES = { go:['home','univ','行き（家→大学）'], back:['univ','home','帰り（大学→家）'], work:['univ','work','バイトへ（大学→イオン）'] };
function nowMinutes(){ var n = new Date(); return n.getHours()*60 + n.getMinutes(); }
/* 今の時間から、どの道のりか決める */
function dlyAutoRoute(){
  var td = today(), cls = schoolClassesForDate(td), nm = nowMinutes();
  var shift = S.shifts.filter(function(w){ return w.date === td && minutesOf(w.start) != null; })[0];
  if(cls.length){
    var st = minutesOf(S.commute.periods[cls[0].period-1]);
    if(st != null && nm < st) return 'go';
    return shift ? 'work' : 'back';
  }
  return 'go';
}
/* 間に合わせたい時刻（行き：最初の授業、バイト：開始の少し前） */
function dlyTarget(route){
  var td = today();
  if(route === 'go'){
    var cls = schoolClassesForDate(td);
    if(!cls.length) return null;
    var st = minutesOf(S.commute.periods[cls[0].period-1]);
    return st == null ? null : { min: st - (toNum(S.commute.toSchool) || 10), label: cls[0].period + '限（' + S.commute.periods[cls[0].period-1] + '）', walk: toNum(S.commute.toSchool) || 10 };
  }
  if(route === 'work'){
    var w = S.shifts.filter(function(x){ return x.date === td && minutesOf(x.start) != null; })[0];
    return w ? { min: minutesOf(w.start) - (toNum(S.transit.workBuffer) || 10), label: 'バイト（' + w.start + '）', walk: 0 } : null;
  }
  return null;
}
/* ある便が遅れた（または乗りそこねた）ときの、その先のつながり */
function dlyPlan(route, legIdx, svc, delay){
  var r = DLY_ROUTES[route]; if(!r) return null;
  var legs = routeLegs(r[0], r[1]); if(!legs) return null;
  var margin = toNum(S.transit.sannomiyaTransfer) || 10;
  var steps = [{ leg:legs[legIdx], svc:svc, dep:minutesOf(svc.dep) + (delay||0), arr:minutesOf(svc.arr) + (delay||0), late:delay||0 }];
  var t = steps[0].arr;
  for(var i = legIdx + 1; i < legs.length; i++){
    var nx = firstAfter(legs[i].table, t + margin);
    if(!nx) return { steps:steps, broken:legs[i].name };
    steps.push({ leg:legs[i], svc:nx, dep:minutesOf(nx.dep), arr:minutesOf(nx.arr), late:0 });
    t = minutesOf(nx.arr);
  }
  return { steps:steps, arr:t };
}
function delayCard(){
  var route = dly.route || dlyAutoRoute();
  var r = DLY_ROUTES[route];
  var legs = routeLegs(r[0], r[1]) || [];
  var nm = nowMinutes();
  var leg = dly.what === 'miss' ? 0 : Math.min(dly.leg, legs.length - 1);
  var L = legs[leg];
  var h = '<div class="pillrow">' + Object.keys(DLY_ROUTES).map(function(k){
      return '<button data-act="dl-route" data-v="'+k+'" class="'+(route===k?'on':'')+'">'+esc(DLY_ROUTES[k][2])+'</button>';
    }).join('') + '</div>' +
    '<div class="pillrow">' +
      '<button data-act="dl-what" data-v="miss" class="'+(dly.what==='miss'?'on':'')+'">乗りそこねた</button>' +
      legs.map(function(g, i){
        return '<button data-act="dl-what" data-v="late" data-leg="'+i+'" class="'+(dly.what==='late'&&leg===i?'on':'')+'">'+esc(g.kind)+'が遅れている</button>';
      }).join('') + '</div>';
  if(!L || !L.table.length) return h + '<div class="empty">この道のりの時刻表がありません。</div>';

  var target = dlyTarget(route);
  var plan = null, head = '';
  if(dly.what === 'miss'){
    /* 今から乗れる、いちばん早い便 */
    var first = L.table.filter(function(s){ return minutesOf(s.dep) >= nm; })[0];
    if(!first) return h + '<div class="msg ng">今日はもう、この道のりの便がありません。</div>';
    plan = dlyPlan(route, 0, first, 0);
    head = '次に乗れるのは '+esc(L.kind)+' <b>'+first.dep+'</b> 発です。';
  }else{
    /* 乗っている（待っている）便をえらぶ：いまの前後の便 */
    var near = L.table.map(function(s, i){ return { s:s, i:i, d:minutesOf(s.dep) }; })
      .filter(function(o){ return o.d >= nm - 90 && o.d <= nm + 60; });
    if(!near.length) return h + '<div class="msg ng">いまの時間の前後に、この'+esc(L.kind)+'の便がありません。</div>';
    var pickIdx = dly.idx;
    if(!near.some(function(o){ return o.i === pickIdx; })){
      /* いちばん近い「もう出るはずだった便」を選んでおく */
      var past = near.filter(function(o){ return o.d <= nm; });
      pickIdx = (past.length ? past[past.length-1] : near[0]).i;
    }
    var svc = L.table[pickIdx];
    plan = dlyPlan(route, leg, svc, dly.min);
    h += '<label class="f">乗っている（待っている）'+esc(L.kind)+'</label>'+
      '<select data-act="dl-idx" id="dl_idx">'+near.map(function(o){
        return '<option value="'+o.i+'"'+(o.i===pickIdx?' selected':'')+'>'+o.s.dep+' 発 → '+o.s.arr+' 着'+(o.s.kind?'（'+esc(o.s.kind)+'）':'')+'</option>';
      }).join('')+'</select>'+
      '<label class="f">どれくらい遅れている？</label>'+
      '<div class="pillrow">'+[5,10,15,20,30,45,60].map(function(m){
        return '<button data-act="dl-min" data-v="'+m+'" class="'+(dly.min===m?'on':'')+'">'+m+'分</button>';
      }).join('')+'</div>';
    head = esc(L.kind)+'が<b>'+dly.min+'分</b>遅れると、'+esc(L.name.split('→')[1]||'')+'に <b>'+hhmmOf(plan.steps[0].arr)+'</b> ごろ着きます。';
  }
  h += '<div class="trplan dlres">'+'<div style="margin-bottom:6px">'+head+'</div>';
  plan.steps.forEach(function(s, i){
    h += '<div class="trline"><span class="trk">'+esc(s.leg.kind)+'</span><span>'+esc(s.leg.name)+'　'+
      hhmmOf(s.dep)+' 発 → '+hhmmOf(s.arr)+' 着'+(s.late ? '<span class="b warn" style="margin-left:6px">'+s.late+'分遅れ</span>' : '')+
      (i > 0 ? '<span class="s2">（乗りかえ）</span>' : '')+'</span></div>';
  });
  if(plan.broken){
    h += '<div class="trwarn">この先の「'+esc(plan.broken)+'」は、今日はもう便がありません。</div>';
  }else if(target){
    var diff = target.min - plan.arr;
    var goalArr = plan.arr + (target.walk || 0);
    h += diff >= 0
      ? '<div class="dlok">'+esc(target.label)+'に<b>間に合います</b>（'+(target.walk ? '着くのは '+hhmmOf(goalArr)+' ごろ・' : '')+'よゆう'+diff+'分）</div>'
      : '<div class="trwarn">'+esc(target.label)+'に<b>'+(-diff)+'分おくれそう</b>です'+(target.walk ? '（着くのは '+hhmmOf(goalArr)+' ごろ）' : '')+'。'+
        (route === 'go' ? '<br>電車・バスの遅れなら、駅で<b>遅延証明書</b>をもらっておきましょう。' : '<br>早めにバイト先へ連絡しましょう。')+'</div>';
  }else{
    h += '<div class="s2" style="margin-top:4px">着くのは '+hhmmOf(plan.arr)+' ごろです。</div>';
  }
  h += '</div><p class="note">時刻表どおりに動く前提の目安です。実際の遅れは「運行情報」で確かめてください。</p>';
  return h;
}
function delayAction(act, t){
  if(act === 'dl-route'){ dly.route = t.dataset.v; dly.idx = -1; dly.leg = 0; render(); return true; }
  if(act === 'dl-what'){ dly.what = t.dataset.v; dly.leg = toNum(t.dataset.leg); dly.idx = -1; render(); return true; }
  if(act === 'dl-min'){ dly.min = toNum(t.dataset.v); render(); return true; }
  return false;
}

/* ===== 運行情報（阪神電車・神姫バス）===== */
function unkouCard(){
  var now = new Date(), hh = now.getHours();
  var td = today();
  var cls = schoolClassesForDate(td);
  var shiftToday = S.shifts.filter(function(w){ return w.date === td; }).length > 0;
  /* 通学やバイトがある日の朝・夕は目立たせる */
  var soon = (cls.length || shiftToday) && ((hh >= 6 && hh <= 10) || (hh >= 15 && hh <= 21));
  var link = function(href, label, note){
    return '<a class="unkou" href="'+href+'" target="_blank" rel="noopener">'+
      '<span class="grow"><span class="t">'+esc(label)+'</span>'+
      (note ? '<span class="s">'+esc(note)+'</span>' : '')+'</span><span class="s2">開く ›</span></a>';
  };
  return secWrap('unkou', '運行情報', soon ? 'いま確認したい時間' : null,
    (soon ? '<div class="bn amber"><span class="ic">！</span><span>出かける前に、遅れがないか見ておきましょう。</span></div>' : '')+
    '<div class="unkoulist">'+
      link('https://rail.hanshin.co.jp/search/info.html', '阪神電車の運行情報', '本線・武庫川線などの遅れ') +
      link('https://x.com/hanshin_unkou_', '阪神電車 公式X（運行情報）', '毎日7時と17時にも知らせてくれます') +
      link('https://transit.yahoo.co.jp/diainfo/315/0', '阪神本線（Yahoo!路線情報）', '他社線とまとめて見られます') +
      link('https://navi.shinkibus.jp/', '神姫バスNavi', 'バスの現在地と運行案内') +
      link('https://www.shinkibus.co.jp/sys/lines/index', '神姫バス 路線バス運行情報', '運休・遅延のお知らせ') +
    '</div>'+
    '<p class="note">阪神電車と神姫バスは、外から自動で読み取れる形では遅延情報を出していません。'+
      'ここから公式のページを開いて確かめてください。雨や強風の日はとくに。</p>');
}

/* ===== 出発の記録（5・8・13・16）===== */
function leaveCard(){
  var td = today();
  var recs = (S.transitLog||[]).slice(-40);
  var todayRec = recs.filter(function(r){ return r.date===td; })[0];
  var avg = null;
  var arr = recs.filter(function(r){ return r.min != null; });
  if(arr.length >= 2) avg = Math.round(arr.reduce(function(a,r){ return a+r.min; },0)/arr.length);
  var fav = (S.transit.fav||[]);
  return secWrap('leave','出発の記録', avg!=null ? ('いつもは家からバス停まで'+avg+'分') : null,
    '<div class="pillrow">'+
      '<button data-act="leave-now" class="'+(todayRec?'on':'')+'">'+(todayRec?'今日は'+todayRec.at+'に出ました':'いま家を出た')+'</button>'+
      (todayRec?'<button class="mini" data-act="leave-undo">取り消す</button>':'')+
    '</div>'+
    (fav.length ? '<div class="s2" style="margin-top:10px">お気に入りの便</div>'+fav.slice(0,3).map(function(k){
      var a = k.split(':');
      return '<div class="row"><div class="grow t num">'+(a[0]==='go'?'行き':'帰り')+'　バス'+esc(a[1]||'—')+'／電車'+esc(a[2])+'</div></div>';
    }).join('') : '')+
    (recs.length ? '<p class="note">出た時刻を押しておくと、次からの出発の目安が出ます。（'+recs.length+'回ぶん記録）</p>' : '<p class="note">家を出るときに押すと、かかる時間をおぼえていきます。</p>'));
}

