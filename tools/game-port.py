#!/usr/bin/env python3
"""ゲーム道場の新しい版に、kurashi 用のつなぎ（Gemini・Firebase の部屋・記録の同期）を入れて game/index.html にする。

   使い方（kurashi のフォルダで）：
     python3 tools/game-port.py <新しい版の html>
   新しい版は、Claude の公開ページから取った html でも、ZIP の中の chess-dojo.html でもよい。
   3D の素材（assets3d/）は、ZIP の中のものを game/assets3d/ にそのまま置く。

   つなぎの中身（Gemini・Firebase・同期）は、いまの game/index.html から取り出して使う（ここには書かない）。
   どの置きかえも「ちょうど1回」見つかることを確かめてから行う（新しい版で文が変わっていたら、止まって知らせる）。"""
import sys, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = os.path.join(ROOT, 'game', 'index.html')
if len(sys.argv) < 2:
    sys.exit(__doc__)
src = sys.argv[1]
t = open(src, encoding='utf-8').read().replace('\r\n', '\n')
cur = open(GAME, encoding='utf-8').read()

# いまの game/index.html から、つなぎの部分を取り出す
SHIM_A = '/* ---------- Gemini（AIのつなぎ先） ----------'
SHIM_B = '\n/* ---------- boot ---------- */'
SYNC_A = '<script>\n/* ===== ゲーム道場：ほかの端末と、記録をそろえる ====='
try:
    shim = cur[cur.index(SHIM_A):cur.index(SHIM_B)].rstrip('\n') + '\n'
    a = cur.index(SYNC_A)
    sync = cur[a:cur.index('</script>', a) + len('</script>')] + '\n'
except ValueError:
    sys.exit('いまの game/index.html に、つなぎの部分が見つかりません')
if SHIM_A in t or SYNC_A in t:
    sys.exit('この html には、もうつなぎが入っています（新しい版の、そのままのものを渡してください）')

def rep(old, new, count=1):
    global t
    n = t.count(old)
    if n != count:
        sys.exit('見つかった数がちがう（%d 回、期待は %d 回）：%r' % (n, count, old[:120]))
    t = t.replace(old, new)

# ---- 1. 頭（artifact の外がわの枠を、ふつうの頭にする。見た目の基本の style はそのまま） ----
# Claude の公開ページが外がわにつける、見た目の基本（ZIP の chess-dojo.html には無いので、ここで足す）
BASE = ('<style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
        'html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}'
        'img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style>')
m = re.match(r'<!doctype html><html><head><meta charset=utf8><meta name=viewport content="([^"]*)">(<style>.*?</style>)</head><body>\n', t)
if not m:
    if not t.startswith('<meta name="viewport"'):
        sys.exit('頭の形がちがう（公開ページの html か、ZIP の chess-dojo.html を渡してください）')
    t = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="">' + BASE + '</head><body>\n' + t.rstrip('\n') + '\n\n\n</body></html>'
    m = re.match(r'<!doctype html><html><head><meta charset=utf8><meta name=viewport content="([^"]*)">(<style>.*?</style>)</head><body>\n', t)
# ページ自身の頭（viewport・title・フォント・大きな style）は、<div class="app"> の前まで。そこまでを <head> に入れる
body_at = t.index('\n<div class="app">', m.end())
own_head = t[m.end():body_at]
if re.search(r'<(div|script|main|section|article|button)\b', own_head):
    sys.exit('頭の中に、からだの部品がある')
t = ('<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n'
     + m.group(2) + '\n' + own_head.strip('\n') + '\n</head>\n<body>' + t[body_at:])
rep('</body></html>', '</body>\n</html>')

# ---- 2. 画面の文（Claude のページでしか動かない、という説明を、kurashi のつなぎ先に合わせる） ----
rep('<div id="liveOff" class="note" hidden>この画面ではリアルタイム対局は使えません。Claudeのページとして開いたときだけ使えます（同じClaudeアカウントの2台の端末どうし）。離れた友達とは「コードで」を使ってください。</div>',
    '<div id="liveOff" class="note" hidden>リアルタイム対局を使うには、この端末で「くらしの手帳」をいちど開いてください（つなぎ先の設定を、そこから借ります）。離れた友達とは「コードで」を使ってください。</div>')
rep('<p class="note" style="margin:0 0 8px">同じClaudeアカウントでログインした2台の端末（あなたのスマホとパソコンなど）で遊べます。',
    '<p class="note" style="margin:0 0 8px">同じ部屋番号を入れた2台の端末（あなたのスマホとパソコンなど）で遊べます。')
rep('<p class="note">AIの返答にはあなたのClaudeの利用枠を使います。盤面の判定・ヒント・練習問題は無料で何度でも使えます。</p>',
    '<p class="note">AIの返答には、あなたのGeminiのAPIキー（無料の枠）を使います。はじめて使うときにキーを聞きます。盤面の判定・ヒント・練習問題は無料で何度でも使えます。</p>')
rep("['この画面では使えません。Claudeのページとして開いたときだけ使えます。']",
    "['リアルタイム対局を使うには、この端末で「くらしの手帳」をいちど開いてください。']")
rep('いまの言葉、本当にある？（Claudeに聞く）', 'いまの言葉、本当にある？（AIに聞く）')
rep("v.setUi({judge:'Claudeが「'+w+'」をたしかめています…'});", "v.setUi({judge:'AIが「'+w+'」をたしかめています…'});")
rep("'同じClaudeアカウントの2台の端末で遊べます。スタートで部屋を作り、もう1台で部屋番号を入れて「部屋に入る」。':'この画面ではリアルタイムは使えません（Claudeのページとして開いたときだけ）。離れた友達とは「コードで」を使ってください。'",
    "'2台の端末で遊べます。スタートで部屋を作り、もう1台で部屋番号を入れて「部屋に入る」。':'リアルタイムを使うには、この端末で「くらしの手帳」をいちど開いてください。離れた友達とは「コードで」を使ってください。'")
rep("'このゲームのAI対戦は、Claudeのページとして開いたときだけ使えます。'", "'このゲームのAI対戦には、AI（Gemini）が必要です。'")
rep('文章でくわしく答えるAIコーチは、Claudeのページとして開いたときだけ使えます。</span>', '文章でくわしく答えるAIコーチは、GeminiのAPIキーを入れると使えます。</span>')
rep("sample?'答えにはあなたのClaudeの利用枠を使います。実況・早見表・ナイス判定は無料です。':'「今どうすればいい？」はAIエンジンのおすすめを図で見せます。文章で答えるAIコーチは、Claudeのページとして開いたときだけ使えます。'",
    "sample?'答えには、あなたのGeminiのAPIキーを使います。実況・早見表・ナイス判定は無料です。':'「今どうすればいい？」はAIエンジンのおすすめを図で見せます。文章で答えるAIコーチは、GeminiのAPIキーを入れると使えます。'")
rep("PT.dialog({title:'リアルタイムはここでは使えません',html:'<p>Claudeのページとして開いたときだけ使えます。「コードで」なら使えます。</p>'",
    "PT.dialog({title:'リアルタイムはここでは使えません',html:'<p>この端末で「くらしの手帳」をいちど開くと使えます。「コードで」なら使えます。</p>'")
rep("PT.dialog({title:'リアルタイムはここでは使えません',html:'<p>Claudeのページとして開いたときだけ使えます。</p>'",
    "PT.dialog({title:'リアルタイムはここでは使えません',html:'<p>この端末で「くらしの手帳」をいちど開くと使えます。</p>'")
rep('同じ部屋番号に入ると、みんなの画面が同時に動きます（同じClaudeアカウントの端末どうし）。', '同じ部屋番号に入ると、みんなの画面が同時に動きます（同じ部屋番号を入れた端末どうし）。')
rep('<p class="note">リアルタイムは、Claudeのページとして開いたときだけ使えます。この画面では「コードで」を使ってください。</p>',
    '<p class="note">リアルタイムを使うには、この端末で「くらしの手帳」をいちど開いてください。この画面では「コードで」を使ってください。</p>')
rep('番が終わるたびにClaudeが実況します', '番が終わるたびにAIが実況します')
rep("d.by==='claude'?'この新聞はClaudeが書きました。ゲームの結果は変わりません。':'かんたん版の新聞です（Claudeのページで開くと、Claudeが記事を書きます）。'",
    "d.by==='claude'?'この新聞はAI（Gemini）が書きました。ゲームの結果は変わりません。':'かんたん版の新聞です（AIが使えるときは、AIが記事を書きます）。'")
rep("d.by==='claude'?'この自伝はClaudeが書きました。':'かんたん版の自伝です（Claudeのページで開くと、Claudeが書きます）。'",
    "d.by==='claude'?'この自伝はAI（Gemini）が書きました。':'かんたん版の自伝です（AIが使えるときは、AIが書きます）。'")
rep("(sample()?'Claudeが、その人の一生を本人の自伝にします。':", "(sample()?'AIが、その人の一生を本人の自伝にします。':")

# 画面に出る文に Claude がのこっていないか（コメントは除く）
left = []
nocom = re.sub(r'/\*.*?\*/', lambda m: '\n' * m.group(0).count('\n'), t, flags=re.S)   # 行の番号は そのまま
for i, line in enumerate(nocom.split('\n'), 1):
    s = line.strip()
    if 'Claude' not in s or s.startswith('//'):
        continue
    code = re.sub(r'(^|[^:\'"])//.*$', r'\1', s)
    if 'Claude' in code:
        left.append((i, s[:160]))
if left:
    for i, s in left:
        print('のこり', i, s)
    sys.exit('画面の文に Claude がのこっています')

# ---- 3. Gemini と Firebase のつなぎ（boot の前に入れる） ----
rep('/* ---------- boot ---------- */\n', shim + '\n/* ---------- boot ---------- */\n')
rep("  try{ sampleFn = use ? await window.claude.use('sample') : null; }catch(e){ sampleFn=null; }\n",
    "  try{ sampleFn = use ? await window.claude.use('sample') : null; }catch(e){ sampleFn=null; }\n"
    "  if(!sampleFn) sampleFn = geminiSample;   /* Claudeのページでないときは Gemini を使う */\n")
rep("  try{ dbNs = use ? await window.claude.use('db') : null; }catch(e){ dbNs=null; }\n",
    "  try{ dbNs = use ? await window.claude.use('db') : null; }catch(e){ dbNs=null; }\n"
    "  if(!dbNs && gFbCfg() && gRoomId()) dbNs = gdbNs;   /* Claudeのページでないときは、くらしの手帳と同じつなぎ先を使う */\n")
rep("  try{ const u=use ? await window.claude.use('user') : null; if(u&&await u.isOwner()&&$('ghKairo')) $('ghKairo').hidden=false; }catch(e){}\n",
    "  try{ const u=use ? await window.claude.use('user') : null; if(u&&await u.isOwner()&&$('ghKairo')) $('ghKairo').hidden=false; }catch(e){}\n"
    "  if(!use && gSettings() && $('ghKairo')) $('ghKairo').hidden=false;   /* くらしの手帳を使っている端末（持ち主の端末）だけ */\n")

# カイロ名作棚のボタンの行き先：持ち主の Netlify にある名作棚（kairo-tana-c13rdtbw。2026-09-27 に開けることを確認）
KAIRO = 'https://kairo-tana-c13rdtbw.netlify.app/'
km = re.findall(r'<a class="gh-kairo" id="ghKairo" hidden href="([^"]*)"', t)
if len(km) != 1:
    sys.exit('カイロ名作棚のボタンが見つかりません')
t = t.replace('<a class="gh-kairo" id="ghKairo" hidden href="%s"' % km[0], '<a class="gh-kairo" id="ghKairo" hidden href="%s"' % KAIRO)

# ---- 4. 記録の同期（いちばん下） ----
rep('</body>\n</html>', sync + '\n</body>\n</html>')

open(GAME, 'w', encoding='utf-8', newline='\n').write(t)
print('game/index.html を作りました（%d バイト）' % len(t.encode('utf-8')))
