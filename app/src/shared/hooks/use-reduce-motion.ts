import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** ¿La persona pidió "reducir movimiento" en el teléfono? Entonces las animaciones decorativas se omiten. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => alive && setReduce(value))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
