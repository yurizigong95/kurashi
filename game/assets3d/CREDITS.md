# 3D素材のクレジット（assets3d）

画面に出すクレジット：**3D素材：Kenney・ambientCG ほか（CC0）**（素材を足した人は、この行と rail-view.js の同じ文を、使ったサイト名に合わせる）

このフォルダの `.glb` は、下の10のパックから選んだモデルを、このゲーム用に作り直したもの
（向き・大きさをそろえ、色を頂点にうつし、テクスチャはなし。いくつかは部品を組み合わせて1つの建物にした）です。
どれも Kenney の CC0（パブリックドメイン）です。地面のテクスチャ（下の表）は ambientCG の CC0 です。

| パック | 作者・入手先 | ライセンス | このゲームで使ったもの |
|---|---|---|---|
| Train Kit (1.1) | Kenney — https://kenney.nl/assets/train-kit | CC0 1.0 (http://creativecommons.org/publicdomain/zero/1.0/) | 列車6種（electric-city-a, electric-bullet-a, locomotive-b, tram-modern, locomotive-passenger-a）、貨車4種 |
| City Kit Suburban (2.0) | Kenney — https://kenney.nl/assets/city-kit-suburban | CC0 1.0 | 家10種、育った町の家6種、植えこみ・低いさく・街路樹 |
| City Kit Commercial (2.1) | Kenney — https://kenney.nl/assets/city-kit-commercial | CC0 1.0 | 町のビル6種、高層ビル6種、ひさし・日よけ・パラソル |
| Nature Kit (2.1) | Kenney — https://kenney.nl/assets/nature-kit | CC0 1.0 | 木16種（季節の色はゲーム側でぬる）、岩・石、草・花・しげみ、畑と作物、切り株・まき、さく、テント、カヌー、石碑、木の橋 |
| Mini Characters (1.0) | Kenney — https://kenney.nl/assets/mini-characters | CC0 1.0 | 社長（character-male-d、スーツの色はプレイヤーの色） |
| Watercraft Kit (2.1) | Kenney — https://kenney.nl/assets/watercraft-kit | CC0 1.0 | 海の船10種（漁船・ヨット・タグボート・貨物船・客船ほか）とブイ、港の船 |
| Car Kit (3.1) | Kenney — https://kenney.nl/assets/car-kit | CC0 1.0 | 町の車12種（乗用車・バン・トラック・タクシー・パトカー・救急車・ごみ収集車・トラクター） |
| Fantasy Town Kit (2.0) | Kenney — https://kenney.nl/assets/fantasy-town-kit | CC0 1.0 | 観光の古い町：壁と屋根の部品を組み合わせた木造の家と塔、噴水、市場の屋台、荷車、街灯、旗、風車の羽根、水車 |
| Holiday Kit (2.0) | Kenney — https://kenney.nl/assets/holiday-kit | CC0 1.0 | 冬の飾り：雪の木、かざった木、雪だるま、雪山、雪の岩、街灯、プレゼント、そり、ベンチ、トナカイ |
| City Kit Industrial (2.0) | Kenney — https://kenney.nl/assets/city-kit-industrial | CC0 1.0 | 工業の建物9種、大きな煙突、タンク、給水塔、コンテナ |

各パックの `License.txt`（作成日つき）は `scratchpad/assets/kenney/<パック>/License.txt` にあります。
作り直しの手順は `scratchpad/tools/bake.js`（自作。外からダウンロードしたプログラムは使っていません）。

## ファイル

| ファイル | 中身 | 読みこむ順 |
|---|---|---|
| trains.glb | 列車6種 | 1（盤に必要） |
| people.glb | 社長 | 1 |
| houses.glb | 家10種 | 1 |
| towns.glb | 育った町の建物 18種 | 2（かざり） |
| nature.glb | 木・岩・草花・畑など 42種 | 2 |
| props.glb | ひさし・パラソル・植えこみ・貨車など 14種 | 2 |
| industry.glb | 工場・煙突・タンク・給水塔・コンテナ 13種 | 2 |
| oldtown.glb | 古い町の家・塔・噴水・屋台・風車など 14種 | 2 |
| boats.glb | 船 11種 | 2 |
| cars.glb | 車 12種 | 2 |
| winter.glb | 冬の木と飾り 14種 | 2 |

門松（かどまつ）は このゲームで作ったもの（手作り）です。

キャラクターの 貧乏神・キラ坊、マスのタイルとアイコン、駅舎、旗・光の柱などは、このゲームのオリジナル（手作り）です。

## 地面のテクスチャ（ambientCG、CC0）

地面を近くで見たときの細かい模様（色・凹凸・高さ）。ambientCG の 1K-JPG を、1024 と 512 の大きさに作り直して軽くしたもの
（`ground-<名前>-c.jpg`＝色、`-n.jpg`＝凹凸 NormalGL、`-c512/-n512`＝スマホ用、`-h512`＝高さ）。2026-09-27 に公式サイトから入手。

| ファイル | 素材 | 作者・入手先 | ライセンス |
|---|---|---|---|
| ground-grass-* | Grass 004 | ambientCG (Lennart Demes) — https://ambientcg.com/view?id=Grass004 | CC0 1.0 |
| ground-rock-* | Rock 051 | ambientCG — https://ambientcg.com/view?id=Rock051 | CC0 1.0 |
| ground-sand-* | Ground 080（浜の砂） | ambientCG — https://ambientcg.com/view?id=Ground080 | CC0 1.0 |
| ground-dune-* | Ground 093 C（砂漠の砂丘） | ambientCG — https://ambientcg.com/view?id=Ground093C | CC0 1.0 |
| ground-soil-* | Ground 048（土） | ambientCG — https://ambientcg.com/view?id=Ground048 | CC0 1.0 |
| ground-snow-* | Snow 010 A | ambientCG — https://ambientcg.com/view?id=Snow010A | CC0 1.0 |

元の zip は `scratchpad/assets/ambientcg/` にあります。縮小は Windows の System.Drawing で行いました（外のプログラムは使っていません）。

## モンスターの バトル場の 地面（Poly Haven、CC0）— CHARS worker

| ファイル | 素材 | 作者・入手先 | ライセンス |
|---|---|---|---|
| chars-arena-dirt.png | Baseball Playground（ふみかためた 土）の Diffuse 1K | Poly Haven（Guillaume Monsergent）— https://polyhaven.com/a/baseball_playground | CC0 1.0 |

2026-09-27 に公式サイト（dl.polyhaven.org）から 1K-JPG を入手し、ブラウザの canvas で 512×512 に縮めて、バトル場の 砂の色に
あわせて明るくしたもの（PNG）。元のファイルは `scratchpad/chars-dev/dl/`。パソコンの バトル場だけで 読みこみ、スマホと
オフラインの ともだちファイルでは 読まない（そのときは 手作りの 色の地面）。モンスター・貧乏神・キング・キラ坊の 形と色は、
すべて このゲームの オリジナル（手作り）で、外の素材は つかっていません。
