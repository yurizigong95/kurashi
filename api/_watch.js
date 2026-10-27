/* くらしの手帳 Vercel API：同期データの「前回との差分」を見つけて通知にする部品（バッチC2）
   - 出欠（#41）・シラバス（#42）・出欠の危険科目（#43）・新しい課題（#44）・時間割の変更（#45）・
     成績（#50）・週次のふりかえり（#126）・サブスクの監査（#127）。
   - 前回の状態は「部屋ID__watch_v1」に { state: JSON文字列, updatedAt } として置く。
     サブスク監査の指紋は同じ文書の別フィールド subsFinger に書く（状態の保存とぶつからないように）。
   - 初回（前回の状態が無い）はベースラインを保存するだけで、通知は作らない。
   - 同期データのかたまりが読めなかったときは、そのかたまりの区分は前回の状態を引き継ぐ
     （空とみなして保存すると、次の回に全部が「新しい」と判定されてしまうため）。
   - 例外で落とさず、データが無いときは空・enough:false を返す。 */
'use strict';
const { WATCH_DOC, fsGetDoc, fsSetDoc } = require('./_fb');
const D = require('./_digest');
const M = require('./_money');
const AI = require('./_ai');
const { PROMPTS } = require('./_prompts');

const TASKS_KEEP = 200;     // 課題の指紋は直近200件まで
const TASK_NEW_MAX = 10;    // 新しい課題の通知は10件まで（多いときは件数にまとめる）
const ABS_DATES_SHOW = 3;   // 文面に入れる欠席日は科目ごとに直近3日まで

function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
function list(v) { return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []; }
function num(v) {
  const n = parseInt(String(v == null ? '' : v).replace(/[^0-9-]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}
function str(v) { return v == null ? '' : String(v); }

/* ===== 出欠の集計（js/core.js の attendOf と同じ数え方。遅刻3回で欠席1回） ===== */
function attendCount(log) {
  let abRaw = 0, late = 0, pres = 0;
  const absDates = [];
  list(log).forEach((x) => {
    if (x.st === '欠') { abRaw++; if (D.isYmd(x.date)) absDates.push(x.date); }
    else if (x.st === '遅') late++;
    else if (x.st === '出') pres++;
  });
  absDates.sort();
  return { ab: abRaw + Math.floor(late / 3), abRaw, late, pres, absDates };
}

/* ===== 状態の抽出 ===== */
function currentTerm(core) {
  const terms = list(core && core.termsList);
  if (!terms.length) return null;
  return terms.filter((t) => t.id === core.termId)[0] || terms[0];
}
function stateOf(data) {
  const st = {
    v: 1, attend: {}, grades: {}, tasks: {}, tasksInfo: {},
    holidays: [], holidaysFinger: '', coursesFinger: '', syllabus: {},
  };
  try {
    const maps = obj(data && data.maps), plan = obj(data && data.plan), core = obj(data && data.core);
    const log = obj(maps.attendLog);
    Object.keys(log).forEach((name) => { st.attend[name] = attendCount(log[name]); });
    const grades = obj(maps.grades);
    Object.keys(grades).forEach((name) => {
      const g = obj(grades[name]);
      st.grades[name] = { grade: str(g.grade), score: str(g.score) };
    });
    list(plan.tasks).filter((t) => t.id != null && t.id !== '').slice(-TASKS_KEEP).forEach((t) => {
      const id = String(t.id);
      st.tasks[id] = D.hash53([str(t.title), str(t.due), t.done ? '1' : '0', str(t.subject)].join('|'));
      st.tasksInfo[id] = { title: str(t.title), due: str(t.due), subject: str(t.subject), done: t.done ? 1 : 0 };
    });
    st.holidays = list(plan.holidays).map((h) => ({
      date: str(h.date), course: str(h.course), type: str(h.type || 'cancel'), room: str(h.room), period: str(h.period),
    })).sort((a, b) => {
      const ka = JSON.stringify(a), kb = JSON.stringify(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    st.holidaysFinger = st.holidays.length ? D.hash53(JSON.stringify(st.holidays)) : '';
    const term = currentTerm(core);
    if (term) {
      const courses = list(term.courses).map((c) => [str(c.name), str(c.slots), str(c.room), c.bi ? 1 : 0, c.web ? 1 : 0].join('|'));
      st.coursesFinger = courses.length ? D.hash53(courses.join('\n')) : '';
    }
    const syl = obj(maps.syllabus);
    Object.keys(syl).forEach((name) => {
      const s = obj(syl[name]);
      st.syllabus[name] = D.hash53(JSON.stringify({ items: s.items || [], memo: s.memo || '', text: s.text || '', teacher: s.teacher || '' }));
    });
  } catch (e) { /* 途中で形がちがっても、そこまでの状態を返す */ }
  return st;
}

/* ===== 差分 ===== */
function diffWatch(prev, cur) {
  const events = [];
  if (!prev || typeof prev !== 'object' || !cur) return events;
  try {
    /* 出欠（#41）。前回に無い科目（新しく増えた科目）は、その科目の分のベースラインとして扱い、
       過去ぶんの欠席を「新しく記録された」とは言わない（MUSES の取り込み直後の誤通知を防ぐ） */
    const pa = obj(prev.attend);
    Object.keys(obj(cur.attend)).forEach((name) => {
      if (!(name in pa)) return;
      const c = cur.attend[name], p = obj(pa[name]);
      const before = Array.isArray(p.absDates) ? p.absDates : [];
      const added = (c.absDates || []).filter((d) => before.indexOf(d) < 0);
      if (added.length) {
        events.push({ type: 'attend-absence', name, dates: added.slice(-ABS_DATES_SHOW), count: added.length });
      } else if (pa[name] && ((p.pres || 0) !== (c.pres || 0) || (p.late || 0) !== (c.late || 0))) {
        events.push({ type: 'attend-change', name });
      }
    });
    /* 成績（#50） */
    const pg = obj(prev.grades);
    Object.keys(obj(cur.grades)).forEach((name) => {
      const c = cur.grades[name];
      if (!c.grade && !c.score) return;
      const p = pg[name];
      if (!p || (!p.grade && !p.score)) {
        events.push({ type: 'grade-new', name, grade: c.grade, score: c.score });
      } else if (p.grade !== c.grade || p.score !== c.score) {
        events.push({ type: 'grade-change', name, grade: c.grade, score: c.score, prevGrade: p.grade, prevScore: p.score });
      }
    });
    /* 新しい課題（#44。終わっている課題は知らせない） */
    const pt = obj(prev.tasks);
    const info = obj(cur.tasksInfo);
    const fresh = Object.keys(obj(cur.tasks)).filter((id) => !(id in pt) && info[id] && !info[id].done);
    if (fresh.length > TASK_NEW_MAX) {
      const first = info[fresh[0]];
      events.push({ type: 'task-new', id: '', count: fresh.length, title: first.title, due: first.due, subject: first.subject });
    } else {
      fresh.forEach((id) => {
        const t = info[id];
        events.push({ type: 'task-new', id, title: t.title, due: t.due, subject: t.subject });
      });
    }
    /* シラバス（#42）。前回にシラバスの記録が1件も無いときはベースラインがずれているので出さない */
    const ps = obj(prev.syllabus);
    if (Object.keys(ps).length) {
      Object.keys(obj(cur.syllabus)).forEach((name) => {
        if (name in ps && ps[name] !== cur.syllabus[name]) events.push({ type: 'syllabus-change', name });
      });
    }
    /* 時間割（#45）：休講・補講などの追加/削除と、今学期の科目の変更 */
    const keyOf = (h) => JSON.stringify(h);
    const ph = Array.isArray(prev.holidays) ? prev.holidays : [];
    const ch = Array.isArray(cur.holidays) ? cur.holidays : [];
    const phk = ph.map(keyOf), chk = ch.map(keyOf);
    /* 過去日の追加・削除は知らせない（後から整理された記録や、学期の切り替えで消える分の誤通知を防ぐ） */
    const todayJst = D.ymdJst();
    const added = ch.filter((h, i) => phk.indexOf(chk[i]) < 0 && h.date >= todayJst);
    const removed = ph.filter((h, i) => chk.indexOf(phk[i]) < 0 && h.date >= todayJst);
    const coursesChanged = !!prev.coursesFinger && !!cur.coursesFinger && prev.coursesFinger !== cur.coursesFinger;
    if (added.length || removed.length || coursesChanged) {
      events.push({ type: 'timetable-change', added, removed, coursesChanged });
    }
  } catch (e) { /* 差分が取れなかった区分は通知しない */ }
  return events;
}

/* ===== 通知の文面 ===== */
const HOL_LABEL = { cancel: '休講', makeup: '補講', online: 'オンライン', holclass: '授業あり' };
function gradeText(grade, score) {
  const s = str(score);
  return (grade || '—') + (s !== '' ? '（' + s + '点）' : '');
}
function eventJob(event, data) {
  const e = event || {};
  const h = D.hash53(JSON.stringify(e)).slice(0, 10);
  const name = e.name ? D.shortName(data || {}, e.name) : '';
  let title = '🔔 お知らせ', body = '';
  switch (e.type) {
    case 'attend-absence':
      title = '📝 出欠の記録が増えました';
      body = name + ' に ' + (e.dates || []).map(D.mdLabel).join('・') + ' の欠席が記録されました' +
        (e.count > (e.dates || []).length ? '（ほか' + (e.count - e.dates.length) + '件）' : '');
      break;
    case 'attend-change':
      title = '📝 出欠の記録が変わりました';
      body = name + ' の出席・遅刻の記録が更新されました。アプリで確認してね';
      break;
    case 'grade-new':
      title = '🎓 成績が出ました';
      body = name + '：' + gradeText(e.grade, e.score);
      break;
    case 'grade-change':
      title = '🎓 成績が変わりました';
      body = name + '：' + gradeText(e.prevGrade, e.prevScore) + ' → ' + gradeText(e.grade, e.score);
      break;
    case 'task-new': {
      title = '📚 新しい課題';
      const sub = e.subject ? '（' + D.shortName(data || {}, e.subject) + '）' : '';
      const due = D.isYmd(e.due) ? ' 締切：' + D.mdLabel(e.due) : '';
      body = e.count ? '新しい課題が' + e.count + '件あります（' + (e.title || '課題') + sub + ' ほか）'
        : (e.title || '課題') + sub + due;
      break;
    }
    case 'syllabus-change':
      title = '📖 シラバスが変わりました';
      body = name + ' の評価方法などが更新されたかもしれません。アプリで確認してね';
      break;
    case 'timetable-change': {
      title = '🗓 時間割の変更';
      const added = e.added || [], removed = e.removed || [];
      const courseText = (c) => (c === '*' ? '全部の授業' : D.shortName(data || {}, c) || '授業');
      if (added.length) {
        const a = added[0];
        body = D.mdLabel(a.date) + ' ' + courseText(a.course) + ' は' + (HOL_LABEL[a.type] || '変更') +
          (added.length > 1 ? ' ほか' + (added.length - 1) + '件' : '');
      } else if (removed.length) {
        const r = removed[0];
        body = D.mdLabel(r.date) + ' ' + courseText(r.course) + ' の' + (HOL_LABEL[r.type] || '変更') + 'が取り消されました' +
          (removed.length > 1 ? ' ほか' + (removed.length - 1) + '件' : '');
      }
      if (e.coursesChanged) body = (body ? body + '\n' : '') + '今学期の科目・教室が変わりました。アプリで確認してね';
      break;
    }
    default:
      body = '同期データに変化がありました';
  }
  return { key: 'srv-watch-' + e.type + '-' + h, id: 'watch-' + e.type + '-' + h, title, body: body.slice(0, 500), cat: 'today' };
}

/* ===== 永続化 ===== */
async function loadWatchDoc() {
  try {
    const doc = await fsGetDoc(WATCH_DOC);
    if (!doc) return { state: null, subsFinger: null };
    let state = null, subsFinger = null;
    try { state = doc.state ? JSON.parse(doc.state) : null; } catch (e) { state = null; }
    try { subsFinger = doc.subsFinger ? JSON.parse(doc.subsFinger) : null; } catch (e) { subsFinger = null; }
    return { state: state && typeof state === 'object' ? state : null, subsFinger: obj(subsFinger) === subsFinger ? subsFinger : null };
  } catch (e) { return { state: null, subsFinger: null, error: true }; }
}
async function loadWatchState() { return (await loadWatchDoc()).state; }
async function saveWatchState(state) {
  await fsSetDoc(WATCH_DOC, { state: JSON.stringify(state), updatedAt: new Date().toISOString() });
  return true;
}
async function saveSubsFinger(finger) {
  await fsSetDoc(WATCH_DOC, { subsFinger: JSON.stringify(obj(finger)), subsAt: new Date().toISOString() });
  return true;
}

/* 読めなかったかたまりの区分は、前回の状態を引き継ぐ。
   かたまりが届いていても、その中の肝心の項目（attendLog など）が入っていないときも同じに扱う */
function carryOver(cur, prev, data) {
  if (!prev) return cur;
  const d = data || {};
  if (!d.maps) { cur.attend = obj(prev.attend); cur.grades = obj(prev.grades); cur.syllabus = obj(prev.syllabus); }
  else {
    if (!('attendLog' in d.maps)) cur.attend = obj(prev.attend);
    if (!('grades' in d.maps)) cur.grades = obj(prev.grades);
    if (!('syllabus' in d.maps)) cur.syllabus = obj(prev.syllabus);
  }
  if (!d.plan) {
    cur.tasks = obj(prev.tasks); cur.tasksInfo = obj(prev.tasksInfo);
    cur.holidays = Array.isArray(prev.holidays) ? prev.holidays : []; cur.holidaysFinger = str(prev.holidaysFinger);
  } else {
    if (!('tasks' in d.plan)) { cur.tasks = obj(prev.tasks); cur.tasksInfo = obj(prev.tasksInfo); }
    if (!('holidays' in d.plan)) {
      cur.holidays = Array.isArray(prev.holidays) ? prev.holidays : []; cur.holidaysFinger = str(prev.holidaysFinger);
    }
  }
  if (!d.core) cur.coursesFinger = str(prev.coursesFinger);
  return cur;
}
/* 前回と比べて、今回の状態を保存する。prevOpt を渡せば読み直さない（cron が先に読んでいるとき） */
async function runWatch(data, prevOpt) {
  try {
    const d = data || {};
    if (!d.core && !d.plan && !d.maps) return { events: [], baseline: false, skipped: true };   // 同期データが読めない回は何もしない
    let prev = prevOpt;
    if (prev === undefined) {
      const doc = await loadWatchDoc();
      if (doc.error) return { events: [], baseline: false, skipped: true };   // 読めなかった回に上書きすると前回の状態が消える
      prev = doc.state;
    }
    /* 初回のベースラインは、材料（core・plan・maps）がそろっているときだけ保存する。
       欠けたまま保存すると、次の回に実データが届いたとき全部が「新しい」と誤判定されるため */
    if (!prev && (!d.core || !d.plan || !d.maps)) return { events: [], baseline: false, skipped: true, partialBaseline: true };
    const cur = carryOver(stateOf(d), prev, d);
    const events = prev ? diffWatch(prev, cur) : [];
    await saveWatchState(cur);
    return { events, baseline: !prev };
  } catch (e) {
    return { events: [], baseline: false, error: String((e && e.message) || e) };
  }
}

/* ===== 出欠の危険科目（#43） ===== */
function dangerCourses(data) {
  const out = [];
  try {
    const maps = obj(data && data.maps);
    const log = obj(maps.attendLog), meta = obj(maps.courseMeta);
    Object.keys(log).forEach((name) => {
      const a = attendCount(log[name]);
      const cm = obj(meta[name]);
      let limit = null, limitSource = 'none';
      if (num(cm.evalAbsent) > 0) { limit = num(cm.evalAbsent); limitSource = 'courseMeta'; }
      else if (num(cm.total) > 0) { limit = Math.ceil(num(cm.total) / 3); limitSource = 'total/3'; }
      const remaining = limit === null ? null : limit - a.ab;
      let level = '';
      if (limit !== null && remaining <= 1) level = 'danger';
      else if (limit === null && a.ab >= 3) level = 'count';
      if (!level) return;
      out.push({ name, shortName: D.shortName(data || {}, name), ab: a.ab, late: a.late, limit, limitSource, remaining, level });
    });
  } catch (e) { return []; }
  out.sort((x, y) => {
    if (x.level !== y.level) return x.level === 'danger' ? -1 : 1;
    const rx = x.remaining === null ? 1e9 : x.remaining, ry = y.remaining === null ? 1e9 : y.remaining;
    if (rx !== ry) return rx - ry;
    return y.ab - x.ab;
  });
  return out;
}

/* ===== 週次のふりかえり（#126） =====
   課題の完了数は「done で、最後に更新された日時（mt）が週内のもの」で数える推定値（完了日時は記録されていないため）
   opts.noAi … AI の要約を試さない（送れない設定の cron で毎回呼ばないように） */
async function buildWeeklyReview(data, extra, snap, ymdNow, opts) {
  const ymd = D.isYmd(ymdNow) ? ymdNow : D.ymdJst();
  const weekStart = D.addDaysYmd(ymd, -((D.wdayOf(ymd) + 6) % 7));
  const weekEnd = D.addDaysYmd(weekStart, 6);
  const inWeek = (d) => D.isYmd(d) && d >= weekStart && d <= weekEnd;
  const counts = {
    attend: { pres: 0, late: 0, ab: 0 },
    tasks: { doneEstimated: 0, overdue: 0, estimated: true },
    money: { out: 0, count: 0, source: 'none' },
    ai: { calls: 0 },
  };
  try {
    const log = obj(data && data.maps && data.maps.attendLog);
    Object.keys(log).forEach((name) => {
      list(log[name]).forEach((x) => {
        if (!inWeek(x.date)) return;
        if (x.st === '出') counts.attend.pres++;
        else if (x.st === '遅') counts.attend.late++;
        else if (x.st === '欠') counts.attend.ab++;
      });
    });
    list(data && data.plan && data.plan.tasks).forEach((t) => {
      const mt = Number(t.mt) || 0;
      if (t.done && mt > 0 && inWeek(D.ymdJst(mt))) counts.tasks.doneEstimated++;
      if (!t.done && inWeek(t.due) && t.due <= ymd) counts.tasks.overdue++;
    });
    const txs = M.transactionsOf(data, snap);
    counts.money.source = txs.source;
    txs.list.forEach((tx) => {
      if (tx.io !== 'out' || !inWeek(tx.date)) return;
      counts.money.out += tx.amount; counts.money.count++;
    });
    const days = await AI.loadUsageDays();
    Object.keys(days).forEach((d) => { if (inWeek(d)) counts.ai.calls += Number(days[d] && days[d].calls) || 0; });
  } catch (e) { /* 集計できた分だけで作る */ }
  const lines = [
    D.mdLabel(weekStart) + '〜' + D.mdLabel(weekEnd) + ' のふりかえり',
    '・出欠：出席' + counts.attend.pres + '・遅刻' + counts.attend.late + '・欠席' + counts.attend.ab,
    '・課題：完了（推定）' + counts.tasks.doneEstimated + '件' + (counts.tasks.overdue ? '・締切を過ぎた未完了 ' + counts.tasks.overdue + '件' : ''),
    '・支出：¥' + D.yenText(counts.money.out) + '（' + counts.money.count + '件）',
    '・AIの利用：' + counts.ai.calls + '回',
  ];
  const text = lines.join('\n').slice(0, 500);
  let aiText = null;
  try {
    const tpl = (PROMPTS.weekly && PROMPTS.weekly.body) || '';
    if (tpl && !(opts && opts.noAi)) {
      const prompt = tpl.replace(/\{name\}さん/g, 'あなた').replace(/\{name\}/g, 'あなた')
        .replace(/\{start\}/g, D.mdLabel(weekStart)).replace(/\{end\}/g, D.mdLabel(weekEnd)).replace(/\{data\}/g, text);
      const r = await AI.generateText(prompt, { task: 'light' });
      if (r && r.ok && r.text) aiText = r.text;
    }
  } catch (e) { aiText = null; }
  return { weekStart, weekEnd, counts, text, aiText };
}

/* ===== サブスクの監査（#127） ===== */
function fingerOfSubs(snap) {
  const out = {};
  list(snap && snap.subs).forEach((s) => {
    const name = str(s.name);
    if (name && !(name in out)) out[name] = Number(s.amount) || 0;
  });
  return out;
}
function auditSubs(snap, prevFinger) {
  const subs = list(snap && snap.subs).filter((s) => str(s.name));
  if (!subs.length) return { enough: false, findings: [] };
  const findings = [];
  const byName = {};
  subs.forEach((s) => { (byName[s.name] = byName[s.name] || []).push(Number(s.amount) || 0); });
  Object.keys(byName).forEach((name) => {
    const amounts = byName[name];
    if (amounts.length < 2) return;
    const same = amounts.every((a) => a === amounts[0]);
    findings.push(same
      ? { type: 'duplicate', name, count: amounts.length, amount: amounts[0] }
      : { type: 'amount-mismatch', name, amounts });
  });
  const finger = fingerOfSubs(snap);
  const pf = prevFinger && typeof prevFinger === 'object' ? prevFinger : null;
  if (pf) {
    Object.keys(finger).forEach((name) => {
      if (name in pf && Number(pf[name]) !== finger[name]) findings.push({ type: 'amount-changed', name, before: Number(pf[name]) || 0, after: finger[name] });
    });
  }
  return { enough: true, findings, finger };
}
function auditText(findings) {
  return (findings || []).slice(0, 5).map((f) => {
    if (f.type === 'duplicate') return f.name + '：同じ内容が' + f.count + '件あります（¥' + D.yenText(f.amount) + '）';
    if (f.type === 'amount-mismatch') return f.name + '：同じ名前で金額がちがうものがあります（' + f.amounts.map((a) => '¥' + D.yenText(a)).join('・') + '）';
    if (f.type === 'amount-changed') return f.name + '：金額が変わりました（¥' + D.yenText(f.before) + ' → ¥' + D.yenText(f.after) + '）';
    return f.name || '';
  }).join('\n') + ((findings || []).length > 5 ? '\nほか' + (findings.length - 5) + '件' : '');
}

module.exports = {
  attendCount, stateOf, diffWatch, eventJob,
  loadWatchDoc, loadWatchState, saveWatchState, saveSubsFinger, runWatch,
  dangerCourses, buildWeeklyReview,
  fingerOfSubs, auditSubs, auditText,
};
