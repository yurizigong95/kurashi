/* データのエクスポート（#86）
   使い方:
     GET /api/export?kind=money|plan|all&format=json|csv
   - money: 明細（日付・入出金・金額・店名など・分類）を返す。
   - plan: 予定・課題・試験を返す。
   - all: 両方を1つの JSON で返す（format=csv のときは kind ごとに区切った CSV）。
   - お金と予定の個人データなので、合言葉 x-app-key が必要。
   - メールで送りたいときは /api/mail（#163）の基盤と組み合わせる想定（ここはダウンロード用）。 */
'use strict';
const { sendJson, checkAppKey } = require('./_fb');
const D = require('./_digest');
const M = require('./_money');

function list(v) { return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []; }
function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function csvOf(rows) { return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'; }

function moneyRows(data) {
  const txs = M.transactionsOf(data, null);
  return txs.list.map((tx) => ({ date: tx.date || '', io: tx.io || '', amount: tx.amount || 0, title: tx.title || '', cat: tx.cat || '' }));
}
function planRows(data) {
  const plan = (data && data.plan) || {};
  return {
    events: list(plan.events).map((e) => ({ id: String(e.id || ''), date: e.date || '', time: e.time || '', title: e.title || '', kind: e.kind || '' })),
    tasks: list(plan.tasks).map((t) => ({ id: String(t.id || ''), title: t.title || '', subject: t.subject || '', due: t.due || '', done: t.done ? 1 : 0 })),
    exams: list(plan.exams).map((x) => ({ id: String(x.id || ''), subject: x.subject || '', title: x.title || '', date: x.date || '', time: x.time || '' })),
  };
}
function sendCsv(res, kind, data) {
  let text = '';
  if (kind === 'money' || kind === 'all') {
    text += csvOf([['date', 'io', 'amount', 'title', 'cat']]
      .concat(moneyRows(data).map((r) => [r.date, r.io, r.amount, r.title, r.cat])));
  }
  if (kind === 'plan' || kind === 'all') {
    const p = planRows(data);
    const rows = [['type', 'date', 'time', 'title', 'subject', 'done']];
    p.events.forEach((e) => rows.push(['event', e.date, e.time, e.title, '', '']));
    p.tasks.forEach((t) => rows.push(['task', t.due, '', t.title, t.subject, t.done]));
    p.exams.forEach((x) => rows.push(['exam', x.date, x.time, x.title, x.subject, '']));
    text += csvOf(rows);
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Disposition', 'attachment; filename="kurashi-export-' + kind + '.csv"');
  res.end(text);
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const q = new URL(req.url || '/', 'http://localhost').searchParams;
    const kind = ['money', 'plan', 'all'].indexOf(q.get('kind') || '') >= 0 ? q.get('kind') : 'all';
    const format = q.get('format') === 'csv' ? 'csv' : 'json';
    const data = await D.loadData();
    if (format === 'csv') return sendCsv(res, kind, data);
    const out = { ok: true, kind, exportedAt: new Date().toISOString() };
    if (kind === 'money' || kind === 'all') out.money = { transactions: moneyRows(data) };
    if (kind === 'plan' || kind === 'all') out.plan = planRows(data);
    res.setHeader('Content-Disposition', 'attachment; filename="kurashi-export-' + kind + '.json"');
    return sendJson(res, 200, out);
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.csvOf = csvOf;
module.exports.moneyRows = moneyRows;
module.exports.planRows = planRows;
