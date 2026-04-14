function meshApplyPayload(payload) {
  if (payload?.kind === QR_PACKET_KIND_STATE) {
    _importStatePacket(payload);
    return;
  }
  if (!payload?.casualties || !Array.isArray(payload.casualties)) {
    showToast('⚠ חסר שדה casualties — נתונים לא תקינים');
    return;
  }

  // Validate payload structure
  const validCas = payload.casualties.filter(c => c && (c.id || c.name));
  if (validCas.length === 0) {
    showToast('⚠ לא נמצאו פגועים תקינים בנתונים');
    return;
  }

  let added = 0, updated = 0, conflicts = 0, mergeDetails = [];
  validCas.forEach(incoming => {
    // Match by ID first, then by name as fallback
    const existing = S.casualties.find(c => c.id == incoming.id) ||
                     S.casualties.find(c => c.name && incoming.name && c.name === incoming.name);
    if (!existing) {
      S.casualties.push(_normalizeImportedCasualty({ ...incoming, _meshReceived: true, _meshSyncAt: Date.now() }));
      added++;
      mergeDetails.push(`+ ${escHTML(incoming.name || '?')} (חדש)`);
    } else {
      const inTs = incoming._addedAt || 0, exTs = existing._addedAt || 0;
      const changes = [];

      // Priority: take more critical (lower number = more critical)
      if (incoming.priority && prioN(incoming.priority) < prioN(existing.priority)) {
        changes.push(`תעדוף: ${existing.priority}→${incoming.priority}`);
        existing.priority = incoming.priority;
        conflicts++;
      }

      // TxList: merge unique treatments
      let txAdded = 0;
      if (Array.isArray(incoming.txList)) {
        incoming.txList.forEach(tx => {
          if (tx && !existing.txList.some(t => t.type === tx.type && t.time === tx.time)) {
            existing.txList.push({ ...tx, _mesh: true, _meshSyncAt: Date.now() });
            txAdded++;
          }
        });
      }
      if (txAdded) changes.push(`+${txAdded} טיפולים`);

      // Injuries: merge unique
      let injAdded = 0;
      if (Array.isArray(incoming.injuries)) {
        incoming.injuries.forEach(inj => {
          if (inj && !existing.injuries.some(e => e.loc === inj.loc && e.type === inj.type)) {
            existing.injuries.push({ ...inj, _mesh: true });
            injAdded++;
          }
        });
      }
      if (injAdded) changes.push(`+${injAdded} פציעות`);

      // Vitals: take if newer
      if (incoming.vitals && inTs > exTs) {
        existing.vitals = { ...incoming.vitals };
        changes.push('ויטלים עודכנו');
      }

      // VitalsHistory: merge unique entries
      const existH = existing.vitalsHistory || [];
      let vhAdded = 0;
      (incoming.vitalsHistory || []).forEach(s => {
        if (s && !existH.some(e => e.ms === s.ms)) { existH.push(s); vhAdded++; }
      });
      existing.vitalsHistory = existH.sort((a, b) => (a.ms || 0) - (b.ms || 0));
      if (vhAdded) changes.push(`+${vhAdded} מדידות`);

      // MARCH: merge — take worst score per category
      if (incoming.march) {
        ['M', 'A', 'R', 'C', 'H'].forEach(k => {
          if ((incoming.march[k] || 0) > (existing.march[k] || 0)) {
            existing.march[k] = incoming.march[k];
          }
        });
      }

      // Notes: append if different
      if (incoming.notes && incoming.notes !== existing.notes) {
        if (existing.notes && !existing.notes.includes(incoming.notes)) {
          existing.notes = existing.notes + '\n[mesh] ' + incoming.notes;
          changes.push('הערות מוזגו');
        } else if (!existing.notes) {
          existing.notes = incoming.notes;
        }
      }

      // Medic assignment: take if missing locally
      if (incoming.medic && !existing.medic) {
        existing.medic = incoming.medic;
        changes.push(`חובש: ${escHTML(incoming.medic)}`);
      }

      // TQ: take if newer
      if (incoming.tqStart && (!existing.tqStart || incoming.tqStart > existing.tqStart)) {
        existing.tqStart = incoming.tqStart;
        changes.push('TQ עודכן');
      }

      existing._meshSyncAt = Date.now();
      if (changes.length > 0) {
        updated++;
        mergeDetails.push(`↻ ${escHTML(existing.name || '?')}: ${changes.join(', ')}`);
      }
    }
  });

  // Merge timeline
  let tlAdded = 0;
  (payload.timeline || []).forEach(e => {
    if (e && !S.timeline.some(t => t.ms === e.ms && t.who === e.who)) {
      S.timeline.push({ ...e, _mesh: true });
      tlAdded++;
    }
  });
  S.timeline.sort((a, b) => (a.ms || 0) - (b.ms || 0));

  // Merge supplies: take max of each
  if (payload.supplies) {
    Object.keys(payload.supplies).forEach(k => {
      if (typeof payload.supplies[k] === 'number' && payload.supplies[k] > (S.supplies[k] || 0)) {
        S.supplies[k] = payload.supplies[k];
      }
    });
  }

  const summary = `✅ מוזג: +${added} חדשים, ${updated} עודכנו${conflicts ? `, ${conflicts} קונפליקטים` : ''}${tlAdded ? `, +${tlAdded} אירועים` : ''}`;

  // Show detailed merge log
  meshAddLog(summary);
  if (mergeDetails.length > 0 && mergeDetails.length <= 10) {
    mergeDetails.forEach(d => meshAddLog('  ' + d));
  }

  renderWarRoom(); renderTimeline(); populateSupply();
  saveState();
  showToast(summary, 4000);
  addTL('sys', 'SYSTEM', `🔗 Mesh Sync: +${added} חדשים, ${updated} עודכנו`, 'olive');

  // Vibrate on successful merge
  try { if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]); } catch (_) {}
}

// _normalizeImportedCasualty is defined in 19-qr-export.js (more complete version)

function renderMeshStatus() {
  const el = $('mesh-sync-status'); if (!el) return;
  const pending = _meshPendingDeltas.length;
  const meshCount = S.casualties.filter(c => c._meshReceived).length;
  const lastSyncAgo = _meshLastSync ? _formatTimeAgo(_meshLastSync) : null;
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <div style="width:8px;height:8px;border-radius:50%;background:${pending ? 'var(--amber3)' : 'var(--green3)'};${pending ? 'animation:pulse 1.5s infinite' : ''}"></div>
      <span style="color:${pending ? 'var(--amber3)' : 'var(--green3)'}; font-weight:700">
        ${pending ? `${pending} עדכונים ממתינים` : '✅ מסונכרן'}
      </span>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <span>📊 ${S.casualties.length} פגועים</span>
      <span>📝 ${S.timeline.length} אירועים</span>
      ${meshCount ? `<span>🔗 ${meshCount} ממקור חיצוני</span>` : ''}
    </div>
    ${lastSyncAgo ? `<div style="color:var(--muted2);margin-top:2px">סנכרון אחרון: ${lastSyncAgo}</div>` : '<div style="color:var(--muted2);margin-top:2px">טרם סונכרן</div>'}`;
}

function _formatTimeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'לפני ' + diff + ' שניות';
  if (diff < 3600) return 'לפני ' + Math.floor(diff / 60) + ' דקות';
  return new Date(ts).toLocaleTimeString('he-IL');
}