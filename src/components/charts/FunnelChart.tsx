"use client";

import React, { useState } from "react";

export interface FunnelData {
  name: string;
  value: number;
  fill?: string;
}

export interface FunnelChartProps {
  data: FunnelData[];
}

export default function FunnelChart({ data }: FunnelChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="w-full py-12 flex flex-col items-center justify-center text-muted-foreground text-sm">
        <p>No funnel metrics available yet.</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const totalLeads = data[0]?.value || 0;
  const finalEnrollments = data[data.length - 1]?.value || 0;
  const overallConversion = totalLeads > 0 ? ((finalEnrollments / totalLeads) * 100).toFixed(1) : "0.0";

  return (
    <div className="w-full space-y-5">
      {/* Top Conversion Summary */}
      <div className="flex items-center justify-between px-2 text-xs">
        <span className="text-muted-foreground font-medium">Pipeline Progression</span>
        <div className="flex items-center space-x-2">
          <span className="text-muted-foreground">End-to-End Conversion:</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            {overallConversion}%
          </span>
        </div>
      </div>

      {/* Funnel Steps */}
      <div className="space-y-3">
        {data.map((step, idx) => {
          const percentageOfMax = Math.max((step.value / maxValue) * 100, 6);
          const percentageOfTotal = totalLeads > 0 ? ((step.value / totalLeads) * 100).toFixed(1) : "0.0";
          
          // Conversion from previous step
          const prevValue = idx > 0 ? data[idx - 1].value : null;
          const stepConversion = prevValue !== null && prevValue > 0
            ? ((step.value / prevValue) * 100).toFixed(1)
            : null;

          const defaultColors = ["#06b6d4", "#3b82f6", "#10b981", "#8b5cf6"];
          const barColor = step.fill || defaultColors[idx % defaultColors.length];
          const isHovered = hoveredIndex === idx;

          return (
            <div
              key={step.name}
              className="relative group transition-all"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Between step conversion connector indicator */}
              {idx > 0 && (
                <div className="flex items-center pl-6 py-1 text-[11px] text-muted-foreground">
                  <div className="w-0.5 h-3 bg-border mr-2" />
                  <span className="text-muted-foreground/80 font-mono">
                    {stepConversion}% conversion from {data[idx - 1].name}
                  </span>
                </div>
              )}

              {/* Stage Card */}
              <div
                className={`p-3.5 rounded-xl border transition-all duration-200 ${
                  isHovered
                    ? "bg-muted/60 border-cyan-500/40 shadow-sm"
                    : "bg-background/40 border-border hover:border-border/80"
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: barColor }}
                    />
                    <span className="font-semibold text-foreground">{step.name}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="font-mono font-bold text-sm text-foreground">
                      {step.value.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground text-[11px] font-mono">
                      ({percentageOfTotal}%)
                    </span>
                  </div>
                </div>

                {/* Horizontal Funnel Bar */}
                <div className="w-full h-3 bg-muted/40 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${percentageOfMax}%`,
                      backgroundColor: barColor,
                      boxShadow: isHovered ? `0 0 12px ${barColor}80` : "none",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
