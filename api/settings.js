/* 端末別の設定（#88）
   使い方:
     GET  /api/settings[?deviceId=<id>] … { ok, rev, common, device, merged }
                                          merged は「共通＋その端末の上書き」を浅く重ねたもの。
     POST /api/settings  { common?, deviceId?, device?, baseRev? }
                                          … 渡した分だけ差し替える。baseRev が今の rev と
                                            ちがえば 409（#81 の版チェック。古い版での上書きを防ぐ）。
   保存先は「部屋ID__settings_v1」の common / devices（どちらも JSON文字列）と rev（整数）。 */
'use strict';
const { sendJson, readBody, checkAppKey, fsGetDoc, fsSetDoc, SETTINGS_DOC } = require('./_fb');

function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
function parseField(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  try { return typeof v === 'string' ? JSON.parse(v) : v; } catch (e) { return fallback; }
}
async function loadSettings() {
  const doc = await fsGetDoc(SETTINGS_DOC);
  if (!doc) return { common: {}, devices: {}, rev: 0 };
  return {
    common: obj(parseField(doc.common, {})),
    devices: obj(parseField(doc.devices, {})),
    rev: Number(doc.rev) || 0,
  };
}
function mergedOf(s, deviceId) {
  const dev = deviceId ? obj(s.devices[deviceId]) : {};
  return Object.assign({}, s.common, dev);
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    if (req.method === 'GET') {
      const q = new URL(req.url || '/', 'http://localhost').searchParams;
      const deviceId = String(q.get('deviceId') || '').slice(0, 80);
      const s = await loadSettings();
      return sendJson(res, 200, {
        ok: true, rev: s.rev, common: s.common,
        device: deviceId ? obj(s.devices[deviceId]) : {},
        merged: mergedOf(s, deviceId),
      });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });
    const body = await readBody(req);
    const cur = await loadSettings();
    /* 版チェック（#81）: baseRev を渡してきたら、今の rev と一致するときだけ書く */
    if (body.baseRev !== undefined && body.baseRev !== null && Number(body.baseRev) !== cur.rev) {
      return sendJson(res, 409, { error: 'conflict', rev: cur.rev, note: 'ほかの端末が先に設定を変えています。GET で読み直してから送ってください' });
    }
    const fields = { rev: cur.rev + 1, updatedAt: new Date().toISOString() };
    if (body.common !== undefined) {
      if (!body.common || typeof body.common !== 'object' || Array.isArray(body.common)) {
        return sendJson(res, 400, { error: 'common はオブジェクトで渡してください' });
      }
      fields.common = JSON.stringify(body.common);
    }
    const deviceId = String(body.deviceId || '').slice(0, 80);
    if (body.device !== undefined) {
      if (!deviceId) return sendJson(res, 400, { error: 'device を渡すときは deviceId が必要です' });
      if (!body.device || typeof body.device !== 'object' || Array.isArray(body.device)) {
        return sendJson(res, 400, { error: 'device はオブジェクトで渡してください' });
      }
      const devices = Object.assign({}, cur.devices);
      devices[deviceId] = body.device;
      fields.devices = JSON.stringify(devices);
    }
    await fsSetDoc(SETTINGS_DOC, fields);
    return sendJson(res, 200, { ok: true, rev: cur.rev + 1 });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.loadSettings = loadSettings;
module.exports.mergedOf = mergedOf;
