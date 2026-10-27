/* データ移行のワンタイムコード（#90・#199）
   使い方:
     POST /api/transfer  { action:'issue' }            … コードを発行する { ok, code, expiresAt }（合言葉が必要）
     POST /api/transfer  { action:'consume', code }    … コードを使って接続情報を得る（1回だけ）
     GET  /api/transfer?code=<コード>                  … consume と同じ（QRコードのリンク用）
   考え方:
     - 新しい端末への引っ越しは、アプリの同期の「部屋」が担っている。端末が同じ部屋に
       入れば、データ本体は既存の同期でそのまま届く。
     - なので、このコードが運ぶのは「部屋ID（接続情報）」だけ。コードは24時間有効・1回限り。
     - QRコードはクライアント側でこのコード（または GET の URL）を表示すればよい。
   保存先は「部屋ID__transfer_v1」の codes（JSON文字列の { コード: { createdAt, expiresAt, used } }）。 */
'use strict';
const crypto = require('crypto');
const { sendJson, readBody, checkAppKey, fsGetDoc, fsSetDoc, ROOM, TRANSFER_DOC } = require('./_fb');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // api/share/create.js と同じ（見まちがえやすい文字を除く）
const CODE_LEN = 12;
const KEEP_MS = 24 * 60 * 60 * 1000;
const MAX_CODES = 10;

function newCode() {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s;
}
async function loadCodes() {
  try {
    const doc = await fsGetDoc(TRANSFER_DOC);
    if (!doc || !doc.codes) return {};
    const o = JSON.parse(doc.codes);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch (e) { return {}; }
}
/* 期限切れ・使用済み（1日以上前）を掃除し、新しい順に max 件だけ残す */
function pruneCodes(map, nowMs, max) {
  const list = Object.keys(map || {})
    .map((k) => [k, map[k]])
    .filter((x) => x[1] && Date.parse(x[1].expiresAt) > nowMs - 24 * 60 * 60 * 1000)
    .sort((a, b) => Date.parse(b[1].createdAt) - Date.parse(a[1].createdAt))
    .slice(0, max);
  const out = {};
  list.forEach((x) => { out[x[0]] = x[1]; });
  return out;
}
async function saveCodes(map, nowMs) {
  await fsSetDoc(TRANSFER_DOC, { codes: JSON.stringify(pruneCodes(map, nowMs, MAX_CODES)), updatedAt: new Date(nowMs).toISOString() });
}

async function consume(codeRaw, res) {
  const code = String(codeRaw || '').trim().toUpperCase();
  if (!new RegExp('^[' + ALPHABET + ']{' + CODE_LEN + '}$').test(code)) {
    return sendJson(res, 404, { error: 'not found' });
  }
  const now = Date.now();
  const codes = await loadCodes();
  const c = codes[code];
  if (!c || c.used || !(Date.parse(c.expiresAt) > now)) return sendJson(res, 404, { error: 'not found' });
  c.used = new Date(now).toISOString();
  await saveCodes(codes, now);
  return sendJson(res, 200, {
    ok: true, kind: 'kurashi-transfer', room: ROOM,
    note: '新しい端末の「くらしの手帳」で、同期の設定にこの部屋IDを入れると、同じデータが届きます。データ本体は既存の同期が運びます。このコードは使用済みになりました。',
  });
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  try {
    if (req.method === 'GET') {
      const q = new URL(req.url || '/', 'http://localhost').searchParams;
      return consume(q.get('code'), res);
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });
    const body = await readBody(req);
    const action = String((body && body.action) || '');
    if (action === 'consume') return consume(body.code, res);
    if (action !== 'issue') return sendJson(res, 400, { error: "action は 'issue' か 'consume' です" });
    if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
    const now = Date.now();
    const codes = await loadCodes();
    let code = newCode();
    while (codes[code]) code = newCode();
    const expiresAt = new Date(now + KEEP_MS).toISOString();
    codes[code] = { createdAt: new Date(now).toISOString(), expiresAt, used: '' };
    await saveCodes(codes, now);
    return sendJson(res, 200, { ok: true, code, expiresAt });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.pruneCodes = pruneCodes;
