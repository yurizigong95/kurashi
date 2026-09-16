/* くらしの手帳：キャラクターの絵（SVG） */
/* ============================== 形 ============================== */
function chSt(k, w){ return ' stroke="'+k.line+'" stroke-width="'+(w || 2.6)+'" stroke-linejoin="round" stroke-linecap="round"'; }
function chShape(k){ return k.shape || 'round'; }
/* 顔や手の位置（体の形ごと） */
function chLayout(k){
  var s = chShape(k);
  var f = { eyeY:58, ex1:40, ex2:60, cheekY:67, cx1:30, cx2:70, mouthY:66, top:27, armY:72, arms:true };
  if(k.ears === 'frog') f = { eyeY:33, ex1:34, ex2:66, cheekY:62, cx1:28, cx2:72, mouthY:58, top:27, armY:72, arms:true };
  else if(s === 'ghost'){ f.top = 22; f.arms = false; }
  else if(s === 'tri'){ f.cx1 = 32; f.cx2 = 68; f.mouthY = 65; f.top = 16; f.armY = 78; }
  else if(s === 'cloud'){ f.top = 30; f.arms = false; }
  else if(s === 'star'){ f.eyeY = 55; f.ex1 = 42; f.ex2 = 58; f.cheekY = 63; f.cx1 = 35; f.cx2 = 65; f.mouthY = 62; f.top = 8; f.arms = false; }
  else if(s === 'pudding'){ f.eyeY = 62; f.cheekY = 71; f.cx1 = 29; f.cx2 = 71; f.mouthY = 70; f.top = 34; f.arms = false; }
  else if(s === 'jelly'){ f.eyeY = 46; f.cheekY = 55; f.cx1 = 29; f.cx2 = 71; f.mouthY = 54; f.top = 18; f.arms = false; }
  else if(s === 'octo'){ f.eyeY = 48; f.cheekY = 57; f.cx1 = 28; f.cx2 = 72; f.mouthY = 59; f.top = 14; f.arms = false; }
  return f;
}
function chMirror(d){ return '<g transform="translate(100 0) scale(-1 1)">' + d + '</g>'; }
function chPts(cx, cy, r1, r2, n, a0, a1){
  var p = [], i, a, r;
  for(i = 0; i <= n * 2; i++){
    a = (a0 + (a1 - a0) * i / (n * 2)) * Math.PI / 180;
    r = (i % 2) ? r1 : r2;
    p.push((cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1));
  }
  return p;
}

/* 体のうしろ（しっぽ・羽・とげ・足） */
function chBack(k){
  var st = chSt(k), o = '';
  if(k.ears === 'squirrel'){
    o += '<path d="M66 84 C96 88 102 60 90 44 C82 32 94 22 86 12 C72 14 64 32 70 46 C76 58 70 70 58 78 Z" fill="'+(k.tail || k.body)+'"'+st+'/>'+
         '<path d="M80 22 C76 32 80 40 86 48" fill="none" stroke="'+k.line+'" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>';
  }
  if(k.ears === 'spiky'){
    o += '<path d="M'+chPts(50, 60, 47, 33, 9, 150, 390).join(' L')+' Z" fill="'+(k.spike || k.line)+'"'+chSt(k, 2.2)+'/>';
  }
  if(k.ears === 'dragon'){
    var wing = '<path d="M22 56 L4 40 Q10 50 6 58 Q12 58 10 66 Q16 62 20 68 Z" fill="'+(k.belly || k.inner)+'"'+chSt(k, 2)+'/>';
    o += wing + chMirror(wing);
  }
  if(k.ears === 'antenna'){
    var bw = '<ellipse cx="24" cy="34" rx="13" ry="9" transform="rotate(-30 24 34)" fill="#E4F4FF" fill-opacity=".9"'+chSt(k, 1.8)+'/>';
    o += bw + chMirror(bw);
  }
  if(chShape(k) === 'bird'){
    o += '<path d="M70 76 Q84 80 92 90 Q86 92 80 88 Q84 94 80 96 Q72 90 64 84 Z" fill="'+(k.wing || k.line)+'"'+chSt(k, 1.8)+'/>';
  }
  if(chShape(k) === 'jelly'){
    [26, 38, 50, 62, 74].forEach(function(x, i){
      o += '<path d="M'+x+' 60 q'+(i % 2 ? 5 : -5)+' 8 0 16 q'+(i % 2 ? -5 : 5)+' 8 0 16" fill="none" stroke="'+k.line+'" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>';
    });
  }
  if(chShape(k) === 'octo'){
    var leg = function(x, dx){ return '<path d="M'+x+' 70 Q'+(x + dx)+' 86 '+(x + dx * 1.6)+' 94 Q'+(x + dx * 2)+' 98 '+(x + dx * 2.2)+' 92" fill="none" stroke="'+k.body+'" stroke-width="9" stroke-linecap="round"/>'; };
    var legO = function(x, dx){ return '<path d="M'+x+' 70 Q'+(x + dx)+' 86 '+(x + dx * 1.6)+' 94 Q'+(x + dx * 2)+' 98 '+(x + dx * 2.2)+' 92" fill="none" stroke="'+k.line+'" stroke-width="13" stroke-linecap="round"/>'; };
    var legs = [[30, -6], [42, -3], [58, 3], [70, 6]];
    o += legs.map(function(l){ return legO(l[0], l[1]); }).join('') + legs.map(function(l){ return leg(l[0], l[1]); }).join('');
  }
  return o;
}

/* 耳・角・頭の飾り（体の前にかくもの以外） */
function chEars(k){
  var L = k.line, B = k.earFill || k.body, I = k.inner, st = chSt(k);
  var one;
  switch(k.ears){
    case 'bunny':
      return '<ellipse cx="37" cy="20" rx="7" ry="17" transform="rotate(-9 37 20)" fill="'+B+'"'+st+'/>'+
             '<ellipse cx="63" cy="20" rx="7" ry="17" transform="rotate(9 63 20)" fill="'+B+'"'+st+'/>'+
             '<ellipse cx="37" cy="22" rx="3.2" ry="11" transform="rotate(-9 37 22)" fill="'+I+'"/>'+
             '<ellipse cx="63" cy="22" rx="3.2" ry="11" transform="rotate(9 63 22)" fill="'+I+'"/>';
    case 'bear':
      return '<circle cx="27" cy="33" r="9.5" fill="'+B+'"'+st+'/><circle cx="73" cy="33" r="9.5" fill="'+B+'"'+st+'/>'+
             '<circle cx="27" cy="34" r="4.8" fill="'+I+'"/><circle cx="73" cy="34" r="4.8" fill="'+I+'"/>';
    case 'round':
      return '<circle cx="28" cy="33" r="8" fill="'+B+'"'+st+'/><circle cx="72" cy="33" r="8" fill="'+B+'"'+st+'/>'+
             '<circle cx="28" cy="34" r="4" fill="'+I+'"/><circle cx="72" cy="34" r="4" fill="'+I+'"/>';
    case 'tiny':
      return '<circle cx="30" cy="33" r="5" fill="'+B+'"'+st+'/><circle cx="70" cy="33" r="5" fill="'+B+'"'+st+'/>';
    case 'hamster':
      return '<circle cx="27" cy="37" r="7.5" fill="'+B+'"'+st+'/><circle cx="73" cy="37" r="7.5" fill="'+B+'"'+st+'/>'+
             '<circle cx="27" cy="38" r="3.8" fill="'+I+'"/><circle cx="73" cy="38" r="3.8" fill="'+I+'"/>';
    case 'mouse':
      return '<circle cx="22" cy="31" r="13" fill="'+B+'"'+st+'/><circle cx="78" cy="31" r="13" fill="'+B+'"'+st+'/>'+
             '<circle cx="22" cy="32" r="7.5" fill="'+I+'"/><circle cx="78" cy="32" r="7.5" fill="'+I+'"/>';
    case 'koala':
      return '<circle cx="20" cy="39" r="14" fill="'+B+'"'+st+'/><circle cx="80" cy="39" r="14" fill="'+B+'"'+st+'/>'+
             '<circle cx="20" cy="40" r="8" fill="'+I+'"/><circle cx="80" cy="40" r="8" fill="'+I+'"/>';
    case 'cat':
      return '<path d="M20 47 L25 17 L44 31 Z" fill="'+B+'"'+st+'/><path d="M80 47 L75 17 L56 31 Z" fill="'+B+'"'+st+'/>'+
             '<path d="M25.5 40 L27.5 24 L37 31 Z" fill="'+I+'"/><path d="M74.5 40 L72.5 24 L63 31 Z" fill="'+I+'"/>';
    case 'owl':
      one = '<path d="M20 46 L22 16 L40 31 Z" fill="'+B+'"'+st+'/>';
      return one + chMirror(one);
    case 'shiba':
      return '<path d="M20 46 Q21 20 28 16 Q36 22 44 31 Z" fill="'+B+'"'+st+'/><path d="M80 46 Q79 20 72 16 Q64 22 56 31 Z" fill="'+B+'"'+st+'/>'+
             '<path d="M26 40 Q27 26 29 23 Q34 27 38 32 Z" fill="'+I+'"/><path d="M74 40 Q73 26 71 23 Q66 27 62 32 Z" fill="'+I+'"/>';
    case 'rpanda':
      one = '<path d="M18 46 Q16 20 29 16 Q39 22 44 31 Z" fill="'+B+'"'+st+'/><path d="M24 40 Q23 26 29 22 Q35 26 38 31 Z" fill="'+I+'"/>';
      return one + chMirror(one);
    case 'fox':
      return '<path d="M18 48 L22 10 L45 30 Z" fill="'+B+'"'+st+'/><path d="M82 48 L78 10 L55 30 Z" fill="'+B+'"'+st+'/>'+
             '<path d="M24 40 L25.5 19 L38 30 Z" fill="'+I+'"/><path d="M76 40 L74.5 19 L62 30 Z" fill="'+I+'"/>';
    case 'squirrel':
      one = '<path d="M22 44 L26 16 L42 31 Z" fill="'+B+'"'+st+'/><path d="M26 17 q-3 -6 1 -9 M26 17 q2 -7 6 -7" fill="none" stroke="'+L+'" stroke-width="1.8" stroke-linecap="round"/>'+
            '<path d="M27 38 L28.5 24 L36 31 Z" fill="'+I+'"/>';
      return one + chMirror(one);
    case 'pig':
      one = '<path d="M22 42 Q18 22 28 16 Q40 22 44 31 Q34 30 30 42 Z" fill="'+B+'"'+st+'/><path d="M28 21 Q37 25 40 30 Q33 29 30 35 Z" fill="'+I+'"/>';
      return one + chMirror(one);
    case 'cow':
      one = '<path d="M37 31 Q28 20 34 10 Q37 21 44 28 Z" fill="#F6E9C8"'+chSt(k, 2)+'/>'+
            '<ellipse cx="16" cy="45" rx="10" ry="5.5" transform="rotate(-18 16 45)" fill="'+B+'"'+st+'/>'+
            '<ellipse cx="16" cy="45" rx="5.5" ry="2.8" transform="rotate(-18 16 45)" fill="'+I+'"/>';
      return one + chMirror(one);
    case 'alpaca':
      one = '<ellipse cx="25" cy="24" rx="5.5" ry="13" transform="rotate(-24 25 24)" fill="'+B+'"'+st+'/>'+
            '<ellipse cx="25" cy="25" rx="2.4" ry="8" transform="rotate(-24 25 25)" fill="'+I+'"/>';
      return one + chMirror(one);
    case 'unicorn':
      one = '<path d="M24 42 L28 20 L42 32 Z" fill="'+B+'"'+st+'/><path d="M28 36 L30 25 L37 31 Z" fill="'+I+'"/>';
      return one + chMirror(one);
    case 'dragon':
      one = '<path d="M36 31 L31 13 L45 28 Z" fill="#FFF1C9"'+chSt(k, 2.2)+'/><circle cx="24" cy="40" r="6" fill="'+B+'"'+st+'/>';
      return one + chMirror(one);
    case 'antenna':
      one = '<path d="M43 30 Q38 18 32 12" fill="none" stroke="'+L+'" stroke-width="2.2" stroke-linecap="round"/><circle cx="31" cy="11" r="3.4" fill="'+L+'"/>';
      return one + chMirror(one);
    case 'frog':
      return '<circle cx="34" cy="33" r="11" fill="'+B+'"'+st+'/><circle cx="66" cy="33" r="11" fill="'+B+'"'+st+'/>';
    case 'sheep':
      var w = k.wool || '#fff', o = '';
      [[26,34],[36,25],[50,22],[64,25],[74,34],[19,46],[81,46]].forEach(function(p){
        o += '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="9" fill="'+w+'"'+st+'/>';
      });
      return o;
    case 'tuft':
      return '<path d="M47 27 Q46 18 50 16 M50 27 Q51 17 56 17 M53 27 Q57 21 60 22" fill="none" stroke="'+L+'" stroke-width="2.4" stroke-linecap="round"/>';
    default:
      return '';
  }
}

/* 体 */
function chBody(k){
  var st = chSt(k), s = chShape(k), o = '';
  if(s === 'ghost'){
    return '<path d="M50 22 C72 22 84 38 84 58 L84 86 Q80 80 75 86 Q70 92 65 86 Q60 80 55 86 Q50 92 45 86 Q40 80 35 86 Q30 92 25 86 Q20 80 16 86 L16 58 C16 38 28 22 50 22 Z" fill="'+k.body+'" fill-opacity=".96"'+st+'/>';
  }
  if(s === 'tri'){
    return '<path d="M50 14 Q56 14 60 22 L87 76 Q91 88 78 88 L22 88 Q9 88 13 76 L40 22 Q44 14 50 14 Z" fill="'+k.body+'"'+st+'/>'+
           '<path d="M50 20 Q54 20 57 26" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/>'+
           '<rect x="33" y="72" width="34" height="16.5" rx="2" fill="'+(k.nori || '#2F3B35')+'"/>'+
           '<path d="M36 76 H64" stroke="#fff" stroke-width="1" opacity=".15"/>';
  }
  if(s === 'cloud'){
    return '<path d="M24 84 Q9 84 9 69 Q9 56 22 54 Q19 38 35 35 Q42 22 57 27 Q71 22 77 37 Q92 39 91 56 Q93 69 85 77 Q81 84 72 84 Z" fill="'+k.body+'"'+st+'/>'+
           '<path d="M30 44 Q34 40 40 40" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>';
  }
  if(s === 'star'){
    return '<path d="M'+chPts(50, 56, 25, 47, 5, -90, 270).join(' L')+' Z" fill="'+k.body+'"'+chSt(k, 2.8)+'/>';
  }
  if(s === 'pudding'){
    return '<ellipse cx="50" cy="89" rx="42" ry="7" fill="#EEF3F8"'+chSt(k, 2)+'/>'+
           '<path d="M26 38 L74 38 Q78 38 79 42 L85 82 Q86 88 78 88 L22 88 Q14 88 15 82 L21 42 Q22 38 26 38 Z" fill="'+k.body+'"'+st+'/>'+
           '<path d="M24 39 Q26 30 50 30 Q74 30 76 39 L76 44 Q72 50 68 44 Q64 50 58 44 Q52 52 46 44 Q40 50 34 44 Q28 50 24 44 Z" fill="'+(k.caramel || '#B0702F')+'"'+chSt(k, 2)+'/>'+
           '<path d="M34 34 Q40 32 44 33" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".6"/>';
  }
  if(s === 'jelly'){
    return '<path d="M13 60 C13 30 30 16 50 16 C70 16 87 30 87 60 Q81 66 75 60 Q69 66 63 60 Q56 66 50 60 Q44 66 37 60 Q31 66 25 60 Q19 66 13 60 Z" fill="'+k.body+'" fill-opacity=".92"'+st+'/>'+
           '<path d="M26 30 Q32 23 40 22" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>';
  }
  if(s === 'octo'){
    return '<circle cx="50" cy="46" r="33" fill="'+k.body+'"'+st+'/>'+
           '<path d="M28 30 Q33 22 41 20" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>';
  }
  o = '<path d="M50 27 C73 27 86 42 86 62 C86 80 70 90 50 90 C30 90 14 80 14 62 C14 42 27 27 50 27 Z" fill="'+k.body+'"'+st+'/>';
  if(k.face) o += (k.eyeRing ? '<ellipse cx="50" cy="60" rx="30" ry="22" fill="'+k.face+'"/>' : '<ellipse cx="50" cy="66" rx="27" ry="21" fill="'+k.face+'"/>');
  if(k.belly) o += '<ellipse cx="50" cy="75" rx="19" ry="13" fill="'+k.belly+'"/>';
  if(k.spots) o += '<ellipse cx="26" cy="52" rx="7" ry="5.5" fill="'+k.spots+'"/><ellipse cx="73" cy="78" rx="6.5" ry="4.5" fill="'+k.spots+'"/><ellipse cx="64" cy="36" rx="5" ry="3.5" fill="'+k.spots+'"/>';
  if(k.patches) o += '<ellipse cx="34" cy="41" rx="11" ry="8" fill="'+k.patches[0]+'"/><ellipse cx="68" cy="40" rx="9" ry="7" fill="'+k.patches[1]+'"/><ellipse cx="62" cy="80" rx="7" ry="4.5" fill="'+k.patches[0]+'"/>';
  if(k.muzzle) o += '<ellipse cx="50" cy="69" rx="'+(k.spots ? 15 : 11)+'" ry="'+(k.spots ? 9 : 7.5)+'" fill="'+k.muzzle+'"/>';
  if(k.stripes) o += '<path d="M44 33 L45 38 M50 31 L50 37 M56 33 L55 38" stroke="'+k.line+'" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>';
  if(k.tiger){
    o += '<path d="M44 32 L45 38 M50 30 L50 37 M56 32 L55 38 M16 55 L25 57 M15 62 L23 63 M16 69 L23 68 M84 55 L75 57 M85 62 L77 63 M84 69 L77 68" stroke="'+k.line+'" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>';
  }
  if(k.bee){
    o += '<path d="M17 68 Q50 78 83 68 M22 80 Q50 88 78 80" fill="none" stroke="'+k.bee+'" stroke-width="5" stroke-linecap="round"/>';
  }
  if(k.mask){
    o += '<ellipse cx="39" cy="58" rx="7.5" ry="6" transform="rotate(-18 39 58)" fill="'+k.mask+'"/>'+
         '<ellipse cx="61" cy="58" rx="7.5" ry="6" transform="rotate(18 61 58)" fill="'+k.mask+'"/>';
  }
  if(k.brow) o += '<ellipse cx="38" cy="50" rx="4.5" ry="2.6" fill="'+k.brow+'"/><ellipse cx="62" cy="50" rx="4.5" ry="2.6" fill="'+k.brow+'"/>';
  return o;
}
/* 体の前にかく飾り */
function chFront(k){
  var o = '';
  if(k.ears === 'alpaca'){
    [[40,28],[50,23],[60,28],[45,32],[55,32]].forEach(function(p){
      o += '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="7" fill="'+(k.wool || '#fff')+'"'+chSt(k, 2)+'/>';
    });
  }
  if(k.ears === 'unicorn'){
    o += '<circle cx="33" cy="31" r="6" fill="#F9B8D4"/><circle cx="40" cy="27" r="6" fill="#CDB8F6"/><circle cx="27" cy="38" r="5.5" fill="#A9E3D2"/>'+
         '<path d="M50 3 L44 28 L56 28 Z" fill="#F7D56B"'+chSt(k, 2)+'/>'+
         '<path d="M46.5 20 L53 17 M45.5 25 L54.5 21.5 M48 13 L52 11.5" stroke="'+k.line+'" stroke-width="1.3" stroke-linecap="round" opacity=".6"/>';
  }
  if(k.ears === 'dragon'){
    o += '<path d="M46 29 L50 23 L54 29" fill="#FFF1C9"'+chSt(k, 1.8)+'/>';
  }
  return o;
}
/* ============================== 顔 ============================== */
var CH_HAPPY = { happy:1, cheer:1, love:1, sparkle:1, wink:1 };
function chFace(k, expr){
  var f = chLayout(k), L = k.line, o = '', eyes = '';
  var onMask = !!k.mask && k.mask !== k.body && k.mask.toUpperCase() !== '#FFFFFF';
  var eyeC = onMask ? '#FFFFFF' : L;
  var ey = f.eyeY, e1 = f.ex1, e2 = f.ex2, sm = k.tinyEyes ? .6 : 1;
  var dot = function(x, y, r){
    r *= sm;
    if(k.eyeColor){
      return '<circle cx="'+x+'" cy="'+y+'" r="'+(r*1.4)+'" fill="'+k.eyeColor+'" stroke="#1E1B24" stroke-width="1"/>'+
             '<ellipse cx="'+x+'" cy="'+y+'" rx="'+(r*.45)+'" ry="'+(r*1.1)+'" fill="#1E1B24"/>'+
             '<circle cx="'+(x+1.2)+'" cy="'+(y-1.6)+'" r="'+(r*.35)+'" fill="#fff"/>';
    }
    return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+eyeC+'"/>'+
      (onMask || sm < 1 ? '' : '<circle cx="'+(x+1.1)+'" cy="'+(y-1.2)+'" r="'+(r*0.32)+'" fill="#fff"/>');
  };
  var ln = function(d, w, c){ return '<path d="'+d+'" fill="none" stroke="'+(c || eyeC)+'" stroke-width="'+(w || 2.4)+'" stroke-linecap="round" stroke-linejoin="round"/>'; };
  var arcUp = function(x, y){ return ln('M'+(x-4)+' '+(y+1)+' Q'+x+' '+(y-4.5)+' '+(x+4)+' '+(y+1), 2.6); };
  var arcDn = function(x, y){ return ln('M'+(x-4)+' '+(y-1)+' Q'+x+' '+(y+3)+' '+(x+4)+' '+(y-1)); };
  var heart = function(x, y){ return '<path d="M'+x+' '+(y+3.6)+' C'+(x-6)+' '+(y-.5)+' '+(x-3.6)+' '+(y-5.4)+' '+x+' '+(y-2)+' C'+(x+3.6)+' '+(y-5.4)+' '+(x+6)+' '+(y-.5)+' '+x+' '+(y+3.6)+' Z" fill="#F0587A"/>'; };
  var starEye = function(x, y){ return '<path d="M'+x+' '+(y-5)+' Q'+(x+1)+' '+(y-1)+' '+(x+5)+' '+y+' Q'+(x+1)+' '+(y+1)+' '+x+' '+(y+5)+' Q'+(x-1)+' '+(y+1)+' '+(x-5)+' '+y+' Q'+(x-1)+' '+(y-1)+' '+x+' '+(y-5)+' Z" fill="#FFD84D" stroke="'+eyeC+'" stroke-width="1.2" stroke-linejoin="round"/>'; };
  var spiral = function(x, y){ return ln('M'+(x+3.4)+' '+y+' A3.4 3.4 0 1 1 '+x+' '+(y-3.4)+' A2 2 0 1 1 '+(x-1)+' '+(y+1.4), 1.8); };
  var brows = function(inward, up){
    var a = inward ? 3 : (up ? -2 : 0);
    return ln('M'+(e1-5)+' '+(ey-8-a)+' L'+(e1+3)+' '+(ey-7+a)+' M'+(e2+5)+' '+(ey-8-a)+' L'+(e2-3)+' '+(ey-7+a), 2, L);
  };
  if(k.eyeRing){
    eyes += '<circle cx="'+e1+'" cy="'+ey+'" r="8.5" fill="#fff"'+chSt(k, 1.8)+'/><circle cx="'+e2+'" cy="'+ey+'" r="8.5" fill="#fff"'+chSt(k, 1.8)+'/>';
  }
  switch(expr){
    case 'happy': case 'cheer': case 'eat': eyes += arcUp(e1, ey) + arcUp(e2, ey); break;
    case 'shy': eyes += arcUp(e1, ey + 1) + arcUp(e2, ey + 1); break;
    case 'sleep': eyes += arcDn(e1, ey) + arcDn(e2, ey); break;
    case 'proud': eyes += arcDn(e1, ey) + arcDn(e2, ey) + brows(false, true); break;
    case 'wink': eyes += arcUp(e1, ey) + dot(e2, ey, 3.3); break;
    case 'surprise': eyes += dot(e1, ey, 4) + dot(e2, ey, 4) + brows(false, true); break;
    case 'sad':
      eyes += dot(e1, ey + 1, 3) + dot(e2, ey + 1, 3) +
        ln('M'+(e1-5)+' '+(ey-6)+' L'+(e1+3)+' '+(ey-4)+' M'+(e2+5)+' '+(ey-6)+' L'+(e2-3)+' '+(ey-4), 2, L) +
        '<path d="M'+(e1+1)+' '+(ey+5)+' q-2.4 4 0 5.6 q2.4 -1.6 0 -5.6 Z" fill="#8CC8F0"/>';
      break;
    case 'cry':
      eyes += ln('M'+(e1-4)+' '+(ey-2.5)+' L'+(e1+3)+' '+ey+' L'+(e1-4)+' '+(ey+2.5)) + ln('M'+(e2+4)+' '+(ey-2.5)+' L'+(e2-3)+' '+ey+' L'+(e2+4)+' '+(ey+2.5)) +
        '<path d="M'+(e1-2)+' '+(ey+3)+' q-1 6 -3 10" fill="none" stroke="#7FC0EE" stroke-width="3" stroke-linecap="round"/>'+
        '<path d="M'+(e2+2)+' '+(ey+3)+' q1 6 3 10" fill="none" stroke="#7FC0EE" stroke-width="3" stroke-linecap="round"/>';
      break;
    case 'love': eyes += heart(e1, ey) + heart(e2, ey); break;
    case 'angry': eyes += dot(e1, ey + 1, 3) + dot(e2, ey + 1, 3) + brows(true); break;
    case 'think': eyes += dot(e1 - 1, ey - 1.5, 3.1) + dot(e2 - 1, ey - 1.5, 3.1); break;
    case 'dizzy': eyes += spiral(e1, ey) + spiral(e2, ey); break;
    case 'sparkle': eyes += starEye(e1, ey) + starEye(e2, ey); break;
    case 'sweat': eyes += dot(e1, ey, 3.2) + dot(e2, ey, 3.2) + ln('M'+(e1-4)+' '+(ey-7)+' L'+(e1+3)+' '+(ey-7.5)+' M'+(e2+4)+' '+(ey-7)+' L'+(e2-3)+' '+(ey-7.5), 1.8, L); break;
    default: eyes += dot(e1, ey, 3.3) + dot(e2, ey, 3.3);
  }
  o += '<g class="cheye">'+eyes+'</g>';

  /* ほっぺ */
  var crx = (expr === 'eat') ? 7.5 : 5.2, cry = (expr === 'eat') ? 5 : 3.2;
  var cop = (expr === 'shy' || expr === 'love') ? '.95' : '.8';
  o += '<ellipse cx="'+f.cx1+'" cy="'+f.cheekY+'" rx="'+crx+'" ry="'+cry+'" fill="'+k.cheek+'" opacity="'+cop+'"/>'+
       '<ellipse cx="'+f.cx2+'" cy="'+f.cheekY+'" rx="'+crx+'" ry="'+cry+'" fill="'+k.cheek+'" opacity="'+cop+'"/>';
  if(expr === 'shy'){
    [f.cx1, f.cx2].forEach(function(x){
      o += ln('M'+(x-3.5)+' '+(f.cheekY+1.5)+' l2 -3 M'+(x-.5)+' '+(f.cheekY+1.5)+' l2 -3 M'+(x+2.5)+' '+(f.cheekY+1.5)+' l2 -3', 1.2, '#E0607E');
    });
  }

  /* くち・はな・くちばし */
  var my = f.mouthY;
  var happy = !!CH_HAPPY[expr];
  var mouth = function(y){
    if(happy) return '<path d="M45 '+y+' Q50 '+(y+7)+' 55 '+y+' Z" fill="#F47C8C" stroke="'+L+'" stroke-width="1.8" stroke-linejoin="round"/>';
    switch(expr){
      case 'surprise': return '<ellipse cx="50" cy="'+(y+2)+'" rx="2.6" ry="3.3" fill="'+L+'"/>';
      case 'sad': return ln('M46 '+(y+3)+' Q50 '+y+' 54 '+(y+3), 2, L);
      case 'cry': return '<path d="M45 '+(y+4)+' Q50 '+(y-1)+' 55 '+(y+4)+' Q50 '+(y+2)+' 45 '+(y+4)+' Z" fill="#F47C8C" stroke="'+L+'" stroke-width="1.8" stroke-linejoin="round"/>';
      case 'sleep': return '<circle cx="50" cy="'+(y+1.5)+'" r="1.7" fill="'+L+'"/>';
      case 'angry': return ln('M45.5 '+(y+3)+' L50 '+y+' L54.5 '+(y+3), 2, L);
      case 'think': return ln('M47 '+(y+1.5)+' L53 '+y, 2, L);
      case 'eat': return ln('M44 '+y+' Q47 '+(y+4)+' 50 '+y+' Q53 '+(y+4)+' 56 '+y, 2.2, L);
      case 'dizzy': case 'sweat': return ln('M44 '+(y+1)+' q1.5 -2 3 0 t3 0 t3 0 t3 0', 1.8, L);
      case 'proud': return ln('M45 '+y+' Q51 '+(y+4.5)+' 56 '+(y-1.5), 2, L);
      case 'shy': return ln('M47 '+y+' Q48.5 '+(y+2)+' 50 '+y+' Q51.5 '+(y+2)+' 53 '+y, 1.7, L);
      default: return ln('M46 '+y+' Q48 '+(y+3)+' 50 '+y+' Q52 '+(y+3)+' 54 '+y, 1.9, L);
    }
  };
  if(k.beak){
    o += (expr === 'surprise' || happy)
      ? '<path d="M46 '+(my-2)+' L54 '+(my-2)+' L50 '+(my+1)+' Z M46.5 '+(my+1)+' L53.5 '+(my+1)+' L50 '+(my+4.5)+' Z" fill="'+k.beak+'" stroke="'+L+'" stroke-width="1.2" stroke-linejoin="round"/>'
      : '<path d="M46 '+(my-1)+' L54 '+(my-1)+' L50 '+(my+4)+' Z" fill="'+k.beak+'" stroke="'+L+'" stroke-width="1.4" stroke-linejoin="round"/>';
  }else if(k.ears === 'frog'){
    o += happy ? '<path d="M38 '+my+' Q50 '+(my+10)+' 62 '+my+'" fill="#F47C8C" stroke="'+L+'" stroke-width="2.2" stroke-linejoin="round"/>'
       : (expr === 'surprise') ? '<ellipse cx="50" cy="'+(my+2)+'" rx="3.4" ry="4" fill="'+L+'"/>'
       : (expr === 'sad' || expr === 'cry' || expr === 'angry') ? ln('M42 '+(my+4)+' Q50 '+(my-1)+' 58 '+(my+4), 2.2, L)
       : ln('M40 '+my+' Q50 '+(my+6)+' 60 '+my, 2.2, L);
  }else if(chShape(k) === 'octo' && !happy && expr !== 'surprise' && expr !== 'cry'){
    o += '<ellipse cx="50" cy="'+(my+1)+'" rx="3.6" ry="3" fill="#F26A6A" stroke="'+L+'" stroke-width="2"/>';
  }else{
    var dn = 0;
    if(k.snout){
      o += '<ellipse cx="50" cy="'+(my-1)+'" rx="8" ry="5.5" fill="'+k.snout+'"'+chSt(k, 1.8)+'/>'+
           '<ellipse cx="47" cy="'+(my-1)+'" rx="1.4" ry="2" fill="'+L+'"/><ellipse cx="53" cy="'+(my-1)+'" rx="1.4" ry="2" fill="'+L+'"/>';
      dn = 6.5;
    }else if(k.bignose){
      o += '<ellipse cx="50" cy="'+(my-1.5)+'" rx="5" ry="3.8" fill="'+k.bignose+'"/><ellipse cx="48.6" cy="'+(my-2.8)+'" rx="1.4" ry=".9" fill="#fff" opacity=".6"/>';
      dn = 3.2;
    }else if(k.muzzle || k.ears === 'bear' || k.ears === 'shiba' || k.ears === 'fox' || k.ears === 'round' || k.ears === 'rpanda'){
      o += '<ellipse cx="50" cy="'+my+'" rx="2.6" ry="1.9" fill="'+L+'"/>';
      dn = 2.6;
    }
    o += mouth(my + dn);
  }
  if(k.whisker){
    var wc = k.eyeColor ? '#A8A2B4' : L, wy = f.cheekY;
    o += '<path d="M'+(f.cx1-8)+' '+(wy-4)+' L'+(f.cx1+1)+' '+(wy-3)+' M'+(f.cx1-8)+' '+(wy+2)+' L'+(f.cx1+1)+' '+(wy+1)+
         ' M'+(f.cx2+8)+' '+(wy-4)+' L'+(f.cx2-1)+' '+(wy-3)+' M'+(f.cx2+8)+' '+(wy+2)+' L'+(f.cx2-1)+' '+(wy+1)+'" stroke="'+wc+'" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>';
  }
  return o;
}
/* 表情のしるし（頭のまわり） */
function chMarks(k, expr){
  var dy = Math.max(-18, chLayout(k).top - 27), L = k.line;
  var g = function(s){ return '<g transform="translate(0 '+dy+')">'+s+'</g>'; };
  switch(expr){
    case 'sleep':
      return g('<text x="80" y="30" font-size="13" font-weight="700" fill="'+L+'" opacity=".7" font-family="sans-serif">z</text>'+
               '<text x="88" y="20" font-size="9" font-weight="700" fill="'+L+'" opacity=".5" font-family="sans-serif">z</text>');
    case 'angry':
      return g('<path d="M78 24 q3 3 0 6 M84 24 q-3 3 0 6 M78 34 q3 -3 6 0 M78 20 q3 3 6 0" fill="none" stroke="#E0485A" stroke-width="2.4" stroke-linecap="round"/>');
    case 'sweat':
      return g('<path d="M82 30 q-4 7 0 9 q4 -2 0 -9 Z" fill="#8CCBF2" stroke="#5B9BC8" stroke-width="1"/>');
    case 'think':
      return g('<text x="78" y="30" font-size="16" font-weight="800" fill="'+L+'" opacity=".75" font-family="sans-serif">?</text>');
    case 'surprise':
      return g('<text x="82" y="30" font-size="16" font-weight="800" fill="#E0485A" font-family="sans-serif">!</text>');
    case 'love':
      return g('<path d="M86 22 c-1.6-2.6-6-2-6 1.3 c0 2.6 3.3 4.6 6 6.6 c2.7-2 6-4 6-6.6 c0-3.3-4.4-3.9-6-1.3z" fill="#F58CA8"/>'+
               '<path d="M14 32 c-1-1.7-4-1.3-4 .9 c0 1.7 2.2 3 4 4.3 c1.8-1.3 4-2.6 4-4.3 c0-2.2-3-2.6-4-.9z" fill="#F58CA8" opacity=".8"/>');
    case 'sparkle':
      return chSparkle();
    case 'dizzy':
      return g('<path d="M30 18 l1.2 2.6 2.8.4-2 2 .5 2.8-2.5-1.4-2.5 1.4.5-2.8-2-2 2.8-.4z M68 14 l1 2 2.2.3-1.6 1.6.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.6 2.2-.3z" fill="#F7C94F"/>'+
               '<path d="M26 22 Q50 8 74 18" fill="none" stroke="'+L+'" stroke-width="1.2" stroke-dasharray="2 3" opacity=".5"/>');
    case 'proud':
      return g('<path d="M84 34 l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#F7C94F"/>');
    case 'eat':
      return '<g transform="translate(58 70)"><path d="M8 0 Q10 0 11 2 L16 12 Q17 15 14 15 L2 15 Q-1 15 0 12 L5 2 Q6 0 8 0 Z" fill="#fff" stroke="'+L+'" stroke-width="1.4"/><rect x="4" y="10" width="8" height="5" fill="#2F3B35"/></g>'+
             '<circle cx="42" cy="'+(chLayout(k).mouthY+8)+'" r=".9" fill="'+L+'" opacity=".5"/>';
    default: return '';
  }
}
/* 手 */
function chArms(k, expr){
  var f = chLayout(k);
  if(!f.arms) return '';
  var st = ' fill="'+(k.armFill || k.body)+'" stroke="'+k.line+'" stroke-width="2.4"';
  var e = function(x, y, rx, ry, rot){ return '<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'"'+(rot ? ' transform="rotate('+rot+' '+x+' '+y+')"' : '')+st+'/>'; };
  var y = f.armY;
  switch(expr){
    case 'cheer': case 'sparkle': return e(16, 50, 5.5, 8, -30) + e(84, 50, 5.5, 8, 30);
    case 'love': return e(24, 66, 5, 4.2) + e(76, 66, 5, 4.2);
    case 'angry': return e(17, 62, 5, 5) + e(83, 62, 5, 5);
    case 'think': return e(20, y, 5.5, 4.5) + e(60, 76, 5, 4.2);
    case 'eat': return e(56, 82, 4.5, 4) + e(76, 80, 4.5, 4);
    case 'cry': return e(30, f.eyeY + 8, 5, 4) + e(70, f.eyeY + 8, 5, 4);
    default: return e(20, y, 5.5, 4.5) + e(80, y, 5.5, 4.5);
  }
}

/* ============================== 着せかえ ============================== */
function chHat(k, id){
  if(!id) return '';
  var f = chLayout(k), L = k.line, s = ' stroke="'+L+'" stroke-width="1.8" stroke-linejoin="round"';
  var g = function(x){ return '<g transform="translate(0 '+(f.top - 27)+')">'+x+'</g>'; };
  var flower = function(x, y, c, r){
    var o = '';
    for(var i = 0; i < 5; i++){ var a = i * 72 * Math.PI / 180; o += '<circle cx="'+(x + Math.cos(a) * r).toFixed(1)+'" cy="'+(y + Math.sin(a) * r).toFixed(1)+'" r="'+r+'" fill="'+c+'"/>'; }
    return o + '<circle cx="'+x+'" cy="'+y+'" r="'+(r * .8)+'" fill="#FFE07A"/>';
  };
  switch(id){
    case 'megane':
      return '<g fill="rgba(255,255,255,.25)" stroke="#5A4A58" stroke-width="2"><circle cx="'+f.ex1+'" cy="'+f.eyeY+'" r="7"/><circle cx="'+f.ex2+'" cy="'+f.eyeY+'" r="7"/></g>'+
             '<path d="M'+(f.ex1+7)+' '+(f.eyeY-1)+' Q50 '+(f.eyeY-4)+' '+(f.ex2-7)+' '+(f.eyeY-1)+'" fill="none" stroke="#5A4A58" stroke-width="2"/>';
    case 'hachimaki':
      var hy = f.eyeY - 15;
      return '<path d="M16 '+(hy+4)+' Q50 '+(hy-6)+' 84 '+(hy+4)+'" fill="none" stroke="'+L+'" stroke-width="9" stroke-linecap="round"/>'+
             '<path d="M16 '+(hy+4)+' Q50 '+(hy-6)+' 84 '+(hy+4)+'" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round"/>'+
             '<circle cx="50" cy="'+(hy-1)+'" r="2.6" fill="#E0485A"/>'+
             '<path d="M84 '+(hy+4)+' l8 -4 M84 '+(hy+4)+' l9 3" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>';
    case 'scarf':
      return '<path d="M22 80 Q50 92 78 80" fill="none" stroke="'+L+'" stroke-width="10" stroke-linecap="round"/>'+
             '<path d="M22 80 Q50 92 78 80" fill="none" stroke="#E0607E" stroke-width="7.5" stroke-linecap="round"/>'+
             '<path d="M64 86 L68 98 L74 96 L70 84 Z" fill="#E0607E"'+s+'/>'+
             '<path d="M30 83 L32 86 M40 86 L41 89 M52 87 L52 90" stroke="#fff" stroke-width="1.4" opacity=".7"/>';
    case 'ribbon':
      return g('<path d="M64 28 L54 20 L55 36 Z M64 28 L74 20 L73 36 Z" fill="#F58CA8"'+s+'/><circle cx="64" cy="28" r="3.2" fill="#E0607E"'+s+'/>');
    case 'beret':
      return g('<ellipse cx="48" cy="26" rx="22" ry="8" transform="rotate(-8 48 26)" fill="#D9536B"'+s+'/><path d="M46 18 q2 -5 5 -4" fill="none" stroke="'+L+'" stroke-width="2.2" stroke-linecap="round"/>');
    case 'star':
      return g('<path d="M68 22 l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="#F7D35B"'+s+'/>');
    case 'sakura':
      return g(flower(66, 30, '#F8B9CB', 3.2));
    case 'flower':
      return g(flower(30, 34, '#F8B9CB', 2.8) + flower(40, 29, '#FFFFFF', 2.8) + flower(50, 27, '#F7C94F', 2.8) + flower(60, 29, '#CDB8F6', 2.8) + flower(70, 34, '#F8B9CB', 2.8));
    case 'straw':
      return g('<ellipse cx="50" cy="28" rx="34" ry="7.5" fill="#F3D58B"'+s+'/><path d="M34 28 Q34 12 50 12 Q66 12 66 28 Z" fill="#F3D58B"'+s+'/>'+
               '<path d="M34.5 24 Q50 27 65.5 24 L65.8 27.5 Q50 30 34.2 27.5 Z" fill="#E0485A"/>');
    case 'nurse':
      return g('<path d="M33 30 L36 15 Q50 10 64 15 L67 30 Q50 25 33 30 Z" fill="#FFFFFF"'+s+'/><path d="M35 22 Q50 18 65 22" fill="none" stroke="#F58CA8" stroke-width="2.4"/>'+
               '<path d="M48 13 L52 13" stroke="#F58CA8" stroke-width="1.6"/>');
    case 'party':
      return g('<path d="M40 29 L52 3 L62 27 Z" fill="#8FD0F0"'+s+'/><path d="M43 22 L57 18 M46 14 L54 12" stroke="#F58CA8" stroke-width="2.4"/><circle cx="52" cy="3" r="3.6" fill="#F7C94F"'+s+'/>');
    case 'leaf':
      return g('<path d="M50 26 Q42 14 52 6 Q62 14 50 26 Z" fill="#7CC47A"'+s+'/><path d="M50 26 Q51 16 52 9" fill="none" stroke="'+L+'" stroke-width="1.2"/>');
    case 'crown':
      return g('<path d="M36 29 L35 13 L43 21 L50 9 L57 21 L65 13 L64 29 Z" fill="#F7D35B"'+s+'/><circle cx="50" cy="23" r="2.4" fill="#F0587A"/><circle cx="41" cy="25" r="1.6" fill="#7FC0EE"/><circle cx="59" cy="25" r="1.6" fill="#7FC0EE"/>');
    case 'santa':
      return g('<path d="M28 31 Q30 10 54 8 Q72 8 82 26 L76 30 Z" fill="#E0485A"'+s+'/><ellipse cx="52" cy="31" rx="27" ry="5.5" fill="#fff"'+s+'/><circle cx="82" cy="27" r="5" fill="#fff"'+s+'/>');
    case 'witch':
      return g('<ellipse cx="50" cy="28" rx="31" ry="6" fill="#6C4F9E"'+s+'/><path d="M36 27 Q44 18 46 2 Q58 12 64 27 Z" fill="#6C4F9E"'+s+'/>'+
               '<path d="M37.5 24 Q50 22 62.5 24" fill="none" stroke="#F7C94F" stroke-width="3"/>');
    case 'kabuto':
      return g('<path d="M22 32 L50 6 L78 32 Z" fill="#DDE6F2"'+s+'/><path d="M50 6 L50 32 M36 19 L50 26 L64 19" fill="none" stroke="'+L+'" stroke-width="1.2" opacity=".6"/>'+
               '<rect x="24" y="29" width="52" height="6" rx="2" fill="#8FB3E0"'+s+'/>');
    default: return '';
  }
}

/* ============================== 持ちもの ============================== */
function chProp(prop, k){
  var L = k.line, s = ' stroke="'+L+'" stroke-width="1.6" stroke-linejoin="round"';
  switch(prop){
    case 'book':  return '<g transform="translate(62 70)"><rect x="0" y="0" width="22" height="16" rx="2" fill="#7FB3E6"'+s+'/><path d="M11 0 V16" stroke="'+L+'" stroke-width="1.4"/></g>';
    case 'umbrella': return '<g transform="translate(62 44)"><path d="M0 12 Q12 -6 24 12 Z" fill="#8EC9F2"'+s+'/><path d="M12 12 V30 Q12 34 8 33" fill="none" stroke="'+L+'" stroke-width="1.8" stroke-linecap="round"/></g>';
    case 'coin':  return '<g transform="translate(66 70)"><circle cx="9" cy="9" r="9" fill="#F6C94A"'+s+'/><text x="9" y="13" text-anchor="middle" font-size="10" font-weight="800" fill="'+L+'" font-family="sans-serif">¥</text></g>';
    case 'star':  return '<path d="M80 12 l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="#F7D35B" stroke="'+L+'" stroke-width="1.2" stroke-linejoin="round"/>';
    case 'heart': return '<path d="M82 18 c-2.5-4-9-3-9 2 c0 4 5 7 9 10 c4-3 9-6 9-10 c0-5-6.5-6-9-2z" fill="#F58CA8" stroke="'+L+'" stroke-width="1.2"/>';
    case 'cup':   return '<g transform="translate(64 72)"><path d="M0 0 H16 V8 Q16 15 8 15 Q0 15 0 8 Z" fill="#F3E3D3"'+s+'/><path d="M16 3 Q21 3 21 7 Q21 10 16 10" fill="none" stroke="'+L+'" stroke-width="1.6"/><path d="M5 -3 q-2 -3 0 -6 M10 -3 q-2 -3 0 -6" stroke="'+L+'" stroke-width="1.2" fill="none" opacity=".5"/></g>';
    case 'pencil':return '<g transform="translate(66 60) rotate(35)"><rect x="0" y="0" width="6" height="22" rx="1" fill="#F7C95B"'+s+'/><path d="M0 22 L3 28 L6 22 Z" fill="#F3DDC0"'+s+'/></g>';
    case 'moon':  return '<path d="M84 10 a8 8 0 1 0 6 12 a6.5 6.5 0 1 1 -6 -12z" fill="#F7E08A" stroke="'+L+'" stroke-width="1.2"/>';
    case 'stetho':
      return '<path d="M40 76 Q40 90 56 90 Q72 90 74 80" fill="none" stroke="#6D8BB5" stroke-width="2.6" stroke-linecap="round"/>'+
             '<circle cx="75" cy="78" r="5" fill="#D8E2EE" stroke="#6D8BB5" stroke-width="2"/><circle cx="75" cy="78" r="2" fill="#9FB3CC"/>';
    case 'bento':
      return '<g transform="translate(62 72)"><rect x="0" y="0" width="24" height="15" rx="3" fill="#fff"'+s+'/><rect x="0" y="0" width="12" height="15" rx="3" fill="#FFFDF6"/><circle cx="6" cy="7.5" r="2" fill="#E0485A"/>'+
             '<circle cx="16" cy="5" r="2.4" fill="#F7C94F"/><circle cx="20" cy="10" r="2.4" fill="#7CC47A"/><rect x="0" y="0" width="24" height="15" rx="3" fill="none"'+s+'/></g>';
    case 'flower':
      return '<path d="M80 86 Q78 74 80 62" fill="none" stroke="#5FA35C" stroke-width="2"/><path d="M80 74 q5 -4 8 -1 q-4 4 -8 1" fill="#7CC47A"/>'+
             '<circle cx="80" cy="56" r="3.6" fill="#F8B9CB"/><circle cx="85" cy="59" r="3.6" fill="#F8B9CB"/><circle cx="75" cy="59" r="3.6" fill="#F8B9CB"/><circle cx="83" cy="64" r="3.6" fill="#F8B9CB"/><circle cx="77" cy="64" r="3.6" fill="#F8B9CB"/><circle cx="80" cy="60.5" r="2.6" fill="#FFE07A"/>';
    case 'balloon':
      return '<path d="M80 76 Q86 62 84 44" fill="none" stroke="'+L+'" stroke-width="1.2"/><ellipse cx="85" cy="32" rx="9" ry="11.5" fill="#F58CA8"'+s+'/><path d="M82 26 q2 -3 5 -2" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><path d="M83 43.5 L85 45 L87 43.5 Z" fill="#F58CA8"/>';
    case 'note':
      return '<g transform="translate(62 68) rotate(-8)"><rect x="0" y="0" width="20" height="18" rx="2" fill="#FFF8DC"'+s+'/><path d="M4 6 H16 M4 10 H16 M4 14 H12" stroke="#9FB3CC" stroke-width="1.2"/></g>';
    case 'clock':
      return '<g transform="translate(78 74)"><circle r="9" fill="#FFFFFF"'+s+'/><path d="M0 0 V-6 M0 0 L4 2" stroke="'+L+'" stroke-width="1.6" stroke-linecap="round"/><circle cx="-6" cy="-9" r="2.6" fill="#F7C94F"'+s+'/><circle cx="6" cy="-9" r="2.6" fill="#F7C94F"'+s+'/></g>';
    case 'trophy':
      return '<g transform="translate(64 66)"><path d="M3 0 H19 V6 Q19 14 11 14 Q3 14 3 6 Z" fill="#F7D35B"'+s+'/><path d="M3 3 H0 Q0 9 4 9 M19 3 H22 Q22 9 18 9" fill="none" stroke="'+L+'" stroke-width="1.4"/><rect x="8" y="14" width="6" height="4" fill="#F7D35B"'+s+'/><rect x="5" y="18" width="12" height="4" rx="1" fill="#C9A63A"'+s+'/></g>';
    case 'cake':
      return '<g transform="translate(62 72)"><path d="M0 16 L0 6 L22 0 L22 16 Z" fill="#FFF3E0"'+s+'/><path d="M0 6 L22 0 L22 5 L0 11 Z" fill="#F8B9CB"/><circle cx="12" cy="0" r="3" fill="#E0485A"'+s+'/></g>';
    case 'leaf':
      return '<path d="M78 80 Q72 66 84 60 Q90 72 78 80 Z" fill="#E9964A"'+s+'/><path d="M78 80 Q80 70 84 62" fill="none" stroke="'+L+'" stroke-width="1"/>';
    case 'snow':
      return '<path d="M84 12 V28 M77 16 L91 24 M77 24 L91 16" stroke="#8FC3EA" stroke-width="2" stroke-linecap="round"/>';
    default: return '';
  }
}
function chSparkle(){
  var s = function(x, y, r, c){ return '<path d="M'+x+' '+(y-r)+' Q'+x+' '+y+' '+(x+r)+' '+y+' Q'+x+' '+y+' '+x+' '+(y+r)+' Q'+x+' '+y+' '+(x-r)+' '+y+' Q'+x+' '+y+' '+x+' '+(y-r)+'Z" fill="'+c+'"/>'; };
  return s(10, 22, 5, '#F7C94F') + s(90, 30, 4, '#F58CA8') + s(14, 86, 3.5, '#8EC9F2');
}

/* ============================== 1ぴきぶんの絵 ============================== */
var __chDefs = false;
function charaDefs(){
  if(__chDefs || typeof document === 'undefined' || !document.body) return;
  __chDefs = true;
  var d = document.createElement('div');
  d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  d.setAttribute('aria-hidden', 'true');
  d.innerHTML = '<svg width="0" height="0"><defs><filter id="chPencil" x="-5%" y="-5%" width="110%" height="110%">'+
    '<feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" result="n"/>'+
    '<feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>';
  document.body.appendChild(d);
}
/* opt: { size, expr, prop, anim, id, hat（''で帽子なし）, still（まばたきしない） } */
function charaSvg(opt){
  opt = opt || {};
  var k = opt.id ? charaById(opt.id) : charaNow();
  if(k.custom && typeof charaImgHtml === 'function') return charaImgHtml(k, opt);
  var expr = opt.expr || 'normal', size = opt.size || 64;
  var hat = (opt.hat !== undefined) ? opt.hat : charaHatNow();
  var touch = charaTouch();
  var inner = ((expr === 'cheer') ? chSparkle() : '') + chBack(k) + chEars(k) + chBody(k) + chFront(k) +
    chFace(k, expr) + chArms(k, expr) + chHat(k, hat) + chProp(opt.prop, k) + chMarks(k, expr);
  if(touch === 'pencil'){ charaDefs(); inner = '<g filter="url(#chPencil)">' + inner + '</g>'; }
  var blink = (!opt.still && expr === 'normal' && size >= 28 && charaLevel() >= 4);
  return '<span class="chara ct-'+touch+(opt.anim ? ' anim-'+opt.anim : '')+(blink ? ' blink' : '')+'" title="'+esc(k.name)+'">'+
    '<svg viewBox="0 0 100 100" width="'+size+'" height="'+size+'" aria-hidden="true" focusable="false">'+inner+'</svg></span>';
}
