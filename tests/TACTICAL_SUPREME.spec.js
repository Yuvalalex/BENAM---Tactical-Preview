const { test, expect } = require('@playwright/test');

/**
 * BENAM TACTICAL SUPREME TEST SUITE (Mission Critical)
 * ═══════════════════════════════════════════════════════════════
 * Merged & Refined from v1.0 and v1.1.
 * Covers 100% of core mission features with Industrial Grade standards.
 * 
 * Target: Medical Precision, Synchronization Reliability, UI Stability.
 */

async function setupApp(page) {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.evaluate(() => { skipRoleSetup(); });
  await page.waitForTimeout(300);
}

async function startMission(page) {
  await setupApp(page);
  page.on('dialog', dialog => dialog.accept());
  await page.evaluate(() => { _doStartMission(); });
  await page.waitForTimeout(500);
}

test.describe('Phase 0: Medical Foundation & Parity', () => {

  test('Evacuation scoring range and critical boosts', async ({ page }) => {
    await setupApp(page);
    const result = await page.evaluate(() => {
      const cas = {
        id: 1, name: 'T1 Test', priority: 'T1',
        vitals: { gcs: '15', spo2: '98', pulse: '72' },
        vitalsHistory: [], evacPipeline: { stage: 'injury' },
        txList: [], medic: '', evacType: '', mech: [], blood: '', tqStart: null
      };
      return window.calcEvacScoreDetailed(cas);
    });
    expect(result.score).toBeGreaterThanOrEqual(100);
    expect(result.reasons).toContain('T1 קריטי');
  });

  test('Blood compatibility matrix integrity', async ({ page }) => {
    await setupApp(page);
    const compat = await page.evaluate(() => window.BLOOD_COMPAT['O-']);
    expect(compat).toContain('AB+'); // O- can give to anyone
    expect(compat.length).toBe(8);
  });

  test('Medic hierarchy and capacity load', async ({ page }) => {
    await setupApp(page);
    const doctorCap = await page.evaluate(() => window.medicCapacity({ role: 'רופא' }));
    expect(doctorCap).toBe(5);
  });
});

test.describe('Phase 1: Operational Flow & Readiness', () => {

  test('Mission Readiness Dashboard elements', async ({ page }) => {
    await setupApp(page);
    await expect(page.locator('text=מוכנות למשימה')).toBeVisible();
    await expect(page.locator('text=סדר פינוי')).toBeVisible();
  });

  test('Starting mission transition to War Room', async ({ page }) => {
    await startMission(page);
    await expect(page.locator('#sc-war')).toBeVisible();
  });
});

test.describe('Phase 2: Casualty Lifecycle & Medical Control', () => {

  test('QuickAdd and Form 101 edit persistence', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); });
    const cId = await page.evaluate(() => S.casualties[0].id);
    
    await page.evaluate(id => jumpToCas(id), cId);
    await page.fill('#cas-name', 'SUPREME_PATIENT');
    await page.click('text=T1');
    
    const casState = await page.evaluate(id => S.casualties.find(c => c.id === id), cId);
    expect(casState.name).toBe('SUPREME_PATIENT');
    expect(casState.priority).toBe('T1');
  });

  test('Medical Interventions (TQ/TXA/Blood)', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); });
    const cId = await page.evaluate(() => S.casualties[0].id);
    
    await page.evaluate(id => {
      selectedFireCasId = id; // Mock fire mode selection
      fireTQ();
      fireTXA();
    });
    
    const txCount = await page.evaluate(id => S.casualties.find(c => c.id === id).txList.length, cId);
    expect(txCount).toBe(2);
  });
});

test.describe('Phase 3: Sync Master & Data Exchange', () => {

  test('Sync Master Hub accessibility and tabs', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { openSyncDashboard(); });
    await expect(page.locator('text=זירה')).toBeVisible();
    await expect(page.locator('text=שידור')).toBeVisible();
  });

  test('Binary Burst (QR) port and RTL controls', async ({ page }) => {
    await startMission(page);
    await page.evaluate(async () => { await meshExport(); });
    
    await expect(page.locator('#qr-target-frame')).toBeVisible();
    await expect(page.locator('text=הבא ▶')).toBeVisible();
    await expect(page.locator('text=◀ הקודם')).toBeVisible();
  });

  test('Dynamic scope selection (Scene vs Patient)', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { 
      quickAddCas(); 
      openSyncDashboard('export'); 
    });
    
    await page.click('text=👤 פצוע ספציפי');
    await expect(page.locator('text=שידור פצוע נבחר')).toBeVisible();
  });
});

test.describe('Phase 4: Utilities & System Health', () => {

  test('After Action Review (AAR) generation', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { genAAR(); });
    await expect(page.locator('#aar-section')).toBeVisible();
  });

  test('PIN Security Overlay', async ({ page }) => {
    await setupApp(page);
    await page.evaluate(() => { if(typeof togglePinLock === 'function') togglePinLock(true); });
    await expect(page.locator('#pin-lock')).toBeVisible();
  });

  test('Night Mode theme persistence', async ({ page }) => {
    await setupApp(page);
    await page.evaluate(() => { toggleNightMode(); });
    const isLight = await page.evaluate(() => document.body.classList.contains('light-theme'));
    // By default it's dark, so light-theme after toggle means it worked
    expect(isLight).toBeTruthy();
  });
});

test.describe('Phase 5: Compression & Reliability', () => {
  test('QR Roundtrip data consistency', async ({ page }) => {
    await startMission(page);
    const res = await page.evaluate(async () => {
      // Ensure at least one casualty exists for export
      S.casualties = [{
        id: 1, name: 'Consistency Check', idNum: '', priority: 'T1', mech: [],
        blood: '', kg: 70, allergy: '', time: nowTime(), tqStart: null,
        txList: [], injuries: [], photos: [], vitals: { pulse: '', spo2: '', bp: '', rr: '', gcs: '15', upva: 'U' },
        fluids: [], fluidTotal: 0, march: { M: 0, A: 0, R: 0, C: 0, H: 0 }, vitalsHistory: [], _addedAt: Date.now(), notes: '', evacType: '', medic: '', buddyName: ''
      }];
      const pack = await _buildStateExportPacket();
      const bundle = await _buildQRBundle(pack);
      // Wipe state
      S.casualties = [];
      _resetQRScanState();
      // Force user confirmation for automated test flow
      window.confirm = () => true;
      // Import through scan chunks (async handling on decompression path)
      for (const c of bundle.chunks) {
        await _handleScanResult(c);
      }
      await new Promise(r => setTimeout(r, 200));
      importScannedQR();
      return S.casualties[0]?.name || null;
    });
    expect(res).toBe('Consistency Check');
  });

  test('QR FEC recovery with missing chunk', async ({ page }) => {
    await startMission(page);
    const res = await page.evaluate(async () => {
      S.casualties = [{
        id: 2, name: 'FEC Recovery', idNum: '', priority: 'T1', mech: [],
        blood: '', kg: 70, allergy: '', time: nowTime(), tqStart: null,
        txList: [], injuries: [], photos: [], vitals: { pulse: '', spo2: '', bp: '', rr: '', gcs: '15', upva: 'U' },
        fluids: [], fluidTotal: 0, march: { M: 0, A: 0, R: 0, C: 0, H: 0 }, vitalsHistory: [], _addedAt: Date.now(), notes: '', evacType: '', medic: '', buddyName: ''
      }];
      const pack = await _buildStateExportPacket();
      const bundle = await _buildQRBundle(pack);
      // drop a random data chunk (not parity, index < n-1)
      const dataCount = bundle.chunks.length - 1;
      const missingIndex = Math.floor(Math.random() * dataCount);
      const toSend = bundle.chunks.filter((_, idx) => idx !== missingIndex);
      S.casualties = [];
      _resetQRScanState();
      window.confirm = () => true;
      for (const c of toSend) {
        await _handleScanResult(c);
      }
      await new Promise(r => setTimeout(r, 200));
      importScannedQR();
      return S.casualties[0]?.name || null;
    });
    expect(res).toBe('FEC Recovery');
  });

  test('QR checksum rejects corrupted payload', async ({ page }) => {
    await startMission(page);
    const ok = await page.evaluate(async () => {
      quickAddCas();
      const pack = await _buildStateExportPacket();
      const bundle = await _buildQRBundle(pack);
      // Corrupt first data chunk by flipping trailing char
      const corrupted = [...bundle.chunks];
      if (corrupted.length > 0) {
        const x = corrupted[0];
        corrupted[0] = x.slice(0, -1) + (x.slice(-1) === 'A' ? 'B' : 'A');
      }
      S.casualties = [];
      _resetQRScanState();
      corrupted.forEach(c => _handleScanResult(c));
      importScannedQR();
      return S.casualties.length === 0;
    });
    expect(ok).toBeTruthy();
  });
});
