/* 学校に着いた記録（#60）
   使い方:
     POST /api/attend/arrive  … { date:'YYYY-MM-DD', time:'HH:MM', place?:'学校' } を1件追記して { ok } を返す
     GET  /api/attend/arrive  … 新しい順に最大50件（合言葉 x-app-key が必要）
   アプリ（js/links.js の arriveAttend）が、Vercel 版のときだけ出席をつけたついでに送る。
   ここで貯めた記録は /api/plan/learn（#57）が「授業開始の何分前に着いているか」の学習に使う。
   POST には checkAppKey（合言葉）を適用しない（api/hook.js と同じ理由。ショートカット等から
   ヘッダーを付けずに送れるように）。その代わり形を厳しく確かめ、件数上限で古いものから押し出す。
   Firestore の「部屋ID__arrive_v1」に { entries: JSON文字列(配列・古い順), updatedAt } で置く。 */
'use strict';
const { sendJson, readBody, checkAppKey, fsGetDoc, fsSetDoc, ARRIVE_DOC } = require('../_fb');
const { isYmd, minutesOf } = require('../_digest');

const MAX_ENTRIES = 200;
const MAX_LIST = 50;
const MAX_PLACE = 40;

function pad(n) { return String(n).padStart(2, '0'); }
async function loadArrivals() {
  try {
    const doc = await fsGetDoc(ARRIVE_DOC);
    if (!doc || !doc.entries) return [];
    const arr = JSON.parse(doc.entries);
    return Array.isArray(arr) ? arr.filter((x) => x && typeof x === 'object') : [];
  } catch (e) { return []; }
}
/* 1件の形を確かめる。だめなら null */
function normalizeArrival(body) {
  const b = body && typeof body === 'object' ? body : {};
  const date = String(b.date || '');
  const m = minutesOf(b.time);
  if (!isYmd(date) || m === null || m < 0 || m >= 24 * 60) return null;
  return {
    date, time: pad(Math.floor(m / 60)) + ':' + pad(m % 60),
    place: String(b.place == null ? '' : b.place).replace(/[\u0000-\u001f]/g, '').slice(0, MAX_PLACE),
    at: new Date().toISOString(),
  };
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  try {
    if (req.method === 'GET') {
      if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
      const entries = await loadArrivals();
      return sendJson(res, 200, { ok: true, entries: entries.slice(-MAX_LIST).reverse() });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });
    const entry = normalizeArrival(await readBody(req));
    if (!entry) return sendJson(res, 400, { error: 'date（YYYY-MM-DD）と time（HH:MM）が必要です' });
    const entries = await loadArrivals();
    entries.push(entry);
    while (entries.length > MAX_ENTRIES) entries.shift();
    await fsSetDoc(ARRIVE_DOC, { entries: JSON.stringify(entries), updatedAt: new Date().toISOString() });
    return sendJson(res, 200, { ok: true });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.loadArrivals = loadArrivals;
