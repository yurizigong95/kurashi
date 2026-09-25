/* 資料の読みこみ：スライド・ZIP・写真（撮影日・手入れ）・二重取りこみ */

/* テスト用の小さな zip（圧縮しない） */
function zipOf(entries){
  var enc = new TextEncoder(), out = [], central = [], off = 0;
  var u16 = function(v){ return [v & 255, (v >> 8) & 255]; };
  var u32 = function(v){ return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255]; };
  entries.forEach(function(e){
    var name = [].slice.call(enc.encode(e.name)), data = [].slice.call(enc.encode(e.text));
    var head = [0x50, 0x4b, 0x03, 0x04].concat(u16(20), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(data.length), u32(data.length), u16(name.length), u16(0), name);
    central.push([0x50, 0x4b, 0x01, 0x02].concat(u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), name));
    out = out.concat(head, data);
    off += head.length + data.length;
  });
  var cd = [];
  central.forEach(function(c){ cd = cd.concat(c); });
  return out.concat(cd, [0x50, 0x4b, 0x05, 0x06].concat(u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(cd.length), u32(off), u16(0)));
}
function slideXml(lines, bold){
  return '<?xml version="1.0"?><p:sld xmlns:a="x"><p:cSld><p:spTree>' +
    lines.map(function(t, i){
      var pr = (bold && i === 0) ? '<a:rPr b="1"/>' : '<a:rPr/>';
      return '<a:p><a:r>' + pr + '<a:t>' + t + '</a:t></a:r></a:p>';
    }).join('') + '</p:spTree></p:cSld></p:sld>';
}
function docXml(lines){
  return '<?xml version="1.0"?><w:document><w:body>' +
    lines.map(function(t){ return '<w:p><w:r><w:rPr/><w:t>' + t + '</w:t></w:r></w:p>'; }).join('') +
    '</w:body></w:document>';
}
/* 撮影日（EXIF）の入った、小さなJPEG */
function jpegWithDate(ymdhms){
  var enc = new TextEncoder();
  var tiff = [0x49, 0x49, 0x2A, 0x00, 8, 0, 0, 0,
    1, 0,
    0x69, 0x87, 4, 0, 1, 0, 0, 0, 26, 0, 0, 0,
    0, 0, 0, 0,
    1, 0,
    0x03, 0x90, 2, 0, 20, 0, 0, 0, 44, 0, 0, 0,
    0, 0, 0, 0];
  var str = [].slice.call(enc.encode(ymdhms)).concat([0]);
  while(tiff.length < 44) tiff.push(0);
  var payload = [].slice.call(enc.encode('Exif')).concat([0, 0], tiff, str);
  var len = payload.length + 2;
  return [0xFF, 0xD8, 0xFF, 0xE1, (len >> 8) & 255, len & 255].concat(payload, [0xFF, 0xD9]);
}
function fileOf(bytes, name, type){
  return new W.File([new W.Uint8Array(bytes)], name, { type:type });
}

test('スライド（.pptx）から字を取り出す（強調したことばも）', async function(){
  var pptx = fileOf(zipOf([
    { name:'ppt/slides/slide1.xml', text:slideXml(['循環器のまとめ', '心臓は4つの部屋からなる'], true) },
    { name:'ppt/slides/slide2.xml', text:slideXml(['血圧の基準値は120/80mmHg未満'], false) },
    { name:'ppt/notesSlides/notesSlide1.xml', text:slideXml(['ここはテストに出す'], false) }
  ]), '第3回 循環器.pptx', '');
  var got = await W.loadFiles([pptx]);
  eq(got.length, 1, '1つ読めた');
  eq(got[0].kind, 'slide', 'スライドとして読む');
  ok(got[0].text.indexOf('心臓は4つの部屋') >= 0, 'スライドの字');
  ok(got[0].text.indexOf('ここはテストに出す') >= 0, 'ノートの字');
  ok(got[0].text.indexOf('【スライド 1】') >= 0, 'スライド番号');
  ok(got[0].emph.indexOf('循環器のまとめ') >= 0, '太字のことばを取り出す');
  ok(!got[0].url, '写真は作らない（＝AIに写真を送らずにすむ）');
});

test('Word（.docx）からも字を取り出す', async function(){
  var docx = fileOf(zipOf([
    { name:'word/document.xml', text:docXml(['看護過程の5段階', 'アセスメント→診断→計画→実施→評価']) }
  ]), 'はんどあうと.docx', '');
  var got = await W.loadFiles([docx]);
  eq(got[0].kind, 'slide', 'Wordも字として読む');
  ok(got[0].text.indexOf('看護過程の5段階') >= 0, '中身');
});

test('ZIP（ポータルからまとめて落としたもの）を、中身ごと読む', async function(){
  var zip = fileOf(zipOf([
    { name:'第1回/メモ.txt', text:'脈拍は60〜100回/分' },
    { name:'第2回/はいふ.txt', text:'呼吸は12〜20回/分' },
    { name:'__MACOSX/けす.txt', text:'これは読まない' }
  ]), 'shiryou.zip', 'application/zip');
  var got = await W.loadFiles([zip]);
  eq(got.length, 2, '読めるものだけ2つ');
  ok(got.map(function(x){ return x.text; }).join('').indexOf('脈拍') >= 0, '中身が読める');
});

test('写真：撮影日（EXIF）を読んで、資料の日付に入れる', async function(){
  var jpg = fileOf(jpegWithDate('2026:09:20 10:11:12'), 'IMG_1234.jpg', 'image/jpeg');
  eq(await W.exifDate(jpg), '2026-09-20', '撮影日を読む');
});

test('写真：明るく・まっすぐ・見開き分け・ぼけ判定', async function(){
  var cv = W.document.createElement('canvas');
  cv.width = 80; cv.height = 60;
  var ctx = cv.getContext('2d');
  ctx.fillStyle = '#888'; ctx.fillRect(0, 0, 80, 60);
  ctx.fillStyle = '#777'; ctx.fillRect(10, 10, 30, 20);
  var url = cv.toDataURL('image/jpeg', 0.9);
  var auto = await W.imgAuto(url);
  ok(auto.indexOf('data:image/jpeg') === 0 && auto.length > 100, '明るさ・コントラストをととのえられる');
  var two = await W.imgSplit(url);
  eq(two.length, 2, '見開きを2つに');
  var warped = await W.imgWarp(url, [[0.05, 0.05], [0.95, 0.03], [0.97, 0.95], [0.03, 0.97]]);
  ok(warped.indexOf('data:image/jpeg') === 0, '四すみを指してまっすぐにできる');
  /* まっ平らな写真は「ぼけている」と判定される */
  var flat = W.document.createElement('canvas');
  flat.width = 60; flat.height = 40;
  flat.getContext('2d').fillStyle = '#999';
  flat.getContext('2d').fillRect(0, 0, 60, 40);
  var blur = await W.imgSharp(flat.toDataURL('image/jpeg', 0.9));
  ok(blur < 100, 'ぼけのめやすが出る（' + blur + '）');
});

test('二重取りこみに気づく', async function(){
  W.S.mats.push({ id:'m1', mt:Date.now(), sub:'', title:'第1回のスライド', at:'2026-09-01',
                  sig:W.hash('脈拍は60〜100回/分'.slice(0, 800)), photos:[], text:'脈拍は60〜100回/分' });
  W.saveNow();
  var list = W.dupMark([{ name:'おなじ.txt', kind:'text', text:'脈拍は60〜100回/分' }]);
  ok(list[0].dup && list[0].dup.indexOf('第1回のスライド') >= 0, 'もう取りこんだと教えてくれる');
});

test('つくる画面：スライドを読みこむと、第◯回と名前が入る', async function(){
  W.subAdd('循環器');
  var pptx = fileOf(zipOf([
    { name:'ppt/slides/slide1.xml', text:slideXml(['血圧の基準値は120/80mmHg未満である'], false) }
  ]), '第5回 循環器.pptx', '');
  await click('tab', 'make');
  await W.mkTake([pptx]);
  await frames();
  eq(W.mk.files.length, 1, '読みこめた');
  eq(W.mk.mat.no, '5', 'ファイル名から「第5回」を見つける');
  ok(W.mk.mat.title.indexOf('循環器') >= 0, '資料の名前');
  ok(has('スライド'), '画面にも出る');
  /* そのままAIなしで作れる */
  await click('mk-noai');
  await click('mk-run');
  ok(W.mk.pv && W.mk.pv.items.length >= 1, 'その場で問題ができた');
  eq(aiCalls.length, 0, 'AIなし');
});

/* ===== 大きなファイル ===== */
/* 中身のない、大きなファイルを作る（メモリは使うが、テストの中だけ） */
function bigFile(mb, name, type){
  return new W.File([new W.Uint8Array(mb * 1024 * 1024)], name, { type:type });
}

test('大きなPDF（20MB）は、AIに預けてから読む', async function(){
  var got = await W.loadFiles([bigFile(20, '第7回 循環器.pdf', 'application/pdf')]);
  eq(got.length, 1, '読みこめた');
  eq(got[0].kind, 'pdf', 'PDFとして');
  ok(got[0].big, '「預けてから」のしるしがつく');
  ok(!got[0].url, 'その場では送らない（メモリに載せない）');
  ok(got[0].file && got[0].file.size === 20 * 1024 * 1024, 'ファイルそのものを持っている');
});

test('小さいPDF（1MB）は、今までどおりそのまま送る', async function(){
  var got = await W.loadFiles([bigFile(1, 'ちいさい.pdf', 'application/pdf')]);
  ok(!got[0].big, '預けない');
  ok(/^data:application\/pdf/.test(got[0].url || ''), 'その場でくっつけて送る形');
});

test('講義の録音・動画も読みこめる（大きくても大丈夫）', async function(){
  var got = await W.loadFiles([bigFile(30, '第3回 講義.m4a', 'audio/mp4')]);
  eq(got[0].kind, 'audio', '録音として読む');
  ok(got[0].big, '預けてから読む');
  var v = await W.loadFiles([bigFile(2, '手技.mp4', 'video/mp4')]);
  eq(v[0].kind, 'video', '動画として読む');
  ok(v[0].big, '動画も預けてから読む');
});

test('長い文章のファイルは、はじめのところだけ読む', async function(){
  var chunk = new Array(1024).join('あ');                 /* 1023文字 */
  var parts = [];
  for(var i = 0; i < 6000; i++) parts.push(chunk);        /* だいたい18MB（日本語3バイト） */
  var f = new W.File(parts, 'ながい.txt', { type:'text/plain' });
  ok(f.size > W.TXT_HEAD, 'たしかに大きい：' + W.fSizeText(f.size));
  var got = await W.loadFiles([f]);
  ok(got[0].cut, 'はじめだけ読んだしるし');
  ok(got[0].text.length > 1000, '中身は読めている');
  ok(got[0].text.length < f.size, 'ぜんぶは読みこんでいない');
});

test('大きな資料は、AIに預けてから問題を作る', async function(){
  W.subAdd('成人看護学');
  fakeUpload();
  fakeAI(function(){
    return aiJsonReply({ title:'第3回 講義', summary:'心不全', questions:[
      { type:'tf', q:'心不全では息切れが出る。', answer:'○', why:'先生の話より' }
    ] });
  });
  await click('tab', 'make');
  await W.mkTake([bigFile(18, '第3回 講義.m4a', 'audio/mp4')]);
  await frames();
  ok(has('大きいので'), '画面でも知らせる');
  await click('mk-run');
  await until(function(){ return W.mk.pv; }, 8000, '問題ができるのを待つ');
  eq(upCalls.length, 1, '預けたのは1回');
  eq(upCalls[0].name, '第3回 講義.m4a', '預けたファイル');
  var parts = aiCalls[0].contents[0].parts;
  ok(parts.some(function(p){ return p.file_data && p.file_data.file_uri; }), '預けた場所をAIに渡す');
  ok(parts.some(function(p){ return /録音や動画/.test(p.text || ''); }), '録音の読み方も伝える');
  eq(W.mk.pv.items.length, 1, '問題ができた');
});

/* 大きな中身（圧縮なし）が1つ入った ZIP を、メモリを使わずに作る */
function zipWithBig(inner, mb){
  var enc = new W.TextEncoder(), name = enc.encode(inner);
  var size = mb * 1024 * 1024;
  var u16 = function(v){ return [v & 255, (v >> 8) & 255]; };
  var u32 = function(v){ return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255]; };
  var local = new W.Uint8Array([0x50, 0x4b, 0x03, 0x04].concat(u16(20), u16(0), u16(0), u16(0), u16(0), u32(0),
    u32(size), u32(size), u16(name.length), u16(0), [].slice.call(name)));
  var cd = new W.Uint8Array([0x50, 0x4b, 0x01, 0x02].concat(u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(0),
    u32(size), u32(size), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(0), [].slice.call(name)));
  var off = local.length + size;
  var eocd = new W.Uint8Array([0x50, 0x4b, 0x05, 0x06].concat(u16(0), u16(0), u16(1), u16(1), u32(cd.length), u32(off), u16(0)));
  return new W.File([local, new W.Uint8Array(size), cd, eocd], 'shiryou.zip', { type:'application/zip' });
}

test('ZIPの中の大きな動画は、ほどかずに切り出して預ける', async function(){
  var got = await W.loadFiles([zipWithBig('第4回/こうぎ.mp4', 20)]);
  eq(got.length, 1, '中の動画を見つけた');
  eq(got[0].kind, 'video', '動画として');
  ok(got[0].big, '預けてから読む');
  eq(got[0].file.size, 20 * 1024 * 1024, '中身をそのまま切り出した');
});

test('預けるときの手順（はじめ → 少しずつ送る → 終わり）', async function(){
  var log = [], realFetch = W.fetch;
  W.fetch = async function(url, opt){
    opt = opt || {};
    var cmd = (opt.headers || {})['X-Goog-Upload-Command'] || '';
    log.push({ url:String(url), cmd:cmd, off:(opt.headers || {})['X-Goog-Upload-Offset'], size:opt.body && opt.body.size });
    if(/\/upload\/v1beta\/files$/.test(String(url))){
      return { ok:true, headers:{ get:function(k){ return /upload-url/i.test(k) ? 'https://up.test/put' : null; } } };
    }
    return { ok:true, json:async function(){ return { file:{ name:'files/abc', uri:'https://f.test/abc', mimeType:'audio/mp4', state:'ACTIVE' } }; } };
  };
  try{
    W.S.set.key = 'test-key';
    var pct = [];
    var r = await W.aiUpload(bigFile(20, 'こうぎ.m4a', 'audio/mp4'), { onProgress:function(p){ pct.push(p); } });
    eq(r.uri, 'https://f.test/abc', '置き場所が返る');
    eq(log[0].cmd, 'start', 'はじめに置き場所をもらう');
    ok(log.length >= 4, '少しずつ送る（' + (log.length - 1) + '回）');
    eq(log[1].off, '0', '1回目は先頭から');
    eq(log[log.length - 1].cmd, 'upload, finalize', '最後に「終わり」を伝える');
    eq(pct[pct.length - 1], 100, '進みぐあいは100%まで出る');
  }finally{
    W.fetch = realFetch;
    W.S.set.key = '';
  }
});

test('送り先を教えてもらえないときは、ひと息で送る', async function(){
  var log = [], realFetch = W.fetch;
  W.fetch = async function(url, opt){
    opt = opt || {};
    var h = opt.headers || {};
    log.push({ proto:h['X-Goog-Upload-Protocol'], cmd:h['X-Goog-Upload-Command'], type:h['Content-Type'], body:opt.body && opt.body.size });
    /* 1回目は、送り先（ヘッダ）を返さないブラウザのふり */
    if(h['X-Goog-Upload-Command'] === 'start') return { ok:true, headers:{ get:function(){ return null; } } };
    return { ok:true, json:async function(){ return { file:{ name:'files/z', uri:'https://f.test/z', mimeType:'audio/mp4', state:'ACTIVE' } }; } };
  };
  try{
    W.S.set.key = 'test-key';
    var pct = [];
    var r = await W.aiUpload(bigFile(3, 'こうぎ.m4a', 'audio/mp4'), { onProgress:function(p){ pct.push(p); } });
    eq(r.uri, 'https://f.test/z', '預けられた');
    eq(log.length, 2, '2回でおわる（聞く → ひと息で送る）');
    eq(log[1].proto, 'raw', 'ひと息で送るやり方');
    eq(log[1].type, 'audio/mp4', '中身の種類も伝える');
    eq(log[1].body, 3 * 1024 * 1024, 'ファイルまるごと');
    eq(pct[0], null, '進みぐあいは出せないと伝える');
    eq(pct[pct.length - 1], 100, '終わったら100%');
  }finally{
    W.fetch = realFetch;
    W.S.set.key = '';
  }
});

test('読めないファイルは、教えてくれる', async function(){
  var bad = fileOf([1, 2, 3], 'なぞ.xyz', 'application/octet-stream');
  var err = '';
  try{ await W.loadFiles([bad]); }catch(e){ err = e.message; }
  ok(err.indexOf('読めません') >= 0, 'メッセージが出る：' + err);
});
