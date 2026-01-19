'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ResultsChart } from '@/components/results-chart';
import { TrialResult, ResultsSummary } from '@/types';
import { calculateAverage } from '@/lib/timing';
import { RotateCcw, TrendingUp, Target, Clock, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function calculateSummary(results: TrialResult[]): ResultsSummary {
  const congruentTimes = results
    .filter((r) => r.is_congruent && r.is_correct)
    .map((r) => r.reaction_time_ms);

  const incongruentTimes = results
    .filter((r) => !r.is_congruent && r.is_correct)
    .map((r) => r.reaction_time_ms);

  const congruentAvg = calculateAverage(congruentTimes);
  const incongruentAvg = calculateAverage(incongruentTimes);
  const correctTrials = results.filter((r) => r.is_correct).length;

  return {
    congruentAvg,
    incongruentAvg,
    stroopEffect: incongruentAvg - congruentAvg,
    totalTrials: results.length,
    correctTrials,
    accuracy: (correctTrials / results.length) * 100,
  };
}

export default function ResultsPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<ResultsSummary | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    const storedResults = sessionStorage.getItem('stroop_results');
    const storedSessionId = sessionStorage.getItem('stroop_session_id');
    if (!storedResults) {
      router.push('/');
      return;
    }

    setSessionId(storedSessionId);

    try {
      const results: TrialResult[] = JSON.parse(storedResults);
      setSummary(calculateSummary(results));
    } catch {
      router.push('/');
    }
  }, [router]);

  const handleRestart = () => {
    sessionStorage.removeItem('stroop_session_id');
    sessionStorage.removeItem('stroop_results');
    router.push('/');
  };

  const handleClearResults = async () => {
    if (!sessionId) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this session\'s results from the database? This cannot be undone.'
    );

    if (!confirmed) return;

    setIsClearing(true);
    try {
      const { error } = await supabase
        .from('stroop_results')
        .delete()
        .eq('session_id', sessionId);

      if (error) {
        console.error('Failed to clear results:', error);
        alert('Failed to clear results. Please try again.');
      } else {
        alert('Results cleared from database successfully.');
      }
    } catch (err) {
      console.error('Error clearing results:', err);
      alert('Failed to clear results. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  if (!summary) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-muted">Loading results...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-3xl"
      >
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-2">
          Your Results
        </h1>
        <p className="text-muted text-center mb-8">
          Here&apos;s how your brain handled the Stroop Effect
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted text-sm mb-1">
              <Clock className="w-4 h-4" />
              <span>Congruent</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {Math.round(summary.congruentAvg)}ms
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted text-sm mb-1">
              <Clock className="w-4 h-4" />
              <span>Incongruent</span>
            </div>
            <div className="text-2xl font-bold text-rose-500">
              {Math.round(summary.incongruentAvg)}ms
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              <span>Stroop Effect</span>
            </div>
            <div className="text-2xl font-bold text-amber-400">
              +{Math.round(summary.stroopEffect)}ms
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted text-sm mb-1">
              <Target className="w-4 h-4" />
              <span>Accuracy</span>
            </div>
            <div className="text-2xl font-bold">
              {Math.round(summary.accuracy)}%
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">
            Average Reaction Times
          </h2>
          <ResultsChart
            congruentAvg={summary.congruentAvg}
            incongruentAvg={summary.incongruentAvg}
          />
        </div>

        {/* Explanation */}
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-3">
            What does this mean?
          </h2>
          <p className="text-muted leading-relaxed">
            The <strong className="text-foreground">Stroop Effect</strong> demonstrates
            cognitive interference—when the word meaning conflicts with the font color,
            your brain takes longer to respond. Your Stroop Effect of{' '}
            <strong className="text-amber-400">
              {Math.round(summary.stroopEffect)}ms
            </strong>{' '}
            {summary.stroopEffect > 100
              ? 'is typical! Most people experience a 100-200ms delay on incongruent trials.'
              : summary.stroopEffect > 50
              ? 'shows moderate interference. Your brain handles the conflict relatively well!'
              : 'is quite low! You have excellent selective attention.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRestart}
            className="flex items-center gap-2 px-6 py-3 bg-card border border-border
                       rounded-xl font-medium transition-colors hover:bg-border"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleClearResults}
            disabled={isClearing}
            className="flex items-center gap-2 px-6 py-3 bg-card border border-rose-500/50
                       rounded-xl font-medium text-rose-500 transition-colors
                       hover:bg-rose-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            {isClearing ? 'Clearing...' : 'Clear Results'}
          </motion.button>
        </div>
      </motion.div>
    </main>
  );
}
