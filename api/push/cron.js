/* 送信予定のうち、時刻が来たものを送る（タイマー実行）
   - Vercel Cron から呼ばれます（vercel.json の crons。Hobby プランは1日1回まで）。
   - 5分おきに回したいときは、GAS の tick など外のタイマーから
     Authorization: Bearer <CRON_SECRET> 付きでこの URL を叩いても同じです。
   - 送信には環境変数 FIREBASE_SERVICE_ACCOUNT が必要です。 */
'use strict';
const { sendJson, loadDevices, saveDevices, loadJobs, saveJobs, serviceAccount, fcmSendTo } = require('../_fb');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  const secret = process.env.CRON_SECRET || '';
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== 'Bearer ' + secret) return sendJson(res, 401, { error: 'unauthorized' });
  }
  try {
    if (!serviceAccount()) {
      const jobs = await loadJobs();
      const devices = await loadDevices();
      return sendJson(res, 501, {
        error: '送信の鍵（FIREBASE_SERVICE_ACCOUNT）が未設定です', code: 'NO_SA',
        pendingJobs: jobs.filter((j) => !j.sent).length, devices: Object.keys(devices).length,
      });
    }
    const now = Date.now();
    const jobs = await loadJobs();
    const devices = await loadDevices();
    const due = jobs.filter((j) => !j.sent && j.at <= now);
    let sentCount = 0;
    const dead = [];
    for (const job of due) {
      for (const id of Object.keys(devices)) {
        const d = devices[id];
        if (!d || !d.token) continue;
        const r = await fcmSendTo(d.token, job.title, job.body, job.url);
        if (r.ok) sentCount++;
        else if (r.code === 404 || /UNREGISTERED/.test(r.body || '')) dead.push(id);
      }
      job.sent = 1;
    }
    let changed = false;
    for (const id of dead) { if (devices[id]) { delete devices[id]; changed = true; } }
    if (changed) await saveDevices(devices);
    /* 送ったものと、1日以上過ぎたものは掃除する */
    const keep = jobs.filter((j) => !j.sent || j.at > now - 24 * 60 * 60 * 1000);
    if (due.length || keep.length !== jobs.length) await saveJobs(keep);
    sendJson(res, 200, { ok: true, due: due.length, sent: sentCount });
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
};
