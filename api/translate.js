/* 翻訳の中継（#68）
   使い方:
     POST /api/translate  { text, to? } … { ok, via:'deepl'|'gemini', text }
       to は 'ja'（既定）・'en' などの言語コード、または DeepL のコード（'EN-US' など）。
   - 環境変数 DEEPL_API_KEY があれば DeepL を使う（末尾が ':fx' のキーは無料版のホスト）。
     鍵はサーバーだけに置き、端末には出さない。
   - 無ければ Gemini（サーバーの鍵）で翻訳する。どちらも使えなければ { ok:false, reason }。 */
'use strict';
const { sendJson, readBody, checkAppKey } = require('./_fb');
const AI = require('./_ai');

const MAX_TEXT = 5000;
const LANG_NAME = { ja: '日本語', en: '英語', 'en-us': '英語', 'en-gb': '英語', ko: '韓国語', zh: '中国語', fr: 'フランス語', de: 'ドイツ語', es: 'スペイン語' };

function deeplTarget(to) {
  const t = String(to || 'ja').toUpperCase();
  if (t === 'EN') return 'EN-US';
  if (t === 'JA') return 'JA';
  return t;
}
async function viaDeepL(text, to, key) {
  const host = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  const form = new URLSearchParams();
  form.set('text', text);
  form.set('target_lang', deeplTarget(to));
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15000);
  try {
    const r = await fetch(host + '/v2/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'DeepL-Auth-Key ' + key },
      body: form.toString(),
      signal: ac.signal,
    });
    if (!r.ok) return { ok: false, reason: 'HTTP_' + r.status };
    const j = await r.json();
    const out = j && Array.isArray(j.translations) && j.translations[0] ? String(j.translations[0].text || '') : '';
    return out ? { ok: true, via: 'deepl', text: out } : { ok: false, reason: 'EMPTY' };
  } catch (e) {
    return { ok: false, reason: 'FETCH_ERROR' };
  } finally {
    clearTimeout(timer);
  }
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const body = await readBody(req);
    const text = String((body && body.text) || '');
    if (!text.trim()) return sendJson(res, 400, { error: 'text が必要です' });
    if (text.length > MAX_TEXT) return sendJson(res, 413, { error: '文章が長すぎます（' + MAX_TEXT + '字まで）' });
    const to = String((body && body.to) || 'ja').toLowerCase();
    const dkey = process.env.DEEPL_API_KEY || '';
    if (dkey) {
      const r = await viaDeepL(text, to, dkey);
      if (r.ok) return sendJson(res, 200, { ok: true, via: 'deepl', text: r.text });
      /* DeepL が使えなかったときは Gemini に切り替えて、理由も添える */
      const g = await AI.generateText('次の文章を' + (LANG_NAME[to] || to) + 'に翻訳してください。翻訳文だけを返してください。\n\n' + text, { task: 'light' });
      if (g.ok) return sendJson(res, 200, { ok: true, via: 'gemini', text: g.text, model: g.model, deeplReason: r.reason });
      return sendJson(res, 200, { ok: false, reason: r.reason || g.reason || '' });
    }
    const g = await AI.generateText('次の文章を' + (LANG_NAME[to] || to) + 'に翻訳してください。翻訳文だけを返してください。\n\n' + text, { task: 'light' });
    if (!g.ok) return sendJson(res, 200, { ok: false, reason: g.reason || '' });
    return sendJson(res, 200, { ok: true, via: 'gemini', text: g.text, model: g.model });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.deeplTarget = deeplTarget;
