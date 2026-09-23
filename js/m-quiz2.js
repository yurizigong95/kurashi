/* くらしの手帳：授業の問題の追加（組みこみの知識・AIを使わない問題づくり・新しい種類・模擬テスト） */
/* ============================== このファイルの中身 ==============================
   js/m-quiz.js（授業の資料から問題を作る）に、次を足す。
   ・組みこみの知識 … 科目と国試の分野の対応・科目ごとの章（単元）・看護の計算の式・取りちがえやすいことば
   ・AIを使わない問題づくり … 基準値・略語・薬・看護技術の手順・計算・資料の字から、その場で作る（通信もAIも使わない）
   ・新しい種類 … 並べかえ・組み合わせ・計算
   ・小テスト工房（qz-kit）／模擬テスト（qz-moc）／にが手ノート（qz-weak）の画面
   ・Discordのボットに出す問題（まとめに入れる）
   組みこみの表は、勉強①（js/m-kokushi.js）の KQ_LABS（基準値149）・KQ_DICT（略語334）・
   KQ_DRUGS（薬95）・KQ_SKILLS（手順21）・KQ_ANAT（図4）・KQ_QS（国試の練習問題72）を、そのまま使う。 */

/* ============================== 科目と国試の分野（#127） ==============================
   授業の科目名にふくまれることばから、国試の出題基準の分野（KQ_FIELDS の id）を決める。
   上から順に見て、はじめに合ったものを使う。 */
var QZ2_FIELD_MAP = [
  ['bosei',   ['母性', '助産', '産科', 'ウィメンズ', 'women']],
  ['shoni',   ['小児', '児童', '子ども', '子供', '新生児']],
  ['rounen',  ['老年', '高齢', '加齢', 'ジェロント']],
  ['seishin', ['精神', 'メンタル', '心理', 'こころ']],
  ['zaitaku', ['在宅', '地域', '訪問', '公衆衛生', '疫学']],
  ['shakai',  ['社会保障', '社会福祉', '法規', '関係法規', '保健医療福祉', '制度', '倫理', '医療倫理']],
  ['tougou',  ['統合', '看護管理', '医療安全', '災害', '国際', 'チーム医療', 'リーダー']],
  ['kiso',    ['基礎看護', '看護技術', '看護学概論', '看護過程', '初期演習', 'フィジカルアセスメント', '援助論']],
  ['seijin',  ['成人看護', '成人', '急性期', '慢性期', 'がん', '腫瘍', 'リハビリ', '周術期', 'クリティカル']],
  ['jintai',  ['解剖', '生理学', '人体', '形態機能', '機能形態', '生体']],
  ['shippei', ['病理', '薬理', '微生物', '免疫', '生化学', '病態', '疾病', '感染症', '栄養学', '臨床栄養', '医学概論']]
];
/* 科目名から国試の分野を決める（分からなければ空） */
function qz2FieldOf(name){
  var n = String(name || '');
  for(var i = 0; i < QZ2_FIELD_MAP.length; i++){
    var f = QZ2_FIELD_MAP[i];
    for(var k = 0; k < f[1].length; k++) if(n.indexOf(f[1][k]) >= 0) return f[0];
  }
  return '';
}
function qz2FieldName(id){
  if(typeof KQ_FIELDS === 'undefined') return '';
  for(var i = 0; i < KQ_FIELDS.length; i++) if(KQ_FIELDS[i][0] === id) return KQ_FIELDS[i][1];
  return '';
}

/* ============================== 科目ごとの章（単元）の見本（#110） ==============================
   教科書によくある章立て。科目名にことばが合ったものを出して、えらぶだけで使えるようにする。 */
var QZ2_UNITS = [
  { key:['母性', '助産'], name:'母性看護学',
    units:['女性のライフサイクル', '妊娠', '分娩', '産褥', '新生児', '母乳育児', '母子保健の制度'] },
  { key:['小児'], name:'小児看護学',
    units:['成長と発達', 'バイタルと観察', '予防接種', 'よくある病気', '家族への支援', '事故予防'] },
  { key:['老年', '高齢'], name:'老年看護学',
    units:['加齢による変化', '認知症', 'フレイル・サルコペニア', '転倒・骨折', '介護と家族', '高齢者の権利'] },
  { key:['精神'], name:'精神看護学',
    units:['こころのしくみ', '主な精神疾患', '治療（薬物・精神療法）', '対人関係と看護', '権利擁護と法'] },
  { key:['成人'], name:'成人看護学',
    units:['成人の特徴', '生活習慣病', '急性期（周術期）', '慢性期', 'がん看護', 'リハビリテーション', '終末期'] },
  { key:['在宅', '地域', '訪問', '公衆衛生'], name:'地域・在宅看護論',
    units:['地域包括ケア', '訪問看護', '多職種連携', '在宅の医療機器', '介護保険', '災害と地域'] },
  { key:['社会保障', '社会福祉', '法規', '制度'], name:'健康支援と社会保障',
    units:['医療保険', '介護保険', '年金・生活保護', '保健師助産師看護師法', '医療法', '母子・高齢者・障害者の福祉'] },
  { key:['解剖', '生理', '人体', '形態機能', '機能形態'], name:'解剖生理学',
    units:['細胞と組織', '骨格と筋', '神経系', '感覚器', '循環器（心臓）', '循環器（血管）', '血液', '呼吸器',
           '消化器', '腎・泌尿器', '内分泌', '生殖器', '体液・恒常性', '免疫'] },
  { key:['病理', '病態', '疾病'], name:'疾病の成り立ち',
    units:['炎症', '感染症', '腫瘍', '循環障害', '代謝の異常', '免疫・アレルギー', '遺伝', '老化と死'] },
  { key:['薬理'], name:'薬理学',
    units:['薬の作用のしくみ', '薬物動態（吸収・分布・代謝・排泄）', '自律神経の薬', '循環器の薬', '中枢神経の薬',
           '抗菌薬・抗ウイルス薬', '鎮痛薬・麻酔薬', '副作用と相互作用', '与薬の安全'] },
  { key:['微生物'], name:'微生物学',
    units:['細菌', 'ウイルス', '真菌・原虫', '滅菌と消毒', '感染経路と予防', '常在菌と日和見感染'] },
  { key:['生化学'], name:'生化学',
    units:['糖質', '脂質', 'たんぱく質', '酵素', 'ビタミン・ミネラル', '代謝のつながり'] },
  { key:['栄養'], name:'栄養学',
    units:['三大栄養素', 'ビタミン・ミネラル', '食事摂取基準', '病気と食事療法', '経腸栄養・静脈栄養', '嚥下と食形態'] },
  { key:['心理'], name:'心理学',
    units:['発達', '学習', '記憶', '感情と動機づけ', 'パーソナリティ', 'ストレスと対処'] },
  { key:['英語'], name:'医学英語',
    units:['からだの部位', '症状', '検査', '病名', '略語', '会話（問診）'] },
  { key:['統計', '情報', 'データ', 'AI'], name:'情報・統計',
    units:['データの種類', '代表値（平均・中央値）', 'ばらつき', 'グラフの読み方', '相関と因果', '個人情報と倫理'] },
  { key:['基礎看護', '看護技術', '援助論', '初期演習', '看護学概論'], name:'基礎看護学',
    units:['看護とは', 'コミュニケーション', '環境整備', 'バイタルサイン', 'フィジカルアセスメント', '感染予防',
           '清潔の援助', '食事の援助', '排泄の援助', '活動と休息（体位・移動）', '与薬', '注射・採血',
           '呼吸の援助（酸素・吸引）', '創傷・褥瘡', '救急・BLS', '記録と報告', '看護過程'] }
];
/* 科目名に合う章の見本（合うものがなければ、ひろく使える見本） */
var QZ2_UNITS_ANY = ['第1回', '第2回', '第3回', '中間テストの範囲', '期末テストの範囲', '実習の前に'];
function qz2UnitsFor(name){
  var n = String(name || '');
  for(var i = 0; i < QZ2_UNITS.length; i++){
    var u = QZ2_UNITS[i];
    for(var k = 0; k < u.key.length; k++) if(n.indexOf(u.key[k]) >= 0) return { name:u.name, units:u.units.slice() };
  }
  return { name:'', units:QZ2_UNITS_ANY.slice() };
}

/* ============================== 取りちがえやすいことば（#42） ==============================
   ひっかけの選択肢を作るときと、AIに「まちがえやすいところを出して」と伝えるときに使う。 */
var QZ2_CONFUSE = [
  ['交感神経', '副交感神経'], ['収縮期血圧', '拡張期血圧'], ['動脈血', '静脈血'], ['吸気', '呼気'],
  ['頻脈', '徐脈'], ['頻呼吸', '徐呼吸'], ['乏尿', '多尿'], ['高血糖', '低血糖'],
  ['高カリウム血症', '低カリウム血症'], ['高ナトリウム血症', '低ナトリウム血症'],
  ['インスリン', 'グルカゴン'], ['甲状腺ホルモン', '副甲状腺ホルモン'], ['アドレナリン', 'アセチルコリン'],
  ['赤血球', '白血球'], ['好中球', 'リンパ球'], ['血小板', '赤血球'],
  ['僧帽弁', '三尖弁'], ['大動脈弁', '肺動脈弁'], ['右心房', '左心房'], ['右心室', '左心室'],
  ['肺動脈', '肺静脈'], ['収縮', '弛緩'], ['蠕動運動', '分節運動'],
  ['滅菌', '消毒'], ['標準予防策', '感染経路別予防策'], ['接触感染', '飛沫感染'], ['飛沫感染', '空気感染'],
  ['皮下注射', '筋肉内注射'], ['皮内注射', '静脈内注射'], ['一次救命処置（BLS）', '二次救命処置（ALS）'],
  ['仰臥位', '腹臥位'], ['側臥位', '半坐位（ファウラー位）'], ['砕石位', '膝胸位'],
  ['ネフロン', 'ネフローゼ'], ['糸球体', '尿細管'], ['吸収', '排泄'],
  ['自動運動', '他動運動'], ['等張性収縮', '等尺性収縮'],
  ['初乳', '成乳'], ['悪露', '羊水'], ['妊娠高血圧症候群', '妊娠糖尿病'],
  ['脱水（高張性）', '脱水（低張性）'], ['浮腫', '脱水'], ['チアノーゼ', '黄疸'],
  ['せん妄', '認知症'], ['うつ病', '双極性障害'], ['幻覚', '妄想'],
  ['介護保険', '医療保険'], ['要支援', '要介護'], ['保健所', '市町村保健センター']
];
function qz2ConfusePartner(word){
  var w = String(word || '');
  if(!w) return '';
  for(var i = 0; i < QZ2_CONFUSE.length; i++){
    if(QZ2_CONFUSE[i][0] === w) return QZ2_CONFUSE[i][1];
    if(QZ2_CONFUSE[i][1] === w) return QZ2_CONFUSE[i][0];
  }
  return '';
}
/* 文の中に出てくる「取りちがえやすいことば」を集める（AIへのヒントに使う） */
function qz2ConfuseIn(text){
  var t = String(text || ''), out = [];
  QZ2_CONFUSE.forEach(function(p){
    if(t.indexOf(p[0]) >= 0 || t.indexOf(p[1]) >= 0){
      if(out.length < 8) out.push(p[0] + '↔' + p[1]);
    }
  });
  return out;
}

/* ============================== 看護の計算問題（#32） ==============================
   数字はそのつど変えて作る。式と答えはこの表のとおりなので、AI は使わない。
   ・滴下数（滴/分）＝ 総量(mL) × 1mLあたりの滴数 ÷ 時間(分)（成人用20滴・小児用60滴）
   ・％の液（w/v％）＝ 100mL に何g入っているか
   ・うすめる … もとの濃さ×もとの量 ＝ うすめた濃さ×うすめた量
   ・酸素ボンベ（500L・満量14.7MPa）… 残り(L) ＝ 500 × 残圧(MPa) ÷ 14.7
   ・BMI ＝ 体重(kg) ÷ 身長(m)²、標準体重 ＝ 身長(m)² × 22
   ・尿量のめやす … 1時間に体重1kgあたり0.5mL より少ないと乏尿を考える */
function qz2Rnd(min, max, step){
  step = step || 1;
  var n = Math.floor(Math.random() * (Math.floor((max - min) / step) + 1));
  return Math.round((min + n * step) * 1000) / 1000;
}
function qz2Round(v, d){ var p = Math.pow(10, d || 0); return Math.round(Number(v) * p) / p; }
var QZ2_CALC = [
  { id:'drip20', name:'点滴の滴下数（成人用）', make:function(){
      var total = qz2Rnd(200, 1000, 100), h = qz2Rnd(2, 8, 1);
      var v = total * 20 / (h * 60);
      return { q:total + 'mLの輸液を' + h + '時間で落とす。成人用輸液セット（20滴＝1mL）を使うとき、1分間の滴下数はおよそ何滴か。',
        at:String(qz2Round(v, 0)), un:'滴/分', tol:5,
        how:'滴下数（滴/分）＝ 総量(mL) × 20(滴/mL) ÷ 時間(分)　＝ ' + total + ' × 20 ÷ ' + (h * 60) + ' ＝ ' + qz2Round(v, 1),
        exp:'成人用の輸液セットは20滴で1mL。時間は分になおしてから計算する。' };
    } },
  { id:'drip60', name:'点滴の滴下数（小児用）', make:function(){
      var total = qz2Rnd(50, 300, 10), h = qz2Rnd(2, 6, 1);
      var v = total * 60 / (h * 60);
      return { q:total + 'mLの輸液を' + h + '時間で落とす。小児用輸液セット（60滴＝1mL）を使うとき、1分間の滴下数はおよそ何滴か。',
        at:String(qz2Round(v, 0)), un:'滴/分', tol:5,
        how:'滴下数（滴/分）＝ 総量(mL) × 60(滴/mL) ÷ 時間(分)　＝ ' + total + ' × 60 ÷ ' + (h * 60) + ' ＝ ' + qz2Round(v, 1),
        exp:'小児用（微量用）の輸液セットは60滴で1mL。1時間あたりのmL数と、滴下数が同じ数になる。' };
    } },
  { id:'rate', name:'1時間あたりの流量', make:function(){
      var h = qz2Rnd(4, 12, 2), total = h * qz2Rnd(40, 120, 10);
      return { q:total + 'mLの輸液を' + h + '時間で落とすとき、1時間あたり何mLか。',
        at:String(qz2Round(total / h, 1)), un:'mL/時', tol:2,
        how:'流量（mL/時）＝ 総量(mL) ÷ 時間(時)　＝ ' + total + ' ÷ ' + h + ' ＝ ' + qz2Round(total / h, 1),
        exp:'輸液ポンプに入れる数字。滴下数を数えるときは、これに滴数（20または60）をかけて60で割る。' };
    } },
  { id:'hours', name:'輸液にかかる時間', make:function(){
      var rate = qz2Rnd(40, 120, 20), total = rate * qz2Rnd(3, 10, 1);
      return { q:total + 'mLの輸液を' + rate + 'mL/時で落とすと、何時間かかるか。',
        at:String(qz2Round(total / rate, 1)), un:'時間', tol:2,
        how:'時間(時)＝ 総量(mL) ÷ 流量(mL/時)　＝ ' + total + ' ÷ ' + rate + ' ＝ ' + qz2Round(total / rate, 1),
        exp:'終わる時刻を伝えるときや、次の輸液を用意するときに使う。' };
    } },
  { id:'mgkg', name:'体重あたりの薬の量', make:function(){
      var w = qz2Rnd(40, 70, 1), d = qz2Rnd(2, 10, 1);
      return { q:'体重' + w + 'kgの患者に、1回' + d + 'mg/kgの薬を指示された。1回量は何mgか。',
        at:String(qz2Round(w * d, 1)), un:'mg', tol:2,
        how:'1回量(mg)＝ 体重(kg) × 指示(mg/kg)　＝ ' + w + ' × ' + d + ' ＝ ' + qz2Round(w * d, 1),
        exp:'小児や、量の幅がせまい薬では、体重あたりで指示が出る。計算したら、指示書ともう一度つき合わせる。' };
    } },
  { id:'pct', name:'％の液に入っている量', make:function(){
      var p = [0.9, 5, 10, 20][Math.floor(Math.random() * 4)], v = qz2Rnd(20, 500, 20);
      return { q:p + '%のブドウ糖液（または生理食塩液）' + v + 'mLの中に、溶けている成分は何gか。',
        at:String(qz2Round(p / 100 * v, 2)), un:'g', tol:3,
        how:'％（w/v％）は「100mLに何g」という意味。　量(g)＝ 濃さ(%) ÷ 100 × 液の量(mL)　＝ ' + p + ' ÷ 100 × ' + v + ' ＝ ' + qz2Round(p / 100 * v, 2),
        exp:'生理食塩液0.9%は、100mLに0.9gの塩化ナトリウムが入っている、という意味。' };
    } },
  { id:'dilute', name:'消毒液をうすめる', make:function(){
      var c1 = [5, 6, 10][Math.floor(Math.random() * 3)], c2 = [0.1, 0.2, 0.5, 1][Math.floor(Math.random() * 4)];
      var v2 = qz2Rnd(200, 1000, 100);
      return { q:c1 + '%の消毒液をうすめて、' + c2 + '%の液を' + v2 + 'mL作りたい。もとの液は何mL必要か。',
        at:String(qz2Round(c2 * v2 / c1, 1)), un:'mL', tol:3,
        how:'もとの濃さ×もとの量 ＝ うすめた濃さ×うすめた量。　もとの量 ＝ ' + c2 + ' × ' + v2 + ' ÷ ' + c1 + ' ＝ ' + qz2Round(c2 * v2 / c1, 1) + 'mL（残りは水を足す）',
        exp:'次亜塩素酸ナトリウムなどをうすめるときの考え方。作った液は、その日のうちに使いきる。' };
    } },
  { id:'o2', name:'酸素ボンベの残り', make:function(){
      var p = qz2Rnd(3, 13, 1), f = [1, 2, 3, 4, 5][Math.floor(Math.random() * 5)];
      var left = 500 * p / 14.7;
      return { q:'500L入りの酸素ボンベ（満タンで14.7MPa）の圧力計が' + p + 'MPaをさしている。' + f + 'L/分で使うと、およそ何分使えるか。',
        at:String(qz2Round(left / f, 0)), un:'分', tol:8,
        how:'残り(L)＝ 500 × 残圧(MPa) ÷ 14.7 ＝ ' + qz2Round(left, 0) + 'L。　使える時間(分)＝ 残り(L) ÷ 流量(L/分) ＝ ' + qz2Round(left, 0) + ' ÷ ' + f + ' ＝ ' + qz2Round(left / f, 0),
        exp:'移動や検査の前に確かめる。実際には、余裕をみて早めに交換する。' };
    } },
  { id:'bmi', name:'BMI', make:function(){
      var h = qz2Rnd(150, 180, 1), w = qz2Rnd(45, 85, 1);
      var m = h / 100;
      return { q:'身長' + h + 'cm、体重' + w + 'kgの人のBMIはいくつか（小数第1位まで）。',
        at:String(qz2Round(w / (m * m), 1)), un:'', tol:3,
        how:'BMI ＝ 体重(kg) ÷ 身長(m)²　＝ ' + w + ' ÷ ' + qz2Round(m * m, 4) + ' ＝ ' + qz2Round(w / (m * m), 1),
        exp:'日本肥満学会の区分では、18.5未満がやせ、18.5〜25未満がふつう、25以上が肥満。' };
    } },
  { id:'ibw', name:'標準体重', make:function(){
      var h = qz2Rnd(150, 180, 1), m = h / 100;
      return { q:'身長' + h + 'cmの人の標準体重（BMI22で計算）は何kgか（小数第1位まで）。',
        at:String(qz2Round(m * m * 22, 1)), un:'kg', tol:3,
        how:'標準体重(kg)＝ 身長(m)² × 22　＝ ' + qz2Round(m * m, 4) + ' × 22 ＝ ' + qz2Round(m * m * 22, 1),
        exp:'BMI22は、統計上いちばん病気になりにくいとされる値。食事の計画を立てるときの目安に使う。' };
    } },
  { id:'urine', name:'尿量のめやす', make:function(){
      var w = qz2Rnd(40, 70, 5), t = [2, 3, 4, 6][Math.floor(Math.random() * 4)];
      var v = qz2Rnd(40, 250, 10);
      return { q:'体重' + w + 'kgの患者の' + t + '時間の尿量が' + v + 'mLだった。1時間あたり体重1kgあたり何mLか（小数第2位まで）。',
        at:String(qz2Round(v / t / w, 2)), un:'mL/kg/時', tol:5,
        how:'尿量(mL/kg/時)＝ 尿量(mL) ÷ 時間(時) ÷ 体重(kg)　＝ ' + v + ' ÷ ' + t + ' ÷ ' + w + ' ＝ ' + qz2Round(v / t / w, 2),
        exp:'0.5mL/kg/時より少ない状態が続くときは、乏尿として医師に報告する目安になる。' };
    } },
  { id:'tab', name:'錠剤の数', make:function(){
      var t = [50, 100, 200, 250][Math.floor(Math.random() * 4)];
      var d = t * [1, 2, 3][Math.floor(Math.random() * 3)];
      var n = [2, 3][Math.floor(Math.random() * 2)], days = [3, 5, 7, 14][Math.floor(Math.random() * 4)];
      return { q:'1回' + d + 'mgを1日' + n + '回、' + days + '日分の処方が出た。1錠' + t + 'mgの薬は、ぜんぶで何錠必要か。',
        at:String(qz2Round(d / t * n * days, 0)), un:'錠', tol:0,
        how:'1回の錠数 ＝ ' + d + ' ÷ ' + t + ' ＝ ' + (d / t) + '錠。　ぜんぶで ＝ ' + (d / t) + ' × ' + n + '回 × ' + days + '日 ＝ ' + qz2Round(d / t * n * days, 0) + '錠',
        exp:'受け取ったときと、飲ませる前に、指示書と数を確かめる（与薬の6R）。' };
    } }
];

/* ============================== AIを使わない問題づくり ==============================
   組みこみの表（基準値・略語・薬・手順）と、資料から取り出した字だけで問題を作る。
   通信もAIも使わないので、APIをまったく使わない。 */
function qz2Shuffle(a){
  for(var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
  return a;
}
function qz2Pick(list, n){ return qz2Shuffle(list.slice()).slice(0, Math.max(0, n)); }
/* 正解＋まちがいの選択肢をまぜて、正解の番号を返す */
function qz2Choices(right, wrongs, max){
  var c = [right], seen = {};
  seen[right] = 1;
  qz2Shuffle(wrongs.slice()).forEach(function(w){
    w = String(w == null ? '' : w).trim();
    if(!w || seen[w] || c.length >= (max || 4)) return;
    seen[w] = 1; c.push(w);
  });
  if(c.length < 2) return null;
  qz2Shuffle(c);
  return { c:c, a:[c.indexOf(right)] };
}
function qz2Item(o){
  return Object.assign({ qt:'mc', q:'', c:[], a:[], at:'', alt:[], exp:'', tag:'', lv:2, ch:'', on:1 }, o);
}

/* ===== 基準値（#130） ===== */
function qz2Labs(){ return (typeof kqLabs === 'function') ? kqLabs() : []; }
function qz2MakeLabs(n, opt){
  opt = opt || {};
  var all = qz2Labs().filter(function(o){ return o.v && o.name; });
  if(opt.cat) all = all.filter(function(o){ return o.cat === opt.cat; });
  if(!all.length) return [];
  var out = [];
  qz2Pick(all, n * 2).forEach(function(o){
    if(out.length >= n) return;
    var right = o.v + (o.unit ? ' ' + o.unit : '');
    /* まちがいの選択肢は、同じ単位のほかの項目の値（本当にある値なので、はっきりまちがい） */
    var pool = qz2Labs().filter(function(x){ return x !== o && x.unit === o.unit && x.v !== o.v; })
      .map(function(x){ return x.v + (x.unit ? ' ' + x.unit : ''); });
    if(pool.length < 3){
      pool = pool.concat(qz2Labs().filter(function(x){ return x !== o && x.v !== o.v; })
        .slice(0, 12).map(function(x){ return x.v + (x.unit ? ' ' + x.unit : ''); }));
    }
    var ch = qz2Choices(right, pool, 4);
    if(!ch || ch.c.length < 3) return;
    out.push(qz2Item({ qt:'mc', q:'「' + o.name + (o.abbr ? '（' + o.abbr + '）' : '') + '」の基準値（目安）はどれか。',
      c:ch.c, a:ch.a, exp:(o.note || '') + '（' + o.cat + '）', tag:o.cat, ch:o.cat, lv:1,
      src:'くらしの手帳の基準値表（目安。施設・教科書で少しちがう）' }));
  });
  return out;
}
/* 穴うめ版（書いて覚える） */
function qz2MakeLabsCloze(n, opt){
  opt = opt || {};
  var all = qz2Labs().filter(function(o){ return o.v && o.name; });
  if(opt.cat) all = all.filter(function(o){ return o.cat === opt.cat; });
  return qz2Pick(all, n).map(function(o){
    return qz2Item({ qt:'cloze', q:'「' + o.name + (o.abbr ? '（' + o.abbr + '）' : '') + '」の基準値は（　）' + (o.unit || '') + '。',
      at:o.v, alt:[o.v.replace(/,/g, '')], exp:(o.note || '') + '（' + o.cat + '）', tag:o.cat, ch:o.cat, lv:2,
      src:'くらしの手帳の基準値表（目安。施設・教科書で少しちがう）' });
  });
}

/* ===== 略語・用語（#130・英語は #43） ===== */
function qz2Dicts(){
  var b = (typeof kqDictBuiltin === 'function') ? kqDictBuiltin() : [];
  var o = (typeof kqDictOwn === 'function') ? kqDictOwn() : [];
  return b.concat(o).filter(function(x){ return x && x.abbr; });
}
function qz2MakeDict(n, opt){
  opt = opt || {};
  var all = qz2Dicts().filter(function(x){ return x.ja || x.desc; });
  if(!all.length) return [];
  var out = [];
  qz2Pick(all, n * 2).forEach(function(o){
    if(out.length >= n) return;
    var right = o.ja || String(o.desc).split('。')[0];
    var pool = qz2Pick(all.filter(function(x){ return x !== o && (x.ja || x.desc); }), 12)
      .map(function(x){ return x.ja || String(x.desc).split('。')[0]; });
    /* 取りちがえやすいことばがあれば、それをまちがいの選択肢に入れる */
    var mate = qz2ConfusePartner(o.ja);
    if(mate) pool.unshift(mate);
    var ch = qz2Choices(right, pool, 4);
    if(!ch || ch.c.length < 3) return;
    out.push(qz2Item({ qt:'mc', q:'「' + o.abbr + '」の意味はどれか。', c:ch.c, a:ch.a,
      exp:(o.full ? o.full + '。' : '') + String(o.desc || '').slice(0, 160), tag:'略語', ch:'略語・用語', lv:1,
      src:'くらしの手帳の用語集（教科書で確かめて）' }));
  });
  return out;
}
/* 英語の正式名をあてる（医学英語の授業むけ #43） */
function qz2MakeDictEn(n){
  var all = qz2Dicts().filter(function(x){ return x.full && /[A-Za-z]/.test(x.full) && x.ja; });
  if(!all.length) return [];
  var out = [];
  qz2Pick(all, n * 2).forEach(function(o){
    if(out.length >= n) return;
    var pool = qz2Pick(all.filter(function(x){ return x !== o; }), 10).map(function(x){ return x.full; });
    var ch = qz2Choices(o.full, pool, 4);
    if(!ch || ch.c.length < 3) return;
    out.push(qz2Item({ qt:'mc', q:'「' + o.ja + '（' + o.abbr + '）」の英語の正式名はどれか。', c:ch.c, a:ch.a,
      exp:o.abbr + '＝' + o.full + '（' + o.ja + '）', tag:'医学英語', ch:'英語', lv:2,
      src:'くらしの手帳の用語集（教科書で確かめて）' }));
  });
  return out;
}

/* ===== 薬（#130 のついで） ===== */
function qz2MakeDrugs(n){
  var all = (typeof kqDrugs === 'function') ? kqDrugs() : [];
  if(!all.length) return [];
  var out = [];
  qz2Pick(all, n * 2).forEach(function(o){
    if(out.length >= n) return;
    var kind = Math.random() < 0.5 ? 'act' : 'side';
    var right = kind === 'act' ? o.act : String(o.side).split('、')[0];
    if(!right) return;
    var pool = qz2Pick(all.filter(function(x){ return x !== o && x.cat !== o.cat; }), 10)
      .map(function(x){ return kind === 'act' ? x.act : String(x.side).split('、')[0]; });
    var ch = qz2Choices(right, pool, 4);
    if(!ch || ch.c.length < 3) return;
    out.push(qz2Item({ qt:'mc',
      q:'「' + o.group + '」（' + String(o.names).split('、')[0] + 'など）について、' + (kind === 'act' ? 'はたらき' : '主な副作用') + 'はどれか。',
      c:ch.c, a:ch.a, exp:'はたらき：' + o.act + '\n看護で気をつけること：' + o.care, tag:o.cat, ch:'薬', lv:2,
      src:'くらしの手帳の薬のカード（目安。添付文書・教科書で確かめて）' }));
  });
  return out;
}

/* ===== 看護技術の手順を、並べかえ問題に（#129） ===== */
function qz2Skills(){ return (typeof kqSkillsAll === 'function') ? kqSkillsAll() : []; }
function qz2MakeSkillOrder(n, opt){
  opt = opt || {};
  var all = qz2Skills().filter(function(s){ return s && (s.steps || []).length >= 4; });
  if(opt.skill) all = all.filter(function(s){ return s.id === opt.skill; });
  if(!all.length) return [];
  var out = [];
  qz2Pick(all, Math.max(n, 1)).forEach(function(s){
    if(out.length >= n) return;
    var steps = s.steps.map(function(x){ return Array.isArray(x) ? String(x[0]) : String((x && x.s) || x); });
    var len = Math.min(5, steps.length);
    var from = Math.floor(Math.random() * (steps.length - len + 1));
    var part = steps.slice(from, from + len);
    out.push(qz2Item({ qt:'order', q:'「' + s.name + '」の手順です。正しい順にならべてください。' +
        (from > 0 ? '（' + (from + 1) + '番目からの' + len + 'つ）' : '（はじめの' + len + 'つ）'),
      c:part, a:[], exp:'学校で習った手順を優先してください。' + (s.goal ? '目安の時間：' + s.goal : ''), tag:s.cat, ch:'看護技術', lv:2,
      src:'くらしの手帳の手順の例（学校で習った手順を優先して）' }));
  });
  return out;
}
/* 手順の「根拠」をあてる問題 */
function qz2MakeSkillWhy(n){
  /* 手順は { s:手順, w:根拠 } の形（勉強①が作る）。念のため配列の形も読む。 */
  var step1 = function(x){ return Array.isArray(x) ? String(x[0] || '') : String((x && x.s) || ''); };
  var why1 = function(x){ return Array.isArray(x) ? String(x[1] || '') : String((x && x.w) || ''); };
  var all = qz2Skills().filter(function(s){ return (s.steps || []).some(function(x){ return why1(x); }); });
  if(!all.length) return [];
  var pairs = [];
  all.forEach(function(s){
    (s.steps || []).forEach(function(x){ if(step1(x) && why1(x)) pairs.push({ s:s, step:step1(x), why:why1(x) }); });
  });
  var out = [];
  qz2Pick(pairs, n * 2).forEach(function(p){
    if(out.length >= n) return;
    var pool = qz2Pick(pairs.filter(function(x){ return x.s !== p.s; }), 10).map(function(x){ return x.why; });
    var ch = qz2Choices(p.why, pool, 4);
    if(!ch || ch.c.length < 3) return;
    out.push(qz2Item({ qt:'mc', q:'「' + p.s.name + '」で、「' + p.step + '」のはなぜか。', c:ch.c, a:ch.a,
      exp:p.step + '\n→ ' + p.why, tag:p.s.cat, ch:'看護技術', lv:3,
      src:'くらしの手帳の手順の例（学校で習った手順を優先して）' }));
  });
  return out;
}

/* ===== 計算問題（#32） ===== */
function qz2MakeCalc(n, ids){
  var types = QZ2_CALC.filter(function(t){ return !ids || !ids.length || ids.indexOf(t.id) >= 0; });
  if(!types.length) return [];
  var out = [], seen = {};
  for(var i = 0; i < n * 4 && out.length < n; i++){
    var t = types[i % types.length];
    var o = t.make();
    if(seen[o.q]) continue;
    seen[o.q] = 1;
    out.push(qz2Item({ qt:'calc', q:o.q, at:o.at, un:o.un, tol:o.tol, how:o.how, exp:o.exp,
      tag:t.name, ch:'計算', lv:2, src:'くらしの手帳の計算問題（式は教科書で確かめて）' }));
  }
  return out;
}

/* ===== 組み合わせ問題（#30）… 用語と意味をむすぶ ===== */
function qz2MakeMatch(n, opt){
  opt = opt || {};
  var out = [];
  var src = opt.from === 'lab' ? qz2Labs().filter(function(o){ return o.v; }).map(function(o){ return [o.name, o.v + (o.unit ? ' ' + o.unit : '')]; })
    : opt.from === 'drug' ? ((typeof kqDrugs === 'function') ? kqDrugs() : []).map(function(o){ return [o.group, String(o.act).slice(0, 40)]; })
    : qz2Dicts().filter(function(x){ return x.ja && x.ja.indexOf('②') < 0; }).map(function(x){ return [x.abbr, x.ja]; });
  src = src.filter(function(p){ return p[0] && p[1]; });
  if(src.length < 4) return [];
  for(var i = 0; i < n; i++){
    var pick = qz2Pick(src, 4);
    var seen = {}, pairs = [];
    pick.forEach(function(p){ if(!seen[p[1]]){ seen[p[1]] = 1; pairs.push([p[0], p[1]]); } });
    if(pairs.length < 3) continue;
    out.push(qz2Item({ qt:'match', q:'左と右で、合うものをむすんでください。', pairs:pairs,
      exp:'', tag:opt.from === 'lab' ? '基準値' : opt.from === 'drug' ? '薬' : '略語', ch:'組み合わせ', lv:2,
      src:'くらしの手帳の組みこみの表（教科書で確かめて）' }));
  }
  return out;
}

/* ===== 資料の字から、その場で作る（AIを使わないモード） =====
   数字と単位があるところ・組みこみの用語が出てくるところを（　）にする。 */
var QZ2_UNIT_RE = /(\d[\d,\.]*\s*(?:〜|～|-|から)?\s*[\d,\.]*\s*(?:mmHg|mL|ml|L|mg|g|kg|μg|mEq\/L|mg\/dL|g\/dL|%|℃|回\/分|回|時間|分|日|週|歳|mm|cm|kcal|単位))/;
function qz2Sentences(text){
  return String(text || '')
    .replace(/【[^】]*】/g, ' ')
    .split(/[。\n！？!?]/)
    .map(function(s){ return s.replace(/^[\s・●○◆■\-–—*・]+/, '').trim(); })
    .filter(function(s){ return s.length >= 12 && s.length <= 120; });
}
function qz2TermsIn(s){
  var out = [];
  qz2Dicts().forEach(function(d){
    if(out.length >= 3) return;
    var w = d.ja || '';
    if(w && w.length >= 3 && s.indexOf(w) >= 0) out.push(w);
    else if(d.abbr && d.abbr.length >= 3 && s.indexOf(d.abbr) >= 0) out.push(d.abbr);
  });
  return out;
}
function qz2MakeText(text, n, opt){
  opt = opt || {};
  var ss = qz2Sentences(text), out = [], seen = {};
  /* 数字のある文を先に使う（基準値や回数は、覚えるところになりやすい） */
  var withNum = ss.filter(function(s){ return QZ2_UNIT_RE.test(s); });
  var rest = ss.filter(function(s){ return withNum.indexOf(s) < 0; });
  withNum.concat(rest).forEach(function(s){
    if(out.length >= n) return;
    var m = s.match(QZ2_UNIT_RE), hide = '';
    if(m) hide = m[1].trim();
    else {
      var t = qz2TermsIn(s);
      if(t.length) hide = t[0];
    }
    if(!hide || hide.length > 24) return;
    var q = s.split(hide).join('（　）');
    if(q === s || seen[q]) return;
    seen[q] = 1;
    out.push(qz2Item({ qt:'cloze', q:q + '。', at:hide, exp:'もとの文：' + s + '。', tag:opt.tag || '', ch:opt.ch || '', lv:1,
      src:(opt.src || '資料') + '（自分の資料から、その場で作りました）' }));
  });
  return out;
}
/* ○×も作る（数字をわざと変えた文を「×」にする） */
function qz2MakeTextTf(text, n, opt){
  opt = opt || {};
  var ss = qz2Sentences(text).filter(function(s){ return QZ2_UNIT_RE.test(s); });
  var out = [];
  qz2Pick(ss, n).forEach(function(s){
    var m = s.match(QZ2_UNIT_RE);
    if(!m || out.length >= n) return;
    var num = m[1], wrong = Math.random() < 0.5;
    var shown = wrong ? qz2Twist(num) : num;
    if(wrong && shown === num) wrong = false;
    out.push(qz2Item({ qt:'tf', q:s.split(num).join(shown) + '。', c:['○（正しい）', '×（まちがい）'], a:[wrong ? 1 : 0],
      exp:'資料には「' + s + '」と書いてあります。', tag:opt.tag || '', ch:opt.ch || '', lv:2,
      src:(opt.src || '資料') + '（自分の資料から、その場で作りました）' }));
  });
  return out;
}
/* 数字を、ありそうだけどちがう数に変える */
function qz2Twist(s){
  return String(s).replace(/\d+(\.\d+)?/, function(d){
    var v = Number(d);
    if(!isFinite(v) || v === 0) return d;
    var k = [0.5, 2, 1.5, 10][Math.floor(Math.random() * 4)];
    var r = v * k;
    return String(d.indexOf('.') >= 0 ? Math.round(r * 10) / 10 : Math.round(r));
  });
}

/* ============================== まちがいの「なぜ？」を、手帳の中でさがす（#72） ==============================
   基準値・略語・薬の表に書いてあることで説明できるときは、AIを呼ばない。 */
function qz2Why(q){
  if(!q) return '';
  if(q.qt === 'calc' && q.how) return q.how + (q.exp ? '\n' + q.exp : '');
  var text = String(q.q || '') + ' ' + (typeof qzAnswerText === 'function' ? qzAnswerText(q) : '');
  var out = [];
  /* 基準値 */
  qz2Labs().forEach(function(o){
    if(out.length >= 2 || !o.name || o.name.length < 3) return;
    if(text.indexOf(o.name) >= 0 || (o.abbr && o.abbr.length >= 2 && text.indexOf(o.abbr) >= 0)){
      out.push('【' + o.name + (o.abbr ? '（' + o.abbr + '）' : '') + '】基準値の目安は ' + o.v + (o.unit ? ' ' + o.unit : '') +
        '。' + (o.note || ''));
    }
  });
  /* 略語・用語 */
  qz2Dicts().forEach(function(d){
    if(out.length >= 3) return;
    var hit = (d.abbr && d.abbr.length >= 2 && text.indexOf(d.abbr) >= 0) || (d.ja && d.ja.length >= 3 && text.indexOf(d.ja) >= 0);
    if(!hit) return;
    out.push('【' + d.abbr + '】' + (d.full ? d.full + '＝' : '') + (d.ja || '') + '。' + String(d.desc || '').slice(0, 120));
  });
  /* 取りちがえやすいことば */
  var conf = qz2ConfuseIn(text);
  if(conf.length) out.push('まちがえやすい組み合わせ：' + conf.slice(0, 3).join('、') + '。どちらの話かを、先にたしかめる。');
  /* 薬 */
  if(out.length < 3 && typeof kqDrugs === 'function'){
    kqDrugs().forEach(function(o){
      if(out.length >= 3 || !o.group) return;
      if(text.indexOf(o.group) >= 0) out.push('【' + o.group + '】' + o.act + ' 看護：' + o.care);
    });
  }
  return out.slice(0, 3).join('\n');
}

/* ============================== 小テスト工房（AIを使わない問題づくり） ============================== */
var QZ2_KITS = [
  { id:'lab',      name:'基準値（4択）',       desc:'血液・尿・バイタルの基準値', make:function(n, o){ return qz2MakeLabs(n, o); } },
  { id:'labc',     name:'基準値（穴うめ）',     desc:'数を書いて覚える',           make:function(n, o){ return qz2MakeLabsCloze(n, o); } },
  { id:'dict',     name:'略語・用語',           desc:'ADL・SpO2 などの意味',       make:function(n){ return qz2MakeDict(n); } },
  { id:'en',       name:'医学英語',             desc:'日本語→英語の正式名',        make:function(n){ return qz2MakeDictEn(n); } },
  { id:'drug',     name:'薬',                   desc:'はたらき・副作用',           make:function(n){ return qz2MakeDrugs(n); } },
  { id:'skill',    name:'看護技術の手順（並べかえ）', desc:'正しい順にならべる',   make:function(n, o){ return qz2MakeSkillOrder(n, o); } },
  { id:'why',      name:'手順の根拠',           desc:'なぜそうするのか',           make:function(n){ return qz2MakeSkillWhy(n); } },
  { id:'match',    name:'組み合わせ',           desc:'略語と意味をむすぶ',         make:function(n, o){ return qz2MakeMatch(n, o); } },
  { id:'calc',     name:'計算',                 desc:'点滴・薬の量・BMI など',     make:function(n, o){ return qz2MakeCalc(n, o && o.calcIds); } }
];
var qz2State = { kit:'lab', n:10, cat:'', calcIds:[],
  weakSub:'all', mocSub:'all', mocField:'', mocN:50, mocMin:50 };

function qz2KitOf(id){ return QZ2_KITS.filter(function(k){ return k.id === id; })[0] || QZ2_KITS[0]; }
function qz2KitMake(){
  var kit = qz2KitOf(qz2State.kit);
  var sub = (typeof qzCurSub === 'function') ? qzCurSub() : '';
  if(sub === 'none') sub = '';
  var items = [];
  try{ items = kit.make(qz2State.n, { cat:qz2State.cat, calcIds:qz2State.calcIds }) || []; }
  catch(e){ kmErr('quiz2/' + kit.id, e); }
  if(!items.length){ toast('作れませんでした（もとになる表が見つかりません）', true); return 0; }
  qzState.pv = { sub:sub, nomat:1, title:kit.name, summary:'', items:items, src:items[0].src || '' };
  render(); window.scrollTo(0, 0);
  toast(items.length + '問できました（AIは使っていません）');
  return items.length;
}
function qz2KitView(){
  if(qzState.pv) return qzPvView();
  var kit = qz2KitOf(qz2State.kit);
  var subs = qzSubs(), sub = qzCurSub();
  var h = section('どの科目に入れる？', subs.length ? qzSubTitle(sub) : null,
    subs.length ? qzSubChips('qz-sub', sub, false) : qzNoSubHtml());
  h += section('何から作る？', kit.name,
    '<div class="qz-kits">' + QZ2_KITS.map(function(k){
      return '<button data-act="qz2-kit" data-v="' + k.id + '" class="' + (qz2State.kit === k.id ? 'on' : '') + '">' +
        '<b>' + esc(k.name) + '</b><span>' + esc(k.desc) + '</span></button>';
    }).join('') + '</div>' +
    (kit.id === 'lab' || kit.id === 'labc'
      ? '<label class="f" style="margin-top:10px">分類でしぼる</label><div class="chips qz-chips">' +
        [['', 'すべて']].concat((typeof kqLabCats === 'function' ? kqLabCats() : []).map(function(c){ return [c, c]; })).map(function(c){
          return '<button data-act="qz2-cat" data-v="' + esc(c[0]) + '" class="' + (qz2State.cat === c[0] ? 'on' : '') + '">' + esc(c[1]) + '</button>';
        }).join('') + '</div>'
      : '') +
    (kit.id === 'calc'
      ? '<label class="f" style="margin-top:10px">計算の種類（えらばないと、ぜんぶから出ます）</label><div class="chips qz-chips">' +
        QZ2_CALC.map(function(t){
          return '<button data-act="qz2-calc" data-v="' + t.id + '" class="' + (qz2State.calcIds.indexOf(t.id) >= 0 ? 'on' : '') + '">' + esc(t.name) + '</button>';
        }).join('') + '</div>'
      : '') +
    '<label class="f" style="margin-top:10px">問題の数</label>' +
    '<div class="pillrow">' + [5, 10, 20, 30].map(function(n){
      return '<button data-act="qz2-n" data-v="' + n + '" class="' + (qz2State.n === n ? 'on' : '') + '">' + n + '問</button>';
    }).join('') + '</div>' +
    '<button class="btn" style="margin-top:12px" data-act="qz2-make">この中から' + qz2State.n + '問つくる</button>' +
    '<div class="pair" style="margin-top:8px"><button class="btn ghost" data-act="qz-go" data-tool="kq-anat">🫀 解剖図の穴うめをひらく</button>' +
      '<button class="btn ghost" data-act="qz-go" data-tool="kq-drill" style="flex:0 0 auto">📝 国試ドリル</button></div>' +
    '<p class="note">くらしの手帳に入っている表（基準値149・略語334・薬95・手順21・解剖図4）から作ります。' +
      '<b>AI（Gemini）は使いません</b>ので、通信も、APIの使用量もかかりません。数字や式は教科書で確かめてください。</p>');
  return h;
}

/* ============================== 操作・登録 ============================== */
kmAction(function(act, t){
  if(act.indexOf('qz2-') !== 0) return false;
  var v = t.dataset.v || '';
  if(act === 'qz2-kit'){ qz2State.kit = v; qz2State.cat = ''; render(); return true; }
  if(act === 'qz2-cat'){ qz2State.cat = v; render(); return true; }
  if(act === 'qz2-n'){ qz2State.n = toNum(v) || 10; render(); return true; }
  if(act === 'qz2-calc'){
    var i = qz2State.calcIds.indexOf(v);
    if(i >= 0) qz2State.calcIds.splice(i, 1); else qz2State.calcIds.push(v);
    render();
    return true;
  }
  if(act === 'qz2-make'){ qz2KitMake(); return true; }
  return false;                      /* ほかの qz2- の操作は、下の登録にまかせる */
});
kmStudy({ id:'qz-kit', icon:'🧪', title:'基準値・略語の小テスト', desc:'手帳の中の表から、AIを使わずに作ります', order:8,
  view:qz2KitView, badge:function(){ return 'AIなし'; } });

/* ============================== 写真をととのえる（#8・#9・#11・#22） ==============================
   どれもブラウザの中だけで計算する（通信もAIも使わない）。 */
function qz2Load(dataUrl){
  return new Promise(function(res, rej){
    var i = new Image();
    i.onload = function(){ res(i); };
    i.onerror = function(){ rej(new Error('写真を読めませんでした')); };
    i.src = dataUrl;
  });
}
function qz2Canvas(w, h){
  var cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h));
  return cv;
}
/* 明るさ・コントラストを自動で合わせる（字を読みやすく：#9） */
async function qz2ImgAuto(dataUrl, quality){
  var img = await qz2Load(dataUrl);
  var cv = qz2Canvas(img.width, img.height), ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  var d;
  try{ d = ctx.getImageData(0, 0, cv.width, cv.height); }catch(e){ return dataUrl; }
  var px = d.data, hist = new Array(256);
  for(var i = 0; i < 256; i++) hist[i] = 0;
  for(var p = 0; p < px.length; p += 4){
    var y = (px[p] * 299 + px[p + 1] * 587 + px[p + 2] * 114) / 1000;
    hist[Math.max(0, Math.min(255, Math.round(y)))]++;
  }
  /* 下から2%・上から2%を切りつめて、明るさの幅をいっぱいに広げる */
  var total = px.length / 4, cut = total * 0.02, lo = 0, hi = 255, acc = 0;
  for(var a = 0; a < 256; a++){ acc += hist[a]; if(acc >= cut){ lo = a; break; } }
  acc = 0;
  for(var b = 255; b >= 0; b--){ acc += hist[b]; if(acc >= cut){ hi = b; break; } }
  if(hi - lo < 16) return dataUrl;                       /* もともと平らな写真は、さわらない */
  var scale = 255 / (hi - lo);
  for(var k = 0; k < px.length; k += 4){
    px[k] = Math.max(0, Math.min(255, (px[k] - lo) * scale));
    px[k + 1] = Math.max(0, Math.min(255, (px[k + 1] - lo) * scale));
    px[k + 2] = Math.max(0, Math.min(255, (px[k + 2] - lo) * scale));
  }
  ctx.putImageData(d, 0, 0);
  return cv.toDataURL('image/jpeg', quality || 0.82);
}
/* 見開きを2ページに分ける（#11） */
async function qz2ImgSplit(dataUrl, quality){
  var img = await qz2Load(dataUrl);
  var half = Math.floor(img.width / 2), out = [];
  [[0, half], [half, img.width - half]].forEach(function(p){
    var cv = qz2Canvas(p[1], img.height);
    cv.getContext('2d').drawImage(img, p[0], 0, p[1], img.height, 0, 0, p[1], img.height);
    out.push(cv.toDataURL('image/jpeg', quality || 0.82));
  });
  return out;
}
/* 四すみを指して、まっすぐにする（#8）
   quad … [[x,y] ×4]（左上・右上・右下・左下。0〜1の割合） */
async function qz2ImgWarp(dataUrl, quad, quality){
  var img = await qz2Load(dataUrl);
  var sx = function(p){ return p[0] * img.width; }, sy = function(p){ return p[1] * img.height; };
  var W = img.width, H = img.height;
  var cv = qz2Canvas(W, H), ctx = cv.getContext('2d');
  var N = 14;                                            /* 細かく分けて、少しずつ貼る */
  var at = function(u, v){                               /* 四すみのあいだを、たての横のわりあいでとる */
    var top = [quad[0][0] + (quad[1][0] - quad[0][0]) * u, quad[0][1] + (quad[1][1] - quad[0][1]) * u];
    var bot = [quad[3][0] + (quad[2][0] - quad[3][0]) * u, quad[3][1] + (quad[2][1] - quad[3][1]) * u];
    return [(top[0] + (bot[0] - top[0]) * v) * W, (top[1] + (bot[1] - top[1]) * v) * H];
  };
  var tri = function(s0, s1, s2, d0, d1, d2){
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(d0[0], d0[1]); ctx.lineTo(d1[0], d1[1]); ctx.lineTo(d2[0], d2[1]); ctx.closePath();
    ctx.clip();
    var den = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
    if(Math.abs(den) > 1e-6){
      var a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / den;
      var b = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / den;
      var c = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / den;
      var e = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / den;
      ctx.setTransform(a, c, b, e, d0[0] - a * s0[0] - b * s0[1], d0[1] - c * s0[0] - e * s0[1]);
      ctx.drawImage(img, 0, 0);
    }
    ctx.restore();
  };
  for(var i = 0; i < N; i++){
    for(var j = 0; j < N; j++){
      var u0 = i / N, u1 = (i + 1) / N, v0 = j / N, v1 = (j + 1) / N;
      var s00 = at(u0, v0), s10 = at(u1, v0), s11 = at(u1, v1), s01 = at(u0, v1);
      var d00 = [u0 * W, v0 * H], d10 = [u1 * W, v0 * H], d11 = [u1 * W, v1 * H], d01 = [u0 * W, v1 * H];
      tri(s00, s10, s01, d00, d10, d01);
      tri(s10, s11, s01, d10, d11, d01);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return cv.toDataURL('image/jpeg', quality || 0.82);
}
/* ピンボケ・手ぶれのめやす（#22）… となりの点との差が小さいほど、ぼけている */
async function qz2ImgSharp(dataUrl){
  var img = await qz2Load(dataUrl);
  var w = 320, h = Math.max(1, Math.round(img.height * w / img.width));
  var cv = qz2Canvas(w, h), ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  var d;
  try{ d = ctx.getImageData(0, 0, w, h).data; }catch(e){ return 999; }
  var g = new Float32Array(w * h);
  for(var p = 0, q = 0; p < d.length; p += 4, q++) g[q] = (d[p] * 299 + d[p + 1] * 587 + d[p + 2] * 114) / 1000;
  var sum = 0, sum2 = 0, n = 0;
  for(var y = 1; y < h - 1; y++){
    for(var x = 1; x < w - 1; x++){
      var i2 = y * w + x;
      var lap = 4 * g[i2] - g[i2 - 1] - g[i2 + 1] - g[i2 - w] - g[i2 + w];
      sum += lap; sum2 += lap * lap; n++;
    }
  }
  if(!n) return 999;
  var mean = sum / n;
  return Math.round(sum2 / n - mean * mean);            /* 100より小さいと、ぼけていることが多い */
}
/* 写真の撮影日（EXIF の DateTimeOriginal）を読む（#17） */
function qz2ExifDate(file){
  return new Promise(function(res){
    var r = new FileReader();
    r.onerror = function(){ res(''); };
    r.onload = function(){
      try{
        var v = new DataView(r.result);
        if(v.byteLength < 8 || v.getUint16(0) !== 0xFFD8){ res(''); return; }
        var p = 2;
        while(p + 4 < v.byteLength){
          var mark = v.getUint16(p);
          if((mark & 0xFF00) !== 0xFF00) break;
          var len = v.getUint16(p + 2);
          if(mark === 0xFFE1){
            var s = p + 4;
            if(v.getUint32(s) === 0x45786966){          /* 'Exif' */
              var tiff = s + 6;
              var le = v.getUint16(tiff) === 0x4949;
              var ifd = tiff + v.getUint32(tiff + 4, le);
              var found = qz2ExifWalk(v, tiff, ifd, le, 0);
              res(found);
              return;
            }
          }
          p += 2 + len;
        }
        res('');
      }catch(e){ res(''); }
    };
    r.readAsArrayBuffer(file.slice(0, 256 * 1024));
  });
}
function qz2ExifWalk(v, tiff, ifd, le, depth){
  if(depth > 2 || ifd + 2 > v.byteLength) return '';
  var n = v.getUint16(ifd, le), out = '';
  for(var i = 0; i < n; i++){
    var e = ifd + 2 + i * 12;
    if(e + 12 > v.byteLength) break;
    var tag = v.getUint16(e, le), type = v.getUint16(e + 2, le), cnt = v.getUint32(e + 4, le);
    if(tag === 0x8769){                                  /* Exif IFD へ */
      var sub = tiff + v.getUint32(e + 8, le);
      var got = qz2ExifWalk(v, tiff, sub, le, depth + 1);
      if(got) return got;
    }
    if((tag === 0x9003 || tag === 0x0132) && type === 2 && cnt >= 19){
      var off = tiff + v.getUint32(e + 8, le), s = '';
      for(var k = 0; k < 19 && off + k < v.byteLength; k++) s += String.fromCharCode(v.getUint8(off + k));
      var m = s.match(/^(\d{4}):(\d{2}):(\d{2})/);
      if(m) out = m[1] + '-' + m[2] + '-' + m[3];
      if(tag === 0x9003 && out) return out;
    }
  }
  return out;
}

/* ============================== 模擬テスト（#124・#125） ==============================
   まとめて解いて、最後に点数を出す。結果は残して、前の回とくらべる。 */
function qz2Mocs(){
  return (S.kmItems || []).filter(function(x){ return x && x.mod === 'quiz' && x.type === 'moc'; })
    .sort(function(a, b){ return toNum(b.mt) - toNum(a.mt); });
}
function qz2MocStart(){
  var sub = qz2State.mocSub, n = qz2State.mocN, min = qz2State.mocMin;
  var pool = (sub === 'field'
    ? qz2FieldPool(qz2State.mocField)
    : qzQs(sub === 'all' ? '' : sub)).slice();
  if(pool.length < 3){ toast('問題が足りません（3問以上必要です）', true); return false; }
  qz2Shuffle(pool);
  var ids = pool.slice(0, Math.min(n, pool.length)).map(function(x){ return x.id; });
  appId = 'study'; studyTool = 'qz-drill';
  qzRunSet(ids, sub === 'all' || sub === 'field' ? '' : sub, 'all',
    { moc:{ min:min, at:Date.now(), sub:sub, field:qz2State.mocField || '' }, ans:{} });
  return true;
}
/* 国試の分野でまとめて出す（#127） */
function qz2FieldPool(field){
  if(!field) return qzQs('');
  var subs = qzSubs().filter(function(s){ return (s.field || (typeof qz2FieldOf === 'function' ? qz2FieldOf(s.name) : '')) === field; });
  var ids = {};
  subs.forEach(function(s){ ids[s.id] = 1; });
  return qzQs('').filter(function(x){ return ids[x.sub]; });
}
function qz2MocSave(r){
  var by = {}, n = 0, ok = 0;
  (r.ids || []).forEach(function(id){
    var q = qzItem(id);
    if(!q) return;
    var res = (r.ans || {})[id];
    if(res == null) return;
    var k = q.sub || '';
    by[k] = by[k] || { n:0, ok:0 };
    by[k].n++; n++;
    if(res){ by[k].ok++; ok++; }
  });
  var rec = { id:uid('qzmo'), mt:Date.now(), mod:'quiz', type:'moc', at:today(),
    sub:(r.moc && r.moc.sub) || '', field:(r.moc && r.moc.field) || '',
    n:n, ok:ok, all:(r.ids || []).length, min:(r.moc && r.moc.min) || 0,
    sec:Math.round((Date.now() - toNum(r.moc && r.moc.at)) / 1000), by:by, timeup:r.timeup ? 1 : 0 };
  if(!Array.isArray(S.kmItems)) S.kmItems = [];
  S.kmItems.push(rec);
  touch('kmItems');
  persist();
  if(typeof pushRemote === 'function') pushRemote();       /* ここで render は呼ばない（画面を作っている途中のため） */
  return rec;
}
function qz2MocEndHtml(r){
  if(!r.saved && !r.saving){
    r.saving = 1;
    try{ r.saved = qz2MocSave(r); }
    finally{ r.saving = 0; }
  }
  if(!r.saved) return section('模擬テストの結果', null, '<div class="empty">記録できませんでした。</div>');
  var rec = r.saved, rate = rec.n ? Math.round(rec.ok * 100 / rec.n) : 0;
  var prev = qz2Mocs().filter(function(x){ return x.id !== rec.id && x.sub === rec.sub; })[0];
  var diff = '';
  if(prev && prev.n){
    var d = rate - Math.round(prev.ok * 100 / prev.n);
    diff = '前の回（' + qzMd(prev.at) + '・' + Math.round(prev.ok * 100 / prev.n) + '%）より ' +
      (d > 0 ? '＋' + d : d) + 'ポイント';
  }
  var wrong = (r.wrong || []).map(function(id){ return qzItem(id); }).filter(Boolean);
  return section('模擬テストの結果', rec.n + '問',
    '<div class="qz-score"><b>' + rate + '</b><span>点（' + rec.ok + ' / ' + rec.n + '問）</span></div>' +
    (rec.timeup ? '<div class="qz-ask">⏱ 時間切れでおわりました（' + (rec.all - rec.n) + '問のこり）</div>' : '') +
    (diff ? '<div class="qz-res ' + (/＋/.test(diff) ? 'ok' : '') + '">' + esc(diff) + '</div>' : '') +
    '<div class="stats" style="margin-top:8px">' +
      qzStat('かかった時間', Math.floor(rec.sec / 60) + '分' + (rec.sec % 60) + '秒') +
      qzStat('1問あたり', rec.n ? Math.round(rec.sec / rec.n) + '秒' : '—') +
      qzStat('まちがい', (rec.n - rec.ok) + '問') + '</div>' +
    (Object.keys(rec.by).length > 1
      ? '<label class="f" style="margin-top:10px">科目ごと</label>' + Object.keys(rec.by).map(function(k){
          var b = rec.by[k];
          return '<div class="row"><div class="grow"><div class="t">' + esc(qzSubName(k)) + '</div>' +
            '<div class="s">' + b.ok + ' / ' + b.n + '問（' + Math.round(b.ok * 100 / b.n) + '%）</div></div></div>';
        }).join('')
      : '') +
    (wrong.length
      ? '<label class="f" style="margin-top:10px">まちがえた問題</label>' + wrong.slice(0, 20).map(function(q){
          return '<div class="row qz-wrow"><div class="grow"><div class="t">' + esc(q.q) + '</div>' +
            '<div class="s">答え：' + esc(qzAnswerText(q)) + '</div></div>' +
            '<button class="mini' + (q.star ? ' on' : '') + '" data-act="qz-star" data-id="' + esc(q.id) + '">' + (q.star ? '★' : '☆') + '</button></div>';
        }).join('')
      : '<div class="qz-res ok" style="margin-top:10px">ぜんぶ正かいです！</div>') +
    '<div class="pair" style="margin-top:12px">' +
      (wrong.length ? '<button class="btn" data-act="qz-again-wrong">まちがえた' + wrong.length + '問をやり直す</button>' : '') +
      '<button class="btn ghost" data-act="qz-quit">おわる</button></div>');
}
function qz2MocView(){
  if(qzState.run) return qzState.run.end ? qz2MocEndHtml(qzState.run) : qzQView(qzState.run);
  var subs = qzSubs(), mocs = qz2Mocs();
  var total = qzQs('').length;
  var fields = (typeof KQ_FIELDS !== 'undefined' ? KQ_FIELDS : []).filter(function(f){ return qz2FieldPool(f[0]).length >= 3; });
  var h = section('模擬テスト', total + '問から出します',
    '<label class="f">どこから出す？</label>' +
    '<div class="chips qz-chips">' +
      '<button data-act="qz2-mocsub" data-v="all" class="' + (qz2State.mocSub === 'all' ? 'on' : '') + '">ぜんぶ（' + total + '問）</button>' +
      subs.map(function(s){
        return '<button data-act="qz2-mocsub" data-v="' + esc(s.id) + '" class="' + (qz2State.mocSub === s.id ? 'on' : '') + '">' +
          esc(s.icon + ' ' + s.name) + '（' + qzQs(s.id).length + '）</button>';
      }).join('') +
      (fields.length ? '<button data-act="qz2-mocsub" data-v="field" class="' + (qz2State.mocSub === 'field' ? 'on' : '') + '">国試の分野で</button>' : '') +
    '</div>' +
    (qz2State.mocSub === 'field'
      ? '<label class="f" style="margin-top:8px">分野</label><div class="chips qz-chips">' + fields.map(function(f){
          return '<button data-act="qz2-mocfield" data-v="' + f[0] + '" class="' + (qz2State.mocField === f[0] ? 'on' : '') + '">' +
            esc(f[1]) + '（' + qz2FieldPool(f[0]).length + '）</button>';
        }).join('') + '</div>'
      : '') +
    '<label class="f" style="margin-top:10px">問題の数</label>' +
    '<div class="pillrow">' + [20, 50, 100].map(function(n){
      return '<button data-act="qz2-mocn" data-v="' + n + '" class="' + (qz2State.mocN === n ? 'on' : '') + '">' + n + '問</button>';
    }).join('') + '</div>' +
    '<label class="f" style="margin-top:10px">時間</label>' +
    '<div class="pillrow">' + [0, 20, 30, 50, 90].map(function(m){
      return '<button data-act="qz2-mocmin" data-v="' + m + '" class="' + (qz2State.mocMin === m ? 'on' : '') + '">' + (m ? m + '分' : '時間なし') + '</button>';
    }).join('') + '</div>' +
    '<button class="btn" style="margin-top:12px" data-act="qz2-mocgo">はじめる</button>' +
    '<p class="note">1問ずつの答え合わせは出ません。最後にまとめて点数が出ます。まちがえた問題は、あとで復習に出ます。</p>');
  if(mocs.length){
    h += section('これまでの結果', mocs.length + '回',
      mocs.slice(0, 10).map(function(m){
        var rate = m.n ? Math.round(m.ok * 100 / m.n) : 0;
        return '<div class="row"><div class="grow"><div class="t">' + rate + '点（' + m.ok + '/' + m.n + '問）' +
          (m.sub && m.sub !== 'all' && m.sub !== 'field' ? '　' + esc(qzSubName(m.sub)) : m.field ? '　' + esc(qz2FieldName(m.field)) : '') + '</div>' +
          '<div class="s">' + esc(qzMd(m.at)) + '・' + Math.floor(toNum(m.sec) / 60) + '分' + (m.timeup ? '・時間切れ' : '') + '</div></div>' +
          '<button class="mini" data-act="qz2-mocdel" data-id="' + esc(m.id) + '" aria-label="消す">✕</button></div>';
      }).join('') +
      (mocs.length > 1 ? '<p class="note">いちばん上が新しい回です。同じ「どこから出す？」の回とくらべます。</p>' : ''));
  }
  return h;
}

/* ============================== にが手ノート（#77） ==============================
   まちがえた問題だけを集めて、答えと解説をならべる。印刷・書き出しもできる。 */
function qz2WeakList(sub){
  var list = qzQs(sub === 'all' ? '' : sub).map(function(x){
    var l = qzLogOf(x.id) || {};
    return { q:x, miss:toNum(l.miss), n:toNum(l.n), ok:toNum(l.ok), res:l.res, last:l.last || '' };
  }).filter(function(o){ return o.miss > 0 || o.res === 0; });
  return list.sort(function(a, b){
    return (b.miss - a.miss) || (String(b.last).localeCompare(String(a.last)));
  });
}
function qz2WeakView(){
  var sub = qz2State.weakSub || 'all';
  var subs = qzSubs(), list = qz2WeakList(sub);
  var h = section('どの科目？', null,
    '<div class="chips qz-chips"><button data-act="qz2-weaksub" data-v="all" class="' + (sub === 'all' ? 'on' : '') + '">すべて</button>' +
    subs.map(function(s){
      return '<button data-act="qz2-weaksub" data-v="' + esc(s.id) + '" class="' + (sub === s.id ? 'on' : '') + '">' +
        esc(s.icon + ' ' + s.name) + '（' + qz2WeakList(s.id).length + '）</button>';
    }).join('') + '</div>');
  if(!list.length){
    return h + section('にが手ノート', null, '<div class="empty">まちがえた問題はありません。よくできています！</div>');
  }
  h += section('にが手ノート', list.length + '問',
    '<div class="pair"><button class="btn" data-act="qz2-weakdrill">この' + Math.min(list.length, 20) + '問を解く</button>' +
      '<button class="btn ghost" data-act="qz2-weakout" style="flex:0 0 auto">書き出す</button></div>' +
    list.slice(0, 60).map(function(o){
      var x = o.q, why = (typeof qzWhyOf === 'function') ? qzWhyOf(x.id) : null;
      return '<div class="qz-weak">' +
        '<div class="qz-badges"><span class="qz-b">' + esc(qzTypeName(x.qt)) + '</span>' +
          '<span class="qz-b sub">' + esc(qzSubName(x.sub)) + '</span>' +
          (x.ch ? '<span class="qz-b sub">' + esc(x.ch) + '</span>' : '') +
          '<span class="qz-b sub">まちがえ ' + o.miss + '回</span>' +
          '<button class="qz-star' + (x.star ? ' on' : '') + '" data-act="qz-star" data-id="' + esc(x.id) + '">' + (x.star ? '★' : '☆') + '</button></div>' +
        '<div class="t">' + esc(x.q) + '</div>' +
        '<div class="qz-weakans">答え：<b>' + esc(qzAnswerText(x)) + '</b></div>' +
        (x.exp ? '<div class="s">' + esc(x.exp) + '</div>' : '') +
        (why ? '<div class="s qz-weakwhy">なぜ？：' + esc(why.text) + '</div>'
             : '<button class="mini" data-act="qz-why" data-id="' + esc(x.id) + '">❓ なぜまちがい？をしらべる</button>') +
        '</div>';
    }).join('') +
    (list.length > 60 ? '<p class="note">多いので、まちがえた回数の多い60問だけ出しています。</p>' : ''));
  return h;
}
function qz2WeakOut(){
  var sub = qz2State.weakSub || 'all', list = qz2WeakList(sub);
  if(!list.length){ toast('書き出すものがありません', true); return; }
  var lines = ['にが手ノート（' + (sub === 'all' ? 'すべての科目' : qzSubName(sub)) + '）　' + today(), ''];
  list.forEach(function(o, i){
    var x = o.q, why = (typeof qzWhyOf === 'function') ? qzWhyOf(x.id) : null;
    lines.push((i + 1) + '. [' + qzSubName(x.sub) + (x.ch ? '／' + x.ch : '') + '] ' + x.q);
    lines.push('　答え：' + qzAnswerText(x));
    if(x.exp) lines.push('　解説：' + x.exp);
    if(why) lines.push('　なぜ？：' + why.text);
    lines.push('　まちがえた回数：' + o.miss + '回');
    lines.push('');
  });
  download(new Blob(['﻿' + lines.join('\n')], { type:'text/plain;charset=utf-8' }), 'nigate-' + today() + '.txt');
  toast(list.length + '問を書き出しました');
}

/* ============================== 操作・登録（模擬テスト・にが手ノート） ============================== */
kmAction(function(act, t){
  if(act.indexOf('qz2-') !== 0) return false;
  var v = t.dataset.v || '', id = t.dataset.id || '';
  if(act === 'qz2-mocsub'){ qz2State.mocSub = v; render(); return true; }
  if(act === 'qz2-mocfield'){ qz2State.mocField = v; render(); return true; }
  if(act === 'qz2-mocn'){ qz2State.mocN = toNum(v) || 50; render(); return true; }
  if(act === 'qz2-mocmin'){ qz2State.mocMin = toNum(v); render(); return true; }
  if(act === 'qz2-mocgo'){ qz2MocStart(); return true; }
  if(act === 'qz2-mocdel'){
    var rec = (S.kmItems || []).filter(function(x){ return x.id === id; })[0];
    if(rec){ removeItem('kmItems', id); commit(); toast('結果を消しました'); }
    return true;
  }
  if(act === 'qz2-weaksub'){ qz2State.weakSub = v; render(); return true; }
  if(act === 'qz2-weakout'){ qz2WeakOut(); return true; }
  if(act === 'qz2-weakdrill'){
    var list = qz2WeakList(qz2State.weakSub || 'all');
    if(!list.length){ toast('まちがえた問題がありません', true); return true; }
    appId = 'study'; studyTool = 'qz-drill';
    qzRunSet(list.slice(0, 20).map(function(o){ return o.q.id; }), '', 'wrong');
    return true;
  }
  return false;
});
kmStudy({ id:'qz-moc', icon:'📝', title:'模擬テスト', desc:'まとめて解いて、点数と前回との差を出します', order:9,
  view:qz2MocView, badge:function(){ var m = qz2Mocs()[0]; return m && m.n ? Math.round(m.ok * 100 / m.n) + '点' : ''; } });
kmStudy({ id:'qz-weak', icon:'❌', title:'にが手ノート', desc:'まちがえた問題だけを集めます', order:10,
  view:qz2WeakView, badge:function(){ var n = qz2WeakList('all').length; return n ? n + '問' : ''; } });

/* まとめ（ウィジェット・Discordのボットが出す問題：#170） */
kmSummary(function(s){
  var pool = qzPool('', 'due').concat(qzPool('', 'new')).filter(function(x){ return x.qt === 'mc' || x.qt === 'tf'; });
  if(!pool.length) pool = qzQs('').filter(function(x){ return x.qt === 'mc' || x.qt === 'tf'; });
  if(!pool.length) return;
  s.quizAsk = qz2Pick(pool, 5).map(function(x){
    return { id:x.id, subject:qzSubName(x.sub), q:String(x.q).slice(0, 200),
      choices:(x.c || []).map(function(c){ return String(c).slice(0, 80); }),
      answer:(x.a || []).map(function(i){ return i + 1; }),
      exp:String(x.exp || '').slice(0, 200) };
  });
});
