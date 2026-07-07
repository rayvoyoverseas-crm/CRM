import React from "react";
import { STAGE_MAP } from "@/lib/api";

export default function StageBadge({ pipeline = "study_abroad", stage, className = "" }) {
  const cfg = STAGE_MAP[pipeline]?.[stage];
  if (!cfg) return null;
  return (
    <span
      data-testid={`stage-badge-${stage}`}
      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1.5 ring-1 ring-inset ${cfg.classes} ${className}`}
      title={cfg.label}
    >
      <span className="tracking-wide">{stage}</span>
      <span className="opacity-70 font-medium">·</span>
      <span className="font-medium">{cfg.label}</span>
    </span>
  );
}

export function StageChip({ pipeline = "study_abroad", stage, className = "" }) {
  const cfg = STAGE_MAP[pipeline]?.[stage];
  if (!cfg) return null;
  return (
    <span
      className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide ring-1 ring-inset ${cfg.classes} ${className}`}
      title={cfg.label}
    >
      {stage}
    </span>
  );
}
