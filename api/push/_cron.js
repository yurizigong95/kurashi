/* 送信予定のうち、時刻が来たものを送る（タイマー実行）＋ サーバー側で作る通知
   - Vercel Cron から呼ばれます（vercel.json の crons。Hobby プランは1日1回まで）。
   - 5分おきに回したいときは、GAS の tickVercel（gas/Code.gs の末尾）など外のタイマーから
     Authorization: Bearer <CRON_SECRET> 付きでこの URL を叩いても同じです。
   - 実際に送られる時刻は、呼び出しの間隔しだいです。Vercel Cron だけなら1日1回（その時刻にまとめて）、
     GAS の tickVercel を5分ごとにすれば、5分きざみで「時刻を過ぎた最初の呼び出し」で送ります。
   - 送信には環境変数 FIREBASE_SERVICE_ACCOUNT が必要です。未設定のときは何も送らず、
     「送るはずだった件数」だけを数えて cron ログに残します（送信済みの記録も書かないので、
     鍵を入れたあとの呼び出しで、あらためて作られます）。
   GET /api/push/cron?log=1 … cron ログ（新しい順・最大60件）。CRON_SECRET を設定しているときだけ読めます。

   サーバー側で作る通知（同期データを api/_digest.js で読んで作る）:
     朝の「今日のまとめ」（＋気象警報）・16:30 の出欠チェック・締切の段階リマインド・残高の警告・遅延の割りこみ
   アプリがすでに同じ id の予定を預けている通知（朝のまとめ・締切）は、二重にならないよう、こちらでは送りません。

   バッチC1で足したもの（api/_money.js・api/_plan.js）:
     引落日の朝チェック（#32）・サブスク更新14日前（#33）・給与の入金かも（#34）・
     月末の家計まとめ（#37）・明日の予定（#75）・記念日（#77）と、
     通知ではない日次処理として世代スナップショット（#40）。
     #32 と残高警告（#7）の重複防止は、#32 の節のコメントに書いた。

   バッチC2で足したもの（api/_watch.js・api/_wx.js）:
     気象警報の即時通知（#54/#58）・雨の日の出発前倒し（#53。朝のまとめに1行）・
     受信箱の割りこみ（遅延＋駅の情報・大学メール。#46/#52/#59）・
     同期データの差分検知（出欠・成績・新しい課題・シラバス・時間割。#41/#42/#44/#45/#50/#125）・
     出欠の危険科目（#43。月曜の朝）・週次のふりかえり（#126。日曜の夜）・
     サブスクの監査（#127。夜）・暑さ指数の前夜通知（#55）。

   バッチDで足したもの（api/_hub.js・api/_mail.js）:
     受信箱に Goodnotes のバックアップ（#64）・お薬/ワクチンの期限（#183）・
     外部サイトの更新チェック（#166。CONFIG_DOC の watchUrls）・週次のふりかえりのメール（#140）・
     ランキングの週間集計（#160。日曜の夜）と、
     通知ではない日次処理として同期スナップショット（#82）・年度アーカイブ（#195。3/31）・自己点検（#84。cron ログに残す）。 */
'use strict';
const {
  sendJson, fsGetDoc, fsSetDoc, INBOX_DOC, CONFIG_DOC, SITE_DOC, ARCHIVE_DOC,
  loadDevices, saveDevices, loadJobs, saveJobs,
  loadSent, saveSent, loadCronLog, appendCronLog,
  serviceAccount, sendToDevices,
} = require('../_fb');
const D = require('../_digest');
const M = require('../_money');
const P = require('../_plan');
const W = require('../_watch');
const WX = require('../_wx');
const HUB = require('../_hub');
const MAIL = require('../_mail');

const HOUR_MS = 60 * 60 * 1000;
/* 受信箱の割りこみ（src ごとの設定）。時刻は朝 5:00〜10:00 の分。
   delay は従来どおり st.delay に、それ以外は st.inbox に数える */
const INBOX_SRCS = [
  { src: 'delay', from: 300, to: 600, maxAge: 3 * HOUR_MS, title: '🚃 運行情報', bucket: 'delay' },
  { src: 'station', from: 300, to: 600, maxAge: 12 * HOUR_MS, title: '🚉 駅の情報', bucket: 'inbox' },
  { src: 'mail', from: 300, to: 600, maxAge: 24 * HOUR_MS, title: '📧 大学メール', bucket: 'inbox' },
  { src: 'goodnotes', from: 300, to: 600, maxAge: 24 * HOUR_MS, title: '📓 Goodnotes のバックアップ', bucket: 'inbox' },
];

async function loadInbox() {
  try {
    const doc = await fsGetDoc(INBOX_DOC);
    if (!doc || !doc.entries) return [];
    const arr = JSON.parse(doc.entries);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

/* アプリの通知の設定（js/notify.js の notifyPrefs のうち、ここで使うものだけ） */
function notifyPrefsOf(data) {
  const ui = data && data.core && data.core.ui;
  const n = (ui && ui.notify && typeof ui.notify === 'object') ? ui.notify : {};
  const p = Object.assign({ push: 1, am: 1, amTime: '07:30', dl3: 1, dl1: 1, dl0: 1, dlTime: '20:00', dlMorning: '07:30', quiet: 1 }, n);
  if (p.amTime === '06:45' && !p.amSet) p.amTime = '07:30';
  return p;
}
function off(v) { return v === 0 || v === '0' || v === false; }

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  const q = new URL(req.url || '/', 'http://localhost').searchParams;
  const secret = process.env.CRON_SECRET || '';
  if (req.method === 'GET' && q.get('log') === '1' && !secret) {
    return sendJson(res, 403, { error: 'CRON_SECRET が未設定のためログは読めません' });
  }
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== 'Bearer ' + secret) return sendJson(res, 401, { error: 'unauthorized' });
  }
  if (req.method === 'GET' && q.get('log') === '1') {
    try {
      const entries = await loadCronLog();
      return sendJson(res, 200, { ok: true, entries: entries.slice(-60).reverse() });
    } catch (e) { return sendJson(res, 500, { error: e.message }); }
  }
  try {
    const now = Date.now();
    const [devices, jobs, sent] = await Promise.all([loadDevices(), loadJobs(), loadSent()]);
    const senderReady = !!serviceAccount();
    const dead = [];
    let sentChanged = false;
    const st = {
      due: { found: 0, sent: 0 },
      digest: { planned: 0, sent: 0 },
      daycheck: { planned: 0, sent: 0 },
      deadline: { planned: 0, sent: 0 },
      balance: { planned: 0, sent: 0 },
      delay: { planned: 0, sent: 0 },
      debitam: { planned: 0, sent: 0 },
      sub: { planned: 0, sent: 0 },
      salary: { planned: 0, sent: 0 },
      monthsum: { planned: 0, sent: 0 },
      tomorrow: { planned: 0, sent: 0 },
      anniv: { planned: 0, sent: 0 },
      backup: { added: 0 },
      watch: { events: 0, planned: 0, sent: 0 },
      attend: { planned: 0, sent: 0 },
      warn: { planned: 0, sent: 0 },
      wkrev: { planned: 0, sent: 0 },
      subaudit: { planned: 0, sent: 0 },
      wbgt: { planned: 0, sent: 0 },
      inbox: { planned: 0, sent: 0 },
      syncsnap: { added: 0 },
      selfcheck: { ok: 0 },
      med: { planned: 0, sent: 0 },
      site: { checked: 0, changed: 0, planned: 0, sent: 0 },
      gameagg: { done: 0 },
      archive: { added: 0 },
      weekmail: { queued: 0, sent: 0 },
    };
    const dropDead = (ids) => {
      for (const id of ids) { if (devices[id]) { delete devices[id]; dead.push(id); } }
    };

    /* 1. 時刻が来た送信予定（従来どおり＋再送防止）
       - アプリは予定をまるごと送り直すため、ジョブ側の sent 印だけでは二重送信を防げない。
         送信済みの記録（sent）に id があるものは送らない。
       - 40分以上すぎたものは送らない（GAS版の tick と同じ足切り）。
       - 送信に失敗（端末の登録切れ以外）したら sent にせず、次の呼び出しでやり直す。 */
    const due = jobs.filter((j) => !j.sent && j.at <= now);
    st.due.found = due.length;
    st.due.stale = 0;
    if (senderReady) {
      for (const job of due) {
        if (job.id && sent['job-' + job.id]) { job.sent = 1; continue; }
        if (now - job.at > 40 * 60 * 1000) { job.sent = 1; st.due.stale++; continue; }
        const r = await sendToDevices(devices, job);
        st.due.sent += r.sent;
        dropDead(r.dead);
        const failed = r.results.some((x) => !x.skipped && !x.ok && r.dead.indexOf(x.device) < 0);
        if (r.sent > 0 || !failed) {
          job.sent = 1;
          if (job.id) { sent['job-' + job.id] = now; sentChanged = true; }
        }
      }
    }

    /* 2. サーバー側で作る通知（同期データが読めなくても、ほかは続ける） */
    let data = { core: null, plan: null, money: null, maps: null };
    try { data = await D.loadData(); } catch (e) { /* 読めないときは作らない */ }
    /* バッチC1の材料：extra のかたまり（記念日）、お金のスナップショット、Googleカレンダーのキャッシュ */
    let extra = null, snap = null, gcalItems = [];
    try { extra = await D.loadPart('extra'); } catch (e) { /* 無ければ記念日なし */ }
    try { snap = await M.loadMoneySnap(); } catch (e) { /* 無ければ同期データだけで判定 */ }
    try { gcalItems = await P.loadGcalItems(); } catch (e) { /* 無ければ共有予定なし */ }
    const p = notifyPrefsOf(data);
    const ymd = D.ymdJst(now), nowMin = D.minJst(now);
    /* 世代スナップショット（#40。通知ではないので、静かな時間帯でも・鍵が無くても作る） */
    try {
      const g = await M.takeGenerationIfNewDay(data, snap, ymd, now);
      if (g.added) st.backup.added = 1;
    } catch (e) { /* 作れなくても本体は止めない */ }
    /* 同期スナップショット（#82。1日1回。通知ではないので、静かな時間帯でも作る） */
    try {
      const ss = await HUB.takeSyncSnapIfNewDay(data, ymd, now);
      if (ss.added) st.syncsnap.added = 1;
    } catch (e) { /* 作れなくても本体は止めない */ }
    /* 年度アーカイブ（#195。3/31 に、その年度の指紋と件数を1回だけ残す） */
    if (ymd.slice(5) === '03-31') {
      try {
        const years = await HUB.loadJsonField(ARCHIVE_DOC, 'years', {});
        const sy = String(Number(ymd.slice(0, 4)) - 1);
        if (years && typeof years === 'object' && !years[sy]) {
          const f = HUB.syncFingerOf(data);
          years[sy] = { schoolYear: sy, archivedAt: new Date(now).toISOString(), fingers: f.fingers, counts: f.counts };
          await HUB.saveJsonField(ARCHIVE_DOC, 'years', years);
          st.archive.added = 1;
        }
      } catch (e) { /* 残せなくても本体は止めない */ }
    }
    /* 夜中（23:30〜6:00）は作らない（アプリの「夜中は送らない」と同じ）。スマホへの通知を切っている人にも送らない */
    const quietNow = !off(p.quiet) && (nowMin < 360 || nowMin > 1410);
    const genOn = !off(p.push) && !quietNow;
    const clientHas = (id) => jobs.some((j) => j.id === id);
    /* 1件送る。送れたとき（または送る相手がいなかったとき）だけ記録する。失敗したら次の呼び出しでやり直す */
    const deliver = async (key, job, bucket) => {
      bucket.planned++;
      if (!senderReady) return;
      const r = await sendToDevices(devices, job);
      bucket.sent += r.sent;
      dropDead(r.dead);
      const failed = r.results.some((x) => !x.skipped && !x.ok && r.dead.indexOf(x.device) < 0);
      if (r.sent > 0 || !failed) { sent[key] = now; sentChanged = true; }
    };

    /* 差分検知（#41/#42/#44/#45/#50/#125）。前回の状態が無いときはベースラインを作るだけ（通知は出ないので、
       静かな時間帯でも作ってよい）。夜スロット（20:55以降）は差分を取って、通知は下の genOn の中で送る。
       夜スロットでも genOn でない回（23:30以降）は差分を取らない（取ると状態だけ進んで、通知が消えるため） */
    let watchEvents = [];
    let watchPrevState = null;
    let prevSubsFinger = null;
    try {
      const wd = await W.loadWatchDoc();
      prevSubsFinger = wd.subsFinger;
      watchPrevState = wd.state;
      /* 差分を取るのは、送れる状態（送信の鍵あり）の夜スロットだけ。鍵が無いときに状態だけ進めると、
         あとから鍵を入れても変化が消えてしまい、知らせる機会を失うため */
      if (!wd.error && (!wd.state || (nowMin >= 1255 && genOn && senderReady))) {
        const r = await W.runWatch(data, wd.state);
        watchEvents = r.events || [];
        st.watch.events = watchEvents.length;
        if (r.baseline) st.watch.baseline = 1;
      }
    } catch (e) { /* 差分が取れなくても本体は止めない */ }

    if (genOn) {
      /* 朝の「今日のまとめ」（気象警報はここでだけ読む）
         時刻の判定には2分のゆるみを持たせる（タイマーの起動が数秒早いだけで、その日ぶんが消えないように）。
         アプリと同じく、10:30までに始まる授業がある日は 6:15 に早める（自分で時刻を決めた人＝amSet はそのまま） */
      let amMin = D.minutesOf(p.amTime);
      if (amMin != null && !p.amSet) {
        const early = D.classesForDate(data, ymd).some((c) => {
          const m = D.minutesOf(c.start);
          return !c.off && m != null && m <= 630;
        });
        if (early && amMin > 375) amMin = 375;
      }
      /* 警報の即時通知（下の #54/#58）と同じ指紋（今日の日付＋出ている警報の地域・名前） */
      let wxNow = null;
      const warnKey = (list) => 'srv-warn-' + ymd + '-' + D.hash53(list.map((w) => w.area + w.name).sort().join('|')).slice(0, 8);
      let digestWx = false;
      if (!off(p.am) && amMin != null && nowMin >= amMin - 2 && nowMin < 720 && !sent['slot-am-' + ymd] && !clientHas('am-' + ymd)) {
        const base = D.buildDigest(data, ymd, []);
        if (base) {
          const wx = senderReady ? await D.jmaWarnings() : [];
          wxNow = wx;
          /* 同じ警報が即時通知で送れたあとは、まとめには入れ直さない（指紋が同じものだけ） */
          const wxPushed = wx.length && !!sent[warnKey(wx)];
          const dg = (wx.length && !wxPushed) ? D.buildDigest(data, ymd, wx) : base;
          let body = dg.body;
          /* 雨の出発前倒し（#53）。学校に行く授業（休講・家で受講を除く）がある日だけ1行足す */
          try {
            const school = D.classesForDate(data, ymd).some((c) => !c.off && !c.web);
            if (school) {
              const rain = await WX.rainInfo(ymd);
              if (rain.enough && rain.rain) body += '\n☔ 雨の予報（降水確率' + rain.pop + '%）。出発はいつもより15分早めがおすすめです';
            }
          } catch (e) { /* 予報が読めなければ足さない */ }
          await deliver('slot-am-' + ymd, { id: 'am-' + ymd, title: dg.title, body, cat: 'today' }, st.digest);
          /* まとめに警報を入れて送れたら、同じ警報の即時通知は送らない（記録を共有する）。
             まとめの送信に失敗したときは抑止しない（即時通知のほうで拾う） */
          if (wx.length && !wxPushed && (!senderReady || sent['slot-am-' + ymd])) {
            digestWx = true;
            if (sent['slot-am-' + ymd]) { sent[warnKey(wx)] = sent['slot-am-' + ymd]; sentChanged = true; }
          }
        }
      }
      /* 気象警報の即時通知（#54/#58）。朝のまとめより前から出ている警報や、日中に出た警報を拾う。
         同じ警報は sent の指紋で1日1回（翌日は日付が変わるので、続いていればもう一度知らせる）。
         この実行でまとめに警報を入れたときは送らない */
      if (!digestWx) {
        try {
          const wx = wxNow || await D.jmaWarnings();
          const list = wx.filter((w) => w && w.lv >= 2);
          if (list.length && !sent[warnKey(list)]) {
            const phase = nowMin >= 1140 ? '前日' : '当日';
            await deliver(warnKey(list), {
              id: 'warn-' + ymd, title: '⚠️ 気象警報',
              body: list.slice(0, 4).map((w) => w.area + '：' + w.name).join('\n') + '\n' + WX.stageText(list, phase),
              cat: 'today',
            }, st.warn);
          }
        } catch (e) { /* 警報が読めなくても本体は止めない */ }
      }
      /* 16:30 の出欠チェック（今日の授業があるときだけ。2分のゆるみつき） */
      if (nowMin >= 988 && !sent['slot-daycheck-' + ymd]) {
        const cls = D.classesForDate(data, ymd).filter((c) => !c.off);
        if (cls.length) {
          await deliver('slot-daycheck-' + ymd, {
            id: 'daycheck-' + ymd, title: '✍️ 今日の出欠チェック',
            body: cls.map((c) => c.period + '限 ' + D.shortName(data, c.name)).join('・') + '\n出席・欠席を記録してね', cat: 'today',
          }, st.daycheck);
        }
      }
      /* 締切の段階リマインド（3日前・前日は dlTime、当日は dlMorning） */
      for (const s of D.deadlineStages(data, ymd)) {
        if (off(p[s.key === 'd3' ? 'dl3' : s.key === 'd1' ? 'dl1' : 'dl0'])) continue;
        const at = D.minutesOf(s.key === 'd0' ? p.dlMorning : p.dlTime);
        if (at == null || nowMin < at - 2) continue;
        const key = 'srv-' + s.key + '-' + s.taskId + '-' + s.due;
        const id = s.key + '-' + s.taskId + '-' + s.due;   // アプリの予定と同じ id（端末では同じ通知として上書きされる）
        if (sent[key] || clientHas(id)) continue;
        await deliver(key, { id, title: s.title, body: s.body, cat: 'due' }, st.deadline);
      }
      /* お薬・ワクチンの期限（#183）。題名・科目に「薬・ワクチン・接種・服薬」を含む課題を、締切と同じ時刻・設定で知らせる。
         上の締切リマインドで同じ段階を送っていたら送らない */
      {
        const tasks = (data.plan && Array.isArray(data.plan.tasks)) ? data.plan.tasks : [];
        for (const t of tasks) {
          if (!t || typeof t !== 'object' || t.done || !t.id || !D.isYmd(t.due)) continue;
          if (!/薬|ワクチン|接種|服薬/.test(String(t.title || '') + String(t.subject || ''))) continue;
          const diff = D.diffDays(ymd, t.due);
          if (diff !== 3 && diff !== 1 && diff !== 0) continue;
          const stage = diff === 0 ? 'd0' : diff === 1 ? 'd1' : 'd3';
          if (off(p[stage === 'd3' ? 'dl3' : stage === 'd1' ? 'dl1' : 'dl0'])) continue;
          const at = D.minutesOf(stage === 'd0' ? p.dlMorning : p.dlTime);
          if (at == null || nowMin < at - 2) continue;
          const taskId = String(t.id), due = t.due;
          const key = 'srv-med-' + stage + '-' + taskId + '-' + due;
          if (sent[key] || sent['srv-' + stage + '-' + taskId + '-' + due]) continue;
          /* アプリ自身が同じ締切の予定を預けているときは、アプリの通知にまかせる（二重に送らない） */
          if (clientHas(stage + '-' + taskId + '-' + due)) continue;
          await deliver(key, {
            id: 'med-' + stage + '-' + taskId + '-' + due, title: '💊 お薬・ワクチンの期限',
            body: (t.title || 'お薬・ワクチン') + '（' + D.mdLabel(due) + (diff === 0 ? '・今日' : diff === 1 ? '・明日' : '・3日後') + '）',
            cat: 'due',
          }, st.med);
          /* こちらで送れたら、締切リマインド側のキーも記録しておく（締切側が次の回に送り直して二重にならないように） */
          if (sent[key]) { sent['srv-' + stage + '-' + taskId + '-' + due] = sent[key]; sentChanged = true; }
        }
        /* 健康管理の項目（plan.health の { name, next }。ワクチンの接種期限など）も同じ段階で知らせる */
        const healthItems = (data.plan && Array.isArray(data.plan.health)) ? data.plan.health : [];
        for (const hItem of healthItems) {
          if (!hItem || typeof hItem !== 'object' || !D.isYmd(hItem.next)) continue;
          const diff = D.diffDays(ymd, hItem.next);
          if (diff !== 3 && diff !== 1 && diff !== 0) continue;
          const stage = diff === 0 ? 'd0' : diff === 1 ? 'd1' : 'd3';
          if (off(p[stage === 'd3' ? 'dl3' : stage === 'd1' ? 'dl1' : 'dl0'])) continue;
          const at = D.minutesOf(stage === 'd0' ? p.dlMorning : p.dlTime);
          if (at == null || nowMin < at - 2) continue;
          const hid = String(hItem.id || hItem.name || ''), due = hItem.next;
          if (!hid) continue;
          const key = 'srv-medh-' + stage + '-' + hid + '-' + due;
          if (sent[key]) continue;
          await deliver(key, {
            id: 'medh-' + stage + '-' + hid + '-' + due, title: '💊 健康管理の期限',
            body: (hItem.name || '健康管理') + '（期限：' + D.mdLabel(due) + (diff === 0 ? '・今日' : diff === 1 ? '・明日' : '・3日後') + '）',
            cat: 'due',
          }, st.med);
        }
      }
      /* 引落日の朝チェック（#32）。#7 より先に評価する（理由は下の役割分担を参照）
         #7 との役割分担と重複防止:
         - #7（下の残高の警告）は「今日＋明日の累積」で判定し、キー srv-bal-<対象日> を使う。
           前日の時点で明日の分として警告済みなら、その記録が残っている。
         - #32 は当日の朝（6:00以降）に「当日ぶんだけ」を見て、名前つきで知らせる。
           キーは srv-debitam-<当日>。srv-bal-<当日> があれば送らない。送れたときは
           srv-bal-<当日> も一緒に記録して、直後の #7 が同じ日に二重に送らないようにする。
           （#7 を先に評価すると、#7 が当日ぶんを汎用の文面で送って記録してしまい、
             名前つきの #32 が永遠に送られなくなるため、この順序にしている） */
      if (nowMin >= 360) {
        const chk = M.debitMorningCheck(data, snap, ymd);
        if (chk && chk.short && !sent['srv-bal-' + ymd] && !sent['srv-debitam-' + ymd]) {
          await deliver('srv-debitam-' + ymd, {
            id: 'debitam-' + ymd, title: '⚠️ 今日の引落に注意',
            body: '今日の引落予定は合計¥' + D.yenText(chk.total) + '（' + chk.names.slice(0, 3).join('・') + '）ですが、いまの残高は¥' + D.yenText(chk.balance) + 'です',
            cat: 'today',
          }, st.debitam);
          if (sent['srv-debitam-' + ymd]) { sent['srv-bal-' + ymd] = sent['srv-debitam-' + ymd]; sentChanged = true; }
        }
      }
      /* 残高の警告（#7）。朝の引落チェック（#32）が同じ対象日に送っていたら送らない */
      for (const w of await D.balanceWarnings(data, ymd)) {
        const key = 'srv-bal-' + w.targetYmd;
        if (sent[key] || sent['srv-debitam-' + w.targetYmd]) continue;
        await deliver(key, {
          id: 'bal-' + w.targetYmd, title: '⚠️ 残高に注意',
          body: (w.cumulative > w.total
            ? '今日・明日の引落予定は合計¥' + D.yenText(w.cumulative)
            : D.mdLabel(w.targetYmd) + 'の引落予定は合計¥' + D.yenText(w.total)) +
            'ですが、いまの残高は¥' + D.yenText(w.balance) + 'です',
          cat: 'today',
        }, st.balance);
      }
      /* サブスクの更新14日前（#33） */
      for (const s of M.subscriptionWarnings(data, snap, ymd)) {
        if (sent[s.key]) continue;
        await deliver(s.key, { id: s.id, title: s.title, body: s.body, cat: 'today' }, st.sub);
      }
      /* 給与の入金かも（#34。断定しない文面は api/_money.js 側で組み立て） */
      for (const s of M.salaryCandidates(data, snap, ymd, now)) {
        if (sent[s.key]) continue;
        await deliver(s.key, { id: s.id, title: s.title, body: s.body, cat: 'today' }, st.salary);
      }
      /* 月末の家計まとめ（#37。月末の20時以降、作れなければ翌月1日の午前中に拾う） */
      {
        const isEnd = D.addDaysYmd(ymd, 1).slice(8, 10) === '01';
        const isStart = ymd.slice(8, 10) === '01';
        const targetYm = isEnd ? ymd.slice(0, 7) : isStart ? D.addDaysYmd(ymd, -1).slice(0, 7) : '';
        if (targetYm && ((isEnd && nowMin >= 1200) || (isStart && nowMin < 720)) && !sent['srv-monthsum-' + targetYm]) {
          const txs = M.transactionsOf(data, snap);
          const ms = M.monthSummary(txs.list, targetYm);
          if (ms.count > 0) {
            const prevYm = D.addDaysYmd(targetYm + '-01', -1).slice(0, 7);
            const prev = M.monthSummary(txs.list, prevYm);
            const top = ms.byCat.slice(0, 3).map((c) => c.label + ' ¥' + D.yenText(c.amount)).join('・');
            const diffTxt = prev.out > 0
              ? '（先月 ¥' + D.yenText(prev.out) + ' より ' + (ms.out >= prev.out ? '+' : '−') + '¥' + D.yenText(Math.abs(ms.out - prev.out)) + '）'
              : '';
            await deliver('srv-monthsum-' + targetYm, {
              id: 'monthsum-' + targetYm, title: '📊 ' + Number(targetYm.slice(5, 7)) + '月の家計まとめ',
              body: '支出 ¥' + D.yenText(ms.out) + diffTxt + (top ? '\n内訳：' + top : '') +
                (ms.inn > 0 ? '\n収入 ¥' + D.yenText(ms.inn) : ''),
              cat: 'today',
            }, st.monthsum);
          }
        }
      }
      /* 明日の予定（#75。19時以降。予定が無い日は何も送らない） */
      if (nowMin >= 1140) {
        const tmr = D.addDaysYmd(ymd, 1);
        if (!sent['srv-tmr-' + tmr]) {
          const items = P.dayItems(data, extra, tmr, gcalItems);
          if (items.length) {
            await deliver('srv-tmr-' + tmr, {
              id: 'tmr-' + tmr, title: '📌 明日の予定',
              body: items.slice(0, 5).map((o) => (o.time ? o.time + ' ' : '') + o.title).join('\n') +
                (items.length > 5 ? '\nほか' + (items.length - 5) + '件' : ''),
              cat: 'today',
            }, st.tomorrow);
          }
        }
      }
      /* 記念日（#77。当日は朝6時以降、前日は19時以降） */
      for (const a of P.annivCandidates(extra, ymd)) {
        if (sent[a.key]) continue;
        if (a.when === '当日' && nowMin < 360) continue;
        if (a.when === '前日' && nowMin < 1140) continue;
        await deliver(a.key, { id: a.id, title: a.title, body: a.body, cat: 'today' }, st.anniv);
      }
      /* 受信箱の割りこみ（#46/#52/#59）。src ごとの時間帯・新しさの範囲は INBOX_SRCS の設定。
         delay（3時間以内）・station（12時間以内）・mail（24時間以内＝前日の分も朝に拾う）。重複防止のキーは従来どおり 'hook-' + 受け取った時刻 */
      const srcsNow = INBOX_SRCS.filter((c) => nowMin >= c.from && nowMin < c.to);
      if (srcsNow.length) {
        for (const e of await loadInbox()) {
          const c = e && srcsNow.filter((x) => x.src === e.src)[0];
          if (!c || !e.at) continue;
          const t = Date.parse(e.at);
          if (!isFinite(t) || now - t > c.maxAge || sent['hook-' + e.at]) continue;
          const b = (e.body && typeof e.body === 'object') ? e.body : {};
          const text = String(b.text || b.body || b.summary || '').slice(0, 300);
          if (!text) continue;
          await deliver('hook-' + e.at, { id: 'hook-' + e.at, title: String(b.title || c.title).slice(0, 80), body: text, cat: 'today' }, st[c.bucket]);
        }
      }
      /* 差分検知の通知（上で取った events。キーはイベントの中身から作るので、同じ変化は2回送らない） */
      let watchMissed = false;
      for (const ev of watchEvents) {
        const job = W.eventJob(ev, data);
        if (sent[job.key]) continue;
        await deliver(job.key, { id: job.id, title: job.title, body: job.body, cat: job.cat }, st.watch);
        if (senderReady && !sent[job.key]) watchMissed = true;
      }
      /* 送れなかった変化があったら、前回の状態に戻しておく（状態だけ進むと、その変化は二度と拾えないため）。
         送れた分は sent の記録で抑えられるので、戻しても二重にはならない */
      if (watchMissed && watchPrevState) {
        try { await W.saveWatchState(watchPrevState); } catch (e) { /* 戻せなければ次の回に作り直す */ }
      }
      /* 出欠の危険科目（#43。月曜の8時以降に1回） */
      if (D.wdayOf(ymd) === 1 && nowMin >= 480 && !sent['srv-attend-' + ymd]) {
        const dc = W.dangerCourses(data).slice(0, 5);
        if (dc.length) {
          await deliver('srv-attend-' + ymd, {
            id: 'attend-' + ymd, title: '⚠️ 出欠がギリギリです',
            body: dc.map((c) => c.shortName + '：欠席' + c.ab + '回' + (c.limit === null
              ? '（上限は未設定）'
              : '（上限' + c.limit + '回・' + (c.remaining > 0 ? 'あと' + c.remaining + '回' : '上限に達しています') + '）')).join('\n'),
            cat: 'today',
          }, st.attend);
        }
      }
      /* 週次のふりかえり（#126。日曜の20時以降に1回）。送れない設定のときは AI を呼ばない（毎回呼ばれてしまうため） */
      const weekStart = D.addDaysYmd(ymd, -6);
      let wkrevText = '';   // 週次レポートのメール（#140）に使う本文
      if (D.wdayOf(ymd) === 0 && nowMin >= 1200) {
        if (!sent['srv-wkrev-' + weekStart]) {
          const wr = await W.buildWeeklyReview(data, extra, snap, ymd, { noAi: !senderReady });
          wkrevText = String(wr.aiText || wr.text || '');
          await deliver('srv-wkrev-' + wr.weekStart, {
            id: 'wkrev-' + wr.weekStart, title: '📅 今週のふりかえり',
            body: String(wr.aiText || wr.text).slice(0, 1000), cat: 'today',
          }, st.wkrev);
        } else if (!sent['srv-wkrevmail-' + weekStart]) {
          /* 通知は送れたのにメールだけ失敗した回は、本文を作り直してメールだけやり直す */
          const wr = await W.buildWeeklyReview(data, extra, snap, ymd, { noAi: !senderReady });
          wkrevText = String(wr.aiText || wr.text || '');
        }
        /* ランキングの週間集計（#160。週に1回。期間内のスコアを game ごとに上位3件） */
        try {
          const weekly = await HUB.loadGameField('weekly', null);
          if (!weekly || weekly.weekStart !== weekStart) {
            const scores = await HUB.loadGameField('scores', []);
            const groups = {};
            for (const s of (Array.isArray(scores) ? scores : [])) {
              if (!s || typeof s !== 'object') continue;
              const d = String(s.at || '').slice(0, 10);
              if (!d || d < weekStart || d > ymd) continue;
              const g = String(s.game || '');
              (groups[g] = groups[g] || []).push(s);
            }
            const byGame = {};
            for (const g of Object.keys(groups)) {
              byGame[g] = groups[g].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
                .slice(0, 3).map((s) => ({ name: s.name, score: s.score, at: s.at }));
            }
            await HUB.saveGameField('weekly', { weekStart, weekEnd: ymd, byGame, at: new Date(now).toISOString() });
            st.gameagg.done = 1;
          }
        } catch (e) { /* 集計できなくても本体は止めない */ }
      }
      /* 週次レポートのメール（#140）。ふりかえりを作った回だけ。送れた・預けたら記録して二重にしない */
      if (wkrevText && !sent['srv-wkrevmail-' + weekStart]) {
        try {
          const mr = await MAIL.sendMail({ kind: 'weekly', subject: '📅 今週のふりかえり（' + weekStart + '〜）', body: wkrevText });
          if (mr.ok) { st.weekmail.sent = 1; sent['srv-wkrevmail-' + weekStart] = now; sentChanged = true; }
          else if (mr.queued) { st.weekmail.queued = 1; sent['srv-wkrevmail-' + weekStart] = now; sentChanged = true; }
        } catch (e) { /* メールが送れなくても本体は止めない */ }
      }
      /* サブスクの監査（#127。夜スロットで1日1回まで）。指紋は監査のたびに WATCH_DOC の subsFinger に残す */
      if (nowMin >= 1255 && !sent['srv-subaudit-' + ymd]) {
        const au = W.auditSubs(snap, prevSubsFinger);
        if (au.enough) {
          if (au.findings.length) {
            await deliver('srv-subaudit-' + ymd, {
              id: 'subaudit-' + ymd, title: '🔁 サブスクの確認', body: W.auditText(au.findings), cat: 'today',
            }, st.subaudit);
          }
          /* 知らせるものがあって送れなかったときは指紋を進めない（次の回に「金額の変化」をもう一度拾うため） */
          const done = !au.findings.length || !!sent['srv-subaudit-' + ymd];
          if (done && JSON.stringify(au.finger) !== JSON.stringify(prevSubsFinger || null)) {
            try { await W.saveSubsFinger(au.finger); } catch (e) { /* 書けなければ次の回に比べ直す */ }
          }
        }
      }
      /* 暑さ指数の前夜通知（#55。19時以降。データ源は環境変数 WBGT_CSV_URL。花粉はデータ源が無いので対象外） */
      if (nowMin >= 1140) {
        const tmr = D.addDaysYmd(ymd, 1);
        if (!sent['srv-wbgt-' + tmr]) {
          const wb = await WX.wbgtInfo(tmr);
          if (wb.enough && wb.wbgt >= 28) {
            await deliver('srv-wbgt-' + tmr, {
              id: 'wbgt-' + tmr, title: '🥵 明日は暑さに注意',
              body: '明日（' + D.mdLabel(tmr) + '）の暑さ指数（WBGT）は最高' + wb.wbgt + '・' + wb.level + 'の予想です。水分と塩分をこまめにとってね',
              cat: 'today',
            }, st.wbgt);
          }
        }
      }
      /* 外部サイトの更新チェック（#166）。CONFIG_DOC の watchUrls（[{url, label}] の JSON 文字列）を最大5件。
         前回のハッシュは SITE_DOC の hashes。前回が無い URL はベースラインを作るだけ */
      /* この先は外部サイトの取得で時間がかかることがあるので、送信済みの記録を先に保存しておく
         （関数の時間切れで終わっても、送ったものが「未送信」に戻って二重送信にならないように） */
      if (sentChanged) { try { await saveSent(sent); sentChanged = false; } catch (e) { /* 保存できなければ末尾でもう一度試す */ } }
      try {
        const cfg = await fsGetDoc(CONFIG_DOC);
        const list = cfg && cfg.watchUrls ? JSON.parse(cfg.watchUrls) : null;
        if (Array.isArray(list) && list.length) {
          const sd = await fsGetDoc(SITE_DOC);
          let hashes = {};
          try { hashes = (sd && sd.hashes) ? JSON.parse(sd.hashes) || {} : {}; } catch (e) { hashes = {}; }
          let hashesChanged = false;
          for (const w of list.slice(0, 5)) {
            const url = w && typeof w.url === 'string' ? w.url : '';
            if (!url) continue;
            let text = '';
            const ac = new AbortController();
            const timer = setTimeout(() => ac.abort(), 5000);
            try {
              const r = await fetch(url, { signal: ac.signal });
              if (!r.ok) continue;
              text = await r.text();
            } catch (e) { continue; /* 読めなければ読み飛ばす */ } finally { clearTimeout(timer); }
            st.site.checked++;
            const hash = D.hash53(text.slice(0, 200000));
            const prev = hashes[url];
            if (!prev) { hashes[url] = hash; hashesChanged = true; continue; }
            if (prev === hash) continue;
            st.site.changed++;
            const key = 'srv-site-' + D.hash53(url).slice(0, 8) + '-' + hash.slice(0, 8);
            await deliver(key, {
              id: 'site-' + D.hash53(url).slice(0, 8), title: '🔔 ページが更新されました',
              body: (w.label || url) + '\n' + url, cat: 'today',
            }, st.site);
            /* 送れなかった変化は保存しない（次の回にもう一度拾うため）。
               送信の鍵が無いときも保存しない（鍵を入れたあとに知らせる機会を失うため） */
            if (sent[key]) { hashes[url] = hash; hashesChanged = true; }
          }
          if (hashesChanged) await fsSetDoc(SITE_DOC, { hashes: JSON.stringify(hashes), updatedAt: new Date().toISOString() });
        }
      } catch (e) { /* チェックできなくても本体は止めない */ }
    }

    /* 3. 後片付け（送ったものと、1日以上過ぎたものは掃除する） */
    if (dead.length) await saveDevices(devices);
    if (senderReady) {
      const keep = jobs.filter((j) => !j.sent || j.at > now - 24 * HOUR_MS);
      if (due.length || keep.length !== jobs.length) await saveJobs(keep);
    }
    if (sentChanged) await saveSent(sent);

    /* 自己点検（#84。結果は cron ログに残す） */
    try {
      const hc = await HUB.selfCheck();
      st.selfcheck = { ok: hc.ok ? 1 : 0, firestore: hc.checks.firestore, modelSource: hc.checks.model ? hc.checks.model.source : '' };
    } catch (e) { /* 点検できなくても本体は止めない */ }

    /* 4. cron ログ */
    try {
      await appendCronLog(Object.assign({ at: new Date(now).toISOString(), senderReady, devices: Object.keys(devices).length }, st));
    } catch (e) { /* ログが書けなくても本体は止めない */ }

    if (!senderReady) {
      return sendJson(res, 501, {
        error: '送信の鍵（FIREBASE_SERVICE_ACCOUNT）が未設定です', code: 'NO_SA',
        pendingJobs: jobs.filter((j) => !j.sent).length, devices: Object.keys(devices).length,
        due: st.due, digest: st.digest, daycheck: st.daycheck,
        deadline: st.deadline, balance: st.balance, delay: st.delay,
        debitam: st.debitam, sub: st.sub, salary: st.salary, monthsum: st.monthsum,
        tomorrow: st.tomorrow, anniv: st.anniv, backup: st.backup,
        watch: st.watch, attend: st.attend, warn: st.warn, wkrev: st.wkrev,
        subaudit: st.subaudit, wbgt: st.wbgt, inbox: st.inbox,
        syncsnap: st.syncsnap, selfcheck: st.selfcheck, med: st.med, site: st.site,
        gameagg: st.gameagg, archive: st.archive, weekmail: st.weekmail,
      });
    }
    sendJson(res, 200, {
      ok: true, due: due.length, sent: st.due.sent,   // due・sent は従来と同じ意味（送信予定ぶん）
      digest: st.digest, daycheck: st.daycheck, deadline: st.deadline, balance: st.balance, delay: st.delay,
      debitam: st.debitam, sub: st.sub, salary: st.salary, monthsum: st.monthsum,
      tomorrow: st.tomorrow, anniv: st.anniv, backup: st.backup,
      watch: st.watch, attend: st.attend, warn: st.warn, wkrev: st.wkrev,
      subaudit: st.subaudit, wbgt: st.wbgt, inbox: st.inbox,
      syncsnap: st.syncsnap, selfcheck: st.selfcheck, med: st.med, site: st.site,
      gameagg: st.gameagg, archive: st.archive, weekmail: st.weekmail,
    });
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
};
