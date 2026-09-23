// くらしの手帳：ファイルの抜けを調べる（GitHub Actions で動く）
// index.html と sw.js に書いてあるファイルが、ぜんぶそろっているかを確かめる。
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const need = new Set();
const html = readFileSync('index.html', 'utf8');
for (const m of html.matchAll(/(?:src|href)="((?:js|css)\/[^"?#]+)"/g)) need.add(m[1]);
const sw = readFileSync('sw.js', 'utf8');
for (const m of sw.matchAll(/'\.\/([^']+)'/g)) if (m[1] && !m[1].startsWith('__')) need.add(m[1]);
need.add('sw.js');

// もんだいメーカー（study/）も、同じやり方で調べる
if (existsSync('study/index.html')) {
  const h2 = readFileSync('study/index.html', 'utf8');
  for (const m of h2.matchAll(/(?:src|href)="((?:js|css)\/[^"?#]+)"/g)) need.add('study/' + m[1]);
  const s2 = readFileSync('study/sw.js', 'utf8');
  for (const m of s2.matchAll(/'\.\/([^']+)'/g)) {
    if (m[1] && m[1] !== '' && !m[1].startsWith('__')) need.add('study/' + m[1]);
  }
  need.add('study/sw.js');
  need.add('study/manifest.json');
  need.delete('study/');
}

let bad = 0;
for (const f of [...need].sort()) {
  if (!existsSync(f)) { console.log(`::error file=${f}::見つかりません：${f}`); bad++; }
}
if (existsSync('files.json')) {
  const list = JSON.parse(readFileSync('files.json', 'utf8')).files || [];
  let stale = 0;
  for (const f of list) {
    if (!existsSync(f.path)) { console.log(`::error::files.json にあるのに見つかりません：${f.path}`); bad++; continue; }
    if (!f.sha256) continue;
    let text = readFileSync(f.path, 'utf8');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    text = text.replace(/\r/g, '');
    const hex = createHash('sha256').update(text, 'utf8').digest('hex');
    if (!hex.startsWith(f.sha256)) { console.log(`::warning file=${f.path}::files.json の記録と中身がちがいます（tools/チェック を実行してからアップロードしてください）`); stale++; }
  }
  console.log(`files.json：${list.length}件（中身がちがうもの ${stale}件）`);
} else {
  console.log('::warning::files.json がありません（tools/チェック を実行すると作られます）');
}
console.log(`必要なファイル ${need.size}件、見つからないもの ${bad}件`);
process.exit(bad ? 1 : 0);
