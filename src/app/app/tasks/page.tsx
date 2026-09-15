"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CrmFollowUp } from "@/domain/types/retirement-crm";

type FollowUpGroups = {
  today: CrmFollowUp[];
  overdue: CrmFollowUp[];
  upcoming: CrmFollowUp[];
};

export default function TasksFollowUpPage() {
  const [groups, setGroups] = useState<FollowUpGroups>({
    today: [],
    overdue: [],
    upcoming: [],
  });

  async function load() {
    const res = await fetch("/api/crm");
    const json = await res.json();
    setGroups(json.followUps ?? { today: [], overdue: [], upcoming: [] });
  }

  useEffect(() => {
    void load();
  }, []);

  async function complete(leadId: string, followUpId: string) {
    await fetch("/api/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete_follow_up",
        lead_id: leadId,
        follow_up_id: followUpId,
      }),
    });
    await load();
  }

  function Section({
    title,
    items,
  }: {
    title: string;
    items: CrmFollowUp[];
  }) {
    return (
      <section className="space-y-2">
        <h2 className="text-sm font-bold tracking-[0.12em] text-[var(--altus-blue)]">
          {title} ({items.length})
        </h2>
        {items.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-[var(--altus-border)] bg-white p-4 text-sm text-[var(--altus-text-secondary)]">
            None
          </p>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-bold uppercase text-[var(--altus-text-secondary)]">
                    {item.type}
                  </div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-xs text-[var(--altus-text-secondary)]">
                    Due {item.due_at ? new Date(item.due_at).toLocaleString() : "—"}
                  </p>
                  {item.body ? (
                    <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">{item.body}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/app/leads/${item.lead_id}`}
                    className="rounded-md border border-[var(--altus-border)] px-2 py-1 text-xs font-semibold"
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={() => void complete(item.lead_id, item.id)}
                    className="rounded-md bg-[var(--altus-blue)] px-2 py-1 text-xs font-semibold text-white"
                  >
                    Done
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Follow-Ups</h1>
        <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">
          Tasks, callbacks, appointments, and notes — Today / Overdue / Upcoming.
        </p>
      </div>
      <Section title="OVERDUE" items={groups.overdue} />
      <Section title="TODAY" items={groups.today} />
      <Section title="UPCOMING" items={groups.upcoming} />
    </div>
  );
}
