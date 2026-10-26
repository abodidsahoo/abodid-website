import { useEffect, useRef, useState } from "react";
type Leader = { display_name: string; active_seconds: number };
type Ranking = {
  month: string;
  leaders: Leader[];
  award: { display_name: string; month: string } | null;
  mine: (Leader & { public_opt_in: boolean }) | null;
};
export function timeLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes}m ${seconds % 60}s`;
}
export default function Wanderers() {
  const [ranking, setRanking] = useState<Ranking | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [name, setName] = useState("");
  const lastInteraction = useRef(0),
    inView = useRef(false);
  const refresh = async () => {
    try {
      const response = await fetch("/api/artist-globe/wanderers");
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setRanking(data);
      setError("");
    } catch {
      setError("The leaderboard is temporarily unavailable.");
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const joined = ranking?.mine?.public_opt_in === true;
  useEffect(() => {
    if (!joined) return;
    const globe = document.querySelector(".globe-workspace");
    const record = () => {
      lastInteraction.current = Date.now();
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView.current = entry.isIntersecting;
    });
    if (globe) observer.observe(globe);
    globe?.addEventListener("pointerdown", record);
    globe?.addEventListener("wheel", record, { passive: true });
    globe?.addEventListener("keydown", record);
    const discover = document.querySelector(".discover-button");
    discover?.addEventListener("click", record);
    const tick = async () => {
      try {
        const active =
          !document.hidden &&
          inView.current &&
          Date.now() - lastInteraction.current < 60000;
        const r = await fetch("/api/artist-globe/wanderers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "heartbeat", active }),
        });
        if (r.ok) {
          const d = await r.json();
          setRanking((previous) =>
            previous?.mine
              ? {
                  ...previous,
                  mine: { ...previous.mine, active_seconds: d.seconds },
                }
              : previous,
          );
        }
      } catch {
        /* Keep exploration available during a temporary network loss. */
      }
    };
    const timer = setInterval(tick, 15000),
      listTimer = setInterval(refresh, 60000);
    return () => {
      clearInterval(timer);
      clearInterval(listTimer);
      observer.disconnect();
      globe?.removeEventListener("pointerdown", record);
      globe?.removeEventListener("wheel", record);
      globe?.removeEventListener("keydown", record);
      discover?.removeEventListener("click", record);
    };
  }, [joined]);
  const action = async (kind: "join" | "leave") => {
    setPending(true);
    setError("");
    try {
      const r = await fetch("/api/artist-globe/wanderers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: kind, name }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };
  const month = ranking?.month
    ? new Date(`${ranking.month}T00:00:00Z`).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";
  return (
    <section className="wanderer-section" aria-labelledby="wanderer-title">
      <div className="section-heading">
        <h2 id="wanderer-title">
          Art Wanderer
          <br />
          of the Month
        </h2>
        <span className="micro">{month}</span>
      </div>
      {ranking?.award && (
        <p className="wanderer-award">
          ✳ {ranking.award.display_name}
          <span>
            {new Date(`${ranking.award.month}T00:00:00Z`).toLocaleDateString(
              "en-GB",
              { month: "long", year: "numeric", timeZone: "UTC" },
            )}{" "}
            award
          </span>
        </p>
      )}
      {ranking?.leaders?.length ? (
        <ol className="wanderer-leaders">
          {ranking.leaders.map((person, i) => (
            <li key={`${person.display_name}-${i}`}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <strong>{person.display_name}</strong>
              <time>{timeLabel(person.active_seconds)}</time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="leaderboard-empty">
          The month is open. Be the first to wander.
        </p>
      )}
      {joined ? (
        <div className="wanderer-joined">
          <p>
            {ranking!.mine!.display_name} ·{" "}
            {timeLabel(ranking!.mine!.active_seconds)}
          </p>
          <button onClick={() => action("leave")} disabled={pending}>
            Leave leaderboard
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action("join");
          }}
        >
          <label htmlFor="wanderer-name">
            Your public name
            <input
              id="wanderer-name"
              required
              minLength={2}
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="nickname"
            />
          </label>
          <button type="submit" disabled={pending}>
            {pending ? "Joining…" : "Join this month ↗"}
          </button>
        </form>
      )}
      <p className="wanderer-privacy">
        Joining makes your chosen name and active exploration time public. Time
        counts while you interact with the visible globe. You can leave at any
        time.
      </p>
      {error && <p role="status">{error}</p>}
    </section>
  );
}
