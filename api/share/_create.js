/* 時間割・課題の共有コードを作る（#49）
   使い方:
     POST /api/share/create  … { ok, code, expiresAt } を返す（合言葉 x-app-key が必要）
   コードは暗号論的な乱数で作る12文字（英大文字＋数字。見まちがえやすい 0・O・1・I は使わない）。
   有効期限は30日。保存は最大20件で、超えたら古いものから消す。期限切れは作るたびに掃除する。
   見る側は GET /api/share/view?code=<コード>（api/share/view.js）。
   Firestore の「部屋ID__share_v1」に { shares: JSON文字列({ コード: { createdAt, expiresAt } }), updatedAt } で置く。 */
'use strict';
const crypto = require('crypto');
const { sendJson, checkAppKey, fsGetDoc, fsSetDoc, SHARE_DOC } = require('../_fb');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 32文字
const CODE_LEN = 12;
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_SHARES = 20;

function newCode() {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s;
}
async function loadShares() {
  try {
    const doc = await fsGetDoc(SHARE_DOC);
    if (!doc || !doc.shares) return {};
    const o = JSON.parse(doc.shares);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch (e) { return {}; }
}
/* 期限切れを除き、新しい順に max 件だけ残す */
function pruneShares(map, nowMs, max) {
  const list = Object.keys(map || {})
    .map((k) => [k, map[k]])
    .filter((x) => x[1] && Date.parse(x[1].expiresAt) > nowMs)
    .sort((a, b) => Date.parse(b[1].createdAt) - Date.parse(a[1].createdAt))
    .slice(0, max);
  const out = {};
  list.forEach((x) => { out[x[0]] = x[1]; });
  return out;
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const now = Date.now();
    const shares = await loadShares();
    let code = newCode();
    while (shares[code]) code = newCode();
    const expiresAt = new Date(now + KEEP_MS).toISOString();
    shares[code] = { createdAt: new Date(now).toISOString(), expiresAt };
    await fsSetDoc(SHARE_DOC, { shares: JSON.stringify(pruneShares(shares, now, MAX_SHARES)), updatedAt: new Date(now).toISOString() });
    return sendJson(res, 200, { ok: true, code, expiresAt });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.loadShares = loadShares;
module.exports.pruneShares = pruneShares;
module.exports.ALPHABET = ALPHABET;
