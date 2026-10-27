/* くらしの手帳 Vercel API：予定まわりのサーバー処理（バッチC1）
   - 同期データの plan（events / tasks / exams）、money（shifts）、extra（annivs）を
     サーバー側で「日ごとの予定」に展開して、重なりチェック・前日リマインド・
     空き時間の提案・.ics 生成・カウントダウン用データを組み立てる。
   - クライアントの繰り返し予定について：アプリは繰り返しを「毎週ぶんの実体を
     先に作る」方式（js/calendar.js の createOne が rid を共有する複数件を作る）。
     そのためサーバー側で RRULE のような展開は不要で、実体をそのまま読むのが正しい。
     サーバーで展開するのは、年1回の記念日（annivs。'MM-DD' または 'YYYY-MM-DD'）と
     複数日にまたがる予定（date〜dateEnd）だけ。
   - 判定はすべて「警告候補」レベル。場所の情報が無いので、移動時間は目安として使う。 */
'use strict';
const { GCAL_DOC, fsGetDoc } = require('./_fb');
const { isYmd, addDaysYmd, diffDays, minutesOf, hash53, classesForDate } = require('./_digest');

/* Googleカレンダーのキャッシュ（#71。api/calendar.js が書いた GCAL_DOC）を読む。
   無い・壊れているときは空（共有予定なし）として扱う */
async function loadGcalItems() {
  try {
    const doc = await fsGetDoc(GCAL_DOC);
    if (!doc || !doc.items) return [];
    const arr = typeof doc.items === 'string' ? JSON.parse(doc.items) : doc.items;
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function listOf(o, k) { return o && Array.isArray(o[k]) ? o[k].filter((x) => x && typeof x === 'object') : []; }
function pad(n) { return String(n).padStart(2, '0'); }
function hhmm(min) {
  if (min === null || min === undefined || !isFinite(min)) return '';
  return pad(Math.floor(min / 60)) + ':' + pad(min % 60);
}

/* 通学の所要時間（片道・分）。同期の commute 設定（歩き+バス+乗換+電車+学校まで）から。
   読めないときは目安の100分 */
function commuteMinutesOf(data) {
  const c = data && data.core && data.core.commute;
  if (c && typeof c === 'object') {
    const parts = ['walk', 'bus', 'change', 'train', 'toSchool'].map((k) => Number(c[k]) || 0);
    const sum = parts.reduce((a, b) => a + b, 0);
    if (sum > 0) return sum;
  }
  return 100;
}

/* 記念日の今年・来年の日付（'MM-DD' でも 'YYYY-MM-DD' でも、毎年くり返す） */
function annivDates(a, years) {
  const m = /^(\d{4}-)?(\d{2})-(\d{2})$/.exec(String((a && a.date) || ''));
  if (!m) return [];
  return years.map((y) => y + '-' + m[2] + '-' + m[3]).filter(isYmd);
}

/* ===== 日ごとの予定への展開 =====
   戻り値: [{ date, title, kind, src, id, time, endTime, shared, cal?, span? }]
   kind … event | exam | shift | task | anniv | gcal | class は付けない（授業は別枠）
   gcalItems（#71 のキャッシュ）があれば、共有予定として shared:true で混ぜる */
function occurrencesInRange(data, extra, fromYmd, toYmd, gcalItems) {
  const out = [];
  if (!isYmd(fromYmd) || !isYmd(toYmd) || fromYmd > toYmd) return out;
  const plan = (data && data.plan) || {};
  const inRange = (d) => isYmd(d) && d >= fromYmd && d <= toYmd;

  listOf(plan, 'events').forEach((e) => {
    if (!isYmd(e.date)) return;
    const end = isYmd(e.dateEnd) && e.dateEnd > e.date ? e.dateEnd : e.date;
    let d = e.date, guard = 0;
    while (d <= end && guard < 62) {
      if (inRange(d)) {
        out.push({
          date: d, title: e.title || '予定', kind: 'event', src: 'events', id: String(e.id || ''),
          time: e.time || '', endTime: '', shared: !!(e.shared || e.cal), cal: e.cal || '',
          span: end !== e.date,
        });
      }
      d = addDaysYmd(d, 1); guard++;
    }
  });
  listOf(plan, 'exams').forEach((x) => {
    if (!inRange(x.date)) return;
    out.push({
      date: x.date, title: [x.subject, x.title].filter(Boolean).join(' ') || 'テスト', kind: 'exam', src: 'exams',
      id: String(x.id || ''), time: x.time || '', endTime: '', shared: false, cal: '',
    });
  });
  listOf(data && data.money, 'shifts').forEach((s) => {
    if (!inRange(s.date)) return;
    out.push({
      date: s.date, title: s.title || 'バイト', kind: 'shift', src: 'shifts', id: String(s.id || ''),
      time: s.start || '', endTime: s.end || '', shared: false, cal: '',
    });
  });
  listOf(plan, 'tasks').forEach((t) => {
    if (t.done || !inRange(t.due)) return;
    out.push({
      date: t.due, title: t.title || '課題', kind: 'task', src: 'tasks', id: String(t.id || ''),
      time: t.time || '', endTime: '', shared: false, cal: '',
    });
  });
  const years = [];
  for (let y = Number(fromYmd.slice(0, 4)); y <= Number(toYmd.slice(0, 4)); y++) years.push(y);
  listOf(extra, 'annivs').forEach((a) => {
    annivDates(a, years).forEach((d) => {
      if (!inRange(d)) return;
      out.push({
        date: d, title: a.name || '記念日', kind: 'anniv', src: 'annivs', id: String(a.id || ''),
        time: '', endTime: '', shared: false, cal: '', annivKind: a.kind || '', who: a.who || '',
      });
    });
  });
  (Array.isArray(gcalItems) ? gcalItems : []).forEach((g) => {
    if (!g || typeof g !== 'object') return;
    const d = String(g.start || '').slice(0, 10);
    if (!inRange(d)) return;
    const timed = /T(\d{2}):(\d{2})/.exec(String(g.start || ''));
    const endT = /T(\d{2}):(\d{2})/.exec(String(g.end || ''));
    out.push({
      date: d, title: String(g.title || '予定').slice(0, 80), kind: 'gcal', src: 'gcal', id: String(g.id || ''),
      time: timed ? timed[1] + ':' + timed[2] : '', endTime: endT ? endT[1] + ':' + endT[2] : '',
      shared: true, cal: String(g.cal || ''),
    });
  });
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '99:99') < (b.time || '99:99') ? -1 : 1));
  return out;
}

/* ===== 重なり・移動時間の警告候補（#72 / #78） =====
   時刻のある予定だけを対象に、(1) 時間の重なり、(2) 通学所要時間より短い間隔
   を「候補」として返す。終わり時刻が無い予定は60分として扱う（アプリの予定は
   開始時刻のみで、終わりは持っていないため）。共有予定（gcal）は shared で区別する。 */
const DEFAULT_DUR_MIN = 60;
function timedSpan(o) {
  const s = minutesOf(o.time);
  if (s === null) return null;
  let e = minutesOf(o.endTime);
  if (e === null || e <= s) e = s + DEFAULT_DUR_MIN;
  return { s, e };
}
function conflictsForRange(occs, commuteMin) {
  const warnings = [];
  const byDate = {};
  (occs || []).forEach((o) => {
    if (o.kind === 'task' || o.kind === 'anniv') return;   // 締切と記念日は「居場所」ではない
    (byDate[o.date] = byDate[o.date] || []).push(o);
  });
  Object.keys(byDate).sort().forEach((date) => {
    const items = byDate[date]
      .map((o) => ({ o, span: timedSpan(o) }))
      .filter((x) => x.span)
      .sort((a, b) => a.span.s - b.span.s);
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1], cur = items[i];
      const base = {
        date,
        a: { title: prev.o.title, time: prev.o.time, kind: prev.o.kind, shared: !!prev.o.shared, cal: prev.o.cal || '' },
        b: { title: cur.o.title, time: cur.o.time, kind: cur.o.kind, shared: !!cur.o.shared, cal: cur.o.cal || '' },
      };
      if (cur.span.s < prev.span.e) {
        warnings.push(Object.assign({ type: 'overlap' }, base));
      } else if (cur.span.s - prev.span.e < commuteMin) {
        warnings.push(Object.assign({ type: 'tight', gapMin: cur.span.s - prev.span.e, commuteMin }, base));
      }
    }
  });
  return warnings;
}

/* ===== 空き時間と課題の割り当て候補（#76） ===== */
const GAP_WINDOW = { from: 8 * 60, to: 22 * 60 };
const GAP_MIN_TASK = 30;
function gapsForDate(data, extra, ymd, gcalItems) {
  if (!isYmd(ymd)) return null;
  const busy = [];
  occurrencesInRange(data, extra, ymd, ymd, gcalItems).forEach((o) => {
    if (o.kind === 'task' || o.kind === 'anniv') return;
    const sp = timedSpan(o);
    if (sp) busy.push({ s: sp.s, e: sp.e, title: o.title });
  });
  /* 授業も埋まっている時間として扱う（コマの開始・終了は commute.periods / ends） */
  try {
    const commute = (data && data.core && data.core.commute) || {};
    const starts = Array.isArray(commute.periods) ? commute.periods : [];
    const ends = Array.isArray(commute.ends) ? commute.ends : [];
    classesForDate(data, ymd).forEach((c) => {
      if (c.off) return;
      const s = minutesOf(starts[c.period - 1] || c.start);
      const e = minutesOf(ends[c.period - 1]);
      if (s !== null) busy.push({ s, e: e !== null && e > s ? e : s + 90, title: c.name });
    });
  } catch (e) { /* 授業が読めなくても空き時間は出す */ }
  busy.sort((a, b) => a.s - b.s);
  const gaps = [];
  let cur = GAP_WINDOW.from;
  busy.forEach((b) => {
    const s = Math.max(b.s, GAP_WINDOW.from), e = Math.min(b.e, GAP_WINDOW.to);
    if (s > cur) gaps.push({ from: cur, to: s, minutes: s - cur });
    if (e > cur) cur = e;
  });
  if (cur < GAP_WINDOW.to) gaps.push({ from: cur, to: GAP_WINDOW.to, minutes: GAP_WINDOW.to - cur });
  const tasks = listOf(data && data.plan, 'tasks')
    .filter((t) => !t.done)
    .sort((a, b) => String(a.due || '9999') < String(b.due || '9999') ? -1 : 1);
  const suggestions = [];
  const usable = gaps.filter((g) => g.minutes >= GAP_MIN_TASK);
  tasks.forEach((t, i) => {
    const g = usable[i];
    if (!g) return;
    suggestions.push({
      taskId: String(t.id || ''), title: t.title || '課題', due: t.due || '',
      from: hhmm(g.from), to: hhmm(Math.min(g.to, g.from + 60)), minutes: Math.min(g.minutes, 60),
    });
  });
  return {
    date: ymd,
    gaps: gaps.map((g) => ({ from: hhmm(g.from), to: hhmm(g.to), minutes: g.minutes })),
    suggestions,
  };
}

/* ===== 直近の予定・締切（#80）と翌日の予定（#75） ===== */
function nextItems(data, extra, ymdNow, limit, gcalItems) {
  if (!isYmd(ymdNow)) return [];
  const to = addDaysYmd(ymdNow, 60);
  const occs = occurrencesInRange(data, extra, ymdNow, to, gcalItems)
    .filter((o) => o.kind !== 'shift');
  return occs.slice(0, Math.max(1, Math.min(50, limit || 10))).map((o) => ({
    date: o.date, daysLeft: diffDays(ymdNow, o.date), kind: o.kind,
    title: o.title, time: o.time || '', shared: !!o.shared,
    deadline: o.kind === 'task',   // #48 締切（課題）かどうか
  }));
}
function dayItems(data, extra, ymd, gcalItems) {
  return occurrencesInRange(data, extra, ymd, ymd, gcalItems)
    .filter((o) => o.kind === 'event' || o.kind === 'exam' || o.kind === 'shift' || o.kind === 'gcal');
}

/* ===== 記念日の候補（#77） ===== */
function annivCandidates(extra, ymdNow) {
  const out = [];
  if (!isYmd(ymdNow)) return out;
  const tomorrow = addDaysYmd(ymdNow, 1);
  const years = [Number(ymdNow.slice(0, 4)), Number(ymdNow.slice(0, 4)) + 1];
  listOf(extra, 'annivs').forEach((a) => {
    annivDates(a, years).forEach((d) => {
      const when = d === ymdNow ? '当日' : d === tomorrow ? '前日' : '';
      if (!when) return;
      out.push({
        key: 'srv-anniv-' + (a.id || hash53(a.name || '')) + '-' + d + '-' + (when === '当日' ? 'd0' : 'd1'),
        id: 'anniv-' + d + '-' + (a.id || hash53(a.name || '')),
        when, date: d, name: a.name || '記念日', annivKind: a.kind || '',
        title: when === '当日' ? '🎂 今日は記念日' : '🎂 明日は記念日',
        body: (a.name || '記念日') + (a.kind === 'birthday' ? 'の誕生日' : '') + 'は' + (when === '当日' ? '今日' : '明日') + 'です',
      });
    });
  });
  return out;
}

/* ===== .ics 生成（#74） ===== */
function icsEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function icsUtc(ymd, hhmmStr) {
  const m = minutesOf(hhmmStr);
  if (m === null) return '';
  const a = ymd.split('-');
  const t = Date.UTC(+a[0], +a[1] - 1, +a[2], 0, m) - 9 * 60 * 60 * 1000;   // JST → UTC
  return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
function buildIcs(occs, nowMs) {
  const stamp = new Date(nowMs || Date.now()).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//kurashi//VERCEL//JA', 'CALSCALE:GREGORIAN'];
  (occs || []).forEach((o) => {
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + hash53(o.src + '|' + o.id + '|' + o.date + '|' + o.title) + '@kurashi');
    lines.push('DTSTAMP:' + stamp);
    if (o.time && icsUtc(o.date, o.time)) {
      lines.push('DTSTART:' + icsUtc(o.date, o.time));
      const endMin = (minutesOf(o.endTime) !== null && minutesOf(o.endTime) > minutesOf(o.time))
        ? o.endTime : hhmm(minutesOf(o.time) + DEFAULT_DUR_MIN);
      lines.push('DTEND:' + icsUtc(o.date, endMin));
    } else {
      lines.push('DTSTART;VALUE=DATE:' + o.date.replace(/-/g, ''));
      lines.push('DTEND;VALUE=DATE:' + addDaysYmd(o.date, 1).replace(/-/g, ''));
    }
    lines.push('SUMMARY:' + icsEscape(o.title));
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

module.exports = {
  loadGcalItems,
  listOf, hhmm, commuteMinutesOf, annivDates,
  occurrencesInRange, conflictsForRange, gapsForDate,
  nextItems, dayItems, annivCandidates, buildIcs,
};
