/* ゲーム道場のランキング（#152・#160）
   使い方:
     GET /api/game/ranking?game=<id> … { ok, game, allTime:[上位20件], weekly:{ weekStart, top:[...] } | null }
   週間集計は cron（api/push/cron.js）が週に1回、GAME_DOC の weekly に作る。
   ここは読むだけ（集計がまだ無ければ weekly:null を返す）。 */
'use strict';
const { sendJson, checkAppKey } = require('../_fb');
const { loadGameField } = require('../_hub');
const { topOf } = require('./score');

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const q = new URL(req.url || '/', 'http://localhost').searchParams;
    const game = String(q.get('game') || '');
    if (!game) return sendJson(res, 400, { error: 'game が必要です' });
    const scores = await loadGameField('scores', []);
    const weekly = await loadGameField('weekly', null);
    const w = weekly && weekly.byGame && Array.isArray(weekly.byGame[game])
      ? { weekStart: weekly.weekStart, weekEnd: weekly.weekEnd, top: weekly.byGame[game] }
      : null;
    return sendJson(res, 200, { ok: true, game, allTime: topOf(Array.isArray(scores) ? scores : [], game, 20), weekly: w });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
