// くらしの手帳：出す前の確認（node tools/release-check.mjs）
// ① js/core.js の APP_BUILD と sw.js の CACHE を表示する（2つはセットで上げる）
// ② sw.js の FILES と、実際にあるファイル（js/*.js・css/*.css・index.html など）を照らし合わせる。
//    もんだいメーカー（study/）は study/sw.js の FILES と study/js/*.js などを照らし合わせる。
//    抜け・余りがあれば終了コード 1
// ③ すべての JS を node --check で構文チェックする
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

let bad = 0;
const read = (f) => readFileSync(f, 'utf8');
const list = (dir, ext) => existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).sort().map((f) => `${dir}/${f}`) : [];

// ① 版の番号
const build = (read('js/core.js').match(/var APP_BUILD = '([^']+)'/) || [])[1] || '（見つかりません）';
const cache = (read('sw.js').match(/var CACHE = '([^']+)'/) || [])[1] || '（見つかりません）';
console.log(`APP_BUILD：${build}`);
console.log(`sw.js CACHE：${cache}`);
if (!/^\d{4}-\d{2}-\d{2}[a-z]?$/.test(build) || !/^kurashi-v\d+$/.test(cache)) { console.log('::error::APP_BUILD か CACHE の形がちがいます'); bad++; }

// ② FILES と実際のファイル
function swFiles(swPath) {
  const sw = read(swPath);
  const m = sw.match(/var FILES = \[([\s\S]*?)\];/);
  if (!m) { console.log(`::error file=${swPath}::FILES が見つかりません`); bad++; return []; }
  return [...m[1].matchAll(/'\.\/([^']*)'/g)].map((x) => x[1]).filter((p) => p && !p.startsWith('__'));
}
function compare(label, base, swPath, want) {
  const files = swFiles(join(base, swPath)).map((p) => (base === '.' ? p : `${base}/${p}`));
  const have = new Set(files);
  const need = new Set(want.filter((f) => existsSync(f)));
  const miss = [...need].filter((f) => !have.has(f)).sort();
  const extra = files.filter((f) => !existsSync(f)).sort();
  for (const f of miss) console.log(`::error::${label}：sw.js の FILES に入っていません：${f}`);
  for (const f of extra) console.log(`::error::${label}：sw.js の FILES にあるのに見つかりません：${f}`);
  console.log(`${label}：FILES ${files.length}件・抜け ${miss.length}件・余り ${extra.length}件`);
  bad += miss.length + extra.length;
}
const htmlRefs = (dir) => {
  const p = join(dir, 'index.html');
  if (!existsSync(p)) return [];
  return [...read(p).matchAll(/(?:src|href)="((?:js|css)\/[^"?#]+)"/g)].map((m) => (dir === '.' ? m[1] : `${dir}/${m[1]}`));
};
compare('くらしの手帳', '.', 'sw.js', [
  'index.html', 'manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'files.json',
  ...list('js', '.js'), ...list('css', '.css'), 'gas/Code.gs', 'gas/appsscript.json', ...htmlRefs('.')
]);
if (existsSync('study/sw.js')) {
  compare('もんだいメーカー', 'study', 'sw.js', [
    'study/index.html', 'study/manifest.json', 'study/icon-180.png', 'study/icon-192.png', 'study/icon-512.png',
    ...list('study/js', '.js'), ...list('study/css', '.css'), ...htmlRefs('study')
  ]);
}

// ③ 構文チェック
const js = [...list('js', '.js'), ...list('study/js', '.js'), 'sw.js', ...(existsSync('study/sw.js') ? ['study/sw.js'] : []), ...list('tools', '.mjs')];
let ng = 0;
for (const f of js) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { ng++; console.log(`::error file=${f}::構文エラー\n${String(e.stderr || e.message).trim()}`); }
}
console.log(`構文チェック：${js.length}件・エラー ${ng}件`);
bad += ng;

console.log(bad ? `問題 ${bad}件` : 'ぜんぶそろっています');
process.exit(bad ? 1 : 0);
