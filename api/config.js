/* アプリ向けの設定配信（#23 / #30）
   使い方（アプリ側から）:
     GET /api/config            … 自動解決したモデルと定型文を返す
     GET /api/config?refresh=1  … モデル一覧を取り直して再解決する
   鍵の優先順位は /api/gemini と同じ（環境変数 GEMINI_API_KEY → ヘッダー x-goog-api-key）。
   鍵が無いときもフォールバックのモデルと定型文は返します（serverKey:false）。
   transit（#51）… サーバーに登録した時刻表 { source:'server', tables, updatedAt }。無ければ { source:'none', tables:null }。
   events（#154）… イベント配布。CONFIG_DOC の events（JSON 文字列の配列）。読めなければ null。
   endpoints（#200）… 秘書APIの目録 [{ path, method, about }]。 */
'use strict';
const { sendJson, fsGetDoc, CONFIG_DOC } = require('./_fb');
const { resolveModels } = require('./_models');
const { publicPrompts } = require('./_prompts');
const { loadRules } = require('./_money');
const { loadTransit } = require('./_transit');

/* 秘書APIの目録（#200） */
const ENDPOINTS = [
  { path: '/api/ping', method: 'GET', about: '死活確認' },
  { path: '/api/config', method: 'GET', about: 'モデル・定型文・時刻表などの設定配信' },
  { path: '/api/gemini', method: 'GET/POST', about: 'Gemini の中継' },
  { path: '/api/pdf', method: 'POST', about: 'PDF の読み取り' },
  { path: '/api/fetch', method: 'GET', about: '外部ページの取得' },
  { path: '/api/hook', method: 'GET/POST', about: '受信箱への受け口' },
  { path: '/api/log', method: 'GET/POST', about: 'ログの記録・閲覧' },
  { path: '/api/transit', method: 'GET/POST', about: '時刻表の登録・取得' },
  { path: '/api/calendar', method: 'GET', about: 'Googleカレンダーの予定' },
  { path: '/api/push/register', method: 'POST', about: '通知端末の登録' },
  { path: '/api/push/remove', method: 'POST', about: '通知端末の解除' },
  { path: '/api/push/send', method: 'GET/POST', about: '通知の送信' },
  { path: '/api/push/jobs', method: 'GET/POST', about: '送信予定の預け入れ' },
  { path: '/api/push/cron', method: 'GET/POST', about: '定期実行（通知・日次処理）' },
  { path: '/api/money/import', method: 'GET/POST', about: '家計データの取り込み' },
  { path: '/api/money/rules', method: 'GET/POST', about: '自動分類ルール' },
  { path: '/api/money/summary', method: 'GET', about: '家計のまとめ' },
  { path: '/api/plan/check', method: 'GET', about: '予定の点検' },
  { path: '/api/plan/gaps', method: 'GET', about: '空き時間' },
  { path: '/api/plan/history', method: 'GET', about: '予定の履歴' },
  { path: '/api/plan/ics', method: 'GET', about: '予定の ICS 配信' },
  { path: '/api/plan/lasttrain', method: 'GET', about: '終電の目安' },
  { path: '/api/plan/learn', method: 'GET', about: '予定の傾向' },
  { path: '/api/plan/next', method: 'GET', about: '次の予定' },
  { path: '/api/attend/arrive', method: 'GET/POST', about: '到着で出席を記録' },
  { path: '/api/share/create', method: 'POST', about: '共有リンクの作成' },
  { path: '/api/share/view', method: 'GET', about: '共有リンクの表示' },
  { path: '/api/study/plan', method: 'GET/POST', about: '学習計画' },
  { path: '/api/study/generate', method: 'POST', about: '学習教材の生成' },
  { path: '/api/study/time', method: 'GET/POST', about: '学習時間の記録' },
  { path: '/api/study/summarize', method: 'POST', about: '要約' },
  { path: '/api/study/transcribe', method: 'POST', about: '文字起こし' },
  { path: '/api/study/questions', method: 'GET', about: '問題の取得' },
  { path: '/api/translate', method: 'POST', about: '翻訳' },
  { path: '/api/ocr', method: 'POST', about: '画像の文字読み取り' },
  { path: '/api/voice', method: 'POST', about: '音声入力' },
  { path: '/api/health', method: 'GET', about: 'サーバーの状態' },
  { path: '/api/health/cycle', method: 'GET', about: '周期の予測（サーバーで見える範囲）' },
  { path: '/api/health/report', method: 'GET/POST', about: '健診レポートの要約と保存' },
  { path: '/api/health/rhythm', method: 'GET', about: '生活リズム' },
  { path: '/api/export', method: 'GET', about: 'データの書き出し' },
  { path: '/api/search', method: 'GET', about: '横断検索' },
  { path: '/api/settings', method: 'GET/POST', about: '設定の保存・取得' },
  { path: '/api/sync/queue', method: 'GET/POST', about: '同期の待ち行列' },
  { path: '/api/transfer', method: 'GET/POST', about: '端末間の引き継ぎ' },
  { path: '/api/photo/hash', method: 'GET/POST', about: '写真の重複チェック' },
  { path: '/api/game/score', method: 'GET/POST', about: 'ゲームのスコア' },
  { path: '/api/game/ranking', method: 'GET', about: 'ランキング' },
  { path: '/api/game/save', method: 'GET/POST', about: 'ゲームのセーブ' },
  { path: '/api/game/daily', method: 'GET', about: '今日のお題' },
  { path: '/api/game/record', method: 'GET/POST', about: 'ゲームの記録' },
  { path: '/api/game/pet', method: 'GET/POST', about: 'ペット' },
  { path: '/api/game/talk', method: 'POST', about: 'ゲームのセリフ生成（キャッシュつき）' },
  { path: '/api/notify/discord', method: 'POST', about: 'Discord への通知' },
  { path: '/api/notify/line', method: 'POST', about: 'LINE への通知' },
  { path: '/api/mail', method: 'GET/POST', about: 'メールの送信・待ち行列' },
  { path: '/api/maps', method: 'GET', about: '地図・経路' },
  { path: '/api/wx', method: 'GET', about: '天気・警報' },
];

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });

  const key = process.env.GEMINI_API_KEY || req.headers['x-goog-api-key'] || '';
  const q = new URL(req.url || '/', 'http://localhost').searchParams;
  const force = q.get('refresh') === '1';

  const resolved = await resolveModels(key, force);
  /* 家計簿の自動分類ルール（#36）。読めないときは既定値が返る（loadRules は例外にしない） */
  const classRules = await loadRules();
  /* サーバー配信の時刻表（#51）。読めないときは none（loadTransit は例外にしない） */
  const tr = await loadTransit();
  const transit = tr ? { source: 'server', tables: tr.tables, holiday: tr.holiday, updatedAt: tr.updatedAt } : { source: 'none', tables: null };
  /* イベント配布（#154）。読めないときは null */
  let events = null;
  try {
    const cfg = await fsGetDoc(CONFIG_DOC);
    const arr = cfg && cfg.events ? JSON.parse(cfg.events) : null;
    events = Array.isArray(arr) ? arr : null;
  } catch (e) { events = null; }
  const out = {
    ok: true,
    model: resolved.model,
    heavy: resolved.heavy,
    candidates: resolved.light,
    updatedAt: resolved.updatedAt,
    source: resolved.source,
    prompts: publicPrompts(),
    classRules,
    transit,
    events,
    endpoints: ENDPOINTS,
  };
  if (!key) { out.source = 'fallback'; out.serverKey = false; }
  /* 鍵の有無で内容が変わるため、共有キャッシュには載せず端末側だけ300秒 */
  res.setHeader('Cache-Control', 'private, max-age=300');
  return sendJson(res, 200, out);
};
