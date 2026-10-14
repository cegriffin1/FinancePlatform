"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  destinationsFromWizardChannels,
  type CreativeDestination,
} from "@/domain/media/destinations";
import type { CampaignMediaAttachmentPublic } from "@/domain/media/attachments";
import type { CompatibilityResult } from "@/domain/media/creativeCompatibility";
import {
  MEDIA_ACCEPT_ATTR,
  MEDIA_FORMAT_HINT,
  formatBytes,
  mapMediaUploadError,
  mediaTypeLabel,
  type MediaLibraryAsset,
} from "@/application/media/mediaLibraryUi";

type Props = {
  campaignId: string | null;
  channels: string[];
  onNeedCampaign: () => Promise<string | null>;
};

type ListPayload = {
  attachments?: CampaignMediaAttachmentPublic[];
  compatibility?: Array<{
    attachmentId: string;
    destination: CreativeDestination;
    result: CompatibilityResult;
  }>;
  readiness?: {
    creativeReady: boolean;
    missingDestinations: CreativeDestination[];
    blockedDestinations: Array<{ destination: CreativeDestination; reason: string }>;
  };
  error?: string;
};

export function CreativeMediaPanel({
  campaignId,
  channels,
  onNeedCampaign,
}: Props) {
  const [attachments, setAttachments] = useState<CampaignMediaAttachmentPublic[]>(
    [],
  );
  const [compatibility, setCompatibility] = useState<
    NonNullable<ListPayload["compatibility"]>
  >([]);
  const [readiness, setReadiness] = useState<ListPayload["readiness"]>();
  const [library, setLibrary] = useState<MediaLibraryAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const destinations = useMemo(
    () => destinationsFromWizardChannels(channels),
    [channels],
  );

  const refresh = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        const qs = destinations
          .map((d) => `destination=${encodeURIComponent(d)}`)
          .join("&");
        const res = await fetch(
          `/api/campaigns/${id}/media${qs ? `?${qs}` : ""}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as ListPayload;
        if (!res.ok) {
          setError(json.error || "Unable to load creative attachments.");
          setAttachments([]);
          return;
        }
        setAttachments(json.attachments || []);
        setCompatibility(json.compatibility || []);
        setReadiness(json.readiness);
      } finally {
        setLoading(false);
      }
    },
    [destinations],
  );

  useEffect(() => {
    if (campaignId) void refresh(campaignId);
  }, [campaignId, refresh]);

  async function ensureCampaignId(): Promise<string | null> {
    if (campaignId) return campaignId;
    return onNeedCampaign();
  }

  async function loadLibrary() {
    const res = await fetch("/api/media", { cache: "no-store" });
    const json = (await res.json()) as { assets?: MediaLibraryAsset[]; error?: string };
    if (!res.ok) {
      setError(json.error || "Unable to load Media Library.");
      return;
    }
    setLibrary((json.assets || []).filter((a) => a.status === "ACTIVE"));
    setPickerOpen(true);
  }

  async function attachAsset(mediaAssetId: string, destination: CreativeDestination | null) {
    const id = await ensureCampaignId();
    if (!id) {
      setError("Save the campaign draft before attaching media.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${id}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_asset_id: mediaAssetId,
          destination,
          role: "PRIMARY",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Unable to attach media.");
        return;
      }
      setPickerOpen(false);
      await refresh(id);
    } finally {
      setBusy(false);
    }
  }

  async function detach(attachmentId: string) {
    const id = await ensureCampaignId();
    if (!id) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/media/${attachmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "Unable to detach media.");
        return;
      }
      await refresh(id);
    } finally {
      setBusy(false);
    }
  }

  async function uploadNew(file: File) {
    const id = await ensureCampaignId();
    if (!id) {
      setError("Save the campaign draft before uploading media.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const upload = await fetch("/api/media", { method: "POST", body: form });
      const body = await upload.json().catch(() => null);
      if (!upload.ok || !body?.asset?.id) {
        setError(mapMediaUploadError(upload.status, body));
        return;
      }
      await attachAsset(body.asset.id, null);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4 rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[var(--altus-text)]">
            Campaign media
          </h3>
          <p className="mt-1 text-xs text-[var(--altus-text-secondary)]">
            Select from Media Library or upload new. Compatibility is evaluated
            per destination — connection is separate from creative fitness.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void loadLibrary()}
            className="min-h-11 rounded-md border border-[var(--altus-border)] bg-white px-3 text-sm font-semibold"
          >
            Choose from Media Library
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="min-h-11 rounded-md bg-[var(--altus-blue)] px-3 text-sm font-semibold text-white"
          >
            Upload new
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={MEDIA_ACCEPT_ATTR}
            className="sr-only"
            aria-label="Upload campaign media"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadNew(file);
            }}
          />
        </div>
      </div>
      <p className="text-xs text-[var(--altus-text-secondary)]">{MEDIA_FORMAT_HINT}</p>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {readiness ? (
        <div
          className={
            readiness.creativeReady
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              : "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          }
          role="status"
        >
          {readiness.creativeReady
            ? "Creative ready for selected destinations (provider connection may still be required later)."
            : `Creative not ready: ${[
                ...readiness.missingDestinations.map((d) => `${d} needs an asset`),
                ...readiness.blockedDestinations.map((b) => `${b.destination}: ${b.reason}`),
              ].join(" · ")}`}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--altus-text-secondary)]">Loading attachments…</p>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-[var(--altus-text-secondary)]">
          No media attached yet. Upload or choose an ACTIVE library asset.
        </p>
      ) : (
        <ul className="space-y-3">
          {attachments.map((att) => {
            const rows = compatibility.filter((c) => c.attachmentId === att.id);
            return (
              <li
                key={att.id}
                className="rounded-[12px] border border-[var(--altus-border)] bg-[var(--altus-section)] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--altus-text)]">
                      {att.media.original_filename}
                    </p>
                    <p className="text-xs text-[var(--altus-text-secondary)]">
                      {mediaTypeLabel(att.media.media_type)} ·{" "}
                      {formatBytes(att.media.size_bytes)} · {att.media.status}
                      {att.destination ? ` · ${att.destination}` : " · Shared"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void detach(att.id)}
                    className="min-h-10 rounded-md border border-[var(--altus-border)] bg-white px-3 text-xs font-semibold"
                  >
                    Detach
                  </button>
                </div>
                {rows.length > 0 ? (
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {rows.map((row) => (
                      <li
                        key={`${att.id}-${row.destination}`}
                        className="rounded-md border border-[var(--altus-border)] bg-white px-3 py-2 text-xs"
                      >
                        <p className="font-bold uppercase tracking-wide">
                          {row.destination} · {row.result.status}
                        </p>
                        <p className="mt-1 text-[var(--altus-text-secondary)]">
                          {row.result.reason}
                        </p>
                        <p className="mt-1 text-[var(--altus-text-secondary)]">
                          {row.result.possibleAction}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {pickerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Choose media from library"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPickerOpen(false);
          }}
        >
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[16px] bg-white shadow-xl sm:rounded-[16px]">
            <div className="flex items-center justify-between border-b border-[var(--altus-border)] px-4 py-3">
              <p className="text-sm font-semibold">Media Library</p>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="min-h-11 rounded-md border border-[var(--altus-border)] px-3 text-sm font-semibold"
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              {library.length === 0 ? (
                <p className="text-sm text-[var(--altus-text-secondary)]">
                  No ACTIVE media in your library.
                </p>
              ) : (
                <ul className="space-y-2">
                  {library.map((asset) => (
                    <li
                      key={asset.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--altus-border)] px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-semibold">{asset.original_filename}</p>
                        <p className="text-xs text-[var(--altus-text-secondary)]">
                          {mediaTypeLabel(asset.media_type)} · {formatBytes(asset.size_bytes)}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void attachAsset(asset.id, null)}
                        className="min-h-10 rounded-md bg-[var(--altus-blue)] px-3 text-xs font-semibold text-white"
                      >
                        Attach shared
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
