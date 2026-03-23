"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";

interface ScrollContextValue {
  scrollingDown: boolean;
}

const ScrollContext = createContext<ScrollContextValue>({ scrollingDown: false });

export function ScrollProvider({ children }: { children: React.ReactNode }) {
  const [scrollingDown, setScrollingDown] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function onScroll(e: Event) {
      const el = e.target === document ? null : (e.target as HTMLElement);
      const y = el ? el.scrollTop : window.scrollY;
      setScrollingDown(y > lastScrollY.current && y > 10);
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    const main = document.querySelector("main");
    main?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      main?.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <ScrollContext.Provider value={{ scrollingDown }}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScrollContext() {
  return useContext(ScrollContext);
}
