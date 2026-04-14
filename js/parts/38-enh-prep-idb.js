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
