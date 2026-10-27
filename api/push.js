/* プッシュ系の統合ディスパッチャ（Vercel Hobby の関数数上限対策）
   実際の処理は api/push/_*.js にあり、この関数は ?op= で振り分けるだけ。
   /api/push/:op は vercel.json の rewrites で /api/push?op=:op に解決される。
   ?op= が無いときは、URL の末尾セグメント（register / remove / send / jobs / cron）でも判定する。 */
'use strict';
const { sendJson } = require('./_fb');

const OPS = {
  register: () => require('./push/_register'),
  remove: () => require('./push/_remove'),
  send: () => require('./push/_send'),
  jobs: () => require('./push/_jobs'),
  cron: () => require('./push/_cron'),
};

module.exports = async function handler(req, res) {
  let op = '';
  try {
    const u = new URL(req.url || '/', 'http://localhost');
    op = u.searchParams.get('op') || '';
    if (!op) {
      const seg = u.pathname.split('/').filter(Boolean);
      const last = seg[seg.length - 1] || '';
      if (last && last !== 'push') op = last;
    }
  } catch (e) { /* op は空のまま */ }
  const load = OPS[op];
  if (!load) return sendJson(res, 404, { ok: false, error: 'unknown op', op });
  return load()(req, res);
};
