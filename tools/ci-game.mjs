// ゲーム道場（game/）：新しい版を入れたときに、kurashi 用のつなぎがちゃんと動くかを調べる（GitHub Actions で動く）
//  ・AI は Gemini（Claude のページの sample のかわり）：少しずつ表示・モデルの切りかえ・キーはヘッダー・手帳のキーを借りる
//  ・3D の素材（assets3d/）が同じ場所から読める
//  ・リアルタイム対局（2台）：手帳と同じ Firebase に部屋を置く（ここでは にせの Firebase）
//  ・記録の同期：成績などはそろう。APIキー・3Dの設定・端末だけの印は送らない
// 本物の Gemini・Firebase にはつながない。
import { chromium } from 'playwright';

const URL = process.env.TEST_URL || 'http://127.0.0.1:8080/game/index.html';
let bad = 0;
const say = (ok, msg) => { if (!ok) { bad++; console.log('::error::' + msg); } else console.log('  ' + msg); };

// にせの Firebase（v10 のモジュールの形）。中身はこのテストの STORE に置き、書くたびに全部の画面へ知らせる
const FAKE_APP = 'export function initializeApp(c,n){ return {c,n}; }';
const FAKE_FS = `
const subs={};
function snap(d){ return {exists:()=>!!d,data:()=>d?JSON.parse(JSON.stringify(d)):undefined}; }
window.__fsPush=(id,d)=>{ (subs[id]||[]).forEach(f=>f(snap(d))); };
export function getFirestore(){ return {}; }
export function doc(db,col,id){ return {id:col+'/'+id}; }
export async function getDoc(r){ return snap(await window.__fsGet(r.id)); }
export async function setDoc(r,d,o){ await window.__fsSet(r.id,JSON.parse(JSON.stringify(d)),!!(o&&o.merge)); }
export function onSnapshot(r,next){ (subs[r.id]=subs[r.id]||[]).push(next); window.__fsGet(r.id).then(d=>next(snap(d))); return ()=>{ subs[r.id]=(subs[r.id]||[]).filter(f=>f!==next); }; }
`;
const STORE = {};
const PAGES = [];
const deep = (a, b) => { const o = Object.assign({}, a || {}); for (const k in b) { const v = b[k]; if (v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) o[k] = deep(o[k], v); else o[k] = v; } return o; };
const TECHO = { settings: { room: 'testroom123', fbConfig: '{"apiKey":"x","projectId":"p-test","appId":"1:2:web:3"}', geminiKey: 'kurashi-key' } };

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const errors = [];

// 1台の端末（保存場所は端末ごとに別。techo：くらしの手帳を開いたことがあるか）
async function device(opt) {
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: opt.phone ? { width: 390, height: 844 } : { width: 1200, height: 900 } });
  // ネットに出られない場所で試すときは、chess.js を手元のファイルから出す（CHESS_JS）
  if (process.env.CHESS_JS) await ctx.route('https://cdnjs.cloudflare.com/ajax/libs/chess.js/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', path: process.env.CHESS_JS }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_APP, headers: { 'access-control-allow-origin': '*' } }));
  await ctx.route('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_FS, headers: { 'access-control-allow-origin': '*' } }));
  await ctx.exposeFunction('__fsGet', (id) => STORE[id] || null);
  await ctx.exposeFunction('__fsSet', (id, d, merge) => {
    STORE[id] = merge ? deep(STORE[id], d) : d;
    const v = STORE[id];
    setTimeout(() => PAGES.forEach((p) => p.evaluate(([i, x]) => window.__fsPush && window.__fsPush(i, x), [id, v]).catch(() => {})), 0);
  });
  // Gemini のにせもの：1つめのモデルは「枠がいっぱい（429）」、2つめは少しずつ答える
  const reqs = [];
  await ctx.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const r = route.request();
    reqs.push({ url: r.url(), key: r.headers()['x-goog-api-key'], body: JSON.parse(r.postData() || '{}') });
    if (/gemini-3\.6-flash/.test(r.url())) return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { message: 'quota' } }) });
    const chunk = (t) => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] }) + '\n\n';
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: chunk('ナイトを') + chunk('f3へ（Nf3）。\n[図] g1f3:緑') });
  });
  await ctx.addInitScript(([techo, key]) => {
    try {
      if (techo && !localStorage.getItem('shiharai:v1')) localStorage.setItem('shiharai:v1', JSON.stringify(techo));
      if (key && !localStorage.getItem('gd-gemini-key')) localStorage.setItem('gd-gemini-key', key);
    } catch (e) {}
  }, [opt.techo ? TECHO : null, opt.key || null]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  PAGES.push(page);
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.CDH && typeof window.CDH.sample === 'function', null, { timeout: 30000 });
  return { page, reqs };
}

// ---- 1. 手帳のない端末（スマホの幅）：AI は Gemini。パソコンの中なので部屋は使わない ----
{
  const { page, reqs } = await device({ phone: true, key: 'test-key' });
  say((await page.title()) === 'ゲーム道場', 'タイトル：' + (await page.title()));
  say(await page.isVisible('#gdHome'), '入口の建物が出る');
  say(await page.evaluate(() => window.CDH.sample.name === 'geminiSample'), 'AIは Gemini につながっている');
  say(await page.evaluate(() => window.CDH.db === null), 'パソコンの中で、手帳の設定もなければ、本物の Firebase にはつながない');
  say(await page.evaluate(() => document.getElementById('ghKairo').hidden), '手帳のない端末では「カイロ名作棚」を出さない');

  const r = await page.evaluate(async () => {
    const seen = [];
    const out = await window.CDH.sample([{ role: 'user', content: 'ルール' }, { role: 'user', content: '質問' }, { role: 'assistant', content: '答え' }, { role: 'user', content: 'つぎ' }], { cache: false, onText: ({ text }) => seen.push(text) });
    return { text: out.text, seen };
  });
  say(r.text === 'ナイトをf3へ（Nf3）。\n[図] g1f3:緑', 'Gemini の答え：' + JSON.stringify(r.text));
  say(r.seen.length >= 2, '少しずつ表示される（' + r.seen.length + '回）');
  say(reqs.length === 2 && /3\.6-flash/.test(reqs[0].url) && /2\.5-flash/.test(reqs[1].url), '枠がいっぱいのモデルは飛ばして次へ：' + reqs.map((q) => (q.url.match(/models\/([^:]+)/) || [])[1]).join(' → '));
  say(reqs.every((q) => q.key === 'test-key' && !/key=/.test(q.url)), 'キーはヘッダーで送る（URLに入れない）');
  const roles = ((reqs[1] && reqs[1].body.contents) || []).map((c) => c.role + ':' + c.parts.length).join(',');
  say(roles === 'user:2,model:1,user:1', '同じ側の発言は1つにまとめる：' + roles);

  // チェスの AI コーチに聞く（スマホの幅では ≡ の中なので、送信だけする）
  await page.click('.gh-enter');
  await page.waitForTimeout(1200);
  say(await page.evaluate(() => !document.getElementById('ai').hidden), 'チェスの AI コーチが出る');
  await page.evaluate(() => { document.getElementById('askInput').value = '次はどうする？'; document.getElementById('askForm').requestSubmit(); });
  await page.waitForFunction(() => /ナイトをf3へ/.test(document.getElementById('aiLog').textContent), null, { timeout: 10000 }).catch(() => {});
  const log = await page.$eval('#aiLog', (e) => e.textContent);
  say(/ナイトをf3へ/.test(log) && !/\[図\]/.test(log), 'コーチの答えが出る（[図] の行はかくれる）');
  say(await page.$$eval('#aiLog svg', (a) => a.length) > 0, 'コーチの図が出る');

  // 3D の素材は、このページと同じ場所（game/assets3d/）から読める
  const a3 = await page.evaluate(async () => {
    const out = {};
    for (const f of ['trains', 'people', 'houses', 'towns', 'nature', 'props', 'industry', 'oldtown', 'boats', 'cars', 'winter']) {
      try { const r = await fetch('assets3d/' + f + '.gltf.json'); const j = await r.json(); out[f] = r.ok && !!j.asset; } catch (e) { out[f] = false; }
    }
    for (const f of ['ground-grass-c.jpg', 'ground-dune-n512.jpg', 'ground-snow-h512.jpg', 'chars-arena-dirt.png']) {
      try { const r = await fetch('assets3d/' + f); out[f] = r.ok && (await r.blob()).size > 1000; } catch (e) { out[f] = false; }
    }
    return out;
  });
  const miss = Object.keys(a3).filter((k) => !a3[k]);
  say(miss.length === 0, '3D の素材が読める（' + Object.keys(a3).length + 'こ）' + (miss.length ? '　読めない：' + miss.join(',') : ''));
  say(await page.evaluate(() => document.querySelectorAll('.ar-card').length) >= 50, 'ゲームセンターの一覧が出る');
}

// ---- 2. 手帳のある端末 2台：リアルタイム対局（チェス） ----
async function openLive(name) {
  const d = await device({ techo: true });
  const p = d.page;
  say(await p.evaluate(() => !!window.CDH.db && !document.getElementById('ghKairo').hidden), name + '：手帳のつなぎ先を借りて部屋が使える・カイロ名作棚が出る');
  await p.click('#gdHome [data-go="friend"]');
  await p.waitForTimeout(900);
  if (!(await p.isVisible('#friendNav [data-sub="live"]'))) {
    const card = p.locator('#arcade .ar-card', { hasText: 'チェス' }).first();
    if (await card.count()) { await card.click(); await p.waitForTimeout(600); }
  }
  await p.click('#friendNav [data-sub="live"]');
  await p.waitForSelector('#liveCard:not([hidden])');
  await p.fill('#liveName', name);
  return d;
}
const { page: A, reqs: reqA } = await openLive('あい');
await A.evaluate(() => window.CDH.sample([{ role: 'user', content: 'x' }], {}));
say(reqA.length > 0 && reqA.every((q) => q.key === 'kurashi-key'), '手帳に入れた API キーをそのまま使う');
say(await A.isHidden('#liveOff') && await A.isVisible('#liveOn'), 'リアルタイム対局の欄が使える');
await A.click('#btnRoomNew');
await A.waitForFunction(() => /[A-Z0-9]{5}/.test(document.getElementById('roomInfo').textContent), null, { timeout: 8000 }).catch(() => {});
const code = ((await A.$eval('#roomInfo', (e) => e.textContent)).match(/[A-Z2-9]{5}/) || [])[0] || '';
const RID = 'shiharai/testroom123__gd_rooms_' + code;
say(!!code && !!STORE[RID], '部屋は手帳の合言葉ではじまる名前で置く：' + Object.keys(STORE).join(','));
const { page: B } = await openLive('びー');
await B.fill('#roomIn', code);
await B.click('#btnRoomJoin');
await B.waitForTimeout(1500);
const seats = (STORE[RID] || {}).seats || {};
say(seats.w && seats.b && seats.w !== seats.b, '席は2人ぶん（あとから入った人が、先の人の席を消さない）');
await A.waitForTimeout(500);
await A.click('#board .sq[data-sq="e2"]');
await A.waitForTimeout(300);
await A.click('#board .sq[data-sq="e4"]');
const moved = await B.waitForFunction(() => !!document.querySelector('#board .sq[data-sq="e4"] .pc') && !document.querySelector('#board .sq[data-sq="e2"] .pc'), null, { timeout: 10000 }).then(() => true, () => false);
say(moved && /e4/.test((STORE[RID] || {}).pgn || ''), '1台目が e2→e4 と指すと、2台目の盤も動く');

// ---- 3. 記録の同期：1台目の記録が、まっさらな3台目にそろう ----
await A.evaluate(() => {
  localStorage.setItem('chess-dojo-stats', JSON.stringify({ xp: 123 }));
  localStorage.setItem('gd-rail-book-japan', JSON.stringify({ tokyo: 1 }));
  localStorage.setItem('gd-rail-3d', 'false');
  localStorage.setItem('gd-kaiju-3d', '0');
  localStorage.setItem('gd-home-last', 'party');
  localStorage.setItem('gd-gemini-key', 'secret-key');
});
const SK = 'shiharai/testroom123__gd_state_all';
let pushed = null;
for (let i = 0; i < 50 && !pushed; i++) {
  const v = STORE[SK] ? JSON.parse(STORE[SK].d || '{}') : {};
  if (/"xp":123/.test(v['chess-dojo-stats'] || '')) pushed = v; else await A.waitForTimeout(500);
}
say(!!pushed, '記録が置き場に送られる');
const ks = Object.keys(pushed || {});
say(ks.includes('chess-dojo-stats') && ks.includes('gd-rail-book-japan'), '成績と鉄道すごろくの図かんを送る');
say(!ks.some((k) => /gd-gemini-key|gd-rail-3d|gd-kaiju-3d|gd-home-last|chess-dojo-rooms/.test(k)), 'API キー・3D の設定・端末だけの印は送らない：' + ks.join(','));
const C = (await device({ techo: true })).page;
const got = await C.waitForFunction(() => /"xp":123/.test(localStorage.getItem('chess-dojo-stats') || ''), null, { timeout: 20000 }).then(() => true, () => false);
say(got, 'まっさらな端末に、成績がそろう');
await C.waitForLoadState('load');
await C.waitForTimeout(1500);
say(await C.evaluate(() => localStorage.getItem('gd-gemini-key') === null && localStorage.getItem('gd-rail-3d') === null), 'API キーと 3D の設定は、ほかの端末に入らない');

say(errors.length === 0, `画面のエラー：${errors.length}件 ${errors.slice(0, 3).join(' / ')}`);
await browser.close();
console.log(bad ? `失敗 ${bad}件` : 'ゲーム道場：問題なし');
process.exit(bad ? 1 : 0);
