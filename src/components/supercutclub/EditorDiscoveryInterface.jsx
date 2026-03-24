import React, { useDeferredValue, useMemo, useState, startTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";

const editorProfiles = [
  {
    id: "ari-vaan",
    name: "Ari Vaan",
    legalName: "Arjun Mehta",
    age: 29,
    gender: "Male",
    city: "New Delhi",
    vibe: "Muted",
    bpmRange: [65, 85],
    bpmLabel: "65-85 BPM",
    rhythmLabel: "Slow Burn",
    techSpec: "Fixed Workstation",
    hardware: "Mac Studio / 32TB RAID / RAW-ready pipeline",
    pricing: "INR 1,500/min",
    tags: ["Slow Burn", "Film Grain", "Natural Light"],
    aesthetic: "Muted, film-grain, melancholic, natural light.",
    why:
      "He is for projects that need to breathe. His taste score rises first for documentary work, restrained branded films, and indie cinema.",
    portraitSrc: "https://randomuser.me/api/portraits/men/32.jpg",
    portraitTone: "blue",
    portraitPosition: "50% 24%",
    featuredMediaType: "embed",
    featuredUrl: "https://vimeo.com/265220711",
    featuredLabel: "Documentary sample",
    featuredSourceLabel: "Official portfolio / Vimeo",
    featuredSourceUrl: "https://vimeo.com/265220711",
    featuredNote:
      "This profile uses the Odisha Tourism Vimeo piece from your official site because the pacing is observational, scenic, and built for longer breaths.",
    projects: [
      { title: "Odisha Horizon", type: "Documentary", accent: "doc" },
      { title: "Still Monsoon", type: "Narrative Short", accent: "narrative" },
      { title: "Founder's Letter", type: "Branded Documentary", accent: "brand" },
    ],
  },
  {
    id: "pri-nox",
    name: "Pri Nox",
    legalName: "Priya Sharma",
    age: 24,
    gender: "Female",
    city: "Mumbai",
    vibe: "Neon",
    bpmRange: [120, 145],
    bpmLabel: "120-145 BPM",
    rhythmLabel: "Fast Cut",
    techSpec: "On-Site Mobile",
    hardware: "MacBook Pro M3 Max / mobile edit rig / fast social export",
    pricing: "INR 2,200/min",
    tags: ["High Energy", "Neon", "Glitch FX"],
    aesthetic: "Neon, hyper-saturated, glitch-effects, electronic pulse.",
    why:
      "She edits to the beat. If the brief is fast, glossy, and performance-led, her rhythmic signature aligns almost instantly.",
    portraitSrc: "https://randomuser.me/api/portraits/women/44.jpg",
    portraitTone: "red",
    portraitPosition: "50% 20%",
    featuredMediaType: "embed",
    featuredUrl: "https://www.youtube.com/watch?v=EMsZT9PCFms",
    featuredLabel: "Fashion film sample",
    featuredSourceLabel: "Official portfolio / YouTube",
    featuredSourceUrl: "https://www.youtube.com/watch?v=EMsZT9PCFms",
    featuredNote:
      "This profile uses the Hermosa Design YouTube link from your site because it carries the cleaner fashion-film rhythm and saturated commercial finish.",
    projects: [
      { title: "Hermosa Pulse", type: "Fashion Film", accent: "fashion" },
      { title: "Pulse Room", type: "Music Video", accent: "music" },
      { title: "Arc Runner", type: "Launch Reel", accent: "social" },
    ],
  },
  {
    id: "suri-gold",
    name: "Sol Suri",
    legalName: "Suresh Iyer",
    age: 32,
    gender: "Male",
    city: "Bengaluru",
    vibe: "Golden Hour",
    bpmRange: [90, 110],
    bpmLabel: "90-110 BPM",
    rhythmLabel: "Emotional Flow",
    techSpec: "Fixed Workstation",
    hardware: "PC Workstation / RTX 4090 / 64GB RAM / 4K 10-bit ready",
    pricing: "INR 1,900/min",
    tags: ["Warm Tones", "Epic", "Slow Motion"],
    aesthetic: "Warm gold tones, slow-motion transitions, orchestral and epic.",
    why:
      "He handles massive amounts of footage and specializes in emotional storytelling with high production value and polished finish.",
    portraitSrc: "https://randomuser.me/api/portraits/men/68.jpg",
    portraitTone: "green",
    portraitPosition: "50% 18%",
    featuredMediaType: "local",
    featuredVideo: "/videos/showreel-2025.mp4",
    featuredLabel: "Showreel sample",
    featuredSourceLabel: "Local archive / Showreel",
    featuredNote:
      "This profile keeps your local showreel in view to signal range, premium finish, and cinematic highlight-cut storytelling.",
    projects: [
      { title: "Goldlight 2025", type: "Showreel", accent: "wedding" },
      { title: "Royal Jaipur", type: "Wedding Film", accent: "brand" },
      { title: "Temple Procession", type: "Cultural Film", accent: "doc" },
    ],
  },
  {
    id: "zia-flux",
    name: "Zia Flux",
    legalName: "Zoya Khan",
    age: 27,
    gender: "Female",
    city: "Kolkata",
    vibe: "Gritty",
    bpmRange: [78, 128],
    bpmLabel: "Variable BPM",
    rhythmLabel: "Eclectic",
    techSpec: "On-Site Mobile",
    hardware: "iPad Pro + MacBook Air / hyper-mobile edit workflow",
    pricing: "INR 1,200/min",
    tags: ["Experimental", "Handheld", "Mixed Media"],
    aesthetic: "Raw, handheld, social-first, mixed-media.",
    why:
      "She is the new-talent discovery. Her work breaks format rules and is strongest when the brief wants raw social texture.",
    portraitSrc: "https://randomuser.me/api/portraits/women/29.jpg",
    portraitTone: "mono",
    portraitPosition: "50% 20%",
    featuredMediaType: "embed",
    featuredUrl: "https://vimeo.com/265220711",
    featuredLabel: "Experimental landscape sample",
    featuredSourceLabel: "Official portfolio / Vimeo",
    featuredNote:
      "This profile uses a landscape textural sample to fill the frame edge-to-edge, avoiding the pillarbox white spaces from portrait formatting.",
    projects: [
      { title: "Street Syntax", type: "Experimental Reel", accent: "experimental" },
      { title: "Open City", type: "Campaign Film", accent: "doc" },
      { title: "Noise Study", type: "Art Reel", accent: "social" },
    ],
  },
  {
    id: "rivu-chrome",
    name: "Rivu Chrome",
    legalName: "Rishabh Kulkarni",
    age: 30,
    gender: "Male",
    city: "Pune",
    vibe: "Minimalist",
    bpmRange: [108, 130],
    bpmLabel: "108-130 BPM",
    rhythmLabel: "Commercial Tempo",
    techSpec: "Fixed Workstation",
    hardware: "Threadripper PC / 12TB NVMe cache / brand-delivery pipeline",
    pricing: "INR 2,400/min",
    tags: ["Commercial Tempo", "Clean Frames", "Machine Rhythm"],
    aesthetic: "Minimal, metallic, performance-led, precision cut.",
    why:
      "He is strongest when a product film needs speed, control, and a mechanical sense of rhythm without visual clutter.",
    portraitSrc: "https://randomuser.me/api/portraits/men/21.jpg",
    portraitTone: "blue",
    portraitPosition: "50% 18%",
    featuredMediaType: "embed",
    featuredUrl: "https://www.youtube.com/watch?v=CSmZHXpr13E",
    featuredLabel: "Commercial sample",
    featuredSourceLabel: "Official portfolio / YouTube",
    featuredSourceUrl: "https://www.youtube.com/watch?v=CSmZHXpr13E",
    featuredNote:
      "This profile uses the Jawa Motorcycles YouTube link from your site because the motion language reads like a crisp commercial cut.",
    projects: [
      { title: "Jawa Cutdown", type: "Commercial Film", accent: "brand" },
      { title: "Midnight Metal", type: "Launch Film", accent: "fashion" },
      { title: "Torque 15", type: "Promo Reel", accent: "social" },
    ],
  },
  {
    id: "ira-velvet",
    name: "Ira Velvet",
    legalName: "Ira Menon",
    age: 26,
    gender: "Female",
    city: "Hyderabad",
    vibe: "Gritty",
    bpmRange: [118, 138],
    bpmLabel: "118-138 BPM",
    rhythmLabel: "Music Video Lift",
    techSpec: "On-Site Mobile",
    hardware: "MacBook Pro M3 Max / SSD shuttle kit / performance-cut workflow",
    pricing: "INR 2,000/min",
    tags: ["Performance Cut", "Club Rhythm", "After-dark"],
    aesthetic: "Dark club lighting, movement-led cuts, kinetic performance energy.",
    why:
      "She is strongest when a performance-driven brief needs a stylish but controlled edit language with music doing the structural work.",
    portraitSrc: "https://randomuser.me/api/portraits/women/65.jpg",
    portraitTone: "red",
    portraitPosition: "50% 18%",
    featuredMediaType: "embed",
    featuredUrl: "https://www.youtube.com/watch?v=fooE0W_mFSY",
    featuredLabel: "Music video sample",
    featuredSourceLabel: "Official portfolio / YouTube",
    featuredSourceUrl: "https://www.youtube.com/watch?v=fooE0W_mFSY",
    featuredNote:
      "This profile pulls the Show Me the Way YouTube film from your official portfolio because it reads as a music-led rhythm test rather than a generic reel.",
    projects: [
      { title: "Show Me the Way", type: "Music Video", accent: "music" },
      { title: "Velvet Rush", type: "Performance Film", accent: "fashion" },
      { title: "Night Window", type: "Artist Reel", accent: "social" },
    ],
  },
];

const vibeOptions = ["All", "Gritty", "Neon", "Minimalist", "Golden Hour", "Muted"];
const techOptions = ["All", "Fixed Workstation", "On-Site Mobile"];
const cityOptions = ["All", "Mumbai", "New Delhi", "Bengaluru", "Kolkata", "Pune", "Hyderabad"];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function getBpmLabel(value) {
  if (value < 75) return "Slow Burn";
  if (value < 95) return "Narrative Pulse";
  if (value < 120) return "Emotional Flow";
  if (value < 135) return "Commercial Tempo";
  return "Hyper-Edit";
}

function getEmbeddedMediaUrl(url) {
  if (!url) return "";

  if (url.includes("vimeo")) {
    const videoId = url.split("/").pop()?.split("?")[0];
    return `https://player.vimeo.com/video/${videoId}?autoplay=1&muted=1&loop=1&title=0&byline=0&portrait=0`;
  }

  try {
    const parsedUrl = new URL(url);
    const videoId = parsedUrl.hostname.includes("youtu.be")
      ? parsedUrl.pathname.replace("/", "")
      : parsedUrl.searchParams.get("v");

    if (!videoId) {
      return "";
    }

    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&playsinline=1&controls=0&rel=0&modestbranding=1`;
  } catch {
    return "";
  }
}

function computeMatchScore(editor, filters) {
  let score = 52;

  if (filters.vibe === "All") {
    score += 8;
  } else if (editor.vibe === filters.vibe) {
    score += 22;
  }

  const midpoint = (editor.bpmRange[0] + editor.bpmRange[1]) / 2;
  const bpmDelta = Math.abs(filters.bpm - midpoint);
  score += clamp(24 - bpmDelta * 0.45, 4, 24);

  if (filters.techSpec === "All") {
    score += 6;
  } else if (editor.techSpec === filters.techSpec) {
    score += 12;
  }

  if (filters.city === "All") {
    score += 5;
  } else if (editor.city === filters.city) {
    score += 12;
  }

  return clamp(Math.round(score), 54, 98);
}

function projectAccentClass(accent) {
  return `sced-project-${accent}`;
}

export default function EditorDiscoveryInterface() {
  const [filters, setFilters] = useState({
    vibe: "All",
    bpm: 110,
    techSpec: "All",
    city: "All",
  });
  const [activeIndex, setActiveIndex] = useState(0);

  const deferredFilters = useDeferredValue(filters);

  const filteredProfiles = useMemo(() => {
    const nextProfiles = editorProfiles
      .map((editor) => ({
        ...editor,
        matchScore: computeMatchScore(editor, deferredFilters),
      }))
      .filter((editor) => {
        const vibeMatch =
          deferredFilters.vibe === "All" || editor.vibe === deferredFilters.vibe;
        const techMatch =
          deferredFilters.techSpec === "All" ||
          editor.techSpec === deferredFilters.techSpec;
        const cityMatch =
          deferredFilters.city === "All" || editor.city === deferredFilters.city;

        const [minBpm, maxBpm] = editor.bpmRange;
        const bpmMatch =
          deferredFilters.bpm >= minBpm - 15 && deferredFilters.bpm <= maxBpm + 15;

        return vibeMatch && techMatch && cityMatch && bpmMatch;
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    return nextProfiles.length > 0
      ? nextProfiles
      : editorProfiles
          .map((editor) => ({
            ...editor,
            matchScore: computeMatchScore(editor, deferredFilters),
          }))
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 2);
  }, [deferredFilters]);

  const safeIndex = filteredProfiles.length === 0 ? 0 : activeIndex % filteredProfiles.length;
  const activeProfile = filteredProfiles[safeIndex];
  const embeddedMediaUrl =
    activeProfile.featuredMediaType === "embed"
      ? getEmbeddedMediaUrl(activeProfile.featuredUrl)
      : "";

  const updateFilter = (key, value) => {
    startTransition(() => {
      setFilters((current) => ({
        ...current,
        [key]: value,
      }));
      setActiveIndex(0);
    });
  };

  const nextEditor = () => {
    if (!filteredProfiles.length) {
      return;
    }

    setActiveIndex((current) => (current + 1) % filteredProfiles.length);
  };

  return (
    <section className="sced-shell">
      <div className="sced-discovery-bar">
        <div className="sced-filter-group">
          <label htmlFor="sced-vibe">Aesthetic vibe</label>
          <select
            id="sced-vibe"
            value={filters.vibe}
            onChange={(event) => updateFilter("vibe", event.target.value)}
          >
            {vibeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="sced-filter-group sced-filter-group-wide">
          <label htmlFor="sced-bpm">Rhythm ({filters.bpm} BPM)</label>
          <input
            id="sced-bpm"
            type="range"
            min="60"
            max="145"
            step="5"
            value={filters.bpm}
            onChange={(event) => updateFilter("bpm", Number(event.target.value))}
          />
          <div className="sced-slider-meta">
            <span>Slow Burn</span>
            <strong>{getBpmLabel(filters.bpm)}</strong>
            <span>Hyper-Edit</span>
          </div>
        </div>

        <div className="sced-filter-group">
          <label htmlFor="sced-tech">Tech spec</label>
          <select
            id="sced-tech"
            value={filters.techSpec}
            onChange={(event) => updateFilter("techSpec", event.target.value)}
          >
            {techOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="sced-filter-group">
          <label htmlFor="sced-city">Location</label>
          <select
            id="sced-city"
            value={filters.city}
            onChange={(event) => updateFilter("city", event.target.value)}
          >
            {cityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="sced-results-meta">
        <div>
          <span className="sced-results-kicker">Live pool</span>
          <strong>{filteredProfiles.length} editors in current loop</strong>
        </div>
        <div>
          <span className="sced-results-kicker">Current search state</span>
          <strong>
            {filters.city === "All" ? "Pan-India" : filters.city} / {getBpmLabel(filters.bpm)}
          </strong>
        </div>
      </div>

      <div className="sced-stage">
        <AnimatePresence mode="wait">
          <motion.article
            key={activeProfile.id}
            className="sced-profile-card"
            initial={{ opacity: 0, y: 22, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.985 }}
            transition={{ duration: 0.34, ease: "easeOut" }}
          >
            <div className="sced-profile-left">
              <div className="sced-identity">
                <div className="sced-identity-head">
                  <div className="sced-identity-person">
                    <div className={`sced-avatar-small sced-avatar-${activeProfile.portraitTone}`}>
                      <img
                        src={activeProfile.portraitSrc}
                        alt={`${activeProfile.name} portrait`}
                        loading="lazy"
                        style={{ objectPosition: activeProfile.portraitPosition }}
                      />
                    </div>
                    <div>
                      <p className="sced-mono">Editor profile</p>
                      <h3>{activeProfile.name}</h3>
                      <p className="sced-aka">aka {activeProfile.legalName}</p>
                    </div>
                  </div>
                  <div className="sced-match-badge">{activeProfile.matchScore}% Match</div>
                </div>

                <p className="sced-demographic">
                  {activeProfile.age} / {activeProfile.gender} / {activeProfile.city}
                </p>
                <p className="sced-aesthetic">{activeProfile.aesthetic}</p>
              </div>

              <div className="sced-tag-row">
                {activeProfile.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>

              <div className="sced-spec-card">
                <p className="sced-mono">Taste match</p>
                <strong>
                  {activeProfile.bpmLabel} · {activeProfile.rhythmLabel}
                </strong>
              </div>

              <div className="sced-spec-card">
                <p className="sced-mono">Hardware badge</p>
                <strong>{activeProfile.hardware}</strong>
              </div>

              <div className="sced-spec-grid">
                <div className="sced-spec-card">
                  <p className="sced-mono">Tech mode</p>
                  <strong>{activeProfile.techSpec}</strong>
                </div>
                <div className="sced-spec-card">
                  <p className="sced-mono">Pricing</p>
                  <strong>{activeProfile.pricing}</strong>
                </div>
              </div>

              <div className="sced-why">
                <p className="sced-mono">Why this editor</p>
                <p>{activeProfile.why}</p>
              </div>
            </div>

            <div className="sced-profile-right">
              <div className="sced-sample-map">
                <div>
                  <p className="sced-mono">Core logic</p>
                  <strong>{activeProfile.featuredLabel}</strong>
                </div>
                <p>{activeProfile.featuredNote}</p>
              </div>

              <div className="sced-source-row">
                <span className="sced-source-pill">{activeProfile.featuredSourceLabel}</span>
                {activeProfile.featuredSourceUrl ? (
                  <a
                    className="sced-source-link"
                    href={activeProfile.featuredSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open original
                  </a>
                ) : (
                  <span className="sced-source-note">Embedded from local archive</span>
                )}
              </div>

              <div className="sced-video-frame">
                {activeProfile.featuredMediaType === "embed" ? (
                  <iframe
                    key={activeProfile.featuredUrl}
                    className="sced-video sced-video-embed"
                    src={embeddedMediaUrl}
                    title={`${activeProfile.name} featured sample`}
                    loading="lazy"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    key={activeProfile.featuredVideo}
                    className="sced-video"
                    src={activeProfile.featuredVideo}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                  />
                )}
                <div className="sced-video-overlay">
                  <div>
                    <p className="sced-mono">{activeProfile.featuredLabel}</p>
                    <h4>{activeProfile.projects[0].title}</h4>
                  </div>
                  <span>{activeProfile.city}</span>
                </div>
              </div>

              <div className="sced-project-grid">
                {activeProfile.projects.map((project) => (
                  <article
                    key={project.title}
                    className={`sced-project-card ${projectAccentClass(project.accent)}`}
                  >
                    <p className="sced-mono">{project.type}</p>
                    <h5>{project.title}</h5>
                  </article>
                ))}
              </div>
            </div>
          </motion.article>
        </AnimatePresence>

        <motion.button
          type="button"
          className="sced-next-button"
          onClick={nextEditor}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          <span>Next Editor</span>
          <strong>
            {safeIndex + 1}/{filteredProfiles.length}
          </strong>
        </motion.button>
      </div>

      <style>{`
        .sced-shell {
          display: grid;
          gap: 1.25rem;
        }

        .sced-discovery-bar,
        .sced-results-meta {
          display: grid;
          gap: 1rem;
          padding: 1rem 1.1rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1.4rem;
          background: rgba(14, 18, 28, 0.82);
          box-shadow: 0 22px 48px rgba(0, 0, 0, 0.22);
          backdrop-filter: blur(16px);
        }

        .sced-discovery-bar {
          grid-template-columns: minmax(180px, 0.9fr) minmax(280px, 1.4fr) minmax(180px, 0.9fr) minmax(180px, 0.9fr);
          align-items: end;
        }

        .sced-filter-group {
          display: grid;
          gap: 0.55rem;
          min-width: 0;
        }

        .sced-filter-group-wide {
          align-self: stretch;
        }

        .sced-filter-group label,
        .sced-mono,
        .sced-results-kicker {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(232, 229, 223, 0.72);
        }

        .sced-filter-group select,
        .sced-filter-group input[type="range"] {
          width: 100%;
        }

        .sced-filter-group select {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          background: rgba(255, 255, 255, 0.04);
          color: #fff8ee;
          padding: 0.9rem 1rem;
          font: inherit;
        }

        .sced-filter-group input[type="range"] {
          accent-color: #ee5a36;
        }

        .sced-slider-meta {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          font-size: 0.82rem;
          color: rgba(232, 229, 223, 0.72);
        }

        .sced-slider-meta strong {
          color: #fff8ee;
          font-weight: 600;
        }

        .sced-results-meta {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .sced-results-meta strong {
          display: block;
          margin-top: 0.25rem;
          color: #fff8ee;
          font-size: 1rem;
        }

        .sced-stage {
          position: relative;
        }

        .sced-profile-card {
          display: grid;
          grid-template-columns: minmax(320px, 0.62fr) minmax(0, 1fr);
          gap: 1.2rem;
          padding: 1.2rem;
          border-radius: 2rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(circle at top right, rgba(37, 99, 235, 0.16), transparent 24%),
            linear-gradient(145deg, rgba(9, 12, 20, 0.98), rgba(16, 21, 34, 0.98));
          box-shadow: 0 30px 56px rgba(0, 0, 0, 0.28);
          min-height: 720px;
        }

        .sced-profile-left,
        .sced-profile-right {
          min-width: 0;
        }

        .sced-profile-left {
          display: grid;
          align-content: start;
          gap: 1rem;
          padding: 0.25rem;
        }

        .sced-avatar-small {
          position: relative;
          width: 84px;
          height: 84px;
          border-radius: 999px;
          overflow: hidden;
          background: #0b0f16;
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .sced-avatar-small::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, var(--sced-avatar-tint), transparent 72%);
          z-index: 1;
        }

        .sced-avatar-small img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          filter: grayscale(1) contrast(1.08) brightness(0.9);
        }

        .sced-avatar-blue {
          --sced-avatar-tint: rgba(37, 99, 235, 0.38);
        }

        .sced-avatar-red {
          --sced-avatar-tint: rgba(238, 90, 54, 0.36);
        }

        .sced-avatar-green {
          --sced-avatar-tint: rgba(15, 118, 110, 0.38);
        }

        .sced-avatar-mono {
          --sced-avatar-tint: rgba(100, 116, 139, 0.32);
        }

        .sced-identity-head {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .sced-identity-person {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .sced-identity h3,
        .sced-video-overlay h4,
        .sced-project-card h5 {
          margin: 0;
          color: #fff8ee;
          font-family: var(--font-display);
          letter-spacing: -0.04em;
        }

        .sced-identity h3 {
          font-size: clamp(1.6rem, 3.5vw, 2.3rem);
          line-height: 0.95;
          margin-top: 0.15rem;
        }

        .sced-aka {
          margin: 0.35rem 0 0;
          color: rgba(232, 229, 223, 0.62);
          font-size: 0.92rem;
          letter-spacing: 0.01em;
        }

        .sced-match-badge {
          flex-shrink: 0;
          padding: 0.55rem 0.8rem;
          border-radius: 999px;
          background: rgba(238, 90, 54, 0.16);
          border: 1px solid rgba(238, 90, 54, 0.2);
          color: #fff4ee;
          font-family: var(--font-mono);
          font-size: 0.76rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .sced-demographic,
        .sced-aesthetic,
        .sced-why p {
          margin: 0;
          color: rgba(232, 229, 223, 0.8);
          line-height: 1.68;
        }

        .sced-tag-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
        }

        .sced-tag-row span,
        .sced-spec-card,
        .sced-why {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.035);
          border-radius: 1.1rem;
        }

        .sced-tag-row span {
          padding: 0.5rem 0.7rem;
          color: #fff8ee;
          font-size: 0.88rem;
        }

        .sced-spec-card,
        .sced-why {
          padding: 0.95rem 1rem;
        }

        .sced-spec-card strong,
        .sced-why p {
          display: block;
          margin-top: 0.35rem;
          color: #fff8ee;
        }

        .sced-spec-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.85rem;
        }

        .sced-profile-right {
          display: grid;
          gap: 1rem;
          align-content: start;
        }

        .sced-sample-map {
          display: grid;
          gap: 0.4rem;
          padding: 0.95rem 1rem;
          border-radius: 1.2rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
        }

        .sced-sample-map strong {
          display: block;
          margin-top: 0.32rem;
          color: #fff8ee;
        }

        .sced-sample-map p:last-child {
          max-width: 56ch;
          color: rgba(232, 229, 223, 0.78);
          line-height: 1.64;
        }

        .sced-source-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.7rem;
          align-items: center;
        }

        .sced-source-pill,
        .sced-source-note,
        .sced-source-link {
          display: inline-flex;
          align-items: center;
          min-height: 2.2rem;
          padding: 0.58rem 0.82rem;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-family: var(--font-mono);
          font-size: 0.74rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          text-decoration: none;
        }

        .sced-source-pill,
        .sced-source-note {
          color: rgba(232, 229, 223, 0.82);
          background: rgba(255, 255, 255, 0.04);
        }

        .sced-source-link {
          color: #fff8ee;
          background: rgba(255, 255, 255, 0.08);
          transition: background-color 0.2s ease, transform 0.2s ease;
        }

        .sced-source-link:hover,
        .sced-source-link:focus-visible {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.14);
        }

        .sced-video-frame {
          position: relative;
          min-height: 380px;
          border-radius: 1.6rem;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: #0b0f16;
        }

        .sced-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .sced-video-embed {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 140%;
          height: 140%;
          transform: translate(-50%, -50%);
          border: 0;
          pointer-events: none;
        }

        .sced-video-overlay {
          position: absolute;
          inset: auto 0 0 0;
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: end;
          padding: 1rem;
          background: linear-gradient(180deg, transparent, rgba(4, 5, 10, 0.86));
        }

        .sced-video-overlay h4 {
          font-size: clamp(1.2rem, 3vw, 2rem);
          line-height: 1;
        }

        .sced-video-overlay span {
          color: #fff8ee;
          font-family: var(--font-mono);
          font-size: 0.78rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .sced-project-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.9rem;
        }

        .sced-project-card {
          min-height: 170px;
          padding: 1rem;
          border-radius: 1.25rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          background: rgba(255, 255, 255, 0.04);
        }

        .sced-project-card h5 {
          font-size: 1.1rem;
          line-height: 1.04;
        }

        .sced-project-doc { background: linear-gradient(160deg, rgba(15, 118, 110, 0.18), rgba(255,255,255,0.04)); }
        .sced-project-narrative { background: linear-gradient(160deg, rgba(37, 99, 235, 0.18), rgba(255,255,255,0.04)); }
        .sced-project-brand { background: linear-gradient(160deg, rgba(212, 120, 40, 0.2), rgba(255,255,255,0.04)); }
        .sced-project-fashion { background: linear-gradient(160deg, rgba(255, 0, 140, 0.18), rgba(255,255,255,0.04)); }
        .sced-project-music { background: linear-gradient(160deg, rgba(116, 57, 255, 0.18), rgba(255,255,255,0.04)); }
        .sced-project-social { background: linear-gradient(160deg, rgba(51, 65, 85, 0.28), rgba(255,255,255,0.04)); }
        .sced-project-wedding { background: linear-gradient(160deg, rgba(245, 190, 82, 0.2), rgba(255,255,255,0.04)); }
        .sced-project-experimental { background: linear-gradient(160deg, rgba(79, 208, 255, 0.18), rgba(255,255,255,0.04)); }

        .sced-next-button {
          position: absolute;
          right: 1rem;
          top: 1rem;
          z-index: 3;
          display: inline-flex;
          flex-direction: column;
          gap: 0.2rem;
          align-items: flex-start;
          padding: 0.9rem 1rem;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 1.2rem;
          background: rgba(6, 8, 14, 0.82);
          color: #fff8ee;
          cursor: pointer;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.22);
        }

        .sced-next-button span {
          font-family: var(--font-mono);
          font-size: 0.74rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(232, 229, 223, 0.72);
        }

        .sced-next-button strong {
          font-size: 1rem;
        }

        @media (max-width: 1120px) {
          .sced-discovery-bar,
          .sced-results-meta,
          .sced-profile-card,
          .sced-project-grid,
          .sced-spec-grid {
            grid-template-columns: 1fr;
          }

          .sced-next-button {
            position: sticky;
            top: 1rem;
            margin-left: auto;
            margin-bottom: 1rem;
          }
        }

        @media (max-width: 780px) {
          .sced-discovery-bar {
            padding: 0.95rem;
          }

          .sced-profile-card {
            min-height: unset;
            padding: 1rem;
          }

          .sced-video-frame {
            min-height: 260px;
          }

          .sced-identity-head {
            flex-direction: column;
          }
        }
      `}</style>
    </section>
  );
}
