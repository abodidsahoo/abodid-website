import React, { useEffect, useRef, useState } from "react";
const sample =
  "Keep track of the Google Creative Art Residency in India whose application deadline is 12th April, 2027.";
export function OpportunityAllowance({
  accessToken,
  savedCount,
  error,
}: {
  accessToken: string | null;
  savedCount: number;
  error: string;
}) {
  const [usage, setUsage] = useState<any>(null),
    [open, setOpen] = useState(false),
    [sending, setSending] = useState(false),
    [status, setStatus] = useState("");
  const [message, setMessage] = useState(
    "Hello Support team of Abodid & Co., I’m enjoying the opportunity tracker and reminder features, and I’d love a higher monthly AI allowance.",
  );
  const [connectUrl, setConnectUrl] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    fetch("/api/opportunities/usage", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    })
      .then(async (r) => {
        if (r.ok) setUsage(await r.json());
      })
      .catch(() => {});
    return () => controller.abort();
  }, [accessToken, savedCount, error, open]);
  useEffect(() => {
    if (/this month|monthly.*allowance/i.test(error)) {
      setStatus("");
      setOpen(true);
    }
  }, [error]);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
  }, [open]);
  const send = async () => {
    setSending(true);
    setStatus("");
    try {
      const r = await fetch("/api/opportunities/usage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setStatus(
        "Your request has been sent to the Support team of Abodid & Co.",
      );
      setUsage((v: any) => ({ ...v, request: { delivery_status: "sent" } }));
    } catch (e) {
      setStatus(
        e instanceof Error
          ? e.message
          : "Your request could not be sent. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };
  const connect = async () => {
    setStatus("");
    try {
      const r = await fetch("/api/integrations/telegram/connection", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setConnectUrl(b.connect_url);
    } catch (e) {
      setStatus(
        e instanceof Error ? e.message : "Telegram could not be prepared.",
      );
    }
  };
  const exhausted = usage && usage.used >= usage.limit;
  return (
    <section className="opp-allowance" aria-label="Your radar and AI allowance">
      <div>
        <strong>
          {savedCount === 0
            ? "Start with something worth keeping."
            : "Keep your radar close."}
        </strong>
        <p>
          Add opportunities from Abodid’s collection without using AI credits.
          Then connect Telegram to share links, PDFs, images and voice notes.
        </p>
        <div className="opp-allowance-actions">
          <a className="opp-btn opp-btn-secondary" href="/opportunities/abodid">
            Explore opportunities · no AI credits
          </a>
          {savedCount > 0 && (
            <button
              type="button"
              className="opp-btn opp-btn-secondary"
              onClick={() => void connect()}
            >
              Connect Telegram
            </button>
          )}
          {connectUrl && (
            <a
              className="opp-btn opp-btn-primary"
              href={connectUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Telegram to connect ↗
            </a>
          )}
        </div>
      </div>
      <p>
        {usage
          ? `${usage.used} / ${usage.limit} AI attempts this month · ${savedCount} / 100 saved`
          : "New AI captures use your monthly allowance. You can keep up to 100 opportunities."}
      </p>
      {exhausted && (
        <p>
          Your monthly AI allowance is used. Your saved opportunities and
          reminders remain available. Resets{" "}
          {new Date(usage.resets_at).toLocaleDateString(undefined, {
            dateStyle: "long",
          })}
          .
        </p>
      )}
      {savedCount >= 100 && (
        <p>
          Your radar has 100 opportunities. Delete one to make room. Deleting
          does not restore AI credits.
        </p>
      )}
      <button
        type="button"
        className="opp-btn opp-btn-secondary"
        onClick={() => {
          setStatus("");
          setOpen(true);
        }}
      >
        Request more AI credits
      </button>
      {savedCount > 0 && (
        <details>
          <summary>What can I send on Telegram?</summary>
          <p>
            Share a link, PDF or image, or speak it out as a voice note. Try
            this example:
          </p>
          <blockquote>{sample}</blockquote>
          <small>
            Example only; this is not a verified opportunity listing. AI
            messages use the same monthly allowance.
          </small>
        </details>
      )}
      {!open && status && <p role="status">{status}</p>}
      <dialog
        ref={dialog}
        className="opp-radar-auth-dialog opp-credit-dialog"
        aria-labelledby="opp-credit-title"
        onClose={() => setOpen(false)}
      >
        <button
          type="button"
          className="opp-btn opp-btn-secondary"
          onClick={() => dialog.current?.close()}
          aria-label="Close credit request"
        >
          Close
        </button>
        <p>Support team of Abodid &amp; Co.</p>
        <h2 id="opp-credit-title">A little more room to explore?</h2>
        <p>
          Your saved opportunities and reminders stay available. Ask the Support
          team of Abodid &amp; Co. for a higher monthly AI allowance.
        </p>
        <label htmlFor="opp-credit-message">Your message</label>
        <textarea
          id="opp-credit-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          minLength={10}
          maxLength={2000}
          disabled={sending}
        />
        <button
          type="button"
          className="opp-btn opp-btn-primary"
          disabled={
            sending ||
            message.trim().length < 10 ||
            usage?.request?.delivery_status === "sent"
          }
          onClick={() => void send()}
        >
          {sending
            ? "Sending…"
            : usage?.request?.delivery_status === "sent"
              ? "Request sent"
              : "Send request"}
        </button>
        <p role="status">{status}</p>
        <a href="mailto:hello@abodid.com">
          Email the Support team of Abodid &amp; Co.
        </a>
      </dialog>
    </section>
  );
}
