/* 通知の即時送信（テスト送信・手動送信）
   POST /api/push/send { title, body, url?, device?, cat? }
   device を省略すると登録済みの全端末へ送ります。cat を付けると、その種類を「知らせない」にした端末へは送りません。
   送信には Vercel の環境変数 FIREBASE_SERVICE_ACCOUNT（Firebase のサービスアカウントJSON）が必要です。
   未設定のときは 501 と登録端末数を返します（登録までは動いていることが分かります）。 */
'use strict';
const { sendJson, readBody, loadDevices, saveDevices, serviceAccount, sendToDevices } = require('../_fb');

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
    const targets = {};
    for (const id of ids) if (devices[id]) targets[id] = devices[id];
    const job = { title: b.title, body: b.body, url: b.url };
    if (b.cat) job.cat = String(b.cat).slice(0, 20);
    const out = await sendToDevices(targets, job);
    const results = [];
    let changed = false;
    for (const r of out.results) {
      if (r.skipped) { results.push({ device: r.device, skipped: r.skipped }); continue; }
      results.push({ device: r.device, ok: r.ok, code: r.code });
      if (!r.ok && (r.code === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(r.body || ''))) {
        delete devices[r.device]; changed = true;
      }
    }
    if (changed) await saveDevices(devices);
    sendJson(res, 200, { ok: true, sent: out.sent, results });
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
};
