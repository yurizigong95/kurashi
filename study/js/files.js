/* もんだいメーカー：資料を読みこむ
   ・写真・PDF … そのままAIに見てもらう
   ・スライド(.pptx)・Word(.docx) … 中身はzipなので、ブラウザでほどいて字だけ取り出す（AIに写真を送らなくてすむ）
   ・ZIP … 大学のポータルからまとめて落としたものを、中身ごとに読む
   ・写真の手入れ（明るく・まっすぐ・見開き分け・ぼけ判定）は、すべてこの端末の中で計算する */

var MAX_FILES = 8;                       /* 1回に読みこむ資料の数 */
var PDF_MAX = 15 * 1024 * 1024;
var DOC_MAX = 25 * 1024 * 1024;
var TXT_MAX = 5 * 1024 * 1024;
var TEXT_KEEP = 8000;                    /* 資料に残しておく字の数 */
var TEXT_SEND = 24000;                   /* AIに送る字の数 */

function fKindOf(f){
  var name = String(f && f.name || '');
  if(/\.zip$/i.test(name) || /zip/i.test(f.type || '')) return 'zip';
  if(/\.(pptx|docx)$/i.test(name)) return 'slide';
  if(/pdf/i.test(f.type || '') || /\.pdf$/i.test(name)) return 'pdf';
  if(/^image\//.test(f.type || '') || /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(name)) return 'photo';
  if(/^text\//.test(f.type || '') || /\.(txt|md|csv|tsv|json|rtf|html?|vtt|srt)$/i.test(name)) return 'text';
  return '';
}
function fKindName(kind){
  return { photo:'写真', pdf:'PDF', slide:'スライド', text:'文章' }[kind] || '資料';
}
/* &amp; などを、もとの字にもどす */
function unent(s){
  return String(s == null ? '' : s)
    .replace(/&#x([0-9a-fA-F]+);/g, function(m, h){ return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function(m, d){ return String.fromCharCode(Number(d)); })
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
/* <a:t>…</a:t> のような札の中の字をぜんぶ集める */
function tagText(xml, tag){
  var out = [], re = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'g'), m;
  while((m = re.exec(xml))) out.push(unent(m[1].replace(/<[^>]+>/g, '')));
  return out;
}
/* 段落の札で区切って、1行ずつにする */
function ooxText(xml, pTag, tTag){
  var lines = [];
  String(xml).split('</' + pTag + '>').forEach(function(part){
    var t = tagText(part, tTag).join('').replace(/\s+$/, '');
    if(t.trim()) lines.push(t);
  });
  return lines.join('\n');
}
/* zip をほどく（中の1つ分） */
async function inflateOne(bytes, method){
  if(method === 0) return bytes;
  if(method !== 8) throw new Error('この形のファイルは、中の字を読めません');
  if(typeof DecompressionStream === 'undefined'){
    throw new Error('この端末では、スライドの中の字を読めません。スライドを画面に出して写真にとるか、PDFにして読みこんでください');
  }
  var st = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(st).arrayBuffer());
}
/* zip の中の、ほしいファイルだけを取り出す */
function zipEntries(buf, want){
  var b = new Uint8Array(buf);
  var dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  var eo = -1, stop = Math.max(0, b.length - 66000);
  for(var i = b.length - 22; i >= stop; i--){ if(dv.getUint32(i, true) === 0x06054b50){ eo = i; break; } }
  if(eo < 0) throw new Error('ファイルを開けませんでした（.pptx / .docx / .zip を選んでください）');
  var count = dv.getUint16(eo + 10, true), p = dv.getUint32(eo + 16, true);
  var dec = new TextDecoder('utf-8'), out = [];
  for(var k = 0; k < count && p + 46 <= b.length; k++){
    if(dv.getUint32(p, true) !== 0x02014b50) break;
    var method = dv.getUint16(p + 10, true);
    var csize = dv.getUint32(p + 20, true);
    var nameLen = dv.getUint16(p + 28, true), extLen = dv.getUint16(p + 30, true), cmtLen = dv.getUint16(p + 32, true);
    var lho = dv.getUint32(p + 42, true);
    var name = dec.decode(b.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extLen + cmtLen;
    if(!want(name) || !csize || lho + 30 > b.length) continue;
    if(dv.getUint32(lho, true) !== 0x04034b50) continue;
    var start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    if(start + csize > b.length) continue;
    out.push({ name:name, method:method, data:b.subarray(start, start + csize) });
  }
  return out;
}
function slideNo(name){ var m = String(name).match(/(\d+)\.xml$/); return m ? Number(m[1]) : 0; }
/* 太字・下線・色つきの字（先生が大事だと言ったところ）を取り出す */
function emphFrom(xml, isDoc){
  var out = [], re = isDoc ? /<w:r\b[\s\S]*?<\/w:r>/g : /<a:r\b[\s\S]*?<\/a:r>/g, m;
  while((m = re.exec(xml)) && out.length < 40){
    var run = m[0];
    var pr = run.match(isDoc ? /<w:rPr>[\s\S]*?<\/w:rPr>/ : /<a:rPr[\s\S]*?(?:\/>|<\/a:rPr>)/);
    if(!pr) continue;
    var p = pr[0];
    var hot = isDoc
      ? (/<w:b\b/.test(p) || /<w:u\b/.test(p) || /<w:color[^>]*w:val="(?!auto|000000)/.test(p) || /<w:highlight/.test(p))
      : (/\bb="1"/.test(p) || /\bu="(?!none)/.test(p) || /srgbClr val="(?!000000)/.test(p));
    if(!hot) continue;
    var t = tagText(run, isDoc ? 'w:t' : 'a:t').join('').trim();
    if(t && t.length >= 2 && t.length <= 60 && out.indexOf(t) < 0) out.push(t);
  }
  return out;
}
/* スライド（.pptx）・Word（.docx）から字を取り出す */
async function docText(f){
  var buf = await readAs(f, 'buf');
  return docTextBuf(buf, /\.docx$/i.test(f.name), f.name);
}
async function docTextBuf(buf, isDoc, name){
  var fname = name || (isDoc ? 'document.docx' : 'slides.pptx');
  var want = isDoc
    ? function(n){ return n === 'word/document.xml'; }
    : function(n){ return /^ppt\/(slides\/slide|notesSlides\/notesSlide)\d+\.xml$/.test(n); };
  var files = zipEntries(buf, want);
  if(!files.length) throw new Error('「' + fname + '」の中に字が見つかりませんでした');
  var emph = [];
  files.sort(function(a, b){
    var na = /notesSlide/.test(a.name) ? 1 : 0, nb = /notesSlide/.test(b.name) ? 1 : 0;
    return (na - nb) || (slideNo(a.name) - slideNo(b.name)) || a.name.localeCompare(b.name);
  });
  var dec = new TextDecoder('utf-8'), out = [];
  for(var i = 0; i < files.length; i++){
    var xml = dec.decode(await inflateOne(files[i].data, files[i].method));
    var t = isDoc ? ooxText(xml, 'w:p', 'w:t') : ooxText(xml, 'a:p', 'a:t');
    emphFrom(xml, isDoc).forEach(function(w){ if(emph.indexOf(w) < 0 && emph.length < 30) emph.push(w); });
    if(!t.trim()) continue;
    if(isDoc) out.push(t);
    else out.push((/notesSlide/.test(files[i].name) ? '【ノート ' : '【スライド ') + slideNo(files[i].name) + '】\n' + t);
  }
  if(!out.length) throw new Error('「' + fname + '」の中に字が見つかりませんでした');
  return { text:out.join('\n\n'), emph:emph };
}
/* バイトの列を data: の形にする */
function bytesToDataUrl(bytes, mime){
  var bin = '', chunk = 0x8000;
  for(var i = 0; i < bytes.length; i += chunk){
    bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(bytes.length, i + chunk)));
  }
  return 'data:' + mime + ';base64,' + btoa(bin);
}
/* えらんだファイルを、AIに渡せる形にする */
async function loadFiles(files){
  var out = [];
  for(var i = 0; i < files.length; i++){
    var f = files[i], kind = fKindOf(f);
    if(!kind) throw new Error('「' + f.name + '」は読めません（写真・PDF・.pptx・.docx・文章・ZIP）');
    if(kind === 'zip'){
      var inner = await loadZip(f);
      inner.forEach(function(x){ if(out.length < MAX_FILES) out.push(x); });
      continue;
    }
    out.push(await loadOne(f, kind));
  }
  return out;
}
async function loadOne(f, kind){
  if(kind === 'photo'){
    var url = await resizeImage(f, 1800, 0.82);
    var o = { name:f.name, kind:'photo', url:url, text:'' };
    try{ o.at = await exifDate(f); }catch(e){}
    try{
      var sharp = await imgSharp(url);
      if(sharp < 60) o.warn = '⚠️ ぼけている・手ぶれしているかもしれません（読みやすさ ' + sharp + '）。撮り直すか、「明るく・くっきり」を押してみてください。';
    }catch(e){}
    return o;
  }
  if(kind === 'pdf'){
    if(f.size > PDF_MAX) throw new Error('PDFは15MBまでです（' + f.name + '）');
    return { name:f.name, kind:'pdf', url:await readAs(f, 'url'), text:'' };
  }
  if(kind === 'slide'){
    if(f.size > DOC_MAX) throw new Error('スライド・Wordは25MBまでです（' + f.name + '）');
    var d = await docText(f);
    return { name:f.name, kind:'slide', url:'', text:d.text, emph:d.emph || [] };
  }
  if(f.size > TXT_MAX) throw new Error('文章のファイルは5MBまでです（' + f.name + '）');
  return { name:f.name, kind:'text', url:'', text:String(await readAs(f, 'text') || '') };
}
/* ZIP の中の、読めるものだけを取り出す */
async function loadZip(f){
  if(f.size > DOC_MAX) throw new Error('ZIPは25MBまでです（' + f.name + '）');
  var buf = await readAs(f, 'buf');
  var want = function(n){ return !/\/$/.test(n) && !/^__MACOSX/.test(n) && /\.(pptx|docx|txt|md|csv|pdf|jpe?g|png)$/i.test(n); };
  var entries = zipEntries(buf, want);
  if(!entries.length) throw new Error('「' + f.name + '」の中に、読めるファイルがありませんでした');
  entries.sort(function(a, b){ return a.name.localeCompare(b.name); });
  var out = [], dec = new TextDecoder('utf-8');
  for(var i = 0; i < entries.length && out.length < MAX_FILES; i++){
    var e = entries[i], base = String(e.name).split('/').pop();
    var bytes;
    try{ bytes = await inflateOne(e.data, e.method); }catch(err){ continue; }
    if(/\.(pptx|docx)$/i.test(base)){
      try{
        var d = await docTextBuf(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), /\.docx$/i.test(base), base);
        out.push({ name:base, kind:'slide', url:'', text:d.text, emph:d.emph || [] });
      }catch(err2){}
    }else if(/\.(txt|md|csv)$/i.test(base)){
      out.push({ name:base, kind:'text', url:'', text:dec.decode(bytes) });
    }else if(/\.pdf$/i.test(base)){
      if(bytes.length <= PDF_MAX) out.push({ name:base, kind:'pdf', url:bytesToDataUrl(bytes, 'application/pdf'), text:'' });
    }else{
      out.push({ name:base, kind:'photo', url:bytesToDataUrl(bytes, /\.png$/i.test(base) ? 'image/png' : 'image/jpeg'), text:'' });
    }
  }
  if(!out.length) throw new Error('「' + f.name + '」の中身を読めませんでした');
  return out;
}
/* 同じ資料を2回取りこんでいないか */
function fileSig(f){ return hash((f.text || '').slice(0, 800) || (f.name + '|' + (f.url || '').length)); }
function dupMark(list){
  var mats = S.mats || [];
  list.forEach(function(f){
    var sig = fileSig(f);
    f.sig = sig;
    var hit = mats.filter(function(m){ return m.sig === sig; })[0];
    if(hit) f.dup = '📌 この資料は「' + hit.title + '」（' + mdText(hit.at) + '）で、もう取りこんでいます。';
  });
  return list;
}

/* ============================== 写真の手入れ ============================== */
/* 明るさ・コントラストを自動で合わせる（字を読みやすく） */
async function imgAuto(dataUrl, quality){
  var img = await imgLoad(dataUrl);
  var cv = canvasOf(img.width, img.height), ctx = cv.getContext('2d');
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
/* 見開きを2ページに分ける */
async function imgSplit(dataUrl, quality){
  var img = await imgLoad(dataUrl);
  var half = Math.floor(img.width / 2), out = [];
  [[0, half], [half, img.width - half]].forEach(function(p){
    var cv = canvasOf(p[1], img.height);
    cv.getContext('2d').drawImage(img, p[0], 0, p[1], img.height, 0, 0, p[1], img.height);
    out.push(cv.toDataURL('image/jpeg', quality || 0.82));
  });
  return out;
}
/* 四すみを指して、まっすぐにする（quad … [[x,y]×4] 左上・右上・右下・左下。0〜1の割合） */
async function imgWarp(dataUrl, quad, quality){
  var img = await imgLoad(dataUrl);
  var W = img.width, H = img.height;
  var cv = canvasOf(W, H), ctx = cv.getContext('2d');
  var N = 14;                                            /* 細かく分けて、少しずつ貼る */
  var at = function(u, v){                               /* 四すみのあいだを、たて・よこのわりあいでとる */
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
/* ピンボケ・手ぶれのめやす（となりの点との差が小さいほど、ぼけている） */
async function imgSharp(dataUrl){
  var img = await imgLoad(dataUrl);
  var w = 320, h = Math.max(1, Math.round(img.height * w / img.width));
  var cv = canvasOf(w, h), ctx = cv.getContext('2d');
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
/* 写真の撮影日（EXIF の DateTimeOriginal）を読む */
function exifDate(file){
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
              res(exifWalk(v, tiff, ifd, le, 0));
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
function exifWalk(v, tiff, ifd, le, depth){
  if(depth > 2 || ifd + 2 > v.byteLength) return '';
  var n = v.getUint16(ifd, le), out = '';
  for(var i = 0; i < n; i++){
    var e = ifd + 2 + i * 12;
    if(e + 12 > v.byteLength) break;
    var tag = v.getUint16(e, le), type = v.getUint16(e + 2, le), cnt = v.getUint32(e + 4, le);
    if(tag === 0x8769){                                  /* Exif IFD へ */
      var got = exifWalk(v, tiff, tiff + v.getUint32(e + 8, le), le, depth + 1);
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
