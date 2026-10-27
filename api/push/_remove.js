/* 通知を受け取る端末の解除
   POST /api/push/remove { device } */
'use strict';
const { sendJson, readBody, loadDevices, saveDevices } = require('../_fb');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  try {
    const b = await readBody(req);
    const device = String(b.device || '').slice(0, 80);
    if (!device) return sendJson(res, 400, { error: 'device が必要です' });
    const devices = await loadDevices();
    delete devices[device];
    await saveDevices(devices);
    sendJson(res, 200, { ok: true, devices: Object.keys(devices).length });
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
};
