/* くらしの手帳：設定 */
/* ============================== 設定 ============================== */
function viewSettings(){
  var c = S.commute;
  var look = foldSection('s1', '見た目', uiStyleNow().name + '・' + ((THEMES.filter(function(t){ return t.id===S.ui.theme; })[0] || THEMES[0]).name) +
      (uiFontNow().css ? '・' + uiFontNow().name : ''),
    styleSettings() + fontSettings() +
    '<label class="f">カラー（背景ごと変わります）</label><div class="themes">'+
      THEMES.map(function(t){
        var sw = t.custom ? 'linear-gradient(150deg,'+(S.ui.customColor||'#E8C8E8')+','+(S.ui.customColor||'#E8C8E8')+')'
                          : 'linear-gradient(150deg,'+t.sw[0]+','+t.sw[1]+')';
        return '<button data-act="set-theme" data-v="'+t.id+'" class="'+(S.ui.theme===t.id?'on':'')+'">'+
          '<span class="sw" style="background:'+sw+'"></span>'+t.name+'</button>'; }).join('')+
    '</div>'+
    '<label class="f">背景の変わり方</label>'+
    '<div class="pillrow">'+
      [['fixed','自分で選ぶ'],['season','季節で'],['time','時間で'],['mix','季節と時間']].map(function(o){
        return '<button data-act="bg-mode" data-v="'+o[0]+'" class="'+((S.ui.bgMode||'fixed')===o[0]?'on':'')+'">'+o[1]+'</button>';
      }).join('')+
    '</div>'+
    '<p class="note" style="margin:-4px 0 10px">'+
      ((S.ui.bgMode||'fixed')==='season' ? 'いまは'+SEASON_NAME[seasonNow()]+'。春はさくら色、夏はミント色、秋はピーチ色、冬はそら色。'
       : (S.ui.bgMode==='time') ? 'いまは'+BAND_NAME[timeBandNow()]+'。明け方・朝・昼・夕方・夜・深夜で色が移ります。'
       : (S.ui.bgMode==='mix') ? 'いまは'+SEASON_NAME[seasonNow()]+'の'+BAND_NAME[timeBandNow()]+'。季節の色に、時間帯の空気を重ねます。'
       : '下の色から自分で選べます。')+'</p>'+
    '<label class="f">背景のイラスト</label>'+
    '<div class="pillrow">'+
      [[0,'なし'],[1,'ひかえめ'],[2,'ふつう'],[3,'にぎやか']].map(function(o){
        return '<button data-act="decor-lv" data-v="'+o[0]+'" class="'+(decorLevel()===o[0]?'on':'')+'">'+o[1]+'</button>';
      }).join('')+
    '</div>'+
    (decorLevel()>0
      ? '<label class="f">動き</label><div class="pillrow">'+
        '<button data-act="decor-move" data-v="0" class="'+(S.ui.decorMove===0?'on':'')+'">止める</button>'+
        '<button data-act="decor-move" data-v="1" class="'+(S.ui.decorMove!==0?'on':'')+'">動かす</button>'+
        '</div>'
      : '')+
    '<p class="note" style="margin:-4px 0 10px">'+
      (function(){
        var c = (typeof decorNow==='function') ? decorNow() : null;
        return c ? '<b>いまは「'+esc(c.d.name)+'」の絵</b>が出ています。雪や花びらが落ちる動きも付けられます。'
                 : '行事・時間帯・季節に合わせて、背景にそっと絵が出ます。';
      })()+'</p>'+
    '<label class="f">行事のかざり</label>'+
    '<div class="pillrow">'+
      '<button data-act="fes-mode" data-v="0" class="'+(S.ui.fesMode===0?'on':'')+'">つけない</button>'+
      '<button data-act="fes-mode" data-v="1" class="'+(S.ui.fesMode!==0?'on':'')+'">つける</button>'+
    '</div>'+
    '<p class="note" style="margin:-4px 0 10px">'+
      (S.ui.fesMode===0
        ? 'クリスマス・お正月・七夕・ひなまつり・こどもの日・お月見・紅葉・ハロウィン・バレンタイン・節分・梅雨・真夏、そして祝日に、その日らしい色になります。'
        : (festivalNow()
            ? '<b>いまは「'+esc(FES_NAME[festivalNow()])+'」の色</b>になっています。'
            : 'いまは行事の日ではないので、ふだんの色です。次の行事になると自動で変わります。'))+'</p>'+
    '<div class="pair" style="align-items:center;margin-bottom:11px">'+
      '<div style="flex:0 0 auto"><label class="f">好きな色を作る</label>'+
        '<input type="color" id="cc_pick" value="'+esc(S.ui.customColor||'#E8C8E8')+'" style="width:64px;height:44px;padding:3px;border-radius:14px"></div>'+
      '<button class="btn ghost" style="align-self:flex-end;margin-bottom:0" data-act="set-custom">この色にする</button></div>'+
    '<p class="note" style="margin:-4px 0 10px">選んだ色から、背景・文字・ボタンの色を自動で作ります。</p>'+
    '<label class="f">お気に入りの色（5個まで）</label>'+
    '<div class="themes" style="grid-template-columns:repeat(6,minmax(0,1fr));margin-bottom:6px">'+
      (S.ui.myColors||[]).map(function(c,i){
        return '<button data-act="mycolor-use" data-c="'+esc(c)+'" class="'+(S.ui.theme==='custom'&&S.ui.customColor===c?'on':'')+'">'+
          '<span class="sw" style="background:'+esc(c)+'"></span>'+
          '<span class="s2" style="font-size:.9em">'+(i+1)+'</span></button>';
      }).join('')+
      ((S.ui.myColors||[]).length < 5 ? '<button data-act="mycolor-add"><span class="sw" style="background:var(--glass2);border-style:dashed">＋</span>追加</button>' : '')+
    '</div>'+
    ((S.ui.myColors||[]).length ? '<div class="pillrow">'+(S.ui.myColors||[]).map(function(c,i){
        return '<button class="mini" data-act="mycolor-del" data-i="'+i+'">'+(i+1)+'を消す</button>'; }).join('')+'</div>' : '')+
    '<label class="f">祝日の授業</label>'+
    '<div class="pillrow">'+
      '<button data-act="hol-class" data-v="0" class="'+(!S.settings.classOnHoliday?'on':'')+'">祝日は休み</button>'+
      '<button data-act="hol-class" data-v="1" class="'+(S.settings.classOnHoliday?'on':'')+'">祝日も授業あり</button>'+
    '</div>'+
    '<p class="note" style="margin:-4px 0 10px">祝日に授業がある日は、時間割タブの「補講」で登録もできます。</p>'+
    '<label class="f">締切が近いと知らせる</label>'+
    '<div class="pillrow">'+[[0,'知らせない'],[1,'1日前'],[3,'3日前'],[7,'7日前']].map(function(o){
      return '<button data-act="due-lead" data-v="'+o[0]+'" class="'+((toNum(S.ui.dueLead)||0)===o[0]?'on':'')+'">'+o[1]+'</button>';
    }).join('')+'</div>'+
    '<label class="f">やることの並び</label>'+
    '<div class="pillrow">'+
      '<button data-act="todo-sort" data-v="0" class="'+(!S.ui.todoByPri?'on':'')+'">締切の近い順</button>'+
      '<button data-act="todo-sort" data-v="1" class="'+(S.ui.todoByPri?'on':'')+'">大事さの順</button>'+
    '</div>'+
    '<label class="f">テストの進みぐあいの段階</label>'+
    '<div class="pillrow">'+
      '<button data-act="prog-scale" data-v="3" class="'+((S.ui.progScale||3)===3?'on':'')+'">3段階</button>'+
      '<button data-act="prog-scale" data-v="5" class="'+(S.ui.progScale===5?'on':'')+'">5段階</button>'+
      '<button data-act="prog-show" class="'+(S.ui.showProg!==0?'on':'')+'">'+(S.ui.showProg!==0?'表示する':'表示しない')+'</button>'+
    '</div>'+

    '<label class="tg"><input type="checkbox" id="cbWeather"'+(S.ui.weather?' checked':'')+'>三田の天気とバス遅延の注意を表示する</label>')

;
  var chSec = (typeof charaSettings === 'function')
    ? foldSection('chara', 'キャラクター', (charaLevel() ? charaNow().name + '・' : '') + CHARA_LEVELS[charaLevel()][1], charaSettings()) : '';
  return look + chSec + (photoOpen ? photoPicker() : '') + storageBox() + trashBox() + kindSettings() + weekFilterSettings() + tabSettings() + pageSettings() + diaSettings()
  + foldSection('s2', '通学の時間', '合計 '+commuteTotal()+'分',
    '<div class="grid3" style="margin-bottom:11px">'+
      '<div><label class="f">家→バス停</label><input id="cm_walk" inputmode="numeric" value="'+toNum(c.walk)+'"></div>'+
      '<div><label class="f">バス</label><input id="cm_bus" inputmode="numeric" value="'+toNum(c.bus)+'"></div>'+
      '<div><label class="f">三宮乗換</label><input id="cm_change" inputmode="numeric" value="'+toNum(c.change)+'"></div>'+
      '<div><label class="f">電車</label><input id="cm_train" inputmode="numeric" value="'+toNum(c.train)+'"></div>'+
      '<div><label class="f">駅→大学</label><input id="cm_school" inputmode="numeric" value="'+toNum(c.toSchool)+'"></div>'+
      '<div><label class="f">余裕</label><input id="cm_buffer" inputmode="numeric" value="'+toNum(c.buffer)+'"></div>'+
    '</div>'+
    '<label class="f">各時限の開始時刻（目安。大学の実際の時刻に直してください）</label>'+
    '<div class="grid3" style="margin-bottom:11px">'+
      c.periods.map(function(p,i){
        return '<div><label class="f">'+(i+1)+'限 開始</label><input type="time" id="cm_p'+i+'" value="'+esc(p)+'"></div>'+
               '<div><label class="f">'+(i+1)+'限 終了</label><input type="time" id="cm_e'+i+'" value="'+esc(c.ends[i]||'')+'"></div>';
      }).join('')+
    '</div>'+
    '<button class="btn ghost" data-act="save-commute">通学の設定を保存</button>')

  + foldSection('s3', '大切な日・バイト', null,
    '<div class="field"><label class="f">履修登録の締切日</label><input type="date" id="st_reg" value="'+esc(S.settings.regDeadline||'')+'"></div>'+
    '<div class="pair" style="margin-bottom:11px">'+
      '<div><label class="f">三宮での乗換に見る時間（分）</label><input id="st_tr" inputmode="numeric" value="'+(toNum(S.transit.sannomiyaTransfer)||10)+'"></div>'+
      '<div><label class="f">バイト開始の何分前に着くか</label><input id="st_wb" inputmode="numeric" value="'+(toNum(S.transit.workBuffer)||10)+'"></div></div>'+
    '<div class="pair" style="margin-bottom:11px">'+
      '<div><label class="f">三井住友の引落日</label><input id="sy_smbc" inputmode="numeric" value="'+S.settings.smbcDay+'"></div>'+
      '<div><label class="f">楽天の引落日</label><input id="sy_rakuten" inputmode="numeric" value="'+S.settings.rakutenDay+'"></div></div>'+
    '<div class="pair" style="margin-bottom:11px">'+
      '<div><label class="f">平日の分給（円）</label><input id="st_min1" inputmode="decimal" value="'+(Number(S.settings.minWeekday)||0)+'"></div>'+
      '<div><label class="f">土日の分給（円）</label><input id="st_min2" inputmode="decimal" value="'+(Number(S.settings.minWeekend)||0)+'"></div></div>'+
    '<div class="pair" style="margin-bottom:11px">'+
      '<div><label class="f">1回あたりの交通費（円）</label><input id="st_fare" inputmode="numeric" value="'+toNum(S.settings.fare)+'"></div>'+
      '<div><label class="f">バイト先の既定名</label><input id="st_shop" value="'+esc(S.settings.shop||'')+'"></div></div>'+
    '<p class="note" style="margin:-4px 0 10px">分給×（勤務分＋残業分）＋交通費で計算します。時給にすると平日'+yen(Math.round((Number(S.settings.minWeekday)||0)*60))+'／土日'+yen(Math.round((Number(S.settings.minWeekend)||0)*60))+'です。給料は毎月15日締め・25日払いとして扱います。</p>'+
    '<button class="btn ghost" data-act="save-days">保存する</button>')

  + foldSection('s4', '端末どうしの同期', syncPhase()[1], syncSettings())

  + foldSection('s5', 'AIそうだん・写真の読み取り', (S.settings.geminiKey?'登録済み':'未登録'),
    '<div class="field"><label class="f">Gemini APIキー</label>'+
    '<input id="sy_key" type="password" value="'+esc(S.settings.geminiKey||'')+'" placeholder="AQ.Ab… または AIza…"></div>'+
    '<button class="btn ghost" data-act="save-key">保存する</button>'+
    '<label class="f">AIのかしこさ</label>'+
    '<div class="pillrow">'+AI_MODELS.map(function(m){
      return '<button data-act="ai-model" data-v="'+esc(m[0])+'" class="'+((S.settings.geminiModel||'')===m[0]?'on':'')+'">'+esc(m[1])+'</button>';
    }).join('')+'</div>'+
    '<p class="note" style="margin:-4px 0 10px">'+esc(modelNote(S.settings.geminiModel))+
      (S.settings.aiLastModel ? '（前回つながったのは '+esc(S.settings.aiLastModel)+'）' : '')+'</p>'+
    '<label class="f">AIの話し方</label>'+
    '<div class="pillrow">'+AI_TONES.map(function(t2){
      return '<button data-act="ai-tone" data-v="'+t2.id+'" class="'+((S.ui.aiTone||'friendly')===t2.id?'on':'')+'">'+t2.name+'</button>';
    }).join('')+'</div>'+
    '<label class="f">書き方</label>'+
    '<div class="pillrow">'+
      '<button data-act="ai-style" data-v="bullet" class="'+((S.ui.aiStyle||'bullet')==='bullet'?'on':'')+'">箇条書き</button>'+
      '<button data-act="ai-style" data-v="text" class="'+(S.ui.aiStyle==='text'?'on':'')+'">文章</button>'+
    '</div>'+
    '<div class="note">Google AI Studio（aistudio.google.com）で無料でもらえます。いまは <b>AQ.</b> で始まるキーが発行されます（以前の AIza… でも動きます）。「相談」タブでAIに相談できるようになります。この端末だけに保存され、同期されません。</div>')

  + (typeof voiceSettings === 'function' ? foldSection('voice', '声・AIの登録', S.ui.voiceEngine === 'gemini' ? 'AIの声' : '端末の声', voiceSettings()) : '')

  + foldSection('gas', 'Google連携（カレンダー・ドライブ・ToDo・通知）', gasReady() ? '✓ つながっています' : '未設定', gasSettings())
  + (typeof gasPlusSettings === 'function' ? foldSection('gasplus', 'ほかの端末・Gmail・AIの読み取り・スプレッドシート',
      !gasReady() ? (gasSharedUrl() ? 'コードでつなげます' : '未設定') : toNum(GAS.ver) >= 3 ? 'v3' : '新しい版にしてください', gasPlusSettings()) : '')
  + (typeof kmSettingsHtml === 'function' ? kmSettingsHtml('gas') : '')
  + (typeof notifySettings === 'function' ? foldSection('notify', '通知（スマホ・Discord）', notifyPrefs().push || notifyPrefs().discord ? 'オン' : 'オフ', notifySettings()) : '')
  + (typeof linksSettings === 'function' ? foldSection('links', 'iPhone・ショートカット・ウィジェット', shortKey() ? '準備OK' : '未設定', linksSettings()) : '')
  + (typeof tasksSettings === 'function' ? foldSection('gtasks', 'Google ToDoリスト', linkPrefs().tasks ? '同期中' : 'オフ', tasksSettings()) : '')
  + (typeof placeSettings === 'function' ? foldSection('place', '学校の場所', linkPrefs().place ? '登録ずみ' : '未登録', placeSettings()) : '')
  + (typeof kmSettingsHtml === 'function' ? kmSettingsHtml('') : '')     /* 足した機能の設定 */

  + foldSection('s6', 'ファイルでのバックアップ', null,
    '<div class="pair"><button class="btn ghost" data-act="export">ファイルに保存</button>'+
    '<button class="btn ghost" data-act="import">読み込む</button></div>'+
    '<input type="file" accept="application/json,.json" id="imp" class="hide">'+
    '<div class="note">機種変更のときや、念のための保存に使えます。読み込むと、今の内容に足し合わせます。</div>')

  + foldSection('errlog', 'エラーの記録', errLogAll().length ? errLogAll().length+'件' : 'なし', errLogBox())
  + (typeof opsSettings === 'function' ? foldSection('ops', 'エラーの自動送信（Sentry）', OPS.sentryOn ? 'オン' : 'オフ', opsSettings()) : '')
  + (typeof perfSettings === 'function' ? foldSection('perf', '表示の速さ', null, perfSettings()) : '')
  + (typeof verSettings === 'function' ? foldSection('ver', 'アプリの版・アップロード', APP_BUILD, verSettings()) : '')

  + foldSection('whatsnew', 'この版で変わったこと', APP_BUILD, whatsNewHtml());
}
/* ===== エラーの記録 ===== */
function errLogBox(){
  var a = errLogAll().slice().reverse();
  if(!a.length) return '<div class="empty" style="padding:8px 0">エラーは記録されていません。</div>';
  return a.slice(0, 50).map(function(x){
    return '<div class="row"><div class="tick" style="background:#D93A2F"></div><div class="grow">'+
      '<div class="t">'+esc(x.w)+(x.c > 1 ? '<span class="b cat" style="margin-left:6px">'+x.c+'回</span>' : '')+'</div>'+
      '<div class="s">'+esc(new Date(x.t).toLocaleString('ja-JP'))+'・版 '+esc(x.b||'')+'</div>'+
      '<div class="s" style="white-space:pre-wrap;word-break:break-all">'+esc(x.m)+'</div></div></div>';
  }).join('')+
  '<div class="pillrow" style="margin-top:10px">'+
    '<button class="mini" data-act="errlog-copy">まとめてコピー</button>'+
    '<button class="mini" data-act="errlog-clear">記録を消す</button></div>'+
  '<p class="note">困ったときは「まとめてコピー」して、相談するときに貼り付けてください。</p>';
}
/* 「◯分前」の言い方 */
function agoText(t){
  t = Number(t) || 0;
  if(!t) return 'まだ';
  var s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if(s < 60) return 'たった今';
  if(s < 3600) return Math.floor(s/60) + '分前';
  if(s < 86400) return Math.floor(s/3600) + '時間前';
  if(s < 86400*30) return Math.floor(s/86400) + '日前';
  var d = new Date(t);
  return (d.getMonth()+1) + '/' + d.getDate();
}
/* ===== 設定：端末どうしの同期 ===== */
function syncSettings(){
  var ph = syncPhase();
  var h = (ph[0] === 'ok')
    ? '<div class="msg ok" style="margin-bottom:12px"><b>同期済み</b>　スマホ・iPad・パソコンの内容が自動でそろいます。</div>'
    : (ph[0] === 'test')
    ? '<div class="msg" style="margin-bottom:12px"><b>テストモード</b>　この画面では本物のデータを使いません。</div>'
    : '<div class="bn '+(ph[0] === 'ng' ? 'red' : 'amber')+'" style="margin-bottom:12px"><span class="ic">!</span><span><b>'+esc(ph[1])+'</b>'+
      (ph[2] ? '<br>'+esc(ph[2]) : '')+'</span></div>';
  if(syncState.permDenied){
    h += '<div class="box" style="margin-bottom:12px;background:rgba(255,255,255,.55)">'+
      '<div class="t" style="font-weight:700;margin-bottom:6px">Firebaseのルールを直す手順</div>'+
      '<ol class="steps">'+
        '<li><a href="https://console.firebase.google.com/" target="_blank" rel="noopener">Firebaseコンソール</a>を開き、プロジェクト「kurashi-59562」を選ぶ</li>'+
        '<li>左のメニューの「Firestore Database」→ 上の「ルール」を開く</li>'+
        '<li>書いてあるものを<b>ぜんぶ消して</b>、下の「ルールをコピー」で写したものを貼り付ける</li>'+
        '<li>「公開」を押す → 1分ほど待って、この画面の「もう一度つなぐ」を押す</li>'+
      '</ol>'+
      '<pre class="rules">'+esc(firebaseRulesText())+'</pre>'+
      '<button class="btn ghost" data-act="copy-rules">ルールをコピー</button>'+
      '<p class="note">このルールは「部屋のID（'+esc(DEFAULT_ROOM)+'）で始まる文書だけ」を読み書きできるようにします。</p></div>';
  }
  if(location.protocol === 'file:'){
    h += '<div class="bn red" style="margin-bottom:12px"><span class="ic">!</span><span>'+
      '<b>保存したファイルを直接ひらいています。</b><br>この開き方だと同期できません。<b>https://yurizigong95.github.io/kurashi/</b> から開くか、ホーム画面のアイコンを使ってください。</span></div>';
  }
  h += '<div class="pillrow">'+
    (!syncState.on ? '<button class="mini" data-act="sync-retry">もう一度つなぐ</button>'
                   : '<button class="mini" data-act="sync-now">今すぐ同期する</button>')+
    (Date.now() < syncState.pauseUntil ? '<button class="mini" data-act="sync-resume">休止をやめる</button>' : '')+
    '<button class="mini" data-act="go-errlog">エラーの記録を見る</button></div>';

  /* この端末 */
  h += '<label class="f" style="margin-top:6px">この端末の名前</label>'+
    '<div class="pair" style="margin-bottom:10px"><input id="dev_name" value="'+esc(DEV.name||'')+'" placeholder="例：わたしのiPhone" maxlength="20">'+
    '<button class="btn ghost" style="flex:0 0 auto;padding:11px 16px" data-act="dev-rename">変える</button></div>';

  /* 使っている端末の一覧 */
  var devs = syncState.devices || {};
  var ids = Object.keys(devs).sort(function(a,b){ return (Number(devs[b].at)||0) - (Number(devs[a].at)||0); });
  if(ids.length){
    h += '<label class="f">同期している端末</label>'+ids.map(function(id){
      var d = devs[id] || {};
      var old = d.build && d.build !== APP_BUILD;
      return '<div class="row"><div class="tick" style="background:'+(id===DEV.id?'var(--accent)':old?'#D93A2F':'#3FA36B')+'"></div>'+
        '<div class="grow"><div class="t">'+esc(d.name||'端末')+(id===DEV.id?'<span class="b cat" style="margin-left:6px">この端末</span>':'')+'</div>'+
        '<div class="s">'+agoText(d.at)+'に使用・版 '+esc(d.build||'?')+
        (old ? '　<b style="color:#B3261E">'+(d.build < APP_BUILD ? '古い版です。開き直してください' : 'こちらより新しい版です')+'</b>' : '')+'</div></div></div>';
    }).join('');
  }
  var lg = syncState.legacy;
  if(lg && lg.at && Date.now() - lg.at < 14*86400000 && lg.at > (Number((devs[DEV.id]||{}).at)||0) - 14*86400000){
    h += '<div class="bn amber" style="margin:8px 0"><span class="ic">!</span><span>'+
      '<b>前のしくみの端末</b>（版 '+esc(lg.build)+'）が'+agoText(lg.at)+'に使われました。その端末でアプリを開き直すと、新しいしくみに切り替わります。'+
      '（その端末の内容は、こちらに取りこみ済みです）</span></div>';
  }

  /* 写真 */
  var pc = photoCloudStats();
  h += '<label class="f" style="margin-top:8px">写真の同期</label>'+
    '<div class="pillrow">'+
      '<button data-act="photo-sync" data-v="1" class="'+(photoSyncOn()?'on':'')+'">この端末の写真も送る</button>'+
      '<button data-act="photo-sync" data-v="0" class="'+(!photoSyncOn()?'on':'')+'">送らない</button>'+
    '</div>'+
    '<div class="row"><div class="grow s">同期にある写真</div><div class="t num">'+
      (pc.ready ? pc.count+'枚・'+sizeText(pc.bytes) : '—')+(pc.queued || pc.busy ? '（送っています：のこり'+pc.queued+'枚）' : '')+'</div></div>'+
    '<p class="note" style="margin-top:4px">「送らない」にしても、ほかの端末の写真は見られます。</p>'+
    (typeof photoSyncSettings === 'function' ? photoSyncSettings() : '');

  /* くわしい情報 */
  var rp = (syncState.remote && syncState.remote.parts) || {};
  h += '<div class="row"><div class="grow s">このアプリの版</div><div class="t num">'+APP_BUILD+'</div></div>'+
    '<div class="row"><div class="grow s">最後に送った／受け取った</div><div class="t num">'+agoText(syncState.pushedAt)+'／'+agoText(syncState.pulledAt)+'</div></div>'+
    '<div class="row"><div class="grow s">送っているデータ（圧縮後）</div><div class="t num">'+
      (syncState.size ? sizeText(syncState.size)+'・'+Object.keys(rp).length+'つに分けて保存' : '—')+'</div></div>'+
    '<div class="row"><div class="grow"><div class="s">いまの件数</div><div class="t num" style="margin-top:2px">'+
      '予定'+S.events.length+'・課題'+S.tasks.length+'・テスト'+S.exams.length+'・バイト'+S.shifts.length+'・メモ'+S.notes.length+'</div></div></div>'+
    '<div class="note">予定・課題・テスト・バイト・メモ・ToDo・支払い・収支・履修・時間割・出席・成績・休講・長いお休み・'+
      'そうだんの会話・ふりかえり・ゴミ箱・見た目や並びの設定・時給などの設定・<b>写真</b>まで、すべて自動でそろいます。<br>'+
      '<b>APIキー</b>と<b>Google連携の合言葉</b>だけは、大事な鍵なので端末ごとに入れてください。</div>';
  return h;
}
function settingsAction(act, t){
  if(act==='dev-rename'){
    var nm = val('dev_name').trim().slice(0, 20);
    if(!nm){ toast('名前を入れてください', true); return true; }
    DEV.name = nm; saveDevice(); pushRemote(true); toast('この端末の名前を「'+nm+'」にしました'); render(); return true;
  }
  if(act==='photo-size'){ SYNC_LOCAL.photoSize = t.dataset.v; saveSyncLocal(); toast('送る写真の大きさを変えました'); render(); return true; }
  if(act==='photo-store'){ SYNC_LOCAL.photoStore = t.dataset.v; saveSyncLocal(); if(t.dataset.v==='storage'){ photoCloud.failed = {}; } toast(t.dataset.v==='storage' ? 'これからの写真は Firebase Storage に送ります' : 'これからの写真はいつもの方法で送ります'); render(); return true; }
  if(act==='copy-text'){ navigator.clipboard.writeText(t.dataset.text||'').then(function(){ toast('コピーしました'); }, function(){ toast('コピーできませんでした', true); }); return true; }
  if(act==='photo-sync'){
    SYNC_LOCAL.photoSync = toNum(t.dataset.v) ? 1 : 0; saveSyncLocal();
    if(SYNC_LOCAL.photoSync){ photoCloud.failed = {}; photoUploadScan(); }
    toast(SYNC_LOCAL.photoSync ? 'この端末の写真も送ります' : 'この端末の写真は送りません'); render(); return true;
  }
  if(act==='errlog-copy'){
    var txt = errLogAll().map(function(x){
      return new Date(x.t).toLocaleString('ja-JP') + ' [' + x.w + '] ' + x.m + (x.c > 1 ? '（' + x.c + '回）' : '') + '（版 ' + x.b + '）';
    }).join('\n') + '\n端末：' + DEV.name + ' / ' + navigator.userAgent;
    navigator.clipboard.writeText(txt).then(function(){ toast('コピーしました'); }, function(){ toast('コピーできませんでした', true); });
    return true;
  }
  if(act==='errlog-clear'){
    if(!confirm('エラーの記録を消しますか？')) return true;
    try{ localStorage.removeItem(ERRLOG_KEY); }catch(e){}
    toast('消しました'); render(); return true;
  }
  if(act==='copy-rules'){
    navigator.clipboard.writeText(firebaseRulesText()).then(function(){ toast('ルールをコピーしました。Firebaseのルールの画面に貼り付けてください'); },
      function(){ toast('コピーできませんでした。上の文字を長押しして写してください', true); });
    return true;
  }
  if(act==='sync-resume'){ syncState.pauseUntil = 0; syncState.writes = []; pushRemote(true); toast('同期を再開しました'); render(); return true; }
  if(act==='go-errlog'){
    S.ui.setOpen = S.ui.setOpen || {}; S.ui.setOpen.errlog = 1; render();
    setTimeout(function(){ var el = document.querySelector('[data-id="errlog"]'); if(el) el.scrollIntoView({ block:'start', behavior:'smooth' }); }, 50);
    return true;
  }
  if(act==='set-style'){
    var stNew = UI_STYLES.filter(function(s){ return s.id === t.dataset.v; })[0];
    if(!stNew) return true;
    S.ui.style = stNew.id; touch('ui'); applyUi(); toast('「' + stNew.name + '」にしました'); commit(); return true;
  }
  if(act==='set-font'){
    var fnNew = UI_FONTS.filter(function(f){ return f.id === t.dataset.v; })[0];
    if(!fnNew) return true;
    S.ui.font = fnNew.id; touch('ui'); applyUi(); toast('文字を「' + fnNew.name + '」にしました'); commit(); return true;
  }
  if(act==='set-theme'){ S.ui.theme = t.dataset.v; touch('ui'); applyUi(); toast('テーマを変えました'); commit(); return true; }
  if(act==='mycolor-add'){
    var v0 = val('cc_pick');
    if(!/^#[0-9a-fA-F]{6}$/.test(v0)){ toast('上の色えらびで色を決めてから押してください', true); return true; }
    S.ui.myColors = (S.ui.myColors||[]);
    if(S.ui.myColors.length >= 5){ toast('お気に入りは5個までです', true); return true; }
    if(S.ui.myColors.indexOf(v0) >= 0){ toast('もう入っています', true); return true; }
    S.ui.myColors.push(v0); touch('ui'); toast('お気に入りに入れました'); commit(); return true;
  }
  if(act==='mycolor-use'){
    S.ui.customColor = t.dataset.c; S.ui.theme = 'custom'; touch('ui'); applyUi(); toast('色を変えました'); commit(); return true;
  }
  if(act==='mycolor-del'){
    S.ui.myColors.splice(toNum(t.dataset.i), 1); touch('ui'); toast('消しました'); commit(); return true;
  }
  if(act==='hol-class'){ S.settings.classOnHoliday = toNum(t.dataset.v) ? 1 : 0; toast(S.settings.classOnHoliday?'祝日も授業ありにしました':'祝日は休みにしました'); commit(); return true; }
  if(act==='due-lead'){ S.ui.dueLead = toNum(t.dataset.v); touch('ui'); commit(); return true; }
  if(act==='todo-sort'){ S.ui.todoByPri = toNum(t.dataset.v) ? 1 : 0; touch('ui'); commit(); return true; }
  if(act==='prog-scale'){ S.ui.progScale = toNum(t.dataset.v); touch('ui'); commit(); return true; }
  if(act==='prog-show'){ S.ui.showProg = (S.ui.showProg===0) ? 1 : 0; touch('ui'); commit(); return true; }
  if(act==='auto-clean'){
    S.ui.autoClean = (S.ui.autoClean === 0) ? 1 : 0;
    touch('ui'); toast(S.ui.autoClean ? '自動で消します' : '自動では消しません'); commit(); return true;
  }
  if(act==='photo-list'){
    photoKeys().then(function(ks){
      window.__photoList = ks.filter(function(k9){ return String(k9).indexOf('chimg_') !== 0; });
      photoOpen = true; render();
    });
    return true;
  }
  if(act==='photo-close'){ photoOpen = false; photoPick = {}; render(); return true; }
  if(act==='photo-pick'){
    var pid3 = t.dataset.id;
    photoPick[pid3] = photoPick[pid3] ? 0 : 1;
    var el = t.closest ? t.closest('.mphoto') : null;
    if(el){
      el.classList.toggle('picked', !!photoPick[pid3]);
      var mk = el.querySelector('.pickmark');
      if(photoPick[pid3] && !mk){ var sp=document.createElement('span'); sp.className='pickmark'; sp.textContent='✓'; el.appendChild(sp); }
      if(!photoPick[pid3] && mk) mk.remove();
      /* 件数だけ書き替える */
      var btn = document.querySelector('[data-act="photo-del-sel"]');
      var cnt = Object.keys(photoPick).filter(function(k){ return photoPick[k]; }).length;
      if(btn){ btn.textContent = 'えらんだ'+(cnt||'')+'枚を消す'; btn.disabled = !cnt; btn.className = cnt ? 'btn' : 'btn ghost'; }
    }
    return true;
  }
  if(act==='photo-del-sel'){
    var ids = Object.keys(photoPick).filter(function(k){ return photoPick[k]; });
    if(!ids.length) return true;
    if(!confirm(ids.length+'枚の写真を消しますか？　もどせません。')) return true;
    Promise.all(ids.map(function(id4){ return photoDel(id4); })).then(function(){
      /* 予定やメモからも外す */
      [S.events,S.tasks,S.exams,S.shifts,S.notes].forEach(function(arr){
        (arr||[]).forEach(function(o){
          if((o.photos||[]).length){
            var before = o.photos.length;
            o.photos = o.photos.filter(function(x){ return ids.indexOf(x) < 0; });
            if(o.photos.length !== before) o.mt = Date.now();
          }
        });
      });
      Object.keys(S.memos||{}).forEach(function(k){
        var mm = S.memos[k];
        if(mm && (mm.photos||[]).length) mm.photos = mm.photos.filter(function(x){ return ids.indexOf(x) < 0; });
      });
      photoPick = {};
      photoKeys().then(function(ks){ window.__photoList = ks.filter(function(k9){ return String(k9).indexOf('chimg_') !== 0; }); photoUsage().then(function(u){ window.__photoQuota = u; toast(ids.length+'枚を消しました'); commit(); }); });
    });
    return true;
  }
  if(act==='img-clean'){
    var mon = toNum(t.dataset.m) || 3;
    if(!confirm(mon+'か月より古い写真を消します。金額やメモの記録は残ります。よろしいですか？')) return true;
    var limYm = addMonths(thisYm(), -mon);
    var n = 0;
    /* 明細の写真 */
    S.statements.forEach(function(x){
      if(String(x.billingMonth||'') && String(x.billingMonth) < limYm){
        try{ localStorage.removeItem(imgKey(x.id)); x.hasImage = false; n++; }catch(e){}
      }
    });
    /* 予定・メモの写真 */
    var limD = addMonths(thisYm(), -mon) + '-01';
    var killIds = [];
    var drop = function(arr, dateKey){
      (arr||[]).forEach(function(o){
        var d = o[dateKey] || '';
        if(d && d < limD && (o.photos||[]).length){
          o.photos.forEach(function(pid){ killIds.push(pid); n++; });
          o.photos = []; o.mt = Date.now();
        }
      });
    };
    drop(S.events,'date'); drop(S.tasks,'due'); drop(S.exams,'date'); drop(S.shifts,'date');
    /* 大きい入れもの（IndexedDB）からも、ちゃんと消す */
    Promise.all(killIds.map(function(pid){ return photoDel(pid); })).then(function(){
      photoUsage().then(function(u){ window.__photoQuota = u; render(); });
    });
    toast(n+'枚の写真を消しました'); commit(); return true;
  }
  if(act==='storage-recount'){
    window.__photoQuota = null; render();
    photoUsage().then(function(u){ window.__photoQuota = u; toast('数え直しました'); render(); });
    return true;
  }
  if(act==='img-orphan'){
    /* どこからも使われていない写真を消す */
    var used = {};
    [S.events,S.tasks,S.exams,S.shifts,S.notes].forEach(function(arr){
      (arr||[]).forEach(function(o){ (o.photos||[]).forEach(function(pid){ used[pid]=1; }); });
    });
    Object.keys(S.memos||{}).forEach(function(k){ ((S.memos[k]||{}).photos||[]).forEach(function(pid){ used[pid]=1; }); });
    if(typeof charaPhotoIds === 'function') charaPhotoIds().forEach(function(pid){ used[pid]=1; });   /* 自分で作ったキャラの画像は残す */
    photoKeys().then(function(ks){
      var kill = ks.filter(function(id5){ return !used[id5]; });
      return Promise.all(kill.map(function(id6){ return photoDel(id6); })).then(function(){
        toast(kill.length ? kill.length+'枚の迷子の写真を消しました' : '迷子の写真はありませんでした');
        photoUsage().then(function(u){ window.__photoQuota = u; render(); });
      });
    });
    return true;
  }
  if(act==='decor-lv'){
    var v = toNum(t.dataset.v);
    S.ui.decorLv = v; S.ui.decor = v ? 1 : 0;
    touch('ui'); applyDecor();
    toast(['イラストを消しました','ひかえめにしました','ふつうにしました','にぎやかにしました'][v]);
    commit(); return true;
  }
  if(act==='decor-move'){
    S.ui.decorMove = toNum(t.dataset.v) ? 1 : 0;
    touch('ui'); applyDecor();
    toast(S.ui.decorMove ? '動かします' : '止めました');
    commit(); return true;
  }
  if(act==='fes-mode'){
    S.ui.fesMode = toNum(t.dataset.v) ? 1 : 0; touch('ui'); applyUi();
    toast(S.ui.fesMode ? '行事のかざりをつけました' : '行事のかざりを外しました');
    commit(); return true;
  }
  if(act==='bg-mode'){
    S.ui.bgMode = t.dataset.v;
    S.ui.season = (t.dataset.v==='season'||t.dataset.v==='mix') ? 1 : 0;
    touch('ui'); applyUi();
    toast(({fixed:'自分で選ぶ', season:SEASON_NAME[seasonNow()]+'の色', time:BAND_NAME[timeBandNow()]+'の色', mix:'季節と時間'})[t.dataset.v]+'にしました');
    commit(); return true;
  }
  if(act==='set-custom'){
    var v = val('cc_pick');
    if(!/^#[0-9a-fA-F]{6}$/.test(v)){ toast('色を選んでください', true); return true; }
    S.ui.customColor = v; S.ui.theme = 'custom'; touch('ui'); applyUi(); toast('色を変えました'); commit(); return true;
  }
  if(act==='set-fs'){ S.ui.fs = t.dataset.v; touch('ui'); applyUi(); toast('文字の大きさを変えました'); commit(); return true; }
  if(act==='save-commute'){
    S.commute.walk=toNum(val('cm_walk')); S.commute.bus=toNum(val('cm_bus'));
    S.commute.change=toNum(val('cm_change')); S.commute.train=toNum(val('cm_train'));
    S.commute.toSchool=toNum(val('cm_school')); S.commute.buffer=toNum(val('cm_buffer'));
    for(var i=0;i<6;i++){
      var v=val('cm_p'+i); if(minutesOf(v)!=null) S.commute.periods[i]=v;
      var e=val('cm_e'+i); if(minutesOf(e)!=null) S.commute.ends[i]=e;
    }
    touch('commute'); toast('通学の設定を保存しました'); commit(); return true;
  }
  if(act==='save-days'){
    S.settings.smbcDay = Math.min(31, Math.max(1, toNum(val('sy_smbc'))||27));
    S.settings.rakutenDay = Math.min(31, Math.max(1, toNum(val('sy_rakuten'))||27));
    var rg = val('st_reg'); S.settings.regDeadline = isYmd(rg) ? rg : '';
    S.settings.minWeekday = Math.max(0, Number(val('st_min1'))||0);
    S.settings.minWeekend = Math.max(0, Number(val('st_min2'))||0);
    S.settings.fare = Math.max(0, toNum(val('st_fare')));
    S.settings.shop = val('st_shop').trim() || 'デリフランス';
    S.transit.sannomiyaTransfer = Math.max(0, toNum(val('st_tr'))); S.transit.workBuffer = Math.max(0, toNum(val('st_wb'))); touch('transit');
    toast('保存しました'); commit(); return true;
  }
  if(act==='sync-now'){ syncNow(); return true; }
  if(act==='sync-retry'){
    syncState.retry = 0; syncState.connecting = false; fbLoad = null;
    syncState.msg = '接続しています…'; render(); initSync(); return true;
  }
  if(act==='save-key'){ S.settings.geminiKey = val('sy_key').trim(); persist(); toast('保存しました'); render(); return true; }
  if(act==='fold'){
    S.ui.setOpen = S.ui.setOpen || {};
    var fid = t.dataset.id;
    S.ui.setOpen[fid] = S.ui.setOpen[fid] ? 0 : 1;
    touch('ui'); persist(); render();
    /* 開いた見出しが見えるように */
    setTimeout(function(){
      var el = document.querySelector('[data-act="fold"][data-id="'+fid+'"]');
      if(el && S.ui.setOpen[fid]) el.scrollIntoView({block:'start', behavior:'smooth'});
    }, 30);
    return true;
  }
  if(act==='trash-back'){ trashRestore(toNum(t.dataset.i)); return true; }
  if(act==='trash-clear'){
    if(!confirm('ゴミ箱をぜんぶ捨てますか？　戻せなくなります。')) return true;
    S.trash = []; toast('からにしました'); commit(); return true;
  }
  if(act==='ics-alarm'){ S.ui.icsAlarm = toNum(t.dataset.v) ? 1 : 0; touch('ui'); commit(); return true; }
  if(act==='ics-a1'){ S.ui.icsAlarm1 = toNum(t.dataset.v); touch('ui'); commit(); return true; }
  if(act==='ics-a2'){ S.ui.icsAlarm2 = toNum(t.dataset.v); touch('ui'); commit(); return true; }
  if(act==='export'){
    download(new Blob([JSON.stringify(Object.assign({ app:'kurashi', version:4 }, payload()))],{type:'application/json'}),
      'kurashi_'+thisYm()+'.json');
    S.backupAt = Date.now(); persist();
    toast('バックアップを保存しました'); render(); return true;
  }
  if(act==='import'){ document.getElementById('imp').click(); return true; }
  return false;
}

/* ===== 設定：タブの表示と並び ===== */
function tabSettings(){
  var names = {}; TAB_DEFS.forEach(function(t){ names[t[0]] = t[1]==='⚙' ? '設定' : t[1]; });
  return foldSection('tabSettings', 'タブの表示と順番', null,
    S.ui.tabs.map(function(t, i){
      var id = t[0], on = !!t[1];
      return '<div class="row"><div class="grow"><div class="t">'+esc(names[id]||id)+'</div></div>'+
        '<button class="mini" data-act="tab-up" data-i="'+i+'"'+(i===0?' disabled':'')+'>↑</button>'+
        '<button class="mini" data-act="tab-down" data-i="'+i+'"'+(i===S.ui.tabs.length-1?' disabled':'')+'>↓</button>'+
        (id==='set' ? '<span class="b cr">常に表示</span>' : '<button class="mini" data-act="tab-toggle" data-i="'+i+'" style="'+(on?'background:linear-gradient(180deg,var(--accent2),var(--accent));color:#fff;border-color:rgba(255,255,255,.6)':'')+'">'+(on?'表示':'非表示')+'</button>')+'</div>';
    }).join('')+'<p class="note">非表示にしたタブは設定からいつでも戻せます。「履修」は抽選のシミュレーターです。</p>');
}
function pageSettings(){
  var appNames = { today:'今日', cal:'予定', todo:'ToDo', money:'お金', risyu:'履修（抽選）' };
  var pageNames = { today:'今日 › 今日', week:'今日 › 今週', life:'今日 › くらし', cal:'予定 › カレンダー', tt:'時間割',
    course:'授業', money:'お金 › ホーム', in:'お金 › 収支', work:'お金 › バイト', todo:'ToDo' };
  var accentBtn = 'background:linear-gradient(180deg,var(--accent2),var(--accent));color:#fff;border-color:rgba(255,255,255,.6)';
  var h = '';
  /* サブタブ */
  h += foldSection('subTabSet', 'タブの中のタブ（順番・表示）', null,
    Object.keys(SUBTAB_DEFS).map(function(app){
      var list = subTabs(app);
      return '<div style="margin-bottom:14px"><div class="s2" style="font-weight:700;color:var(--ink);margin-bottom:6px">'+esc(appNames[app]||app)+'</div>'+
        list.map(function(t, i){
          var hidden = !!(S.ui.subHide[app] && S.ui.subHide[app][t[0]]);
          var visibleCount = list.filter(function(x){ return !(S.ui.subHide[app] && S.ui.subHide[app][x[0]]); }).length;
          return '<div class="row"><div class="grow"><div class="t"'+(hidden?' style="color:var(--sub)"':'')+'>'+esc(t[1])+'</div></div>'+
            '<button class="mini" data-act="sub-up" data-p="'+app+'" data-i="'+i+'"'+(i===0?' disabled':'')+'>↑</button>'+
            '<button class="mini" data-act="sub-down" data-p="'+app+'" data-i="'+i+'"'+(i===list.length-1?' disabled':'')+'>↓</button>'+
            '<button class="mini" data-act="subtab-toggle" data-p="'+app+'" data-id="'+t[0]+'" style="'+(hidden?'':accentBtn)+'"'+(!hidden&&visibleCount<=1?' disabled':'')+'>'+(hidden?'非表示':'表示')+'</button></div>';
        }).join('')+'</div>';
    }).join('')+'<p class="note">最後の1つは非表示にできません。</p>');
  /* ページの項目 */
  h += foldSection('pageItemSet', '各ページの項目（順番・表示）', null,
    Object.keys(pageNames).map(function(pg){
      var labels = {}; (PAGE_SECTIONS[pg]||[]).forEach(function(x){ labels[x[0]]=x[1]; });
      return '<div style="margin-bottom:14px"><div class="s2" style="font-weight:700;color:var(--ink);margin-bottom:6px">'+esc(pageNames[pg])+'</div>'+
        pageOrder(pg).map(function(id, i, arr){
          var hidden = pageHidden(pg, id);
          return '<div class="row"><div class="grow"><div class="t"'+(hidden?' style="color:var(--sub)"':'')+'>'+esc(labels[id]||id)+'</div></div>'+
            '<button class="mini" data-act="pg-up" data-p="'+pg+'" data-i="'+i+'"'+(i===0?' disabled':'')+'>↑</button>'+
            '<button class="mini" data-act="pg-down" data-p="'+pg+'" data-i="'+i+'"'+(i===arr.length-1?' disabled':'')+'>↓</button>'+
            '<button class="mini" data-act="pg-toggle" data-p="'+pg+'" data-id="'+id+'" style="'+(hidden?'':accentBtn)+'">'+(hidden?'非表示':'表示')+'</button></div>';
        }).join('')+'</div>';
    }).join(''));
  return h;
}
function todaySettings(){
  var names = {}; TODAY_SECTIONS.forEach(function(t){ names[t[0]] = t[1]; });
  return section('今日ページの枠の順番', null,
    S.ui.todayOrder.map(function(id, i){
      return '<div class="row"><div class="grow"><div class="t">'+esc(names[id]||id)+'</div></div>'+
        '<button class="mini" data-act="tsec-up" data-i="'+i+'"'+(i===0?' disabled':'')+'>↑</button>'+
        '<button class="mini" data-act="tsec-down" data-i="'+i+'"'+(i===S.ui.todayOrder.length-1?' disabled':'')+'>↓</button></div>';
    }).join('')+'<p class="note">枠の見出しをタップすると折りたためます。</p>');
}
function diaSettings(){
  var names = { busGo:'行き：弥生ヶ丘五丁目→三ノ宮（バス）', trainGo:'行き：三ノ宮→鳴尾（電車）', trainBack:'帰り：鳴尾→三ノ宮（電車）', busBack:'帰り：三ノ宮→三田（バス）', busWork:'バイト：三ノ宮→イオンモール神戸北（バス）' };
  var cu = S.transit.custom || {};
  var fav = S.transit.fav || [];
  return foldSection('diaSettings', 'ダイヤの追加・お気に入り', null,
    (fav.length ? '<div class="s2" style="margin-bottom:6px">お気に入りの便</div>'+fav.map(function(k){
      var a = k.split(':');
      return '<div class="row"><div class="grow t">'+(a[0]==='go'?'行き':'帰り')+'　バス'+esc(a[1]||'—')+'／電車'+esc(a[2])+'</div>'+
        '<button class="mini" data-act="tr-fav" data-key="'+esc(k)+'">外す</button></div>';
    }).join('') : '<p class="note">行き方の便で ☆ を押すとお気に入りに入ります。</p>')+
    '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--rule)">'+
    '<div class="field"><label class="f">どのダイヤに足す？</label><select id="dia_kind">'+Object.keys(names).map(function(k){ return '<option value="'+k+'">'+names[k]+'</option>'; }).join('')+'</select></div>'+
    '<div class="pair" style="margin-bottom:11px"><div><label class="f">発</label><input type="time" id="dia_dep"></div><div><label class="f">着</label><input type="time" id="dia_arr"></div>'+
      '<button class="btn ghost" style="flex:0 0 auto;align-self:flex-end" data-act="dia-add">追加</button></div>'+
    Object.keys(cu).map(function(k){
      var list = cu[k]||[]; if(!list.length) return '';
      return '<div class="s2" style="margin-top:6px">'+esc(names[k])+'（自分で追加）</div>'+list.map(function(p,i){
        return '<div class="row"><div class="grow t num">'+esc(p[0])+' → '+esc(p[1])+'</div><button class="mini" data-act="dia-del" data-k="'+k+'" data-i="'+i+'">削除</button></div>';
      }).join('');
    }).join('')+'</div>');
}
function viewNews(){
  var list = S.notices.slice().reverse();
  return section('お知らせの履歴', list.length ? list.length+'件' : null,
    (list.length ? list.slice(0,60).map(function(n){
      return '<div class="bn '+(n.level||'blue')+'" style="margin-bottom:6px"><span class="ic">•</span><span>'+esc(n.text)+
        '<div class="s2" style="margin-top:2px">'+new Date(n.mt).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})+'</div></span></div>';
    }).join('') : '<div class="empty">今日ページに出たお知らせがここに残ります。</div>')+
    (list.length ? '<button class="btn ghost" style="margin-top:10px" data-act="news-clear">履歴を消す</button>' : ''));
}
function settingsAction2(act, t){
  var mv = function(arr, i, d){ var j=i+d; if(j<0||j>=arr.length) return; var x=arr[i]; arr[i]=arr[j]; arr[j]=x; };
  if(act==='tab-up'){ mv(S.ui.tabs, toNum(t.dataset.i), -1); touch('ui'); commit(); return true; }
  if(act==='tab-down'){ mv(S.ui.tabs, toNum(t.dataset.i), 1); touch('ui'); commit(); return true; }
  if(act==='tab-toggle'){ var tb=S.ui.tabs[toNum(t.dataset.i)]; if(tb && tb[0]!=='set'){ tb[1]=tb[1]?0:1; touch('ui'); commit(); } return true; }
  if(act==='tsec-up'){ mv(S.ui.todayOrder, toNum(t.dataset.i), -1); touch('ui'); commit(); return true; }
  if(act==='tsec-down'){ mv(S.ui.todayOrder, toNum(t.dataset.i), 1); touch('ui'); commit(); return true; }
  if(act==='sub-up' || act==='sub-down'){
    var ap = t.dataset.p, arr = S.ui.subOrder[ap] || subTabs(ap).map(function(x){ return x[0]; });
    var si = toNum(t.dataset.i), sj = si + (act==='sub-up'?-1:1);
    if(sj>=0 && sj<arr.length){ var tmp2=arr[si]; arr[si]=arr[sj]; arr[sj]=tmp2; S.ui.subOrder[ap]=arr; touch('ui'); commit(); }
    return true;
  }
  if(act==='subtab-toggle'){
    var ap2 = t.dataset.p, sid = t.dataset.id;
    S.ui.subHide[ap2] = S.ui.subHide[ap2] || {};
    var willHide = !S.ui.subHide[ap2][sid];
    if(willHide && subVisible(ap2).length <= 1){ toast('最後の1つは隠せません', true); return true; }
    S.ui.subHide[ap2][sid] = willHide ? 1 : 0;
    touch('ui'); commit(); return true;
  }
  if(act==='pg-up' || act==='pg-down'){
    var pg = t.dataset.p, arr = pageOrder(pg), i = toNum(t.dataset.i), j = i + (act==='pg-up'?-1:1);
    if(j>=0 && j<arr.length){ var tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp; S.ui.pageOrder[pg]=arr; touch('ui'); commit(); }
    return true;
  }
  if(act==='pg-toggle'){
    var pg2 = t.dataset.p, id2 = t.dataset.id;
    S.ui.pageHide[pg2] = S.ui.pageHide[pg2] || {};
    S.ui.pageHide[pg2][id2] = S.ui.pageHide[pg2][id2] ? 0 : 1;
    touch('ui'); commit(); return true;
  }
  if(act==='wday-toggle'){
    S.ui.weekClosed = S.ui.weekClosed || {};
    var dk = t.dataset.d;
    S.ui.weekClosed[dk] = S.ui.weekClosed[dk] ? 0 : 1;
    touch('ui'); persist(); pushRemote(); render(); return true;
  }
  if(act==='wk-off'){ weekOff += toNum(t.dataset.v); render(); window.scrollTo(0,0); return true; }
  if(act==='wk-set'){ weekOff = toNum(t.dataset.v); render(); window.scrollTo(0,0); return true; }
  if(act==='today-toggle'){ var id=t.dataset.id; S.ui.todayClosed[id] = S.ui.todayClosed[id]?0:1; touch('ui'); persist(); pushRemote(); render(); return true; }
  if(act==='cal-add'){
    evDraft = newDraft(calSel);
    calEdit = null; calTab = 'add'; render(); window.scrollTo(0,0);
    return true;
  }
  if(act==='fd-preset'){
    var v = t.dataset.v;
    if(v==='work'){ findFrom='sannomiya'; findTo='work'; }
    else if(v==='go'){ findFrom='home'; findTo='univ'; }
    else { findFrom='univ'; findTo='home'; }
    /* 時刻が空なら、いまの時刻でさがす */
    if(!findTime){ var nw=new Date(); findTime = pad(nw.getHours())+':'+pad(nw.getMinutes()); }
    render();
    setTimeout(function(){
      var el=document.getElementById('fd_result');
      if(el) el.scrollIntoView({block:'center', behavior:'smooth'});
    }, 50);
    return true;
  }
  if(act==='fd-day'){ findDate = t.dataset.v || ''; render(); return true; }
  if(act==='fd-mode'){
    findMode = t.dataset.v;
    var row = t.parentNode;
    if(row) Array.prototype.forEach.call(row.querySelectorAll('button'), function(bb){ bb.classList.toggle('on', bb.dataset.v===findMode); });
    var bx = document.getElementById('fd_result');
    if(bx && findTime){ bx.innerHTML = findRoute(findFrom, findTo, findTime, findMode) || ''; }
    return true;
  }
  if(act==='fd-go'){
    var fh = document.getElementById('fd_h'), fm2 = document.getElementById('fd_m');
    var ff = document.getElementById('fd_from'), ft = document.getElementById('fd_to');
    if(ff) findFrom = ff.value;
    if(ft) findTo = ft.value;
    if(fh && fm2){
      var hs = String(fh.value).replace(/[^0-9]/g,'');
      var ms = String(fm2.value).replace(/[^0-9]/g,'');
      if(hs === '' && ms === ''){
        /* 空なら、いまの時刻でさがす */
        var nw = new Date();
        findTime = pad(nw.getHours())+':'+pad(nw.getMinutes());
        fh.value = pad(nw.getHours()); fm2.value = pad(nw.getMinutes());
      }else{
        var H = Math.max(0, Math.min(23, toNum(hs)));
        var M = Math.max(0, Math.min(59, toNum(ms)));
        findTime = pad(H)+':'+pad(M);
      }
    }
    /* 結果のところだけ書き替える（画面の位置は変えない） */
    var box = document.getElementById('fd_result');
    if(box){
      var y = window.scrollY;
      var top = box.getBoundingClientRect().top;
      box.innerHTML = findRoute(findFrom, findTo, findTime, findMode) || '';
      /* 高さが変わってもズレないように、結果の位置を合わせる */
      requestAnimationFrame(function(){
        var nt = box.getBoundingClientRect().top;
        window.scrollTo(0, y + (nt - top));
      });
    }else render();
    return true;
  }
  if(act==='leave-now'){
    var now = new Date(), td2 = today();
    S.transitLog = (S.transitLog||[]).filter(function(r){ return r.date!==td2; });
    var cls = schoolClassesForDate(td2);
    var target = cls.length ? minutesOf(S.commute.periods[cls[0].period-1]) : null;
    var nowMin = now.getHours()*60 + now.getMinutes();
    S.transitLog.push({ date:td2, at:pad(now.getHours())+':'+pad(now.getMinutes()),
      min:null, target:target, nowMin:nowMin });
    if(S.transitLog.length > 120) S.transitLog = S.transitLog.slice(-120);
    touch('transitLog'); toast('出発を記録しました'); commit(); return true;
  }
  if(act==='leave-undo'){
    var td3 = today();
    S.transitLog = (S.transitLog||[]).filter(function(r){ return r.date!==td3; });
    touch('transitLog'); commit(); return true;
  }
  if(act==='tr-fav'){
    var k=t.dataset.key, f=S.transit.fav||[]; var i=f.indexOf(k);
    if(i>=0) f.splice(i,1); else f.push(k);
    S.transit.fav=f; touch('transit'); toast(i>=0?'お気に入りから外しました':'お気に入りに入れました'); commit(); return true;
  }
  if(act==='dia-add'){
    var k2=val('dia_kind'), dep=val('dia_dep'), arr=val('dia_arr');
    if(minutesOf(dep)==null||minutesOf(arr)==null){ toast('発と着の時刻を入れてください', true); return true; }
    S.transit.custom = S.transit.custom||{}; S.transit.custom[k2]=(S.transit.custom[k2]||[]).concat([[dep,arr]]);
    touch('transit'); toast('ダイヤを足しました'); commit(); return true;
  }
  if(act==='dia-del'){
    var k3=t.dataset.k, i3=toNum(t.dataset.i);
    if(S.transit.custom && S.transit.custom[k3]){ S.transit.custom[k3].splice(i3,1); touch('transit'); commit(); }
    return true;
  }
  if(act==='news-clear'){ S.notices=[]; commit(); return true; }
  return false;
}


/* ===== 写真とデータの容量 ===== */
/* localStorage（文字のデータ）の使用量。だいたい1文字=2バイトで数える */
function storageInfo(){
  var total = 0, imgs = 0, other = 0;
  try{
    for(var i=0;i<localStorage.length;i++){
      var k = localStorage.key(i), v = localStorage.getItem(k) || '';
      var b = (k.length + v.length) * 2;          /* 1文字=2バイトで概算 */
      total += b;
      if(k.indexOf('shiharai:img:')===0 || k.indexOf('shiharai:memoimg:')===0) imgs += b; else other += b;
    }
  }catch(e){}
  var limit = 5 * 1024 * 1024;
  return { total:total, imgs:imgs, other:other, limit:limit, pct:Math.min(100, Math.round(total/limit*100)) };
}
function mb(b){ return (b/1024/1024).toFixed(2)+' MB'; }
/* 大きさを読みやすく（KB／MB／GB） */
function sizeText(b){
  b = Number(b) || 0;
  if(b < 1024) return b + ' B';
  if(b < 1024*1024) return Math.round(b/1024) + ' KB';
  if(b < 1024*1024*1024) return (b/1024/1024).toFixed(b < 10*1024*1024 ? 1 : 0) + ' MB';
  return (b/1024/1024/1024).toFixed(1) + ' GB';
}
var photoPick = {}, photoOpen = false;
function storageBox(){
  var st = storageInfo();
  var q = window.__photoQuota || null;
  var txtPct = Math.min(100, Math.round(st.total / st.limit * 100));
  var body;
  if(!q){
    body = '<div class="s2" style="margin-bottom:10px">容量を調べています…</div>';
  }else{
    var free = (q.estimateOk && q.quota) ? Math.max(0, q.quota - q.used) : 0;
    var phPct = (q.estimateOk && q.quota) ? Math.min(100, Math.round(q.used / q.quota * 100)) : 0;
    body =
      '<p class="note" style="margin-top:0">この端末には、データを入れる<b>入れものが2つ</b>あります。</p>'+
      /* 1) 文字の入れもの */
      '<div class="stbox"><div class="row"><div class="grow"><div class="t">① 文字の入れもの</div>'+
        '<div class="s">予定・課題・メモ・会話など　<b>'+sizeText(st.total)+'</b> ／ 上限 約5MB</div></div>'+
        '<span class="b cat">'+txtPct+'%</span></div>'+
      '<div class="bar" style="margin:6px 0 6px"><i class="'+(txtPct>=80?'over':txtPct>=50?'':'done')+'" style="width:'+Math.max(2,txtPct)+'%"></i></div>'+
      '<p class="note" style="margin:0">「約5MB」は、ブラウザ（SafariやChrome）が文字データ用に決めている大きさです。どの端末でもほぼ同じで、増やせません。文字だけなら、ふつうはいっぱいになりません。</p></div>'+
      /* 2) 写真の入れもの */
      '<div class="stbox"><div class="row"><div class="grow"><div class="t">② 写真の入れもの</div>'+
        '<div class="s">写真 <b>'+q.count+'枚・'+sizeText(q.bytes)+'</b>'+
        ((q.estimateOk && q.quota) ? ' ／ あと約 <b>'+sizeText(free)+'</b> 入ります' : '')+'</div></div>'+
        ((q.estimateOk && q.quota) ? '<span class="b cat">'+phPct+'%</span>' : '')+'</div>'+
      ((q.estimateOk && q.quota) ? '<div class="bar" style="margin:6px 0 6px"><i class="'+(phPct>=80?'over':phPct>=50?'':'done')+'" style="width:'+Math.max(2,phPct)+'%"></i></div>' : '')+
      '<p class="note" style="margin:0">'+
        ((q.estimateOk && q.quota)
          ? '「あと約'+sizeText(free)+'」は、この端末の空き容量をもとに、ブラウザが「このアプリが使ってよい」と決めた目安です。端末の空きが減ると小さくなります。'
          : 'このブラウザは、写真の入れものの空きを教えてくれません。')+
        (q.biggest ? 'いちばん大きい写真は '+sizeText(q.biggest)+' です。' : '')+'</p></div>';
  }
  return foldSection('storageBox', '写真とデータの容量',
    q ? (q.count+'枚・'+sizeText(q.bytes)) : '調べています…',
    body+
    '<div class="pillrow" style="margin-top:10px">'+
      '<button class="mini" data-act="photo-list">写真をえらんで消す</button>'+
      '<button class="mini" data-act="storage-recount">数え直す</button>'+
      '<button class="mini" data-act="auto-clean" style="'+(S.ui.autoClean!==0?'background:linear-gradient(180deg,var(--accent2),var(--accent));color:#fff;border-color:rgba(255,255,255,.6)':'')+'">終わった課題の写真を自動で消す'+(S.ui.autoClean!==0?'（オン）':'（オフ）')+'</button>'+
      '<button class="mini" data-act="img-clean" data-m="3">3か月より古いのを消す</button>'+
      '<button class="mini" data-act="img-clean" data-m="6">6か月より古いのを消す</button>'+
      '<button class="mini" data-act="img-orphan">迷子の写真を消す</button>'+
    '</div>'+
    '<p class="note">写真の大きさは、この端末に入っている写真を1枚ずつ数えた本当の合計です。写真と文字は、どちらも同期されます（設定 › 端末どうしの同期）。</p>');
}
/* 写真をえらんで消す */
function photoPicker(){
  var list = window.__photoList || [];
  if(!list.length) return section('写真をえらんで消す', null, '<div class="empty">写真がありません。</div>');
  var n = Object.keys(photoPick).filter(function(k){ return photoPick[k]; }).length;
  return section('写真をえらんで消す', n ? n+'枚えらんでいます' : list.length+'枚',
    '<div class="mphotos">'+list.map(function(id){
      return '<div class="mphoto'+(photoPick[id]?' picked':'')+'" data-act="photo-pick" data-id="'+id+'">'+
        '<img data-pid="'+id+'" alt="写真">'+
        (photoPick[id] ? '<span class="pickmark">✓</span>' : '')+'</div>';
    }).join('')+'</div>'+
    '<div class="pair" style="margin-top:10px">'+
      '<button class="btn'+(n?'':' ghost')+'" data-act="photo-del-sel"'+(n?'':' disabled')+'>えらんだ'+(n||'')+'枚を消す</button>'+
      '<button class="btn ghost" style="flex:0 0 auto;padding:13px 16px" data-act="photo-close">とじる</button></div>');
}


/* ===== 予定の種類を自分で作る・直す ===== */
function ensureKinds(){
  if(!Array.isArray(S.ui.kinds)) S.ui.kinds = kindsAll().map(function(k){ return { id:k.id, name:k.name, hex:k.hex, fg:k.fg }; });
  return S.ui.kinds;
}
function kindSettings(){
  /* 見るだけでは保存しない（直したときに ensureKinds で作る） */
  var base = Array.isArray(S.ui.kinds) ? S.ui.kinds : kindsAll().map(function(k){ return { id:k.id, name:k.name, hex:k.hex, fg:k.fg }; });
  var list = base.filter(function(k){ return !k.del; });
  return foldSection('kindSettings', '予定の種類', '順番・色・名前',
    list.map(function(k, i){
      return '<div class="row"><span class="kdot" style="background:'+esc(k.hex)+';width:16px;height:16px"></span>'+
        '<div class="grow"><div class="t">'+esc(k.name)+'</div></div>'+
        '<button class="mini" data-act="kind-up" data-i="'+i+'"'+(i===0?' disabled':'')+'>↑</button>'+
        '<button class="mini" data-act="kind-down" data-i="'+i+'"'+(i===list.length-1?' disabled':'')+'>↓</button>'+
        '<button class="mini" data-act="kind-edit" data-i="'+i+'">直す</button>'+
        (list.length>1 ? '<button class="mini" data-act="kind-del" data-i="'+i+'">削除</button>' : '')+'</div>';
    }).join('')+
    '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--rule)">'+
    '<div class="pair" style="margin-bottom:11px">'+
      '<div><label class="f">新しい種類の名前</label><input id="kd_name" placeholder="例：提出物"></div>'+
      '<div style="flex:0 0 80px"><label class="f">色</label><input type="color" id="kd_hex" value="#A8DCF7" style="height:44px;padding:3px"></div></div>'+
    '<button class="btn ghost" data-act="kind-add">種類を足す</button>'+
    '<p class="note">いちばん上の種類が、予定を足すときの最初の選択になります。</p></div>');
}
function kindAction(act, t){
  if(act==='kind-up' || act==='kind-down'){
    var list = ensureKinds().filter(function(k){ return !k.del; });
    var i = toNum(t.dataset.i), j = i + (act==='kind-up'?-1:1);
    if(j<0 || j>=list.length) return true;
    var all = ensureKinds();
    var ai = all.indexOf(list[i]), aj = all.indexOf(list[j]);
    var tmp = all[ai]; all[ai] = all[aj]; all[aj] = tmp;
    S.ui.kinds = all; touch('ui'); commit(); return true;
  }
  if(act==='kind-edit'){
    var list2 = ensureKinds().filter(function(k){ return !k.del; });
    var k = list2[toNum(t.dataset.i)]; if(!k) return true;
    var nm = prompt('名前', k.name); if(nm===null) return true;
    var hx = prompt('色（#RRGGBB）', k.hex); if(hx===null) return true;
    if(!/^#[0-9a-fA-F]{6}$/.test(hx)){ toast('色は #RRGGBB の形で', true); return true; }
    k.name = nm.trim() || k.name; k.hex = hx;
    /* 背景の明るさで文字色を決める */
    var r=parseInt(hx.slice(1,3),16), g=parseInt(hx.slice(3,5),16), b=parseInt(hx.slice(5,7),16);
    k.fg = (0.299*r + 0.587*g + 0.114*b) > 150 ? '#3B2030' : '#FFFFFF';
    touch('ui'); commit(); return true;
  }
  if(act==='kind-del'){
    var list3 = ensureKinds().filter(function(k){ return !k.del; });
    var k3 = list3[toNum(t.dataset.i)]; if(!k3) return true;
    if(list3.length<=1){ toast('最後の1つは消せません', true); return true; }
    if(!confirm(k3.name+' を消しますか？（この種類で登録した予定は残ります）')) return true;
    k3.del = 1; touch('ui'); commit(); return true;
  }
  if(act==='wf-toggle'){
    S.ui.weekHide = S.ui.weekHide || {};
    var kk = t.dataset.k;
    S.ui.weekHide[kk] = S.ui.weekHide[kk] ? 0 : 1;
    touch('ui'); commit(); return true;
  }
  if(act==='kind-add'){
    var nm2 = val('kd_name').trim(), hx2 = val('kd_hex');
    if(!nm2){ toast('名前を入れてください', true); return true; }
    var r2=parseInt(hx2.slice(1,3),16), g2=parseInt(hx2.slice(3,5),16), b2=parseInt(hx2.slice(5,7),16);
    ensureKinds().push({ id:uid('kd'), name:nm2, hex:hx2,
      fg:(0.299*r2+0.587*g2+0.114*b2)>150?'#3B2030':'#FFFFFF', custom:1 });
    touch('ui'); toast('種類を足しました'); commit(); return true;
  }
  return false;
}


/* ===== 今週タブに出す種類 ===== */
function weekFilterSettings(){
  var defs = kindsAll().map(function(k){ return [k.id, k.name, k.hex]; })
    .concat([['chg','休講・遠隔・補講','var(--e6)'],['pay','引き落とし',DEEPGREEN],['health','健康の期限',colorOf('c5')]]);
  var hide = S.ui.weekHide || {};
  return foldSection('weekFilterSettings', '今週タブに出す予定', '種類でしぼる',
    '<div class="kindrow">'+defs.map(function(d){
      var on = !hide[d[0]];
      return '<button data-act="wf-toggle" data-k="'+d[0]+'" class="kbtn'+(on?' on':'')+'" style="--kc:'+d[2]+';--kf:'+(kindOf(d[0]).fg||'#fff')+'">'+
        '<span class="kdot2"></span>'+esc(d[1])+'</button>';
    }).join('')+'</div>'+
    '<p class="note">選んだ種類だけが「今日 › 今週」に出ます。ToDoで足したものは、もともと出ません。</p>');
}


/* ===== 週を時間軸で見る（121）===== */
function weekTimeline(){
  var start = weekMonday();
  var H0 = 7, H1 = 23;                       /* 7時〜23時 */
  var rowH = 30;
  var days = [];
  for(var i=0;i<7;i++){ var d=new Date(start); d.setDate(start.getDate()+i); days.push(toYmd(d)); }
  var h = '<div class="wtl"><div class="wtl-head"><span class="wtl-hcol"></span>'+
    days.map(function(ymd,i){
      var d = new Date(start); d.setDate(start.getDate()+i);
      var isT = ymd===today();
      return '<span class="wtl-d'+(isT?' now':'')+'">'+WDAY[d.getDay()]+'<b>'+d.getDate()+'</b></span>';
    }).join('')+'</div><div class="wtl-body" style="height:'+((H1-H0)*rowH)+'px">'+
    '<div class="wtl-hours">'+(function(){
      var o=''; for(var hh=H0;hh<H1;hh++) o += '<span style="height:'+rowH+'px">'+hh+'</span>'; return o;
    })()+'</div>';
  days.forEach(function(ymd){
    h += '<div class="wtl-col">';
    /* 授業 */
    schoolClassesForDate(ymd).forEach(function(c){
      var st = minutesOf(S.commute.periods[c.period-1]), en = minutesOf(S.commute.ends[c.period-1]);
      if(st==null||en==null) return;
      var top = (st - H0*60)/60*rowH, hgt = (en-st)/60*rowH;
      if(top < -hgt) return;
      h += '<div class="wtl-ev cls" style="top:'+top+'px;height:'+Math.max(14,hgt)+'px;background:'+courseColor(c.name)+'22;border-color:'+courseColor(c.name)+'" title="'+esc(c.name)+'">'+
        '<span>'+esc(shortName(c.name))+'</span></div>';
    });
    /* 予定 */
    itemsOn(ymd, 1).forEach(function(x){
      var st2 = minutesOf(x.time);
      if(st2==null) return;
      var dur = 60;
      if(x.src==='work'){ var w=S.shifts.filter(function(z){return z.id===x.id;})[0]; if(w) dur = Math.max(30, shiftHours(w)*60); }
      var top2 = (st2 - H0*60)/60*rowH, hgt2 = dur/60*rowH;
      h += '<div class="wtl-ev" style="top:'+top2+'px;height:'+Math.max(14,hgt2)+'px;background:'+itemColor(x)+';color:'+itemFg(x)+'" '+
        'data-act="ev-open" data-src="'+x.src+'" data-id="'+x.id+'" title="'+esc(x.title)+'"><span>'+esc(x.title)+'</span></div>';
    });
    h += '</div>';
  });
  return h + '</div></div>';
}


/* ===== ゴミ箱（30日） ===== */
function trashBox(){
  var list = (S.trash||[]);
  return foldSection('trashBox', 'ゴミ箱', list.length ? list.length+'件' : '空っぽ',
    (list.length
      ? list.slice(0,30).map(function(t,i){
          var d = Math.floor((Date.now()-toNum(t.at))/86400000);
          return '<div class="row"><div class="grow"><div class="t">'+esc(trashLabel(t))+'</div>'+
            '<div class="s">'+(d===0?'今日':d+'日前')+'に削除　あと'+(30-d)+'日で消えます</div></div>'+
            '<button class="mini" data-act="trash-back" data-i="'+i+'">もどす</button></div>';
        }).join('')
      : '<div class="empty">消したものが30日ここに残ります。</div>')+
    (list.length ? '<button class="btn ghost" style="margin-top:10px" data-act="trash-clear">ぜんぶ捨てる</button>' : '')+
    '<p class="note">30日たつと自動で消えます。まちがえて消しても、ここから戻せます。</p>');
}

/* 画面のスタイルを選ぶ（見本つき） */
function styleSettings(){
  var cur = uiStyleNow();
  return '<label class="f">画面のスタイル（形や質感）</label>'+
    '<div class="stylegrid">'+UI_STYLES.map(function(s){
      var on = (s.id === cur.id);
      return '<button data-act="set-style" data-v="'+s.id+'" class="'+(on?'on':'')+'" aria-pressed="'+(on?'true':'false')+'">'+
        '<span class="stpv pv-'+s.id+'" aria-hidden="true"><i class="c"></i><i class="b"></i><i class="b2"></i></span>'+
        '<span class="stt">'+esc(s.tag)+'</span>'+
        '<span class="stn">'+esc(s.name)+'</span></button>';
    }).join('')+'</div>'+
    '<p class="note" style="margin:-2px 0 12px">いまは<b>「'+esc(cur.name)+'」</b>：'+esc(cur.desc)+'。下のカラーと組み合わせられます。</p>';
}

/* 文字の形（フォント）を選ぶ（見本つき） */
function fontSettings(){
  var cur = uiFontNow();
  /* 見た目を開いているときだけ、見本のために全部読みこむ（届くのは見本の字の分だけ） */
  if(S.ui.setOpen && S.ui.setOpen.s1) UI_FONTS.forEach(loadUiFont);
  return '<label class="f">文字の形（フォント）</label>'+
    '<div class="stylegrid fontgrid">'+UI_FONTS.map(function(f){
      var on = (f.id === cur.id);
      return '<button data-act="set-font" data-v="'+f.id+'" class="'+(on?'on':'')+'" aria-pressed="'+(on?'true':'false')+'">'+
        '<span class="fnpv" aria-hidden="true" style="font-family:'+esc(uiFontStack(f))+'">あいう<small>Aa</small></span>'+
        '<span class="stt">'+esc(f.tag)+'</span>'+
        '<span class="stn">'+esc(f.name)+'</span></button>';
    }).join('')+'</div>'+
    '<p class="note" style="margin:-2px 0 12px">いまは<b>「'+esc(cur.name)+'」</b>：'+esc(cur.desc)+'。'+
      (cur.gf ? 'はじめての端末では、ネットから文字を読みこむまで少しだけ時間がかかります。' : '')+'</p>';
}
