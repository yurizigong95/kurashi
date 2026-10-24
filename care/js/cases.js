/* かんご実習メーカー：「事例」タブ（事例ライブラリ：登録・編集・一覧） */

var csv = { edit:'', q:'' };      /* edit … 直している事例の id（'new' は新しく作る） */

function casesView(){
  if(csv.edit) return caseForm(csv.edit === 'new' ? null : cs(csv.edit));
  var list = cases(), q = String(csv.q || '').trim().toLowerCase();
  if(q) list = list.filter(function(c){ return (c.name + ' ' + c.dx + ' ' + c.memo + ' ' + caseWho(c)).toLowerCase().indexOf(q) >= 0; });
  var h = '';
  h += '<div class="pair topact">' + btn('＋ 事例を作る', 'cs-new', { cls:'main' }) + '</div>';
  if(S.cases.length > 3){
    h += '<input id="cs_q" type="search" class="search" data-act="cs-q" placeholder="事例名・疾患名でさがす" value="' + esc(csv.q) + '">';
  }
  if(!list.length){
    h += S.cases.length ? empty('見つかりませんでした') :
      section(null, null, empty('まだ事例がありません。') +
        btn('学習用の事例（3つ）を入れる', 'cs-seed', { cls:'ghost' }));
    return h;
  }
  h += list.map(function(c){
    var p = caseProgress(c), cur = curCase() && curCase().id === c.id;
    return '<section class="card case' + (cur ? ' cur' : '') + '">' +
      '<button type="button" class="casehd" data-act="cs-open" data-id="' + esc(c.id) + '">' +
        '<b>' + esc(c.name || '（名前なし）') + '</b>' +
        '<span class="s">' + esc([caseWho(c), c.dx].filter(Boolean).join('／')) + '</span>' +
        (c.memo ? '<span class="s memo">' + esc(String(c.memo).replace(/\s+/g, ' ').slice(0, 80)) + (c.memo.length > 80 ? '…' : '') + '</span>' : '') +
        '<span class="prog">' +
          '<i class="' + (p.info ? 'on' : '') + '">情報 ' + p.info + '</i>' +
          '<i class="' + (p.asm ? 'on' : '') + '">アセス ' + p.asm + '</i>' +
          '<i class="' + (p.probs ? 'on' : '') + '">問題 ' + p.probs + '</i>' +
          '<i class="' + (p.plan ? 'on' : '') + '">計画 ' + p.plan + '</i>' +
          '<i class="' + (p.evals ? 'on' : '') + '">評価 ' + p.evals + '</i>' +
        '</span>' +
      '</button>' +
      '<div class="minirow">' +
        '<button type="button" data-act="cs-open" data-id="' + esc(c.id) + '">🩺 看護過程</button>' +
        '<button type="button" data-act="cs-chat" data-id="' + esc(c.id) + '">💬 AI壁打ち</button>' +
        '<button type="button" data-act="cs-edit" data-id="' + esc(c.id) + '">✏️ 事例を直す</button>' +
      '</div>' +
    '</section>';
  }).join('');
  h += note('事例は<b>学習用の架空のもの</b>だけを入れてください。実習先の患者さんの情報（名前・年齢・病室・くわしい経過など）は入れないでください。');
  return h;
}

function caseForm(c){
  var isNew = !c;
  c = c || { name:'', age:'', sex:'', dx:'', memo:'' };
  var opt = function(list, cur){
    return '<option value="">（えらぶ）</option>' + list.map(function(x){
      return '<option value="' + esc(x) + '"' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>';
    }).join('') + (cur && list.indexOf(cur) < 0 ? '<option value="' + esc(cur) + '" selected>' + esc(cur) + '</option>' : '');
  };
  return section(isNew ? '事例を作る' : '事例を直す', null,
    '<label class="f" for="cs_name">事例名</label>' +
    '<input id="cs_name" type="text" maxlength="60" placeholder="例：心不全で入院した高齢者（Dさん）" value="' + esc(inVal('cs_name', c.name)) + '">' +
    '<div class="pair">' +
      '<div><label class="f" for="cs_age">年齢層</label><select id="cs_age">' + opt(D_AGES, inVal('cs_age', c.age)) + '</select></div>' +
      '<div><label class="f" for="cs_sex">性別</label><select id="cs_sex">' + opt(D_SEXES, inVal('cs_sex', c.sex)) + '</select></div>' +
    '</div>' +
    '<label class="f" for="cs_dx">疾患名（学習用の架空のもの）</label>' +
    '<input id="cs_dx" type="text" maxlength="80" placeholder="例：慢性心不全の急性増悪" value="' + esc(inVal('cs_dx', c.dx)) + '">' +
    '<label class="f" for="cs_memo">状況メモ（経過の要約）</label>' +
    '<textarea id="cs_memo" rows="6" placeholder="入院のきっかけ・いまの治療・生活のようす など">' + esc(inVal('cs_memo', c.memo)) + '</textarea>' +
    warnBox('実在の患者さんの情報は入れないでください。教科書や授業の事例をもとに、<b>名前や細かいところを変えた架空の事例</b>にしてください。') +
    '<div class="pair">' + btn(isNew ? '作る' : '保存', 'cs-save', { cls:'main', data:{ id:isNew ? '' : c.id } }) + btn('やめる', 'cs-cancel', { cls:'ghost' }) + '</div>' +
    (isNew ? '' : '<div class="minirow"><button type="button" class="danger" data-act="cs-del" data-id="' + esc(c.id) + '">この事例を消す</button></div>'));
}

onView('cases', casesView);

function csFormClear(){ inClear('cs_'); }
onAct('cs-new', function(){ csFormClear(); csv.edit = 'new'; render(); window.scrollTo(0, 0); });
onAct('cs-edit', function(d){ csFormClear(); csv.edit = d.id; render(); window.scrollTo(0, 0); });
onAct('cs-cancel', function(){ csFormClear(); csv.edit = ''; render(); });
onAct('cs-q', function(d, el){ csv.q = el.value; render(); });
onAct('cs-save', function(d){
  var name = String(elVal('cs_name') || '').trim();
  if(!name){ toast('事例名を入れてください', true); return; }
  var o = { name:name, age:String(elVal('cs_age') || ''), sex:String(elVal('cs_sex') || ''),
            dx:String(elVal('cs_dx') || '').trim(), memo:String(elVal('cs_memo') || '').replace(/\s+$/, '') };
  var c = d.id ? cs(d.id) : null;
  if(c){ Object.assign(c, o); caseTouch(c, true); toast('保存しました'); }
  else{ c = caseNew(o); setCur(c.id); saveNow(); toast('事例を作りました'); }
  csFormClear();
  csv.edit = '';
  render();
});
onAct('cs-del', function(d){
  var c = cs(d.id);
  if(!c) return;
  if(!ask('「' + (c.name || '事例') + '」を消します。看護過程の書きこみとAI壁打ちの記録も消えます。よろしいですか？')) return;
  caseDel(c.id);
  saveNow();
  csFormClear();
  csv.edit = '';
  toast('消しました');
  render();
});
onAct('cs-open', function(d){ setCur(d.id); saveSoon(); go('work'); });
onAct('cs-chat', function(d){ setCur(d.id); saveSoon(); go('chat'); });
onAct('cs-seed', function(){
  var n = seedCases(true);
  saveNow();
  toast(n ? '学習用の事例を' + n + 'つ入れました' : 'もう入っています');
  render();
});
