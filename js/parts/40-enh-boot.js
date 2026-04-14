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
