import Image from "next/image";

type BrandMarkProps = {
  size?: number;
  width?: number;
  wordmark?: boolean;
  area?: string;
  tone?: "auto" | "dark-surface";
};

export default function BrandMark({
  size = 32,
  width = 116,
  wordmark = true,
  area,
  tone = "auto",
}: BrandMarkProps) {
  if (!wordmark) {
    return <Image src="/brand/edulexa-icon.svg" width={size} height={size} alt="" className="shrink-0" loading="eager" unoptimized />;
  }

  const height = Math.round(width * 143 / 420);
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      {tone === "auto" && (
        <Image src="/brand/edulexa-light.svg" width={width} height={height} alt="Edulexa" className="block h-auto shrink-0 dark:hidden" loading="eager" unoptimized />
      )}
      <Image src="/brand/edulexa-dark.svg" width={width} height={height} alt="Edulexa" className={tone === "auto" ? "hidden h-auto shrink-0 dark:block" : "block h-auto shrink-0"} loading="eager" unoptimized />
      {area && <span className="sr-only text-sm text-muted-foreground sm:not-sr-only sm:truncate">{area}</span>}
    </span>
  );
}
