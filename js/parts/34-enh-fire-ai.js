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
