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
