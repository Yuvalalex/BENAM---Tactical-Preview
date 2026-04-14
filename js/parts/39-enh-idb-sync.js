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
