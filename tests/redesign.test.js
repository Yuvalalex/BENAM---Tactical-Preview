const { test, expect } = require('@playwright/test');

test('prep tabs, stats tabs, and report navigation render correctly', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('dialog', d => d.accept());

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.evaluate(() => skipRoleSetup());
  await page.waitForTimeout(300);

  // Test prep sub-tabs
  await page.evaluate(() => setPrepTab('force'));
  await page.waitForTimeout(200);
  const forceVisible = await page.evaluate(() => {
    const el = document.querySelector('.prep-grp-force');
    return el ? getComputedStyle(el).display !== 'none' : false;
  });
  const commsHidden = await page.evaluate(() => {
    const el = document.querySelector('.prep-grp-comms');
    return el ? getComputedStyle(el).display === 'none' : false;
  });
  await page.evaluate(() => setPrepTab('comms'));
  await page.waitForTimeout(200);

  // Test stats sub-tabs
  await page.evaluate(() => setStatsTab('export'));
  await page.waitForTimeout(200);
  const exportVisible = await page.evaluate(() => {
    const el = document.querySelector('.stats-grp-export');
    return el ? getComputedStyle(el).display !== 'none' : false;
  });

  // Test 3-tab nav
  const navCount = await page.evaluate(() =>
    document.querySelectorAll('#bottomnav .nav-btn').length
  );

  // Start mission and test goReportTools
  await page.evaluate(() => { _doStartMission(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => goReportTools());
  await page.waitForTimeout(300);
  const reportVisible = await page.evaluate(() => {
    const el = document.getElementById('sc-report');
    return el ? el.classList.contains('active') : false;
  });

  const results = {
    forceVisible,
    commsHidden,
    exportVisible,
    navCount,
    reportVisible,
    errors
  };
  console.log(JSON.stringify(results, null, 2));

  expect(forceVisible).toBe(true);
  expect(commsHidden).toBe(true);
  expect(exportVisible).toBe(true);
  expect(navCount).toBe(3);
  expect(reportVisible).toBe(true);
  expect(errors).toEqual([]);
});
