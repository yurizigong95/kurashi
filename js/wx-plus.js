/* くらしの手帳：気象庁の警報・注意報と、雨雲レーダー（気象庁・RainViewer） */
/* ============================== 警報・注意報 ==============================
   気象庁の公開データ（bosai）を読む。公式の「API」ではないので、形が変わったら「気象庁で見る」に切りかえる。 */
var JMA_WARN = {
  '02':'暴風雪警報', '03':'大雨警報', '04':'洪水警報', '05':'暴風警報', '06':'大雪警報', '07':'波浪警報', '08':'高潮警報',
  '10':'大雨注意報', '12':'大雪注意報', '13':'風雪注意報', '14':'雷注意報', '15':'強風注意報', '16':'波浪注意報', '17':'融雪注意報',
  '18':'洪水注意報', '19':'高潮注意報', '20':'濃霧注意報', '21':'乾燥注意報', '22':'なだれ注意報', '23':'低温注意報', '24':'霜注意報',
  '25':'着氷注意報', '26':'着雪注意報', '27':'その他の注意報',
  '32':'暴風雪特別警報', '33':'大雨特別警報', '35':'暴風特別警報', '36':'大雪特別警報', '37':'波浪特別警報', '38':'高潮特別警報'
};
var WX_AREAS = [['2821900', '三田市（家）'], ['2820400', '西宮市（大学）']];
var WX_OFFICE = '280000';
var wxWarn = (function(){
  var o = null;
  try{ o = JSON.parse(localStorage.getItem(KEY + ':jmawarn') || 'null'); }catch(e){}
  return o || { at:0, list:[], err:'', report:'' };
})();
var wxWarnBusy = false;
function warnLevel(code){
  var c = Number(code);
  if(c >= 32) return 3;          /* 特別警報 */
  if(c >= 2 && c <= 8) return 2; /* 警報 */
  return 1;                      /* 注意報 */
}
async function warnLoad(force){
  if(wxWarnBusy || TEST_MODE) return;
  if(!force && Date.now() - wxWarn.at < 10 * 60000) return;
  wxWarnBusy = true;
  try{
    var r = await withTimeout(fetch('https://www.jma.go.jp/bosai/warning/data/warning/' + WX_OFFICE + '.json', { cache:'no-store' }), 15000, '気象庁');
    if(!r.ok) throw new Error('気象庁のデータを読めませんでした（' + r.status + '）');
    var j = await r.json(), list = [];
    var areas = [];
    (j.areaTypes || []).forEach(function(t){ areas = areas.concat(t.areas || []); });
    WX_AREAS.forEach(function(a){
      var hit = areas.filter(function(x){ return x.code === a[0]; })[0];
      if(!hit) return;
      (hit.warnings || []).forEach(function(w){
        if(!w.code || /解除|なし/.test(w.status || '')) return;
        list.push({ area:a[1], code:w.code, name:JMA_WARN[w.code] || '警報・注意報（' + w.code + '）', status:w.status || '', lv:warnLevel(w.code) });
      });
    });
    list.sort(function(a, b){ return b.lv - a.lv; });
    wxWarn = { at:Date.now(), list:list, err:'', report:String(j.reportDatetime || '') };
  }catch(e){
    wxWarn.err = e.message;
    wxWarn.at = Date.now();
    logErr('警報', e.message);
  }finally{
    wxWarnBusy = false;
    try{ localStorage.setItem(KEY + ':jmawarn', JSON.stringify(wxWarn)); }catch(e){}
    if(appId === 'today' && !isTyping()) render();
  }
}
function warnCard(){
  if(TEST_MODE && !wxWarn.list.length) return '';
  setTimeout(function(){ warnLoad(false); }, 0);
  var list = wxWarn.list || [];
  var link = 'https://www.jma.go.jp/bosai/warning/#area_type=class20s&area_code=' + WX_AREAS[0][0] + '&lang=ja';
  if(!list.length){
    return wxWarn.err ? '<p class="note">警報・注意報：' + esc(wxWarn.err) + '　<a href="' + link + '" target="_blank" rel="noopener">気象庁で見る</a></p>'
      : (wxWarn.at ? '<p class="note">警報・注意報：いまは出ていません（三田市・西宮市）</p>' : '');
  }
  var top = list[0].lv;
  var byArea = {};
  list.forEach(function(w){ (byArea[w.area] = byArea[w.area] || []).push(w); });
  return '<div class="bn ' + (top >= 2 ? 'red' : 'amber') + ' wxwarn" role="alert"><span class="ic">' + (top >= 3 ? '🚨' : top >= 2 ? '⚠️' : '⚠') + '</span><span class="grow">' +
    '<b>' + (top >= 3 ? '特別警報が出ています。命を守る行動を。' : top >= 2 ? '警報が出ています' : '注意報が出ています') + '</b><br>' +
    Object.keys(byArea).map(function(a){
      return esc(a) + '：' + byArea[a].map(function(w){ return esc(w.name) + (w.status && w.status !== '発表' && w.status !== '継続' ? '（' + esc(w.status) + '）' : ''); }).join('・');
    }).join('<br>') +
    (top >= 2 ? '<br>大学・バイト先からの休講や休みの連絡を確認してください。' : '') +
    '　<a href="' + link + '" target="_blank" rel="noopener">気象庁で見る</a></span></div>';
}

/* ============================== 雨雲レーダー ==============================
   地図（国土地理院）と雨（気象庁 または RainViewer）のタイルを、同じ「z/x/y」（ウェブメルカトル）で重ねる。
   ・気象庁の雨のタイル（hrpns）は、偶数のズーム（4・6・8・10）にしか中身がない（奇数のズームは空の絵が返る）。
     気象庁のサイトも、ズーム9では「ズーム8の雨」を2倍に広げて重ねている。→ 雨は偶数のズームで読んで広げる。
   ・RainViewer の無料のタイルは、ズーム7まで（8より細かいと「Zoom Level Not Supported」の絵）。→ 7で読んで広げる。
   ・地点の印は、点の中心がその場所に来るようにする（名前は点の下に出す）。
   ・時刻は世界標準時（UTC）で来るので、端末の時計の設定によらず、日本時間で出す。
   ・枠の縦横（6:5）は aspect-ratio を使わずに作る（古いiPhoneでも同じ形になる）。 */
var radar = { open:false, frames:null, idx:0, z:9, play:null, err:'', busy:false, at:0, tryAt:0, src:'' };
var RADAR_W = 360, RADAR_H = 300;              /* 枠の大きさ（計算用の点の数。画面では幅に合わせて広がる） */
var RADAR_COLORS = [['#F2F2FF', '1未満'], ['#A0D2FF', '1〜5'], ['#218CFF', '5〜10'], ['#0041FF', '10〜20'],
                    ['#FAF500', '20〜30'], ['#FF9900', '30〜50'], ['#FF2800', '50〜80'], ['#B40068', '80以上']];
var RADAR_SRC = {
  jma:{ name:'気象庁', max:10, even:1, fut:'予報は1時間先まで。',
    credit:'出典：気象庁（降水ナウキャスト）・国土地理院（地図）。',
    url:function(fr, z, x, y){ return 'https://www.jma.go.jp/bosai/jmatile/data/nowc/' + fr.b + '/none/' + fr.v + '/surf/hrpns/' + z + '/' + x + '/' + y + '.png'; } },
  rv:{ name:'RainViewer', max:7, even:0, fut:'RainViewer は、いまから2時間前までの雨だけです（予報はありません）。',
    credit:'出典：RainViewer（世界の雨雲レーダー。細かく見るとぼやけます）・国土地理院（地図）。',
    url:function(fr, z, x, y){ return fr.p + '/256/' + z + '/' + x + '/' + y + '/2/1_1.png'; } }
};
var RADAR_BASE = 'https://www.jma.go.jp/bosai/jmatile/data/nowc/';
function radarSrcId(){
  var s = '';
  try{ s = (typeof l2Prefs === 'function') ? l2Prefs().radarSrc : ''; }catch(e){}
  return RADAR_SRC[s] ? s : 'jma';
}
/* 時刻（'YYYYMMDDhhmmss' は世界標準時）→ 日本時間の「時:分」 */
function radarUtcMs(v){
  v = String(v || '');
  return Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8), +v.slice(8, 10), +v.slice(10, 12));
}
function radarJst(ms){ var d = new Date(Number(ms) + 9 * 3600000); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }
function radarTimeLabel(v){ return radarJst(radarUtcMs(v)); }
/* 気象庁の時刻の一覧 → こま（古い順。実況は1時間前まで、予報は1時間先まで）
   ・N1（実況）も N2（予報）も、並び順にはたよらず、時刻で並べ直す
   ・予報は、実況のいちばん新しい時刻より先のものだけ。予報の basetime は、その予報のもの（実況より1つ古いことがある）を使う */
function radarFramesJma(n1, n2){
  var ok = function(t){
    return t && /^\d{14}$/.test(String(t.basetime)) && /^\d{14}$/.test(String(t.validtime)) &&
      (!Array.isArray(t.elements) || t.elements.indexOf('hrpns') >= 0);
  };
  var pick = function(list, f, after){
    var m = {};
    (Array.isArray(list) ? list : []).filter(ok).forEach(function(t){
      if(after && !(t.validtime > after)) return;
      var o = m[t.validtime];
      if(!o || t.basetime > o.b) m[t.validtime] = { b:t.basetime, v:t.validtime, f:f, t:radarUtcMs(t.validtime) };
    });
    return Object.keys(m).sort().map(function(k){ return m[k]; });
  };
  var past = pick(n1, 0, '').slice(-13);
  var last = past.length ? past[past.length - 1].v : '';
  var fut = last ? pick(n2, 1, last).slice(0, 12) : [];
  return past.concat(fut);
}
/* RainViewer の一覧 → こま（time は世界標準時の秒） */
function radarFramesRv(j){
  var host = String((j && j.host) || '');
  if(!/^https:\/\/[a-z0-9.\-]+$/i.test(host)) host = 'https://tilecache.rainviewer.com';
  var r = (j && j.radar) || {};
  var mk = function(f){
    return function(x){ return (x && /^\/[\w\/\-]+$/.test(String(x.path)) && isFinite(Number(x.time))) ? { t:Number(x.time) * 1000, p:host + x.path, f:f } : null; };
  };
  var byT = function(a, b){ return a.t - b.t; };
  var past = (r.past || []).map(mk(0)).filter(Boolean).sort(byT).slice(-13);
  var lastT = past.length ? past[past.length - 1].t : 0;
  var fut = (r.nowcast || []).map(mk(1)).filter(function(x){ return x && x.t > lastT; }).sort(byT).slice(0, 12);
  return past.concat(fut);
}
function radarNowIdx(){
  var fr = radar.frames || [], n = -1;
  fr.forEach(function(f, i){ if(!f.f) n = i; });
  return Math.max(0, n);
}
async function radarLoad(force){
  var src = radarSrcId();
  if(radar.busy) return;
  if(!force && radar.frames && radar.src === src && Date.now() - radar.at < 5 * 60000) return;
  radar.busy = true; radar.tryAt = Date.now();
  try{
    var frames;
    if(src === 'rv'){
      frames = radarFramesRv(await apiJson('https://api.rainviewer.com/public/weather-maps.json'));
    }else{
      var n1 = await apiJson(RADAR_BASE + 'targetTimes_N1.json');
      var n2 = [];
      try{ n2 = await apiJson(RADAR_BASE + 'targetTimes_N2.json'); }catch(e2){ /* 予報が読めなくても、実況は出す */ }
      frames = radarFramesJma(n1, n2);
    }
    if(!frames.length) throw new Error('時刻の一覧が空でした');
    radarStop();
    radar.frames = frames; radar.src = src;
    radar.idx = radarNowIdx();
    radar.at = Date.now(); radar.err = '';
  }catch(e){
    radar.err = (RADAR_SRC[src] || RADAR_SRC.jma).name + 'のレーダーを読めませんでした：' + (e && e.message || e);
    logErr('雨雲レーダー', radar.err);
  }finally{
    radar.busy = false;
    /* 時刻のつまみに指が乗っていても描き直す（入力中あつかいのままだと、古いこまの画面が残る） */
    var ae = document.activeElement;
    if(radar.open && (!isTyping() || (ae && ae.id === 'radar_t'))) render();
    /* 読んでいる間に出どころが変えられた（そのときの読みこみは断っている）→ 新しい出どころで読み直す */
    if(radar.open && src !== radarSrcId()) setTimeout(function(){ radarLoad(true); }, 0);
  }
}
function lonToX(lng, z){ return (lng + 180) / 360 * Math.pow(2, z); }
function latToY(lat, z){ var r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z); }
function radarPoints(){
  var pts = [{ lat:34.8890, lng:135.2250, name:'家（三田）' }];
  var pl = (typeof linkPrefs === 'function') ? linkPrefs().place : null;
  var la = pl ? parseFloat(pl.lat) : NaN, lo = pl ? parseFloat(pl.lng) : NaN;      /* 変な値で地図がこわれないように */
  pts.push(isFinite(la) && isFinite(lo) && Math.abs(la) < 85 ? { lat:la, lng:lo, name:'学校' } : { lat:34.7376, lng:135.3416, name:'西宮' });
  return pts;
}
/* 枠の中の位置（計算用の点。枠は RADAR_W × RADAR_H）
   base … 地図のタイル（ズーム z・256点）／ rain … 雨のタイル（ズーム dz。1枚が 256×2^(z-dz) 点）／ marks … 地点（点の中心） */
function radarGeom(pts, z, srcId){
  var s = RADAR_SRC[srcId] || RADAR_SRC.jma, W = RADAR_W, H = RADAR_H;
  var cLat = 0, cLng = 0;
  pts.forEach(function(p){ cLat += p.lat; cLng += p.lng; });
  cLat /= pts.length; cLng /= pts.length;
  var cx = lonToX(cLng, z), cy = latToY(cLat, z);
  var grid = function(dz){
    var k = Math.pow(2, dz - z), size = 256 / k, ccx = cx * k, ccy = cy * k, out = [];
    var x0 = Math.floor(ccx - W / 2 / size), x1 = Math.ceil(ccx + W / 2 / size) - 1;
    var y0 = Math.floor(ccy - H / 2 / size), y1 = Math.ceil(ccy + H / 2 / size) - 1;
    for(var tx = x0; tx <= x1; tx++){
      for(var ty = y0; ty <= y1; ty++) out.push({ z:dz, x:tx, y:ty, left:(tx - ccx) * size + W / 2, top:(ty - ccy) * size + H / 2, size:size });
    }
    return out;
  };
  var dz = Math.min(z, s.max);
  if(s.even) dz -= dz % 2;
  return { z:z, dz:dz, cLat:cLat, cLng:cLng, cx:cx, cy:cy, base:grid(z), rain:grid(dz),
    marks:pts.map(function(p){
      return { name:p.name, lat:p.lat, lng:p.lng, left:(lonToX(p.lng, z) - cx) * 256 + W / 2, top:(latToY(p.lat, z) - cy) * 256 + H / 2 };
    }) };
}
function radarPct(v, of){ return (v / of * 100).toFixed(4) + '%'; }
function radarImg(cls, u, t){
  return '<img alt="" class="' + cls + '" data-z="' + t.z + '" data-x="' + t.x + '" data-y="' + t.y + '" data-u="' + esc(u) + '"' +
    ' style="left:' + radarPct(t.left, RADAR_W) + ';top:' + radarPct(t.top, RADAR_H) + ';width:' + radarPct(t.size, RADAR_W) + ';height:' + radarPct(t.size, RADAR_H) + '"' +
    (TEST_MODE ? '' : ' src="' + esc(u) + '"') + ' onerror="this.style.visibility=\'hidden\'">';        /* テストでは本物の地図・雨は読まない */
}
function radarText(i){
  var fr = radar.frames && radar.frames[i];
  if(!fr) return '';
  return radarJst(fr.t) + (fr.f ? ' 予報' : i === radarNowIdx() ? ' 現在' : '');
}
function radarLinks(g){
  var la = g.cLat.toFixed(3), lo = g.cLng.toFixed(3);
  return [['気象庁', 'https://www.jma.go.jp/bosai/nowc/#zoom:' + g.z + '/lat:' + la + '/lon:' + lo + '/colordepth:normal/elements:hrpns'],
    ['tenki.jp', 'https://tenki.jp/radar/6/31/'],
    ['Yahoo!天気', 'https://weather.yahoo.co.jp/weather/zoomradar/?lat=' + la + '&lon=' + lo + '&z=' + Math.max(7, g.z + 1)],
    ['ウェザーニュース', 'https://weathernews.jp/onebox/radar/hyogo/']];
}
function radarHtml(){
  var srcId = RADAR_SRC[radar.src] ? radar.src : radarSrcId(), s = RADAR_SRC[srcId];
  var fr = radar.frames && radar.frames[radar.idx];
  var g = radarGeom(radarPoints(), radar.z, srcId);
  var tiles = g.base.map(function(t){ return radarImg('rb', 'https://cyberjapandata.gsi.go.jp/xyz/pale/' + t.z + '/' + t.x + '/' + t.y + '.png', t); }).join('');
  var rain = fr ? g.rain.map(function(t){ return radarImg('rn', s.url(fr, t.z, t.x, t.y), t); }).join('') : '';
  var marks = g.marks.map(function(m){
    return '<span class="rmark" data-lat="' + m.lat + '" data-lng="' + m.lng + '" style="left:' + radarPct(m.left, RADAR_W) + ';top:' + radarPct(m.top, RADAR_H) + '">' +
      '<i></i><em>' + esc(m.name) + '</em></span>';
  }).join('');
  var n = radar.frames ? radar.frames.length : 0, nowIdx = radarNowIdx();
  var nowPct = n > 1 ? nowIdx / (n - 1) : 1;
  var cur = radarSrcId();
  return '<div class="radar" role="img" aria-label="雨雲レーダー（' + esc(s.name) + '） ' + esc(radarText(radar.idx)) + '" data-src="' + srcId + '" data-z="' + g.z + '" data-dz="' + g.dz + '">' +
      tiles + rain + marks + (fr ? '<span class="rtime">' + esc(radarText(radar.idx)) + '</span>' : '') + '</div>' +
    (n ? '<input type="range" id="radar_t" min="0" max="' + (n - 1) + '" value="' + radar.idx + '" aria-label="時刻">' +
      '<div class="rticks l2-rt"><span>' + radarJst(radar.frames[0].t) + '</span>' +
        /* 予報がない（RainViewer・予報を読めなかった）ときは、右はしが「いま」。目盛りを重ねない */
        (nowIdx < n - 1 ? '<span class="l2-rnow" style="left:calc(' + (nowPct * 100).toFixed(2) + '% + ' + ((0.5 - nowPct) * 16).toFixed(1) + 'px)">▲いま</span>' +
          '<span>' + radarJst(radar.frames[n - 1].t) + '</span>'
          : '<span>' + radarJst(radar.frames[n - 1].t) + '（いま）</span>') + '</div>' : '') +
    '<div class="pillrow" style="margin-top:6px">' +
      '<button class="mini" data-act="radar-play">' + (radar.play ? '■ 止める' : '▶ 動かす') + '</button>' +
      '<button class="mini" data-act="radar-now">いま</button>' +
      '<button class="mini" data-act="radar-z" data-v="-1"' + (radar.z <= 7 ? ' disabled' : '') + '>－ 広く</button>' +
      '<button class="mini" data-act="radar-z" data-v="1"' + (radar.z >= 10 ? ' disabled' : '') + '>＋ 細かく</button>' +
      '<button class="mini" data-act="radar-reload">' + (radar.busy ? '読みこみ中…' : '読みこみ直す') + '</button></div>' +
    '<div class="pillrow l2-rsrc"><span class="s2">雨雲：</span>' + Object.keys(RADAR_SRC).map(function(k){
      return '<button data-act="l2-radar-src" data-v="' + k + '" class="' + (cur === k ? 'on' : '') + '">' + esc(RADAR_SRC[k].name) + '</button>';
    }).join('') + '</div>' +
    (srcId === 'jma'
      ? '<div class="rlegend" aria-label="1時間あたりの雨の量（ミリ）">' + RADAR_COLORS.map(function(c){
          return '<span><i style="background:' + c[0] + '"></i>' + c[1] + '</span>';
        }).join('') + '<span class="s2">mm/時</span></div>'
      : '<div class="rlegend"><span><i style="background:#88DDEE"></i>弱い</span><span><i style="background:#0099CC"></i>ふつう</span>' +
        '<span><i style="background:#FFEE00"></i>強い</span><span><i style="background:#FF4400"></i>とても強い</span></div>') +
    '<div class="pillrow l2-rlinks"><span class="s2">ほかで見る：</span>' + radarLinks(g).map(function(l){
      return '<a class="mini" href="' + esc(l[1]) + '" target="_blank" rel="noopener">' + esc(l[0]) + '</a>';
    }).join('') + '</div>' +
    (radar.err ? '<p class="note">' + esc(radar.err) + '</p>' : '') +
    '<p class="note">' + esc(s.credit + (s.fut || '')) + (radar.at ? '（' + radarJst(radar.at) + 'に読みこみ）' : '') + '</p>';
}
function radarCard(){
  if(!radar.open){
    return '<button class="btn ghost" style="margin-top:8px" data-act="radar-open">☔ 雨雲レーダーを見る</button>';
  }
  /* 古くなった・雨雲の出どころを変えた → 裏で読みこみ直す（失敗したときは1分待つ） */
  var stale = !radar.frames || radar.src !== radarSrcId() || Date.now() - radar.at > 5 * 60000;
  if(stale && !radar.busy && Date.now() - radar.tryAt > 60000) setTimeout(function(){ radarLoad(); }, 0);
  return '<div class="radarbox">' + (radar.frames ? radarHtml() : '<div class="empty">' + (radar.err ? esc(radar.err) : '読みこんでいます…') + '</div>') +
    '<button class="mini" data-act="radar-close">レーダーを閉じる</button></div>';
}
/* こまを変える（画面を描き直さず、雨の絵と時刻だけ入れかえる） */
function radarShow(i){
  var frs = radar.frames || [];
  if(!frs.length) return;
  radar.idx = Math.max(0, Math.min(frs.length - 1, i));
  var fr = frs[radar.idx];
  var box = document.querySelector('.radar');
  if(!box) return;
  /* 画面が、前の出どころ・前の時刻の一覧のまま（描き直せなかった）→ 絵のURLを作らずに描き直す */
  var sl0 = document.getElementById('radar_t');
  if(box.getAttribute('data-src') !== radar.src || (sl0 && Number(sl0.max) !== frs.length - 1)){ render(); return; }
  var s = RADAR_SRC[box.getAttribute('data-src')] || RADAR_SRC.jma;
  Array.prototype.forEach.call(box.querySelectorAll('img.rn'), function(img){
    var u = s.url(fr, toNum(img.getAttribute('data-z')), toNum(img.getAttribute('data-x')), toNum(img.getAttribute('data-y')));
    img.setAttribute('data-u', u);
    if(!TEST_MODE && img.getAttribute('src') !== u){ img.style.visibility = ''; img.setAttribute('src', u); }
  });
  var tl = box.querySelector('.rtime');
  if(tl) tl.textContent = radarText(radar.idx);
  var sl = document.getElementById('radar_t');
  if(sl && Number(sl.value) !== radar.idx) sl.value = radar.idx;
}
/* 動かすとき、次のこまの雨の絵を先に読んでおく（ちらつかないように） */
var radarPre = [];
function radarPreload(i){
  if(TEST_MODE) return;
  var frs = radar.frames || [], fr = frs[i], box = document.querySelector('.radar');
  if(!fr || !box) return;
  var s = RADAR_SRC[box.getAttribute('data-src')] || RADAR_SRC.jma;
  radarPre = Array.prototype.map.call(box.querySelectorAll('img.rn'), function(img){
    var im = new Image();
    im.src = s.url(fr, toNum(img.getAttribute('data-z')), toNum(img.getAttribute('data-x')), toNum(img.getAttribute('data-y')));
    return im;
  });
}
function radarStop(){ if(radar.play){ clearInterval(radar.play); radar.play = null; } }
function wxAction(act, t){
  if(act === 'radar-open'){ radar.open = true; radarLoad(); render(); return true; }
  if(act === 'radar-close'){ radar.open = false; radarStop(); render(); return true; }
  if(act === 'radar-reload'){ radarStop(); radarLoad(true); render(); return true; }
  if(act === 'radar-now'){
    radarStop();
    if(Date.now() - radar.at > 5 * 60000) radarLoad();
    radarShow(radarNowIdx()); render(); return true;
  }
  if(act === 'radar-z'){ radar.z = Math.max(7, Math.min(10, radar.z + toNum(t.dataset.v))); render(); return true; }
  if(act === 'radar-play'){
    if(radar.play){ radarStop(); render(); return true; }
    if(!radar.frames) return true;
    radar.play = setInterval(function(){
      if(appId !== 'today' || !document.querySelector('.radar')){ radarStop(); return; }
      var nx = (radar.idx + 1) % radar.frames.length;
      radarShow(nx);
      radarPreload((nx + 1) % radar.frames.length);
    }, 700);
    render(); return true;
  }
  if(act === 'warn-reload'){ warnLoad(true); return true; }
  return false;
}
document.addEventListener('input', function(e){
  if(e.target && e.target.id === 'radar_t'){ radarStop(); radarShow(toNum(e.target.value)); }
});
setInterval(function(){ if(!document.hidden && appId === 'today') warnLoad(false); }, 10 * 60000);
/* レーダーを開いている間は、5分ごとに新しい時刻を読む */
setInterval(function(){
  if(radar.open && !document.hidden && appId === 'today' && !radar.play && Date.now() - radar.at > 5 * 60000) radarLoad();
}, 60000);
