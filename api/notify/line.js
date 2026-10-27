/* LINE への通知（#162）
   使い方:
     POST /api/notify/line  { text } … 環境変数 LINE_CHANNEL_TOKEN と LINE_USER_ID があれば
                                       Messaging API で自分の LINE に push する
   未設定なら 501 { ok:false, code:'NO_ENV' }（送ったことにはしない）。 */
'use strict';
const { sendJson, readBody, checkAppKey } = require('../_fb');

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  const token = process.env.LINE_CHANNEL_TOKEN || '';
  const userId = process.env.LINE_USER_ID || '';
  if (!token || !userId) return sendJson(res, 501, { ok: false, code: 'NO_ENV', error: 'LINE_CHANNEL_TOKEN / LINE_USER_ID が未設定です' });
  try {
    const body = await readBody(req);
    const text = String((body && body.text) || '').slice(0, 4900);
    if (!text) return sendJson(res, 400, { error: 'text が必要です' });
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10000);
    try {
      const r = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
        signal: ac.signal,
      });
      if (!r.ok) return sendJson(res, 502, { ok: false, error: 'LINE への送信に失敗しました（' + r.status + '）' });
      return sendJson(res, 200, { ok: true, via: 'line' });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
