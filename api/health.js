/* サーバーの自己点検（#84）
   使い方:
     GET /api/health … { ok, checks:{ firestore, configDoc, geminiKey, model, sender }, at }
   - Firestore が読めるか、設定doc があるか、Gemini のモデル自動解決がどうなっているかを確認する。
   - 鍵そのものは返さず、有無（true/false）とモデルの解決元（source）だけを返す。
   - cron（api/push/cron.js）も日次で同じ点検をして、結果を cron ログに残す。
   （/api/health/cycle・/api/health/report・/api/health/rhythm は別ファイル） */
'use strict';
const { sendJson } = require('./_fb');
const { selfCheck } = require('./_hub');

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  const r = await selfCheck();
  return sendJson(res, 200, r);
}

module.exports = handler;
