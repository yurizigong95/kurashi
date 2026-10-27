/* 周期の予測（#182）— サーバーから見える範囲の正直な実装
   使い方:
     GET /api/health/cycle … { ok, enough:false, syncedPeriodItems:<件数>, note }
   なぜ予測まで行かないか:
     - アプリの周期の記録は「この端末だけ」が基本で、同期するときも中身をそのまま読めない形
       （js/m-life.js の lfEnc。手帳全体を読む道具や検索に内容を出さないための設計）で
       extra の kmItems（mod:'life', type:'period'）に入る。サーバーで無理に解読はしない。
     - Apple Health の周期はサーバーからは見えない。
   なので、ここでは「同期されている周期アイテムの件数」だけを数えて返し、予測は端末側
   （アプリの生活タブ）の役割として note で明示する。 */
'use strict';
const { sendJson, checkAppKey } = require('../_fb');
const D = require('../_digest');

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const extra = await D.loadPart('extra');
    const items = extra && Array.isArray(extra.kmItems) ? extra.kmItems : [];
    const periodItems = items.filter((x) => x && x.mod === 'life' && x.type === 'period').length;
    return sendJson(res, 200, {
      ok: true,
      enough: false,
      syncedPeriodItems: periodItems,
      note: '周期の記録は端末内だけにあり、同期分も内容を読めない形で保存されているため、サーバーでは予測できません。予測はアプリの生活タブ（端末側）で行われます。Apple Health の周期もサーバーからは見えません。',
    });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
