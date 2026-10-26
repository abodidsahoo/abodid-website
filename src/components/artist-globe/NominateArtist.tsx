import { useEffect, useRef, useState } from "react";
import countries from "../../lib/artist-globe/countries.json";
type Place = {
  id: string;
  name: string;
  countryCode: string;
  country: string;
  latitude: number;
  longitude: number;
};
export default function NominateArtist() {
  const [city, setCity] = useState(""),
    [country, setCountry] = useState(""),
    [place, setPlace] = useState<Place | null>(null),
    [suggestions, setSuggestions] = useState<Place[]>([]),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(-1);
  const [status, setStatus] = useState(""),
    [pending, setPending] = useState(false),
    [verified, setVerified] = useState(import.meta.env.DEV);
  const form = useRef<HTMLFormElement>(null),
    challenge = useRef<HTMLDivElement>(null),
    token = useRef(import.meta.env.DEV ? "local-preview" : ""),
    widget = useRef<string>();
  useEffect(() => {
    if (city.trim().length < 2 || place) {
      setSuggestions([]);
      return;
    }
    const abort = new AbortController();
    const timeout = setTimeout(() => {
      fetch(
        `/api/artist-globe/locations?q=${encodeURIComponent(city)}&country=${country}`,
        { signal: abort.signal },
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!abort.signal.aborted) {
            setSuggestions(d?.locations || []);
            setActive(-1);
          }
        })
        .catch(() => {});
    }, 220);
    return () => {
      clearTimeout(timeout);
      abort.abort();
    };
  }, [city, country, place]);
  useEffect(() => {
    if (import.meta.env.DEV || !challenge.current) return;
    let cancelled = false;
    const render = () => {
      const turnstile = (window as any).turnstile;
      if (cancelled || !challenge.current || !turnstile || widget.current)
        return;
      widget.current = turnstile.render(challenge.current, {
        sitekey: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY,
        action: "contact",
        appearance: "interaction-only",
        size: "flexible",
        theme: "light",
        callback: (value: string) => {
          token.current = value;
          setVerified(true);
        },
        "expired-callback": () => {
          token.current = "";
          setVerified(false);
        },
        "error-callback": () => {
          token.current = "";
          setVerified(false);
        },
      });
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        if ((window as any).turnstile) {
          render();
          return;
        }
        let script = document.querySelector<HTMLScriptElement>(
          "script[data-globe-verification]",
        );
        if (!script) {
          script = document.createElement("script");
          script.dataset.globeVerification = "true";
          script.src =
            "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
          script.async = true;
          document.head.append(script);
        }
        script.addEventListener("load", render, { once: true });
      },
      { rootMargin: "200px" },
    );
    observer.observe(challenge.current);
    return () => {
      cancelled = true;
      observer.disconnect();
      if (widget.current) (window as any).turnstile?.remove(widget.current);
    };
  }, []);
  const choose = (p: Place) => {
    setPlace(p);
    setCity(p.name);
    setCountry(p.countryCode);
    setOpen(false);
    setSuggestions([]);
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setStatus("");
    try {
      const response = await fetch("/api/artist-globe/nominations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          city,
          country,
          link: data.get("link"),
          fax: data.get("fax"),
          latitude: place?.latitude ?? null,
          longitude: place?.longitude ?? null,
          turnstileToken: token.current,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Could not send your nomination.");
      setStatus("Thank you. Your nomination is saved for review.");
      form.current?.reset();
      setCity("");
      setCountry("");
      setPlace(null);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setPending(false);
      if (!import.meta.env.DEV) {
        token.current = "";
        setVerified(false);
        if (widget.current) (window as any).turnstile?.reset(widget.current);
      }
    }
  };
  return (
    <section className="nomination-section" aria-labelledby="nomination-title">
      <h2 id="nomination-title">Nominate an artist</h2>
      <form ref={form} onSubmit={submit}>
        <label htmlFor="nominee-name">
          Artist’s name
          <input
            id="nominee-name"
            name="name"
            required
            minLength={2}
            maxLength={120}
            autoComplete="off"
          />
        </label>
        <div className="location-field">
          <label htmlFor="nominee-city">
            Location <span className="optional">(optional)</span>
          </label>
          <input
            id="nominee-city"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open && suggestions.length > 0}
            aria-controls="location-suggestions"
            aria-activedescendant={
              open && active >= 0
                ? `place-${suggestions[active]?.id}`
                : undefined
            }
            autoComplete="off"
            value={city}
            maxLength={160}
            placeholder="Search a city"
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onChange={(e) => {
              setCity(e.target.value);
              setPlace(null);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setActive((i) => Math.min(i + 1, suggestions.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              }
              if (e.key === "Escape") {
                setOpen(false);
                setActive(-1);
              }
              if (
                e.key === "Enter" &&
                open &&
                active >= 0 &&
                suggestions[active]
              ) {
                e.preventDefault();
                choose(suggestions[active]);
              }
            }}
          />
          {open && suggestions.length > 0 && (
            <ul
              id="location-suggestions"
              className="location-suggestions"
              role="listbox"
              aria-label="City suggestions"
            >
              {suggestions.map((p, i) => (
                <li
                  id={`place-${p.id}`}
                  key={p.id}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(p)}
                >
                  {p.name}
                  <span>{p.country}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="country-field">
          <label htmlFor="nominee-country">Country</label>
          <select
            id="nominee-country"
            required
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              if (place && place.countryCode !== e.target.value) {
                setPlace(null);
                setCity("");
              }
            }}
          >
            <option value="">Choose a country</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <label htmlFor="nominee-link">
          Website or social handle
          <input
            id="nominee-link"
            name="link"
            required
            maxLength={500}
            placeholder="https://… or @handle"
            autoComplete="url"
          />
        </label>
        <div className="form-honeypot" aria-hidden="true">
          <label>
            Fax
            <input name="fax" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <div ref={challenge} className="nomination-verification" />
        <div className="form-submit">
          <button type="submit" disabled={pending || !verified}>
            {pending ? "Sending…" : "Submit nomination ↗"}
          </button>
          <p role="status">{status}</p>
        </div>
      </form>
      <a
        className="data-credit"
        href="https://www.geonames.org/"
        target="_blank"
        rel="noopener noreferrer"
      >
        City suggestions: GeoNames · CC BY 4.0 ↗
      </a>
    </section>
  );
}
