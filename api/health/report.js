/* 健康診断の結果 PDF の保管と要約（#188）
   使い方:
     POST /api/health/report  { pdfBase64 } … PDF から文章を取り出し（/api/pdf と同じ抽出）、
                                              AI で要約して Firestore に保存する
                                              { ok, source:'ai'|'none', pages, chars, summary, saved }
     GET  /api/health/report  … 保存済みの要約（新しい順・最大20件）
   - 保存先は「部屋ID__health_v1」の reports（JSON文字列の配列・古い順）。
   - AI が使えないときは summary を空にして source:'none' で返す（要約があるふりはしない）。
     その場合も、取り出した文章のページ数・文字数だけは返す。保存はしない。
   - PDF の上限は /api/pdf と同じ（デコード後4MBまで）。 */
'use strict';
const { sendJson, readBody, checkAppKey, fsGetDoc, fsSetDoc, HEALTH_DOC } = require('../_fb');
const AI = require('../_ai');
const { extractPdfText } = require('../pdf');

const MAX_REPORTS = 20;
const SUMMARY_INPUT = 12000;

async function loadReports() {
  try {
    const doc = await fsGetDoc(HEALTH_DOC);
    if (!doc || !doc.reports) return [];
    const arr = JSON.parse(doc.reports);
    return Array.isArray(arr) ? arr.filter((x) => x && typeof x === 'object') : [];
  } catch (e) { return []; }
}

const PROMPT_HEAD = [
  '次の健康診断の結果を、日本語で要約してください。',
  '「主な結果」「基準から外れている項目」「次に気をつけること」の3つの見出しで、箇条書きにしてください。',
  '数値と単位は正確に残してください。診断や治療の判断はしないでください。',
  '',
].join('\n');

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    if (req.method === 'GET') {
      const reports = await loadReports();
      return sendJson(res, 200, { ok: true, reports: reports.slice(-MAX_REPORTS).reverse() });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });
    const body = await readBody(req);
    const b64 = typeof body.pdfBase64 === 'string' ? body.pdfBase64 : (typeof body.base64 === 'string' ? body.base64 : '');
    const ex = await extractPdfText(b64);
    if (!ex.ok) return sendJson(res, ex.status || 500, { error: ex.error });
    if (!ex.text || !ex.text.trim()) {
      return sendJson(res, 422, { error: 'PDFから文章を取り出せませんでした（画像だけのPDFかもしれません）', pages: ex.pages });
    }
    const r = await AI.generateText(PROMPT_HEAD + ex.text.slice(0, SUMMARY_INPUT), { task: 'light' });
    if (!r.ok) {
      return sendJson(res, 200, { ok: true, source: 'none', reason: r.reason || '', pages: ex.pages, chars: ex.chars, summary: '', saved: false });
    }
    const entry = { at: new Date().toISOString(), pages: ex.pages, chars: ex.chars, summary: r.text.slice(0, 4000), model: r.model || '' };
    const reports = await loadReports();
    reports.push(entry);
    while (reports.length > MAX_REPORTS) reports.shift();
    await fsSetDoc(HEALTH_DOC, { reports: JSON.stringify(reports), updatedAt: new Date().toISOString() });
    return sendJson(res, 200, { ok: true, source: 'ai', pages: ex.pages, chars: ex.chars, summary: entry.summary, saved: true });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.loadReports = loadReports;
