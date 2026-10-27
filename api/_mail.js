/* メール送信の共通基盤（#163）
   - サーバー（Vercel）から直接メールを送る手段は無いので、既存の GAS のメールブリッジが
     環境変数で渡されたときだけ、そこへ中継する。
       GAS_MAIL_URL    … GAS の Web アプリの URL（doPost で { secret, to, subject, body } を受ける想定）
       GAS_MAIL_SECRET … そのブリッジとの合言葉
   - ブリッジが無い・送れなかったときは、送信箱（OUTBOX_DOC）に貯めて { ok:false, queued:true } を返す。
     「送ったこと」には絶対にしない。
   - POST /api/mail（api/mail.js）と、cron の週次レポート（#140）が使う。 */
'use strict';
const { enqueueOutbox } = require('./_hub');

const TIMEOUT_MS = 10000;

function bridge() {
  const url = process.env.GAS_MAIL_URL || '';
  const secret = process.env.GAS_MAIL_SECRET || '';
  return url ? { url, secret } : null;
}

/* mail = { to?, subject, body, kind? }。戻り値 { ok, via:'gas'|'outbox'|null, queued?, reason? } */
async function sendMail(mail) {
  const m = mail && typeof mail === 'object' ? mail : {};
  const entry = {
    at: new Date().toISOString(),
    to: String(m.to || ''),
    subject: String(m.subject || '').slice(0, 200),
    body: String(m.body || '').slice(0, 8000),
    kind: String(m.kind || ''),
  };
  const b = bridge();
  if (!b) {
    const q = await enqueueOutbox(entry);
    return { ok: false, via: 'outbox', queued: q.queued, reason: 'NO_BRIDGE' };
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(b.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: b.secret, to: entry.to, subject: entry.subject, body: entry.body, kind: entry.kind }),
      signal: ac.signal,
    });
    if (r.ok) return { ok: true, via: 'gas' };
    const q = await enqueueOutbox(entry);
    return { ok: false, via: 'outbox', queued: q.queued, reason: 'HTTP_' + r.status };
  } catch (e) {
    const q = await enqueueOutbox(entry);
    return { ok: false, via: 'outbox', queued: q.queued, reason: 'FETCH_ERROR' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { sendMail, mailBridgeReady: () => !!bridge() };
