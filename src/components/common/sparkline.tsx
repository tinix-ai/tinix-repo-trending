"use client";

import { useState, useEffect } from "react";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 28,
  color = "#22c55e",
}: SparklineProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  if (!data || data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * width : width / 2;
    const y = height - ((val - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;

  // Area fill path
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      aria-hidden="true"
    >
      {/* Gradient fill */}
      <defs>
        <linearGradient id={`spark-grad-${data.length}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={areaD}
        fill={`url(#spark-grad-${data.length})`}
        style={{
          opacity: mounted ? 1 : 0,
          transition: "opacity 1s ease-out 0.4s",
        }}
      />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{
          strokeDasharray: 200,
          strokeDashoffset: mounted ? 0 : 200,
          transition: "stroke-dashoffset 1s cubic-bezier(0.25, 1, 0.5, 1)",
        }}
      />
      {/* End dot */}
      <circle
        cx={data.length > 1 ? width : width / 2}
        cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2}
        r="2"
        fill={color}
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "scale(1)" : "scale(0)",
          transformOrigin: `${data.length > 1 ? width : width / 2}px ${height - ((data[data.length - 1] - min) / range) * (height - 4) - 2}px`,
          transition: "opacity 0.3s ease-out 0.8s, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.8s",
        }}
      />
    </svg>
  );
}

