import { memo, useEffect, useRef, useState } from "react";
import {
  demoArtists,
  safeUrl,
  validArtist,
  type Artist,
} from "../../lib/artist-globe/data";
import type { createGlobe } from "./scene";
import NominateArtistForm from "./NominateArtist";
import WanderersBoard from "./Wanderers";
const NominateArtist = memo(NominateArtistForm);
const Wanderers = memo(WanderersBoard);
type Globe = Awaited<ReturnType<typeof createGlobe>>;
export default function ArtistGlobe() {
  const [artists, setArtists] = useState(demoArtists);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [selected, setSelected] = useState<Artist>(demoArtists[0]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [query, setQuery] = useState("");
  const [directory, setDirectory] = useState(false);
  const [time, setTime] = useState("");

  const [hover, setHover] = useState<Artist | null>(null);
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<Globe>();
  const panel = useRef<HTMLElement>(null);
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

    const tick = () => {
      setTime(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZoneName: "short",
        }).format(new Date()),
      );
    };

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
          (artist) => {
            if (!cancelled)
              setSelected((previous) =>
                previous === artist ? previous : artist,
              );
          },
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
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && directory) {
        setDirectory(false);
        document
          .querySelector<HTMLButtonElement>(".directory-toggle")
          ?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [directory]);
  const select = (
    artist: Artist,
    _event?: React.MouseEvent<HTMLElement>,
    focus = false,
  ) => {
    setSelected(artist);
    setHover(null);
    if (focus) {
      scene.current?.focus(artist);
    }
  };
  const discover = async () => {
    if (discovering || !ready) return;
    const alternatives = artists.filter((a) => a.id !== selected?.id);
    const artist = (alternatives.length ? alternatives : artists)[
      Math.floor(Math.random() * (alternatives.length || artists.length))
    ];
    setDiscovering(true);
    setHover(null);
    try {
      const completed = await scene.current?.discover(artist);
      if (completed) {
        setSelected(artist);
      }
    } finally {
      setDiscovering(false);
    }
  };
  const filtered = artists.filter((a) =>
    `${a.name} ${a.current_city} ${a.country} ${a.disciplines.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <div className="artist-atlas">
      <h1 className="atlas-title">Art in Every Corner</h1>
      <section className="observatory" aria-label="Artist globe explorer">
        <div className="globe-workspace">
          <div className="globe-stage" ref={host}>
            {artists.map((a) => (
              <button
                type="button"
                key={a.id}
                data-marker={a.id}
                className={`artist-marker ${selected?.id === a.id ? "is-selected" : ""}`}
                hidden={!ready || failed}
                aria-label={`${a.name}, ${a.current_city}, ${a.disciplines.join(" and ")}${a.is_demo ? ", demo artist" : ""}`}
                aria-pressed={selected?.id === a.id}
                onClick={(e) => select(a, e, true)}
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
          <svg className="radar-link" aria-hidden="true">
            <line />
          </svg>
          <div className="radar" aria-hidden="true">
            <span className="radar-orbit" />
            <span className="radar-centre" />
          </div>
          <div className="spotlight-name" aria-hidden="true">
            <strong>{selected.name}</strong>
            <span>{selected.current_city}</span>
          </div>
          <button
            className={`discover-button ${discovering ? "is-spinning" : ""}`}
            disabled={!ready || discovering}
            onClick={discover}
          >
            <span aria-hidden="true">↻</span>{" "}
            {discovering ? "Discovering…" : "Discover an Artist!"}
          </button>
          <div className="workspace-bottom">
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
                aria-label="Show whole globe"
                onClick={() => scene.current?.reset()}
              >
                ◎
              </button>
            </div>
          </div>
        </div>
        <div className="artist-rail">
          {selected ? (
            <aside
              className="artist-panel"
              ref={panel}
              aria-label="Selected artist"
            >
              <div className="artist-summary">
                <span className="profile-symbol" aria-hidden="true">
                  ✳
                </span>
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
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                      selected.public_email,
                    ) && (
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
                    This person and their story are invented for the prototype.
                    No real biography, artwork, or contact details are implied.
                  </p>
                )}
              </div>
            </aside>
          ) : null}
        </div>
      </section>
      <div className="atlas-readout">
        <span className="micro">
          <span className="signal" /> Your local time <time>{time || "—"}</time>
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
      <div className="atlas-community">
        <NominateArtist />
        <Wanderers />
      </div>
      <noscript>
        The interactive atlas needs JavaScript. All profiles in this initial
        edition are fictional demonstrations.
      </noscript>
    </div>
  );
}
