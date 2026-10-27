/* 予定の .ics 配布（#74）
   使い方:
     GET /api/plan/ics?k=<合言葉>[&from=YYYY-MM-DD&to=YYYY-MM-DD]
   同期データの予定から iCalendar を作って返す（他のカレンダーアプリから購読できる）。
   予定は個人情報なので、合言葉が未設定のときは配らない（fail-closed）:
     合言葉 = 環境変数 PLAN_ICS_KEY、無ければ APP_API_SECRET。
     渡し方は ?k= / ?key= クエリ、または x-app-key ヘッダー。
   なお GAS 側にも同じ役割の配布（Code.gs の icsGet_、Drive の kurashi.ics を
   iPhone が照会する方式）が既にある。こちらは Vercel 単体で完結する版。 */
'use strict';
const { sendJson } = require('../_fb');
const D = require('../_digest');
const P = require('../_plan');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  const q = new URL(req.url || '/', 'http://localhost').searchParams;
  const secret = process.env.PLAN_ICS_KEY || process.env.APP_API_SECRET || '';
  if (!secret) {
    return sendJson(res, 403, {
      error: '合言葉（PLAN_ICS_KEY または APP_API_SECRET）が未設定のため、予定表は配りません',
      code: 'NO_KEY',
    });
  }
  const given = req.headers['x-app-key'] || q.get('k') || q.get('key') || '';
  if (given !== secret) return sendJson(res, 403, { error: '合言葉がちがいます' });
  try {
    const today = D.ymdJst(Date.now());
    const from = D.isYmd(q.get('from')) ? q.get('from') : D.addDaysYmd(today, -7);
    let to = D.isYmd(q.get('to')) ? q.get('to') : D.addDaysYmd(today, 92);
    if (to < from) to = from;
    if (D.diffDays(from, to) > 120) to = D.addDaysYmd(from, 120);
    const data = await D.loadData();
    const extra = await D.loadPart('extra').catch(() => null);
    const gcal = await P.loadGcalItems();
    const occs = P.occurrencesInRange(data, extra, from, to, gcal)
      .filter((o) => o.kind !== 'task');
    const ics = P.buildIcs(occs, Date.now());
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.end(ics);
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
