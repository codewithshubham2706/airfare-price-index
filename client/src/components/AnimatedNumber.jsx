import { useCountUp } from '../services/useCountUp.js';

/**
 * Number ticker — animates from 0 (or previous value) to `value` with ease-out.
 * Renders an em-dash for null/undefined. Format callback controls presentation.
 */
export default function AnimatedNumber({ value, format = (v) => v, duration = 900, decimals = 0, className = '' }) {
  const shown = useCountUp(value, { duration, decimals });
  if (value == null || Number.isNaN(Number(value))) return <span className={className}>—</span>;
  return <span className={className}>{format(shown)}</span>;
}
