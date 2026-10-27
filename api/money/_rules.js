/* 家計簿の自動分類ルールの一括管理（#36）
   使い方:
     GET  /api/money/rules  … いまのルール（サーバー設定 or 既定値）を返す
     POST /api/money/rules  … { rules: [{ cat, keywords: [...] }] } で丸ごと差し替える
   ルール本体は Firestore の「部屋ID__rules_v1」に置き、/api/config でも配信する。
   アプリ（js/kakeibo.js）は Vercel 版のときだけ、内蔵の KB_GUESS より先にこのルールを
   当てる。カテゴリはアプリの KB_CATS と同じ id を使う。 */
'use strict';
const { sendJson, readBody, checkAppKey } = require('../_fb');
const M = require('../_money');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    if (req.method === 'GET') {
      const r = await M.loadRules();
      return sendJson(res, 200, { ok: true, rules: r.rules, source: r.source, updatedAt: r.updatedAt });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });
    const body = await readBody(req);
    const saved = await M.saveRules(body && body.rules);
    if (!saved) return sendJson(res, 400, { error: 'ルールの形がちがいます（cat と keywords が必要です）' });
    return sendJson(res, 200, { ok: true, rules: saved, source: 'server' });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
