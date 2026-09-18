/* くらしの手帳：家計簿（手で入れる・銀行やカードのCSV・Apple Payの自動記録） */
/* ============================== 家計簿 ==============================
   S.spends = [{ id, date, amount, io:'out'|'in', title, cat, src:'hand'|'csv'|'wallet', acct, memo, ref, mt }]
   ・個人のアプリは銀行のAPIを使えないので、各社のサイトから書き出したCSVを読みこむ。
   ・Apple Pay／Suica は、iPhoneのショートカットから橋わたし（Apps Script）に届いたものを取りこむ。 */
var KB_CATS = [
  ['food','食費','🍙'], ['daily','日用品','🧴'], ['move','交通','🚃'], ['study','勉強・本','📚'],
  ['wear','服・美容','👗'], ['fun','趣味・遊び','🎮'], ['friend','交際','🎁'], ['health','医療','💊'],
  ['phone','スマホ・通信','📱'], ['other','その他','📦']
];
var KB_GUESS = [
  ['move', /JR|阪急|阪神|神戸電鉄|神鉄|北神|市営|地下鉄|バス|タクシー|Suica|ICOCA|PASMO|PiTaPa|交通|駐輪|定期/i],
  ['food', /セブン|ローソン|ファミリーマート|ファミマ|ミニストップ|デイリー|イオン|ライフ|コープ|マックスバリュ|業務スーパー|スーパー|マクドナルド|マック|すき家|吉野家|松屋|スタバ|スターバックス|ドトール|タリーズ|コメダ|ケンタッキー|モス|サイゼ|ガスト|丸亀|弁当|パン|カフェ|食堂|レストラン|デリフランス/i],
  ['daily', /マツモトキヨシ|マツキヨ|ウエルシア|スギ薬局|ココカラ|ダイソー|セリア|キャンドゥ|ニトリ|無印|ロフト|ハンズ|ドラッグ/i],
  ['study', /書店|紀伊國屋|ジュンク|丸善|ブックオフ|文具|大学生協|生協|Kindle|ブックス/i],
  ['wear', /ユニクロ|UNIQLO|GU|ZARA|H&M|しまむら|美容|ヘア|コスメ|化粧/i],
  ['fun', /Netflix|Spotify|YouTube|Apple Music|Amazon Prime|ゲーム|映画|カラオケ|Nintendo|PlayStation|Steam/i],
  ['health', /病院|クリニック|医院|歯科|薬局/i],
  ['phone', /ドコモ|docomo|au |KDDI|ソフトバンク|SoftBank|楽天モバイル|ahamo|povo|LINEMO|UQ|ワイモバイル/i]
];
function kbGuessCat(title){
  var t = String(title || '');
  for(var i = 0; i < KB_GUESS.length; i++){ if(KB_GUESS[i][1].test(t)) return KB_GUESS[i][0]; }
  return 'other';
}
function kbCat(id){ return KB_CATS.filter(function(c){ return c[0] === id; })[0] || KB_CATS[KB_CATS.length - 1]; }
function kbRef(date, amount, title, acct){ return hash53([date, amount, String(title || '').replace(/\s+/g, ''), acct || ''].join('|')); }
function kbList(){ return Array.isArray(S.spends) ? S.spends : []; }
function kbMonth(ym){ return kbList().filter(function(x){ return String(x.date || '').slice(0, 7) === ym; }); }
function kbTotals(ym){
  var list = kbMonth(ym), out = 0, inn = 0, by = {};
  list.forEach(function(x){
    var a = Math.abs(Number(x.amount) || 0);
    if(x.io === 'in'){ inn += a; return; }
    out += a; by[x.cat || 'other'] = (by[x.cat || 'other'] || 0) + a;
  });
  return { out:out, inn:inn, by:by, n:list.length };
}
/* 1件足す（同じものが2回入らないように） */
function kbAdd(o){
  S.spends = kbList();
  var item = {
    id: uid('sp'), date: isYmd(o.date) ? o.date : today(),
    amount: Math.abs(Math.round(Number(o.amount) || 0)), io: o.io === 'in' ? 'in' : 'out',
    title: String(o.title || '').slice(0, 60), cat: o.cat || kbGuessCat(o.title), src: o.src || 'hand',
    acct: String(o.acct || '').slice(0, 30), memo: String(o.memo || '').slice(0, 200), mt: Date.now()
  };
  if(!item.amount) return null;
  item.ref = o.ref || kbRef(item.date, item.amount * (item.io === 'in' ? -1 : 1), item.title, item.acct);
  if(S.spends.some(function(x){ return x.ref === item.ref; })) return null;
  S.spends.push(item);
  return item;
}

/* ============================== CSVを読む ============================== */
async function kbReadFile(file){
  var buf = await new Promise(function(res, rej){
    var r = new FileReader(); r.onload = function(){ res(r.result); }; r.onerror = function(){ rej(new Error('読めません')); };
    r.readAsArrayBuffer(file);
  });
  var text;
  try{ text = new TextDecoder('utf-8', { fatal:true }).decode(buf); }
  catch(e){ text = new TextDecoder('shift_jis').decode(buf); }
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}
function kbParseCsv(text){
  var rows = [], row = [], cell = '', q = false;
  for(var i = 0; i < text.length; i++){
    var ch = text[i];
    if(q){
      if(ch === '"'){ if(text[i + 1] === '"'){ cell += '"'; i++; } else q = false; }
      else cell += ch;
    }else if(ch === '"') q = true;
    else if(ch === ',' || ch === '\t'){ row.push(cell); cell = ''; }
    else if(ch === '\n' || ch === '\r'){
      if(ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if(row.some(function(c){ return String(c).trim() !== ''; })) rows.push(row);
      row = [];
    }else cell += ch;
  }
  row.push(cell);
  if(row.some(function(c){ return String(c).trim() !== ''; })) rows.push(row);
  return rows.map(function(r){ return r.map(function(c){ return String(c).trim(); }); });
}
function kbDate(s){
  s = String(s || '').trim();
  try{ s = s.normalize('NFKC'); }catch(e){}
  var m = s.match(/^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/) || s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if(m) return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
  m = s.match(/^(\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if(m) return '20' + m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
  return '';
}
function kbAmount(s){
  s = String(s == null ? '' : s).trim();
  try{ s = s.normalize('NFKC'); }catch(e){}
  if(!s) return null;
  var neg = /^[-−▲△]|^\(.*\)$/.test(s);
  var n = Number(s.replace(/[^0-9.]/g, ''));
  if(!isFinite(n) || s.replace(/[^0-9]/g, '') === '') return null;
  return neg ? -n : n;
}
/* 列の役目を見出しから当てる */
var KB_ROLES = [['','使わない'],['date','日付'],['title','内容・お店'],['out','出金'],['in','入金'],['signed','金額（＋入金／−出金）'],['amount','金額（すべて支出）']];
function kbGuessRoles(rows){
  var hi = -1, roles = [];
  for(var i = 0; i < Math.min(rows.length, 12); i++){
    if(rows[i].some(function(c){ return /日付|利用日|取引日|年月日|ご利用日|お取引日/.test(c); })){ hi = i; break; }
  }
  var width = rows.reduce(function(a, r){ return Math.max(a, r.length); }, 0);
  for(var c = 0; c < width; c++) roles.push('');
  if(hi >= 0){
    rows[hi].forEach(function(h, c){
      if(/日付|利用日|取引日|年月日|ご利用日|お取引日/.test(h) && roles.indexOf('date') < 0) roles[c] = 'date';
      else if(/内容|摘要|店名|お取り扱い|ご利用先|利用先|商品/.test(h) && !/金額|\(円\)|（円）/.test(h) && roles.indexOf('title') < 0) roles[c] = 'title';
      else if(/入出金/.test(h)) roles[c] = 'signed';
      else if(/お引出し|出金|引出|お支払|支払金額/.test(h) && roles.indexOf('out') < 0) roles[c] = 'out';
      else if(/お預入れ|入金|預入/.test(h) && roles.indexOf('in') < 0) roles[c] = 'in';
      else if(/利用金額|ご利用金額|金額/.test(h) && !/手数料|残高|繰越|総額/.test(h) && roles.indexOf('amount') < 0 && roles.indexOf('out') < 0 && roles.indexOf('signed') < 0) roles[c] = 'amount';
      else if(/内容|摘要|店名|お取り扱い|取引内容|ご利用先|利用先|商品/.test(h) && roles.indexOf('title') < 0) roles[c] = 'title';
    });
  }else{
    /* 見出しのないCSV（カード会社など）：日付・内容・金額の順が多い */
    var r0 = rows.filter(function(r){ return kbDate(r[0]); })[0];
    if(r0){
      roles[0] = 'date';
      for(var k = 1; k < r0.length; k++){
        if(roles.indexOf('title') < 0 && r0[k] && kbAmount(r0[k]) === null){ roles[k] = 'title'; continue; }
        if(roles.indexOf('amount') < 0 && kbAmount(r0[k]) !== null){ roles[k] = 'amount'; }
      }
    }
  }
  return { head:hi, roles:roles };
}
function kbRowsToItems(rows, roles, head, acct){
  var out = [];
  rows.forEach(function(r, i){
    if(i <= head) return;
    var o = { date:'', title:'', amount:0, io:'out' };
    roles.forEach(function(role, c){
      var v = r[c];
      if(role === 'date') o.date = kbDate(v);
      else if(role === 'title') o.title = (o.title ? o.title + ' ' : '') + v;
      else if(role === 'out'){ var a = kbAmount(v); if(a) { o.amount = Math.abs(a); o.io = 'out'; } }
      else if(role === 'in'){ var b = kbAmount(v); if(b && !o.amount){ o.amount = Math.abs(b); o.io = 'in'; } }
      else if(role === 'signed'){ var s = kbAmount(v); if(s){ o.amount = Math.abs(s); o.io = s < 0 ? 'out' : 'in'; } }
      else if(role === 'amount'){ var t = kbAmount(v); if(t){ o.amount = Math.abs(t); o.io = t < 0 ? 'in' : 'out'; } }
    });
    if(!o.date || !o.amount) return;
    o.acct = acct || '';
    o.cat = o.io === 'in' ? 'other' : kbGuessCat(o.title);
    o.src = 'csv';
    out.push(o);
  });
  return out;
}

/* ============================== 画面 ============================== */
var kbYm = '', kbCsv = null, kbShowAll = false;
function viewKakeibo(){
  if(!kbYm) kbYm = thisYm();
  var tot = kbTotals(kbYm), list = kbMonth(kbYm).slice().sort(function(a, b){ return b.date.localeCompare(a.date) || (b.mt || 0) - (a.mt || 0); });
  var h = '<div class="pillrow"><button class="mini" data-act="kb-ym" data-v="-1">‹ 前の月</button>'+
    '<b style="align-self:center;margin:0 6px">'+ymLabel(kbYm)+'</b>'+
    '<button class="mini" data-act="kb-ym" data-v="1">次の月 ›</button>'+
    (kbYm !== thisYm() ? '<button class="mini" data-act="kb-ym" data-v="0">今月</button>' : '')+'</div>';
  /* まとめ */
  var cats = KB_CATS.filter(function(c){ return tot.by[c[0]]; }).sort(function(a, b){ return tot.by[b[0]] - tot.by[a[0]]; });
  var max = cats.length ? tot.by[cats[0][0]] : 0;
  h += section('使ったお金', tot.n ? tot.n + '件' : null,
    '<div class="grid2"><div class="stat"><div class="k">支出</div><div class="v num">'+yen(tot.out)+'</div></div>'+
    '<div class="stat"><div class="k">入ったお金（記録）</div><div class="v num">'+yen(tot.inn)+'</div></div></div>'+
    (cats.length ? '<div class="kbbars">'+cats.map(function(c){
      var v = tot.by[c[0]];
      return '<div class="kbbar" title="'+esc(c[1])+'：'+yen(v)+'"><span class="kbn">'+c[2]+' '+esc(c[1])+'</span>'+
        '<span class="kbt"><i style="width:'+Math.max(2, Math.round(v / max * 100))+'%"></i></span>'+
        '<span class="kbv num">'+yen(v)+'</span><span class="kbp num">'+(tot.out ? Math.round(v / tot.out * 100) : 0)+'%</span></div>';
    }).join('')+'</div>' : '<div class="empty">この月の記録はまだありません。</div>'));
  /* 入れる */
  h += section('記録する', null,
    '<div class="pair" style="margin-bottom:10px">'+
      '<div><label class="f" for="kb_amt">金額（円）</label><input id="kb_amt" inputmode="numeric" placeholder="500"></div>'+
      '<div><label class="f" for="kb_date">日付</label><input id="kb_date" type="date" value="'+today()+'"></div></div>'+
    '<div class="field"><label class="f" for="kb_title">内容・お店</label><input id="kb_title" placeholder="例：コンビニ"></div>'+
    '<label class="f">分類</label><div class="chips">'+KB_CATS.map(function(c, i){
      return '<button data-act="kb-cat" data-v="'+c[0]+'" class="'+((kbDraftCat || 'food') === c[0] ? 'on' : '')+'">'+c[2]+' '+c[1]+'</button>';
    }).join('')+'</div>'+
    '<div class="pair"><button class="btn" data-act="kb-add" data-io="out">支出を記録</button>'+
    '<button class="btn ghost" data-act="kb-add" data-io="in" style="flex:0 0 auto">入金として記録</button></div>');
  /* 一覧 */
  var shown = kbShowAll ? list : list.slice(0, 30);
  h += section('記録の一覧', list.length ? list.length + '件' : null,
    (shown.length ? shown.map(function(x){
      var c = kbCat(x.cat);
      return '<div class="row"><span class="kbic" aria-hidden="true">'+(x.io === 'in' ? '💴' : c[2])+'</span>'+
        '<div class="grow"><div class="t">'+esc(x.title || c[1])+'</div>'+
        '<div class="s">'+ymdLabel(x.date)+'・'+(x.io === 'in' ? '入金' : esc(c[1]))+
          (x.src === 'csv' ? '・CSV' : x.src === 'wallet' ? '・Apple Pay' : '')+(x.acct ? '・'+esc(x.acct) : '')+'</div></div>'+
        '<div class="amt num"'+(x.io === 'in' ? ' style="color:var(--ok)"' : '')+'>'+(x.io === 'in' ? '+' : '')+yen(x.amount)+'</div>'+
        '<button class="mini" data-act="kb-del" data-id="'+x.id+'" aria-label="消す">×</button></div>';
    }).join('') : '<div class="empty">記録はありません。</div>')+
    (list.length > 30 ? '<button class="mini" data-act="kb-all">'+(kbShowAll ? 'たたむ' : 'ぜんぶ見る')+'</button>' : ''));
  /* CSV */
  h += section('銀行・カードのCSVを取りこむ', null, kbCsvBox());
  h += '<p class="note">Apple Pay・Suicaで払ったときに自動で記録するには、設定 › iPhone・ショートカット連携 の手順でショートカットを作ってください。</p>';
  return h;
}
var kbDraftCat = 'food';
function kbCsvBox(){
  if(!kbCsv){
    return '<p class="note" style="margin-top:0">楽天銀行・三井住友銀行・楽天カード・三井住友カードなどのサイトで「明細をCSVで書き出す」をして、そのファイルを選んでください。同じ明細を2回読みこんでも、二重には入りません。</p>'+
      '<button class="btn ghost" data-act="kb-csv">CSVファイルを選ぶ</button>';
  }
  var c = kbCsv, rows = c.rows, width = c.roles.length;
  var items = kbRowsToItems(rows, c.roles, c.head, c.acct);
  var dup = items.filter(function(o){ var ref = kbRef(o.date, o.amount * (o.io === 'in' ? -1 : 1), o.title, o.acct); return kbList().some(function(x){ return x.ref === ref; }); }).length;
  var h = '<div class="s" style="margin-bottom:6px">'+esc(c.name)+'（'+rows.length+'行）</div>'+
    '<div class="field"><label class="f" for="kb_acct">口座・カードの名前</label><input id="kb_acct" value="'+esc(c.acct)+'" placeholder="例：楽天カード"></div>'+
    '<label class="f">それぞれの列が何か（自動で当てています。ちがっていたら直してください）</label>'+
    '<div class="scroll kbcsv"><table><thead><tr>';
  for(var i = 0; i < width; i++){
    h += '<th><select data-kbcol="'+i+'" aria-label="'+(i + 1)+'列目">'+KB_ROLES.map(function(r){
      return '<option value="'+r[0]+'"'+(c.roles[i] === r[0] ? ' selected' : '')+'>'+r[1]+'</option>';
    }).join('')+'</select></th>';
  }
  h += '</tr></thead><tbody>';
  rows.slice(Math.max(0, c.head), Math.max(0, c.head) + 7).forEach(function(r, k){
    h += '<tr'+(k === 0 && c.head >= 0 ? ' class="kbhead"' : '')+'>';
    for(var j = 0; j < width; j++) h += '<td>'+esc(String(r[j] == null ? '' : r[j]).slice(0, 24))+'</td>';
    h += '</tr>';
  });
  h += '</tbody></table></div>'+
    '<p class="note">取りこめる行：<b>'+items.length+'件</b>'+(dup ? '（うち'+dup+'件は取りこみ済み）' : '')+
    (items.length ? '　支出 '+yen(sumBy(items.filter(function(o){ return o.io === 'out'; }), function(o){ return o.amount; }))+
      '・入金 '+yen(sumBy(items.filter(function(o){ return o.io === 'in'; }), function(o){ return o.amount; })) : '')+'</p>'+
    '<div class="pair"><button class="btn" data-act="kb-csv-go"'+(items.length ? '' : ' disabled')+'>取りこむ</button>'+
    '<button class="btn ghost" data-act="kb-csv-cancel" style="flex:0 0 auto">やめる</button></div>';
  return h;
}
function kbPickCsv(){
  var f = document.getElementById('kbfile');
  if(!f){
    f = document.createElement('input');
    f.type = 'file'; f.accept = '.csv,text/csv,text/plain'; f.id = 'kbfile'; f.style.display = 'none';
    f.addEventListener('change', async function(){
      var file = f.files && f.files[0]; f.value = '';
      if(!file) return;
      if(file.size > 5 * 1024 * 1024){ toast('ファイルが大きすぎます（5MBまで）', true); return; }
      try{
        var rows = kbParseCsv(await kbReadFile(file));
        if(!rows.length) throw new Error('中身がありません');
        var g = kbGuessRoles(rows);
        var guessAcct = /楽天/.test(file.name) ? '楽天' : /smbc|三井住友|vpass/i.test(file.name) ? '三井住友' : '';
        kbCsv = { name:file.name, rows:rows.slice(0, 3000), roles:g.roles, head:g.head, acct:guessAcct };
        render();
      }catch(e){ toast('CSVを読めませんでした：' + e.message, true); }
    });
    document.body.appendChild(f);
  }
  f.click();
}
function kakeiboAction(act, t){
  if(act === 'kb-ym'){
    var v = toNum(t.dataset.v);
    kbYm = v ? addMonths(kbYm || thisYm(), v) : thisYm();
    render(); return true;
  }
  if(act === 'kb-cat'){ kbDraftCat = t.dataset.v; render(); return true; }
  if(act === 'kb-all'){ kbShowAll = !kbShowAll; render(); return true; }
  if(act === 'kb-add'){
    var amt = toNum(val('kb_amt'));
    if(!amt){ toast('金額を入れてください', true); return true; }
    var io = t.dataset.io === 'in' ? 'in' : 'out';
    var it = kbAdd({ amount:amt, date:val('kb_date'), title:val('kb_title').trim(), cat:io === 'in' ? 'other' : kbDraftCat, io:io, src:'hand', ref:uid('ref') });
    if(!it){ toast('記録できませんでした', true); return true; }
    kbYm = it.date.slice(0, 7);
    toast((io === 'in' ? '入金' : '支出') + ' ' + yen(amt) + ' を記録しました'); commit(); return true;
  }
  if(act === 'kb-del'){
    removeWithUndo('spends', t.dataset.id, '家計簿の記録を消しました');
    commit(); return true;
  }
  if(act === 'kb-csv'){ kbPickCsv(); return true; }
  if(act === 'kb-csv-cancel'){ kbCsv = null; render(); return true; }
  if(act === 'kb-csv-go'){
    if(!kbCsv) return true;
    kbCsv.acct = val('kb_acct').trim();
    var items = kbRowsToItems(kbCsv.rows, kbCsv.roles, kbCsv.head, kbCsv.acct), n = 0;
    items.forEach(function(o){ if(kbAdd(o)) n++; });
    kbCsv = null;
    toast(n ? n + '件を取りこみました' : '新しい行はありませんでした');
    commit(); return true;
  }
  return false;
}
/* 列の役目を変えたとき */
document.addEventListener('change', function(e){
  var s = e.target;
  if(!s || !s.dataset || s.dataset.kbcol == null || !kbCsv) return;
  var acctEl = document.getElementById('kb_acct');
  if(acctEl) kbCsv.acct = acctEl.value;
  kbCsv.roles[toNum(s.dataset.kbcol)] = s.value;
  render();
});
/* お金のホームに出す、今月の家計簿 */
function kbHomeCard(){
  var tot = kbTotals(thisYm());
  var cats = KB_CATS.filter(function(c){ return tot.by[c[0]]; }).sort(function(a, b){ return tot.by[b[0]] - tot.by[a[0]]; }).slice(0, 3);
  return section('今月の家計簿', tot.n ? '支出 ' + yen(tot.out) : '未記録',
    (tot.n ? cats.map(function(c){
      return '<div class="row"><span class="kbic" aria-hidden="true">'+c[2]+'</span><div class="grow t">'+esc(c[1])+'</div><div class="amt num">'+yen(tot.by[c[0]])+'</div></div>';
    }).join('') : '<div class="empty">使ったお金を記録すると、ここにまとめが出ます。</div>')+
    '<button class="btn ghost" style="margin-top:10px" data-act="go" data-app="money" data-tab="kakeibo">家計簿を開く</button>');
}
