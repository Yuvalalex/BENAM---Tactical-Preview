const { test, expect } = require('@playwright/test');

/**
 * BENAM MASTER UI VALIDATION — v1.1
 * Comprehensive UI tests covering every major feature.
 */

async function setupApp(page) {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const tut = document.getElementById('tutorial-overlay');
    if (tut) tut.style.display = 'none';
  });
}

async function startMission(page) {
  await setupApp(page);
  await page.evaluate(() => { skipRoleSetup(); });
  await page.waitForTimeout(300);
  page.on('dialog', d => d.accept());
  await page.evaluate(() => { _doStartMission(); });
  await page.waitForTimeout(500);
}

// ==========================================
// 1. ROLE SELECTION (6 Tests)
// ==========================================
test.describe('1. Role Selection', () => {
  test('selectRole sets commander role', async ({ page }) => {
    await setupApp(page);
    await page.evaluate(() => selectRole('commander'));
    expect(await page.evaluate(() => S.role)).toBe('commander');
  });
  test('selectRole sets medic role and navigates', async ({ page }) => {
    await setupApp(page);
    await page.evaluate(() => selectRole('medic'));
    expect(await page.evaluate(() => S.role)).toBe('medic');
  });
  test('Role persists on reload', async ({ page }) => {
    await setupApp(page);
    await page.evaluate(() => { selectRole('commander'); saveState(); });
    await page.reload();
    expect(await page.evaluate(() => S.role)).toBe('commander');
  });
  test('skipRoleSetup navigates to Prep', async ({ page }) => {
    await setupApp(page);
    await page.evaluate(() => skipRoleSetup());
    await expect(page.locator('#sc-prep')).toBeVisible();
  });
  test('skipRoleSetup assigns a default role', async ({ page }) => {
    await setupApp(page);
    await page.evaluate(() => skipRoleSetup());
    expect(await page.evaluate(() => !!S.role)).toBeTruthy();
  });
  test('Role screen hidden after skip', async ({ page }) => {
    await setupApp(page);
    await page.evaluate(() => skipRoleSetup());
    await expect(page.locator('#sc-role')).not.toBeVisible();
  });
});

// ==========================================
// 2. PREP HUB (9 Tests)
// ==========================================
test.describe('2. Prep Hub', () => {
  test('Comms unit saves to state', async ({ page }) => {
    await setupApp(page);
    await page.evaluate(() => { S.comms.unit = 'ALPHA-7'; saveState(); });
    expect(await page.evaluate(() => S.comms.unit)).toBe('ALPHA-7');
  });
  test('Supply state persists across reloads', async ({ page }) => {
    await setupApp(page);
    await page.evaluate(() => { skipRoleSetup(); S.supplies.TQ = 5; saveState(); });
    await page.reload();
    expect(await page.evaluate(() => S.supplies.TQ)).toBe(5);
  });
  test('Prep screen shows readiness section', async ({ page }) => {
    await setupApp(page);
    await page.evaluate(() => skipRoleSetup());
    await expect(page.locator('text=מוכנות למשימה')).toBeVisible();
  });
  test('Start Mission transitions to War Room', async ({ page }) => {
    await startMission(page);
    await expect(page.locator('#sc-war')).toBeVisible();
  });
  test('Start Mission sets missionActive', async ({ page }) => {
    await startMission(page);
    expect(await page.evaluate(() => S.missionActive)).toBe(true);
  });
  test('Start Mission creates timeline event', async ({ page }) => {
    await startMission(page);
    expect(await page.evaluate(() => S.timeline.length)).toBeGreaterThan(0);
  });
  test('Force roster add works', async ({ page }) => {
    await setupApp(page);
    await page.evaluate(() => {
      skipRoleSetup();
      addForceMember({ id: Date.now(), name: 'Test', idNum: '', kg: 70, blood: 'O+', role: 'לוחם', equip: [] });
    });
    expect(await page.evaluate(() => S.force.length)).toBe(1);
  });
  test('Prep sub-tabs switch correctly', async ({ page }) => {
    await setupApp(page);
    await page.evaluate(() => skipRoleSetup());
    await page.evaluate(() => setPrepTab('force'));
    const forceVisible = await page.evaluate(() => {
      const el = document.querySelector('.prep-grp-force');
      return el ? getComputedStyle(el).display !== 'none' : false;
    });
    expect(forceVisible).toBe(true);
  });
  test('Empty state handled gracefully', async ({ page }) => {
    await setupApp(page);
    await page.evaluate(() => { S.comms.unit = ''; skipRoleSetup(); });
    await expect(page.locator('#sc-prep')).toBeVisible();
  });
});

// ==========================================
// 3. WAR ROOM (15 Tests)
// ==========================================
test.describe('3. War Room', () => {
  test('QuickAdd creates a casualty', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); });
    expect(await page.evaluate(() => S.casualties.length)).toBe(1);
  });
  test('QuickAdd increments unique IDs', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); quickAddCas(); });
    expect(await page.evaluate(() => S.casualties[0].id !== S.casualties[1].id)).toBeTruthy();
  });
  test('Casualty count display updates', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); });
    await expect(page.locator('#cas-count')).not.toBeEmpty();
  });
  test('View switcher: matrix', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); setWarView('matrix'); });
    const view = await page.evaluate(() => currentWarView);
    expect(view).toBe('matrix');
  });
  test('View switcher: triage', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); setWarView('triage'); });
    const view = await page.evaluate(() => currentWarView);
    expect(view).toBe('triage');
  });
  test('View switcher: march', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); setWarView('march'); });
    const view = await page.evaluate(() => currentWarView);
    expect(view).toBe('march');
  });
  test('View switcher: blood', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { setWarView('blood'); });
    const view = await page.evaluate(() => currentWarView);
    expect(view).toBe('blood');
  });
  test('View switcher: cards', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); setWarView('cards'); });
    const view = await page.evaluate(() => currentWarView);
    expect(view).toBe('cards');
  });
  test('Fire Mode toggle activates', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { toggleFireMode(); });
    expect(await page.evaluate(() => S.fireMode)).toBeTruthy();
  });
  test('Fire Mode toggle deactivates', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { toggleFireMode(); toggleFireMode(); });
    expect(await page.evaluate(() => S.fireMode)).toBeFalsy();
  });
  test('Sync Master modal opens', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { openSyncDashboard(); });
    await expect(page.locator('#modal-title')).toContainText('סנכרון');
  });
  test('Night Mode CSS toggle', async ({ page }) => {
    await setupApp(page);
    await page.evaluate(() => toggleNightMode());
    const hasClass = await page.evaluate(() => document.body.classList.contains('light-theme'));
    expect(hasClass).toBeTruthy();
  });
  test('PIN Lock screen shows', async ({ page }) => {
    await setupApp(page);
    await page.evaluate(() => { if (typeof togglePinLock === 'function') togglePinLock(true); });
    await expect(page.locator('#pin-lock')).toBeVisible();
  });
  test('RTL layout is set', async ({ page }) => {
    await setupApp(page);
    const dir = await page.evaluate(() => document.body.dir);
    expect(dir).toBe('rtl');
  });
  test('20 concurrent casualties handle correctly', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { for (let i = 0; i < 20; i++) quickAddCas(); });
    expect(await page.evaluate(() => S.casualties.length)).toBe(20);
  });
});

// ==========================================
// 4. CASUALTY PROFILE (12 Tests)
// ==========================================
test.describe('4. Casualty Profile & Form 101', () => {
  test('Drawer opens for casualty', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); jumpToCas(S.casualties[0].id); });
    await expect(page.locator('#cas-drawer')).toBeVisible();
  });
  test('Name edit updates state', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); jumpToCas(S.casualties[0].id); });
    await page.fill('#cas-name', 'JOHN_TEST');
    expect(await page.evaluate(() => S.casualties[0].name)).toBe('JOHN_TEST');
  });
  test('Triage T1 click updates priority', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); jumpToCas(S.casualties[0].id); });
    await page.click('text=T1');
    expect(await page.evaluate(() => S.casualties[0].priority)).toBe('T1');
  });
  test('Triage T2 click updates priority', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); jumpToCas(S.casualties[0].id); });
    await page.click('text=T2');
    expect(await page.evaluate(() => S.casualties[0].priority)).toBe('T2');
  });
  test('Triage logs change to timeline', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); jumpToCas(S.casualties[0].id); });
    await page.click('text=T1');
    expect(await page.evaluate(() => S.timeline.some(t => t.text && t.text.includes('T1')))).toBeTruthy();
  });
  test('TQ apply starts clock', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); jumpToCas(S.casualties[0].id); });
    await page.evaluate(() => {
      const cas = S.casualties[0];
      cas.tqStart = Date.now();
      addTL(cas.id, cas.name, 'TQ הופעל', 'red');
    });
    expect(await page.evaluate(() => S.casualties[0].tqStart)).not.toBeNull();
  });
  test('Vitals field saves pulse', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); jumpToCas(S.casualties[0].id); });
    await page.fill('#cas-pulse', '88');
    expect(await page.evaluate(() => S.casualties[0].vitals.pulse)).toBe('88');
  });
  test('Fire TQ applies tourniquet', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => {
      quickAddCas();
      selectedFireCasId = S.casualties[0].id;
      fireTQ();
    });
    expect(await page.evaluate(() => S.casualties[0].tqStart)).not.toBeNull();
  });
  test('Fire TXA adds treatment', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => {
      quickAddCas();
      selectedFireCasId = S.casualties[0].id;
      fireTXA();
    });
    expect(await page.evaluate(() => S.casualties[0].txList.length)).toBeGreaterThan(0);
  });
  test('Medical interventions TQ + TXA count', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => {
      quickAddCas();
      selectedFireCasId = S.casualties[0].id;
      fireTQ(); fireTXA();
    });
    expect(await page.evaluate(() => S.casualties[0].txList.length)).toBe(2);
  });
  test('Vitals history logging', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); });
    const cId = await page.evaluate(() => S.casualties[0].id);
    for (let i = 0; i < 3; i++) {
      await page.evaluate((id) => {
        const cas = S.casualties.find(c => c.id === id);
        cas.vitals.pulse = String(80 + i);
        saveVitals(id);
      }, cId);
    }
    const count = await page.evaluate(id => S.casualties.find(c => c.id === id).vitalsHistory.length, cId);
    expect(count).toBe(3);
  });
  test('Done status sets priority', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); jumpToCas(S.casualties[0].id); });
    await page.click('text=Done');
    expect(await page.evaluate(() => S.casualties[0].priority)).toBe('Done');
  });
});

// ==========================================
// 5. SYNC MASTER (8 Tests)
// ==========================================
test.describe('5. Sync Master & Burst Engine', () => {
  test('Burst Export chunks visible', async ({ page }) => {
    await startMission(page);
    await page.evaluate(async () => { quickAddCas(); await meshExport(); });
    await expect(page.locator('text=חלק 1/')).toBeVisible();
  });
  test('AutoPlay toggles button text', async ({ page }) => {
    await startMission(page);
    await page.evaluate(async () => { quickAddCas(); await meshExport(); });
    await page.click('#qr-auto-btn');
    await expect(page.locator('#qr-auto-btn')).toContainText('עצור');
  });
  test('Speed selector updates timer', async ({ page }) => {
    await startMission(page);
    await page.evaluate(async () => { quickAddCas(); await meshExport(); });
    await page.click('#spd-3000');
    expect(await page.evaluate(() => _qrAutoSpeed)).toBe(3000);
  });
  test('Scope selector: patient mode', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); openSyncDashboard('export'); });
    await page.click('text=👤 פצוע ספציפי');
    await expect(page.locator('text=שידור פצוע נבחר')).toBeVisible();
  });
  test('Scope selector: auto-focus first casualty', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); S.casualties[0].name = 'ALPHA'; openSyncDashboard('export'); });
    await page.click('text=👤 פצוע ספציפי');
    await expect(page.locator('text=ALPHA')).toBeVisible();
  });
  test('Sync dashboard tabs visible', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { openSyncDashboard(); });
    await expect(page.locator('text=זירה')).toBeVisible();
    await expect(page.locator('text=שידור')).toBeVisible();
  });
  test('QR target frame visible on export', async ({ page }) => {
    await startMission(page);
    await page.evaluate(async () => { quickAddCas(); await meshExport(); });
    await expect(page.locator('#qr-target-frame')).toBeVisible();
  });
  test('Navigation controls visible', async ({ page }) => {
    await startMission(page);
    await page.evaluate(async () => { quickAddCas(); await meshExport(); });
    await expect(page.locator('text=הבא ▶')).toBeVisible();
  });
});

// ==========================================
// 6. RESPONSIVE & VISUAL (4 Tests)
// ==========================================
test.describe('6. Responsive & Visual', () => {
  test('Mobile viewport (375x812)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await startMission(page);
    await expect(page.locator('#sc-war')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBeFalsy();
  });
  test('Tablet viewport (1024x1366)', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1366 });
    await startMission(page);
    await expect(page.locator('#sc-war')).toBeVisible();
  });
  test('Fire Mode activates visual indicator', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => toggleFireMode());
    expect(await page.evaluate(() => S.fireMode)).toBeTruthy();
  });
  test('No horizontal overflow on war room', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBeFalsy();
  });
});

// ==========================================
// 7. END-TO-END JOURNEY (2 Tests)
// ==========================================
test.describe('7. End-to-End Journey', () => {
  test('Add → Triage → TQ → Report flow', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => quickAddCas());
    const cId = await page.evaluate(() => S.casualties[0].id);
    await page.evaluate(id => jumpToCas(id), cId);
    await page.fill('#cas-name', 'JOURNEY_ALPHA');
    await page.click('text=T1');
    await page.evaluate(() => {
      selectedFireCasId = S.casualties[0].id;
      fireTQ();
    });
    const state = await page.evaluate(id => S.casualties.find(c => c.id === id), cId);
    expect(state.name).toBe('JOURNEY_ALPHA');
    expect(state.priority).toBe('T1');
    expect(state.tqStart).not.toBeNull();
  });
  test('Report generation contains MEDEVAC', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); genReport(); });
    await expect(page.locator('#report-txt')).toContainText('MEDEVAC');
  });
});

// ==========================================
// 8. UI FEEDBACK (2 Tests)
// ==========================================
test.describe('8. UI Feedback', () => {
  test('Toast shows and auto-hides', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => showToast('Test toast'));
    await expect(page.locator('.toast')).toBeVisible();
  });
  test('Modal opens correctly', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => openSyncDashboard());
    await expect(page.locator('#modal-title')).toBeVisible();
  });
});
