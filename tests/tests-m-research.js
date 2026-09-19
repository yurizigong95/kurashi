/* くらしの手帳：勉強②（看護過程・レポート・論文・本・翻訳・法令・講義の録音） のテスト（KT.test で足す） */
(function(){
'use strict';
var ok = KT.ok, eq = KT.eq, J = KT.J;

/* ============ 道具 ============ */
function typeIn(w, id, v){
  var el = w.document.getElementById(id);
  ok(el, '入力欄がある：' + id);
  el.value = v;
  el.dispatchEvent(new w.Event('input', { bubbles:true }));
  return el;
}
function pickIn(w, id, v){
  var el = w.document.getElementById(id);
  ok(el, '選ぶ欄がある：' + id);
  el.value = v;
  el.dispatchEvent(new w.Event('change', { bubbles:true }));
  return el;
}
function btn(w, act, more){
  var b = w.document.querySelector('[data-act="' + act + '"]' + (more || ''));
  ok(b, 'ボタンがある：' + act + (more || ''));
  return b;
}
function press(w, act, more){ btn(w, act, more).click(); }
function openTool(w, id){ w.appId = 'study'; w.studyTool = id; w.render(); }
function appText(w){ return w.document.getElementById('app').textContent; }
function calls(tag){ return KT.aiCalls.filter(function(r){ return r.tag === tag; }); }
function sentText(req){ return (req.contents || []).map(function(c){ return (c.parts || []).map(function(p){ return p.text || ''; }).join(''); }).join('\n'); }
var urls = [];

/* ============ にせAI ============ */
KT.ai.push(function(req){
  if(req.tag === 'rs-coach') return JSON.stringify({ good:['S情報とO情報が分けられています'], hints:['眠れない理由を、痛み・環境・不安の3つの面から見てみましょう'],
    questions:['夜に眠れないのは、いつからでしょう？'], missing:['昼間の過ごし方'] });
  if(req.tag === 'rs-proof') return JSON.stringify({ overall:'事例がわかりやすいです。根拠をもう少し。', items:[
    { kind:'誤字・脱字', from:'おこなた', to:'おこなった', why:'「っ」がぬけています', replace:true },
    { kind:'根拠', from:'痛みを訴えていた', to:'痛みの強さ（NRSなど）を書くと根拠になります', why:'数字があると伝わる', replace:false },
    { kind:'言い回し', from:'事例について述べる', to:'＊＊さんの事例をのべる', why:'かくした文字が入った直し', replace:true } ] });
  if(req.tag === 'rs-kw') return JSON.stringify({ query:'rstest pressure ulcer AND prevention', words:[{ ja:'褥瘡', en:'pressure ulcer' }, { ja:'予防', en:'prevention' }] });
  if(req.tag === 'rs-easy') return JSON.stringify({ title_ja:'股関節骨折の手術を受けた人の褥瘡のリスク', ja:'手術のあとは長く横になるので、褥瘡（とこずれ）ができやすくなります。',
    points:['手術の時間が長いと危ない', '栄養が足りないと危ない', '早めに体の向きを変える'],
    words:[{ en:'pressure injury', ja:'褥瘡・圧迫創傷', note:'' }, { en:'risk factor', ja:'危険因子', note:'' }, { en:'hip fracture', ja:'股関節骨折', note:'大腿骨頸部骨折など' }] });
  if(req.tag === 'rs-tr') return '褥瘡を予防する';
  if(req.tag === 'rs-isbn') return JSON.stringify({ isbn:'978-4-260-03176-9' });
  if(req.tag === 'rs-lec-stt'){
    var t = sentText(req);
    return /1つ目/.test(t) ? '今日はバイタルサインについて話します。' : '体温は36度から37度くらいが目安です。';
  }
  if(req.tag === 'rs-lec-sum') return JSON.stringify({ title:'バイタルサイン', summary:'バイタルサインの意味と、はかり方を学んだ。',
    points:['体温・脈拍・呼吸・血圧をはかる'], test:['成人の体温の目安'], words:[{ w:'バイタルサイン', m:'生きているしるし' }] });
  return null;
});

/* ============ にせAPI（本物のネットにはつながない） ============ */
var JSTAGE_XML = '<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:prism="http://prismstandard.org/namespaces/basic/2.0/" ' +
  'xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/"><result><status>0</status><message/></result><opensearch:totalResults>528</opensearch:totalResults>' +
  '<entry><article_title><en><![CDATA[Physical Therapists and Pressure Injury]]></en><ja><![CDATA[褥瘡ケアで<i>理学療法士</i>だからできること]]></ja></article_title>' +
  '<article_link><en>https://www.jstage.jst.go.jp/article/cjpt/44S1/0/44S1_47/_article</en><ja>https://www.jstage.jst.go.jp/article/cjpt/44S1/0/44S1_47/_article/-char/ja/</ja></article_link>' +
  '<author><en><name><![CDATA[Yoshiyuki Yoshikawa]]></name></en><ja><name><![CDATA[吉川 義之]]></name></ja></author>' +
  '<material_title><en><![CDATA[Congress of the JPTA]]></en><ja><![CDATA[理学療法学Supplement]]></ja></material_title>' +
  '<prism:volume>44S1</prism:volume><prism:number>0</prism:number><prism:startingPage>47</prism:startingPage><prism:endingPage>51</prism:endingPage>' +
  '<pubyear>2017</pubyear><prism:doi>10.14900/cjpt.44S1.47</prism:doi><title><![CDATA[褥瘡ケアで理学療法士だからできること]]></title></entry></feed>';
var NDL_XML = '<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:openSearch="http://a9.com/-/spec/opensearchrss/1.0/" xmlns:dcndl="http://ndl.go.jp/dcndl/terms/" ' +
  'xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="2.0"><channel><title>基礎看護技術 books</title>' +
  '<openSearch:totalResults>247</openSearch:totalResults><item><title>イラストでわかる基礎看護技術 : ひとりで学べる方法とポイント</title>' +
  '<link>https://ndlsearch.ndl.go.jp/books/R100000002-I000004220608</link><dc:title>イラストでわかる基礎看護技術</dc:title>' +
  '<dc:creator>石井, 範子</dc:creator><dc:creator>阿部, テル子, 1943-</dc:creator><dcndl:creatorTranscription>イシイ, ノリコ</dcndl:creatorTranscription>' +
  '<dc:publisher>日本看護協会出版会</dc:publisher><dc:date xsi:type="dcterms:W3CDTF">2002</dc:date><dcndl:price>3600円</dcndl:price>' +
  '<dc:identifier xsi:type="dcndl:ISBN">4-8180-0941-5</dc:identifier><dc:identifier xsi:type="dcndl:NDLBibID">000004220608</dc:identifier></item></channel></rss>';
var EFETCH_XML = '<?xml version="1.0" ?><PubmedArticleSet><PubmedArticle><MedlineCitation><Article><Abstract>' +
  '<AbstractText Label="BACKGROUND">Pressure injuries are common after hip fracture surgery.</AbstractText>' +
  '<AbstractText Label="CONCLUSION">Early repositioning helps.</AbstractText></Abstract></Article>' +
  '<OtherAbstract Type="Publisher" Language="jpn"><AbstractText>rstestほかの言葉の要旨</AbstractText></OtherAbstract></MedlineCitation></PubmedArticle></PubmedArticleSet>';
function node(tag, kids, attr){ return { tag:tag, attr:attr || {}, children:kids || [] }; }
function sentence(t){ return node('Sentence', [t]); }
var LAW_JSON = { law_info:{ law_id:'323AC0000000203', law_num:'昭和二十三年法律第二百三号' }, revision_info:{ law_title:'保健師助産師看護師法' },
  law_full_text:node('Law', [node('LawNum', ['昭和二十三年法律第二百三号']), node('LawBody', [
    node('LawTitle', ['保健師助産師看護師法']),
    node('TOC', [node('TOCLabel', ['目次'])]),
    node('MainProvision', [
      node('Chapter', [node('ChapterTitle', ['第一章　総則']),
        node('Article', [node('ArticleTitle', ['第五条']), node('Paragraph', [node('ParagraphNum'), node('ParagraphSentence', [sentence('この法律において「看護師」とは、療養上の世話又は診療の補助を行うことを業とする者をいう。')])], { Num:'1' })], { Num:'5' })
      ], { Num:'1' }),
      node('Chapter', [node('ChapterTitle', ['第四章　業務']),
        node('Article', [node('ArticleTitle', ['第三十一条']),
          node('Paragraph', [node('ParagraphNum'), node('ParagraphSentence', [sentence('看護師でない者は、第五条に規定する業をしてはならない。'), sentence('ただし、医師法の規定に基づいて行う場合は、この限りでない。')])], { Num:'1' }),
          node('Paragraph', [node('ParagraphNum', ['２']), node('ParagraphSentence', [sentence('保健師及び助産師は、前項の規定にかかわらず、第五条に規定する業を行うことができる。')])], { Num:'2' })
        ], { Num:'31' }),
        node('Article', [node('ArticleCaption', ['（秘密を守る義務）']), node('ArticleTitle', ['第四十二条の二']),
          node('Paragraph', [node('ParagraphNum'), node('ParagraphSentence', [sentence('保健師、看護師又は准看護師は、正当な理由がなく、その業務上知り得た人の秘密を漏らしてはならない。')]),
            node('Item', [node('ItemTitle', ['一']), node('ItemSentence', [sentence('テストの号の文')])], { Num:'1' })], { Num:'1' })
        ], { Num:'42_2' })
      ], { Num:'4' })
    ]),
    node('SupplProvision', [node('Article', [node('ArticleTitle', ['附則第一条']), node('Paragraph', [node('ParagraphSentence', [sentence('附則の文')])])], { Num:'1' })])
  ])]) };
KT.api.push(function(url){
  var u = String(url);
  if(!/rstest|99000001|9784260031769|9784567890120|323AC0000000203/.test(u)) return null;
  urls.push(u);
  if(/esearch\.fcgi.*rstestmany/.test(u)) return { esearchresult:{ count:'45', idlist:['99000001', '99000002'] } };
  if(/eutils\.ncbi\.nlm\.nih\.gov\/entrez\/eutils\/esearch\.fcgi/.test(u)) return { esearchresult:{ count:'2', idlist:['99000001', '99000002'] } };
  if(/esummary\.fcgi/.test(u)) return { result:{ uids:['99000001', '99000002'],
    '99000001':{ uid:'99000001', title:'Risk Factors Associated With Hospital-Acquired Pressure Injuries.', pubdate:'2026 Sep-Oct 01', source:'J Wound Ostomy Continence Nurs',
      authors:[{ name:'Zhao Y' }, { name:'Alderden J' }], volume:'53', issue:'5', pages:'369-375', articleids:[{ idtype:'doi', value:'10.1097/WON.1' }], attributes:['Has Abstract'] },
    '99000002':{ uid:'99000002', title:'Challenges in Offloading Lesser Toe Deformities.', pubdate:'2026', source:'J Wound Ostomy Continence Nurs', authors:[{ name:'Gregor SR' }],
      volume:'53', issue:'5', pages:'435-438', articleids:[], attributes:[] } } };
  if(/efetch\.fcgi/.test(u)) return EFETCH_XML;
  if(/api\.jstage\.jst\.go\.jp\/searchapi\/do/.test(u)) return JSTAGE_XML;
  if(/cir\.nii\.ac\.jp\/opensearch\/articles/.test(u)) return { 'opensearch:totalResults':2449, items:[
    { '@id':'https://cir.nii.ac.jp/crid/1050282812521198592', title:'平成24年度委員会活動報告', link:{ '@id':'https://cir.nii.ac.jp/crid/1050282812521198592' },
      'dc:creator':['看護部褥瘡対策委員会'], 'dc:publisher':'名古屋市立大学病院', 'dc:type':'Article', 'prism:publicationName':'看護研究集録', 'prism:volume':'2012',
      'prism:startingPage':'36', 'prism:endingPage':'36', 'prism:publicationDate':'2015-03' } ] };
  if(/ndlsearch\.ndl\.go\.jp\/api\/opensearch/.test(u)) return NDL_XML;
  if(/api\.openbd\.jp.*9784260031769/.test(u)) return [{ onix:{ ProductSupply:{ SupplyDetail:{ Price:[{ PriceAmount:'1800' }] } } },
    summary:{ isbn:'9784260031769', title:'新看護学 1', volume:'', publisher:'医学書院', pubdate:'201803', cover:'', author:'小林,靖 幸田,和久,pub.2018' } }];
  if(/api\.openbd\.jp.*9784567890120/.test(u)) return [null];
  if(/googleapis\.com\/books.*9784567890120/.test(u)) return { totalItems:1, items:[{ volumeInfo:{ title:'看護のための英語', authors:['Tanaka H'], publisher:'テスト出版', publishedDate:'2024-04',
    imageLinks:{ thumbnail:'http://books.google.com/x.jpg' } } }] };
  if(/laws\.e-gov\.go\.jp\/api\/2\/law_data\/323AC0000000203/.test(u)) return LAW_JSON;
  if(/laws\.e-gov\.go\.jp\/api\/2\/laws\?/.test(u)) return { total_count:2, laws:[
    { law_info:{ law_id:'323AC0000000205X', law_type:'MinisterialOrdinance', law_num:'昭和二十三年厚生省令第五十号' }, current_revision_info:{ law_title:'rstest医療法施行規則' } },
    { law_info:{ law_id:'323AC0000000205', law_type:'Act', law_num:'昭和二十三年法律第二百五号' }, current_revision_info:{ law_title:'rstest医療法', abbrev:null } } ] };
  if(/laws\.e-gov\.go\.jp\/api\/2\/keyword/.test(u)) return { total_count:1, items:[{ law_info:{ law_id:'322AC0000000164', law_num:'昭和二十二年法律第百六十四号' },
    revision_info:{ law_title:'児童福祉法' }, sentences:[{ position:'mainprovision', text:'その他の<span>守秘義務</span>に関する法律の規定は…' }] }] };
  return null;
});

/* ============ にせ橋わたし ============ */
var deeplKeys = [];
KT.gas.push(function(req){
  if(req.action === 'deeplKeySet'){ deeplKeys.push(req.key); return { ok:true, deepl:!!req.key }; }
  if(req.action === 'translate') return { ok:true, text:'（DeepL）' + (req.target === 'EN' ? 'prevent pressure injury' : '褥瘡の予防'), from:'EN' };
  return null;
});
function bridgeOn(A){ A.GAS.url = 'https://script.google.com/macros/s/test/exec'; A.GAS.token = 'tok'; A.GAS.ver = 3; A.saveGas(); KT.gasState.ver = 3; }
function bridgeOff(A){ A.GAS.url = ''; A.GAS.token = ''; A.GAS.ver = 0; A.saveGas(); KT.gasState.ver = 2; }
/* ほかのテストが橋わたしをつないだままでも、元にもどせるように */
function bridgeSave(A){ return { url:A.GAS.url, token:A.GAS.token, ver:A.GAS.ver, kv:KT.gasState.ver }; }
function bridgeBack(A, s){ A.GAS.url = s.url; A.GAS.token = s.token; A.GAS.ver = s.ver; A.saveGas(); KT.gasState.ver = s.kv; }

/* ============ テスト ============ */
KT.test('勉強②：AIに送る前に、名前・年齢・電話・病院名を＊＊にかくす', async function(){
  var A = KT.frames().A;
  var r = A.rsMask('山田太郎さん（82歳）は、090-1234-5678 に連絡。さくら中央病院の305号室。氏名：佐藤花子。1944年3月2日生まれ。');
  ['山田', '太郎', '82歳', '090-1234', 'さくら中央', '305', '佐藤', '花子', '1944'].forEach(function(w){ ok(r.text.indexOf(w) < 0, '「' + w + '」がかくれていない：' + r.text); });
  ok(r.text.indexOf('80代') >= 0, '年齢は〇〇代にする：' + r.text);
  ok(r.n >= 6, 'かくした数：' + r.n);
  var keep = '患者さんは、お母さんと同様に、たくさん食べた。症状は様々で、長谷川式の点数は20点。85歳以上が多い。近くの病院、大学病院、B病院。A氏。';
  var r2 = A.rsMask(keep);
  eq(r2.text, keep, 'ふつうのことばは、かくさない');
  eq(r2.n, 0, 'かくした数は0');
  ok(A.rsMask('田中先生に相談').text === '＊＊先生に相談', '名字のあとの「先生」は残す');
});

KT.test('勉強②：看護過程を1段ずつ書く→AIコーチ（伏せ字して送る）→保存・相手に届く・続きから・看護計画の枠', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  A.rsSt.np.id = ''; A.rsSt.np.d = null; A.rsSt.np.tab = 'proc'; A.rsSt.np.plId = ''; A.rsSt.np.pl = null;
  openTool(A, 'rs-np');
  ok(appText(A).indexOf('患者さんの名前') >= 0, '個人情報の注意書きが出る');
  typeIn(A, 'rs_np_newTitle', '肺炎のA氏（80代）');
  press(A, 'rs-np-frame', '[data-v="gordon"]');
  press(A, 'rs-np-new');
  var it = A.rsItems('nproc').filter(function(x){ return x.title === '肺炎のA氏（80代）'; })[0];
  ok(it, '看護過程が S.kmItems に入る');
  eq(it.mod, 'research', 'mod は research');
  eq(A.rsSt.np.id, it.id, 'そのまま書く画面になる');
  /* ① 情報収集（はじめの項目＝健康知覚） */
  typeIn(A, 'rs_np_d_info_g1_s', '山田花子さん「夜は痛くて眠れない」');
  typeIn(A, 'rs_np_d_info_g1_o', '夜の睡眠は3時間くらい');
  ok(doc.getElementById('rs_np_state').textContent.indexOf('まだ保存') >= 0, '打つと「まだ保存していません」');
  var n0 = calls('rs-coach').length;
  press(A, 'rs-np-coach');
  await KT.until(function(){ return calls('rs-coach').length > n0 && !A.rsSt.np.busy; }, 8000, 'AIコーチの答え');
  var req = calls('rs-coach')[calls('rs-coach').length - 1], sent = sentText(req);
  ok(sent.indexOf('山田') < 0 && sent.indexOf('花子') < 0, 'AIには名前を送らない：' + sent);
  ok(sent.indexOf('＊＊さん') >= 0, '名前は＊＊にする');
  ok(sent.indexOf('夜の睡眠は3時間') >= 0, 'O情報は送る');
  ok(/答え.*書いてはいけません/.test(req.system), '答えを書かないコーチにする');
  await KT.until(function(){ return doc.querySelector('.rs-coach .rs-list'); }, 4000, 'ヒントの表示');
  ok(appText(A).indexOf('眠れない理由を') >= 0, 'ヒントが出る');
  ok(appText(A).indexOf('いつからでしょう') >= 0, '問いかけが出る');
  it = A.rsItem(it.id);
  eq(it.info.g1.s, '山田花子さん「夜は痛くて眠れない」', '自分が書いた文はそのまま保存（かくすのはAIに送る文だけ）');
  ok(it.coach['info:g1'] && it.coach['info:g1'].hints.length === 1, 'コーチの答えも保存');
  /* ③ 看護問題 → ④ 目標 → ⑤ 計画 */
  press(A, 'rs-np-step', '[data-v="prob"]');
  press(A, 'rs-np-padd');
  typeIn(A, 'rs_np_d_probs_0_text', '痛みに関連した睡眠パターンの混乱');
  typeIn(A, 'rs_np_d_probs_0_why', 'S「眠れない」O 睡眠3時間');
  press(A, 'rs-np-padd');
  typeIn(A, 'rs_np_d_probs_1_text', '転倒のおそれ');
  press(A, 'rs-np-pdown', '[data-i="0"]');
  eq(A.rsSt.np.d.probs[0].text, '転倒のおそれ', '順番を入れかえられる');
  press(A, 'rs-np-pup', '[data-i="1"]');
  eq(A.rsSt.np.d.probs[0].text, '痛みに関連した睡眠パターンの混乱', 'もとにもどせる');
  var pid = A.rsSt.np.d.probs[0].id;
  press(A, 'rs-np-step', '[data-v="goal"]');
  typeIn(A, 'rs_np_d_goals_' + pid.replace(/[^A-Za-z0-9]/g, '_') + '_long', '退院までに夜に眠れる');
  typeIn(A, 'rs_np_d_goals_' + pid.replace(/[^A-Za-z0-9]/g, '_') + '_short', '3日後までに5時間眠れたと話す');
  typeIn(A, 'rs_np_d_goals_' + pid.replace(/[^A-Za-z0-9]/g, '_') + '_date', '2026-09-25');
  press(A, 'rs-np-step', '[data-v="plan"]');
  typeIn(A, 'rs_np_d_plans_' + pid.replace(/[^A-Za-z0-9]/g, '_') + '_op', '睡眠時間・痛みの強さ（NRS）');
  typeIn(A, 'rs_np_d_plans_' + pid.replace(/[^A-Za-z0-9]/g, '_') + '_tp', '眠る前に部屋を暗くする');
  typeIn(A, 'rs_np_d_plans_' + pid.replace(/[^A-Za-z0-9]/g, '_') + '_ep', '痛いときは伝えてよいと話す');
  press(A, 'rs-np-save');
  it = A.rsItem(it.id);
  eq(it.probs.length, 2, '看護問題が保存される');
  eq(it.plans[pid].op, '睡眠時間・痛みの強さ（NRS）', '計画が保存される');
  eq(A.rsNpProgress(A.rsNpFix(A.rsCopy(it))), '4/6段', 'どこまで書いたか');
  /* 印刷の見た目 */
  press(A, 'rs-np-print');
  var pa = doc.getElementById('rs-printarea');
  ok(pa && pa.querySelector('table.rs-ptable') && pa.textContent.indexOf('痛みに関連した') >= 0, '印刷用の表ができる');
  /* 看護計画の枠を作る */
  press(A, 'rs-np-toplan');
  var pl = A.rsItems('nplan').filter(function(x){ return x.from === it.id; })[0];
  ok(pl, '看護計画の枠ができる');
  eq(pl.problem, '#1 痛みに関連した睡眠パターンの混乱', '看護問題');
  eq(pl.shorts[0].date, '2026-09-25', '短期目標の評価日');
  eq(pl.op, '睡眠時間・痛みの強さ（NRS）', 'O-P');
  eq(A.rsSt.np.tab, 'plan', '看護計画の枠の画面になる');
  typeIn(A, 'rs_np_pl_memo', '実習のメモ');
  press(A, 'rs-pl-sadd');
  typeIn(A, 'rs_np_pl_shorts_1_text', '2つ目の短期目標');
  press(A, 'rs-pl-save');
  eq(A.rsItem(pl.id).shorts.length, 2, '短期目標を足せる');
  press(A, 'rs-pl-copy');
  ok(A.rsSt.lastCopy.indexOf('【O-P（観察計画）】') >= 0 && A.rsSt.lastCopy.indexOf('2つ目の短期目標') >= 0, 'コピーの文');
  press(A, 'rs-pl-print');
  ok(doc.getElementById('rs-printarea').textContent.indexOf('E-P（教育計画）') >= 0, '看護計画の印刷');
  /* 相手に届く */
  await KT.settle([A, B]);
  var bi = (B.S.kmItems || []).filter(function(x){ return x.id === it.id; })[0];
  ok(bi && bi.plans[pid] && bi.plans[pid].tp === '眠る前に部屋を暗くする', '相手の端末に看護過程が届く');
  ok((B.S.kmItems || []).some(function(x){ return x.id === pl.id && x.memo === '実習のメモ'; }), '相手に看護計画が届く');
  /* 一覧から続きを開く */
  press(A, 'rs-pl-back');
  press(A, 'rs-np-tab', '[data-v="proc"]');
  press(A, 'rs-np-back');
  ok(appText(A).indexOf('肺炎のA氏（80代）') >= 0, '一覧に出る');
  press(A, 'rs-np-open', '[data-id="' + it.id + '"]');
  eq(doc.getElementById('rs_np_d_info_g1_o').value, '夜の睡眠は3時間くらい', '続きから書ける');
  /* AIで読める・全体検索 */
  var more = A.aiSectionData('more');
  ok(more.rs_nursing && more.rs_nursing.some(function(x){ return x.id === it.id && x.problems.length === 2; }), 'AIの道具で看護過程が読める');
  ok(JSON.stringify(more.data.kmItems).indexOf('眠る前に部屋を暗くする') >= 0, 'kmItems もAIで読める');
  var hits = [];
  A.KM.search.forEach(function(fn){ hits = hits.concat(fn('睡眠パターン') || []); });
  ok(hits.some(function(h){ return h.kind === '看護過程' && h.act === 'rs-open'; }), '全体検索に出る');
  A.rsSt.np.id = ''; A.rsSt.np.d = null;
});

KT.test('勉強②：レポートの文字数・原稿用紙・長い文・です/ますのまざり・構成・課題の目標文字数', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  var st = A.rsReportStats('あいうえおかきくけこさしすせそたちつて', 0);
  eq(st.noWs, 19, '文字数');
  eq(st.rows, 1, '段落のはじめの1マスを入れて20字で1行');
  st = A.rsReportStats('はじめに\n本レポートでは看護について述べる。\nまず事例をのべる。次に考察します。\nおわりに\nこのように看護は大事である。', 100);
  eq(st.paras, 5, '段落の数');
  ok(st.mixed && st.polite === 1, 'です・ますがまざっている');
  ok(st.intro && st.body && st.concl, '序論・本論・結論らしさ');
  A.S.tasks.push(J(A, { id:'tk_rs1', title:'看護学概論レポート', subject:'', due:A.shiftDate(A.today(), 7), time:'', done:0, memo:'', subs:[], photos:[], mt:Date.now() }));
  A.commit();
  A.rsSt.rep.tab = 'count'; A.rsSt.rep.text = ''; A.rsSt.rep.taskId = ''; A.rsSt.rep.target = '';
  openTool(A, 'rs-rep');
  var longS = 'この事例では、患者さんが手術のあとに強い痛みを感じていたために夜に眠ることができず、昼間もうとうとしていて、食事も少ししか食べられず、リハビリにも前向きになれなかったと考えられる。';
  typeIn(A, 'rs_rep_text', 'はじめに\n' + longS + '\n看護師は痛みを聞きました。\nおわりに\nこのように痛みのケアは大事である。');
  var box = doc.getElementById('rs_rep_stats');
  ok(box.textContent.indexOf('長い文が1こ') >= 0, '長すぎる文に印（描き直さずにその場で）');
  ok(box.textContent.indexOf('まざっています') >= 0, 'です・ますのまざりを出す');
  pickIn(A, 'rs_rep_task', 'tk_rs1');
  eq(A.rsSt.rep.taskId, 'tk_rs1', '課題と結びつく');
  typeIn(A, 'rs_rep_target', '400');
  ok(doc.getElementById('rs_rep_stats').textContent.indexOf('目標 400字') >= 0, '目標に対する割合');
  press(A, 'rs-rep-goal');
  eq(A.S.kmData['research:goal:tk_rs1'].n, 400, '目標の文字数を覚える（kmData）');
  /* 選び直すと、覚えた目標が入る */
  pickIn(A, 'rs_rep_task', '');
  typeIn(A, 'rs_rep_target', '');
  pickIn(A, 'rs_rep_task', 'tk_rs1');
  eq(A.rsSt.rep.target, '400', '覚えた目標が入る');
  /* メモから読みこむ */
  A.S.notes.push(J(A, { id:'nt_rs1', title:'下書き', body:'メモの文である。', pinned:0, checks:[], photos:[], link:null, ct:Date.now(), mt:Date.now() }));
  A.commit(); openTool(A, 'rs-rep');
  pickIn(A, 'rs_rep_note', 'nt_rs1');
  eq(A.rsSt.rep.text, 'メモの文である。', 'メモから読みこめる');
  await KT.settle([A, B]);
  ok(B.S.kmData['research:goal:tk_rs1'] && B.S.kmData['research:goal:tk_rs1'].n === 400, '目標の文字数が相手に届く');
  ok(A.aiSectionData('study').rs_device.report.chars > 0, '書いているレポートの数字もAIで読める');
  A.removeItem('tasks', 'tk_rs1'); A.removeItem('notes', 'nt_rs1'); delete A.S.kmData['research:goal:tk_rs1']; A.touch('kmData'); A.commit();
});

KT.test('勉強②：参考文献の要素と形のチェック・引用番号の数・保存した論文と本から書き出す', async function(){
  var A = KT.frames().A, doc = A.document;
  var c = A.rsRefCheck('山田花子，鈴木一郎（2020）：褥瘡予防のケア，日本看護科学会誌，40（2），100-108．', 'jans');
  eq(c.type, 'article', '論文と分かる');
  eq(c.miss.join(','), '', '要素がそろっている');
  ok(c.styleOk, '日本看護科学学会ふうの形');
  c = A.rsRefCheck('山田花子：褥瘡予防のケア', 'jans');
  ok(c.miss.indexOf('year') >= 0, '年がないと印');
  ok(!c.styleOk, '形がちがうと印');
  c = A.rsRefCheck('Smith, J., & Lee, K. (2019). Pressure injury prevention. Journal of Nursing, 12(3), 45–50.', 'apa');
  ok(!c.miss.length && c.styleOk, 'APAの形：' + c.miss.join(','));
  ok(!A.rsRefCheck('Smith, J., & Lee, K. (2019). Pressure injury prevention. Journal of Nursing, 12(3), 45–50.', 'sist').styleOk, 'SIST02 の形ではない');
  c = A.rsRefCheck('厚生労働省（2024）：看護職員の現状，https://www.mhlw.go.jp/example（閲覧日 2026年9月1日）．', 'jans');
  eq(c.type, 'web', 'ウェブと分かる');
  eq(c.miss.join(','), '', 'URLと閲覧日がある');
  c = A.rsRefCheck('医学書院編（2021）：基礎看護技術，医学書院．', 'jans');
  eq(c.type, 'book', '本と分かる');
  eq(c.miss.join(','), '', '本の要素がそろっている');
  var cc = A.rsCiteCheck('褥瘡は多い1)。予防が大事である2,3)。', 'a\nb');
  eq(cc.cited.join(','), '1,2,3', '本文の引用番号');
  eq(cc.over.join(','), '3', '一覧にない番号');
  /* 書き方 */
  var p = { authors:['Zhao Y', 'Alderden J'], title:'Risk Factors.', journal:'J Wound Ostomy Continence Nurs', year:'2026', vol:'53', issue:'5', pages:'369-375', doi:'10.1097/X' };
  eq(A.rsFormatRef(p, 'apa'), 'Zhao, Y., & Alderden, J. (2026). Risk Factors. J Wound Ostomy Continence Nurs, 53(5), 369–375. https://doi.org/10.1097/X', 'APAで書き出す');
  var bk = { title:'基礎看護技術', author:'石井範子・阿部テル子', publisher:'医学書院', year:'2020', status:'持っている' };
  eq(A.rsFormatRef(bk, 'jans'), '石井範子，阿部テル子（2020）：基礎看護技術，医学書院．', '本を日本看護科学学会ふうに');
  eq(A.rsFormatRef(bk, 'sist'), '石井範子; 阿部テル子. 基礎看護技術. 医学書院, 2020.', '本をSIST02に');
  ok(A.rsRefCheck(A.rsFormatRef(bk, 'jans'), 'jans').styleOk, '書き出したものはチェックに通る');
  /* 画面：貼る → 1件ずつ印 */
  A.S.papers.push(J(A, { id:'pp_rs1', mt:Date.now(), src:'jstage', title:'褥瘡予防のケア', authors:['山田 花子'], journal:'看護研究', year:'2021', vol:'10', issue:'1', pages:'1-9', doi:'', url:'', pmid:'', abstract:'', memo:'' }));
  A.S.books.push(J(A, { id:'bk_rs1', mt:Date.now(), title:'基礎看護技術', author:'石井範子', publisher:'医学書院', isbn:'', year:'2020', course:'', where:'家', status:'持っている', price:0, memo:'', cover:'' }));
  A.commit();
  A.rsSt.rep.text = '褥瘡は多い1)。予防が大事である2)。'; A.rsSt.rep.refs = ''; A.rsSt.rep.style = 'jans'; A.rsSt.rep.tab = 'refs'; A.rsSt.rep.pick = false;
  openTool(A, 'rs-rep');
  typeIn(A, 'rs_rep_refs', '1) 山田花子（2020）：褥瘡予防のケア，看護研究，40（2），100-108．');
  eq(doc.querySelectorAll('#rs_rep_refres .rs-refrow').length, 1, '1件ずつ印が出る');
  ok(doc.querySelector('#rs_rep_refres .rs-citechk').textContent.indexOf('本文で使っていない') < 0, '引用の数を見る');
  ok(doc.querySelector('#rs_rep_refres').textContent.indexOf('2') >= 0, '引用番号が出る');
  press(A, 'rs-rep-pick');
  press(A, 'rs-rep-picksel', '[data-id="pp_rs1"]');
  press(A, 'rs-rep-picksel', '[data-id="bk_rs1"]');
  press(A, 'rs-rep-pickadd');
  var lines = A.rsRefLines(A.rsSt.rep.refs);
  eq(lines.length, 3, '保存した論文・本を一覧に足せる');
  ok(lines.indexOf('山田花子（2021）：褥瘡予防のケア，看護研究，10（1），1-9．') >= 0, '論文の書き出し：' + lines.join(' / '));
  ok(lines.indexOf('石井範子（2020）：基礎看護技術，医学書院．') >= 0, '本の書き出し');
  eq(doc.querySelectorAll('#rs_rep_refres .rs-refrow').length, 3, '書き出したものもチェック');
  A.removeItem('papers', 'pp_rs1'); A.removeItem('books', 'bk_rs1'); A.commit();
  A.rsSt.rep.text = ''; A.rsSt.rep.refs = '';
});

KT.test('勉強②：レポートの添削（名前をかくして送る→1つずつ「直す」）', async function(){
  var A = KT.frames().A, doc = A.document;
  A.rsSt.rep.text = '鈴木さんの事例について述べる。患者は痛みを訴えていた。看護師はケアをおこなた。';
  A.rsSt.rep.proof = null; A.rsSt.rep.tab = 'proof';
  openTool(A, 'rs-rep');
  ok(appText(A).indexOf('患者さんの名前') >= 0, '個人情報の注意書き');
  var n0 = calls('rs-proof').length;
  press(A, 'rs-rep-proof');
  await KT.until(function(){ return A.rsSt.rep.proof && !A.rsSt.rep.busy; }, 8000, '添削の答え');
  var sent = sentText(calls('rs-proof')[n0]);
  ok(sent.indexOf('鈴木') < 0 && sent.indexOf('＊＊さん') >= 0, '名前をかくして送る：' + sent);
  eq(doc.querySelectorAll('[data-act="rs-rep-fix"]').length, 1, '置きかえられるものだけ「直す」がある（＊＊が入った直しは出さない）');
  A.kmRunAction('rs-rep-fix', { dataset:{ i:'2' } });
  ok(A.rsSt.rep.text.indexOf('＊＊') < 0, '＊＊（かくした文字）を本文に入れない');
  press(A, 'rs-rep-fix', '[data-i="0"]');
  ok(A.rsSt.rep.text.indexOf('おこなった') >= 0 && A.rsSt.rep.text.indexOf('おこなた') < 0, '本文に反映');
  ok(A.rsSt.rep.text.indexOf('鈴木さん') === 0, '自分の本文の名前はそのまま');
  var dv = A.aiSectionData('study').rs_device;
  ok(dv.report && dv.report.text.indexOf('鈴木') < 0 && dv.report.text.indexOf('＊＊さん') >= 0, 'AIそうだんに見せるレポートの文も名前をかくす：' + (dv.report && dv.report.text));
  press(A, 'rs-rep-skip', '[data-i="1"]');
  ok(A.rsSt.rep.proof.items[1].skip, 'しないを選べる');
  A.rsSt.rep.text = ''; A.rsSt.rep.proof = null; A.rsSt.rep.tab = 'count';
});

KT.test('勉強②：PubMedでさがす→要旨→保存（相手に届く）・日本語から英語のことば', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  var F = A.rsSt.find;
  F.src = 'pubmed'; A.rsSt.rep.style = 'jans'; F.list = []; F.err = ''; F.kw = null; F.q = '';
  openTool(A, 'rs-find');
  typeIn(A, 'rs_find_q', 'rstest pressure ulcer');
  press(A, 'rs-find-go');
  await KT.until(function(){ return !F.busy && F.list.length === 2; }, 8000, 'PubMedの結果');
  ok(urls.some(function(u){ return /esearch\.fcgi.*term=rstest%20pressure%20ulcer/.test(u); }), 'esearch で検索する');
  ok(urls.some(function(u){ return /esummary\.fcgi.*id=99000001,99000002/.test(u); }), 'esummary で中身を読む');
  eq(F.list[0].title, 'Risk Factors Associated With Hospital-Acquired Pressure Injuries.', '題名');
  eq(F.list[0].year, '2026', '年');
  eq(F.list[0].doi, '10.1097/WON.1', 'DOI');
  ok(appText(A).indexOf('Zhao Y') >= 0, '結果が画面に出る');
  press(A, 'rs-find-abs', '[data-i="0"]');
  await KT.until(function(){ return !F.absBusy && F.abs['99000001']; }, 8000, '要旨');
  ok(F.abs['99000001'].indexOf('BACKGROUND: Pressure injuries') === 0, 'efetch で要旨を読む');
  ok(F.abs['99000001'].indexOf('ほかの言葉の要旨') < 0, 'OtherAbstract（ほかの言葉の要旨）はまぜない');
  var n0 = (A.S.papers || []).length;
  press(A, 'rs-find-save', '[data-i="0"]');
  eq(A.S.papers.length, n0 + 1, '保存（S.papers）');
  var sp = A.S.papers.filter(function(x){ return x.pmid === '99000001'; })[0];
  ok(sp && sp.abstract.indexOf('Early repositioning') >= 0 && sp.url === 'https://pubmed.ncbi.nlm.nih.gov/99000001/', '要旨・URLもいっしょに');
  ok(!btn(A, 'rs-find-abs', '[data-i="1"]').disabled, '2件目の要旨ボタン');
  ok(doc.querySelectorAll('[data-act="rs-find-save"]').length === 1, '保存したものは「保存ずみ」');
  A.kmRunAction('rs-find-save', { dataset:{ i:'0' } });
  eq(A.S.papers.length, n0 + 1, '同じ論文は2回入れない');
  /* 日本語から英語のことば（AI） */
  typeIn(A, 'rs_find_q', '褥瘡 予防');
  press(A, 'rs-find-kw');
  await KT.until(function(){ return !F.kwBusy && F.kw; }, 8000, '英語のことば');
  ok(appText(A).indexOf('褥瘡＝pressure ulcer') >= 0, '日本語と英語の対応が出る');
  var u0 = urls.length;
  press(A, 'rs-find-kwuse');
  await KT.until(function(){ return !F.busy && urls.length > u0; }, 8000, 'その式でさがす');
  ok(urls.slice(u0).some(function(u){ return /term=rstest%20pressure%20ulcer%20AND%20prevention/.test(u); }), 'AIの式でさがす');
  /* 保存した論文：メモ・文献の形でコピー */
  openTool(A, 'rs-find');
  press(A, 'rs-pp-memo', '[data-id="' + sp.id + '"]');
  typeIn(A, 'rs_find_memo', 'レポートの考察に使う');
  press(A, 'rs-pp-memosave', '[data-id="' + sp.id + '"]');
  eq(A.S.papers.filter(function(x){ return x.id === sp.id; })[0].memo, 'レポートの考察に使う', 'メモを保存');
  press(A, 'rs-pp-cite', '[data-id="' + sp.id + '"]');
  ok(A.rsSt.lastCopy.indexOf('Zhao Y, Alderden J (2026): Risk Factors') === 0, '文献の形でコピー：' + A.rsSt.lastCopy);
  await KT.settle([A, B]);
  ok((B.S.papers || []).some(function(x){ return x.pmid === '99000001' && x.memo === 'レポートの考察に使う'; }), '相手の端末に届く');
  ok(A.aiSectionData('study').data.papers.total >= 1, 'AIの道具（分野 study）で読める');
});

KT.test('勉強②：J-STAGE・CiNii・国会図書館を読む（XML・JSON）→本だなへ・読めないときの知らせ', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  KT.freshWrites([A, B]);
  var F = A.rsSt.find;
  openTool(A, 'rs-find');
  press(A, 'rs-find-src', '[data-v="jstage"]');
  typeIn(A, 'rs_find_q', 'rstest褥瘡');
  press(A, 'rs-find-go');
  await KT.until(function(){ return !F.busy && F.list.length; }, 8000, 'J-STAGE');
  var r = F.list[0];
  eq(r.title, '褥瘡ケアで理学療法士だからできること', 'J-STAGE：日本語の題名（<i> などのタグは取る）');
  eq(r.issue, '', 'J-STAGE：号の「0」は号なし');
  eq(r.authors.join(','), '吉川 義之', 'J-STAGE：著者');
  eq(r.journal, '理学療法学Supplement', 'J-STAGE：雑誌名');
  eq(r.pages, '47-51', 'J-STAGE：ページ');
  eq(F.total, 528, 'J-STAGE：件数');
  press(A, 'rs-find-src', '[data-v="cinii"]');
  typeIn(A, 'rs_find_q', 'rstest褥瘡');
  press(A, 'rs-find-go');
  await KT.until(function(){ return !F.busy && F.list.length; }, 8000, 'CiNii');
  eq(F.list[0].journal, '看護研究集録', 'CiNii：雑誌名');
  eq(F.list[0].year, '2015', 'CiNii：年');
  press(A, 'rs-find-src', '[data-v="ndl"]');
  typeIn(A, 'rs_find_q', 'rstest基礎看護技術');
  press(A, 'rs-find-go');
  await KT.until(function(){ return !F.busy && F.list.length; }, 8000, '国会図書館');
  r = F.list[0];
  eq(r.publisher, '日本看護協会出版会', 'NDL：出版社');
  eq(r.isbn, '4818009415', 'NDL：ISBN');
  var n0 = A.S.books.length;
  press(A, 'rs-find-book', '[data-i="0"]');
  eq(A.S.books.length, n0 + 1, '本だなに入れられる');
  var b = A.S.books[A.S.books.length - 1];
  eq(b.isbn, '9784818009417', 'ISBNは13けたにそろえる');
  eq(b.author, '石井範子・阿部テル子', '著者名を整える（生まれた年などを取る）');
  ok(b.title.indexOf('イラストでわかる基礎看護技術') === 0, '題名');
  ok(appText(A).indexOf('本だなにあります') >= 0, '入れたものは印');
  /* 読めないとき */
  var bs = bridgeSave(A);
  bridgeOff(A);
  try{
    press(A, 'rs-find-src', '[data-v="pubmed"]');
    typeIn(A, 'rs_find_q', 'no hit here');
    press(A, 'rs-find-go');
    await KT.until(function(){ return !F.busy && F.err; }, 8000, 'エラー');
    ok(F.err.indexOf('Google連携を新しい版にすると使えます') >= 0, '橋わたしが無いときの知らせ：' + F.err);
    ok(appText(A).indexOf('Google連携を新しい版にすると使えます') >= 0, '画面にも出る');
  }finally{ bridgeBack(A, bs); }
  await KT.settle([A, B]);
  ok(B.S.books.some(function(x){ return x.id === b.id; }), '相手に届く');
  A.removeItem('books', b.id); A.commit();
});

KT.test('勉強②：教科書の本だな（ISBN→openBD→Google Books、写真のバーコード、授業ごと、AIと全体検索）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  var Bk = A.rsSt.books, cn = (A.termCourses()[0] || {}).name || '';
  ok(A.rsIsbnOk('9784260031769') && !A.rsIsbnOk('9784260031760'), 'ISBNの数字の確かめ');
  eq(A.rsIsbnNorm('4-8180-0941-5'), '9784818009417', '10けたを13けたに');
  Bk.d = null; Bk.editId = '';
  openTool(A, 'rs-books');
  press(A, 'rs-bk-new');
  typeIn(A, 'rs_books_d_isbn', '978-4-260-03176-9');
  press(A, 'rs-bk-isbn');
  await KT.until(function(){ return !Bk.busy && Bk.d.title; }, 8000, 'openBD');
  eq(Bk.d.title, '新看護学 1', 'openBDで題名');
  eq(Bk.d.author, '小林靖・幸田和久', '著者を整える');
  eq(Bk.d.publisher, '医学書院', '出版社');
  eq(String(Bk.d.price), '1800', 'ねだん');
  ok(appText(A).indexOf('openBD') >= 0, 'どこで見つけたかを出す');
  if(cn) typeIn(A, 'rs_books_d_course', cn);
  press(A, 'rs-bk-status', '[data-v="買う予定"]');
  press(A, 'rs-bk-where', '[data-v="ロッカー"]');
  var n0 = A.S.books.length;
  press(A, 'rs-bk-save');
  eq(A.S.books.length, n0 + 1, '本だなに入る');
  var b1 = A.S.books[A.S.books.length - 1];
  ok(b1.isbn === '9784260031769' && b1.status === '買う予定' && b1.where === 'ロッカー' && b1.price === 1800 && b1.course === cn, '中身：' + JSON.stringify(b1));
  if(cn) ok(appText(A).indexOf(A.shortName(cn)) >= 0, '授業ごとにまとめて出す');
  /* openBD に無い → Google Books */
  press(A, 'rs-bk-new');
  typeIn(A, 'rs_books_d_isbn', '9784567890120');
  press(A, 'rs-bk-isbn');
  await KT.until(function(){ return !Bk.busy && Bk.d.title; }, 8000, 'Google Books');
  eq(Bk.d.title, '看護のための英語', 'Google Books で題名');
  eq(Bk.d.cover, 'https://books.google.com/x.jpg', '表紙は https に');
  ok(Bk.msg.indexOf('Google Books') >= 0, 'Google Booksで見つかった');
  press(A, 'rs-bk-cancel');
  /* ISBNの数字がちがう */
  press(A, 'rs-bk-new');
  typeIn(A, 'rs_books_d_isbn', '1234');
  var u0 = urls.length;
  press(A, 'rs-bk-isbn');
  eq(urls.length, u0, 'まちがったISBNでは調べない');
  /* バーコードの写真 → AIで数字 → openBD */
  var n1 = calls('rs-isbn').length;
  await A.rsBookPhoto(['data:image/jpeg;base64,/9j/AA==']);
  await KT.until(function(){ return !Bk.busy && Bk.d.title === '新看護学 1'; }, 8000, '写真から');
  eq(calls('rs-isbn').length, n1 + 1, '写真をAIに送る');
  eq(Bk.d.isbn, '9784260031769', '写真からISBN');
  press(A, 'rs-bk-cancel');
  /* 直す */
  press(A, 'rs-bk-edit', '[data-id="' + b1.id + '"]');
  press(A, 'rs-bk-status', '[data-v="持っている"]');
  press(A, 'rs-bk-save');
  eq(A.S.books.filter(function(x){ return x.id === b1.id; })[0].status, '持っている', '直せる');
  press(A, 'rs-bk-edit', '[data-id="' + b1.id + '"]');
  press(A, 'rs-bk-status', '[data-v="買う予定"]');
  press(A, 'rs-bk-save');
  /* AI・全体検索 */
  var sd = A.aiSectionData('study');
  ok(sd.rs_books && sd.rs_books.toBuy >= 1 && sd.rs_books.toBuyYen >= 1800, 'AIで本だなの数字が読める');
  ok(sd.data.books.total >= 1, 'AIの道具で S.books が読める');
  var hits = [];
  A.KM.search.forEach(function(fn){ hits = hits.concat(fn('新看護学') || []); });
  var h = hits.filter(function(x){ return x.kind === '教科書'; })[0];
  ok(h && String(h.attrs).indexOf('data-tool="rs-books"') >= 0 && h.attrs['data-id'] === b1.id, '全体検索に出る（attrs）');
  A.appId = 'today'; A.render();
  A.kmRunAction('rs-open', { dataset:{ tool:'rs-books', id:b1.id } });
  ok(A.appId === 'study' && A.studyTool === 'rs-books' && doc.querySelector('.rs-hl'), '検索から本だなを開ける');
  await KT.settle([A, B]);
  ok(B.S.books.some(function(x){ return x.id === b1.id && x.status === '買う予定'; }), '相手に届く');
  A.removeItem('books', b1.id); A.commit(); Bk.hl = '';
});

KT.test('勉強②：英語論文をやさしく→単語を暗記カードに・翻訳（Gemini と DeepL＝橋わたし）', async function(){
  var A = KT.frames().A, doc = A.document, E = A.rsSt.eng;
  E.tab = 'easy'; E.out = null; E.files = []; E.paperId = ''; E.dir = 'auto'; E.trOut = '';
  var bs = bridgeSave(A);
  bridgeOff(A);
  try{
  openTool(A, 'rs-eng');
  typeIn(A, 'rs_eng_text', 'Pressure injuries are common after hip fracture surgery.');
  press(A, 'rs-eng-go');
  await KT.until(function(){ return !E.busy && E.out; }, 8000, 'やさしい説明');
  ok(appText(A).indexOf('とこずれ') >= 0, 'やさしい説明が出る');
  eq(E.out.points.length, 3, '要点3つ');
  eq(E.out.words.length, 3, '単語の一覧');
  press(A, 'rs-eng-word', '[data-i="1"]');
  var n0 = A.S.cards.length;
  press(A, 'rs-eng-cards');
  eq(A.S.cards.length, n0 + 2, 'チェックした単語だけ暗記カードに');
  ok(A.S.cards.some(function(c){ return c.deck === '英語の論文' && c.q === 'pressure injury' && c.src === 'research'; }), 'カードの中身');
  press(A, 'rs-eng-cards');
  eq(A.S.cards.length, n0 + 2, '同じカードは2回入れない');
  /* 翻訳：橋わたしが無い → Gemini */
  press(A, 'rs-eng-tab', '[data-v="tr"]');
  ok(appText(A).indexOf('Google連携を新しい版にすると使えます') >= 0, '橋わたしが無いときの知らせ');
  typeIn(A, 'rs_eng_tr', 'Prevent pressure injury');
  press(A, 'rs-tr-go');
  await KT.until(function(){ return !E.trBusy && E.trOut; }, 8000, 'Geminiの翻訳');
  eq(E.trBy, 'Gemini（AI）', 'Geminiで訳したと出す');
  eq(E.trOut, '褥瘡を予防する', '訳');
  /* 橋わたし（v3）に DeepL のカギを預ける */
  bridgeOn(A);
  {
    A.S.ui.setOpen = A.S.ui.setOpen || {}; A.S.ui.setOpen['rs-deepl'] = 1;
    A.appId = 'set'; A.render();
    typeIn(A, 'rs_deepl_key', 'abcdefgh-1234-5678-90ab-cdefabcdef12:fx');
    press(A, 'rs-deepl-set');
    await KT.until(function(){ return deeplKeys.indexOf('abcdefgh-1234-5678-90ab-cdefabcdef12:fx') >= 0; }, 5000, 'カギを預ける');
    ok(JSON.stringify(A.S).indexOf('abcdefgh-1234') < 0, 'カギは S（同期）に入れない');
    var inLs = false;
    for(var i = 0; i < A.localStorage.length; i++){ if(String(A.localStorage.getItem(A.localStorage.key(i))).indexOf('abcdefgh-1234') >= 0) inLs = true; }
    ok(!inLs, 'カギは localStorage にも入れない');
    delete A.S.ui.setOpen['rs-deepl'];
    E.trOut = ''; E.dir = 'JA';
    openTool(A, 'rs-eng');
    typeIn(A, 'rs_eng_tr', 'Prevent pressure injury');
    press(A, 'rs-tr-go');
    await KT.until(function(){ return !E.trBusy && E.trOut; }, 8000, 'DeepLの翻訳');
    eq(E.trBy, 'DeepL', 'DeepLで訳したと出す');
    eq(E.trOut, '（DeepL）褥瘡の予防', 'DeepLの訳');
    var tc = KT.gasCalls.filter(function(r){ return r.action === 'translate'; });
    eq(tc[tc.length - 1].target, 'JA', '訳す先の言葉');
  }
  }finally{
    bridgeBack(A, bs); A.rsLs('deepl', null); E.dir = 'auto'; E.trOut = ''; E.tab = 'easy';
  }
});

KT.test('勉強②：e-Gov法令（よく使う法令・条文の中をさがす・保存・名前やことばでさがす）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document, L = A.rsSt.law;
  KT.freshWrites([A, B]);
  L.id = ''; L.arts = null; L.list = null; L.cache = {};
  openTool(A, 'rs-law');
  ok(doc.querySelectorAll('.rs-lawbtns [data-act="rs-law-open"]').length === 8, 'よく使う法令のボタンが8つ');
  press(A, 'rs-law-open', '[data-id="323AC0000000203"]');
  await KT.until(function(){ return !L.busy && L.arts; }, 8000, '条文');
  eq(L.arts.length, 3, '附則はのぞいて本則の条だけ');
  eq(L.title, '保健師助産師看護師法', '法令の名前');
  var a31 = L.arts.filter(function(a){ return a.num === '31'; })[0];
  ok(a31.text.indexOf('看護師でない者は') === 0 && a31.text.indexOf('ただし、医師法') > 0 && a31.text.indexOf('\n２　保健師及び助産師') > 0, '項をならべる：' + a31.text);
  eq(a31.chap, '第四章　業務', '章');
  var a42 = L.arts.filter(function(a){ return a.num === '42_2'; })[0];
  ok(a42.cap === '（秘密を守る義務）' && a42.text.indexOf('\n　一　テストの号の文') > 0, '見出しと号');
  typeIn(A, 'rs_law_filter', '31');
  var box = doc.getElementById('rs_law_arts');
  ok(box.textContent.indexOf('第三十一条') >= 0 && box.querySelectorAll('.rs-art').length === 1, '番号でしぼる');
  typeIn(A, 'rs_law_filter', '秘密');
  ok(doc.getElementById('rs_law_arts').textContent.indexOf('第四十二条の二') >= 0, 'ことばでしぼる');
  press(A, 'rs-law-clip', '[data-n="42_2"]');
  var clip = A.rsItems('lawclip').filter(function(x){ return x.num === '42_2'; })[0];
  ok(clip && clip.law === '保健師助産師看護師法' && clip.text.indexOf('秘密を漏らしてはならない') >= 0, '条文を保存（kmItems）');
  ok(appText(A).indexOf('保存ずみ') >= 0, '保存ずみの印');
  press(A, 'rs-law-back');
  ok(appText(A).indexOf('保存した条文') >= 0, '保存した条文が出る');
  press(A, 'rs-law-mode', '[data-v="title"]');
  typeIn(A, 'rs_law_q', 'rstest医療法');
  press(A, 'rs-law-go');
  await KT.until(function(){ return !L.busy && L.list; }, 8000, '名前でさがす');
  eq(L.list[0].title, 'rstest医療法', 'ちょうど同じ名前の法律を先に');
  press(A, 'rs-law-mode', '[data-v="word"]');
  typeIn(A, 'rs_law_q', 'rstest守秘義務');
  press(A, 'rs-law-go');
  await KT.until(function(){ return !L.busy && L.list; }, 8000, 'ことばでさがす');
  ok(L.list[0].hits[0].indexOf('【守秘義務】') >= 0, '見つかったところに印');
  ok(appText(A).indexOf('児童福祉法') >= 0, '画面に出る');
  var hits = [];
  A.KM.search.forEach(function(fn){ hits = hits.concat(fn('秘密を漏らして') || []); });
  ok(hits.some(function(x){ return x.kind === '法令'; }), '保存した条文が全体検索に出る');
  await KT.settle([A, B]);
  ok((B.S.kmItems || []).some(function(x){ return x.id === clip.id; }), '相手に届く');
  A.removeItem('kmItems', clip.id); A.commit();
  L.list = null; L.mode = 'title';
});

KT.test('勉強②：講義の録音（区切りごとに文字→要約→メモに保存・音声は残さない）・カギが無いとき', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document, L = A.rsSt.lec;
  KT.freshWrites([A, B]);
  var cn = (A.termCourses()[0] || {}).name || '';
  L.segs = []; L.sum = null; L.course = ''; L.rec = false;
  openTool(A, 'rs-lec');
  ok(appText(A).indexOf('先生の許可をとってから') >= 0, '先生の許可の注意');
  if(cn) pickIn(A, 'rs_lec_course', cn);
  var n0 = calls('rs-lec-stt').length;
  A.rsLecAddSegment(new A.Blob(['RIFFtest1'], { type:'audio/mp4' }));
  A.rsLecAddSegment(new A.Blob(['RIFFtest2'], { type:'audio/mp4' }));
  ok(appText(A).indexOf('区切りごとの進みぐあい') >= 0, '進みぐあいが出る');
  await KT.until(function(){ return L.segs.length === 2 && L.segs.every(function(s){ return s.st === 'done'; }); }, 8000, '文字にする');
  var reqs = calls('rs-lec-stt').slice(n0);
  eq(reqs.length, 2, '区切りごとにAIへ');
  eq(reqs[0].contents[0].parts[0].inline_data.mime_type, 'audio/mp4', '音声を inline_data で送る');
  ok(L.segs.every(function(s){ return s.blob === null; }), '文字にしたら音声は消す');
  var saved = A.rsLs('lec');
  ok(saved && saved.segs.length === 2 && JSON.stringify(saved).indexOf('base64') < 0, 'この端末には文字だけ残す');
  ok(A.rsLecText().indexOf('バイタルサイン') >= 0 && A.rsLecText().indexOf('37度') > 0, '順番に文字がつながる');
  render_(A);
  press(A, 'rs-lec-sum');
  await KT.until(function(){ return !L.sumBusy && L.sum; }, 8000, '要約');
  ok(appText(A).indexOf('テストに出そうなこと') >= 0, '要約が出る');
  var nn = A.S.notes.length;
  press(A, 'rs-lec-save');
  eq(A.S.notes.length, nn + 1, 'メモに保存');
  var note = A.S.notes[A.S.notes.length - 1];
  ok(note.body.indexOf('【要約】') === 0 && note.body.indexOf('【わからなかった言葉】') > 0 && note.body.indexOf('【文字起こし】') > 0, 'メモの中身');
  if(cn) ok(note.link && note.link.type === 'course' && note.link.id === cn, '授業に link');
  eq(L.segs.length, 0, '保存したら片づける');
  eq(A.rsLs('lec'), null, '端末の文字も消す');
  await KT.settle([A, B]);
  ok(B.S.notes.some(function(x){ return x.id === note.id; }), '相手に届く');
  /* AIのカギが無いとき */
  var fake = window.__FAKE_AI;
  window.__FAKE_AI = null;
  try{
    openTool(A, 'rs-lec');
    ok(appText(A).indexOf('AI（Gemini）のカギが無いので、いまは使えません') >= 0, 'カギが無いと使えないと出す');
    ok(!doc.querySelector('[data-act="rs-lec-start"]'), '録音ボタンを出さない');
  }finally{ window.__FAKE_AI = fake; }
  A.removeItem('notes', note.id); A.commit();
});
function render_(w){ w.render(); }

KT.test('勉強②：AIそうだんの道具・表示するだけでは中身が変わらない', async function(){
  var A = KT.frames().A;
  var names = A.KM.chatTools.map(function(x){ return x.decl.name; });
  ['rs_find_papers', 'rs_format_reference', 'rs_add_book'].forEach(function(n){ ok(names.indexOf(n) >= 0, '道具がある：' + n); });
  ok(A.KM.chatTools.filter(function(x){ return x.decl.name === 'rs_add_book'; })[0].write, '本を足す道具は書きこむ道具');
  var n0 = A.S.books.length;
  var r = A.aiRunFunc({ name:'rs_add_book', args:{ title:'解剖生理学ノート', status:'買う予定', price:2500 } });
  eq(A.S.books.length, n0 + 1, 'AIから本を足せる');
  ok(r.op && r.op.list === 'books', '取り消せる');
  A.aiUndoOps([r.op]);
  eq(A.S.books.length, n0, '取り消せる');
  A.S.papers.push(J(A, { id:'pp_rs2', mt:Date.now(), src:'hand', title:'看護の本の論文', authors:['佐藤 一'], journal:'看護', year:'2020', vol:'1', issue:'', pages:'1-2', doi:'', url:'', pmid:'', abstract:'', memo:'' }));
  var f = JSON.parse(A.aiRunFunc({ name:'rs_format_reference', args:{ query:'看護の本', style:'jans' } }).result);
  eq(f.refs[0], '佐藤一（2020）：看護の本の論文，看護，1，1-2．', '保存した論文を文献の形に');
  A.removeItem('papers', 'pp_rs2');
  var F = A.rsSt.find;
  F.list = []; F.lastQ = ''; F.resSrc = '';
  var r1 = A.aiRunFunc({ name:'rs_find_papers', args:{ query:'rstest pressure' } });
  ok(r1.result.indexOf('さがしはじめました') >= 0, 'さがしはじめる');
  await KT.until(function(){ return !F.busy && F.list.length; }, 8000, 'AIからさがす');
  var r2 = JSON.parse(A.aiRunFunc({ name:'rs_find_papers', args:{ query:'rstest pressure' } }).result);
  eq(r2.items.length, 2, 'もう一度使うと一覧を返す');
  A.appId = 'today'; A.render();
  /* 表示するだけでは変わらない */
  await KT.settle([A, KT.frames().B]);
  var snap = function(){ var o = A.payloadCore(); delete o.notices; return A.canon(o) + '|' + A.canon(A.S.meta); };
  var before = snap();
  var views = [['rs-np', function(){ A.rsSt.np.tab = 'proc'; }], ['rs-np', function(){ A.rsSt.np.tab = 'plan'; }],
    ['rs-rep', function(){ A.rsSt.rep.tab = 'count'; }], ['rs-rep', function(){ A.rsSt.rep.tab = 'refs'; }], ['rs-rep', function(){ A.rsSt.rep.tab = 'proof'; }],
    ['rs-find', null], ['rs-books', function(){ A.rsSt.books.d = A.rsBookNew(); }], ['rs-eng', function(){ A.rsSt.eng.tab = 'easy'; }], ['rs-eng', function(){ A.rsSt.eng.tab = 'tr'; }],
    ['rs-law', null], ['rs-lec', null], ['', null]];
  views.forEach(function(v){
    if(v[1]) v[1]();
    A.appId = 'study'; A.studyTool = v[0]; A.render();
    ok(A.document.getElementById('app').innerHTML.indexOf('表示できませんでした') < 0, '表示できる：' + v[0]);
  });
  A.rsSt.books.d = null;
  A.appId = 'set'; A.render();
  A.persist();
  eq(snap(), before, '表示しただけでは中身が変わらない');
  A.studyTool = ''; A.appId = 'today'; A.render();
});

KT.test('勉強②：「つぎの20件」は、いま出ている一覧と同じことば・同じところでさがす（入力欄を書きかえても混ぜない）', async function(){
  var A = KT.frames().A, F = A.rsSt.find;
  F.src = 'pubmed'; F.list = []; F.err = ''; F.kw = null; F.total = 0; F.q = '';
  openTool(A, 'rs-find');
  typeIn(A, 'rs_find_q', 'rstestmany ulcer');
  press(A, 'rs-find-go');
  await KT.until(function(){ return !F.busy && F.list.length === 2; }, 8000, 'はじめの結果');
  eq(F.total, 45, '全部の件数');
  /* ことばを書きかえただけ（さがすは押さない）で「つぎの20件」 */
  typeIn(A, 'rs_find_q', 'rstest other words');
  var u0 = urls.length;
  press(A, 'rs-find-more');
  await KT.until(function(){ return !F.busy && F.list.length === 4; }, 8000, 'つぎの結果');
  var es = urls.slice(u0).filter(function(u){ return /esearch\.fcgi/.test(u); })[0] || '';
  ok(/term=rstestmany%20ulcer/.test(es) && /retstart=2(&|$)/.test(es), '同じことばの続きをさがす：' + es);
  eq(F.lastQ, 'rstestmany ulcer', '一覧のことばは変わらない');
  F.list = []; F.total = 0; F.q = ''; F.lastQ = ''; F.resSrc = '';
});

KT.test('勉強②：本だな：ISBNを調べている間に「やめる」→新しい下書きには入れない', async function(){
  var A = KT.frames().A, Bk = A.rsSt.books;
  Bk.d = null; Bk.editId = ''; Bk.msg = ''; Bk.busy = false;
  openTool(A, 'rs-books');
  press(A, 'rs-bk-new');
  typeIn(A, 'rs_books_d_isbn', '9784260031769');
  press(A, 'rs-bk-isbn');
  ok(Bk.busy, '調べている');
  press(A, 'rs-bk-cancel');
  press(A, 'rs-bk-new');
  await KT.until(function(){ return !Bk.busy; }, 8000, '調べ終わる');
  eq(Bk.d.title, '', '新しい下書きの題名は空のまま');
  eq(Bk.msg, '', 'エラーも出ない');
  press(A, 'rs-bk-cancel');
});

KT.test('勉強②：講義の録音：2回押してもマイクは1つ・マイクが切れたら止めて知らせる・止めたらマイクを閉じる', async function(){
  var A = KT.frames().A, L = A.rsSt.lec;
  var streams = [], recs = [];
  function FakeTrack(){ this.readyState = 'live'; }
  FakeTrack.prototype.stop = function(){ this.readyState = 'ended'; };
  function FakeStream(){ this.t = [new FakeTrack()]; }
  FakeStream.prototype.getTracks = function(){ return this.t; };
  FakeStream.prototype.getAudioTracks = function(){ return this.t; };
  function FakeMR(stream){ this.stream = stream; this.state = 'inactive'; this.mimeType = 'audio/mp4'; recs.push(this); }
  FakeMR.isTypeSupported = function(t){ return t === 'audio/mp4'; };
  FakeMR.prototype.start = function(){
    if(!this.stream.t.some(function(t){ return t.readyState === 'live'; })) throw new Error('InvalidStateError');
    this.state = 'recording';
  };
  FakeMR.prototype.stop = function(){
    var me = this;
    if(me.state === 'inactive') return;
    me.state = 'inactive';
    setTimeout(function(){ if(me.ondataavailable) me.ondataavailable({ data:new A.Blob(['RIFFfake' + recs.indexOf(me)], { type:'audio/mp4' }) }); if(me.onstop) me.onstop(); }, 10);
  };
  var gum = function(){ return new Promise(function(res){ setTimeout(function(){ var s = new FakeStream(); streams.push(s); res(s); }, 40); }); };
  var md = A.navigator.mediaDevices, own = !!md && Object.prototype.hasOwnProperty.call(md, 'getUserMedia'), oldGum = md ? md.getUserMedia : null, oldMR = A.MediaRecorder, defined = false;
  if(md) md.getUserMedia = gum;
  else{ Object.defineProperty(A.navigator, 'mediaDevices', { value:{ getUserMedia:gum }, configurable:true }); defined = true; }
  A.MediaRecorder = FakeMR;
  try{
    L.segs = []; L.sum = null; L.rec = false; L.err = ''; L.course = '-';
    openTool(A, 'rs-lec');
    press(A, 'rs-lec-start');
    press(A, 'rs-lec-start');                               /* すばやく2回 */
    await KT.until(function(){ return L.rec && A.rsLecRec; }, 5000, '録音がはじまる');
    await new Promise(function(r){ setTimeout(r, 120); });
    eq(streams.length, 1, 'マイクは1つだけ開く');
    eq(recs.length, 1, '録音は1つ');
    eq(recs[0].state, 'recording', '録音している');
    ok(A.document.querySelector('[data-act="rs-lec-stop"]'), '止めるボタン');
    /* iPhoneで画面を消した → マイクが切れて、録音が勝手に止まる */
    streams[0].t[0].readyState = 'ended';
    recs[0].stop();
    await KT.until(function(){ return !L.rec; }, 5000, '録音が止まったと分かる');
    ok(L.err.indexOf('録音が止まりました') >= 0, '知らせる：' + L.err);
    ok(!A.rsLecRec, '録音の道具を片づける');
    ok(A.document.getElementById('app').textContent.indexOf('録音が止まりました') >= 0, '画面にも出る');
    ok(!A.document.querySelector('[data-act="rs-lec-stop"]'), '「録音しています」のままにならない');
    await KT.until(function(){ return L.segs.length === 1 && L.segs[0].st === 'done'; }, 8000, 'ここまでの分は文字にする');
    /* もう一度はじめて、止める → マイクを閉じる */
    press(A, 'rs-lec-start');
    await KT.until(function(){ return L.rec && A.rsLecRec; }, 5000, 'もう一度はじまる');
    eq(streams.length, 2, '新しくマイクを開く');
    press(A, 'rs-lec-stop');
    await KT.until(function(){ return !A.rsLecRec && streams[1].t[0].readyState === 'ended'; }, 5000, 'マイクを閉じる');
    await KT.until(function(){ return L.segs.length === 2 && L.segs.every(function(s){ return s.st === 'done'; }); }, 8000, '最後の区切りも文字にする');
  }finally{
    if(defined) delete A.navigator.mediaDevices;
    else if(md){ if(own) md.getUserMedia = oldGum; else delete md.getUserMedia; }
    A.MediaRecorder = oldMR;
    if(A.rsLecRec){ try{ A.rsLecStop(); }catch(e){} }
    L.segs = []; L.sum = null; L.rec = false; L.err = ''; L.course = ''; A.rsLs('lec', null);
  }
});

})();
