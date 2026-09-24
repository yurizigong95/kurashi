// ぜんぶ入り（all/）：3つのアプリがちゃんと出るかを調べる（GitHub Actions で動く）
import { chromium } from 'playwright';

const base = process.env.TEST_URL || 'http://127.0.0.1:8080/all/index.html';
const WANT = [
  { tab: 'くらし',   title: 'くらしの手帳' },
  { tab: 'もんだい', title: 'もんだいメーカー' },
  { tab: 'ゲーム',   title: 'ゲーム道場' }
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base, { waitUntil: 'load' });

let bad = 0;
const say = (ok, msg) => { if (!ok) { bad++; console.log('::error::' + msg); } else console.log('  ' + msg); };

const tabs = await page.$$eval('#tabs button', (bs) => bs.map((b) => b.textContent.trim()));
say(tabs.join(',') === WANT.map((w) => w.tab).join(','), `切りかえバー：${tabs.join(' / ')}`);

for (let i = 0; i < WANT.length; i++) {
  const w = WANT[i];
  await page.click(`#tabs button:nth-child(${i + 1})`);
  let title = '';
  for (let n = 0; n < 60 && title !== w.title; n++) {
    for (const fr of page.frames()) {
      if (fr === page.mainFrame()) continue;
      const t = await fr.title().catch(() => '');
      if (t === w.title) title = t;
    }
    if (title !== w.title) await page.waitForTimeout(500);
  }
  say(title === w.title, `${w.tab} → ${title || '（出ませんでした）'}`);
  const shown = await page.$$eval('#stage iframe', (fs) => fs.filter((f) => !f.hidden).length);
  say(shown === 1, `見えているアプリは1つだけ（${shown}）`);
}

// ページを開き直しても、さいごに見ていたアプリを覚えているか
await page.goto(base, { waitUntil: 'load' });
await page.waitForTimeout(1500);
const sel = await page.$$eval('#tabs button', (bs) => (bs.find((b) => b.getAttribute('aria-selected') === 'true') || {}).textContent || '');
say((sel || '').trim() === 'ゲーム', `開き直したときに覚えている：${sel}`);

say(errors.length === 0, `画面のエラー：${errors.length}件 ${errors.join(' / ')}`);
await browser.close();
console.log(bad ? `失敗 ${bad}件` : 'ぜんぶ入り：問題なし');
process.exit(bad ? 1 : 0);
