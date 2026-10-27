/* ゲーム道場のデイリーミッション（#157）
   使い方:
     GET /api/game/daily … { ok, date:'YYYY-MM-DD', missions:[{ id, text, points }] }
   サーバーの日本時間の日付から、決定的に（同じ日は全端末で同じ内容に）3件選ぶ。
   日付が変われば内容も変わる。状態は持たない（判定はサーバーの日付だけ）。 */
'use strict';
const { sendJson } = require('../_fb');
const D = require('../_digest');

const MISSIONS = [
  { id: 'play1', text: 'どれかのゲームで1回あそぶ', points: 10 },
  { id: 'win1', text: '対局で1勝する', points: 30 },
  { id: 'play3', text: '合計3回あそぶ', points: 20 },
  { id: 'record1', text: '対局の記録を1件残す', points: 15 },
  { id: 'score1', text: 'スコアを登録する', points: 15 },
  { id: 'try-new', text: 'いつもと別のゲームを試す', points: 20 },
  { id: 'save1', text: 'セーブを作る', points: 10 },
  { id: 'pet1', text: 'ペットに会いに行く', points: 10 },
  { id: 'win2', text: '対局で2勝する', points: 50 },
  { id: 'play5', text: '合計5回あそぶ', points: 40 },
];

/* 日付文字列から種を作り、重ならないよう3件選ぶ（全端末で同じ結果） */
function missionsForDate(ymd) {
  let seed = 0;
  const h = D.hash53(ymd);
  for (let i = 0; i < h.length; i++) seed = (seed * 31 + h.charCodeAt(i)) >>> 0;
  const pool = MISSIONS.slice();
  const out = [];
  let x = seed || 1;
  while (out.length < 3 && pool.length) {
    x = (x * 1103515245 + 12345) >>> 0;
    out.push(pool.splice(x % pool.length, 1)[0]);
  }
  return out;
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  const ymd = D.ymdJst(Date.now());
  res.setHeader('Cache-Control', 'private, max-age=300');
  return sendJson(res, 200, { ok: true, date: ymd, missions: missionsForDate(ymd) });
}

module.exports = handler;
module.exports.missionsForDate = missionsForDate;
