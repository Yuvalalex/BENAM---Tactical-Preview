// ═══════════════════════════════════════════════════════════
// BENAM ENHANCEMENTS — Sprint 1-4 Features
// ═══════════════════════════════════════════════════════════

// ── NEW STATE FIELDS ──────────────────────────────────────
if(!S.commsLog) S.commsLog=[];
if(!S.lzStatus) S.lzStatus={lz1:{status:'standby',responsible:''},lz2:{status:'standby',responsible:''}};
if(!S.medicAssignment) S.medicAssignment={};

// ═══ FIRE MODE: Chest Seal action ═══════════════════════
function fireChestSeal(){
  const c=getFireTarget();if(!c) return;
  c.txList.push({type:'Chest Seal',time:nowTime(),dose:'Asherman'});
  if(!c.march) c.march={M:0,A:0,R:0,C:0,H:0};
  c.march.R=Math.max(c.march.R,1);
  addTL(c.id,c.name,'Chest Seal הונח','green');
  showToast(`🫁 Chest Seal → ${c.name}`);
  renderWarRoom();saveState();
}

// ═══ FIRE: Show per-casualty pills at top ════════════════
let _fireCasSelected=null;
function updateFireCasTop(){
  const el=$('fire-cas-selector-top');if(!el) return;
  if(!S.casualties.length){
    el.innerHTML='<div style="font-size:11px;color:var(--muted)">אין פגועים — הוסף ⊕ קודם</div>';
    return;
  }
  const sorted=[...S.casualties].sort((a,b)=>prioN(a.priority)-prioN(b.priority));
  el.innerHTML=sorted.map(c=>{
    const sel=_fireCasSelected==c.id;
    return `<button style="padding:4px 8px;border-radius:5px;border:1px solid ${sel?'#fff':pClr(c.priority)};background:${sel?pClr(c.priority):'transparent'};color:${sel?'#fff':pClr(c.priority)};font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font)" onclick="_fireCasSelected=${c.id};updateFireCasTop()">${c.priority} ${escHTML(c.name)}</button>`;
  }).join('');
}
// Override getFireTarget to use our top selector
const _origGetFire=typeof getFireTarget==='function'?getFireTarget:null;
getFireTarget=function(){
  if(_fireCasSelected) return S.casualties.find(x=>x.id==_fireCasSelected)||null;
  if(_origGetFire) return _origGetFire();
  if(S.casualties.length===1) return S.casualties[0];
  return null;
};
// Update fire selector when switching to fire screen
const _origGoScreen=goScreen;
goScreen=function(id){
  _origGoScreen(id);
  if(id==='sc-fire'){ updateFireCasTop(); runAIAdvisor(); }
};

// ═══════════════════════════════════════════════════════════
// 🤖 AI ADVISOR — OFFLINE DECISION ENGINE
// ═══════════════════════════════════════════════════════════
// Rule-based engine that analyzes all casualties and generates
// prioritized recommendations. Runs 100% on-device.

const AI_TACTICAL_PROFILE={
  thresholds:{
    tqWatchMin:30,
    tqDangerMin:45,
    tqCriticalMin:60,
    txaAdvisorDelayMin:5,
    txaActionDelayMin:3,
    t2DeteriorationMin:30,
    noTreatmentMin:10,
    hypothermiaAlertMin:15,
    nineLineMissingMin:20,
    goldenHourWarnMin:50,
    goldenHourCriticalMin:60,
    casPerMedicWarn:3,
    maxVisibleAlerts:8
  },
  scores:{
    assignMedicT1:98,
    autoBalance:72,
    tqCritical:100,
    tqNow:95,
    txaNow:80,
    airwayNow:70,
    hypothermia:40,
    nineLineData:30,
    casevacGoldenHour:90
  }
};

function _getMedicCoverageSnapshot(){
  const medics=(S.force||[]).filter(f=>f&&getMedicLevel&&getMedicLevel(f.role)>0);
  const active=(S.casualties||[]).filter(c=>c&&c.priority!=='T4');
  const unassigned=active.filter(c=>!c.medic);
  const unassignedT1=unassigned.filter(c=>c.priority==='T1');

  let overloaded=[];
  if(typeof buildMedicLoadMap==='function'&&typeof medicCapacity==='function'){
    const loadMap=buildMedicLoadMap(active,medics);
    overloaded=medics.filter(m=>(loadMap[m.name]||0)>=medicCapacity(m));
  }
  return {medics,active,unassigned,unassignedT1,overloaded};
}

function runAIAdvisor(){
  const cfg=AI_TACTICAL_PROFILE;
  const th=cfg.thresholds;
  const el=$('ai-advisor-content');
  const qs=$('ai-quick-status');
  if(!el) return;
  if(!S.missionActive||!S.casualties.length){
    el.innerHTML='הפעל אר"ן והוסף פגועים לקבלת המלצות';
    if(qs) qs.innerHTML='';
    return;
  }

  const now=Date.now();
  const alerts=[]; // {priority: 1-5 (1=critical), icon, text, color}

  S.casualties.forEach(c=>{
    if(c.priority==='T4') return; // skip expectant
    const m=c.march||{M:0,A:0,R:0,C:0,H:0};
    const mins=c._addedAt?Math.floor((now-c._addedAt)/60000):0;

    // ─── TQ TIME ALERTS ───
    if(c.tqStart){
      const tqMin=Math.floor((now-c.tqStart)/60000);
      if(tqMin>=th.tqCriticalMin) alerts.push({p:1,icon:'🔴',text:`${escHTML(c.name)}: TQ ${tqMin} דק'! סיכון אישמיה חמור — שחרר/בדוק מיידית`,color:'#ff4444'});
      else if(tqMin>=th.tqDangerMin) alerts.push({p:1,icon:'🟠',text:`${escHTML(c.name)}: TQ ${tqMin} דק' — בדוק סיכון עצבי, שקול conversion`,color:'#ff8800'});
      else if(tqMin>=th.tqWatchMin) alerts.push({p:2,icon:'🟡',text:`${escHTML(c.name)}: TQ ${tqMin} דק' — בדוק לחץ + דופק דיסטלי`,color:'#ffcc00'});
    }

    // ─── MISSING MARCH STEPS ───
    const missing=[];
    if(m.M===0 && c.priority==='T1') missing.push('M (דימום)');
    if(m.A===0) missing.push('A (נתיב אוויר)');
    if(m.R===0 && c.mech && c.mech.some(x=>x.includes('פיצוץ')||x.includes('ירי'))) missing.push('R (נשימה)');
    if(m.C===0 && c.priority==='T1') missing.push('C (מחזור)');
    if(m.H===0 && mins>15) missing.push('H (היפותרמיה)');
    if(missing.length>0){
      alerts.push({p:missing.includes('M (דימום)')?1:2,icon:'⚠️',text:`${escHTML(c.name)}: חסר MARCH — ${missing.join(', ')}`,color:'#ffaa44'});
    }

    // ─── TXA REMINDER ───
    const hasTXA=c.txList&&c.txList.some(t=>t.type&&t.type.includes('TXA'));
    if(!hasTXA && c.priority==='T1' && mins>th.txaAdvisorDelayMin){
      const casAge=S.missionStart?(now-S.missionStart)/60000:0;
      if(casAge<=180){
        alerts.push({p:2,icon:'💉',text:`${escHTML(c.name)}: T1 ללא TXA — מתן 1g IV/IO בהקדם`,color:'var(--olive3)'});
      } else {
        alerts.push({p:3,icon:'⏰',text:`${escHTML(c.name)}: חלון TXA (3 שעות) חלף — שקול סיכון/תועלת`,color:'#aa6688'});
      }
    }

    // ─── VITALS-BASED ALERTS ───
    const _pulse=parseInt(c.vitals?.pulse)||0;
    const _spo2=parseInt(c.vitals?.spo2)||0;
    const _gcs=parseInt(c.vitals?.gcs)||15;
    const _rr=parseInt(c.vitals?.rr)||0;
    if(_spo2>0 && _spo2<90 && c.priority!=='T4'){
      alerts.push({p:1,icon:'🫁',text:`${escHTML(c.name)}: SpO2 ${_spo2}% — בדוק נתיב אוויר ונשימה!`,color:'#ff4444'});
    }
    if(_pulse>0 && (_pulse>140||_pulse<50) && c.priority!=='T4'){
      alerts.push({p:1,icon:'💓',text:`${escHTML(c.name)}: דופק ${_pulse} — ${_pulse>140?'טכיקרדיה':'ברדיקרדיה'}, בדוק הלם!`,color:'#ff6644'});
    }
    if(_gcs<9 && c.priority!=='T4'){
      alerts.push({p:1,icon:'🧠',text:`${escHTML(c.name)}: GCS ${_gcs} — שקול הגנת נתיב אוויר`,color:'#ff8844'});
    }
    if(_rr>0 && (_rr>30||_rr<10) && c.priority!=='T4'){
      alerts.push({p:2,icon:'💨',text:`${escHTML(c.name)}: קצב נשימה ${_rr} — ${_rr>30?'טכיפניאה':'ברדיפניאה'}`,color:'#ffaa44'});
    }

    // ─── DETERIORATION RISK ───
    if(c.priority==='T2' && mins>th.t2DeteriorationMin && m.C===0){
      alerts.push({p:2,icon:'📉',text:`${escHTML(c.name)}: T2 > 30 דק' ללא C — סיכון הידרדרות → T1`,color:'#ff6688'});
    }

    // ─── NO TREATMENT ALERT ───
    if((!c.txList||c.txList.length===0) && mins>th.noTreatmentMin){
      alerts.push({p:2,icon:'❗',text:`${escHTML(c.name)}: ${mins} דק' ללא טיפול מתועד`,color:'#ff8888'});
    }

    // ─── 9-LINE READINESS ───
    if(mins>th.nineLineMissingMin && (!c.blood||!c.kg||!c.name)){
      alerts.push({p:3,icon:'📋',text:`${escHTML(c.name)}: חסר נתונים ל-9LINE (${!c.blood?'דם ':''}${!c.kg?'משקל ':''}${!c.name?'שם':''})`,color:'#aaaacc'});
    }
  });

  // ─── GOLDEN HOUR ───
  if(S.missionStart){
    const ghMin=Math.floor((now-S.missionStart)/60000);
    if(ghMin>=th.goldenHourWarnMin && ghMin<th.goldenHourCriticalMin){
      alerts.push({p:1,icon:'⏰',text:`Golden Hour: ${Math.max(0,60-ghMin)} דקות נותרו! — פנה פגועי T1 עכשיו`,color:'#ff4444'});
    } else if(ghMin>=th.goldenHourCriticalMin){
      alerts.push({p:1,icon:'🔴',text:`Golden Hour חלף (${ghMin} דקות) — פינוי דחוף`,color:'#ff2222'});
    }
  }

  // ─── RATIO CHECK ───
  const medics=S.force.filter(f=>getMedicLevel&&getMedicLevel(f.role)>0).length;
  const activeCas=S.casualties.filter(c=>c.priority!=='T4').length;
  if(medics>0 && activeCas>medics*th.casPerMedicWarn){
    alerts.push({p:2,icon:'👥',text:`עומס: ${activeCas} פגועים / ${medics} גורמי רפואה — בקש תגבור`,color:'#ffaa88'});
  }

  // ─── MEDIC COVERAGE QUALITY ───
  const cov=_getMedicCoverageSnapshot();
  if(cov.unassignedT1.length){
    const names=cov.unassignedT1.slice(0,2).map(c=>escHTML(c.name)).join(', ');
    alerts.push({p:1,icon:'🩺',text:`T1 ללא מטפל: ${names}${cov.unassignedT1.length>2?'...':''}`,color:'#ff6666'});
  }
  if(cov.unassigned.length && cov.unassignedT1.length===0){
    alerts.push({p:2,icon:'🧷',text:`${cov.unassigned.length} פצועים ללא מטפל — הפעל Auto Balance`,color:'#ffb266'});
  }
  if(cov.overloaded.length){
    alerts.push({p:2,icon:'↔️',text:`עומס מטפלים: ${cov.overloaded.length} בעומס מלא — בצע Reassign`,color:'#ff9a7a'});
  }

  // Sort by priority
  alerts.sort((a,b)=>a.p-b.p);

  // Render
  if(alerts.length===0){
    el.innerHTML='<div style="color:#66dd88">✅ כל הפגועים מטופלים — אין התראות דחופות</div>';
  } else {
    el.innerHTML=alerts.slice(0,th.maxVisibleAlerts).map(a=>
      `<div style="display:flex;align-items:flex-start;gap:6px;padding:3px 0;border-bottom:1px solid rgba(30,50,80,.5)">
        <span style="font-size:12px;flex-shrink:0">${a.icon}</span>
        <span style="color:${a.color};font-size:10px;line-height:1.4">${a.text}</span>
      </div>`
    ).join('');
    if(alerts.length>th.maxVisibleAlerts) el.innerHTML+=`<div style="font-size:9px;color:#335588;margin-top:4px;text-align:center">+ ${alerts.length-th.maxVisibleAlerts} התראות נוספות</div>`;
  }

  // ─── EVAC ORDER RECOMMENDATION ───
  const activeCasEvac=S.casualties.filter(c=>c.priority!=='T4');
  if(activeCasEvac.length){
    const ranked=[...activeCasEvac].sort((a,b)=>calcEvacScore(b)-calcEvacScore(a));
    const evacHtml=ranked.map((c,i)=>{
      const sc=calcEvacScore(c);
      const reasons=[];
      if(c.priority==='T1') reasons.push('T1');
      if(c.tqStart){const tm=Math.floor((now-c.tqStart)/60000); if(tm>15) reasons.push(`TQ ${tm}′`);}
      const gcs=parseInt(c.vitals.gcs)||15;
      if(gcs<=8) reasons.push('GCS≤8');
      const spo2=parseInt(c.vitals.spo2)||98;
      if(spo2<90) reasons.push('SpO2<90');
      if(!c.txList.length) reasons.push('ללא טיפול');
      const clr=i===0?'var(--red3)':i===1?'var(--amber3)':'var(--muted2)';
      const evType=c.evacType?` ${c.evacType==='מוסק'?'🚁':'🚗'}${c.evacType}`:'';
      return `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid rgba(30,50,80,.3)">
        <span style="font-family:var(--font-mono);font-size:14px;font-weight:700;color:${clr};min-width:18px">${i+1}</span>
        <span class="prio pt${c.priority[1]}" style="font-size:8px">${c.priority}</span>
        <span style="font-size:10px;font-weight:700;flex:1">${escHTML(c.name)}</span>
        <span style="font-size:8px;color:var(--muted2)">${reasons.join(' · ')}${evType}</span>
        <span style="font-size:8px;color:var(--olive3);font-family:var(--font-mono)">${sc}</span>
      </div>`;
    }).join('');
    el.innerHTML+=`<div style="margin-top:8px;background:var(--s2);border:1px solid var(--b0);border-radius:8px;padding:8px 10px">
      <div style="font-size:9px;color:var(--muted);letter-spacing:.1em;margin-bottom:4px">🚁 סדר פינוי מומלץ</div>
      ${evacHtml}
    </div>`;
  }

  // ─── MEDIC ALLOCATION RECOMMENDATION ───
  const medicsAI=S.force.filter(f=>getMedicLevel(f.role)>0)
    .sort((a,b)=>getMedicLevel(b.role)-getMedicLevel(a.role));
  if(medicsAI.length && activeCasEvac.length){
    const sortedCas=[...activeCasEvac].sort((a,b)=>prioN(a.priority)-prioN(b.priority));
    const allocHtml=sortedCas.map((c,i)=>{
      const medic=medicsAI[i%medicsAI.length];
      const already=c.medic;
      const match=already===medic.name;
      return `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid rgba(30,50,80,.3)">
        <span class="prio pt${c.priority[1]}" style="font-size:8px">${c.priority}</span>
        <span style="font-size:10px;font-weight:700;flex:1">${escHTML(c.name)}</span>
        <span style="font-size:9px">←</span>
        <span style="font-size:10px;color:${match?'var(--green3)':'var(--olive3)'};font-weight:700">${escHTML(medic.name)}</span>
        <span style="font-size:8px;color:var(--muted)">${escHTML(medic.role)}</span>
        ${already && !match?`<span style="font-size:8px;color:var(--amber3)">(כרגע: ${escHTML(already)})</span>`:''}
        ${match?'<span style="font-size:9px">✓</span>':''}
      </div>`;
    }).join('');
    const freeMs=medicsAI.length>sortedCas.length?medicsAI.slice(sortedCas.length).map(m=>`${escHTML(m.name)} (${escHTML(m.role)})`).join(', '):'';
    el.innerHTML+=`<div style="margin-top:8px;background:var(--s2);border:1px solid var(--b0);border-radius:8px;padding:8px 10px">
      <div style="font-size:9px;color:var(--muted);letter-spacing:.1em;margin-bottom:4px">🩺 חלוקת גורמי טיפול מומלצת</div>
      ${allocHtml}
      ${freeMs?`<div style="font-size:9px;color:var(--olive3);margin-top:4px">זמינים: ${freeMs}</div>`:''}
    </div>`;
  } else if(!medicsAI.length && activeCasEvac.length){
    el.innerHTML+=`<div style="margin-top:6px;font-size:10px;color:var(--red3)">⚠️ אין גורמי רפואה בכוח — הוסף לוחמים עם תפקיד רפואי</div>`;
  }

  // ─── Quick Status — compact MARCH dots per casualty ───
  if(qs){
    const sorted=[...S.casualties].filter(c=>c.priority!=='T4').sort((a,b)=>prioN(a.priority)-prioN(b.priority));
    if(sorted.length){
      qs.innerHTML=`<div style="background:var(--s2);border:1px solid var(--b0);border-radius:8px;padding:8px 10px">
        <div style="font-size:8px;color:var(--muted);letter-spacing:.1em;margin-bottom:6px">📊 סטטוס MARCH — כל הפגועים</div>
        ${sorted.map(c=>{
          const m=c.march||{M:0,A:0,R:0,C:0,H:0};
          const dots=['M','A','R','C','H'].map(k=>{
            const v=m[k]||0;
            const clr=v>=2?'#44dd44':v===1?'#ddaa00':'#dd4444';
            return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${clr};margin:0 1px" title="${k}:${v}"></span>`;
          }).join('');
          return `<div style="display:flex;align-items:center;gap:6px;padding:2px 0">
            <span class="prio pt${c.priority[1]}" style="font-size:8px">${c.priority}</span>
            <span style="font-size:10px;font-weight:700;min-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHTML(c.name)}</span>
            <span>${dots}</span>
            ${c.tqStart?`<span style="font-size:8px;color:var(--red3)">TQ:${Math.floor((now-c.tqStart)/60000)}m</span>`:''}
          </div>`;
        }).join('')}
      </div>`;
    } else { qs.innerHTML=''; }
  }
}

// Run AI advisor every 3 seconds when Fire screen is active
setInterval(()=>{
  if(document.hidden) return;
  const fireScreen=$('sc-fire');
  if(fireScreen && fireScreen.classList.contains('active')){
    runAIAdvisor();
    updateNextBestAction();
    updateDoseCalc();
    updateTreatmentTracker();
    updateSmartTimers();
    updateRadioScript();
  }
},3000);

// ═══════════════════════════════════════════════════════════
// 🚨 QUICK ADD CASUALTY — one-tap from Fire mode
// ═══════════════════════════════════════════════════════════
function addCasualty(c) {
  S.casualties.push(c);
  saveState();
}

function quickAddCas(){
  const n=S.casualties.length+1;
  const name='פגוע '+n;
  const c={
    id:Date.now(),
    name:name,
    idNum:'',
    priority:'T1',
    mech:[],
    blood:'',
    kg:70,
    allergy:'',
    time:nowTime(),
    tqStart:null,
    txList:[],
    injuries:[],
    photos:[],
    vitals:{pulse:'',spo2:'',bp:'',rr:'',gcs:'15',upva:'U'},
    fluids:[],
    fluidTotal:0,
    march:{M:0,A:0,R:0,C:0,H:0},
    vitalsHistory:[],
    _addedAt:Date.now(),
    notes:'',
    evacType:'',medic:'',buddyName:''
  };
  addCasualty(c);
  _fireCasSelected=c.id;
  if(typeof renderWarRoom==='function') renderWarRoom();
  updateFireCasTop();
  runAIAdvisor();
  showToast(`🚨 ${name} נוסף — T1`);
  addTL(c.id,name,'פגוע חדש נוסף (Fire)','red');
}

// ═══════════════════════════════════════════════════════════
// ⏱ SMART TIMERS — all critical countdowns
// ═══════════════════════════════════════════════════════════
function updateSmartTimers(){
  const el=$('ai-timers-panel');if(!el) return;
  if(!S.missionActive){el.innerHTML='';return;}
  const now=Date.now();
  const timers=[];

  // Golden Hour
  if(S.missionStart){
    const elapsed=Math.floor((now-S.missionStart)/1000);
    const total=3600;
    const remain=Math.max(0,total-elapsed);
    const pct=Math.min(100,Math.round((elapsed/total)*100));
    const mm=Math.floor(remain/60);const ss=remain%60;
    const clr=pct>=90?'#ff2222':pct>=75?'#ff8800':pct>=50?'#ffcc00':'var(--green3)';
    timers.push({label:'⏱ Golden Hour',time:`${mm}:${String(ss).padStart(2,'0')}`,pct,clr,warn:pct>=75});
  }

  // TQ timers
  S.casualties.forEach(c=>{
    if(c.tqStart){
      const mins=Math.floor((now-c.tqStart)/60000);
      const secs=Math.floor(((now-c.tqStart)%60000)/1000);
      const pct=Math.min(100,Math.round((mins/120)*100));
      const clr=mins>=60?'#ff2222':mins>=45?'#ff8800':mins>=30?'#ffcc00':'var(--green3)';
      timers.push({label:`🩹 TQ ${escHTML(c.name)}`,time:`${mins}:${String(secs).padStart(2,'0')}`,pct,clr,warn:mins>=30});
    }
  });

  if(!timers.length){el.innerHTML='';return;}
  el.innerHTML=`<div style="background:var(--s2);border:1px solid var(--b0);border-radius:8px;padding:8px 10px">
    <div style="font-size:8px;color:var(--muted);letter-spacing:.1em;margin-bottom:4px">⏱ ACTIVE TIMERS</div>
    ${timers.map(t=>`<div style="margin-bottom:4px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:9px;color:${t.clr};font-weight:700">${t.label}</span>
        <span style="font-size:14px;font-weight:900;font-family:var(--font-mono);color:${t.clr}">${t.time}</span>
      </div>
      <div style="height:4px;background:var(--s1);border-radius:2px;overflow:hidden;margin-top:2px">
        <div style="height:100%;width:${t.pct}%;background:${t.clr};border-radius:2px;transition:width .5s"></div>
      </div>
    </div>`).join('')}
  </div>`;
}

// ═══════════════════════════════════════════════════════════
// 📻 AUTO RADIO SCRIPT — CASEVAC message generator
// ═══════════════════════════════════════════════════════════
function updateRadioScript(){
  const el=$('ai-radio-script');if(!el) return;
  if(!_fireCasSelected||!S.missionActive){el.innerHTML='';return;}
  const c=S.casualties.find(x=>x.id==_fireCasSelected);
  if(!c){el.innerHTML='';return;}
  const unit=$('p-unit')?$('p-unit').value||'—':'—';
  const lz=$('p-lz1')?$('p-lz1').value||'LZ1':'LZ1';
  const freq=$('p-helo')?$('p-helo').value||'—':'—';
  const blood=c.blood||'לא ידוע';
  const kg=c.kg||'—';
  const mins=c._addedAt?Math.floor((Date.now()-c._addedAt)/60000):0;
  const txDone=(c.txList||[]).map(t=>t.type).join(', ')||'אין';
  const script=`שלום, כאן ${escHTML(unit)}.
מבקש פינוי ${c.priority} מ-${escHTML(lz)}.
פגוע: ${escHTML(c.name)}, ${escHTML(blood)}, ${kg}kg.
מנגנון: ${(c.mech||[]).map(m=>escHTML(m)).join(', ')||'לא ידוע'}.
טיפול שניתן: ${escHTML(txDone)}.
זמן מפציעה: ${mins} דקות.
תדר: ${escHTML(freq)}. שלכם.`;

  el.innerHTML=`<div style="background:var(--s1);border:1px solid var(--blue2);border-radius:8px;padding:8px 10px">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      <span style="font-size:12px">📻</span>
      <span style="font-size:9px;font-weight:900;color:var(--olive3);letter-spacing:.08em;flex:1">AUTO RADIO — ${escHTML(c.name)}</span>
      <button class="btn btn-xs btn-ghost" onclick="navigator.clipboard.writeText(document.getElementById('radio-script-text').textContent);showToast('📋 הועתק!')" style="font-size:9px;padding:1px 6px;color:var(--olive3);border-color:var(--blue2)">📋 העתק</button>
    </div>
    <div id="radio-script-text" style="font-size:10px;color:var(--muted2);line-height:1.5;font-family:var(--font-mono);white-space:pre-wrap;background:var(--s1);border-radius:4px;padding:6px">${script}</div>
  </div>`;
}


// ═══════════════════════════════════════════════════════════
// 🎯 NEXT BEST ACTION ENGINE
// ═══════════════════════════════════════════════════════════
let _nextAction=null;
function updateNextBestAction(){
  const el=$('ai-next-action');if(!el) return;
  if(!S.missionActive||!S.casualties.length){el.style.display='none';return;}
  const cfg=AI_TACTICAL_PROFILE;
  const th=cfg.thresholds;
  const sc=cfg.scores;
  const now=Date.now();
  const actions=[]; // {score, icon, text, sub, fn}

  const cov=_getMedicCoverageSnapshot();
  if(cov.unassignedT1.length){
    const c=cov.unassignedT1[0];
    actions.push({
      score:sc.assignMedicT1,
      icon:'🩺',
      text:`שייך מטפל → ${escHTML(c.name)}`,
      sub:'T1 ללא מטפל',
      fn:()=>{ if(typeof openMedicAllocView==='function') openMedicAllocView(); }
    });
  } else if(cov.unassigned.length){
    actions.push({
      score:sc.autoBalance,
      icon:'⚡',
      text:'Auto Balance — שיבוץ מטפלים',
      sub:`${cov.unassigned.length} ללא מטפל`,
      fn:()=>{ if(typeof autoBalanceMedicAllocation==='function') autoBalanceMedicAllocation(); }
    });
  }

  S.casualties.forEach(c=>{
    if(c.priority==='T4') return;
    const m=c.march||{M:0,A:0,R:0,C:0,H:0};
    const mins=c._addedAt?Math.floor((now-c._addedAt)/60000):0;

    // TQ critical
    if(c.tqStart){
      const tqM=Math.floor((now-c.tqStart)/60000);
      if(tqM>=th.tqDangerMin) actions.push({score:sc.tqCritical,icon:'🩹',text:`בדוק TQ → ${escHTML(c.name)}`,sub:`${tqM} דק' — סיכון עצבי!`,fn:()=>{_fireCasSelected=c.id;updateFireCasTop();jumpToCas(c.id);}});
    }
    // T1 without TQ
    if(c.priority==='T1' && m.M===0 && !c.tqStart){
      actions.push({score:sc.tqNow,icon:'🩹',text:`TQ → ${escHTML(c.name)}`,sub:'T1 ללא חסם דימום',fn:()=>{_fireCasSelected=c.id;updateFireCasTop();fireTQ();}});
    }
    // T1 without TXA
    const hasTXA=c.txList&&c.txList.some(t=>t.type&&t.type.includes('TXA'));
    if(c.priority==='T1' && !hasTXA && mins>th.txaActionDelayMin){
      actions.push({score:sc.txaNow,icon:'💉',text:`TXA 1g → ${escHTML(c.name)}`,sub:'T1 ללא TXA',fn:()=>{_fireCasSelected=c.id;updateFireCasTop();fireTXA();}});
    }
    // Airway not done
    if(m.A===0 && c.priority!=='T3'){
      actions.push({score:sc.airwayNow,icon:'💨',text:`בדוק נתיב אוויר → ${escHTML(c.name)}`,sub:'A לא הושלם',fn:()=>{_fireCasSelected=c.id;updateFireCasTop();fireAirway();}});
    }
    // Hypothermia not addressed
    if(m.H===0 && mins>th.hypothermiaAlertMin){
      actions.push({score:sc.hypothermia,icon:'🌡',text:`מנע היפותרמיה → ${escHTML(c.name)}`,sub:`${mins} דק' ללא H`,fn:()=>{_fireCasSelected=c.id;updateFireCasTop();jumpToCas(c.id);}});
    }
    // No data for 9-LINE
    if(mins>th.nineLineMissingMin && (!c.blood||!c.kg)){
      actions.push({score:sc.nineLineData,icon:'📋',text:`השלם נתוני 9-LINE → ${escHTML(c.name)}`,sub:'חסר דם / משקל',fn:()=>{_fireCasSelected=c.id;jumpToCas(c.id);}});
    }
  });

  // Golden Hour CASEVAC
  if(S.missionStart){
    const ghM=Math.floor((now-S.missionStart)/60000);
    if(ghM>=th.goldenHourWarnMin){
      const t1=S.casualties.filter(c=>c.priority==='T1');
      if(t1.length) actions.push({score:sc.casevacGoldenHour,icon:'🚁',text:'CASEVAC — פנה T1 עכשיו!',sub:`Golden Hour: ${Math.max(0,60-ghM)} דק'`,fn:()=>{fireCasevac();}});
    }
  }

  actions.sort((a,b)=>b.score-a.score);
  if(!actions.length){el.style.display='none';_nextAction=null;_updateNttComboNBA();return;}
  _nextAction=actions[0];
  el.style.display='block';
  $('ai-next-icon').textContent=_nextAction.icon;
  $('ai-next-text').textContent=_nextAction.text;
  $('ai-next-sub').textContent=_nextAction.sub;
  _updateNttComboNBA();
}
// [REMOVED] NTT combo banner removed from UI
function _updateNttComboNBA(){}
function executeNextAction(){
  if(_nextAction && _nextAction.fn){
    _nextAction.fn();
    showToast(`🎯 ${_nextAction.text}`);
    setTimeout(()=>{updateNextBestAction();runAIAdvisor();},500);
  }
}

// ═══════════════════════════════════════════════════════════
// 💊 AUTO DOSE CALCULATOR
// ═══════════════════════════════════════════════════════════
function updateDoseCalc(){
  const el=$('ai-dose-calc');if(!el) return;
  if(!_fireCasSelected){el.innerHTML='';return;}
  const c=S.casualties.find(x=>x.id==_fireCasSelected);
  if(!c){el.innerHTML='';return;}
  const kg=c.kg||70; // default 70kg
  const doses=[
    {name:'TXA',dose:`${Math.min(2000,1000)} mg`,route:'IV/IO',note:'מתן איטי 10 דק\'',icon:'💉'},
    {name:'Ketamine',dose:`${Math.round(kg*0.5)} mg`,route:`IV / ${Math.round(kg*2)} mg IM`,note:`0.5mg/kg (${kg}kg)`,icon:'💊'},
    {name:'Morphine',dose:`${Math.round(kg*0.1*10)/10} mg`,route:'IV/IO',note:`0.1mg/kg — רק אם SBP>90`,icon:'💊'},
    {name:'NaCl 0.9%',dose:'500 ml',route:'IV/IO',note:'בולוס → בדוק דופק',icon:'💧'},
    {name:'Amoxicillin',dose:'500 mg',route:'PO',note:'אנטיביוטיקה — פצעים פתוחים',icon:'💊'},
  ];
  el.innerHTML=`<div style="background:var(--s2);border:1px solid var(--b0);border-radius:8px;padding:8px 10px">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:12px">💊</span>
      <span style="font-size:10px;font-weight:900;color:var(--olive3)">מינונים — ${escHTML(c.name)} (${kg}kg)</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
      ${doses.map(d=>`<div style="background:var(--s1);border:1px solid var(--b0);border-radius:5px;padding:5px 6px">
        <div style="font-size:10px;font-weight:700;color:var(--white)">${d.icon} ${d.name}</div>
        <div style="font-size:12px;font-weight:900;color:var(--olive3)">${d.dose}</div>
        <div style="font-size:8px;color:var(--muted)">${d.note}</div>
      </div>`).join('')}
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════
// 📝 TREATMENT TRACKER — per-casualty MARCH completion
// ═══════════════════════════════════════════════════════════
function updateTreatmentTracker(){
  const el=$('ai-treatment-tracker');if(!el) return;
  if(!_fireCasSelected){el.innerHTML='';return;}
  const c=S.casualties.find(x=>x.id==_fireCasSelected);
  if(!c){el.innerHTML='';return;}
  const m=c.march||{M:0,A:0,R:0,C:0,H:0};
  const steps=[
    {k:'M',label:'דימום מסיבי',icon:'🩹',actions:['TQ','לחץ ישיר','Gauze']},
    {k:'A',label:'נתיב אוויר',icon:'💨',actions:['Head tilt','NPA','Cric']},
    {k:'R',label:'נשימה',icon:'🫁',actions:['Chest Seal','Needle Decompression']},
    {k:'C',label:'מחזור דם',icon:'❤️',actions:['IV/IO','NaCl','TXA']},
    {k:'H',label:'היפותרמיה',icon:'🌡',actions:['Blizzard Bag','בידוד']},
  ];
  const txLog=c.txList||[];
  el.innerHTML=`<div style="background:var(--s2);border:1px solid var(--b0);border-radius:8px;padding:8px 10px">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:12px">📝</span>
      <span style="font-size:10px;font-weight:900;color:var(--olive3)">MARCH Tracker — ${escHTML(c.name)}</span>
      <span style="font-size:9px;color:var(--muted);margin-right:auto">${['M','A','R','C','H'].filter(k=>m[k]>=2).length}/5</span>
    </div>
    ${steps.map(s=>{
      const v=m[s.k]||0;
      const clr=v>=2?'var(--green3)':v===1?'var(--amber3)':'var(--red3)';
      const bg=v>=2?'rgba(40,130,40,.1)':v===1?'rgba(200,150,0,.1)':'rgba(200,40,40,.06)';
      const icon=v>=2?'✅':v===1?'⏳':'❌';
      return `<div style="display:flex;align-items:center;gap:6px;padding:5px 6px;background:${bg};border:1px solid ${clr};border-radius:5px;margin-bottom:3px;cursor:pointer" onclick="markMARCH(${c.id},'${s.k}')">
        <span style="font-size:14px">${icon}</span>
        <span style="font-size:12px;font-weight:700;color:${clr};min-width:18px">${s.k}</span>
        <span style="font-size:10px;color:var(--muted2);flex:1">${s.label}</span>
        <span style="font-size:8px;color:var(--muted)">${v>=2?'הושלם':v===1?'חלקי':'לחץ ✓'}</span>
      </div>`;
    }).join('')}
    ${txLog.length?`<div style="margin-top:6px;font-size:8px;color:var(--muted);border-top:1px solid var(--b0);padding-top:4px">
      📋 טיפולים: ${txLog.slice(-5).map(t=>`${t.type}(${t.time})`).join(' · ')}
    </div>`:''} 
  </div>`;
}

// Quick mark MARCH step as done
function markMARCH(casId,step){
  const c=S.casualties.find(x=>x.id==casId);if(!c) return;
  if(!c.march) c.march={M:0,A:0,R:0,C:0,H:0};
  c.march[step]=c.march[step]>=2?0:c.march[step]+1; // cycle: 0→1→2→0
  saveState();
  showToast(`${step}: ${c.march[step]>=2?'✅ הושלם':c.march[step]===1?'⏳ חלקי':'❌ ריסט'}`);
  updateTreatmentTracker();
  runAIAdvisor();
}

// ═══ SPRINT 1.1: EVAC READINESS BADGE ═══════════════════
function calcEvacReadiness(c){
  const checks=[];
  checks.push({k:'9line',label:'9-LINE',ok:!!(c.blood&&c.kg&&c.name)});
  checks.push({k:'blood',label:'דם',ok:!!c.blood});
  const hasTXA=c.txList&&c.txList.some(t=>t.type&&t.type.includes('TXA'));
  checks.push({k:'txa',label:'TXA',ok:hasTXA});
  const tqM=c.tqStart?Math.floor((Date.now()-c.tqStart)/60000):null;
  checks.push({k:'tq',label:'TQ',ok:tqM===null||tqM<60,warn:tqM!==null&&tqM>=60});
  checks.push({k:'f101',label:'טופס 101',ok:!!(c.kg&&c.blood&&c.name&&c.idNum)});
  const hasIV=c.txList&&c.txList.some(t=>t.type&&(t.type.includes('IV')||t.type.includes('IO')));
  checks.push({k:'iv',label:'IV/IO',ok:hasIV||c.priority==='T3'});
  checks.push({k:'heat',label:'חום',ok:c.march&&c.march.H>0});
  checks.push({k:'handoff',label:'Handoff',ok:!!(c.kg&&c.blood)});
  return checks;
}

function getEvacScore(c){
  const ch=calcEvacReadiness(c);
  return {done:ch.filter(x=>x.ok).length,total:ch.length,checks:ch};
}

function updateEvacBadge(){
  const badge=$('evac-badge');if(!badge) return;
  if(!S.missionActive||!S.casualties.length){badge.style.display='none';return;}
  const active=S.casualties.filter(c=>c.priority!=='T4');
  if(!active.length){badge.style.display='none';return;}
  const ready=active.filter(c=>{const s=getEvacScore(c);return s.done>=s.total-1;}).length;
  badge.style.display='flex';
  const textEl=$('evac-badge-text');
  const timerEl=$('evac-badge-timer');
  if(textEl) textEl.textContent=`🚁 ${ready}/${active.length}`;
  else badge.textContent=`🚁 ${ready}/${active.length}`;
  // Show evac countdown timer in badge using S_evac tracker
  if(timerEl && S_evac && S_evac.heliETA && S_evac.heliSetAt){
    const elapsed = Math.floor((Date.now() - S_evac.heliSetAt) / 1000);
    const remainingSecs = S_evac.heliETA * 60 - elapsed;
    if(remainingSecs > 0){
      const m = Math.floor(remainingSecs / 60);
      const s = remainingSecs % 60;
      timerEl.textContent = `⏱${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      timerEl.style.display = '';
    } else {
      timerEl.textContent = '🚁 מגיע!';
      timerEl.style.display = '';
    }
  } else if(timerEl){
    timerEl.style.display = 'none';
  }
  badge.className='evac-badge '+(ready>=active.length*0.6?'evac-ok':ready>0?'evac-warn':'evac-crit');
}
setInterval(()=>{ if(!document.hidden) updateEvacBadge(); },5000);

// ═══ SPRINT 1.2: COMMANDER ROW VIEW ═════════════════════
function buildCommanderRow(c){
  const m=c.march||{M:0,A:0,R:0,C:0,H:0};
  const marchStr=['M','A','R','C','H'].map(k=>{
    const v=m[k]||0;
    return v>=2?`<span style="color:var(--green3)">${k}✓</span>`:
           v===1?`<span style="color:var(--amber3)">${k}?</span>`:
           `<span style="color:var(--red3)">${k}✗</span>`;
  }).join('');
  const tqM=c.tqStart?Math.floor((Date.now()-c.tqStart)/60000):null;
  const tqStr=tqM!==null?`<span style="color:${tqM>45?'var(--red3)':tqM>30?'var(--amber3)':'var(--olive3)'}">TQ:${tqM}m</span>`:'—';
  const es=getEvacScore(c);
  const evacStr=es.done>=es.total-1?
    `<span style="color:var(--green3)">✅ מוכן</span>`:
    `<span style="color:var(--amber3)">⏳ ${es.total-es.done} חסר</span>`;
  return `<div class="cmd-row ct${c.priority[1]}" onclick="jumpToCas(${c.id})">
    <span class="prio pt${c.priority[1]}" style="font-size:10px;flex-shrink:0">${c.priority}</span>
    <span style="font-weight:700;font-size:12px;min-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHTML(c.name)}</span>
    <span style="font-size:9px;font-family:var(--font-mono);letter-spacing:1px">${marchStr}</span>
    <span style="font-size:10px;min-width:45px;text-align:center">${tqStr}</span>
    <span style="font-size:9px;text-align:left">${evacStr}</span>
  </div>`;
}

function renderCommanderView(){
  const list=$('cas-list');if(!list) return;
  const sorted=[...S.casualties].sort((a,b)=>prioN(a.priority)-prioN(b.priority));
  if(!sorted.length) return;
  list.innerHTML=`<div style="display:flex;flex-direction:column;gap:3px;padding:0 6px">
    ${sorted.map(c=>buildCommanderRow(c)).join('')}
  </div>`;
}

// ═══ SPRINT 1.3: EVAC PACKAGE SCREEN ════════════════════
function openEvacPackage(casId){
  const c=casId?S.casualties.find(x=>x.id==casId):null;
  const list=S.casualties.filter(x=>x.priority!=='T4');
  let html=`<div style="padding:12px">
    <div style="display:flex;align-items:center;margin-bottom:12px;gap:10px">
      <div style="font-size:18px;font-weight:900;flex:1">📦 Evac Package</div>
      <button class="btn btn-ghost btn-sm" onclick="$('evac-pkg-overlay').style.display='none'">✕</button>
    </div>`;
  if(!c){
    html+=`<div style="font-size:11px;color:var(--muted);margin-bottom:10px">בחר פגוע:</div>
      <div style="display:flex;flex-direction:column;gap:5px">
      ${list.map(x=>`<button class="btn btn-lg btn-ghost btn-full" onclick="openEvacPackage(${x.id})" style="justify-content:flex-start;gap:8px;border-color:${pClr(x.priority)}">
        <span class="prio pt${x.priority[1]}">${x.priority}</span> ${escHTML(x.name)}
      </button>`).join('')}
      </div>`;
  } else {
    const es=getEvacScore(c);
    const pct=Math.round(es.done/es.total*100);
    const clr=pct>=80?'var(--green3)':pct>=50?'var(--amber3)':'var(--red3)';
    html+=`<div style="background:var(--s2);border:1px solid var(--b1);border-radius:10px;padding:12px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span class="prio pt${c.priority[1]}">${c.priority}</span>
        <span style="font-size:15px;font-weight:900">${escHTML(c.name)}</span>
        <span class="tag tag-blood">${escHTML(c.blood||'?')}</span>
      </div>
      <div style="font-size:28px;font-weight:900;color:${clr};text-align:center;margin:8px 0">${es.done}/${es.total}</div>
      <div style="height:6px;background:var(--s3);border-radius:3px;overflow:hidden;margin-bottom:8px">
        <div style="height:100%;width:${pct}%;background:${clr};border-radius:3px;transition:width .3s"></div>
      </div>
      <div style="font-size:11px;color:var(--muted2);text-align:center">${pct>=80?'כמעט מוכן לפינוי':'חסרים פריטים — השלם למטה'}</div>
    </div>`;
    html+=`<div style="display:flex;flex-direction:column;gap:5px">`;
    es.checks.forEach(ch=>{
      const icon=ch.ok?'✅':'❌';
      const bg=ch.ok?'rgba(40,130,40,.08)':'rgba(200,40,40,.08)';
      const border=ch.ok?'var(--green2)':'var(--red2)';
      html+=`<div style="background:${bg};border:1px solid ${border};border-radius:6px;padding:8px 10px;display:flex;align-items:center;gap:8px">
        <span style="font-size:16px">${icon}</span>
        <span style="font-size:12px;font-weight:700;flex:1">${ch.label}</span>
        <span style="font-size:10px;color:var(--muted2)">${ch.ok?'מוכן':'חסר'}</span>
      </div>`;
    });
    html+=`</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px">
      <button class="btn btn-md btn-olive btn-full" onclick="$('evac-pkg-overlay').style.display='none';openRadioTemplates()">📻 שדר 9-LINE</button>
      <button class="btn btn-md btn-ghost btn-full" onclick="$('evac-pkg-overlay').style.display='none';openForm101()">📄 טופס 101</button>
    </div>
    <button class="btn btn-md btn-ghost btn-full" style="margin-top:6px;border-color:var(--olive3);color:var(--olive3)" onclick="openEvacPackage()">◀ חזור לרשימה</button>`;
  }
  html+=`</div>`;
  $('evac-pkg-overlay').innerHTML=html;
  $('evac-pkg-overlay').style.display='block';
}

// ═══ SPRINT 2.1: SABCDE OVERLAY ═════════════════════════
const SABCDE_DATA={
  S:{title:'Safety — בטיחות',icon:'🛡',steps:[
    {q:'בטיחות שדה מאובטחת?',yes:'המשך ל-A',no:'אבטח שטח → נייח פגוע → נשק בטוח'},
    {q:'נשק פגוע מאובטח?',yes:'המשך',no:'אבטח נשק'}
  ]},
  A:{title:'Airway — נתיב אוויר',icon:'💨',steps:[
    {q:'נשימה ספונטנית?',yes:'בדוק איכות',no:'Head tilt + Jaw thrust → NPA'},
    {q:'חסם בנתיב?',yes:'שאיבה → NPA / Cric',no:'המשך ל-B'}
  ]},
  B:{title:'Breathing — נשימה',icon:'🫁',steps:[
    {q:'קצב נשימה 12-20?',yes:'תקין',no:'בדוק חזה → Asherman / Needle Decompression'},
    {q:'חשד לחזה מתח?',yes:'Needle 2ICS MCL + Asherman',no:'המשך ל-C'}
  ]},
  C:{title:'Circulation — מחזור',icon:'❤️',steps:[
    {q:'דופק מלא וסדיר?',yes:'המשך',no:'IV/IO NaCl 500ml + TXA'},
    {q:'דימום פעיל?',yes:'TQ / לחץ ישיר / Gauze',no:'המשך ל-D'}
  ]},
  D:{title:'Disability — הכרה',icon:'🧠',steps:[
    {q:'GCS > 12?',yes:'תקין',no:'בדוק אישונים → הגן על ראש'},
    {q:'UPVA — תגובה?',yes:'A=Alert → המשך',no:'U=Unresponsive → נטר צמוד'}
  ]},
  E:{title:'Exposure — חשיפה',icon:'🌡',steps:[
    {q:'פציעות נסתרות?',yes:'גלה → טפל → כסה',no:'Blizzard Bag'},
    {q:'טמפ׳ > 35°?',yes:'תקין',no:'מנע היפותרמיה → בידוד מקרקע'}
  ]}
};

function openSABCDE(casId){
  const c=casId?S.casualties.find(x=>x.id==casId):null;
  let html=`<div style="max-width:430px;margin:0 auto;padding:16px">
    <div style="display:flex;align-items:center;margin-bottom:12px;gap:8px">
      <div style="font-size:18px;font-weight:900;flex:1">🏥 SABCDE — פרוטוקול IDF</div>
      <button class="btn btn-ghost btn-sm" onclick="$('sabcde-overlay').style.display='none'">✕</button>
    </div>
    ${c?`<div style="font-size:12px;color:var(--olive3);margin-bottom:10px">פגוע: <b>${escHTML(c.name)}</b></div>`:''}`;
  Object.entries(SABCDE_DATA).forEach(([k,phase])=>{
    html+=`<div style="background:var(--s2);border:1px solid var(--b0);border-radius:8px;padding:10px 12px;margin-bottom:8px">
      <div style="font-size:13px;font-weight:900;color:var(--olive3);margin-bottom:6px">${phase.icon} ${phase.title}</div>
      ${phase.steps.map(s=>`
        <div style="font-size:11px;color:var(--muted2);margin-bottom:4px;padding:4px 0;border-bottom:1px solid var(--b0)">
          <div style="font-weight:700;color:var(--white);margin-bottom:2px">${s.q}</div>
          <div><span style="color:var(--green3)">✓ כן:</span> ${s.yes}</div>
          <div><span style="color:var(--red3)">✗ לא:</span> ${s.no}</div>
        </div>`).join('')}
    </div>`;
  });
  html+=`</div>`;
  $('sabcde-overlay').innerHTML=html;
  $('sabcde-overlay').style.display='block';
}

// ═══ SPRINT 2.2: תול ארן OVERLAY ════════════════════════
const TOLARN_PHASES=[
  {id:'cuf',title:'שלב 1: CUF — Care Under Fire',icon:'🔥',color:'var(--red2)',
   steps:['נייח פגוע מאש','TQ מיידי על דימום מסיבי','הסתר / משוך פגוע לכיסוי','אל תטפל בנתיב אוויר תחת אש','דווח במ\"ק: "פגוע!" + כמות']},
  {id:'tfc',title:'שלב 2: TFC — Tactical Field Care',icon:'🩹',color:'var(--amber)',
   steps:['MARCH מלא — שלב אחר שלב','TQ — בדוק/הדק 2 אצבעות מעל פצע','נתיב אוויר — NPA + Head tilt','נשימה — Asherman + Needle Decompression','מחזור — IV/IO + TXA 1g','היפותרמיה — Blizzard Bag','GCS + כאב — קטמין/מורפין (SBP>80)','טופס 101 — מלא והכן']},
  {id:'tacevac',title:'שלב 3: TACEVAC — Transfer',icon:'🚁',color:'var(--green2)',
   steps:['9-LINE MEDEVAC — הכן ושדר','LZ — אבטח ווסמן','סלוט פינוי — שבץ פגוע','Handoff — העבר מידע לצו"ר','נסור מחדש TQ + ויטלים','צילום/QR — גיבוי נתונים','אשר מוכנות פינוי']}
];

function openTolArn(){
  let html=`<div style="max-width:430px;margin:0 auto;padding:16px">
    <div style="display:flex;align-items:center;margin-bottom:14px;gap:8px">
      <div style="font-size:18px;font-weight:900;flex:1">⚡ תול אר"ן — IDF ARN</div>
      <button class="btn btn-ghost btn-sm" onclick="$('tolarn-overlay').style.display='none'">✕</button>
    </div>`;
  TOLARN_PHASES.forEach(ph=>{
    html+=`<div style="background:var(--s2);border:1px solid ${ph.color};border-radius:10px;padding:12px;margin-bottom:10px">
      <div style="font-size:14px;font-weight:900;color:${ph.color};margin-bottom:8px">${ph.icon} ${ph.title}</div>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${ph.steps.map((s,i)=>`<div style="display:flex;align-items:flex-start;gap:6px;padding:4px 0;border-bottom:1px solid var(--b0)">
          <div style="width:18px;height:18px;border-radius:50%;border:2px solid var(--b1);display:flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0;cursor:pointer;color:var(--muted)" onclick="this.textContent=this.textContent==='✓'?'':'✓';this.style.background=this.textContent==='✓'?'var(--green2)':'';this.style.borderColor=this.textContent==='✓'?'var(--green3)':'var(--b1)';this.style.color=this.textContent==='✓'?'#fff':'var(--muted)'"></div>
          <div style="font-size:12px;color:var(--muted2)">${s}</div>
        </div>`).join('')}
      </div>
    </div>`;
  });
  html+=`</div>`;
  $('tolarn-overlay').innerHTML=html;
  $('tolarn-overlay').style.display='block';
}

// ═══ SPRINT 2.3: ROLE-BASED ACTION BARS ═════════════════
function renderRoleActionBar(){
  // Disabled — always keep the default wr-actions bar (with tools strip)
  return;
}

// ═══ SPRINT 3.1: PFC OVERLAY ════════════════════════════
function openPFC(){
  let html=`<div style="max-width:430px;margin:0 auto;padding:16px">
    <div style="display:flex;align-items:center;margin-bottom:12px;gap:8px">
      <div style="font-size:18px;font-weight:900;flex:1">🕐 PFC — Prolonged Field Care</div>
      <button class="btn btn-ghost btn-sm" onclick="$('pfc-overlay').style.display='none'">✕</button>
    </div>
    <div style="font-size:11px;color:var(--amber3);margin-bottom:10px;font-weight:700">⚠ פינוי מעוכב — טיפול שדה ממושך</div>`;
  const pfc=[
    {icon:'📊',title:'ניטור ויטלים',desc:'כל 15 דקות: דופק, SpO2, BP, RR, GCS, טמפרטורה'},
    {icon:'💊',title:'Sedation / כאב',desc:'קטמין 0.5mg/kg IV | מידזולם 0.05mg/kg | מורפין 0.1mg/kg'},
    {icon:'🌡',title:'מניעת היפותרמיה',desc:'Blizzard Bag + בידוד מקרקע + נוזלים חמים (אם זמין)'},
    {icon:'💬',title:'בדיקת הכרה',desc:'שאלות: שם? תאריך? מה קרה? — כל 15 דקות'},
    {icon:'💧',title:'Fluid Balance',desc:'מעקב נוזלים IN/OUT + שתן (יעד >0.5ml/kg/h)'},
    {icon:'🔄',title:'TQ Rotation',desc:'בדוק TQ כל 30 דקות — שחרר אם אפשר + בדוק דימום'},
    {icon:'🚁',title:'Trigger לפינוי',desc:'GCS יורד | SpO2<90 | דופק>130 | הידרדרות מתועדת → הפעל CASEVAC'}
  ];
  pfc.forEach(p=>{
    html+=`<div style="background:var(--s2);border:1px solid var(--b0);border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;gap:10px;align-items:flex-start">
      <div style="font-size:20px;flex-shrink:0">${p.icon}</div>
      <div><div style="font-size:12px;font-weight:700;color:var(--white)">${p.title}</div>
      <div style="font-size:10px;color:var(--muted2);margin-top:2px">${p.desc}</div></div>
    </div>`;
  });
  html+=`</div>`;
  $('pfc-overlay').innerHTML=html;
  $('pfc-overlay').style.display='block';
}

// ═══ SPRINT 4.1: CRUSH SYNDROME OVERLAY ═════════════════
function openCrush(){
  const html=`<div style="max-width:430px;margin:0 auto;padding:16px">
    <div style="display:flex;align-items:center;margin-bottom:12px;gap:8px">
      <div style="font-size:18px;font-weight:900;flex:1">🏗 Crush Syndrome</div>
      <button class="btn btn-ghost btn-sm" onclick="$('crush-overlay').style.display='none'">✕</button>
    </div>
    <div style="background:rgba(200,40,40,.1);border:1px solid var(--red2);border-radius:8px;padding:10px;margin-bottom:10px;font-size:11px;color:var(--red3);font-weight:700">⚠ לפני שחרור — חובה נוזלים IV!</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      <div class="protocol-step">🔍 <b>אבחון:</b> לכודים >1h, כאב בגפיים, CK גבוה, דם בשתן</div>
      <div class="protocol-step">💧 <b>נוזלים:</b> NaCl 1-1.5L/שעה — לפני שחרור!</div>
      <div class="protocol-step">⏱ <b>מעקב שתן:</b> יעד >200ml/h</div>
      <div class="protocol-step">🩹 <b>TQ:</b> הנח לפני שחרור גפה לכודה</div>
      <div class="protocol-step">❤️ <b>ECG:</b> סיכון הפרעת קצב (היפרקלמיה)</div>
      <div class="protocol-step">🚁 <b>פינוי:</b> מיידי — דיאליזה בביה"ח</div>
    </div>
  </div>`;
  $('crush-overlay').innerHTML=html;
  $('crush-overlay').style.display='block';
}

// ═══ SPRINT 4.2: BLAST/IED OVERLAY ══════════════════════
function openBlast(){
  const html=`<div style="max-width:430px;margin:0 auto;padding:16px">
    <div style="display:flex;align-items:center;margin-bottom:12px;gap:8px">
      <div style="font-size:18px;font-weight:900;flex:1">💥 Blast / IED — פיצוץ</div>
      <button class="btn btn-ghost btn-sm" onclick="$('blast-overlay').style.display='none'">✕</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="background:rgba(200,40,40,.08);border:1px solid var(--red2);border-radius:8px;padding:10px">
        <div style="font-size:12px;font-weight:900;color:var(--red3);margin-bottom:4px">Primary Blast</div>
        <div style="font-size:11px;color:var(--muted2)">TM (אזניים) + ריאות (blast lung) + מעיים — בדוק דימום פנימי</div>
      </div>
      <div style="background:rgba(200,130,0,.08);border:1px solid var(--amber);border-radius:8px;padding:10px">
        <div style="font-size:12px;font-weight:900;color:var(--amber3);margin-bottom:4px">Secondary Blast</div>
        <div style="font-size:11px;color:var(--muted2)">שברים + רסיסים + פצעי חדירה — TQ + Chest Seal</div>
      </div>
      <div style="background:rgba(200,130,0,.06);border:1px solid var(--b1);border-radius:8px;padding:10px">
        <div style="font-size:12px;font-weight:900;color:var(--amber3);margin-bottom:4px">Tertiary Blast</div>
        <div style="font-size:11px;color:var(--muted2)">Polytrauma — מכת גוף מלאה — MARCH מלא</div>
      </div>
      <div style="background:rgba(200,60,0,.08);border:1px solid var(--orange2);border-radius:8px;padding:10px">
        <div style="font-size:12px;font-weight:900;color:var(--orange2);margin-bottom:4px">Burns / כוויות</div>
        <div style="font-size:11px;color:var(--muted2)">TBSA% — כף יד = 1% — נוזלים Parkland: 4ml × kg × %TBSA</div>
      </div>
      <div class="protocol-step" style="font-weight:700;color:var(--red3)">צעד ראשון: TQ שני גפיים + Chest Seal דו-צדדי</div>
    </div>
  </div>`;
  $('blast-overlay').innerHTML=html;
  $('blast-overlay').style.display='block';
}

// ═══ SPRINT 4.3: HYPOTHERMIA OVERLAY ════════════════════
function openHypothermia(){
  const html=`<div style="max-width:430px;margin:0 auto;padding:16px">
    <div style="display:flex;align-items:center;margin-bottom:12px;gap:8px">
      <div style="font-size:18px;font-weight:900;flex:1">🌡 Hypothermia Prevention</div>
      <button class="btn btn-ghost btn-sm" onclick="$('hypother-overlay').style.display='none'">✕</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
      <div class="protocol-step">🔍 <b>זיהוי:</b> טמפ' < 35°C | עור קר + רטוב | רעד | בלבול</div>
      <div class="protocol-step">🛏 <b>בידוד:</b> Blizzard Bag + בידוד מהקרקע (פד / מזרן)</div>
      <div class="protocol-step">🧤 <b>הסר:</b> בגדים רטובים — החלף ליבש</div>
      <div class="protocol-step">💧 <b>נוזלים:</b> חמים אם זמין — לא ישירות על העור</div>
      <div class="protocol-step">❌ <b>אל:</b> אל תחמם מהר — סיכון VF</div>
      <div class="protocol-step">🎯 <b>יעד:</b> טמפ' > 36°C לפני פינוי</div>
      <div class="protocol-step">🚁 <b>פינוי:</b> אם < 32°C — פינוי מיידי לביה"ח</div>
    </div>
  </div>`;
  $('hypother-overlay').innerHTML=html;
  $('hypother-overlay').style.display='block';
}

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

// ═══ PREP SCREEN: Dynamic GO button ═══════════════════
function updatePrepScreen(){
  const btn=$('start-btn');if(!btn) return;
  if(S.missionActive){
    btn.textContent='⚔ אר"ן פעיל ✓';
    btn.style.background='var(--olive)';
    btn.style.boxShadow='0 4px 20px rgba(74,107,41,.3)';
    btn.onclick=function(){goScreen('sc-war');setNav(1);};
  } else {
    btn.textContent='⚡ התחל אר"ן';
    btn.style.background='';
    btn.style.boxShadow='0 4px 20px rgba(200,40,40,.3)';
    btn.onclick=function(){startMission();};
  }
}
// Check every 2 seconds (skip when app backgrounded)
setInterval(()=>{ if(!document.hidden) updatePrepScreen(); },2000);
setTimeout(updatePrepScreen,300);

// ═══════════════════════════════════════════════════════════
// 🔒 PIN LOCK SYSTEM — 4 digit PIN, offline, hashed
// ═══════════════════════════════════════════════════════════
let _pinBuffer='';
let _pinAttempts=parseInt(localStorage.getItem('benam_pin_attempts')||'0');
let _lastActivity=Date.now();

// Improved hash — PBKDF2-like multiple rounds (still offline, no deps)
function hashPin(pin){
  let h=5381;
  for(let round=0;round<100;round++){
    for(let i=0;i<pin.length;i++){h=((h<<5)+h+round)^pin.charCodeAt(i);h|=0;}
  }
  return 'pin2_'+Math.abs(h).toString(36);
}

function pinInput(n){
  // Check time-based lockout
  const lockUntil=parseInt(localStorage.getItem('benam_pin_lockout')||'0');
  if(Date.now()<lockUntil){
    const remaining=Math.ceil((lockUntil-Date.now())/1000);
    const err=document.getElementById('pin-error');
    if(err) err.textContent=`PIN נעול — נסה שוב עוד ${remaining} שניות`;
    return;
  }
  if(_pinBuffer.length>=4) return;
  _pinBuffer+=n;
  haptic(10);
  const dots=document.querySelectorAll('.pin-dot');
  dots.forEach((d,i)=>{d.classList.toggle('filled',i<_pinBuffer.length);});
  if(_pinBuffer.length===4){
    setTimeout(pinCheck,200);
  }
}
function pinClear(){
  _pinBuffer=_pinBuffer.slice(0,-1);
  const dots=document.querySelectorAll('.pin-dot');
  dots.forEach((d,i)=>{d.classList.toggle('filled',i<_pinBuffer.length);});
}
function pinCheck(){
  // Check time-based lockout
  const lockUntil=parseInt(localStorage.getItem('benam_pin_lockout')||'0');
  if(Date.now()<lockUntil){
    const remaining=Math.ceil((lockUntil-Date.now())/1000);
    const err=document.getElementById('pin-error');
    if(err) err.textContent=`PIN נעול — נסה שוב עוד ${remaining} שניות`;
    _pinBuffer='';
    document.querySelectorAll('.pin-dot').forEach(d=>d.classList.remove('filled'));
    return;
  }
  const stored=localStorage.getItem('benam_pin');
  if(!stored){
    // No PIN set — first time, save this one
    localStorage.setItem('benam_pin',hashPin(_pinBuffer));
    pinUnlock();
    showToast('🔒 PIN נשמר');
  } else if(hashPin(_pinBuffer)===stored){
    // Correct PIN — reset attempts
    _pinAttempts=0;
    localStorage.setItem('benam_pin_attempts','0');
    localStorage.removeItem('benam_pin_lockout');
    pinUnlock();
  } else {
    _pinAttempts++;
    localStorage.setItem('benam_pin_attempts',String(_pinAttempts));
    const err=document.getElementById('pin-error');
    if(err) err.textContent=`PIN שגוי (${_pinAttempts}/5)`;
    _pinBuffer='';
    document.querySelectorAll('.pin-dot').forEach(d=>d.classList.remove('filled'));
    haptic(200);
    playAlert('error');
    if(_pinAttempts>=5){
      // Lock for 60 seconds (persistent across reload)
      localStorage.setItem('benam_pin_lockout',String(Date.now()+60000));
      if(err) err.textContent='נעילה — נסה שוב עוד 60 שניות';
    }
  }
}
function pinSkip(){
  // Only allow skip in training mode
  if(S.opMode==='training'){pinUnlock();return;}
  showToast('⚠ דילוג על PIN אפשרי רק במצב אימון');
}
function pinUnlock(){
  const el=document.getElementById('pin-lock');
  if(el) el.style.display='none';
  _pinBuffer='';
  _lastActivity=Date.now();
  document.querySelectorAll('.pin-dot').forEach(d=>d.classList.remove('filled'));
}
function pinSetup(){
  const current=localStorage.getItem('benam_pin');
  if(current){
    localStorage.removeItem('benam_pin');
    const err=document.getElementById('pin-error');
    if(err) err.textContent='PIN אופס — הזן PIN חדש';
    _pinBuffer='';
    document.querySelectorAll('.pin-dot').forEach(d=>d.classList.remove('filled'));
  }
}
function showPinLock(){
  const el=document.getElementById('pin-lock');
  if(el){
    el.style.display='flex';
    _pinBuffer='';
    document.querySelectorAll('.pin-dot').forEach(d=>d.classList.remove('filled'));
    const err=document.getElementById('pin-error');
    if(err) err.textContent='';
  }
}

// Show PIN lock on startup if PIN exists
(function initPinLock(){
  const stored=localStorage.getItem('benam_pin');
  if(stored) showPinLock();
})();

// Auto-lock after 5 min idle
document.addEventListener('touchstart',()=>{_lastActivity=Date.now();});
document.addEventListener('click',()=>{_lastActivity=Date.now();});
setInterval(()=>{
  const stored=localStorage.getItem('benam_pin');
  if(stored && Date.now()-_lastActivity>300000){
    showPinLock();
  }
},30000);

// ═══════════════════════════════════════════════════════════
// 🌙 NIGHT VISION MODE — accessible via topbar menu only
// ═══════════════════════════════════════════════════════════
// Restore NV state on load (no floating button)
(function initNV(){
  if(localStorage.getItem('benam_nv')==='1'){
    document.body.classList.add('night-vision');
  }
})();

// ═══════════════════════════════════════════════════════════
// 🔊 SOUND ALERTS — oscillator-based, no external files
// ═══════════════════════════════════════════════════════════
let _audioCtx=null;
function getAudioCtx(){
  if(!_audioCtx) _audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  return _audioCtx;
}
function playAlert(type){
  try{
    const ctx=getAudioCtx();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    switch(type){
      case 'tq-warning':
        osc.frequency.value=800;gain.gain.value=0.3;
        osc.start();osc.stop(ctx.currentTime+0.15);
        setTimeout(()=>{const o2=ctx.createOscillator();const g2=ctx.createGain();o2.connect(g2);g2.connect(ctx.destination);o2.frequency.value=800;g2.gain.value=0.3;o2.start();o2.stop(ctx.currentTime+0.15);},200);
        break;
      case 'tq-critical':
        osc.frequency.value=1200;gain.gain.value=0.4;
        osc.start();osc.stop(ctx.currentTime+0.3);
        setTimeout(()=>{const o2=ctx.createOscillator();const g2=ctx.createGain();o2.connect(g2);g2.connect(ctx.destination);o2.frequency.value=1400;g2.gain.value=0.4;o2.start();o2.stop(ctx.currentTime+0.3);},350);
        break;
      case 'casevac':
        osc.frequency.value=600;osc.type='sawtooth';gain.gain.value=0.3;
        osc.start();osc.stop(ctx.currentTime+0.5);
        break;
      case 'success':
        osc.frequency.value=523;gain.gain.value=0.2;
        osc.start();osc.stop(ctx.currentTime+0.1);
        setTimeout(()=>{const o2=ctx.createOscillator();const g2=ctx.createGain();o2.connect(g2);g2.connect(ctx.destination);o2.frequency.value=659;g2.gain.value=0.2;o2.start();o2.stop(ctx.currentTime+0.1);},120);
        break;
      case 'error':
        osc.frequency.value=200;osc.type='square';gain.gain.value=0.2;
        osc.start();osc.stop(ctx.currentTime+0.2);
        break;
      default: // generic beep
        osc.frequency.value=660;gain.gain.value=0.15;
        osc.start();osc.stop(ctx.currentTime+0.1);
    }
  }catch(e){}
}

// Sound alerts for TQ — check every 10 seconds
let _lastTQAlert=0;
setInterval(()=>{
  if(!S.missionActive||!S.casualties||document.hidden) return;
  const now=Date.now();
  if(now-_lastTQAlert<60000) return; // max 1 alert per minute
  S.casualties.forEach(c=>{
    if(c.tqStart){
      const mins=Math.floor((now-c.tqStart)/60000);
      if(mins>=45&&mins<46){playAlert('tq-critical');haptic(300);_lastTQAlert=now;}
      else if(mins>=30&&mins<31){playAlert('tq-warning');haptic(100);_lastTQAlert=now;}
    }
  });
  // Golden Hour alert
  if(S.missionStart){
    const ghMin=Math.floor((now-S.missionStart)/60000);
    if(ghMin>=55&&ghMin<56){playAlert('tq-critical');haptic(500);_lastTQAlert=now;}
  }
},10000);

// ═══════════════════════════════════════════════════════════
// 📳 HAPTIC FEEDBACK — vibration on critical actions
// ═══════════════════════════════════════════════════════════
function haptic(styleOrMs){
  try{
    if(!navigator.vibrate) return;
    if(typeof styleOrMs === 'number') { navigator.vibrate(styleOrMs||50); return; }
    const patterns = { light:10, medium:25, heavy:[40,30,40], success:[10,50,10], error:[50,30,50,30,50] };
    navigator.vibrate(patterns[styleOrMs] || 20);
  }catch(e){}
}

// Hook haptic into fire buttons
const _origFireTQ=typeof fireTQ==='function'?fireTQ:null;
if(_origFireTQ){fireTQ=function(){haptic(100);playAlert('success');if(_origFireTQ)_origFireTQ();};}
const _origFireCasevac=typeof fireCasevac==='function'?fireCasevac:null;
if(_origFireCasevac){fireCasevac=function(){haptic(200);playAlert('casevac');if(_origFireCasevac)_origFireCasevac();};}

// ═══════════════════════════════════════════════════════════
// 🛡 ERROR BOUNDARIES — catch & log, never crash
// ═══════════════════════════════════════════════════════════
window.addEventListener('error',function(e){
  console.error('BENAM Error:',e.message,e.filename,e.lineno);
  // Don't crash — show toast
  if(typeof showToast==='function') showToast('⚠ שגיאה: '+e.message.substring(0,50));
});
window.addEventListener('unhandledrejection',function(e){
  console.error('BENAM Promise Error:',e.reason);
});

// ═══════════════════════════════════════════════════════════
// 💾 IndexedDB WRAPPER — bigger storage, offline-safe
// ═══════════════════════════════════════════════════════════
const IDB={
  DB_NAME:'benam_db',
  STORE:'state',
  VERSION:1,
  _db:null,
  open(){
    return new Promise((resolve,reject)=>{
      if(this._db){resolve(this._db);return;}
      const req=indexedDB.open(this.DB_NAME,this.VERSION);
      req.onupgradeneeded=e=>{e.target.result.createObjectStore(this.STORE);};
      req.onsuccess=e=>{this._db=e.target.result;resolve(this._db);};
      req.onerror=e=>{reject(e);};
    });
  },
  async save(key,data){
    try{
      const db=await this.open();
      const tx=db.transaction(this.STORE,'readwrite');
      tx.objectStore(this.STORE).put(data,key);
    }catch(e){
      console.warn('[IDB] Primary save failed, attempting localStorage fallback');
      try{
        localStorage.setItem('benam_idb_fallback_'+key,JSON.stringify(data));
      }catch(e2){
        console.error('[IDB] Both storage layers failed:',e,e2);
        if(typeof showToast==='function') showToast('⛔ DATA SAVE FAILED — BOTH STORAGE LAYERS FULL',8000);
      }
    }
  },
  async load(key){
    try{
      const db=await this.open();
      return new Promise((resolve)=>{
        const tx=db.transaction(this.STORE,'readonly');
        const req=tx.objectStore(this.STORE).get(key);
        req.onsuccess=()=>resolve(req.result);
        req.onerror=()=>resolve(null);
      });
    }catch(e){return null;}
  }
};

// Hook saveState to also save to IndexedDB with debounce (300ms)
const _origSaveState=typeof saveState==='function'?saveState:null;
let _idbSaveTimer=null;
if(_origSaveState){
  saveState=function(){
    _origSaveState(); // persist to localStorage immediately
    // Debounced IDB save — prevents race conditions on rapid double-tap
    clearTimeout(_idbSaveTimer);
    _idbSaveTimer=setTimeout(()=>{
      // Build a clean serializable snapshot — exclude timer refs, DOM refs, functions
      const cleanCasualties=(S.casualties||[]).map(c=>{
        const {_vitalTimer,_el,_domRef,...rest}=c;
        return rest;
      });
      const snapshot={
        force:S.force,casualties:cleanCasualties,timeline:S.timeline,
        comms:S.comms,supplies:S.supplies,
        missionStart:S.missionStart,missionActive:S.missionActive,
        role:S.role,opMode:S.opMode,missionType:S.missionType,
        operations:S.operations||[],currentOperationId:S.currentOperationId||null,
        leadership:S.leadership||{},commsLog:S.commsLog||[],
        lzStatus:S.lzStatus||{},medicAssignment:S.medicAssignment||{},
        prefs:S.prefs||{}
      };
      IDB.save('mission_state',snapshot).catch(err=>{
        console.error('[IDB] Save failed:',err);
        // Both IDB and LS may have failed — alert operator
        if(typeof showToast==='function') showToast('⛔ DATA SAVE FAILED — check storage',8000);
      });
    },300);
  };
}

// On boot: try loading from IndexedDB if localStorage is empty
(async function initIDB(){
  try{
    const data=await IDB.load('mission_state');
    if(data && (!S.casualties || S.casualties.length===0) && data.casualties && data.casualties.length>0){
      const defaultVitals={pulse:'',spo2:'',bp:'',rr:'',gcs:'15',upva:'U'};
      data.casualties=(data.casualties||[]).map(c=>({
        vitals:{...defaultVitals,...(c&&c.vitals&&typeof c.vitals==='object'?c.vitals:{})},
        mech:Array.isArray(c?.mech)?c.mech:[],
        injuries:Array.isArray(c?.injuries)?c.injuries:[],
        txList:Array.isArray(c?.txList)?c.txList:[],
        march:{M:0,A:0,R:0,C:0,H:0,...(c?.march||{})},
        ...c
      }));
      Object.assign(S,data);
      if(typeof renderWarRoom==='function') renderWarRoom();
      console.log('✓ Restored from IndexedDB:',data.casualties.length,'casualties');
    }
  }catch(e){console.warn('IDB init fail');}
})();

console.log('✓ P0 Features: PIN Lock, Night Vision, Sound Alerts, Haptic, Error Boundaries, IndexedDB');

// ═══════════════════════════════════════════════════════════
// 🎓 TRAINING MODE — scenarios with auto-scoring
// ═══════════════════════════════════════════════════════════
const SCENARIOS={
  open:{name:'ארן שטח פתוח',casualties:[
    {name:'לוחם א׳',priority:'T1',mech:['ירי ישיר'],blood:'O+',kg:78},
    {name:'לוחם ב׳',priority:'T2',mech:['רסיס'],blood:'A+',kg:85},
    {name:'לוחם ג׳',priority:'T3',mech:['חבלה'],blood:'B+',kg:72}
  ]},
  urban:{name:'ארן עירוני',casualties:[
    {name:'חייל 1',priority:'T1',mech:['פיצוץ','ירי'],blood:'O-',kg:82},
    {name:'חייל 2',priority:'T1',mech:['פיצוץ'],blood:'A+',kg:75},
    {name:'חייל 3',priority:'T2',mech:['ירי ישיר'],blood:'O+',kg:90},
    {name:'חייל 4',priority:'T2',mech:['רסיס'],blood:'B+',kg:68},
    {name:'חייל 5',priority:'T3',mech:['חבלה'],blood:'AB+',kg:77}
  ]},
  pfc:{name:'PFC — טיפול ממושך',casualties:[
    {name:'פצוע א׳',priority:'T1',mech:['ירי ישיר','פיצוץ'],blood:'O+',kg:88},
    {name:'פצוע ב׳',priority:'T1',mech:['קריסת מבנה'],blood:'A-',kg:74}
  ]},
  mass:{name:'Mass Casualty',casualties:[
    {name:'נפגע 1',priority:'T1',mech:['פיצוץ'],blood:'O+',kg:80},
    {name:'נפגע 2',priority:'T1',mech:['פיצוץ'],blood:'A+',kg:75},
    {name:'נפגע 3',priority:'T1',mech:['פיצוץ','ירי'],blood:'O-',kg:82},
    {name:'נפגע 4',priority:'T2',mech:['פיצוץ'],blood:'B+',kg:70},
    {name:'נפגע 5',priority:'T2',mech:['רסיס'],blood:'A+',kg:88},
    {name:'נפגע 6',priority:'T2',mech:['חבלה'],blood:'O+',kg:73},
    {name:'נפגע 7',priority:'T3',mech:['חבלה'],blood:'AB+',kg:90},
    {name:'נפגע 8',priority:'T3',mech:['חבלה'],blood:'B-',kg:65},
    {name:'נפגע 9',priority:'T3',mech:['שריפה'],blood:'A+',kg:77},
    {name:'נפגע 10',priority:'T4',mech:['פיצוץ'],blood:'O+',kg:85}
  ]},
  lms:{name:'LMS — ארב לילי',casualties:[
    {name:'לוחם שקט',priority:'T1',mech:['ירי ישיר'],blood:'O+',kg:84},
    {name:'לוחם צל',priority:'T1',mech:['ירי','רסיס'],blood:'A+',kg:78},
    {name:'לוחם ליל',priority:'T2',mech:['רסיס'],blood:'B+',kg:82},
    {name:'לוחם ירח',priority:'T3',mech:['חבלה'],blood:'O-',kg:70}
  ]}
};

let _trainingStart=null;
let _trainingScenario=null;
let _trainingInterval=null;

function _trainingVitalsByPriority(p){
  if(p==='T1') return {pulse:'126',spo2:'89',bp:'86',rr:'30',gcs:'11',upva:'V'};
  if(p==='T2') return {pulse:'104',spo2:'94',bp:'98',rr:'22',gcs:'14',upva:'V'};
  if(p==='T4') return {pulse:'0',spo2:'0',bp:'0',rr:'0',gcs:'3',upva:'U'};
  return {pulse:'88',spo2:'97',bp:'112',rr:'18',gcs:'15',upva:'A'};
}

function _normalizeTrainingCasualty(c){
  const vitals=c&&c.vitals&&typeof c.vitals==='object'?c.vitals:_trainingVitalsByPriority(c?.priority);
  return {
    id:Date.now()+Math.random()*1000|0,
    name:c?.name||'פצוע',
    priority:c?.priority||'T3',
    mech:Array.isArray(c?.mech)?c.mech:[],
    blood:c?.blood||'',
    kg:c?.kg||70,
    txList:Array.isArray(c?.txList)?c.txList:[],
    injuries:Array.isArray(c?.injuries)?c.injuries:[],
    vitals:{pulse:'',spo2:'',bp:'',rr:'',gcs:'15',upva:'U',...vitals},
    march:{M:0,A:0,R:0,C:0,H:0,...(c?.march||{})},
    _addedAt:Date.now(),
    notes:c?.notes||''
  };
}

function openTraining(){
  $('training-overlay').style.display='block';
  renderTrainingHistory();
}
function closeTraining(){
  $('training-overlay').style.display='none';
}

function startTraining(scenarioKey){
  const sc=SCENARIOS[scenarioKey];if(!sc) return;
  
  // Reset mission state
  if(typeof resetMission==='function'){
    // Save current state first
    const backup=JSON.parse(JSON.stringify(S));
    localStorage.setItem('benam_backup_pre_training',JSON.stringify(backup));
  }
  
  // Clear and setup
  S.casualties=[];
  S.timeline=[];
  S.missionActive=true;
  S.missionStart=Date.now();
  S.trainingMode=true;
  
  // Add scenario casualties
  sc.casualties.forEach(c=>{
    S.casualties.push(_normalizeTrainingCasualty(c));
  });
  
  _trainingStart=Date.now();
  _trainingScenario=scenarioKey;
  
  saveState();
  if(typeof renderWarRoom==='function') renderWarRoom();
  
  // Show active training bar
  $('training-active').style.display='block';
  $('training-scenario-name').textContent=sc.name;
  $('training-scenarios').style.display='none';
  
  // Start timer
  if(_trainingInterval) clearInterval(_trainingInterval);
  _trainingInterval=setInterval(()=>{
    const elapsed=Math.floor((Date.now()-_trainingStart)/1000);
    const mm=Math.floor(elapsed/60);const ss=elapsed%60;
    $('training-timer').textContent=`${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  },1000);
  
  // Close overlay and go to War Room
  closeTraining();
  goScreen('sc-war');setNav(1);
  showToast(`🎓 תרחיש: ${sc.name} — ${sc.casualties.length} פגועים`);
  playAlert('success');
}

function endTraining(){
  if(!_trainingStart) return;
  if(_trainingInterval){clearInterval(_trainingInterval);_trainingInterval=null;}
  
  const elapsed=Math.floor((Date.now()-_trainingStart)/1000);
  const score=calcTrainingScore(elapsed);
  
  // Save score
  const history=JSON.parse(localStorage.getItem('benam_training_history')||'[]');
  history.unshift({
    scenario:_trainingScenario,
    name:SCENARIOS[_trainingScenario]?.name||'—',
    time:elapsed,
    score:score.total,
    grade:score.grade,
    date:new Date().toLocaleDateString('he-IL'),
    details:score
  });
  if(history.length>20) history.length=20;
  localStorage.setItem('benam_training_history',JSON.stringify(history));
  
  // Reset
  S.trainingMode=false;
  _trainingStart=null;
  _trainingScenario=null;
  
  // Show results
  $('training-active').style.display='none';
  $('training-scenarios').style.display='flex';
  renderTrainingHistory();
  
  openTraining();
  showToast(`🏆 ציון: ${score.total}/100 (${score.grade})`);
  playAlert(score.total>=70?'success':'error');
}

function calcTrainingScore(elapsedSec){
  let total=0;
  const cas=S.casualties.filter(c=>c.priority!=='T4');
  const t1=cas.filter(c=>c.priority==='T1');
  
  // Speed (25 pts) — under 10 min = full, over 30 min = 0
  const minUsed=elapsedSec/60;
  const speedScore=Math.max(0,Math.min(25,Math.round(25*(1-Math.max(0,(minUsed-10)/20)))));
  
  // MARCH completion (30 pts) — average across all casualties
  let marchTotal=0;
  cas.forEach(c=>{
    const m=c.march||{M:0,A:0,R:0,C:0,H:0};
    const done=['M','A','R','C','H'].filter(k=>(m[k]||0)>=2).length;
    marchTotal+=done;
  });
  const marchScore=cas.length?Math.round(30*(marchTotal/(cas.length*5))):0;
  
  // TXA on T1 (15 pts)
  let txaScore=0;
  if(t1.length){
    const withTxa=t1.filter(c=>c.txList&&c.txList.some(t=>t.type&&t.type.includes('TXA'))).length;
    txaScore=Math.round(15*(withTxa/t1.length));
  } else txaScore=15;
  
  // Triage accuracy (15 pts) — did they keep correct priorities?
  const triageScore=15; // baseline (would need original vs modified comparison)
  
  // Treatment documented (15 pts)
  let txCount=0;
  cas.forEach(c=>{txCount+=(c.txList||[]).length;});
  const txDocScore=Math.min(15,Math.round(txCount*2));
  
  total=speedScore+marchScore+txaScore+triageScore+txDocScore;
  const grade=total>=90?'A':total>=80?'B':total>=70?'C':total>=50?'D':'F';
  
  return{total,grade,speedScore,marchScore,txaScore,triageScore,txDocScore};
}

function renderTrainingHistory(){
  const el=$('training-history');if(!el) return;
  const history=JSON.parse(localStorage.getItem('benam_training_history')||'[]');
  if(!history.length){el.innerHTML='<div style="color:var(--muted)">אין תוצאות עדיין — בחר תרחיש!</div>';return;}
  el.innerHTML=history.slice(0,8).map(h=>{
    const mm=Math.floor(h.time/60);const ss=h.time%60;
    const gClr=h.grade==='A'?'var(--green3)':h.grade==='B'?'var(--olive3)':h.grade==='C'?'var(--amber3)':'var(--red3)';
    return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--b0)">
      <span style="font-size:18px;font-weight:900;color:${gClr};min-width:24px">${h.grade}</span>
      <span style="font-size:11px;flex:1;color:var(--muted2)">${h.name}</span>
      <span style="font-size:10px;color:var(--muted)">${mm}:${String(ss).padStart(2,'0')}</span>
      <span style="font-size:12px;font-weight:700;color:${gClr}">${h.score}/100</span>
      <span style="font-size:8px;color:var(--muted)">${h.date}</span>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// 🎨 TUTORIAL — first-time user walkthrough
// ═══════════════════════════════════════════════════════════
function openTutorial(){
  const el=$('tutorial-overlay');
  if(el) el.style.display='block';
}
function closeTutorial(){
  const el=$('tutorial-overlay');
  if(el) el.style.display='none';
  const noShow=$('tut-no-show');
  if(noShow&&noShow.checked) localStorage.setItem('benam_tutorial_done','1');
}

// Show tutorial on first visit
(function initTutorial(){
  if(!localStorage.getItem('benam_tutorial_done')){
    setTimeout(()=>{
      const pinLock=$('pin-lock');
      // Only show tutorial if PIN is not blocking
      if(!pinLock||pinLock.style.display==='none'||!localStorage.getItem('benam_pin')){
        openTutorial();
      } else {
        // Show after PIN unlock
        const origUnlock=typeof pinUnlock==='function'?pinUnlock:null;
        pinUnlock=function(){if(origUnlock)origUnlock();setTimeout(openTutorial,500);pinUnlock=origUnlock||pinUnlock;};
      }
    },800);
  }
})();

// ═══════════════════════════════════════════════════════════
// 📄 PDF EXPORT — generate printable AAR report
// ═══════════════════════════════════════════════════════════
function exportPDF(){
  // Generate report content, then trigger print
  if(typeof genReport==='function') genReport();
  if(typeof renderStats==='function') renderStats();
  showToast('🖨️ מכין דוח להדפסה...');
  setTimeout(()=>{window.print();},500);
}

// Also make training accessible from Prep screen training button
const _origStartTraining=typeof startTrainingMode==='function'?startTrainingMode:null;
if(typeof startTrainingMode!=='undefined'){
  startTrainingMode=function(){openTraining();};
} else {
  window.startTrainingMode=function(){openTraining();};
}

console.log('✓ P1 Features: Training Mode, Tutorial, PDF Export');

// ═══════════════════════════════════════════════════════════
// 🚁 EVACUATION ORDER — auto-generated priority list
// ═══════════════════════════════════════════════════════════
function _inferEvacTypeFromVehicle(vehicle){
  const v=(vehicle||'').toLowerCase();
  if(v.includes('helo')||v.includes('heli')||v.includes('מסוק')||v.includes('ינשוף')) return 'helicopter';
  if(v.includes('ambul')||v.includes('אמבול')||v.includes('אט"ן')) return 'ambulance';
  return 'vehicle';
}

function _syncLegacyEvacForceToEvacForces(){
  if(!S.evacForce) return;
  if(!S.evacForces) S.evacForces=[];
  const hasLegacy=!!(S.evacForce.driver||S.evacForce.vehicle||S.evacForce.medic||S.evacForce.guard);
  if(!hasLegacy) return;

  const mapped={
    callsign:S.evacForce.driver||'כוח מפנה',
    type:_inferEvacTypeFromVehicle(S.evacForce.vehicle),
    capacity:4,
    etaMin:0,
    vehicle:S.evacForce.vehicle||'',
    medic:S.evacForce.medic||'',
    guard:S.evacForce.guard||'',
    source:'prep-legacy'
  };

  const legacyIdx=S.evacForces.findIndex(f=>f&&f.source==='prep-legacy');
  if(legacyIdx>=0) S.evacForces[legacyIdx]={...S.evacForces[legacyIdx],...mapped};
  else S.evacForces.unshift(mapped);
}

function renderEvacWarSnapshot(){
  const targets=['evac-war-snapshot','evac-war-snapshot-modal']
    .map(id=>$(id))
    .filter(Boolean);
  if(!targets.length) return;
  _syncLegacyEvacForceToEvacForces();

  const comms=S.comms||{};
  const forces=(S.evacForces||[]);
  const forceCards=forces.length?forces.map((f,idx)=>`
    <div style="background:var(--s2);border:1px solid var(--b0);border-radius:6px;padding:8px 10px;display:flex;align-items:center;gap:8px">
      <span style="font-size:17px">${f.type==='helicopter'?'🚁':f.type==='ambulance'?'🚑':'🚗'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;color:var(--white)">${escHTML(f.callsign||('Evac '+(idx+1)))}</div>
        <div style="font-size:10px;color:var(--muted2)">${escHTML(f.vehicle||'ללא כלי')}${f.medic?' · חובש: '+escHTML(f.medic):''}${f.guard?' · אבטחה: '+escHTML(f.guard):''}</div>
      </div>
      <div style="font-size:10px;color:var(--muted)">ETA ${f.etaMin||0}m</div>
    </div>`).join(''):
    '<div style="font-size:11px;color:var(--muted);padding:8px 0">אין כוחות פינוי מוגדרים</div>';

  const html=`
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">${forceCards}</div>
    <div style="background:var(--s2);border:1px solid var(--b0);border-radius:6px;padding:8px 10px">
      <div style="font-size:10px;color:var(--olive3);font-weight:700;letter-spacing:.08em;margin-bottom:4px">📻 תדרים ו-LZ</div>
      <div style="font-size:11px;color:var(--white)">יחידה: ${comms.unit||'—'} · MAHUP: ${comms.mahup||'—'}</div>
      <div style="font-size:11px;color:var(--white)">HELO: ${comms.helo||'—'} · LZ1: ${comms.lz1||'—'} · LZ2: ${comms.lz2||'—'}</div>
    </div>`;
  targets.forEach(el=>{el.innerHTML=html;});
}

function updateEvacOrder(){
  const el=$('evac-order-list');if(!el) return;
  if(!S.casualties||!S.casualties.length){
    el.innerHTML='<div style="font-size:11px;color:var(--muted);padding:4px 0">הוסף פגועים ← ייוצר סדר פינוי אוטומטי</div>';
    return;
  }
  const sorted=[...S.casualties].sort((a,b)=>prioN(a.priority)-prioN(b.priority));
  el.innerHTML=sorted.map((c,i)=>{
    const prioClr=c.priority==='T1'?'var(--red3)':c.priority==='T2'?'var(--amber3)':c.priority==='T3'?'var(--green3)':'var(--muted)';
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--s2);border:1px solid var(--b0);border-radius:5px">
      <span style="font-size:14px;font-weight:900;color:var(--muted);min-width:20px">${i+1}</span>
      <span class="prio pt${c.priority[1]}" style="font-size:9px">${c.priority}</span>
      <span style="font-size:11px;font-weight:700;flex:1;color:${prioClr}">${escHTML(c.name)}</span>
      <span style="font-size:9px;color:var(--muted)">${escHTML(c.blood||'?')} | ${c.kg||'?'}kg</span>
    </div>`;
  }).join('');

  // Restore evac force inputs and sync to the ARAN evac-force store
  if(S.evacForce){
    if($('evac-driver')) $('evac-driver').value=S.evacForce.driver||'';
    if($('evac-vehicle')) $('evac-vehicle').value=S.evacForce.vehicle||'';
    if($('evac-medic')) $('evac-medic').value=S.evacForce.medic||'';
    if($('evac-guard')) $('evac-guard').value=S.evacForce.guard||'';
    _syncLegacyEvacForceToEvacForces();
    if(typeof renderEvacForcesSetup==='function') renderEvacForcesSetup();
  }
  renderEvacWarSnapshot();
}

function saveEvacForce(){
  S.evacForce={
    driver:($('evac-driver')?.value||'').trim(),
    vehicle:($('evac-vehicle')?.value||'').trim(),
    medic:($('evac-medic')?.value||'').trim(),
    guard:($('evac-guard')?.value||'').trim()
  };
  _syncLegacyEvacForceToEvacForces();
  if(typeof renderEvacForcesSetup==='function') renderEvacForcesSetup();
  renderEvacWarSnapshot();
  saveState();
  showToast('🚁 כוח מפנה נשמר');
}

// ═══════════════════════════════════════════════════════════
// ✅ MISSION READINESS — auto-calculated checklist
// ═══════════════════════════════════════════════════════════
function updateReadiness(){
  const el=$('readiness-checklist');if(!el) return;
  const checks=[];
  
  // Unit name
  const unit=$('p-unit')?.value?.trim();
  checks.push({ok:!!unit,label:'שם יחידה',icon:'🪖',detail:unit||'חסר'});
  
  // Comms
  const mahup=$('p-mahup')?.value?.trim();
  const helo=$('p-helo')?.value?.trim();
  checks.push({ok:!!mahup,label:'תדר MAHUP',icon:'📻',detail:mahup||'חסר'});
  checks.push({ok:!!helo,label:'תדר פינוי HELO',icon:'🚁',detail:helo||'חסר'});
  
  // LZ
  const lz1=$('p-lz1')?.value?.trim();
  checks.push({ok:!!lz1,label:'LZ ראשי',icon:'🛬',detail:lz1||'חסר'});
  
  // Force
  const forceCount=S.force.length;
  checks.push({ok:forceCount>=2,label:`כוח: ${forceCount} לוחמים`,icon:'👥',detail:forceCount>=2?'תקין':'הוסף לפחות 2'});
  
  // Iron numbers
  const ironCount=S.force.filter(f=>f.ironNum).length;
  checks.push({ok:ironCount===forceCount&&forceCount>0,label:`מספרי ברזל: ${ironCount}/${forceCount}`,icon:'🔢',detail:ironCount===forceCount?'הכל מוגדר':'חסר'});
  
  // Blood types
  const bloodCount=S.force.filter(f=>f.blood).length;
  checks.push({ok:bloodCount===forceCount&&forceCount>0,label:`סוגי דם: ${bloodCount}/${forceCount}`,icon:'🩸',detail:bloodCount===forceCount?'הכל ידוע':'חסר'});
  
  // Medic ratio
  const medics=S.force.filter(f=>f.role&&(f.role.includes('חובש')||f.role.includes('רופא')||f.role.includes('פאראמדיק'))).length;
  checks.push({ok:medics>=1,label:`גורמי רפואה: ${medics}`,icon:'🩺',detail:medics>=1?'תקין':' לפחות 1'});
  
  // Equipment — TQ count
  const tqTotal=S.force.reduce((sum,f)=>{return sum+((f.equip||[]).filter(e=>e.toLowerCase().includes('tq')).length);},0);
  checks.push({ok:tqTotal>=2,label:`TQ בכוח: ${tqTotal}`,icon:'🩹',detail:tqTotal>=2?'תקין':'מומלץ 2+'});
  
  // Evac force
  const hasLegacyEvac=S.evacForce&&S.evacForce.driver;
  const hasForceList=(S.evacForces||[]).length>0;
  const topForce=(S.evacForces||[])[0];
  checks.push({ok:!!(hasLegacyEvac||hasForceList),label:'כוח מפנה',icon:'🚗',detail:hasLegacyEvac?S.evacForce.driver:(topForce?.callsign||'לא הוגדר')});
  
  // Calculate score
  const total=checks.length;
  const done=checks.filter(c=>c.ok).length;
  const pct=Math.round((done/total)*100);
  const scoreEl=$('readiness-score');
  if(scoreEl) scoreEl.textContent=`${pct}%`;
  if(scoreEl) scoreEl.style.color=pct>=80?'var(--green3)':pct>=50?'var(--amber3)':'var(--red3)';
  
  el.innerHTML=checks.map((c,i)=>{
    const bg=c.ok?'var(--s3)':'rgba(200,40,40,.06)';
    const bdr=c.ok?'var(--green3)':'var(--red3)';
    const ic=c.ok?'✅':'<span style="font-size:10px">❌</span>';
    // Smart mapping for 'Complete' buttons
    let targetId = '';
    if (c.label.includes('יחידה')) targetId = 'p-unit';
    else if (c.label.includes('MAHUP')) targetId = 'p-mahup';
    else if (c.label.includes('HELO')) targetId = 'p-helo';
    else if (c.label.includes('LZ')) targetId = 'p-lz1';
    else if (c.label.includes('לוחמים') || c.label.includes('ברזל') || c.label.includes('דם') || c.label.includes('רפואה')) targetId = 'sc-prep'; // Scroll to force roster area

    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:${bg};border-right:3px solid ${bdr};border-radius:0 4px 4px 0;margin-bottom:4px">
      <div style="width:20px;text-align:center">${ic}</div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:700;color:var(--white)">${c.icon} ${c.label}</div>
        <div style="font-size:10px;color:var(--muted2)">${c.detail}</div>
      </div>
      ${!c.ok?`<button class="btn btn-xs btn-ghost" style="font-size:10px;color:var(--amber3);border-color:var(--amber3)" onclick="const el=document.getElementById('${targetId}'); if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); if(el.focus)el.focus(); }">השלם</button>`:''}
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// 🎒 EQUIPMENT SUMMARY — aggregated across force
// ═══════════════════════════════════════════════════════════
function updateEquipSummary(){
  const el=$('equip-summary-grid');if(!el) return;
  const counts={};
  S.force.forEach(f=>{
    (f.equip||[]).forEach(k=>{
      counts[k]=(counts[k]||0)+1;
    });
  });
  const keys=Object.keys(counts);
  if(!keys.length){el.innerHTML='<div style="font-size:11px;color:var(--muted);grid-column:span 2;padding:4px 0">הוסף לוחמים עם ציוד ← יוצג סיכום</div>';return;}
  el.innerHTML=keys.sort().map(k=>{
    const e=(typeof EQUIP_LIST!=='undefined')?EQUIP_LIST.find(x=>x.k===k):null;
    const label=e?`${e.icon} ${e.label}`:k;
    return `<div onclick="openEquipDetail('${k}')" style="background:var(--s2);border:1px solid var(--b0);border-radius:4px;padding:4px 6px;display:flex;align-items:center;gap:4px;cursor:pointer">
      <span style="font-size:9px;flex:1;color:var(--muted2)">${label}</span>
      <span style="font-size:12px;font-weight:900;color:var(--olive3)">${counts[k]}</span>
    </div>`;
  }).join('');
}

function openEquipDetail(itemKey) {
  const e = (typeof EQUIP_LIST !== 'undefined') ? EQUIP_LIST.find(x => x.k === itemKey) : null;
  const label = e ? `${e.icon} ${e.label}` : itemKey;
  const holders = S.force.filter(f => (f.equip || []).includes(itemKey));
  openModal(`פירוט ציוד: ${label}`, `
    <div class="pad col" style="gap:12px">
      <div style="font-size:13px;color:var(--muted);margin-bottom:4px">לוחמים המחזיקים בציוד זה (${holders.length}):</div>
      <div class="col" style="gap:6px">${holders.map(f => `
          <div style="background:var(--s2);border:1px solid var(--b0);border-radius:6px;padding:10px 12px;display:flex;align-items:center;gap:10px">
            <div style="width:30px;height:30px;border-radius:50%;background:var(--olive);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px">${initials(f.name)}</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700">${f.name}</div>
              <div style="font-size:10px;color:var(--muted)">${f.role || ''}</div>
            </div>
          </div>`).join('')}${holders.length === 0 ? '<div style="font-size:12px;color:var(--muted);text-align:center;padding:20px">אף לוחם לא רשום כמחזיק בציוד זה</div>' : ''}
      </div>
      <button class="btn btn-lg btn-ghost btn-full" onclick="closeModal()" style="margin-top:8px">סגור</button>
    </div>`);
}

if (typeof window !== 'undefined') {
  window.openEquipDetail = openEquipDetail;
  window.updateReadiness = updateReadiness;
  window.updateEvacOrder = updateEvacOrder;
  window.updateEquipSummary = updateEquipSummary;
}

// Auto-update prep sections every 3 seconds
setInterval(()=>{
  if(document.hidden) return;
  const prepScreen=$('sc-prep');
  if(prepScreen && prepScreen.classList.contains('active')){
    updateReadiness();
    updateEvacOrder();
    updateEquipSummary();
  }
  const evacScreen=$('sc-evac');
  if(evacScreen && evacScreen.classList.contains('active')){
    renderEvacWarSnapshot();
  }
},3000);
// Initial render
setTimeout(()=>{updateReadiness();updateEvacOrder();updateEquipSummary();renderEvacWarSnapshot();},500);

console.log('✓ Prep Enhancements: Evac Order, Mission Readiness, Equipment Summary');

// ═══════════════════════════════════════════════════
// 🎙️ AUDIO RECORDING SYSTEM (CASUALTY REPORT)
// ═══════════════════════════════════════════════════

let _globalRecorder = null;
let _globalAudioChunks = [];
let _recordingCasId = null;
let _recordingStartMs = 0;
let _recordingTimer = null;

function toggleAudioRecord(casId) {
  const c = S.casualties.find(x => x.id == casId);
  if (!c) return;

  if (_globalRecorder && _globalRecorder.state === 'recording') {
    // Stop recording
    if (_recordingCasId === casId) {
      _globalRecorder.stop();
      return;
    } else {
      showToast('הקלטה פעילה בפצוע אחר'); return;
    }
  }

  // Request Microphone access
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('❌ הדפדפן לא תומך בהקלטת אודיו');
    return;
  }

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      _globalAudioChunks = [];
      _recordingCasId = casId;
      _globalRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      _globalRecorder.ondataavailable = e => {
        if (e.data.size > 0) _globalAudioChunks.push(e.data);
      };
      
      _globalRecorder.onstart = () => {
        _recordingStartMs = Date.now();
        showToast('🎙️ מקליט דוח מילולי...');
        if(navigator.vibrate) navigator.vibrate(50);
        updateRecordingUI(casId, true);
        
        _recordingTimer = setInterval(() => {
           const sec = Math.floor((Date.now() - _recordingStartMs) / 1000);
           const m = Math.floor(sec / 60);
           const s = String(sec % 60).padStart(2, '0');
           const btn = document.getElementById(`btn-rec-${casId}`);
           if (btn) {
             btn.innerHTML = `<span style="color:var(--red3)">⏹ ${m}:${s}</span>`;
           }
        }, 1000);
      };

      _globalRecorder.onstop = () => {
        clearInterval(_recordingTimer);
        const audioBlob = new Blob(_globalAudioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = function() {
          const base64data = reader.result;
          const targetCas = S.casualties.find(x => x.id == _recordingCasId);
          if (targetCas) {
            targetCas.voiceRecords = targetCas.voiceRecords || [];
            targetCas.voiceRecords.push({ ms: Date.now(), data: base64data });
            addTL(_recordingCasId, targetCas.name, '🎙️ הוקלט דוח קולי', 'amber');
            saveState();
            showToast('✓ הדוח נשמר בהצלחה');
          }
          _recordingCasId = null;
          updateRecordingUI(casId, false);
          
          // Stop all mic tracks
          stream.getTracks().forEach(track => track.stop());
        }
        reader.readAsDataURL(audioBlob);
      };

      _globalRecorder.start();
    })
    .catch(err => {
      console.error('Audio Record error:', err);
      showToast('❌ אין הרשאה למיקרופון');
    });
}

function updateRecordingUI(casId, isRecording) {
  const btn = document.getElementById(`btn-rec-${casId}`);
  if (btn) {
    if (isRecording) {
      btn.style.borderColor = 'var(--red3)';
      btn.innerHTML = `<span style="color:var(--red3)">⏹ הולט...</span>`;
    } else {
      btn.style.borderColor = 'transparent';
      btn.innerHTML = `🎙️ הקלט דוח`;
    }
  }
}
