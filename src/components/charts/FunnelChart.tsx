"use client";

import React from "react";
import {
  FunnelChart as RechartsFunnelChart,
  Funnel,
  Tooltip,
  LabelList,
  ResponsiveContainer,
  Cell
} from "recharts";

interface FunnelData {
  name: string;
  value: number;
  fill: string;
}

interface FunnelChartProps {
  data: FunnelData[];
}

export default function FunnelChart({ data }: FunnelChartProps) {
  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsFunnelChart>
          <Tooltip 
            contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: "8px" }} 
            itemStyle={{ color: "#e2e8f0" }} 
          />
          <Funnel
            dataKey="value"
            data={data}
            isAnimationActive
          >
            <LabelList position="right" fill="#94a3b8" stroke="none" dataKey="name" />
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Funnel>
        </RechartsFunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
