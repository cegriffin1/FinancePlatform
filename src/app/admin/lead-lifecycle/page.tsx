"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LifecycleConfig } from "@/domain/types/lead-lifecycle";

export default function LeadLifecycleAdminPage() {
  const [config, setConfig] = useState<LifecycleConfig | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/lead-lifecycle", {
      headers: { "x-altus-role": "admin" },
    });
    const json = await res.json();
    setConfig(json.lifecycle_config ?? null);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!config) return;
    setError(null);
    const res = await fetch("/api/admin/lead-lifecycle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-altus-role": "admin",
      },
      body: JSON.stringify({ action: "update_lifecycle_config", config }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Save failed");
      return;
    }
    setMessage("Lifecycle configuration saved");
    setConfig(json.lifecycle_config);
  }

  async function runJob() {
    const res = await fetch("/api/admin/lead-lifecycle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-altus-role": "admin",
      },
      body: JSON.stringify({ action: "run_lifecycle_job" }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Job failed");
      return;
    }
    setMessage(`Lifecycle job ran for ${json.results?.length ?? 0} leads`);
  }

  if (!config) {
    return <p className="p-6 text-sm text-[var(--altus-text-secondary)]">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lead Lifecycle</h1>
          <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">
            Versioned HOT / MEDIUM / COLD thresholds, cold/recycle windows, and
            recycling warnings. Do not hardcode these in product UI.
          </p>
        </div>
        <Link
          href="/admin/lead-inventory"
          className="text-sm font-semibold text-[var(--altus-blue)]"
        >
          Inventory dashboard →
        </Link>
      </div>

      {message ? (
        <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      <div className="space-y-4 rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
        <Field
          label="Config version"
          value={config.version}
          onChange={(v) => setConfig({ ...config, version: v })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Num
            label="Hot min score"
            value={config.hot_min_score}
            onChange={(v) => setConfig({ ...config, hot_min_score: v })}
          />
          <Num
            label="Medium min score"
            value={config.medium_min_score}
            onChange={(v) => setConfig({ ...config, medium_min_score: v })}
          />
          <Num
            label="cold_after_days"
            value={config.cold_after_days}
            onChange={(v) => setConfig({ ...config, cold_after_days: v })}
          />
          <Num
            label="recycle_after_days"
            value={config.recycle_after_days}
            onChange={(v) => setConfig({ ...config, recycle_after_days: v })}
          />
          <Num
            label="ownership_duration_days"
            value={config.ownership_duration_days}
            onChange={(v) =>
              setConfig({ ...config, ownership_duration_days: v })
            }
          />
          <Num
            label="max_ownership_extensions_days"
            value={config.max_ownership_extensions_days}
            onChange={(v) =>
              setConfig({ ...config, max_ownership_extensions_days: v })
            }
          />
        </div>
        <Field
          label="Recycling warning days (comma-separated)"
          value={config.recycling_warning_days.join(",")}
          onChange={(v) =>
            setConfig({
              ...config,
              recycling_warning_days: v
                .split(",")
                .map((x) => Number(x.trim()))
                .filter((n) => Number.isFinite(n) && n > 0),
            })
          }
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void save()}
            className="rounded-[8px] bg-[var(--altus-blue)] px-4 py-2 text-sm font-semibold text-white"
          >
            Save configuration
          </button>
          <button
            type="button"
            onClick={() => void runJob()}
            className="rounded-[8px] border border-[var(--altus-border)] px-4 py-2 text-sm font-semibold"
          >
            Run lifecycle job now
          </button>
        </div>
        <p className="text-xs text-[var(--altus-text-secondary)]">
          Production resale rules require legal/compliance review before enabling
          live consumer data resale.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-semibold">{label}</span>
      <input
        className="mt-1 w-full rounded-[8px] border border-[var(--altus-border)] px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-semibold">{label}</span>
      <input
        type="number"
        className="mt-1 w-full rounded-[8px] border border-[var(--altus-border)] px-3 py-2"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
