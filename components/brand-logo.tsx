import Image from "next/image";

import { cn } from "@/lib/utils";

interface BrandLogoProps {
  tagline?: string;
  className?: string;
  imageClassName?: string;
  showTagline?: boolean;
}

export function BrandLogo({
  tagline,
  className,
  imageClassName,
  showTagline = true,
}: BrandLogoProps) {
  return (
    <div className={cn("flex flex-col items-start gap-1 text-left", className)}>
      <Image
        src="/brand/jouwtdl-logo.svg"
        alt="jouwtdl"
        width={420}
        height={96}
        className={cn("h-10 w-auto", imageClassName)}
      />
      {showTagline && tagline ? (
        <p className="pl-1 text-left text-xs text-[color:var(--muted)]">{tagline}</p>
      ) : null}
    </div>
  );
}
