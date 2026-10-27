/* 通知を受け取る端末の登録（Vercel版）
   POST /api/push/register { device, token, name, prefs? }
   アプリの通知ONのとき、GAS 側に加えてここへも登録されます（js/notify.js）。
   prefs … この端末だけの設定 { silent, badge, icon, mutedCats:[種類…] }。
   送られてこなければ、前に登録した prefs をそのまま残します。 */
'use strict';
const { sendJson, readBody, loadDevices, saveDevices } = require('../_fb');

/* 決まった形のものだけ通す */
function cleanPrefs(p) {
  const out = {};
  if (typeof p.silent === 'boolean') out.silent = p.silent;
  if (typeof p.badge === 'boolean') out.badge = p.badge;
  if (typeof p.icon === 'boolean') out.icon = p.icon;
  if (Array.isArray(p.mutedCats)) {
    out.mutedCats = p.mutedCats.filter((c) => typeof c === 'string' && c).map((c) => c.slice(0, 20)).slice(0, 20);
  }
  return out;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  try {
    const b = await readBody(req);
    const device = String(b.device || '').slice(0, 80);
    const token = String(b.token || b.pushToken || '');
    if (!device || !token) return sendJson(res, 400, { error: 'device と token が必要です' });
    const devices = await loadDevices();
    const prev = devices[device] || {};
    const rec = { token, name: String(b.name || '').slice(0, 60), at: new Date().toISOString() };
    if (b.prefs && typeof b.prefs === 'object' && !Array.isArray(b.prefs)) rec.prefs = cleanPrefs(b.prefs);
    else if (prev.prefs) rec.prefs = prev.prefs;
    devices[device] = rec;
    await saveDevices(devices);
    sendJson(res, 200, { ok: true, devices: Object.keys(devices).length });
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
};
