/* 空き時間と、そこへ入れる課題の候補（#76）
   使い方:
     GET /api/plan/gaps[?date=YYYY-MM-DD]  … 既定は今日（JST）
   8:00〜22:00 のうち、予定と授業で埋まっていない時間を返し、未完了の課題を
   締切の近い順に割り当てた候補も返す。通知はせず、候補を返すだけ（ルールベース）。 */
'use strict';
const { sendJson, checkAppKey } = require('../_fb');
const D = require('../_digest');
const P = require('../_plan');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const q = new URL(req.url || '/', 'http://localhost').searchParams;
    const date = D.isYmd(q.get('date')) ? q.get('date') : D.ymdJst(Date.now());
    const data = await D.loadData();
    const extra = await D.loadPart('extra').catch(() => null);
    const gcal = await P.loadGcalItems();
    const out = P.gapsForDate(data, extra, date, gcal);
    if (!out) return sendJson(res, 400, { error: '日付の形がちがいます' });
    return sendJson(res, 200, Object.assign({ ok: true }, out));
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
