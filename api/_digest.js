/* くらしの手帳 Vercel API：同期データをサーバー側で読んで、通知の文面を作る部品
   - 読むのはアプリの同期と同じ文書（目次「部屋ID__v3」と、かたまりごとの文書「部屋ID__v3_<名前>_<指紋>_<番号>」）。
   - 読むだけで、書きこみはしません。
   - 読めないとき・形がちがうときは、例外にせず null や空を返します（通知を作らないだけで、ほかの処理は続ける）。
   - 日付・時刻はすべて日本時間（JST）で考えます。Vercel のサーバーは UTC で動くためです。
   - 祝日・時間割・コマの書き方は js/core.js・js/data.js と同じ考え方を移したものです。 */
'use strict';
const zlib = require('zlib');
const { FB, ROOM, MONEYSNAP_DOC, fsGetDoc } = require('./_fb');

const WDAY = ['日', '月', '火', '水', '木', '金', '土'];
const PERIODS = [1, 2, 3, 4, 5, 6];
const JST_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/* ===== 日本時間の小道具 ===== */
function pad(n) { return String(n).padStart(2, '0'); }
function isYmd(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }
function ymdJst(ms) { return new Date((ms == null ? Date.now() : ms) + JST_MS).toISOString().slice(0, 10); }
function minJst(ms) {
  const d = new Date((ms == null ? Date.now() : ms) + JST_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
function ymdToUtc(ymd) { const a = ymd.split('-'); return Date.UTC(+a[0], +a[1] - 1, +a[2]); }
function utcToYmd(ms) { return new Date(ms).toISOString().slice(0, 10); }
function addDaysYmd(ymd, n) { return isYmd(ymd) ? utcToYmd(ymdToUtc(ymd) + n * DAY_MS) : ymd; }
/* b − a の日数 */
function diffDays(a, b) {
  if (!isYmd(a) || !isYmd(b)) return null;
  return Math.round((ymdToUtc(b) - ymdToUtc(a)) / DAY_MS);
}
function wdayOf(ymd) { return new Date(ymdToUtc(ymd)).getUTCDay(); }
function ymdLabel(ymd) {
  if (!isYmd(ymd)) return ymd || '';
  const a = ymd.split('-');
  return Number(a[1]) + '月' + Number(a[2]) + '日（' + WDAY[wdayOf(ymd)] + '）';
}
function mdLabel(ymd) {
  if (!isYmd(ymd)) return ymd || '';
  const a = ymd.split('-');
  return Number(a[1]) + '月' + Number(a[2]) + '日';
}
function minutesOf(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}
function toNum(v) {
  const n = parseInt(String(v == null ? '' : v).replace(/[^0-9-]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}
function yenText(n) { return Math.round(n || 0).toLocaleString('ja-JP'); }

/* ===== Firestore の生の値を、ふつうの値に直す ===== */
function richValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('mapValue' in v) {
    const out = {};
    const f = (v.mapValue && v.mapValue.fields) || {};
    for (const k of Object.keys(f)) out[k] = richValue(f[k]);
    return out;
  }
  if ('arrayValue' in v) return ((v.arrayValue && v.arrayValue.values) || []).map(richValue);
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return !!v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  return null;
}
/* map を含む文書を読む（_fb の fsGetDoc は map を読まないので、ここで直接読む） */
async function fsGetRich(id) {
  try {
    const url = 'https://firestore.googleapis.com/v1/projects/' + FB.projectId + '/databases/(default)/documents/shiharai/' +
      encodeURIComponent(id) + (FB.apiKey ? '?key=' + FB.apiKey : '');
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    return richValue({ mapValue: { fields: j.fields || {} } });
  } catch (e) { return null; }
}

/* js/sync.js の hash53 と同じ（中身がこわれていないかの確認用） */
function hash53(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + 'x' + str.length.toString(36);
}

/* ===== 同期データを読む ===== */
async function loadIndex() {
  const doc = await fsGetRich(ROOM + '__v3');
  return doc && doc.parts && typeof doc.parts === 'object' ? doc.parts : null;
}
/* parts（目次）は省略可。省略したときは目次から読む */
async function loadPart(name, parts) {
  try {
    const idx = parts || await loadIndex();
    const m = idx && idx[name];
    if (!m || !m.h) return null;
    const n = Number(m.n) || 1;
    const ids = [];
    for (let i = 0; i < n; i++) ids.push(ROOM + '__v3_' + name + '_' + m.h + '_' + i);
    const docs = await Promise.all(ids.map((id) => fsGetDoc(id)));
    if (docs.some((d) => !d || d.h !== m.h)) return null;   // まだ届いていない部分がある
    const joined = docs.map((d) => d.d || '').join('');
    const text = Number(m.z) ? zlib.gunzipSync(Buffer.from(joined, 'base64')).toString('utf8') : joined;
    if (hash53(text) !== m.h) return null;
    return JSON.parse(text);
  } catch (e) { return null; }
}
async function loadData() {
  let parts = null;
  try { parts = await loadIndex(); } catch (e) { parts = null; }
  if (!parts) return { core: null, plan: null, money: null, maps: null };
  const [core, plan, money, maps] = await Promise.all(['core', 'plan', 'money', 'maps'].map((p) => loadPart(p, parts)));
  return { core, plan, money, maps };
}

/* ===== 日本の祝日（js/core.js の holidaysOf と同じ） ===== */
const holCache = {};
function ymdOf(y, m, d) { return utcToYmd(Date.UTC(y, m - 1, d)); }
function nthMonday(y, m, n) {            /* m は 1〜12 */
  const wd = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const first = 1 + ((8 - wd) % 7);       /* その月の最初の月曜 */
  return ymdOf(y, m, first + (n - 1) * 7);
}
function holidaysOf(y) {
  if (holCache[y]) return holCache[y];
  const h = {};
  const fixed = [[1, 1, '元日'], [2, 11, '建国記念の日'], [2, 23, '天皇誕生日'], [4, 29, '昭和の日'],
    [5, 3, '憲法記念日'], [5, 4, 'みどりの日'], [5, 5, 'こどもの日'], [8, 11, '山の日'],
    [11, 3, '文化の日'], [11, 23, '勤労感謝の日']];
  fixed.forEach((f) => { h[ymdOf(y, f[0], f[1])] = f[2]; });
  h[nthMonday(y, 1, 2)] = '成人の日';
  h[nthMonday(y, 7, 3)] = '海の日';
  h[nthMonday(y, 9, 3)] = '敬老の日';
  h[nthMonday(y, 10, 2)] = 'スポーツの日';
  /* 春分・秋分（1980〜2099年で使える式） */
  const t = y - 1980;
  h[ymdOf(y, 3, Math.floor(20.8431 + 0.242194 * t - Math.floor(t / 4)))] = '春分の日';
  h[ymdOf(y, 9, Math.floor(23.2488 + 0.242194 * t - Math.floor(t / 4)))] = '秋分の日';
  /* 振替休日：日曜と重なったら、次の祝日でない日 */
  Object.keys(h).slice().sort().forEach((k) => {
    if (wdayOf(k) !== 0) return;
    let n = k, guard = 0;
    do { n = addDaysYmd(n, 1); guard++; } while (h[n] && guard < 10);
    if (!h[n]) h[n] = '振替休日';
  });
  /* 国民の休日：祝日と祝日にはさまれた平日 */
  Object.keys(h).slice().sort().forEach((k) => {
    const mid = addDaysYmd(k, 1), nxt = addDaysYmd(k, 2);
    if (h[mid] || !h[nxt]) return;
    const w = wdayOf(mid);
    if (w === 0 || w === 6) return;
    h[mid] = '国民の休日';
  });
  holCache[y] = h;
  return h;
}
function holidayName(ymd) {
  if (!isYmd(ymd)) return '';
  return holidaysOf(+ymd.slice(0, 4))[ymd] || '';
}

/* ===== 時間割（js/data.js の parseSlots・js/core.js の classesForDate と同じ） ===== */
function parseSlots(s) {
  const out = [];
  let last = '月';
  String(s || '').split(',').forEach((t) => {
    t = t.trim();
    const m = t.match(/^([月火水木金土])?([1-7])$/);
    if (!m) return;
    const d = m[1] || last; last = d;
    out.push({ d, p: parseInt(m[2], 10) });
  });
  return out;
}
function courseAlias(data, name) {
  const cm = ((data.maps || {}).courseMeta || {})[name] || {};
  return cm.alias || '';
}
function shortName(data, name) { return courseAlias(data, name) || name; }
/* 戻り値: [{ period, name, room, web, off, start }]（off … '' | 'holiday' | 'cancel' | 'biweek'） */
function classesForDate(data, ymd) {
  try {
    if (!data || !isYmd(ymd)) return [];
    const core = data.core || {}, plan = data.plan || {}, maps = data.maps || {};
    const terms = Array.isArray(core.termsList) ? core.termsList.filter((t) => t && typeof t === 'object') : [];
    if (!terms.length) return [];
    const term = terms.filter((t) => t.id === core.termId)[0] || terms[0];
    const courseMeta = maps.courseMeta || {}, biweek = maps.biweek || {};
    const settings = core.settings || {};
    const periods = (core.commute && Array.isArray(core.commute.periods)) ? core.commute.periods : [];
    const courses = (term.courses || []).filter(Boolean).map((c) => ({
      name: c.name, slots: parseSlots(c.slots || ''), room: c.room || '', bi: c.bi ? 1 : 0, web: c.web ? 1 : 0,
    }));
    const courseByName = (name) => courses.filter((c) => c.name === name)[0] || null;
    const courseRoom = (name) => { const cm = courseMeta[name] || {}, c = courseByName(name); return cm.room || (c ? c.room : '') || ''; };
    const changes = (Array.isArray(plan.holidays) ? plan.holidays : []).filter((h) => h && h.date === ymd);
    const changeType = (h) => h.type || 'cancel';
    const isCancelled = (name) => changes.some((h) => changeType(h) === 'cancel' && (h.course === name || h.course === '*'));
    const isOnline = (name) => changes.some((h) => changeType(h) === 'online' && (h.course === name || h.course === '*'));
    const biweekOn = (name) => {
      const c = courseByName(name);
      if (!c || !c.bi) return true;
      const anchor = biweek[name];
      if (!isYmd(anchor)) return true;      /* 基準日が無ければ毎週あるものとして扱う */
      const d = diffDays(anchor, ymd);
      if (d === null) return true;
      const w = Math.floor(d / 7);
      return ((w % 2) + 2) % 2 === 0;
    };
    const dch = WDAY[wdayOf(ymd)];
    const map = {};
    courses.forEach((c) => { c.slots.forEach((sl) => { map[sl.d + sl.p] = c; }); });
    const holOn = changes.some((h) => changeType(h) === 'holclass');   /* この日は授業あり */
    const inBreak = (Array.isArray(plan.breaks) ? plan.breaks : []).some((b) => b && ymd >= b.from && ymd <= b.to);
    const isHol = (!!holidayName(ymd) || inBreak) && !settings.classOnHoliday && !holOn;
    const out = [];
    PERIODS.forEach((p) => {
      const c = map[dch + p]; if (!c) return;
      const off = isHol ? 'holiday' : isCancelled(c.name) ? 'cancel' : (!biweekOn(c.name) ? 'biweek' : '');
      const web = c.web || (isOnline(c.name) ? 1 : 0);
      out.push({ period: p, name: c.name, room: courseRoom(c.name), web, off, start: periods[p - 1] || '' });
    });
    /* 補講はその日に足す */
    changes.filter((h) => changeType(h) === 'makeup').forEach((h) => {
      const pd = toNum(h.period) || 1;
      if (out.some((x) => x.period === pd)) return;
      out.push({ period: pd, name: h.course, room: h.room || courseRoom(h.course), web: 0, off: '', start: periods[pd - 1] || '' });
    });
    out.sort((a, b) => a.period - b.period);
    return out;
  } catch (e) { return []; }
}

/* ===== 朝の「今日のまとめ」 ===== */
function listOf(o, k) { return o && Array.isArray(o[k]) ? o[k].filter((x) => x && typeof x === 'object') : []; }
/* バイトの記録は同期の money のかたまりに入っている（念のため plan も見る） */
function shiftsOf(data) { return listOf(data.money, 'shifts').concat(listOf(data.plan, 'shifts')); }
function buildDigest(data, ymd, wxList) {
  if (!data || !isYmd(ymd)) return null;
  const plan = data.plan || {};
  const lines = [];
  const cls = classesForDate(data, ymd).filter((c) => !c.off);
  if (cls.length) {
    const c0 = cls[0];
    lines.push('📚 ' + c0.period + '限 ' + (c0.start ? c0.start + ' ' : '') + shortName(data, c0.name) +
      (c0.room ? '（' + c0.room + '）' : '') + (c0.web ? '・家で受講' : ''));
    if (cls.length > 1) lines.push(cls.slice(1).map((c) => '・' + c.period + '限 ' + shortName(data, c.name)).join(' '));
  } else lines.push('📚 授業はありません');
  /* 気象警報は授業のすぐあとに割りこませる */
  (Array.isArray(wxList) ? wxList : []).forEach((w) => { lines.push('⚠️ 警報：' + w.area + '：' + w.name); });
  const due = listOf(plan, 'tasks').filter((t) => !t.done && t.due === ymd);
  if (due.length) {
    lines.push('📝 今日までの課題：' + due.slice(0, 3).map((t) => t.title || '課題').join('・') +
      (due.length > 3 ? ' ほか' + (due.length - 3) + '件' : ''));
  }
  listOf(plan, 'exams').filter((x) => x.date === ymd).forEach((x) => {
    lines.push('✏️ ' + [x.subject ? shortName(data, x.subject) : '', x.title || ''].filter(Boolean).join(' '));
  });
  listOf(plan, 'events').filter((e) => e.date === ymd || (isYmd(e.dateEnd) && e.date <= ymd && ymd <= e.dateEnd))
    .slice(0, 3).forEach((e) => { lines.push('📌 ' + (e.title || '予定')); });
  shiftsOf(data).filter((w) => w.date === ymd).forEach((w) => {
    lines.push('💼 バイト ' + (w.start || '') + (w.end ? '〜' + w.end : ''));
  });
  if (lines.length === 1 && lines[0] === '📚 授業はありません') return null;
  return { title: '☀️ 今日のまとめ', body: lines.join('\n').slice(0, 500) };
}

/* ===== 締切の段階（js/notify.js の d3/d1/d0 と同じ文面） ===== */
const STAGES = { 3: ['d3', '締切まであと3日'], 1: ['d1', '明日が締切です'], 0: ['d0', '今日が締切です'] };
function deadlineStages(data, ymdNow) {
  const out = [];
  if (!data || !isYmd(ymdNow)) return out;
  listOf(data.plan, 'tasks').forEach((t) => {
    if (t.done || !isYmd(t.due) || !t.id) return;
    const st = STAGES[diffDays(ymdNow, t.due)];
    if (!st) return;
    const name = (t.title || '課題') + (t.subject ? '（' + shortName(data, t.subject) + '）' : '');
    const tm = t.time ? '（' + t.time + 'まで）' : '';
    const body = st[0] === 'd3' ? name + '：' + ymdLabel(t.due) + tm : name + tm;
    out.push({ key: st[0], taskId: String(t.id), due: t.due, title: st[1], body });
  });
  return out;
}

/* ===== 残高の警告 =====
   今日か明日に引き落とされるものの合計が、いまの残高より多いとき。数字が分からないときは何も返さない */
const CARD_NAMES = { smbc: '三井住友カード', rakuten: '楽天カード' };
function dayOfYmd(ymd) { return Number(ymd.slice(8, 10)); }
async function balanceWarnings(data, ymdNow) {
  try {
    if (!isYmd(ymdNow)) return [];
    const targets = [ymdNow, addDaysYmd(ymdNow, 1)];
    const sums = {};
    const add = (ymd, amount, name) => {
      if (!(amount > 0)) return;
      const s = sums[ymd] || (sums[ymd] = { total: 0, names: [] });
      s.total += amount; s.names.push(name);
    };
    let balance = null;
    const money = data && data.money;
    if (money && Array.isArray(money.balances) && money.balances.length) {
      balance = money.balances.reduce((a, b) => a + toNum(b && b.amount), 0);
      listOf(money, 'fixed').forEach((f) => {
        const day = toNum(f.day), amount = toNum(f.amount);
        targets.forEach((ymd) => { if (day && day === dayOfYmd(ymd)) add(ymd, amount, f.name || '固定費'); });
      });
      const core = data.core || {};
      const settings = core.settings || {};
      const dayOf = { smbc: toNum(settings.smbcDay), rakuten: toNum(settings.rakutenDay) };
      listOf(core, 'statements').forEach((s) => {
        const d = dayOf[s.accountId];
        if (!d) return;
        targets.forEach((ymd) => {
          if (s.billingMonth === ymd.slice(0, 7) && d === dayOfYmd(ymd)) add(ymd, toNum(s.amount), CARD_NAMES[s.accountId]);
        });
      });
    } else if (!money) {
      /* 同期データの money が読めないときだけ、スナップショット { balance, debits:[{ date, amount, label }] } を見る */
      const snap = await fsGetDoc(MONEYSNAP_DOC).catch(() => null);
      if (!snap || typeof snap.balance !== 'number' || !isFinite(snap.balance)) return [];
      let debits = snap.debits;
      if (typeof debits === 'string') { try { debits = JSON.parse(debits); } catch (e) { debits = null; } }
      if (!Array.isArray(debits)) return [];
      balance = snap.balance;
      debits.forEach((x) => {
        if (!x || typeof x !== 'object') return;
        if (targets.indexOf(x.date) >= 0) add(x.date, Number(x.amount) || 0, String(x.label || '引落'));
      });
    }
    if (balance === null) return [];
    /* 日ごとに比べるだけでなく、今日→明日の累積でも判定する
       （今日の引落で残高が減り、明日の分が足りなくなるケースを拾うため） */
    const out = [];
    let acc = 0;
    for (const ymd of targets) {
      const s = sums[ymd];
      if (!s) continue;
      acc += s.total;
      if (balance < acc) { out.push({ targetYmd: ymd, total: s.total, cumulative: acc, balance, names: s.names }); break; }
    }
    return out;
  } catch (e) { return []; }
}

/* ===== 気象庁の警報（js/wx-plus.js と同じ読み方） ===== */
const JMA_WARN = {
  '02': '暴風雪警報', '03': '大雨警報', '04': '洪水警報', '05': '暴風警報', '06': '大雪警報', '07': '波浪警報', '08': '高潮警報',
  '10': '大雨注意報', '12': '大雪注意報', '13': '風雪注意報', '14': '雷注意報', '15': '強風注意報', '16': '波浪注意報', '17': '融雪注意報',
  '18': '洪水注意報', '19': '高潮注意報', '20': '濃霧注意報', '21': '乾燥注意報', '22': 'なだれ注意報', '23': '低温注意報', '24': '霜注意報',
  '25': '着氷注意報', '26': '着雪注意報', '27': 'その他の注意報',
  '32': '暴風雪特別警報', '33': '大雨特別警報', '35': '暴風特別警報', '36': '大雪特別警報', '37': '波浪特別警報', '38': '高潮特別警報',
};
const WX_AREAS = [['2821900', '三田市（家）'], ['2820400', '西宮市（大学）']];
const WX_OFFICE = '280000';
function warnLevel(code) {
  const c = Number(code);
  if (c >= 32) return 3;          /* 特別警報 */
  if (c >= 2 && c <= 8) return 2; /* 警報 */
  return 1;                       /* 注意報 */
}
/* 警報・特別警報（lv>=2）だけを返す。読めないときは [] */
async function jmaWarnings() {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch('https://www.jma.go.jp/bosai/warning/data/warning/' + WX_OFFICE + '.json', { signal: ac.signal });
    if (!r.ok) return [];
    const j = await r.json();
    let areas = [];
    (j.areaTypes || []).forEach((t) => { areas = areas.concat(t.areas || []); });
    const list = [];
    WX_AREAS.forEach((a) => {
      const hit = areas.filter((x) => x.code === a[0])[0];
      if (!hit) return;
      (hit.warnings || []).forEach((w) => {
        if (!w.code || /解除|なし/.test(w.status || '')) return;
        list.push({ area: a[1], name: JMA_WARN[w.code] || '警報・注意報（' + w.code + '）', lv: warnLevel(w.code) });
      });
    });
    list.sort((a, b) => b.lv - a.lv);
    return list.filter((w) => w.lv >= 2);
  } catch (e) {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  WDAY,
  ymdJst, minJst, addDaysYmd, diffDays, isYmd, wdayOf, ymdLabel, mdLabel, minutesOf, yenText,
  richValue, hash53, loadPart, loadData,
  holidaysOf, holidayName, parseSlots, classesForDate, shortName,
  buildDigest, deadlineStages, balanceWarnings, jmaWarnings,
};
