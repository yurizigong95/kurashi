/* もんだいメーカー：「設定」タブ（AIのキー・目標・成績・バックアップ） */

function setView(){
  var h = '';
  var key = aiKey();
  h += section('AI（Gemini）のキー', key ? '入っています' : 'まだです',
    '<label class="f" for="st_key">APIキー</label>' +
    '<input id="st_key" type="password" autocomplete="off" placeholder="' + (key ? '●●●●●●（入っています）' : 'AIza… ではじまる文字') + '" value="">' +
    '<div class="pair">' + btn('入れる', 'st-key', { cls:'main' }) + btn('消す', 'st-keydel', { cls:'ghost', dis:!key }) + '</div>' +
    '<label class="f">かしこさ</label>' +
    chips(AI_MODELS.map(function(m){ return [m[0], m[1]]; }), S.set.model || '', 'st-model') +
    note('キーは<b>この端末の中だけ</b>に保存します（どこにも送りません）。' +
      'キーは Google AI Studio（aistudio.google.com）の「Get API key」で作れます。' +
      '<br>キーがなくても、「つくる」タブの<b>表から作る（AIなし）</b>と、作った問題をとくのは、ぜんぶ使えます。'));

  var u = aiUse(), l = aiLim();
  h += section('AIをどれだけ使ったか', 'きょう ' + toNum(u.req) + '回',
    '<div class="stats">' +
      statBox('AIを呼んだ回数', toNum(S.set.aiCount)) +
      statBox('AIなしで作った問題', toNum(S.set.aiSaved)) +
    '</div>' +
    '<table class="use"><tbody>' +
      '<tr><th></th><th>回数</th><th>読んだ量</th><th>書いた量</th><th>送った大きさ</th><th>お金のめやす</th></tr>' +
      '<tr><th>きょう</th><td>' + toNum(u.req) + '回</td><td>' + aiTokText(u.tin) + '</td><td>' + aiTokText(u.tout) + '</td><td>' + fSizeText(u.up) + '</td><td>' + aiYenText(aiYen(u.tin, u.tout)) + '</td></tr>' +
      '<tr><th>今月</th><td>' + toNum(u.mreq) + '回</td><td>' + aiTokText(u.mtin) + '</td><td>' + aiTokText(u.mtout) + '</td><td>' + fSizeText(u.mup) + '</td><td>' + aiYenText(aiYen(u.mtin, u.mtout)) + '</td></tr>' +
    '</tbody></table>' +
    '<label class="f">無料のめやす（1日に作れる回数）</label>' +
    '<input id="st_rpd" type="number" min="0" max="10000" inputmode="numeric" value="' + esc(inVal('st_rpd', String(toNum(l.rpd)))) + '">' +
    '<div class="pair">' +
      '<div><label class="f" for="st_yin">読む1Mトークンの値段（円）</label><input id="st_yin" type="number" min="0" max="100000" inputmode="numeric" value="' + esc(inVal('st_yin', String(toNum(l.yenIn)))) + '"></div>' +
      '<div><label class="f" for="st_yout">書く1Mトークンの値段（円）</label><input id="st_yout" type="number" min="0" max="100000" inputmode="numeric" value="' + esc(inVal('st_yout', String(toNum(l.yenOut)))) + '"></div>' +
    '</div>' +
    btn('めやすを保存', 'st-lim', { cls:'ghost' }) +
    note('「回数」「読んだ量」「書いた量」は、Googleが返してきた数をそのまま足しています（あてずっぽうではありません）。' +
      '<br><b>お金と無料のめやすは“めやす”です。</b>無料でどれだけ使えるか・1トークンいくらかは、モデルや時期で変わります。' +
      'いまの数字は、上の欄で直せます（はじめは1日20回・読む45円／書く375円で入れてあります）。' +
      '<br>ほんとうの請求は、Google AI Studio や Google Cloud の画面でたしかめてください。'));

  var sy = syState();
  h += section('ほかの端末とそろえる', sy.on ? 'オン' : null,
    '<div class="s"><b>' + esc(sy.text) + '</b></div>' +
    (sy.sub ? '<div class="s">' + esc(sy.sub) + '</div>' : '') +
    (syReady() ? '<div class="pair" style="margin-top:10px">' +
      btn('いますぐ合わせる', 'st-sync', { cls:'ghost' }) +
      btn(SY.on ? '同期をやめる' : '同期をはじめる', 'st-syncsw', { cls:'ghost' }) +
    '</div>' : '') +
    note('スマホ・iPad・パソコンのどれで直しても、<b>ひとりでにそろいます</b>（科目・資料・問題・といた記録・にが手ノート・資料の写真）。' +
      '<br>つなぎ先は、くらしの手帳と同じところです。同じ2つのアプリを入れていれば、それだけで動きます。' +
      '<br><b>APIキーと、使った量の記録は、同期しません</b>（端末ごとのものだからです）。' +
      '<br>同じものを2台で直したときは、<b>あとから直したほう</b>がのこります。消したものは、ほかの端末でも消えます。'));

  h += section('勉強のしかた', null,
    '<label class="f">1日の目標</label>' +
    '<div class="pillrow">' + [5, 10, 20, 30, 50].map(function(n){
      return '<button type="button" data-act="st-goal" data-v="' + n + '" class="' + (toNum(S.set.goal) === n ? 'on' : '') + '">' + n + '問</button>';
    }).join('') + '</div>' +
    '<label class="f">4択のならび</label>' +
    '<div class="pillrow">' +
      '<button type="button" data-act="st-shuffle" data-v="1" class="' + (S.set.shuffle ? 'on' : '') + '">毎回いれかえる</button>' +
      '<button type="button" data-act="st-shuffle" data-v="0" class="' + (!S.set.shuffle ? 'on' : '') + '">そのまま</button>' +
    '</div>' +
    '<label class="f" for="st_term">いまの学期</label>' +
    '<div class="pair"><input id="st_term" type="text" maxlength="12" placeholder="2026前期" value="' + esc(inVal('st_term', S.set.term || '')) + '">' +
      btn('入れる', 'st-term', { cls:'ghost' }) + '</div>' +
    '<div class="pillrow">' +
      '<button type="button" data-act="st-allterms" class="' + (S.set.allTerms ? 'on' : '') + '">ほかの学期の科目も出す</button>' +
    '</div>');

  h += setStatsPart();

  h += section('バックアップ', null,
    '<div class="pair">' + btn('📤 書き出す', 'st-export', { cls:'ghost' }) + btn('📥 読みこむ', 'st-import', { cls:'ghost' }) + '</div>' +
    note('問題・科目・記録を1つのファイルにします（写真はふくみません）。機種変えのときに使ってください。') +
    '<div class="minirow">' +
      '<button type="button" data-act="st-csv">問題をCSVで書き出す</button>' +
      '<button type="button" data-act="st-sweep">使っていない写真をそうじ</button>' +
      '<button type="button" data-act="st-logreset">記録だけ消す（問題はのこす）</button>' +
      '<button type="button" data-act="st-reset">ぜんぶ消す</button>' +
    '</div>');

  h += section('このアプリについて', APP_BUILD,
    '<div class="s">' + esc(APP_NAME) + '（版 ' + APP_BUILD + '）<br>' +
      '作った問題は、この端末の中に保存されます。' +
      '<br>先に入れてある表：基準値' + dLabs().length + '・略語' + dDicts().length + '・薬' + dDrugs().length +
      '・手順' + dSkills().length + '・練習問題' + D_QS.length + '・計算' + D_CALC.length + '種</div>' +
    warnBox('AIが作った問題は、かならず<b>教科書・先生の資料で確かめて</b>ください。' +
      '<br>実習記録など、<b>患者さんの情報がある資料は読みこまないで</b>ください。'));
  return h;
}
function setStatsPart(){
  var days = [], td = today();
  for(var i = 6; i >= 0; i--){
    var d = shiftDate(td, -i);
    days.push([d, dayCount(d)]);
  }
  var max = Math.max(1, Math.max.apply(null, days.map(function(x){ return x[1].n; })));
  var fields = {};
  qsAll().forEach(function(q){
    var s = sub(q.sub), f = (s && s.field) || '';
    if(!f) return;
    var l = logOf(q.id);
    if(!l) return;
    fields[f] = fields[f] || { n:0, ok:0 };
    fields[f].n += toNum(l.n);
    fields[f].ok += toNum(l.ok);
  });
  var fkeys = Object.keys(fields).sort(function(a, b){
    return (fields[a].ok / Math.max(1, fields[a].n)) - (fields[b].ok / Math.max(1, fields[b].n));
  });
  return section('成績', streak() + '日つづけています',
    '<div class="week">' + days.map(function(x){
      var hpct = Math.round(x[1].n * 100 / max);
      return '<div class="wd"><span class="bar" style="height:' + Math.max(4, hpct) + '%"></span>' +
        '<small>' + mdText(x[0]).split('/')[1] + '</small></div>';
    }).join('') + '</div>' +
    (fkeys.length
      ? '<label class="f">分野べつの正答率（にが手な順）</label>' +
        fkeys.map(function(f){
          var r = Math.round(fields[f].ok * 100 / Math.max(1, fields[f].n));
          return '<div class="frow"><span class="nm">' + esc(dFieldName(f)) + '</span>' + bar(r, r >= 80 ? 'good' : r >= 60 ? '' : 'bad') +
            '<span class="pct">' + r + '%</span></div>';
        }).join('')
      : note('科目に「国試の分野」を決めると、分野べつの正答率が出ます（科目タブ）。')));
}
/* ===== バックアップ ===== */
function setExport(){
  var data = JSON.stringify({ app:'mondai', ver:1, at:new Date().toISOString(), data:S }, null, 0);
  try{
    var blob = new Blob([data], { type:'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mondai-' + today() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('書き出しました');
  }catch(e){
    toast('書き出せませんでした：' + e.message, true);
  }
}
/* 問題をCSVにする（Excel・暗記カードのアプリに持っていける） */
function csvCell(v){ return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
function csvText(){
  var rows = [['科目', '章', '種類', '問題', '答え', '選択肢', '解説', '出典'].map(csvCell).join(',')];
  qsAll().forEach(function(q){
    rows.push([subName(q.sub), q.ch || '', typeName(q.qt), q.q, answerText(q),
               (q.c || []).join(' / '), q.exp || '', q.src || ''].map(csvCell).join(','));
  });
  return rows;
}
function setCsv(){
  var rows = csvText();
  if(rows.length < 2){ toast('書き出す問題がありません', true); return; }
  try{
    /* Excelで開いても字がくずれないように、はじめに BOM を入れる */
    var blob = new Blob(['\ufeff' + rows.join('\r\n')], { type:'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mondai-' + today() + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast((rows.length - 1) + '問を書き出しました');
  }catch(e){
    toast('書き出せませんでした：' + e.message, true);
  }
}
function setImport(){
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.onchange = async function(){
    var f = (inp.files || [])[0];
    if(!f) return;
    try{
      var j = JSON.parse(String(await readAs(f, 'text')));
      var d = (j && j.data) ? j.data : j;
      if(!d || !Array.isArray(d.qs)) throw new Error('このアプリのバックアップではないようです');
      if(!ask('いまのデータを、読みこんだ内容に入れかえます。よろしいですか？')) return;
      ['subs', 'mats', 'qs', 'moc'].forEach(function(k){ if(Array.isArray(d[k])) S[k] = d[k]; });
      ['log', 'day', 'why', 'ui'].forEach(function(k){ if(d[k] && typeof d[k] === 'object') S[k] = d[k]; });
      if(d.set && typeof d.set === 'object'){
        var keep = S.set.key;                       /* キーは、いまの端末のものを残す */
        S.set = Object.assign({}, DEFAULT_SET, d.set);
        if(!S.set.key) S.set.key = keep;
      }
      saveNow();
      toast('読みこみました（問題' + S.qs.length + '問）');
      go('home');
    }catch(e){
      toast('読みこめませんでした：' + e.message, true);
    }
  };
  inp.click();
}

onView('set', setView);
onAct('st-key', function(){
  var v = String(elVal('st_key') || '').trim();
  if(!v){ toast('キーを入れてください', true); return; }
  S.set.key = v;
  inClear('st_key');
  saveNow();
  toast('入れました');
  render();
});
onAct('st-keydel', function(){
  if(!ask('APIキーを消しますか？')) return;
  S.set.key = '';
  saveNow();
  toast('消しました');
  render();
});
onAct('st-model', function(d){ S.set.model = d.v; syTouchSet(); saveNow(); render(); });
onAct('st-sync', function(){
  if(!syReady()){ toast('この端末でいちど「くらしの手帳」を開いてください', true); return; }
  if(!SY.on){ syStart().then(function(){ render(); }); toast('つないでいます…'); return; }
  toast('合わせています…');
  syPush().then(function(okp){ toast(okp ? 'そろえました' : (SY.msg || '合わせられませんでした'), !okp); render(); });
});
onAct('st-syncsw', function(){
  if(SY.on){ syStop(); toast('同期をやめました'); render(); return; }
  syStart().then(function(okp){ toast(okp ? '同期をはじめました' : (SY.msg || 'つなげませんでした'), !okp); render(); });
});
onAct('st-lim', function(){
  var l = aiLim();
  l.rpd = clamp(toNum(elVal('st_rpd')), 0, 10000);
  l.yenIn = clamp(toNum(elVal('st_yin')), 0, 100000);
  l.yenOut = clamp(toNum(elVal('st_yout')), 0, 100000);
  inClear('st_rpd'); inClear('st_yin'); inClear('st_yout');
  syTouchSet();
  saveNow();
  toast('めやすを保存しました');
  render();
});
onAct('st-goal', function(d){ S.set.goal = toNum(d.v); syTouchSet(); saveNow(); render(); });
onAct('st-shuffle', function(d){ S.set.shuffle = toNum(d.v); syTouchSet(); saveNow(); render(); });
onAct('st-term', function(){ S.set.term = String(elVal('st_term') || '').trim(); syTouchSet(); saveNow(); toast('学期を入れました'); render(); });
onAct('st-allterms', function(){ S.set.allTerms = S.set.allTerms ? 0 : 1; syTouchSet(); saveNow(); render(); });
onAct('st-export', function(){ setExport(); });
onAct('st-import', function(){ setImport(); });
onAct('st-csv', function(){ setCsv(); });
onAct('st-logreset', function(){
  if(!ask('といた記録（正解・まちがい・次の日）だけを消します。問題はのこります。よろしいですか？')) return;
  S.log = {}; S.day = {}; S.moc = []; S.why = {};
  saveNow();
  toast('記録を消しました');
  render();
});
onAct('st-sweep', async function(){
  var n = await photoSweep();
  toast(n ? n + '枚そうじしました' : 'そうじするものはありませんでした');
});
onAct('st-reset', function(){
  if(!ask('作った問題・科目・記録を、ぜんぶ消します。よろしいですか？')) return;
  if(!ask('本当に消しますか？（もとにもどせません）')) return;
  var key = S.set.key;
  S = blankState();
  S.set.key = key;
  saveNow();
  toast('ぜんぶ消しました');
  go('home');
});
