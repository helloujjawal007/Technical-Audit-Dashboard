import { useEffect, useState } from "react";
import { Sparkles, AlertTriangle, AlertCircle } from "lucide-react";
import { scoreColor } from "@/types";

interface ScoreGaugeProps {
  score: number;
  size?: number;
}

export function ScoreGauge({ score, size = 180 }: ScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const sc = scoreColor(score);
  const strokeWidth = 14;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  useEffect(() => {
    let start = 0;
    const duration = 1000;
    const stepTime = 16;
    const steps = duration / stepTime;
    const increment = score / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= score) {
        setDisplayScore(score);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.floor(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [score]);

  const gradientId =
    score >= 80 ? "gaugeEmerald" : score >= 50 ? "gaugeAmber" : "gaugeRose";

  const glowColor =
    score >= 80
      ? "bg-emerald-500/15"
      : score >= 50
      ? "bg-amber-500/15"
      : "bg-rose-500/15";

  const BadgeIcon =
    score >= 80 ? Sparkles : score >= 50 ? AlertTriangle : AlertCircle;

  return (
    <div
      className="relative flex flex-col items-center justify-center group"
      style={{ width: size, height: size }}
    >
      {/* Ambient Glow Aura */}
      <div
        className={`absolute inset-4 rounded-full ${glowColor} blur-2xl transition-all duration-700 pointer-events-none group-hover:scale-110`}
      />

      <svg width={size} height={size} className="-rotate-90 relative z-10">
        <defs>
          <linearGradient id="gaugeEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
          <linearGradient id="gaugeAmber" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <linearGradient id="gaugeRose" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
        </defs>

        {/* Base Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-slate-100"
        />

        {/* Animated Progress Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          stroke={`url(#${gradientId})`}
          className="transition-all duration-1000 ease-out drop-shadow-xs"
        />
      </svg>

      {/* Center Metrics Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 text-center select-none">
        <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-800 flex items-baseline">
          {displayScore}
          <span className="text-sm sm:text-base font-semibold text-slate-400 ml-0.5">/100</span>
        </span>
        <div className="mt-1 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/90 shadow-xs border border-slate-200/80">
          <BadgeIcon className={`w-3 h-3 ${sc.text}`} />
          <span className={sc.text}>{sc.label}</span>
        </div>
      </div>
    </div>
  );
}
