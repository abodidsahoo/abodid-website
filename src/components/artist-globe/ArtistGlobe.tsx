import { useEffect, useMemo, useRef, useState } from "react";
import {
  validArtist,
  validProfile,
  type Artist,
} from "../../lib/artist-globe/data";
import { searchArtists } from "../../lib/artist-globe/search";
import {
  artistGivenName,
  artistGoogleSearch,
  countryFlag,
  profileLinks,
  specificPractices,
} from "../../lib/artist-globe/profile";
import type { createGlobe } from "./scene";
import DiceButton from "./DiceButton";
type Globe = Awaited<ReturnType<typeof createGlobe>>;
export default function ArtistGlobe() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selected, setSelected] = useState<Artist | null>(null);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const [discovering, setDiscovering] = useState(false),
    [query, setQuery] = useState("");
  const [countries, setCountries] = useState(true),
    [places, setPlaces] = useState(true);
  const [dieMotion, setDieMotion] = useState(true);
  const [time, setTime] = useState(""),
    [hover, setHover] = useState<Artist | null>(null);
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<Globe>();
  const card = useRef<HTMLElement>(null),
    lastCardFade = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null),
    menu = useRef<HTMLDetailsElement>(null);
  const projectInfo = useRef<HTMLDialogElement>(null);
  const mapped = useMemo(() => artists.filter(validArtist), [artists]);
  const filtered = useMemo(
    () => searchArtists(artists, query),
    [artists, query],
  );
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/artist-globe/artists", {
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(8000)]),
    })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(Error("Artists unavailable")),
      )
      .then((data) => {
        const records: Artist[] = data.artists?.filter(validProfile) || [];
        setArtists(records);
        setSelected(records.find(validArtist) || records[0] || null);
        if (!records.length) setFailed(true);
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      });
    const tick = () =>
      setTime(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZoneName: "short",
        }).format(new Date()),
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => {
      abort.abort();
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!mapped.length) return;
    let cancelled = false,
      instance: Globe | undefined;
    setReady(false);
    import("./scene")
      .then(({ createGlobe }) => {
        if (cancelled || !host.current) return;
        return createGlobe(
          host.current,
          mapped,
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
        if (!result) return;
        instance = result;
        if (cancelled) result.dispose();
        else scene.current = result;
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
  }, [mapped]);
  useEffect(() => {
    scene.current?.labels({ countries, places });
  }, [countries, places, ready]);
  useEffect(() => {
    if (
      !selected ||
      !card.current ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const now = performance.now();
    if (now - lastCardFade.current < 180) return;
    lastCardFade.current = now;
    const fade = card.current.animate([{ opacity: 0.8 }, { opacity: 1 }], {
      duration: 150,
      easing: "ease-out",
    });
    return () => fade.cancel();
  }, [selected?.id]);
  const select = (artist: Artist, focus = false) => {
    setSelected(artist);
    setHover(null);
    if (focus && validArtist(artist)) scene.current?.focus(artist);
  };
  const openIndex = () => {
    setQuery("");
    dialog.current?.showModal();
  };
  const discover = async (direction?: number) => {
    if (!ready || discovering || !mapped.length) return;
    const options = mapped.filter((a) => a.id !== selected?.id);
    const pool = options.length ? options : mapped;
    const artist = pool[Math.floor(Math.random() * pool.length)];
    setDiscovering(true);
    setHover(null);
    try {
      if (await scene.current?.discover(artist, direction)) setSelected(artist);
    } finally {
      setDiscovering(false);
    }
  };
  const sourceFrequency = useMemo(() => {
    const counts = new Map<string, number>();
    for (const artist of artists)
      for (const url of new Set(artist.sources))
        counts.set(url, (counts.get(url) || 0) + 1);
    return counts;
  }, [artists]);
  const links = selected ? profileLinks(selected, sourceFrequency) : [];
  const flag = selected ? countryFlag(selected.country) : undefined;
  return (
    <div className="artist-atlas">
      <h1 className="atlas-title">Art in Every Corner</h1>
      <section className="observatory" aria-label="Artist globe explorer">
        <div className="globe-workspace">
          <div className="globe-stage" ref={host}>
            {mapped.map((a) => (
              <button
                type="button"
                key={a.id}
                data-marker={a.id}
                className={`artist-marker ${selected?.id === a.id ? "is-selected" : ""}`}
                hidden={!ready || failed}
                aria-label={`${a.name}, ${a.current_city}, ${a.country}`}
                aria-pressed={selected?.id === a.id}
                onClick={() => select(a, true)}
                onMouseEnter={() => setHover(a)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(a)}
                onBlur={() => setHover(null)}
              >
                <span />
              </button>
            ))}
            {!ready && !failed && (
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
                <p>The globe is unavailable in this browser.</p>
                <button onClick={openIndex}>Explore the artist index</button>
              </div>
            )}
          </div>
          {hover && (
            <div className="marker-tooltip">
              <strong>{hover.name}</strong>
              <span>
                {hover.current_city}, {hover.country}
              </span>
            </div>
          )}
          <div className="radar" aria-hidden="true">
            <span className="radar-orbit" />
            <span className="radar-centre" />
          </div>
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
          <details className="globe-menu" ref={menu}>
            <summary aria-label="Globe menu">
              <span aria-hidden="true">☰</span>
            </summary>
            <div className="globe-menu-content">
              <p>Make it your world</p>
              <label>
                <input
                  type="checkbox"
                  checked={countries}
                  onChange={(e) => setCountries(e.target.checked)}
                />
                Show country names
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={places}
                  onChange={(e) => setPlaces(e.target.checked)}
                />
                Show city & place names
              </label>
              <button className="directory-toggle" onClick={openIndex}>
                Artist index <span aria-hidden="true">↗</span>
              </button>
              <label>
                <input
                  type="checkbox"
                  checked={dieMotion}
                  onChange={(e) => setDieMotion(e.target.checked)}
                />
                Float the die
              </label>
              <div className="map-credits">
                Dots include approximate city/country placements. Map data:{" "}
                <a
                  href="https://www.naturalearthdata.com/about/terms-of-use/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Natural Earth
                </a>{" "}
                ·{" "}
                <a
                  href="https://www.geonames.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GeoNames
                </a>{" "}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  (CC BY 4.0)
                </a>
              </div>
            </div>
          </details>
          {flag && (
            <img
              key={flag}
              className="country-flag"
              src={flag}
              width="80"
              height="56"
              alt={`${selected?.country} flag`}
              decoding="async"
              onError={(e) => {
                e.currentTarget.hidden = true;
              }}
            />
          )}
          <DiceButton
            disabled={!ready || discovering}
            onRoll={discover}
            animate={dieMotion}
          />
          <div
            className="globe-coordinates"
            aria-label="Central pointer coordinates"
            role="group"
          >
            {(["latitude", "longitude"] as const).map((axis) => (
              <div
                key={axis}
                className="coordinate-crown"
                data-coordinate={axis}
                role="spinbutton"
                tabIndex={0}
                aria-label={axis === "latitude" ? "Latitude" : "Longitude"}
                aria-valuemin={axis === "latitude" ? -85 : -180}
                aria-valuemax={axis === "latitude" ? 85 : 180}
                aria-valuenow={0}
                title={`Scroll or drag ${axis === "latitude" ? "up/down" : "left/right"}; arrow keys adjust ${axis}`}
              >
                <span className="coordinate-axis" aria-hidden="true">
                  {axis === "latitude" ? "LAT" : "LON"}
                </span>
                <span className="coordinate-reels" aria-hidden="true">
                  {[0, 1, 2].map((place) => (
                    <span className="coordinate-digit" key={place}>
                      <span className="coordinate-drum" data-coordinate-drum="">
                        {Array.from({ length: 10 }, (_, digit) => (
                          <span
                            className="coordinate-face"
                            key={digit}
                            style={{
                              transform: `rotateX(${digit * 36}deg) translateZ(var(--drum-radius))`,
                            }}
                          >
                            {digit}
                          </span>
                        ))}
                      </span>
                    </span>
                  ))}
                </span>
                <span className="coordinate-direction" aria-hidden="true">
                  <sup>°</sup>
                  <span data-coordinate-hemisphere="">
                    {axis === "latitude" ? "N" : "E"}
                  </span>
                </span>
                <span className="coordinate-knob" aria-hidden="true">
                  <svg
                    className="coordinate-arrows"
                    viewBox="0 0 16 16"
                    focusable="false"
                  >
                    <path
                      d={
                        axis === "latitude"
                          ? "M8 2v12M5 5l3-3 3 3M5 11l3 3 3-3"
                          : "M2 8h12M5 5l-3 3 3 3M11 5l3 3-3 3"
                      }
                    />
                  </svg>
                </span>
              </div>
            ))}
          </div>
          <div className="atlas-readout">
            <time>{time || "—"}</time>
            <p className="atlas-credit">
              Designed and developed by{" "}
              <a href="https://abodid.com/">Abodid Sahoo</a>.
            </p>
            <button
              className="project-info-toggle"
              type="button"
              aria-haspopup="dialog"
              aria-controls="atlas-project-info"
              onClick={() => projectInfo.current?.showModal()}
            >
              Project Info
            </button>
          </div>
        </div>
        <aside className="artist-panel" ref={card} aria-label="Selected artist">
          {selected ? (
            <>
              <div className="artist-summary">
                <span className="profile-symbol" aria-hidden="true">
                  ✳
                </span>
                <h2>{selected.name}</h2>
                <p className="artist-location">
                  <span className="artist-country">
                    <span className="country-name">{selected.country}</span>
                  </span>
                </p>
                {selected.current_city && (
                  <p className="artist-city">{selected.current_city}</p>
                )}
              </div>
              <div className="artist-story" id="artist-story" key={selected.id}>
                {!!specificPractices(selected).length && (
                  <p className="artist-practice">
                    {specificPractices(selected).join(" & ")}
                  </p>
                )}
                <div
                  className={`artist-links${specificPractices(selected).length ? " has-context" : ""}`}
                >
                  {links.map((link) => (
                    <a
                      key={link.url!}
                      className={`profile-link profile-link-${link.kind}`}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label} <span aria-hidden="true">↗</span>
                    </a>
                  ))}
                </div>
                <a
                  className="artist-google-search"
                  href={artistGoogleSearch(selected)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Learn more about {artistGivenName(selected.name)}{" "}
                  <span aria-hidden="true">↗</span>
                </a>
                {selected.is_demo && (
                  <p className="location-note">
                    Fictional demonstration profile.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="artist-summary">
              <h2>
                {failed ? "Artist index unavailable" : "Finding a corner…"}
              </h2>
            </div>
          )}
        </aside>
      </section>
      <dialog
        className="atlas-project-info"
        id="atlas-project-info"
        ref={projectInfo}
        aria-labelledby="project-info-title"
      >
        <div className="project-info-heading">
          <h2 id="project-info-title">Project Info</h2>
          <form method="dialog">
            <button aria-label="Close project info" autoFocus>
              ×
            </button>
          </form>
        </div>
        <div className="project-info-body" tabIndex={0}>
          <section>
            <h3>Why this project?</h3>
            <p>
              I made Art in Every Corner out of an urge to discover new artists
              and share their work with the world. Research often leads us back
              to familiar places: New York, London, Berlin. When we keep looking
              in the same localities, we miss extraordinary practices taking
              shape elsewhere.
            </p>
            <p>
              This globe is an invitation to follow your curiosity beyond those
              hotspots and meet artists you might otherwise never encounter.
            </p>
          </section>
          <section>
            <h3>A little discovery, every day</h3>
            <p>
              Wander around the world, roll the die, and let an unfamiliar name
              become a new connection. I want this to be a playful experience
              people return to each day, finding another artist and following
              their work wherever it lives online.
            </p>
          </section>
          <section>
            <h3>Where it could go</h3>
            <p>
              In the future, people will be able to nominate amazing artists
              from their own locality. The ambition is to grow this into a
              repository of 100,000 emerging artists over the next three years,
              shaped by the people who know their communities best.
            </p>
          </section>
          <section>
            <h3>Made with</h3>
            <p>
              Astro and React power the experience, Three.js brings the globe
              and die to life, and Supabase holds the artist directory.
              Geographic data comes from Natural Earth and GeoNames.
            </p>
          </section>
          <section className="project-info-role">
            <h3>My role</h3>
            <p>Concept, creative technology, design &amp; development.</p>
            <a href="https://abodid.com/">Abodid Sahoo ↗</a>
          </section>
        </div>
      </dialog>
      <dialog
        className="artist-directory"
        id="artist-directory"
        ref={dialog}
        aria-labelledby="directory-title"
      >
        <div className="directory-heading">
          <div>
            <p className="micro">An atlas of practices</p>
            <h2 id="directory-title">Find your next artist.</h2>
          </div>
          <form method="dialog">
            <button aria-label="Close artist index">×</button>
          </form>
        </div>
        <label className="directory-search">
          <span>Search artists, countries, places or styles</span>
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try Japan, photography, or a name…"
          />
        </label>
        <p className="directory-count" role="status">
          {filtered.length} {filtered.length === 1 ? "artist" : "artists"} ·{" "}
          {mapped.length} mapped locations
        </p>
        <ul>
          {filtered.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => {
                  select(a, true);
                  dialog.current?.close();
                  menu.current?.removeAttribute("open");
                }}
              >
                <span className="index-name">
                  {a.name}
                  <span aria-hidden="true">↗</span>
                </span>
                <span className="index-location">
                  {a.current_city ? `${a.current_city} · ` : ""}
                  {a.country}
                </span>
                <span className="index-practice">
                  {a.disciplines.join(" & ")}
                </span>
                <small>
                  {a.map_placement === "country"
                    ? "Country-level placement"
                    : "On the globe"}
                </small>
              </button>
            </li>
          ))}
        </ul>
        {!filtered.length && (
          <p className="no-results">
            No matches yet. Try another name, country or practice.
          </p>
        )}
      </dialog>
      <noscript>The interactive atlas needs JavaScript.</noscript>
    </div>
  );
}
