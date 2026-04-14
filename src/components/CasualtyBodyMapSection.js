const INJURY_TYPE_META = {
  'חדירני': { color: '#c82828', icon: '🔴' },
  'שטחי': { color: '#d06018', icon: '🟠' },
  'שבר': { color: '#c89010', icon: '🟡' },
  'כוויה': { color: '#8b4513', icon: '🟤' },
  'דימום': { color: '#8b0000', icon: '⬛' },
  'בלאסט': { color: '#4a4a8a', icon: '🔵' },
  'אחר': { color: '#406040', icon: '✏️' },
};

function getInjuryColor(type) {
  return (INJURY_TYPE_META[type] || INJURY_TYPE_META['חדירני']).color;
}

function getInjuryIcon(type) {
  return (INJURY_TYPE_META[type] || INJURY_TYPE_META['חדירני']).icon;
}

function renderInjuryDots(injuries) {
  return injuries.map((injury) => `
    <circle cx="${injury.cx}" cy="${injury.cy}" r="7" fill="${getInjuryColor(injury.type)}" opacity=".92" stroke="#000" stroke-width="1"/>
    <text x="${injury.cx}" y="${injury.cy + 4}" text-anchor="middle" font-size="8" fill="#fff">${getInjuryIcon(injury.type)}</text>
  `).join('');
}

function renderInjuryList(casualty) {
  if (!casualty.injuries.length) {
    return '<div style="font-size:11px;color:var(--muted)">לחץ על הגוף לסימון פציעה</div>';
  }

  return casualty.injuries.map((injury, index) => `
    <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--b0)">
      <div style="width:10px;height:10px;border-radius:50%;background:${getInjuryColor(injury.type)};flex-shrink:0"></div>
      <div style="flex:1;font-size:11px"><span style="font-weight:700">${injury.type}</span> — ${injury.zone} <span style="color:var(--muted);font-size:9px">${injury.side === 'back' ? 'אחורי' : 'קדמי'}</span></div>
      <button class="btn btn-xs btn-ghost" style="min-height:22px;color:var(--red3);border-color:var(--red)" onclick="removeInjury(${casualty.id},${index})">✕</button>
    </div>`).join('');
}

export function buildBodyMapSection(casualty) {
  const frontInjuries = casualty.injuries.filter((injury) => injury.side === 'front' || !injury.side);
  const backInjuries = casualty.injuries.filter((injury) => injury.side === 'back');

  return `
    <!-- BODY MAP INTERACTIVE -->
    <div class="sec" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <span>מפת פציעות — לחץ על הגוף לסימון</span>
      <div style="display:flex;gap:6px">
        <button class="btn btn-xs btn-ghost" id="bodymap-fs-btn-${casualty.id}" onclick="toggleBodyMapFullscreen(${casualty.id})">⛶ מסך מלא</button>
        <button class="btn btn-xs btn-ghost" id="bodymap-close-btn-${casualty.id}" onclick="toggleBodyMapFullscreen(${casualty.id})" style="display:none">✕ סגור</button>
      </div>
    </div>
    <div class="card bodymap-container" id="bodymap-container-${casualty.id}" style="overflow:visible;position:relative">
      <div style="font-size:10px;color:var(--muted);text-align:center;padding:6px 0 2px;letter-spacing:.06em">לחץ על הגוף → בחר סוג פציעה</div>
      <div class="inj-type-selected" style="font-size:10px;color:var(--muted);text-align:center;margin-bottom:4px">בחר סוג פציעה: חדירני</div>
      <div style="display:flex;justify-content:center;gap:18px;padding:8px 12px 4px;position:relative">
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
          <div style="font-size:9px;color:var(--olive3);letter-spacing:.1em;font-weight:700">קדמי</div>
          <svg id="bodyfront-${casualty.id}" width="150" height="320" viewBox="0 0 110 230" style="cursor:crosshair;touch-action:manipulation" onclick="bodyTap(event,${casualty.id},'front')">
            <ellipse cx="55" cy="18" rx="16" ry="17" class="bm-part" stroke-width="2"/>
            <rect x="49" y="33" width="12" height="10" rx="3" class="bm-part" stroke-width="2"/>
            <rect x="28" y="42" width="54" height="62" rx="6" class="bm-part" stroke-width="2"/>
            <rect x="7" y="44" width="20" height="56" rx="8" class="bm-part" stroke-width="2"/>
            <rect x="83" y="44" width="20" height="56" rx="8" class="bm-part" stroke-width="2"/>
            <rect x="28" y="104" width="23" height="78" rx="8" class="bm-part" stroke-width="2"/>
            <rect x="59" y="104" width="23" height="78" rx="8" class="bm-part" stroke-width="2"/>
            <text x="55" y="20" text-anchor="middle" font-size="9" class="bm-text" font-family="Heebo,sans-serif">ראש</text>
            <text x="55" y="75" text-anchor="middle" font-size="9" class="bm-text" font-family="Heebo,sans-serif">חזה</text>
            <text x="55" y="94" text-anchor="middle" font-size="8" class="bm-text" font-family="Heebo,sans-serif">בטן</text>
            <text x="16" y="73" text-anchor="middle" font-size="8" class="bm-text" font-family="Heebo,sans-serif">יד</text>
            <text x="16" y="82" text-anchor="middle" font-size="8" class="bm-text" font-family="Heebo,sans-serif">שמאל</text>
            <text x="93" y="73" text-anchor="middle" font-size="8" class="bm-text" font-family="Heebo,sans-serif">יד</text>
            <text x="93" y="82" text-anchor="middle" font-size="8" class="bm-text" font-family="Heebo,sans-serif">ימין</text>
            <text x="39" y="148" text-anchor="middle" font-size="8" class="bm-text" font-family="Heebo,sans-serif">רגל</text>
            <text x="39" y="158" text-anchor="middle" font-size="8" class="bm-text" font-family="Heebo,sans-serif">שמאל</text>
            <text x="70" y="148" text-anchor="middle" font-size="8" class="bm-text" font-family="Heebo,sans-serif">רגל</text>
            <text x="70" y="158" text-anchor="middle" font-size="8" class="bm-text" font-family="Heebo,sans-serif">ימין</text>
            <g id="dots-front-${casualty.id}">${renderInjuryDots(frontInjuries)}</g>
          </svg>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
          <div style="font-size:9px;color:var(--muted2);letter-spacing:.1em;font-weight:700">אחורי</div>
          <svg id="bodyback-${casualty.id}" width="150" height="320" viewBox="0 0 110 230" style="cursor:crosshair;touch-action:manipulation" onclick="bodyTap(event,${casualty.id},'back')">
            <ellipse cx="55" cy="18" rx="16" ry="17" class="bm-part bm-back" stroke-width="2"/>
            <rect x="49" y="33" width="12" height="10" rx="3" class="bm-part bm-back" stroke-width="2"/>
            <rect x="28" y="42" width="54" height="62" rx="6" class="bm-part bm-back" stroke-width="2"/>
            <line x1="55" y1="44" x2="55" y2="102" class="bm-spine" stroke-width="2" stroke-dasharray="4,3"/>
            <rect x="7" y="44" width="20" height="56" rx="8" class="bm-part bm-back" stroke-width="2"/>
            <rect x="83" y="44" width="20" height="56" rx="8" class="bm-part bm-back" stroke-width="2"/>
            <rect x="28" y="104" width="23" height="78" rx="8" class="bm-part bm-back" stroke-width="2"/>
            <rect x="59" y="104" width="23" height="78" rx="8" class="bm-part bm-back" stroke-width="2"/>
            <text x="55" y="20" text-anchor="middle" font-size="9" class="bm-text" font-family="Heebo,sans-serif">עורף</text>
            <text x="55" y="72" text-anchor="middle" font-size="9" class="bm-text" font-family="Heebo,sans-serif">גב</text>
            <g id="dots-back-${casualty.id}">${renderInjuryDots(backInjuries)}</g>
          </svg>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 12px 10px;justify-content:center">
        ${[['חדירני', 'var(--red2)'], ['שטחי', 'var(--orange)'], ['שבר', 'var(--amber)'], ['כוויה', '#8b4513'], ['דימום', 'var(--red)'], ['בלאסט', 'var(--blue2)'], ['אחר', 'var(--olive3)']].map(([type, color]) => `
          <button type="button" class="injury-type-pill" style="font-size:9px" data-type="${type}" onclick="setInjuryType('${type}')">
            <span class="injury-type-pill-icon" style="background:${color}"></span>${type}
          </button>`).join('')}
      </div>
      <div style="border-top:1px solid var(--b0);padding:8px 12px">
        <div style="font-size:10px;color:var(--muted);letter-spacing:.08em;margin-bottom:6px">פציעות רשומות:</div>
        <div id="inj-list-${casualty.id}">${renderInjuryList(casualty)}</div>
      </div>
    </div>`;
}

function toggleBodyMapFullscreen(casId) {
  const container = document.getElementById(`bodymap-container-${casId}`);
  const btn = document.getElementById(`bodymap-fs-btn-${casId}`);
  const closeBtn = document.getElementById(`bodymap-close-btn-${casId}`);
  if (!container) return;
  const isFull = container.classList.toggle('bodymap-fullscreen');
  if (btn) btn.textContent = isFull ? '⛶ מסך מלא' : '⛶ מסך מלא';
  if (closeBtn) closeBtn.style.display = isFull ? 'inline-flex' : 'none';
  document.body.classList.toggle('bodymap-fullscreen-active', isFull);
}

function addInjuryZoneAnalysis(casualty) {
  const zoneCounts = (casualty.injuries || []).reduce((acc, injury) => {
    if (!acc[injury.zone]) acc[injury.zone] = 0;
    acc[injury.zone] += 1;
    return acc;
  }, {});
  return Object.entries(zoneCounts).map(([zone, count]) => `${zone}: ${count}`).join(' | ');
}

export function initCasualtyBodyMapSection() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.bodyMapSection = {
    buildBodyMapSection,
  };

  window.toggleBodyMapFullscreen = toggleBodyMapFullscreen;
  window.addInjuryZoneAnalysis = addInjuryZoneAnalysis;
}