/* ゲーム道場のペットの状態判定（#153）
   使い方:
     POST /api/game/pet  { key, name? } … ペットを登録（初回）し、会いに来たことを記録して状態を返す
     GET  /api/game/pet?key=<id>        … 状態だけを見る（記録は更新しない）
   状態はサーバー側で計算する（端末を閉じていても時間が進む）:
     - 成長段階は「生まれてからの日数」で決まる（たまご→あかちゃん→こども→わかば→おとな→ベテラン）。
     - 機嫌は「最後に会ってからの日数」で決まる（0日:げんき、1日:ふつう、2日:さみしい、3日以上:すねてる）。
   保存先は「部屋ID__game_v1」の pets（JSON文字列の { key: { name, bornAt, lastSeenAt, touches } }）。 */
'use strict';
const { sendJson, readBody, checkAppKey } = require('../_fb');
const { loadGameField, saveGameField } = require('../_hub');

const DAY_MS = 24 * 60 * 60 * 1000;
const STAGES = [
  { days: 30, name: 'ベテラン' },
  { days: 14, name: 'おとな' },
  { days: 7, name: 'わかば' },
  { days: 3, name: 'こども' },
  { days: 1, name: 'あかちゃん' },
  { days: 0, name: 'たまご' },
];
function stageOf(ageDays) {
  for (const s of STAGES) if (ageDays >= s.days) return s.name;
  return 'たまご';
}
function moodOf(sinceDays) {
  if (sinceDays <= 0) return 'げんき';
  if (sinceDays === 1) return 'ふつう';
  if (sinceDays === 2) return 'さみしい';
  return 'すねてる';
}
function viewOf(key, pet, nowMs) {
  const born = Date.parse(pet.bornAt) || nowMs;
  const seen = Date.parse(pet.lastSeenAt) || nowMs;
  const ageDays = Math.max(0, Math.floor((nowMs - born) / DAY_MS));
  const sinceDays = Math.max(0, Math.floor((nowMs - seen) / DAY_MS));
  return {
    key, name: pet.name || 'ペット',
    stage: stageOf(ageDays), mood: moodOf(sinceDays),
    ageDays, sinceDays, touches: Number(pet.touches) || 0,
    bornAt: pet.bornAt, lastSeenAt: pet.lastSeenAt,
  };
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const raw = await loadGameField('pets', {});
    const pets = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    if (req.method === 'GET') {
      const q = new URL(req.url || '/', 'http://localhost').searchParams;
      const key = String(q.get('key') || '').slice(0, 40);
      if (!key || !pets[key]) return sendJson(res, 404, { error: 'not found' });
      return sendJson(res, 200, { ok: true, pet: viewOf(key, pets[key], Date.now()) });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });
    const body = await readBody(req);
    const key = String((body && body.key) || '').slice(0, 40);
    if (!key) return sendJson(res, 400, { error: 'key が必要です' });
    const now = Date.now();
    let pet = pets[key];
    if (!pet) {
      pet = { name: String((body && body.name) || 'ペット').slice(0, 20), bornAt: new Date(now).toISOString(), lastSeenAt: new Date(now).toISOString(), touches: 0 };
      pets[key] = pet;
    }
    if (body && body.name) pet.name = String(body.name).slice(0, 20);
    pet.touches = (Number(pet.touches) || 0) + 1;
    pet.lastSeenAt = new Date(now).toISOString();
    await saveGameField('pets', pets);
    return sendJson(res, 200, { ok: true, pet: viewOf(key, pet, now) });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.stageOf = stageOf;
module.exports.moodOf = moodOf;
module.exports.viewOf = viewOf;
