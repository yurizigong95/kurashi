/* Gemini のモデル自動解決（#23 / #25）
   - Gemini のモデル一覧を取得し、軽い用途（Flash 系）の候補列と重い用途（Pro / Thinking 系）の1件を決めます。
   - 結果はこの関数インスタンスのメモリに最大24時間、Firestore の「部屋ID__config_v1」にも保存します。
   - 鍵が無い・一覧が取れないときは例外を投げずにフォールバック（gemini-3.8-flash）を返します。
     このプロジェクトの鍵では gemini-3.8-flash が生成成功済みで、gemini-2.5-flash は新規ユーザー不可で404になる実績があるためです。 */
'use strict';
const { CONFIG_DOC, fsGetDoc, fsSetDoc } = require('./_fb');

const LIST_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const TTL = 24 * 60 * 60 * 1000;
const FALLBACK_MODEL = 'gemini-3.8-flash';

let memCache = null; // { light, heavy, model, updatedAt, source }

function fallback() {
  return {
    light: [FALLBACK_MODEL], heavy: FALLBACK_MODEL, model: FALLBACK_MODEL,
    updatedAt: new Date().toISOString(), source: 'fallback',
  };
}

/* gemini-<major>.<minor> を数値化。minor が無いものは hasMinor=false で後ろへ回す */
function versionOf(id) {
  const m = /^gemini-(\d+)(?:\.(\d+))?/.exec(id);
  if (!m) return { hasMinor: false, major: -1, minor: -1 };
  if (m[2] === undefined) return { hasMinor: false, major: Number(m[1]), minor: -1 };
  return { hasMinor: true, major: Number(m[1]), minor: Number(m[2]) };
}
function isPreview(id) { return /preview|exp/.test(id); }

/* 並び順: バージョンの新しい順 → 正式版を先 → lite は後ろ → id 順 */
function compareIds(a, b) {
  const va = versionOf(a), vb = versionOf(b);
  if (va.hasMinor !== vb.hasMinor) return va.hasMinor ? -1 : 1;
  if (va.major !== vb.major) return vb.major - va.major;
  if (va.minor !== vb.minor) return vb.minor - va.minor;
  const pa = isPreview(a), pb = isPreview(b);
  if (pa !== pb) return pa ? 1 : -1;
  const la = a.includes('lite'), lb = b.includes('lite');
  if (la !== lb) return la ? 1 : -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function pickFromList(models) {
  const ids = [];
  for (const m of models || []) {
    const name = (m && m.name) || '';
    const methods = (m && m.supportedGenerationMethods) || [];
    if (!name.startsWith('models/gemini-')) continue;
    if (!methods.includes('generateContent')) continue;
    ids.push(name.slice('models/'.length));
  }
  const light = ids
    .filter((id) => id.includes('flash') && !/image|tts|audio/.test(id))
    .sort(compareIds);
  const heavyList = ids.filter((id) => /pro|thinking/.test(id)).sort(compareIds);
  if (!light.length) return null;
  return { light, heavy: heavyList[0] || light[0] };
}

async function fetchList(key) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(LIST_URL + '?key=' + encodeURIComponent(key) + '&pageSize=1000', { signal: ac.signal });
    if (!r.ok) throw new Error('models list failed: ' + r.status);
    const j = await r.json();
    return j.models || [];
  } finally {
    clearTimeout(timer);
  }
}

function fresh(updatedAt) {
  const t = Date.parse(updatedAt || '');
  return Number.isFinite(t) && Date.now() - t < TTL;
}

async function resolveModels(key, force) {
  if (!key) return fallback();

  // メモリのキャッシュ
  if (!force && memCache && fresh(memCache.updatedAt)) {
    return Object.assign({}, memCache, { light: memCache.light.slice(), source: 'cache' });
  }

  // Firestore に保存済みの結果
  if (!force) {
    try {
      const doc = await fsGetDoc(CONFIG_DOC);
      if (doc && doc.models && fresh(doc.updatedAt)) {
        const light = JSON.parse(doc.models);
        if (Array.isArray(light) && light.length) {
          const heavy = doc.heavy || light[0];
          memCache = { light, heavy, model: light[0], updatedAt: doc.updatedAt, source: 'firestore' };
          return Object.assign({}, memCache, { light: light.slice() });
        }
      }
    } catch (e) { /* 読めなければ一覧取得へ */ }
  }

  // 一覧を取得して解決
  let picked = null;
  try { picked = pickFromList(await fetchList(key)); } catch (e) { picked = null; }
  if (!picked) return fallback();

  const updatedAt = new Date().toISOString();
  memCache = { light: picked.light, heavy: picked.heavy, model: picked.light[0], updatedAt, source: 'live' };
  try {
    await fsSetDoc(CONFIG_DOC, { models: JSON.stringify(picked.light), heavy: picked.heavy, updatedAt });
  } catch (e) { /* 保存失敗は無視 */ }
  return Object.assign({}, memCache, { light: memCache.light.slice() });
}

/* 試す順番。明示指定 → 重い用途なら heavy → light の順（重複は除く） */
function candidateOrder(resolved, task, explicitModel) {
  const light = (resolved && resolved.light) || [FALLBACK_MODEL];
  if (explicitModel) return [explicitModel].concat(light.filter((id) => id !== explicitModel));
  if (task === 'heavy') {
    const heavy = (resolved && resolved.heavy) || light[0];
    return [heavy].concat(light.filter((id) => id !== heavy));
  }
  return light;
}

module.exports = { resolveModels, candidateOrder, FALLBACK_MODEL };
