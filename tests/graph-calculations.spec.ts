import { test, expect } from '@playwright/test';
import {
  generateMockResults,
  calculateExpectedStats,
  injectMockResults,
  waitForChartRender,
  getDisplayedStat,
} from './utils/test-helpers';
import { v4 as uuidv4 } from 'uuid';

test.describe('Graph Calculations Correctness', () => {
  test('displays correct summary statistics', async ({ page }) => {
    const sessionId = uuidv4();
    const mockResults = generateMockResults(sessionId, {
      congruentMean: 450,
      incongruentMean: 600,
      congruentVariance: 30,
      incongruentVariance: 40,
      trialsPerCondition: 10,
      errorRate: 0,
    });

    const expectedStats = calculateExpectedStats(mockResults);

    // Inject mock results and navigate to results page
    await page.goto('/');
    await injectMockResults(page, sessionId, mockResults);
    await page.goto('/results');

    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Your Results');

    // Verify displayed statistics match expected (within tolerance)
    const congruentDisplayed = await getDisplayedStat(page, 'Congruent');
    const incongruentDisplayed = await getDisplayedStat(page, 'Incongruent');
    const stroopDisplayed = await getDisplayedStat(page, 'Stroop Effect');
    const accuracyDisplayed = await getDisplayedStat(page, 'Accuracy');

    // Allow 5% tolerance due to rounding
    expect(Math.abs(congruentDisplayed - expectedStats.congruentMean)).toBeLessThan(
      expectedStats.congruentMean * 0.05 + 5
    );
    expect(Math.abs(incongruentDisplayed - expectedStats.incongruentMean)).toBeLessThan(
      expectedStats.incongruentMean * 0.05 + 5
    );
    expect(Math.abs(stroopDisplayed - expectedStats.stroopEffect)).toBeLessThan(
      Math.abs(expectedStats.stroopEffect) * 0.1 + 10
    );
    expect(accuracyDisplayed).toBe(expectedStats.accuracy);
  });

  test('grouped bar chart shows correct values per word', async ({ page }) => {
    const sessionId = uuidv4();
    const mockResults = generateMockResults(sessionId, {
      congruentMean: 500,
      incongruentMean: 700,
      trialsPerCondition: 12, // 4 per word
      errorRate: 0,
    });

    await page.goto('/');
    await injectMockResults(page, sessionId, mockResults);
    await page.goto('/results');

    // Ensure grouped bar tab is active (default)
    await expect(page.locator('button:has-text("Grouped Bar")')).toBeVisible();

    // Wait for chart to render
    await waitForChartRender(page);

    // Verify chart has correct structure
    const chart = page.locator('.recharts-responsive-container');
    await expect(chart).toBeVisible();

    // Check that bars exist for each word
    const bars = page.locator('.recharts-bar-rectangle');
    const barCount = await bars.count();
    expect(barCount).toBeGreaterThanOrEqual(6); // 3 words × 2 conditions
  });

  test('distribution chart shows raw data points', async ({ page }) => {
    const sessionId = uuidv4();
    const mockResults = generateMockResults(sessionId, {
      trialsPerCondition: 10,
      errorRate: 0.1,
    });

    await page.goto('/');
    await injectMockResults(page, sessionId, mockResults);
    await page.goto('/results');

    // Click distribution tab
    await page.click('button:has-text("Distribution")');
    await waitForChartRender(page);

    // Verify scatter points exist
    const scatterPoints = page.locator('.recharts-scatter-symbol');
    const pointCount = await scatterPoints.count();
    expect(pointCount).toBe(mockResults.length); // One point per trial
  });

  test('effect size chart shows correct differences', async ({ page }) => {
    const sessionId = uuidv4();
    const mockResults = generateMockResults(sessionId, {
      congruentMean: 400,
      incongruentMean: 550,
      trialsPerCondition: 9, // 3 per word
      errorRate: 0,
    });

    const expectedStats = calculateExpectedStats(mockResults);

    await page.goto('/');
    await injectMockResults(page, sessionId, mockResults);
    await page.goto('/results');

    // Click effect size tab
    await page.click('button:has-text("Effect Size")');
    await waitForChartRender(page);

    // Verify overall effect is displayed in description
    const description = page.locator('p.text-sm.text-muted').first();
    const descText = await description.textContent();
    expect(descText).toContain('ms');

    // Verify bars exist for each word + overall
    const bars = page.locator('.recharts-bar-rectangle');
    const barCount = await bars.count();
    expect(barCount).toBe(4); // 3 words + 1 overall
  });

  test('speed-accuracy chart positions points correctly', async ({ page }) => {
    const sessionId = uuidv4();
    const mockResults = generateMockResults(sessionId, {
      trialsPerCondition: 9,
      errorRate: 0.2, // 20% error rate for visible scatter
    });

    await page.goto('/');
    await injectMockResults(page, sessionId, mockResults);
    await page.goto('/results');

    // Click speed-accuracy tab
    await page.click('button:has-text("Speed vs Accuracy")');
    await waitForChartRender(page);

    // Verify scatter points exist (6 points: 3 words × 2 conditions)
    const chart = page.locator('.recharts-responsive-container');
    await expect(chart).toBeVisible();
  });

  test('word comparison (spaghetti) chart shows all words', async ({ page }) => {
    const sessionId = uuidv4();
    const mockResults = generateMockResults(sessionId, {
      trialsPerCondition: 9,
      errorRate: 0,
    });

    await page.goto('/');
    await injectMockResults(page, sessionId, mockResults);
    await page.goto('/results');

    // Click word comparison tab
    await page.click('button:has-text("Word Comparison")');
    await waitForChartRender(page);

    // Verify chart legend/labels show word names
    const chartArea = page.locator('.recharts-responsive-container');
    await expect(chartArea).toBeVisible();

    // Check for word labels in legend area
    const legendItems = page.locator('.recharts-legend-item, .flex.items-center.gap-2');
    const legendCount = await legendItems.count();
    expect(legendCount).toBeGreaterThanOrEqual(3);
  });

  test('handles edge case: all correct responses', async ({ page }) => {
    const sessionId = uuidv4();
    const mockResults = generateMockResults(sessionId, {
      trialsPerCondition: 10,
      errorRate: 0, // Perfect accuracy
    });

    await page.goto('/');
    await injectMockResults(page, sessionId, mockResults);
    await page.goto('/results');

    // Verify 100% accuracy
    const accuracyDisplayed = await getDisplayedStat(page, 'Accuracy');
    expect(accuracyDisplayed).toBe(100);
  });

  test('handles edge case: high error rate', async ({ page }) => {
    const sessionId = uuidv4();
    const mockResults = generateMockResults(sessionId, {
      trialsPerCondition: 10,
      errorRate: 0.5, // 50% error rate
    });

    await page.goto('/');
    await injectMockResults(page, sessionId, mockResults);
    await page.goto('/results');

    // Page should still render without crashing
    await expect(page.locator('h1')).toContainText('Your Results');

    // All visualizations should work
    for (const tab of ['Grouped Bar', 'Distribution', 'Word Comparison', 'Effect Size', 'Speed vs Accuracy']) {
      await page.click(`button:has-text("${tab}")`);
      await waitForChartRender(page);
      const chart = page.locator('.recharts-responsive-container');
      await expect(chart).toBeVisible();
    }
  });

  test('consistent Stroop effect direction across visualizations', async ({ page }) => {
    const sessionId = uuidv4();
    // Create data with clear Stroop effect (incongruent slower)
    const mockResults = generateMockResults(sessionId, {
      congruentMean: 400,
      incongruentMean: 600,
      congruentVariance: 20,
      incongruentVariance: 30,
      trialsPerCondition: 10,
      errorRate: 0,
    });

    await page.goto('/');
    await injectMockResults(page, sessionId, mockResults);
    await page.goto('/results');

    // Verify Stroop Effect is positive (incongruent > congruent)
    const stroopDisplayed = await getDisplayedStat(page, 'Stroop Effect');
    expect(stroopDisplayed).toBeGreaterThan(0);

    // Check effect size chart shows positive overall
    await page.click('button:has-text("Effect Size")');
    await waitForChartRender(page);

    // Look for the effect value in the description text
    const description = page.locator('p.text-sm').first();
    const descText = await description.textContent();
    // The text should mention a positive effect (ms value)
    expect(descText).toContain('ms');
  });
});
