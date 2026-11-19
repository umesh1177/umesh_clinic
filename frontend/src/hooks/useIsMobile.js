import { useState, useEffect } from 'react';

/**
 * Custom hook to detect mobile and tablet viewports
 * Breakpoint for mobile: <= 768px (smartphones)
 * Breakpoint for tablet: <= 1024px (tablets / compact screens)
 */
export const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= breakpoint;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkMobile = () => {
      setIsMobile(window.innerWidth <= breakpoint);
    };

    // Use matchMedia for high performance query matching
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    
    // Initial sync
    setIsMobile(mql.matches);

    const handler = (e) => setIsMobile(e.matches);

    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
    } else {
      mql.addListener(handler);
    }

    window.addEventListener('resize', checkMobile);

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', handler);
      } else {
        mql.removeListener(handler);
      }
      window.removeEventListener('resize', checkMobile);
    };
  }, [breakpoint]);

  return isMobile;
};

export default useIsMobile;
