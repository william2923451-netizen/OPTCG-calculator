/* 介面與卡片語言（v48）：tools/i18n.tsv＋tools/jp-names.tsv 由 tools/build-i18n.py 嵌入。
   介面翻譯是在畫面上把中文片段換成日文／英文（MutationObserver），程式邏輯一律用中文和英文卡名。 */
const I18N_DICT=/*DICT*/{}/*END*/;
const JP_NAMES=(()=>{const o={};/*JPN*/''/*END*/.split(';').forEach(x=>{const k=x.indexOf('|');if(k>0)o[x.slice(0,k)]=x.slice(k+1);});return o;})();
const I18N=(()=>{
  let ui='zh',card='en';
  try{
    const s=JSON.parse(localStorage.getItem('optcg-lang')||'null');
    if(s&&s.ui){ui=s.ui;card=s.card||'en';}
    else{const n=(navigator.language||'').toLowerCase(); ui=n.startsWith('ja')?'ja':n.startsWith('zh')?'zh':'en'; card=ui==='ja'?'ja':'en';}
  }catch(_){}
  if(!['zh','ja','en'].includes(ui)) ui='zh';
  if(!['en','ja'].includes(card)) card='en';
  return {ui,card};
})();
function setLang(ui,card){try{localStorage.setItem('optcg-lang',JSON.stringify({ui,card}));}catch(_){} location.reload();}
const LANG_NAMES={zh:'繁體中文',ja:'日本語',en:'English'};
function settingsBody(){
  const seg=(key,cur,opts)=>`<span class="seg notr" role="group">${opts.map(v=>`<button id="set-${key}-${v}" data-${key}="${v}" aria-pressed="${cur===v}">${LANG_NAMES[v]}</button>`).join('')}</span>`;
  return `<div class="st"><span class="stl">介面語言</span>${seg('uilang',I18N.ui,['zh','ja','en'])}</div>
    <div class="st"><span class="stl">卡片語言</span>${seg('cardlang',I18N.card,['en','ja'])}</div>
    <p class="note">卡片語言會切換卡名和卡圖。切換後頁面會重新整理，盤面不會不見。</p>`;
}

/* ---- 文字翻譯 ---- */
const I18N_KEYS=(()=>{const m=new Map();for(const k in I18N_DICT){const c=k[0];if(!m.has(c))m.set(c,[]);m.get(c).push(k);}m.forEach(a=>a.sort((x,y)=>y.length-x.length));return m;})();
const HAN_RUN=/[　-〿぀-ヿ一-鿿！-｠]+/g;
const HAS_HAN=/[一-鿿　-〿！-｠]/;
const I18N_RULES=[
  [/航海王TCG ?配DON!!計算器/g,'OPTCG DON!! Calculator','OPTCG ドン!!計算機'],
  [/第\s*(\d+)\s*張生命卡/g,'Life card #$1','ライフ$1枚目'],
  [/第\s*(\d+)\s*張（最上面）/g,'Card #$1 (top)','$1枚目（一番上）'],
  [/第\s*(\d+)\s*張/g,'Card #$1','$1枚目'],
  [/不到\s*(\d+)\s*%/g,'under $1%','$1%未満'],
  [/吃\s*(\d+)\s*血/g,'take $1 life','ライフ$1点受ける'],
  [/約\s*([\d.]+)\s*%/g,'about $1%','約$1%'],
  [/約\s*(\d+)/g,'≈$1','約$1'],
];
function trRun(run,li){
  const whole=I18N_DICT[run]; if(whole) return [whole[li]];
  const out=[]; let i=0;
  while(i<run.length){
    const cands=I18N_KEYS.get(run[i]); let hit=null;
    if(cands) for(const k of cands){ if(run.startsWith(k,i)){hit=k;break;} }
    if(hit){out.push(I18N_DICT[hit][li]); i+=hit.length;} else {out.push(run[i]); i++;}
  }
  return out;
}
function trText(s,keep){
  keep=keep||[];
  const back=x=>x.replace(/\u0001(\d+)\u0002/g,(_,k)=>keep[+k]);
  if(I18N.ui==='zh'||!HAS_HAN.test(s)) return back(s);
  const li=I18N.ui==='en'?0:1;
  for(const [re,en,ja] of I18N_RULES) s=s.replace(re,(...a)=>{const r=(li?ja:en).replace(/\$(\d)/g,(_,k)=>a[+k]); keep.push(r); return '\u0001'+(keep.length-1)+'\u0002';});
  const parts=[]; let last=0;
  s.replace(HAN_RUN,(m,off)=>{ if(off>last) parts.push(s.slice(last,off)); trRun(m,li).forEach(x=>parts.push(x)); last=off+m.length; return m;});
  if(last<s.length) parts.push(s.slice(last));
  if(li) return back(parts.join(''));
  let o='';
  for(let p of parts){ if(!p) continue; if(p[0]==='\u2060'){o=o.replace(/ $/,'');o+=p.slice(1);continue;} if(o&&(/[A-Za-z0-9!%)\]'"’\u0002]$/.test(o)&&/^[A-Za-z0-9(\["'#+≈\u0001]/.test(p)||/[,.:;?]$/.test(o)&&/^[A-Za-z0-9("\u0001]/.test(p))) o+=' '; o+=p; }
  o=back(o);
  return o.replace(/ {2,}/g,' ').replace(/ ([,.;:)\]])/g,'$1').replace(/\( /g,'(').replace(/,(?=[^\s\d])/g,', ');
}

/* ---- 卡名 ---- */
let CARD_RE=null, CARD_MAP=null, CARD_N=-1;
function buildCardNames(){
  const m={}; const add=(id,name)=>{if(!id||!name)return; const j=JP_NAMES[id]; if(j){const n=String(name).trim(); if(n.length>=3&&!m[n]) m[n]=j;}};
  try{Object.values(META_CHARS).forEach(c=>add(c.id,c.name));Object.values(META_EVS).forEach(c=>add(c.id,c.name));Object.values(META_LDS).forEach(c=>add(c.id,c.name));META.leaders.forEach(L=>{add(L.id,L.name);(L.evs||[]).forEach(v=>add(v.id,v.name));});}catch(_){}
  try{for(const id in EFX_UI) add(id,EFX_UI[id].name);}catch(_){}
  CARD_MAP=m; const keys=Object.keys(m).sort((a,b)=>b.length-a.length);
  CARD_RE=keys.length?new RegExp('(^|[^A-Za-z])('+keys.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')(?![A-Za-z])','g'):null;
  try{CARD_N=Object.keys(META_CHARS).length+Object.keys(META_EVS).length;}catch(_){CARD_N=0;}
}
function trCards(s,keep){
  if(I18N.card!=='ja'||!CARD_RE||!/[A-Za-z]{3}/.test(s)) return s;
  return s.replace(CARD_RE,(m,pre,name)=>{keep.push(CARD_MAP[name]); return pre+'\u0001'+(keep.length-1)+'\u0002';});
}

/* ---- 套用到畫面 ---- */
const I18N_ATTRS=['aria-label','placeholder','title','alt'];
function trAll(s){const keep=[]; return trText(trCards(s,keep),keep);}
const I18N_DONE=new WeakMap();
function trNode(n){
  if(n.nodeType===3){const v=n.nodeValue; if(v&&v.trim()&&I18N_DONE.get(n)!==v){const t=trAll(v); if(t!==v) n.nodeValue=t; I18N_DONE.set(n,t);} return;}
  if(n.nodeType!==1) return;
  const tag=n.tagName; if(tag==='SCRIPT'||tag==='STYLE'||tag==='TEXTAREA'||tag==='INPUT'&&n.type!=='button') {trAttrs(n);return;}
  if(n.classList&&n.classList.contains('notr')) return;
  trAttrs(n);
  for(let c=n.firstChild;c;c=c.nextSibling) trNode(c);
}
const I18N_ADONE=new WeakMap();
function trAttrs(n){if(!n.getAttribute) return; let m=I18N_ADONE.get(n); for(const a of I18N_ATTRS){const v=n.getAttribute(a); if(v&&!(m&&m[a]===v)){const t=trAll(v); if(t!==v) n.setAttribute(a,t); if(!m){m={};I18N_ADONE.set(n,m);} m[a]=t;}}}
let I18N_ON=false;
function i18nApply(el){if(I18N_ON&&el) trNode(el);}
function i18nStart(){
  document.documentElement.lang=I18N.ui==='zh'?'zh-Hant':I18N.ui;
  if(I18N.ui==='zh'&&I18N.card==='en') return;
  I18N_ON=true;
  buildCardNames();
  document.title=trAll(document.title);
  trNode(document.body);
  const obs=new MutationObserver(recs=>{
    try{const n=Object.keys(META_CHARS).length+Object.keys(META_EVS).length; if(n!==CARD_N) buildCardNames();}catch(_){}
    for(const r of recs){
      if(r.type==='childList') r.addedNodes.forEach(x=>{const p=x.parentNode; if(!(p&&p.closest&&p.closest('.notr'))) trNode(x);});
      else if(r.type==='characterData'){const p=r.target.parentNode; if(!(p&&p.closest&&p.closest('.notr'))) trNode(r.target);}
      else if(r.type==='attributes') trAttrs(r.target);
    }
    obs.takeRecords();
  });
  obs.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:I18N_ATTRS});
  if(I18N.card==='ja'&&/^https?:$/.test(location.protocol)) fetch('jp-names.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(o=>{
    if(!o) return; let n=0; for(const k in o) if(!JP_NAMES[k]){JP_NAMES[k]=o[k];n++;}
    if(n){buildCardNames(); try{renderBoard(); if(sheet) renderSheet(); compute();}catch(_){}}
  }).catch(()=>{});
}
