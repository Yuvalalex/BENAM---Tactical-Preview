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
  await page.evaluate(() => { skipRoleSetup(); });
  await page.waitForTimeout(300);
}

async function startMission(page) {
  await setupApp(page);
  page.on('dialog', dialog => dialog.accept());
  await page.evaluate(() => { _doStartMission(); });
  await page.waitForTimeout(500);
}

test.describe('Sync Master Hub', () => {

  test('Sync Master dashboard opens and shows all tabs', async ({ page }) => {
    await startMission(page);
    
    // Open Dashboard
    await page.evaluate(() => { openSyncDashboard(); });
    await expect(page.locator('#modal-title')).toContainText('מרכז סנכרון מאוחד');
    
    // Check Tabs
    const modalBody = page.locator('#modal-body');
    await expect(modalBody.getByText('📡 זירה', { exact: true })).toBeVisible();
    await expect(modalBody.getByText('📤 שידור', { exact: true })).toBeVisible();
    await expect(modalBody.getByText('📥 קליטה', { exact: true })).toBeVisible();
  });

  test('Tab switching works correctly', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { openSyncDashboard('mesh'); });
    const modalBody = page.locator('#modal-body');
    
    // Click Export Tab
    await modalBody.getByText('📤 שידור', { exact: true }).click();
    await expect(page.locator('text=מוכן לשידור טקטי')).toBeVisible();
    await expect(page.locator('text=צור רצף שידור (BURST)')).toBeVisible();
    
    // Click Scan Tab
    await modalBody.getByText('📥 קליטה', { exact: true }).click();
    await expect(page.locator('text=קליטת נתונים (Scanner)')).toBeVisible();
  });

  test('Export scope selector 🌍 vs 👤', async ({ page }) => {
    await startMission(page);
    // Add some casualties first
    await page.evaluate(() => { 
      quickAddCas(); 
      S.casualties[0].name = 'Patient Alpha';
    });
    
    await page.evaluate(() => { openSyncDashboard('export'); });
    
    // Toggle to Casualty Scope
    await page.locator('#modal-body').getByText('👤 פצוע ספציפי', { exact: true }).click();
    await expect.poll(async () => page.evaluate(() => window._burstScope || 'all')).toBe('cas');
    await expect(page.locator('text=Patient Alpha')).toBeVisible();
    
    // Toggle back to All
    await page.locator('#modal-body').getByText('🌍 הכל (זירה)', { exact: true }).click();
    await expect.poll(async () => page.evaluate(() => window._burstScope || 'all')).toBe('all');
    await expect(page.locator('text=מוכן לשידור טקטי')).toBeVisible();
  });

  test('Binary Burst (QR) modal sequence', async ({ page }) => {
    await startMission(page);
    await page.evaluate(async () => {
      quickAddCas();
      await meshExport();
    });
    
    // Verify Burst UI
    await expect(page.locator('#modal-title')).toContainText('Binary Burst');
    await expect(page.locator('#qr-target-frame')).toBeVisible();
    await expect(page.locator('text=חלק 1/')).toBeVisible();
    
    // Check Controls
    await expect(page.locator('#qr-auto-btn')).toBeVisible();
    await expect(page.locator('text=הבא ▶')).toBeVisible();
    await expect(page.locator('text=◀ הקודם')).toBeVisible();
  });

  test('Auto-Play speed selector integration', async ({ page }) => {
    await startMission(page);
    await page.evaluate(async () => { await meshExport(); });
    
    // Change speed to 1s
    await page.click('#spd-1000');
    const speedActive = await page.evaluate(() => _qrAutoSpeed);
    expect(speedActive).toBe(1000);
    
    // Start AutoPlay
    await page.click('#qr-auto-btn');
    await expect(page.locator('#qr-auto-btn')).toContainText('עצור');
  });

});
