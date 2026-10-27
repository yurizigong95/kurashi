/* くらしの手帳 Vercel API：バッチDの共通部品
   - JSON を1フィールドに文字列で置く文書の読み書き（既存の各文書と同じ流儀）。
   - 同期データの軽量スナップショット（#82。指紋＋件数だけを世代に残す）。
   - 自己点検（#84。GET /api/health と cron の日次点検で共用）。
   - ゲーム道場のサーバー記録（#151〜#160）と、送れなかったメールの送信箱（#163）の置き場。
   - 例外で落とさず、読めないときは空・false を返す（自己点検だけは状態を正直に返す）。 */
'use strict';
const {
  fsGetDoc, fsSetDoc,
  CONFIG_DOC, SNAPSHOTS_DOC, OUTBOX_DOC, GAME_DOC,
  serviceAccount,
} = require('./_fb');
const D = require('./_digest');
const { resolveModels } = require('./_models');

/* ===== JSON フィールドの読み書き ===== */
async function loadJsonField(docId, field, fallback) {
  try {
    const doc = await fsGetDoc(docId);
    if (!doc || doc[field] === undefined || doc[field] === null || doc[field] === '') return fallback;
    const v = typeof doc[field] === 'string' ? JSON.parse(doc[field]) : doc[field];
    return v === null || v === undefined ? fallback : v;
  } catch (e) { return fallback; }
}
async function saveJsonField(docId, field, value) {
  await fsSetDoc(docId, { [field]: JSON.stringify(value === undefined ? null : value), updatedAt: new Date().toISOString() });
  return true;
}

/* キーの順番に寄らない文字列化（指紋用） */
function stable(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
}

/* ===== 同期データの軽量スナップショット（#82） =====
   世代スナップショット（#40）は moneysnap＋予定の要約だけだったので、
   同期データ全体の指紋（core/plan/money/maps ごと）と件数を、同じ文書の
   syncGens フィールドに日次で最大12世代ぶん残す。中身そのものは残さない。 */
function list(v) { return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []; }
function syncFingerOf(data) {
  const d = data || {};
  const fingers = {}, counts = {};
  for (const part of ['core', 'plan', 'money', 'maps']) {
    const v = d[part];
    fingers[part] = v ? D.hash53(stable(v)) : '';
  }
  const plan = d.plan || {}, money = d.money || {}, maps = d.maps || {};
  counts.tasks = list(plan.tasks).length;
  counts.events = list(plan.events).length;
  counts.exams = list(plan.exams).length;
  counts.spends = list(money.spends).length;
  counts.attendCourses = Object.keys(maps.attendLog || {}).length;
  counts.grades = Object.keys(maps.grades || {}).length;
  return { fingers, counts };
}
const SYNC_GEN_MAX = 12;
async function loadSyncGens() {
  const gens = await loadJsonField(SNAPSHOTS_DOC, 'syncGens', []);
  return Array.isArray(gens) ? gens : [];
}
async function takeSyncSnapIfNewDay(data, ymdNow, nowMs) {
  try {
    if (!data || (!data.core && !data.plan && !data.money && !data.maps)) return { added: false };
    const gens = await loadSyncGens();
    const last = gens[gens.length - 1];
    if (last && last.ymd === ymdNow) return { added: false, gen: last };
    const f = syncFingerOf(data);
    const gen = { ymd: ymdNow, at: new Date(nowMs || Date.now()).toISOString(), fingers: f.fingers, counts: f.counts };
    gens.push(gen);
    await saveJsonField(SNAPSHOTS_DOC, 'syncGens', gens.slice(-SYNC_GEN_MAX));
    return { added: true, gen };
  } catch (e) { return { added: false, error: String((e && e.message) || e) }; }
}

/* ===== 自己点検（#84） =====
   Firestore が読めるか・設定doc があるか・モデルの自動解決がどうなっているかを確かめる。
   鍵そのものは返さず、有無（true/false）だけを返す。 */
async function selfCheck() {
  const checks = { firestore: 'error', configDoc: false, geminiKey: false, model: null, sender: false };
  try {
    const doc = await fsGetDoc(CONFIG_DOC);
    checks.firestore = 'ok';
    checks.configDoc = !!doc;
  } catch (e) { checks.firestore = 'error'; }
  checks.geminiKey = !!process.env.GEMINI_API_KEY;
  checks.sender = !!serviceAccount();
  try {
    const r = await resolveModels(process.env.GEMINI_API_KEY || '');
    checks.model = { model: r.model, heavy: r.heavy, source: r.source, updatedAt: r.updatedAt };
  } catch (e) { checks.model = null; }
  const ok = checks.firestore === 'ok';
  return { ok, checks, at: new Date().toISOString() };
}

/* ===== ゲーム道場のサーバー記録（#151〜#160） =====
   GAME_DOC の各フィールドに JSON 文字列で置く: scores / saves / records / weekly / pets */
async function loadGameField(field, fallback) { return loadJsonField(GAME_DOC, field, fallback); }
async function saveGameField(field, value) { return saveJsonField(GAME_DOC, field, value); }

/* ===== 送信箱（#163。送れなかったメールを貯める） ===== */
const OUTBOX_MAX = 50;
async function loadOutbox() {
  const entries = await loadJsonField(OUTBOX_DOC, 'entries', []);
  return Array.isArray(entries) ? entries : [];
}
async function enqueueOutbox(entry) {
  try {
    const entries = await loadOutbox();
    entries.push(entry);
    while (entries.length > OUTBOX_MAX) entries.shift();
    await saveJsonField(OUTBOX_DOC, 'entries', entries);
    return { queued: true, count: entries.length };
  } catch (e) {
    return { queued: false, error: String((e && e.message) || e) };
  }
}

module.exports = {
  loadJsonField, saveJsonField, stable,
  syncFingerOf, loadSyncGens, takeSyncSnapIfNewDay,
  selfCheck,
  loadGameField, saveGameField,
  loadOutbox, enqueueOutbox,
};
