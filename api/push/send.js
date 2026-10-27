/* 通知の即時送信（テスト送信・手動送信）
   POST /api/push/send { title, body, url?, device? }
   device を省略すると登録済みの全端末へ送ります。
   送信には Vercel の環境変数 FIREBASE_SERVICE_ACCOUNT（Firebase のサービスアカウントJSON）が必要です。
   未設定のときは 501 と登録端末数を返します（登録までは動いていることが分かります）。 */
'use strict';
const { sendJson, readBody, loadDevices, saveDevices, serviceAccount, fcmSendTo } = require('../_fb');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method === 'GET') {
    try {
      const devices = await loadDevices();
      return sendJson(res, 200, { ok: true, senderReady: !!serviceAccount(), devices: Object.keys(devices).length });
    } catch (e) { return sendJson(res, 500, { error: e.message }); }
  }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  try {
    const b = await readBody(req);
    const devices = await loadDevices();
    const ids = b.device ? [String(b.device)] : Object.keys(devices);
    if (!serviceAccount()) {
      return sendJson(res, 501, {
        error: '送信の鍵（FIREBASE_SERVICE_ACCOUNT）が未設定です', code: 'NO_SA',
        devices: Object.keys(devices).length,
      });
    }
    const results = [];
    let changed = false;
    for (const id of ids) {
      const d = devices[id];
      if (!d || !d.token) continue;
      const r = await fcmSendTo(d.token, b.title, b.body, b.url);
      results.push({ device: id, ok: r.ok, code: r.code });
      if (!r.ok && (r.code === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(r.body || ''))) {
        delete devices[id]; changed = true;
      }
    }
    if (changed) await saveDevices(devices);
    sendJson(res, 200, { ok: true, sent: results.filter((x) => x.ok).length, results });
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
};
