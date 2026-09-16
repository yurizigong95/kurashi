/* くらしの手帳：画面の切り替え・イベント・起動 */
/* ============================== 画面の切り替え ============================== */
function APPS_VISIBLE(){
  var names = {}; TAB_DEFS.forEach(function(t){ names[t[0]] = t[1]; });
  return (S.ui.tabs||[]).filter(function(t){ return t[1] || t[0]==='set'; }).map(function(t){ return [t[0], names[t[0]]||t[0]]; });
}
var MONEY_TABS = [['home','ホーム'],['schedule','予定'],['chart','グラフ'],['stmt','明細'],['in','収支'],['work','バイト']];
var RISYU_TABS = [['tt','抽選シミュ'],['plans','履修案']];
var TODAY_TABS = [['today','今日'],['tomo','明日'],['week','今週'],['life','くらし']];
var CAL_TABS = [['cal','カレンダー'],['add','追加'],['imp','重要'],['health','健康']];
var TITLES = { today:'今日', tt:'時間割', course:'授業', money:'お金', chat:'相談', risyu:'履修（抽選）', cal:'予定', todo:'ToDo', notes:'メモ', news:'お知らせ', set:'設定' };
var FOOTS = {
  today:'天気は Open-Meteo の予報です。バスや電車の運行状況は各社の公式情報も確認してください。',
  money:'金額に分割手数料（金利）は含まれていません。引き落とし日の前日までに入金しておくと安心です。',
  risyu:'単位数は「週1コマ＝1単位／週2コマ＝2単位」での推定です。申込者数は9月7日17時00分時点。正確な単位数と科目区分はシラバスと履修便覧で確認してください。',
  cal:'予定・課題・テスト・引き落としをまとめて表示しています。',
  tt:'必修は赤・選択は青。休講や隔週は自動で反映されます。',
  course:'科目をタップすると出欠・課題・テスト・成績・メモをまとめて見られます。',
  todo:'科目を選んだ課題は、その科目の色になります。',
  chat:'アプリに登録した予定をもとに、AIが相談に乗ります。',
  notes:'ピン留めしたメモは今日ページにも出ます。',
  news:'今日ページに出たお知らせの履歴です。',
  set:'合言葉は他人に教えないでください。Firestoreのセキュリティルールを必ず設定してください。'
};

function render(){
  __rc = {};
  try{ renderInner(); }
  finally{ __rc = null; }
}
function renderInner(){
  var APPS = APPS_VISIBLE();
  /* 授業タブを一時的に開いているときは、そのまま表示する */
  if(appId === 'course' && courseTemp && !APPS.some(function(a){ return a[0]==='course'; })){
    /* 何もしない（タブには出ないが、画面は授業のまま） */
  }else if(!APPS.some(function(a){ return a[0]===appId; })){
    appId = APPS[0] ? APPS[0][0] : 'today';
    courseTemp = false;
  }
  document.getElementById('apps').setAttribute('data-n', String(APPS.length));
  document.getElementById('apps').innerHTML = '<span class="pill"></span>' + APPS.map(function(a){
    return '<button data-app="'+a[0]+'" class="'+(appId===a[0]?'on':'')+(a[0]==='set'?' ico':'')+'">'+a[1]+'</button>';
  }).join('');

  var nav = document.getElementById('nav');
  var tabs = SUBTAB_DEFS[appId] ? subVisible(appId) : null;
  if(tabs && !tabs.length) tabs = null;
  if(tabs){
    var curMap = { money:payTab, risyu:risyuTab, cal:calTab, todo:todoTab, today:todayTab };
    var cur = curMap[appId];
    /* 今のサブタブが非表示なら最初のものへ */
    if(!tabs.some(function(t){ return t[0]===cur; })){
      cur = tabs[0][0];
      if(appId==='money') payTab=cur; else if(appId==='risyu') risyuTab=cur; else if(appId==='cal') calTab=cur; else if(appId==='todo') todoTab=cur; else if(appId==='today') todayTab=cur;
    }
    nav.className = '';
    nav.innerHTML = '<span class="pill"></span>' + tabs.map(function(t){
      return '<button data-tab="'+t[0]+'" class="'+(cur===t[0]?'on':'')+'">'+t[1]+'</button>';
    }).join('');
  }else{
    nav.className = 'hide'; nav.innerHTML = '';
  }

  var html = notice ? '<div class="msg '+notice.type+'">'+esc(notice.text)+'</div>' : '';
  if(appId==='today'){
    html += viewToday();
  }else if(appId==='money'){
    var d = derive();
    html += ({ home:viewHome, schedule:viewSchedule, chart:viewChart, stmt:viewStmt, in:viewIncome, work:viewShifts })[payTab](d);
  }else if(appId==='risyu'){
    html += ({ tt:viewRisyuTt, plans:viewRisyuPlans })[risyuTab==='plans'?'plans':'tt']();
  }else if(appId==='tt'){ html += viewTT(); }
  else if(appId==='course'){ html += viewCourse(); }
  else if(appId==='todo'){ html += viewTodo(); }
  else if(appId==='chat'){ html += viewChat(); }
  else if(appId==='notes'){ html += viewNotes(); }
  else if(appId==='news'){ html += viewNews(); }
  else if(appId==='cal'){
    html += calTab==='health' ? viewHealth() : calTab==='kind' ? viewKindTab() : calTab==='add' ? viewCalAdd() : viewCalendar();
  }else{
    html += viewSettings();
  }
  /* 打っていた場所と文字の位置を覚えておいて、描き直したあとに戻す */
  var appEl = document.getElementById('app');
  var keep = null, af = document.activeElement;
  if(af && af.id && appEl && appEl.contains(af) && /^(INPUT|TEXTAREA|SELECT)$/.test(af.tagName)){
    keep = { id:af.id, s:null, e:null };
    try{ keep.s = af.selectionStart; keep.e = af.selectionEnd; }catch(err){}
  }
  appEl.innerHTML = html;
  if(keep){
    var back = document.getElementById(keep.id);
    if(back){
      try{ back.focus({ preventScroll:true }); }catch(err){ try{ back.focus(); }catch(e2){} }
      if(keep.s != null && back.setSelectionRange){ try{ back.setSelectionRange(keep.s, keep.e); }catch(err){} }
    }
  }
  var titleEl = document.getElementById('apptitle');
  titleEl.innerHTML = esc(TITLES[appId]) + '<span id="synctag"></span>' +
    '<button id="addbtn" type="button" data-act="go-add" title="予定を追加する" aria-label="予定を追加する"><span>＋</span><em>追加</em></button>' +
    '<button id="revbtn" data-act="go-review" title="今日の評価をみる">'+
      (function(){
        var r = (S.dayReview||{})[today()];
        return r && r.grade
          ? '<span class="rgb" style="--gc:'+(GRADE_COLOR[r.grade]||'#999')+'">'+esc(r.grade)+'</span>'
          : '<span class="rgb none">評価</span>';
      })()+'</button>';
  document.getElementById('foot').textContent = FOOTS[appId];
  var fab = document.getElementById('fab');
  if(fab) fab.className = 'fab hide';   /* 月カレンダーには右下の＋があるので、こちらは使わない */
  updateSyncTag();          /* 上の「同期済み・送れていない」などの表示 */
  /* 丸の位置合わせは次の描画のときに（ここで測ると、画面全体の計算を待たされて重くなる） */
  if(window.requestAnimationFrame) requestAnimationFrame(movePills); else movePills();
  if(typeof twInit==='function') twInit();
  if(typeof photoFill==='function') photoFill();
  if(typeof applyDecor==='function') applyDecor();
  if(appId==='chat' && typeof chatScrollBottom==='function') chatScrollBottom();
  if(typeof charaBuddy==='function') charaBuddy();   /* たっぷりのときの、すみにいる子 */
  var fixHeader = function(){
    var hd = document.querySelector('header');
    if(hd) document.documentElement.style.setProperty('--hdrh', Math.round(hd.getBoundingClientRect().height)+'px');
  };
  if(window.requestAnimationFrame) requestAnimationFrame(fixHeader); else fixHeader();
}

/* 選ばれているタブの位置に丸をすべらせる */
function movePill(box){
  if(!box) return;
  var pill = box.querySelector('.pill');
  var on = box.querySelector('button.on');
  if(!pill || !on){ if(pill) pill.style.width = '0px'; return; }
  pill.style.width = on.offsetWidth + 'px';
  pill.style.transform = 'translateX(' + on.offsetLeft + 'px)';
}
function movePills(){
  movePill(document.getElementById('apps'));
  var nav = document.getElementById('nav');
  if(nav && !nav.classList.contains('hide')) movePill(nav);
}
window.addEventListener('resize', movePills);

/* ============================== イベント ============================== */
document.getElementById('apps').addEventListener('click', function(e){
  var b = e.target.closest('button[data-app]'); if(!b) return;
  appId = b.dataset.app; notice = null; closePicker(); render(); window.scrollTo(0,0);
});
document.getElementById('nav').addEventListener('click', function(e){
  var b = e.target.closest('button[data-tab]'); if(!b) return;
  if(appId==='money') payTab = b.dataset.tab;
  else if(appId==='risyu') risyuTab = b.dataset.tab;
  else if(appId==='cal') calTab = b.dataset.tab;
  else if(appId==='todo') todoTab = b.dataset.tab;
  else if(appId==='today') todayTab = b.dataset.tab;
  notice = null; render(); window.scrollTo(0,0);
});

document.getElementById('app').addEventListener('click', function(e){
  var t = e.target.closest('[data-act]'); if(!t) return;
  undoable(t.dataset.act, function(){ appClick(e, t, t.dataset.act); });
});
function appClick(e, t, act){
  if(act==='go'){
    appId = t.dataset.app || appId;
    if(t.dataset.tab){
      if(appId==='money') payTab = t.dataset.tab;
      else if(appId==='risyu') risyuTab = t.dataset.tab;
      else if(appId==='cal') calTab = t.dataset.tab;
    }
    render(); window.scrollTo(0,0); return;
  }
  if(act.indexOf('cal-')===0 || act.indexOf('ev-')===0 || act==='add-health' || act==='del-health'){
    if(calAction(act, t)) return;
  }
  if(chatAction(act, t)) return;
  if(typeof charaAction==='function' && charaAction(act, t)) return;
  if(reviewAction(act, t)) return;
  if(kindAction(act, t)) return;
  if(ttAction(act, t, e)) return;
  if(todoAction(act, t)) return;
  if(settingsAction2(act, t)) return;
  if(gasAction(act, t)) return;
  if(delayAction(act, t)) return;
  if(act === 'go-gas'){
    appId = 'set'; S.ui.setOpen = S.ui.setOpen || {}; S.ui.setOpen.gas = 1; render();
    setTimeout(function(){ var el = document.querySelector('[data-id="gas"]'); if(el) el.scrollIntoView({ block:'start', behavior:'smooth' }); }, 50);
    return;
  }
  if(act.indexOf('r-')===0 || ['add-task','task-done','task-undone','del-task','add-exam','del-exam',
     'ab-plus','ab-minus','late-plus','set-limit','year-edit','course-add'].indexOf(act)>=0){
    if(risyuAction(act, t, e)) return;
  }
  if(act.indexOf('ev-')===0 || act.indexOf('cal-')===0){
    if(calAction(act, t)) return;
  }
  if(calAction(act, t)) return;
  if(moneyAction(act, t)) return;
  settingsAction(act, t);
}

/* 相談タブの添付 */
document.getElementById('chatfile').addEventListener('change', async function(e){
  var files = Array.prototype.slice.call(e.target.files || []);
  e.target.value = '';
  if(!files.length) return;
  for(var i = 0; i < files.length; i++){
    var f = files[i];
    if(chatFiles.length >= 4){ toast('いちどに送れるのは4つまでです', true); break; }
    try{
      if(/^image\//.test(f.type)){
        var data = await resizeImage(f, 1200, 0.75);
        chatFiles.push({ name:f.name, kind:'image', mime:'image/jpeg', data:data });
      }else{
        if(f.size > 3 * 1024 * 1024){ toast(f.name + ' は大きすぎます（3MBまで）', true); continue; }
        var d2 = await new Promise(function(res, rej){
          var r = new FileReader();
          r.onload = function(){ res(r.result); };
          r.onerror = function(){ rej(new Error('読めません')); };
          r.readAsDataURL(f);
        });
        chatFiles.push({ name:f.name, kind:'file', mime:f.type || 'application/octet-stream', data:d2 });
      }
    }catch(err){ toast(f.name + ' を読めませんでした', true); }
  }
  render();
});
document.getElementById('shiftimg').addEventListener('change', function(e){
  var f = (e.target.files || [])[0];
  e.target.value = '';
  if(f) shiftOcrRun(f);
});
document.getElementById('memoimg').addEventListener('change', async function(e){
  var files = Array.prototype.slice.call(e.target.files || []);
  e.target.value = '';
  if(!files.length || !memoTarget) return;
  var okN = 0, ngN = 0;
  for(var i = 0; i < files.length; i++){
    try{
      /* 幅1400・画質0.72 まで上げつつ、1枚が大きすぎるときは落とす */
      /* 大きい入れものに入れるので、画質を上げられる */
      var data = await resizeImage(files[i], 1800, 0.82);
      var id = uid('mi');
      await photoPut(id, data);
      if(memoTarget === 'draft'){
        if(!evDraft) evDraft = newDraft(calSel);
        evDraft.photos = (evDraft.photos||[]).concat([id]);
      }else if(memoTarget.indexOf('note:')===0){
        var n = noteOf(memoTarget.slice(5));
        if(n){ n.photos = (n.photos||[]).concat([id]); n.mt = Date.now(); }
      }else{
        var mo = memoOf(memoTarget);
        mo.photos = (mo.photos||[]).concat([id]); mo.mt = Date.now(); S.memos[memoTarget] = mo;
        touch('memos');
      }
      okN++;
    }catch(err){ ngN++; }
  }
  if(okN) toast(okN + '枚の写真を足しました' + (ngN ? '（' + ngN + '枚は入りませんでした）' : ''));
  else toast('写真を保存できませんでした（容量が足りないかもしれません）', true);
  if(memoTarget === 'draft'){
    render();
    var fm = document.getElementById('evform'); if(fm) fm.scrollIntoView({block:'center'});
  }else commit();
});

/* 時刻の数字入力：2桁入れたら分へ移る・範囲を直す */
/* 時刻の入力でEnterを押したら、次の欄へ */
document.getElementById('app').addEventListener('keydown', function(e){
  var el = e.target;
  if(!el || !el.classList || !el.classList.contains('tnum')) return;
  if(e.key !== 'Enter') return;
  e.preventDefault();
  var order = ['ev_time_h','ev_time_m','ev_end_h','ev_end_m','ev_real_h','ev_real_m'];
  var i = order.indexOf(el.id);
  for(var j = i + 1; j < order.length; j++){
    var nx = document.getElementById(order[j]);
    if(nx){ nx.focus(); nx.select && nx.select(); return; }
  }
  el.blur();
});
document.getElementById('app').addEventListener('input', function(e){
  var el = e.target;
  if(!el || !el.classList || !el.classList.contains('tnum')) return;
  var v = String(el.value).replace(/[^0-9]/g,'').slice(0,2);
  el.value = v;
  var isH = /_h$/.test(el.id);
  if(v.length === 2){
    var n = parseInt(v,10);
    if(isH && n > 23) el.value = '23';
    if(!isH && n > 59) el.value = '59';
    if(isH){
      var mm = document.getElementById(el.id.replace(/_h$/,'_m'));
      if(mm) mm.focus();
    }
  }
});
document.getElementById('app').addEventListener('change', function(e){
  var el = e.target;
  if(el && el.dataset && el.dataset.md && /_m$/.test(el.id)) refreshMd(el.dataset.md);
});
/* ===== 予定の入力は、打つそばから覚えておく =====
   これで、天気や同期で画面が描き直されても、打った字が消えない。 */
var evKeep = function(e){
  var el = e.target;
  if(!el || !el.id || el.id.indexOf('ev_') !== 0) return;
  if(!evDraft) return;
  readEvForm();
};
document.getElementById('app').addEventListener('input', evKeep);
document.getElementById('app').addEventListener('change', evKeep);
/* 入力中は、上のタブの固定をやめる（画面を広く使う） */
/* ヘッダーの中のボタンも押せるようにする */
document.querySelector('header').addEventListener('click', function(e){
  var t = e.target.closest ? e.target.closest('[data-act]') : null;
  if(!t) return;
  e.preventDefault();
  var act = t.dataset.act;
  if(act === 'go-add'){
    /* どの画面からでも、今日の日付で予定の追加画面を開く（書きかけがあればそのまま） */
    if(calEdit || !evDraft){ calEdit = null; evDraft = newDraft(today()); }
    appId = 'cal'; calTab = 'add'; courseView = ''; closeDetail();
    render(); window.scrollTo(0, 0);
    return;
  }
  if(act === 'go-sync'){
    appId = 'set'; S.ui.setOpen = S.ui.setOpen || {}; S.ui.setOpen.s4 = 1;
    render();
    setTimeout(function(){ var el = document.querySelector('[data-id="s4"]'); if(el) el.scrollIntoView({ block:'start', behavior:'smooth' }); }, 50);
    return;
  }
  if(typeof chatAction==='function' && chatAction(act, t)) return;
  if(typeof reviewAction==='function' && reviewAction(act, t)) return;
});
document.addEventListener('focusin', function(e){
  var t = e.target;
  if(t && /^(INPUT|TEXTAREA)$/.test(t.tagName) && t.type !== 'checkbox' && t.type !== 'color'){
    document.body.setAttribute('data-kb','1');
  }
});
document.addEventListener('focusout', function(){
  setTimeout(function(){
    var a = document.activeElement;
    if(!a || !/^(INPUT|TEXTAREA)$/.test(a.tagName)) document.body.removeAttribute('data-kb');
  }, 60);
});
document.getElementById('app').addEventListener('focusin', function(e){
  /* 時刻のプルダウンを空のまま開いたら、12:00 を入れておく */
  var el = e.target;
  if(el && el.tagName==='SELECT' && el.dataset && el.dataset.t12 && !el.value && el.dataset.pref){
    el.value = el.dataset.pref;
  }
});
document.getElementById('app').addEventListener('change', async function(e){
  var id = e.target.id;
  if(id === 'dl_idx'){ dly.idx = toNum(e.target.value); render(); return; }
  if(e.target.dataset && (e.target.dataset.act==='sub-toggle' || e.target.dataset.act==='note-check')){
    var tg = e.target;
    undoable(tg.dataset.act, function(){ todoAction(tg.dataset.act, tg); }); return;
  }
  if(id==='cam' || id==='pickf'){ var f=e.target.files[0]; e.target.value=''; if(f) handlePhoto(f); }
  if(id==='tgOcc'){ rIncludeOcc = e.target.checked; render(); if(sheetOpen()) renderPicker(); }
  if(id==='cbWeather'){
    S.ui.weather = e.target.checked ? 1 : 0; touch('ui'); persist(); pushRemote();
    if(S.ui.weather){ weather.state='idle'; loadWeather(); } else { weather.state='off'; weather.alert=''; }
    render();
  }
  if(id==='imp'){
    var g=e.target.files[0]; e.target.value=''; if(!g) return;
    try{
      var txt = await g.text();
      var d = JSON.parse(txt);
      if(d.app!=='kurashi' && d.app!=='shiharai') throw new Error('形式');
      importData(d);
      toast('読み込みました（今の内容に足し合わせました）');
    }catch(err){ toast('読み込めませんでした。書き出したファイルを選んでください', true); }
  }
});

/* 既修得単位は打っている途中で全体を描き直さない */
/* （時刻の入力でEnterを押したときの動きは、上で1回だけ登録している） */
document.getElementById('app').addEventListener('input', function(e){
  if(e.target.id === 'note_q'){
    noteQ = e.target.value;
    clearTimeout(window.__nqT);
    window.__nqT = setTimeout(function(){ render(); var q=document.getElementById('note_q'); if(q){ q.focus(); q.setSelectionRange(q.value.length,q.value.length); } }, 260);
    return;
  }
  var k = e.target.getAttribute('data-earn');
  if(!k) return;
  var v = parseInt(e.target.value, 10);
  if(isNaN(v) || v < 0) v = 0;
  if(k==='otherCr') S.risyu.otherCr = v; else S.risyu.earned[k] = v;
  touchRisyu();
  var m = document.getElementById('meters'); if(m) m.innerHTML = metersHtml();
  var w = document.getElementById('warns'); if(w) w.innerHTML = warnsHtml();
  persist(); pushRemote();
});

/* 選択シート */
document.getElementById('shBody').addEventListener('click', function(e){
  var b = e.target.closest('[data-act]');
  if(b && !b.disabled) risyuAction(b.dataset.act, b, e);
});
document.getElementById('shDays').addEventListener('click', function(e){
  var b = e.target.closest('[data-day]'); if(!b) return;
  pick.d = b.dataset.day; pick.cat='all'; renderPicker();
});
document.getElementById('shPeriods').addEventListener('click', function(e){
  var b = e.target.closest('[data-period]'); if(!b) return;
  pick.p = parseInt(b.dataset.period,10); pick.cat='all'; renderPicker();
});
document.getElementById('shCats').addEventListener('click', function(e){
  var b = e.target.closest('[data-cat]'); if(!b) return;
  pick.cat = b.dataset.cat; renderPicker();
});
document.getElementById('shSearch').addEventListener('input', function(e){ pick.q = e.target.value; renderPicker(); });
document.getElementById('shClose').addEventListener('click', closePicker);
document.getElementById('detail').addEventListener('click', function(e){
  var b = e.target.closest('[data-act]'); if(!b) return;
  var act = b.dataset.act;
  if(act==='sub-toggle'){ return; }
  undoable(act, function(){
    if(act==='task-done'||act==='task-undone'){ risyuAction(act, b, e); closeDetail(); return; }
    if(todoAction(act, b)) return;
    if(kindAction(act, b)) return;
    if(calAction(act, b)) return;
  });
});
document.getElementById('detail').addEventListener('change', function(e){
  if(e.target.dataset && e.target.dataset.act==='sub-toggle') todoAction('sub-toggle', e.target);
});
document.getElementById('dtClose').addEventListener('click', closeDetail);
document.getElementById('veil').addEventListener('click', function(){ closePicker(); closeDetail(); });
document.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ closePicker(); closeDetail(); } });

/* 右下の「＋」ボタン（長押しで種類を選ぶ） */
(function(){
  var fab = document.getElementById('fab'), timer = null, longed = false;
  var openMenu = function(){
    longed = true;
    var m = document.getElementById('fabmenu');
    m.innerHTML = kindsAll().map(function(k){
      return '<button data-k="'+k.id+'" style="--kc:'+k.hex+'"><span class="kdot2"></span>'+k.name+'</button>';
    }).join('');
    m.classList.add('on');
  };
  fab.addEventListener('touchstart', function(){ longed=false; timer=setTimeout(openMenu, 450); }, {passive:true});
  fab.addEventListener('touchend', function(){ clearTimeout(timer); }, {passive:true});
  fab.addEventListener('mousedown', function(){ longed=false; timer=setTimeout(openMenu, 450); });
  fab.addEventListener('mouseup', function(){ clearTimeout(timer); });
  fab.addEventListener('contextmenu', function(e){ e.preventDefault(); openMenu(); });
  document.getElementById('fabmenu').addEventListener('click', function(e){
    var b = e.target.closest('button[data-k]'); if(!b) return;
    document.getElementById('fabmenu').classList.remove('on');
    readEvForm(); calEdit=null; evDraft=newDraft(calSel); evDraft.kind=b.dataset.k;
    appId='cal'; calTab='add'; render(); window.scrollTo(0,0);
  });
  document.addEventListener('click', function(e){
    var m = document.getElementById('fabmenu');
    if(m.classList.contains('on') && !e.target.closest('#fabmenu') && !e.target.closest('#fab')) m.classList.remove('on');
  });
})();
document.getElementById('fab').addEventListener('click', function(){
  if(document.getElementById('fabmenu').classList.contains('on')) return;
  readEvForm();
  calEdit = null;
  evDraft = newDraft(calSel);
  appId='cal'; calTab='add';
  render(); window.scrollTo(0,0);
});


/* 左右にはらってタブを切り替える */
(function(){
  var root = document.body;
  var x0=0, y0=0, t0=0, decided=0, active=false, busy=false;
  var appEl = function(){ return document.getElementById('app'); };
  var inScroller = function(el){
    for(var n=el; n && n!==root; n=n.parentElement){
      if(n.scrollWidth > n.clientWidth + 4 && /auto|scroll/.test(getComputedStyle(n).overflowX)) return true;
    }
    return false;
  };
  var isInput = function(el){ return !!(el && el.closest && el.closest('input,textarea,select,button')); };
  var clear = function(){
    var a = appEl(); if(!a) return;
    a.style.transition = ''; a.style.transform = ''; a.style.opacity = '';
  };
  var settle = function(){
    var a = appEl(); if(!a) return;
    a.style.transition = 'transform .2s ease, opacity .2s ease';
    a.style.transform = ''; a.style.opacity = '';
    setTimeout(clear, 220);
  };
  root.addEventListener('touchstart', function(e){
    if(busy || e.touches.length !== 1 || isInput(e.target) || inScroller(e.target)){ t0 = 0; return; }
    clear();
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now(); decided = 0; active = false;
  }, {passive:true});
  root.addEventListener('touchmove', function(e){
    if(!t0) return;
    var dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
    if(!decided){
      if(Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      decided = 1;
      active = Math.abs(dx) > Math.abs(dy) * 1.3;
      if(!active){ t0 = 0; return; }
    }
    var a = appEl();
    if(active && a){
      var shift = Math.max(-70, Math.min(70, dx * 0.35));
      a.style.transition = 'none';
      a.style.transform = 'translateX('+shift+'px)';
      a.style.opacity = String(1 - Math.min(0.3, Math.abs(dx)/1000));
    }
  }, {passive:true});
  root.addEventListener('touchend', function(e){
    if(!t0 || !active){ t0 = 0; settle(); return; }
    var dx = e.changedTouches[0].clientX - x0;
    var dt = Date.now() - t0;
    t0 = 0; active = false;
    if(Math.abs(dx) < 55 || dt > 800){ settle(); return; }
    busy = true;
    clear();
    switchTab(dx < 0 ? 1 : -1);
    setTimeout(function(){ busy = false; }, 380);
  }, {passive:true});
  root.addEventListener('touchcancel', function(){ t0=0; active=false; settle(); }, {passive:true});
})();
/* サブタブがあればサブタブ、なければ大きいタブを動かす */
function switchTab(dir){
  var a = document.getElementById('app');
  var finish = function(go){
    if(!a){ go(); return; }
    /* いまの画面をそっと送り出す */
    a.style.transition = 'transform .13s ease-in, opacity .13s ease-in';
    a.style.transform = 'translateX('+(dir>0?-26:26)+'px)';
    a.style.opacity = '0';
    setTimeout(function(){
      go();
      var b = document.getElementById('app');
      if(!b) return;
      b.style.transition = 'none';
      b.style.transform = 'translateX('+(dir>0?30:-30)+'px)';
      b.style.opacity = '0';
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          b.style.transition = 'transform .2s cubic-bezier(.22,.9,.3,1), opacity .2s ease-out';
          b.style.transform = 'translateX(0)';
          b.style.opacity = '1';
          setTimeout(function(){ b.style.transition=''; b.style.transform=''; b.style.opacity=''; }, 220);
        });
      });
    }, 130);
  };
  var subs = SUBTAB_DEFS[appId] ? subVisible(appId) : null;
  if(subs && subs.length > 1){
    var cur = appId==='money' ? payTab : appId==='cal' ? calTab : appId==='todo' ? todoTab : appId==='risyu' ? risyuTab : todayTab;
    var i = subs.findIndex(function(t){ return t[0]===cur; });
    var j = i + dir;
    if(j >= 0 && j < subs.length){
      var v = subs[j][0];
      finish(function(){
        if(appId==='money') payTab=v; else if(appId==='cal') calTab=v; else if(appId==='todo') todoTab=v;
        else if(appId==='risyu') risyuTab=v; else if(appId==='today') todayTab=v;
        render(); window.scrollTo(0,0);
      });
      return;
    }
  }
  var apps = APPS_VISIBLE();
  var ai = apps.findIndex(function(a){ return a[0]===appId; });
  var aj = ai + dir;
  if(aj >= 0 && aj < apps.length){
    finish(function(){
      appId = apps[aj][0]; courseView=''; noteView='';
      render(); window.scrollTo(0,0);
    });
  }
}

/* オフラインでも開けるように（https のときだけ） */
if('serviceWorker' in navigator && location.protocol === 'https:'){
  navigator.serviceWorker.register('sw.js', { updateViaCache:'none' }).then(function(reg){
    reg.update();
    /* 新しい版が来たら、次に開いたときに切り替わる */
    reg.addEventListener('updatefound', function(){
      var w = reg.installing;
      if(!w) return;
      w.addEventListener('statechange', function(){
        if(w.state === 'installed' && navigator.serviceWorker.controller){
          notice_('新しい版があります。アプリを開き直すと新しくなります。', 'amber');
          render();
        }
      });
    });
  }).catch(function(){});
}

/* ============================== 起動 ============================== */
applyUi();
/* 前に書きかけていた予定があれば、そのまま出す（打った字を消さない） */
(function(){
  try{
    var dr = loadDraft();
    if(dr) evDraft = Object.assign(newDraft(calSel), dr);
  }catch(e){}
})();
render();
/* 時間帯で背景を変える設定のときは、定期的に見直す */
setInterval(function(){
  var mode = S.ui.bgMode || 'fixed';
  if(mode === 'time' || mode === 'mix'){
    var now = timeBandNow();
    if(document.body.getAttribute('data-band') !== now && !isTyping()){ applyUi(); applyDecor(); }
  }
}, 60000);
initSync();
if(typeof photoMigrate==='function') photoMigrate().then(function(n){ if(n) render(); });
if(typeof photoUsage==='function') photoUsage().then(function(u){
  window.__photoQuota = u;
  /* 本当にいっぱいに近いときだけ知らせる */
  var warn = '';
  if(u.quota && u.used / u.quota > 0.85) warn = '写真の保存がいっぱいに近づいています。設定から整理してください。';
  else {
    var st0 = storageInfo();
    if(st0.total / st0.limit > 0.85) warn = '文字のデータがいっぱいに近づいています。設定 › 容量から古いものを整理してください。';
  }
  if(warn){ notice_(warn, 'red'); render(); }
});
if(typeof cleanDonePhotos==='function') setTimeout(function(){ var n = cleanDonePhotos(); if(n) render(); }, 1500);
loadWeather();
setTimeout(function(){
  var s = document.getElementById('splash');
  if(s) s.classList.add('out');
}, 700);
setTimeout(movePills, 60);
setTimeout(movePills, 400);
if(document.fonts && document.fonts.ready) document.fonts.ready.then(movePills)['catch'](function(){});
/* 写真を大きく見る画面は、どこを押しても閉じる */
(function(){
  var v = document.getElementById('viewer');
  if(v) v.addEventListener('click', function(){ v.classList.remove('on'); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && v) v.classList.remove('on'); });
})();
/* 新しい版のお知らせ（この版で初めて開いたときだけ） */
if(typeof maybeWhatsNew === 'function') maybeWhatsNew();
/* テストモードのときは、はっきり出しておく */
if(TEST_MODE){
  document.documentElement.setAttribute('data-test', '1');
}

/* 読みこみの見張り（index.html）に「ちゃんと起動した」と知らせる */
window.__kurashiOK = true;
/* 「1件ずつ見る」を開いたかどうかを覚えておく（描き直しても閉じないように） */
document.getElementById('app').addEventListener('toggle', function(e){
  var t = e.target;
  if(t && t.dataset && t.dataset.flowMore) flowOpen = !!t.open;
}, true);
