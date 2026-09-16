/* くらしの手帳：この版で変わったこと */
/* ============================== 新しい版のお知らせ ==============================
   版が上がって初めて開いたときに、1回だけ出す。設定からいつでも見られる。     */
var CHANGELOG = [
  { build:'2026-09-17a', items:[
    ['同期', '同期のしくみを作り直しました。データを分けて圧縮して送るので、たくさん入れても止まりません。'],
    ['同期', '上の「同期済み／送れていません／オフライン」で、今の様子がわかります。押すと詳しい画面が開きます。'],
    ['同期', '写真も同期されます。ほかの端末で撮った写真も見られます。'],
    ['同期', '端末に名前をつけられます。予定の詳細に「どの端末で直したか」が出ます。'],
    ['Google', 'Googleカレンダーに予定が自動で入ります（通知は前日の0時）。iPhoneのカレンダーへのファイル書き出しは、これに変わりました。'],
    ['Google', 'Googleドライブに、毎週自動でバックアップします（写真も）。'],
    ['授業', 'シラバスの文章を貼ると、AIが評価の割合とテストの日を読み取ります（授業の詳細）。'],
    ['今日', '欠席があと1回で上限になる授業を、今日の画面で知らせます。'],
    ['通学', 'バス・電車が遅れたときや、乗りそこねたときに「次の便なら何時に着くか」を出します。'],
    ['お金', 'シフト表の写真から、シフトをまとめて登録できます（バイト）。'],
    ['お金', '1か月のお金の流れを1枚の図で見られます（お金 › ホーム）。'],
    ['そうだん', '声で相談できます（マイクのボタン）。答えの読み上げもできます。'],
    ['そうだん', 'よく使う相談をボタンにしておけます。'],
    ['そうだん', '長くなった会話は、AIが自動でまとめて軽くします。'],
    ['使いやすさ', '削除以外の操作（完了・移動・保存など）も「取り消す」でもどせます。'],
    ['使いやすさ', '時間割の表示を軽くしました。'],
    ['使いやすさ', '写真をタップすると大きく見られるようにしました（前は開きませんでした）。'],
    ['安心', 'エラーの記録を、設定から見られるようにしました。'],
    ['安心', 'パソコンで試すときは、本物のデータに触れない「テストモード」で動きます。']
  ]}
];
function whatsNewHtml(build){
  var list = build ? CHANGELOG.filter(function(c){ return c.build === build; }) : CHANGELOG;
  if(!list.length) return '<div class="empty" style="padding:8px 0">お知らせはありません。</div>';
  return list.map(function(c){
    return '<div class="wn-build">版 '+esc(c.build)+'</div>'+c.items.map(function(it){
      return '<div class="wn-row"><span class="b cat">'+esc(it[0])+'</span><span class="grow">'+esc(it[1])+'</span></div>';
    }).join('');
  }).join('');
}
function showWhatsNew(){
  var box = document.getElementById('whatsnew');
  if(!box){
    box = document.createElement('div');
    box.id = 'whatsnew';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    document.body.appendChild(box);
    box.addEventListener('click', function(e){
      if(e.target === box || (e.target.closest && e.target.closest('[data-wn-close]'))) closeWhatsNew();
    });
  }
  box.innerHTML = '<div class="wn-card"><h3>新しくなりました</h3>'+
    '<div class="wn-body">'+whatsNewHtml(APP_BUILD)+'</div>'+
    '<button class="btn" data-wn-close="1">わかった</button></div>';
  box.classList.add('on');
}
function closeWhatsNew(){
  var box = document.getElementById('whatsnew');
  if(box) box.classList.remove('on');
  SYNC_LOCAL.seenBuild = APP_BUILD; saveSyncLocal();
}
/* 初めてこの版を開いたときだけ出す（まったく初めての人には出さない） */
function maybeWhatsNew(){
  if(SYNC_LOCAL.seenBuild === APP_BUILD) return;
  var firstEver = !localStorage.getItem(KEY) && !SYNC_LOCAL.seenBuild;
  if(firstEver || TEST_MODE){ SYNC_LOCAL.seenBuild = APP_BUILD; saveSyncLocal(); return; }
  if(!CHANGELOG.some(function(c){ return c.build === APP_BUILD; })){ SYNC_LOCAL.seenBuild = APP_BUILD; saveSyncLocal(); return; }
  setTimeout(showWhatsNew, 900);
}
