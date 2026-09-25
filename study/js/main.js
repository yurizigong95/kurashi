/* もんだいメーカー：はじまり（読みこみの最後に走る） */

function boot(){
  load();
  bindEvents();
  /* ?tab=drill のように、開くところを決められる */
  try{
    var m = String(location.search).match(/[?&]tab=([a-z]+)/);
    if(m && TABS.some(function(t){ return t[0] === m[1]; })) view.tab = m[1];
  }catch(e){}
  render();
  var sp = document.getElementById('splash');
  if(sp) sp.style.display = 'none';
  window.__MK_OK = 1;
  /* ほかの端末と自動でそろえる（つなぎ先が用意できているときだけ） */
  if(typeof syStart === 'function') setTimeout(function(){ syStart(); }, 300);
  /* オフラインでも使えるように（テストのときは入れない） */
  if(!TEST_MODE && 'serviceWorker' in navigator){
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('sw.js').catch(function(){});
    });
  }
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
