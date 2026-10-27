/* 生活パターンのばらつき（#190）— サーバーにある範囲のデータだけから
   使い方:
     GET /api/health/rhythm … { ok, enough, arrivals:{ days, mean, sd, list }, activity:{ days, mean, sd }, note }
   睡眠データはサーバーには無い（Apple Health は見えない）ので、代わりの材料として:
     - 学校に着いた記録（api/attend/arrive.js の ARRIVE_DOC）: 日ごとの最初の到着時刻
     - アプリの動作ログ（LOG_DOC）: 日ごとの最初の記録時刻（活動のはじまりの目安）
   の2つについて、時刻（分）の平均とばらつき（標準偏差）を出す。
   標準偏差が45分を超えたら「ばらつきが大きめ」と flag で知らせる。材料が3日分未満なら enough:false。 */
'use strict';
const { sendJson, checkAppKey, fsGetDoc, LOG_DOC } = require('../_fb');
const D = require('../_digest');
const { loadArrivals } = require('../attend/_arrive');

const LOOKBACK_DAYS = 14;
const SD_FLAG = 45;

function statsOf(dayMinutes) {
  const days = Object.keys(dayMinutes).sort();
  if (!days.length) return { days: 0, mean: null, sd: null, list: [] };
  const vals = days.map((d) => dayMinutes[d]);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length);
  return {
    days: days.length,
    mean: Math.round(mean),
    sd: Math.round(sd * 10) / 10,
    scattered: sd > SD_FLAG,
    list: days.map((d) => ({ date: d, minutes: dayMinutes[d] })),
  };
}
function hhmm(min) {
  if (min === null || min === undefined) return '';
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const today = D.ymdJst(Date.now());
    const from = D.addDaysYmd(today, -(LOOKBACK_DAYS - 1));
    /* 到着記録: 日ごとの最初の到着 */
    const arrByDay = {};
    for (const a of await loadArrivals()) {
      if (!a || !D.isYmd(a.date) || a.date < from || a.date > today) continue;
      const m = D.minutesOf(a.time);
      if (m === null) continue;
      if (arrByDay[a.date] === undefined || m < arrByDay[a.date]) arrByDay[a.date] = m;
    }
    /* 動作ログ: 日ごとの最初の記録（日本時間） */
    const actByDay = {};
    try {
      const doc = await fsGetDoc(LOG_DOC);
      const entries = doc && doc.entries ? JSON.parse(doc.entries) : [];
      for (const e of Array.isArray(entries) ? entries : []) {
        const t = Date.parse(e && e.at);
        if (!isFinite(t)) continue;
        const ymd = D.ymdJst(t);
        if (ymd < from || ymd > today) continue;
        const m = D.minJst(t);
        if (actByDay[ymd] === undefined || m < actByDay[ymd]) actByDay[ymd] = m;
      }
    } catch (e) { /* ログが読めなければ到着だけ */ }
    const arrivals = statsOf(arrByDay);
    const activity = statsOf(actByDay);
    if (arrivals.mean !== null) arrivals.meanHhmm = hhmm(arrivals.mean);
    if (activity.mean !== null) activity.meanHhmm = hhmm(activity.mean);
    const enough = arrivals.days >= 3 || activity.days >= 3;
    return sendJson(res, 200, {
      ok: true, enough, from, to: today, arrivals, activity,
      note: '睡眠データはサーバーに無いため、到着記録とアプリの動作ログから「活動のはじまり」のばらつきだけを見ています。',
    });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.statsOf = statsOf;
