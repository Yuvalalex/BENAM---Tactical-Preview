const { test, expect } = require('@playwright/test');

/**
 * COMPREHENSIVE TACTICAL SUITE - BENAM 1.1 (Industrial Grade)
 * Validates the entire mission lifecycle from Prep to AAR.
 */

test.describe('End-to-End Mission Validation', () => {

  async function startMission(page) {
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForTimeout(500);
    // Skip Role & Start
    await page.evaluate(() => { skipRoleSetup(); });
    page.on('dialog', dialog => dialog.accept());
    await page.evaluate(() => { _doStartMission(); });
    await page.waitForTimeout(500);
    await expect(page.locator('#sc-war')).toBeVisible();
  }

  test('01. Core Launch & Stability', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/', { waitUntil: 'load' });
    await expect(page.locator('#sc-role')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('02. Preparation & Readiness Hub', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.evaluate(() => { skipRoleSetup(); });
    await expect(page.locator('#sc-prep')).toBeVisible();
    
    // Verify Mission Readiness Dashboard
    await expect(page.locator('text=מוכנות למשימה')).toBeVisible();
    await expect(page.locator('text=סדר פינוי')).toBeVisible();
  });

  test('03. War Room Viewport Dynamics', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); });
    
    const views = ['matrix', 'triage', 'march', 'blood', 'cards'];
    for (const v of views) {
      await page.evaluate(m => setWarView(m), v);
      await page.waitForTimeout(100);
      // Verify active view indicator
      const isActive = await page.evaluate(m => document.querySelector(`[onclick="setWarView('${m}')"]`).classList.contains('active'), v);
      expect(isActive).toBeTruthy();
    }
  });

  test('04. High-Fidelity Casualty Management (Form 101)', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { quickAddCas(); });
    const cId = await page.evaluate(() => S.casualties[0].id);
    
    // Jump into Patient Drawer
    await page.evaluate(id => jumpToCas(id), cId);
    await expect(page.locator('#cas-drawer')).toBeVisible();
    
    // Edit Form 101 Fields
    await page.fill('#cas-name', 'STABLE_TEST_PATIENT');
    await page.click('text=T1'); // Priority change
    
    // Check Intervention logic
    await page.click('text=🩹 TQ');
    const interventions = await page.evaluate(id => S.casualties.find(c => c.id === id).txList.length, cId);
    expect(interventions).toBeGreaterThan(0);
  });

  test('05. Sync Master - Tactical Data Link', async ({ page }) => {
    await startMission(page);
    
    // Hub Accessibility
    await page.evaluate(() => { openSyncDashboard(); });
    await expect(page.locator('#modal-title')).toContainText('מרכז סנכרון מאוחד');
    
    // Binary Burst Portal Verification
    await page.click('text=שידור');
    await page.click('text=התחל שידור נל״ן (Burst)');
    await expect(page.locator('#qr-target-frame')).toBeVisible();
    await expect(page.locator('text=הבא ▶')).toBeVisible();
  });

  test('06. After Action Review (AAR) & Log Integrity', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { 
      quickAddCas(); 
      addTL(S.casualties[0].id, S.casualties[0].name, 'Test Log Event', 'red');
    });
    
    // Validate Log Entry
    const logs = await page.evaluate(() => S.timeline.length);
    expect(logs).toBeGreaterThan(0);
    
    // Generate Report
    await page.evaluate(() => { genReport(); });
    await expect(page.locator('#report-txt')).toContainText('MEDEVAC');
  });

  test('07. Global Utilities (PIN & System)', async ({ page }) => {
    await page.goto('/');
    // Night Mode Toggle
    const isDarkBefore = await page.evaluate(() => document.body.classList.contains('light-theme'));
    await page.evaluate(() => { toggleNightMode(); });
    const isDarkAfter = await page.evaluate(() => document.body.classList.contains('light-theme'));
    expect(isDarkBefore).not.toEqual(isDarkAfter);
    
    // PIN Lock Screen
    await page.evaluate(() => { if(typeof togglePinLock === 'function') togglePinLock(true); });
    // Verify Lock Overlay
    await expect(page.locator('#pin-lock')).toBeVisible();
  });

});
