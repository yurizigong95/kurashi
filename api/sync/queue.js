/* オフライン時の変更キュー（#89）
   使い方:
     POST /api/sync/queue  { ops:[{ op, part?, payload?, at? }, ...] }
                            … 受け取った順に連番（seq）を付けて「保留キュー」に保存する
     GET  /api/sync/queue  … 保留中のキュー（新しい順・最大50件）と件数を返す
   大事な約束: ここに貯めた変更は、サーバーでは自動で適用しない。
     理由: アプリの同期（js/sync.js）は版（指紋）で競合を調停していて、サーバーが勝手に
     書き込むと、その調停を壊してしまうため。適用は、アプリがオンラインに戻ったときに
     自分の変更として送り直すのが安全で、このキューは「送れなかった変更の控え」として残す。
   保存先は「部屋ID__queue_v1」の entries（JSON文字列の配列・古い順、最大200件）。 */
'use strict';
const { sendJson, readBody, checkAppKey, fsGetDoc, fsSetDoc, QUEUE_DOC } = require('../_fb');

const MAX_ENTRIES = 200;
const MAX_LIST = 50;
const MAX_OPS = 50;

async function loadEntries() {
  try {
    const doc = await fsGetDoc(QUEUE_DOC);
    if (!doc || !doc.entries) return [];
    const arr = JSON.parse(doc.entries);
    return Array.isArray(arr) ? arr.filter((x) => x && typeof x === 'object') : [];
  } catch (e) { return []; }
}
function normalizeOp(raw, seq) {
  const o = raw && typeof raw === 'object' ? raw : {};
  let payload = '';
  try { payload = JSON.stringify(o.payload === undefined ? null : o.payload).slice(0, 4000); } catch (e) { payload = ''; }
  return {
    seq,
    at: new Date().toISOString(),
    clientAt: String(o.at || '').slice(0, 40),
    op: String(o.op || 'note').slice(0, 40),
    part: String(o.part || '').slice(0, 40),
    payload,
    status: 'pending',
  };
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    if (req.method === 'GET') {
      const entries = await loadEntries();
      return sendJson(res, 200, {
        ok: true, pending: entries.length, entries: entries.slice(-MAX_LIST).reverse(),
        note: '保留キューです。サーバーでは自動適用しません（アプリの同期の競合調停を壊さないため）。',
      });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });
    const body = await readBody(req);
    const ops = Array.isArray(body.ops) ? body.ops.slice(0, MAX_OPS) : [];
    if (!ops.length) return sendJson(res, 400, { error: 'ops（配列）が必要です' });
    const entries = await loadEntries();
    let seq = entries.reduce((m, e) => Math.max(m, Number(e.seq) || 0), 0);
    const added = ops.map((o) => normalizeOp(o, ++seq));
    const all = entries.concat(added).slice(-MAX_ENTRIES);
    await fsSetDoc(QUEUE_DOC, { entries: JSON.stringify(all), updatedAt: new Date().toISOString() });
    return sendJson(res, 200, { ok: true, accepted: added.length, pending: all.length, firstSeq: added[0].seq, lastSeq: added[added.length - 1].seq });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.loadEntries = loadEntries;
module.exports.normalizeOp = normalizeOp;
