/* 天気のサーバーキャッシュ（#165）
   使い方:
     GET /api/wx … { ok, source:'live'|'cache', fetchedAt,
                     today:{ pop, slots }, tomorrow:{ pop, slots } }（気象庁・兵庫県南部の降水確率）
   - 気象庁の予報 JSON は大きく変わらないので、サーバー側で10分キャッシュして配る
     （端末が何台あっても、気象庁への問い合わせは10分に1回まで）。
   - 材料は api/_wx.js（C2）の jmaForecast / popsForDate をそのまま使う。
   - 取れなければ { ok:false } を返す（古いキャッシュを新しいふりで出さない）。 */
'use strict';
const { sendJson } = require('./_fb');
const D = require('./_digest');
const WX = require('./_wx');

const TTL = 10 * 60 * 1000;
let cache = { at: 0, data: null };

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  try {
    const now = Date.now();
    if (cache.data && now - cache.at < TTL) {
      return sendJson(res, 200, Object.assign({}, cache.data, { source: 'cache' }));
    }
    const fc = await WX.jmaForecast();
    if (!fc) return sendJson(res, 502, { ok: false, error: '気象庁の予報を取得できませんでした' });
    const today = D.ymdJst(now);
    const tomorrow = D.addDaysYmd(today, 1);
    const data = {
      ok: true,
      fetchedAt: new Date(now).toISOString(),
      area: '兵庫県南部',
      today: WX.popsForDate(fc, today),
      tomorrow: WX.popsForDate(fc, tomorrow),
    };
    cache = { at: now, data };
    res.setHeader('Cache-Control', 'private, max-age=300');
    return sendJson(res, 200, Object.assign({}, data, { source: 'live' }));
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
