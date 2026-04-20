"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  duration?: number;        // ms, default 800
  suffix?: string;
  prefix?: string;
  className?: string;
}

/**
 * 0'dan (veya önceki değerden) target'a ease-out count-up animasyonu.
 * requestAnimationFrame tabanlı, smooth 60fps.
 */
export function AnimatedNumber({
  value,
  duration = 800,
  suffix = "",
  prefix = "",
  className,
}: Props) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number | null>(null);
  const startValueRef = useRef(value);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = display;
    startValueRef.current = startValue;
    startTimeRef.current = null;

    const step = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (value - startValue) * eased;
      setDisplay(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const rendered = Math.round(display);

  return (
    <span className={className}>
      {prefix}
      {rendered.toLocaleString("tr-TR")}
      {suffix}
    </span>
  );
}
