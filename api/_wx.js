/* くらしの手帳 Vercel API：天気まわりの部品（バッチC2）
   - 気象庁の予報（兵庫県）から降水確率を読む（#53 雨の日の出発前倒し）。
   - 警報の段階（警報／特別警報）と、前日・当日の文面（#54 / #58）。
   - 暑さ指数 WBGT（#55）。データ源の CSV の URL は環境変数 WBGT_CSV_URL で渡す（未設定なら何もしない）。
   - 読めないときは例外にせず null・enough:false を返す。 */
'use strict';
const { isYmd } = require('./_digest');

const FORECAST_URL = 'https://www.jma.go.jp/bosai/forecast/data/forecast/280000.json';
const AREA_SOUTH = '280010';   // 兵庫県南部（家も大学もここ）

async function fetchWithTimeout(url, ms) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms || 8000);
  try {
    return await fetch(url, { signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* ===== 降水確率 ===== */
async function jmaForecast() {
  try {
    const r = await fetchWithTimeout(FORECAST_URL, 8000);
    if (!r || !r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (e) { return null; }
}
/* 予報の [0].timeSeries から、南部の pops を timeDefines と対応付けて、その日の最大値を返す */
function popsForDate(forecast, ymd) {
  const out = { pop: null, slots: [] };
  try {
    const series = (Array.isArray(forecast) && forecast[0] && forecast[0].timeSeries) || [];
    for (const s of series) {
      const area = (s && Array.isArray(s.areas) ? s.areas : []).filter((a) => a && a.area && a.area.code === AREA_SOUTH && Array.isArray(a.pops))[0];
      if (!area) continue;
      const times = Array.isArray(s.timeDefines) ? s.timeDefines : [];
      area.pops.forEach((p, i) => {
        if (p === '' || p == null) return;
        const at = String(times[i] || '');
        if (at.slice(0, 10) !== ymd) return;
        const n = Number(p);
        if (!isFinite(n)) return;
        out.slots.push({ at, pop: n });
        if (out.pop === null || n > out.pop) out.pop = n;
      });
      break;
    }
  } catch (e) { return { pop: null, slots: [] }; }
  return out;
}
/* 傘の要否（アプリの umbrellaInfo と同じ物差し：50%以上で雨、30%以上で「かも」） */
async function rainInfo(ymd, forecastOpt) {
  if (!isYmd(ymd)) return { enough: false };
  const fc = forecastOpt || await jmaForecast();
  if (!fc) return { enough: false };
  const p = popsForDate(fc, ymd);
  if (p.pop === null) return { enough: false };
  return { enough: true, pop: p.pop, rain: p.pop >= 50, maybe: p.pop >= 30, slots: p.slots };
}

/* ===== 警報の段階 ===== */
function warningStage(warnList) {
  const lv = (Array.isArray(warnList) ? warnList : []).reduce((m, w) => Math.max(m, Number(w && w.lv) || 0), 0);
  if (lv >= 3) return { lv, stage: 'special', label: '特別警報' };
  if (lv === 2) return { lv, stage: 'warn', label: '警報' };
  return { lv, stage: 'none', label: '' };
}
/* phase は '前日' | '当日'。警報が無ければ '' */
function stageText(warnList, phase) {
  const s = warningStage(warnList);
  const eve = phase === '前日';
  if (s.stage === 'special') {
    return eve ? '⚠️ 特別警報が出ています。明日は無理に出かけず、最新の情報を確認してね。'
      : '⚠️ 特別警報が出ています。身の安全を最優先に。';
  }
  if (s.stage === 'warn') {
    return eve ? '⚠️ 警報が出ています。明日の休講・交通の情報を確認してね。'
      : '⚠️ 警報が出ています。休講や電車の遅れがないか確認してね。';
  }
  return '';
}

/* ===== 暑さ指数（WBGT） =====
   CSV の形は提供元しだいなので、次の2通りを読む（取れなければ enough:false）
   1. その日の日付（YYYY-MM-DD / YYYY/M/D / YYYYMMDD）を含む行の、15〜45 の数値セルの最大
   2. 見出し行に YYYYMMDDHH の時刻が並ぶ形（環境省の予測値 CSV）。その日の列の最大（値が10倍なら戻す） */
function wbgtLevel(v) {
  if (v >= 31) return '危険';
  if (v >= 28) return '厳重警戒';
  if (v >= 25) return '警戒';
  return '';
}
function dateForms(ymd) {
  const a = ymd.split('-');
  return [ymd, a[0] + '/' + a[1] + '/' + a[2], a[0] + '/' + Number(a[1]) + '/' + Number(a[2]), a.join('')];
}
function cellNum(c) {
  const t = String(c || '').trim().replace(/^"|"$/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}
function parseWbgtCsv(text, ymd) {
  const rows = String(text || '').replace(/\r/g, '').split('\n').filter((l) => l.trim()).map((l) => l.split(','));
  if (!rows.length) return null;
  let best = null;
  const take = (n) => { if (n !== null && n >= 15 && n <= 45 && (best === null || n > best)) best = n; };
  /* 2. 見出し行が時刻の形 */
  const compact = ymd.replace(/-/g, '');
  const cols = [];
  rows[0].forEach((c, i) => { if (new RegExp('^"?' + compact + '\\d{2}"?$').test(String(c).trim())) cols.push(i); });
  if (cols.length) {
    rows.slice(1).forEach((r) => cols.forEach((i) => {
      const n = cellNum(r[i]);
      if (n === null) return;
      take(n > 45 && n <= 450 ? n / 10 : n);
    }));
    if (best !== null) return best;
  }
  /* 1. 日付を含む行 */
  const forms = dateForms(ymd);
  rows.forEach((r) => {
    const hit = r.some((c) => { const t = String(c).trim().replace(/^"|"$/g, ''); return forms.some((f) => t === f || t.indexOf(f + ' ') === 0 || t.indexOf(f + 'T') === 0); });
    if (!hit) return;
    r.forEach((c) => {
      const t = String(c).trim().replace(/^"|"$/g, '');
      if (forms.some((f) => t.indexOf(f) === 0)) return;   // 日付のセルは数えない
      take(cellNum(c));
    });
  });
  return best;
}
async function wbgtInfo(ymd) {
  const url = process.env.WBGT_CSV_URL || '';
  if (!url) return { enough: false, reason: 'WBGT_CSV_URL 未設定' };
  if (!isYmd(ymd)) return { enough: false, reason: '日付がちがいます' };
  try {
    const r = await fetchWithTimeout(url, 8000);
    if (!r || !r.ok) return { enough: false, reason: '取得できませんでした' };
    const v = parseWbgtCsv(await r.text(), ymd);
    if (v === null) return { enough: false, reason: 'その日の値が見つかりません' };
    return { enough: true, wbgt: Math.round(v * 10) / 10, level: wbgtLevel(v) };
  } catch (e) {
    return { enough: false, reason: '取得できませんでした' };
  }
}

module.exports = {
  FORECAST_URL, AREA_SOUTH,
  jmaForecast, popsForDate, rainInfo,
  warningStage, stageText,
  wbgtLevel, parseWbgtCsv, wbgtInfo,
};
