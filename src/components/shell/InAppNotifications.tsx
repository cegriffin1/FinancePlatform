"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SimNotification } from "@/application/growth/simulationStore";

export function InAppNotifications() {
  const [items, setItems] = useState<SimNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void fetch("/api/campaigns/state")
      .then((r) => r.json())
      .then((json) => setItems(json.notifications ?? []));
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
      >
        Notifications{unread > 0 ? ` (${unread})` : ""}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-96 max-w-[90vw] rounded-[12px] border border-[var(--line)] bg-white p-3 shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
            In-app · Email/SMS/D365/Teams ready
          </p>
          {items.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--ink-muted)]">No notifications</p>
          ) : (
            <ul className="mt-2 max-h-80 space-y-2 overflow-auto">
              {items.slice(0, 12).map((n) => (
                <li key={n.id} className="rounded-md border border-[var(--line)] p-2 text-sm">
                  <div className="font-semibold">{n.title}</div>
                  <div className="mt-1 text-xs text-[var(--ink-muted)]">{n.body}</div>
                  <Link
                    href={`/app/leads/${n.lead_id}`}
                    className="mt-1 inline-block text-xs font-semibold text-[var(--altus-blue,#004C91)]"
                    onClick={() => setOpen(false)}
                  >
                    Open lead
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
