/* 共有コードで時間割・課題を見る（#49）
   使い方:
     GET /api/share/view?code=<12文字>  … { ok, term, courses:[{ name, slots, room }], tasks:[{ title, subject, due }], generatedAt }
   合言葉（checkAppKey）は確かめない。コードそのものが見るための資格になる（api/share/create.js で作る）。
   コードが無い・期限切れのときは 404 { error:'not found' }（どちらかは区別しない）。
   出すのは今学期の時間割（科目名・曜日限・教室）と、終わっていない課題（締切の近い順に最大20件）だけ。
   お金・成績・出欠などの個人的な記録は出さない。 */
'use strict';
const { sendJson } = require('../_fb');
const D = require('../_digest');
const { loadShares, ALPHABET } = require('./_create');

const MAX_TASKS = 20;
const CODE_RE = new RegExp('^[' + ALPHABET + ']{12}$');

function list(v) { return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []; }

/* 共有してよい範囲だけを組み立てる */
function shareView(data) {
  const core = (data && data.core) || {}, plan = (data && data.plan) || {};
  const meta = (data && data.maps && data.maps.courseMeta) || {};
  const terms = list(core.termsList);
  const term = terms.filter((t) => t.id === core.termId)[0] || terms[0] || null;
  const courses = term ? list(term.courses).map((c) => ({
    name: String(c.name || ''), slots: String(c.slots || ''),
    room: String((meta[c.name] && meta[c.name].room) || c.room || ''),
  })).filter((c) => c.name) : [];
  const tasks = list(plan.tasks).filter((t) => !t.done)
    .sort((a, b) => String(a.due || '9999') < String(b.due || '9999') ? -1 : String(a.due || '9999') > String(b.due || '9999') ? 1 : 0)
    .slice(0, MAX_TASKS)
    .map((t) => ({ title: String(t.title || '課題'), subject: String(t.subject || ''), due: D.isYmd(t.due) ? t.due : '' }));
  return { term: term ? { id: String(term.id || ''), label: String(term.label || '') } : null, courses, tasks };
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  try {
    const q = new URL(req.url || '/', 'http://localhost').searchParams;
    const code = String(q.get('code') || '').trim().toUpperCase();
    if (!CODE_RE.test(code)) return sendJson(res, 404, { error: 'not found' });
    const shares = await loadShares();
    const s = shares[code];
    if (!s || !(Date.parse(s.expiresAt) > Date.now())) return sendJson(res, 404, { error: 'not found' });
    const data = await D.loadData();
    res.setHeader('Cache-Control', 'no-store');
    return sendJson(res, 200, Object.assign({ ok: true }, shareView(data), { generatedAt: new Date().toISOString() }));
  } catch (e) {
    return sendJson(res, 500, { error: 'error' });
  }
}

module.exports = handler;
module.exports.shareView = shareView;
