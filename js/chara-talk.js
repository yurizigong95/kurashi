/* くらしの手帳：キャラクターのセリフ（1ぴき1日200種類以上） */
/* ============================== セリフの素 ==============================
   ・組み合わせで、その日・その子だけのセリフを200種類以上つくる（AIがなくても動く）。
   ・AIが使えるときは、その日の予定や天気にあわせたセリフを、さらに200以上考えてもらう。
   ・キャラ＋：場面の文（時間・曜日・天気・予定・テスト・課題・暗記・おせわ・お金・季節・行事・記念日）×
     その子の性格の話しかけ方・一言・口ぐせ で、1ぴき数千とおりのセリフを作る（c2Scenes）。 */
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

/* ============================== 場面の文（キャラ＋） ==============================
   band … その時間帯だけに出す（morning 5〜10時／noon 11〜16時／evening 17〜21時／night 22〜23時／late 0〜4時）
   mood … 性格ごとの一言（c2Types[..].tail）の気分。base … どの子も使う文。type … 性格ごとの文
   {subj}{n}{task}{cls}{pet}{tmax}{pop}{hol}{fes}{anniv} … その日の中身。{me}{you}{name}{like} … その子のこと */
var c2Scenes = {
  /* ===== 時間 ===== */
  't-morning': { band:'morning', mood:'cheer',
    base:['おはよう。きょうもいい朝だね', '朝ごはん、なにを食べる？', 'きょうの予定、いっしょに見よう', 'お水を1ぱい飲んでから出かけよう', '顔をあらって、しゃきっとしよう', '持ちもの、たしかめた？'],
    type:{ yasashi:['おはよう。よくねむれたかな', 'ゆっくり目をさましてね'], genki:['おっはよー！きょうも元気にいこう', '朝から元気100ばい！'],
           nonbiri:['ふわぁ…まだねむいね…', 'あと5分…って言いたくなる朝だね'], monoshiri:['朝の光は、体内時計を整えてくれますよ', '朝ごはんは、脳のエネルギーになりますよ'],
           kimagure:['…おはよ。べつに待ってたわけじゃないけど', '朝か。まあ、起きられたならえらいね'], amaen:['おはよ〜！会いたかったよ', 'おはよ、なでなでして〜'],
           fushigi:['おはよう。ゆめの中から帰ってきたよ', '朝の光って、きらきらのまほうみたい'], ganbari:['おはよう！きょうのもくひょうを1つ決めよう', '朝のうちに、ひとつ終わらせよう'] } },
  't-noon': { band:'noon', mood:'care',
    base:['お昼ごはんの時間だね', '午前中おつかれさま', 'ちょっと目を休めよう', '午後の授業の場所、たしかめた？', 'のびをして、ひと休みしよう', '水分とってる？'],
    type:{ yasashi:['ちゃんと座って食べてね', '午後も{you}のペースでね'], genki:['午後もいっくぞー！', 'ごはん食べてパワー回復！'],
           nonbiri:['お昼寝したくなる時間だね〜', 'ぽかぽかして、ねむくなるね〜'], monoshiri:['食後は少し眠くなるものです。軽く歩くといいですよ', '午後の予習を5分だけしておきましょう'],
           kimagure:['お昼、なに食べるの？…ちょっと気になっただけ', 'ひと休みしたら？{me}もするし'], amaen:['お昼、いっしょに食べたいな〜', 'おやつも、ちょっとほしいな〜'],
           fushigi:['お昼の雲、ソフトクリームみたい', '空のむこうでも、だれかがお昼を食べてるかな'], ganbari:['午前のぶん、よくがんばったね', '午後の作戦を立てよう'] } },
  't-evening': { band:'evening', mood:'care',
    base:['おかえりなさい', 'きょうもおつかれさま', '晩ごはん、なにかな', '明日の準備、少しだけしよう', 'お風呂でゆっくりしてね', 'きょうできたこと、数えてみよう'],
    type:{ yasashi:['きょうも、よくがんばったね', 'あったかい飲みもので、ほっとしよう'], genki:['おかえり！きょうもよくがんばった！', '晩ごはん、もりもり食べよう！'],
           nonbiri:['やっと、のんびりタイムだね〜', 'ソファでごろごろしたいね〜'], monoshiri:['きょうの学びを1つ思い出してみましょう', 'お風呂は寝る1〜2時間前がよいそうですよ'],
           kimagure:['…おかえり。待ってないけどね', 'つかれた顔してる。…休みなよ'], amaen:['おかえり〜！さみしかったよ', 'ねえ、きょうのお話きかせて〜'],
           fushigi:['夕やけが、きょうも空にお絵かきしてたよ', 'おかえり。星がそろそろ起きてくるね'], ganbari:['おかえり。きょうのふりかえりをしよう', '明日の準備をして、すっきり寝よう'] } },
  't-night': { band:'night', mood:'care',
    base:['そろそろ寝る準備をしよう', 'スマホの光、少しへらそう', '明日の目覚まし、セットした？', 'きょうもよくがんばったね', 'あったかくして寝てね', 'おやすみの前に、お水ひとくち'],
    type:{ yasashi:['いい夢みてね', 'きょうのことは、きょうでおしまいにしようね'], genki:['しっかり寝て、明日も元気にいこう！', '寝るのもトレーニングだよ！'],
           nonbiri:['ふとん、あったかいね〜', 'もう、まぶたが重いよ〜'], monoshiri:['ねむっている間に、記憶が整理されるそうですよ', '寝る前の画面は、ねむりを浅くしますよ'],
           kimagure:['…もう寝れば？明日もあるし', 'おやすみ。…ちゃんと寝なよ'], amaen:['いっしょに寝よ〜', 'おやすみのぎゅーして〜'],
           fushigi:['星たちが、おやすみって言ってるよ', 'ゆめの入り口で待ってるね'], ganbari:['明日にそなえて、早めに寝よう', 'きょうのがんばり、ちゃんと見てたよ'] } },
  't-late': { band:'late', mood:'care',
    base:['もうこんな時間だよ', '夜ふかしはほどほどにね', '続きは明日の朝にしよう', '目をとじるだけでも休まるよ', 'ねむれないときは、ゆっくり呼吸しよう'],
    type:{ yasashi:['まだ起きてたの？心配だよ', 'あたたかくして、横になろうね'], genki:['もう寝る時間だよ！明日の元気のために！', '夜ふかしは元気の大敵！'],
           nonbiri:['ふわぁ…もうねむいよ〜', 'いっしょに、すやすやしよ〜'], monoshiri:['夜ふかしは集中力を下げます。もう休みましょう', '深夜の勉強より、朝の30分のほうが頭に入りますよ'],
           kimagure:['…まだ起きてるの？しょうがないな', 'ねむれないなら、ちょっとだけ付き合ってあげる'], amaen:['ねむれないの？そばにいるよ', 'いっしょに目をつむろ？'],
           fushigi:['夜のまんなかは、しずかでふしぎだね', 'お月さまも、そろそろねむたそう'], ganbari:['もう限界だよ。続きは明日にしよう', '寝るのも、だいじな作戦だよ'] } },
  /* ===== 曜日 ===== */
  'd-mon': { mood:'cheer', base:['あたらしい1週間のはじまりだね', '月曜日は、ゆっくりエンジンをかけよう', '今週のもくひょう、ひとつ決めよう', '今週の予定を見ておこう'] },
  'd-wed': { mood:'care', base:['週のまんなか、水曜日だね', 'もう半分まできたね', 'つかれがたまるころだね', 'きょうは早めに休もう'] },
  'd-fri': { mood:'happy', base:['金曜日！あと1日がんばろう', '週末まで、あと少しだね', '今週もよくがんばったね', '週末の予定、なにかある？'] },
  'd-sat': { mood:'happy', base:['土曜日だね。ゆっくり休めるかな', 'おやすみの日、なにしよう', 'たまった洗たく、しちゃおうか'] },
  'd-sun': { mood:'care', base:['日曜日だね。明日の準備もちょっとだけ', 'のんびりする日も大事だよ', '来週の予定、ちらっと見ておこう'] },
  /* ===== 天気 ===== */
  'w-sunny': { mood:'happy', base:['きょうは晴れそうだね', 'お日さまがきもちいいね', '洗たく日和かも', 'ひざしが強いときは、帽子をかぶろう'],
    type:{ yasashi:['いいお天気で、うれしいね'], genki:['晴れだー！外に出たくなる！'], nonbiri:['ひなたぼっこ日和だね〜'], monoshiri:['日光をあびると、夜ねむりやすくなりますよ'],
           kimagure:['晴れか。…まあ、悪くないね'], amaen:['お天気だから、おさんぽしたいな〜'], fushigi:['空が、にじ色のまほうをためてるみたい'], ganbari:['晴れの日は、気持ちも前向きにいこう'] } },
  'w-rain': { mood:'care', base:['雨がふりそう。傘をわすれないでね', '雨の日は、足もとに気をつけてね', '雨の音、ちょっとおちつくね', '雨の日は、バスがおくれることもあるよ', 'くつがぬれないように気をつけてね'],
    type:{ yasashi:['雨の日は、ゆっくり歩こうね'], genki:['雨でも元気にいこう！傘はもった？'], nonbiri:['雨の日は、おうちでぬくぬくしたいね〜'], monoshiri:['降水確率は{pop}%です。傘があると安心ですよ'],
           kimagure:['雨か…。傘、わすれたら知らないよ'], amaen:['雨の日は、くっついていたいな〜'], fushigi:['雨つぶが、ぽつぽつ歌ってるね'], ganbari:['雨の日は、いつもより5分早く出よう'] } },
  'w-snow': { mood:'warn', base:['雪がふるかも！あったかくしてね', '雪の日は、すべらないように気をつけよう', 'バスがおくれるかも。早めに出よう'],
    type:{ yasashi:['雪の日は、手ぶくろをわすれないでね'], genki:['雪だ！でも、すべらないように注意！'], nonbiri:['雪の日は、こたつから出たくないね〜'], monoshiri:['雪の日は、歩幅を小さくするとすべりにくいですよ'],
           kimagure:['雪か。…転ばないでよね'], amaen:['雪、つめたいね。あっためて〜'], fushigi:['空から、白い手紙がとどいてるね'], ganbari:['雪の日は、早めに出るのが作戦だ'] } },
  'w-hot': { mood:'care', base:['きょうは暑くなりそう。水分をこまめにね', '暑い日は、日かげで休もう', '熱中症に気をつけてね', 'きょうは{tmax}度まで上がるみたい'],
    type:{ yasashi:['暑いね。むりしないでね'], genki:['暑さに負けるな！でも水分はわすれずに！'], nonbiri:['あつくて、とけちゃいそう〜'], monoshiri:['のどがかわく前に、少しずつ飲むのがコツですよ'],
           kimagure:['暑い…。{you}も、ちゃんと水のみなよ'], amaen:['あついよ〜、アイス食べたいな〜'], fushigi:['お日さまが、はりきりすぎてるみたい'], ganbari:['暑い日は、休けいも計画に入れよう'] } },
  'w-cold': { mood:'care', base:['きょうは寒いね。上着をもっていこう', '手があたたまる飲みものがほしいね', '首もとをあたためると、ぽかぽかだよ', '朝と夜で、気温の差が大きいよ'],
    type:{ yasashi:['さむいね。あったかくしてね'], genki:['寒さなんかに負けないぞ！'], nonbiri:['さむいから、ふとんから出たくないね〜'], monoshiri:['首・手首・足首をあたためると効果的ですよ'],
           kimagure:['寒い。…{you}、かぜひかないでよ'], amaen:['さむいよ〜、ぎゅってして〜'], fushigi:['空気が、きんと澄んでるね'], ganbari:['寒い日は、からだを動かしてあたたまろう'] } },
  /* ===== 予定 ===== */
  'p-first': { mood:'cheer', base:['きょうは1限からだね', '1限の{cls}、ねぼうしないでね', '早めに家を出よう', '1限に間に合うように、準備はばっちり？'] },
  'p-noclass': { mood:'cheer', base:['きょうは授業がない日だね', '授業がない日は、じぶんのペースでね', '課題を進めるチャンスかも', 'たまった復習、ちょっとだけやろう'] },
  'p-work': { mood:'cheer', base:['きょうはバイトだね。いってらっしゃい', 'バイト、むりしないでね', 'バイトの前に、なにか食べておこう', 'バイトから帰ったら、ゆっくり休もう'],
    type:{ yasashi:['バイト、おつかれさまって待ってるね'], genki:['バイトもファイト！'], nonbiri:['バイトのあとは、ごろごろしよ〜'], monoshiri:['働いた時間は、あとで記録しておきましょう'],
           kimagure:['バイト？…いってらっしゃい。早く帰ってきなよ'], amaen:['バイトいっちゃうの？はやく帰ってきてね'], fushigi:['バイト先に、しあわせのかけらが落ちてるかも'], ganbari:['バイトも勉強も、両立してえらい'] } },
  'p-off': { mood:'happy', base:['おやすみの日だね。ゆっくりしよう', '休みの日こそ、ちゃんとごはんを食べよう', 'おでかけする？', 'たまには、思いっきりのんびりしよう'],
    type:{ yasashi:['きょうは、じぶんを甘やかしていい日だよ'], genki:['休みの日だ！なにしてあそぶ？'], nonbiri:['きょうは一日、ごろごろしよ〜'], monoshiri:['休日も、起きる時間はいつもどおりがコツですよ'],
           kimagure:['休み？じゃあ、ちょっとかまってよ'], amaen:['きょうは、ずっといっしょにいられる？'], fushigi:['休みの日は、時間がふわふわ流れるね'], ganbari:['休むのも、りっぱな予定だよ'] } },
  'p-long': { mood:'care', base:['きょうは{n}コマもあるね。長い一日だ', 'すきま時間に、ひと休みしよう', 'お昼はしっかり食べてね', '長い日は、おやつを持っていこう'] },
  'p-holiday': { mood:'happy', base:['きょうは{hol}だね', '{hol}、どうすごす？'] },
  /* ===== テスト ===== */
  'x-7': { mood:'cheer', base:['{subj}のテストまで、あと{n}日だね', 'そろそろ{subj}の勉強をはじめよう', 'テスト範囲、たしかめた？', '1日すこしずつ、進めよう'] },
  'x-3': { mood:'cheer', base:['{subj}のテストまで、あと{n}日！', '{subj}のまとめノートをつくろう', 'わからないところは、今のうちに聞こう', 'テスト前こそ、しっかり寝よう'] },
  'x-1': { mood:'cheer', base:['明日は{subj}のテストだね', 'きょうは大事なところを見直そう', '筆記用具と学生証、準備しよう', '明日にそなえて、早めに寝よう'],
    type:{ yasashi:['明日のテスト、きっとだいじょうぶだよ'], genki:['明日はテスト！さいごの追いこみだ！'], nonbiri:['明日テストだね〜。きょうは早寝しよ〜'], monoshiri:['前日は新しいことより、復習を優先しましょう'],
           kimagure:['明日テストでしょ。…さっさと寝なよ'], amaen:['明日テストなの？おうえんのぎゅーする〜'], fushigi:['明日のテストに、おまもりのまほうをかけておくね'], ganbari:['前日は、見直しと早寝が作戦だ'] } },
  'x-today': { mood:'cheer', base:['きょうは{subj}のテストだね。ファイト！', 'ここまでがんばってきたから、だいじょうぶ', '深呼吸してから、はじめよう', 'おわったら、ごほうびだね'],
    type:{ yasashi:['{you}のがんばり、ちゃんと知ってるよ'], genki:['テスト本番！全力でいこう！'], nonbiri:['おちついて〜、ゆっくり問題を読もうね〜'], monoshiri:['まず全体を見て、解ける問題から解きましょう'],
           kimagure:['テストでしょ。…まあ、きみならいけるって'], amaen:['テストがんばったら、いっぱいほめてあげる！'], fushigi:['ペンに、ほしのちからをこめておいたよ'], ganbari:['いつもどおりでいこう。きっとできる'] } },
  'x-done': { mood:'happy', base:['{subj}のテスト、おつかれさま！', 'テスト、よくがんばったね', 'きょうはゆっくり休もう', '結果はあとで。いまはひと休み'],
    type:{ yasashi:['ほんとうに、よくがんばったね'], genki:['テスト終わったー！おつかれさま！'], nonbiri:['テスト終わったね〜。ごろごろしよ〜'], monoshiri:['見直しは、記憶が新しいうちがいちばんですよ'],
           kimagure:['テストおわり？…おつかれ。えらかったじゃん'], amaen:['テストおわったら、あそんでくれる？'], fushigi:['テストのあとの空は、ちょっとまぶしいね'], ganbari:['やりきったね。つぎにつなげよう'] } },
  /* ===== 課題 ===== */
  'k-today': { mood:'warn', base:['きょう、しめきりの課題があるよ', '「{task}」、きょうまでだよ', '出すまであと少し！', '出したら、チェックをつけよう'] },
  'k-tomo': { mood:'warn', base:['明日しめきりの課題があるよ', '「{task}」、明日までだよ', 'きょうのうちに、少し進めておこう'] },
  'k-late': { mood:'warn', base:['しめきりをすぎた課題が{n}こあるよ', 'おくれても、出せるなら出してみよう', '先生に相談してみるのもいいかも', 'いっしょに1つずつ片づけよう'],
    type:{ yasashi:['だいじょうぶ、いっしょに考えようね'], genki:['よーし、いまから取り返そう！'], nonbiri:['あせらなくていいよ〜、1こずつね〜'], monoshiri:['まずは、提出できるかを確認しましょう'],
           kimagure:['…課題、たまってるでしょ。手伝ってあげる'], amaen:['課題おわったら、なでなでしてあげる'], fushigi:['止まった時計も、また動きだせるよ'], ganbari:['順番を決めて、ひとつずつ片づけよう'] } },
  'k-clear': { mood:'happy', base:['やることがぜんぶ終わってる！すごい！', '課題ゼロだね！', 'きょうは、じぶんをたくさんほめよう', 'すっきりしたね'],
    type:{ yasashi:['ぜんぶ終わらせたの？えらいね'], genki:['課題ゼロ！さいこうだ！'], nonbiri:['課題ゼロ〜。これで安心してお昼寝できるね〜'], monoshiri:['すべて提出ずみ。計画どおりですね'],
           kimagure:['ぜんぶ終わってるの？…やるじゃん'], amaen:['ぜんぶ終わったなら、いっぱいあそぼ〜'], fushigi:['やることゼロ。心がふわっと軽いね'], ganbari:['ぜんぶやりきったね。見事だ'] } },
  /* ===== 暗記 ===== */
  'a-pile': { mood:'warn', base:['暗記の復習が{n}まい、たまってるよ', '5分だけ、カードをめくろう', '少しずつ減らしていこう', '復習は、ちょっとずつが近道だよ'] },
  'a-streak': { mood:'happy', base:['暗記、{n}日つづいてるね！', '毎日つづけてて、えらい', 'このまま、つづけていこう', '{n}日れんぞく、すごいよ'] },
  /* ===== おせわ ===== */
  'e-hungry': { mood:'warn', base:['{pet}が、おなかをすかせてるよ', '{pet}にごはんをあげてね', '{pet}のおなかが、ぐーってなってる'] },
  'e-happy': { mood:'happy', base:['{pet}、ごきげんだね', '{pet}がうれしそう', '{pet}となかよしだね'] },
  'e-dirty': { mood:'warn', base:['{pet}、おふろに入りたいみたい', '{pet}をぴかぴかにしてあげよう'] },
  'e-sleepy': { mood:'care', base:['{pet}がねむたそう', '{pet}は、そっとしておいてあげよう'] },
  /* ===== お金 ===== */
  'm-payday': { mood:'happy', base:['きょうは給料日だね！', 'おつかれさまのごほうび、ちょっとだけね', '入ったお金、家計簿につけておこう', 'まずは引き落としの分をたしかめよう'] },
  'm-over': { mood:'warn', base:['今月のお金、ちょっとピンチかも', 'ほしいものは、ひと晩考えてからにしよう', 'おさいふの中、たしかめよう', '節約できるところ、いっしょにさがそう'] },
  /* ===== 季節 ===== */
  's-spring': { mood:'happy', base:['春だね、ぽかぽか', 'お花がさいてるね', '新しいことをはじめたくなるね', '花粉には気をつけてね'] },
  's-summer': { mood:'happy', base:['夏だね！水分とってね', 'アイスが食べたくなるね', '日焼けどめ、ぬった？', '夏の空、きれいだね'] },
  's-autumn': { mood:'happy', base:['秋だね。すずしくなってきた', '食欲の秋だね', '読書の秋、なにか読む？', '紅葉、見にいきたいな'] },
  's-winter': { mood:'care', base:['冬だね。あったかくしてね', 'こたつに入りたいな', '手洗い・うがいをわすれずに', '冬の星、きれいだね'] },
  /* ===== 行事（季節のイベント） ===== */
  'f-newyear': { mood:'happy', base:['あけましておめでとう！', 'ことしもよろしくね', 'ことしのもくひょう、なににする？', 'おもち、食べすぎないようにね', 'はつもうで、行った？'] },
  'f-setsubun': { mood:'happy', base:['鬼は外、福は内！', '豆まき、する？', '年の数だけ豆を食べるんだって', '恵方巻き、どっちを向いて食べる？'] },
  'f-valentine': { mood:'happy', base:['もうすぐバレンタインだね', 'チョコ、だれにあげる？', '自分用のチョコも、ありだよね', 'あまいもので、ほっとひと息'] },
  'f-whiteday': { mood:'happy', base:['きょうはホワイトデーだね', 'おかえしのお菓子、なにがいいかな', 'あまいものは、ちょっとずつね'] },
  'f-hinamatsuri': { mood:'happy', base:['きょうはひなまつりだね', 'ひなあられ、食べた？', 'ちらしずし、おいしそう'] },
  'f-sakura': { mood:'happy', base:['桜がさいてるね', 'お花見びより！', 'さくらの花びら、ひらひら', '桜の下で、おべんとう食べたいな'] },
  'f-shingakki': { mood:'cheer', base:['新学期だね。どきどきするね', '新しい時間割、なれてきた？', '新しいノート、わくわくするね', 'はじめは、つかれやすいから気をつけてね'] },
  'f-kodomo': { mood:'happy', base:['きょうはこどもの日だね', 'こいのぼり、見た？', 'かしわもち、食べたいな'] },
  'f-tsuyu': { mood:'care', base:['梅雨の季節だね', 'じめじめするけど、がんばろう', 'あじさいが、きれいだね', '洗たくものが、かわきにくいね'] },
  'f-tanabata': { mood:'happy', base:['もうすぐ七夕だね', 'ねがいごと、なににする？', '天の川、見えるかな', 'たんざくに、なんて書く？'] },
  'f-natsu': { mood:'happy', base:['夏まっさかりだね', 'すいか、食べたいな', '花火、見にいきたいな', 'ひまわりがきれいだね'] },
  'f-natsuyasumi': { mood:'happy', base:['夏休みだね！', '夏休みのうちに、やりたいことある？', '生活リズム、くずさないようにね', '夏休みの課題、少しずつね'] },
  'f-tsukimi': { mood:'happy', base:['お月見の季節だね', 'きょうの月、きれいかな', 'お月見だんご、食べたいな', 'すすきを見ると、秋を感じるね'] },
  'f-halloween': { mood:'happy', base:['もうすぐハロウィンだね', 'トリックオアトリート！', 'かぼちゃのお菓子、食べたいな', '仮装するなら、なにになる？'] },
  'f-kouyou': { mood:'happy', base:['紅葉がきれいな季節だね', 'もみじ、まっかだね', '落ち葉をふむと、さくさくするね'] },
  'f-xmas': { mood:'happy', base:['もうすぐクリスマスだね', 'メリークリスマス！', 'サンタさん、くるかな', 'ケーキ、食べたいな'] },
  'f-omisoka': { mood:'happy', base:['きょうは大みそかだね', 'ことしも、よくがんばったね', '年越しそば、食べる？', 'ことしも、いっしょにいてくれてありがとう'] },
  'f-holiday': { mood:'happy', base:['きょうは祝日だね', '祝日は、ゆっくりしようね'] },
  /* ===== 記念日 ===== */
  'n-anniv': { mood:'happy', base:['きょうは{anniv}だね', '{anniv}、おめでとう！', 'きょうは、たいせつな日だね'] },
  'n-petbirth': { mood:'happy', base:['{pet}が生まれて{n}日だね', '{pet}、大きくなったね'] },
  /* ===== 組み合わせ（2つの場面が重なった日） ===== */
  'c-rain-first': { mood:'care', base:['雨の日の1限、たいへんだけどがんばろう', '雨だから、いつもより早めに出よう'] },
  'c-hot-work': { mood:'care', base:['暑い中のバイト、水分をわすれずにね', 'バイトの前に、塩分と水分をとろう'] },
  'c-cold-morning': { band:'morning', mood:'care', base:['さむい朝だね。ふとんから出られた？', 'つめたい朝は、あったかいものを飲もう'] },
  'c-exam-night': { band:'night', mood:'warn', base:['明日はテストだから、早めに寝よう', '見直しはあと少しにして、ねむろう'] },
  'c-exam-late': { band:'late', mood:'warn', base:['テスト前の夜ふかしは、よくないよ。もう寝よう', 'ねむったほうが、覚えたことが残るよ'] },
  'c-weekend-rain': { mood:'happy', base:['雨の休日は、おうちでのんびりしよう', '雨の日は、映画でも見る？'] },
  'c-work-exam': { mood:'care', base:['バイトとテスト勉強、両方えらいね。むりしないでね', 'バイトの前に、少しだけ見直そう'] },
  'c-clear-fri': { mood:'happy', base:['課題ゼロで週末をむかえられるね！'] },
  'c-task-night': { band:'night', mood:'warn', base:['しめきり、きょうまでだよ。出した？'] }
};
/* なかよし度で増えるセリフ（Lv1 名前で呼ぶ・Lv5 だいすき）。Lv2 ひみつ・Lv4 夢 は性格ごと（c2Types）、Lv3 思い出 は手帳の中身から */
var c2BondTalk = {
  1:['{you}、きょうも会えてうれしいな', '{you}のこと、いつもおうえんしてるよ', 'ねえ{you}、ちょっと休もう', '{you}、よくがんばってるね', '{you}って呼べるの、うれしいな'],
  2:['{like}のこと、じつは夢に見るくらい好きなんだ', 'ひみつだよ。{name}って名前、けっこう気に入ってるの'],
  5:['{you}のこと、だいすきだよ', 'ずっといっしょにいようね', '{you}がいてくれて、ほんとうによかった', '{you}は、{me}のたからものだよ']
};

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
  if(line.indexOf(k.tic) >= 0) return line;              /* もう口ぐせが入っているときは、足さない */
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
  var fes = (typeof c2FesMain === 'function') ? c2FesMain(td) : (typeof festivalOn === 'function') ? festivalOn(td) : '';
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

/* ============================== 性格・なかよし度（キャラ＋） ============================== */
function c2Ov(id){
  var v = (S.kmData || {})['chara2:persona:' + id];
  return (v && typeof v === 'object' && !v.reset) ? v : null;
}
function c2Clamp(v, a, b, d){ v = Number(v); return isFinite(v) ? Math.max(a, Math.min(b, v)) : d; }
/* その子の性格・口調（直したところは S.kmData の 'chara2:persona:<id>'） */
function c2Persona(id){
  id = id || charaNow().id;
  var k = charaById(id);
  var base = c2Personas[id] || { t:'yasashi', me:'わたし' };
  var ov = c2Ov(id) || {};
  var t = c2Types[ov.t] ? ov.t : (c2Types[base.t] ? base.t : 'yasashi');
  var T = c2Types[t];
  var h = parseInt(String(hash53(String(id))).slice(0, 4), 36) || 0;
  var call = String(((S.ui || {}).chara || {}).callName || '').trim();
  return {
    id:k.id, name:k.name, desc:k.desc || '', t:t, type:T.name, typeDesc:T.desc,
    me:String(ov.me || base.me || 'わたし').slice(0, 8), you:call || T.you, callName:call,
    tic:k.tic || '', like:k.like || '', style:String(ov.style || T.style).slice(0, 80),
    pitch:c2Clamp(ov.pitch, 0.5, 2, Math.round((T.pitch + ((h % 5) - 2) * 0.04) * 100) / 100),
    rate:c2Clamp(ov.rate, 0.5, 1.6, T.rate),
    edited:!!(ov && ov.mt)
  };
}
/* なかよし度（おせわ・そうだん・話しかけ・なでた回数・手帳の記録から。保存はしない） */
function c2BondData(){
  var v = (S.kmData || {})['chara2:bond'];
  return (v && typeof v === 'object' && v.c && typeof v.c === 'object') ? v.c : {};
}
function c2Bond(id){
  id = id || charaNow().id;
  var b = c2BondData()[id] || {};
  var base = (typeof charaFriend === 'function') ? toNum(charaFriend().pts) : 0;
  var pet = (S.pets && S.pets[id] && typeof S.pets[id] === 'object') ? Math.floor(toNum(S.pets[id].exp) / 2) : 0;
  var chat = Math.min(150, (Array.isArray(S.chat) ? S.chat : []).filter(function(m){ return m && m.role === 'user'; }).length);
  var own = toNum(b.pats) + toNum(b.talks) * 2 + toNum(b.voice) * 3;
  var pts = Math.max(0, Math.round(base + pet + chat + own));
  var lv = 0;
  c2BondSteps.forEach(function(s, i){ if(pts >= s) lv = i; });
  var cur = c2BondSteps[lv], nx = c2BondSteps[lv + 1];
  return { id:id, pts:pts, lv:lv, next:(nx == null) ? 0 : nx - pts,
    pct:(nx == null) ? 100 : Math.max(0, Math.min(100, Math.round((pts - cur) / (nx - cur) * 100))),
    parts:{ note:base, pet:pet, chat:chat, pats:toNum(b.pats), talks:toNum(b.talks), voice:toNum(b.voice) }, first:b.first || '' };
}
/* 話しかけた・なでた・声で話した（操作したときだけ呼ぶ） */
function c2BondAdd(id, field){
  id = id || charaNow().id;
  S.kmData = (S.kmData && typeof S.kmData === 'object') ? S.kmData : {};
  var all = S.kmData['chara2:bond'];
  var c = Object.assign({}, (all && all.c) || {});
  var o = Object.assign({}, c[id] || {});
  o[field] = toNum(o[field]) + 1;
  if(!o.first) o.first = today();
  c[id] = o;
  S.kmData['chara2:bond'] = { c:c, mt:Date.now() };
  touch('kmData');
  ctCache = {};
}

/* ============================== その日の場面（キャラ＋） ============================== */
function c2Mon(ymd){
  ymd = isYmd(ymd) ? ymd : today();
  var a = ymd.split('-'), d = new Date(+a[0], +a[1] - 1, +a[2]);
  return shiftDate(ymd, -((d.getDay() + 6) % 7));
}
function c2Band(h){ return h < 5 ? 'late' : h < 11 ? 'morning' : h < 17 ? 'noon' : h < 22 ? 'evening' : 'night'; }
/* その日にあてはまる場面（見るだけ。保存はしない） */
function c2Ctx(ymd){
  ymd = isYmd(ymd) ? ymd : today();
  var isToday = (ymd === today());
  var on = [], v = {};
  var add = function(id, vars){ if(on.indexOf(id) < 0) on.push(id); if(vars) v[id] = vars; };
  var has = function(id){ return on.indexOf(id) >= 0; };
  var a = ymd.split('-'), m = +a[1], dow = new Date(+a[0], m - 1, +a[2]).getDay();
  /* 曜日・季節 */
  var dk = ['d-sun', 'd-mon', '', 'd-wed', '', 'd-fri', 'd-sat'][dow];
  if(dk) add(dk);
  add(m >= 3 && m <= 5 ? 's-spring' : m >= 6 && m <= 8 ? 's-summer' : m >= 9 && m <= 11 ? 's-autumn' : 's-winter');
  /* 行事・祝日 */
  var fes = (typeof c2FesOn === 'function') ? c2FesOn(ymd) : [(typeof festivalOn === 'function') ? festivalOn(ymd) : ''];
  fes.forEach(function(f){ if(f && c2Scenes['f-' + f]) add('f-' + f, { fes:(typeof c2FesName === 'function') ? c2FesName(f) : f }); });
  var hol = (typeof holidayName === 'function') ? holidayName(ymd) : '';
  if(hol) add('p-holiday', { hol:hol });
  /* 授業・バイト */
  var cls = [];
  try{ cls = (typeof classesForDate === 'function') ? classesForDate(ymd).filter(function(c){ return !c.off; }) : []; }catch(e){}
  var work = (S.shifts || []).some(function(w){ return w && w.date === ymd; });
  var off = dow === 0 || dow === 6 || !!hol;
  if(cls.length){
    var first = cls.filter(function(c){ return +c.period === 1; })[0];
    if(first) add('p-first', { cls:shortName(first.name) });
    if(cls.length >= 4 || (cls.length >= 3 && work)) add('p-long', { n:cls.length });
  }else if(!off) add('p-noclass');
  if(work) add('p-work');
  if(off && !work && !cls.length) add('p-off');
  /* テスト */
  var ex = (S.exams || []).filter(function(x){ return x && isYmd(x.date); }).sort(function(x, y){ return x.date.localeCompare(y.date); });
  var next = ex.filter(function(x){ return x.date >= ymd; })[0];
  var subjOf = function(x){ return x.subject ? shortName(x.subject) : String(x.title || 'テスト').slice(0, 12); };
  var nx = next ? daysBetween(ymd, next.date) : 99;
  if(next){
    if(nx === 0) add('x-today', { subj:subjOf(next) });
    else if(nx === 1) add('x-1', { subj:subjOf(next), n:1 });
    else if(nx <= 3) add('x-3', { subj:subjOf(next), n:nx });
    else if(nx <= 7) add('x-7', { subj:subjOf(next), n:nx });
  }
  var past = ex.filter(function(x){ return x.date < ymd && daysBetween(x.date, ymd) <= 2; }).pop();
  if(past && nx > 1) add('x-done', { subj:subjOf(past) });
  /* 課題 */
  var tasks = Array.isArray(S.tasks) ? S.tasks : [];
  var open = tasks.filter(function(t){ return t && !t.done; });
  var tl = function(t){ return String(t.title || '課題').slice(0, 14); };
  var dueT = open.filter(function(t){ return t.due === ymd; });
  if(dueT.length) add('k-today', { task:tl(dueT[0]), n:dueT.length });
  var dueM = open.filter(function(t){ return t.due === shiftDate(ymd, 1); });
  if(dueM.length) add('k-tomo', { task:tl(dueM[0]), n:dueM.length });
  var late = open.filter(function(t){ return isYmd(t.due) && t.due < ymd; });
  if(late.length) add('k-late', { n:late.length });
  if(tasks.length && !open.length) add('k-clear');
  /* 暗記 */
  if(Array.isArray(S.cards) && S.cards.length && typeof ankiIsDue === 'function'){
    var due = S.cards.filter(function(c){ return c && ankiIsDue(c, ymd); }).length;
    if(due >= 20) add('a-pile', { n:due });
    if(isToday && typeof ankiStreak === 'function'){ var st = ankiStreak(); if(st >= 3) add('a-streak', { n:st }); }
  }
  /* おせわ（今日だけ） */
  if(isToday && typeof petNow === 'function' && typeof petActiveId === 'function'){
    try{
      var pid = petActiveId(), po = petNow(pid);
      if(po && po.stage > 0){
        var pv = { pet:String(po.name || charaById(pid).name) };
        if(po.sleep || po.eng < 20) add('e-sleepy', pv);
        else if(po.hun < 30) add('e-hungry', pv);
        else if(po.cln < 30) add('e-dirty', pv);
        else if(po.joy >= 80) add('e-happy', pv);
        if(po.born){
          var bd = toYmd(new Date(Number(po.born))), pn = daysBetween(bd, ymd);
          if(pn > 0 && (pn % 100 === 0 || bd.slice(5) === ymd.slice(5))) add('n-petbirth', { pet:pv.pet, n:pn });
        }
      }
    }catch(e){}
  }
  /* お金 */
  if(ymd.slice(8, 10) === '25' && (S.shifts || []).length) add('m-payday');
  if(isToday && typeof budget === 'function'){ try{ var bg = budget(); if(bg.level === 'bad' || bg.level === 'warn') add('m-over'); }catch(e){} }
  /* 天気（今日だけ） */
  if(isToday && typeof weather !== 'undefined' && weather && weather.state === 'ok'){
    try{
      var d1 = weather.sanda.daily, d2 = ((weather.school || {}).daily) || d1;
      var n0 = function(o, key, def){ var x = Number(((o || {})[key] || [])[0]); return isFinite(x) ? x : def; };
      var code = n0(d1, 'weather_code', 0);
      var pop = Math.max(n0(d1, 'precipitation_probability_max', 0), n0(d2, 'precipitation_probability_max', 0));
      var tmax = Math.round(Math.max(n0(d1, 'temperature_2m_max', -99), n0(d2, 'temperature_2m_max', -99)));
      var tmin = Math.round(Math.min(n0(d1, 'temperature_2m_min', 99), n0(d2, 'temperature_2m_min', 99)));
      var snow = (code >= 71 && code <= 77) || code === 85 || code === 86 || n0(d1, 'snowfall_sum', 0) > 0;
      if(snow) add('w-snow');
      else if(pop >= 50 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) add('w-rain', { pop:pop });
      else if(code <= 2 && pop < 30) add('w-sunny');
      if(tmax > -99 && tmax >= 30) add('w-hot', { tmax:tmax });
      if(tmin < 99 && (tmin <= 5 || (tmax > -99 && tmax <= 10))) add('w-cold', { tmin:tmin });
    }catch(e){}
  }
  /* 誕生日・記念日 */
  (Array.isArray(S.annivs) ? S.annivs : []).forEach(function(x){
    if(!x || typeof x !== 'object') return;
    var md = '';
    var dt = String(x.date || x.md || '');
    if(/^\d{4}-\d{2}-\d{2}/.test(dt)) md = dt.slice(5, 10);
    else if(/^\d{1,2}-\d{1,2}$/.test(dt)){ var q = dt.split('-'); md = pad(+q[0]) + '-' + pad(+q[1]); }
    else if(x.month && x.day) md = pad(+x.month) + '-' + pad(+x.day);
    if(md && md === ymd.slice(5)) add('n-anniv', { anniv:String(x.title || x.name || '記念日').slice(0, 16) });
  });
  /* 組み合わせ */
  if(has('w-rain') && has('p-first')) add('c-rain-first');
  if(has('w-hot') && has('p-work')) add('c-hot-work');
  if(has('w-cold')) add('c-cold-morning');
  if(has('x-1')){ add('c-exam-night'); add('c-exam-late'); }
  if(has('w-rain') && (has('p-off') || has('d-sat') || has('d-sun'))) add('c-weekend-rain');
  if(has('p-work') && (has('x-1') || has('x-3') || has('x-today'))) add('c-work-exam');
  if(has('k-clear') && has('d-fri')) add('c-clear-fri');
  if(has('k-today')) add('c-task-night');
  return { ymd:ymd, isToday:isToday, on:on, v:v, sig:on.join(',') };
}
/* {名前} を中身に（中身がないものがあれば、その文は使わない） */
function c2Fill(s, vars){
  var ok = true;
  var out = String(s || '').replace(/\{(\w+)\}/g, function(m0, key){
    var x = vars ? vars[key] : undefined;
    if(x === undefined || x === null || x === '') { ok = false; return ''; }
    return String(x);
  });
  return ok ? out : '';
}
/* ものしりの子は、ていねいに */
function c2Polite(s){
  return String(s).replace(/だね([。！？!?…]|$)/g, 'ですね$1').replace(/だよ([。！？!?…]|$)/g, 'ですよ$1')
    .replace(/しよう([。！？!?…]|$)/g, 'しましょう$1').replace(/てね([。！？!?…]|$)/g, 'てくださいね$1');
}
var c2OpenRe = /^(ねえ|あのね|ふふ|そうだ|よーし|おっ|ふわぁ|えっとね|んー|のんびり|ちなみに|そうそう|ひとつ言うと|ええと|…|べつに|ふーん|まあ|えへへ|きいて|ふわり|ふしぎ|きらきら|よし|作戦)/;
/* 場面の文 × 話しかけ方 × 一言 × 口ぐせ */
function c2Deco(k, T, s, mood, r, lv, you){
  var opens = [''].concat(T.open || []);
  if(lv >= 1 && you) opens.push(you + '、');
  var tails = [''].concat(((T.tail || {})[mood]) || []);
  var o = opens[Math.floor(r() * opens.length)], t = tails[Math.floor(r() * tails.length)];
  if(o && (c2OpenRe.test(s) || (you && s.indexOf(you) === 0))) o = '';
  var line = o + s;
  if(t && line.length + t.length <= 44) line = line + (/[！!？?。…♪〜]$/.test(line) ? '' : '。') + t;
  return ctTic(k, line);
}
/* 1つの文から、ちがう形を n こ */
function c2Variants(k, T, s, mood, r, lv, you, n){
  var out = [];
  for(var i = 0; i < n * 3 && out.length < n; i++){
    var x = c2Deco(k, T, s, mood, r, lv, you);
    if(out.indexOf(x) < 0) out.push(x);
  }
  return out;
}
/* 思い出の話（手帳の記録から） */
function c2Memories(id, ymd){
  ymd = ymd || today();
  var out = [], b = c2Bond(id);
  if(b.first && isYmd(b.first)){
    var n = daysBetween(b.first, ymd);
    if(n > 0) out.push('{me}たちが出会ってから' + n + '日。いろいろあったね');
    out.push('はじめて話しかけてくれたのは、' + ymdLabel(b.first) + 'だったね');
  }
  (S.exams || []).filter(function(x){ return x && isYmd(x.date) && x.date < ymd && daysBetween(x.date, ymd) <= 200; })
    .slice(-3).forEach(function(x){
      var nm = x.subject ? shortName(x.subject) : String(x.title || 'テスト').slice(0, 10);
      out.push((+x.date.slice(5, 7)) + '月の' + nm + 'のテスト、がんばってたね');
    });
  var done = (S.tasks || []).filter(function(t){ return t && t.done; }).length;
  if(done >= 3) out.push('これまでに課題を' + done + 'こも終わらせたんだよ');
  var log = S.studyLog || {}, seen = 0;
  Object.keys(log).forEach(function(k2){ seen += toNum(log[k2] && log[k2].n); });
  if(seen >= 10) out.push('暗記カード、ぜんぶで' + seen + 'まいも見てきたね');
  var nt = (S.notes || []).length;
  if(nt >= 10) out.push('メモが' + nt + 'こもたまったね。{you}の努力のあとだね');
  var rv = Object.keys(S.dayReview || {}).length;
  if(rv >= 3) out.push('ふりかえりを' + rv + '回もしてきたね');
  var pet = (S.pets || {})[id];
  if(pet && pet.born) out.push('{me}が生まれた日のこと、おぼえてる？');
  return out;
}
/* なかよし度で増えるセリフ（文だけ） */
function c2BondLines(id, lv, ymd){
  var p = c2Persona(id), T = c2Types[p.t];
  var vars = { me:p.me, you:p.callName || T.you, name:p.name, like:p.like || 'おいしいもの' };
  var out = [];
  var push = function(arr){ (arr || []).forEach(function(s){ var f = c2Fill(s, vars); if(f) out.push(T.polite ? c2Polite(f) : f); }); };
  if(lv >= 1 && p.callName) push(c2BondTalk[1]);
  if(lv >= 2) push(T.secret.concat(c2BondTalk[2]));
  if(lv >= 3) push(c2Memories(id, ymd));
  if(lv >= 4) push(T.dream);
  if(lv >= 5) push(c2BondTalk[5]);
  return out;
}
/* その子・その日の、場面のセリフ（時間帯ごと・場面ごと） */
function c2SceneLines(k, ymd, ctx, seed){
  var p = c2Persona(k.id), T = c2Types[p.t] || c2Types.yasashi;
  var r = ctRand(seed + 7);
  var lv = c2Bond(k.id).lv;
  var you = (lv >= 1 && p.callName) ? p.callName : T.you;
  var common = { me:p.me, you:you, name:k.name, like:k.like || 'おいしいもの' };
  var out = { scene:[], morning:[], noon:[], evening:[], night:[], late:[], bond:[] };
  var ids = ['t-morning', 't-noon', 't-evening', 't-night', 't-late'].concat(ctx.on);
  ids.forEach(function(sid){
    var sc = c2Scenes[sid];
    if(!sc) return;
    var lines = sc.base.concat((sc.type && sc.type[p.t]) || []);
    var vars = Object.assign({}, common, ctx.v[sid] || {});
    var dest = sc.band ? out[sc.band] : out.scene;
    lines.forEach(function(s){
      var f = c2Fill(s, vars);
      if(!f) return;
      if(T.polite) f = c2Polite(f);
      c2Variants(k, T, f, sc.mood, r, lv, (lv >= 1 ? p.callName : ''), 2).forEach(function(x){ dest.push(x); });
    });
  });
  c2BondLines(k.id, lv, ymd).forEach(function(s){
    var x = c2Deco(k, T, s, 'happy', r, 0, '');
    out.bond.push(x); out.scene.push(x);
  });
  return out;
}
/* 組み合わせで何とおり作れるか（場面の文 × 話しかけ方 × 一言） */
function c2ComboCount(id){
  var p = c2Persona(id), T = c2Types[p.t] || c2Types.yasashi, n = 0;
  Object.keys(c2Scenes).forEach(function(sid){
    var sc = c2Scenes[sid];
    var L = sc.base.length + (((sc.type || {})[p.t]) || []).length;
    n += L * (1 + (T.open || []).length) * (1 + (((T.tail || {})[sc.mood]) || []).length);
  });
  return n;
}

/* ============================== その日・その子のセリフぜんぶ ============================== */
var ctCache = {};
function charaDayPool(id, ymd){
  ymd = ymd || today();
  var k = charaById(id);
  var ctx = c2Ctx(ymd), bond = c2Bond(id);
  var ck = id + '|' + ymd + '|' + (k.tic || '') + '|' + (k.like || '') + '|' + (S.tasks || []).length + '|' + (S.exams || []).length + '|' +
    ctx.sig + '|' + bond.lv + '|' + (((S.ui || {}).chara || {}).callName || '') + '|' + ((S.meta || {}).charaTalk || 0) + '|' + ((S.meta || {}).kmData || 0);
  if(ctCache[ck]) return ctCache[ck];
  var seed = ctSeed(ck.split('|').slice(0, 7).join('|'));
  var r = ctRand(seed);
  var pool = { morning:[], noon:[], evening:[], night:[], any:[], late:[], scene:[] };
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
  /* AIが今週足したセリフ（キャラ＋） */
  var week = c2WeekLines(id, ymd);
  pool.any = any.concat(extra, week.filter(function(s){ return s.length <= 60; }));
  /* AIが考えたセリフ */
  var ai = (S.charaTalk || {})[ymd + ':' + id];
  if(ai){
    ['morning', 'noon', 'evening', 'night', 'any'].forEach(function(b){
      (ai[b] || []).forEach(function(s){ if(typeof s === 'string' && s.length <= 60) pool[b].push(s); });
    });
  }
  var seen = {};
  ['morning', 'noon', 'evening', 'night', 'any'].forEach(function(b){
    pool[b] = ctShuffle(pool[b], seed + b.length).filter(function(s){
      s = String(s).trim();
      if(!s || seen[s]) return false;
      seen[s] = 1; return true;
    }).map(function(s){
      var e = CT_END[Math.floor(r() * CT_END.length)];
      return ctTic(k, /[！!？?。♪〜…]$/.test(s) ? s : s + e);
    });
  });
  /* 場面 × 性格 × 口ぐせ（キャラ＋） */
  var sl = c2SceneLines(k, ymd, ctx, seed);
  ['morning', 'noon', 'evening', 'night', 'late', 'scene'].forEach(function(b){
    sl[b].forEach(function(s){
      s = String(s).trim();
      if(!s || seen[s]) return;
      seen[s] = 1; pool[b].push(s);
    });
  });
  pool.bond = sl.bond.length;
  pool.ctx = ctx.on.slice();
  pool.total = Object.keys(seen).length;
  pool.ai = ai ? 1 : 0;
  pool.week = week.length;
  ctCache = {}; ctCache[ck] = pool;
  return pool;
}
/* 同じセリフが続かないように、さいきん出したものは覚えておく（この端末の中だけ・保存しない） */
var c2Recent = [];
function c2PickFresh(list){
  if(!list || !list.length) return '';
  var pick = '';
  for(var i = 0; i < 12; i++){
    pick = list[Math.floor(Math.random() * list.length)];
    if(c2Recent.indexOf(pick) < 0) break;
  }
  c2Recent.push(pick);
  if(c2Recent.length > 40) c2Recent = c2Recent.slice(-40);
  return pick || '';
}
/* いまの時間に合うセリフを1つ */
function charaPoolLine(id, kind){
  var p = charaDayPool(id);
  var h = new Date().getHours();
  var b = ctBucket(h);
  var timeList = (h < 5 && p.late && p.late.length) ? p.late.concat(p.night) : p[b];
  var x = Math.random(), list;
  if(kind === 'greet') list = (p.scene.length && x < .35) ? p.scene : timeList;
  else list = (p.scene.length && x < .45) ? p.scene : (x < .65 ? timeList : p.any);
  if(!list || !list.length) list = p.any;
  return c2PickFresh(list);
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
    c2TalkPrune();
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

/* ============================== AIが毎週セリフを足す（キャラ＋） ==============================
   S.charaTalk のキー：'YYYY-MM-DD:<id>' その日のAIのセリフ／'w:<月曜>:<id>' その週のAIのセリフ（{ lines, wk, id, mt, by }）
                      'w:<月曜>:lock' 作っている端末の印（2台で二重に作らない）／'c:<日付>' AIが作ったキャラどうしの会話 */
function c2WeekKey(id, ymd){ return 'w:' + c2Mon(ymd || today()) + ':' + id; }
function c2WeekLines(id, ymd){
  var e = (S.charaTalk || {})[c2WeekKey(id, ymd)];
  return (e && Array.isArray(e.lines)) ? e.lines.filter(function(s){ return typeof s === 'string' && s; }) : [];
}
function c2WeekAiOn(){ return ((S.ui.chara || {}).weekAi !== 0); }
/* 古いものを片づける（どの端末でも同じきまりで消す） */
function c2TalkPrune(){
  var ct = S.charaTalk || {}, td = today(), old = shiftDate(c2Mon(td), -14), oldC = shiftDate(td, -14);
  Object.keys(ct).forEach(function(x){
    var m;
    if((m = x.match(/^(\d{4}-\d{2}-\d{2}):/))){ if(m[1] !== td) delete ct[x]; return; }
    if((m = x.match(/^w:(\d{4}-\d{2}-\d{2}):/))){ if(m[1] < old) delete ct[x]; return; }
    if((m = x.match(/^c:(\d{4}-\d{2}-\d{2})/))){ if(m[1] < oldC) delete ct[x]; return; }
  });
}
/* 変なセリフ・長すぎるものは、はじく */
var c2Ng = /https?:|www\.|[<>{}\[\]`\\|＜＞]|@|死|殺|バカ|ばか|馬鹿|アホ|あほ|くそ|クソ|うざ|ウザ|キモ|きもい|ブス|デブ|消えろ|診断|処方|\d+\s*(mg|ｍｇ|ミリグラム|錠|ml|mL|ｍｌ)/;
function c2CleanLine(s){
  if(typeof s !== 'string') return '';
  s = s.replace(/[\r\n\t]+/g, ' ').replace(/^[\s・\-*「『"']+|[\s」』"']+$/g, '').trim();
  if(s.length < 3 || s.length > 40) return '';
  if(c2Ng.test(s)) return '';
  if((s.match(/[A-Za-z]/g) || []).length > s.length / 3) return '';
  return s;
}
function c2CleanList(arr, max){
  var seen = {}, out = [];
  (Array.isArray(arr) ? arr : []).forEach(function(s){
    var c = c2CleanLine(s);
    if(c && !seen[c]){ seen[c] = 1; out.push(c); }
  });
  return out.slice(0, max || 40);
}
/* その週の予定（AIにわたす） */
function c2WeekFacts(mon){
  var L = [];
  for(var i = 0; i < 7; i++){
    var d = shiftDate(mon, i), a = [];
    (S.exams || []).forEach(function(x){ if(x && x.date === d) a.push('テスト：' + (x.subject ? shortName(x.subject) : '') + (x.title ? ' ' + String(x.title).slice(0, 16) : '')); });
    (S.tasks || []).forEach(function(t){ if(t && !t.done && t.due === d) a.push('課題のしめきり：' + String(t.title || '').slice(0, 20)); });
    if((S.shifts || []).some(function(w){ return w && w.date === d; })) a.push('バイト');
    (S.events || []).forEach(function(e){ if(e && e.date === d && e.kind === 'imp') a.push('大事な予定：' + String(e.title || '').slice(0, 20)); });
    var hol = (typeof holidayName === 'function') ? holidayName(d) : '';
    if(hol) a.push(hol);
    (typeof c2FesOn === 'function' ? c2FesOn(d) : []).forEach(function(f){ if(f !== 'holiday') a.push('行事：' + c2FesName(f)); });
    var cls = 0;
    try{ cls = classesForDate(d).filter(function(c){ return !c.off; }).length; }catch(e){}
    if(cls) a.push('授業' + cls + 'コマ');
    L.push(ymdLabel(d) + '：' + (a.length ? a.join('、') : 'とくになし'));
  }
  var nx = (S.exams || []).filter(function(x){ return x && isYmd(x.date) && x.date >= shiftDate(mon, 7) && x.date <= shiftDate(mon, 13); });
  if(nx.length) L.push('来週のテスト：' + nx.map(function(x){ return ymdLabel(x.date) + ' ' + (x.subject ? shortName(x.subject) : String(x.title || '')); }).join('、'));
  return L.join('\n').slice(0, 2000);
}
function c2WeekTargets(){
  var ids = [charaNow().id];
  if(charaLevel() >= 5) ids = ids.concat(charaPals(2));
  return ids.filter(function(x, i){ return ids.indexOf(x) === i; }).slice(0, 3);
}
var c2WeekBusy = false;
/* 週のはじめに1回だけ（2台で二重に作らない）。opt.wait … 印をつけてから待つ時間（ミリ秒） */
async function c2WeekAi(opt){
  opt = opt || {};
  if(c2WeekBusy) return { skip:'busy' };
  if(typeof charaLevel === 'function' && charaLevel() < 1) return { skip:'off' };
  if(!c2WeekAiOn() && !opt.force) return { skip:'off' };
  if(!aiReady()) return { skip:'noai' };
  S.charaTalk = (S.charaTalk && typeof S.charaTalk === 'object') ? S.charaTalk : {};
  var mon = c2Mon(today());
  var need = function(){ return (opt.ids || c2WeekTargets()).filter(function(id){ return !S.charaTalk['w:' + mon + ':' + id]; }); };
  var ids = need();
  if(!ids.length) return { skip:'done' };
  var lk = 'w:' + mon + ':lock', lock = S.charaTalk[lk];
  if(lock && lock.by !== DEV.id && Date.now() - toNum(lock.mt) < 10 * 60000) return { skip:'lock' };
  c2WeekBusy = true;
  try{
    S.charaTalk[lk] = { by:DEV.id, wk:mon, mt:Date.now() };
    touch('charaTalk'); persist(); pushRemote();
    var wait = (opt.wait == null) ? 8000 : toNum(opt.wait);
    if(wait > 0) await new Promise(function(res){ setTimeout(res, wait); });
    lock = S.charaTalk[lk];
    if(lock && lock.by !== DEV.id) return { skip:'lock' };
    ids = need();
    if(!ids.length) return { skip:'done' };
    var prompt = 'あなたは、手帳アプリのオリジナルキャラクターのセリフを書く係です。使う人は看護学部1年生です。\n' +
      '今週（' + ymdLabel(mon) + 'からの7日間）の予定：\n' + c2WeekFacts(mon) + '\n\n' +
      'キャラクター：\n' + ids.map(function(id){
        var p = c2Persona(id);
        return '・' + id + '：「' + p.name + '」（' + p.desc + '）。性格：' + p.type + '（' + p.typeDesc + '）。一人称「' + p.me + '」。話し方：' + p.style + '。' +
          (p.tic ? '口ぐせ「' + p.tic + '」（ときどき文末に。入れすぎない）。' : '') + (p.like ? '好きなもの：' + p.like + '。' : '');
      }).join('\n') + '\n\n' +
      'ルール：キャラごとに、今週の予定（テスト・課題・バイト・行事）や季節に合わせたセリフを30こずつ。1つ30文字以内。やさしく、はげます内容。' +
      '同じセリフをくり返さない。病気の診断・薬の量・お金の断定的な助言は書かない。実在の作品・人物の名前は出さない。個人名は書かない。\n' +
      '次のJSONだけを返す：{"lines":{' + ids.map(function(id){ return '"' + id + '":["セリフ", …]'; }).join(',') + '}}';
    var j = parseJsonLoose(await aiGenerate({ tag:'c2-week', json:true, temperature:0.9, maxTokens:6000,
      contents:[{ role:'user', parts:[{ text:prompt }] }] }));
    var got = (j && j.lines && typeof j.lines === 'object') ? j.lines : (j || {});
    var total = 0, now = Date.now();
    ids.forEach(function(id){
      var arr = Array.isArray(got) ? (ids.length === 1 ? got : []) : got[id];
      var lines = c2CleanList(arr, 40);
      if(!lines.length) return;
      S.charaTalk['w:' + mon + ':' + id] = { wk:mon, id:id, lines:lines, n0:lines.length, mt:now, by:DEV.id };
      total += lines.length;
    });
    if(!total) throw new Error('使えるセリフがありませんでした');
    c2TalkPrune();
    touch('charaTalk'); ctCache = {};
    persist(); pushRemote();
    if(typeof render === 'function' && (appId === 'set' || appId === 'today')){ if(typeof isTyping === 'function' && isTyping()) renderLater(); else render(); }
    return { ok:true, n:total, ids:ids };
  }catch(e){
    logErr('キャラの今週のセリフ', e.message || String(e));
    return { error:e.message || String(e) };
  }finally{
    c2WeekBusy = false;
  }
}
/* 開いたときに（描画とは別に）1回だけ。うまくいかなかったら6時間あける */
function c2WeekAiAuto(){
  if(TEST_MODE || typeof charaLevel !== 'function' || charaLevel() < 1 || !c2WeekAiOn() || !aiReady()) return;
  var mon = c2Mon(today()), fk = KEY + ':c2week', st = {};
  try{ st = JSON.parse(localStorage.getItem(fk) || '{}') || {}; }catch(e){}
  var ids = c2WeekTargets().join(',');
  if(st.wk === mon && st.ids === ids && (st.ok || Date.now() - toNum(st.at) < 6 * 3600000)) return;
  try{ localStorage.setItem(fk, JSON.stringify({ wk:mon, ids:ids, at:Date.now(), ok:0 })); }catch(e){ return; }
  c2WeekAi({}).then(function(r){
    if(r && (r.ok || r.skip === 'done')){ try{ localStorage.setItem(fk, JSON.stringify({ wk:mon, ids:ids, at:Date.now(), ok:1 })); }catch(e){} }
  });
}
setTimeout(c2WeekAiAuto, 30000);
if(typeof document !== 'undefined') document.addEventListener('visibilitychange', function(){ if(!document.hidden) setTimeout(c2WeekAiAuto, 5000); });

/* ============================== キャラどうしの会話（キャラ＋） ==============================
   a … いまの子、b … 仲間。{an}{bn} 名前、{al}{bl} 好きなもの、{you} 呼び名 */
var c2Dialogs = {
  'w-rain':['a:きょうは雨がふりそうだね|b:え〜、傘もった？|a:{you}にも言っておかなきゃ|b:ぬれたら、あったかくしてね',
            'b:雨の音がするね|a:バスがおくれるかもしれないね|b:いつもより早めに出よう'],
  'w-sunny':['a:いい天気だね！|b:おさんぽ日和だ〜|a:{bl}をもって、でかけたいな|b:まずは授業と課題が先だよ〜|a:はーい'],
  'w-hot':['b:あつい〜…|a:きょうは{tmax}度まで上がるんだって|b:水分とらなきゃ|a:{you}も、こまめに飲んでね'],
  'w-cold':['a:さむいね…|b:ぎゅっとくっつこう|a:{you}は上着をわすれないでね|b:マフラーもね'],
  'w-snow':['b:見て、雪だよ！|a:きれいだけど、すべらないようにね|b:バスもおくれるかも|a:早めに出ようね'],
  'x-7':['a:{subj}のテストまで、あと{n}日だって|b:え、もうそんなに近いの？|a:きょうから少しずつ見直そう|b:{bn}もいっしょにやる！|a:がんばろうね'],
  'x-3':['b:{subj}のテスト、あと{n}日だね|a:まとめノートを作るといいかも|b:わからないところは先生に聞こう|a:{you}ならきっとだいじょうぶ'],
  'x-1':['b:明日は{subj}のテストだね…|a:ここまで、がんばってきたもんね|b:きょうは早めに寝よう|a:うん、おやすみの準備だ',
         'a:明日の持ちもの、なんだっけ|b:筆記用具と学生証！|a:ばっちりだね|b:あとはぐっすり寝るだけ'],
  'x-today':['a:きょう、{subj}のテストだね！|b:深呼吸、深呼吸…|a:{you}ならだいじょうぶ|b:おわったら、みんなで{bl}を食べよう'],
  'x-done':['a:{subj}のテスト、おわったね！|b:おつかれさまー！|a:きょうはゆっくりしようね|b:ごほうびタイムだ'],
  'k-today':['a:きょうしめきりの課題があるよ|b:「{task}」だっけ？|a:そう。出したらチェックだね|b:おうえんしてる！'],
  'k-tomo':['b:明日しめきりの課題があるみたい|a:「{task}」だね|b:きょう少し進めておくと安心だよ'],
  'k-late':['b:あれ、しめきりをすぎた課題があるみたい|a:{n}こだね…|b:まだ出せるか、たしかめてみよう|a:先生に相談するのもありだよ|b:1つずつ、いっしょにね'],
  'k-clear':['a:見て、課題がぜんぶ終わってる！|b:すごーい！|a:{you}、えらいね|b:きょうは、ごほうびの日だ'],
  'p-first':['b:きょうは1限からだね|a:ねぼうしないように…|b:目覚まし、2こかけた？|a:ばっちり！'],
  'p-work':['a:きょうはバイトの日だね|b:いってらっしゃーい！|a:帰ったら、ゆっくり休もうね'],
  'p-off':['a:おやすみの日だ〜|b:なにする？|a:{al}を食べながら、のんびり|b:いいね。ちょっとだけ勉強もね|a:…ちょっとだけね'],
  'p-long':['b:きょうは{n}コマもあるんだって|a:長い一日だね|b:お昼はしっかり食べよう|a:おやつも持っていこう'],
  'p-noclass':['a:きょうは授業がない日だね|b:課題を進めるチャンス！|a:でも、休けいもわすれずにね'],
  'a-pile':['a:暗記カード、{n}まいたまってるよ|b:5分だけやってみよう|a:少しずつなら、できるね|b:おわったら{bl}だ！'],
  'a-streak':['b:暗記、{n}日れんぞくだって！|a:すごいね、{you}|b:きょうもつづけよう'],
  'm-payday':['a:きょうは給料日！|b:やったー！|a:まず家計簿につけようね|b:ごほうびは、ちょっとだけね'],
  'm-over':['b:今月のお金、ちょっとピンチかも|a:ほしいものは、ひと晩考えよう|b:{bl}はがまん…？|a:…ちょっとだけならいいかな'],
  'e-hungry':['a:{pet}が、おなかすいたって|b:ごはんの時間だね|a:おせわタブで、あげてね'],
  'e-happy':['b:{pet}、ごきげんだね|a:なかよしのしるしだね|b:いっしょにあそびたいな'],
  'fes':['a:{fes}の季節だね|b:{fesline}|a:{you}といっしょに楽しみたいな', 'b:ねえ、{fes}だよ|a:{fesline}|b:わくわくするね'],
  'season':['a:{season}だね|b:{seasonline}|a:季節の変わりめは、体調に気をつけてね'],
  'general':['a:ねえ{bn}、好きなものってなに？|b:{bl}！|a:{an}は{al}が好き|b:こんど、いっしょに食べよう',
             'b:{an}、きょうは何してた？|a:{you}のおうえんをしてたよ|b:{bn}もする！|a:じゃあ、いっしょにね',
             'a:{you}、がんばってるよね|b:うん、毎日えらいと思う|a:ちゃんと休めてるかな|b:声をかけてあげよう',
             'b:ねむくなってきた…|a:ちょっとお昼寝する？|b:5分だけ…|a:おきたら、またがんばろうね',
             'a:きょうのもくひょう、決めた？|b:うーん、1つだけにしよう|a:いいね、1つできたら花まるだ',
             'b:ねえ{an}、看護師さんってすごいね|a:{you}も、きっとなれるよ|b:いっしょにおうえんしようね']
};
var c2DialogOrder = ['x-today', 'x-1', 'k-late', 'k-today', 'x-3', 'x-done', 'w-rain', 'w-snow', 'p-work', 'x-7', 'k-tomo', 'a-pile', 'm-payday',
  'k-clear', 'e-hungry', 'w-hot', 'w-cold', 'p-first', 'p-long', 'p-off', 'p-noclass', 'a-streak', 'm-over', 'e-happy', 'fes', 'w-sunny', 'season'];
function c2DialogPair(){
  var a = charaNow().id, b = (typeof charaPals === 'function') ? charaPals(1)[0] : '';
  if(!b || b === a) b = charaAllIds().filter(function(x){ return x !== a; })[0] || a;
  return [a, b];
}
/* 今日の会話（いくつか。いちばん今日らしいものが先） */
function c2DialogList(ymd, pair){
  ymd = ymd || today();
  pair = pair || c2DialogPair();
  var ctx = c2Ctx(ymd);
  var A = c2Persona(pair[0]), B = c2Persona(pair[1]);
  var TA = c2Types[A.t];
  var m = +ymd.slice(5, 7);
  var seasonKey = ctx.on.filter(function(x){ return /^s-/.test(x); })[0];
  var fesKey = ctx.on.filter(function(x){ return /^f-/.test(x) && x !== 'f-holiday'; })[0];
  var common = { an:A.name, bn:B.name, al:A.like || 'おいしいもの', bl:B.like || 'おいしいもの', you:A.callName || TA.you,
    season:(m >= 3 && m <= 5 ? '春' : m >= 6 && m <= 8 ? '夏' : m >= 9 && m <= 11 ? '秋' : '冬'),
    seasonline:seasonKey ? c2Scenes[seasonKey].base[1] : '',
    fes:fesKey ? ((ctx.v[fesKey] || {}).fes || '') : '', fesline:fesKey ? (c2Scenes[fesKey].base[1] || c2Scenes[fesKey].base[0]) : '' };
  var out = [];
  var build = function(topic, tpl, vars){
    var lines = [];
    var parts = tpl.split('|');
    for(var i = 0; i < parts.length; i++){
      var who = parts[i].charAt(0) === 'b' ? 1 : 0;
      var text = c2Fill(parts[i].slice(2), vars);
      if(!text) return null;
      var sp = who ? B : A;
      if(c2Types[sp.t].polite) text = c2Polite(text);
      lines.push({ who:who, id:pair[who], t:ctTic(charaById(pair[who]), text) });
    }
    return { topic:topic, pair:pair.slice(), lines:lines };
  };
  var seed = ctSeed(ymd + pair.join(','));
  c2DialogOrder.forEach(function(topic){
    var on = topic === 'fes' ? !!fesKey : topic === 'season' ? !!seasonKey : ctx.on.indexOf(topic) >= 0;
    if(!on) return;
    var list = c2Dialogs[topic] || [];
    if(!list.length) return;
    var tpl = list[seed % list.length];
    var d = build(topic, tpl, Object.assign({}, common, ctx.v[topic] || {}));
    if(d) out.push(d);
  });
  ctShuffle(c2Dialogs.general, seed).forEach(function(tpl){ var d = build('general', tpl, common); if(d) out.push(d); });
  /* AIが作った今日の会話 */
  var ai = (S.charaTalk || {})['c:' + ymd];
  if(ai && Array.isArray(ai.lines) && ai.lines.length >= 3 && Array.isArray(ai.pair)){
    var ap = ai.pair;
    out.unshift({ topic:'ai', pair:ap.slice(), ai:1, lines:ai.lines.map(function(l){
      var w = l.w === 'b' || l.w === 1 ? 1 : 0;
      return { who:w, id:ap[w], t:String(l.t || '') };
    }) });
  }
  return out;
}
