import { test, expect } from '@playwright/test';

test.describe('Experiment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('landing page displays correctly', async ({ page }) => {
    // Check title and main elements
    await expect(page.locator('h1')).toContainText('Stroop Lab');
    await expect(page.locator('text=Start Experiment')).toBeVisible();
    await expect(page.locator('text=Instructions')).toBeVisible();

    // Check keyboard shortcut info in kbd elements
    await expect(page.locator('kbd:has-text("Y")')).toBeVisible();
    await expect(page.locator('kbd:has-text("G")')).toBeVisible();
    await expect(page.locator('kbd:has-text("R")')).toBeVisible();
  });

  test('can start experiment and see first trial', async ({ page }) => {
    // Click start button
    await page.click('button:has-text("Start Experiment")');

    // Should navigate to experiment page
    await expect(page).toHaveURL('/experiment');

    // Should show trial progress
    await expect(page.locator('text=Trial 1 of 20')).toBeVisible();

    // Should show response buttons (specific styling)
    await expect(page.locator('button:has-text("Y")').first()).toBeVisible();
    await expect(page.locator('button:has-text("G")').first()).toBeVisible();
    await expect(page.locator('button:has-text("R")').first()).toBeVisible();

    // Should show a color word (one of red, green, yellow)
    const wordElement = page.locator('span.uppercase').first();
    await expect(wordElement).toBeVisible();
    const wordText = await wordElement.textContent();
    expect(['RED', 'GREEN', 'YELLOW']).toContain(wordText?.toUpperCase());
  });

  test('responds to keyboard shortcuts', async ({ page }) => {
    await page.click('text=Start Experiment');
    await expect(page).toHaveURL('/experiment');

    // Wait for first trial
    await expect(page.locator('text=Trial 1 of 20')).toBeVisible();

    // Press a response key
    await page.keyboard.press('r');

    // Should advance to trial 2 (with brief delay)
    await expect(page.locator('text=Trial 2 of 20')).toBeVisible({ timeout: 2000 });
  });

  test('responds to button clicks', async ({ page }) => {
    await page.click('text=Start Experiment');
    await expect(page).toHaveURL('/experiment');

    // Wait for first trial
    await expect(page.locator('text=Trial 1 of 20')).toBeVisible();

    // Click a response button
    await page.click('button:has-text("G")');

    // Should advance to trial 2
    await expect(page.locator('text=Trial 2 of 20')).toBeVisible({ timeout: 2000 });
  });

  test('can restart experiment mid-session', async ({ page }) => {
    await page.click('text=Start Experiment');
    await expect(page).toHaveURL('/experiment');

    // Complete a few trials
    await page.keyboard.press('r');
    await expect(page.locator('text=Trial 2 of 20')).toBeVisible({ timeout: 2000 });
    await page.keyboard.press('g');
    await expect(page.locator('text=Trial 3 of 20')).toBeVisible({ timeout: 2000 });

    // Click restart
    await page.click('text=Restart');

    // Should reset to trial 1
    await expect(page.locator('text=Trial 1 of 20')).toBeVisible({ timeout: 2000 });
  });

  test('completes full experiment and navigates to results', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for full experiment

    await page.click('text=Start Experiment');
    await expect(page).toHaveURL('/experiment');

    // Complete all 20 trials
    for (let i = 1; i <= 20; i++) {
      await expect(page.locator(`text=Trial ${i} of 20`)).toBeVisible({ timeout: 3000 });

      // Respond with a random key
      const keys = ['r', 'g', 'y'];
      await page.keyboard.press(keys[i % 3]);

      // Small delay between trials
      if (i < 20) {
        await page.waitForTimeout(600);
      }
    }

    // Should navigate to results page
    await expect(page).toHaveURL('/results', { timeout: 5000 });
    await expect(page.locator('h1')).toContainText('Your Results');
  });

  test('redirects to home if no session on experiment page', async ({ page }) => {
    // Try to access experiment page directly without starting
    await page.goto('/experiment');

    // Should redirect to home
    await expect(page).toHaveURL('/');
  });

  test('redirects to home if no results on results page', async ({ page }) => {
    // Try to access results page directly without completing experiment
    await page.goto('/results');

    // Should redirect to home
    await expect(page).toHaveURL('/');
  });
});
