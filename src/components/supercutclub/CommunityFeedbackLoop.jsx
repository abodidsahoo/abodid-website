import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const feedbackMoments = [
  {
    id: "hook",
    time: "00:12",
    title: "Opening hook lands late",
    frame: "Hook frame",
    commenter: "Mira / Mumbai",
    note: "The first title card should arrive 1 second earlier so the viewer catches the premise sooner.",
    action: "Timing note",
    accent: "orange",
  },
  {
    id: "music",
    time: "00:28",
    title: "Music shift needs cleaner sync",
    frame: "Beat change",
    commenter: "Kabir / Bengaluru",
    note: "The transition works, but the downbeat and the cut are drifting apart by a few frames.",
    action: "Rhythm note",
    accent: "blue",
  },
  {
    id: "story",
    time: "00:46",
    title: "Character beat could breathe",
    frame: "Reaction frame",
    commenter: "Ananya / Kolkata",
    note: "Hold the reaction half a second longer before the cutaway. The emotion is there but it exits too fast.",
    action: "Narrative note",
    accent: "emerald",
  },
  {
    id: "closing",
    time: "01:04",
    title: "Closing CTA should feel safer",
    frame: "Final slate",
    commenter: "Priya / Delhi",
    note: "The final CTA is visually strong, but the watermark should persist here if this is still a feedback-only export.",
    action: "Security note",
    accent: "slate",
  },
];

export default function CommunityFeedbackLoop() {
  const [activeId, setActiveId] = useState(feedbackMoments[1].id);

  const activeMoment = useMemo(
    () => feedbackMoments.find((moment) => moment.id === activeId) || feedbackMoments[0],
    [activeId],
  );

  return (
    <section className="scfb-shell">
      <div className="scfb-stage">
        <div className="scfb-stage-header">
          <div>
            <p className="scfb-mono">Secure feedback room</p>
            <h3>Move across the timeline to see how a closed critique loop works.</h3>
          </div>
          <div className="scfb-security-stack">
            <span>Private room</span>
            <span>Watermarked link</span>
            <span>Expiring access</span>
          </div>
        </div>

        <div className="scfb-preview-pane">
          <div className={`scfb-film-frame scfb-film-frame-${activeMoment.accent}`}>
            <div className="scfb-watermark">Feedback only / Viewer trace enabled</div>
            <div className="scfb-frame-grid">
              {feedbackMoments.map((moment) => (
                <div
                  key={moment.id}
                  className={`scfb-frame-card ${moment.id === activeMoment.id ? "is-active" : ""}`}
                >
                  <span>{moment.frame}</span>
                </div>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.aside
              key={activeMoment.id}
              className="scfb-comment-card"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              <p className="scfb-mono">{activeMoment.action}</p>
              <h4>{activeMoment.title}</h4>
              <p>{activeMoment.note}</p>
              <div className="scfb-comment-meta">
                <strong>{activeMoment.commenter}</strong>
                <span>{activeMoment.time}</span>
              </div>
            </motion.aside>
          </AnimatePresence>
        </div>

        <div className="scfb-timeline">
          <div className="scfb-timeline-bar"></div>
          {feedbackMoments.map((moment) => (
            <button
              key={moment.id}
              type="button"
              className={`scfb-marker scfb-marker-${moment.accent} ${moment.id === activeMoment.id ? "is-active" : ""}`}
              onMouseEnter={() => setActiveId(moment.id)}
              onFocus={() => setActiveId(moment.id)}
              onClick={() => setActiveId(moment.id)}
              aria-label={`${moment.time} ${moment.title}`}
            >
              <span>{moment.time}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="scfb-loop-legend">
        <article>
          <p className="scfb-mono">1. Upload privately</p>
          <p>Share a protected clip link that carries a visible watermark and room-level access control.</p>
        </article>
        <article>
          <p className="scfb-mono">2. Review in context</p>
          <p>Editors leave notes against specific moments so the feedback stays tied to the actual cut.</p>
        </article>
        <article>
          <p className="scfb-mono">3. Keep it closed</p>
          <p>The room is only visible to approved members, which keeps comments useful and accountable.</p>
        </article>
      </div>

      <style>{`
        .scfb-shell {
          display: grid;
          gap: 1rem;
        }

        .scfb-stage,
        .scfb-loop-legend article {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1.7rem;
          background: rgba(14, 18, 28, 0.82);
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.22);
        }

        .scfb-stage {
          padding: 1.1rem;
        }

        .scfb-stage-header,
        .scfb-preview-pane,
        .scfb-loop-legend {
          display: grid;
        }

        .scfb-stage-header {
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 1rem;
          align-items: start;
          margin-bottom: 1rem;
        }

        .scfb-stage-header h3,
        .scfb-comment-card h4 {
          margin: 0.35rem 0 0;
          color: #fff8ee;
          font-family: var(--font-display);
          letter-spacing: -0.04em;
        }

        .scfb-stage-header h3 {
          font-size: clamp(1.5rem, 3vw, 2.4rem);
          line-height: 1;
        }

        .scfb-mono {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(232, 229, 223, 0.72);
        }

        .scfb-security-stack {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 0.6rem;
        }

        .scfb-security-stack span {
          padding: 0.48rem 0.65rem;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: #fff8ee;
          font-size: 0.82rem;
        }

        .scfb-preview-pane {
          grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
          gap: 1rem;
          align-items: stretch;
        }

        .scfb-film-frame,
        .scfb-comment-card {
          border-radius: 1.4rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }

        .scfb-film-frame {
          position: relative;
          min-height: 340px;
          padding: 1rem;
          background: linear-gradient(145deg, #0f1520, #171f30);
        }

        .scfb-film-frame-orange {
          background:
            radial-gradient(circle at 20% 20%, rgba(238, 90, 54, 0.18), transparent 24%),
            linear-gradient(145deg, #0f1520, #171f30);
        }

        .scfb-film-frame-blue {
          background:
            radial-gradient(circle at 60% 20%, rgba(37, 99, 235, 0.2), transparent 24%),
            linear-gradient(145deg, #0f1520, #171f30);
        }

        .scfb-film-frame-emerald {
          background:
            radial-gradient(circle at 18% 26%, rgba(15, 118, 110, 0.2), transparent 24%),
            linear-gradient(145deg, #0f1520, #171f30);
        }

        .scfb-film-frame-slate {
          background:
            radial-gradient(circle at 68% 18%, rgba(148, 163, 184, 0.18), transparent 24%),
            linear-gradient(145deg, #0f1520, #171f30);
        }

        .scfb-watermark {
          position: absolute;
          top: 1rem;
          right: 1rem;
          padding: 0.4rem 0.65rem;
          border-radius: 999px;
          background: rgba(255, 248, 238, 0.08);
          color: rgba(255, 248, 238, 0.78);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .scfb-frame-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.75rem;
          height: 100%;
          align-items: end;
        }

        .scfb-frame-card {
          min-height: 180px;
          border-radius: 1.1rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
          display: flex;
          align-items: end;
          padding: 0.85rem;
          color: rgba(255, 248, 238, 0.72);
          transform: scale(0.98);
          transition:
            transform 0.22s ease,
            border-color 0.22s ease,
            background-color 0.22s ease;
        }

        .scfb-frame-card.is-active {
          transform: scale(1);
          border-color: rgba(255, 255, 255, 0.18);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.04));
        }

        .scfb-comment-card {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.04);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 340px;
        }

        .scfb-comment-card p {
          margin: 0.5rem 0 0;
          color: rgba(232, 229, 223, 0.84);
          line-height: 1.68;
        }

        .scfb-comment-meta {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          margin-top: auto;
          padding-top: 1rem;
        }

        .scfb-comment-meta strong {
          color: #fff8ee;
        }

        .scfb-comment-meta span {
          color: rgba(232, 229, 223, 0.7);
          font-family: var(--font-mono);
          font-size: 0.76rem;
        }

        .scfb-timeline {
          position: relative;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1rem;
          align-items: center;
          padding-top: 1rem;
          margin-top: 1rem;
        }

        .scfb-timeline-bar {
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 2px;
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.18));
          transform: translateY(-50%);
        }

        .scfb-marker {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 0.45rem;
          justify-items: center;
          padding: 0.2rem 0;
          background: transparent;
          border: none;
          color: rgba(232, 229, 223, 0.74);
          cursor: pointer;
        }

        .scfb-marker::before {
          content: "";
          width: 0.95rem;
          height: 0.95rem;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.16);
          border: 2px solid rgba(8, 11, 18, 0.92);
          transition: transform 0.22s ease, background-color 0.22s ease;
        }

        .scfb-marker.is-active::before,
        .scfb-marker:hover::before,
        .scfb-marker:focus-visible::before {
          transform: scale(1.15);
        }

        .scfb-marker-orange::before { background: #ee5a36; }
        .scfb-marker-blue::before { background: #2563eb; }
        .scfb-marker-emerald::before { background: #0f766e; }
        .scfb-marker-slate::before { background: #94a3b8; }

        .scfb-marker span {
          font-family: var(--font-mono);
          font-size: 0.76rem;
          letter-spacing: 0.08em;
        }

        .scfb-loop-legend {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }

        .scfb-loop-legend article {
          padding: 1rem;
        }

        .scfb-loop-legend article p:last-child {
          margin-top: 0.5rem;
          color: rgba(232, 229, 223, 0.8);
          line-height: 1.62;
        }

        @media (max-width: 1080px) {
          .scfb-preview-pane,
          .scfb-loop-legend,
          .scfb-frame-grid {
            grid-template-columns: 1fr;
          }

          .scfb-stage-header {
            grid-template-columns: 1fr;
          }

          .scfb-security-stack {
            justify-content: flex-start;
          }

          .scfb-timeline {
            gap: 0.6rem;
          }
        }

        @media (max-width: 780px) {
          .scfb-film-frame,
          .scfb-comment-card {
            min-height: unset;
          }

          .scfb-frame-card {
            min-height: 120px;
          }
        }
      `}</style>
    </section>
  );
}
