// ═══ SPRINT 3.2: COMMS LOG ══════════════════════════════
function addCommsLog(type, content){
  if (!Array.isArray(S.commsLog)) S.commsLog = [];
  S.commsLog.unshift({time:nowTimeSec(),type,content,id:Date.now()});
  if(S.commsLog.length>100) S.commsLog.length=100;
  saveState();
}

function openCommsLog(){
  let html=`<div style="max-width:430px;margin:0 auto;padding:16px">
    <div style="display:flex;align-items:center;margin-bottom:12px;gap:8px">
      <div style="font-size:18px;font-weight:900;flex:1">📻 לוג שידורים</div>
      <button class="btn btn-ghost btn-sm" onclick="$('comms-log-overlay').style.display='none'">✕</button>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:10px">
      <input class="inp" id="comms-log-input" placeholder="תיעוד שידור..." style="flex:1">
      <button class="btn btn-sm btn-olive" onclick="addCommsLog('manual',$('comms-log-input').value);$('comms-log-input').value='';openCommsLog()">+ הוסף</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px">`;
  if(!S.commsLog.length) html+=`<div style="font-size:11px;color:var(--muted);padding:20px;text-align:center">אין שידורים מתועדים</div>`;
  S.commsLog.forEach(l=>{
    html+=`<div style="background:var(--s2);border:1px solid var(--b0);border-radius:6px;padding:6px 10px;display:flex;gap:8px;align-items:flex-start">
      <div style="font-size:9px;color:var(--muted);font-family:var(--font-mono);flex-shrink:0;margin-top:2px">${l.time}</div>
      <div style="font-size:11px;color:var(--muted2);flex:1">${escHTML(l.content)}</div>
    </div>`;
  });
  html+=`</div></div>`;
  $('comms-log-overlay').innerHTML=html;
  $('comms-log-overlay').style.display='block';
}

// ═══ SPRINT 4.4: KPI DASHBOARD ══════════════════════════
function renderKPI(){
  const el=$('kpi-dashboard');if(!el) return;
  if(!S.missionStart||!S.casualties.length){el.innerHTML='<div style="font-size:11px;color:var(--muted);padding:8px">הפעל אר"ן עם פגועים</div>';return;}
  const now=Date.now();
  const kpis=[];
  // Time to first TQ
  const withTQ=S.casualties.filter(c=>c.tqStart);
  if(withTQ.length){
    const avgTQ=withTQ.reduce((s,c)=>s+((c.tqStart-(c._addedAt||S.missionStart))/60000),0)/withTQ.length;
    kpis.push({label:'זמן ממגע → TQ',value:`${avgTQ.toFixed(1)} דק'`,target:'< 2 דק\'',ok:avgTQ<2});
  }
  // Time contact to evac
  const avgWait=S.casualties.reduce((s,c)=>s+((now-(c._addedAt||S.missionStart))/60000),0)/S.casualties.length;
  kpis.push({label:'זמן ממגע → כעת',value:`${avgWait.toFixed(0)} דק'`,target:'< 60 דק\'',ok:avgWait<60});
  // TXA compliance
  const needTXA=S.casualties.filter(c=>c.priority!=='T4');
  const gotTXA=needTXA.filter(c=>c.txList&&c.txList.some(t=>t.type&&t.type.includes('TXA')));
  const txaPct=needTXA.length?Math.round(gotTXA.length/needTXA.length*100):0;
  kpis.push({label:'TXA בזמן',value:`${txaPct}%`,target:'100%',ok:txaPct>=80});
  // 9-LINE ready
  const nineReady=S.casualties.filter(c=>c.name&&c.blood&&c.kg).length;
  const ninePct=S.casualties.length?Math.round(nineReady/S.casualties.length*100):0;
  kpis.push({label:'9-LINE מוכן',value:`${ninePct}%`,target:'100%',ok:ninePct>=80});

  el.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
    ${kpis.map(k=>`<div style="background:var(--s2);border:1px solid ${k.ok?'var(--green2)':'var(--red2)'};border-radius:8px;padding:10px;text-align:center">
      <div style="font-size:20px;font-weight:900;color:${k.ok?'var(--green3)':'var(--red3)'}">${k.value}</div>
      <div style="font-size:10px;color:var(--muted2);margin-top:2px">${k.label}</div>
      <div style="font-size:8px;color:var(--muted);margin-top:1px">יעד: ${k.target}</div>
    </div>`).join('')}
  </div>`;
}

// ═══ SPRINT 5: EXTRA TRAINING SCENARIOS ═════════════════
const EXTRA_SCENARIOS=[
  {id:4,name:'תרחיש 4: IED — 3 פגועי פיצוץ',difficulty:'קשה',
   casualties:[
     {name:'אלעד מ.',priority:'T1',mech:['פיצוץ'],blood:'A+',kg:80},
     {name:'רועי כ.',priority:'T1',mech:['פיצוץ','כוויה'],blood:'O+',kg:75},
     {name:'מיכל ש.',priority:'T2',mech:['רסיס'],blood:'B+',kg:60}
   ]},
  {id:5,name:'תרחיש 5: PFC — פינוי מאוחר >2h',difficulty:'בינוני',
   casualties:[
     {name:'עומר ד.',priority:'T2',mech:['ירי'],blood:'O-',kg:85}
   ]},
  {id:6,name:'תרחיש 6: MASCAL לילה — 8 פגועים',difficulty:'קשה מאוד',
   casualties:[
     {name:'פגוע 1',priority:'T1',mech:['ירי'],blood:'A+',kg:75},
     {name:'פגוע 2',priority:'T1',mech:['פיצוץ'],blood:'O+',kg:80},
     {name:'פגוע 3',priority:'T2',mech:['רסיס'],blood:'B+',kg:70},
     {name:'פגוע 4',priority:'T2',mech:['נפילה'],blood:'A-',kg:65},
     {name:'פגוע 5',priority:'T3',mech:['להב'],blood:'O+',kg:90},
     {name:'פגוע 6',priority:'T3',mech:['כוויה'],blood:'AB+',kg:72},
     {name:'פגוע 7',priority:'T1',mech:['ירי','רסיס'],blood:'B-',kg:82},
     {name:'פגוע 8',priority:'T4',mech:['פיצוץ'],blood:'O-',kg:68}
   ]}
];

// ═══ SPRINT 3.3: LZ MANAGER ════════════════════════════
function openLZManager(){
  let html=`<div style="max-width:430px;margin:0 auto;padding:16px">
    <div style="display:flex;align-items:center;margin-bottom:12px;gap:8px">
      <div style="font-size:18px;font-weight:900;flex:1">🛬 LZ Manager</div>
      <button class="btn btn-ghost btn-sm" onclick="$('lz-overlay').style.display='none'">✕</button>
    </div>`;
  ['lz1','lz2'].forEach((k,i)=>{
    const lz=S.lzStatus[k]||{status:'standby',responsible:''};
    const colors={active:'var(--green2)',closed:'var(--red2)',standby:'var(--amber)'};
    const labels={active:'🟢 פעיל',closed:'🔴 סגור',standby:'🟡 המתנה'};
    html+=`<div style="background:var(--s2);border:1px solid ${colors[lz.status]||'var(--b0)'};border-radius:10px;padding:12px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="font-size:14px;font-weight:900">LZ${i+1}</div>
        <div style="font-size:20px;font-weight:900;color:${colors[lz.status]}">${labels[lz.status]||'—'}</div>
      </div>
      <div style="font-size:11px;color:var(--muted2);margin-bottom:4px">שם / נ.צ.: ${S.comms[k]||'לא הוגדר'}</div>
      <input class="inp" placeholder="אחראי LZ" value="${escHTML(lz.responsible)}" onchange="S.lzStatus['${k}'].responsible=this.value;saveState()" style="margin-bottom:6px">
      <div style="display:flex;gap:4px">
        <button class="btn btn-sm ${lz.status==='active'?'btn-olive':'btn-ghost'}" onclick="S.lzStatus['${k}'].status='active';saveState();openLZManager()">🟢 פעיל</button>
        <button class="btn btn-sm ${lz.status==='standby'?'btn-amber':'btn-ghost'}" onclick="S.lzStatus['${k}'].status='standby';saveState();openLZManager()">🟡 המתנה</button>
        <button class="btn btn-sm ${lz.status==='closed'?'btn-red':'btn-ghost'}" onclick="S.lzStatus['${k}'].status='closed';saveState();openLZManager()">🔴 סגור</button>
      </div>
    </div>`;
  });
  html+=`</div>`;
  $('lz-overlay').innerHTML=html;
  $('lz-overlay').style.display='block';
}

// ═══ SPRINT 3.4: CREW ASSIGNMENT ════════════════════════
function openCrewAssign(){
  const medics=S.force.filter(f=>getMedicLevel(f.role)>0);
  const cas=S.casualties.filter(c=>c.priority!=='T4');
  let html=`<div style="max-width:430px;margin:0 auto;padding:16px">
    <div style="display:flex;align-items:center;margin-bottom:12px;gap:8px">
      <div style="font-size:18px;font-weight:900;flex:1">👥 שיבוץ צוות רפואי</div>
      <button class="btn btn-ghost btn-sm" onclick="$('crew-overlay').style.display='none'">✕</button>
    </div>`;
  if(!medics.length){html+=`<div style="font-size:11px;color:var(--red3);padding:20px;text-align:center">⚠ אין גורמי רפואה בכוח</div>`;}
  else{
    medics.forEach(m=>{
      const assigned=cas.filter(c=>c.medic===m.name);
      const load=assigned.length;
      const loadClr=load>2?'var(--red3)':load>1?'var(--amber3)':'var(--green3)';
      html+=`<div style="background:var(--s2);border:1px solid var(--b0);border-radius:8px;padding:10px 12px;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <div style="font-size:13px;font-weight:700">${escHTML(m.name)}</div>
          <span style="font-size:9px;color:var(--olive3)">${escHTML(m.role)}</span>
          <span style="font-size:10px;color:${loadClr};margin-right:auto;font-weight:700">${load} פגועים</span>
          ${load>2?'<span style="font-size:9px;color:var(--red3);font-weight:700">⚠ עומס</span>':''}
        </div>
        ${assigned.length?assigned.map(c=>`<div style="font-size:10px;color:var(--muted2);padding:2px 0">• ${escHTML(c.name)} (${c.priority})</div>`).join(''):'<div style="font-size:10px;color:var(--muted)">ללא שיבוץ</div>'}
      </div>`;
    });
  }
  html+=`</div>`;
  $('crew-overlay').innerHTML=html;
  $('crew-overlay').style.display='block';
}

// ═══ EXTEND setView for commander view ═══════════════════
const _origSetView=setView;
setView=function(v){
  if(v==='commander'){
    S.view=v;
    $('cas-list').style.display='';
    $('board-view').style.display='none';
    $('medic-view').style.display='none';
    renderCommanderView();
    return;
  }
  _origSetView(v);
};

// ═══ HOOK: after startMission, render role bar ══════════
const _origDoStart=_doStartMission;
_doStartMission=function(){
  _origDoStart();
  renderRoleActionBar();
  updateEvacBadge();
};

// ═══ HOOK: add Pre-Mission Briefing to sc-prep ══════════
function openPreMissionBrief(){
  const checks=[
    {label:'HELO תדר אומת',ok:!!S.comms.helo},
    {label:'LZ1 סומנה',ok:!!S.comms.lz1},
    {label:'LZ2 סומנה (גיבוי)',ok:!!S.comms.lz2},
    {label:'Blood Bank roster מלא',ok:S.force.filter(f=>f.blood).length>=S.force.length*0.8},
    {label:'רוסטר כוח (≥3)',ok:S.force.length>=3},
    {label:'תדר קשר מוגדר',ok:!!S.comms.mahup},
    {label:'ציוד TQ בכוח',ok:S.force.some(f=>f.equip&&f.equip.includes('TQ'))},
  ];
  const done=checks.filter(c=>c.ok).length;
  openModal('📋 תדריך טרום-משימה',`<div class="pad col" style="gap:6px">
    <div style="font-size:13px;color:var(--olive3);font-weight:700;text-align:center">${done}/${checks.length} מוכן</div>
    ${checks.map(c=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:${c.ok?'rgba(40,130,40,.08)':'rgba(200,40,40,.08)'};border:1px solid ${c.ok?'var(--green2)':'var(--red2)'};border-radius:6px">
      <span style="font-size:14px">${c.ok?'✅':'❌'}</span>
      <span style="font-size:12px;color:var(--muted2)">${c.label}</span>
    </div>`).join('')}
    <button class="btn btn-lg btn-ghost btn-full" onclick="forceClose()" style="margin-top:4px">סגור</button>
  </div>`);
}

// ═══ HERO SCORE — Overall mission grade ══════════════════
function updateHeroScore(){
  const v=$('hero-score-val'),s=$('hero-score-sub');
  if(!v||!s) return;
  if(!S.missionStart||!S.casualties.length){
    v.textContent='—'; s.textContent='הפעל אר"ן כדי לראות ביצועים';
    v.style.color='var(--olive3)'; return;
  }
  let score=100;
  const cas=S.casualties;
  // -10 for each unrecorded casualty
  cas.forEach(c=>{if(!c.kg||!c.blood) score-=10;});
  // -15 for each T1 without TXA
  cas.filter(c=>c.priority==='T1').forEach(c=>{
    if(!c.txList||!c.txList.some(t=>t.type&&t.type.includes('TXA'))) score-=15;
  });
  // -5 for TQ>45min
  cas.filter(c=>c.tqStart).forEach(c=>{
    const m=Math.floor((Date.now()-c.tqStart)/60000);
    if(m>45) score-=10; else if(m>30) score-=5;
  });
  // -5 for each casualty without treatment
  cas.forEach(c=>{if(!c.txList||c.txList.length===0) score-=5;});
  score=Math.max(0,Math.min(100,score));
  const grade=score>=90?'A':score>=75?'B':score>=60?'C':score>=40?'D':'F';
  const clr=score>=75?'var(--green3)':score>=50?'var(--amber3)':'var(--red3)';
  v.textContent=grade;v.style.color=clr;
  s.textContent=`ציון: ${score}/100 — ${cas.length} פגועים, ${Math.floor((Date.now()-S.missionStart)/60000)} דקות`;
}

// ═══ TIMELINE SYNC — render into inline container ════════
const _origRenderTimeline=typeof renderTimeline==='function'?renderTimeline:null;
if(_origRenderTimeline){
  renderTimeline=function(){
    _origRenderTimeline();
    setTimeout(()=>{
      const src=$('timeline-list');
      const dst=$('timeline-list-inline');
      if(src&&dst) dst.innerHTML=src.innerHTML;
    },50);
  };
}

// ═══ HOOK renderStats to update hero ═════════════════════
const _origRenderStats2=typeof renderStats==='function'?renderStats:null;
if(_origRenderStats2){
  renderStats=function(){
    _origRenderStats2();
    updateHeroScore();
  };
}

console.log('✓ BENAM Enhancements loaded');

// ═══ TOOLS MENU — replaces old toggleWRMore ═══════════
function openToolsMenu(){
  const el=$('tools-menu');
  if(el) el.style.display='flex';
}
function closeToolsMenu(){
  const el=$('tools-menu');
  if(el) el.style.display='none';
}
// Keep old toggleWRMore as fallback (some code may still call it)
function toggleWRMore(){openToolsMenu();}

// ═══ SYNC BLOOD BANK TO INLINE ═══════════════════════
// After original renderBloodScreen runs, copy to inline div
const _origRenderBlood = typeof renderBloodScreen === 'function' ? renderBloodScreen : null;
if(_origRenderBlood){
  renderBloodScreen = function(){
    _origRenderBlood();
    // Sync content from original blood elements to inline copies
    setTimeout(()=>{
      const srcBtns=$('blood-recip-btns');
      const dstBtns=$('blood-recip-btns-inline');
      if(srcBtns && dstBtns) dstBtns.insertAdjacentHTML('afterbegin',((dstBtns.textContent=''),srcBtns.innerHTML));
      const dstBtnsStats=$('blood-recip-btns-stats');
      if(srcBtns && dstBtnsStats) dstBtnsStats.insertAdjacentHTML('afterbegin',((dstBtnsStats.textContent=''),srcBtns.innerHTML));
      const srcAlloc=$('med-alloc');
      const dstAlloc=$('med-alloc-inline');
      if(srcAlloc && dstAlloc) dstAlloc.insertAdjacentHTML('afterbegin',((dstAlloc.textContent=''),srcAlloc.innerHTML));
      const dstAllocStats=$('med-alloc-stats');
      if(srcAlloc && dstAllocStats) dstAllocStats.insertAdjacentHTML('afterbegin',((dstAllocStats.textContent=''),srcAlloc.innerHTML));
      const srcEvac=$('evac-priority-list');
      const dstEvac=$('evac-priority-inline');
      if(srcEvac && dstEvac) dstEvac.insertAdjacentHTML('afterbegin',((dstEvac.textContent=''),srcEvac.innerHTML));
      const dstEvacStats=$('evac-priority-stats');
      if(srcEvac && dstEvacStats) dstEvacStats.insertAdjacentHTML('afterbegin',((dstEvacStats.textContent=''),srcEvac.innerHTML));
    },100);
  };
}

// ═══ BIGGER NAV STYLES ═══════════════════════════════
(function upgradeNav(){
  const style=document.createElement('style');
  style.textContent=`
    .nav-btn{ padding:10px 2px; gap:3px; }
    .nav-btn .ni{ font-size:24px; }
    .nav-btn .nl{ font-size:9px; font-weight:800; letter-spacing:.06em; }
    #bottomnav{ min-height:60px; }
  `;
  document.head.appendChild(style);
})();
