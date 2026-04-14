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
