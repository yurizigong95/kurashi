/* メール送信の入口（#163）
   使い方:
     POST /api/mail  { to?, subject, body, kind? } … api/_mail.js の基盤で送る
                       { ok:true, via:'gas' } / { ok:false, via:'outbox', queued:true, reason }
     GET  /api/mail  … 送信箱（送れなかったメール。新しい順・最大50件）
   サーバーから直接メールは送れないので、GAS のメールブリッジ（環境変数 GAS_MAIL_URL /
   GAS_MAIL_SECRET）があるときだけ中継し、無ければ送信箱に貯める。「送った」とは言わない。 */
'use strict';
const { sendJson, readBody, checkAppKey } = require('./_fb');
const { sendMail } = require('./_mail');
const { loadOutbox } = require('./_hub');

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    if (req.method === 'GET') {
      const entries = await loadOutbox();
      return sendJson(res, 200, { ok: true, outbox: entries.slice(-50).reverse() });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });
    const body = await readBody(req);
    const subject = String((body && body.subject) || '');
    const text = String((body && body.body) || '');
    if (!subject && !text) return sendJson(res, 400, { error: 'subject か body が必要です' });
    const r = await sendMail({ to: body.to || '', subject, body: text, kind: body.kind || '' });
    return sendJson(res, 200, Object.assign({ ok: r.ok }, r));
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
