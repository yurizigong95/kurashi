/* くらしの手帳：かざり・イラスト */
/* ============================== かざり（背景のイラスト） ============================== */
/* 背景にそっと絵を置く。色だけでなく、その日らしさを出すため */

var DECOR = {
  /* ===== 行事 ===== */
  xmas: {
    name:'クリスマス',
    sky:'linear-gradient(180deg, rgba(30,50,70,.10), rgba(255,255,255,0) 40%)',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".55">'+
      '<path d="M60 130 L60 118" stroke="#6B4A2F" stroke-width="5"/>'+
      '<path d="M60 40 L34 80 L48 80 L28 112 L92 112 L72 80 L86 80 Z" fill="#4F8F5E"/>'+
      '<circle cx="60" cy="36" r="6" fill="#E8C24A"/>'+
      '<circle cx="50" cy="70" r="3.5" fill="#D94F4F"/><circle cx="72" cy="90" r="3.5" fill="#E8C24A"/>'+
      '<circle cx="56" cy="99" r="3.5" fill="#D94F4F"/>'+
      '<path d="M330 130 L330 120" stroke="#6B4A2F" stroke-width="4"/>'+
      '<path d="M330 62 L310 94 L322 94 L306 118 L354 118 L338 94 L350 94 Z" fill="#3F7A4E"/>'+
      '<circle cx="330" cy="58" r="4.5" fill="#E8C24A"/>'+
      '</g>'+
      '<g opacity=".38" fill="#fff">'+
      '<circle cx="120" cy="30" r="3"/><circle cx="180" cy="55" r="2.4"/><circle cx="240" cy="25" r="3.2"/>'+
      '<circle cx="280" cy="62" r="2.2"/><circle cx="150" cy="86" r="2.6"/><circle cx="210" cy="100" r="2"/>'+
      '<circle cx="265" cy="38" r="2"/><circle cx="95" cy="60" r="2.2"/></g></svg>',
    fall:{ ch:['❄','✻','·'], color:'rgba(255,255,255,.75)', n:16, speed:14 }
  },
  newyear: {
    name:'お正月',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".5">'+
      '<circle cx="330" cy="40" r="26" fill="#E8646E" opacity=".55"/>'+
      '<path d="M40 128 L40 96" stroke="#7BA05B" stroke-width="7"/>'+
      '<path d="M56 128 L56 84" stroke="#8FB56B" stroke-width="7"/>'+
      '<path d="M72 128 L72 104" stroke="#7BA05B" stroke-width="7"/>'+
      '<path d="M30 128 h52 v6 h-52 z" fill="#C8A165"/>'+
      '<path d="M150 120 q14-26 28 0 q-14 10-28 0" fill="#D9A441" opacity=".6"/>'+
      '<path d="M230 126 q12-22 24 0 q-12 9-24 0" fill="#E0B96A" opacity=".5"/>'+
      '</g></svg>',
    fall:{ ch:['❁','·'], color:'rgba(216,164,84,.5)', n:10, speed:20 }
  },
  halloween: {
    name:'ハロウィン',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".5">'+
      '<ellipse cx="66" cy="112" rx="30" ry="24" fill="#E08A3C"/>'+
      '<path d="M66 88 q3-10 10-12" stroke="#5E8A4A" stroke-width="5" fill="none"/>'+
      '<path d="M54 106 l8 6 l-8 6 z" fill="#3A2A1E"/><path d="M78 106 l-8 6 l8 6 z" fill="#3A2A1E"/>'+
      '<path d="M54 124 q12 8 24 0" stroke="#3A2A1E" stroke-width="3" fill="none"/>'+
      '<circle cx="320" cy="44" r="20" fill="#F0DCA0" opacity=".7"/>'+
      '<path d="M300 130 q10-18 20 0 q-10 8-20 0" fill="#6B5080" opacity=".5"/>'+
      '</g></svg>',
    fall:{ ch:['🦇','·'], color:'rgba(90,70,110,.45)', n:8, speed:16 }
  },
  valentine: {
    name:'バレンタイン',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".45" fill="#D9738F">'+
      '<path d="M60 118c-16-12-28-20-28-32 0-8 6-14 14-14 6 0 11 4 14 8 3-4 8-8 14-8 8 0 14 6 14 14 0 12-12 20-28 32z"/>'+
      '<path d="M330 96c-10-8-18-13-18-21 0-5 4-9 9-9 4 0 7 3 9 5 2-2 5-5 9-5 5 0 9 4 9 9 0 8-8 13-18 21z" opacity=".7"/>'+
      '</g></svg>',
    fall:{ ch:['♥','·'], color:'rgba(217,115,143,.45)', n:12, speed:15 }
  },
  setsubun: {
    name:'節分',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".5">'+
      '<circle cx="66" cy="106" r="28" fill="#C8654A"/>'+
      '<path d="M46 84 l8-16 l8 12 z" fill="#E0C88A"/><path d="M86 84 l-8-16 l-8 12 z" fill="#E0C88A"/>'+
      '<circle cx="56" cy="104" r="4" fill="#3A2018"/><circle cx="76" cy="104" r="4" fill="#3A2018"/>'+
      '<path d="M54 118 q12 10 24 0" stroke="#3A2018" stroke-width="3" fill="none"/>'+
      '</g>'+
      '<g opacity=".4" fill="#D8C08A"><circle cx="200" cy="60" r="4"/><circle cx="240" cy="80" r="3.4"/>'+
      '<circle cx="280" cy="50" r="4"/><circle cx="320" cy="86" r="3.4"/><circle cx="170" cy="96" r="3"/></g></svg>',
    fall:{ ch:['·','•'], color:'rgba(200,180,130,.55)', n:14, speed:10 }
  },
  hinamatsuri: {
    name:'ひなまつり',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".5">'+
      '<path d="M40 130 h60 v-8 h-60 z" fill="#C2607F"/>'+
      '<path d="M54 122 q0-22 12-22 q12 0 12 22 z" fill="#F5EDE4"/>'+
      '<circle cx="66" cy="96" r="9" fill="#F5EDE4"/><path d="M57 92 q9-8 18 0" fill="#3A2A30"/>'+
      '<path d="M320 60 q16 0 16 14 q0 14-16 14 q-16 0-16-14 q0-14 16-14z" fill="#8FBF7F" opacity=".5"/>'+
      '</g></svg>',
    fall:{ ch:['❀','·'], color:'rgba(230,156,180,.5)', n:12, speed:16 }
  },
  sakura: {
    name:'桜の季節',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".45">'+
      '<path d="M30 140 q10-40 34-58 q10-8 6-18" stroke="#8A6A55" stroke-width="6" fill="none"/>'+
      '<circle cx="62" cy="66" r="16" fill="#F2B5CB"/><circle cx="84" cy="80" r="12" fill="#F7C8D8"/>'+
      '<circle cx="44" cy="86" r="13" fill="#F7C8D8"/><circle cx="76" cy="54" r="10" fill="#FAD9E4"/>'+
      '<circle cx="348" cy="52" r="14" fill="#F2B5CB" opacity=".7"/><circle cx="366" cy="70" r="10" fill="#F7C8D8" opacity=".7"/>'+
      '</g></svg>',
    fall:{ ch:['❀','✿','·'], color:'rgba(242,181,203,.6)', n:16, speed:13 }
  },
  kodomo: {
    name:'こどもの日',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".5">'+
      '<path d="M30 30 L30 140" stroke="#8A9A7A" stroke-width="4"/>'+
      '<path d="M34 40 q40-12 70 0 q-16 12-70 12 z" fill="#4A8FA8"/>'+
      '<path d="M34 62 q34-10 60 0 q-14 10-60 10 z" fill="#D95F4F"/>'+
      '<path d="M34 82 q28-8 50 0 q-12 8-50 8 z" fill="#5E9E6E"/>'+
      '</g></svg>',
    fall:null
  },
  tsuyu: {
    name:'梅雨',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".45">'+
      '<path d="M40 110 q26-32 52 0 z" fill="#7FA8C4"/><path d="M66 110 L66 134" stroke="#5E7E96" stroke-width="4"/>'+
      '<path d="M66 134 q8 6 12 0" stroke="#5E7E96" stroke-width="4" fill="none"/>'+
      '<circle cx="300" cy="70" r="20" fill="#B8CEDC" opacity=".6"/><circle cx="326" cy="74" r="16" fill="#C8DCE8" opacity=".6"/>'+
      '<circle cx="280" cy="78" r="14" fill="#C8DCE8" opacity=".6"/>'+
      '</g></svg>',
    fall:{ ch:['|','·'], color:'rgba(120,165,190,.45)', n:22, speed:5 }
  },
  tanabata: {
    name:'七夕',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".5">'+
      '<path d="M40 24 L40 140" stroke="#6E8E5E" stroke-width="5"/>'+
      '<path d="M44 40 h18 v22 h-18 z" fill="#E8646E"/><path d="M44 74 h16 v20 h-16 z" fill="#E8C24A"/>'+
      '<path d="M44 104 h20 v22 h-20 z" fill="#6EA8D8"/>'+
      '<path d="M120 16 q80 40 200 20" stroke="#C8D8EE" stroke-width="10" fill="none" opacity=".35"/>'+
      '</g>'+
      '<g opacity=".55" fill="#F0E4A8">'+
      '<path d="M200 40 l3 7 l7 1 l-5 5 l1 7 l-6-3 l-6 3 l1-7 l-5-5 l7-1 z"/>'+
      '<path d="M280 70 l2.5 6 l6 .8 l-4 4 l1 6 l-5-2.5 l-5 2.5 l1-6 l-4-4 l6-.8 z"/>'+
      '<path d="M330 30 l2 5 l5 .6 l-3.5 3.5 l.8 5 l-4.3-2.2 l-4.3 2.2 l.8-5 l-3.5-3.5 l5-.6 z"/></g></svg>',
    fall:{ ch:['✦','·'], color:'rgba(240,228,168,.6)', n:14, speed:18 }
  },
  natsu: {
    name:'真夏',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".45">'+
      '<circle cx="330" cy="36" r="24" fill="#F5D76E"/>'+
      '<g stroke="#F5D76E" stroke-width="4">'+
      '<path d="M330 2 v-0"/><path d="M296 36 h-10"/><path d="M364 36 h10"/><path d="M306 12 l-7-7"/><path d="M354 12 l7-7"/></g>'+
      '<path d="M20 140 q40-70 80 0 z" fill="#6EC4D8" opacity=".5"/>'+
      '<path d="M0 132 q40 12 80 0 q40-12 80 0 q40 12 80 0 q40-12 80 0 q40 12 80 0 v20 H0 z" fill="#8FD4E4" opacity=".4"/>'+
      '</g></svg>',
    fall:null
  },
  tsukimi: {
    name:'お月見',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".5">'+
      '<circle cx="320" cy="40" r="28" fill="#F5F0D8"/>'+
      '<circle cx="312" cy="34" r="5" fill="#E4DCBC" opacity=".8"/><circle cx="330" cy="48" r="4" fill="#E4DCBC" opacity=".8"/>'+
      '<path d="M40 130 h56 v-6 h-56 z" fill="#C8A165"/>'+
      '<circle cx="54" cy="116" r="8" fill="#F5F0E0"/><circle cx="70" cy="116" r="8" fill="#F5F0E0"/>'+
      '<circle cx="86" cy="116" r="8" fill="#F5F0E0"/><circle cx="62" cy="102" r="8" fill="#F5F0E0"/>'+
      '<circle cx="78" cy="102" r="8" fill="#F5F0E0"/>'+
      '<path d="M170 140 q6-46 14-56" stroke="#A8A070" stroke-width="3" fill="none"/>'+
      '<path d="M190 140 q4-40 10-50" stroke="#A8A070" stroke-width="3" fill="none"/>'+
      '</g></svg>',
    fall:null
  },
  kouyou: {
    name:'紅葉',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".45">'+
      '<path d="M36 140 q8-42 28-58" stroke="#8A6A4A" stroke-width="6" fill="none"/>'+
      '<circle cx="62" cy="70" r="18" fill="#D9743C"/><circle cx="86" cy="86" r="13" fill="#E09A5C"/>'+
      '<circle cx="42" cy="90" r="14" fill="#C85A32"/>'+
      '<circle cx="350" cy="56" r="14" fill="#D9743C" opacity=".7"/>'+
      '</g></svg>',
    fall:{ ch:['🍁','🍂','·'], color:'rgba(200,90,50,.5)', n:12, speed:12 }
  },
  /* ===== 行事（キャラ＋で足したもの） ===== */
  omisoka: {
    name:'大みそか',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".5">'+
      '<path d="M330 22 a20 20 0 1 0 16 30 a16 16 0 1 1-16-30z" fill="#EFE6C8"/>'+
      '<path d="M36 58 h64 v6 h-64 z" fill="#8A5A3A"/><path d="M42 64 v76 M94 64 v76" stroke="#8A5A3A" stroke-width="5"/>'+
      '<path d="M56 68 q-6 0 -8 30 h40 q-2 -30 -8 -30 z" fill="#B08A4E"/><path d="M50 98 h36" stroke="#8A6A3A" stroke-width="4"/>'+
      '<path d="M178 120 q32 24 64 0 z" fill="#C9543E"/>'+
      '<path d="M184 118 q10 -10 20 0 q10 -10 20 0 q8 -8 14 0" stroke="#E8D5A8" stroke-width="3" fill="none"/>'+
      '</g>'+
      '<g opacity=".45" fill="#F0EAD0"><circle cx="120" cy="30" r="2.2"/><circle cx="250" cy="40" r="2"/><circle cx="290" cy="80" r="1.8"/><circle cx="160" cy="60" r="1.6"/></g></svg>',
    fall:{ ch:['✦','·'], color:'rgba(240,234,208,.55)', n:10, speed:20 }
  },
  whiteday: {
    name:'ホワイトデー',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".45">'+
      '<circle cx="64" cy="104" r="14" fill="#B8D8F0"/><path d="M50 104 l-12 -8 v16 z M78 104 l12 -8 v16 z" fill="#B8D8F0"/>'+
      '<circle cx="110" cy="122" r="9" fill="#F5C8D8"/><path d="M101 122 l-8 -5 v10 z M119 122 l8 -5 v10 z" fill="#F5C8D8"/>'+
      '<circle cx="330" cy="70" r="10" fill="#F5E6A8"/><path d="M320 70 l-9 -6 v12 z M340 70 l9 -6 v12 z" fill="#F5E6A8"/>'+
      '</g></svg>',
    fall:{ ch:['♡','·'], color:'rgba(170,200,230,.5)', n:10, speed:16 }
  },
  shingakki: {
    name:'新学期',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".45">'+
      '<path d="M40 72 L80 50 L120 72 Z" fill="#D98C7A"/>'+
      '<rect x="48" y="72" width="64" height="44" rx="3" fill="#F3E6D8"/>'+
      '<rect x="56" y="82" width="10" height="10" fill="#9CC3D8"/><rect x="75" y="82" width="10" height="10" fill="#9CC3D8"/><rect x="94" y="82" width="10" height="10" fill="#9CC3D8"/>'+
      '<rect x="74" y="100" width="12" height="16" fill="#B98A62"/>'+
      '<g transform="rotate(-8 320 99)"><rect x="300" y="84" width="40" height="30" rx="3" fill="#8FB5E0"/>'+
      '<path d="M306 92 h26 M306 100 h22 M306 108 h18" stroke="#fff" stroke-width="2"/></g>'+
      '<path d="M352 118 l24 -30" stroke="#E8B04A" stroke-width="5" stroke-linecap="round"/>'+
      '</g></svg>',
    fall:{ ch:['✿','·'], color:'rgba(242,181,203,.5)', n:10, speed:15 }
  },
  natsuyasumi: {
    name:'夏休み',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".45">'+
      '<path d="M60 140 L60 86" stroke="#6E9A4A" stroke-width="4"/><path d="M60 110 q-14 -4 -18 -14 q12 0 18 14" fill="#7FAF5A"/>'+
      '<circle cx="60" cy="76" r="16" fill="#F5C842"/><circle cx="60" cy="76" r="7" fill="#8A5A2A"/>'+
      '<circle cx="330" cy="112" r="16" fill="#F29A8A"/><path d="M314 112 h32 M330 96 v32" stroke="#fff" stroke-width="3"/>'+
      '<path d="M0 136 q40 10 80 0 q40-10 80 0 q40 10 80 0 q40-10 80 0 q40 10 80 0 v20 H0 z" fill="#8FD4E4" opacity=".4"/>'+
      '</g></svg>',
    fall:null
  },
  holiday: {
    name:'祝日',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".4">'+
      '<circle cx="60" cy="100" r="22" fill="#E8949E"/>'+
      '<path d="M60 78 q10-14 22-12 q-4 12-22 12z" fill="#8FBF7F"/>'+
      '<circle cx="330" cy="60" r="16" fill="#F0B8C4" opacity=".7"/>'+
      '</g></svg>',
    fall:{ ch:['·'], color:'rgba(222,155,172,.45)', n:8, speed:20 }
  },

  /* ===== 時間帯 ===== */
  dawn: { name:'明け方',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".4">'+
      '<circle cx="200" cy="140" r="46" fill="#F5B99E"/>'+
      '<path d="M0 138 q60-16 120 0 q60 16 120 0 q60-16 160 0 v20 H0 z" fill="#E8A8B8" opacity=".5"/>'+
      '<path d="M60 40 q20-10 40 0 q20 10 40 0" stroke="#E8C4B8" stroke-width="5" fill="none" opacity=".6"/>'+
      '</g></svg>', fall:null },
  morning: { name:'朝',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".38">'+
      '<circle cx="320" cy="42" r="22" fill="#F5D76E"/>'+
      '<path d="M40 130 q16-34 34 0 z" fill="#8FC7A8"/><path d="M90 134 q12-26 26 0 z" fill="#A8D4BC"/>'+
      '<path d="M0 140 h400 v14 H0 z" fill="#B8DCC8" opacity=".5"/>'+
      '</g></svg>', fall:null },
  noon: { name:'昼',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".35" fill="#fff">'+
      '<ellipse cx="90" cy="46" rx="34" ry="18"/><ellipse cx="120" cy="40" rx="24" ry="16"/>'+
      '<ellipse cx="290" cy="70" rx="30" ry="15"/><ellipse cx="318" cy="64" rx="20" ry="13"/>'+
      '</g></svg>', fall:null },
  evening: { name:'夕方',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".42">'+
      '<circle cx="330" cy="120" r="34" fill="#F0A05E"/>'+
      '<path d="M0 140 q50-12 100 0 q50 12 100 0 q50-12 100 0 q50 12 100 0 v18 H0 z" fill="#E08A5C" opacity=".4"/>'+
      '<path d="M60 50 q14-8 28 0" stroke="#D98A6A" stroke-width="4" fill="none" opacity=".7"/>'+
      '<path d="M110 66 q12-7 24 0" stroke="#D98A6A" stroke-width="4" fill="none" opacity=".5"/>'+
      '</g></svg>', fall:null },
  dusk: { name:'夜',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".45">'+
      '<path d="M330 26 a22 22 0 1 0 18 34 a18 18 0 1 1-18-34z" fill="#EFE6C8"/>'+
      '<g fill="#F0EAD0"><circle cx="120" cy="34" r="2.4"/><circle cx="180" cy="58" r="2"/>'+
      '<circle cx="240" cy="30" r="2.6"/><circle cx="90" cy="70" r="1.8"/><circle cx="280" cy="76" r="2"/></g>'+
      '<path d="M0 132 q60-20 120-4 q60 16 120-6 q60-20 160 4 v26 H0 z" fill="#5A4E80" opacity=".35"/>'+
      '</g></svg>', fall:null },
  night: { name:'深夜',
    art:'<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">'+
      '<g opacity=".5">'+
      '<path d="M340 22 a20 20 0 1 0 16 30 a16 16 0 1 1-16-30z" fill="#E8E0F0"/>'+
      '<g fill="#D8D0E8"><circle cx="60" cy="40" r="2"/><circle cx="130" cy="26" r="2.6"/>'+
      '<circle cx="200" cy="50" r="2"/><circle cx="260" cy="34" r="2.4"/><circle cx="100" cy="72" r="1.8"/>'+
      '<circle cx="170" cy="86" r="2"/><circle cx="290" cy="90" r="1.8"/></g>'+
      '</g></svg>',
    fall:{ ch:['·'], color:'rgba(230,220,245,.35)', n:10, speed:26 } }
};

/* ===== 季節のイベント（キャラ＋）=====
   本体の行事（festivalOn）に、大みそか・ホワイトデー・新学期（4月・後期のはじめ）・夏休み を足す。
   c2FesOn(ymd) … その日の行事ぜんぶ（はじめが、いちばんその日らしいもの）／c2FesMain(ymd) … かざりに使う1つ */
var c2FesExtra = { omisoka:'大みそか', whiteday:'ホワイトデー', shingakki:'新学期', natsuyasumi:'夏休み' };
function c2FesName(key){ return c2FesExtra[key] || ((typeof FES_NAME !== 'undefined' && FES_NAME[key]) || key || ''); }
function c2FesOn(ymd){
  var d = isYmd(ymd) ? ymd : today(), m = +d.slice(5, 7), dd = +d.slice(8, 10), out = [];
  var push = function(k){ if(k && out.indexOf(k) < 0) out.push(k); };
  if(m === 12 && dd === 31) push('omisoka');
  if(m === 3 && dd === 14) push('whiteday');
  push(typeof festivalOn === 'function' ? festivalOn(d) : '');
  if((m === 4 && dd <= 14) || (m === 9 && dd >= 21) || (m === 10 && dd <= 4)) push('shingakki');
  if(m === 8 || (m === 9 && dd <= 20)) push('natsuyasumi');
  var hi = out.indexOf('holiday');
  if(hi >= 0 && out.length > 1){ out.splice(hi, 1); out.push('holiday'); }
  return out;
}
function c2FesMain(ymd){ return c2FesOn(ymd)[0] || ''; }

/* いま出すかざりを決める */
function decorNow(){
  var mode = S.ui.bgMode || 'fixed';
  var fes = (S.ui.fesMode === 0) ? '' : (c2FesMain() || '');
  if(fes && DECOR[fes]) return { key:fes, d:DECOR[fes] };
  if((mode === 'time' || mode === 'mix')){
    var b = timeBandNow();
    if(DECOR[b]) return { key:b, d:DECOR[b] };
  }
  if(mode === 'season' || mode === 'mix'){
    var s = seasonNow();
    var m = { spring:'sakura', summer:'natsu', autumn:'kouyou', winter:'night' }[s];
    if(DECOR[m]) return { key:m, d:DECOR[m] };
  }
  return null;
}

/* 上にも小さな絵を散らす（にぎやかさ用） */
var DECOR_TOP = {
  xmas:['🎄','🎁','⭐','🔔','🦌','🍬'],
  newyear:['🎍','🌅','🎌','🍊','🧧'],
  halloween:['🎃','👻','🦇','🕸','🍬'],
  valentine:['💝','🍫','💗','🎀'],
  setsubun:['👹','🫘','🍀'],
  hinamatsuri:['🎎','🌸','🍡','🏮'],
  sakura:['🌸','🌷','🦋','🌱'],
  kodomo:['🎏','🍃','🪁','🎐'],
  tsuyu:['☔','💧','🐌','🌿'],
  tanabata:['🎋','⭐','🌌','🎐'],
  natsu:['🌻','🍉','🌊','🐚','🍧'],
  tsukimi:['🌕','🍡','🐰','🌾'],
  kouyou:['🍁','🍂','🌰','🍄'],
  holiday:['🎌','🌸','☀'],
  omisoka:['🔔','🍜','🌙','✨'],
  whiteday:['🍬','🤍','🎀','🍪'],
  shingakki:['🏫','📓','✏️','🌸'],
  natsuyasumi:['🌻','🏖','🍉','🎐'],
  dawn:['🌄','🐦','☁'],
  morning:['🌱','☀','🐝','🍀'],
  noon:['☁','🕊','🌤'],
  evening:['🌇','🍂','🕊'],
  dusk:['🌙','⭐','🦉'],
  night:['🌙','⭐','💫','😴']
};
/* 充実度：0=なし 1=ひかえめ 2=ふつう 3=にぎやか */
function decorLevel(){
  if(S.ui.decor === 0) return 0;
  var lv = S.ui.decorLv;
  return (lv == null) ? 2 : toNum(lv);
}
function applyDecor(){
  var host = document.getElementById('decor');
  if(!host) return;
  var lv = decorLevel();
  if(lv === 0){ host.innerHTML = ''; host.className = 'decor off'; host.dataset.key=''; return; }
  var cur = decorNow();
  if(!cur){ host.innerHTML = ''; host.className = 'decor'; host.dataset.key=''; return; }
  var sig = cur.key + ':' + lv + ':' + (S.ui.decorMove === 0 ? 0 : 1);
  if(host.dataset.key === sig) return;
  host.dataset.key = sig;
  host.className = 'decor lv' + lv;

  var h = '<div class="decor-art">' + cur.d.art + '</div>';

  /* 上に散らす小さな絵（ふつう以上） */
  var marks = DECOR_TOP[cur.key];
  if(lv >= 2 && marks && marks.length){
    var n = (lv === 3) ? 14 : 7;
    h += '<div class="decor-marks">';
    for(var j = 0; j < n; j++){
      var mk = marks[j % marks.length];
      var x = (j * 37 + 9) % 94;
      var y = (j * 23 + 5) % 62;
      var sz = 13 + ((j * 7) % 14);
      var op = 0.16 + ((j % 4) * 0.05);
      var sw = 4 + (j % 5);
      h += '<span style="left:' + x + '%;top:' + y + '%;font-size:' + sz + 'px;opacity:' + op +
           ';animation-duration:' + sw + 's;animation-delay:-' + (j * 0.7) + 's">' + mk + '</span>';
    }
    h += '</div>';
  }

  /* 落ちてくるもの */
  var f = cur.d.fall;
  if(f && S.ui.decorMove !== 0 && lv >= 1){
    var cnt = (lv === 3) ? f.n : (lv === 2) ? Math.round(f.n * 0.7) : Math.round(f.n * 0.4);
    h += '<div class="decor-fall">';
    for(var i = 0; i < cnt; i++){
      var ch = f.ch[i % f.ch.length];
      var left = Math.round((i * 97 + 13) % 100);
      var dur = f.speed + (i % 5) * 2;
      var delay = -(i * (dur / Math.max(1,cnt)));
      var size = 8 + (i % 4) * 4;
      h += '<span style="left:' + left + '%;font-size:' + size + 'px;color:' + f.color +
           ';animation-duration:' + dur + 's;animation-delay:' + delay + 's">' + ch + '</span>';
    }
    h += '</div>';
  }
  host.innerHTML = h;
}
/* ============================== イラスト ============================== */
var ART = {
  bus: '<svg class="illus" width="76" height="52" viewBox="0 0 76 52" fill="none" aria-hidden="true">'+
    '<rect x="6" y="8" width="50" height="30" rx="6" fill="var(--accent)" opacity=".92"/>'+
    '<rect x="11" y="13" width="17" height="12" rx="3" fill="var(--card)" opacity=".92"/>'+
    '<rect x="32" y="13" width="17" height="12" rx="3" fill="var(--card)" opacity=".92"/>'+
    '<circle cx="18" cy="41" r="5.5" fill="var(--ink)"/><circle cx="46" cy="41" r="5.5" fill="var(--ink)"/>'+
    '<path d="M60 22h12M60 28h8" stroke="var(--accent2)" stroke-width="3" stroke-linecap="round" opacity=".9"/></svg>',
  train: '<svg class="illus" width="70" height="52" viewBox="0 0 70 52" fill="none" aria-hidden="true">'+
    '<rect x="14" y="6" width="42" height="34" rx="8" fill="var(--accent)" opacity=".92"/>'+
    '<rect x="20" y="12" width="30" height="12" rx="3" fill="var(--card)" opacity=".92"/>'+
    '<circle cx="25" cy="31" r="2.6" fill="var(--card)"/><circle cx="45" cy="31" r="2.6" fill="var(--card)"/>'+
    '<path d="M22 44l-6 6M48 44l6 6" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>'+
    '<path d="M6 46h58" stroke="var(--sub)" stroke-width="2" stroke-linecap="round" opacity=".5"/></svg>',
  campus: '<svg class="illus" width="80" height="52" viewBox="0 0 80 52" fill="none" aria-hidden="true">'+
    '<path d="M40 6L68 20H12L40 6Z" fill="var(--accent)" opacity=".92"/>'+
    '<rect x="16" y="20" width="48" height="24" rx="3" fill="var(--card)" stroke="var(--rule)" stroke-width="2"/>'+
    '<rect x="23" y="27" width="8" height="10" rx="2" fill="var(--accent)" opacity=".55"/>'+
    '<rect x="36" y="27" width="8" height="10" rx="2" fill="var(--accent)" opacity=".55"/>'+
    '<rect x="49" y="27" width="8" height="10" rx="2" fill="var(--accent)" opacity=".55"/>'+
    '<path d="M8 46h64" stroke="var(--sub)" stroke-width="2" stroke-linecap="round" opacity=".45"/></svg>',
  empty: '<svg class="illus" width="72" height="52" viewBox="0 0 72 52" fill="none" aria-hidden="true">'+
    '<rect x="14" y="12" width="44" height="32" rx="6" fill="var(--soft)" stroke="var(--rule)" stroke-width="2"/>'+
    '<path d="M22 24h28M22 32h18" stroke="var(--rule)" stroke-width="3" stroke-linecap="round"/></svg>'
};

