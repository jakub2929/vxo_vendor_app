// GPS-based arrival auto-detection for Job Chat.
//
// Fires on JobChatScreen mount (after a brief settle delay) and on every
// background → active AppState transition. When the vendor is within 0.5
// miles of the job's seeded coordinates, calls the supplied `arrival`
// callback — which is shared with the manual "I've arrived" action card so
// both paths converge on a single status-flip + system-message flow.
//
// Silent on every failure path: permission denied, GPS unavailable, no job
// coords, wrong status, debounce. The manual action card is always visible
// while in en_route / accepted, so a missed auto-detection has a one-tap
// fallback.
//
// Does NOT prompt for permission. Foreground location permission is asked
// once on Jobs-tab mount via useVendorLocation; here we only *read* the
// status with getForegroundPermissionsAsync.
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import type { Job } from './types';
import { haversineMiles } from '@/lib/geo';

// 0.5 miles per the contract.
const ARRIVAL_THRESHOLD_MILES = 0.5;

// Don't run a GPS fetch more often than this. Cheap protection against a
// rapid bg/fg cycle (e.g. control-center pull, notification flick) firing
// repeated checks. NOT an arrival cooldown — once arrived, the status flips
// to on_site and the status gate (below) rejects the next attempt anyway.
const DEBOUNCE_MS = 30_000;

// Defer the on-mount check briefly so the screen has time to paint and the
// job query has a chance to resolve. Keeps GPS work off the critical path
// for the chat first-render.
const MOUNT_DELAY_MS = 500;

// Phase 5: per-vendor job_status values that should trigger an arrival
// check. Was ['en_route', 'accepted']; now the equivalents.
const ELIGIBLE_STATUSES: ReadonlyArray<string> = ['on_the_way', 'in_progress'];

export function useArrivalDetection(
  job: Job | null | undefined,
  arrival: () => void,
): void {
  // Refs (not state) — these drive the gate, never the render.
  const lastCheckAtRef = useRef<number>(0);
  const lastAppStateRef = useRef<AppStateStatus>(AppState.currentState);
  // Pin the latest job + callback so the AppState listener (long-lived) sees
  // the current values without re-subscribing every render.
  const jobRef = useRef(job);
  const arrivalRef = useRef(arrival);
  useEffect(() => {
    jobRef.current = job;
  }, [job]);
  useEffect(() => {
    arrivalRef.current = arrival;
  }, [arrival]);

  const runCheck = useCallback(async (): Promise<void> => {
    const currentJob = jobRef.current;
    if (!currentJob) return;
    if (
      currentJob.job_status == null ||
      !ELIGIBLE_STATUSES.includes(currentJob.job_status)
    ) {
      return;
    }
    // Phase 5 dropped jobs.location_lat/lng. Auto-arrival is currently
    // disabled until Ryan re-exposes coordinates on vendor_requests — the
    // manual "I've arrived" action card stays as the always-visible
    // fallback. Bail silently when no coords are available.
    //
    // TODO(phase5b): re-enable once vendor_requests carries coords. Keep
    // ARRIVAL_THRESHOLD_MILES + haversineMiles in scope for the eventual
    // re-wire.
    void ARRIVAL_THRESHOLD_MILES;
    void haversineMiles;
    void Location;
    const now = Date.now();
    if (now - lastCheckAtRef.current < DEBOUNCE_MS) return;
    lastCheckAtRef.current = now;
    return;
  }, []);

  // On-mount check (after a brief settle). One-shot per JobChatScreen mount.
  useEffect(() => {
    const timer = setTimeout(() => {
      void runCheck();
    }, MOUNT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [runCheck]);

  // AppState listener: re-check on every transition INTO 'active' from a
  // non-active state. Two-tuple compare (prev → next) so we don't fire on
  // active → active (shouldn't happen, but defensive).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = lastAppStateRef.current;
      lastAppStateRef.current = next;
      if (next === 'active' && prev !== 'active') {
        void runCheck();
      }
    });
    return () => {
      sub.remove();
    };
  }, [runCheck]);
}
