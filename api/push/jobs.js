/* 通知の送信予定（ジョブ）の置き場所
   POST /api/push/jobs { jobs: [{ id, at, title, body, url }] }  … アプリから予定を預ける
   GET  /api/push/jobs                                       … 預かっている予定の確認
   GAS 版の jobsPut と同じ役割です。実際の送信は /api/push/cron が行います。 */
'use strict';
const { sendJson, readBody, loadJobs, saveJobs } = require('../_fb');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  try {
    if (req.method === 'GET') {
      const jobs = await loadJobs();
      return sendJson(res, 200, { ok: true, jobs: jobs.length });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST/GET only' });
    const b = await readBody(req);
    const incoming = Array.isArray(b.jobs) ? b.jobs : [];
    const clean = incoming.slice(0, 200).map((j) => ({
      id: String(j.id || '').slice(0, 80),
      at: Number(j.at) || 0,
      title: String(j.title || 'くらしの手帳').slice(0, 80),
      body: String(j.body || '').slice(0, 300),
      url: String(j.url || './').slice(0, 200),
      sent: 0,
    })).filter((j) => j.id && j.at);
    await saveJobs(clean);
    sendJson(res, 200, { ok: true, jobs: clean.length });
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
};
