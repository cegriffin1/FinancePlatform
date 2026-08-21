import { cn } from "@/lib/cn";

type AltusLogoProps = {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  showDescriptor?: boolean;
  inverted?: boolean;
};

/** Minimal geometric A mark — luxury financial + modern tech monogram. */
export function AltusMark({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  const fill = inverted ? "#FFFFFF" : "#0068B5";
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-8 w-8", className)}
      aria-hidden
    >
      <path
        d="M20 4L34 36H27.2L24.1 28.4H15.9L12.8 36H6L20 4Z"
        fill={fill}
      />
      <path
        d="M17.35 24.6H22.65L20 18.1L17.35 24.6Z"
        fill={inverted ? "#004C91" : "#FFFFFF"}
      />
    </svg>
  );
}

export function AltusLogo({
  className,
  markClassName,
  showWordmark = true,
  showDescriptor = false,
  inverted = false,
}: AltusLogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <AltusMark className={markClassName} inverted={inverted} />
      {showWordmark ? (
        <div className="leading-none">
          <div
            className={cn(
              "text-[17px] font-semibold tracking-[0.04em]",
              inverted ? "text-white" : "text-[var(--altus-text)]",
            )}
          >
            ALTUS
          </div>
          {showDescriptor ? (
            <div
              className={cn(
                "mt-1 text-[10px] font-medium tracking-[0.12em] uppercase",
                inverted ? "text-white/70" : "text-[var(--altus-text-secondary)]",
              )}
            >
              Financial Intelligence
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
