/* 到着時刻の学習（#57）
   使い方:
     GET /api/plan/learn  … 学校に着いた記録（/api/attend/arrive）と同期データの時間割から、
                            曜日ごとに「最初の授業の開始 − 到着時刻」（＝余裕の分数）の平均を出す
   - 数えるのは、授業開始より前に着いていて、余裕が0〜120分に収まる日だけ（同じ日に何件あれば最初の1件）。
   - 最初の授業は、学校に行く授業（休講・家で受講を除く）のうち一番早いもの。
   - correctionMin … 余裕の平均が10分未満なら、10分に届くまでの分（切り上げ）。それ以外は 0。
   - 使える記録が3件未満なら { ok, enough:false, reason:'学習データ不足', count }。 */
'use strict';
const { sendJson, checkAppKey } = require('../_fb');
const D = require('../_digest');
const { loadArrivals } = require('../attend/_arrive');

const MIN_SAMPLES = 3;
const MAX_MARGIN = 120;
const TARGET_MARGIN = 10;

function round1(n) { return Math.round(n * 10) / 10; }
/* 記録と同期データから、余裕の分数を日ごとに出す（テストからも使う） */
function marginsOf(data, entries) {
  const byDate = {};
  (Array.isArray(entries) ? entries : []).forEach((e) => {
    if (!e || !D.isYmd(e.date)) return;
    const m = D.minutesOf(e.time);
    if (m === null) return;
    if (!(e.date in byDate) || m < byDate[e.date]) byDate[e.date] = m;
  });
  const out = [];
  Object.keys(byDate).sort().forEach((date) => {
    const cls = D.classesForDate(data, date).filter((c) => !c.off && !c.web);
    const starts = cls.map((c) => D.minutesOf(c.start)).filter((m) => m !== null);
    if (!starts.length) return;
    const margin = Math.min.apply(null, starts) - byDate[date];
    if (margin < 0 || margin > MAX_MARGIN) return;
    out.push({ date, wday: D.wdayOf(date), margin });
  });
  return out;
}
function learnSummary(samples) {
  const count = samples.length;
  if (count < MIN_SAMPLES) return { enough: false, reason: '学習データ不足', count };
  const byWeekday = {};
  samples.forEach((s) => {
    const k = String(s.wday);
    const b = byWeekday[k] || (byWeekday[k] = { n: 0, sum: 0 });
    b.n++; b.sum += s.margin;
  });
  Object.keys(byWeekday).forEach((k) => {
    const b = byWeekday[k];
    byWeekday[k] = { n: b.n, avgMarginMin: round1(b.sum / b.n) };
  });
  const avg = samples.reduce((a, s) => a + s.margin, 0) / count;
  return {
    enough: true, byWeekday, avgMarginMin: round1(avg),
    correctionMin: avg < TARGET_MARGIN ? Math.ceil(TARGET_MARGIN - avg) : 0, count,
  };
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const [data, entries] = await Promise.all([D.loadData(), loadArrivals()]);
    return sendJson(res, 200, Object.assign({ ok: true }, learnSummary(marginsOf(data, entries))));
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.marginsOf = marginsOf;
module.exports.learnSummary = learnSummary;
