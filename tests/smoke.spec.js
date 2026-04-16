const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('benam_tutorial_done', '1');
    localStorage.removeItem('benam_pin');
    localStorage.removeItem('benam_s');
    localStorage.removeItem('benam_s_training');
  });
});

async function setupApp(page) {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const tut = document.getElementById('tutorial-overlay');
    if (tut) tut.style.display = 'none';
  });
  // Skip role selection to go directly to prep
  await page.evaluate(() => { skipRoleSetup(); });
  await page.waitForTimeout(300);
}

async function startMission(page) {
  await setupApp(page);
  page.on('dialog', dialog => dialog.accept());
  await page.evaluate(() => { _doStartMission(); });
  await page.waitForTimeout(500);
}

test('app loads without JS errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});

test('skip role setup goes to prep', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await setupApp(page);
  await expect(page.locator('#sc-prep')).toBeVisible();
  expect(errors).toEqual([]);
});

test('start mission shows war room', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await startMission(page);
  await expect(page.locator('#sc-war')).toBeVisible();
  expect(errors).toEqual([]);
});

test('quickAddCas adds casualty without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await startMission(page);

  await page.evaluate(() => { quickAddCas(); });
  await page.waitForTimeout(500);

  const count = await page.evaluate(() => S.casualties.length);
  expect(count).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('fire mode buttons work', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await startMission(page);

  await page.evaluate(() => { quickAddCas(); });
  await page.waitForTimeout(300);

  await page.evaluate(() => { toggleFireMode(); });
  await page.waitForTimeout(300);

  await page.evaluate(() => { fireTQ(); });
  await page.waitForTimeout(300);

  await page.evaluate(() => { fireTXA(); });
  await page.waitForTimeout(300);

  expect(errors).toEqual([]);
});

test('view modes render without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await startMission(page);

  await page.evaluate(() => { quickAddCas(); });
  await page.waitForTimeout(300);

  for (const mode of ['matrix', 'triage', 'march', 'blood', 'cards']) {
    await page.evaluate(m => setWarView(m), mode);
    await page.waitForTimeout(200);
  }

  expect(errors).toEqual([]);
});

test('genAAR works', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await startMission(page);

  await page.evaluate(() => { quickAddCas(); });
  await page.waitForTimeout(300);

  await page.evaluate(() => { genAAR(); });
  await page.waitForTimeout(300);

  const aarContent = await page.locator('#aar-section').innerHTML();
  expect(aarContent.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('renderStats works', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await startMission(page);

  await page.evaluate(() => { quickAddCas(); });
  await page.waitForTimeout(300);

  await page.evaluate(() => { renderStats(); });
  await page.waitForTimeout(300);

  const statsContent = await page.locator('#kpi-dashboard').innerHTML();
  expect(statsContent.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('genReport works', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await startMission(page);

  await page.evaluate(() => { quickAddCas(); });
  await page.waitForTimeout(300);

  await page.evaluate(() => { genReport(); });
  await page.waitForTimeout(300);

  const reportContent = await page.locator('#report-txt').textContent();
  expect(reportContent).toContain('MEDEVAC');
  expect(errors).toEqual([]);
});

test('drawer opens for casualty', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await startMission(page);

  await page.evaluate(() => { quickAddCas(); });
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const casId = S.casualties[0].id;
    jumpToCas(casId);
  });
  await page.waitForTimeout(500);

  expect(errors).toEqual([]);
});

test('blood screen renders without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await startMission(page);

  await page.evaluate(() => { renderBloodScreen(); });
  await page.waitForTimeout(300);

  expect(errors).toEqual([]);
});

test('state QR roundtrip restores full transferred state', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await startMission(page);

  const snapshot = await page.evaluate(async () => {
    quickAddCas();
    const casualty = S.casualties[0];
    casualty.name = 'QR Alpha';
    casualty.priority = 'T1';
    casualty.txList = ['TQ', 'TXA'];
    casualty.notes = 'roundtrip';
    S.comms.unit = 'Unit QR';
    S.supplies.TQ = 7;
    S.role = 'lead';
    S.opMode = 'advanced';
    S.timeline.push({ ms: Date.now(), text: 'qr export event' });
    const pack = await _buildStateExportPacket();
    const bundle = await _buildQRBundle(pack);
    return {
      chunks: [...bundle.chunks].reverse(),
      expected: {
        casualtyName: casualty.name,
        casualtyPriority: casualty.priority,
        txCount: casualty.txList.length,
        notes: casualty.notes,
        unit: S.comms.unit,
        tq: S.supplies.TQ,
        role: S.role,
        opMode: S.opMode,
        missionActive: S.missionActive,
        timelineCount: S.timeline.length,
      }
    };
  });

  await page.evaluate(async (chunks) => {
    S.force = [];
    S.casualties = [];
    S.timeline = [];
    S.comms = {};
    S.supplies = {};
    S.role = null;
    S.opMode = null;
    S.missionActive = false;
    S.missionStart = null;
    _resetQRScanState();
    window.confirm = () => true;
    for (const chunk of chunks) await _handleScanResult(chunk);
    importScannedQR();
  }, snapshot.chunks);

  await page.waitForTimeout(250);

  const restored = await page.evaluate(() => ({
    casualtyName: S.casualties[0]?.name,
    casualtyPriority: S.casualties[0]?.priority,
    txCount: S.casualties[0]?.txList?.length || 0,
    notes: S.casualties[0]?.notes,
    unit: S.comms.unit,
    tq: S.supplies.TQ,
    role: S.role,
    opMode: S.opMode,
    missionActive: S.missionActive,
    timelineCount: S.timeline.length,
  }));

  expect(restored).toEqual(snapshot.expected);
  expect(errors).toEqual([]);
});

test('mesh QR roundtrip merges full payload without truncation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await startMission(page);

  const meshBundle = await page.evaluate(async () => {
    quickAddCas();
    const casualty = S.casualties[0];
    casualty.name = 'Mesh Sender';
    casualty.priority = 'T2';
    casualty.notes = 'mesh note';
    S.timeline.push({ ms: Date.now(), text: 'mesh timeline item' });
    await meshExport();
    return {
      chunks: [..._meshExportBundle.chunks].reverse(),
      expectedName: casualty.name,
      expectedTimelineText: 'mesh timeline item',
    };
  });

  await page.evaluate(async (chunks) => {
    S.casualties = [{
      id: 999001,
      name: 'Local Only',
      priority: 'T3',
      vitalsHistory: [],
      photos: [],
      injuries: [],
      tqStart: null,
      txList: [],
      fluids: [],
      fluidTotal: 0,
      allergy: '',
      medic: '',
      buddyName: '',
      idNum: '',
      evacType: '',
      mech: [],
      blood: '',
      kg: 70,
      notes: '',
      vitals: { pulse: '', spo2: '', bp: '', rr: '', gcs: '15', upva: 'U' },
      march: { M: 0, A: 0, R: 0, C: 0, H: 0 },
      _addedAt: Date.now(),
    }];
    S.timeline = [{ ms: Date.now(), text: 'local timeline item' }];
    _resetQRScanState();
    window.confirm = () => true;
    for (const chunk of chunks) await _handleScanResult(chunk);
    importScannedQR();
  }, meshBundle.chunks);

  const merged = await page.evaluate(() => ({
    casualtyNames: S.casualties.map(c => c.name).sort(),
    timelineCount: S.timeline.length,
  }));

  expect(merged.casualtyNames).toContain('Local Only');
  expect(merged.casualtyNames).toContain(meshBundle.expectedName);
  expect(merged.timelineCount).toBeGreaterThanOrEqual(2);
  expect(errors).toEqual([]);
});

test('QR image fallback imports state when camera permission is unavailable', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await startMission(page);

  const snapshot = await page.evaluate(() => {
    quickAddCas();
    const casualty = S.casualties[0];
    casualty.name = 'Image Fallback';
    casualty.priority = 'T1';
    casualty.txList = ['TQ'];
    casualty.notes = 'from-image';
    S.comms.unit = 'IMG UNIT';
    return {
      expectedName: casualty.name,
      expectedTxCount: casualty.txList.length,
      expectedUnit: S.comms.unit,
    };
  });

  const chunks = await page.evaluate(async () => {
    const pack = await _buildStateExportPacket();
    const bundle = await _buildQRBundle(pack);
    return [...bundle.chunks].reverse();
  });

  await page.evaluate(() => {
    S.force = [];
    S.casualties = [];
    S.timeline = [];
    S.comms = {};
    S.supplies = {};
    S.role = null;
    S.opMode = null;
    S.missionActive = false;
    S.missionStart = null;
  });

  await page.evaluate(() => { startQRScan(); });
  await page.evaluate(async (parts) => {
    window.confirm = () => true;
    for (const part of parts) {
      await _handleScanResult(part);
    }
  }, chunks);
  await page.waitForTimeout(300);
  await page.evaluate(() => { importScannedQR(); });

  const restored = await page.evaluate(() => ({
    name: S.casualties[0]?.name,
    txCount: S.casualties[0]?.txList?.length || 0,
    unit: S.comms.unit,
  }));

  expect(restored.name).toBe(snapshot.expectedName);
  expect(restored.txCount).toBe(snapshot.expectedTxCount);
  expect(restored.unit).toBe(snapshot.expectedUnit);
  expect(errors).toEqual([]);
});
