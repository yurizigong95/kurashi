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

test('読めないファイルは、教えてくれる', async function(){
  var bad = fileOf([1, 2, 3], 'なぞ.xyz', 'application/octet-stream');
  var err = '';
  try{ await W.loadFiles([bad]); }catch(e){ err = e.message; }
  ok(err.indexOf('読めません') >= 0, 'メッセージが出る：' + err);
});
