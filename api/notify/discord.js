/* Discord への通知の中継（#161）
   使い方:
     POST /api/notify/discord  { text } … 環境変数 DISCORD_WEBHOOK_URL があれば Webhook で送る
   Webhook の URL（＝秘密情報）はサーバーだけに置く。未設定なら 501 { ok:false, code:'NO_HOOK' }。 */
'use strict';
const { sendJson, readBody, checkAppKey } = require('../_fb');

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  const url = process.env.DISCORD_WEBHOOK_URL || '';
  if (!url) return sendJson(res, 501, { ok: false, code: 'NO_HOOK', error: 'DISCORD_WEBHOOK_URL が未設定です' });
  try {
    const body = await readBody(req);
    const text = String((body && body.text) || '').slice(0, 1900);
    if (!text) return sendJson(res, 400, { error: 'text が必要です' });
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10000);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
        signal: ac.signal,
      });
      if (!r.ok) return sendJson(res, 502, { ok: false, error: 'Discord への送信に失敗しました（' + r.status + '）' });
      return sendJson(res, 200, { ok: true, via: 'discord' });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
