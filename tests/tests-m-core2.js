/* くらしの手帳：検索・文字の大きさ・ホーム画面・データの点検・今日の自動評価・AIが全部を読める のテスト（KT.test で足す） */
(function(){
'use strict';
var ok = KT.ok, eq = KT.eq, J = KT.J;

/* AIのにせもの：「家計簿の明細」と聞かれたら、手帳を調べる道具を使う */
KT.ai.push(function(req){
  if(req.tag !== 'chat') return null;
  var last = (req.contents || [])[req.contents.length - 1] || {};
  var said = (last.parts || []).map(function(p){ return p.text || ''; }).join('');
  var fr = (last.parts || []).filter(function(p){ return p.functionResponse; })[0];
  if(fr && fr.functionResponse.name === 'get_app_data') return '調べました：' + String(fr.functionResponse.response.result).slice(0, 4000);
  if(/家計簿の明細を調べて/.test(said)) return { parts:[{ functionCall:{ name:'get_app_data', args:{ section:'money', query:'テスト用のパン屋' } } }] };
  return null;
});

KT.test('AI：アプリのすべての情報を読める（分野にもれがない・カギは見せない・道具で調べる）', async function(){
  var A = KT.frames().A;
  /* どのキーも、どこかの分野に入っているか、外す理由が書いてある */
  var covered = {};
  A.AI_SECTIONS.forEach(function(s){ s.keys.forEach(function(k){ covered[k] = s.id; }); });
  var missing = Object.keys(A.S).filter(function(k){ return !covered[k] && !A.AI_EXCLUDE[k]; });
  eq(missing.join(','), '', 'AIが読めないデータ');
  /* 同期するものもぜんぶ入っている */
  var partKeys = [];
  Object.keys(A.SYNC_PARTS).forEach(function(p){ A.SYNC_PARTS[p].keys.forEach(function(k){ partKeys.push(k); }); });
  var missing2 = partKeys.filter(function(k){ return !covered[k] && !A.AI_EXCLUDE[k]; });
  eq(missing2.join(','), '', 'AIが読めない同期データ');
  /* どの分野も読める */
  A.AI_SECTIONS.forEach(function(s){
    var r = A.aiSectionData(s.id, { limit:5 });
    ok(r && !r.error && r.section === s.id, s.id + ' が読めない：' + (r && r.error));
    ok(JSON.stringify(r).length > 10, s.id);
  });
  /* カギ・合言葉・同期の部屋は出さない */
  var keep = { g:A.S.settings.geminiKey, a:A.S.settings.apiKey };
  A.S.settings.geminiKey = 'SECRET_GEMINI_12345'; A.S.settings.apiKey = 'SECRET_CLAUDE_67890';
  A.S.cloud = A.S.cloud || {}; var keepLinks = A.S.cloud.links;
  A.S.cloud.links = J(A, { shortKey:'SECRETSHORTKEY1234567', mt:1 });
  var all = A.AI_SECTIONS.map(function(s){ return JSON.stringify(A.aiSectionData(s.id, { limit:200 })); }).join('\n') + JSON.stringify(A.aiSearchAll('SECRET'));
  ok(all.indexOf('SECRET_GEMINI') < 0 && all.indexOf('SECRET_CLAUDE') < 0 && all.indexOf('SECRETSHORTKEY') < 0, 'カギが見えてしまう');
  ok(all.indexOf(String(A.S.settings.room || 'x-no-room-x')) < 0 || !A.S.settings.room, '同期の部屋の名前が見えてしまう');
  A.S.settings.geminiKey = keep.g; A.S.settings.apiKey = keep.a; A.S.cloud.links = keepLinks;
  /* 授業の教室（room）は見せる */
  var cm = A.aiSectionData('timetable', {});
  ok(cm.courses && cm.nextDays && cm.nextDays.length === 14, '時間割と14日ぶん');
  /* 家計簿の明細を、AIが道具で調べて答える */
  A.kbAdd({ amount:432, title:'テスト用のパン屋', date:A.today(), src:'hand', ref:'test-bakery' });
  A.commit();
  var r2 = await A.chatAsk({ system:A.chatSystem(), contents:[{ role:'user', parts:[{ text:'家計簿の明細を調べて' }] }], text:'家計簿の明細を調べて' });
  ok(/テスト用のパン屋/.test(r2.text) && /432/.test(r2.text), 'AIが家計簿の明細を読める：' + String(r2.text).slice(0, 120));
  eq((r2.ops || []).length, 0, '読むだけなので、何も登録しない');
  var chatReq = KT.aiCalls.filter(function(c){ return c.tag === 'chat'; }).pop();
  ok(/手帳を調べる/.test(chatReq.system) && /money/.test(chatReq.system), '道具で調べるように、分野の一覧をわたす');
  /* ことばで、ぜんぶをさがす */
  var s = A.aiSearchAll('テスト用のパン屋');
  ok(s.count >= 1 && s.hits.some(function(h){ return h.section === 'money'; }), 'ことばでさがせる');
  var ov = A.aiOverview();
  ok(ov.sections.length === A.AI_SECTIONS.length && ov.today === A.today(), '目次');
  A.S.spends = A.S.spends.filter(function(x){ return x.ref !== 'test-bakery'; }); A.commit();
});
})();
