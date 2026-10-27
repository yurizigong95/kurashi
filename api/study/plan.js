/* 試験までの学習計画（#47）
   使い方:
     GET  /api/study/plan  … 同期データの試験一覧（今日以降を日付順に先、そのあと過ぎたもの）
     POST /api/study/plan  … { subject?, date? }（どちらも任意）。指定が無ければ今日以降で一番近い試験。
                            AI（サーバーの GEMINI_API_KEY）が使えれば日ごとの計画を作る { source:'ai', plan:文章 }。
                            使えないときは、残り日数を3期（基礎固め→問題演習→直前確認）に割った骨組みを返す
                            { source:'template', phases, checklist, plan:文章 }。
   試験日が過ぎている・分からないときは、7日間の骨組みにして note で知らせる。
   どちらも合言葉 x-app-key が必要（AI の利用回数を使うため）。 */
'use strict';
const { sendJson, readBody, checkAppKey } = require('../_fb');
const D = require('../_digest');
const AI = require('../_ai');

const DEFAULT_DAYS = 7;

function list(v) { return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []; }
function examsSorted(data, today) {
  const all = list(data && data.plan && data.plan.exams).map((x) => ({
    id: String(x.id || ''), subject: String(x.subject || ''), title: String(x.title || ''),
    date: D.isYmd(x.date) ? x.date : '', time: String(x.time || ''),
  }));
  const up = all.filter((x) => x.date && x.date >= today).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const past = all.filter((x) => !x.date || x.date < today).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return up.concat(past);
}
/* 対象の試験を決める */
function pickExam(data, today, body) {
  const b = body && typeof body === 'object' ? body : {};
  const subject = String(b.subject || '').slice(0, 60);
  const date = D.isYmd(b.date) ? b.date : '';
  const exams = examsSorted(data, today);
  if (subject || date) {
    const hit = exams.filter((x) => (!subject || x.subject === subject) && (!date || x.date === date))
      .filter((x) => !x.date || x.date >= today)[0];
    if (hit) return hit;
    return { id: '', subject, title: '試験', date, time: '' };
  }
  return exams.filter((x) => x.date && x.date >= today)[0] || { id: '', subject: '', title: '試験', date: '', time: '' };
}

/* 骨組み（AI が使えないとき） */
function templatePlan(exam, today, days) {
  const lastN = Math.max(1, Math.round(days * 0.2));
  const rest = Math.max(0, days - lastN);
  const p1 = Math.ceil(rest / 2), p2 = rest - p1;
  const defs = [
    { name: '基礎固め', len: p1, todo: ['教科書・ノートを読み直して、大事な用語と公式をまとめる', 'わからないところに印をつけておく'] },
    { name: '問題演習', len: p2, todo: ['演習問題・過去問を解いて、まちがえた問題に印をつける', '印のついた問題を解き直す'] },
    { name: '直前確認', len: lastN, todo: ['まとめノートと、まちがえた問題だけを見直す', '早めに寝て、持ち物を確認する'] },
  ];
  const phases = [];
  let off = 0;
  defs.forEach((d) => {
    if (d.len <= 0) return;
    phases.push({ name: d.name, from: D.addDaysYmd(today, off), to: D.addDaysYmd(today, off + d.len - 1), days: d.len, todo: d.todo });
    off += d.len;
  });
  const checklist = ['試験の日時・教室', '持ち込みできるもの（電卓・資料など）', '筆記用具・学生証', '範囲の最終確認'];
  const name = [exam.subject, exam.title].filter(Boolean).join(' ') || '試験';
  const text = [name + ' まで ' + days + '日の計画（骨組み）']
    .concat(phases.map((p) => '■ ' + p.name + '（' + D.mdLabel(p.from) + (p.days > 1 ? '〜' + D.mdLabel(p.to) : '') + '・' + p.days + '日）\n' +
      p.todo.map((t) => '・' + t).join('\n')))
    .concat(['■ 前日の確認\n' + checklist.map((c) => '□ ' + c).join('\n')])
    .join('\n\n');
  return { phases, checklist, text };
}

function buildPrompt(exam, today, days) {
  return [
    '大学生の試験勉強の計画を作ってください。',
    '科目：' + (exam.subject || '（未指定）') + (exam.title ? '（' + exam.title + '）' : ''),
    '試験日：' + (exam.date ? D.ymdLabel(exam.date) : '（未定。' + days + '日後と仮定）'),
    '今日：' + D.ymdLabel(today),
    '残り日数：' + days + '日',
    '日ごとの学習計画を、基礎固め→問題演習→直前確認の流れで、1日ごとに見出し（日付）＋やること1〜2行で書いてください。',
    '前置きや締めの挨拶は不要です。やさしい日本語で。',
  ].join('\n');
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const today = D.ymdJst(Date.now());
    const data = await D.loadData();
    if (req.method === 'GET') {
      return sendJson(res, 200, { ok: true, exams: examsSorted(data, today), note: '今日以降の試験を日付順に先に並べています' });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });
    const body = await readBody(req);
    const exam = pickExam(data, today, body);
    let days = exam.date ? D.diffDays(today, exam.date) : null;
    let note = '';
    if (days === null || days <= 0) {
      note = exam.date ? '試験日が今日か過ぎているため、7日間の計画にしました' : '試験日が分からないため、7日間の計画にしました';
      days = DEFAULT_DAYS;
    }
    const examOut = { subject: exam.subject, title: exam.title, date: exam.date, days };
    const r = await AI.generateText(buildPrompt(exam, today, days), { task: 'light' });
    if (r.ok) return sendJson(res, 200, { ok: true, source: 'ai', model: r.model, exam: examOut, plan: r.text, note });
    const t = templatePlan(exam, today, days);
    return sendJson(res, 200, {
      ok: true, source: 'template', reason: r.reason || '', exam: examOut,
      plan: t.text, phases: t.phases, checklist: t.checklist, note,
    });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.templatePlan = templatePlan;
module.exports.pickExam = pickExam;
