import { cn } from "@/lib/cn";
import type { PropsWithChildren } from "react";

export function AltusContainer({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn("mx-auto w-full max-w-[1180px] px-5 md:px-6", className)}>
      {children}
    </div>
  );
}
