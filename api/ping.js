/* 疎通確認用 */
'use strict';
const { sendJson } = require('./_fb');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  sendJson(res, 200, {
    ok: true,
    service: 'kurashi-vercel',
    time: new Date().toISOString(),
    geminiServerKey: !!process.env.GEMINI_API_KEY,
    pushSenderReady: !!process.env.FIREBASE_SERVICE_ACCOUNT,
  });
};
