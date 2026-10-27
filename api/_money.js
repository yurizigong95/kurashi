/* くらしの手帳 Vercel API：お金まわりのサーバー処理（バッチC1）
   - 数字は同期データ（money のかたまり）と、取り込み口（/api/money/import）で受けた
     スナップショット（MONEYSNAP_DOC）にあるものだけを使う。推測で金額は作らない。
   - データが無い・読めないときは例外にせず null / 空 / enough:false を返す。
   - スナップショットの保存形式は、バッチBの残高警告（api/_digest.js の balanceWarnings の
     予備読み）が読める形にそろえる：balance は数値フィールド、debits は JSON 文字列。 */
'use strict';
const { MONEYSNAP_DOC, SNAPSHOTS_DOC, RULES_DOC, fsGetDoc, fsSetDoc } = require('./_fb');
const { isYmd, addDaysYmd, diffDays, ymdLabel, mdLabel, yenText, hash53 } = require('./_digest');

function toNum(v) {
  const n = parseInt(String(v == null ? '' : v).replace(/[^0-9-]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}
function capStr(v, n) { return String(v == null ? '' : v).slice(0, n); }
function ymOf(ymd) { return isYmd(ymd) ? ymd.slice(0, 7) : ''; }

/* ===== スナップショット（#31） ===== */
const SNAP_MAX_TX = 3000, SNAP_MAX_DEBITS = 200, SNAP_MAX_SUBS = 100, SNAP_MAX_BAL = 50;

function normalizeTx(x) {
  if (!x || typeof x !== 'object' || !isYmd(x.date)) return null;
  const amount = Math.abs(Number(x.amount) || 0);
  if (!isFinite(amount)) return null;
  return {
    date: x.date,
    amount,
    io: x.io === 'in' ? 'in' : 'out',
    title: capStr(x.title || x.name || '', 80),
    cat: capStr(x.cat || '', 30),
    acct: capStr(x.acct || '', 40),
  };
}
function normalizeSnap(input) {
  if (!input || typeof input !== 'object') return null;
  const out = { balance: null, balances: [], debits: [], transactions: [], subs: [], updatedAt: new Date().toISOString() };
  if (Array.isArray(input.balances)) {
    out.balances = input.balances.slice(0, SNAP_MAX_BAL).map((b) => ({
      name: capStr(b && b.name, 60), amount: Number(b && b.amount) || 0,
    })).filter((b) => isFinite(b.amount));
  }
  if (typeof input.balance === 'number' && isFinite(input.balance)) out.balance = input.balance;
  else if (out.balances.length) out.balance = out.balances.reduce((a, b) => a + b.amount, 0);
  if (Array.isArray(input.debits)) {
    out.debits = input.debits.slice(0, SNAP_MAX_DEBITS).map((d) => ({
      date: d && d.date, amount: Number(d && d.amount) || 0, label: capStr(d && (d.label || d.name), 60),
    })).filter((d) => isYmd(d.date) && d.amount > 0);
  }
  if (Array.isArray(input.transactions)) {
    out.transactions = input.transactions.slice(0, SNAP_MAX_TX).map(normalizeTx).filter(Boolean);
  }
  if (Array.isArray(input.subs)) {
    out.subs = input.subs.slice(0, SNAP_MAX_SUBS).map((s) => ({
      name: capStr(s && s.name, 60), renewDate: s && s.renewDate, amount: Number(s && s.amount) || 0,
    })).filter((s) => s.name && isYmd(s.renewDate));
  }
  return out;
}
async function loadMoneySnap() {
  try {
    const doc = await fsGetDoc(MONEYSNAP_DOC);
    if (!doc) return null;
    const parse = (v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return []; } }
      return [];
    };
    return normalizeSnap({
      balance: typeof doc.balance === 'number' ? doc.balance : undefined,
      balances: parse(doc.balances),
      debits: parse(doc.debits),
      transactions: parse(doc.transactions),
      subs: parse(doc.subs),
    });
  } catch (e) { return null; }
}
async function saveMoneySnap(snap) {
  /* 残高が分からないときは null のまま保存する（0 にすると、_digest の予備読みが
     「残高0円」と誤判定してしまうため）。hasBalance は念のための印 */
  await fsSetDoc(MONEYSNAP_DOC, {
    balance: snap.balance,
    hasBalance: snap.balance !== null,
    balances: JSON.stringify(snap.balances),
    debits: JSON.stringify(snap.debits),
    transactions: JSON.stringify(snap.transactions),
    subs: JSON.stringify(snap.subs),
    updatedAt: snap.updatedAt,
  });
  return true;
}

/* ===== 明細の統一形（同期の spends を優先し、無ければスナップショット） ===== */
function transactionsOf(data, snap) {
  const spends = data && data.money && Array.isArray(data.money.spends) ? data.money.spends : [];
  const fromSync = spends.map(normalizeTx).filter(Boolean);
  if (fromSync.length) return { list: fromSync, source: 'sync' };
  if (snap && Array.isArray(snap.transactions) && snap.transactions.length) return { list: snap.transactions, source: 'snap' };
  return { list: [], source: 'none' };
}
function balanceOf(data, snap) {
  const money = data && data.money;
  if (money && Array.isArray(money.balances) && money.balances.length) {
    return { balance: money.balances.reduce((a, b) => a + toNum(b && b.amount), 0), source: 'sync' };
  }
  if (snap && typeof snap.balance === 'number') return { balance: snap.balance, source: 'snap' };
  return { balance: null, source: 'none' };
}

/* ===== 給与らしい入金（#34） =====
   パターンは環境変数 SALARY_PATTERNS（正規表現をカンマ区切り）で変更できる。
   あたるかどうかは「可能性」の判定にだけ使い、文面でも断定しない。 */
function salaryPatterns() {
  const raw = process.env.SALARY_PATTERNS || '';
  const list = [];
  if (raw) {
    raw.split(',').forEach((s) => {
      s = s.trim();
      if (!s) return;
      try { list.push(new RegExp(s, 'i')); } catch (e) { /* 壊れた正規表現は読み飛ばす */ }
    });
  }
  if (!list.length) list.push(/給与/, /給料/, /バイト代/, /賃金/, /salary/i);
  return list;
}
function isSalaryTx(tx, pats) {
  if (!tx || tx.io !== 'in') return false;
  const pats2 = pats || salaryPatterns();
  return pats2.some((re) => re.test(tx.title || '') || re.test(tx.acct || ''));
}
/* 直近3日以内の給与らしい入金・給与の支払い記録を、通知の候補として返す */
function salaryCandidates(data, snap, ymdNow, nowMs) {
  const out = [];
  if (!isYmd(ymdNow)) return out;
  const from = addDaysYmd(ymdNow, -3);
  const payApplied = (data && data.maps && data.maps.payApplied && typeof data.maps.payApplied === 'object') ? data.maps.payApplied : {};
  const payMonths = {};
  Object.keys(payApplied).forEach((ym) => {
    const rec = payApplied[ym];
    if (!rec || typeof rec !== 'object') return;
    const at = Number(rec.at) || 0;
    if (!at || nowMs - at > 3 * 24 * 60 * 60 * 1000 || at > nowMs + 60 * 1000) return;
    const amount = toNum(rec.amount);
    if (!(amount > 0)) return;
    payMonths[ym] = true;
    out.push({
      key: 'srv-pay-' + ym,
      id: 'pay-' + ym,
      title: '💰 給与の入金かも',
      body: ym.replace('-', '年') + '月の給与 ¥' + yenText(amount) + ' が「支払われた」記録になっています。口座の明細と合っているか確認してね',
    });
  });
  const txs = transactionsOf(data, snap);
  const pats = salaryPatterns();
  txs.list.forEach((tx) => {
    if (tx.date < from || tx.date > ymdNow) return;
    if (!isSalaryTx(tx, pats)) return;
    if (payMonths[ymOf(tx.date)]) return;   // 給与記録と重なりそうな月はそちらを優先
    out.push({
      key: 'srv-salary-' + tx.date + '-' + tx.amount + '-' + hash53(tx.title).slice(0, 6),
      id: 'salary-' + tx.date + '-' + hash53(tx.title).slice(0, 6),
      title: '💰 給与の入金かも',
      body: '「' + (tx.title || '入金') + '」¥' + yenText(tx.amount) + ' の入金がありました。給与の振り込みかもしれません',
    });
  });
  return out;
}

/* ===== 扶養の壁ウォッチ（#35） =====
   年収累計 = 給与の支払い記録（maps.payApplied、その年の勤務月ぶん）を優先し、
   無い月は明細の給与らしい入金で埋める。どちらも無ければ enough:false。
   上限は 環境変数 FUYOU_LIMIT → アプリ設定 settings.fuyouLimit → 仮の既定値 1,030,000 の順。 */
const FUYOU_DEFAULT = 1030000;
function incomeSummary(data, snap, year) {
  const y = String(year || '').replace(/[^0-9]/g, '').slice(0, 4) || String(new Date().getFullYear());
  const settings = (data && data.core && data.core.settings) || {};
  let limit = Number(process.env.FUYOU_LIMIT) || 0;
  let limitSource = '環境変数';
  if (!(limit > 0)) { limit = toNum(settings.fuyouLimit); limitSource = 'アプリの設定'; }
  if (!(limit > 0)) { limit = FUYOU_DEFAULT; limitSource = '仮の既定値（アプリ未設定）'; }
  const payApplied = (data && data.maps && data.maps.payApplied && typeof data.maps.payApplied === 'object') ? data.maps.payApplied : {};
  const txs = transactionsOf(data, snap).list;
  const pats = salaryPatterns();
  const monthly = [];
  let total = 0, any = false;
  for (let m = 1; m <= 12; m++) {
    const ym = y + '-' + String(m).padStart(2, '0');
    const rec = payApplied[ym];
    const payAmt = rec && typeof rec === 'object' ? toNum(rec.amount) : 0;
    if (payAmt > 0) { monthly.push({ ym, amount: payAmt, source: 'actual' }); total += payAmt; any = true; continue; }
    const s = txs.filter((tx) => ymOf(tx.date) === ym && isSalaryTx(tx, pats)).reduce((a, tx) => a + tx.amount, 0);
    if (s > 0) { monthly.push({ ym, amount: s, source: '明細' }); total += s; any = true; continue; }
    monthly.push({ ym, amount: 0, source: 'none' });
  }
  return {
    year: y, limit, limitSource, total, remaining: limit - total,
    monthly, enough: any,
    note: any ? '' : '給与の記録も明細も無いため、判定できません',
  };
}

/* ===== 月のまとめ（#37） ===== */
const KB_CAT_LABELS = {
  food: '食費', daily: '日用品', move: '交通', study: '勉強・本', wear: '服・美容',
  fun: '趣味・遊び', friend: '交際', health: '医療', phone: 'スマホ・通信', other: 'その他',
};
function monthSummary(txs, ym) {
  const list = (txs || []).filter((tx) => ymOf(tx.date) === ym);
  let out = 0, inn = 0;
  const by = {};
  list.forEach((tx) => {
    if (tx.io === 'in') { inn += tx.amount; return; }
    out += tx.amount;
    const c = tx.cat || 'other';
    by[c] = (by[c] || 0) + tx.amount;
  });
  const byCat = Object.keys(by).map((c) => ({ cat: c, label: KB_CAT_LABELS[c] || c, amount: by[c] }))
    .sort((a, b) => b.amount - a.amount);
  return { ym, out, inn, byCat, count: list.length };
}

/* ===== 引落日の朝チェック（#32） =====
   今日の引落予定の合計と残高を比べる。当日ぶんだけを見る（今日＋明日の累積判定は
   バッチBの #7 balanceWarnings が担当）。重複送信の防ぎ方は cron.js 側のコメント参照。 */
function debitMorningCheck(data, snap, ymdNow) {
  if (!isYmd(ymdNow)) return null;
  const day = Number(ymdNow.slice(8, 10));
  const bal = balanceOf(data, snap);
  if (bal.balance === null) return null;
  let total = 0;
  const names = [];
  const money = data && data.money;
  if (money && Array.isArray(money.balances) && money.balances.length) {
    (Array.isArray(money.fixed) ? money.fixed : []).forEach((f) => {
      if (f && toNum(f.day) === day && toNum(f.amount) > 0) { total += toNum(f.amount); names.push(f.name || '固定費'); }
    });
    const settings = (data.core && data.core.settings) || {};
    const dayOf = { smbc: toNum(settings.smbcDay), rakuten: toNum(settings.rakutenDay) };
    const CARD = { smbc: '三井住友カード', rakuten: '楽天カード' };
    const core = data.core || {};
    (Array.isArray(core.statements) ? core.statements : []).forEach((s) => {
      if (s && s.billingMonth === ymOf(ymdNow) && dayOf[s.accountId] === day && toNum(s.amount) > 0) {
        total += toNum(s.amount); names.push(CARD[s.accountId] || 'カード');
      }
    });
  } else if (snap) {
    (Array.isArray(snap.debits) ? snap.debits : []).forEach((d) => {
      if (d && d.date === ymdNow) { total += Number(d.amount) || 0; names.push(d.label || '引落'); }
    });
  }
  if (!(total > 0)) return null;
  return { targetYmd: ymdNow, total, balance: bal.balance, names, short: bal.balance < total };
}

/* ===== サブスクの更新14日前（#33） =====
   アプリ内の固定費（money.fixed）は毎月払いのみで、年額の更新日は持っていない。
   そのため更新日はスナップショットの subs（{ name, renewDate, amount }）で受け取る。
   fixed に renewDate が入っているものがあれば、それも対象にする。 */
function subscriptionWarnings(data, snap, ymdNow) {
  const out = [];
  if (!isYmd(ymdNow)) return out;
  const subs = [];
  if (snap && Array.isArray(snap.subs)) subs.push.apply(subs, snap.subs);
  const fixed = data && data.money && Array.isArray(data.money.fixed) ? data.money.fixed : [];
  fixed.forEach((f) => {
    if (f && isYmd(f.renewDate)) subs.push({ name: f.name || '固定費', renewDate: f.renewDate, amount: toNum(f.amount) });
  });
  subs.forEach((s) => {
    if (diffDays(ymdNow, s.renewDate) !== 14) return;
    out.push({
      key: 'srv-sub14-' + hash53(s.name + '|' + s.renewDate).slice(0, 10),
      id: 'sub14-' + s.renewDate + '-' + hash53(s.name).slice(0, 6),
      title: '🔁 サブスク更新が近づいています',
      body: s.name + ' の更新日（' + ymdLabel(s.renewDate) + '）まであと14日です' +
        (s.amount > 0 ? '（¥' + yenText(s.amount) + '）' : '') + '。続けるか確認してね',
      name: s.name, renewDate: s.renewDate, amount: s.amount,
    });
  });
  return out;
}

/* ===== 自動分類ルール（#36） =====
   既定値はアプリ本体（js/kakeibo.js の KB_GUESS）と同じ考え方を、部分一致の
   キーワード列に置き換えたもの。サーバーの設定doc（RULES_DOC）に rules があれば
   そちらを使う。/api/config で配信し、アプリは Vercel 版のときだけ優先する。 */
const KB_CATS = ['food', 'daily', 'move', 'study', 'wear', 'fun', 'friend', 'health', 'phone', 'other'];
const DEFAULT_RULES = [
  { cat: 'move', keywords: ['JR', '阪急', '阪神', '神戸電鉄', '神鉄', '北神', '市営', '地下鉄', 'バス', 'タクシー', 'Suica', 'ICOCA', 'PASMO', 'PiTaPa', '交通', '駐輪', '定期'] },
  { cat: 'food', keywords: ['セブン', 'ローソン', 'ファミリーマート', 'ファミマ', 'ミニストップ', 'デイリー', 'イオン', 'ライフ', 'コープ', 'マックスバリュ', '業務スーパー', 'スーパー', 'マクドナルド', 'マック', 'すき家', '吉野家', '松屋', 'スタバ', 'スターバックス', 'ドトール', 'タリーズ', 'コメダ', 'ケンタッキー', 'モス', 'サイゼ', 'ガスト', '丸亀', '弁当', 'パン', 'カフェ', '食堂', 'レストラン', 'デリフランス'] },
  { cat: 'daily', keywords: ['マツモトキヨシ', 'マツキヨ', 'ウエルシア', 'スギ薬局', 'ココカラ', 'ダイソー', 'セリア', 'キャンドゥ', 'ニトリ', '無印', 'ロフト', 'ハンズ', 'ドラッグ'] },
  { cat: 'study', keywords: ['書店', '紀伊國屋', 'ジュンク', '丸善', 'ブックオフ', '文具', '大学生協', '生協', 'Kindle', 'ブックス'] },
  { cat: 'wear', keywords: ['ユニクロ', 'UNIQLO', 'GU', 'ZARA', 'H&M', 'しまむら', '美容', 'ヘア', 'コスメ', '化粧'] },
  { cat: 'fun', keywords: ['Netflix', 'Spotify', 'YouTube', 'Apple Music', 'Amazon Prime', 'ゲーム', '映画', 'カラオケ', 'Nintendo', 'PlayStation', 'Steam'] },
  { cat: 'health', keywords: ['病院', 'クリニック', '医院', '歯科', '薬局'] },
  { cat: 'phone', keywords: ['ドコモ', 'docomo', 'KDDI', 'ソフトバンク', 'SoftBank', '楽天モバイル', 'ahamo', 'povo', 'LINEMO', 'UQ', 'ワイモバイル'] },
];
function validRules(rules) {
  if (!Array.isArray(rules)) return null;
  const out = [];
  for (const r of rules.slice(0, 100)) {
    if (!r || typeof r !== 'object' || KB_CATS.indexOf(r.cat) < 0 || !Array.isArray(r.keywords)) continue;
    const kws = r.keywords.slice(0, 200).map((k) => capStr(k, 40)).filter(Boolean);
    if (kws.length) out.push({ cat: r.cat, keywords: kws });
  }
  return out;
}
async function loadRules() {
  try {
    const doc = await fsGetDoc(RULES_DOC);
    if (doc && doc.rules) {
      let parsed = doc.rules;
      if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch (e) { parsed = null; } }
      const ok = validRules(parsed);
      if (ok && ok.length) return { rules: ok, source: 'server', updatedAt: doc.updatedAt || '' };
    }
  } catch (e) { /* 読めなければ既定値 */ }
  return { rules: DEFAULT_RULES, source: 'default', updatedAt: '' };
}
async function saveRules(rules) {
  const ok = validRules(rules);
  if (!ok) return null;
  await fsSetDoc(RULES_DOC, { rules: JSON.stringify(ok), updatedAt: new Date().toISOString() });
  return ok;
}
function classifyTitle(title, rules) {
  const t = String(title || '').toLowerCase();
  if (!t) return 'other';
  for (const r of (rules || DEFAULT_RULES)) {
    for (const kw of r.keywords) {
      if (kw && t.indexOf(String(kw).toLowerCase()) >= 0) return r.cat;
    }
  }
  return 'other';
}

/* ===== 世代スナップショット（#40）と差分（#79） =====
   同期データまるごとは大きい（かたまり分割＋国試などの大物）ため、世代に残すのは
   moneysnap 相当（残高＋明細の指紋）と予定の要約（件数＋指紋）だけにする。
   直近12世代を SNAPSHOTS_DOC の gens（JSON文字列）に保持する。 */
const GEN_MAX = 12;
const GEN_TXKEYS_MAX = 300;
function txKeyHash(tx) { return hash53(tx.date + '|' + tx.amount + '|' + tx.io + '|' + tx.title); }
function generationOf(data, snap, nowMs) {
  const bal = balanceOf(data, snap);
  const txs = transactionsOf(data, snap);
  const plan = (data && data.plan) || {};
  const list = (k) => (Array.isArray(plan[k]) ? plan[k].filter((x) => x && typeof x === 'object') : []);
  const planFinger = list('events').map((e) => e.id + ':' + e.date + ':' + e.title)
    .concat(list('tasks').map((t) => t.id + ':' + t.due + ':' + t.title + ':' + (t.done ? 1 : 0)))
    .concat(list('exams').map((x) => x.id + ':' + x.date + ':' + x.title)).join('|');
  const txKeys = Array.from(new Set(txs.list.map(txKeyHash))).sort().slice(-GEN_TXKEYS_MAX);
  return {
    at: new Date(nowMs).toISOString(),
    ymd: '',   // 呼び出し側で ymdJst を入れる
    balance: bal.balance,
    balanceSource: bal.source,
    txCount: txs.list.length,
    txSource: txs.source,
    txKeys,
    planCounts: { events: list('events').length, tasks: list('tasks').length, exams: list('exams').length },
    planHash: hash53(planFinger),
  };
}
async function loadGenerations() {
  try {
    const doc = await fsGetDoc(SNAPSHOTS_DOC);
    if (!doc || !doc.gens) return [];
    const arr = typeof doc.gens === 'string' ? JSON.parse(doc.gens) : doc.gens;
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
async function saveGenerations(gens) {
  const keep = (gens || []).slice(-GEN_MAX);
  await fsSetDoc(SNAPSHOTS_DOC, { gens: JSON.stringify(keep), updatedAt: new Date().toISOString() });
  return keep;
}
/* 今日のぶんがまだ無ければ1世代足す。戻り値 { added, gen } */
async function takeGenerationIfNewDay(data, snap, ymdNow, nowMs) {
  const gens = await loadGenerations();
  const last = gens[gens.length - 1];
  if (last && last.ymd === ymdNow) return { added: false, gen: last };
  const gen = generationOf(data, snap, nowMs);
  gen.ymd = ymdNow;
  gens.push(gen);
  await saveGenerations(gens);
  return { added: true, gen };
}
function diffGenerations(gens) {
  if (!Array.isArray(gens) || gens.length < 2) {
    return { enough: false, note: '世代が2つ以上たまると差分を出せます', generations: (gens || []).length };
  }
  const prev = gens[gens.length - 2], cur = gens[gens.length - 1];
  const prevKeys = new Set(prev.txKeys || []), curKeys = new Set(cur.txKeys || []);
  let added = 0, removed = 0;
  curKeys.forEach((k) => { if (!prevKeys.has(k)) added++; });
  prevKeys.forEach((k) => { if (!curKeys.has(k)) removed++; });
  return {
    enough: true,
    from: { at: prev.at, ymd: prev.ymd },
    to: { at: cur.at, ymd: cur.ymd },
    balance: { before: prev.balance, after: cur.balance, delta: (prev.balance === null || cur.balance === null) ? null : cur.balance - prev.balance },
    transactions: { before: prev.txCount, after: cur.txCount, added, removed },
    plan: {
      changed: prev.planHash !== cur.planHash,
      countsBefore: prev.planCounts || {},
      countsAfter: cur.planCounts || {},
    },
  };
}

module.exports = {
  toNum,
  normalizeTx, normalizeSnap, loadMoneySnap, saveMoneySnap,
  transactionsOf, balanceOf,
  salaryPatterns, isSalaryTx, salaryCandidates,
  incomeSummary, monthSummary, KB_CAT_LABELS,
  debitMorningCheck, subscriptionWarnings,
  KB_CATS, DEFAULT_RULES, loadRules, saveRules, classifyTitle,
  generationOf, loadGenerations, saveGenerations, takeGenerationIfNewDay, diffGenerations,
};
