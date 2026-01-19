import { Page } from '@playwright/test';

export interface MockTrialResult {
  session_id: string;
  word_text: string;
  font_color: string;
  is_congruent: boolean;
  reaction_time_ms: number;
  user_response: string;
  is_correct: boolean;
}

export const COLORS = {
  red: '#f43f5e',
  green: '#34d399',
  yellow: '#fbbf24',
};

export const WORDS = ['red', 'green', 'yellow'] as const;

/**
 * Generate mock trial results with known statistics for validation
 */
export function generateMockResults(
  sessionId: string,
  options: {
    congruentMean?: number;
    incongruentMean?: number;
    congruentVariance?: number;
    incongruentVariance?: number;
    trialsPerCondition?: number;
    errorRate?: number;
  } = {}
): MockTrialResult[] {
  const {
    congruentMean = 500,
    incongruentMean = 650,
    congruentVariance = 50,
    incongruentVariance = 80,
    trialsPerCondition = 10,
    errorRate = 0.05,
  } = options;

  const results: MockTrialResult[] = [];

  // Generate congruent trials (word matches color)
  for (let i = 0; i < trialsPerCondition; i++) {
    const word = WORDS[i % WORDS.length];
    const rt = congruentMean + (Math.random() - 0.5) * 2 * congruentVariance;
    const isCorrect = Math.random() > errorRate;

    results.push({
      session_id: sessionId,
      word_text: word,
      font_color: COLORS[word],
      is_congruent: true,
      reaction_time_ms: Math.round(rt),
      user_response: isCorrect ? word : WORDS[(WORDS.indexOf(word) + 1) % 3],
      is_correct: isCorrect,
    });
  }

  // Generate incongruent trials (word doesn't match color)
  for (let i = 0; i < trialsPerCondition; i++) {
    const word = WORDS[i % WORDS.length];
    const colorIndex = (WORDS.indexOf(word) + 1) % 3;
    const colorName = WORDS[colorIndex];
    const rt = incongruentMean + (Math.random() - 0.5) * 2 * incongruentVariance;
    const isCorrect = Math.random() > errorRate;

    results.push({
      session_id: sessionId,
      word_text: word,
      font_color: COLORS[colorName],
      is_congruent: false,
      reaction_time_ms: Math.round(rt),
      user_response: isCorrect ? colorName : word, // Common error: responding to word instead of color
      is_correct: isCorrect,
    });
  }

  return results;
}

/**
 * Calculate expected statistics from mock results
 */
export function calculateExpectedStats(results: MockTrialResult[]) {
  const congruentCorrect = results.filter((r) => r.is_congruent && r.is_correct);
  const incongruentCorrect = results.filter((r) => !r.is_congruent && r.is_correct);

  const congruentMean =
    congruentCorrect.reduce((sum, r) => sum + r.reaction_time_ms, 0) / congruentCorrect.length;
  const incongruentMean =
    incongruentCorrect.reduce((sum, r) => sum + r.reaction_time_ms, 0) / incongruentCorrect.length;

  const stroopEffect = incongruentMean - congruentMean;
  const accuracy = (results.filter((r) => r.is_correct).length / results.length) * 100;

  // Calculate per-word stats
  const wordStats: Record<string, { congruentMean: number; incongruentMean: number; difference: number }> = {};

  for (const word of WORDS) {
    const wordCongruent = results.filter(
      (r) => r.word_text === word && r.is_congruent && r.is_correct
    );
    const wordIncongruent = results.filter(
      (r) => r.word_text === word && !r.is_congruent && r.is_correct
    );

    const wCongruentMean =
      wordCongruent.length > 0
        ? wordCongruent.reduce((sum, r) => sum + r.reaction_time_ms, 0) / wordCongruent.length
        : 0;
    const wIncongruentMean =
      wordIncongruent.length > 0
        ? wordIncongruent.reduce((sum, r) => sum + r.reaction_time_ms, 0) / wordIncongruent.length
        : 0;

    wordStats[word] = {
      congruentMean: Math.round(wCongruentMean),
      incongruentMean: Math.round(wIncongruentMean),
      difference: Math.round(wIncongruentMean - wCongruentMean),
    };
  }

  return {
    congruentMean: Math.round(congruentMean),
    incongruentMean: Math.round(incongruentMean),
    stroopEffect: Math.round(stroopEffect),
    accuracy: Math.round(accuracy),
    totalTrials: results.length,
    correctTrials: results.filter((r) => r.is_correct).length,
    wordStats,
  };
}

/**
 * Inject mock results into sessionStorage
 */
export async function injectMockResults(page: Page, sessionId: string, results: MockTrialResult[]) {
  await page.evaluate(
    ({ sessionId, results }) => {
      sessionStorage.setItem('stroop_session_id', sessionId);
      sessionStorage.setItem('stroop_results', JSON.stringify(results));
    },
    { sessionId, results }
  );
}

/**
 * Clear sessionStorage
 */
export async function clearSessionStorage(page: Page) {
  await page.evaluate(() => {
    sessionStorage.clear();
  });
}

/**
 * Wait for chart to render
 */
export async function waitForChartRender(page: Page, timeout = 5000) {
  await page.waitForSelector('.recharts-responsive-container', { timeout });
  // Additional wait for animations
  await page.waitForTimeout(500);
}

/**
 * Get displayed stat value from the dashboard
 */
export async function getDisplayedStat(page: Page, label: string): Promise<number> {
  // Find the stat card containing the label, then get the value
  const statCard = page.locator('.bg-card').filter({ hasText: label }).first();
  const valueText = await statCard.locator('.text-2xl').textContent();
  return parseInt(valueText?.replace(/[^0-9-]/g, '') || '0', 10);
}
