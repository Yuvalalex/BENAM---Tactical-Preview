function buildPhaseRow(casualtyId, phase, phaseColors, defaultDisplay) {
  return `
    <div class="march-phase">
      <div class="march-hdr" onclick="toggleMarchBody('mb-${casualtyId}-${phase.k}')">
        <div class="march-letter" style="background:${phaseColors[phase.k]}">${phase.k}</div>
        <div style="flex:1"><div style="font-size:12px;font-weight:700">${phase.title}</div><div style="font-size:9px;color:var(--muted)">${phase.sub}</div></div>
        <span id="mc-${casualtyId}-${phase.k}" style="font-size:10px;color:var(--olive3);font-family:var(--font-mono)">0/${phase.items.length}</span>
      </div>
      <div class="march-body" id="mb-${casualtyId}-${phase.k}" style="display:${defaultDisplay}">
        ${phase.items.map((item) => `
          <div class="march-item" onclick="toggleMarchItem(this,${casualtyId},'${phase.k}',${phase.items.length})">
            <div class="march-cb"></div>
            <div class="march-text">${item}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

export function buildMarchProtocolSection(casualtyId, phases, phaseColors, options = {}) {
  const {
    collapsible = false,
    wrapperId = `dm-full-${casualtyId}`,
    title = 'MARCH Protocol',
    titleButtonHtml = '',
    collapsedLabel = '▼ לחץ להרחבה',
    defaultOpenPhase = null,
  } = options;

  const phasesHtml = phases.map((phase) => buildPhaseRow(
    casualtyId,
    phase,
    phaseColors,
    defaultOpenPhase === phase.k ? 'block' : 'none',
  )).join('');

  if (collapsible) {
    return `
      <div class="sec" style="cursor:pointer" onclick="toggleDrawerSection('${wrapperId}')">
        ${title} <span style="font-size:9px;color:var(--muted)">${collapsedLabel}</span>
      </div>
      <div id="${wrapperId}" style="display:none">
        ${phasesHtml}
      </div>`;
  }

  return `
    <div class="sec">${title}${titleButtonHtml}</div>
    ${phasesHtml}`;
}

export function initCasualtyMarchProtocolSection() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.marchProtocolSection = {
    buildMarchProtocolSection,
  };
}