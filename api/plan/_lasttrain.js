/* 今日の終電（#56）
   使い方:
     GET /api/plan/lasttrain  … サーバーに登録した時刻表（/api/transit）の trainBack から、
                                今日（日本時間）の最後の便と、いまから何分あるかを返す
   土日・祝日は holiday 側の trainBack があればそれを、無ければ平日の表を使う。
   時刻表が未登録のときは { ok, enough:false }。 */
'use strict';
const { sendJson, checkAppKey } = require('../_fb');
const D = require('../_digest');
const { loadTransit } = require('../transit');

function lastOf(rows) {
  let last = null;
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    if (!Array.isArray(r)) return;
    const m = D.minutesOf(r[0]);
    if (m === null) return;
    if (!last || m > last.m) last = { m, dep: String(r[0]), arr: String(r[1] || '') };
  });
  return last;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const now = Date.now();
    const date = D.ymdJst(now), nowMin = D.minJst(now);
    const w = D.wdayOf(date);
    const dayType = (w === 0 || w === 6 || !!D.holidayName(date)) ? 'holiday' : 'weekday';
    const t = await loadTransit();
    const hol = t && t.holiday && Array.isArray(t.holiday.trainBack) && t.holiday.trainBack.length ? t.holiday.trainBack : null;
    const rows = (dayType === 'holiday' && hol) ? hol : (t && t.tables && t.tables.trainBack);
    const last = lastOf(rows);
    if (!last) return sendJson(res, 200, { ok: true, enough: false, reason: '時刻表データがサーバーに未登録です' });
    return sendJson(res, 200, {
      ok: true, enough: true, date, dayType,
      last: { dep: last.dep, arr: last.arr }, minutesLeft: last.m - nowMin,
      table: (dayType === 'holiday' && hol) ? 'holiday' : 'tables',
    });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
