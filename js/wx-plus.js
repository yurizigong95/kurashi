/* くらしの手帳：気象庁の警報・注意報と、雨雲レーダー */
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

/* ============================== 雨雲レーダー ============================== */
var radar = { open:false, frames:null, idx:0, z:9, play:null, err:'', busy:false, at:0 };
var RADAR_COLORS = [['#F2F2FF', '1未満'], ['#A0D2FF', '1〜5'], ['#218CFF', '5〜10'], ['#0041FF', '10〜20'],
                    ['#FAF500', '20〜30'], ['#FF9900', '30〜50'], ['#FF2800', '50〜80'], ['#B40068', '80以上']];
async function radarLoad(){
  if(radar.busy) return;
  if(radar.frames && Date.now() - radar.at < 5 * 60000) return;
  radar.busy = true;
  try{
    var n1 = await (await withTimeout(fetch('https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N1.json', { cache:'no-store' }), 15000, '気象庁')).json();
    var n2 = await (await withTimeout(fetch('https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N2.json', { cache:'no-store' }), 15000, '気象庁')).json();
    var past = n1.slice(0, 13).reverse().map(function(t){ return { b:t.basetime, v:t.validtime, f:0 }; });
    var fut = n2.slice().reverse().filter(function(t){ return t.validtime > (past[past.length - 1] || {}).v; })
      .map(function(t){ return { b:t.basetime, v:t.validtime, f:1 }; });
    radar.frames = past.concat(fut);
    radar.idx = past.length - 1;
    radar.at = Date.now(); radar.err = '';
  }catch(e){
    radar.err = e.message;
    logErr('雨雲レーダー', e.message);
  }finally{
    radar.busy = false;
    if(radar.open && !isTyping()) render();
  }
}
function radarTimeLabel(v){
  var d = new Date(Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8), +v.slice(8, 10), +v.slice(10, 12)));
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}
function lonToX(lng, z){ return (lng + 180) / 360 * Math.pow(2, z); }
function latToY(lat, z){ var r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z); }
function radarPoints(){
  var pts = [{ lat:34.8890, lng:135.2250, name:'家（三田）' }];
  var pl = (typeof linkPrefs === 'function') ? linkPrefs().place : null;
  pts.push(pl ? { lat:pl.lat, lng:pl.lng, name:'学校' } : { lat:34.7376, lng:135.3416, name:'西宮' });
  return pts;
}
function radarHtml(){
  var fr = radar.frames && radar.frames[radar.idx];
  var z = radar.z, W = 360, H = 300;
  var pts = radarPoints();
  var cLat = (pts[0].lat + pts[1].lat) / 2, cLng = (pts[0].lng + pts[1].lng) / 2;
  var cx = lonToX(cLng, z), cy = latToY(cLat, z);
  var x0 = Math.floor(cx - W / 512) - 0, x1 = Math.floor(cx + W / 512);
  var y0 = Math.floor(cy - H / 512), y1 = Math.floor(cy + H / 512);
  var tiles = '', rain = '';
  for(var tx = x0; tx <= x1; tx++){
    for(var ty = y0; ty <= y1; ty++){
      var left = Math.round((tx - cx) * 256 + W / 2), top = Math.round((ty - cy) * 256 + H / 2);
      var pos = 'left:' + (left / W * 100).toFixed(3) + '%;top:' + (top / H * 100).toFixed(3) + '%;width:' + (256 / W * 100).toFixed(3) + '%;height:' + (256 / H * 100).toFixed(3) + '%';
      tiles += '<img alt="" loading="lazy" style="' + pos + '" src="https://cyberjapandata.gsi.go.jp/xyz/pale/' + z + '/' + tx + '/' + ty + '.png">';
      if(fr) rain += '<img alt="" class="rn" style="' + pos + '" onerror="this.style.visibility=\'hidden\'" src="https://www.jma.go.jp/bosai/jmatile/data/nowc/' +
        fr.b + '/none/' + fr.v + '/surf/hrpns/' + z + '/' + tx + '/' + ty + '.png">';
    }
  }
  var marks = pts.map(function(p){
    var left = (lonToX(p.lng, z) - cx) * 256 + W / 2, top = (latToY(p.lat, z) - cy) * 256 + H / 2;
    return '<span class="rmark" style="left:' + (left / W * 100).toFixed(2) + '%;top:' + (top / H * 100).toFixed(2) + '%"><i></i><em>' + esc(p.name) + '</em></span>';
  }).join('');
  var n = radar.frames ? radar.frames.length : 0;
  var nowIdx = radar.frames ? radar.frames.filter(function(f){ return !f.f; }).length - 1 : 0;
  return '<div class="radar" role="img" aria-label="雨雲レーダー ' + (fr ? radarTimeLabel(fr.v) + (fr.f ? '（予報）' : '') : '') + '">' + tiles + rain + marks +
    (fr ? '<span class="rtime">' + radarTimeLabel(fr.v) + (fr.f ? ' 予報' : radar.idx === nowIdx ? ' 現在' : '') + '</span>' : '') + '</div>' +
    (n ? '<input type="range" id="radar_t" min="0" max="' + (n - 1) + '" value="' + radar.idx + '" aria-label="時刻">' +
      '<div class="rticks"><span>' + radarTimeLabel(radar.frames[0].v) + '</span><span>いま</span><span>' + radarTimeLabel(radar.frames[n - 1].v) + '</span></div>' : '') +
    '<div class="pillrow" style="margin-top:6px">' +
      '<button class="mini" data-act="radar-play">' + (radar.play ? '■ 止める' : '▶ 動かす') + '</button>' +
      '<button class="mini" data-act="radar-now">いま</button>' +
      '<button class="mini" data-act="radar-z" data-v="-1"' + (z <= 7 ? ' disabled' : '') + '>－ 広く</button>' +
      '<button class="mini" data-act="radar-z" data-v="1"' + (z >= 10 ? ' disabled' : '') + '>＋ 細かく</button>' +
      '<button class="mini" data-act="radar-reload">読みこみ直す</button></div>' +
    '<div class="rlegend" aria-label="1時間あたりの雨の量（ミリ）">' + RADAR_COLORS.map(function(c){
      return '<span><i style="background:' + c[0] + '"></i>' + c[1] + '</span>';
    }).join('') + '<span class="s2">mm/時</span></div>' +
    (radar.err ? '<p class="note">' + esc(radar.err) + '</p>' : '') +
    '<p class="note">出典：気象庁（降水ナウキャスト）・国土地理院（地図）。予報は1時間先まで。</p>';
}
function radarCard(){
  if(!radar.open){
    return '<button class="btn ghost" style="margin-top:8px" data-act="radar-open">☔ 雨雲レーダーを見る</button>';
  }
  if(!radar.frames && !radar.busy) setTimeout(radarLoad, 0);
  return '<div class="radarbox">' + (radar.frames ? radarHtml() : '<div class="empty">読みこんでいます…</div>') +
    '<button class="mini" data-act="radar-close">レーダーを閉じる</button></div>';
}
function radarShow(i){
  radar.idx = Math.max(0, Math.min((radar.frames || []).length - 1, i));
  var box = document.querySelector('.radar');
  var fr = radar.frames && radar.frames[radar.idx];
  if(!box || !fr) return;
  box.querySelectorAll('img.rn').forEach(function(img){
    img.style.visibility = '';
    img.src = img.src.replace(/nowc\/\d+\/none\/\d+\//, 'nowc/' + fr.b + '/none/' + fr.v + '/');
  });
  var tl = box.querySelector('.rtime');
  var nowIdx = radar.frames.filter(function(f){ return !f.f; }).length - 1;
  if(tl) tl.textContent = radarTimeLabel(fr.v) + (fr.f ? ' 予報' : radar.idx === nowIdx ? ' 現在' : '');
  var sl = document.getElementById('radar_t');
  if(sl && Number(sl.value) !== radar.idx) sl.value = radar.idx;
}
function radarStop(){ if(radar.play){ clearInterval(radar.play); radar.play = null; } }
function wxAction(act, t){
  if(act === 'radar-open'){ radar.open = true; radarLoad(); render(); return true; }
  if(act === 'radar-close'){ radar.open = false; radarStop(); render(); return true; }
  if(act === 'radar-reload'){ radar.at = 0; radar.frames = null; radarStop(); radarLoad(); render(); return true; }
  if(act === 'radar-now'){ radarStop(); radarShow(radar.frames ? radar.frames.filter(function(f){ return !f.f; }).length - 1 : 0); render(); return true; }
  if(act === 'radar-z'){ radar.z = Math.max(7, Math.min(10, radar.z + toNum(t.dataset.v))); render(); return true; }
  if(act === 'radar-play'){
    if(radar.play){ radarStop(); render(); return true; }
    if(!radar.frames) return true;
    radar.play = setInterval(function(){
      if(appId !== 'today' || !document.querySelector('.radar')){ radarStop(); return; }
      radarShow((radar.idx + 1) % radar.frames.length);
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
