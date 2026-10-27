/* fetch プロキシ（#14）
   使い方（アプリ側から）:
     GET /api/fetch?url=https://example.com/  … 本文をテキストで返す
   応答: { ok, status, contentType, url(最終URL), body, truncated }
   - http: / https: のみ。localhost 系のホスト名と、プライベート・ループバック・リンクローカル・
     予約帯域の IP リテラル（IPv4 / IPv6）は 400 { error:'blocked host' } で断ります。
   - リダイレクトは redirect:'manual' で自前に最大3回まで追い、行き先ごとに同じ検証をします。
   - 注意: 検証するのは URL に書かれたホスト名と IP リテラルだけです。DNS 解決後の IP までは
     検証しません（内部 IP を指す公開ドメインや DNS リバインディングは防げません）。 */
'use strict';
const net = require('net');
const { sendJson, checkAppKey } = require('./_fb');

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10000;
const MAX_BYTES = 200 * 1024;

/* --- IPv4 --- */
function ipv4ToInt(ip) {
  const p = ip.split('.').map(Number);
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}
const V4_BLOCKS = [
  ['0.0.0.0', 8],        // 「この」ネットワーク
  ['10.0.0.0', 8],       // プライベート
  ['100.64.0.0', 10],    // キャリアグレード NAT
  ['127.0.0.0', 8],      // ループバック
  ['169.254.0.0', 16],   // リンクローカル（クラウドのメタデータ含む）
  ['172.16.0.0', 12],    // プライベート
  ['192.0.0.0', 24],     // IETF 予約
  ['192.168.0.0', 16],   // プライベート
  ['198.18.0.0', 15],    // ベンチマーク用
  ['224.0.0.0', 4],      // マルチキャスト
  ['240.0.0.0', 4],      // 予約（255.255.255.255 含む）
].map(([base, bits]) => ({ base: ipv4ToInt(base), mask: bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0 }));
function isBlockedV4(ip) {
  const n = ipv4ToInt(ip);
  return V4_BLOCKS.some((b) => ((n & b.mask) >>> 0) === b.base);
}

/* --- IPv6 --- */
/* 8個の16ビット値に展開する（:: の省略と末尾の IPv4 表記に対応） */
function expandV6(ip) {
  let s = ip.toLowerCase();
  const pct = s.indexOf('%');
  if (pct >= 0) s = s.slice(0, pct);
  let tail = [];
  const m = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (m) {
    const n = ipv4ToInt(m[1]);
    tail = [(n >>> 16) & 0xffff, n & 0xffff];
    s = s.slice(0, -m[1].length);
    if (s.endsWith(':') && !s.endsWith('::')) s = s.slice(0, -1);
  }
  const parse = (part) => (part ? part.split(':').map((h) => parseInt(h, 16)) : []);
  let groups;
  if (s.includes('::')) {
    const [a, b] = s.split('::');
    const left = parse(a), right = parse(b);
    const fill = 8 - tail.length - left.length - right.length;
    groups = left.concat(new Array(Math.max(fill, 0)).fill(0), right);
  } else {
    groups = parse(s);
  }
  return groups.concat(tail);
}
function isBlockedV6(ip) {
  const g = expandV6(ip);
  if (g.length !== 8 || g.some((x) => !Number.isFinite(x))) return true; // 解釈できないものは断る
  const allZero = (from, to) => g.slice(from, to).every((x) => x === 0);
  if (allZero(0, 8)) return true;                                   // :: 未指定
  if (allZero(0, 7) && g[7] === 1) return true;                     // ::1 ループバック
  if ((g[0] & 0xffc0) === 0xfe80) return true;                      // fe80::/10 リンクローカル
  if ((g[0] & 0xfe00) === 0xfc00) return true;                      // fc00::/7 ユニークローカル
  if ((g[0] & 0xff00) === 0xff00) return true;                      // ff00::/8 マルチキャスト
  /* IPv4 埋め込み（::ffff:a.b.c.d / ::a.b.c.d / 64:ff9b::a.b.c.d）は中の IPv4 で判定 */
  const embedded = (allZero(0, 5) && (g[5] === 0xffff || g[5] === 0))
    || (g[0] === 0x64 && g[1] === 0xff9b && allZero(2, 6));
  if (embedded) {
    const v4 = [g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff].join('.');
    return isBlockedV4(v4);
  }
  return false;
}

/* URL を検証して URL オブジェクトを返す。ダメなら { code, error } を返す */
function checkUrl(raw, base) {
  let u;
  try { u = base ? new URL(raw, base) : new URL(raw); } catch (e) { return { code: 400, error: 'invalid url' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { code: 400, error: 'unsupported protocol' };
  let host = u.hostname.toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  host = host.replace(/\.+$/, ''); // 末尾のドット（localhost. など）
  if (!host) return { code: 400, error: 'blocked host' };
  if (host === 'localhost' || host.endsWith('.localhost')) return { code: 400, error: 'blocked host' };
  const kind = net.isIP(host);
  if (kind === 4 && isBlockedV4(host)) return { code: 400, error: 'blocked host' };
  if (kind === 6 && isBlockedV6(host)) return { code: 400, error: 'blocked host' };
  /* 数字とドットだけなのに IP として解釈できないもの（進数表記のすり抜け対策）も断る */
  if (kind === 0 && /^[0-9.]+$/.test(host)) return { code: 400, error: 'blocked host' };
  return { url: u };
}

/* 本文を上限まで読む（超えた分は読まずに切る） */
async function readLimited(r) {
  if (!r.body) return { body: '', truncated: false };
  const reader = r.body.getReader();
  const chunks = [];
  let size = 0, truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const buf = Buffer.from(value);
    if (size + buf.length > MAX_BYTES) {
      chunks.push(buf.subarray(0, MAX_BYTES - size));
      size = MAX_BYTES;
      truncated = true;
      try { await reader.cancel(); } catch (e) { /* 無視 */ }
      break;
    }
    chunks.push(buf);
    size += buf.length;
  }
  /* 切った位置が多バイト文字の途中でも TextDecoder が置換文字にするだけで落ちない */
  return { body: new TextDecoder('utf-8').decode(Buffer.concat(chunks)), truncated };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });

  const q = new URL(req.url || '/', 'http://localhost').searchParams;
  const raw = q.get('url') || '';
  if (!raw) return sendJson(res, 400, { error: 'url is required' });

  let checked = checkUrl(raw);
  if (!checked.url) return sendJson(res, checked.code, { error: checked.error });
  let current = checked.url;

  try {
    for (let hop = 0; ; hop++) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
      try {
        const r = await fetch(current.href, {
          method: 'GET',
          redirect: 'manual',
          signal: ac.signal,
          headers: { 'User-Agent': 'kurashi-fetch/1.0' },
        });
        const loc = r.headers.get('location');
        if (r.status >= 300 && r.status < 400 && loc) {
          try { await r.body?.cancel(); } catch (e) { /* 無視 */ }
          if (hop >= MAX_REDIRECTS) return sendJson(res, 502, { error: 'too many redirects' });
          checked = checkUrl(loc, current);
          if (!checked.url) return sendJson(res, checked.code, { error: checked.error });
          current = checked.url;
          continue;
        }
        const { body, truncated } = await readLimited(r);
        return sendJson(res, 200, {
          ok: true,
          status: r.status,
          contentType: r.headers.get('content-type') || '',
          url: current.href,
          body,
          truncated,
        });
      } finally {
        clearTimeout(timer);
      }
    }
  } catch (e) {
    const msg = e && e.name === 'AbortError' ? 'timeout' : String((e && e.message) || e);
    return sendJson(res, 502, { error: msg });
  }
};
