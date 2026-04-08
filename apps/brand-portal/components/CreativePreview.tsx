"use client";

export type CreativePreviewProps = {
  imageUrl?: string | null;
  assembledUrl?: string | null;
  headline?: string | null;
  subheadline?: string | null;
  cta?: string | null;
  backgroundColor?: string | null;
  layout?: string | null;
  brandColor?: string;
};

export function CreativePreview({
  imageUrl,
  assembledUrl,
  headline,
  subheadline,
  cta,
  backgroundColor,
  layout,
  brandColor = "#6366f1",
}: CreativePreviewProps) {
  const useCss = !assembledUrl || assembledUrl === imageUrl;
  if (!useCss && assembledUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={assembledUrl} alt="" className="h-48 w-full object-cover rounded-lg" />;
  }
  const align =
    layout === "centered"
      ? "items-center text-center"
      : layout === "bottom_bar"
        ? "items-end text-left pb-4"
        : "items-start text-left pt-4 pl-4";
  return (
    <div
      className={`relative h-48 w-full overflow-hidden rounded-lg flex flex-col justify-between ${align}`}
      style={{
        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: backgroundColor || "#1e293b",
      }}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: backgroundColor || "#0f172a", opacity: 0.55 }}
      />
      <div className="relative z-10 p-3 text-white max-w-[95%]">
        <p className="font-display font-bold text-lg leading-tight drop-shadow">{headline}</p>
        {subheadline ? (
          <p className="text-xs text-white/80 mt-1 line-clamp-2">{subheadline}</p>
        ) : null}
        {cta ? (
          <span
            className="mt-2 inline-block rounded-md px-3 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: brandColor }}
          >
            {cta}
          </span>
        ) : null}
      </div>
    </div>
  );
}
