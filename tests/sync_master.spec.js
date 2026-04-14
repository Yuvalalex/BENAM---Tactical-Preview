const { test, expect } = require('@playwright/test');

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

test.describe('Sync Master Hub', () => {

  test('Sync Master dashboard opens and shows all tabs', async ({ page }) => {
    await startMission(page);
    
    // Open Dashboard
    await page.evaluate(() => { openSyncDashboard(); });
    await expect(page.locator('#modal-title')).toContainText('מרכז סנכרון מאוחד');
    
    // Check Tabs
    await expect(page.locator('text=זירה')).toBeVisible();
    await expect(page.locator('text=שידור')).toBeVisible();
    await expect(page.locator('text=קליטה')).toBeVisible();
  });

  test('Tab switching works correctly', async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => { openSyncDashboard('mesh'); });
    
    // Click Export Tab
    await page.click('text=שידור');
    await expect(page.locator('text=שידור כל הזירה')).toBeVisible();
    
    // Click Scan Tab
    await page.click('text=קליטה');
    await expect(page.locator('text=קליטת נתונים (QR)')).toBeVisible();
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
    await page.click('text=👤 פצוע ספציפי');
    await expect(page.locator('text=שידור פצוע נבחר')).toBeVisible();
    await expect(page.locator('text=Patient Alpha')).toBeVisible();
    
    // Toggle back to All
    await page.click('text=🌍 הכל (זירה)');
    await expect(page.locator('text=שידור כל הזירה')).toBeVisible();
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
