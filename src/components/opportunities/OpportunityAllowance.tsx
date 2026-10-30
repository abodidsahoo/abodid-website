import React, { useEffect, useRef, useState } from "react";
import { OPPORTUNITY_CURATED_COLLECTION_PATH } from "../../lib/opportunities/routes";
const sample =
  "Keep track of the Google Creative Art Residency in India whose application deadline is 12th April, 2027.";
export function OpportunityAllowance({
  accessToken,
  savedCount,
  error,
  radarOpen,
  onClose,
}: {
  accessToken: string | null;
  savedCount?: number;
  error: string;
  radarOpen: boolean;
  onClose: () => void;
}) {
  const [usage, setUsage] = useState<any>(null),
    [open, setOpen] = useState(false),
    [sending, setSending] = useState(false),
    [status, setStatus] = useState("");
  const [message, setMessage] = useState(
    "Hello Support team of Abodid & Co., I’m enjoying the opportunity tracker and reminder features, and I’d love a higher monthly AI allowance.",
  );
  const [usageError, setUsageError] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const radarDialog = useRef<HTMLDialogElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { setUsage(null); setRequestSent(false); }, [accessToken]);
  useEffect(() => {
    if (!accessToken || (!radarOpen && !open)) return;
    setUsageError("");
    const controller = new AbortController();
    fetch("/api/opportunities/usage", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Usage unavailable. Close and reopen to retry.");
        const nextUsage = await r.json();
        if (!controller.signal.aborted) setUsage(nextUsage);
      })
      .catch((error) => { if (!controller.signal.aborted) setUsageError(error.message); });
    return () => controller.abort();
  }, [accessToken, savedCount, error, open, radarOpen]);
  useEffect(() => {
    if (radarOpen && !radarDialog.current?.open) radarDialog.current?.showModal();
    if (!radarOpen && radarDialog.current?.open) radarDialog.current.close();
  }, [radarOpen]);
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
      setRequestSent(true);
      setUsage((v: any) => v ? { ...v, request: { delivery_status: "sent" } } : v);
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
  const exhausted = usage && usage.used >= usage.limit;
  const count = usage?.saved ?? savedCount;
  return (
    <>
      <dialog
        ref={radarDialog}
        className="opp-radar-auth-dialog opp-radar-settings-dialog"
        data-pop-surface="cream"
        aria-labelledby="opp-radar-settings-title"
        onClose={onClose}
      >
        <button type="button" className="opp-btn opp-btn-secondary opp-radar-settings-close"
          aria-label="Close your usage settings" onClick={() => radarDialog.current?.close()}>Close</button>
        <h2 id="opp-radar-settings-title">Your usage</h2>
        <a className="opp-btn opp-btn-secondary" href={OPPORTUNITY_CURATED_COLLECTION_PATH}>
          Browse opportunities
        </a>
        <dl className="opp-radar-usage" aria-live="polite">
          <div><dt>AI attempts this month</dt><dd>{usage ? `${usage.used} of ${usage.limit} used` : usageError || "Loading…"}</dd></div>
          <div><dt>Saved opportunities</dt><dd>{count === undefined ? "Loading…" : `${count} of 100`}</dd></div>
        </dl>
        {exhausted && <p>Resets {new Date(usage.resets_at).toLocaleDateString(undefined, { dateStyle: "long" })}. Your saved opportunities remain available.</p>}
        {count !== undefined && count >= 100 && <p>Delete an opportunity to make room. Deleting does not restore AI attempts.</p>}
        <button type="button" className="opp-btn opp-btn-secondary" onClick={() => { setStatus(""); setOpen(true); }}>
          Request more AI credits
        </button>
        <details className="opp-radar-telegram-help">
          <summary>Using Telegram</summary>
          <p>Connect from Settings, then send a link, file or voice note. For example:</p>
          <blockquote>{sample}</blockquote>
          <small>Example only. AI processing uses the same monthly allowance.</small>
        </details>
      </dialog>
      <dialog
        ref={dialog}
        className="opp-radar-auth-dialog opp-credit-dialog" data-pop-surface="cream"
        aria-labelledby="opp-credit-title"
        onClose={() => { setOpen(false); if (!radarOpen) onClose(); }}
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
            requestSent || usage?.request?.delivery_status === "sent"
          }
          onClick={() => void send()}
        >
          {sending
            ? "Sending…"
            : requestSent || usage?.request?.delivery_status === "sent"
              ? "Request sent"
              : "Send request"}
        </button>
        <p role="status">{status}</p>
        <a href="mailto:hello@abodid.com">
          Email the Support team of Abodid &amp; Co.
        </a>
      </dialog>
    </>
  );
}
