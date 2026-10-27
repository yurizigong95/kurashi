/* 時刻表のサーバー配信（#51）
   使い方:
     GET  /api/transit  … 登録済みの時刻表 { ok, source:'server', tables, holiday, updatedAt }。無ければ { ok, source:'none', tables:null }
     POST /api/transit  … { tables, holiday? } で丸ごと差し替える（合言葉 x-app-key が必要）
   tables / holiday は { busGo, trainGo, trainBack, busBack, busWork } の各テーブルに
   ['HH:MM'(出発), 'HH:MM'(到着)] の配列を入れた形（アプリの S.transit.custom と同じ）。
   holiday は土日・祝日用（任意）。無いテーブルは平日用（tables）を使う。
   アプリは /api/config の transit で受け取り、同じ名前のテーブルを内蔵のダイヤより優先する。
   Firestore の「部屋ID__transit_v1」に { tables: JSON文字列, holiday: JSON文字列, updatedAt } で置く。 */
'use strict';
const { sendJson, readBody, checkAppKey, fsGetDoc, fsSetDoc, TRANSIT_DOC } = require('./_fb');
const { minutesOf } = require('./_digest');

const TABLE_NAMES = ['busGo', 'trainGo', 'trainBack', 'busBack', 'busWork'];
const MAX_ROWS = 300;

function pad(n) { return String(n).padStart(2, '0'); }
function normTime(v) {
  const m = minutesOf(v);
  if (m === null || m < 0 || m >= 24 * 60 + 60) return '';   // 終電の 24:xx 表記までは受ける
  return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
}
/* 1つの表（{ 名前: [[dep, arr], ...] }）を整える。使える便が1つも無ければ null */
function normalizeTables(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out = {};
  let n = 0;
  TABLE_NAMES.forEach((name) => {
    const rows = Array.isArray(input[name]) ? input[name] : null;
    if (!rows) return;
    const list = [];
    rows.forEach((r) => {
      if (!Array.isArray(r) || r.length < 2 || list.length >= MAX_ROWS) return;
      const dep = normTime(r[0]), arr = normTime(r[1]);
      if (!dep || !arr) return;
      list.push([dep, arr]);
    });
    list.sort((a, b) => minutesOf(a[0]) - minutesOf(b[0]));
    out[name] = list;
    n += list.length;
  });
  return n ? out : null;
}
/* POST の中身を整える。tables が使えなければ null */
function normalizeTransit(input) {
  if (!input || typeof input !== 'object') return null;
  const tables = normalizeTables(input.tables);
  if (!tables) return null;
  return { tables, holiday: input.holiday ? normalizeTables(input.holiday) : null };
}

function parseJson(v) {
  if (v && typeof v === 'object') return v;
  if (typeof v !== 'string' || !v) return null;
  try { return JSON.parse(v); } catch (e) { return null; }
}
/* 登録済みの時刻表。無い・読めないときは null */
async function loadTransit() {
  try {
    const doc = await fsGetDoc(TRANSIT_DOC);
    if (!doc) return null;
    const tables = parseJson(doc.tables);
    if (!tables || typeof tables !== 'object') return null;
    return { tables, holiday: parseJson(doc.holiday), updatedAt: doc.updatedAt || '' };
  } catch (e) { return null; }
}
async function saveTransit(t) {
  const updatedAt = new Date().toISOString();
  await fsSetDoc(TRANSIT_DOC, { tables: JSON.stringify(t.tables), holiday: JSON.stringify(t.holiday || null), updatedAt });
  return updatedAt;
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  try {
    if (req.method === 'GET') {
      const t = await loadTransit();
      if (!t) return sendJson(res, 200, { ok: true, source: 'none', tables: null });
      return sendJson(res, 200, { ok: true, source: 'server', tables: t.tables, holiday: t.holiday, updatedAt: t.updatedAt });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });
    if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
    const body = await readBody(req);
    const t = normalizeTransit(body);
    if (!t) return sendJson(res, 400, { error: '時刻表の形がちがいます（tables に [出発, 到着] の配列が必要です）' });
    const updatedAt = await saveTransit(t);
    const counts = {};
    Object.keys(t.tables).forEach((k) => { counts[k] = t.tables[k].length; });
    return sendJson(res, 200, { ok: true, counts, holiday: !!t.holiday, updatedAt });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.normalizeTransit = normalizeTransit;
module.exports.loadTransit = loadTransit;
module.exports.TABLE_NAMES = TABLE_NAMES;
