import { useEffect, useRef, useState } from "react";

const RATING_LABELS = {
  1: "Not for me",
  2: "Could be better",
  3: "Good",
  4: "Very good",
  5: "Excellent",
};

export default function PunctumFeedbackModal({
  open,
  onClose,
  sessionId = "",
  sharePath = "/research/punctum",
}) {
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const [shareUrl, setShareUrl] = useState("");
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy the link");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ratingSaved, setRatingSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const feedbackStateRef = useRef({});
  onCloseRef.current = onClose;
  feedbackStateRef.current = {
    rating,
    review,
    ratingSaved,
    submitted,
    sessionId,
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(new URL(sharePath, window.location.origin).href);
    }
  }, [sharePath]);

  useEffect(() => {
    setRating(0);
    setReview("");
    setStatus("");
    setRatingSaved(false);
    setSubmitted(false);
    if (!sessionId || typeof window === "undefined") return;

    const saved = sessionStorage.getItem(`punctum-feedback-submitted:${sessionId}`);
    if (!saved) return;
    try {
      const feedback = JSON.parse(saved);
      setRating(Number(feedback.rating) || 0);
      setReview(typeof feedback.review === "string" ? feedback.review : "");
      setRatingSaved(true);
      setSubmitted(true);
    } catch {
      sessionStorage.removeItem(`punctum-feedback-submitted:${sessionId}`);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      const feedback = feedbackStateRef.current;
      if (feedback.ratingSaved && !feedback.submitted && feedback.sessionId) {
        setSubmitted(true);
        sessionStorage.setItem(
          `punctum-feedback-submitted:${feedback.sessionId}`,
          JSON.stringify({ rating: feedback.rating, review: "" }),
        );
      }
      onCloseRef.current();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open && submitted) closeRef.current?.focus();
  }, [open, submitted]);

  if (!open) return null;

  const shareText =
    "Try Punctum—a photographic experiment about the details that catch and stay with us.";
  const encodedMessage = encodeURIComponent(`${shareText}\n${shareUrl}`);
  const emailSubject = encodeURIComponent("Try Punctum");
  const emailBody = encodeURIComponent(`${shareText}\n\n${shareUrl}`);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyLabel("Link copied");
    } catch {
      const field = document.createElement("textarea");
      field.value = shareUrl;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
      setCopyLabel("Link copied");
    }
    window.setTimeout(() => setCopyLabel("Copy the link"), 1800);
  };

  const rememberSubmittedFeedback = (nextRating, nextReview) => {
    if (!sessionId) return;
    sessionStorage.setItem(
      `punctum-feedback-submitted:${sessionId}`,
      JSON.stringify({ rating: nextRating, review: nextReview }),
    );
  };

  const saveFeedback = async (nextRating, nextReview) => {
    if (!nextRating || !sessionId || submitting) return false;
    setSubmitting(true);
    try {
      const response = await fetch("/api/punctum/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          rating: nextRating,
          review: nextReview,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Your feedback could not be saved.");
      }
      return true;
    } catch (error) {
      setStatus(error.message);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const selectRating = async (value) => {
    if (submitting) return;
    setRating(value);
    setRatingSaved(false);
    setStatus("Saving your rating…");
    const saved = await saveFeedback(value, "");
    if (!saved) return;
    setRatingSaved(true);
    setStatus("Your rating is saved. Write a feedback or close the window to go back.");
  };

  const submitFeedback = async () => {
    const nextReview = review.trim();
    if (!rating || !nextReview || submitting) return;
    setStatus("");
    const saved = await saveFeedback(rating, nextReview);
    if (!saved) return;
    setRatingSaved(true);
    setSubmitted(true);
    setStatus("");
    rememberSubmittedFeedback(rating, nextReview);
  };

  const closeModal = () => {
    if (ratingSaved && !submitted) {
      setSubmitted(true);
      rememberSubmittedFeedback(rating, "");
    }
    onCloseRef.current();
  };

  return (
    <div
      className="punctum-feedback-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <section
        className={`punctum-feedback ${submitted ? "is-thank-you" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="punctum-feedback-title"
      >
        <button
          ref={closeRef}
          className="punctum-feedback__close"
          type="button"
          aria-label="Close"
          onClick={closeModal}
        >
          ×
        </button>

        {submitted ? (
          <div className="punctum-feedback__thanks" role="status">
            <p className="punctum-eyebrow">Received</p>
            {review.trim() ? (
              <blockquote>
                <span aria-hidden="true">“</span>
                <p>{review.trim()}</p>
              </blockquote>
            ) : (
              <div
                className="punctum-feedback__saved-stars"
                aria-label={`${rating} out of 5 stars`}
              >
                {"★".repeat(rating)}
              </div>
            )}
            <h2 id="punctum-feedback-title">Thank you for your feedback.</h2>
            <p>Your response has been saved.</p>
            <button
              className="punctum-button punctum-button--yellow"
              type="button"
              onClick={closeModal}
            >
              Close and go back
            </button>
          </div>
        ) : (
          <>
            <p className="punctum-eyebrow">Pass it on</p>
            <h2 id="punctum-feedback-title">Share Punctum with a friend.</h2>
            <div className="punctum-feedback__share">
              <a
                href={`https://wa.me/?text=${encodedMessage}`}
                target="_blank"
                rel="noreferrer"
              >
                Share on WhatsApp
              </a>
              <button type="button" onClick={copyLink}>
                {copyLabel}
              </button>
              <a href={`mailto:?subject=${emailSubject}&body=${emailBody}`}>
                Email it to someone
              </a>
            </div>

            <div className="punctum-feedback__divider" />

            {sessionId ? (
          <div className="punctum-feedback__rating">
            <div>
              <h3>How was the experience?</h3>
              <span>{rating ? RATING_LABELS[rating] : "Choose 1–5 stars"}</span>
            </div>
            <div className="punctum-feedback__stars" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  className={value <= rating ? "is-selected" : ""}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                  disabled={submitting}
                  onClick={() => selectRating(value)}
                  key={value}
                >
                  ★
                </button>
              ))}
            </div>
            <label>
              <span>Short review <small>optional</small></span>
              <textarea
                value={review}
                rows={3}
                maxLength={600}
                placeholder="Anything you would change?"
                onChange={(event) => setReview(event.target.value)}
              />
            </label>
            {review.trim() && (
              <button
                className="punctum-button punctum-button--yellow"
                type="button"
                disabled={!rating || submitting}
                onClick={submitFeedback}
              >
                {submitting ? "Sending…" : "Send written feedback"}
              </button>
            )}
            {status && (
              <p className="punctum-feedback__status" role="status">
                {status}
              </p>
            )}
          </div>
        ) : (
          <div className="punctum-feedback__participate">
            <h3>Want to leave a rating?</h3>
            <p>Complete the six-image experiment first.</p>
            <a href="/research/punctum/experiment">Play Punctum</a>
          </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
