/* ゲーム道場のスコア登録とランキング材料（#152）
   使い方:
     POST /api/game/score  { game, name, score } … 1件登録する
     GET  /api/game/score?game=<id>              … そのゲームの上位20件
     GET  /api/game/score                        … ゲームごとの件数と最高スコア
   不正対策（できる範囲）:
     - game は英数字・_・- の40文字まで、name は20文字まで、score は 0〜10億 の有限数だけを受ける。
     - 同じ game＋name の登録は1分に30件まで（この関数インスタンスの中だけの数え方なので、
       完全な制限ではない。あくまで「あからさまな連投」を止めるためのもの）。
   保存先は「部屋ID__game_v1」の scores（JSON文字列の配列、最大500件）。 */
'use strict';
const { sendJson, readBody, checkAppKey } = require('../_fb');
const { loadGameField, saveGameField } = require('../_hub');

const MAX_SCORES = 500;
const SCORE_MAX = 1000000000;
const RATE_MAX = 30;
const GAME_RE = /^[A-Za-z0-9_-]{1,40}$/;
const hits = new Map();   // game|name -> [時刻ms]

function rateOk(key, now) {
  const arr = (hits.get(key) || []).filter((t) => now - t < 60 * 1000);
  if (arr.length >= RATE_MAX) { hits.set(key, arr); return false; }
  arr.push(now);
  hits.set(key, arr);
  return true;
}
function normalizeScore(body) {
  const b = body && typeof body === 'object' ? body : {};
  const game = String(b.game || '');
  const name = String(b.name == null ? '' : b.name).slice(0, 20);
  const score = Number(b.score);
  if (!GAME_RE.test(game)) return null;
  if (!name) return null;
  if (!Number.isFinite(score) || score < 0 || score > SCORE_MAX) return null;
  return { game, name, score: Math.floor(score), at: new Date().toISOString() };
}
function topOf(scores, game, n) {
  return (scores || []).filter((s) => s && s.game === game)
    .slice().sort((a, b) => (b.score - a.score) || (String(a.at) < String(b.at) ? -1 : 1))
    .slice(0, n || 20);
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const scores = await loadGameField('scores', []);
    const arr = Array.isArray(scores) ? scores : [];
    if (req.method === 'GET') {
      const q = new URL(req.url || '/', 'http://localhost').searchParams;
      const game = String(q.get('game') || '');
      if (game) return sendJson(res, 200, { ok: true, game, top: topOf(arr, game, 20) });
      const games = {};
      for (const s of arr) {
        if (!s || !s.game) continue;
        const g = games[s.game] || (games[s.game] = { game: s.game, count: 0, best: null });
        g.count++;
        if (!g.best || s.score > g.best.score) g.best = { name: s.name, score: s.score, at: s.at };
      }
      return sendJson(res, 200, { ok: true, games: Object.values(games) });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });
    const rec = normalizeScore(await readBody(req));
    if (!rec) return sendJson(res, 400, { error: 'game（英数字40字まで）・name（20字まで）・score（0〜10億）が必要です' });
    if (!rateOk(rec.game + '|' + rec.name, Date.now())) {
      return sendJson(res, 429, { error: '登録が速すぎます。少し待ってください' });
    }
    arr.push(rec);
    while (arr.length > MAX_SCORES) arr.shift();
    await saveGameField('scores', arr);
    return sendJson(res, 200, { ok: true, record: rec, rank: topOf(arr, rec.game, 20).findIndex((s) => s === rec || (s.name === rec.name && s.score === rec.score && s.at === rec.at)) + 1 });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.normalizeScore = normalizeScore;
module.exports.topOf = topOf;
