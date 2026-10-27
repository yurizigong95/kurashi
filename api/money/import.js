/* お金のスナップショットの取り込み口（#31）
   使い方:
     POST /api/money/import  … { balance?, balances?, debits?, transactions?, subs? } を
                               Firestore の「部屋ID__moneysnap_v1」に保存する
     GET  /api/money/import  … 保存済みの最新スナップショットを返す
   マネーフォワード等の外部の取得結果を、アプリの同期データとは別の「受け口」から
   入れるための入口。サーバーが MF に直接ログインすることはしない。
   保存形式は api/_digest.js の残高警告（予備読み）と api/_money.js が読める形。
   お金の情報なので、合言葉（checkAppKey）が設定されているときは GET・POST とも必須。
   版チェック（#81）: POST の body に baseUpdatedAt（読み取ったときの updatedAt）を付けると、
   保存済みの updatedAt と一致するときだけ書き込む。一致しなければ 409 を返し、
   古い版の取り込みで新しいスナップショットを上書きしないようにする。 */
'use strict';
const { sendJson, readBody, checkAppKey, fsGetDoc, MONEYSNAP_DOC } = require('../_fb');
const M = require('../_money');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    if (req.method === 'GET') {
      const snap = await M.loadMoneySnap();
      if (!snap) return sendJson(res, 200, { ok: true, empty: true });
      return sendJson(res, 200, { ok: true, snap });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });
    const body = await readBody(req);
    const snap = M.normalizeSnap(body && typeof body === 'object' ? (body.snap || body) : null);
    if (!snap) return sendJson(res, 400, { error: 'スナップショットの形がちがいます' });
    /* 版チェック（#81）: baseUpdatedAt が付いているときは、現在の版と一致するときだけ書く */
    const baseUpdatedAt = String((body && (body.baseUpdatedAt || (body.snap && body.snap.baseUpdatedAt))) || '');
    if (baseUpdatedAt) {
      const curDoc = await fsGetDoc(MONEYSNAP_DOC);
      const curUpdatedAt = curDoc && curDoc.updatedAt ? String(curDoc.updatedAt) : '';
      if (curUpdatedAt && curUpdatedAt !== baseUpdatedAt) {
        return sendJson(res, 409, { error: 'conflict', updatedAt: curUpdatedAt, note: '新しいスナップショットが既にあります。読み直してから取り込んでください' });
      }
    }
    await M.saveMoneySnap(snap);
    return sendJson(res, 200, {
      ok: true, balance: snap.balance,
      counts: { balances: snap.balances.length, debits: snap.debits.length, transactions: snap.transactions.length, subs: snap.subs.length },
      updatedAt: snap.updatedAt,
    });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
