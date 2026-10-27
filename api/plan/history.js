/* 世代スナップショットと前回との差分サマリー（#79 / #40 の共通基盤）
   使い方:
     GET /api/plan/history  … 直近2世代の差分（残高の変化・明細の増減・予定の変更有無）と、
                               世代の一覧（時刻のみ）を返す
   世代は cron が日次で作る（api/_money.js の takeGenerationIfNewDay）。
   完全な復元UIは作らない（差分を見るための口だけ）。 */
'use strict';
const { sendJson, checkAppKey } = require('../_fb');
const M = require('../_money');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const gens = await M.loadGenerations();
    return sendJson(res, 200, {
      ok: true,
      diff: M.diffGenerations(gens),
      generations: gens.map((g) => ({ at: g.at, ymd: g.ymd })),
    });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
