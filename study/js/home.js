/* もんだいメーカー：「ホーム」タブ */

function homeView(){
  var td = today(), d = dayCount(td), goal = Math.max(1, toNum(S.set.goal) || 10);
  var st = streak();
  var all = qsAll().length;
  var h = '';
  h += '<section class="card hero">' +
    '<div class="heroTop"><div class="ring" style="--p:' + clamp(Math.round(d.n * 100 / goal), 0, 100) + '">' +
      '<span>' + d.n + '<small>/' + goal + '</small></span></div>' +
    '<div class="bd"><b>' + (d.n >= goal ? 'きょうの分、おわりました！' : 'きょうの勉強') + '</b>' +
    '<div class="s">' + (st ? st + '日つづいています🔥' : 'まずは1問からいきましょう') + '</div>' +
    (d.n ? '<div class="s">せいかい ' + d.ok + ' / ' + d.n + '問</div>' : '') +
    '</div></div>' +
    '<div class="pair">' +
      btn('▶ 今日の分をとく', 'hm-go', { cls:'main' }) +
      btn('📸 問題をつくる', 'tab', { data:{ tab:'make' }, cls:'ghost' }) +
    '</div>' +
    '</section>';

  if(!all){
    h += section('はじめかた', null,
      '<ol class="steps">' +
        '<li><b>科目をつくる</b>…「科目」タブで、授業の名前を足します</li>' +
        '<li><b>資料をよみこむ</b>…「つくる」タブで、授業の写真やスライドをえらびます</li>' +
        '<li><b>とく</b>…作った問題が、忘れにくい順に出ます</li>' +
      '</ol>' +
      '<div class="pair">' + btn('🗂 科目をつくる', 'tab', { data:{ tab:'lib' }, cls:'main' }) +
        btn('🧪 まず表から作ってみる', 'hm-kit', { cls:'ghost' }) + '</div>' +
      note('AIを使わない「表から作る」なら、APIキーがなくてもすぐ試せます。'));
    return h;
  }

  var list = subs();
  if(list.length){
    h += section('科目べつ', null, '<div class="subgrid">' + list.map(function(s){
      var todo = todoCount(s.id), stt = stats(s.id);
      return '<button type="button" class="subcard" data-act="hm-sub" data-id="' + s.id + '" style="--c:' + (s.color ? colorOf(s.color) : '#999') + '">' +
        '<span class="ic">' + esc(s.icon || '📘') + '</span>' +
        '<b>' + esc(s.name) + '</b>' +
        '<span class="s">' + (todo ? '今日 ' + todo + '問' : 'おわり') + '</span>' +
        bar(stt.total ? stt.answered * 100 / stt.total : 0) +
        '</button>';
    }).join('') + '</div>');
  }
  var wrong = weakList('all').length;
  h += section('つづける', null,
    '<div class="pair3">' +
      btn('❌ にが手 ' + wrong, 'dr-weak', { cls:'ghost' }) +
      btn('📝 模擬テスト', 'hm-moc', { cls:'ghost' }) +
      btn('🧪 AIなしで作る', 'hm-kit', { cls:'ghost' }) +
    '</div>' +
    '<div class="stats">' +
      statBox('ぜんぶの問題', all) +
      statBox('きょう出す', todoCount('')) +
      statBox('つづけた日', st) +
    '</div>');
  if((S.moc || []).length){
    var m = S.moc[0];
    h += section('この前の模擬テスト', mdText(m.at),
      '<div class="score"><b>' + m.ok + '</b> / ' + m.n + '問　<span class="pct">' + Math.round(m.ok * 100 / Math.max(1, m.n)) + '%</span></div>');
  }
  return h;
}
onView('home', homeView);
onAct('hm-go', function(){
  view.sub = ''; view.unit = ''; view.weak = 0; view.moc = 0;
  drill.mode = pool('', 'due').length ? 'due' : 'new';
  go('drill');
  drillStart(drill.mode, drill.n);
});
onAct('hm-sub', function(d){
  view.sub = d.id; view.unit = ''; view.weak = 0; view.moc = 0;
  drill.mode = pool(d.id, 'due').length ? 'due' : 'new';
  go('drill');
});
onAct('hm-moc', function(){ view.moc = 1; view.weak = 0; go('drill'); });
onAct('hm-kit', function(){ mk.mode = 'kit'; go('make'); });
