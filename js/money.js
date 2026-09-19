/* くらしの手帳：お金 */
/* ============================== お金：共通 ============================== */
function accRow(acc, amount, sub, label){
  var a=ACCOUNTS[acc];
  return '<div class="row"><div class="tick" style="background:var(--'+a.cls+')"></div>'+
    '<div class="grow"><div class="t">'+esc(label||a.bank)+'</div><div class="s">'+esc(sub||(a.card+'引落'))+'</div></div>'+
    '<div class="amt num">'+yen(amount)+'</div></div>';
}

/* ===== 1か月のお金の流れ =====
   「あるお金」を1本の帯にして、出ていく分とのこりに分けて見せる（全体に対する割合）。
   下に、1件ずつの金額と割合の一覧（表の代わり）を出す。
   色：引落＝1番目（青）・固定費＝2番目（オレンジ）・のこり＝3番目（みどり）。足りない分は注意の赤＋「!」。 */
var flowOpen = false;
function flowPct(v, total){ return total > 0 ? Math.round(v / total * 100) : 0; }
function flowData(){
  var b = budget(), d = derive(), cur = thisYm(), g = d.byMonth[cur];
  var cards = [];
  if(g){
    if(g.smbc.plan + g.smbc.stmt > 0) cards.push({ name:ACCOUNTS.smbc.bank + '（' + ACCOUNTS.smbc.card + '）', amount:g.smbc.plan + g.smbc.stmt });
    if(g.rakuten.plan + g.rakuten.stmt > 0) cards.push({ name:ACCOUNTS.rakuten.bank + '（' + ACCOUNTS.rakuten.card + '）', amount:g.rakuten.plan + g.rakuten.stmt });
  }
  var fixed = S.fixed.map(function(x){ return { name:x.name || '固定費', amount:toNum(x.amount) }; }).filter(function(x){ return x.amount > 0; });
  var srcs = S.balances.map(function(x){ return { name:(x.name || '口座') + '（残高）', amount:toNum(x.amount) }; })
    .concat(S.income.map(function(x){ return { name:(x.name || '収入') + '（今月の収入）', amount:toNum(x.amount) }; }))
    .filter(function(x){ return x.amount > 0; });
  var sum = function(a){ return a.reduce(function(s, x){ return s + x.amount; }, 0); };
  return { b:b, have:b.have, out:b.pay + b.fixed, card:sum(cards), fix:sum(fixed), free:b.free,
           cards:cards, fixed:fixed, srcs:srcs };
}
function flowCard(){
  var f = flowData();
  if(!f.have && !f.out){
    return section('今月のお金の流れ', ymLabel(thisYm()),
      '<div class="empty">口座の残高・収入・固定費を入れると、ここにまとめが出ます。</div>'+
      '<button class="btn ghost" style="margin-top:8px" data-act="go" data-app="money" data-tab="in">収入・固定費・残高を入力</button>');
  }
  var short = f.free < 0;
  var base = short ? f.out : f.have;            /* 帯ぜんたいが表すお金 */
  var segs = [
    { cls:'s1', label:'カードの引落', v:f.card },
    { cls:'s2', label:'固定費', v:f.fix },
    short ? null : { cls:'s3', label:'のこり', v:f.free }
  ].filter(function(s){ return s && s.v > 0; });
  var tip = function(s){ return s.label + ' ' + yen(s.v) + '（' + flowPct(s.v, base) + '%）'; };

  /* 3つの数字 */
  var h = '<div class="mf2">'+
    '<div class="mf-kpis">'+
      '<div class="mf-kpi"><div class="k">あるお金</div><div class="v">'+yen(f.have)+'</div><div class="s">口座＋今月の収入</div></div>'+
      '<div class="mf-kpi"><div class="k">出ていく</div><div class="v">'+yen(f.out)+'</div><div class="s">引落＋固定費</div></div>'+
      (short
        ? '<div class="mf-kpi hero bad"><div class="k"><span class="mf-alert" aria-hidden="true">!</span>足りない</div><div class="v">'+yen(-f.free)+'</div><div class="s">引き落としまでに入金を</div></div>'
        : '<div class="mf-kpi hero"><div class="k">自由に使える</div><div class="v">'+yen(f.free)+'</div><div class="s">あるお金の'+flowPct(f.free, f.have)+'%</div></div>')+
    '</div>';

  /* 1本の帯 */
  h += '<div class="mf-cap">'+(short ? '出ていくお金 '+yen(f.out)+' のうちわけ' : 'あるお金 '+yen(f.have)+' の行き先')+'</div>'+
    '<div class="mf-bar" role="img" aria-label="'+esc(segs.map(tip).join('、'))+'">'+
      segs.map(function(s){
        var p = s.v / base * 100;
        return '<span class="mf-seg '+s.cls+'" tabindex="0" style="flex-grow:'+p.toFixed(3)+'" data-tip="'+esc(tip(s))+'" title="'+esc(tip(s))+'">'+
          (p >= 18 ? '<span class="mf-in">'+flowPct(s.v, base)+'%</span>' : '')+'</span>';
      }).join('')+
      (short ? '<span class="mf-mark" style="left:'+(f.have / base * 100).toFixed(2)+'%" title="ここまでは払えます（あるお金 '+esc(yen(f.have))+'）"></span>' : '')+
    '</div>'+
    (short ? '<div class="mf-markcap" style="padding-left:'+Math.min(80, f.have / base * 100).toFixed(1)+'%">▲ ここまでは払えます</div>' : '');

  /* 凡例（色と名前と金額） */
  h += '<div class="mf-leg">'+segs.map(function(s){
    return '<span class="mf-li"><i class="mf-sw '+s.cls+'"></i>'+esc(s.label)+'<b>'+yen(s.v)+'</b><em>'+flowPct(s.v, base)+'%</em></span>';
  }).join('')+'</div>';

  /* 1件ずつの一覧 */
  var rows = function(list, cls, total){
    var max = list.reduce(function(m, x){ return Math.max(m, x.amount); }, 0) || 1;
    return list.slice().sort(function(a, b){ return b.amount - a.amount; }).map(function(x){
      return '<div class="mf-row"><span class="mf-name"><i class="mf-sw '+cls+'"></i>'+esc(x.name)+'</span>'+
        '<span class="mf-track"><span class="mf-fill '+cls+'" style="width:'+Math.max(2, x.amount / max * 100).toFixed(1)+'%"></span></span>'+
        '<span class="mf-amt">'+yen(x.amount)+'</span><span class="mf-pct">'+flowPct(x.amount, total)+'%</span></div>';
    }).join('');
  };
  h += '<details class="mf-more"'+(flowOpen ? ' open' : '')+' data-flow-more="1"><summary>1件ずつ見る</summary>'+
    (f.cards.length || f.fixed.length
      ? '<div class="mf-sub">出ていくお金（'+(short ? '出ていくお金' : 'あるお金')+'に対する割合）</div>'+
        rows(f.cards, 's1', base) + rows(f.fixed, 's2', base)
      : '')+
    (f.srcs.length ? '<div class="mf-sub">あるお金のもと</div>' + rows(f.srcs, 'sx', f.have) : '')+
    '</details></div>';

  h += '<button class="btn ghost" style="margin-top:10px" data-act="go" data-app="money" data-tab="in">収入・固定費・残高を入力</button>';
  return section('今月のお金の流れ', ymLabel(thisYm()), h);
}

/* ===== シフト表の写真から、シフトをまとめて登録 ===== */
var shiftOcr = { busy:false, list:null, err:'' };
function shiftOcrCard(){
  var h = '<div class="field"><label class="f">表の中のあなたの名前（何人分も書いてある表のとき）</label>'+
    '<input id="so_name" value="'+esc(S.settings.shiftName||'')+'" placeholder="例：山田"></div>'+
    '<button class="btn" data-act="shift-ocr"'+(shiftOcr.busy?' disabled':'')+'>'+(shiftOcr.busy ? '読み取っています…' : 'シフト表の写真をえらぶ')+'</button>'+
    (shiftOcr.err ? '<p class="note" style="color:var(--rakuten)">'+esc(shiftOcr.err)+'</p>' : '');
  if(shiftOcr.list){
    var L = shiftOcr.list;
    h += '<div style="margin-top:12px">'+(L.length
      ? '<label class="f">読み取ったシフト（登録するものにチェック）</label>'+L.map(function(x, i){
          var dup = S.shifts.some(function(w){ return w.date === x.date && w.start === x.start; });
          return '<label class="row" style="gap:8px"><input type="checkbox" class="so-pick" data-i="'+i+'"'+(dup?'':' checked')+' style="width:auto">'+
            '<div class="grow"><div class="t">'+ymdLabel(x.date)+'　'+esc(x.start)+'〜'+esc(x.end)+'</div>'+
            '<div class="s">'+(dup ? 'もう登録されています' : (Math.round(shiftMinutes({start:x.start,end:x.end})/6)/10)+'時間')+(x.note ? '・'+esc(x.note) : '')+'</div></div></label>';
        }).join('')+
        '<div class="pair" style="margin-top:10px"><button class="btn" data-act="shift-ocr-add">チェックしたシフトを登録</button>'+
        '<button class="btn ghost" style="flex:0 0 auto;padding:11px 14px" data-act="shift-ocr-cancel">やめる</button></div>'
      : '<div class="empty">シフトを見つけられませんでした。名前や写真の明るさをたしかめてください。'+
        '<br><button class="mini" data-act="shift-ocr-cancel" style="margin-top:6px">とじる</button></div>')+'</div>';
  }
  h += '<p class="note">写真はGoogleのAIに送られて読み取られます（Gemini APIキーが必要です）。登録したあと、カレンダーやこの画面で直せます。</p>';
  return section('シフト表の写真から登録', null, h);
}
/* 「17」「9時半」「0930」「9:00」などを分に直す */
function looseMinutes(v){
  var s = String(v == null ? '' : v);
  try{ s = s.normalize('NFKC'); }catch(e){}
  s = s.replace(/\s/g, '').replace(/半/, '30');
  var m = s.match(/^(\d{1,2})(?:[:時](\d{1,2})?分?)?$/) || s.match(/^(\d{1,2})(\d{2})$/);
  if(!m) return null;
  var h = +m[1], mi = +(m[2] || 0);
  if(h > 29 || mi > 59) return null;
  if(h >= 24) h -= 24;
  return h * 60 + mi;
}
async function shiftOcrRun(file){
  if(!aiReady()){ toast('先に設定タブでGemini APIキーを登録してください', true); return; }
  shiftOcr = { busy:true, list:null, err:'' }; render();
  try{
    var data = await resizeImage(file, 2000, 0.85);
    var nm = String(S.settings.shiftName || '').trim();
    var r = await aiJson(
      'これはアルバイトのシフト表の写真です。' + (nm ? '「' + nm + '」さんの勤務だけ' : 'この表の勤務（1人分の表として）') + 'を取り出して、JSONだけを返してください。\n' +
      '{"shifts":[{"date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","note":"備考（なければ空）"}]}\n' +
      '・休み（×、休、公休、空欄など）は入れない。\n' +
      '・年が書いていないときは、今日（' + today() + '）に近い年にする。\n' +
      '・「9-17」「9:00〜17:00」「9~17」「17-22」などの書き方も HH:MM に直す。24時間表記にする。\n' +
      '・読み取れない日は入れない。', [data], 'shift');
    var list = (r && Array.isArray(r.shifts)) ? r.shifts : (Array.isArray(r) ? r : []);
    shiftOcr.list = list.map(function(x){
      x = x || {};
      var d = String(x.date || '');
      var m = d.match(/(\d{1,2})[-\/月](\d{1,2})/);
      if(!isYmd(d) && m) d = guessYear(+m[1], +m[2]) + '-' + pad(+m[1]) + '-' + pad(+m[2]);
      var st = looseMinutes(x.start), en = looseMinutes(x.end);
      return { date:d, start: st == null ? '' : hhmmOf(st), end: en == null ? '' : hhmmOf(en), note:String(x.note || '').slice(0, 60) };
    }).filter(function(x){ return isYmd(x.date) && x.start && x.end; })
      .sort(function(a, b){ return a.date.localeCompare(b.date) || a.start.localeCompare(b.start); });
  }catch(e){
    shiftOcr.err = '読み取れませんでした：' + e.message;
    logErr('シフト表', e.message);
  }finally{
    shiftOcr.busy = false; render();
  }
}
function shiftOcrAdd(){
  var L = shiftOcr.list || [];
  var picks = Array.prototype.filter.call(document.querySelectorAll('.so-pick'), function(el){ return el.checked; })
    .map(function(el){ return L[toNum(el.dataset.i)]; }).filter(Boolean);
  if(!picks.length){ toast('登録するシフトにチェックを入れてください', true); return; }
  var now = Date.now(), n = 0;
  picks.forEach(function(x){
    if(S.shifts.some(function(w){ return w.date === x.date && w.start === x.start; })) return;
    S.shifts.push({ id:uid('wk'), title:'バイト', date:x.date, start:x.start, end:x.end, realEnd:'', ot:0, rate:0,
      memo:x.note || '', photos:[], rid:'', mt:now });
    n++;
  });
  shiftOcr = { busy:false, list:null, err:'' };
  toast(n + '件のシフトを登録しました'); commit();
}
function viewHome(d){
  var cur=thisYm(), g=d.byMonth[cur];
  var smbc=g.smbc.plan+g.smbc.stmt, rakuten=g.rakuten.plan+g.rakuten.stmt;
  var peak=null;
  d.months.forEach(function(m){ if(m<cur) return; var t=d.monthTotal(m); if(!peak||t>peak.t) peak={m:m,t:t}; });
  var remain = S.plans.reduce(function(a,p){ return a.concat(planRows(p)); },[])
    .filter(function(r){ return !isPaid(r.planId+':'+r.month); })
    .reduce(function(s,r){ return s+r.amount; },0);
  var next3 = d.months.filter(function(m){ return m>cur; }).slice(0,3);
  var b = budget();

  var partsM = {};
  partsM.ready = function(){ return section(ymLabel(cur)+'のご用意額', (g.smbc.stmt+g.rakuten.stmt)>0?'明細ぶん加算済み':null,
    '<div style="padding-bottom:12px;border-bottom:1px solid var(--rule)">'+
      '<div class="big num">'+yen(smbc+rakuten)+'</div>'+
      '<div class="s" style="margin-top:4px">2口座の合計</div></div>'+
    accRow('smbc', smbc, 'オリコ引落・'+S.settings.smbcDay+'日 / あと'+daysUntil(S.settings.smbcDay)+'日')+
    accRow('rakuten', rakuten, '楽天カード引落・'+S.settings.rakutenDay+'日 / あと'+daysUntil(S.settings.rakutenDay)+'日')+
    '<div class="pair" style="margin-top:12px">'+
      '<button class="btn" data-act="go" data-app="money" data-tab="stmt">明細を追加</button>'+
      '<button class="btn ghost" data-act="gas-cal-now" style="flex:0 0 auto;padding:11px 14px">Googleカレンダー</button></div>'); };
  partsM.free = function(){ return section('自由に使えるお金', b.word,
    '<div class="big num" style="color:'+(b.free<0?'var(--rakuten)':'var(--ink)')+'">'+yen(b.free)+'</div>'+
    '<div class="s" style="margin:4px 0 12px">口座 '+yen(b.balance)+' ＋ 収入 '+yen(b.income)+' − 支払い '+yen(b.pay)+' − 固定費 '+yen(b.fixed)+'</div>'+
    '<div class="grid2">'+
      '<div class="stat"><div class="k">口座残高の合計</div><div class="v num">'+yen(b.balance)+'</div></div>'+
      '<div class="stat"><div class="k">今月の収入</div><div class="v num">'+yen(b.income)+'</div></div>'+
    '</div>'+
    '<button class="btn ghost" style="margin-top:12px" data-act="go" data-app="money" data-tab="in">収入・固定費・残高を入力</button>'); };
  partsM.flow = function(){ return flowCard(); };
  partsM.spend = function(){ return (typeof kbHomeCard === 'function') ? kbHomeCard() : ''; };
  partsM.fuyou = function(){ return fuyouCard(); };
  partsM.yearchart = function(){ return yearPayChart(); };
  partsM.balchart = function(){ return balanceChart(); };
  partsM.outlook = function(){ return section('この先の見通し', null,
    '<div class="row"><div class="grow s">いちばん重い月</div><div class="amt num">'+(peak?ymLabel(peak.m)+'　'+yen(peak.t):'—')+'</div></div>'+
    '<div class="row"><div class="grow s">未払いの残り総額</div><div class="amt num">'+yen(remain)+'</div></div>'+
    next3.map(function(m){ return '<div class="row"><div class="grow s">'+ymLabel(m)+'</div><div class="t num">'+yen(d.monthTotal(m))+'</div></div>'; }).join('')); };
  var outM = '';
  pageOrder('money').forEach(function(id){ if(partsM[id] && !pageHidden('money', id)) outM += partsM[id](); });
  return outM;
}

/* ============================== お金：予定 ============================== */
function viewSchedule(d){
  var cur=thisYm();
  var html = section('支払いプラン', S.plans.length+'件',
    S.plans.map(function(p){
      var done=planRows(p).filter(function(r){ return isPaid(p.id+':'+r.month); }).length, a=ACCOUNTS[p.accountId];
      return '<div class="row"><div class="tick" style="background:var(--'+a.cls+')"></div>'+
        '<div class="grow"><div class="t" style="font-weight:600">'+esc(p.name)+'</div>'+
        '<div class="s">'+a.card+'・'+yen(p.monthly)+' × '+p.count+'回　残り'+(p.count-done)+'回</div></div>'+
        '<button class="mini" data-act="del-plan" data-id="'+p.id+'">削除</button></div>';
    }).join('')+
    '<button class="btn ghost" style="margin-top:12px" data-act="toggle-plan-form">'+(showPlanForm?'閉じる':'分割払いを追加')+'</button>'+
    (showPlanForm?planForm():''));

  html += '<div class="chips" style="justify-content:flex-end"><button data-act="toggle-past">'+(hidePast?'過去の月も表示':'今月以降だけ表示')+'</button></div>';

  (hidePast?d.months.filter(function(m){ return m>=cur; }):d.months).forEach(function(m){
    var total=d.monthTotal(m); if(total===0) return;
    var inner = ['smbc','rakuten'].map(function(acc){
      var g=d.byMonth[m][acc], sum=g.plan+g.stmt; if(sum===0) return '';
      var a=ACCOUNTS[acc];
      return '<div style="margin-bottom:10px">'+
        '<div class="accbar bg-'+a.cls+' '+a.cls+'"><span>'+a.bank+'</span><span class="num">'+yen(sum)+'</span></div>'+
        g.rows.map(function(r){
          var k=r.planId+':'+r.month, on=isPaid(k);
          return '<button class="row '+(on?'done':'')+'" data-act="paid" data-key="'+k+'">'+
            '<span class="chk" style="'+(on?'background:var(--'+a.cls+');border-color:var(--'+a.cls+')':'')+'">'+(on?'✓':'')+'</span>'+
            '<span class="grow"><span class="t" style="display:block">'+esc(r.name)+'</span>'+
            '<span class="s" style="display:block">'+r.index+'/'+r.count+'回目</span></span>'+
            '<span class="t num">'+yen(r.amount)+'</span></button>';
        }).join('')+
        g.stmts.map(function(s){
          return '<div class="row"><span style="width:20px;text-align:center;color:var(--sub);font-size:.8em">＋</span>'+
            '<span class="grow"><span class="t" style="display:block">明細ぶん</span>'+
            '<span class="s" style="display:block">'+esc(s.memo||(s.hasImage?'写真から追加':'手入力'))+'</span></span>'+
            '<span class="t num">'+yen(s.amount)+'</span></div>';
        }).join('')+'</div>';
    }).join('');
    html += section(ymLabel(m), m===cur?'今月':null, inner +
      '<div class="row" style="border-bottom:0"><div class="grow s">月額総合計</div>'+
      '<div class="num" style="font-size:1.05em;font-weight:700">'+yen(total)+'</div></div>');
  });
  return html;
}
function planForm(){
  return '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--rule)" id="planform">'+
    '<div class="field"><label class="f">品物の名前</label><input id="pf_name" placeholder="例：洗濯機"></div>'+
    '<label class="f">引き落とし口座</label>'+
    '<div class="pick">'+Object.keys(ACCOUNTS).map(function(k,i){ var a=ACCOUNTS[k];
      return '<button class="'+a.cls+' '+(i===0?'on':'')+'" data-act="pf-acc" data-id="'+a.id+'">'+
        '<span class="b">'+a.bank+'</span><span class="c">'+a.card+'引落</span></button>'; }).join('')+'</div>'+
    '<div class="pair" style="margin-bottom:11px">'+
      '<div><label class="f">総額（円）</label><input id="pf_total" inputmode="numeric"></div>'+
      '<div style="flex:0 0 90px"><label class="f">回数</label><input id="pf_count" inputmode="numeric" value="6"></div></div>'+
    '<div class="field"><label class="f">初回請求月</label><input id="pf_start" type="month" value="'+addMonths(thisYm(),1)+'"></div>'+
    '<button class="btn" data-act="add-plan">追加する</button></div>';
}

/* ============================== お金：グラフ ============================== */
function viewChart(d){
  var cur=thisYm(), future=d.months.filter(function(m){ return m>=cur; });
  var use = chartRange===0?d.months:future.slice(0,chartRange);
  var data = use.map(function(m){ var g=d.byMonth[m]; return { m:m, a:g.smbc.plan+g.smbc.stmt, b:g.rakuten.plan+g.rakuten.stmt }; });
  var max = Math.max(1, Math.max.apply(null, data.map(function(x){ return x.a+x.b; })));
  var W=340, H=190, bottom=H-24, top=8, gap=3;
  var bw = Math.max(4, (W-8)/data.length - gap);
  var unit = Math.ceil(max/10000)*10000 || 1;
  var scale = function(v){ return (bottom-top) * v / unit; };
  var bars = data.map(function(x,i){
    var px = 4 + i*((W-8)/data.length);
    var ha = scale(x.a), hb = scale(x.b);
    var showLabel = data.length<=8 || i%2===0;
    return '<rect x="'+px.toFixed(1)+'" y="'+(bottom-ha).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+ha.toFixed(1)+'" fill="var(--smbc)"/>'+
      '<rect x="'+px.toFixed(1)+'" y="'+(bottom-ha-hb).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+hb.toFixed(1)+'" fill="var(--rakuten)"/>'+
      (showLabel?'<text x="'+(px+bw/2).toFixed(1)+'" y="'+(H-8)+'" font-size="9" fill="var(--sub)" text-anchor="middle">'+ymShort(x.m)+'</text>':'');
  }).join('');
  var manLabel = function(v){
    var man = v/10000;
    if(man === 0) return '0';
    return (man < 1 || man % 1 !== 0) ? man.toFixed(1) : String(man);
  };
  var grid = [0,.5,1].map(function(f){ var y=bottom-(bottom-top)*f;
    return '<line x1="0" y1="'+y+'" x2="'+W+'" y2="'+y+'" stroke="var(--rule)"/>'+
      '<text x="0" y="'+(y-3)+'" font-size="9" fill="var(--sub)">'+manLabel(unit*f)+'万</text>'; }).join('');

  return section('口座別の必要額', data.length+'ヶ月',
    '<div class="chips">'+[[6,'6ヶ月'],[12,'12ヶ月'],[0,'全期間']].map(function(v){
      return '<button data-act="range" data-v="'+v[0]+'" class="'+(chartRange===v[0]?'on':'')+'">'+v[1]+'</button>'; }).join('')+'</div>'+
    '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto">'+grid+bars+'</svg>'+
    '<div class="s" style="margin-top:6px"><span class="dot" style="background:var(--smbc)"></span>三井住友　<span class="dot" style="background:var(--rakuten)"></span>楽天</div>')
  + section('口座ごとの残り総額', null, ['smbc','rakuten'].map(function(acc){
      var sum = future.reduce(function(s,m){ return s+d.byMonth[m][acc].plan+d.byMonth[m][acc].stmt; },0);
      return accRow(acc, sum, '今月以降の合計');
    }).join(''));
}

/* ============================== お金：明細 ============================== */
function viewStmt(){
  var hasKey = !!S.settings.apiKey;
  return section('明細を追加', '写真の金額は合計に加算されます',
    '<input type="file" accept="image/*" capture="environment" id="cam" class="hide">'+
    '<input type="file" accept="image/*" id="pickf" class="hide">'+
    '<div class="pair"><button class="btn" data-act="cam">カメラで撮る</button>'+
    '<button class="btn ghost" data-act="pick">写真・ファイルから</button></div>'+
    '<button class="btn ghost" style="margin-top:8px" data-act="manual">金額を手で入力</button>'+
    (hasKey?'':'<div class="note">写真からの自動読み取りは、設定タブでAPIキーを登録すると使えます。未登録でも写真は保存され、金額は手で入れられます。</div>')+
    (draft?draftForm():''))
  + section('保存した明細', S.statements.length+'件', S.statements.length===0
      ? '<div class="empty">'+ART.empty+'<div style="margin-top:8px">まだ明細がありません。</div></div>'
      : S.statements.map(function(s){ var a=ACCOUNTS[s.accountId]||ACCOUNTS.smbc;
          return '<div class="row"><div class="tick" style="background:var(--'+a.cls+')"></div>'+
            '<button class="grow" style="background:none;border:0;padding:0;text-align:left;font:inherit;color:inherit" data-act="view-img" data-id="'+s.id+'">'+
            '<div class="t">'+ymLabel(s.billingMonth)+'・'+a.bank+'</div>'+
            '<div class="s">'+esc(s.memo||(s.hasImage?'写真から追加':'手入力'))+'</div></button>'+
            '<div class="amt num">'+yen(s.amount)+'</div>'+
            '<button class="mini" data-act="del-stmt" data-id="'+s.id+'">削除</button></div>';
        }).join(''));
}
function draftForm(){
  return '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--rule)">'+
    (draft.thumb?'<img class="shot" src="'+draft.thumb+'" alt="明細">':'')+
    '<div class="note" style="margin:0 0 12px">'+(draft.thumb?'読み取った内容を確認して、必要なら直してください。':'口座・請求月・金額を入力してください。')+'</div>'+
    '<label class="f">引き落とし口座</label>'+
    '<div class="pick">'+Object.keys(ACCOUNTS).map(function(k){ var a=ACCOUNTS[k];
      return '<button class="'+a.cls+' '+(draft.accountId===a.id?'on':'')+'" data-act="df-acc" data-id="'+a.id+'">'+
        '<span class="b">'+a.bank+'</span><span class="c">'+a.card+'引落</span></button>'; }).join('')+'</div>'+
    '<div class="pair" style="margin-bottom:11px">'+
      '<div><label class="f">請求月</label><input type="month" id="df_month" value="'+draft.billingMonth+'"></div>'+
      '<div><label class="f">金額（円）</label><input id="df_amount" inputmode="numeric" value="'+esc(draft.amount)+'"></div></div>'+
    '<div class="field"><label class="f">メモ</label><input id="df_memo" value="'+esc(draft.memo)+'" placeholder="例：9月分の利用"></div>'+
    '<div class="pair"><button class="btn" data-act="save-stmt">合計に反映する</button>'+
    '<button class="btn ghost" style="flex:0 0 auto;padding:11px 16px" data-act="cancel-stmt">やめる</button></div></div>';
}

/* ============================== お金：収入・固定費・残高 ============================== */
function viewIncome(){
  var inc = sumBy(S.income, function(x){ return x.amount; });
  var fx  = sumBy(S.fixed, function(x){ return x.amount; });
  var sub = sumBy(S.fixed.filter(function(x){ return x.kind==='sub'; }), function(x){ return x.amount; });
  var bal = sumBy(S.balances, function(x){ return x.amount; });

  var partsI = {};
  partsI.income = function(){ return section('毎月の収入', inc?yen(inc):'未登録',
    (S.income.length ? S.income.map(function(x){
      return '<div class="row"><div class="tick" style="background:var(--smbc)"></div>'+
        '<div class="grow"><div class="t">'+esc(x.name)+'</div>'+
        '<div class="s">'+(x.day?'毎月'+x.day+'日ごろ':'入金日未設定')+(x.memo?'・'+esc(x.memo):'')+'</div></div>'+
        '<div class="amt num">'+yen(x.amount)+'</div>'+
        '<button class="mini" data-act="del-income" data-id="'+x.id+'">削除</button></div>';
    }).join('') : '<div class="empty">バイト代や仕送りを登録すると、使えるお金が分かります。</div>')+
    '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--rule)">'+
    '<div class="field"><label class="f">名前</label><input id="in_name" placeholder="例：バイト代"></div>'+
    '<div class="pair" style="margin-bottom:11px">'+
      '<div><label class="f">金額（円）</label><input id="in_amount" inputmode="numeric"></div>'+
      '<div style="flex:0 0 100px"><label class="f">入金日</label><input id="in_day" inputmode="numeric" placeholder="15"></div></div>'+
    '<button class="btn" data-act="add-income">収入を追加</button></div>'); };
  partsI.fixed = function(){ return section('固定費・サブスク', fx?yen(fx)+'（うちサブスク '+yen(sub)+'）':'未登録',
    (S.fixed.length ? S.fixed.map(function(x){
      return '<div class="row"><div class="tick" style="background:'+(x.kind==='sub'?'var(--e8)':'var(--e10)')+'"></div>'+
        '<div class="grow"><div class="t">'+esc(x.name)+'</div>'+
        '<div class="s">'+(x.kind==='sub'?'サブスク':'固定費')+(x.day?'・毎月'+x.day+'日':'')+'</div></div>'+
        '<div class="amt num">'+yen(x.amount)+'</div>'+
        '<button class="mini" data-act="del-fixed" data-id="'+x.id+'">削除</button></div>';
    }).join('') : '<div class="empty">家賃・通信費・サブスクなどを登録できます。</div>')+
    '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--rule)">'+
    '<div class="field"><label class="f">名前</label><input id="fx_name" placeholder="例：Spotify"></div>'+
    '<label class="f">種類</label>'+
    '<div class="pick"><button class="on" data-act="fx-kind" data-id="sub"><span class="b">サブスク</span></button>'+
    '<button data-act="fx-kind" data-id="fix"><span class="b">固定費</span></button></div>'+
    '<div class="pair" style="margin-bottom:11px">'+
      '<div><label class="f">月額（円）</label><input id="fx_amount" inputmode="numeric"></div>'+
      '<div style="flex:0 0 100px"><label class="f">引落日</label><input id="fx_day" inputmode="numeric" placeholder="27"></div></div>'+
    '<button class="btn" data-act="add-fixed">追加する</button></div>'); };

  var stale = S.balances.filter(function(x){
    return !x.mt || toYm(new Date(x.mt)) !== thisYm();
  });
  partsI.balance = function(){ return section('口座の残高', bal?yen(bal):'未登録',
    (S.balances.length && stale.length ? '<div class="bn amber" style="margin-bottom:10px"><span class="ic">!</span>'+
      '<span>今月まだ更新していない口座が'+stale.length+'件あります。通帳やアプリで見た金額に直しておきましょう。</span></div>' : '')+
    (S.balances.length ? S.balances.map(function(x){
      return '<div class="row"><div class="grow"><div class="t">'+esc(x.name)+'</div>'+
        '<div class="s">'+(x.mt?'更新 '+new Date(x.mt).toLocaleDateString('ja-JP')+(toYm(new Date(x.mt))===thisYm()?'（今月）':'（要更新）'):'未更新')+'</div></div>'+
        '<div class="amt num">'+yen(x.amount)+'</div>'+
        '<button class="mini" data-act="edit-bal" data-id="'+x.id+'">直す</button>'+
        '<button class="mini" data-act="del-bal" data-id="'+x.id+'">削除</button></div>';
    }).join('')+'<div class="row" style="border-top:1px solid var(--rule)"><div class="grow s">合計</div><div class="mid num">'+yen(bal)+'</div></div>'
     : '<div class="empty">通帳やアプリで見た残高を入れておくと、足りるかどうかが分かります。</div>')+
    '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--rule)">'+
    '<div class="pair" style="margin-bottom:11px">'+
      '<div><label class="f">口座名</label><input id="bl_name" placeholder="例：三井住友銀行"></div>'+
      '<div><label class="f">残高（円）</label><input id="bl_amount" inputmode="numeric"></div></div>'+
    '<button class="btn" data-act="add-bal">残高を追加</button></div>'); };
  var html = '';
  pageOrder('in').forEach(function(id){ if(partsI[id] && !pageHidden('in', id)) html += partsI[id](); });
  return html;
}

/* ============================== 明細の写真読み取り ============================== */
async function readStatement(dataUrl){
  var res = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-api-key':S.settings.apiKey,
      'anthropic-version':'2023-06-01',
      'anthropic-dangerous-direct-browser-access':'true'
    },
    body: JSON.stringify({
      model:'claude-sonnet-5', max_tokens:1000,
      messages:[{ role:'user', content:[
        { type:'image', source:{ type:'base64', media_type:'image/jpeg', data:dataUrl.split(',')[1] } },
        { type:'text', text:'これはクレジットカードの利用明細の写真です。次のJSONだけを返してください。前置きやコードフェンスは不要です。\n{"issuer":"三井住友カード|楽天カード|不明","billing_month":"YYYY-MM または null","total_amount":請求合計の数値,"items":[{"name":"店名など","amount":数値}]}\ntotal_amount はその月の請求合計。読み取れない値は null に。' }
      ]}]
    })
  });
  if(!res.ok) throw new Error('API ' + res.status);
  var data = await res.json();
  var text = (data.content||[]).map(function(c){ return c.type==='text'?c.text:''; }).join('\n').replace(/```json|```/g,'').trim();
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}')+1));
}
async function handlePhoto(file){
  toast('写真を読み込んでいます…');
  try{
    var thumb = await resizeImage(file, 480, 0.5);
    var parsed = {};
    if(S.settings.apiKey){
      try{
        var big = await resizeImage(file, 1400, 0.8);
        parsed = await readStatement(big);
      }catch(e){ toast('金額を読み取れませんでした。手で入力してください。', true); }
    }
    draft = {
      id:uid('s'),
      accountId:(parsed.issuer||'').indexOf('楽天')>=0 ? 'rakuten' : 'smbc',
      billingMonth: isYm(parsed.billing_month) ? parsed.billing_month : thisYm(),
      amount: parsed.total_amount ? String(parsed.total_amount) : '',
      memo: (Array.isArray(parsed.items) ? parsed.items : []).slice(0,2)
              .map(function(i){ return i && i.name ? String(i.name) : ''; }).filter(Boolean).join('、'),
      thumb: thumb
    };
  }catch(e){ toast('写真を読み込めませんでした。別の写真で試してください。', true); }
  render();
}
function readDraftFields(){
  var m=document.getElementById('df_month'), a=document.getElementById('df_amount'), me=document.getElementById('df_memo');
  if(m && isYm(m.value)) draft.billingMonth=m.value;
  if(a) draft.amount=a.value.replace(/[^0-9]/g,'');
  if(me) draft.memo=me.value;
}

/* ============================== お金：操作 ============================== */
function moneyAction(act, t){
  if(act==='shift-ocr'){
    var nmS = val('so_name').trim();
    if(nmS !== String(S.settings.shiftName||'')){ S.settings.shiftName = nmS; persist(); pushRemote(); }
    if(!aiReady()){ toast('先に設定タブでGemini APIキーを登録してください', true); return true; }
    var fi = document.getElementById('shiftimg'); if(fi) fi.click();
    return true;
  }
  if(act==='shift-ocr-add'){ shiftOcrAdd(); return true; }
  if(act==='shift-ocr-cancel'){ shiftOcr = { busy:false, list:null, err:'' }; render(); return true; }
  if(act==='paid'){ var k=t.dataset.key; setPaid(k, !isPaid(k)); commit(); }
  else if(act==='toggle-past'){ hidePast=!hidePast; render(); }
  else if(act==='range'){ chartRange=Number(t.dataset.v); render(); }
  else if(act==='toggle-plan-form'){ showPlanForm=!showPlanForm; render(); }
  else if(act==='pf-acc' || act==='df-acc' || act==='fx-kind'){
    Array.prototype.forEach.call(t.parentNode.querySelectorAll('button'), function(b){ b.classList.remove('on'); });
    t.classList.add('on');
    if(act==='df-acc'){ readDraftFields(); draft.accountId=t.dataset.id; render(); }
  }
  else if(act==='del-plan'){
    var id=t.dataset.id;
    markDeleted(id);
    S.plans=S.plans.filter(function(p){ return p.id!==id; });
    Object.keys(S.paid).forEach(function(key){ if(key.indexOf(id+':')===0) delete S.paid[key]; });
    toast('削除しました'); commit();
  }
  else if(act==='add-plan'){
    var name=val('pf_name').trim(), total=toNum(val('pf_total')), count=toNum(val('pf_count')), start=val('pf_start');
    var accBtn=document.querySelector('#planform .pick button.on');
    if(!name||!total||!count){ toast('名前・総額・回数を入れてください', true); return true; }
    if(!isYm(start)) start=addMonths(thisYm(),1);
    var monthly=Math.floor(total/count), rem=total-monthly*count;
    S.plans.push({ id:uid('p'), name:name, accountId:accBtn?accBtn.dataset.id:'smbc', count:count, monthly:monthly, firstAmount:rem>0?monthly+rem:null, start:start, mt:Date.now() });
    showPlanForm=false; toast(name+' を追加しました（月々 '+yen(monthly)+'）'); commit();
  }
  else if(act==='cam'){ document.getElementById('cam').click(); }
  else if(act==='pick'){ document.getElementById('pickf').click(); }
  else if(act==='manual'){ draft={ id:uid('s'), accountId:'smbc', billingMonth:thisYm(), amount:'', memo:'', thumb:null }; render(); }
  else if(act==='cancel-stmt'){ draft=null; render(); }
  else if(act==='save-stmt'){
    readDraftFields();
    if(!draft.amount){ toast('金額を入れてください', true); return true; }
    var s={ id:draft.id, accountId:draft.accountId, billingMonth:draft.billingMonth, amount:Number(draft.amount), memo:draft.memo, hasImage:!!draft.thumb, createdAt:Date.now(), mt:Date.now() };
    if(draft.thumb){ try{ localStorage.setItem(imgKey(s.id), draft.thumb); }catch(err){ s.hasImage=false; } }
    S.statements.unshift(s); draft=null;
    toast(ymLabel(s.billingMonth)+'に '+yen(s.amount)+' を加算しました'); commit();
  }
  else if(act==='del-stmt'){
    var sid=t.dataset.id;
    markDeleted(sid);
    S.statements=S.statements.filter(function(x){ return x.id!==sid; });
    try{ localStorage.removeItem(imgKey(sid)); }catch(err){}
    toast('削除しました'); commit();
  }
  else if(act==='view-img'){
    var src=null; try{ src=localStorage.getItem(imgKey(t.dataset.id)); }catch(err){}
    if(!src){ toast('この端末に写真は保存されていません'); return true; }
    var box=el('<div id="lightbox"><img src="'+src+'" alt="明細"></div>');
    box.addEventListener('click',function(){ box.remove(); });
    document.body.appendChild(box);
  }
  else if(act==='ics'){ makeIcs(); toast('カレンダー用ファイルを保存しました'); }
  else if(act==='add-income'){
    var n=val('in_name').trim(), a=toNum(val('in_amount')), dd=toNum(val('in_day'));
    if(!n||!a){ toast('名前と金額を入れてください', true); return true; }
    S.income.push({ id:uid('in'), name:n, amount:a, day:(dd>=1&&dd<=31)?dd:0, memo:'', mt:Date.now() });
    toast('収入を追加しました'); commit();
  }
  else if(act==='del-income'){ removeWithUndo('income', t.dataset.id, '削除しました'); commit(); }
  else if(act==='add-fixed'){
    var fn=val('fx_name').trim(), fa=toNum(val('fx_amount')), fd=toNum(val('fx_day'));
    var kb=document.querySelector('[data-act="fx-kind"].on');
    if(!fn||!fa){ toast('名前と月額を入れてください', true); return true; }
    S.fixed.push({ id:uid('fx'), name:fn, amount:fa, day:(fd>=1&&fd<=31)?fd:0, kind:kb?kb.dataset.id:'sub', mt:Date.now() });
    toast('追加しました'); commit();
  }
  else if(act==='del-fixed'){ removeWithUndo('fixed', t.dataset.id, '削除しました'); commit(); }
  else if(act==='add-bal'){
    var bn=val('bl_name').trim(), ba=toNum(val('bl_amount'));
    if(!bn){ toast('口座名を入れてください', true); return true; }
    S.balances.push({ id:uid('bl'), name:bn, amount:ba, mt:Date.now() });
    toast('残高を追加しました'); commit();
  }
  else if(act==='fuyou-set'){ S.settings.fuyouLimit = toNum(t.dataset.v); toast('切り替えました'); commit(); }
  else if(act==='edit-bal'){
    var b=S.balances.filter(function(x){ return x.id===t.dataset.id; })[0];
    if(!b) return true;
    var v=prompt(b.name+' の残高（円）', String(b.amount));
    if(v===null) return true;
    b.amount=toNum(v); b.mt=Date.now();
    /* 月ごとの記録を残す（残高の推移に使う） */
    b.hist = Array.isArray(b.hist) ? b.hist : [];
    var ym0 = thisYm();
    b.hist = b.hist.filter(function(h){ return h.ym !== ym0; });
    b.hist.push({ ym:ym0, amount:b.amount });
    if(b.hist.length > 36) b.hist = b.hist.slice(-36);
    toast('更新しました'); commit();
  }
  else if(act==='del-bal'){ removeWithUndo('balances', t.dataset.id, '削除しました'); commit(); }
  else if(act==='work-prev'){ workYm = addMonths(workYm || openYm(), -1); render(); }
  else if(act==='work-next'){ workYm = addMonths(workYm || openYm(), 1); render(); }
  else if(act==='work-now'){ workYm = openYm(); render(); }
  else if(act==='ot-plus' || act==='ot-minus'){
    var w = S.shifts.filter(function(x){ return x.id===t.dataset.id; })[0];
    if(!w) return true;
    var n = act==='ot-plus' ? toNum(t.dataset.n) : -10;
    w.ot = toNum(w.ot) + n; w.mt = Date.now();
    toast('残業 '+toNum(w.ot)+'分'); commit();
  }
  else if(act==='pay-apply'){
    var ym3 = t.dataset.ym, amt = toNum(val('pay_amt')) || periodPay(ym3);
    if(!amt){ toast('金額を入れてください', true); return true; }
    var bank = S.balances.filter(function(x){ return x.id===S.settings.payBankId; })[0] || S.balances[0];
    if(!bank){
      bank = { id:uid('bl'), name:'給与振込口座', amount:0, mt:Date.now() };
      S.balances.push(bank); S.settings.payBankId = bank.id;
    }
    bank.amount = toNum(bank.amount) + amt; bank.mt = Date.now();
    S.payApplied[ym3] = { amount:amt, at:Date.now(), bank:bank.id };
    touch('payApplied'); toast(bank.name+' に '+yen(amt)+' を入れました'); commit();
  }
  else if(act==='pay-undo'){
    var ym4 = t.dataset.ym, rec = S.payApplied[ym4];
    if(!rec) return true;
    var bk = S.balances.filter(function(x){ return x.id===rec.bank; })[0];
    if(bk){ bk.amount = toNum(bk.amount) - toNum(rec.amount); bk.mt = Date.now(); }
    delete S.payApplied[ym4];
    touch('payApplied'); toast('取り消しました'); commit();
  }
  else if(act==='shift-to-income-unused'){
    var ym2 = calYm, ls = S.shifts.filter(function(x){ return String(x.date).slice(0,7)===ym2; });
    var total = ls.reduce(function(a,x){ return a + shiftPay(x); }, 0);
    if(!total){ toast('シフトがありません', true); return true; }
    var cur2 = S.income.filter(function(x){ return x.id==='in_shift'; })[0];
    if(cur2){ cur2.amount = total; cur2.memo = ymLabel(ym2)+'のシフトから'; cur2.mt = Date.now(); }
    else S.income.push({ id:'in_shift', name:'バイト代（シフトから）', amount:total, day:0, memo:ymLabel(ym2)+'のシフトから', mt:Date.now() });
    toast('収入に '+yen(total)+' を入れました'); commit();
  }
  else if(act==='save-wage'){
    S.settings.wage = toNum(val('wk_wage'));
    toast('時給を保存しました'); commit();
  }
  else if(act==='work-to-income'){
    var ym = calYm;
    var hrs = S.shifts.filter(function(w){ return String(w.date).slice(0,7)===ym; })
      .reduce(function(a,w){ return a + shiftHours(w); }, 0);
    var amt = Math.round(hrs * toNum(S.settings.wage));
    if(!amt){ toast('シフトと時給を登録してください', true); return true; }
    var ex = S.income.filter(function(x){ return x.name==='バイト代（見込み）'; })[0];
    if(ex){ ex.amount = amt; ex.mt = Date.now(); }
    else S.income.push({ id:uid('in'), name:'バイト代（見込み）', amount:amt, day:0, memo:'', mt:Date.now() });
    toast(yen(amt)+' を収入に登録しました'); commit();
  }
  else return false;
  return true;
}


function viewShifts(){
  var ym = (typeof workYm === 'string' && /^\d{4}-\d{2}$/.test(workYm)) ? workYm : openYm();
  var p = payPeriod(ym);
  var list = shiftsInPeriod(ym);
  var mins = list.reduce(function(a,x){ return a + shiftMinutes(x); }, 0);
  var ot   = list.reduce(function(a,x){ return a + toNum(x.ot); }, 0);
  var pay  = periodPay(ym);
  var fareAll = list.length * (toNum(S.settings.fare)||0);
  var done = !!S.payApplied[ym];
  var canApply = today() >= p.payDay && !done && pay > 0;

  var partsW = {};
  partsW.period = function(){ return section(ymLabel(ym)+'25日払いぶん', list.length ? list.length+'回' : 'シフトなし',
    '<div class="head" style="margin:-4px 0 10px"><h2 style="font-weight:400;color:var(--sub);font-size:.78em">'+
      ymdLabel(p.from)+' 〜 '+ymdLabel(p.to)+' の勤務</h2>'+
    '<span><button class="mini" data-act="work-prev">‹ 前</button> '+
    '<button class="mini" data-act="work-now">今</button> '+
    '<button class="mini" data-act="work-next">次 ›</button></span></div>'+
    '<div class="grid2" style="margin-bottom:12px">'+
      '<div class="stat"><div class="k">はたらいた時間</div><div class="v num">'+(Math.round(mins/6)/10)+' 時間</div></div>'+
      '<div class="stat"><div class="k">うち残業</div><div class="v num">'+ot+' 分</div></div>'+
      '<div class="stat"><div class="k">お給料</div><div class="v num">'+yen(pay)+'</div></div>'+
      '<div class="stat"><div class="k">交通費ぶん</div><div class="v num">'+yen(fareAll)+'</div></div>'+
    '</div>'+
    '<div class="'+(done?'msg ok':'bn blue')+'" style="margin-bottom:12px">'+
      (done ? 'このぶんは残高に入れました（'+ymdLabel(p.payDay)+'）'
            : '<span class="ic">¥</span><span>'+ymdLabel(p.payDay)+' に '+yen(pay)+' が振り込まれる見込みです。</span>')+'</div>'+
    (canApply ? '<div class="pair" style="margin-bottom:8px"><div><label class="f">実際に振り込まれた額（円）</label><input id="pay_amt" inputmode="numeric" value="'+pay+'"></div>'+
      '<button class="btn" style="flex:0 0 auto;align-self:flex-end" data-act="pay-apply" data-ym="'+ym+'">残高に入れる</button></div>'+
      '<p class="note" style="margin:-4px 0 10px">見込みは'+yen(pay)+'です。通帳やアプリの金額に直して入れてください。</p>' : '')+
    (done ? '<button class="btn ghost" data-act="pay-undo" data-ym="'+ym+'">残高への反映を取り消す</button>' : '')+
    (list.length ? '<div style="margin-top:12px">'+list.map(function(x){
      var mm = shiftMinutes(x);
      return '<div class="row"><div class="tick" style="background:'+colorOf(x.color||kindOf('work').color)+'"></div>'+
        '<div class="grow"><div class="t">'+esc(x.title || S.settings.shop || 'バイト')+'<span class="b cr" style="margin-left:6px">'+(isWeekend(x.date)?'土日':'平日')+'</span></div>'+
        '<div class="s">'+ymdLabel(x.date)+'　'+esc(x.start||'')+'〜'+esc(x.realEnd||x.end||'')+
          (x.realEnd && x.realEnd!==x.end ? '（予定は'+esc(x.end||'')+'）' : '')+
          '　'+(Math.round((mm-shiftBreak(x)+toNum(x.ot))/6)/10)+'時間'+(shiftBreak(x)?'・休憩1h引':'')+
          (toNum(x.ot)>0?'・残業'+toNum(x.ot)+'分':toNum(x.ot)<0?'・早上がり'+(-toNum(x.ot))+'分':'')+'</div></div>'+
        '<div class="amt num">'+yen(shiftPay(x))+'</div></div>'+
        '<div class="row" style="padding-top:0"><div class="grow s">終わった時間を直す</div>'+
        '<button class="mini" data-act="ot-plus" data-id="'+x.id+'" data-n="-10">−10分</button>'+
        '<button class="mini" data-act="ot-plus" data-id="'+x.id+'" data-n="10">＋10分</button>'+
        '<button class="mini" data-act="ev-open" data-src="work" data-id="'+x.id+'">詳細</button></div>';
    }).join('')+'</div>' : '<div class="empty" style="margin-top:12px">'+ART.empty+'<div style="margin-top:8px">この期間のシフトはありません。</div></div>')+
    '<button class="btn ghost" style="margin-top:12px" data-act="go" data-app="cal" data-tab="cal">カレンダーでシフトを追加</button>'+
    '<p class="note">分給は平日'+(Number(S.settings.minWeekday)||0)+'円／土日'+(Number(S.settings.minWeekend)||0)+'円。7時間以上の日は休憩1時間を引き、1回ごとに交通費'+yen(toNum(S.settings.fare))+'を足しています。15日締め・25日払いです。</p>');

; };
  partsW.ocr = function(){ return shiftOcrCard(); };
  partsW.next = function(){
    var nextYm = closeYmOf(shiftDate(p.to, 1));
    if(nextYm === ym) return '';
    var np = payPeriod(nextYm), nl = shiftsInPeriod(nextYm);
    return section('次の給料の見込み', ymdLabel(np.payDay)+'払い',
      '<div class="big num">'+yen(periodPay(nextYm))+'</div>'+
      '<div class="s" style="margin-top:4px">'+ymdLabel(np.from)+' 〜 '+ymdLabel(np.to)+'　'+nl.length+'回ぶん</div>');
  };
  var h = '';
  if(typeof kmParts === 'function') kmParts('work', partsW, { ym:ym });
  pageOrder('work').forEach(function(id){ if(partsW[id] && !pageHidden('work', id)) h += partsW[id](); });
  return h;
}


/* ===== 扶養の壁（91）===== */
function yearPayTotal(y){
  /* その年に「支払われた」ぶん（25日払い基準） */
  var total = 0;
  Object.keys(S.payApplied||{}).forEach(function(ym){
    var rec = S.payApplied[ym];
    var p = payPeriod(ym);
    if(String(p.payDay).slice(0,4) === String(y)) total += toNum(rec.amount);
  });
  /* まだ入れていない期間は見込みで足す */
  for(var m=1;m<=12;m++){
    var ym2 = y+'-'+pad(m);
    if(S.payApplied && S.payApplied[ym2]) continue;
    var amt = periodPay(ym2);
    if(amt) total += amt;
  }
  return total;
}
function fuyouCard(){
  var y = new Date().getFullYear();
  var total = yearPayTotal(y);
  var walls = [[1030000,'103万'],[1300000,'130万']];
  var limit = toNum(S.settings.fuyouLimit) || 1030000;
  var pct = Math.min(100, Math.round(total/limit*100));
  var rest = limit - total;
  var cls = pct>=90 ? 'over' : pct>=75 ? '' : 'done';
  var msg = rest > 0
    ? 'あと '+yen(rest)+' で '+(limit===1030000?'103万':'130万')+' に届きます。'
    : '<b>'+(limit===1030000?'103万':'130万')+'を超えています。</b>おうちの人に相談してください。';
  return section('扶養の壁', y+'年の見込み '+yen(total),
    '<div class="bar" style="margin-bottom:8px"><i class="'+cls+'" style="width:'+pct+'%"></i></div>'+
    '<div class="msg '+(pct>=90?'ng':'ok')+'" style="margin-bottom:12px">'+msg+'</div>'+
    '<div class="pillrow">'+walls.map(function(w){
      return '<button data-act="fuyou-set" data-v="'+w[0]+'" class="'+(limit===w[0]?'on':'')+'">'+w[1]+'で見る</button>';
    }).join('')+'</div>'+
    '<p class="note">25日に振り込まれた実際の額と、これからのシフトの見込みを足しています。交通費も含みます。</p>');
}
/* ===== 年間の給与（92）===== */
function yearPayChart(){
  var y = new Date().getFullYear(), vals = [], labels = [];
  for(var m=1;m<=12;m++){
    var ym = y+'-'+pad(m);
    var rec = (S.payApplied||{})[ym];
    vals.push(rec ? toNum(rec.amount) : periodPay(ym));
    labels.push(m);
  }
  var max = Math.max.apply(null, vals.concat([1]));
  var cum = 0;
  return section('年間の給与', y+'年',
    '<div class="chart" style="height:120px">'+vals.map(function(v,i){
      var rec = (S.payApplied||{})[y+'-'+pad(i+1)];
      return '<div class="col"><div class="bar2" style="height:'+Math.max(2,Math.round(v/max*90))+'px;background:'+(rec?'linear-gradient(180deg,var(--accent2),var(--accent))':'var(--soft)')+'"></div>'+
        '<div class="lb">'+labels[i]+'</div></div>';
    }).join('')+'</div>'+
    '<p class="note">濃い色は実際に入った月、うすい色は見込みです。</p>');
}
/* ===== 残高の推移（108）===== */
function balanceChart(){
  var hist = [];
  (S.balances||[]).forEach(function(b){
    (b.hist||[]).forEach(function(h){ hist.push({ ym:h.ym, amount:toNum(h.amount), name:b.name }); });
  });
  if(!hist.length){
    return section('残高の推移', null,
      '<div class="empty">残高を直すたびに記録していきます。</div>'+
      '<p class="note">口座の残高を更新すると、月ごとの動きがグラフになります。</p>');
  }
  var byYm = {};
  hist.forEach(function(h){ byYm[h.ym] = (byYm[h.ym]||0) + h.amount; });
  var keys = Object.keys(byYm).sort().slice(-12);
  var vals = keys.map(function(k){ return byYm[k]; });
  var max = Math.max.apply(null, vals.concat([1]));
  return section('残高の推移', keys.length+'か月',
    '<div class="chart" style="height:120px">'+vals.map(function(v,i){
      return '<div class="col"><div class="bar2" style="height:'+Math.max(2,Math.round(v/max*90))+'px;background:linear-gradient(180deg,var(--accent2),var(--accent))"></div>'+
        '<div class="lb">'+(+keys[i].slice(5,7))+'</div></div>';
    }).join('')+'</div>'+
    '<div class="s2">いま '+yen(vals[vals.length-1])+'</div>');
}
