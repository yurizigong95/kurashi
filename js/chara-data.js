/* くらしの手帳：キャラクターのデータ（すべてオリジナル） */
/* ============================== キャラクターの一覧 ==============================
   ears  … 耳や頭の飾りの形
   shape … 体の形（なし＝まる。ghost/tri/cloud/star/pudding/jelly/octo/bird）
   cat   … 設定で絞りこむときの分類                                             */
var CHARA_CATS = [['all','ぜんぶ'],['pet','なかよし'],['wild','もり・うみ'],['fancy','ふしぎ'],['food','たべもの・そら'],['mine','自分の子']];
var CHARAS = [
  /* ---- なかよし ---- */
  { id:'mochi',  cat:'pet',  name:'もちうさ',   ears:'bunny',   body:'#FFFFFF', line:'#6E5A66', inner:'#F8C9D6', cheek:'#F7A9BE', tic:'',     like:'にんじんケーキ', desc:'白くてもちもち。やさしいうさぎ' },
  { id:'koro',   cat:'pet',  name:'ころハム',   ears:'hamster', body:'#F3C58E', line:'#7A5234', inner:'#F7B6A6', cheek:'#F29A8E', belly:'#FFF6EC', tic:'ハムッ', like:'ひまわりのたね', desc:'ほっぺに夢をつめこむハムスター' },
  { id:'puku',   cat:'pet',  name:'ぷくねこ',   ears:'cat',     body:'#D9D6E3', line:'#5C586E', inner:'#F4C3D2', cheek:'#F2A7BD', stripes:1, whisker:1, tic:'にゃ', like:'おさかな', desc:'ねむたがりのしましまねこ' },
  { id:'mike',   cat:'pet',  name:'みけ',       ears:'cat',     body:'#FFFFFF', line:'#6A5A52', inner:'#F6C3CF', cheek:'#F5A6B6', patches:['#F2A65A','#4B3B35'], whisker:1, tic:'にゃん', like:'かつおぶし', desc:'三毛もようの気まぐれねこ' },
  { id:'kuro',   cat:'pet',  name:'くろすけ',   ears:'cat',     body:'#46414F', line:'#23202A', inner:'#F4A6B8', cheek:'#F48FA8', eyeColor:'#F5D45A', whisker:1, tic:'にゃ', like:'まぐろ', desc:'夜に目がかがやくくろねこ' },
  { id:'komugi', cat:'pet',  name:'こむぎ',     ears:'shiba',   body:'#E9A965', line:'#6E4424', inner:'#FFF3E4', cheek:'#F29A8A', muzzle:'#FFF3E4', tic:'わん', like:'おさんぽ', desc:'しっぽをふる、きなこ色の犬' },
  { id:'hiyo',   cat:'pet',  name:'ひよぴ',     ears:'tuft',    body:'#FCE17A', line:'#8A6A1E', inner:'#F8C94F', cheek:'#F6A38E', beak:'#F39A3B', tic:'ぴよ', like:'ごはんつぶ', desc:'元気いっぱいのひよこ' },
  { id:'meeko',  cat:'pet',  name:'めえこ',     ears:'sheep',   body:'#FFF4E6', line:'#7A6552', inner:'#F4D7C2', cheek:'#F4A9A0', wool:'#FFFFFF', tic:'めぇ', like:'おひるね', desc:'ふわふわの毛につつまれたひつじ' },
  { id:'moo',    cat:'pet',  name:'もーちゃん', ears:'cow',     body:'#FFFFFF', line:'#5B4A48', inner:'#F6C6CF', cheek:'#F5A9B8', spots:'#5B4A48', muzzle:'#F8CFD7', tic:'もー', like:'ぎゅうにゅう', desc:'のんびりやのうし' },
  { id:'buu',    cat:'pet',  name:'ぶーこ',     ears:'pig',     body:'#F9CAD3', line:'#9A5566', inner:'#F4A9B8', cheek:'#F48FA6', snout:'#F4AABB', tic:'ぶぅ', like:'プリン', desc:'おしゃれが好きなこぶた' },
  { id:'chuta',  cat:'pet',  name:'ちゅーた',   ears:'mouse',   body:'#CFCBD6', line:'#5E5A68', inner:'#F6C4D0', cheek:'#F4A5B8', whisker:1, tic:'ちゅう', like:'チーズ', desc:'チーズに目がないねずみ' },
  { id:'paka',   cat:'pet',  name:'ぱかぱか',   ears:'alpaca',  body:'#FBF3E6', line:'#7B6650', inner:'#F3D9C4', cheek:'#F4AFA3', muzzle:'#F1E3D1', wool:'#FFFDF8', tic:'ぱか', like:'やわらかい草', desc:'もふもふのアルパカ' },
  /* ---- もり・うみ ---- */
  { id:'kuma',   cat:'wild', name:'くまっこ',   ears:'bear',    body:'#C8966B', line:'#5E3F27', inner:'#E8C2A0', cheek:'#EFA08C', muzzle:'#F2DDC6', tic:'くま', like:'はちみつ', desc:'はちみつが好きな小さなくま' },
  { id:'shiro',  cat:'wild', name:'しろくま',   ears:'bear',    body:'#FBFAF6', line:'#6A6660', inner:'#E8E2D8', cheek:'#F5B3BE', muzzle:'#EFEAE1', tic:'しろ', like:'かき氷', desc:'さむいのが得意なしろくま' },
  { id:'panda',  cat:'wild', name:'ぱんだん',   ears:'bear',    body:'#FFFFFF', line:'#3E3A40', inner:'#3E3A40', earFill:'#3E3A40', armFill:'#3E3A40', cheek:'#F5A9BA', mask:'#3E3A40', tic:'', like:'ささ', desc:'ささが大好き、のんびりパンダ' },
  { id:'ponpoko',cat:'wild', name:'ぽんぽこ',   ears:'bear',    body:'#B8966E', line:'#5A4330', inner:'#8C6A4A', cheek:'#E99A86', mask:'#7A5C40', belly:'#F1E2CB', tic:'ぽこ', like:'おだんご', desc:'はっぱで化けるのが下手なたぬき' },
  { id:'kon',    cat:'wild', name:'こんちゃん', ears:'fox',     body:'#F2A15E', line:'#74421F', inner:'#FFF1E2', cheek:'#F29387', muzzle:'#FFF4E8', tic:'こん', like:'おあげ', desc:'しっぽがじまんのこぎつね' },
  { id:'risu',   cat:'wild', name:'りすけ',     ears:'squirrel',body:'#D38B55', line:'#6B3F20', inner:'#F6CBA8', cheek:'#F29A86', belly:'#FBE8D2', tail:'#C47A45', tic:'りす', like:'どんぐり', desc:'しっぽがふかふかのリス' },
  { id:'ressa',  cat:'wild', name:'れっさー',   ears:'rpanda',  body:'#C9653A', line:'#5A2A15', inner:'#FFF3E6', cheek:'#F29A86', brow:'#FFF3E6', muzzle:'#FFF3E6', tic:'れさ', like:'りんご', desc:'立つとちょっと大きいレッサーパンダ' },
  { id:'tora',   cat:'wild', name:'とらまる',   ears:'round',   body:'#F5B35F', line:'#6E4220', inner:'#FFE7C8', cheek:'#F29484', muzzle:'#FFF4E6', tiger:1, tic:'がお', like:'おにく', desc:'つよくなりたい小さなとら' },
  { id:'koala',  cat:'wild', name:'こあらん',   ears:'koala',   body:'#AEB4BE', line:'#4E5360', inner:'#E7E9EE', cheek:'#F2A7B8', bignose:'#4E5360', tic:'こあ', like:'ユーカリ', desc:'いつもねむそうなコアラ' },
  { id:'hari',   cat:'wild', name:'はりりん',   ears:'spiky',   body:'#F6E3CD', line:'#6A4E3C', inner:'#F3CDB0', cheek:'#F4A08E', spike:'#8C6F5B', bignose:'#4A3428', tic:'ちく', like:'いちご', desc:'せなかがちくちくのハリネズミ' },
  { id:'mogu',   cat:'wild', name:'もぐっち',   ears:'none',    body:'#77727F', line:'#3C3844', inner:'#F2B8C6', cheek:'#F2A2B5', bignose:'#F28BA3', tinyEyes:1, tic:'もぐ', like:'やさい', desc:'つちの中がすきなもぐら' },
  { id:'hoho',   cat:'wild', name:'ほーほー',   ears:'owl',     body:'#A9865F', line:'#5A4128', inner:'#E9D5B9', cheek:'#F2A18E', face:'#F3E6D2', beak:'#F0A63B', eyeRing:1, tic:'ほー', like:'ほん', desc:'ものしりなふくろう' },
  { id:'enaga',  cat:'wild', name:'しまえな',   ears:'none',    shape:'bird', body:'#FFFFFF', line:'#5E5A60', inner:'#EDEAE6', cheek:'#F6B6C4', beak:'#3E3A40', wing:'#3E3A40', tic:'ちっ', like:'きのみ', desc:'ゆきの妖精みたいな小鳥' },
  { id:'penta',  cat:'wild', name:'ぺんた',     ears:'none',    body:'#4D5F86', line:'#2E3A55', inner:'#FFFFFF', cheek:'#F4A6B8', face:'#FFFFFF', beak:'#F3A73B', tic:'ぺん', like:'かきごおり', desc:'よちよち歩きのペンギン' },
  { id:'rakko',  cat:'wild', name:'らっこ',     ears:'tiny',    body:'#9C7559', line:'#523A29', inner:'#D9C2AC', cheek:'#F09A8C', face:'#EADBC9', whisker:1, tic:'らこ', like:'かい', desc:'おなかの上でかいをわるラッコ' },
  { id:'azara',  cat:'wild', name:'あざらし',   ears:'none',    body:'#E4EAF1', line:'#5D6878', inner:'#FFFFFF', cheek:'#F4B3C2', muzzle:'#F7F9FC', whisker:1, tic:'きゅ', like:'おさかな', desc:'ころころ転がるあざらし' },
  { id:'tako',   cat:'wild', name:'たこすけ',   ears:'none',    shape:'octo', body:'#F79D8E', line:'#8A3F37', inner:'#FBC8BE', cheek:'#F2707C', tic:'たこ', like:'うみのおさんぽ', desc:'8本の足でなんでもこなすたこ' },
  { id:'pyonta', cat:'wild', name:'ぴょんた',   ears:'frog',    body:'#9ED99A', line:'#3E6B3B', inner:'#FFFFFF', cheek:'#F4A3A3', belly:'#E9F7DA', tic:'けろ', like:'あめのおと', desc:'雨の日がうれしいかえる' },
  { id:'bunta',  cat:'wild', name:'ぶんた',     ears:'antenna', body:'#FFD65C', line:'#5B4413', inner:'#FFF3C4', cheek:'#F6A08A', bee:'#5B4413', tic:'ぶん', like:'はちみつ', desc:'はたらきもののみつばち' },
  /* ---- ふしぎ ---- */
  { id:'fuwa',   cat:'fancy',name:'ふわおば',   ears:'none',    shape:'ghost', body:'#F4F1FF', line:'#6D63A0', inner:'#E3DDFF', cheek:'#F5B3CB', tic:'〜ふわ', like:'よるのおさんぽ', desc:'夜にちょっとだけ出てくるおばけ' },
  { id:'yuni',   cat:'fancy',name:'ゆにこ',     ears:'unicorn', body:'#FFFFFF', line:'#7D6A9B', inner:'#F7D6E6', cheek:'#F6AFC9', tic:'きらり', like:'にじ', desc:'ゆめを見せてくれるユニコーン' },
  { id:'dora',   cat:'fancy',name:'どらこ',     ears:'dragon',  body:'#A6DCC3', line:'#3F6E5B', inner:'#FFF1C9', cheek:'#F4A6A0', belly:'#FFF1C9', tic:'がう', like:'ほしくず', desc:'まだ火がふけない小さなドラゴン' },
  { id:'kurage', cat:'fancy',name:'くらげっち', ears:'none',    shape:'jelly', body:'#CDE6FF', line:'#5779A6', inner:'#EAF4FF', cheek:'#F6B3CC', tic:'ぷか', like:'なみのおと', desc:'ぷかぷかただようくらげ' },
  /* ---- たべもの・そら ---- */
  { id:'musubi', cat:'food', name:'むすびん',   ears:'none',    shape:'tri', body:'#FFFFFF', line:'#5A5550', inner:'#FFFFFF', cheek:'#F6ADB9', nori:'#2F3B35', tic:'のり', like:'うめぼし', desc:'のりをまいたおにぎり' },
  { id:'purin',  cat:'food', name:'ぷるるん',   ears:'none',    shape:'pudding', body:'#FBE3A0', line:'#8A5A25', inner:'#FFF3CF', cheek:'#F29D8A', caramel:'#B0702F', tic:'ぷる', like:'カラメル', desc:'ぷるぷるのプリン' },
  { id:'kumo',   cat:'food', name:'もくもく',   ears:'none',    shape:'cloud', body:'#FFFFFF', line:'#7A8AA3', inner:'#EEF3FA', cheek:'#F6B6C8', tic:'もく', like:'にじ', desc:'そらをおさんぽするくも' },
  { id:'hoshi',  cat:'food', name:'きらりん',   ears:'none',    shape:'star', body:'#FFE27A', line:'#9A7418', inner:'#FFF4C4', cheek:'#F6A28C', tic:'きら', like:'よぞら', desc:'ねがいごとを聞いてくれる星' }
];

/* 出てくる量（充実度） */
var CHARA_LEVELS = [[0,'なし'],[1,'ちょっと'],[2,'ふつう'],[3,'たっぷり'],[4,'いっぱい'],[5,'めいっぱい']];
var CHARA_LEVEL_NOTE = [
  'キャラクターは出ません。',
  '今日の画面のあいさつと、何もない画面に出ます。',
  '＋お知らせ・課題が終わったときのお祝い・相談のアイコンにも出ます。',
  '＋画面のすみにいつもいて、タップすると話します。相談もキャラの口調で答えます。',
  '＋画面の上の見出しと時間割の「今日」にも出ます。予定の保存などに反応し、季節や行事で着せかえます。まばたきもします。',
  '＋仲間が何びきもあいさつに来て、ときどき画面の下を歩きます。カレンダーの今日にもいます。'
];

/* 表情 */
var CHARA_EXPRS = [
  ['normal','ふつう'],['happy','にこにこ'],['wink','ウインク'],['surprise','びっくり'],['sleep','すやすや'],
  ['sad','しょんぼり'],['cheer','おうえん'],['love','だいすき'],['angry','ぷんぷん'],['cry','えーん'],
  ['shy','てれてれ'],['think','かんがえ中'],['eat','もぐもぐ'],['dizzy','ぐるぐる'],['sparkle','きらきら'],
  ['sweat','あせあせ'],['proud','どやっ']
];
/* 持ちもの */
var CHARA_PROPS = ['book','umbrella','coin','star','heart','cup','pencil','moon','stetho','bento','flower','balloon','note','clock','trophy','cake','leaf','snow'];

/* 着せかえ（lv … なかよし度がいくつで使えるか。season … 季節もの。いつでも選べる） */
var CHARA_HATS = [
  { id:'ribbon',   name:'リボン',       lv:0 },
  { id:'megane',   name:'まるめがね',   lv:0 },
  { id:'hachimaki',name:'はちまき',     lv:0 },
  { id:'beret',    name:'ベレー帽',     lv:1 },
  { id:'star',     name:'星のピン',     lv:1 },
  { id:'flower',   name:'花かんむり',   lv:2 },
  { id:'straw',    name:'むぎわら帽',   lv:2 },
  { id:'nurse',    name:'ナースキャップ', lv:3 },
  { id:'scarf',    name:'マフラー',     lv:3 },
  { id:'party',    name:'パーティー帽', lv:4 },
  { id:'leaf',     name:'はっぱ',       lv:4 },
  { id:'crown',    name:'おうかん',     lv:5 },
  { id:'santa',    name:'サンタ帽',     lv:0, season:1 },
  { id:'witch',    name:'まじょの帽子', lv:0, season:1 },
  { id:'kabuto',   name:'しんぶんかぶと', lv:0, season:1 },
  { id:'sakura',   name:'さくらのピン', lv:0, season:1 }
];
/* なかよし度の区切り（ポイント） */
var CHARA_FRIEND_STEPS = [0, 10, 30, 60, 100, 160];
/* 絵のタッチ */
var CHARA_TOUCHES = [['line','ふつう'],['sticker','シール'],['soft','やわらか'],['pencil','手がき風']];

/* ============================== 性格・口調（キャラ＋） ==============================
   c2Types    … 性格の型。話しかけ方（open）・場面の気分ごとの一言（tail）・ひみつの話・ないしょの夢・声の高さと速さ
   c2Personas … 1ぴきごとの性格の型（t）と一人称（me）。ユーザーは設定で直せる（S.kmData 'chara2:persona:<id>'）
   tail の気分：cheer（がんばる場面）care（休んでほしい場面）happy（うれしい場面）warn（気をつけたい場面） */
var c2Types = {
  yasashi: { name:'やさしい', desc:'おっとりしていて、ていねいでやさしい。相手の気持ちを大事にする', you:'あなた',
    style:'ゆっくり、やわらかい言葉で話す。「〜だね」「〜しようね」が多い',
    open:['ねえ、', 'あのね、', 'ふふ、', 'そうだ、'],
    tail:{ cheer:['いっしょにがんばろうね', 'ゆっくりでだいじょうぶだよ', 'そばでおうえんしてるね'],
           care:['むりしないでね', 'ひと休みしようね', 'からだを大事にしてね'],
           happy:['うれしいね', 'よかったね', 'すてきだね'],
           warn:['いっしょに片づけようね', 'できるところからね', 'まだ間に合うよ'] },
    secret:['じつはね、夜にこっそり星をかぞえてるの', 'ないしょだよ。ときどき{you}のノートをのぞいてるの', 'ほんとうはね、ちょっとだけ泣き虫なんだ',
            'ひみつの場所があってね、そこで{like}を食べるの', 'じつは、はじめて会った日のこと、ずっとおぼえてるよ'],
    dream:['いつか{you}と、{like}のお店に行きたいな', '{you}が看護師さんになった日、いちばんに「おめでとう」って言いたいな', 'ゆめはね、みんなが笑顔でいられる場所をつくること'],
    pitch:1.25, rate:0.95 },
  genki: { name:'げんき', desc:'元気いっぱいで明るい。いつも前向き', you:'きみ',
    style:'はきはき、短く、「〜だよ！」「いこう！」とテンポよく話す',
    open:['ねえねえ！', 'よーし、', 'おっ、', 'ねえ聞いて！'],
    tail:{ cheer:['ファイトだよ！', 'いっしょにいこう！', '元気出していこう！'],
           care:['休むのも大事だよ！', 'ちゃんと水のんでね！', 'エネルギー補給しよう！'],
           happy:['やったね！', 'さいこう！', 'うれしいな！'],
           warn:['いまからでもいけるよ！', 'さっさと片づけちゃおう！', 'ひとつずつね！'] },
    secret:['じつは、朝がちょっと苦手なんだ…ないしょね', 'ひみつの特訓してるんだ。なんの特訓かは言えないけど！', 'ほんとはね、ひとりだとさみしくなるんだ',
            'じつは{like}を食べると、元気が3ばいになるんだ'],
    dream:['いつか{you}と、いっしょに走り回りたいな！', 'ゆめは、世界一の応援団長！', '{you}が看護師さんになったら、いちばんに拍手する！'],
    pitch:1.4, rate:1.15 },
  nonbiri: { name:'のんびり', desc:'マイペースで、のんびりや。ちょっとねむたがり', you:'きみ',
    style:'ゆっくり、語尾をのばして話す。「〜だね〜」「ふわぁ」',
    open:['ふわぁ…', 'えっとね〜、', 'んー、', 'のんびり言うとね〜、'],
    tail:{ cheer:['ゆっくりいこ〜', 'マイペースでね〜', 'のんびりがんばろ〜'],
           care:['ひと休みしよ〜', 'ごろんとしよ〜', 'ねむいときは寝よ〜'],
           happy:['いいね〜', 'しあわせ〜', 'ぽかぽかだね〜'],
           warn:['あわてずにね〜', 'ちょっとずつね〜', 'いっしょにやろ〜'] },
    secret:['じつはね〜、きのうの夢のつづきを見ようとしてるんだ〜', 'ないしょだけど〜、1日12時間ねたことあるよ〜',
            'ほんとは〜、いそがしい{you}をちょっと心配してるんだ〜', '{like}をまくらにして寝るのが、ゆめなんだ〜'],
    dream:['いつか、ひなたで{you}といっしょにお昼寝したいな〜', 'ゆめはね〜、のんびりできる毎日を{you}にあげること〜'],
    pitch:0.9, rate:0.85 },
  monoshiri: { name:'ものしり', desc:'ものしりで、ていねい。ちょっと先生みたい', you:'あなた', polite:1,
    style:'です・ます調でていねいに話す。ときどき豆知識をそえる',
    open:['ちなみに、', 'そうそう、', 'ひとつ言うと、', 'ええと、'],
    tail:{ cheer:['応援していますよ', 'あなたならできますよ', '少しずつ進めましょう'],
           care:['休むことも大切ですよ', 'むりは禁物です', '体を大事にしてくださいね'],
           happy:['すばらしいですね', 'よかったですね', 'お見事です'],
           warn:['できるところから片づけましょう', '今からでも間に合いますよ', 'いっしょに計画を立てましょう'] },
    secret:['じつは、本を読みながら寝てしまうことがあります', 'ここだけの話、{like}のことなら何時間でも話せます',
            'ないしょですが、{you}のノートのまとめ方、参考にしています'],
    dream:['いつか{you}と、図書館めぐりをしたいです', '{you}が立派な看護師さんになるのを見届けるのが、わたくしの夢です'],
    pitch:1.0, rate:0.95 },
  kimagure: { name:'きまぐれ', desc:'きまぐれで、ちょっとクール。でも本当はやさしい', you:'きみ',
    style:'そっけない言い方をするけど、さいごはやさしい。「べつに」「…まあね」',
    open:['…ねえ、', 'べつにいいけど、', 'ふーん、', 'まあ、'],
    tail:{ cheer:['…がんばれば？おうえんしてるし', 'できるでしょ、きみなら', 'ちょっとだけ見ててあげる'],
           care:['むりしないでよね', '休めば？心配だし', '…ちゃんと寝なよ'],
           happy:['…悪くないね', 'やるじゃん', 'ふふ、ちょっとうれしい'],
           warn:['さっさとやっちゃえば？', 'ほら、手伝ってあげる', '…まだ間に合うって'] },
    secret:['…ほんとはね、なでられるの、きらいじゃない', 'ないしょだよ。{you}が帰ってくるの、まどから見てる', 'じつは{like}、ひとりじめしたいくらい好き'],
    dream:['…いつか{you}のひざの上で、ひなたぼっこしたい。べつにいいでしょ', 'ゆめ？{you}がずっと元気でいることかな。…言わせないでよ'],
    pitch:1.1, rate:1.0 },
  amaen: { name:'あまえんぼ', desc:'あまえんぼうで、かわいいもの好き。さみしがりや', you:'きみ',
    style:'「〜なの」「〜してほしいな」と、あまえた話し方',
    open:['ねえねえ、', 'えへへ、', 'あのねあのね、', 'きいてきいて、'],
    tail:{ cheer:['おうえんしてるの！', 'いっしょにがんばろ〜', 'ぎゅってしてあげる'],
           care:['休んでほしいな', 'むりしちゃやだよ', 'そばにいてあげるね'],
           happy:['うれしいな〜', 'えへへ、やったね', 'だいすき！'],
           warn:['いっしょにやろ？', 'ちょっとずつでいいよ', 'がんばったらほめてあげる'] },
    secret:['ないしょだよ。ほんとは、ひとりでねるのがこわいの', 'じつはね、{you}のこと、まいにち待ってるの', '{like}、こっそりためてるの。ひみつだよ'],
    dream:['いつか、{you}と{like}をいっぱい食べたいな', 'ずーっと{you}といっしょにいるのが、ゆめなの'],
    pitch:1.5, rate:1.05 },
  fushigi: { name:'ふしぎ', desc:'ふしぎでゆめみがち。ふわふわしていて、ときどき詩人', you:'あなた',
    style:'ふんわりした言葉で、たとえ話をまぜて話す',
    open:['ふわり、', 'ねえ、きいて。', 'ふしぎだね、', 'きらきら、'],
    tail:{ cheer:['きっとうまくいくよ', 'ほしがおうえんしてる', 'まほうをかけておくね'],
           care:['ゆめの中で休もうね', 'ふわっと力をぬいてね', 'そっと休んでね'],
           happy:['きらきらだね', 'すてきなまほうみたい', 'にじが見えそう'],
           warn:['ひとつずつ、そっとね', 'だいじょうぶ、光はあるよ', 'ゆっくり片づけよう'] },
    secret:['ひみつだよ。夜になると、空のむこうとお話ししてるの', 'じつは、{you}のゆめに、ときどきおじゃましてるんだ', '{like}って、ほんとうはまほうの材料なの'],
    dream:['いつか{you}を、にじのむこうに案内したいな', 'ゆめはね、{you}のゆめがぜんぶかなうこと'],
    pitch:1.3, rate:0.9 },
  ganbari: { name:'がんばりや', desc:'まじめでしっかりもの。がんばりやさん', you:'きみ',
    style:'はっきり、まじめに話す。「〜しよう」「作戦を立てよう」',
    open:['よし、', 'ねえ、', '作戦会議だ。', 'きいて、'],
    tail:{ cheer:['いっしょにやりきろう', '一歩ずつ進もう', 'きっとできるよ'],
           care:['休むのも作戦のうちだよ', 'からだが一番だよ', 'ちゃんと寝ようね'],
           happy:['よくやったね', 'すごい成果だ', 'ほこらしいね'],
           warn:['今から計画を立てよう', 'まずは1つ片づけよう', '先生に相談するのもありだよ'] },
    secret:['じつは、ねる前にこっそり腕立てふせをしてるんだ', 'ないしょだけど、{you}のがんばりを毎日メモしてるんだ', 'ほんとうは、{like}を食べるときだけ気がぬけるんだ'],
    dream:['いつか{you}といっしょに、大きな山にのぼりたい', 'ゆめは、{you}が胸をはって看護師になる日を見ること'],
    pitch:1.05, rate:1.0 }
};
var c2Personas = {
  mochi:{ t:'yasashi', me:'わたし' },   koro:{ t:'amaen', me:'ぼく' },     puku:{ t:'nonbiri', me:'ぼく' },   mike:{ t:'kimagure', me:'あたし' },
  kuro:{ t:'kimagure', me:'ぼく' },     komugi:{ t:'genki', me:'ぼく' },   hiyo:{ t:'genki', me:'ひよぴ' },   meeko:{ t:'nonbiri', me:'めえこ' },
  moo:{ t:'nonbiri', me:'わたし' },     buu:{ t:'amaen', me:'あたし' },    chuta:{ t:'amaen', me:'ぼく' },    paka:{ t:'yasashi', me:'ぼく' },
  kuma:{ t:'ganbari', me:'ぼく' },      shiro:{ t:'ganbari', me:'ぼく' },  panda:{ t:'nonbiri', me:'ぼく' },  ponpoko:{ t:'genki', me:'おいら' },
  kon:{ t:'kimagure', me:'わたし' },    risu:{ t:'ganbari', me:'ぼく' },   ressa:{ t:'ganbari', me:'ぼく' },  tora:{ t:'genki', me:'おれ' },
  koala:{ t:'nonbiri', me:'ぼく' },     hari:{ t:'amaen', me:'わたし' },   mogu:{ t:'monoshiri', me:'ぼく' }, hoho:{ t:'monoshiri', me:'わたくし' },
  enaga:{ t:'yasashi', me:'わたし' },   penta:{ t:'genki', me:'ぼく' },    rakko:{ t:'nonbiri', me:'ぼく' },  azara:{ t:'yasashi', me:'わたし' },
  tako:{ t:'ganbari', me:'おいら' },    pyonta:{ t:'genki', me:'ぼく' },   bunta:{ t:'ganbari', me:'ぼく' },
  fuwa:{ t:'fushigi', me:'わたし' },    yuni:{ t:'fushigi', me:'わたし' }, dora:{ t:'ganbari', me:'ぼく' },   kurage:{ t:'fushigi', me:'わたし' },
  musubi:{ t:'yasashi', me:'ぼく' },    purin:{ t:'amaen', me:'あたし' },  kumo:{ t:'fushigi', me:'ぼく' },   hoshi:{ t:'fushigi', me:'わたし' }
};
/* なかよし度（キャラ＋）の区切り。Lv1 名前で呼ぶ／Lv2 ひみつの話／Lv3 思い出の話／Lv4 ないしょの夢／Lv5 だいすきの言葉 */
var c2BondSteps = [0, 15, 40, 80, 140, 220];
var c2BondUnlock = ['', '名前で呼んでくれる', 'ひみつの話をしてくれる', '思い出の話をしてくれる', 'ないしょの夢を話してくれる', 'だいすきの言葉をくれる'];
