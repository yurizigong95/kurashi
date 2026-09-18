// くらしの手帳：自動テストをブラウザで動かす（GitHub Actions で動く）
import { chromium } from 'playwright';

const url = process.env.TEST_URL || 'http://127.0.0.1:8080/tests/index.html';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('[画面のエラー]', m.text()); });
page.on('pageerror', (e) => console.log('[画面のエラー]', e.message));
await page.goto(url);
let result;
try {
  const handle = await page.waitForFunction(() => window.__TEST_RESULT, null, { timeout: 10 * 60 * 1000, polling: 1000 });
  result = await handle.jsonValue();
} catch (e) {
  console.log('::error::テストが終わりませんでした：' + e.message);
  console.log(await page.locator('#sum').textContent().catch(() => ''));
  await browser.close();
  process.exit(1);
}
console.log(`成功 ${result.pass}件 ／ 失敗 ${result.fail}件 ／ 全部 ${result.total}件`);
for (const f of result.fails) console.log(`::error::${f}`);
await browser.close();
process.exit(result.fail ? 1 : 0);
