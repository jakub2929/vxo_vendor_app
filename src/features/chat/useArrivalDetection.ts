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

const ELIGIBLE_STATUSES: ReadonlyArray<string> = ['en_route', 'accepted'];

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
    if (!ELIGIBLE_STATUSES.includes(currentJob.status)) return;
    if (currentJob.location_lat == null || currentJob.location_lng == null) {
      return;
    }

    const now = Date.now();
    if (now - lastCheckAtRef.current < DEBOUNCE_MS) return;
    lastCheckAtRef.current = now;

    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const miles = haversineMiles(
        { lat: pos.coords.latitude, lng: pos.coords.longitude },
        {
          lat: Number(currentJob.location_lat),
          lng: Number(currentJob.location_lng),
        },
      );

      if (miles < ARRIVAL_THRESHOLD_MILES) {
        arrivalRef.current();
      }
    } catch (err) {
      // No UI noise — manual button is the fallback.
      console.warn('[useArrivalDetection] check failed:', err);
    }
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
