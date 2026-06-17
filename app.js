/* ====== データ（初期値） ====== */
const DEFAULT_GROUPS = [
  {name:"グループ1", members:["武田 灯","河原田 舞佑"]},
  {name:"グループ2", members:["渥見 桃可","久野 絢音"]},
  {name:"グループ3", members:["高野 天音","植原 誠一郎"]},
  {name:"グループ4", members:["木村 優那","伊藤 怜和"]},
  {name:"グループ5", members:["西尾 瑛人","一ノ瀬 友希乃"]},
  {name:"グループ6", members:["庄司 楓","鈴木 菜々子"]},
  {name:"グループ7", members:["OK, EUNICE","新海 吉兵"]},
  {name:"グループ8", members:["江本 乃安","坂本 澄佳"]},
];
const STORE_KEY = "presentation-roulette-groups-v1";
const HIST_KEY  = "presentation-roulette-history-v1";
const HIST_MAX  = 20;

function loadGroups(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(raw){
      const data = JSON.parse(raw);
      if(Array.isArray(data) && data.length>=2) return data;
    }
  }catch(e){}
  return JSON.parse(JSON.stringify(DEFAULT_GROUPS));
}
function saveGroups(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(groups)); }catch(e){}
}
function loadHistory(){
  try{ const raw = localStorage.getItem(HIST_KEY); if(raw){ const d=JSON.parse(raw); if(Array.isArray(d)) return d; } }catch(e){}
  return [];
}
function saveHistory(){ try{ localStorage.setItem(HIST_KEY, JSON.stringify(history)); }catch(e){} }

let groups = loadGroups();        // 可変データ
let history = loadHistory();      // 過去の発表順
let N = groups.length;
let SEG = (Math.PI*2)/N;

/* SmartHR配色をベースにしたアクセシブルな配色（グループ数に応じて生成） */
const BASE_COLORS = ["#0077c7","#0f7f85","#f56121","#e01e5a","#6b4fbb","#00a8b5","#2e9e5b","#c98a00"];
function hslToHex(h,s,l){
  s/=100; l/=100;
  const k=n=>(n+h/30)%12, a=s*Math.min(l,1-l);
  const f=n=>{const c=l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
    return Math.round(255*c).toString(16).padStart(2,"0");};
  return `#${f(0)}${f(8)}${f(4)}`;
}
function buildPalette(n){
  if(n<=BASE_COLORS.length) return BASE_COLORS.slice(0,n);
  const arr=[];
  for(let i=0;i<n;i++) arr.push(hslToHex(Math.round(360*i/n),62,45));
  return arr;
}
let COLORS = buildPalette(N);

/* ====== 偏りのない乱数（棄却サンプリング） ====== */
function randInt(n){
  const max = Math.floor(0xFFFFFFFF / n) * n;
  const buf = new Uint32Array(1);
  let x;
  do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= max);
  return x % n;
}

/* ====== 状態（グループのindexで管理） ====== */
let decided = [];                 // 決定済みグループのindex
let remaining = groups.map((_,i)=>i);
let rotation = 0;
let spinning = false;

/* ====== Canvas ====== */
const cv = document.getElementById("wheel");
const ctx = cv.getContext("2d");
const SIZE = cv.width;
const CX = SIZE/2, CY = SIZE/2, R = SIZE/2 - 12;

function drawWheel(rot){
  ctx.clearRect(0,0,SIZE,SIZE);
  const fontSize = N>14 ? 22 : N>10 ? 28 : 38;
  for(let i=0;i<N;i++){
    const start = rot + i*SEG;
    const end = start + SEG;
    const isDone = decided.includes(i);
    ctx.beginPath();
    ctx.moveTo(CX,CY);
    ctx.arc(CX,CY,R,start,end);
    ctx.closePath();
    if(isDone){
      ctx.fillStyle = "#edebe8";
    }else{
      const grad = ctx.createRadialGradient(CX,CY,R*0.2,CX,CY,R);
      grad.addColorStop(0, shade(COLORS[i],18));
      grad.addColorStop(1, COLORS[i]);
      ctx.fillStyle = grad;
    }
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.save();
    ctx.translate(CX,CY);
    ctx.rotate(start + SEG/2);
    ctx.textAlign = "right";
    ctx.fillStyle = isDone ? "#c1bdb7" : "#ffffff";
    ctx.font = "900 "+fontSize+"px 'Noto Sans JP', system-ui, sans-serif";
    ctx.fillText((i+1), R-24, fontSize*0.34);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(CX,CY,R,0,Math.PI*2);
  ctx.lineWidth=4;
  ctx.strokeStyle="#d6d3d0";
  ctx.stroke();
}
function shade(hex,p){
  const n=parseInt(hex.slice(1),16);
  let r=(n>>16)+p, g=((n>>8)&255)+p, b=(n&255)+p;
  r=Math.max(0,Math.min(255,r));g=Math.max(0,Math.min(255,g));b=Math.max(0,Math.min(255,b));
  return `rgb(${r},${g},${b})`;
}

/* ====== サウンド ====== */
let audioCtx=null;
function beep(freq,dur,type="square",vol=.06){
  if(!document.getElementById("soundToggle").checked) return;
  try{
    audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type=type;o.frequency.value=freq;
    o.connect(g);g.connect(audioCtx.destination);
    g.gain.setValueAtTime(vol,audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001,audioCtx.currentTime+dur);
    o.start();o.stop(audioCtx.currentTime+dur);
  }catch(e){}
}
function fanfare(){
  [523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,.25,"triangle",.10),i*110));
}

/* ====== 要素参照 ====== */
const spinBtn=document.getElementById("spinBtn");
const resetBtn=document.getElementById("resetBtn");
const statusEl=document.getElementById("status");
const bigResult=document.getElementById("bigResult");
const hub=document.getElementById("hub");
const avoidConsec=document.getElementById("avoidConsec");

/* 直近の「1番目」のグループ名（連続回避に使用） */
function lastFirstName(){
  return history.length ? (history[0].order[0] || null) : null;
}

/* ====== スピン ====== */
function spin(){
  if(spinning || remaining.length===0) return;
  spinning=true;
  spinBtn.disabled=true; resetBtn.disabled=true;
  bigResult.textContent="";
  statusEl.textContent="抽選中…";

  // 候補プール（連続回避：最初の1回だけ前回トップを除外）
  let pool = remaining;
  if(avoidConsec && avoidConsec.checked && decided.length===0){
    const lf = lastFirstName();
    if(lf){
      const filtered = remaining.filter(i => groups[i].name === lf ? false : true);
      if(filtered.length>0) pool = filtered;
    }
  }

  const targetIdx = pool[randInt(pool.length)];
  const segIndex = targetIdx;

  const center = segIndex*SEG + SEG/2;
  const turns = 5 + randInt(3);
  const targetRot = (-Math.PI/2 - center) - turns*Math.PI*2;

  const startRot = rotation % (Math.PI*2);
  const delta = targetRot - startRot;
  const dur = 4200;
  const t0 = performance.now();
  let lastSeg = -1;

  function frame(now){
    let p = Math.min(1,(now-t0)/dur);
    const eased = 1 - Math.pow(1-p, 3);
    rotation = startRot + delta*eased;
    drawWheel(rotation);

    const ang = ((-Math.PI/2 - rotation) % (Math.PI*2) + Math.PI*2) % (Math.PI*2);
    const curSeg = Math.floor(ang/SEG);
    if(curSeg!==lastSeg){ lastSeg=curSeg; beep(360+curSeg*12,.04,"square",.04); }

    if(p<1){ requestAnimationFrame(frame); }
    else { finishSpin(targetIdx); }
  }
  requestAnimationFrame(frame);
}

function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}

function finishSpin(idx){
  decided.push(idx);
  remaining = remaining.filter(x=>x!==idx);
  drawWheel(rotation);
  fanfare();

  bigResult.textContent = `${decided.length}番目 → ${groups[idx].name}`;
  statusEl.textContent = remaining.length>0
      ? `残り ${remaining.length} グループ`
      : "🎉 全グループの順番が決定しました！";
  hub.innerHTML = remaining.length>0 ? `残り<br>${remaining.length}` : "完了!";

  renderOrder();
  launchConfetti(remaining.length===0 ? 160 : 40);

  if(remaining.length===0) recordHistory();

  spinning=false;
  resetBtn.disabled=false;
  spinBtn.disabled = remaining.length===0;
}

function orderText(){
  return decided.map((idx,pos)=>{
    const g=groups[idx];
    const names=(g.members||[]).filter(m=>m&&m.trim()).join("・");
    return `${pos+1}. ${g.name}${names?`（${names}）`:""}`;
  }).join("\n");
}

function renderOrder(){
  const ol=document.getElementById("orderList");
  if(decided.length===0){
    ol.innerHTML='<li class="placeholder">まだ決まっていません</li>';
    updateResultActions();
    return;
  }
  ol.innerHTML="";
  decided.forEach((idx,pos)=>{
    const g=groups[idx];
    const names=(g.members||[]).filter(m=>m&&m.trim()).join(" ・ ") || "（メンバー未設定）";
    const li=document.createElement("li");
    li.className="order-item";
    li.style.animationDelay=(pos*0.03)+"s";
    li.innerHTML=`<div class="rank">${pos+1}</div>
      <div class="info">
        <span class="grp">${esc(g.name)}</span>
        <span class="members" title="${esc(names)}">${esc(names)}</span>
      </div>`;
    ol.appendChild(li);
  });
  updateResultActions();
}

function reset(){
  decided=[]; remaining=groups.map((_,i)=>i);
  rotation=0; spinning=false;
  spinBtn.disabled=false; resetBtn.disabled=false;
  bigResult.textContent=""; statusEl.textContent="「スピン」を押して開始";
  hub.innerHTML=`残り<br>${N}`;
  drawWheel(rotation); renderOrder();
}

/* グループ変更時に全体を作り直す */
function rebuildFromGroups(){
  N = groups.length;
  SEG = (Math.PI*2)/N;
  COLORS = buildPalette(N);
  reset();
}

spinBtn.addEventListener("click",spin);
resetBtn.addEventListener("click",reset);

/* ====== 結果の保存・出力 ====== */
const copyBtn=document.getElementById("copyBtn");
const imageBtn=document.getElementById("imageBtn");
const printBtn=document.getElementById("printBtn");

function updateResultActions(){
  const done = decided.length>0;
  [copyBtn,imageBtn,printBtn].forEach(b=>{ if(b) b.disabled = !done; });
}

if(copyBtn) copyBtn.addEventListener("click", async ()=>{
  if(decided.length===0) return;
  const text = "【発表順】\n"+orderText();
  try{
    await navigator.clipboard.writeText(text);
    copyBtn.textContent="✅ コピーしました";
    setTimeout(()=>copyBtn.textContent="📋 コピー",1500);
  }catch(e){
    // フォールバック
    const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);
    ta.select();try{document.execCommand("copy");}catch(_){}document.body.removeChild(ta);
    copyBtn.textContent="✅ コピーしました";
    setTimeout(()=>copyBtn.textContent="📋 コピー",1500);
  }
});

function roundRect(c,x,y,w,h,r){
  c.beginPath();
  c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
}
if(imageBtn) imageBtn.addEventListener("click", ()=>{
  if(decided.length===0) return;
  const pad=24, rowH=60, headH=92, w=640;
  const h=headH+decided.length*rowH+pad;
  const dpr=2;
  const c=document.createElement("canvas");
  c.width=w*dpr; c.height=h*dpr;
  const x=c.getContext("2d"); x.scale(dpr,dpr);
  x.fillStyle="#ffffff"; x.fillRect(0,0,w,h);
  x.fillStyle="#0077c7"; x.fillRect(0,0,w,8);
  x.fillStyle="#23221e"; x.font="700 26px 'Noto Sans JP',sans-serif"; x.textBaseline="alphabetic";
  x.fillText("🎯 発表順", pad, 50);
  x.fillStyle="#706d65"; x.font="13px 'Noto Sans JP',sans-serif";
  x.fillText(new Date().toLocaleString("ja-JP"), pad, 74);
  decided.forEach((idx,pos)=>{
    const y=headH+pos*rowH, g=groups[idx];
    x.fillStyle="#0077c7"; roundRect(x,pad,y,38,38,9); x.fill();
    x.fillStyle="#fff"; x.font="900 18px 'Noto Sans JP',sans-serif"; x.textAlign="center";
    x.fillText(pos+1, pad+19, y+26); x.textAlign="left";
    x.fillStyle="#23221e"; x.font="700 17px 'Noto Sans JP',sans-serif";
    x.fillText(g.name, pad+52, y+16);
    x.fillStyle="#706d65"; x.font="13px 'Noto Sans JP',sans-serif";
    const names=(g.members||[]).filter(m=>m&&m.trim()).join(" ・ ");
    x.fillText(names, pad+52, y+36);
    x.strokeStyle="#edebe8"; x.lineWidth=1;
    x.beginPath();x.moveTo(pad,y+rowH-8);x.lineTo(w-pad,y+rowH-8);x.stroke();
  });
  const a=document.createElement("a");
  a.download=`発表順_${new Date().toISOString().slice(0,10)}.png`;
  a.href=c.toDataURL("image/png");
  a.click();
});

if(printBtn) printBtn.addEventListener("click", ()=>{ if(decided.length>0) window.print(); });

/* ====== 履歴 ====== */
const historyCard=document.getElementById("historyCard");
const historyList=document.getElementById("historyList");
const clearHistBtn=document.getElementById("clearHistBtn");

function recordHistory(){
  const order = decided.map(idx=>groups[idx].name);
  history.unshift({ t: Date.now(), order });
  if(history.length>HIST_MAX) history.length = HIST_MAX;
  saveHistory();
  renderHistory();
}
function renderHistory(){
  if(!historyCard) return;
  if(history.length===0){ historyCard.hidden = true; return; }
  historyCard.hidden = false;
  historyList.innerHTML="";
  history.forEach(h=>{
    const li=document.createElement("li");
    li.className="hist-item";
    const time=new Date(h.t).toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
    const seq=h.order.map((nm,i)=>`<b>${i+1}.</b> ${esc(nm)}`).join("　→　");
    li.innerHTML=`<div class="hist-time">${time}</div><div class="hist-order">${seq}</div>`;
    historyList.appendChild(li);
  });
}
if(clearHistBtn) clearHistBtn.addEventListener("click", ()=>{
  if(confirm("履歴をすべて消去します。よろしいですか？")){
    history=[]; saveHistory(); renderHistory();
  }
});

/* ====== 編集機能 ====== */
const editor = document.getElementById("editor");
const groupEditor = document.getElementById("groupEditor");
let draft = [];

function openEditor(){
  draft = JSON.parse(JSON.stringify(groups));
  renderEditor();
  editor.hidden = false;
  editor.scrollIntoView({behavior:"smooth", block:"start"});
}
function closeEditor(){ editor.hidden = true; }

function renderEditor(){
  groupEditor.innerHTML="";
  draft.forEach((g,gi)=>{
    const card=document.createElement("div");
    card.className="grp-edit";
    const members=(g.members||[]).map((m,mi)=>`
      <div class="member-row">
        <span class="mlabel">メンバー${mi+1}</span>
        <input type="text" value="${esc(m)}" data-g="${gi}" data-m="${mi}" class="member-in" placeholder="名前">
        <button class="del-btn" data-del-member="${gi}:${mi}" aria-label="削除">🗑</button>
      </div>`).join("");
    card.innerHTML=`
      <div class="grp-top">
        <span class="grp-no">${gi+1}</span>
        <input type="text" class="grp-name-in" value="${esc(g.name)}" data-name="${gi}" placeholder="グループ名">
        <button class="del-btn" data-del-group="${gi}" aria-label="グループ削除" title="グループを削除">🗑</button>
      </div>
      <div class="members-edit">${members}</div>
      <button class="btn-add sm" data-add-member="${gi}">＋ メンバーを追加</button>
    `;
    groupEditor.appendChild(card);
  });
}

groupEditor.addEventListener("input", e=>{
  const t=e.target;
  if(t.dataset.name!==undefined){ draft[+t.dataset.name].name = t.value; }
  else if(t.classList.contains("member-in")){ draft[+t.dataset.g].members[+t.dataset.m] = t.value; }
});
groupEditor.addEventListener("click", e=>{
  const t=e.target.closest("button");
  if(!t) return;
  if(t.dataset.delGroup!==undefined){
    if(draft.length<=2){ alert("グループは2つ以上必要です。"); return; }
    draft.splice(+t.dataset.delGroup,1); renderEditor();
  }else if(t.dataset.addMember!==undefined){
    draft[+t.dataset.addMember].members.push(""); renderEditor();
  }else if(t.dataset.delMember!==undefined){
    const [gi,mi]=t.dataset.delMember.split(":").map(Number);
    draft[gi].members.splice(mi,1); renderEditor();
  }
});

document.getElementById("addGroupBtn").addEventListener("click",()=>{
  draft.push({name:`グループ${draft.length+1}`, members:["",""]});
  renderEditor();
});
document.getElementById("saveEditBtn").addEventListener("click",()=>{
  if(draft.length<2){ alert("グループは2つ以上必要です。"); return; }
  groups = draft.map((g,i)=>({
    name:(g.name&&g.name.trim()) ? g.name.trim() : `グループ${i+1}`,
    members:(g.members||[]).map(m=>m.trim()).filter(m=>m)
  }));
  saveGroups();
  rebuildFromGroups();
  closeEditor();
});
document.getElementById("editBtn").addEventListener("click",openEditor);
document.getElementById("closeEditBtn").addEventListener("click",closeEditor);
document.getElementById("cancelEditBtn").addEventListener("click",closeEditor);
document.getElementById("resetDefaultBtn").addEventListener("click",()=>{
  if(confirm("初期データ（8グループ）に戻します。よろしいですか？")){
    draft = JSON.parse(JSON.stringify(DEFAULT_GROUPS));
    renderEditor();
  }
});

/* ====== 紙吹雪 ====== */
const confCv=document.getElementById("confetti");
const cctx=confCv.getContext("2d");
let parts=[];
function sizeConf(){confCv.width=innerWidth;confCv.height=innerHeight;}
sizeConf(); addEventListener("resize",sizeConf);
function launchConfetti(n){
  for(let i=0;i<n;i++){
    parts.push({
      x:Math.random()*confCv.width, y:-20,
      vx:(Math.random()-.5)*6, vy:Math.random()*4+2,
      s:Math.random()*8+4, c:COLORS[Math.floor(Math.random()*COLORS.length)],
      rot:Math.random()*6.28, vr:(Math.random()-.5)*.3, life:1
    });
  }
  if(!confRunning) runConfetti();
}
let confRunning=false;
function runConfetti(){
  confRunning=true;
  cctx.clearRect(0,0,confCv.width,confCv.height);
  parts.forEach(p=>{
    p.x+=p.vx;p.y+=p.vy;p.vy+=.12;p.rot+=p.vr;p.life-=.006;
    cctx.save();cctx.translate(p.x,p.y);cctx.rotate(p.rot);
    cctx.globalAlpha=Math.max(0,p.life);cctx.fillStyle=p.c;
    cctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6);cctx.restore();
  });
  parts=parts.filter(p=>p.life>0 && p.y<confCv.height+30);
  if(parts.length>0){requestAnimationFrame(runConfetti);}
  else{cctx.clearRect(0,0,confCv.width,confCv.height);confRunning=false;}
}

/* init */
rebuildFromGroups();
renderHistory();
