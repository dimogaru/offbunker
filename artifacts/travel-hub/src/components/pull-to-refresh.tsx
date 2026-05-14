import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const THRESHOLD = 72;

type State = "idle" | "pulling" | "refreshing";

export default function PullToRefresh() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>("idle");
  const [pullPx, setPullPx] = useState(0);

  const startYRef = useRef<number | null>(null);
  const pullPxRef = useRef(0);
  const isRefreshing = useRef(false);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY === 0 && !isRefreshing.current) {
        startYRef.current = e.touches[0].clientY;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (startYRef.current === null || isRefreshing.current) return;
      if (window.scrollY > 2) {
        startYRef.current = null;
        pullPxRef.current = 0;
        setPullPx(0);
        setState("idle");
        return;
      }
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta > 0) {
        const clamped = Math.min(delta * 0.45, THRESHOLD + 24);
        pullPxRef.current = clamped;
        setPullPx(clamped);
        setState("pulling");
      }
    }

    async function onTouchEnd() {
      const d = pullPxRef.current;
      pullPxRef.current = 0;
      startYRef.current = null;
      setPullPx(0);

      if (d >= THRESHOLD && !isRefreshing.current) {
        isRefreshing.current = true;
        setState("refreshing");
        try {
          await queryClient.invalidateQueries();
        } finally {
          setTimeout(() => {
            isRefreshing.current = false;
            setState("idle");
          }, 700);
        }
      } else {
        setState("idle");
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [queryClient]);

  if (state === "idle") return null;

  const progress = Math.min(pullPx / THRESHOLD, 1);
  const height = state === "refreshing" ? 52 : pullPx;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] flex items-end justify-center pointer-events-none transition-[height] duration-100"
      style={{ height: Math.max(height, 0) }}
    >
      <div className="mb-2 w-9 h-9 rounded-full bg-card border border-border shadow-lg flex items-center justify-center">
        <RefreshCw
          className={`w-4 h-4 text-primary ${state === "refreshing" ? "animate-spin" : "transition-transform"}`}
          style={state === "pulling" ? { transform: `rotate(${Math.round(progress * 270)}deg)` } : undefined}
        />
      </div>
    </div>
  );
}
