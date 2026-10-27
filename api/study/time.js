/* 勉強時間の確定記録（#65）
   使い方:
     POST /api/study/time  { date:'YYYY-MM-DD', minutes, subject? } … 1件記録して { ok } を返す
     GET  /api/study/time  … 今週（月〜日・日本時間）と今月の集計を返す
                             { ok, week:{ from, to, total, byDay, bySubject }, month:{ ym, total, bySubject }, recent:[...] }
   端末ごとにバラバラに集計すると数がズレるので、サーバーに置いた記録を「確定値」にする。
   Firestore の「部屋ID__studytime_v1」に { records: JSON文字列(配列・古い順), updatedAt } で置く（最大500件）。 */
'use strict';
const { sendJson, readBody, checkAppKey, fsGetDoc, fsSetDoc, STUDYTIME_DOC } = require('../_fb');
const D = require('../_digest');

const MAX_RECORDS = 500;
const RECENT = 30;

async function loadRecords() {
  try {
    const doc = await fsGetDoc(STUDYTIME_DOC);
    if (!doc || !doc.records) return [];
    const arr = JSON.parse(doc.records);
    return Array.isArray(arr) ? arr.filter((x) => x && typeof x === 'object') : [];
  } catch (e) { return []; }
}
function validYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return false;
  const mo = +m[2], dy = +m[3];
  if (mo < 1 || mo > 12 || dy < 1 || dy > 31) return false;
  return new Date(Date.UTC(+m[1], mo - 1, dy)).getUTCDate() === dy;
}
function normalizeRecord(body) {
  const b = body && typeof body === 'object' ? body : {};
  const date = String(b.date || '');
  const minutes = Math.floor(Number(b.minutes) || 0);
  if (!validYmd(date) || minutes < 1 || minutes > 1440) return null;
  return {
    date, minutes,
    subject: String(b.subject == null ? '' : b.subject).slice(0, 60),
    at: new Date().toISOString(),
  };
}
function summarize(records, from, to) {
  const byDay = {}, bySubject = {};
  let total = 0;
  for (const r of records) {
    if (!D.isYmd(r.date) || r.date < from || r.date > to) continue;
    const m = Number(r.minutes) || 0;
    total += m;
    byDay[r.date] = (byDay[r.date] || 0) + m;
    const s = String(r.subject || '（科目なし）');
    bySubject[s] = (bySubject[s] || 0) + m;
  }
  return { from, to, total, byDay, bySubject };
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    if (req.method === 'GET') {
      const records = await loadRecords();
      const today = D.ymdJst(Date.now());
      const weekFrom = D.addDaysYmd(today, -((D.wdayOf(today) + 6) % 7));
      const weekTo = D.addDaysYmd(weekFrom, 6);
      const ym = today.slice(0, 7);
      const monthFrom = ym + '-01';
      const monthTo = D.addDaysYmd(D.addDaysYmd(monthFrom, 32).slice(0, 7) + '-01', -1);
      const week = summarize(records, weekFrom, weekTo);
      const month = Object.assign({ ym }, summarize(records, monthFrom, monthTo));
      return sendJson(res, 200, { ok: true, week, month, recent: records.slice(-RECENT).reverse() });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });
    const rec = normalizeRecord(await readBody(req));
    if (!rec) return sendJson(res, 400, { error: 'date（YYYY-MM-DD）と minutes（1〜1440）が必要です' });
    const records = await loadRecords();
    records.push(rec);
    while (records.length > MAX_RECORDS) records.shift();
    await fsSetDoc(STUDYTIME_DOC, { records: JSON.stringify(records), updatedAt: new Date().toISOString() });
    return sendJson(res, 200, { ok: true, record: rec });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.normalizeRecord = normalizeRecord;
module.exports.summarize = summarize;
