import Image from "next/image";

import { cn } from "@/lib/utils";

interface BrandLogoProps {
  tagline?: string;
  className?: string;
  imageClassName?: string;
  showTagline?: boolean;
  align?: "start" | "center";
}

export function BrandLogo({
  tagline,
  className,
  imageClassName,
  showTagline = true,
  align = "start",
}: BrandLogoProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      <Image
        src="/brand/jouwtdl-logo.svg"
        alt="jouwtdl"
        width={420}
        height={96}
        className={cn("h-10 w-auto", imageClassName)}
      />
      {showTagline && tagline ? (
        <p
          className={cn(
            "text-xs text-[color:var(--muted)]",
            align === "center" ? "text-center" : "pl-1 text-left",
          )}
        >
          {tagline}
        </p>
      ) : null}
    </div>
  );
}
