/* ゲーム道場のセーブのクラウド保存（#155）— コードキー方式
   使い方:
     POST /api/game/save  { game, data }   … { ok, code, expiresAt }（コードは8文字）
     GET  /api/game/save?code=<コード>     … { ok, game, data, at }
   - コードを知っている人が読み書きの資格になる（api/share と同じ考え方）。
   - 有効期限は90日。保存は最大100件で、期限切れは読み書きのたびに掃除する。
   - data は JSON として解釈できるものだけを、文字列化して 20,000 字まで。
   保存先は「部屋ID__game_v1」の saves（JSON文字列の { コード: { game, data, at, expiresAt } }）。 */
'use strict';
const crypto = require('crypto');
const { sendJson, readBody, checkAppKey } = require('../_fb');
const { loadGameField, saveGameField } = require('../_hub');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 8;
const KEEP_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_SAVES = 100;
const MAX_DATA = 20000;

function newCode() {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s;
}
function pruneSaves(map, nowMs) {
  const list = Object.keys(map || {})
    .map((k) => [k, map[k]])
    .filter((x) => x[1] && Date.parse(x[1].expiresAt) > nowMs)
    .sort((a, b) => Date.parse(b[1].at) - Date.parse(a[1].at))
    .slice(0, MAX_SAVES);
  const out = {};
  list.forEach((x) => { out[x[0]] = x[1]; });
  return out;
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  try {
    const savesRaw = await loadGameField('saves', {});
    const saves = savesRaw && typeof savesRaw === 'object' && !Array.isArray(savesRaw) ? savesRaw : {};
    if (req.method === 'GET') {
      const q = new URL(req.url || '/', 'http://localhost').searchParams;
      const code = String(q.get('code') || '').trim().toUpperCase();
      const s = saves[code];
      if (!s || !(Date.parse(s.expiresAt) > Date.now())) return sendJson(res, 404, { error: 'not found' });
      let data = null;
      try { data = JSON.parse(s.data); } catch (e) { data = s.data; }
      return sendJson(res, 200, { ok: true, game: s.game, data, at: s.at });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });
    if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
    const body = await readBody(req);
    const game = String((body && body.game) || '');
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(game)) return sendJson(res, 400, { error: 'game（英数字40字まで）が必要です' });
    let dataStr = '';
    try { dataStr = JSON.stringify(body.data === undefined ? null : body.data); } catch (e) { dataStr = ''; }
    if (!dataStr) return sendJson(res, 400, { error: 'data が必要です' });
    if (dataStr.length > MAX_DATA) return sendJson(res, 413, { error: 'セーブデータが大きすぎます（' + MAX_DATA + '字まで）' });
    const now = Date.now();
    let code = newCode();
    while (saves[code]) code = newCode();
    saves[code] = { game, data: dataStr, at: new Date(now).toISOString(), expiresAt: new Date(now + KEEP_MS).toISOString() };
    await saveGameField('saves', pruneSaves(saves, now));
    return sendJson(res, 200, { ok: true, code, expiresAt: saves[code].expiresAt });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.pruneSaves = pruneSaves;
