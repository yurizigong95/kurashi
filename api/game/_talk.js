/* ゲームのキャラクターのセリフ生成（#158）— 生成結果を使い回す
   使い方:
     POST /api/game/talk  { game, char, situation } … { ok, source:'cache'|'ai'|'none', line }
   同じ（game・キャラ・状況）の組み合わせは、一度生成したセリフを台帳から使い回す
   （「部屋ID__gametalk_v1」の lines。最大200件）。AI の利用回数を無駄にしないための仕組み。
   鍵が無いときは { ok:false, source:'none', reason }（セリフがあるふりはしない）。 */
'use strict';
const { sendJson, readBody, checkAppKey, fsGetDoc, fsSetDoc, TALK_DOC } = require('../_fb');
const D = require('../_digest');
const AI = require('../_ai');

const MAX_LINES = 200;

async function loadLines() {
  try {
    const doc = await fsGetDoc(TALK_DOC);
    if (!doc || !doc.lines) return {};
    const o = JSON.parse(doc.lines);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch (e) { return {}; }
}
function pruneLines(map) {
  const list = Object.keys(map || {})
    .map((k) => [k, map[k]])
    .sort((a, b) => String(b[1].at || '') < String(a[1].at || '') ? -1 : 1)
    .slice(0, MAX_LINES);
  const out = {};
  list.forEach((x) => { out[x[0]] = x[1]; });
  return out;
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const body = await readBody(req);
    const game = String((body && body.game) || '').slice(0, 40);
    const char = String((body && body.char) || '').slice(0, 40);
    const situation = String((body && body.situation) || '').slice(0, 200);
    if (!game || !char || !situation) return sendJson(res, 400, { error: 'game・char・situation が必要です' });
    const key = D.hash53(game + '|' + char + '|' + situation);
    const lines = await loadLines();
    if (lines[key] && lines[key].line) {
      return sendJson(res, 200, { ok: true, source: 'cache', line: lines[key].line });
    }
    const prompt = [
      'ゲーム「' + game + '」のキャラクター「' + char + '」のセリフを1つ作ってください。',
      '状況：' + situation,
      '40字以内で、そのキャラクターらしい口調で。セリフだけを返してください（鍵括弧や説明は不要）。',
    ].join('\n');
    const r = await AI.generateText(prompt, { task: 'light' });
    if (!r.ok) return sendJson(res, 200, { ok: false, source: 'none', reason: r.reason || '', line: '' });
    const line = r.text.replace(/^[「『"]|[」』"]$/g, '').slice(0, 120);
    lines[key] = { line, at: new Date().toISOString(), game, char, situation };
    await fsSetDoc(TALK_DOC, { lines: JSON.stringify(pruneLines(lines)), updatedAt: new Date().toISOString() });
    return sendJson(res, 200, { ok: true, source: 'ai', model: r.model, line });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.pruneLines = pruneLines;
