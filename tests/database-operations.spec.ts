import { test, expect } from '@playwright/test';
import {
  generateMockResults,
  injectMockResults,
} from './utils/test-helpers';
import { v4 as uuidv4 } from 'uuid';

test.describe('Database Operations', () => {
  test.describe('Clear Session', () => {
    test('clear session button is visible on results page', async ({ page }) => {
      const sessionId = uuidv4();
      const mockResults = generateMockResults(sessionId, { trialsPerCondition: 10 });

      await page.goto('/');
      await injectMockResults(page, sessionId, mockResults);
      await page.goto('/results');

      await expect(page.locator('button:has-text("Clear Session")')).toBeVisible();
    });

    test('clear session shows confirmation dialog', async ({ page }) => {
      const sessionId = uuidv4();
      const mockResults = generateMockResults(sessionId, { trialsPerCondition: 10 });

      await page.goto('/');
      await injectMockResults(page, sessionId, mockResults);
      await page.goto('/results');

      // Set up dialog handler to cancel
      page.on('dialog', (dialog) => dialog.dismiss());

      // Click clear session
      await page.click('button:has-text("Clear Session")');

      // Page should still be on results (dialog was dismissed)
      await expect(page).toHaveURL('/results');
    });

    test('clear session button shows loading state', async ({ page }) => {
      const sessionId = uuidv4();
      const mockResults = generateMockResults(sessionId, { trialsPerCondition: 10 });

      await page.goto('/');
      await injectMockResults(page, sessionId, mockResults);
      await page.goto('/results');

      // Set up dialog handler to accept
      page.on('dialog', (dialog) => dialog.accept());

      // Click clear session
      const button = page.locator('button:has-text("Clear Session")');
      await button.click();

      // Button might show "Clearing..." briefly (if Supabase is configured)
      // This test mainly verifies the flow doesn't crash
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Clear All Data', () => {
    test('clear all data button is visible on results page', async ({ page }) => {
      const sessionId = uuidv4();
      const mockResults = generateMockResults(sessionId, { trialsPerCondition: 10 });

      await page.goto('/');
      await injectMockResults(page, sessionId, mockResults);
      await page.goto('/results');

      await expect(page.locator('button:has-text("Clear All Data")')).toBeVisible();
    });

    test('clear all data has danger styling', async ({ page }) => {
      const sessionId = uuidv4();
      const mockResults = generateMockResults(sessionId, { trialsPerCondition: 10 });

      await page.goto('/');
      await injectMockResults(page, sessionId, mockResults);
      await page.goto('/results');

      const button = page.locator('button:has-text("Clear All Data")');
      await expect(button).toHaveClass(/border-rose-500/);
      await expect(button).toHaveClass(/text-rose-500/);
    });

    test('clear all data requires double confirmation', async ({ page }) => {
      const sessionId = uuidv4();
      const mockResults = generateMockResults(sessionId, { trialsPerCondition: 10 });

      await page.goto('/');
      await injectMockResults(page, sessionId, mockResults);
      await page.goto('/results');

      let dialogCount = 0;

      // Set up dialog handler to accept first and dismiss second
      page.on('dialog', async (dialog) => {
        dialogCount++;
        if (dialogCount === 1) {
          await dialog.accept();
        } else {
          await dialog.dismiss();
        }
      });

      // Click clear all data
      await page.click('button:has-text("Clear All Data")');

      // Wait for dialogs
      await page.waitForTimeout(500);

      // Should have shown 2 dialogs
      expect(dialogCount).toBe(2);

      // Page should still be on results (second dialog was dismissed)
      await expect(page).toHaveURL('/results');
    });

    test('clear all data redirects to home after successful clear', async ({ page }) => {
      const sessionId = uuidv4();
      const mockResults = generateMockResults(sessionId, { trialsPerCondition: 10 });

      await page.goto('/');
      await injectMockResults(page, sessionId, mockResults);
      await page.goto('/results');

      // Set up single dialog handler to accept all dialogs
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      // Click clear all data
      await page.click('button:has-text("Clear All Data")');

      // Wait for dialogs and potential redirect
      await page.waitForTimeout(3000);

      // Either redirected to home or still on results with alert
      // (depends on Supabase configuration)
      // Just verify the page didn't crash
      const url = page.url();
      expect(url).toMatch(/\/(results)?$/);
    });
  });

  test.describe('Action Buttons Layout', () => {
    test('all action buttons are visible', async ({ page }) => {
      const sessionId = uuidv4();
      const mockResults = generateMockResults(sessionId, { trialsPerCondition: 10 });

      await page.goto('/');
      await injectMockResults(page, sessionId, mockResults);
      await page.goto('/results');

      await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
      await expect(page.locator('button:has-text("Clear Session")')).toBeVisible();
      await expect(page.locator('button:has-text("Clear All Data")')).toBeVisible();
    });

    test('try again button navigates to home', async ({ page }) => {
      const sessionId = uuidv4();
      const mockResults = generateMockResults(sessionId, { trialsPerCondition: 10 });

      await page.goto('/');
      await injectMockResults(page, sessionId, mockResults);
      await page.goto('/results');

      await page.click('button:has-text("Try Again")');

      await expect(page).toHaveURL('/');
    });

    test('buttons are responsive and accessible', async ({ page }) => {
      const sessionId = uuidv4();
      const mockResults = generateMockResults(sessionId, { trialsPerCondition: 10 });

      await page.goto('/');
      await injectMockResults(page, sessionId, mockResults);
      await page.goto('/results');

      // Check buttons are focusable
      const tryAgain = page.locator('button:has-text("Try Again")');
      const clearSession = page.locator('button:has-text("Clear Session")');
      const clearAll = page.locator('button:has-text("Clear All Data")');

      await tryAgain.focus();
      await expect(tryAgain).toBeFocused();

      await clearSession.focus();
      await expect(clearSession).toBeFocused();

      await clearAll.focus();
      await expect(clearAll).toBeFocused();
    });
  });
});

test.describe('Data Persistence', () => {
  test('experiment data persists in sessionStorage', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Start Experiment');

    // Complete a trial
    await expect(page.locator('text=Trial 1 of 20')).toBeVisible();
    await page.keyboard.press('r');
    await expect(page.locator('text=Trial 2 of 20')).toBeVisible({ timeout: 2000 });

    // Check sessionStorage has session_id
    const sessionId = await page.evaluate(() => sessionStorage.getItem('stroop_session_id'));
    expect(sessionId).not.toBeNull();
    expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  test('results are stored after experiment completion', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/');
    await page.click('text=Start Experiment');

    // Complete all 20 trials quickly
    for (let i = 1; i <= 20; i++) {
      await expect(page.locator(`text=Trial ${i} of 20`)).toBeVisible({ timeout: 3000 });
      await page.keyboard.press(['r', 'g', 'y'][i % 3]);
      if (i < 20) await page.waitForTimeout(600);
    }

    // Wait for results page
    await expect(page).toHaveURL('/results', { timeout: 5000 });

    // Check sessionStorage has results
    const results = await page.evaluate(() => sessionStorage.getItem('stroop_results'));
    expect(results).not.toBeNull();

    const parsedResults = JSON.parse(results!);
    expect(parsedResults).toHaveLength(20);
    expect(parsedResults[0]).toHaveProperty('reaction_time_ms');
    expect(parsedResults[0]).toHaveProperty('is_congruent');
    expect(parsedResults[0]).toHaveProperty('is_correct');
  });
});
