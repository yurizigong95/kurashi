/* くらしの手帳：おせわ・キャラの追加 のテスト（KT.test で足す） */
(function(){
'use strict';
var ok = KT.ok, eq = KT.eq, J = KT.J;

/* 生まれている子を用意して、コインを多めに持たせる */
function setup(A){
  var id = A.petActiveId();
  if(!A.petNow(id)){ A.appId = 'pet'; A.petPanel = ''; A.render(); A.document.querySelector('[data-act="pet-adopt"]').click(); }
  A.petUpdate(id, function(o){ if(o.exp < 20) o.exp = 20; o.sleep = 0; o.eng = 95; o.hun = 80; o.joy = 70; o.cln = 90; });
  A.petMetaUpdate(function(m){ m.bonus = (A.toNum(m.bonus) || 0) + 5000; m.pause = 0; });
  A.commit();
  return id;
}
function snapOf(A){ var o = A.payloadCore(); delete o.notices; return A.canon(o) + '|' + A.canon(A.S.meta); }

KT.test('おせわ＋：着せかえ（20品以上・買う・着る・はずす・コインが合う・2台で同時に買っても消えない）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  var id = setup(A);
  ok(A.PP_WEAR.filter(function(x){ return !x.walk; }).length >= 20, '20品以上ある');
  A.appId = 'pet'; A.petPanel = 'dress'; A.ppDressSlot = 'all'; A.render();
  ok(doc.querySelectorAll('.pp-wlist [data-act="pp-wear"]').length >= 20, 'おみせに並ぶ');
  var off = A.PP_WEAR.filter(function(x){ return x.months && !A.ppInSeason(x); })[0];
  if(off) ok(!doc.querySelector('.pp-wlist [data-v="' + off.id + '"]'), '季節の限定品は、その月だけ');
  var c0 = A.petCoins();
  doc.querySelector('.pp-wlist [data-act="pp-wear"][data-v="beret"]').click();
  eq(A.petCoins(), c0 - 80, '買うとコインが減る');
  eq(A.petNow(id).wear.head, 'beret', '着る');
  ok(/pp-w-beret/.test(A.petSvg(id, A.petNow(id), 100)), '着たすがたの絵になる');
  ok(doc.querySelector('.petroom .pp-w-beret'), 'おせわの画面の子が着ている');
  doc.querySelector('.pp-wlist [data-act="pp-wear"][data-v="beret"]').click();
  ok(!A.petNow(id).wear.head, 'もう一度おすと、はずす');
  doc.querySelector('.pp-wlist [data-act="pp-wear"][data-v="beret"]').click();
  eq(A.petCoins(), c0 - 80, '買った服は、もう一度着てもコインはかからない');
  doc.querySelector('.pp-wlist [data-act="pp-wear"][data-v="glasses"]').click();
  doc.querySelector('.pp-wlist [data-act="pp-wear"][data-v="nursewear"]').click();
  var w = A.petNow(id).wear;
  ok(w.head === 'beret' && w.face === 'glasses' && w.body === 'nursewear', '場所ごとに着られる：' + JSON.stringify(w));
  ok(A.petNow(id).worn.beret && (A.petNow(id).pts || {}).idol >= 2, 'はじめて着るとアイドルの点');
  /* おさんぽでしか見つからない服は買えない */
  var c1 = A.petCoins();
  A.ppWear('clover');
  ok(!A.petNow(id).wear.head || A.petNow(id).wear.head === 'beret', 'おさんぽの服は買えない');
  eq(A.petCoins(), c1, 'コインも減らない');
  /* 今日タブの子も着ている */
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  ok(doc.querySelector('.pp-today .pp-w-beret'), '今日タブの子も着ている');
  await KT.settle([A, B]);
  eq(B.petNow(id).wear.head, 'beret', '着せかえが相手に届く');
  eq(B.petCoins(), A.petCoins(), 'コインがそろう');
  /* 2台で同時に買う */
  var base = A.petCoins();
  ok(A.ppBuy('w:sunglass', 100), 'こちらで買う'); A.commit();
  ok(B.ppBuy('w:bowtie', 60), '相手で買う'); B.commit();
  await KT.settle([A, B]);
  ok(A.ppOwned('w:sunglass') && A.ppOwned('w:bowtie') && B.ppOwned('w:sunglass') && B.ppOwned('w:bowtie'), '2台で同時に買っても、どちらも残る');
  eq(A.petCoins(), base - 160, 'コインは両方のぶんだけ減る（こちら）');
  eq(B.petCoins(), base - 160, 'コインは両方のぶんだけ減る（相手）');
});

KT.test('おせわ＋：進化の分かれ道（道のメーター・おとなで道が決まる・称号・前からの子もこわれない）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  var id = setup(A);
  A.petUpdate(id, function(o){ o.exp = 100; o.pts = { hakase:40, genki:5 }; delete o.path; delete o.path2; });
  A.commit();
  A.appId = 'pet'; A.petPanel = ''; A.render();
  var bar = function(p){ var b = doc.querySelector('.pp-mbar[data-path="' + p + '"]'); return b ? +b.getAttribute('aria-valuenow') : -1; };
  ok(bar('hakase') > bar('genki') && bar('hakase') > bar('nurse'), 'はかせの道に近いメーター');
  ok(/はかせ/.test(doc.body.textContent), 'いまどの道に近いか出る');
  var snap = JSON.stringify(A.S.pets);
  A.render();
  eq(JSON.stringify(A.S.pets), snap, '見るだけでは書きかえない');
  var c0 = A.petCoins();
  A.petUpdate(id, function(o){ o.exp = 260; });
  eq(A.S.pets[id].path, 'hakase', 'おとなになると道が決まる');
  eq(A.petCoins(), c0 + 100, '育ったごほうび');
  ok(/ものしりはかせ/.test(A.petLevelMsg), '進んだ道を知らせる：' + A.petLevelMsg);
  A.petSay('テスト');
  ok(/pp-p-hakase/.test(A.petSvg(id, A.petNow(id), 100)), 'はかせのすがた');
  A.commit();
  ok(/ものしりはかせ/.test(doc.querySelector('.pethead').textContent), '称号が出る');
  A.petUpdate(id, function(o){ o.pts = Object.assign({}, o.pts, { genki:500 }); });
  eq(A.S.pets[id].path, 'hakase', '一度決まった道は変わらない');
  A.petUpdate(id, function(o){ o.exp = 620; });
  eq(A.S.pets[id].path2, 'genki', 'マスターの道は、そのときいちばん近い道');
  eq(A.ppTitle(A.petNow(id), id), 'スーパーアスリート', 'マスターの称号');
  A.petUpdate(id, function(o){ o.wear = { head:'beret' }; });
  A.petUpdate(id, function(o){ o.joy += 1; });
  eq(A.S.pets[id].wear.head, 'beret', 'ほかのおせわをしても、着せかえや道は消えない');
  eq(A.S.pets[id].path, 'hakase', '道も消えない');
  /* 前からの（古い形の）子 */
  var old = id !== 'koro' ? 'koro' : 'mochi';
  A.S.pets[old] = J(A, { name:'むかしの子', born:Date.now() - 50 * 86400000, exp:300, hun:70, joy:70, cln:80, eng:80, sleep:0, at:Date.now(), mt:Date.now() });
  A.touch('pets'); A.commit();
  var keepActive = A.petMeta().active;
  A.petMetaUpdate(function(m){ m.active = old; }); A.commit();
  A.appId = 'pet'; A.petPanel = ''; A.render();
  ok(doc.querySelector('.petroom .petstage.s3') && /おとな/.test(doc.querySelector('.pethead').textContent), '古い形の子も表示できる');
  ok(!A.S.pets[old].path, '見るだけでは道を書きこまない');
  ok(A.PP_PATH_BY[A.ppPathOf(old, A.petNow(old))], 'いまの状態から近い道が分かる');
  A.petUpdate(old, function(o){ o.joy += 1; });
  ok(A.PP_PATH_BY[A.S.pets[old].path], '次に世話したとき、いまの状態から道が決まる');
  eq(A.S.pets[old].exp, 300, '育ちはそのまま');
  A.petMetaUpdate(function(m){ m.active = keepActive; }); A.commit();
  await KT.settle([A, B]);
  eq(B.S.pets[id].path, 'hakase', '道が相手に届く');
});

KT.test('おせわ＋：育てた子の図鑑・卒業して新しいたまごから', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  var id = setup(A);
  A.petUpdate(id, function(o){ o.exp = Math.max(o.exp, 700); });
  A.commit();
  eq(A.petNow(id).stage, 4, 'マスターになる');
  A.appId = 'pet'; A.petPanel = 'dex'; A.render();
  eq(doc.querySelectorAll('.pp-dcell').length, 13, 'すがたは13しゅるい（段階×道）');
  ok(doc.querySelectorAll('.pp-dcell.pp-sil').length > 0, 'まだ会っていないすがたはシルエット');
  ok(doc.querySelectorAll('.pp-dcell:not(.pp-sil)').length >= 5, '会ったすがた');
  ok(doc.querySelector('.pp-dcell[data-form="s4:' + A.S.pets[id].path2 + '"]:not(.pp-sil)'), 'マスターのすがたに会った');
  ok(doc.querySelectorAll('.pp-kid').length >= 1 && doc.querySelectorAll('.pp-dc').length === A.charaAllIds().length, '育てた子と、キャラのしゅるい');
  var snap = snapOf(A); A.render(); eq(snapOf(A), snap, '図鑑を見るだけでは変わらない');
  var c0 = A.petCoins(), nm = A.petNow(id).name, gen = A.petNow(id).gen || 1;
  var realConfirm = A.confirm; A.confirm = function(){ return true; };
  try{ doc.querySelector('[data-act="pp-grad"]').click(); }finally{ A.confirm = realConfirm; }
  var g = A.ppItems('grad');
  ok(g.length >= 1 && g[g.length - 1].chara === id && g[g.length - 1].name === nm, '卒業の記録が図鑑にのこる');
  eq(A.petNow(id).stage, 0, '新しいたまごになる');
  eq(A.petNow(id).gen, gen + 1, '何代目か');
  eq(A.petCoins(), c0 + 100, '卒業のお祝い');
  A.appId = 'pet'; A.petPanel = 'dex'; A.render();
  ok(Array.prototype.some.call(doc.querySelectorAll('.pp-kid'), function(x){ return /卒業/.test(x.textContent) && x.textContent.indexOf(nm) >= 0; }), '卒業した子の一覧');
  await KT.settle([A, B]);
  eq(B.ppItems('grad').length, g.length, '相手に届く');
  eq(B.petCoins(), A.petCoins(), 'コインがそろう');
  A.petUpdate(id, function(o){ o.exp = 20; }); A.commit();
});

KT.test('おせわ＋：お部屋のもようがえ（かべがみ・ゆか・家具をマス目に置く）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  var id = setup(A);
  A.appId = 'pet'; A.petPanel = 'room'; A.render();
  var c0 = A.petCoins();
  doc.querySelector('[data-act="pp-wall"][data-v="pinkdot"]').click();
  eq(A.petCoins(), c0 - 60, 'かべがみを買う');
  eq(A.petMeta().wall, 'pinkdot', 'かべがみを変える');
  ok(doc.querySelector('.petroom .pp-wall.pp-wall-pinkdot'), 'おせわの画面の背景になる');
  doc.querySelector('[data-act="pp-floor"][data-v="wood"]').click();
  eq(A.petMeta().floor, 'wood', 'ゆかを変える');
  doc.querySelector('[data-act="pp-wall"][data-v=""]').click();
  eq(A.petMeta().wall, '', 'はじめのかべにもどす');
  doc.querySelector('[data-act="pp-wall"][data-v="pinkdot"]').click();
  eq(A.petCoins(), c0 - 120, '買ったかべがみは無料で戻せる');
  /* 家具（PET_DECO を広げた） */
  ok(A.PET_DECO.length >= 20, '家具がふえた');
  A.petPanel = 'shop'; A.render();
  var c1 = A.petCoins();
  doc.querySelector('[data-act="pet-deco"][data-v="chair"]').click();
  eq(A.petCoins(), c1 - 60, '家具を買う');
  ok(A.petMeta().room.indexOf('chair') >= 0, 'へやにかざる');
  var offDeco = A.PET_DECO.filter(function(d){ return d.months && !A.petInSeason(d); })[0];
  if(offDeco){
    ok(!doc.querySelector('[data-act="pet-deco"][data-v="' + offDeco.id + '"]'), '季節の家具は、その月だけ');
    var c2 = A.petCoins(); A.petAction('pet-deco', { dataset:{ v:offDeco.id } }); eq(A.petCoins(), c2, '季節はずれは買えない');
  }
  A.petPanel = 'room'; A.render();
  doc.querySelector('[data-act="pp-move"][data-v="chair"]').click();
  var cells = doc.querySelectorAll('.petroom [data-act="pp-cell"]');
  eq(cells.length, 24, 'マス目が出る');
  cells[0].click();
  var pos = A.petMeta().pos.chair;
  ok(pos && pos.x === 8 && pos.y === 13, 'えらんだマスに置く：' + JSON.stringify(pos));
  ok(/left:8%;top:13%/.test(doc.querySelector('.petroom .pdeco[data-pp="chair"]').getAttribute('style')), '置いた場所に出る');
  ok(!doc.querySelector('.petroom [data-act="pp-cell"]'), '置いたらマス目はしまう');
  await KT.settle([A, B]);
  eq(B.petMeta().wall, 'pinkdot', 'かべがみが相手に届く');
  eq(B.petMeta().pos.chair.x, 8, '置いた場所が相手に届く');
  eq(B.petCoins(), A.petCoins(), 'コインがそろう');
});

KT.test('おせわ＋：今日タブにおせわの子（なでる・ごはん・出す/出さない）とウィジェットのまとめ', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  var id = setup(A);
  A.petPatAt = {};
  A.petUpdate(id, function(o){ o.joy = 40; o.hun = 40; o.sleep = 0; }); A.commit();
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  ok(doc.querySelector('.pp-today .petstage'), '今日タブに子が出る');
  ok(doc.querySelector('.pp-today .pp-tline').textContent.length > 0, 'ひとこと');
  var j0 = A.petNow(id).joy;
  doc.querySelector('.pp-today .pp-tbtns [data-act="pet-pat"]').click();
  ok(A.petNow(id).joy > j0, 'なでると、おせわタブと同じようにきげんが上がる');
  var h0 = A.petNow(id).hun;
  doc.querySelector('.pp-today [data-act="pet-feed"]').click();
  ok(A.petNow(id).hun > h0, 'ごはんをあげられる');
  ok(A.petDaySum('fed', A.today()) > 0, 'ごはんのミッションにも数える');
  var s = A.buildSummary();
  ok(s.pet && s.pet.name && s.pet.stage && s.pet.mood && s.pet.emoji && typeof s.pet.line === 'string', 'ウィジェットのまとめ：' + JSON.stringify(s.pet));
  A.S.ui.setOpen = A.S.ui.setOpen || {}; A.S.ui.setOpen['pp-set'] = 1;
  A.appId = 'set'; A.render();
  doc.querySelector('[data-act="pp-set"][data-k="today"]').click();
  A.appId = 'today'; A.render();
  ok(!doc.querySelector('.pp-today'), '設定で出さないようにできる');
  A.appId = 'set'; A.render();
  doc.querySelector('[data-act="pp-set"][data-k="today"]').click();
  A.appId = 'today'; A.render();
  ok(doc.querySelector('.pp-today'), 'また出せる');
  A.S.ui.setOpen['pp-set'] = 0;
  await KT.settle([A, B]);
});

KT.test('おせわ＋：誕生日・記念日（登録・当日のお祝い・プレゼントは1回・前日の通知・子のたんじょうび・検索・AI）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  var id = setup(A), td = A.today();
  A.appId = 'pet'; A.petPanel = 'anniv'; A.render();
  doc.getElementById('pp_an_name').value = 'おかあさん';
  doc.getElementById('pp_an_m').value = String(+td.slice(5, 7));
  doc.getElementById('pp_an_d').value = String(+td.slice(8, 10));
  doc.getElementById('pp_an_y').value = '1975';
  doc.getElementById('pp_an_kind').value = 'birthday';
  doc.getElementById('pp_an_who').value = 'family';
  doc.getElementById('pp_an_memo').value = 'お花をおくる';
  doc.querySelector('[data-act="pp-an-save"]').click();
  var an = A.S.annivs.filter(function(a){ return a.name === 'おかあさん'; })[0];
  ok(an && an.date === '1975-' + td.slice(5) && an.kind === 'birthday' && an.who === 'family' && an.id && an.mt, '登録できる：' + JSON.stringify(an));
  /* 当日のお祝い */
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  var cel = Array.prototype.filter.call(doc.querySelectorAll('.pp-celeb'), function(x){ return /おかあさんの誕生日/.test(x.textContent); })[0];
  ok(cel && /さい/.test(cel.textContent), '今日タブにお祝いのカード');
  ok(doc.querySelector('.pp-today .petstage.pp-party'), 'おせわの子も特別なすがた');
  ok(/おかあさん/.test(doc.querySelector('.pp-today .pp-tline').textContent), '特別なセリフ');
  var c0 = A.petCoins();
  cel.querySelector('[data-act="pp-gift"]').click();
  eq(A.petCoins(), c0 + 20, 'プレゼントのコイン');
  A.ppGift('an:' + an.id);
  eq(A.petCoins(), c0 + 20, '2回はもらえない');
  await KT.settle([A, B]);
  eq(B.petCoins(), A.petCoins(), 'コインがそろう');
  B.ppGift('an:' + an.id);
  eq(B.petCoins(), A.petCoins(), '相手の端末でも、もうもらえない');
  /* 前の日の通知（オンにした人だけ） */
  var d3 = A.shiftDate(td, 3);
  A.S.annivs.push(J(A, { id:'an_pptest3', mt:Date.now(), name:'ともだちのゆい', date:d3.slice(5), kind:'birthday', who:'friend', memo:'' }));
  A.commit();
  ok(!A.notifyJobs().some(function(j){ return /^pp-anniv-/.test(j.id); }), 'オフのときは知らせない');
  A.S.ui.petplus = J(A, { annivNotify:1 }); A.touch('ui');
  var job = A.notifyJobs().filter(function(j){ return /^pp-anniv-/.test(j.id) && /ともだちのゆい/.test(j.title); })[0];
  ok(job, 'オンにすると知らせる');
  eq(A.toYmd(new Date(job.at)), A.shiftDate(d3, -1), '前の日に知らせる');
  /* 子のたんじょうび */
  var keepHatch = A.S.pets[id].hatch;
  if(td.slice(5) !== '02-29'){
    var ly = new Date(); ly.setFullYear(ly.getFullYear() - 1);
    A.petUpdate(id, function(o){ o.hatch = ly.getTime(); });
    ok(A.ppCelebToday().some(function(e){ return e.src === 'pet' && /1さい/.test(e.title); }), '子のたんじょうびも自動でお祝い');
    A.render();
    ok(Array.prototype.some.call(doc.querySelectorAll('.pp-celeb'), function(x){ return /たんじょうび（1さい）/.test(x.textContent); }), 'お祝いのカードに出る');
    A.petUpdate(id, function(o){ if(keepHatch) o.hatch = keepHatch; else delete o.hatch; });
  }
  /* 全体検索・AI */
  var res = [];
  A.KM.search.forEach(function(fn){ res = res.concat(fn('おかあさん') || []); });
  ok(res.some(function(r){ return r.kind === '記念日' && r.act === 'pp-open'; }), '全体検索に出る');
  var ad = A.aiSectionData('anniv', {});
  ok(ad.pp_anniv && ad.pp_anniv.today.some(function(x){ return /おかあさん/.test(x.title) && x.giftReceived; }) && ad.data.annivs.total >= 2, 'AIが記念日と今日のお祝いを読める');
  ok(ad.pp_anniv.next.some(function(x){ return /ともだちのゆい/.test(x.title) && x.daysLeft === 3; }), 'AIが次のお祝いを読める');
  var pd = A.aiSectionData('pet', {});
  ok(pd.pp_pet && pd.pp_pet.children.length >= 1 && pd.pp_pet.children[0].meter && pd.pp_pet.owned, 'AIがおせわの道・持ち物を読める');
  var tool = A.KM.chatTools.filter(function(t){ return t.decl.name === 'pp_add_anniv'; })[0];
  ok(tool && tool.write, 'AIそうだんの書きこむ道具');
  var r = tool.run({ name:'はじめてのバイト', date:'2026-04-01', kind:'anniv', who:'self' });
  ok(r.op && A.S.annivs.some(function(a){ return a.id === r.op.id && a.date === '2026-04-01' && a.kind === 'anniv'; }), 'AIが記念日を登録できる');
  A.commit();
  /* 消す */
  var realConfirm = A.confirm; A.confirm = function(){ return true; };
  try{
    A.appId = 'pet'; A.petPanel = 'anniv'; A.render();
    doc.querySelector('[data-act="pp-an-del"][data-id="' + r.op.id + '"]').click();
    ok(!A.S.annivs.some(function(a){ return a.id === r.op.id; }), '消せる');
    ['an_pptest3', an.id].forEach(function(x){ A.removeItem('annivs', x); });
  }finally{ A.confirm = realConfirm; }
  A.S.ui.petplus = J(A, { annivNotify:0 }); A.touch('ui');
  A.commit();
  await KT.settle([A, B]);
  eq(B.S.annivs.filter(function(a){ return /おかあさん|ともだちのゆい|はじめてのバイト/.test(a.name); }).length, 0, '消したものは相手でも消える');
});

KT.test('おせわ＋：天気で様子が変わる（雨・暑い・寒い・雪・晴れ・天気なし）', async function(){
  var A = KT.frames().A, doc = A.document;
  var id = setup(A);
  A.petUpdate(id, function(o){ o.wear = {}; }); A.commit();
  var keep = { state:A.weather.state, sanda:A.weather.sanda, school:A.weather.school };
  var set = function(code, temp, tmax){
    var w = J(A, { current:{ temperature_2m:temp, weather_code:code, precipitation:0 },
      daily:{ time:[A.today(), A.shiftDate(A.today(), 1)], weather_code:[code, code], temperature_2m_max:[tmax, tmax], temperature_2m_min:[temp - 5, temp - 5],
        precipitation_probability_max:[20, 20], precipitation_sum:[0, 0], snowfall_sum:[0, 0] } });
    A.weather.sanda = w; A.weather.school = J(A, w); A.weather.state = 'ok';
  };
  try{
    set(63, 18, 20);
    eq(A.ppWx().kind, 'rain', '雨');
    var svg = A.petSvg(id, A.petNow(id), 100);
    ok(/pp-wx-rain/.test(svg) && /pp-fx-rain/.test(svg), '雨：かさと長ぐつ');
    ok(/かさ/.test(A.ppLine(id, A.petNow(id))), '雨のひとこと');
    set(0, 33, 35);
    eq(A.ppWx().kind, 'hot', '暑い');
    ok(/pp-fx-hot/.test(A.petSvg(id, A.petNow(id), 100)), '暑い：あせ・うちわ');
    set(3, 2, 8);
    eq(A.ppWx().kind, 'cold', '寒い');
    ok(/pp-fx-cold/.test(A.petSvg(id, A.petNow(id), 100)), '寒い：マフラー');
    set(73, -1, 1);
    eq(A.ppWx().kind, 'snow', '雪');
    ok(/pp-snowman/.test(A.petSvg(id, A.petNow(id), 100)), '雪：ゆきだるま');
    set(0, 22, 24);
    eq(A.ppWx().kind, 'sunny', '晴れ');
    ok(/pp-fx-sunny/.test(A.petSvg(id, A.petNow(id), 100)), '晴れ：ごきげん');
    A.appId = 'pet'; A.petPanel = ''; A.render();
    ok(doc.querySelector('.petroom .pp-wxtag'), 'へやにも天気が出る');
    A.appId = 'today'; A.todayTab = 'today'; A.render();
    ok(doc.querySelector('.pp-today .pp-wx-sunny'), '今日タブの子も天気で変わる');
    A.weather.state = 'idle';
    eq(A.ppWx(), null, '天気がないときは');
    ok(!/pp-wx-/.test(A.petSvg(id, A.petNow(id), 100)), '何もしない');
  }finally{
    A.weather.state = keep.state; A.weather.sanda = keep.sanda; A.weather.school = keep.school;
  }
});

KT.test('おせわ＋：おさんぽ（歩数で進む・見つけたもの・1日3回まで・記録・げんきの道）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  var id = setup(A), td = A.today();
  A.S.healthLog = A.S.healthLog || {};
  var keepH = A.S.healthLog[td];
  A.S.healthLog[td] = J(A, { steps:6000, mt:Date.now() }); A.touch('healthLog'); A.commit();
  A.appId = 'pet'; A.petPanel = 'walk'; A.render();
  var g0 = (A.petNow(id).pts || {}).genki || 0;
  doc.querySelector('[data-act="pp-walk-go"]').click();
  var w = A.ppWalkNow();
  ok(w && w.chara === id && w.route.length === 8, 'おさんぽに出る');
  eq(w.bonus, 2, 'その日の歩数ぶん、少し先から');
  eq(A.ppWalkPos(w), 2, '2マス');
  A.S.healthLog[td] = J(A, { steps:6000 + 400 * 3, mt:Date.now() });
  eq(A.ppWalkPos(w), 5, '歩数で進む');
  A.render();
  eq(doc.querySelectorAll('.pp-sq.done').length, 6, 'すごろくの道（おうち＋5マス）');
  ok(doc.querySelector('.pp-sq.here .pp-sqpet'), 'いまいるマスに子がいる');
  A.S.kmData['petplus:walk'].start = Date.now() - 60 * 60000;
  eq(A.ppWalkPos(A.ppWalkNow()), 8, '時間でも進む');
  var expect = 10;
  for(var i = 0; i < 8; i++){ var ev = A.ppWalkEvent(A.ppWalkNow(), i); if(ev.kind === 'coin') expect += ev.v; }
  var c0 = A.petCoins();
  A.render();
  doc.querySelector('[data-act="pp-walk-end"]').click();
  ok(!A.ppWalkNow(), 'かえってきた');
  var recs = A.ppItems('walk'), rec = recs[recs.length - 1];
  ok(rec && rec.squares === 8 && rec.goal === 1 && rec.found.length === 8 && rec.type === 'walk' && rec.mod === 'petplus', '記録（kmItems）');
  eq(rec.steps, 1200, 'あるいた歩数');
  eq(rec.coins, expect, '見つけたコイン');
  eq(A.petCoins(), c0 + expect, 'コインがふえる');
  ok(((A.petNow(id).pts || {}).genki || 0) > g0, 'げんきの道の点がふえる');
  /* 1日3回まで */
  for(var k = 0; k < 2; k++){
    A.petUpdate(id, function(o){ o.eng = 100; o.sleep = 0; });
    A.ppWalkGo(); ok(A.ppWalkNow(), (k + 2) + '回目');
    A.ppWalkEnd();
  }
  eq(A.ppWalksOn(td), 3, '3回');
  A.petUpdate(id, function(o){ o.eng = 100; }); A.commit();
  A.appId = 'pet'; A.petPanel = 'walk'; A.render();
  ok(doc.querySelector('[data-act="pp-walk-go"]').disabled, '4回目のボタンは押せない');
  A.ppWalkGo();
  ok(!A.ppWalkNow(), '4回目は行けない');
  ok(doc.querySelectorAll('.pp-wlog').length >= 3, 'おさんぽの思い出');
  await KT.settle([A, B]);
  eq(B.ppItems('walk').length, A.ppItems('walk').length, '記録が相手に届く');
  eq(B.petCoins(), A.petCoins(), 'コインがそろう');
  if(keepH === undefined) delete A.S.healthLog[td]; else A.S.healthLog[td] = keepH;
  A.touch('healthLog'); A.commit();
  await KT.settle([A, B]);
});

KT.test('おせわ＋：どのパネル・今日タブも、表示するだけでは中身が変わらない', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  setup(A);
  await KT.settle([A, B]);
  var before = snapOf(A);
  ['', 'dress', 'room', 'walk', 'dex', 'anniv', 'shop', 'food', 'play'].forEach(function(p){ A.appId = 'pet'; A.petPanel = p; A.render(); });
  A.ppDressSlot = 'hand'; A.petPanel = 'dress'; A.render(); A.ppDressSlot = 'all';
  A.ppMoveSel = (A.petMeta().room || [])[0] || ''; A.petPanel = 'room'; A.render(); A.ppMoveSel = '';
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  A.todayTab = 'tomo'; A.render(); A.todayTab = 'today';
  A.S.ui.setOpen = A.S.ui.setOpen || {};
  A.appId = 'set'; A.render();
  A.KM.summary.forEach(function(fn){ fn({}); });
  A.aiSectionData('pet', {}); A.aiSectionData('anniv', {});
  A.KM.search.forEach(function(fn){ fn('お'); });
  var after = snapOf(A);
  if(before !== after){
    var b = JSON.parse(before.split('|')[0]), a = JSON.parse(after.split('|')[0]);
    throw new Error('表示しただけで変わった：' + (Object.keys(a).filter(function(k){ return A.canon(a[k]) !== A.canon(b[k]); }).join(',') || 'meta'));
  }
  A.appId = 'today'; A.petPanel = ''; A.render();
});

KT.test('おせわ＋：2台で同じおさんぽ・卒業を終えても、コインは1回ぶん', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  var id = setup(A);
  A.petUpdate(id, function(o){ o.exp = 150; o.eng = 100; o.sleep = 0; }); A.commit();
  /* おさんぽ（2台とも、同期する前に「かえる」を押す） */
  A.S.kmData['petplus:walk'] = J(A, { id:'ppwtwo' + Date.now().toString(36), chara:id, ymd:A.today(), start:Date.now() - 30 * 60000, steps0:-1, bonus:0,
    route:['park', 'river', 'shops', 'bakery', 'shrine', 'library', 'hospital', 'station'], mt:Date.now() });
  A.touch('kmData'); A.commit();
  await KT.settle([A, B]);
  await KT.until(function(){ return B.ppWalkNow() && B.ppWalkNow().id === A.ppWalkNow().id; }, 20000, 'おさんぽが相手に届く');
  var c0 = A.petCoins(), n0 = A.ppItems('walk').length;
  A.ppWalkEnd(); B.ppWalkEnd();
  var got = A.petCoins() - c0;
  ok(got > 0, 'コインがふえる');
  await KT.settle([A, B]);
  await KT.until(function(){ return A.ppItems('walk').length === B.ppItems('walk').length && B.petCoins() === A.petCoins(); }, 20000, '記録がそろう');
  eq(A.ppItems('walk').length, n0 + 1, 'おさんぽの記録は1つ');
  eq(A.petCoins(), c0 + got, 'おさんぽのコインは1回ぶん');
  /* 卒業（2台とも、同期する前に卒業させる） */
  A.petUpdate(id, function(o){ o.exp = 700; }); A.commit();
  await KT.settle([A, B]);
  await KT.until(function(){ return B.petNow(id) && B.petNow(id).stage === 4; }, 20000, 'マスターが相手に届く');
  var c1 = A.petCoins(), g0 = A.ppItems('grad').length;
  var rA = A.confirm, rB = B.confirm;
  A.confirm = function(){ return true; }; B.confirm = function(){ return true; };
  try{ A.ppGrad(); B.ppGrad(); }finally{ A.confirm = rA; B.confirm = rB; }
  await KT.settle([A, B]);
  await KT.until(function(){ return A.ppItems('grad').length === B.ppItems('grad').length && B.petCoins() === A.petCoins(); }, 20000, '卒業の記録がそろう');
  eq(A.ppItems('grad').length, g0 + 1, '卒業の記録は1つ');
  eq(A.petCoins(), c1 + 100, '卒業のお祝いは1回ぶん');
  A.petUpdate(id, function(o){ o.exp = 20; }); A.commit();
  await KT.settle([A, B]);
});

KT.test('おせわ＋：おせわのタブを出していない人には、今日タブでさそわない', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  var none = A.charaAllIds().filter(function(c){ return !A.petAll()[c]; })[0];
  if(!none) return;
  var keepActive = A.petMeta().active, keepTabs = J(A, A.S.ui.tabs);
  try{
    A.petMetaUpdate(function(m){ m.active = none; });
    var ctx = { ymd:A.today(), isToday:true };
    ok(/たまごをもらって/.test(A.ppTodayCard(ctx)), 'タブがあれば、さそう');
    A.S.ui.tabs = keepTabs.map(function(t){ return t[0] === 'pet' ? [t[0], 0] : t; });
    eq(A.ppTodayCard(ctx), '', 'タブを出していなければ、さそわない');
  }finally{
    A.S.ui.tabs = keepTabs;
    A.petMetaUpdate(function(m){ m.active = keepActive; }); A.commit();
  }
  await KT.settle([A, B]);
});

KT.test('おせわ＋：服とキャラの帽子が二重にならない（めがね・マフラー）', async function(){
  var A = KT.frames().A;
  var id = setup(A);
  var keepHat = (A.S.ui.chara || {}).hat, keepLv = (A.S.ui.chara || {}).level;
  var megane = /stroke="#5A4A58" stroke-width="2"><circle/, scarf = /stroke="#E0607E" stroke-width="7.5"/;
  var svgWith = function(wear){ A.petUpdate(id, function(o){ o.exp = 20; o.sleep = 0; o.wear = wear; }); return A.petSvg(id, A.petNow(id), 100); };
  try{
    A.charaSet({ hat:'megane', level:4 });
    eq(A.charaHatNow(), 'megane', 'キャラの帽子（まるめがね）');
    ok(megane.test(svgWith({})), 'ふだんは、あかちゃんもキャラのめがね');
    var html = svgWith({ face:'glasses' });
    ok(/pp-w-glasses/.test(html) && !megane.test(html), 'めがねの服を着ているときは、キャラのめがねをかけない');
    A.charaSet({ hat:'scarf' });
    if(A.charaHatNow() === 'scarf'){
      ok(scarf.test(svgWith({})), 'ふだんは、キャラのマフラー');
      html = svgWith({ neck:'bowtie' });
      ok(/pp-w-bowtie/.test(html) && !scarf.test(html), 'くびの服を着ているときは、キャラのマフラーをしない');
    }
  }finally{
    A.charaSet({ hat:keepHat, level:keepLv });
    A.petUpdate(id, function(o){ o.wear = {}; });
    A.commit();
  }
});
})();
