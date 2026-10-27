/* 通知を受け取る端末の登録（Vercel版）
   POST /api/push/register { device, token, name }
   アプリの通知ONのとき、GAS 側に加えてここへも登録されます（js/notify.js）。 */
'use strict';
const { sendJson, readBody, loadDevices, saveDevices } = require('../_fb');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  try {
    const b = await readBody(req);
    const device = String(b.device || '').slice(0, 80);
    const token = String(b.token || b.pushToken || '');
    if (!device || !token) return sendJson(res, 400, { error: 'device と token が必要です' });
    const devices = await loadDevices();
    devices[device] = { token, name: String(b.name || '').slice(0, 60), at: new Date().toISOString() };
    await saveDevices(devices);
    sendJson(res, 200, { ok: true, devices: Object.keys(devices).length });
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
};
