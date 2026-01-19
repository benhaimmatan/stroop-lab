'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { RotateCcw } from 'lucide-react';
import { TrialDisplay } from '@/components/trial-display';
import { ResponseButtons } from '@/components/response-buttons';
import { ProgressBar } from '@/components/progress-bar';
import { generateTrials, isCorrectResponse } from '@/lib/experiment';
import { getTimestamp, calculateReactionTime } from '@/lib/timing';
import { supabase } from '@/lib/supabase';
import { Trial, TrialResult, ColorKey } from '@/types';

const TOTAL_TRIALS = 20;
const INTER_TRIAL_DELAY = 500; // ms between trials

export default function ExperimentPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isWaiting, setIsWaiting] = useState(false);
  const [results, setResults] = useState<TrialResult[]>([]);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const storedSessionId = sessionStorage.getItem('stroop_session_id');
    if (!storedSessionId) {
      router.push('/');
      return;
    }
    setSessionId(storedSessionId);
    setTrials(generateTrials());
  }, [router]);

  useEffect(() => {
    if (trials.length > 0 && currentIndex < trials.length && !isWaiting) {
      startTimeRef.current = getTimestamp();
    }
  }, [currentIndex, trials.length, isWaiting]);

  const handleRestart = useCallback(() => {
    const newSessionId = uuidv4();
    sessionStorage.setItem('stroop_session_id', newSessionId);
    setSessionId(newSessionId);
    setTrials(generateTrials());
    setCurrentIndex(0);
    setResults([]);
    setIsWaiting(false);
  }, []);

  const handleResponse = useCallback(
    async (response: ColorKey) => {
      if (isWaiting || !sessionId || currentIndex >= trials.length) return;

      const reactionTime = calculateReactionTime(startTimeRef.current);
      const currentTrial = trials[currentIndex];
      const correct = isCorrectResponse(currentTrial, response);

      const result: TrialResult = {
        session_id: sessionId,
        word_text: currentTrial.wordText,
        font_color: currentTrial.fontColor,
        is_congruent: currentTrial.isCongruent,
        reaction_time_ms: reactionTime,
        user_response: response,
        is_correct: correct,
      };

      // Store result locally
      const newResults = [...results, result];
      setResults(newResults);

      // Save to Supabase (non-blocking)
      supabase.from('stroop_results').insert(result).then(({ error }) => {
        if (error) {
          console.error('Failed to save result:', error);
        }
      });

      // Show inter-trial blank
      setIsWaiting(true);

      if (currentIndex + 1 >= TOTAL_TRIALS) {
        // Experiment complete - save results to sessionStorage and navigate
        sessionStorage.setItem('stroop_results', JSON.stringify(newResults));
        setTimeout(() => {
          router.push('/results');
        }, INTER_TRIAL_DELAY);
      } else {
        // Move to next trial after delay
        setTimeout(() => {
          setCurrentIndex((prev) => prev + 1);
          setIsWaiting(false);
        }, INTER_TRIAL_DELAY);
      }
    },
    [currentIndex, isWaiting, results, router, sessionId, trials]
  );

  if (!sessionId || trials.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-muted">Loading...</div>
      </main>
    );
  }

  const currentTrial = trials[currentIndex];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="fixed top-8 left-1/2 -translate-x-1/2 w-full max-w-md px-4">
        <ProgressBar current={currentIndex + 1} total={TOTAL_TRIALS} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-16 w-full">
        <div className="h-32 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {!isWaiting && currentTrial && (
              <TrialDisplay key={currentTrial.id} trial={currentTrial} />
            )}
          </AnimatePresence>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ResponseButtons onResponse={handleResponse} disabled={isWaiting} />
        </motion.div>
      </div>

      <div className="fixed bottom-8 flex flex-col items-center gap-4">
        <span className="text-sm text-muted">
          Press the button matching the <strong>font color</strong>
        </span>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRestart}
          className="flex items-center gap-2 px-4 py-2 text-sm text-muted
                     hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Restart
        </motion.button>
      </div>
    </main>
  );
}
