import type { XRShowcaseItem } from "../../data/xr-showcase";

const fallbackThumbnail = "/images/xr-showcase/placeholder.svg";

type Props = {
  item: XRShowcaseItem;
  index: number;
};

export default function XRShowcaseCard({ item, index }: Props) {
  const thumbnail = item.thumbnail || fallbackThumbnail;
  const source = item.source || item.domain || "Source";
  const visibleTags = item.tags.filter((tag) => tag !== item.primaryGenre).slice(0, 4);
  const href = item.canonicalUrl || item.url || "#";

  return (
    <a
      className="xr-card"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${item.title} from ${source}`}
    >
      <span className="xr-card__image-shell">
        <img
          src={thumbnail}
          alt={item.thumbnailAlt || `${item.title} thumbnail`}
          loading={index < 4 ? "eager" : "lazy"}
          decoding="async"
          onError={(event) => {
            event.currentTarget.src = fallbackThumbnail;
          }}
        />
      </span>
      <span className="xr-card__body">
        <span className="xr-card__genre">{item.primaryGenre}</span>
        <span className="xr-card__title">{item.title}</span>
        <span className="xr-card__source">
          {source}
          <span className="xr-card__arrow" aria-hidden="true">
            -&gt;
          </span>
        </span>
        {visibleTags.length > 0 && (
          <span className="xr-card__tags" aria-label={`Tags: ${visibleTags.join(", ")}`}>
            {visibleTags.map((tag) => (
              <span className="xr-card__tag" key={tag}>
                {tag}
              </span>
            ))}
          </span>
        )}
      </span>
    </a>
  );
}
