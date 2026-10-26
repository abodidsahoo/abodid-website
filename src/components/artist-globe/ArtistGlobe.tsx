import { useEffect, useRef, useState } from "react";
import {
  demoArtists,
  safeUrl,
  validArtist,
  type Artist,
} from "../../lib/artist-globe/data";
import type { createGlobe } from "./scene";
type Globe = Awaited<ReturnType<typeof createGlobe>>;
export default function ArtistGlobe() {
  const [artists, setArtists] = useState(demoArtists);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [selected, setSelected] = useState<Artist | null>(null);
  const [pinned, setPinned] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [spin, setSpin] = useState(false);
  const [query, setQuery] = useState("");
  const [directory, setDirectory] = useState(false);
  const [time, setTime] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [hover, setHover] = useState<Artist | null>(null);
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<Globe>();
  const panel = useRef<HTMLElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/artist-globe/artists", {
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(6000)]),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const records = data?.artists?.filter(validArtist);
        if (records?.length)
          setArtists((previous) =>
            JSON.stringify(previous) === JSON.stringify(records)
              ? previous
              : records,
          );
      })
      .catch(() => {})
      .finally(() => {
        if (!abort.signal.aborted) setDataLoaded(true);
      });
    const start = Date.now();
    const tick = () => {
      setTime(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZoneName: "short",
        }).format(new Date()),
      );
      setElapsed(Math.floor((Date.now() - start) / 1000));
    };
    setSpin(!matchMedia("(prefers-reduced-motion: reduce)").matches);
    tick();
    const timer = setInterval(tick, 1000);
    return () => {
      abort.abort();
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!dataLoaded) return;
    let cancelled = false;
    let instance: Globe;
    setReady(false);
    import("./scene")
      .then(({ createGlobe }) => {
        if (cancelled || !host.current) return;
        return createGlobe(
          host.current,
          artists,
          () => {
            if (!cancelled) setReady(true);
          },
          () => setSpin(false),
        );
      })
      .then((result) => {
        if (result) {
          instance = result;
          if (cancelled) result.dispose();
          else scene.current = result;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
      instance?.dispose();
      scene.current = undefined;
    };
  }, [artists, dataLoaded]);
  useEffect(() => {
    if (selected && matchMedia("(max-width:720px)").matches) {
      const frame = requestAnimationFrame(() =>
        panel.current?.querySelector(".artist-summary")?.scrollIntoView({
          block: "end",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [selected]);
  const close = () => {
    setSelected(null);
    setPinned(false);
    lastTrigger.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (!selected || pinned) return;
    const outside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        !panel.current?.contains(target) &&
        !target.closest("button,a,input")
      ) {
        setSelected(null);
        setPinned(false);
      }
    };
    document.addEventListener("click", outside);
    return () => document.removeEventListener("click", outside);
  }, [selected, pinned]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        setPinned(false);
        setDirectory(false);
        lastTrigger.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, []);
  const select = (
    artist: Artist,
    event?: React.MouseEvent<HTMLElement>,
    focus = false,
  ) => {
    if (event) lastTrigger.current = event.currentTarget;
    setSelected(artist);
    setHover(null);
    if (focus) {
      scene.current?.focus(artist);
      setSpin(false);
    }
  };
  const countries = new Set(artists.map((a) => a.country)).size;
  const filtered = artists.filter((a) =>
    `${a.name} ${a.current_city} ${a.country} ${a.disciplines.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const demo = artists.every((a) => a.is_demo);
  return (
    <div className="artist-atlas">
      <section className="atlas-intro">
        <div>
          <p className="micro eyebrow">
            <span className="signal" /> Open atlas / No. 001
          </p>
          <h1>
            Art in every
            <br />
            <span>corner.</span>
            <span className="title-star" aria-hidden="true">
              ✳
            </span>
          </h1>
        </div>
        <div className="intro-note">
          <p>
            Somewhere, someone
            <br />
            is making something.
          </p>
          <span>
            Spin the world. Follow a point.
            <br />
            Find another way of seeing.
          </span>
        </div>
      </section>
      <div className="atlas-topline">
        <span className="micro">
          {String(artists.length).padStart(2, "0")} artists · {countries}{" "}
          countries · One shared planet
        </span>
        <span className="demo-badge">
          {demo
            ? "Demo atlas · fictional profiles"
            : "Artist atlas · demo profiles labelled"}
        </span>
      </div>
      <section
        className={`observatory ${pinned && selected ? "is-pinned" : ""}`}
        aria-label="Artist globe explorer"
      >
        <div
          className="globe-workspace"
          onClick={(e) => {
            if (
              e.target === host.current ||
              e.target instanceof HTMLCanvasElement
            ) {
              if (!pinned && selected) close();
            }
          }}
        >
          <div className="space-meta micro">
            <span>Earth / Third from the sun</span>
            <span>23.4° axial curiosity</span>
          </div>
          <div className="globe-stage" ref={host}>
            <div className="orbit orbit-one" aria-hidden="true" />
            <div className="orbit orbit-two" aria-hidden="true" />
            {artists.map((a) => (
              <button
                type="button"
                key={a.id}
                data-marker={a.id}
                className={`artist-marker ${selected?.id === a.id ? "is-selected" : ""}`}
                hidden={!ready || failed}
                aria-label={`${a.name}, ${a.current_city}, ${a.disciplines.join(" and ")}${a.is_demo ? ", demo artist" : ""}`}
                aria-pressed={selected?.id === a.id}
                onClick={(e) => select(a, e)}
                onMouseEnter={() => setHover(a)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(a)}
                onBlur={() => setHover(null)}
              >
                <span />
              </button>
            ))}
            {!ready && (
              <div className="globe-loader" role="status">
                <span className="loading-planet" />
                <span className="loading-type">
                  Loading — art in every corner
                </span>
              </div>
            )}
            {failed && (
              <div className="globe-fallback">
                <span aria-hidden="true">◎</span>
                <p>Your browser couldn’t start the 3D globe.</p>
                <button onClick={() => setDirectory(true)}>
                  Explore the artist list ↓
                </button>
              </div>
            )}
          </div>
          {hover && (
            <div className="marker-tooltip" role="status">
              <strong>
                {hover.name}
                {hover.is_demo ? " · Demo" : ""}
              </strong>
              <span>{hover.disciplines.join(" & ")}</span>
              <span>
                {hover.current_city}, {hover.country}
              </span>
            </div>
          )}
          <div className="workspace-bottom">
            <p className="micro gesture-hint">
              Drag to wander
              <br />
              Pinch or scroll to get closer
            </p>
            <div className="globe-controls" aria-label="Globe controls">
              <button
                aria-label="Zoom out"
                onClick={() => scene.current?.zoom(1)}
              >
                −
              </button>
              <button
                aria-label="Zoom in"
                onClick={() => scene.current?.zoom(-1)}
              >
                +
              </button>
              <button
                aria-label="Auto rotate"
                aria-pressed={spin}
                onClick={() => {
                  setSpin(!spin);
                  scene.current?.spin(!spin);
                }}
              >
                {spin ? "Ⅱ" : "▷"}
              </button>
            </div>
          </div>
        </div>
        {selected ? (
          <aside
            className="artist-panel"
            ref={panel}
            aria-label="Selected artist"
          >
            <div className="panel-tools">
              <span className="micro">
                Field note / {selected.id.replace("demo-", "")}
              </span>
              <div>
                <button
                  aria-pressed={pinned}
                  onClick={() => setPinned(!pinned)}
                >
                  {pinned ? "Unpin" : "Pin"}
                </button>
                <button aria-label="Close artist details" onClick={close}>
                  ×
                </button>
              </div>
            </div>
            <div className="artist-summary" aria-live="polite">
              <span className="profile-symbol" aria-hidden="true">
                ✳
              </span>
              {selected.is_demo && (
                <span className="demo-badge">Fictional demo artist</span>
              )}
              <h2>{selected.name}</h2>
              <p className="artist-practice">
                {selected.disciplines.join(" & ")}
              </p>
              <p className="artist-location">
                {selected.current_city}, {selected.country}
              </p>
              <a className="mobile-detail-link" href="#artist-story">
                Scroll for their story ↓
              </a>
            </div>
            <div className="artist-story" id="artist-story">
              <p className="micro">A practice, in place</p>
              <p>{selected.biography}</p>
              {selected.origin && (
                <p className="origin">Origin: {selected.origin}</p>
              )}
              <div className="artist-tags">
                {selected.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              {selected.artist_statement && (
                <blockquote>“{selected.artist_statement}”</blockquote>
              )}
              <div className="artist-links">
                {safeUrl(selected.portfolio_url) && (
                  <a
                    href={safeUrl(selected.portfolio_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Portfolio ↗
                  </a>
                )}
                {safeUrl(selected.instagram_url) && (
                  <a
                    href={safeUrl(selected.instagram_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Instagram ↗
                  </a>
                )}
                {selected.public_email &&
                  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(selected.public_email) && (
                    <a href={`mailto:${selected.public_email}`}>
                      Professional email ↗
                    </a>
                  )}
              </div>
              {!!selected.artwork_urls?.filter(safeUrl).length && (
                <div className="artwork-gallery">
                  {selected.artwork_urls
                    .filter(safeUrl)
                    .slice(0, 4)
                    .map((url, i) => (
                      <a
                        href={url}
                        key={url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={url}
                          alt={`Artwork ${i + 1} by ${selected.name}`}
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.parentElement!.hidden = true;
                          }}
                        />
                      </a>
                    ))}
                </div>
              )}
              {selected.sources?.filter(safeUrl).map((url, i) => (
                <a
                  className="source-link"
                  href={url}
                  key={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Source {i + 1} ↗
                </a>
              ))}
              {selected.is_demo && (
                <p className="demo-disclosure">
                  This person and their story are invented for the prototype. No
                  real biography, artwork, or contact details are implied.
                </p>
              )}
            </div>
          </aside>
        ) : (
          <aside className="atlas-invitation">
            <span className="micro">A small invitation</span>
            <p>
              There’s a whole
              <br />
              world of ways
              <br />
              to make.
            </p>
            <span className="invitation-star" aria-hidden="true">
              ✳
            </span>
            <p className="invitation-small">
              Every point is a practice.
              <br />
              Pick one. Stay curious.
            </p>
            <button
              onClick={() => {
                const a = artists[Math.floor(Math.random() * artists.length)];
                select(a, undefined, true);
              }}
            >
              Take me somewhere <span aria-hidden="true">↗</span>
            </button>
          </aside>
        )}
      </section>
      <div className="atlas-readout">
        <span className="micro">
          <span className="signal" /> Your local time <time>{time || "—"}</time>
        </span>
        <span className="micro desktop-data">
          Time spent wandering{" "}
          {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
          {String(elapsed % 60).padStart(2, "0")}
        </span>
        <button
          className="directory-toggle"
          aria-expanded={directory}
          aria-controls="artist-directory"
          onClick={() => setDirectory(!directory)}
        >
          {directory ? "Close index −" : "Browse artist index +"}{" "}
        </button>
      </div>
      <section
        id="artist-directory"
        className="artist-directory"
        hidden={!directory && !failed}
      >
        <div className="directory-heading">
          <h2>People, across places.</h2>
          <label>
            Find an artist, place, or practice
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try ceramics, Kyoto…"
            />
          </label>
        </div>
        <ul>
          {filtered.map((a) => (
            <li key={a.id}>
              <button
                onClick={(e) => {
                  select(a, e, true);
                  host.current?.scrollIntoView({
                    behavior: matchMedia("(prefers-reduced-motion: reduce)")
                      .matches
                      ? "instant"
                      : "smooth",
                    block: "center",
                  });
                }}
              >
                <span>
                  {a.name}
                  {a.is_demo && <small>Demo</small>}
                </span>
                <span>{a.disciplines.join(" & ")}</span>
                <span>
                  {a.current_city}, {a.country} ↗
                </span>
              </button>
            </li>
          ))}
        </ul>
        {!filtered.length && (
          <p>No artists match that search. Try another place or practice.</p>
        )}
      </section>
      <noscript>
        The interactive atlas needs JavaScript. All profiles in this initial
        edition are fictional demonstrations.
      </noscript>
    </div>
  );
}
