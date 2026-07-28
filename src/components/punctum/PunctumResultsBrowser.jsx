import { useEffect, useState } from "react";

export default function PunctumResultsBrowser({ fallbackImages }) {
  const [images, setImages] = useState(
    fallbackImages.map((image) => ({ ...image, responseCount: 0 })),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/punctum/results")
      .then(async (response) => {
        if (!response.ok) throw new Error("Results unavailable");
        return response.json();
      })
      .then((payload) => {
        if (active && Array.isArray(payload.images)) setImages(payload.images);
      })
      .catch(() => {
        // The gallery remains useful as an invitation when the API is offline.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="punctum-gallery" aria-busy={loading}>
      {images.map((image) => (
        <a
          className="punctum-gallery-card"
          href={`/research/punctum/results/${image.slug}`}
          key={image.id}
          aria-label={`View ${image.responseCount} ${
            image.responseCount === 1 ? "mark" : "marks"
          } on ${image.title}`}
        >
          <div
            className="punctum-gallery-card__image"
            style={{ "--card-background": image.softBackground }}
          >
            <img
              src={image.url}
              alt={image.title}
              width={image.width}
              height={image.height}
              loading="lazy"
            />
            <span className="punctum-gallery-card__count">
              <strong>{image.responseCount}</strong>
              <span>{image.responseCount === 1 ? "mark" : "marks"}</span>
            </span>
          </div>
        </a>
      ))}
    </section>
  );
}
