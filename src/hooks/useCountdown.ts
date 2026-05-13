import { useCallback, useEffect, useState } from 'react';

type UseCountdownReturn = {
  seconds: number;
  restart: () => void;
};

export function useCountdown(initial: number): UseCountdownReturn {
  const [seconds, setSeconds] = useState(initial);

  useEffect(() => {
    if (seconds <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds]);

  const restart = useCallback(() => {
    setSeconds(initial);
  }, [initial]);

  return { seconds, restart };
}
