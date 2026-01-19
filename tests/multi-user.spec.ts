import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import {
  generateMockResults,
  calculateExpectedStats,
  injectMockResults,
  clearSessionStorage,
} from './utils/test-helpers';
import { v4 as uuidv4 } from 'uuid';

test.describe('Multi-User Sessions', () => {
  test('different users have isolated sessions', async ({ browser }) => {
    // Create two separate browser contexts (simulating two users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // User 1 starts experiment
      await page1.goto('/');
      await page1.click('text=Start Experiment');
      await expect(page1).toHaveURL('/experiment');

      // User 2 starts experiment
      await page2.goto('/');
      await page2.click('text=Start Experiment');
      await expect(page2).toHaveURL('/experiment');

      // Both should be on Trial 1 independently
      await expect(page1.locator('text=Trial 1 of 20')).toBeVisible();
      await expect(page2.locator('text=Trial 1 of 20')).toBeVisible();

      // User 1 advances
      await page1.keyboard.press('r');
      await expect(page1.locator('text=Trial 2 of 20')).toBeVisible({ timeout: 2000 });

      // User 2 should still be on Trial 1
      await expect(page2.locator('text=Trial 1 of 20')).toBeVisible();

      // User 2 advances
      await page2.keyboard.press('g');
      await expect(page2.locator('text=Trial 2 of 20')).toBeVisible({ timeout: 2000 });
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('users see only their own results', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Create different mock data for each user
      const sessionId1 = uuidv4();
      const sessionId2 = uuidv4();

      // User 1: Fast responses
      const results1 = generateMockResults(sessionId1, {
        congruentMean: 300,
        incongruentMean: 400,
        trialsPerCondition: 10,
        errorRate: 0,
      });

      // User 2: Slow responses
      const results2 = generateMockResults(sessionId2, {
        congruentMean: 700,
        incongruentMean: 900,
        trialsPerCondition: 10,
        errorRate: 0,
      });

      // Inject results for each user
      await page1.goto('/');
      await injectMockResults(page1, sessionId1, results1);
      await page1.goto('/results');

      await page2.goto('/');
      await injectMockResults(page2, sessionId2, results2);
      await page2.goto('/results');

      // Verify different stats are displayed
      const statCard1 = page1.locator('.bg-card').filter({ hasText: 'Congruent' }).first();
      const statCard2 = page2.locator('.bg-card').filter({ hasText: 'Congruent' }).first();

      const congruent1 = await statCard1.locator('.text-2xl').textContent();
      const congruent2 = await statCard2.locator('.text-2xl').textContent();

      // Extract numbers
      const value1 = parseInt(congruent1?.replace(/[^0-9]/g, '') || '0', 10);
      const value2 = parseInt(congruent2?.replace(/[^0-9]/g, '') || '0', 10);

      // User 2 should have significantly higher RT
      expect(value2).toBeGreaterThan(value1 + 200);
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('session persists after page refresh', async ({ page }) => {
    const sessionId = uuidv4();
    const mockResults = generateMockResults(sessionId, {
      trialsPerCondition: 10,
      errorRate: 0,
    });

    const expectedStats = calculateExpectedStats(mockResults);

    // Inject results and view
    await page.goto('/');
    await injectMockResults(page, sessionId, mockResults);
    await page.goto('/results');

    // Verify initial display
    await expect(page.locator('h1')).toContainText('Your Results');

    // Refresh the page
    await page.reload();

    // Results should still be displayed
    await expect(page.locator('h1')).toContainText('Your Results');

    // Stats should be the same
    const statCard = page.locator('.bg-card').filter({ hasText: 'Congruent' }).first();
    const congruentAfter = await statCard.locator('.text-2xl').textContent();
    const valueAfter = parseInt(congruentAfter?.replace(/[^0-9]/g, '') || '0', 10);

    expect(Math.abs(valueAfter - expectedStats.congruentMean)).toBeLessThan(10);
  });

  test('new session replaces old session data', async ({ page }) => {
    // First session
    const sessionId1 = uuidv4();
    const results1 = generateMockResults(sessionId1, {
      congruentMean: 300,
      incongruentMean: 400,
      trialsPerCondition: 10,
      errorRate: 0,
    });

    await page.goto('/');
    await injectMockResults(page, sessionId1, results1);
    await page.goto('/results');

    // Get first session stats
    const statCard1 = page.locator('.bg-card').filter({ hasText: 'Congruent' }).first();
    const firstCongruent = await statCard1.locator('.text-2xl').textContent();
    const firstValue = parseInt(firstCongruent?.replace(/[^0-9]/g, '') || '0', 10);

    // Start new experiment (click Try Again)
    await page.click('button:has-text("Try Again")');
    await expect(page).toHaveURL('/');

    // Second session with different data
    const sessionId2 = uuidv4();
    const results2 = generateMockResults(sessionId2, {
      congruentMean: 800,
      incongruentMean: 1000,
      trialsPerCondition: 10,
      errorRate: 0,
    });

    await injectMockResults(page, sessionId2, results2);
    await page.goto('/results');

    // Get second session stats
    const statCard2 = page.locator('.bg-card').filter({ hasText: 'Congruent' }).first();
    const secondCongruent = await statCard2.locator('.text-2xl').textContent();
    const secondValue = parseInt(secondCongruent?.replace(/[^0-9]/g, '') || '0', 10);

    // Should be significantly different
    expect(secondValue).toBeGreaterThan(firstValue + 300);
  });

  test('concurrent users can complete experiments without interference', async ({ browser }) => {
    test.setTimeout(180000); // 3 minutes

    const NUM_USERS = 3;
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];

    try {
      // Create multiple browser contexts
      for (let i = 0; i < NUM_USERS; i++) {
        const ctx = await browser.newContext();
        contexts.push(ctx);
        pages.push(await ctx.newPage());
      }

      // Start all users on landing page
      await Promise.all(pages.map((p) => p.goto('/')));

      // All start experiment
      await Promise.all(pages.map((p) => p.click('text=Start Experiment')));

      // All should be on experiment page
      await Promise.all(
        pages.map((p) => expect(p).toHaveURL('/experiment'))
      );

      // Complete 5 trials each (concurrently)
      for (let trial = 1; trial <= 5; trial++) {
        // Wait for all to show current trial
        await Promise.all(
          pages.map((p) =>
            expect(p.locator(`text=Trial ${trial} of 20`)).toBeVisible({ timeout: 3000 })
          )
        );

        // All respond
        await Promise.all(
          pages.map((p, i) => {
            const keys = ['r', 'g', 'y'];
            return p.keyboard.press(keys[i % 3]);
          })
        );

        // Wait for next trial
        if (trial < 5) {
          await Promise.all(pages.map((p) => p.waitForTimeout(700)));
        }
      }

      // Verify all advanced correctly
      await Promise.all(
        pages.map((p) =>
          expect(p.locator('text=Trial 6 of 20')).toBeVisible({ timeout: 3000 })
        )
      );
    } finally {
      for (const ctx of contexts) {
        await ctx.close();
      }
    }
  });
});
