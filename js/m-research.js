/* くらしの手帳：勉強②（看護過程・レポート・論文・本・翻訳・法令・講義の録音） */
/* ============================== しくみ ==============================
   「勉強」タブの道具（kmStudy）として、7つの道具を足す。
   ・看護過程（#7 考え方のコーチ・#8 看護計画の枠） … S.kmItems（mod:'research'、type:'nproc' / 'nplan'）
   ・レポート（#9 文字数と構成・#10 参考文献・#117 AIの添削） … 本文はこの端末だけに置く。目標の文字数は S.kmData 'research:goal:課題id'
   ・論文・本さがし（#11 PubMed・#12 J-STAGE・#13 CiNii・#186 国会図書館） … 保存は S.papers／本は S.books
   ・教科書の本だな（#14） … S.books
   ・英語・翻訳（#118 英語論文をやさしく・#177 DeepL） … DeepLのカギは橋わたしにだけ置く（S にも localStorage にも入れない）
   ・法令（#179 e-Gov法令） … 保存した条文は S.kmItems（type:'lawclip'）
   ・講義の録音（#116） … 音声は残さない。まとめは S.notes（授業に link）
   患者さんの情報をAIに送る画面には、注意書きを出し、送る前に名前らしい文字などを＊＊にかくす（rsMask）。 */

/* ============================== 状態（この端末のメモリーだけ） ============================== */
var RS_LS = KEY + ':research';
function rsLs(name, v){
  try{
    if(arguments.length < 2){ var s = localStorage.getItem(RS_LS + ':' + name); return s == null ? null : JSON.parse(s); }
    if(v === null) localStorage.removeItem(RS_LS + ':' + name);
    else localStorage.setItem(RS_LS + ':' + name, JSON.stringify(v));
  }catch(e){ return null; }
  return v;
}
var rsSt = {
  np:{ tab:'proc', id:'', d:null, step:'info', pat:'', prob:'', busy:false, sent:'', sentKey:'', masked:0, dirty:false,
       newTitle:'', newFrame:'gordon', plId:'', pl:null, plDirty:false },
  rep:{ tab:'count', text:'', target:'', taskId:'', refs:'', style:'jans', pick:false, sel:{}, proof:null, busy:false, sent:'', masked:0 },
  find:{ src:'pubmed', q:'', busy:false, list:[], total:0, next:0, err:'', resSrc:'', lastQ:'', abs:{}, absBusy:'', kw:null, kwBusy:false, memoId:'', memo:'', hl:'' },
  books:{ d:null, editId:'', busy:false, msg:'', hl:'' },
  eng:{ tab:'easy', text:'', files:[], busy:false, out:null, paperId:'', tr:'', dir:'auto', trOut:'', trBy:'', trNote:'', trBusy:false },
  law:{ q:'', mode:'title', busy:false, loading:'', list:null, err:'', id:'', title:'', arts:null, filter:'', show:30, cache:{} },
  lec:{ course:'', min:5, rec:false, t0:0, segs:[], busy:false, sum:null, sumBusy:false, err:'', full:1 },
  lastCopy:''
};
(function(){
  var r = rsLs('rep');
  if(r && typeof r === 'object'){
    rsSt.rep.text = String(r.text || ''); rsSt.rep.refs = String(r.refs || '');
    rsSt.rep.target = String(r.target || ''); rsSt.rep.taskId = String(r.taskId || '');
    if(/^(jans|apa|sist)$/.test(r.style || '')) rsSt.rep.style = r.style;
  }
  var l = rsLs('lec');
  if(l && Array.isArray(l.segs) && l.segs.length){
    rsSt.lec.course = String(l.course || '');
    rsSt.lec.segs = l.segs.map(function(s, i){ return { n:i + 1, st:'done', text:String(s.text || ''), err:'', blob:null }; });
  }
})();

/* ============================== 共通の道具 ============================== */
function rsCopy(o){ return JSON.parse(JSON.stringify(o == null ? null : o)); }
function rsClip(s, n){ s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…' : s; }
function rsStrip(s){ return String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
function rsStrs(a, n){ return (Array.isArray(a) ? a : a ? [a] : []).map(function(x){ return rsClip(typeof x === 'string' ? x : (x && (x.text || x.q)) || '', 300); }).filter(Boolean).slice(0, n || 10); }
function rsAny(v){
  if(v == null) return false;
  if(typeof v === 'string') return !!v.trim();
  if(typeof v === 'object') return Object.keys(v).some(function(k){ return rsAny(v[k]); });
  return false;
}
function rsWhen(mt){ return mt ? ymdLabel(toYmd(new Date(Number(mt)))) : ''; }
function rsWhenTime(mt){ if(!mt) return ''; var d = new Date(Number(mt)); return ymdLabel(toYmd(d)) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function rsSafeUrl(u){ u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u.replace(/^http:\/\//i, 'https://') : ''; }
function rsPaint(){ if(typeof isTyping === 'function' && isTyping()) renderLater(); else render(); }
function rsItems(type){ return (S.kmItems || []).filter(function(x){ return x && x.mod === 'research' && x.type === type; }); }
function rsItem(id){ return (S.kmItems || []).filter(function(x){ return x && x.id === id && x.mod === 'research'; })[0] || null; }
function rsByMt(a, b){ return (Number(b.mt) || 0) - (Number(a.mt) || 0); }
function rsChip(act, v, label, on, extra){
  return '<button class="' + (on ? 'on' : '') + '" data-act="' + act + '" data-v="' + esc(v) + '"' + (extra || '') + '>' + esc(label) + '</button>';
}
/* 入力欄（data-rs に rsSt の場所を書くと、打ったそばから覚える＝描き直しても消えない） */
function rsGetPath(p){
  var o = rsSt, a = String(p).split('.');
  for(var i = 0; i < a.length; i++){ if(o == null || typeof o !== 'object') return ''; o = o[a[i]]; }
  return o == null ? '' : o;
}
function rsSetPath(p, v){
  var o = rsSt, a = String(p).split('.');
  for(var i = 0; i < a.length - 1; i++){
    if(o[a[i]] == null || typeof o[a[i]] !== 'object') o[a[i]] = {};
    o = o[a[i]];
  }
  o[a[a.length - 1]] = v;
}
function rsId(p){ return 'rs_' + String(p).replace(/[^A-Za-z0-9]/g, '_'); }
function rsTa(path, ph, rows, label){
  var id = rsId(path);
  return '<div class="field">' + (label ? '<label class="f" for="' + id + '">' + esc(label) + '</label>' : '') +
    '<textarea id="' + id + '" data-rs="' + esc(path) + '" rows="' + (rows || 3) + '" placeholder="' + esc(ph || '') + '">' + esc(rsGetPath(path)) + '</textarea></div>';
}
function rsIn(path, ph, label, type, extra){
  var id = rsId(path);
  return '<div class="field">' + (label ? '<label class="f" for="' + id + '">' + esc(label) + '</label>' : '') +
    '<input id="' + id + '" data-rs="' + esc(path) + '" type="' + (type || 'text') + '" value="' + esc(rsGetPath(path)) + '" placeholder="' + esc(ph || '') + '"' + (extra || '') + '></div>';
}
function rsBn(color, html){ return '<div class="bn ' + color + '"><span class="ic">!</span><span>' + html + '</span></div>'; }
function rsHead(title, noteHtml, inner){
  return '<section><div class="head"><h2>' + esc(title) + '</h2>' + (noteHtml ? '<span>' + noteHtml + '</span>' : '') + '</div><div class="box">' + inner + '</div></section>';
}
function rsPrivacyBn(){
  return rsBn('amber', '<b>患者さんの名前・くわしい年齢・病院名・住所・電話番号は書かないでください。</b>「A氏・80代・B病院」のように書きます。' +
    'AIに送る前に、名前らしい文字などは自動で＊＊にかくしますが、かくしきれないこともあります。');
}
function rsNoAi(what){ return '<p class="note">' + esc(what) + 'は、設定タブでAI（Gemini）のカギを登録すると使えます。</p>'; }
function rsBridgeOk(){ return typeof gasReady === 'function' && gasReady() && toNum(GAS.ver) >= 3; }
function rsCopyText(text){
  rsSt.lastCopy = String(text || '');
  var done = function(){ toast('コピーしました'); };
  var fallback = function(){
    try{
      var ta = document.createElement('textarea');
      ta.value = rsSt.lastCopy; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done();
    }catch(e){ toast('コピーできませんでした', true); }
  };
  try{
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(rsSt.lastCopy).then(done, fallback);
    else fallback();
  }catch(e){ fallback(); }
}
function rsReadFile(f){
  return new Promise(function(res, rej){ var r = new FileReader(); r.onload = function(){ res(r.result); }; r.onerror = function(){ rej(new Error('読めませんでした')); }; r.readAsDataURL(f); });
}
function rsPickFiles(accept, multi, fn){
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = accept; inp.multiple = !!multi;
  inp.onchange = function(){ var fs = Array.prototype.slice.call(inp.files || []); if(fs.length) fn(fs); };
  inp.click();
}
/* 印刷（window.print 用の見た目。印刷の間だけ、この中身だけを出す） */
function rsPrint(title, html){
  var old = document.getElementById('rs-printarea');
  if(old) old.remove();
  var box = document.createElement('div');
  box.id = 'rs-printarea';
  box.innerHTML = '<h1>' + esc(title) + '</h1>' + html + '<p class="rs-pfoot">くらしの手帳で作成（' + esc(ymdLabel(today())) + '）</p>';
  document.body.appendChild(box);
  if(TEST_MODE) return;
  document.body.classList.add('rs-printing');
  var off = function(){ document.body.classList.remove('rs-printing'); };
  window.addEventListener('afterprint', off, { once:true });
  setTimeout(function(){ try{ window.print(); }catch(e){ off(); } }, 50);
  setTimeout(off, 120000);
}

/* ============================== 個人情報をかくす（AIに送る前に） ============================== */
var RS_SURNAMES = ('佐藤 鈴木 高橋 田中 伊藤 渡辺 渡邊 山本 中村 小林 加藤 吉田 山田 佐々木 山口 松本 井上 木村 斎藤 斉藤 清水 山崎 池田 橋本 ' +
  '阿部 石川 山下 中島 石井 小川 前田 岡田 長谷川 藤田 後藤 近藤 村上 遠藤 青木 坂本 福田 太田 西村 藤井 金子 岡本 藤原 中野 三浦 原田 ' +
  '中川 松田 竹内 小野 田村 中山 和田 石田 上田 柴田 酒井 宮崎 横山 高木 安藤 宮本 大野 小島 谷口 今井 工藤 高田 増田 丸山 杉山 村田 大塚 ' +
  '新井 小山 平野 藤本 河野 上野 野口 武田 松井 千葉 岩崎 菅原 久保 佐野 野村 松尾 菊地 菊池 杉本 市川 古川 大西 島田 水野 桜井 高野 ' +
  '吉川 山内 西田 飯田 西川 小松 北村 安田 五十嵐 川口 平田 中田 久保田 服部 岩田 土屋 川崎 福島 本田 樋口 秋山 田口 永井 山中 中西 吉村 ' +
  '石原 大橋 松岡 馬場 浅野 荒木 大久保 野田 小沢 田辺 川村 星野 黒田 尾崎 望月 永田 熊谷 内藤 松村 西山 大谷 平井 大島 岩本 片山 本間 ' +
  '早川 横田 岡崎 荒井 大石 鎌田 成田 宮田 小田 石橋 篠原 須藤 河合 大川').split(' ').sort(function(a, b){ return b.length - a.length; });
var RS_ROLE = /(患者|看護師|看護婦|看護学生|学生|家族|利用者|対象者|客|母|父|奥|夫|妻|息子|娘|子|兄|姉|弟|妹|孫|祖母|祖父|皆|本人|医師|医者|先生|主治医|担当|師長|主任|指導者|友人|同室者|隣人|旦那|主人|親|姪|甥|叔母|伯母|叔父|伯父|嫁|婿|嬢|彼|坊|神|王|医療者|職員|スタッフ|ヘルパー|ケアマネ|ケアマネジャー|薬剤師|療法士|栄養士|保健師|助産師|教員|同級生|後輩|先輩|とう|かあ|にい|ねえ|ばあ|じい|みな|赤|お医者|お客|お嬢|お坊)$/;
var RS_SAMA_OK = /(同|多|仕|模|異|一|左|神|王|今|有|文|図|態|紋|外|各|人)$/;
var RS_HOSP_OK = /^(大学|総合|精神科|療養型|療養|急性期|一般|地域|市民|公立|私立|専門|小児|こども|子ども|精神|救急|民間|同じ|他|別|大きな|近くの|前の|かかりつけの|実習|実習先の|[A-ZＡ-Ｚ])$/;
var RS_NAME_WORD = /^(式|法|病|症|型|説|線|菜|反射|徴候|試験|検査|分類|理論|療法|県|市|町|村|区)/;
var RS_PHRASE = /(疲れ|苦労|世話|馳走|互い|気の毒|待ち遠|大事|仏|神|ナース|パパ|ママ|お客)$/;
var RS_AFTER =/(先生|医師|看護師|師長|主任|教授|准教授|講師|助教|氏|様|殿|家|宅|君)/;
function rsMask(text){
  var n = 0, s = String(text == null ? '' : text);
  var D = '[0-9０-９]';
  var rep = function(re, fn){ s = s.replace(re, function(){ var r = fn.apply(null, arguments); if(r !== arguments[0]) n++; return r; }); };
  /* 名札（氏名：〇〇・生年月日：〇〇・ID：〇〇） */
  rep(/(^|[^A-Za-z])(氏名|名前|患者名|本名|フルネーム|生年月日|誕生日|住所|電話番号|連絡先|カルテ番号|患者番号|診察券番号|患者ID|ID|ＩＤ)(\s*[:：]\s*|[ 　]+)([^\s、。,，\n]{1,24})/g,
    function(m, p, a, b){ return p + a + b + '＊＊'; });
  /* メール */
  rep(/[\w.+-]+@[\w-]+\.[\w.-]+/g, function(){ return '＊＊'; });
  /* 電話番号（0からはじまる9けた以上） */
  rep(new RegExp('(?:\\+81[-\\s]?|[0０])' + D + '{1,4}[-－−‐ー―\\s]?' + D + '{1,4}[-－−‐ー―\\s]?' + D + '{3,4}', 'g'), function(m){
    return (m.replace(/[^0-9０-９]/g, '').length >= 9) ? '＊＊' : m;
  });
  /* 生まれた日 */
  rep(new RegExp('(明治|大正|昭和|平成|令和|' + D + '{4}\\s*年)\\s*(?:' + D + '{1,2}|元)?\\s*年?\\s*' + D + '{1,2}\\s*月\\s*' + D + '{1,2}\\s*日\\s*(生まれ|生)', 'g'),
    function(m, a, b){ return '＊＊' + b; });
  /* 年齢（くわしい数字 → 〇〇代） */
  rep(new RegExp('(' + D + '{1,3})\\s*(歳|才)(?!\\s*(以上|以下|未満|から|まで|代|〜|～|~))', 'g'), function(m, num){
    var v = toNum(String(num).replace(/[０-９]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }));
    if(v >= 10) return (Math.floor(v / 10) * 10) + '代';
    if(v >= 6) return '学童期';
    if(v >= 1) return '幼児期';
    return '乳児期';
  });
  /* 住所（〇〇県〇〇市・〇丁目） */
  rep(/[一-鿿]{2,3}[都道府県][一-鿿]{1,6}[市区町村郡]/g, function(){ return '＊＊'; });
  rep(new RegExp(D + '{1,3}\\s*丁目(\\s*' + D + '{1,4}(\\s*[-－の]\\s*' + D + '{1,4})*)?', 'g'), function(){ return '＊＊'; });
  /* 病院の名前（「近くの病院」「大学病院」「B病院」などはそのまま） */
  rep(/([一-鿿々ぁ-んァ-ヶーA-Za-zＡ-Ｚａ-ｚ]{1,12})(病院|医院|クリニック|診療所|医療センター)/g, function(m, a, b){
    var sp = rsSplitParticle(a);
    if(!sp.core || RS_HOSP_OK.test(sp.core) || RS_HOSP_OK.test(a)) return m;
    return sp.pre + '＊＊' + b;
  });
  /* 部屋の番号 */
  rep(new RegExp(D + '{3,4}\\s*号室', 'g'), function(){ return '＊＊号室'; });
  /* 〇〇様・〇〇さん・〇〇氏（「患者さん」「お母さん」「同様」「様々」などはそのまま） */
  rep(/([一-鿿々ぁ-んァ-ヶー]{1,6})(様|さま|さん|氏|殿|くん|ちゃん)/g, function(m, a, b, off, all){
    var sp = rsSplitParticle(a);
    if(!sp.core || RS_ROLE.test(a) || RS_ROLE.test(sp.core) || RS_PHRASE.test(a)) return m;
    if(!/[一-鿿々ァ-ヶ]/.test(sp.core)) return m;         /* ひらがなだけ（たくさん・ごちそうさま）はそのまま */
    if(b === '様' && (RS_SAMA_OK.test(sp.core) || String(all).charAt(off + m.length) === '々')) return m;
    return sp.pre + '＊＊' + b;
  });
  /* よくある名字＋名前（例：山田太郎）。「長谷川式」「田中ビネー」などの用語はそのまま */
  rep(new RegExp('(' + RS_SURNAMES.join('|') + ')([\\u4E00-\\u9FFF々]{0,3})', 'g'), function(m, a, b, off, all){
    if(RS_NAME_WORD.test(b)) return m;
    if(!b && /^[ァ-ヶー]/.test(String(all).charAt(off + m.length))) return m;
    var role = b.match(RS_AFTER);
    if(role) return '＊＊' + b.slice(role.index);
    return '＊＊';
  });
  return { text:s, n:n };
}
/* 「市内の大きな」→ 前「市内の」＋のこり「大きな」（助詞のあとだけを名前として見る） */
function rsSplitParticle(a){
  var m = String(a).match(/^(.*[のにはがをでへともやか])?([^のにはがをでへともやか]*)$/);
  return m ? { pre:m[1] || '', core:m[2] || '' } : { pre:'', core:String(a) };
}

/* ============================== 外のサービスを読む ============================== */
async function rsFetch(url){
  try{ return await apiGet(url); }
  catch(e){
    if(!rsBridgeOk()) throw new Error('直接は読めませんでした。Google連携を新しい版にすると使えます（設定 › Google連携）。');
    throw new Error('読めませんでした：' + (e && e.message || e));
  }
}
async function rsFetchJson(url){
  var t = await rsFetch(url);
  if(t && typeof t === 'object') return t;
  try{ return JSON.parse(t); }catch(e){ throw new Error('答えの形が読めませんでした'); }
}
function rsXml(text){
  var d = new DOMParser().parseFromString(String(text || ''), 'application/xml');
  if(d.getElementsByTagName('parsererror').length) throw new Error('答えの形が読めませんでした');
  return d;
}
function rsKids(node, name){
  var out = [];
  if(!node || !node.getElementsByTagName) return out;
  var all = node.getElementsByTagName('*');
  for(var i = 0; i < all.length; i++){ if(all[i].localName === name || all[i].nodeName === name) out.push(all[i]); }
  return out;
}
function rsKid(node, name){ return rsKids(node, name)[0] || null; }
function rsTxt(node, name){ var k = name ? rsKid(node, name) : node; return k ? String(k.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
function rsYear(s){ return (String(s || '').match(/(1[89]|20)\d{2}/) || [''])[0]; }
function rsPages(sp, ep){ sp = String(sp || '').trim(); ep = String(ep || '').trim(); return sp ? (ep && ep !== sp ? sp + '-' + ep : sp) : ''; }

/* ----- PubMed（E-utilities） ----- */
var RS_EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
async function rsPubmed(q, start){
  var s = await rsFetchJson(RS_EUTILS + 'esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=20&retstart=' + (start || 0) + '&term=' + encodeURIComponent(q));
  var r = (s && s.esearchresult) || {}, ids = r.idlist || [];
  if(r.ERROR) throw new Error('PubMedがエラーを返しました：' + r.ERROR);
  if(!ids.length) return { total:toNum(r.count), list:[] };
  var sm = await rsFetchJson(RS_EUTILS + 'esummary.fcgi?db=pubmed&retmode=json&id=' + ids.join(','));
  var res = (sm && sm.result) || {};
  var list = ids.map(function(id){
    var x = res[id];
    if(!x || x.error) return null;
    var doi = ((x.articleids || []).filter(function(a){ return a.idtype === 'doi'; })[0] || {}).value || '';
    return { src:'pubmed', kind:'article', pmid:String(id), title:rsStrip(x.title) || '(題名なし)',
      authors:(x.authors || []).map(function(a){ return a.name; }).filter(Boolean),
      journal:x.source || x.fulljournalname || '', year:rsYear(x.pubdate || x.epubdate), vol:x.volume || '', issue:x.issue || '',
      pages:x.pages || '', doi:doi, url:'https://pubmed.ncbi.nlm.nih.gov/' + id + '/',
      hasAbs:(x.attributes || []).indexOf('Has Abstract') >= 0 };
  }).filter(Boolean);
  /* n … 読んだ件数（こわれた記録をのぞく前）。「つぎの20件」はここから */
  return { total:toNum(r.count), list:list, n:ids.length };
}
async function rsPubmedAbs(pmid){
  var x = rsXml(await rsFetch(RS_EUTILS + 'efetch.fcgi?db=pubmed&retmode=xml&rettype=abstract&id=' + encodeURIComponent(pmid)));
  /* OtherAbstract（ほかの言葉の要旨）はのぞき、Abstract の中だけを読む */
  var ab = rsKid(x, 'Abstract');
  return rsKids(ab, 'AbstractText').map(function(n){
    var lb = n.getAttribute('Label');
    return (lb ? lb + ': ' : '') + String(n.textContent || '').trim();
  }).join('\n');
}
/* ----- J-STAGE（WebAPI・XML） ----- */
async function rsJstage(q, start){
  var x = rsXml(await rsFetch('https://api.jstage.jst.go.jp/searchapi/do?service=3&count=20&start=' + ((start || 0) + 1) + '&keyword=' + encodeURIComponent(q)));
  var st = rsTxt(x, 'status');
  if(st && st !== '0') throw new Error('J-STAGEがエラーを返しました（' + (rsTxt(x, 'message') || st) + '）');
  var list = rsKids(x, 'entry').map(function(en){
    var at = rsKid(en, 'article_title'), au = rsKid(en, 'author'), mt = rsKid(en, 'material_title'), al = rsKid(en, 'article_link');
    var ja = au && rsKid(au, 'ja'), enA = au && rsKid(au, 'en');
    var holder = (ja && rsKids(ja, 'name').length) ? ja : enA;
    /* 題名には <sub> などのタグが文字のまま入ってくる（CDATA）。号の「0」は号なし */
    var no = rsTxt(en, 'number');
    return { src:'jstage', kind:'article', title:rsStrip(rsTxt(at, 'ja') || rsTxt(at, 'en') || rsTxt(en, 'title')) || '(題名なし)',
      authors:holder ? rsKids(holder, 'name').map(function(n){ return String(n.textContent || '').trim(); }).filter(Boolean) : [],
      journal:rsStrip(rsTxt(mt, 'ja') || rsTxt(mt, 'en')), year:rsTxt(en, 'pubyear'), vol:rsTxt(en, 'volume'), issue:no === '0' ? '' : no,
      pages:rsPages(rsTxt(en, 'startingPage'), rsTxt(en, 'endingPage')), doi:rsTxt(en, 'doi'),
      url:rsTxt(al, 'ja') || rsTxt(al, 'en') || rsTxt(en, 'id') };
  });
  return { total:toNum(rsTxt(x, 'totalResults')), list:list };
}
/* ----- CiNii Research（OpenSearch・JSON） ----- */
async function rsCinii(q, start, books){
  var j = await rsFetchJson('https://cir.nii.ac.jp/opensearch/' + (books ? 'books' : 'articles') + '?format=json&count=20&start=' + ((start || 0) + 1) + '&q=' + encodeURIComponent(q));
  var str = function(v){ return typeof v === 'string' ? v : (v && (v['@value'] || v.name)) || ''; };
  var list = ((j && j.items) || []).map(function(it){
    var isbn = '', doi = '';
    [].concat(it['dc:identifier'] || []).forEach(function(d){
      if(!d) return;
      var t = String(d['@type'] || ''), v = String(d['@value'] || '');
      if(/ISBN/i.test(t) && !isbn) isbn = v;
      if(/DOI/i.test(t) && !doi) doi = v;
    });
    return { src:books ? 'ciniib' : 'cinii', kind:books ? 'book' : 'article', title:rsStrip(str(it.title)) || '(題名なし)',
      authors:[].concat(it['dc:creator'] || []).map(str).filter(Boolean),
      journal:books ? '' : str(it['prism:publicationName']), publisher:str(it['dc:publisher']),
      year:rsYear(it['prism:publicationDate']), vol:str(it['prism:volume']), issue:str(it['prism:number']),
      pages:rsPages(it['prism:startingPage'], it['prism:endingPage']), doi:doi, isbn:isbn.replace(/[^0-9Xx]/g, ''),
      url:(it.link && it.link['@id']) || it['@id'] || '' };
  });
  return { total:toNum(j && j['opensearch:totalResults']), list:list };
}
/* ----- 国立国会図書館サーチ（OpenSearch・RSS） ----- */
function rsNdlItems(x){
  return rsKids(x, 'item').map(function(it){
    var isbn = '';
    rsKids(it, 'identifier').forEach(function(n){
      var ty = n.getAttribute('xsi:type') || (n.getAttributeNS ? n.getAttributeNS('http://www.w3.org/2001/XMLSchema-instance', 'type') : '') || '';
      if(/ISBN/i.test(ty) && !isbn) isbn = String(n.textContent || '');
    });
    var creators = rsKids(it, 'creator').map(function(n){ return String(n.textContent || '').trim(); }).filter(Boolean);
    return { src:'ndl', kind:'book', title:rsTxt(it, 'title') || '(題名なし)', authors:creators, publisher:rsTxt(it, 'publisher'),
      year:rsYear(rsTxt(it, 'date') || rsTxt(it, 'issued')), isbn:isbn.replace(/[^0-9Xx]/g, ''), price:toNum(rsTxt(it, 'price')),
      url:rsTxt(it, 'link') || rsTxt(it, 'guid') };
  });
}
async function rsNdl(q, start){
  var x = rsXml(await rsFetch('https://ndlsearch.ndl.go.jp/api/opensearch?mediatype=books&cnt=20&idx=' + ((start || 0) + 1) + '&title=' + encodeURIComponent(q)));
  return { total:toNum(rsTxt(x, 'totalResults')), list:rsNdlItems(x) };
}

/* ============================== ISBN ============================== */
function rsIsbnNorm(s){
  var d = String(s || '').replace(/[０-９Ｘｘ]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[^0-9Xx]/g, '').toUpperCase();
  if(d.length === 10 && /^\d{9}[\dX]$/.test(d)){
    var b = '978' + d.slice(0, 9), sum = 0;
    for(var i = 0; i < 12; i++) sum += (+b[i]) * (i % 2 ? 3 : 1);
    d = b + ((10 - sum % 10) % 10);
  }
  return d;
}
function rsIsbnOk(d){
  if(!/^97[89]\d{10}$/.test(d)) return false;
  var sum = 0;
  for(var i = 0; i < 12; i++) sum += (+d[i]) * (i % 2 ? 3 : 1);
  return (10 - sum % 10) % 10 === +d[12];
}
/* 1人の名前を整える（「石井, 範子, 1943-」→「石井範子」、「幸田,和久,pub.2018」→「幸田和久」） */
function rsPerson(a){
  a = String(a || '').trim();
  for(var i = 0; i < 3; i++) a = a.replace(/[,，]\s*(pub\.\s*)?(\d{4}\s*-?\s*(\d{4})?|-\s*\d{4})\s*$/i, '').trim();
  a = a.replace(/[,，]\s*$/, '').trim();
  return rsIsJa(a) ? a.replace(/[,，\s　]+/g, '') : a;
}
/* openBD の author（人と人は空白で区切る）を「・」でつなぐ */
function rsAuthorClean(s){
  return String(s || '').split(/\s+/).map(rsPerson).filter(Boolean).join('・');
}
async function rsOpenbd(isbn){
  var j = await rsFetchJson('https://api.openbd.jp/v1/get?isbn=' + isbn);
  var x = j && j[0];
  if(!x || !x.summary || !x.summary.title) return null;
  var s = x.summary, price = 0;
  try{ price = toNum(x.onix.ProductSupply.SupplyDetail.Price[0].PriceAmount); }catch(e){}
  return { title:s.title + (s.volume ? ' ' + s.volume : ''), author:rsAuthorClean(s.author), publisher:s.publisher || '', year:String(s.pubdate || '').slice(0, 4),
    cover:rsSafeUrl(s.cover), price:price };
}
async function rsGbooks(isbn){
  var j = await rsFetchJson('https://www.googleapis.com/books/v1/volumes?q=isbn:' + isbn);
  var v = j && j.items && j.items[0] && j.items[0].volumeInfo;
  if(!v || !v.title) return null;
  return { title:v.title + (v.subtitle ? ' ' + v.subtitle : ''), author:(v.authors || []).join('・'), publisher:v.publisher || '',
    year:String(v.publishedDate || '').slice(0, 4), cover:rsSafeUrl(v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail)), price:0 };
}
async function rsNdlIsbn(isbn){
  var x = rsXml(await rsFetch('https://ndlsearch.ndl.go.jp/api/opensearch?cnt=1&isbn=' + isbn));
  var it = rsNdlItems(x)[0];
  if(!it) return null;
  return { title:it.title, author:it.authors.map(rsPerson).filter(Boolean).slice(0, 3).join('・'), publisher:it.publisher, year:it.year, cover:'', price:it.price };
}
/* openBD → Google Books → 国会図書館 の順にさがす */
async function rsIsbnLookup(isbn){
  var tries = [['openBD', rsOpenbd], ['Google Books', rsGbooks], ['国会図書館', rsNdlIsbn]], errs = [];
  for(var i = 0; i < tries.length; i++){
    try{ var r = await tries[i][1](isbn); if(r) return { info:r, by:tries[i][0] }; }
    catch(e){ errs.push(e.message || String(e)); }
  }
  if(errs.length === tries.length) throw new Error(errs[0]);
  return null;
}

/* ============================== 参考文献の形 ============================== */
var RS_STYLES = [['jans', '日本看護科学学会ふう'], ['apa', 'APA'], ['sist', 'SIST02']];
function rsIsJa(s){ return /[ぁ-んァ-ヶ一-鿿]/.test(String(s || '')); }
function rsAuthorsOf(p){
  if(Array.isArray(p.authors) && p.authors.length) return p.authors.slice();
  return String(p.author || '').split(/[・,、;；]/).map(function(a){ return a.trim(); }).filter(Boolean);
}
function rsIsBook(p){ return p.kind === 'book' || p.status != null || (!p.journal && !!p.publisher); }
function rsApaName(n){
  n = String(n || '').trim();
  var m = n.match(/^(.+?)\s+([A-Z]{1,3})$/);
  return m ? m[1] + ', ' + m[2].split('').join('. ') + '.' : n;
}
function rsFormatRef(p, style){
  var au = rsAuthorsOf(p).map(function(a){ return rsIsJa(a) ? rsPerson(a) : a; }).filter(Boolean);
  var ja = rsIsJa(p.title) || rsIsJa(au.join('')), book = rsIsBook(p);
  var t = String(p.title || '').replace(/[.。．]$/, ''), src = p.journal || '';
  var pages = String(p.pages || '').replace(/[–−]/g, '-');
  if(style === 'apa'){
    var y1 = p.year || 'n.d.', names = au.slice(0, 20).map(rsApaName), a;
    if(!names.length) a = '';
    else if(names.length === 1) a = names[0];
    else a = names.slice(0, -1).join(', ') + ', & ' + names[names.length - 1];
    if(book) return (a ? a + ' ' : '') + '(' + y1 + '). ' + t + '. ' + (p.publisher || '') + '.';
    return (a ? a + ' ' : '') + '(' + y1 + '). ' + t + '. ' + src + (p.vol ? ', ' + p.vol + (p.issue ? '(' + p.issue + ')' : '') : '') +
      (pages ? ', ' + pages.replace(/-/g, '–') : '') + '.' + (p.doi ? ' https://doi.org/' + p.doi : '');
  }
  var y = p.year || (ja ? '発行年不明' : 'n.d.');
  if(style === 'sist'){
    var sa = au.slice(0, 3).join('; ') + (au.length > 3 ? (ja ? ' ほか' : ' et al') : '');
    if(book) return (sa ? sa + '. ' : '') + t + '. ' + (p.publisher || '') + ', ' + y + '.';
    return (sa ? sa + '. ' : '') + t + '. ' + src + '. ' + y + (p.vol ? ', vol. ' + p.vol : '') + (p.issue ? ', no. ' + p.issue : '') + (pages ? ', p. ' + pages : '') + '.';
  }
  /* 日本看護科学学会ふう：著者名（発行年）：表題，雑誌名，巻（号），頁-頁． */
  var jn = au.slice(0, 3).join(ja ? '，' : ', ') + (au.length > 3 ? (ja ? '，他' : ', et al.') : '');
  if(ja){
    if(book) return jn + '（' + y + '）：' + t + '，' + (p.publisher || '') + '．';
    return jn + '（' + y + '）：' + t + '，' + src + (p.vol ? '，' + p.vol + (p.issue ? '（' + p.issue + '）' : '') : '') + (pages ? '，' + pages : '') + '．';
  }
  if(book) return jn + ' (' + y + '): ' + t + ', ' + (p.publisher || '') + '.';
  return jn + ' (' + y + '): ' + t + ', ' + src + (p.vol ? ', ' + p.vol + (p.issue ? '(' + p.issue + ')' : '') : '') + (pages ? ', ' + pages : '') + '.';
}
/* 1件ずつ、要素がそろっているか・形にあっているか */
var RS_EL_NAME = { author:'著者', year:'年', title:'題名', source:'雑誌名・書名', volno:'巻号', pages:'ページ', publisher:'出版社', url:'URL', accessed:'閲覧日' };
function rsRefCheck(line, style){
  var raw = String(line || '').trim().replace(/^[\[［(（]?\s*\d{1,3}\s*[\]］)）.．]\s*/, '');
  var urlM = raw.match(/https?:\/\/\S+/);
  var noUrl = raw.replace(/https?:\/\/[^\s（(）)]+/g, ' ').replace(/doi:\s*\S+/ig, ' ');
  var noDate = noUrl.replace(/(19|20)\d{2}\s*[-/年.]\s*\d{1,2}\s*[-/月.]\s*\d{1,2}\s*日?/g, ' ');
  var has = {
    year:/(19|20)\d{2}/.test(noUrl),
    url:!!urlM || /doi\.org|doi:/i.test(raw),
    accessed:/(閲覧|参照|アクセス|accessed|retrieved|入手)/i.test(raw),
    volno:/\d+\s*[（(]\s*\d+(?:\s*[-–]\s*\d+)?\s*[)）]/.test(noDate) || /vol\.?\s*\d+/i.test(noDate) || /\d+\s*巻/.test(noDate) || /no\.\s*\d+/i.test(noDate) || /第?\s*\d+\s*号/.test(noDate),
    pages:/\d+\s*[-–−‐～〜]\s*\d+/.test(noDate.replace(/(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}/g, ' ')) || /pp?\.\s*\d+/i.test(noDate) || /\d+\s*(頁|ページ)/.test(noDate),
    publisher:/(出版|書院|書房|書店|社(?!会)|館|堂|Press|Publish|Elsevier|Springer|Wiley|Lippincott|Mosby|Saunders)/i.test(noUrl)
  };
  var segs = noUrl.split(/[．。.，,：:;；]|[（(]\s*(?:19|20)\d{2}[a-z]?\s*[)）]/).map(function(s){ return s.trim(); })
    .filter(function(s){ return s && !/^[\d\s\-–()（）]+$/.test(s) && !/^(vol|no|pp?)\.?$/i.test(s); });
  has.author = segs.length > 0 && !/^(19|20)\d{2}/.test(raw) && segs[0].length <= 80;
  has.title = segs.length >= 2 && segs.slice(1).some(function(s){ return s.length >= 4; });
  has.source = segs.length >= 3 || (has.publisher && segs.length >= 2);
  var type = has.url && !has.volno && !has.publisher ? 'web' : has.volno ? 'article' : has.publisher ? 'book' : has.pages ? 'article' : 'unknown';
  var need = { article:['author', 'year', 'title', 'source', 'volno', 'pages'], book:['author', 'year', 'title', 'publisher'],
               web:['author', 'title', 'url', 'accessed'], unknown:['author', 'year', 'title'] }[type];
  var styleOk = true, hint = '';
  if(style === 'apa'){
    styleOk = /^[^(（]{1,300}[(（]\s*((19|20)\d{2}[a-z]?|n\.d\.)(,[^)）]*)?\s*[)）]\s*[.．]/.test(raw);
    hint = type === 'book' ? 'Author, A. A. (2020). 書名. 出版社.' : 'Author, A. A., & Author, B. B. (2020). 題名. 雑誌名, 53(2), 100–110.';
  }else if(style === 'sist'){
    styleOk = /[.．]\s*(19|20)\d{2}\s*[,，]/.test(raw) || /[,，]\s*(19|20)\d{2}\s*[.．]?\s*$/.test(raw) || /[,，]\s*(19|20)\d{2}\s*[,，]/.test(raw);
    if(/^[^.．(（]{1,80}[(（]\s*(19|20)\d{2}\s*[)）]/.test(raw)) styleOk = false;
    hint = type === 'book' ? '著者名. 書名. 出版社, 出版年.' : '著者名. 論文名. 誌名. 出版年, vol. 巻, no. 号, p. はじめ-おわり.';
  }else{
    styleOk = /^[^（(]{1,120}[（(]\s*(19|20)\d{2}[a-z]?\s*[)）]\s*[:：]/.test(raw);
    hint = type === 'book' ? '著者名（発行年）：書名，出版社．' : type === 'web' ? '著者名（発行年）：題名，URL（閲覧日 2026年9月19日）．' : '著者名（発行年）：表題，雑誌名，巻（号），頁-頁．';
  }
  return { text:raw, type:type, has:has, need:need, miss:need.filter(function(k){ return !has[k]; }), styleOk:styleOk, hint:hint };
}
function rsRefLines(text){
  return String(text || '').split(/\n/).map(function(s){ return s.trim(); }).filter(function(s){ return s && !/^(参考文献|引用文献|文献|references?)\s*[:：]?$/i.test(s); });
}
/* 本文の引用（1) や [1] や（山田，2020））と、一覧の数が合っているか */
function rsCiteCheck(body, refs){
  body = String(body || '');
  var nums = {}, any = false;
  var addRange = function(s){
    String(s).split(/[,，、]/).forEach(function(part){
      var m = part.match(/(\d{1,3})\s*[-–−~〜～]\s*(\d{1,3})/);
      if(m){ var a = +m[1], b = +m[2]; if(b >= a && b - a < 50) for(var k = a; k <= b; k++) nums[k] = 1; }
      else{ var v = toNum(part); if(v > 0) nums[v] = 1; }
    });
    any = true;
  };
  body.replace(/([^\s\d(（=＝<>≦≧%％.．:：、，,])(\d{1,3}(?:\s*[-–−~〜～,，、]\s*\d{1,3})*)\s*[)）]/g, function(m, pre, g){ addRange(g); return m; });
  body.replace(/\[(\d{1,3}(?:\s*[-–,，]\s*\d{1,3})*)\]/g, function(m, g){ addRange(g); return m; });
  var ay = [];
  body.replace(/[（(]([^（）()\n\d]{1,30}?)[,，、\s]\s*((?:19|20)\d{2})[a-z]?[)）]/g, function(m, who, yr){ ay.push({ who:who.replace(/(ら|他|ほか|et al\.?)\s*$/, '').trim(), year:yr }); return m; });
  var lines = rsRefLines(refs), n = lines.length;
  var cited = Object.keys(nums).map(Number).sort(function(a, b){ return a - b; });
  var out = { numStyle:any, cited:cited, refs:n, over:[], unused:[], ay:ay.length, ayMiss:[] };
  if(any && n){
    out.over = cited.filter(function(v){ return v > n; });
    for(var i = 1; i <= n; i++) if(!nums[i]) out.unused.push(i);
  }
  ay.forEach(function(c){
    var key = c.who.slice(0, 2);
    if(!lines.some(function(l){ return l.indexOf(c.year) >= 0 && (!key || l.indexOf(key) >= 0); })) out.ayMiss.push(c.who + '，' + c.year);
  });
  return out;
}

/* ============================== レポートの数字 ============================== */
var RS_LONG = 80;
function rsReportStats(text, target){
  text = String(text || '').replace(/\r/g, '').replace(/\s+$/, '');
  var noWs = text.replace(/[\s　]/g, '').length, all = text.length;
  var lines = text ? text.split('\n') : [];
  var paras = lines.filter(function(l){ return l.replace(/[\s　]/g, ''); }).length;
  var rows = 0;
  lines.forEach(function(l){
    var s = l.replace(/[ \t]+$/, '');
    if(!s.replace(/[\s　]/g, '')){ rows += 1; return; }
    var body = s.replace(/^[ \t]+/, ''), len = body.length;
    if(!/^　/.test(body)) len += 1;                /* 段落のはじめは1マスあける */
    rows += Math.ceil(len / 20);
  });
  var sents = (text.match(/[^。！？!?\n]+[。！？!?]*/g) || []).map(function(s){ return s.trim(); }).filter(Boolean);
  var long = [], polite = [], plain = [], sum = 0;
  sents.forEach(function(s, i){
    var len = s.replace(/\s/g, '').length;
    sum += len;
    if(len > RS_LONG) long.push({ i:i + 1, len:len, text:s });
    if(!/[。！？!?]$/.test(s)) return;
    var e = s.replace(/[。！？!?」』）)]+$/, '');
    if(/(です|ます|でした|ました|ません|ませんでした|でしょう|ましょう|ください|ございます|ですか|ますか)$/.test(e)) polite.push(s);
    else plain.push(s);
  });
  var mixed = polite.length > 0 && plain.length > 0;
  var minority = polite.length <= plain.length ? 'polite' : 'plain';
  var n = text.length || 1, head = text.slice(0, Math.max(80, Math.floor(n * 0.25))), tail = text.slice(Math.floor(n * 0.75));
  var tgt = toNum(target);
  return {
    noWs:noWs, all:all, paras:paras, rows:rows, sheets:Math.ceil(rows / 20), sents:sents.length,
    avg:sents.length ? Math.round(sum / sents.length) : 0, long:long, polite:polite.length, plain:plain.length, mixed:mixed,
    minority:minority, minorityList:(minority === 'polite' ? polite : plain).slice(0, 3),
    intro:/(はじめに|序論|緒言|目的|背景|本レポートでは|このレポートでは)/.test(head),
    body:/(本論|方法|結果|考察|事例|について|第[一二三1-3]に|まず|次に)/.test(text) && paras >= 3,
    concl:/(おわりに|終わりに|結論|まとめ|結語|以上|このように|したがって|今後)/.test(tail),
    target:tgt, pct:tgt ? Math.round(noWs * 100 / tgt) : 0
  };
}

/* ============================== 看護過程のデータ ============================== */
var RS_FRAMES = {
  gordon:{ name:'ゴードンの11の機能的健康パターン', short:'ゴードン', pats:[
    ['g1', '健康知覚－健康管理', '病気や入院をどう受けとめているか・受診や服薬のしかた・たばこ・お酒・アレルギー'],
    ['g2', '栄養－代謝', '食事の量と内容・水分・身長と体重（BMI）・皮膚や口の中・体温・血液の検査（TP・Alb など）'],
    ['g3', '排泄', '便と尿の回数・量・性状・おなかの張り・下剤や利尿薬・おむつ'],
    ['g4', '活動－運動', '日常生活の動作（ADL）・歩き方・呼吸・脈拍・血圧・息切れ・転倒のおそれ'],
    ['g5', '睡眠－休息', '眠れているか・睡眠時間・眠剤・昼寝・休めている感じ'],
    ['g6', '認知－知覚', '意識・痛み・見る/聞く力・理解や記憶・しびれ'],
    ['g7', '自己知覚－自己概念', '自分のことをどう思っているか・不安・気分・ボディイメージの変化'],
    ['g8', '役割－関係', '家族・キーパーソン・仕事や学校での役割・面会・人との関わり'],
    ['g9', 'セクシュアリティ－生殖', '月経・妊娠・出産・性についての思い・パートナーとの関係'],
    ['g10', 'コーピング－ストレス耐性', 'ストレスの原因・いつもの対処のしかた・相談できる人'],
    ['g11', '価値－信念', '大事にしていること・信仰・治療や生き方への希望']
  ] },
  henderson:{ name:'ヘンダーソンの14の基本的欲求', short:'ヘンダーソン', pats:[
    ['h1', '正常に呼吸する', '呼吸の回数・リズム・SpO2・息苦しさ・痰'],
    ['h2', '適切に飲食する', '食事の量・水分・かむ/飲みこむ力・体重'],
    ['h3', 'あらゆる排泄経路から排泄する', '便・尿・汗の回数や性状'],
    ['h4', '身体の位置を動かし、よい姿勢を保つ', '歩く・すわる・寝返り・姿勢・転倒のおそれ'],
    ['h5', '睡眠と休息をとる', '眠れているか・休めているか'],
    ['h6', '適切な衣類を選び、着脱する', '自分で着がえられるか・衣類の工夫'],
    ['h7', '体温を正常な範囲に保つ', '体温・室温・衣類や寝具での調節'],
    ['h8', '身体を清潔に保ち、身だしなみを整え、皮膚を守る', '入浴・清拭・口の中・皮膚の状態'],
    ['h9', '環境の危険を避け、ほかの人を傷つけない', '転倒・感染・薬の管理・安全の理解'],
    ['h10', '気持ちや欲求を表して、ほかの人とコミュニケーションをとる', '話す・聞く・気持ちの表し方'],
    ['h11', '自分の信仰に従って礼拝する', '信仰・価値観・大事にしていること'],
    ['h12', '達成感をもたらす仕事をする', '役割・仕事・生きがい'],
    ['h13', '遊び・レクリエーションに参加する', '楽しみ・気分転換'],
    ['h14', '正常な発達と健康につながる学習をする', '病気や治療についての理解・学びたいこと']
  ] }
};
var RS_STEPS = [['info', '① 情報収集'], ['assess', '② アセスメント'], ['prob', '③ 看護問題'], ['goal', '④ 目標'], ['plan', '⑤ 計画'], ['eval', '⑥ 評価']];
function rsStepName(s){ var x = RS_STEPS.filter(function(a){ return a[0] === s; })[0]; return x ? x[1] : s; }
function rsFrame(d){ return RS_FRAMES[d && d.frame] || RS_FRAMES.gordon; }
function rsNpPat(d){
  var fr = rsFrame(d);
  return fr.pats.some(function(p){ return p[0] === rsSt.np.pat; }) ? rsSt.np.pat : fr.pats[0][0];
}
function rsNpProbs(d){ return ((d && d.probs) || []).filter(function(p){ return p && String(p.text || '').trim(); }); }
function rsNpProb(d){
  var ps = rsNpProbs(d);
  return ps.some(function(p){ return p.id === rsSt.np.prob; }) ? rsSt.np.prob : (ps[0] ? ps[0].id : '');
}
function rsNpStepHas(d, step){
  if(step === 'info') return rsAny(d.info);
  if(step === 'assess') return rsAny(d.assess);
  if(step === 'prob') return rsNpProbs(d).length > 0;
  if(step === 'goal') return rsAny(d.goals);
  if(step === 'plan') return rsAny(d.plans);
  return rsAny(d.evals);
}
function rsNpProgress(x){ return RS_STEPS.filter(function(s){ return rsNpStepHas(x, s[0]); }).length + '/6段'; }
function rsNpKey(d, step){ return step + ':' + ((step === 'info' || step === 'assess') ? rsNpPat(d) : step === 'prob' ? 'all' : rsNpProb(d)); }
function rsNpFix(d){
  ['info', 'assess', 'goals', 'plans', 'evals', 'coach'].forEach(function(k){ if(!d[k] || typeof d[k] !== 'object' || Array.isArray(d[k])) d[k] = {}; });
  if(!Array.isArray(d.probs)) d.probs = [];
  return d;
}
/* AIコーチに渡す文（その段だけ） */
function rsNpStepText(d, step){
  var fr = rsFrame(d), L = [];
  if(step === 'info' || step === 'assess'){
    var pid = rsNpPat(d), pat = fr.pats.filter(function(p){ return p[0] === pid; })[0];
    var inf = d.info[pid] || {}, as = d.assess[pid] || {};
    if(step === 'info' && !rsAny(inf)) return '';
    if(step === 'assess' && !rsAny(as)) return '';
    L.push('項目：' + pat[1]);
    L.push('S情報：' + (inf.s || '（なし）'));
    L.push('O情報：' + (inf.o || '（なし）'));
    if(step === 'assess'){
      L.push('解釈・分析：' + (as.interp || '（なし）'));
      L.push('原因・誘因：' + (as.cause || '（なし）'));
      L.push('なりゆき：' + (as.course || '（なし）'));
    }
    return L.join('\n');
  }
  var ps = rsNpProbs(d);
  if(step === 'prob'){
    if(!ps.length) return '';
    ps.forEach(function(p, i){ L.push('#' + (i + 1) + ' ' + p.text + (p.why ? '（根拠：' + p.why + '）' : '')); });
    var ass = fr.pats.map(function(p){ var a = d.assess[p[0]] || {}; return a.interp ? '・' + p[1] + '：' + rsClip(a.interp, 200) : ''; }).filter(Boolean);
    if(ass.length) L.push('\nアセスメントの要点：\n' + ass.join('\n'));
    return L.join('\n');
  }
  var id = rsNpProb(d), pr = ps.filter(function(p){ return p.id === id; })[0];
  if(!pr) return '';
  var g = d.goals[id] || {}, pl = d.plans[id] || {}, ev = d.evals[id] || '';
  if(step === 'goal' && !rsAny(g)) return '';
  if(step === 'plan' && !rsAny(pl)) return '';
  if(step === 'eval' && !rsAny(ev)) return '';
  L.push('看護問題：' + pr.text);
  L.push('長期目標：' + (g.long || '（なし）'));
  L.push('短期目標：' + (g.short || '（なし）') + (g.date ? '（評価日：' + g.date + '）' : ''));
  if(step !== 'goal'){ L.push('O-P：' + (pl.op || '（なし）')); L.push('T-P：' + (pl.tp || '（なし）')); L.push('E-P：' + (pl.ep || '（なし）')); }
  if(step === 'eval') L.push('評価：' + ev);
  return L.join('\n');
}
var RS_COACH_SYS = 'あなたは看護学部1年生の「看護過程」の考え方を育てるコーチです。学生が書いたものを読みます。' +
  '答え（アセスメントの文章・看護問題・目標・計画）をそのまま書いてはいけません。かわりに、' +
  '①できているところ（1〜2こ）②考えるヒント（2〜4こ。どんな視点で見るとよいか）③学生への問いかけ（2〜3こ。「〜はどうでしょう？」の形）' +
  '④足りないかもしれない情報の観点（0〜3こ）を、やさしい日本語で短く返します。S情報とO情報が正しく分けられているかも見ます。' +
  '医療の数値や薬にふれるときは「目安。教科書・先生の資料で確かめて」と添えます。患者さん個人を特定することは書きません。' +
  'JSONだけで返す：{"good":["…"],"hints":["…"],"questions":["…"],"missing":["…"]}';
function rsPlanFromNp(np, probId){
  var d = rsNpFix(rsCopy(np)), ps = rsNpProbs(d), pr = ps.filter(function(p){ return p.id === probId; })[0];
  if(!pr) return null;
  var i = ps.indexOf(pr), g = d.goals[probId] || {}, pl = d.plans[probId] || {};
  return { id:uid('km'), mt:Date.now(), mod:'research', type:'nplan', title:rsClip(pr.text, 60), problem:'#' + (i + 1) + ' ' + pr.text,
    long:g.long || '', shorts:[{ text:g.short || '', date:isYmd(g.date) ? g.date : '' }], op:pl.op || '', tp:pl.tp || '', ep:pl.ep || '',
    memo:'', from:np.id, ct:Date.now() };
}
function rsPlanText(p){
  var L = ['【看護問題】', p.problem || '', '', '【長期目標】', p.long || '', '', '【短期目標】'];
  (p.shorts || []).forEach(function(s){ if(s && (s.text || s.date)) L.push('・' + (s.text || '') + (s.date ? '（評価日：' + ymdLabel(s.date) + '）' : '')); });
  L.push('', '【O-P（観察計画）】', p.op || '', '', '【T-P（ケア計画）】', p.tp || '', '', '【E-P（教育計画）】', p.ep || '');
  if(p.memo) L.push('', '【メモ】', p.memo);
  return L.join('\n');
}
function rsPlanPrintHtml(p){
  var cell = function(s){ return '<td>' + esc(s || '') + '</td>'; };
  var shorts = (p.shorts || []).filter(function(s){ return s && (s.text || s.date); })
    .map(function(s){ return (s.text || '') + (s.date ? '\n（評価日：' + ymdLabel(s.date) + '）' : ''); }).join('\n\n');
  return '<table class="rs-ptable"><tr><th>看護問題</th><th>目標</th><th>O-P（観察計画）</th><th>T-P（ケア計画）</th><th>E-P（教育計画）</th></tr>' +
    '<tr>' + cell(p.problem) + cell('長期目標：\n' + (p.long || '') + '\n\n短期目標：\n' + shorts) + cell(p.op) + cell(p.tp) + cell(p.ep) + '</tr></table>' +
    (p.memo ? '<p class="rs-pmemo">' + esc(p.memo) + '</p>' : '');
}
function rsNpPrintHtml(d){
  d = rsNpFix(rsCopy(d));
  var fr = rsFrame(d), h = '<p>' + esc(fr.name) + '</p><h2>① 情報収集・② アセスメント</h2><table class="rs-ptable"><tr><th>項目</th><th>S情報</th><th>O情報</th><th>アセスメント</th></tr>';
  fr.pats.forEach(function(p){
    var inf = d.info[p[0]] || {}, as = d.assess[p[0]] || {};
    if(!rsAny(inf) && !rsAny(as)) return;
    h += '<tr><td>' + esc(p[1]) + '</td><td>' + esc(inf.s || '') + '</td><td>' + esc(inf.o || '') + '</td><td>' +
      esc([as.interp ? '解釈・分析：' + as.interp : '', as.cause ? '原因・誘因：' + as.cause : '', as.course ? 'なりゆき：' + as.course : ''].filter(Boolean).join('\n')) + '</td></tr>';
  });
  h += '</table><h2>③ 看護問題 〜 ⑥ 評価</h2>';
  rsNpProbs(d).forEach(function(p, i){
    var g = d.goals[p.id] || {}, pl = d.plans[p.id] || {};
    h += '<h3>#' + (i + 1) + ' ' + esc(p.text) + '</h3>' + (p.why ? '<p>根拠：' + esc(p.why) + '</p>' : '') +
      rsPlanPrintHtml({ problem:'#' + (i + 1) + ' ' + p.text, long:g.long, shorts:[{ text:g.short, date:g.date }], op:pl.op, tp:pl.tp, ep:pl.ep }) +
      (d.evals[p.id] ? '<p><b>評価：</b>' + esc(d.evals[p.id]) + '</p>' : '');
  });
  return h;
}
/* 書いているものを S にしまう（打つたびに S を変えず、少し待ってからまとめて） */
function rsNpStore(){
  var P = rsSt.np, changed = false;
  if(P.d && P.id && P.dirty){
    var it = rsItem(P.id);
    if(it){
      var c = rsCopy(P.d);
      Object.keys(c).forEach(function(k){ if(k !== 'id' && k !== 'mod' && k !== 'type' && k !== 'by' && k !== 'byAt') it[k] = c[k]; });
      it.mt = Date.now(); changed = true;
    }
    P.dirty = false;
  }
  if(P.pl && P.plId && P.plDirty){
    var ip = rsItem(P.plId);
    if(ip){
      var cp = rsCopy(P.pl);
      Object.keys(cp).forEach(function(k){ if(k !== 'id' && k !== 'mod' && k !== 'type' && k !== 'by' && k !== 'byAt') ip[k] = cp[k]; });
      ip.title = rsClip(String(cp.problem || '').replace(/^#\d+\s*/, '') || '看護計画', 60);
      ip.mt = Date.now(); changed = true;
    }
    P.plDirty = false;
  }
  return changed;
}
var rsSaveTimer = null;
function rsSoonSave(){
  clearTimeout(rsSaveTimer);
  rsSaveTimer = setTimeout(function(){
    rsSaveTimer = null;
    if(rsNpStore()){ persist(); pushRemote(); }
    ['rs_np_state', 'rs_pl_state'].forEach(function(id){ var st = document.getElementById(id); if(st) st.textContent = '保存しました'; });
  }, 4000);
}
/* iPhoneでほかのアプリに切りかえると、待っている間にアプリが止められることがある → 見えなくなったら、すぐしまう */
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState !== 'hidden') return;
  if(rsSaveTimer){ clearTimeout(rsSaveTimer); rsSaveTimer = null; if(rsNpStore()){ persist(); pushRemote(); } }
  if(rsRepKeep.t){ clearTimeout(rsRepKeep.t); rsRepKeep.t = null; rsRepSaveNow(); }
});
function rsNpOpen(id){
  var it = rsItem(id);
  if(!it) return false;
  if(rsNpStore()){ persist(); pushRemote(); }        /* 開いていた方の書きかけを先にしまう */
  var P = rsSt.np;
  P.id = id; P.d = rsNpFix(rsCopy(it)); P.step = 'info'; P.pat = ''; P.prob = ''; P.dirty = false; P.sent = ''; P.sentKey = ''; P.tab = 'proc';
  return true;
}
function rsPlOpen(id){
  var it = rsItem(id);
  if(!it) return false;
  if(rsNpStore()){ persist(); pushRemote(); }
  var P = rsSt.np;
  P.plId = id; P.pl = rsCopy(it); P.plDirty = false; P.tab = 'plan';
  if(!Array.isArray(P.pl.shorts) || !P.pl.shorts.length) P.pl.shorts = [{ text:'', date:'' }];
  return true;
}
async function rsNpCoach(){
  var P = rsSt.np, d = P.d;
  if(!d || P.busy) return;
  if(!aiReady()){ toast('先に設定タブでAI（Gemini）のカギを登録してください', true); return; }
  var id = P.id, step = P.step, key = rsNpKey(d, step), raw = rsNpStepText(d, step);
  if(!raw.trim()){ toast('先にこの段を書いてください', true); return; }
  var m = rsMask(raw);
  P.sent = m.text; P.masked = m.n; P.sentKey = key; P.busy = true;
  if(rsNpStore()){ persist(); pushRemote(); }
  render();
  try{
    /* 考えるモデルは、考えた分も maxTokens に入る → 少なすぎるとJSONがとちゅうで切れる */
    var t = await aiGenerate({ system:RS_COACH_SYS, json:true, temperature:0.4, maxTokens:4096, tag:'rs-coach',
      contents:[{ role:'user', parts:[{ text:'枠組み：' + rsFrame(d).name + '\n段：' + rsStepName(step) + '\n\n' + m.text }] }] });
    var j = parseJsonLoose(t) || {};
    var c = { at:Date.now(), good:rsStrs(j.good, 3), hints:rsStrs(j.hints, 5), questions:rsStrs(j.questions, 4), missing:rsStrs(j.missing, 4) };
    if(!c.good.length && !c.hints.length && !c.questions.length) throw new Error('AIの答えが空でした');
    if(P.id === id && P.d){ P.d.coach[key] = c; P.dirty = true; rsNpStore(); }
    else{ var it = rsItem(id); if(it){ it.coach = it.coach || {}; it.coach[key] = c; it.mt = Date.now(); } }
    persist(); pushRemote();
    toast('AIコーチからヒントがとどきました');
  }catch(e){
    toast('AIコーチにつながりませんでした：' + (e && e.message || e), true);
  }finally{
    P.busy = false; rsPaint();
  }
}

/* ============================== 画面：看護過程 ============================== */
function rsViewNp(){
  var P = rsSt.np;
  var h = '<div class="chips rs-tabs">' + rsChip('rs-np-tab', 'proc', '🩺 看護過程のコーチ', P.tab !== 'plan') + rsChip('rs-np-tab', 'plan', '📋 看護計画の枠', P.tab === 'plan') + '</div>';
  h += rsPrivacyBn();
  if(P.tab === 'plan') return h + rsViewPlan();
  if(P.id && P.d && rsItem(P.id)) return h + rsViewNpEdit();
  return h + rsViewNpList();
}
function rsViewNpList(){
  var P = rsSt.np, list = rsItems('nproc').sort(rsByMt);
  var h = section('書いている看護過程', list.length ? list.length + 'こ' : null, list.length ? list.map(function(x){
    return '<div class="row"><div class="grow"><div class="t">' + esc(x.title || '（題なし）') + '</div>' +
      '<div class="s">' + esc(rsFrame(x).short + '・' + rsNpProgress(rsNpFix(rsCopy(x))) + '・' + rsWhen(x.mt)) + '</div></div>' +
      '<button class="mini" data-act="rs-np-open" data-id="' + esc(x.id) + '">続きから</button>' +
      '<button class="mini" data-act="rs-np-del" data-id="' + esc(x.id) + '">消す</button></div>';
  }).join('') : '<div class="empty">まだありません。下から始めましょう。</div>');
  h += section('新しく始める', null,
    rsIn('np.newTitle', '例：肺炎で入院したA氏（80代）', '題（あとで見分けるため。名前は書かない）') +
    '<label class="f">情報の集め方（枠組み）</label><div class="chips">' +
      rsChip('rs-np-frame', 'gordon', 'ゴードン（11の機能的健康パターン）', P.newFrame !== 'henderson') +
      rsChip('rs-np-frame', 'henderson', 'ヘンダーソン（14の基本的欲求）', P.newFrame === 'henderson') + '</div>' +
    '<button class="btn" data-act="rs-np-new">始める</button>' +
    '<p class="note">①情報収集 → ②アセスメント → ③看護問題 → ④目標 → ⑤計画 → ⑥評価 の順に、1段ずつ書きます。' +
    '段ごとに「AIコーチ」がヒントと問いかけを返します（答えは書きません。自分で考える練習です）。書いたものは保存され、あとで続きから書けます。</p>');
  return h;
}
function rsViewNpEdit(){
  var P = rsSt.np, d = P.d, step = P.step, fr = rsFrame(d);
  var inner = rsIn('np.d.title', '題', '題') +
    '<div class="s2">' + esc(fr.name) + '</div>' +
    '<div class="chips rs-steps">' + RS_STEPS.map(function(s){ return rsChip('rs-np-step', s[0], s[1] + (rsNpStepHas(d, s[0]) ? ' ✓' : ''), step === s[0]); }).join('') + '</div>' +
    rsNpStepHtml(d, step, fr) + rsNpCoachHtml(d, step) +
    '<div class="pair rs-pair"><button class="btn ghost" data-act="rs-np-save">保存する</button>' +
    '<button class="btn ghost" data-act="rs-np-print">印刷する</button>' +
    '<button class="btn ghost" data-act="rs-np-back">一覧にもどる</button></div>';
  return rsHead(d.title || '看護過程', '<span id="rs_np_state">' + (P.dirty ? 'まだ保存していません' : '保存ずみ') + '</span>', inner);
}
function rsNpStepHtml(d, step, fr){
  if(step === 'info' || step === 'assess'){
    var pid = rsNpPat(d), pat = fr.pats.filter(function(p){ return p[0] === pid; })[0];
    var chips = '<div class="chips rs-pats">' + fr.pats.map(function(p, i){
      var has = step === 'info' ? rsAny(d.info[p[0]]) : rsAny(d.assess[p[0]]);
      return rsChip('rs-np-pat', p[0], (i + 1) + '. ' + p[1] + (has ? ' ●' : ''), p[0] === pid);
    }).join('') + '</div>';
    if(step === 'info'){
      return chips + '<p class="note">集める情報の例：' + esc(pat[2]) + '</p>' +
        rsTa('np.d.info.' + pid + '.s', '例：「夜は痛くて眠れない」と話す', 4, 'S情報（患者さんが話したこと）') +
        rsTa('np.d.info.' + pid + '.o', '例：夜の睡眠は3時間くらい。昼間うとうとしている', 4, 'O情報（見たこと・測ったこと・検査）');
    }
    var inf = d.info[pid] || {};
    return chips + '<div class="rs-ref"><div class="s2">「' + esc(pat[1]) + '」の情報</div><div class="rs-pre">' +
      ((inf.s || inf.o) ? esc('S：' + (inf.s || '（なし）') + '\nO：' + (inf.o || '（なし）')) : '（まだ情報がありません。① 情報収集で書けます）') + '</div></div>' +
      rsTa('np.d.assess.' + pid + '.interp', '正常とくらべてどうか・情報どうしのつながり', 4, '解釈・分析（この情報は何を意味する？）') +
      rsTa('np.d.assess.' + pid + '.cause', '例：手術のあとの痛み、環境の変化', 3, '原因・誘因（なぜそうなっている？）') +
      rsTa('np.d.assess.' + pid + '.course', '例：このままだと体力が落ちて…', 3, 'なりゆき（このままだとどうなる？）');
  }
  if(step === 'prob'){
    var probs = d.probs || [];
    return '<p class="note">アセスメントから、看護で解決したいこと（看護問題）を書き、大事な順にならべます。' +
      '順番の考え方の例：命にかかわること（呼吸・循環）→ 安全・安楽 → 生活や気持ちのこと（マズローの欲求の階層）。</p>' +
      (probs.length ? probs.map(function(p, i){
        return '<div class="rs-prob"><div class="rs-probh"><b>#' + (i + 1) + '</b>' +
          '<button class="mini" data-act="rs-np-pup" data-i="' + i + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="上へ">↑</button>' +
          '<button class="mini" data-act="rs-np-pdown" data-i="' + i + '"' + (i === probs.length - 1 ? ' disabled' : '') + ' aria-label="下へ">↓</button>' +
          '<button class="mini" data-act="rs-np-pdel" data-i="' + i + '">消す</button></div>' +
          rsTa('np.d.probs.' + i + '.text', '例：手術のあとの痛みに関連した睡眠パターンの混乱', 2, '看護問題') +
          rsTa('np.d.probs.' + i + '.why', '例：S「痛くて眠れない」、O 睡眠3時間 → …', 2, '根拠（どの情報・アセスメントから？）') + '</div>';
      }).join('') : '<div class="empty">まだありません。</div>') +
      '<button class="btn ghost" data-act="rs-np-padd">看護問題を足す</button>';
  }
  var ps = rsNpProbs(d);
  if(!ps.length) return '<div class="empty">先に「③ 看護問題」を書いてください。</div>';
  var id = rsNpProb(d), pr = ps.filter(function(p){ return p.id === id; })[0];
  var h = '<div class="chips">' + ps.map(function(p, i){ return rsChip('rs-np-prob', p.id, '#' + (i + 1) + ' ' + rsClip(p.text, 18), p.id === id); }).join('') + '</div>' +
    '<div class="rs-ref"><div class="s2">看護問題</div><div>' + esc(pr.text) + '</div></div>';
  if(step === 'goal'){
    return h + '<p class="note">主語は患者さん。「いつまでに・何が・どのくらい」できるかを、見て確かめられる形で書きます。</p>' +
      rsTa('np.d.goals.' + id + '.long', '例：退院までに、痛みとつきあいながら夜に眠れる', 2, '長期目標') +
      rsTa('np.d.goals.' + id + '.short', '例：3日後までに、夜に5時間以上続けて眠れたと話す', 2, '短期目標') +
      rsIn('np.d.goals.' + id + '.date', '', '短期目標の評価日', 'date');
  }
  if(step === 'plan'){
    return h + rsTa('np.d.plans.' + id + '.op', '例：睡眠時間、痛みの強さ（NRS）、表情、痛み止めを使った時間', 4, 'O-P（観察計画：何を見る・はかる？）') +
      rsTa('np.d.plans.' + id + '.tp', '例：眠る前に部屋を暗くする、痛み止めの時間を相談する', 4, 'T-P（ケア計画：何をする？）') +
      rsTa('np.d.plans.' + id + '.ep', '例：痛いときはがまんせずに伝えてよいことを話す', 3, 'E-P（教育計画：何を伝える・教える？）') +
      '<button class="btn ghost" data-act="rs-np-toplan" data-id="' + esc(id) + '">この問題を「看護計画の枠」にする</button>';
  }
  var g = d.goals[id] || {};
  return h + '<div class="rs-ref"><div class="s2">短期目標</div><div>' + esc(g.short || '（④ 目標で書けます）') + (g.date ? '（評価日：' + esc(ymdLabel(g.date)) + '）' : '') + '</div></div>' +
    rsTa('np.d.evals.' + id, '例：評価日に、夜は4時間眠れた。痛みは… → 計画を続ける／変える', 4, '評価（目標に届いた？ 計画はこのままでいい？）');
}
function rsListHtml(title, arr, cls){
  if(!arr || !arr.length) return '';
  return '<div class="rs-listh ' + (cls || '') + '">' + esc(title) + '</div><ul class="rs-list">' + arr.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
}
function rsNpCoachHtml(d, step){
  if(step !== 'info' && step !== 'assess' && step !== 'prob' && !rsNpProbs(d).length) return '';
  var P = rsSt.np, key = rsNpKey(d, step), c = d.coach[key];
  var h = '<div class="rs-coach"><div class="rs-coachhd"><b>🧑‍🏫 AIコーチ</b><span class="s2">答えではなく、考えるヒントを返します</span></div>';
  if(c){
    h += rsListHtml('できているところ', c.good, 'rs-okc') + rsListHtml('考えるヒント', c.hints) + rsListHtml('自分に聞いてみよう', c.questions) + rsListHtml('たりないかも？', c.missing) +
      '<div class="s2">' + esc(rsWhenTime(c.at)) + '</div>';
  }
  if(P.sent && P.sentKey === key){
    h += '<details class="rs-sent"><summary>AIに送った文を見る' + (P.masked ? '（' + P.masked + 'か所を＊＊にかくしました）' : '') + '</summary><div class="rs-pre">' + esc(P.sent) + '</div></details>';
  }
  h += aiReady() ? '<button class="btn" data-act="rs-np-coach"' + (P.busy ? ' disabled' : '') + '>' + (P.busy ? 'AIコーチが読んでいます…' : 'この段をAIコーチに見てもらう') + '</button>' : rsNoAi('AIコーチ');
  h += '<p class="note">医療の数値や薬のことは目安です。教科書・先生の資料で確かめてください。</p></div>';
  return h;
}
function rsViewPlan(){
  var P = rsSt.np;
  if(P.plId && P.pl && rsItem(P.plId)) return rsViewPlanEdit();
  var list = rsItems('nplan').sort(rsByMt);
  return section('看護計画の枠', list.length ? list.length + 'こ' : null,
    (list.length ? list.map(function(x){
      return '<div class="row"><div class="grow"><div class="t">' + esc(x.title || x.problem || '（看護問題なし）') + '</div><div class="s">' + esc(rsWhen(x.mt)) + '</div></div>' +
        '<button class="mini" data-act="rs-pl-open" data-id="' + esc(x.id) + '">開く</button>' +
        '<button class="mini" data-act="rs-pl-del" data-id="' + esc(x.id) + '">消す</button></div>';
    }).join('') : '<div class="empty">まだありません。</div>') +
    '<button class="btn" data-act="rs-pl-new">新しい枠を作る</button>' +
    '<p class="note">看護問題・長期目標・短期目標（評価日つき）・O-P（観察計画）・T-P（ケア計画）・E-P（教育計画）の枠に書けます。' +
    '看護過程のコーチの「⑤ 計画」からも作れます。</p>');
}
function rsViewPlanEdit(){
  var P = rsSt.np, p = P.pl, shorts = p.shorts || [];
  var inner = rsTa('np.pl.problem', '例：#1 手術のあとの痛みに関連した睡眠パターンの混乱', 2, '看護問題') +
    rsTa('np.pl.long', '例：退院までに、痛みとつきあいながら夜に眠れる', 2, '長期目標') +
    shorts.map(function(s, i){
      return '<div class="rs-prob">' + rsTa('np.pl.shorts.' + i + '.text', '例：3日後までに、夜に5時間以上眠れたと話す', 2, '短期目標 ' + (i + 1)) +
        rsIn('np.pl.shorts.' + i + '.date', '', '評価日', 'date') +
        (shorts.length > 1 ? '<button class="mini" data-act="rs-pl-sdel" data-i="' + i + '">この短期目標を消す</button>' : '') + '</div>';
    }).join('') +
    '<button class="mini" data-act="rs-pl-sadd">短期目標を足す</button>' +
    rsTa('np.pl.op', '見ること・はかること（例：睡眠時間、痛みの強さ）', 4, 'O-P（観察計画）') +
    rsTa('np.pl.tp', 'すること（例：眠る前の環境を整える）', 4, 'T-P（ケア計画）') +
    rsTa('np.pl.ep', '伝えること・教えること', 3, 'E-P（教育計画）') +
    rsTa('np.pl.memo', '', 2, 'メモ') +
    '<div class="pair rs-pair"><button class="btn" data-act="rs-pl-save">保存する</button>' +
    '<button class="btn ghost" data-act="rs-pl-copy">コピー</button>' +
    '<button class="btn ghost" data-act="rs-pl-print">印刷する</button>' +
    '<button class="btn ghost" data-act="rs-pl-back">一覧へ</button></div>' +
    '<p class="note">医療の数値や薬のことは目安です。教科書・先生の資料で確かめてください。</p>';
  return rsHead('看護計画', '<span id="rs_pl_state">' + (P.plDirty ? 'まだ保存していません' : '保存ずみ') + '</span>', inner);
}

/* ============================== 画面：レポート ============================== */
function rsRepSaveNow(){
  var R = rsSt.rep;
  rsLs('rep', { text:R.text, refs:R.refs, target:R.target, taskId:R.taskId, style:R.style });
}
function rsRepKeep(){
  clearTimeout(rsRepKeep.t);
  rsRepKeep.t = setTimeout(function(){ rsRepKeep.t = null; rsRepSaveNow(); }, 600);
}
function rsViewRep(){
  var R = rsSt.rep;
  var h = '<div class="chips rs-tabs">' + rsChip('rs-rep-tab', 'count', '文字数・構成', R.tab === 'count') + rsChip('rs-rep-tab', 'refs', '参考文献', R.tab === 'refs') +
    rsChip('rs-rep-tab', 'proof', 'AIで添削', R.tab === 'proof') + '</div>';
  if(R.tab === 'refs') return h + rsViewRefs();
  if(R.tab === 'proof') return h + rsViewProof();
  var notes = (S.notes || []).filter(function(n){ return n && String(n.body || '').trim(); }).slice().sort(rsByMt).slice(0, 60);
  var tasks = (S.tasks || []).filter(function(t){ return t && !t.done; }).slice().sort(function(a, b){ return String(a.due || '9').localeCompare(String(b.due || '9')); });
  if(R.taskId && !tasks.some(function(t){ return t.id === R.taskId; })){ var tk = (S.tasks || []).filter(function(t){ return t.id === R.taskId; })[0]; if(tk) tasks.unshift(tk); }
  h += section('レポートの文', null,
    (notes.length ? '<div class="field"><label class="f" for="rs_rep_note">メモから読みこむ</label><select id="rs_rep_note" data-rs-ch="rep-note"><option value="">メモを選ぶ…</option>' +
      notes.map(function(n){ return '<option value="' + esc(n.id) + '">' + esc(rsClip(n.title || '（題なし）', 30)) + '（' + String(n.body).length + '字）</option>'; }).join('') + '</select></div>' : '') +
    rsTa('rep.text', 'ここにレポートの文を貼りつける', 10, '文') +
    '<div class="grid2"><div class="field"><label class="f" for="rs_rep_task">課題と結びつける</label><select id="rs_rep_task" data-rs-ch="rep-task"><option value="">（結びつけない）</option>' +
      tasks.map(function(t){ var g = (S.kmData || {})['research:goal:' + t.id]; return '<option value="' + esc(t.id) + '"' + (t.id === R.taskId ? ' selected' : '') + '>' +
        esc(rsClip(t.title || '課題', 24) + (t.due ? '（' + ymdLabel(t.due) + '）' : '') + (g && g.n ? '・' + g.n + '字' : '')) + '</option>'; }).join('') + '</select></div>' +
    rsIn('rep.target', '例：2000', '目標の文字数', 'number', ' inputmode="numeric" min="0"') + '</div>' +
    (R.taskId ? '<button class="mini" data-act="rs-rep-goal">この課題の目標文字数として覚える</button>' : '') +
    '<div id="rs_rep_stats">' + rsRepStatsHtml() + '</div>');
  return h;
}
function rsMk(ok, mid){ return '<span class="rs-mk ' + (ok ? 'rs-ok">✓' : mid ? 'rs-mid">△' : 'rs-ng">✗') + '</span>'; }
function rsRepStatsHtml(){
  var R = rsSt.rep, st = rsReportStats(R.text, R.target);
  if(!st.all) return '<p class="note">文を貼ると、その場で数えます（AIは使いません）。</p>';
  var h = '<div class="grid3 keep3 rs-stats">' +
    '<div class="stat"><div class="s">文字数（空白・改行ぬき）</div><div class="v num">' + st.noWs + '</div></div>' +
    '<div class="stat"><div class="s">空白・改行こみ</div><div class="v num">' + st.all + '</div></div>' +
    '<div class="stat"><div class="s">原稿用紙（400字）</div><div class="v num">約' + st.sheets + '枚</div></div></div>' +
    '<div class="row"><div class="grow s">段落 ' + st.paras + '・文 ' + st.sents + '・1文の平均 ' + st.avg + '字</div><div class="s2">原稿用紙で' + st.rows + '行</div></div>';
  if(st.target){
    var over = st.pct > 110;
    h += '<div class="rs-goal"><div class="row"><div class="grow">目標 ' + st.target + '字に対して</div><b class="num">' + st.pct + '%</b></div>' +
      '<div class="rs-bar' + (over ? ' over' : '') + '"><i style="width:' + Math.min(100, st.pct) + '%"></i></div>' +
      '<div class="s2">' + (st.pct < 90 ? 'あと ' + (Math.ceil(st.target * 0.9) - st.noWs) + '字くらい（9割が目安）' : st.pct <= 100 ? 'ちょうどよい長さです' : over ? '長すぎるかも。けずれるところをさがしてみて' : '少しこえています') + '</div></div>';
  }
  h += '<div class="rs-checks">';
  h += '<div class="rs-chk">' + rsMk(!st.long.length, st.long.length <= 2) + '<div class="grow">' +
    (st.long.length ? '<b>長い文が' + st.long.length + 'こ</b>（' + RS_LONG + '字より長い）。2つに分けると読みやすくなります。' +
      '<ul class="rs-list">' + st.long.slice(0, 6).map(function(x){ return '<li>' + x.i + '文目（' + x.len + '字）：' + esc(rsClip(x.text, 40)) + '</li>'; }).join('') + '</ul>'
      : '長すぎる文はありません') + '</div></div>';
  h += '<div class="rs-chk">' + rsMk(!st.mixed) + '<div class="grow">' +
    (st.mixed ? '<b>「です・ます」と「だ・である」がまざっています</b>（です・ます ' + st.polite + '文／だ・である ' + st.plain + '文）。レポートはふつう「だ・である」にそろえます。' +
      '<ul class="rs-list">' + st.minorityList.map(function(s){ return '<li>' + esc(rsClip(s, 50)) + '</li>'; }).join('') + '</ul>'
      : '文の終わりはそろっています（' + (st.polite ? 'です・ます' : 'だ・である') + '）') + '</div></div>';
  h += '<div class="rs-chk">' + rsMk(st.intro && st.body && st.concl, st.intro || st.concl) + '<div class="grow"><b>構成</b>：' +
    [['序論（はじめに・目的）', st.intro], ['本論', st.body], ['結論（おわりに・まとめ）', st.concl]].map(function(x){ return (x[1] ? '✓' : '△') + x[0]; }).join('　') +
    (!(st.intro && st.body && st.concl) ? '<div class="s2">△のところは、見出し（はじめに・おわりに など）や、つなぎのことば（まず・次に・このように）を入れると伝わりやすくなります。</div>' : '') + '</div></div>';
  h += '</div><p class="note">目安です。先生の指示（書き方の決まり）を優先してください。</p>';
  return h;
}
function rsViewRefs(){
  var R = rsSt.rep;
  return section('参考文献の書き方チェック', null,
    '<label class="f">形</label><div class="chips">' + RS_STYLES.map(function(s){ return rsChip('rs-rep-style', s[0], s[1], R.style === s[0]); }).join('') + '</div>' +
    rsTa('rep.refs', '1行に1件ずつ貼りつける', 8, '参考文献の一覧') +
    '<div class="pair rs-pair"><button class="btn ghost" data-act="rs-rep-pick">' + (R.pick ? '選ぶのをやめる' : '保存した論文・本から書き出す') + '</button></div>' +
    (R.pick ? rsRefPickHtml() : '') +
    '<div id="rs_rep_refres">' + rsRefsHtml() + '</div>');
}
function rsRefPickHtml(){
  var R = rsSt.rep, all = (S.papers || []).slice().sort(rsByMt).concat((S.books || []).slice().sort(rsByMt));
  if(!all.length) return '<p class="note">保存した論文・本がまだありません（「論文・本さがし」「教科書の本だな」で保存できます）。</p>';
  return '<div class="rs-pick">' + all.map(function(p){
    return '<label class="row"><input type="checkbox" data-act="rs-rep-picksel" data-id="' + esc(p.id) + '"' + (R.sel[p.id] ? ' checked' : '') + '>' +
      '<div class="grow"><div class="t">' + esc(rsClip(p.title, 60)) + '</div><div class="s">' + esc(rsFormatRef(p, R.style)) + '</div></div></label>';
  }).join('') + '<button class="btn" data-act="rs-rep-pickadd">チェックしたものを一覧に足す</button></div>';
}
function rsRefsHtml(){
  var R = rsSt.rep, lines = rsRefLines(R.refs);
  if(!lines.length) return '<p class="note">文献を貼ると、1件ずつ「そろっている要素」と「形」を見ます。</p>';
  var styleName = RS_STYLES.filter(function(s){ return s[0] === R.style; })[0][1];
  var h = lines.map(function(l, i){
    var c = rsRefCheck(l, R.style);
    return '<div class="rs-chk rs-refrow">' + rsMk(!c.miss.length && c.styleOk, !c.miss.length || c.styleOk) + '<div class="grow"><div>' + (i + 1) + '. ' + esc(rsClip(c.text, 120)) + '</div>' +
      '<div class="rs-tags"><span class="rs-tag">' + esc({ article:'論文', book:'本', web:'ウェブ', unknown:'種類がわからない' }[c.type]) + '</span>' +
      c.need.map(function(k){ return '<span class="rs-tag ' + (c.has[k] ? 'ok' : 'ng') + '">' + (c.has[k] ? '✓' : '✗') + esc(RS_EL_NAME[k]) + '</span>'; }).join('') +
      '<span class="rs-tag ' + (c.styleOk ? 'ok' : 'ng') + '">' + (c.styleOk ? '✓' : '△') + esc(styleName) + 'の形</span></div>' +
      (c.styleOk ? '' : '<div class="s2">形の例：' + esc(c.hint) + '</div>') + '</div></div>';
  }).join('');
  if(String(R.text || '').trim()){
    var cc = rsCiteCheck(R.text, R.refs), msg = [];
    if(cc.numStyle){
      msg.push('本文の引用番号：' + (cc.cited.length ? cc.cited.join(', ') : 'なし') + '／一覧：' + cc.refs + '件');
      if(cc.over.length) msg.push('<b>一覧にない番号</b>：' + cc.over.join(', '));
      if(cc.unused.length) msg.push('<b>本文で使っていない文献</b>：' + cc.unused.join(', ') + '番');
    }
    if(cc.ay) msg.push('本文の（著者，年）の引用：' + cc.ay + 'こ' + (cc.ayMiss.length ? '／<b>一覧に見つからない</b>：' + esc(cc.ayMiss.join('、')) : ''));
    if(!cc.numStyle && !cc.ay) msg.push('本文に引用のしるし（1) や（著者，年））が見つかりませんでした。');
    var good = (cc.numStyle || cc.ay) && !cc.over.length && !cc.unused.length && !cc.ayMiss.length;
    h += '<div class="rs-chk rs-citechk">' + rsMk(good, !good && (cc.numStyle || cc.ay)) + '<div class="grow"><b>本文の引用と一覧</b><div class="s">' + msg.join('<br>') + '</div></div></div>';
  }else{
    h += '<p class="note">「文字数・構成」の欄にレポートの文を貼ると、本文の引用番号と一覧の数が合っているかも見ます。</p>';
  }
  return h + '<p class="note">形は目安です。先生や学校の決まり（投稿規程など）を優先してください。</p>';
}
function rsViewProof(){
  var R = rsSt.rep, pr = R.proof;
  var h = rsPrivacyBn() + section('AIで添削', null,
    rsTa('rep.text', 'ここにレポートの文を貼りつける', 10, '文（「文字数・構成」と同じ文です）') +
    (aiReady() ? '<button class="btn" data-act="rs-rep-proof"' + (R.busy ? ' disabled' : '') + '>' + (R.busy ? 'AIが読んでいます…' : 'AIに添削してもらう') + '</button>' : rsNoAi('添削')) +
    '<p class="note">誤字・脱字、言い回し、構成、根拠の弱いところを、元の文の場所と直し方の一覧で返します（全部は書き直しません）。「直す」を押したものだけ本文に入ります。</p>' +
    (R.sent ? '<details class="rs-sent"><summary>AIに送った文を見る' + (R.masked ? '（' + R.masked + 'か所を＊＊にかくしました）' : '') + '</summary><div class="rs-pre">' + esc(rsClip(R.sent, 3000)) + '</div></details>' : ''));
  if(pr){
    h += section('直したほうがよいところ', pr.items.length + 'こ',
      (pr.overall ? '<div class="rs-ref">' + esc(pr.overall) + '</div>' : '') +
      (pr.items.length ? pr.items.map(function(it, i){
        var found = it.from && String(R.text).indexOf(it.from) >= 0;
        var canFix = it.replace && found && it.to && !it.done && !rsHasMaskMark(it);
        return '<div class="rs-fix' + (it.done || it.skip ? ' done' : '') + '"><span class="rs-tag">' + esc(it.kind || '直し') + '</span>' +
          (it.from ? '<div class="s">元の文：「' + esc(it.from) + '」' + (!found && !it.done ? '（本文に見つかりません）' : '') + '</div>' : '') +
          (it.to ? '<div>' + (it.replace ? '直し方：「' + esc(it.to) + '」' : '直し方のヒント：' + esc(it.to)) + '</div>' : '') +
          (it.why ? '<div class="s2">理由：' + esc(it.why) + '</div>' : '') +
          '<div class="rs-btns">' + (it.done ? '<span class="s2">直しました</span>' : it.skip ? '<span class="s2">そのままにしました</span>' :
            (canFix ? '<button class="mini" data-act="rs-rep-fix" data-i="' + i + '">直す</button>' : '') + '<button class="mini" data-act="rs-rep-skip" data-i="' + i + '">しない</button>') + '</div></div>';
      }).join('') : '<div class="empty">大きな直しはありませんでした。</div>'));
  }
  return h;
}
/* AIは＊＊にかくした文を読んでいるので、直し方に＊＊が入っていたら本文には入れない（本文の名前が＊＊になってしまう） */
function rsHasMaskMark(it){ return /＊＊/.test(String(it.to || '')) || /＊＊/.test(String(it.from || '')); }
async function rsRepProof(){
  var R = rsSt.rep;
  if(R.busy) return;
  if(!aiReady()){ toast('先に設定タブでAI（Gemini）のカギを登録してください', true); return; }
  var text = String(R.text || '').trim();
  if(!text){ toast('先に文を貼りつけてください', true); return; }
  var m = rsMask(text);
  R.sent = m.text; R.masked = m.n; R.busy = true; render();
  try{
    var t = await aiGenerate({ tag:'rs-proof', json:true, temperature:0.2, maxTokens:4096,
      system:'あなたは看護学部1年生のレポートを見る先生です。全部を書き直さず、直したほうがよいところだけを一覧にします。' +
        '種類（kind）は「誤字・脱字」「言い回し」「構成」「根拠」のどれか。from は本文の中の文字を、本文にある通りにそのまま写す（20〜60字くらい）。' +
        '誤字・脱字と言い回しは、to に置きかえる文を書き replace を true にする。構成・根拠は、to に直し方のヒントを書き replace を false にする。' +
        'why に短い理由。多くて15こ。overall に全体のひとこと（よいところ1つと、いちばん大事な直し1つ）。やさしい日本語で。' +
        'JSONだけ：{"overall":"…","items":[{"kind":"…","from":"…","to":"…","why":"…","replace":true}]}',
      contents:[{ role:'user', parts:[{ text:m.text.slice(0, 30000) }] }] });
    var j = parseJsonLoose(t) || {};
    R.proof = { overall:rsClip(j.overall || '', 400), items:(Array.isArray(j.items) ? j.items : []).slice(0, 20).map(function(x){
      return { kind:rsClip(x.kind || '', 12), from:String(x.from || ''), to:String(x.to || ''), why:rsClip(x.why || '', 200), replace:!!x.replace, done:0, skip:0 };
    }) };
    toast('添削の一覧がとどきました');
  }catch(e){
    toast('添削できませんでした：' + (e && e.message || e), true);
  }finally{
    R.busy = false; rsPaint();
  }
}

/* ============================== 画面：論文・本さがし ============================== */
var RS_SRCS = [['pubmed', 'PubMed', '英語の医学・看護の論文（アメリカの国立医学図書館）'], ['jstage', 'J-STAGE', '日本の学会誌の論文'],
  ['cinii', 'CiNii 論文', '日本の論文（国立情報学研究所）'], ['ciniib', 'CiNii 本', '大学図書館にある本'], ['ndl', '国会図書館', '日本で出た本（国立国会図書館サーチ）']];
function rsSrcName(k){ var s = RS_SRCS.filter(function(x){ return x[0] === k; })[0]; return s ? s[1] : k; }
function rsMetaLine(r){
  var a = rsAuthorsOf(r), au = a.slice(0, 3).join(', ') + (a.length > 3 ? ' ほか' : '');
  var vi = r.vol ? r.vol + (r.issue ? '(' + r.issue + ')' : '') : '';
  return [au, r.journal || r.publisher || '', r.year || '', vi, r.pages ? 'p.' + r.pages : ''].filter(Boolean).join('・');
}
function rsPaperFind(r){
  var t = norm(r.title || '');
  return (S.papers || []).filter(function(p){
    return (r.pmid && p.pmid === r.pmid) || (r.doi && p.doi && p.doi === r.doi) || (r.url && p.url === rsSafeUrl(r.url)) || (t && norm(p.title || '') === t);
  })[0] || null;
}
function rsBookFind(r){
  var isbn = rsIsbnNorm(r.isbn), t = norm(r.title || '');
  return (S.books || []).filter(function(b){ return (isbn && rsIsbnNorm(b.isbn) === isbn) || (t && norm(b.title || '') === t); })[0] || null;
}
function rsResKey(r){ return r.pmid || r.doi || r.url || r.title; }
async function rsFindRun(more){
  var F = rsSt.find;
  if(F.busy) return;
  /* 「つぎの20件」は、いま出ている一覧と同じことば・同じところでさがす（入力欄を書きかえていても混ぜない） */
  if(more && !(F.list.length && F.lastQ && F.resSrc)) return;
  var q = more ? F.lastQ : String(F.q || '').trim();
  if(!q){ toast('さがすことばを入れてください', true); return; }
  var src = more ? F.resSrc : F.src;
  F.busy = true; F.err = '';
  if(!more){ F.list = []; F.total = 0; F.abs = {}; F.next = 0; }
  rsPaint();
  try{
    var start = more ? (F.next || F.list.length) : 0;
    var r = src === 'pubmed' ? await rsPubmed(q, start) : src === 'jstage' ? await rsJstage(q, start) :
      src === 'cinii' ? await rsCinii(q, start, false) : src === 'ciniib' ? await rsCinii(q, start, true) : await rsNdl(q, start);
    F.total = r.total || r.list.length; F.list = (more ? F.list : []).concat(r.list); F.lastQ = q; F.resSrc = src;
    F.next = start + (r.n || r.list.length);
    if(!r.list.length && !more) F.err = '見つかりませんでした。ことばを変えてみてください。';
  }catch(e){
    F.err = (e && e.message) || String(e); F.resSrc = src;
  }finally{
    F.busy = false; rsPaint();
  }
}
async function rsFindKw(){
  var F = rsSt.find, q = String(F.q || '').trim();
  if(F.kwBusy) return;
  if(!q){ toast('日本語のことばを入れてください', true); return; }
  if(!aiReady()){ toast('先に設定タブでAI（Gemini）のカギを登録してください', true); return; }
  F.kwBusy = true; render();
  try{
    var j = await aiJson('看護学生がPubMedで論文をさがします。次の日本語のことばから、PubMedで使う英語の検索式を作ってください。' +
      'MeSHのことばがあれば使い、ANDやORでつなぎます。JSONだけ：{"query":"英語の検索式","words":[{"ja":"日本語","en":"英語"}]}\n\nことば：' + q, [], 'rs-kw');
    F.kw = { query:String(j.query || '').trim(), words:(Array.isArray(j.words) ? j.words : []).slice(0, 10).map(function(w){ return { ja:String(w.ja || ''), en:String(w.en || '') }; }) };
    if(!F.kw.query){ F.kw = null; throw new Error('ことばが作れませんでした'); }
  }catch(e){ toast('作れませんでした：' + (e && e.message || e), true); }
  finally{ F.kwBusy = false; rsPaint(); }
}
async function rsFindAbs(i){
  var F = rsSt.find, r = F.list[i];
  if(!r || !r.pmid || F.absBusy) return;
  F.absBusy = r.pmid; render();
  try{
    var a = await rsPubmedAbs(r.pmid);
    F.abs[rsResKey(r)] = a || '（要旨がありません）';
    var saved = rsPaperFind(r);
    if(saved && a && !saved.abstract){ saved.abstract = rsClip(a, 3000); saved.mt = Date.now(); persist(); pushRemote(); }
  }catch(e){ toast(e.message || String(e), true); }
  finally{ F.absBusy = ''; rsPaint(); }
}
function rsPaperFrom(r, abs){
  return { id:uid('pp'), mt:Date.now(), src:r.src || 'hand', title:String(r.title || ''), authors:rsAuthorsOf(r).slice(0, 30), journal:r.journal || '',
    year:r.year || '', vol:r.vol || '', issue:r.issue || '', pages:r.pages || '', doi:r.doi || '', url:rsSafeUrl(r.url), pmid:r.pmid || '',
    abstract:rsClip(abs || '', 3000), memo:'', ct:Date.now() };
}
function rsBookFrom(r){
  return { id:uid('bk'), mt:Date.now(), title:String(r.title || ''), author:rsAuthorsOf(r).map(rsPerson).filter(Boolean).slice(0, 4).join('・'),
    publisher:r.publisher || '', isbn:rsIsbnNorm(r.isbn), year:r.year || '', course:r.course || '', where:r.where || '家', status:r.status || '持っている',
    price:toNum(r.price), memo:r.memo || '', cover:rsSafeUrl(r.cover), ct:Date.now() };
}
function rsViewFind(){
  var F = rsSt.find, src = RS_SRCS.filter(function(s){ return s[0] === F.src; })[0] || RS_SRCS[0];
  var h = section('論文・本をさがす', null,
    '<div class="chips">' + RS_SRCS.map(function(s){ return rsChip('rs-find-src', s[0], s[1], F.src === s[0]); }).join('') + '</div>' +
    '<p class="note">' + esc(src[2]) + (F.src === 'pubmed' ? '。英語のことばでさがします。' : '。') + '</p>' +
    '<div class="pair"><input id="rs_find_q" data-rs="find.q" data-rs-enter="rs-find-go" enterkeyhint="search" value="' + esc(F.q) + '" placeholder="' +
      esc(F.src === 'pubmed' ? '例：pressure ulcer nursing' : F.src === 'ndl' || F.src === 'ciniib' ? '例：基礎看護技術' : '例：褥瘡 看護') + '">' +
    '<button class="btn" data-act="rs-find-go"' + (F.busy ? ' disabled' : '') + '>' + (F.busy ? 'さがしています…' : 'さがす') + '</button></div>' +
    (F.src === 'pubmed' ? (aiReady() ? '<button class="mini" data-act="rs-find-kw"' + (F.kwBusy ? ' disabled' : '') + '>' + (F.kwBusy ? '作っています…' : '日本語から英語のことばを作る（AI）') + '</button>' : '') +
      (F.kw ? '<div class="rs-ref"><div class="s2">英語の検索式</div><div><b>' + esc(F.kw.query) + '</b></div>' +
        (F.kw.words.length ? '<div class="rs-tags">' + F.kw.words.map(function(w){ return '<span class="rs-tag">' + esc(w.ja + '＝' + w.en) + '</span>'; }).join('') + '</div>' : '') +
        '<button class="mini" data-act="rs-find-kwuse">この式でさがす</button></div>' : '') : '') +
    (F.err ? rsBn('amber', esc(F.err)) : ''));
  if(F.list.length){
    h += section(rsSrcName(F.resSrc) + 'で見つかったもの', F.total + '件中 ' + F.list.length + '件',
      F.list.map(function(r, i){ return rsResRow(r, i); }).join('') +
      ((F.next || F.list.length) < F.total && F.list.length < 200 ? '<button class="btn ghost" data-act="rs-find-more"' + (F.busy ? ' disabled' : '') + '>つぎの20件</button>' : ''));
  }
  var pp = (S.papers || []).slice().sort(rsByMt);
  h += section('保存した論文', pp.length + '件', pp.length ? pp.map(rsPaperRow).join('') :
    '<div class="empty">まだありません。さがした結果の「保存する」で入ります。</div>');
  return h;
}
function rsResRow(r, i){
  var F = rsSt.find, key = rsResKey(r), abs = F.abs[key], book = r.kind === 'book', url = rsSafeUrl(r.url);
  var h = '<div class="rs-res"><div class="t">' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(r.title) + '</a>' : esc(r.title)) + '</div>' +
    '<div class="s">' + esc(rsMetaLine(r)) + (r.isbn ? '・ISBN ' + esc(r.isbn) : '') + '</div>';
  if(abs) h += '<div class="rs-abs rs-pre">' + esc(abs) + '</div>';
  h += '<div class="rs-btns">';
  if(book) h += rsBookFind(r) ? '<span class="s2">本だなにあります</span>' : '<button class="mini" data-act="rs-find-book" data-i="' + i + '">本だなに入れる</button>';
  else h += rsPaperFind(r) ? '<span class="s2">保存ずみ</span>' : '<button class="mini" data-act="rs-find-save" data-i="' + i + '">保存する</button>';
  if(r.src === 'pubmed' && !abs) h += '<button class="mini" data-act="rs-find-abs" data-i="' + i + '"' + (F.absBusy ? ' disabled' : '') + '>' + (F.absBusy === r.pmid ? '読んでいます…' : '要旨を読む') + '</button>';
  if(abs && abs.charAt(0) !== '（') h += '<button class="mini" data-act="rs-find-easy" data-i="' + i + '">やさしく説明（AI）</button>';
  return h + '</div></div>';
}
function rsPaperRow(p){
  var F = rsSt.find, url = rsSafeUrl(p.url);
  var h = '<div class="rs-res' + (F.hl === p.id ? ' rs-hl' : '') + '"><div class="t">' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(p.title) + '</a>' : esc(p.title)) + '</div>' +
    '<div class="s">' + esc(rsMetaLine(p)) + (p.src && p.src !== 'hand' ? '・' + esc(rsSrcName(p.src)) : '') + '</div>' +
    (p.easy ? '<div class="rs-abs rs-pre">' + esc(rsClip(p.easy, 600)) + '</div>' : '') +
    (p.memo && F.memoId !== p.id ? '<div class="rs-ref">' + esc(p.memo) + '</div>' : '');
  if(F.memoId === p.id) h += rsTa('find.memo', '読んで思ったこと・使いたいところ', 3, 'メモ') + '<button class="mini" data-act="rs-pp-memosave" data-id="' + esc(p.id) + '">メモを保存</button>';
  return h + '<div class="rs-btns">' +
    (F.memoId !== p.id ? '<button class="mini" data-act="rs-pp-memo" data-id="' + esc(p.id) + '">メモ</button>' : '') +
    '<button class="mini" data-act="rs-pp-cite" data-id="' + esc(p.id) + '">文献の形でコピー</button>' +
    (p.abstract ? '<button class="mini" data-act="rs-pp-easy" data-id="' + esc(p.id) + '">やさしく説明（AI）</button>' : '') +
    '<button class="mini" data-act="rs-pp-del" data-id="' + esc(p.id) + '">消す</button></div></div>';
}

/* ============================== 画面：教科書の本だな ============================== */
var RS_WHERE = ['家', '学校', 'ロッカー'], RS_STATUS = ['持っている', '買う予定', '借りている'];
function rsCourseNames(){
  var seen = {}, out = [];
  termCourses().forEach(function(c){ if(c.name && !seen[c.name]){ seen[c.name] = 1; out.push(c.name); } });
  (S.books || []).forEach(function(b){ if(b.course && !seen[b.course]){ seen[b.course] = 1; out.push(b.course); } });
  return out;
}
function rsBookNew(){ return { isbn:'', title:'', author:'', publisher:'', year:'', course:'', where:'家', status:'持っている', price:'', memo:'', cover:'' }; }
function rsViewBooks(){
  var B = rsSt.books, list = S.books || [];
  var buy = list.filter(function(b){ return b.status === '買う予定'; }), sum = buy.reduce(function(a, b){ return a + toNum(b.price); }, 0);
  var h = section('教科書の本だな', list.length + '冊',
    '<div class="grid3 keep3"><div class="stat"><div class="s">ぜんぶ</div><div class="v num">' + list.length + '</div></div>' +
    '<div class="stat"><div class="s">買う予定</div><div class="v num">' + buy.length + '</div></div>' +
    '<div class="stat"><div class="s">買う予定の合計</div><div class="v num">' + yen(sum) + '</div></div></div>' +
    (B.d ? '' : '<button class="btn" data-act="rs-bk-new">本を足す</button>'));
  if(B.d) h += rsBookForm();
  var names = rsCourseNames(), groups = {};
  list.forEach(function(b){ var c = b.course || ''; (groups[c] = groups[c] || []).push(b); });
  names.concat(['']).forEach(function(c){
    var g = groups[c];
    if(!g || !g.length) return;
    g = g.slice().sort(function(a, b){ return String(a.title || '').localeCompare(String(b.title || ''), 'ja'); });
    h += section(c ? shortName(c) : '授業なし', g.length + '冊', g.map(rsBookRow).join(''));
  });
  if(!list.length) h += '<p class="note">ISBN（本のうらの 978… の数字）を入れると、題名・著者・出版社が自動で入ります。バーコードの写真からも読めます。</p>';
  return h;
}
function rsBookRow(b){
  var cv = rsSafeUrl(b.cover);
  return '<div class="row rs-book' + (rsSt.books.hl === b.id ? ' rs-hl' : '') + '">' +
    (cv ? '<img class="rs-cover" src="' + esc(cv) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="rs-cover rs-nocover" aria-hidden="true">📘</span>') +
    '<div class="grow"><div class="t">' + esc(b.title || '（題名なし）') + '</div>' +
    '<div class="s">' + esc([b.author, b.publisher, b.year].filter(Boolean).join('・')) + '</div>' +
    '<div class="rs-tags"><span class="rs-tag' + (b.status === '買う予定' ? ' ng' : ' ok') + '">' + esc(b.status || '持っている') + '</span>' +
      '<span class="rs-tag">' + esc(b.where || '家') + '</span>' + (toNum(b.price) ? '<span class="rs-tag">' + esc(yen(b.price)) + '</span>' : '') + '</div>' +
    (b.memo ? '<div class="s2">' + esc(b.memo) + '</div>' : '') + '</div>' +
    '<button class="mini" data-act="rs-bk-edit" data-id="' + esc(b.id) + '">直す</button>' +
    '<button class="mini" data-act="rs-bk-del" data-id="' + esc(b.id) + '">消す</button></div>';
}
function rsBookForm(){
  var B = rsSt.books, d = B.d;
  return section(B.editId ? '本を直す' : '本を足す', null,
    '<div class="pair"><input id="rs_books_d_isbn" data-rs="books.d.isbn" data-rs-enter="rs-bk-isbn" inputmode="numeric" value="' + esc(d.isbn) + '" placeholder="ISBN（978…の13けた）">' +
    '<button class="btn" data-act="rs-bk-isbn"' + (B.busy ? ' disabled' : '') + '>ISBNで調べる</button></div>' +
    (aiReady() ? '<button class="mini" data-act="rs-bk-photo"' + (B.busy ? ' disabled' : '') + '>📷 バーコードの写真から読む（AI）</button>' : '') +
    (B.busy ? '<p class="note">調べています…</p>' : B.msg ? '<p class="note rs-bkmsg">' + esc(B.msg) + '</p>' : '') +
    (rsSafeUrl(d.cover) ? '<img class="rs-cover rs-coverbig" src="' + esc(rsSafeUrl(d.cover)) + '" alt="" referrerpolicy="no-referrer">' : '') +
    rsIn('books.d.title', '例：基礎看護技術Ⅰ', '題名') +
    '<div class="grid2">' + rsIn('books.d.author', '', '著者') + rsIn('books.d.publisher', '', '出版社') + '</div>' +
    '<div class="field"><label class="f" for="rs_books_d_course">授業</label><input id="rs_books_d_course" data-rs="books.d.course" list="rs_bk_clist" value="' + esc(d.course) + '" placeholder="授業の名前（なくてもよい）">' +
      '<datalist id="rs_bk_clist">' + rsCourseNames().map(function(c){ return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></div>' +
    '<label class="f">置き場所</label><div class="chips">' + RS_WHERE.map(function(w){ return rsChip('rs-bk-where', w, w, d.where === w); }).join('') + '</div>' +
    '<label class="f">いまは？</label><div class="chips">' + RS_STATUS.map(function(w){ return rsChip('rs-bk-status', w, w, d.status === w); }).join('') + '</div>' +
    rsIn('books.d.price', '例：3600', 'ねだん（円）', 'number', ' inputmode="numeric" min="0"') +
    rsTa('books.d.memo', '例：中古でOK・先輩にもらう', 2, 'メモ') +
    '<div class="pair rs-pair"><button class="btn" data-act="rs-bk-save">' + (B.editId ? '直す' : '本だなに入れる') + '</button>' +
    '<button class="btn ghost" data-act="rs-bk-cancel">やめる</button></div>');
}
async function rsBookIsbn(){
  var B = rsSt.books;
  if(!B.d || B.busy) return;
  var isbn = rsIsbnNorm(B.d.isbn);
  if(!rsIsbnOk(isbn)){ toast('ISBNの数字がちがうようです（978か979ではじまる13けた）', true); return; }
  var d0 = B.d;
  d0.isbn = isbn; B.busy = true; B.msg = ''; render();
  try{
    var r = await rsIsbnLookup(isbn);
    if(B.d !== d0) return;           /* 調べている間に「やめる」「本を足す」を押した → 別の下書きに入れない */
    if(!r){ B.msg = 'この本は見つかりませんでした。題名などを手で入れてください。'; }
    else{
      var d = d0, x = r.info;
      d.title = x.title || d.title; d.author = x.author || d.author; d.publisher = x.publisher || d.publisher;
      d.year = x.year || d.year; d.cover = x.cover || d.cover;
      if(!toNum(d.price) && x.price) d.price = String(x.price);
      B.msg = '「' + r.by + '」で見つかりました。まちがいがないか見てから入れてください。';
    }
  }catch(e){ if(B.d === d0) B.msg = (e && e.message) || String(e); }
  finally{ B.busy = false; rsPaint(); }
}
async function rsBookPhoto(files){
  var B = rsSt.books;
  if(B.busy) return;
  if(!B.d) B.d = rsBookNew();
  var d0 = B.d;
  B.busy = true; B.msg = ''; render();
  try{
    var url = typeof files[0] === 'string' ? files[0] : await resizeImage(files[0], 1600, 0.85);
    var j = await aiJson('この写真の本のバーコードまたはISBNの数字（978か979ではじまる13けた、または10けた）を読みとってください。' +
      'JSONだけ：{"isbn":"数字だけ"}。読めないときは {"isbn":""}', [url], 'rs-isbn');
    if(B.d !== d0){ B.busy = false; rsPaint(); return; }     /* とちゅうで「やめる」を押した */
    var isbn = rsIsbnNorm(j && j.isbn);
    if(!rsIsbnOk(isbn)) throw new Error('ISBNの数字を読みとれませんでした。明るいところで、バーコードを大きく写してください');
    d0.isbn = isbn; B.busy = false;
    await rsBookIsbn();
  }catch(e){ if(B.d === d0) B.msg = (e && e.message) || String(e); B.busy = false; rsPaint(); }
}
function rsBookSave(){
  var B = rsSt.books, d = B.d;
  if(!d) return;
  var title = String(d.title || '').trim();
  if(!title){ toast('題名を入れてください', true); return; }
  var fields = { title:title, author:String(d.author || '').trim(), publisher:String(d.publisher || '').trim(), isbn:rsIsbnNorm(d.isbn),
    year:String(d.year || ''), course:String(d.course || '').trim(), where:RS_WHERE.indexOf(d.where) >= 0 ? d.where : '家',
    status:RS_STATUS.indexOf(d.status) >= 0 ? d.status : '持っている', price:toNum(d.price), memo:String(d.memo || ''), cover:rsSafeUrl(d.cover) };
  var b = B.editId ? (S.books || []).filter(function(x){ return x.id === B.editId; })[0] : null;
  if(b){ Object.assign(b, fields, { mt:Date.now() }); toast('直しました'); }
  else{ S.books = S.books || []; S.books.push(Object.assign({ id:uid('bk'), mt:Date.now(), ct:Date.now() }, fields)); toast('本だなに入れました'); }
  B.d = null; B.editId = ''; B.msg = '';
  commit();
}

/* ============================== 画面：英語・翻訳 ============================== */
function rsViewEng(){
  var E = rsSt.eng;
  var h = '<div class="chips rs-tabs">' + rsChip('rs-eng-tab', 'easy', '英語の論文をやさしく', E.tab !== 'tr') + rsChip('rs-eng-tab', 'tr', '翻訳（DeepL）', E.tab === 'tr') + '</div>';
  if(E.tab === 'tr') return h + rsViewTr();
  var paper = E.paperId ? (S.papers || []).filter(function(p){ return p.id === E.paperId; })[0] : null;
  h += section('英語の論文をやさしく', null,
    (paper ? '<div class="rs-ref"><div class="s2">保存した論文</div>' + esc(paper.title) + '</div>' : '') +
    rsTa('eng.text', 'Abstract（要旨）などの英文を貼りつける', 8, '英語の文') +
    '<div class="pair rs-pair"><button class="btn ghost" data-act="rs-eng-file">📄 写真・PDFをえらぶ</button>' +
    (E.files.length ? '<button class="btn ghost" data-act="rs-eng-fclear">えらんだ' + E.files.length + 'こを外す</button>' : '') + '</div>' +
    (aiReady() ? '<button class="btn" data-act="rs-eng-go"' + (E.busy ? ' disabled' : '') + '>' + (E.busy ? 'AIが読んでいます…' : 'やさしく説明して（AI）') + '</button>' : rsNoAi('説明')) +
    '<p class="note">やさしい日本語の説明・要点3つ・大事な単語の一覧を作ります。単語は暗記カードにできます。</p>');
  var o = E.out;
  if(o){
    h += section('やさしい説明', null,
      (o.title ? '<div class="t rs-ttl">' + esc(o.title) + '</div>' : '') +
      '<div class="rs-pre">' + esc(o.ja) + '</div>' +
      (o.points.length ? '<div class="rs-listh">要点</div><ol class="rs-list">' + o.points.map(function(p){ return '<li>' + esc(p) + '</li>'; }).join('') + '</ol>' : '') +
      (paper ? '<button class="mini" data-act="rs-eng-paper">この説明を保存した論文につける</button>' : '') +
      '<p class="note">AIの説明です。大事なところは原文で確かめてください。医療の数値は目安です。</p>');
    if(o.words.length){
      h += section('大事な単語', o.words.filter(function(w){ return w.on; }).length + 'こ選択',
        o.words.map(function(w, i){
          return '<label class="row"><input type="checkbox" data-act="rs-eng-word" data-i="' + i + '"' + (w.on ? ' checked' : '') + '>' +
            '<div class="grow"><div class="t">' + esc(w.en) + '</div><div class="s">' + esc(w.ja + (w.note ? '（' + w.note + '）' : '')) + '</div></div></label>';
        }).join('') + '<button class="btn" data-act="rs-eng-cards">チェックした単語を暗記カードにする</button>');
    }
  }
  return h;
}
function rsViewTr(){
  var E = rsSt.eng, bridge = rsBridgeOk(), dl = rsLs('deepl');
  return section('翻訳', null,
    '<div class="chips">' + rsChip('rs-tr-dir', 'auto', '自動', E.dir === 'auto') + rsChip('rs-tr-dir', 'EN', '日本語→英語', E.dir === 'EN') + rsChip('rs-tr-dir', 'JA', '英語→日本語', E.dir === 'JA') + '</div>' +
    rsTa('eng.tr', '訳したい文', 6, '文') +
    '<p class="note">文はそのまま DeepL・AI に送られます。患者さんの名前など、個人の情報は入れないでください。</p>' +
    '<button class="btn" data-act="rs-tr-go"' + (E.trBusy ? ' disabled' : '') + '>' + (E.trBusy ? '訳しています…' : '翻訳する') + '</button>' +
    (E.trOut ? '<div class="rs-ref rs-trout"><div class="s2">' + esc(E.trBy) + 'で訳しました' + (E.trNote ? '（' + esc(E.trNote) + '）' : '') + '</div><div class="rs-pre">' + esc(E.trOut) + '</div>' +
      '<button class="mini" data-act="rs-copy" data-k="tr">コピー</button></div>' : '') +
    '<p class="note">' + (bridge ? (dl === 1 ? 'DeepLで訳します。うまくいかないときは AI（Gemini）で訳します。' : 'DeepLのカギは 設定 › DeepL（翻訳）で橋わたしに預けられます。無いときは AI（Gemini）で訳します。')
      : 'DeepLは、Google連携を新しい版にすると使えます。いまは AI（Gemini）で訳します。') + '</p>');
}
async function rsEngGo(){
  var E = rsSt.eng;
  if(E.busy) return;
  if(!aiReady()){ toast('先に設定タブでAI（Gemini）のカギを登録してください', true); return; }
  var text = String(E.text || '').trim();
  if(!text && !E.files.length){ toast('英文を貼るか、写真・PDFをえらんでください', true); return; }
  E.busy = true; render();
  try{
    var j = await aiJson('次の英語の論文（アブストラクトなど）を、看護学部1年生にわかるように、やさしい日本語で説明してください。' +
      '専門用語にはかんたんな説明をつけます。医療の数値は目安として書きます。' +
      'JSONだけ：{"title_ja":"題名の日本語訳（わかれば）","ja":"やさしい説明（300〜500字）","points":["要点1","要点2","要点3"],' +
      '"words":[{"en":"英単語","ja":"日本語の意味","note":"ひとこと（なくてもよい）"}]}。words は大事な単語を10こまで。' +
      (text ? '\n\n英文：\n' + text.slice(0, 20000) : ''), E.files, 'rs-easy');
    E.out = { title:rsClip(j.title_ja || '', 200), ja:String(j.ja || ''), points:rsStrs(j.points, 5),
      words:(Array.isArray(j.words) ? j.words : []).slice(0, 15).map(function(w){ return { en:rsClip(w.en || '', 80), ja:rsClip(w.ja || '', 120), note:rsClip(w.note || '', 120), on:1 }; })
        .filter(function(w){ return w.en && w.ja; }) };
    if(!E.out.ja){ E.out = null; throw new Error('説明が空でした'); }
  }catch(e){ toast('説明できませんでした：' + (e && e.message || e), true); }
  finally{ E.busy = false; rsPaint(); }
}
async function rsTranslate(text, target){
  var tried = '';
  if(rsBridgeOk() && rsLs('deepl') !== 0){
    try{
      var r = await gasCall('translate', { text:text, target:target });
      rsLs('deepl', 1);
      return { text:String(r.text || ''), by:'DeepL', note:'' };
    }catch(e){
      tried = (e && e.message) || String(e);
      if(/カギ/.test(tried)) rsLs('deepl', 0);
    }
  }
  if(!aiReady()) throw new Error(tried ? 'DeepLで訳せませんでした（' + tried + '）。AI（Gemini）のカギもありません。' : '翻訳には、DeepLのカギ（Google連携）か、AI（Gemini）のカギが必要です。');
  var out = await aiGenerate({ tag:'rs-tr', temperature:0.2, maxTokens:4096, contents:[{ role:'user', parts:[{ text:
    (target === 'EN' ? '次の日本語を、自然な英語に訳してください。' : '次の文を、自然でわかりやすい日本語に訳してください。') + '訳だけを返してください。\n\n' + text }] }] });
  return { text:String(out || '').trim(), by:'Gemini（AI）', note:tried ? 'DeepLは使えませんでした：' + rsClip(tried, 60) : '' };
}
async function rsTrGo(){
  var E = rsSt.eng, text = String(E.tr || '').trim();
  if(!text){ toast('訳したい文を入れてください', true); return; }
  if(E.trBusy) return;
  var target = E.dir === 'EN' || E.dir === 'JA' ? E.dir : (rsIsJa(text) ? 'EN' : 'JA');
  E.trBusy = true; render();
  try{
    var r = await rsTranslate(text, target);
    E.trOut = r.text; E.trBy = r.by; E.trNote = r.note;
  }catch(e){ toast((e && e.message) || String(e), true); }
  finally{ E.trBusy = false; rsPaint(); }
}

/* ============================== 画面：法令（e-Gov 法令API v2） ============================== */
var RS_EGOV = 'https://laws.e-gov.go.jp/api/2/';
var RS_LAWS = [
  ['323AC0000000203', '保健師助産師看護師法', '保助看法'], ['323AC0000000205', '医療法', '医療法'], ['323AC0000000201', '医師法', '医師法'],
  ['335AC0000000145', '医薬品、医療機器等の品質、有効性及び安全性の確保等に関する法律', '薬機法'],
  ['410AC0000000114', '感染症の予防及び感染症の患者に対する医療に関する法律', '感染症法'],
  ['325AC0100000123', '精神保健及び精神障害者福祉に関する法律', '精神保健福祉法'], ['409AC0000000123', '介護保険法', '介護保険法'],
  ['415AC0000000057', '個人情報の保護に関する法律', '個人情報保護法']
];
function rsLawText(n){
  if(typeof n === 'string') return n;
  if(!n || !Array.isArray(n.children) || n.tag === 'Rt') return '';
  var t = n.children.map(rsLawText).join('');
  return n.tag === 'Column' ? t + '　' : t;
}
function rsLawPara(n, lines, depth){
  var head = '', body = '', subs = [];
  (n.children || []).forEach(function(c){
    if(!c || typeof c === 'string') return;
    if(/(Num|Title)$/.test(c.tag)) head += rsLawText(c);
    else if(/Sentence$/.test(c.tag)) body += rsLawText(c).replace(/　$/, '');
    else if(c.tag === 'Item' || /^Subitem\d+$/.test(c.tag)) subs.push(c);
    else body += rsLawText(c);
  });
  lines.push(new Array(depth + 1).join('　') + (head ? head + '　' : '') + body);
  subs.forEach(function(s){ rsLawPara(s, lines, depth + 1); });
}
function rsLawParse(tree){
  var arts = [];
  var walk = function(n, chap){
    if(!n || typeof n !== 'object') return;
    if(n.tag === 'SupplProvision' || n.tag === 'TOC') return;
    if(n.tag === 'Chapter'){
      var ct = (n.children || []).filter(function(c){ return c && c.tag === 'ChapterTitle'; })[0];
      if(ct) chap = rsLawText(ct);
    }
    if(n.tag === 'Article'){
      var cap = '', title = '', lines = [];
      (n.children || []).forEach(function(c){
        if(!c || typeof c === 'string') return;
        if(c.tag === 'ArticleCaption') cap = rsLawText(c);
        else if(c.tag === 'ArticleTitle') title = rsLawText(c);
        else if(c.tag === 'Paragraph') rsLawPara(c, lines, 0);
      });
      arts.push({ num:String((n.attr && n.attr.Num) || ''), title:title, cap:cap, chap:chap || '', text:lines.join('\n').replace(/^　+/, '') });
      return;
    }
    (n.children || []).forEach(function(c){ walk(c, chap); });
  };
  walk(tree, '');
  return arts;
}
async function rsLawSearch(){
  var L = rsSt.law, q = String(L.q || '').trim();
  if(!q){ toast('さがすことばを入れてください', true); return; }
  if(L.busy) return;
  L.busy = true; L.err = ''; L.list = null; render();
  try{
    if(L.mode === 'word'){
      var j = await rsFetchJson(RS_EGOV + 'keyword?limit=20&keyword=' + encodeURIComponent(q));
      L.list = ((j && j.items) || []).map(function(it){
        var li = it.law_info || {}, ri = it.revision_info || it.current_revision_info || {};
        return { id:li.law_id, title:ri.law_title || '', num:li.law_num || '', hits:(it.sentences || []).slice(0, 3).map(function(s){
          return String(s.text || '').replace(/<span>/g, '【').replace(/<\/span>/g, '】').replace(/<[^>]+>/g, ''); }) };
      }).filter(function(x){ return x.id; });
    }else{
      var k = await rsFetchJson(RS_EGOV + 'laws?limit=30&law_title=' + encodeURIComponent(q));
      L.list = ((k && k.laws) || []).map(function(it){
        var li = it.law_info || {}, ri = it.current_revision_info || it.revision_info || {};
        return { id:li.law_id, title:ri.law_title || '', abbrev:ri.abbrev || '', num:li.law_num || '', type:li.law_type || '' };
      }).filter(function(x){ return x.id; }).sort(function(a, b){
        var sa = (a.title === q ? 0 : 2) + (a.type === 'Act' ? 0 : 1), sb = (b.title === q ? 0 : 2) + (b.type === 'Act' ? 0 : 1);
        return sa - sb;
      });
    }
    if(!L.list.length) L.err = '見つかりませんでした。ことばを変えてみてください。';
  }catch(e){ L.err = (e && e.message) || String(e); }
  finally{ L.busy = false; rsPaint(); }
}
async function rsLawOpen(id, title){
  var L = rsSt.law;
  if(!/^[0-9A-Za-z_]{8,40}$/.test(String(id || ''))) return;
  L.id = id; L.title = title || ''; L.filter = ''; L.show = 30; L.err = '';
  if(L.cache[id]){ L.arts = L.cache[id].arts; L.title = L.cache[id].title || L.title; render(); window.scrollTo(0, 0); return; }
  /* 読みこみ中のしるしは「さがす」（L.busy）とは別にする（とちゅうで一覧にもどったり、別の法令を開いても、まざらない） */
  L.arts = null; L.loading = id; render(); window.scrollTo(0, 0);
  try{
    var j = await rsFetchJson(RS_EGOV + 'law_data/' + encodeURIComponent(id));
    var arts = rsLawParse(j && j.law_full_text);
    if(!arts.length) throw new Error('条文を読みとれませんでした');
    var t = (j.revision_info && j.revision_info.law_title) || L.title;
    L.cache[id] = { arts:arts, title:t };
    if(L.id === id){ L.arts = arts; L.title = t; }
  }catch(e){ if(L.id === id) L.err = (e && e.message) || String(e); }
  finally{ if(L.loading === id) L.loading = ''; rsPaint(); }
}
function rsLawFilter(arts, f){
  f = String(f || '').trim();
  if(!f) return arts;
  var num = f.replace(/[０-９]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/^第|条$/g, '');
  if(/^\d+(_\d+)?$/.test(num)) return arts.filter(function(a){ return a.num === num || a.num.indexOf(num + '_') === 0; });
  var w = norm(f);
  return arts.filter(function(a){ return norm(a.title + a.cap + a.text).indexOf(w) >= 0; });
}
function rsLawArtsHtml(){
  var L = rsSt.law, arts = L.arts || [], list = rsLawFilter(arts, L.filter);
  var saved = {};
  rsItems('lawclip').forEach(function(c){ if(c.lawId === L.id) saved[c.num] = c.id; });
  if(!list.length) return '<div class="empty">当てはまる条文がありません。</div>';
  return '<div class="s2">' + list.length + '条' + (list.length > L.show ? '（はじめの' + L.show + '条）' : '') + '</div>' +
    list.slice(0, L.show).map(function(a){
      return '<div class="rs-art"><div class="rs-arth">' + esc(a.title) + (a.cap ? '　' + esc(a.cap) : '') + '</div>' +
        (a.chap ? '<div class="s2">' + esc(a.chap) + '</div>' : '') + '<div class="rs-pre">' + esc(a.text) + '</div>' +
        '<div class="rs-btns">' + (saved[a.num] ? '<span class="s2">保存ずみ</span>' : '<button class="mini" data-act="rs-law-clip" data-n="' + esc(a.num) + '">この条文を保存</button>') + '</div></div>';
    }).join('') +
    (list.length > L.show ? '<button class="btn ghost" data-act="rs-law-more">もっと見る</button>' : '');
}
function rsViewLaw(){
  var L = rsSt.law;
  var warn = '<p class="note">法令は改正されることがあります。e-Gov法令検索（デジタル庁）のいまの内容です。試験やレポートでは、授業の資料・最新の法令で確かめてください。</p>';
  if(L.id){
    var url = 'https://laws.e-gov.go.jp/law/' + encodeURIComponent(L.id);
    return rsHead(L.title || '法令', '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">e-Govで見る</a>',
      '<div class="pillrow"><button data-act="rs-law-back">‹ 法令の一覧</button></div>' +
      (L.loading === L.id ? '<p class="note">読みこんでいます…（大きな法令は少し時間がかかります）</p>' : '') +
      (L.err ? rsBn('amber', esc(L.err)) : '') +
      (L.arts ? rsIn('law.filter', '例：5（第5条）・守秘・免許', '条文の中をさがす（数字なら条の番号）') + '<div id="rs_law_arts">' + rsLawArtsHtml() + '</div>' : '') + warn);
  }
  var h = section('よく使う法令', null, '<div class="rs-lawbtns">' + RS_LAWS.map(function(l){
    return '<button class="mini" data-act="rs-law-open" data-id="' + l[0] + '" data-title="' + esc(l[1]) + '">' + esc(l[2]) + '</button>'; }).join('') + '</div>');
  h += section('法令をさがす', null,
    '<div class="chips">' + rsChip('rs-law-mode', 'title', '法令の名前で', L.mode !== 'word') + rsChip('rs-law-mode', 'word', '条文のことばで', L.mode === 'word') + '</div>' +
    '<div class="pair"><input id="rs_law_q" data-rs="law.q" data-rs-enter="rs-law-go" enterkeyhint="search" value="' + esc(L.q) + '" placeholder="' + (L.mode === 'word' ? '例：守秘義務' : '例：健康保険法') + '">' +
    '<button class="btn" data-act="rs-law-go"' + (L.busy ? ' disabled' : '') + '>' + (L.busy ? 'さがしています…' : 'さがす') + '</button></div>' +
    (L.err ? rsBn('amber', esc(L.err)) : '') +
    (L.list && L.list.length ? L.list.map(function(x){
      return '<div class="row"><div class="grow"><div class="t">' + esc(x.title) + (x.abbrev ? '（' + esc(String(x.abbrev).split(',')[0]) + '）' : '') + '</div>' +
        '<div class="s">' + esc(x.num) + '</div>' + (x.hits ? x.hits.map(function(t){ return '<div class="s2">' + esc(rsClip(t, 120)) + '</div>'; }).join('') : '') + '</div>' +
        '<button class="mini" data-act="rs-law-open" data-id="' + esc(x.id) + '" data-title="' + esc(x.title) + '">読む</button></div>';
    }).join('') : '') + warn);
  var clips = rsItems('lawclip').sort(rsByMt);
  if(clips.length){
    h += section('保存した条文', clips.length + 'こ', clips.map(function(c){
      return '<div class="rs-art"><div class="rs-arth">' + esc(c.law + '　' + c.title) + (c.cap ? '　' + esc(c.cap) : '') + '</div>' +
        '<div class="rs-pre">' + esc(c.text) + '</div><div class="rs-btns">' +
        '<button class="mini" data-act="rs-law-open" data-id="' + esc(c.lawId) + '" data-title="' + esc(c.law) + '">この法令を開く</button>' +
        '<button class="mini" data-act="rs-law-unclip" data-id="' + esc(c.id) + '">消す</button></div></div>';
    }).join(''));
  }
  return h;
}

/* ============================== 画面：講義の録音 ============================== */
var rsLecRec = null;
function rsLecMime(){
  if(!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
  var c = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for(var i = 0; i < c.length; i++){ try{ if(MediaRecorder.isTypeSupported(c[i])) return c[i]; }catch(e){} }
  return '';
}
/* 授業（選んでいなければ、今日の授業のはじめ。'-' は「選ばない」） */
function rsLecCourse(){
  var c = rsSt.lec.course;
  if(c === '-') return '';
  if(c) return c;
  var t = classesForDate(today())[0];
  return t ? t.name : '';
}
function rsLecKeep(){
  var L = rsSt.lec, done = L.segs.filter(function(s){ return s.st === 'done' && s.text; });
  rsLs('lec', done.length ? { course:L.course, segs:done.map(function(s){ return { text:s.text }; }), at:Date.now() } : null);
}
function rsLecText(){ return rsSt.lec.segs.filter(function(s){ return s.st === 'done'; }).map(function(s){ return s.text; }).join('\n'); }
function rsMmss(sec){ sec = Math.max(0, Math.floor(sec)); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + pad(m) : m) + ':' + pad(s); }
function rsLecTick(){
  var e = document.getElementById('rs_lec_time');
  if(e && rsSt.lec.rec) e.textContent = rsMmss((Date.now() - rsSt.lec.t0) / 1000);
}
var rsLecStarting = false;
async function rsLecStart(){
  var L = rsSt.lec;
  if(L.rec || rsLecStarting) return;           /* 2回押しても、マイクを2つ開かない */
  if(!aiReady()){ toast('AI（Gemini）のカギが無いので使えません', true); return; }
  if(!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia)){ L.err = 'この端末では録音が使えません。'; render(); return; }
  var stream;
  rsLecStarting = true;
  try{ stream = await navigator.mediaDevices.getUserMedia({ audio:true }); }
  catch(e){ L.err = 'マイクが使えません。端末の設定でマイクを許可してください。'; render(); return; }
  finally{ rsLecStarting = false; }
  if(L.rec){ rsLecEndStream(stream); return; }
  L.err = ''; L.sum = null; L.rec = true; L.t0 = Date.now();
  if(!L.course) L.course = rsLecCourse() || '-';
  var R = rsLecRec = { stream:stream, running:true, mr:null, segTimer:null, tick:setInterval(rsLecTick, 1000), wake:null };
  try{ if(navigator.wakeLock) navigator.wakeLock.request('screen').then(function(w){ if(rsLecRec === R) R.wake = w; else try{ w.release(); }catch(e){} }, function(){}); }catch(e){}
  rsLecNext();
  render();
}
function rsLecEndStream(stream){ try{ stream.getTracks().forEach(function(t){ t.stop(); }); }catch(e){} }
/* 録音をおしまいにして、マイクを閉じる（止めるボタン・止まってしまったとき） */
function rsLecClose(R){
  clearInterval(R.tick); clearTimeout(R.segTimer); clearTimeout(R.closeTimer);
  rsLecEndStream(R.stream);
  try{ if(R.wake) R.wake.release(); }catch(e){}
  if(rsLecRec === R) rsLecRec = null;
}
/* マイクが切れた・録音を始められない（iPhoneで画面を消した・ほかのアプリに切りかえた など） */
function rsLecFail(R, why){
  var cur = rsLecRec === R, L = rsSt.lec;
  R.running = false;
  rsLecClose(R);
  if(cur && L.rec){ L.rec = false; L.err = why; }
  rsPaint();
}
var RS_LEC_MAX = 3 * 3600000;   /* 止め忘れ（ほかの画面に行ったまま）でも、3時間で止める */
function rsLecNext(){
  var R = rsLecRec;
  if(!R || !R.running) return;
  if(Date.now() - rsSt.lec.t0 >= RS_LEC_MAX){ rsLecFail(R, '3時間たったので、録音を止めました。ここまでの分は文字にします。'); return; }
  var live = false;
  try{ live = R.stream.getAudioTracks().some(function(t){ return t.readyState === 'live'; }); }catch(e){}
  if(!live){ rsLecFail(R, '録音が止まりました（画面を消したり、ほかのアプリに切りかえると止まることがあります）。ここまでの分は文字にします。'); return; }
  var mime = rsLecMime(), mr, chunks = [];
  try{
    try{ mr = mime ? new MediaRecorder(R.stream, { mimeType:mime, audioBitsPerSecond:32000 }) : new MediaRecorder(R.stream); }
    catch(e){ mr = new MediaRecorder(R.stream); }
  }catch(e2){ rsLecFail(R, '録音を始められませんでした：' + ((e2 && e2.message) || e2)); return; }
  mr.ondataavailable = function(ev){ if(ev.data && ev.data.size) chunks.push(ev.data); };
  mr.onerror = function(ev){
    var er = ev && ev.error;
    try{ if(mr.state !== 'inactive') mr.stop(); }catch(e){}
    rsLecFail(R, '録音が止まりました：' + ((er && (er.message || er.name)) || 'エラー') + '。ここまでの分は文字にします。');
  };
  mr.onstop = function(){
    clearTimeout(R.segTimer);
    var type = String(mr.mimeType || mime || 'audio/webm').split(';')[0];
    if(chunks.length) rsLecAddSegment(new Blob(chunks, { type:type }));
    if(R.running) rsLecNext();
    else rsLecClose(R);
  };
  R.mr = mr;
  try{ mr.start(1000); }
  catch(e){ rsLecFail(R, '録音を始められませんでした：' + ((e && e.message) || e)); return; }
  R.segTimer = setTimeout(function(){ if(mr.state === 'recording') mr.stop(); }, Math.max(1, toNum(rsSt.lec.min) || 5) * 60000);
}
function rsLecStop(){
  var L = rsSt.lec, R = rsLecRec;
  L.rec = false;
  if(R){
    R.running = false; clearInterval(R.tick); clearTimeout(R.segTimer);
    try{
      if(R.mr && R.mr.state !== 'inactive'){
        R.mr.stop();
        /* 止まった知らせ（onstop）が来ないときも、マイクは必ず閉じる */
        R.closeTimer = setTimeout(function(){ rsLecClose(R); }, 8000);
      }
      else rsLecClose(R);
    }catch(e){ rsLecClose(R); }
  }
  render();
}
/* 区切りの音声を1つ受けとる（録音の区切りごとに呼ばれる。テストからも呼ぶ） */
function rsLecAddSegment(blob){
  var L = rsSt.lec;
  L.segs.push({ n:L.segs.length + 1, st:'wait', text:'', err:'', blob:blob });
  rsLecPump();
  rsPaint();
}
async function rsLecPump(){
  var L = rsSt.lec;
  if(L.busy) return;
  var seg = L.segs.filter(function(s){ return s.st === 'wait'; })[0];
  if(!seg) return;
  L.busy = true; seg.st = 'busy'; rsPaint();
  try{
    var url = await rsReadFile(seg.blob);
    var m = String(url).match(/^data:([^;,]*)[^,]*,(.*)$/);
    if(!m || !m[2]) throw new Error('録音を読めませんでした');
    var mime = (m[1] || seg.blob.type || 'audio/webm').split(';')[0];
    var text = await aiGenerate({ tag:'rs-lec-stt', temperature:0, maxTokens:8192, contents:[{ role:'user', parts:[
      { inline_data:{ mime_type:mime, data:m[2] } },
      { text:'これは看護学部の講義の録音（' + seg.n + 'つ目の区切り）です。話された内容を日本語の文字に起こしてください。' +
        '聞き取れないところは（…）と書きます。見出しや説明はつけず、文字起こしだけを返してください。' }
    ] }] });
    seg.text = String(text || '').trim(); seg.st = 'done'; seg.blob = null; seg.err = '';
    rsLecKeep();
  }catch(e){
    seg.st = 'err'; seg.err = (e && e.message) || String(e);
  }finally{
    L.busy = false; rsPaint();
    rsLecPump();
  }
}
async function rsLecSummary(){
  var L = rsSt.lec, text = rsLecText();
  if(L.sumBusy) return;
  if(!text.trim()){ toast('まだ文字になった部分がありません', true); return; }
  if(!aiReady()){ toast('AI（Gemini）のカギが無いので使えません', true); return; }
  L.sumBusy = true; render();
  try{
    var j = await aiJson('次は看護学部の講義（' + (rsLecCourse() || '授業') + '）の文字起こしです。学生の復習用に、やさしい日本語でまとめてください。' +
      '医療の数値や薬は「目安」とします。JSONだけ：{"title":"短い題","summary":"要約（200〜400字）","points":["大事なこと"],' +
      '"test":["テストに出そうなこと"],"words":[{"w":"むずかしい言葉・聞き取れなかった言葉","m":"かんたんな意味"}]}。points・test は5こまで、words は8こまで。\n\n' + text.slice(0, 60000), [], 'rs-lec-sum');
    L.sum = { title:rsClip(j.title || '', 60), summary:String(j.summary || ''), points:rsStrs(j.points, 8), test:rsStrs(j.test, 8),
      words:(Array.isArray(j.words) ? j.words : []).slice(0, 10).map(function(w){ return { w:rsClip(w.w || w.word || '', 60), m:rsClip(w.m || w.mean || '', 160) }; }).filter(function(w){ return w.w; }) };
    if(!L.sum.summary){ L.sum = null; throw new Error('要約が空でした'); }
  }catch(e){ toast('まとめられませんでした：' + (e && e.message || e), true); }
  finally{ L.sumBusy = false; rsPaint(); }
}
function rsLecNoteBody(){
  var L = rsSt.lec, s = L.sum || {}, b = [];
  b.push('【要約】', s.summary || '');
  if((s.points || []).length) b.push('', '【大事なこと】', s.points.map(function(x){ return '・' + x; }).join('\n'));
  if((s.test || []).length) b.push('', '【テストに出そうなこと】', s.test.map(function(x){ return '・' + x; }).join('\n'));
  if((s.words || []).length) b.push('', '【わからなかった言葉】', s.words.map(function(x){ return '・' + x.w + '：' + x.m; }).join('\n'), '（意味は目安。教科書・先生の資料で確かめて）');
  if(L.full){ var t = rsLecText(); b.push('', '【文字起こし】', t.length > 20000 ? t.slice(0, 20000) + '…（長いので省略）' : t); }
  return b.join('\n');
}
function rsLecSave(){
  var L = rsSt.lec;
  if(!L.sum){ toast('先に要約してください', true); return; }
  var course = rsLecCourse();
  var title = '🎙️ ' + (course ? shortName(course) + ' ' : '') + ymdLabel(today()) + (L.sum.title ? '　' + L.sum.title : '');
  S.notes.push({ id:uid('nt'), title:rsClip(title, 80), body:rsLecNoteBody(), pinned:0, checks:[], photos:[], link:course ? { type:'course', id:course } : null, ct:Date.now(), mt:Date.now() });
  L.segs = []; L.sum = null; rsLs('lec', null);
  toast('メモに保存しました');
  commit();
}
function rsViewLec(){
  var L = rsSt.lec, ai = aiReady();
  var today0 = classesForDate(today()).map(function(c){ return c.name; }), names = [], seen = {};
  today0.concat(termCourses().map(function(c){ return c.name; })).forEach(function(n){ if(n && !seen[n]){ seen[n] = 1; names.push(n); } });
  var cur = rsLecCourse();
  if(cur && !seen[cur]) names.push(cur);
  var h = rsBn('amber', '<b>録音は、先生の許可をとってからにしてください。</b>音声はこの端末にも残しません（文字にしたら消します）。録音中は画面をつけたままにしてください（消えると止まることがあります）。');
  if(!ai) h += rsBn('red', '<b>AI（Gemini）のカギが無いので、いまは使えません。</b>設定タブでカギを登録すると、録音を文字にして要約できます。');
  var segs = L.segs, done = segs.filter(function(s){ return s.st === 'done'; }).length, waiting = segs.some(function(s){ return s.st === 'wait' || s.st === 'busy'; });
  h += section('講義の録音', null,
    '<div class="field"><label class="f" for="rs_lec_course">授業</label><select id="rs_lec_course" data-rs="lec.course"' + (L.rec ? ' disabled' : '') + '>' +
      '<option value="-"' + (!cur ? ' selected' : '') + '>（授業を選ばない）</option>' +
      names.map(function(n){ return '<option value="' + esc(n) + '"' + (n === cur ? ' selected' : '') + '>' + esc(shortName(n)) + '</option>'; }).join('') + '</select></div>' +
    '<label class="f">区切りの長さ（この長さごとにAIで文字にします）</label><div class="chips">' +
      [3, 5, 10].map(function(m){ return rsChip('rs-lec-min', String(m), m + '分', toNum(L.min) === m, L.rec ? ' disabled' : ''); }).join('') + '</div>' +
    (L.rec
      ? '<div class="rs-rec"><div class="rs-time"><span class="rs-dot" aria-hidden="true"></span><span id="rs_lec_time">' + rsMmss((Date.now() - L.t0) / 1000) + '</span></div>' +
        '<div class="s2">録音しています（区切り ' + (segs.length + 1) + ' つ目）</div><button class="btn" data-act="rs-lec-stop">止める</button></div>'
      : (ai ? '<button class="btn" data-act="rs-lec-start">🎙️ 録音をはじめる</button>' : '')) +
    (L.err ? rsBn('amber', esc(L.err)) : ''));
  if(segs.length){
    h += section('区切りごとの進みぐあい', done + '/' + segs.length + ' できた', segs.map(function(s, i){
      var label = s.st === 'done' ? 'できた（' + s.text.length + '字）' : s.st === 'busy' ? '文字にしています…' : s.st === 'wait' ? '待っています' : '失敗：' + s.err;
      return '<div class="rs-seg"><b>区切り' + s.n + '</b><span class="grow ' + (s.st === 'err' ? 'rs-ng' : s.st === 'done' ? 'rs-ok' : '') + '">' + esc(label) + '</span>' +
        (s.st === 'err' && s.blob ? '<button class="mini" data-act="rs-lec-retry" data-i="' + i + '">やり直す</button>' : '') + '</div>';
    }).join('') +
    (done ? '<details class="rs-sent"><summary>文字起こしを見る</summary><div class="rs-pre">' + esc(rsClip(rsLecText(), 20000)) + '</div></details>' : '') +
    (!L.rec && done && ai ? '<button class="btn" data-act="rs-lec-sum"' + (L.sumBusy || waiting ? ' disabled' : '') + '>' +
      (L.sumBusy ? 'まとめています…' : waiting ? '文字にし終わるのを待っています…' : '要約する（大事なこと・テストに出そうなこと）') + '</button>' : '') +
    (!L.rec ? '<button class="btn ghost" data-act="rs-lec-clear">すてる</button>' : ''));
  }
  if(L.sum){
    var s = L.sum;
    h += section('まとめ（見てからメモに保存）', null,
      (s.title ? '<div class="t rs-ttl">' + esc(s.title) + '</div>' : '') + '<div class="rs-pre">' + esc(s.summary) + '</div>' +
      rsListHtml('大事なこと', s.points) + rsListHtml('テストに出そうなこと', s.test) +
      rsListHtml('わからなかった言葉', s.words.map(function(w){ return w.w + '：' + w.m; })) +
      '<label class="row"><input type="checkbox" data-rs="lec.full"' + (L.full ? ' checked' : '') + '><div class="grow">文字起こしの全文もメモに入れる</div></label>' +
      '<button class="btn" data-act="rs-lec-save">メモに保存（' + esc(cur ? shortName(cur) : '授業なし') + '）</button>' +
      '<p class="note">AIのまとめです。医療の数値や薬のことは目安なので、教科書・先生の資料で確かめてください。</p>');
  }
  return h;
}

/* ============================== 操作 ============================== */
function rsFindById(list, id){ return (S[list] || []).filter(function(x){ return x.id === id; })[0] || null; }
var RS_ACTS = {
  /* 全体検索から開く */
  'rs-open':function(ds){
    var tool = ds.tool || '', id = ds.id || '';
    appId = 'study'; studyTool = tool;
    if(tool === 'rs-np' && id){ var it = rsItem(id); if(it && it.type === 'nplan') rsPlOpen(id); else if(it) rsNpOpen(id); }
    if(tool === 'rs-find') rsSt.find.hl = id;
    if(tool === 'rs-books') rsSt.books.hl = id;
    if(tool === 'rs-law'){ var c = rsItem(id); if(c){ rsLawOpen(c.lawId, c.law); return; } }
    render(); window.scrollTo(0, 0);
  },
  /* 看護過程 */
  'rs-np-tab':function(ds){ var ch = rsNpStore(); rsSt.np.tab = ds.v === 'plan' ? 'plan' : 'proc'; if(ch) commit(); else render(); },
  'rs-np-frame':function(ds){ rsSt.np.newFrame = ds.v === 'henderson' ? 'henderson' : 'gordon'; render(); },
  'rs-np-new':function(){
    var P = rsSt.np, title = String(P.newTitle || '').trim() || '看護過程 ' + ymdLabel(today());
    var it = { id:uid('km'), mt:Date.now(), mod:'research', type:'nproc', title:rsClip(title, 60), frame:P.newFrame === 'henderson' ? 'henderson' : 'gordon',
      info:{}, assess:{}, probs:[], goals:{}, plans:{}, evals:{}, coach:{}, ct:Date.now() };
    S.kmItems = S.kmItems || [];
    S.kmItems.push(it);
    P.newTitle = '';
    rsNpOpen(it.id);
    commit(); window.scrollTo(0, 0);
  },
  'rs-np-open':function(ds){ if(rsNpOpen(ds.id)){ render(); window.scrollTo(0, 0); } },
  'rs-np-del':function(ds){
    var it = rsItem(ds.id);
    if(!it || !confirm('「' + (it.title || '看護過程') + '」を消しますか？')) return;
    if(rsSt.np.id === ds.id){ rsSt.np.id = ''; rsSt.np.d = null; }
    removeWithUndo('kmItems', ds.id, '看護過程を消しました');
    commit();
  },
  'rs-np-back':function(){ var ch = rsNpStore(); rsSt.np.id = ''; rsSt.np.d = null; if(ch) commit(); else render(); window.scrollTo(0, 0); },
  'rs-np-save':function(){ rsSt.np.dirty = true; rsNpStore(); commit(); toast('保存しました'); },
  'rs-np-step':function(ds){ if(rsNpStore()){ persist(); pushRemote(); } rsSt.np.step = ds.v; render(); },
  'rs-np-pat':function(ds){ rsSt.np.pat = ds.v; render(); },
  'rs-np-prob':function(ds){ rsSt.np.prob = ds.v; render(); },
  'rs-np-padd':function(){ var d = rsSt.np.d; if(!d) return; d.probs.push({ id:uid('rp'), text:'', why:'' }); rsSt.np.dirty = true; render(); },
  'rs-np-pup':function(ds){ rsNpMove(toNum(ds.i), -1); },
  'rs-np-pdown':function(ds){ rsNpMove(toNum(ds.i), 1); },
  'rs-np-pdel':function(ds){
    var d = rsSt.np.d, i = toNum(ds.i);
    if(!d || !d.probs[i]) return;
    if(String(d.probs[i].text || '').trim() && !confirm('この看護問題を消しますか？')) return;
    var id = d.probs[i].id;
    d.probs.splice(i, 1);
    delete d.goals[id]; delete d.plans[id]; delete d.evals[id];
    rsSt.np.dirty = true; rsNpStore(); commit();
  },
  'rs-np-coach':function(){ rsNpCoach(); },
  'rs-np-toplan':function(ds){
    rsSt.np.dirty = true; rsNpStore();
    var np = rsItem(rsSt.np.id), pl = np ? rsPlanFromNp(np, ds.id) : null;
    if(!pl){ toast('看護問題が見つかりません', true); return; }
    S.kmItems.push(pl);
    rsPlOpen(pl.id);
    toast('看護計画の枠を作りました');
    commit(); window.scrollTo(0, 0);
  },
  'rs-np-print':function(){ var d = rsSt.np.d; if(!d) return; rsSt.np.dirty = true; if(rsNpStore()) commit(); rsPrint(d.title || '看護過程', rsNpPrintHtml(d)); },
  'rs-pl-new':function(){
    var pl = { id:uid('km'), mt:Date.now(), mod:'research', type:'nplan', title:'看護計画', problem:'', long:'', shorts:[{ text:'', date:'' }], op:'', tp:'', ep:'', memo:'', from:'', ct:Date.now() };
    S.kmItems = S.kmItems || [];
    S.kmItems.push(pl); rsPlOpen(pl.id); commit(); window.scrollTo(0, 0);
  },
  'rs-pl-open':function(ds){ if(rsPlOpen(ds.id)){ render(); window.scrollTo(0, 0); } },
  'rs-pl-del':function(ds){
    var it = rsItem(ds.id);
    if(!it || !confirm('「' + (it.title || '看護計画') + '」を消しますか？')) return;
    if(rsSt.np.plId === ds.id){ rsSt.np.plId = ''; rsSt.np.pl = null; }
    removeWithUndo('kmItems', ds.id, '看護計画を消しました');
    commit();
  },
  'rs-pl-back':function(){ var ch = rsNpStore(); rsSt.np.plId = ''; rsSt.np.pl = null; if(ch) commit(); else render(); window.scrollTo(0, 0); },
  'rs-pl-save':function(){ rsSt.np.plDirty = true; rsNpStore(); commit(); toast('保存しました'); },
  'rs-pl-sadd':function(){ var p = rsSt.np.pl; if(!p) return; p.shorts = p.shorts || []; p.shorts.push({ text:'', date:'' }); rsSt.np.plDirty = true; render(); },
  'rs-pl-sdel':function(ds){ var p = rsSt.np.pl; if(!p || !p.shorts) return; p.shorts.splice(toNum(ds.i), 1); rsSt.np.plDirty = true; render(); },
  'rs-pl-copy':function(){ var p = rsSt.np.pl; if(p) rsCopyText(rsPlanText(p)); },
  'rs-pl-print':function(){ var p = rsSt.np.pl; if(!p) return; rsSt.np.plDirty = true; if(rsNpStore()) commit(); rsPrint('看護計画', rsPlanPrintHtml(p)); },
  /* レポート */
  'rs-rep-tab':function(ds){ rsSt.rep.tab = ds.v; render(); },
  'rs-rep-style':function(ds){ rsSt.rep.style = ds.v; rsRepKeep(); render(); },
  'rs-rep-goal':function(){
    var R = rsSt.rep, n = toNum(R.target);
    if(!R.taskId){ toast('課題を選んでください', true); return; }
    S.kmData = S.kmData || {};
    if(n > 0) S.kmData['research:goal:' + R.taskId] = { n:n, at:Date.now() };
    else delete S.kmData['research:goal:' + R.taskId];
    touch('kmData'); commit();
    toast(n > 0 ? '目標の文字数を覚えました（' + n + '字）' : '目標の文字数を消しました');
  },
  'rs-rep-pick':function(){ rsSt.rep.pick = !rsSt.rep.pick; rsSt.rep.sel = {}; render(); },
  'rs-rep-picksel':function(ds){ var s = rsSt.rep.sel; if(s[ds.id]) delete s[ds.id]; else s[ds.id] = 1; render(); },
  'rs-rep-pickadd':function(){
    var R = rsSt.rep, all = (S.papers || []).concat(S.books || []);
    var lines = all.filter(function(p){ return R.sel[p.id]; }).map(function(p){ return rsFormatRef(p, R.style); });
    if(!lines.length){ toast('書き出すものをチェックしてください', true); return; }
    R.refs = String(R.refs || '').replace(/\s+$/, '') + (String(R.refs || '').trim() ? '\n' : '') + lines.join('\n');
    R.pick = false; R.sel = {}; rsRepKeep(); render();
    toast(lines.length + '件を一覧に足しました');
  },
  'rs-rep-proof':function(){ rsRepProof(); },
  'rs-rep-fix':function(ds){
    var R = rsSt.rep, it = R.proof && R.proof.items[toNum(ds.i)];
    if(!it || it.done || !it.replace || !it.from || !it.to) return;
    if(rsHasMaskMark(it)){ toast('かくした文字（＊＊）が入っているので、自分で直してください', true); return; }
    var at = String(R.text).indexOf(it.from);
    if(at < 0){ toast('本文に見つかりませんでした', true); return; }
    R.text = R.text.slice(0, at) + it.to + R.text.slice(at + it.from.length);
    it.done = 1; rsRepKeep(); render(); toast('直しました');
  },
  'rs-rep-skip':function(ds){ var R = rsSt.rep, it = R.proof && R.proof.items[toNum(ds.i)]; if(it){ it.skip = 1; render(); } },
  /* 論文・本さがし */
  'rs-find-src':function(ds){ var F = rsSt.find; if(F.src === ds.v) return; F.src = ds.v; F.list = []; F.total = 0; F.err = ''; F.kw = null; F.abs = {}; render(); },
  'rs-find-go':function(){ rsFindRun(false); },
  'rs-find-more':function(){ rsFindRun(true); },
  'rs-find-kw':function(){ rsFindKw(); },
  'rs-find-kwuse':function(){ var F = rsSt.find; if(!F.kw) return; F.q = F.kw.query; rsFindRun(false); },
  'rs-find-abs':function(ds){ rsFindAbs(toNum(ds.i)); },
  'rs-find-save':function(ds){
    var F = rsSt.find, r = F.list[toNum(ds.i)];
    if(!r) return;
    if(rsPaperFind(r)){ toast('もう保存してあります'); return; }
    var abs = F.abs[rsResKey(r)];
    S.papers = S.papers || [];
    S.papers.push(rsPaperFrom(r, abs && abs.charAt(0) !== '（' ? abs : ''));
    toast('論文を保存しました'); commit();
  },
  'rs-find-book':function(ds){
    var r = rsSt.find.list[toNum(ds.i)];
    if(!r) return;
    if(rsBookFind(r)){ toast('もう本だなにあります'); return; }
    S.books = S.books || [];
    S.books.push(rsBookFrom(r));
    toast('本だなに入れました（授業は「教科書の本だな」で選べます）'); commit();
  },
  'rs-find-easy':function(ds){
    var F = rsSt.find, r = F.list[toNum(ds.i)];
    if(!r) return;
    var saved = rsPaperFind(r);
    rsEngOpen(F.abs[rsResKey(r)] || '', saved ? saved.id : '');
  },
  'rs-pp-memo':function(ds){ var p = rsFindById('papers', ds.id); if(!p) return; rsSt.find.memoId = p.id; rsSt.find.memo = p.memo || ''; render(); },
  'rs-pp-memosave':function(ds){
    var p = rsFindById('papers', ds.id);
    if(p){ p.memo = String(rsSt.find.memo || ''); p.mt = Date.now(); }
    rsSt.find.memoId = ''; rsSt.find.memo = ''; commit(); toast('メモを保存しました');
  },
  'rs-pp-cite':function(ds){ var p = rsFindById('papers', ds.id); if(p) rsCopyText(rsFormatRef(p, rsSt.rep.style)); },
  'rs-pp-easy':function(ds){ var p = rsFindById('papers', ds.id); if(p) rsEngOpen(p.abstract || '', p.id); },
  'rs-pp-del':function(ds){
    var p = rsFindById('papers', ds.id);
    if(!p || !confirm('「' + rsClip(p.title, 40) + '」を消しますか？')) return;
    removeWithUndo('papers', p.id, '論文を消しました'); commit();
  },
  /* 本だな */
  'rs-bk-new':function(){ var B = rsSt.books; B.d = rsBookNew(); B.editId = ''; B.msg = ''; render(); },
  'rs-bk-edit':function(ds){
    var b = rsFindById('books', ds.id);
    if(!b) return;
    var B = rsSt.books;
    B.d = Object.assign(rsBookNew(), rsCopy(b)); B.d.price = toNum(b.price) ? String(b.price) : ''; B.editId = b.id; B.msg = '';
    render(); window.scrollTo(0, 0);
  },
  'rs-bk-del':function(ds){
    var b = rsFindById('books', ds.id);
    if(!b || !confirm('「' + rsClip(b.title, 40) + '」を本だなから消しますか？')) return;
    removeWithUndo('books', b.id, '本を消しました'); commit();
  },
  'rs-bk-cancel':function(){ var B = rsSt.books; B.d = null; B.editId = ''; B.msg = ''; render(); },
  'rs-bk-isbn':function(){ rsBookIsbn(); },
  'rs-bk-photo':function(){
    if(!aiReady()){ toast('先に設定タブでAI（Gemini）のカギを登録してください', true); return; }
    rsPickFiles('image/*', false, rsBookPhoto);
  },
  'rs-bk-where':function(ds){ if(rsSt.books.d){ rsSt.books.d.where = ds.v; render(); } },
  'rs-bk-status':function(ds){ if(rsSt.books.d){ rsSt.books.d.status = ds.v; render(); } },
  'rs-bk-save':function(){ rsBookSave(); },
  /* 英語・翻訳 */
  'rs-eng-tab':function(ds){ rsSt.eng.tab = ds.v === 'tr' ? 'tr' : 'easy'; render(); },
  'rs-eng-file':function(){
    rsPickFiles('image/*,.pdf,application/pdf', true, async function(fs){
      try{
        /* AIに一度に送れるのは20MBくらいまで（文字にすると4/3倍になる）。PDFは合わせて12MBまで */
        var out = [], pdfBytes = 0;
        for(var i = 0; i < fs.length && i < 3; i++){
          var f = fs[i];
          if(/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)){
            pdfBytes += f.size || 0;
            if(pdfBytes > 12 * 1024 * 1024) throw new Error('PDFは合わせて12MBまでです（' + f.name + '）');
            /* iPhoneのファイルでは種類が空のことがある → PDFとして送る */
            out.push(String(await rsReadFile(f)).replace(/^data:[^;,]*/, 'data:application/pdf'));
          }else out.push(await resizeImage(f, 1800, 0.82));
        }
        rsSt.eng.files = out; rsPaint();
      }catch(e){ toast((e && e.message) || String(e), true); }
    });
  },
  'rs-eng-fclear':function(){ rsSt.eng.files = []; render(); },
  'rs-eng-go':function(){ rsEngGo(); },
  'rs-eng-word':function(ds){ var o = rsSt.eng.out, w = o && o.words[toNum(ds.i)]; if(w){ w.on = w.on ? 0 : 1; render(); } },
  'rs-eng-cards':function(){
    var o = rsSt.eng.out;
    if(!o) return;
    var list = o.words.filter(function(w){ return w.on; }).map(function(w){ return { q:w.en, a:w.ja + (w.note ? '（' + w.note + '）' : '') }; });
    if(!list.length){ toast('単語をチェックしてください', true); return; }
    var n = ankiAddMany('英語の論文', list, 'research');
    commit();
    toast(n ? n + '枚の暗記カードを作りました（科目「英語の論文」）' : 'もう同じカードがあります');
  },
  'rs-eng-paper':function(){
    var E = rsSt.eng, o = E.out, p = rsFindById('papers', E.paperId);
    if(!o || !p) return;
    p.easy = rsClip((o.title ? o.title + '\n' : '') + o.ja + (o.points.length ? '\n' + o.points.map(function(x){ return '・' + x; }).join('\n') : ''), 2000);
    p.mt = Date.now(); commit(); toast('論文に説明をつけました');
  },
  'rs-tr-dir':function(ds){ rsSt.eng.dir = ds.v; render(); },
  'rs-tr-go':function(){ rsTrGo(); },
  'rs-copy':function(ds){ if(ds.k === 'tr') rsCopyText(rsSt.eng.trOut); },
  /* 法令 */
  'rs-law-mode':function(ds){ var L = rsSt.law; L.mode = ds.v === 'word' ? 'word' : 'title'; L.list = null; L.err = ''; render(); },
  'rs-law-go':function(){ rsLawSearch(); },
  'rs-law-open':function(ds){ rsLawOpen(ds.id, ds.title || ''); },
  'rs-law-back':function(){ var L = rsSt.law; L.id = ''; L.arts = null; L.err = ''; render(); window.scrollTo(0, 0); },
  'rs-law-more':function(){ rsSt.law.show += 30; render(); },
  'rs-law-clip':function(ds){
    var L = rsSt.law, a = (L.arts || []).filter(function(x){ return x.num === ds.n; })[0];
    if(!a) return;
    S.kmItems = S.kmItems || [];
    S.kmItems.push({ id:uid('km'), mt:Date.now(), mod:'research', type:'lawclip', lawId:L.id, law:L.title, num:a.num, title:a.title, cap:a.cap, text:rsClip(a.text, 2000), ct:Date.now() });
    toast('条文を保存しました'); commit();
  },
  'rs-law-unclip':function(ds){ if(rsItem(ds.id)){ removeWithUndo('kmItems', ds.id, '条文を消しました'); commit(); } },
  /* 講義の録音 */
  'rs-lec-min':function(ds){ rsSt.lec.min = toNum(ds.v) || 5; render(); },
  'rs-lec-start':function(){ rsLecStart(); },
  'rs-lec-stop':function(){ rsLecStop(); },
  'rs-lec-retry':function(ds){ var s = rsSt.lec.segs[toNum(ds.i)]; if(s && s.blob){ s.st = 'wait'; s.err = ''; rsLecPump(); render(); } },
  'rs-lec-sum':function(){ rsLecSummary(); },
  'rs-lec-save':function(){ rsLecSave(); },
  'rs-lec-clear':function(){
    var L = rsSt.lec;
    if(L.segs.length && !confirm('文字起こしとまとめをすてますか？')) return;
    L.segs = []; L.sum = null; L.err = ''; rsLs('lec', null); render();
  },
  /* 設定：DeepLのカギ */
  'rs-deepl-set':function(){
    var inp = document.getElementById('rs_deepl_key'), key = inp ? String(inp.value || '').trim() : '';
    if(!key){ toast('DeepLのカギを入れてください', true); return; }
    if(!rsBridgeOk()){ toast('Google連携を新しい版にすると使えます', true); return; }
    if(inp) inp.value = '';
    return gasCall('deeplKeySet', { key:key }).then(function(){ rsLs('deepl', 1); toast('DeepLのカギを橋わたしに預けました'); render(); },
      function(e){ toast('預けられませんでした：' + ((e && e.message) || e), true); });
  },
  'rs-deepl-del':function(){
    if(!rsBridgeOk()){ toast('Google連携を新しい版にすると使えます', true); return; }
    return gasCall('deeplKeySet', { key:'' }).then(function(){ rsLs('deepl', 0); toast('DeepLのカギを消しました'); render(); },
      function(e){ toast('消せませんでした：' + ((e && e.message) || e), true); });
  }
};
function rsNpMove(i, dir){
  var d = rsSt.np.d;
  if(!d) return;
  var j = i + dir;
  if(!d.probs[i] || !d.probs[j]) return;
  var t = d.probs[i]; d.probs[i] = d.probs[j]; d.probs[j] = t;
  rsSt.np.dirty = true; render();
}
function rsEngOpen(text, paperId){
  var E = rsSt.eng;
  E.tab = 'easy'; E.text = String(text || ''); E.paperId = paperId || ''; E.out = null; E.files = [];
  studyTool = 'rs-eng'; render(); window.scrollTo(0, 0);
}
function rsAct(act, t, e){
  var fn = RS_ACTS[act];
  if(!fn) return false;
  fn((t && t.dataset) || {}, t, e);
  return true;
}
kmAction(function(act, t, e){
  if(act.indexOf('rs-') !== 0) return false;
  return rsAct(act, t, e);
});

/* ===== 入力欄（打ったそばから覚える・その場で数える） ===== */
function rsEdited(p){
  if(/^np\.d\./.test(p)){
    rsSt.np.dirty = true;
    var st = document.getElementById('rs_np_state'); if(st) st.textContent = 'まだ保存していません';
    rsSoonSave();
  }else if(/^np\.pl\./.test(p)){
    rsSt.np.plDirty = true;
    var sp = document.getElementById('rs_pl_state'); if(sp) sp.textContent = 'まだ保存していません';
    rsSoonSave();
  }else if(p === 'rep.text' || p === 'rep.target'){
    var box = document.getElementById('rs_rep_stats'); if(box) box.innerHTML = rsRepStatsHtml();
    rsRepKeep();
  }else if(p === 'rep.refs'){
    var rb = document.getElementById('rs_rep_refres'); if(rb) rb.innerHTML = rsRefsHtml();
    rsRepKeep();
  }else if(p === 'law.filter'){
    var la = document.getElementById('rs_law_arts'); if(la) la.innerHTML = rsLawArtsHtml();
  }else if(p === 'lec.course'){
    rsLecKeep();
  }
}
function rsOnInput(t, isChange){
  if(!t || !t.getAttribute) return;
  var p = t.getAttribute('data-rs');
  if(p){
    rsSetPath(p, t.type === 'checkbox' ? (t.checked ? 1 : 0) : t.value);
    rsEdited(p);
  }
  if(!isChange) return;
  var ch = t.getAttribute('data-rs-ch');
  if(ch === 'rep-note'){
    var n = rsFindById('notes', t.value);
    if(n){ rsSt.rep.text = String(n.body || ''); rsRepKeep(); render(); toast('「' + rsClip(n.title || 'メモ', 20) + '」を読みこみました'); }
  }else if(ch === 'rep-task'){
    var R = rsSt.rep;
    R.taskId = t.value;
    var g = R.taskId ? (S.kmData || {})['research:goal:' + R.taskId] : null;
    if(g && g.n) R.target = String(g.n);
    rsRepKeep(); render();
  }
}
document.addEventListener('input', function(e){ rsOnInput(e.target, false); });
document.addEventListener('change', function(e){ rsOnInput(e.target, true); });
document.addEventListener('keydown', function(e){
  var t = e.target;
  if(!t || !t.getAttribute || e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
  var a = t.getAttribute('data-rs-enter');
  if(!a) return;
  e.preventDefault();
  rsAct(a, t, e);
});

/* ============================== 「勉強」タブに登録 ============================== */
kmStudy({ id:'rs-np', icon:'🩺', title:'看護過程', desc:'考え方のコーチと、看護計画の枠', view:rsViewNp, order:20,
  badge:function(){ var n = rsItems('nproc').length + rsItems('nplan').length; return n ? String(n) : ''; } });
kmStudy({ id:'rs-rep', icon:'📝', title:'レポート', desc:'文字数・構成・参考文献のチェック、AIの添削', view:rsViewRep, order:21 });
kmStudy({ id:'rs-find', icon:'🔎', title:'論文・本さがし', desc:'PubMed・J-STAGE・CiNii・国会図書館', view:rsViewFind, order:22,
  badge:function(){ var n = (S.papers || []).length; return n ? String(n) : ''; } });
kmStudy({ id:'rs-books', icon:'📚', title:'教科書の本だな', desc:'ISBNで登録、授業ごとに見る', view:rsViewBooks, order:23,
  badge:function(){ var n = (S.books || []).length; return n ? n + '冊' : ''; } });
kmStudy({ id:'rs-eng', icon:'🌐', title:'英語・翻訳', desc:'英語の論文をやさしく・DeepLで翻訳', view:rsViewEng, order:24 });
kmStudy({ id:'rs-law', icon:'⚖️', title:'法令', desc:'保助看法などの条文を読む（e-Gov）', view:rsViewLaw, order:25 });
kmStudy({ id:'rs-lec', icon:'🎙️', title:'講義の録音', desc:'録音→文字→要約してメモに', view:rsViewLec, order:26,
  badge:function(){ return rsSt.lec.rec ? '録音中' : ''; } });

/* ===== 設定：DeepLのカギ（橋わたしにだけ預ける） ===== */
kmSettings({ id:'rs-deepl', title:'DeepL（翻訳）', after:'gas',
  note:function(){ return rsLs('deepl') === 1 ? '預けてあります' : ''; },
  html:function(){
    if(!rsBridgeOk()) return rsBn('amber', 'Google連携を新しい版にすると使えます。いまは翻訳に AI（Gemini）を使います。');
    return '<p class="note">DeepL API（Free は無料で登録できます）のカギを、Googleの橋わたしにだけ預けます。この手帳のデータ（同期するもの）には入りません。' +
      '「勉強 › 英語・翻訳」で使います。</p>' +
      '<div class="field"><label class="f" for="rs_deepl_key">DeepLのカギ</label><input id="rs_deepl_key" type="password" autocomplete="off" placeholder="例：xxxxxxxx-xxxx-…:fx"></div>' +
      '<div class="pair rs-pair"><button class="btn" data-act="rs-deepl-set">橋わたしに預ける</button>' +
      (rsLs('deepl') === 1 ? '<button class="btn ghost" data-act="rs-deepl-del">預けたカギを消す</button>' : '') + '</div>';
  } });

/* ============================== AIが読めるように・全体検索 ============================== */
function rsAiBooks(){
  var by = {};
  (S.books || []).forEach(function(b){ var c = b.course || '（授業なし）'; (by[c] = by[c] || []).push(b.title + '（' + (b.status || '持っている') + '・' + (b.where || '家') + '）'); });
  var buy = (S.books || []).filter(function(b){ return b.status === '買う予定'; });
  return { byCourse:by, toBuy:buy.length, toBuyYen:buy.reduce(function(a, b){ return a + toNum(b.price); }, 0), papers:(S.papers || []).length };
}
rsAiBooks.section = 'study';
kmAiData('rs_books', '教科書の本だな（授業ごと）・買う予定の本の数と合計金額・保存した論文の数', rsAiBooks);
KM.aiData.rs_books.section = 'study';
/* AIそうだんに見せる文も、名前らしい文字などは＊＊にかくす（レポートには患者さんの事例が入ることがある） */
function rsAiDevice(){
  var R = rsSt.rep, st = rsReportStats(R.text, R.target), L = rsSt.lec;
  return {
    report:R.text ? { chars:st.noWs, target:st.target, percent:st.pct, sentences:st.sents, longSentences:st.long.length, mixedStyle:st.mixed,
      text:rsMask(rsClip(R.text, 3000)).text, references:rsRefLines(R.refs).length } : null,
    lecture:L.segs.length ? { course:rsLecCourse(), recording:!!L.rec, parts:L.segs.length, text:rsMask(rsClip(rsLecText(), 3000)).text } : null,
    deepl:rsLs('deepl') === 1 ? '預けてある' : 'なし'
  };
}
rsAiDevice.section = 'study';
kmAiData('rs_device', 'この端末だけにあるもの：書いているレポートの下書きと数字・録音中の講義の文字起こし・DeepLのカギがあるか', rsAiDevice);
KM.aiData.rs_device.section = 'study';
function rsAiNursing(){
  return rsItems('nproc').map(function(x){
    var d = rsNpFix(rsCopy(x));
    return { id:x.id, title:rsMask(x.title).text, frame:rsFrame(d).name, progress:rsNpProgress(d), problems:rsNpProbs(d).map(function(p, i){ return '#' + (i + 1) + ' ' + rsMask(p.text).text; }) };
  });
}
rsAiNursing.section = 'more';
/* 看護過程・看護計画の記録は、AIの道具で読まれる前に伏せ字にする（患者さんの名前など） */
if(typeof kmAiMask === 'function') kmAiMask('research', function(s){ return rsMask(s).text; });
kmAiData('rs_nursing', '看護過程（書いているもの）の一覧と看護問題。くわしい中身は kmItems（mod:research, type:nproc / nplan / lawclip）', rsAiNursing);
KM.aiData.rs_nursing.section = 'more';

/* 全体検索（attrs はボタンにつける data- の属性。文字にすると属性の文になる） */
function rsAttrs(o){
  var s = Object.keys(o).map(function(k){ return k + '="' + esc(o[k]) + '"'; }).join(' ');
  Object.defineProperty(o, 'toString', { value:function(){ return s; }, enumerable:false });
  return o;
}
kmSearch(function(q){
  var w = norm(String(q || '')).trim();
  if(!w) return [];
  var hit = function(){ return norm(Array.prototype.slice.call(arguments).join(' ')).indexOf(w) >= 0; }, out = [];
  (S.papers || []).forEach(function(p){
    if(hit(p.title, rsAuthorsOf(p).join(' '), p.journal, p.memo, p.easy)) out.push({ kind:'論文', title:p.title, sub:rsMetaLine(p), act:'rs-open', attrs:rsAttrs({ 'data-tool':'rs-find', 'data-id':p.id }) });
  });
  (S.books || []).forEach(function(b){
    if(hit(b.title, b.author, b.publisher, b.course, b.memo, b.isbn)) out.push({ kind:'教科書', title:b.title, sub:[b.course ? shortName(b.course) : '', b.status, b.where].filter(Boolean).join('・'), act:'rs-open', attrs:rsAttrs({ 'data-tool':'rs-books', 'data-id':b.id }) });
  });
  rsItems('nproc').concat(rsItems('nplan')).forEach(function(x){
    if(hit(JSON.stringify([x.title, x.problem, x.info, x.assess, x.probs, x.goals, x.plans, x.evals, x.long, x.shorts, x.op, x.tp, x.ep, x.memo])))
      out.push({ kind:x.type === 'nplan' ? '看護計画' : '看護過程', title:x.title || '看護過程', sub:rsWhen(x.mt), act:'rs-open', attrs:rsAttrs({ 'data-tool':'rs-np', 'data-id':x.id }) });
  });
  rsItems('lawclip').forEach(function(c){
    if(hit(c.law, c.title, c.cap, c.text)) out.push({ kind:'法令', title:c.law + ' ' + c.title, sub:rsClip(c.text, 40), act:'rs-open', attrs:rsAttrs({ 'data-tool':'rs-law', 'data-id':c.id }) });
  });
  return out.slice(0, 30);
});

/* ===== AIそうだんの道具 ===== */
kmChatTool({ name:'rs_find_papers',
  description:'論文や本を、外のデータベース（PubMed・J-STAGE・CiNii・国会図書館）でさがす。結果は「勉強」タブの「論文・本さがし」に出る。' +
    'さがしはじめたあと、もう一度おなじことばで使うと、見つかった一覧を返す。',
  parameters:{ type:'OBJECT', properties:{
    query:{ type:'STRING', description:'さがすことば（PubMed は英語）' },
    source:{ type:'STRING', enum:['pubmed', 'jstage', 'cinii', 'ndl'], description:'pubmed=英語の医学・看護の論文、jstage=日本の学会誌の論文、cinii=日本の論文、ndl=国会図書館の本' } },
    required:['query'] } },
  function(a){
    var q = String(a.query || '').trim();
    if(!q) return { result:'さがすことばがありません' };
    var src = ['pubmed', 'jstage', 'cinii', 'ndl'].indexOf(a.source) >= 0 ? a.source : (rsIsJa(q) ? 'jstage' : 'pubmed');
    var F = rsSt.find;
    if(F.resSrc === src && F.lastQ === q && F.list.length){
      return { result:JSON.stringify({ source:rsSrcName(src), query:q, total:F.total, items:F.list.slice(0, 10).map(function(r){
        return { title:r.title, authors:rsAuthorsOf(r).slice(0, 3).join(', '), where:r.journal || r.publisher || '', year:r.year, url:r.url }; }) }) };
    }
    if(F.busy) return { result:'いま別のことばでさがしています。少し待ってから、もう一度使ってください。' };
    F.src = src; F.q = q;
    rsFindRun(false);
    return { result:'「' + q + '」で' + rsSrcName(src) + 'をさがしはじめました。結果は「勉強」タブ › 論文・本さがし に出ます。' +
      '少しあとに、この道具をおなじことばで使うと一覧を読めます。' };
  });
kmChatTool({ name:'rs_format_reference',
  description:'手帳に保存した論文（S.papers）・教科書（S.books）を、参考文献の書き方（jans=日本看護科学学会ふう、apa=APA、sist=SIST02）にして返す。',
  parameters:{ type:'OBJECT', properties:{
    query:{ type:'STRING', description:'題名・著者などのことば（空なら全部）' },
    style:{ type:'STRING', enum:['jans', 'apa', 'sist'], description:'書き方（ふつうは jans）' } } } },
  function(a){
    var q = norm(String(a.query || '')).trim(), style = /^(jans|apa|sist)$/.test(a.style || '') ? a.style : 'jans';
    var all = (S.papers || []).concat(S.books || []).filter(function(p){ return !q || norm([p.title, rsAuthorsOf(p).join(' '), p.journal, p.publisher].join(' ')).indexOf(q) >= 0; });
    if(!all.length) return { result:'当てはまる論文・本が手帳にありません' };
    return { result:JSON.stringify({ style:style, refs:all.slice(0, 30).map(function(p){ return rsFormatRef(p, style); }) }) };
  });
kmChatTool({ name:'rs_add_book',
  description:'教科書の本だな（S.books）に本を1冊入れる。',
  parameters:{ type:'OBJECT', properties:{
    title:{ type:'STRING', description:'題名' }, author:{ type:'STRING', description:'著者（なければ空）' },
    course:{ type:'STRING', description:'授業の名前（なければ空）' },
    status:{ type:'STRING', enum:['持っている', '買う予定', '借りている'], description:'いまの状態' },
    price:{ type:'NUMBER', description:'ねだん（円。なければ0）' } },
    required:['title'] } },
  function(a){
    var title = String(a.title || '').trim();
    if(!title) return { result:'題名がありません' };
    var course = String(a.course || '').trim();
    if(course){ var hit = termCourses().filter(function(c){ return c.name === course || c.name.indexOf(course) >= 0 || sameSubject(c.name, course); })[0]; if(hit) course = hit.name; }
    var b = rsBookFrom({ title:title, authors:a.author ? [String(a.author)] : [], course:course, status:RS_STATUS.indexOf(a.status) >= 0 ? a.status : '持っている', price:a.price });
    S.books = S.books || [];
    S.books.push(b);
    return { result:'本だなに入れました', op:{ t:'add', list:'books', id:b.id, label:'本だな「' + title + '」' } };
  });
KM.chatTools[KM.chatTools.length - 1].write = true;
