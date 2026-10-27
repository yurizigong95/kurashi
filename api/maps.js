/* 地図・経路 API の中継（#164）
   使い方:
     GET /api/maps?mode=geocode&q=<住所や場所の名前>
       … { ok, results:[{ name, address, lat, lng }] }
     GET /api/maps?mode=route&origin=<出発>&destination=<到着>
       … { ok, routes:[{ summary, distanceText, durationText, steps:[{ instruction, distanceText, durationText }] }] }
   - Google Maps の鍵（環境変数 GOOGLE_MAPS_KEY）はサーバーだけに置き、端末には出さない。
   - 鍵が無ければ 501 { ok:false, code:'NO_KEY' }（中継できないことを正直に返す）。 */
'use strict';
const { sendJson, checkAppKey } = require('./_fb');

const TIMEOUT_MS = 10000;

async function fetchJson(url) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ac.signal });
    const j = await r.json().catch(() => null);
    return { status: r.status, json: j };
  } finally {
    clearTimeout(timer);
  }
}
function stripHtml(s) { return String(s || '').replace(/<[^>]*>/g, ''); }

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  const key = process.env.GOOGLE_MAPS_KEY || '';
  if (!key) return sendJson(res, 501, { ok: false, code: 'NO_KEY', error: 'GOOGLE_MAPS_KEY が未設定です' });
  try {
    const q = new URL(req.url || '/', 'http://localhost').searchParams;
    const mode = q.get('mode') || 'geocode';
    if (mode === 'geocode') {
      const query = String(q.get('q') || '').slice(0, 200);
      if (!query) return sendJson(res, 400, { error: 'q が必要です' });
      const url = 'https://maps.googleapis.com/maps/api/geocode/json?language=ja&address=' +
        encodeURIComponent(query) + '&key=' + encodeURIComponent(key);
      const r = await fetchJson(url);
      if (r.status !== 200 || !r.json) return sendJson(res, 502, { ok: false, error: 'Google Maps に届きませんでした' });
      const results = (Array.isArray(r.json.results) ? r.json.results : []).slice(0, 5).map((x) => ({
        name: String((x.address_components && x.address_components[0] && x.address_components[0].long_name) || ''),
        address: String(x.formatted_address || ''),
        lat: x.geometry && x.geometry.location ? x.geometry.location.lat : null,
        lng: x.geometry && x.geometry.location ? x.geometry.location.lng : null,
      }));
      return sendJson(res, 200, { ok: true, results });
    }
    if (mode === 'route') {
      const origin = String(q.get('origin') || '').slice(0, 200);
      const destination = String(q.get('destination') || '').slice(0, 200);
      if (!origin || !destination) return sendJson(res, 400, { error: 'origin と destination が必要です' });
      const url = 'https://maps.googleapis.com/maps/api/directions/json?language=ja&mode=transit&origin=' +
        encodeURIComponent(origin) + '&destination=' + encodeURIComponent(destination) + '&key=' + encodeURIComponent(key);
      const r = await fetchJson(url);
      if (r.status !== 200 || !r.json) return sendJson(res, 502, { ok: false, error: 'Google Maps に届きませんでした' });
      const routes = (Array.isArray(r.json.routes) ? r.json.routes : []).slice(0, 3).map((rt) => {
        const leg = (Array.isArray(rt.legs) ? rt.legs : [])[0] || {};
        return {
          summary: String(rt.summary || ''),
          distanceText: leg.distance ? leg.distance.text : '',
          durationText: leg.duration ? leg.duration.text : '',
          steps: (Array.isArray(leg.steps) ? leg.steps : []).slice(0, 20).map((s) => ({
            instruction: stripHtml(s.html_instructions || ''),
            distanceText: s.distance ? s.distance.text : '',
            durationText: s.duration ? s.duration.text : '',
          })),
        };
      });
      return sendJson(res, 200, { ok: true, routes });
    }
    return sendJson(res, 400, { error: "mode は 'geocode' か 'route' です" });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
