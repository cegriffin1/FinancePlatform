export function ErrorState({
  title = "Something went wrong",
  description,
}: {
  title?: string;
  description: string;
}) {
  return (
    <div
      className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-6 text-[var(--danger)]"
      role="alert"
    >
      <h2 className="font-medium">{title}</h2>
      <p className="mt-2 text-sm opacity-90">{description}</p>
    </div>
  );
}
