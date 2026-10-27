/* 統合ルーター（Vercel Hobby の関数数上限対策）
   実際の処理は api/_*.js / api/<area>/_*.js にあり、この関数は振り分けだけを行う。
   従来URLは vercel.json の rewrites でここへ解決される:
     単段: /api/log など            → /api/app?name=log
     二段: /api/plan/next など      → /api/app?area=plan&name=next
     /api/health                    → /api/app?name=health（api/_health.js へ）
     /api/health/cycle など         → /api/app?area=health&name=cycle
   存在しない組み合わせは 404 JSON を返す。 */
'use strict';
const { sendJson } = require('./_fb');

/* 単段（api/_<name>.js）。mail / wx はヘルパー（_mail.js / _wx.js）と名前が重なるため、
   ハンドラー本体は _mailapi.js / _wxapi.js に置いてある。 */
const SINGLE = {
  log: () => require('./_log'),
  fetch: () => require('./_fetch'),
  hook: () => require('./_hook'),
  pdf: () => require('./_pdf'),
  ocr: () => require('./_ocr'),
  translate: () => require('./_translate'),
  voice: () => require('./_voice'),
  wx: () => require('./_wxapi'),
  maps: () => require('./_maps'),
  mail: () => require('./_mailapi'),
  search: () => require('./_search'),
  settings: () => require('./_settings'),
  export: () => require('./_export'),
  transfer: () => require('./_transfer'),
  transit: () => require('./_transit'),
  calendar: () => require('./_calendar'),
  health: () => require('./_health'),
};

/* 二段（api/<area>/_<name>.js）。エリアごとに許可する名前を固定する。 */
const AREAS = {
  money: { import: () => require('./money/_import'), rules: () => require('./money/_rules'), summary: () => require('./money/_summary') },
  plan: {
    check: () => require('./plan/_check'), gaps: () => require('./plan/_gaps'), history: () => require('./plan/_history'),
    ics: () => require('./plan/_ics'), lasttrain: () => require('./plan/_lasttrain'), learn: () => require('./plan/_learn'),
    next: () => require('./plan/_next'),
  },
  study: {
    generate: () => require('./study/_generate'), plan: () => require('./study/_plan'), questions: () => require('./study/_questions'),
    summarize: () => require('./study/_summarize'), time: () => require('./study/_time'), transcribe: () => require('./study/_transcribe'),
  },
  game: {
    daily: () => require('./game/_daily'), pet: () => require('./game/_pet'), ranking: () => require('./game/_ranking'),
    record: () => require('./game/_record'), save: () => require('./game/_save'), score: () => require('./game/_score'),
    talk: () => require('./game/_talk'),
  },
  health: { cycle: () => require('./health/_cycle'), report: () => require('./health/_report'), rhythm: () => require('./health/_rhythm') },
  notify: { discord: () => require('./notify/_discord'), line: () => require('./notify/_line') },
  attend: { arrive: () => require('./attend/_arrive') },
  share: { create: () => require('./share/_create'), view: () => require('./share/_view') },
  photo: { hash: () => require('./photo/_hash') },
  sync: { queue: () => require('./sync/_queue') },
};

module.exports = async function handler(req, res) {
  let area = '', name = '';
  try {
    const u = new URL(req.url || '/', 'http://localhost');
    area = u.searchParams.get('area') || '';
    name = u.searchParams.get('name') || '';
    if (!name) {
      /* クエリが無い直接呼び出しの保険: /api/<area>/<name> や /api/<name> の形でも拾う */
      const seg = u.pathname.split('/').filter(Boolean);
      if (seg[0] === 'api' && seg.length >= 3) { area = seg[1]; name = seg[2]; }
      else if (seg[0] === 'api' && seg.length === 2 && seg[1] !== 'app') { name = seg[1]; }
    }
  } catch (e) { /* area / name は空のまま */ }

  let load = null;
  if (area) {
    const table = AREAS[area];
    if (table && Object.prototype.hasOwnProperty.call(table, name)) load = table[name];
  } else if (name && Object.prototype.hasOwnProperty.call(SINGLE, name)) {
    load = SINGLE[name];
  }
  if (!load) return sendJson(res, 404, { ok: false, error: 'route not found', area, name });

  let fn;
  try { fn = load(); } catch (e) {
    console.error('app router: handler load failed', area, name, e && e.message);
    return sendJson(res, 500, { ok: false, error: 'handler load failed', area, name });
  }
  return fn(req, res);
};
