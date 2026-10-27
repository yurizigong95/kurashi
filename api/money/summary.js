/* お金のまとめ（#35 扶養の壁ウォッチ＋今月の支出）
   使い方:
     GET /api/money/summary[?year=2026]  … 年収累計（月別・上限までの残り）と、
                                            今月の支出合計・カテゴリ別・前月比を返す
   数字は同期データとスナップショットにあるものだけ。給与の記録も明細も無い年は
   enough:false で「判定できない」を返す（推測で金額を作らない）。
   上限の出どころ（limitSource）も必ず返す：環境変数 FUYOU_LIMIT → アプリの設定
   settings.fuyouLimit → 仮の既定値 1,030,000（アプリ未設定のときだけ）。 */
'use strict';
const { sendJson, checkAppKey } = require('../_fb');
const D = require('../_digest');
const M = require('../_money');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const q = new URL(req.url || '/', 'http://localhost').searchParams;
    const nowYmd = D.ymdJst(Date.now());
    const year = q.get('year') || nowYmd.slice(0, 4);
    const data = await D.loadData();
    const snap = await M.loadMoneySnap();
    const income = M.incomeSummary(data, snap, year);
    const txs = M.transactionsOf(data, snap);
    const ym = nowYmd.slice(0, 7);
    const prevYm = D.addDaysYmd(ym + '-01', -1).slice(0, 7);
    const month = M.monthSummary(txs.list, ym);
    const prev = M.monthSummary(txs.list, prevYm);
    return sendJson(res, 200, {
      ok: true,
      income,
      month: Object.assign({}, month, { prevYm, prevOut: prev.out, outDiff: month.out - prev.out, source: txs.source }),
    });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
