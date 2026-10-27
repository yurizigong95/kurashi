/* ゲーム道場の記録（棋譜など）の保存（#156）と、対局のポーリング材料（#151）
   使い方:
     POST /api/game/record  { game, kind, data } … 連番（seq）を付けて1件保存する { ok, seq }
     GET  /api/game/record?game=<id>[&kind=<種類>][&since=<seq>]
                            … since より後の記録を古い順に返す（最大50件）
   リアルタイム対局（WebSocket）は Vercel のサーバーレスでは持てないため、代わりに
   「seq で差分を引くポーリング」で相手の手を受け取る形の材料にする（#151 は partial）。
   保存先は「部屋ID__game_v1」の records（JSON文字列の配列、最大300件）。 */
'use strict';
const { sendJson, readBody, checkAppKey } = require('../_fb');
const { loadGameField, saveGameField } = require('../_hub');

const MAX_RECORDS = 300;
const MAX_LIST = 50;
const MAX_DATA = 20000;

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const raw = await loadGameField('records', []);
    const records = Array.isArray(raw) ? raw : [];
    if (req.method === 'GET') {
      const q = new URL(req.url || '/', 'http://localhost').searchParams;
      const game = String(q.get('game') || '');
      const kind = String(q.get('kind') || '');
      const since = Number(q.get('since')) || 0;
      if (!game) return sendJson(res, 400, { error: 'game が必要です' });
      const out = records
        .filter((r) => r && r.game === game && (!kind || r.kind === kind) && (Number(r.seq) || 0) > since)
        .slice(-MAX_LIST);
      const lastSeq = records.reduce((m, r) => Math.max(m, Number(r && r.seq) || 0), 0);
      return sendJson(res, 200, { ok: true, game, records: out, lastSeq });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });
    const body = await readBody(req);
    const game = String((body && body.game) || '');
    const kind = String((body && body.kind) || 'record').slice(0, 40);
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(game)) return sendJson(res, 400, { error: 'game（英数字40字まで）が必要です' });
    let dataStr = '';
    try { dataStr = JSON.stringify(body.data === undefined ? null : body.data); } catch (e) { dataStr = ''; }
    if (dataStr.length > MAX_DATA) return sendJson(res, 413, { error: '記録が大きすぎます（' + MAX_DATA + '字まで）' });
    const seq = records.reduce((m, r) => Math.max(m, Number(r && r.seq) || 0), 0) + 1;
    const rec = { seq, game, kind, data: dataStr, at: new Date().toISOString() };
    records.push(rec);
    while (records.length > MAX_RECORDS) records.shift();
    await saveGameField('records', records);
    return sendJson(res, 200, { ok: true, seq });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
