"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  emptyStateCopy,
  filterMediaAssets,
  formatBytes,
  formatDimensions,
  formatDuration,
  formatUploadDate,
  mapMediaUploadError,
  MEDIA_ACCEPT_ATTR,
  MEDIA_FORMAT_HINT,
  mediaSizeHints,
  mediaTypeLabel,
  sortMediaByNewest,
  type MediaLibraryAsset,
  type MediaStatusFilter,
  type MediaTypeFilter,
  type UploadUiState,
} from "@/application/media/mediaLibraryUi";

type ListResponse = {
  ok?: boolean;
  assets?: MediaLibraryAsset[];
  error?: string;
  code?: string;
};

export function MediaLibraryClient() {
  const [assets, setAssets] = useState<MediaLibraryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<MediaTypeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<MediaStatusFilter>("ACTIVE");
  const [uploadState, setUploadState] = useState<UploadUiState>({ phase: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<MediaLibraryAsset | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropId = useId();

  const refresh = useCallback(async () => {
    setListError(null);
    const res = await fetch("/api/media?includeArchived=1", { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as ListResponse;
    if (!res.ok) {
      setListError(
        res.status === 401
          ? "Authentication required."
          : res.status === 403
            ? "You do not have permission to view media."
            : "Unable to load media library.",
      );
      setAssets([]);
      setLoading(false);
      return;
    }
    setAssets(sortMediaByNewest(json.assets || []));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(
    () => filterMediaAssets(assets, typeFilter, statusFilter),
    [assets, typeFilter, statusFilter],
  );

  const hasAnyInStatus = useMemo(
    () => assets.some((a) => a.status === statusFilter),
    [assets, statusFilter],
  );

  const empty = emptyStateCopy(typeFilter, statusFilter, hasAnyInStatus);

  async function uploadFile(file: File) {
    setBanner(null);
    setUploadState({
      phase: "selected",
      fileName: file.name,
      sizeBytes: file.size,
    });
    setUploadState({ phase: "uploading", fileName: file.name });

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/media", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        code?: string;
        asset?: MediaLibraryAsset;
      } | null;
      if (!res.ok || !body?.asset) {
        setUploadState({
          phase: "failed",
          fileName: file.name,
          message: mapMediaUploadError(res.status, body),
        });
        return;
      }
      setUploadState({ phase: "success", fileName: file.name });
      setBanner(`Uploaded ${body.asset.original_filename}.`);
      setStatusFilter("ACTIVE");
      setTypeFilter("ALL");
      await refresh();
      window.setTimeout(() => {
        setUploadState((s) => (s.phase === "success" ? { phase: "idle" } : s));
      }, 2500);
    } catch {
      setUploadState({
        phase: "failed",
        fileName: file.name,
        message: "Upload failed. Please try again.",
      });
    }
  }

  function onPick(files: FileList | null) {
    const file = files?.[0];
    if (file) void uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function archiveSelected() {
    if (!selected) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/media/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      if (!res.ok) {
        setBanner("Unable to archive this asset. Please try again.");
        setArchiving(false);
        setConfirmArchive(false);
        return;
      }
      setBanner(`Archived ${selected.original_filename}.`);
      setSelected(null);
      setConfirmArchive(false);
      setStatusFilter("ACTIVE");
      await refresh();
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--altus-text)]">
            Media Library
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--altus-text-secondary)]">
            Manage campaign images, videos, and documents in one secure workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="min-h-11 rounded-md bg-[var(--altus-blue)] px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--altus-blue)]"
        >
          Upload Media
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={MEDIA_ACCEPT_ATTR}
          className="sr-only"
          aria-label="Choose media file to upload"
          onChange={(e) => onPick(e.target.files)}
        />
      </div>

      <UploadZone
        id={dropId}
        dragOver={dragOver}
        uploadState={uploadState}
        onDragOver={(v) => setDragOver(v)}
        onDropFile={(file) => void uploadFile(file)}
        onBrowse={() => fileInputRef.current?.click()}
      />

      {banner ? (
        <p
          className="rounded-[12px] border border-[var(--altus-border)] bg-[var(--altus-soft)] px-4 py-3 text-sm text-[var(--altus-text)]"
          role="status"
        >
          {banner}
        </p>
      ) : null}

      {listError ? (
        <p
          className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {listError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <FilterGroup
          label="Type"
          value={typeFilter}
          options={[
            { value: "ALL", label: "All" },
            { value: "IMAGE", label: "Images" },
            { value: "VIDEO", label: "Videos" },
            { value: "DOCUMENT", label: "Documents" },
          ]}
          onChange={(v) => setTypeFilter(v as MediaTypeFilter)}
        />
        <FilterGroup
          label="Status"
          value={statusFilter}
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "ARCHIVED", label: "Archived" },
          ]}
          onChange={(v) => setStatusFilter(v as MediaStatusFilter)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-[var(--altus-text-secondary)]">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[var(--altus-border)] bg-white p-10 text-center shadow-[var(--altus-shadow)]">
          <h2 className="text-xl font-bold text-[var(--altus-text)]">{empty.title}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--altus-text-secondary)]">
            {empty.description}
          </p>
          {statusFilter === "ACTIVE" && typeFilter === "ALL" ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 inline-flex min-h-11 rounded-md bg-[var(--altus-blue)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Upload Media
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((asset) => (
            <li key={asset.id}>
              <MediaAssetCard asset={asset} onOpen={() => setSelected(asset)} />
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <MediaDetailModal
          asset={selected}
          confirmArchive={confirmArchive}
          archiving={archiving}
          onClose={() => {
            setSelected(null);
            setConfirmArchive(false);
          }}
          onRequestArchive={() => setConfirmArchive(true)}
          onCancelArchive={() => setConfirmArchive(false)}
          onConfirmArchive={() => void archiveSelected()}
        />
      ) : null}
    </div>
  );
}

function FilterGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label={label}
    >
      <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
        {label}
      </span>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={
              active
                ? "min-h-10 rounded-md bg-[var(--altus-blue)] px-3 text-sm font-semibold text-white"
                : "min-h-10 rounded-md border border-[var(--altus-border)] bg-white px-3 text-sm font-semibold text-[var(--altus-text)] hover:bg-[var(--altus-section)]"
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function UploadZone({
  id,
  dragOver,
  uploadState,
  onDragOver,
  onDropFile,
  onBrowse,
}: {
  id: string;
  dragOver: boolean;
  uploadState: UploadUiState;
  onDragOver: (over: boolean) => void;
  onDropFile: (file: File) => void;
  onBrowse: () => void;
}) {
  return (
    <div
      id={id}
      role="region"
      aria-label="Upload media"
      onDragEnter={(e) => {
        e.preventDefault();
        onDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        onDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onDropFile(file);
      }}
      className={
        dragOver
          ? "rounded-[12px] border-2 border-[var(--altus-blue)] bg-[var(--altus-soft)] p-6 shadow-[var(--altus-shadow)]"
          : "rounded-[12px] border border-dashed border-[var(--altus-border)] bg-white p-6 shadow-[var(--altus-shadow)]"
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--altus-text)]">
            Drag and drop a file here, or browse
          </p>
          <p className="mt-1 text-xs text-[var(--altus-text-secondary)]">
            {MEDIA_FORMAT_HINT}
          </p>
          <p className="mt-1 text-xs text-[var(--altus-text-secondary)]">
            {mediaSizeHints()}
          </p>
        </div>
        <button
          type="button"
          onClick={onBrowse}
          className="min-h-11 shrink-0 rounded-md border border-[var(--altus-border)] bg-white px-4 text-sm font-semibold text-[var(--altus-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--altus-blue)]"
        >
          Choose file
        </button>
      </div>
      <UploadStatus state={uploadState} />
    </div>
  );
}

function UploadStatus({ state }: { state: UploadUiState }) {
  if (state.phase === "idle") return null;
  if (state.phase === "selected") {
    return (
      <p className="mt-4 text-sm text-[var(--altus-text)]" role="status">
        Selected: {state.fileName} ({formatBytes(state.sizeBytes)})
      </p>
    );
  }
  if (state.phase === "uploading") {
    return (
      <p className="mt-4 text-sm font-semibold text-[var(--altus-blue)]" role="status">
        Uploading {state.fileName}…
      </p>
    );
  }
  if (state.phase === "success") {
    return (
      <p className="mt-4 text-sm font-semibold text-emerald-700" role="status">
        Uploaded {state.fileName}
      </p>
    );
  }
  return (
    <p className="mt-4 text-sm font-semibold text-red-700" role="alert">
      {state.message}
    </p>
  );
}

function MediaAssetCard({
  asset,
  onOpen,
}: {
  asset: MediaLibraryAsset;
  onOpen: () => void;
}) {
  const dims = formatDimensions(asset.width, asset.height);
  const duration = formatDuration(asset.duration_seconds);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col overflow-hidden rounded-[12px] border border-[var(--altus-border)] bg-white text-left shadow-[var(--altus-shadow)] transition hover:border-[var(--altus-blue)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--altus-blue)]"
      aria-label={`${asset.original_filename}, ${mediaTypeLabel(asset.media_type)}, ${asset.status}`}
    >
      <CardPreview asset={asset} />
      <div className="space-y-1.5 p-4">
        <p className="truncate text-sm font-semibold text-[var(--altus-text)]">
          {asset.original_filename}
        </p>
        <p className="text-xs text-[var(--altus-text-secondary)]">
          {mediaTypeLabel(asset.media_type)} · {formatBytes(asset.size_bytes)}
          {dims ? ` · ${dims}` : ""}
          {duration ? ` · ${duration}` : ""}
        </p>
        <p className="text-xs text-[var(--altus-text-secondary)]">
          {formatUploadDate(asset.created_at)} · {asset.status}
        </p>
      </div>
    </button>
  );
}

function CardPreview({ asset }: { asset: MediaLibraryAsset }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (asset.media_type !== "IMAGE") return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/media/${asset.id}/access`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { url?: string };
      if (!cancelled && json.url) setUrl(json.url);
    })();
    return () => {
      cancelled = true;
    };
  }, [asset.id, asset.media_type]);

  if (asset.media_type === "IMAGE" && url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-40 w-full object-cover bg-[var(--altus-section)]"
      />
    );
  }

  return (
    <div className="flex h-40 w-full items-center justify-center bg-[var(--altus-section)] text-sm font-semibold text-[var(--altus-text-secondary)]">
      {asset.media_type === "VIDEO"
        ? "Video"
        : asset.media_type === "DOCUMENT"
          ? "PDF"
          : "Image"}
    </div>
  );
}

function MediaDetailModal({
  asset,
  confirmArchive,
  archiving,
  onClose,
  onRequestArchive,
  onCancelArchive,
  onConfirmArchive,
}: {
  asset: MediaLibraryAsset;
  confirmArchive: boolean;
  archiving: boolean;
  onClose: () => void;
  onRequestArchive: () => void;
  onCancelArchive: () => void;
  onConfirmArchive: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loadPreview = useCallback(async () => {
    setPreviewError(null);
    const res = await fetch(`/api/media/${asset.id}/access`, { cache: "no-store" });
    if (!res.ok) {
      setPreviewError("Preview unavailable.");
      setPreviewUrl(null);
      return;
    }
    const json = (await res.json()) as { url?: string };
    setPreviewUrl(json.url || null);
  }, [asset.id]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const dims = formatDimensions(asset.width, asset.height);
  const duration = formatDuration(asset.duration_seconds);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Media details for ${asset.original_filename}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[16px] bg-white shadow-xl sm:rounded-[16px]">
        <div className="flex items-center justify-between border-b border-[var(--altus-border)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              {mediaTypeLabel(asset.media_type)} · {asset.status}
            </p>
            <p className="truncate text-sm font-semibold text-[var(--altus-text)]">
              {asset.original_filename}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-md border border-[var(--altus-border)] px-3 text-sm font-semibold"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          <div className="overflow-hidden rounded-[12px] border border-[var(--altus-border)] bg-[var(--altus-section)]">
            {previewError ? (
              <div className="flex h-56 items-center justify-center gap-3 p-4 text-sm text-[var(--altus-text-secondary)]">
                <span>{previewError}</span>
                <button
                  type="button"
                  onClick={() => void loadPreview()}
                  className="min-h-10 rounded-md border border-[var(--altus-border)] bg-white px-3 text-sm font-semibold"
                >
                  Retry preview
                </button>
              </div>
            ) : asset.media_type === "IMAGE" && previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={asset.original_filename}
                className="max-h-[50vh] w-full object-contain"
                onError={() => void loadPreview()}
              />
            ) : asset.media_type === "VIDEO" && previewUrl ? (
              <video
                key={previewUrl}
                src={previewUrl}
                controls
                className="max-h-[50vh] w-full"
                aria-label={`Video preview of ${asset.original_filename}`}
              />
            ) : asset.media_type === "DOCUMENT" && previewUrl ? (
              <div className="flex h-56 flex-col items-center justify-center gap-3 p-6">
                <p className="text-sm font-semibold text-[var(--altus-text)]">PDF document</p>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-11 rounded-md bg-[var(--altus-blue)] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Open secure preview
                </a>
              </div>
            ) : (
              <div className="flex h-56 items-center justify-center text-sm text-[var(--altus-text-secondary)]">
                Loading preview…
              </div>
            )}
          </div>

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
                Filename
              </dt>
              <dd className="mt-1 break-all text-[var(--altus-text)]">
                {asset.original_filename}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
                Type
              </dt>
              <dd className="mt-1 text-[var(--altus-text)]">
                {mediaTypeLabel(asset.media_type)} · {asset.mime_type}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
                Size
              </dt>
              <dd className="mt-1 text-[var(--altus-text)]">
                {formatBytes(asset.size_bytes)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
                Uploaded
              </dt>
              <dd className="mt-1 text-[var(--altus-text)]">
                {formatUploadDate(asset.created_at)}
              </dd>
            </div>
            {dims ? (
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
                  Dimensions
                </dt>
                <dd className="mt-1 text-[var(--altus-text)]">{dims}</dd>
              </div>
            ) : null}
            {duration ? (
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
                  Duration
                </dt>
                <dd className="mt-1 text-[var(--altus-text)]">{duration}</dd>
              </div>
            ) : null}
          </dl>

          {confirmArchive ? (
            <div
              className="rounded-[12px] border border-[var(--altus-border)] bg-[var(--altus-section)] p-4"
              role="alertdialog"
              aria-label="Confirm archive"
            >
              <p className="text-sm font-semibold text-[var(--altus-text)]">
                Archive this asset?
              </p>
              <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
                The asset will be removed from the active Media Library but its
                original file will be preserved.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={archiving}
                  onClick={onConfirmArchive}
                  className="min-h-11 rounded-md bg-[var(--altus-blue)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {archiving ? "Archiving…" : "Archive"}
                </button>
                <button
                  type="button"
                  disabled={archiving}
                  onClick={onCancelArchive}
                  className="min-h-11 rounded-md border border-[var(--altus-border)] bg-white px-4 text-sm font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 border-t border-[var(--altus-border)] pt-4">
              <button
                type="button"
                disabled
                title="Coming next"
                className="min-h-11 rounded-md border border-[var(--altus-border)] bg-[var(--altus-section)] px-4 text-sm font-semibold text-[var(--altus-text-secondary)]"
              >
                Use in Campaign · Coming next
              </button>
              {asset.status === "ACTIVE" ? (
                <button
                  type="button"
                  onClick={onRequestArchive}
                  className="min-h-11 rounded-md border border-[var(--altus-border)] bg-white px-4 text-sm font-semibold text-[var(--altus-text)]"
                >
                  Archive
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
