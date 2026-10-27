/* アプリ全体の横断検索（#87 / #194）
   使い方:
     GET /api/search?q=<言葉> … 同期データの中から、課題・予定・試験・明細・科目を横断して探す
                                { ok, q, hits:{ tasks, events, exams, spends, courses }, total }
   - 探すのはサーバーが読める同期データ（core / plan / money / maps）だけ。
   - 周期の記録（extra の kmItems）は、内容を読めない形で保存されているものなので対象にしない
     （js/m-life.js の設計どおり、検索には出さない）。
   - 大文字小文字・全角半角の違いは吸収しない、単純な部分一致。1区分20件まで。 */
'use strict';
const { sendJson, checkAppKey } = require('./_fb');
const D = require('./_digest');

const MAX_PER = 20;

function list(v) { return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []; }
function has(s, q) { return String(s == null ? '' : s).toLowerCase().indexOf(q) >= 0; }

function searchAll(data, query) {
  const q = String(query || '').trim().toLowerCase();
  const hits = { tasks: [], events: [], exams: [], spends: [], courses: [] };
  if (!q) return hits;
  const plan = (data && data.plan) || {};
  const money = (data && data.money) || {};
  const core = (data && data.core) || {};
  const maps = (data && data.maps) || {};
  for (const t of list(plan.tasks)) {
    if (hits.tasks.length >= MAX_PER) break;
    if (has(t.title, q) || has(t.subject, q)) {
      hits.tasks.push({ id: String(t.id || ''), title: String(t.title || ''), subject: String(t.subject || ''), due: String(t.due || ''), done: t.done ? 1 : 0 });
    }
  }
  for (const e of list(plan.events)) {
    if (hits.events.length >= MAX_PER) break;
    if (has(e.title, q) || has(e.memo, q) || has(e.place, q)) {
      hits.events.push({ id: String(e.id || ''), title: String(e.title || ''), date: String(e.date || ''), time: String(e.time || '') });
    }
  }
  for (const x of list(plan.exams)) {
    if (hits.exams.length >= MAX_PER) break;
    if (has(x.title, q) || has(x.subject, q)) {
      hits.exams.push({ id: String(x.id || ''), title: String(x.title || ''), subject: String(x.subject || ''), date: String(x.date || '') });
    }
  }
  for (const s of list(money.spends)) {
    if (hits.spends.length >= MAX_PER) break;
    if (has(s.title, q) || has(s.cat, q)) {
      hits.spends.push({ id: String(s.id || ''), title: String(s.title || ''), date: String(s.date || ''), amount: Number(s.amount) || 0, io: String(s.io || '') });
    }
  }
  const seen = {};
  const addCourse = (name, room) => {
    const n = String(name || '');
    if (!n || seen[n] || !has(n, q)) return;
    seen[n] = 1;
    if (hits.courses.length < MAX_PER) hits.courses.push({ name: n, room: String(room || '') });
  };
  for (const term of list(core.termsList)) for (const c of list(term.courses)) addCourse(c.name, c.room);
  const meta = maps.courseMeta && typeof maps.courseMeta === 'object' ? maps.courseMeta : {};
  for (const name of Object.keys(meta)) addCourse(name, meta[name] && meta[name].room);
  for (const name of Object.keys(maps.syllabus || {})) addCourse(name, '');
  return hits;
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const q = new URL(req.url || '/', 'http://localhost').searchParams;
    const query = String(q.get('q') || '').slice(0, 100);
    if (!query.trim()) return sendJson(res, 400, { error: 'q が必要です' });
    const data = await D.loadData();
    const hits = searchAll(data, query);
    const total = Object.keys(hits).reduce((a, k) => a + hits[k].length, 0);
    return sendJson(res, 200, { ok: true, q: query, hits, total });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.searchAll = searchAll;
