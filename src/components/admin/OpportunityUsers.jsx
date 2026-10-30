import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import "./opportunity-admin-shell.css";
import "./opportunity-users.css";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : dateFormatter.format(date);
};

const formatTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : `${timeFormatter.format(date)} IST`;
};

const initialsFor = (name) =>
  String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";

const getAdminToken = async (providedToken) => {
  if (providedToken) return providedToken;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token)
    throw new Error("Your admin session has expired.");
  return session.access_token;
};

export default function OpportunityUsers({
  accessToken,
  directory,
  loading,
  error,
  onRetry,
}) {
  const dialogRef = useRef(null);
  const confirmationRef = useRef(null);
  const [confirmation, setConfirmation] = useState(null);
  const openedDeepLinkRef = useRef(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const selectedUserIdRef = useRef(null);
  selectedUserIdRef.current = selectedUser?.id;
  const [allowance, setAllowance] = useState(5);
  const [limitStatus, setLimitStatus] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);
  const [limitOverrides, setLimitOverrides] = useState({});
  const [limitFeedback, setLimitFeedback] = useState({});
  const [pendingLimits, setPendingLimits] = useState({});
  const pendingLimitIds = useRef(new Set());
  const [collection, setCollection] = useState({
    loading: false,
    error: "",
    opportunities: [],
  });

  useEffect(() => {
    setLimitOverrides({});
  }, [directory.users]);

  const openCollection = useCallback(
    async (user) => {
      setSelectedUser(user);
      setCollection({ loading: true, error: "", opportunities: [] });

      try {
        const token = await getAdminToken(accessToken);
        const response = await fetch(
          `/api/admin/opportunity-users/${encodeURIComponent(user.id)}`,
          {
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(payload.error || "Could not load this collection.");
        setSelectedUser(payload.user || user);
        setLimitOverrides((current) => ({
          ...current,
          [user.id]: payload.user?.monthlyLimit ?? 5,
        }));
        setAllowance(payload.user?.monthlyLimit ?? 5);
        setLimitStatus("");
        setCollection({
          loading: false,
          error: "",
          opportunities: payload.opportunities || [],
        });
      } catch (collectionError) {
        setCollection({
          loading: false,
          error:
            collectionError instanceof Error
              ? collectionError.message
              : "Could not load this collection.",
          opportunities: [],
        });
      }
    },
    [accessToken],
  );

  useEffect(() => {
    if (!selectedUser || dialogRef.current?.open) return;
    dialogRef.current?.showModal();
  }, [selectedUser]);

  useEffect(() => {
    if (loading || openedDeepLinkRef.current || directory.users.length === 0)
      return;
    const requestedUserId = new URLSearchParams(window.location.search).get(
      "user",
    );
    if (!requestedUserId) return;
    openedDeepLinkRef.current = true;
    const requestedUser = directory.users.find(
      (user) => user.id === requestedUserId,
    );
    if (requestedUser) void openCollection(requestedUser);
  }, [directory.users, loading, openCollection]);

  useEffect(() => {
    if (confirmation && !confirmationRef.current?.open)
      confirmationRef.current?.showModal();
  }, [confirmation]);
  const reviewAllowance = (user, update) => {
    const currentLimit = limitOverrides[user.id] ?? user.monthlyLimit ?? 5;
    setConfirmation({
      user,
      update,
      currentLimit,
      nextLimit:
        update.increment !== undefined
          ? currentLimit + update.increment
          : update.monthly_limit,
    });
  };
  const changeAllowance = async (userId, update) => {
    if (pendingLimitIds.current.has(userId)) return;
    pendingLimitIds.current.add(userId);
    setPendingLimits((current) => ({ ...current, [userId]: true }));
    setLimitFeedback((current) => ({ ...current, [userId]: "" }));
    setSavingLimit(true);
    setLimitStatus("");
    try {
      const token = await getAdminToken(accessToken);
      const response = await fetch(
        `/api/admin/opportunity-users/${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(update),
          signal: AbortSignal.timeout(15000),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error || "Could not update the allowance.");
      const next = body.monthly_limit;
      if (!Number.isInteger(next))
        throw new Error(
          "The update could not be confirmed. Refresh before trying again.",
        );
      const feedback = `Updated to ${next} AI attempts per month. Existing usage is preserved.`;
      setLimitOverrides((current) => ({ ...current, [userId]: next }));
      setLimitFeedback((current) => ({ ...current, [userId]: feedback }));
      setSelectedUser((current) =>
        current?.id === userId
          ? {
              ...current,
              monthlyLimit: next,
              creditRequest:
                next > current.monthlyLimit ? null : current.creditRequest,
            }
          : current,
      );
      if (dialogRef.current?.open && selectedUserIdRef.current === userId) {
        setAllowance(next);
        setLimitStatus(feedback);
      }
    } catch (error) {
      const message =
        error.name === "TimeoutError"
          ? "The update could not be confirmed. Refresh before trying again."
          : error.message || "Could not save allowance.";
      setLimitFeedback((current) => ({ ...current, [userId]: message }));
      if (selectedUserIdRef.current === userId) setLimitStatus(message);
    } finally {
      pendingLimitIds.current.delete(userId);
      setPendingLimits((current) => ({ ...current, [userId]: false }));
      setSavingLimit(false);
    }
  };
  const saveAllowance = () =>
    reviewAllowance(selectedUser, { monthly_limit: Number(allowance) });
  const confirmAllowance = async () => {
    const pending = confirmation;
    if (!pending) return;
    await changeAllowance(pending.user.id, {
      ...pending.update,
      expected_limit: pending.currentLimit,
    });
    confirmationRef.current?.close();
  };

  const clearUserQuery = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("user");
    window.history.replaceState({}, "", url);
  };

  const closeDialog = () => {
    dialogRef.current?.close();
    setSelectedUser(null);
    setCollection({ loading: false, error: "", opportunities: [] });
    clearUserQuery();
  };

  return (
    <div className="opportunity-users">
      <section
        className="opportunity-admin-collection"
        aria-labelledby="opportunity-users-directory-title"
      >
        <header className="opportunity-admin-results-heading">
          <h3
            id="opportunity-users-directory-title"
            className="opportunity-admin-counter"
          >
            {loading
              ? "Users"
              : `${(directory.summary?.total || 0).toLocaleString()} ${(directory.summary?.total || 0) === 1 ? "user" : "users"}`}
          </h3>
          <p>
            {loading
              ? "Loading directory…"
              : `${(directory.summary?.savedOpportunities || 0).toLocaleString()} saved opportunities · ${(directory.summary?.monthAiAttempts || 0).toLocaleString()} AI attempts this month · ${(directory.summary?.totalAiAttempts || 0).toLocaleString()} total tracked`}
          </p>
        </header>

        <div
          className="opportunity-users-table-shell"
          role="region"
          aria-labelledby="opportunity-users-directory-title"
          tabIndex="0"
        >
          {loading && (
            <p className="opportunity-users-state" role="status">
              Loading users…
            </p>
          )}
          {!loading && error && (
            <div className="opportunity-users-state is-error" role="alert">
              <p>{error}</p>
              <button type="button" onClick={onRetry}>
                Try again
              </button>
            </div>
          )}
          {!loading && !error && directory.users.length === 0 && (
            <p className="opportunity-users-state">No users yet.</p>
          )}
          {!loading && !error && directory.users.length > 0 && (
            <table className="opportunity-users-table">
              <caption>
                People who have onboarded to Opportunity Tracker
              </caption>
              <colgroup>
                <col className="opportunity-users-col-user" />
                <col className="opportunity-users-col-onboarded" />
                <col className="opportunity-users-col-saved" />
                <col className="opportunity-users-col-ai" />
                <col className="opportunity-users-col-collection" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Onboarded</th>
                  <th scope="col">Saved</th>
                  <th scope="col">AI usage</th>
                  <th scope="col">Manage user</th>
                </tr>
              </thead>
              <tbody>
                {directory.users.map((user) => (
                  <tr key={user.id}>
                    <th scope="row">
                      <span className="opportunity-user-profile">
                        <span
                          className="opportunity-user-avatar"
                          aria-hidden="true"
                        >
                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt=""
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            initialsFor(user.displayName)
                          )}
                        </span>
                        <span className="opportunity-user-identity">
                          <strong>{user.displayName}</strong>
                          <small>{user.email || `@${user.username}`}</small>
                        </span>
                      </span>
                    </th>
                    <td data-label="Onboarded">
                      <strong className="opportunity-user-date">
                        {formatDate(user.onboardedAt)}
                      </strong>
                      <small>{formatTime(user.onboardedAt)}</small>
                    </td>
                    <td data-label="Saved">
                      <strong className="opportunity-user-count">
                        {user.opportunityCount}
                      </strong>
                    </td>
                    <td data-label="AI usage">
                      <strong>{user.aiUsed || 0} used this month</strong>
                      <small>
                        {user.aiPaused
                          ? 0
                          : Math.max(
                              0,
                              (limitOverrides[user.id] ??
                                user.monthlyLimit ??
                                5) - (user.aiUsed || 0),
                            )}{" "}
                        remaining /{" "}
                        {limitOverrides[user.id] ?? user.monthlyLimit ?? 5}
                      </small>
                      <small>{user.aiTotal || 0} total tracked</small>
                      {user.aiPaused && <small>AI globally paused</small>}
                    </td>
                    <td data-label="Collection">
                      <button
                        type="button"
                        className="opportunity-user-view"
                        onClick={() => {
                          const url = new URL(window.location.href);
                          url.searchParams.set("user", user.id);
                          window.history.replaceState({}, "", url);
                          void openCollection(user);
                        }}
                        aria-label={`View ${user.displayName}'s collection`}
                      >
                        <span>View collection</span>
                        <ArrowUpRight
                          size={17}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      </button>
                      <div className="opp-user-credit-action">
                        <small>
                          {limitOverrides[user.id] ?? user.monthlyLimit ?? 5} AI
                          attempts / month
                        </small>
                        <button
                          type="button"
                          className="opportunity-user-view"
                          disabled={
                            Boolean(pendingLimits[user.id]) ||
                            (limitOverrides[user.id] ??
                              user.monthlyLimit ??
                              5) > 9995
                          }
                          onClick={() =>
                            reviewAllowance(user, { increment: 5 })
                          }
                          aria-label={`Add 5 monthly AI attempts for ${user.displayName}`}
                        >
                          {pendingLimits[user.id]
                            ? "Updating…"
                            : "+5 AI attempts"}
                        </button>
                        <small role="status">
                          {limitFeedback[user.id] || ""}
                        </small>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="opportunity-users-meter-note">
          Usage counts AI attempts admitted for processing, including failed
          processing. Metering began on 30 October 2026. Months use UTC.
        </p>
      </section>

      <dialog
        ref={dialogRef}
        className="opportunity-collection-dialog"
        aria-labelledby="opportunity-collection-title"
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
        onClose={() => {
          setSelectedUser(null);
          setCollection({ loading: false, error: "", opportunities: [] });
          clearUserQuery();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        <header>
          <div>
            <p>Private collection</p>
            <h3 id="opportunity-collection-title">
              {selectedUser?.displayName || "Collection"}
            </h3>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Close collection"
          >
            <X size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <div className="opportunity-collection-body">
          {!collection.loading && !collection.error && (
            <section className="opp-admin-allowance">
              <p>
                AI attempts this month: {selectedUser?.aiUsed || 0} /{" "}
                {selectedUser?.monthlyLimit ?? 5}
              </p>
              <p>
                {Math.max(
                  0,
                  (selectedUser?.monthlyLimit ?? 5) -
                    (selectedUser?.aiUsed || 0),
                )}{" "}
                AI attempts remaining · {selectedUser?.aiTotal || 0} total
                tracked
              </p>
              <p>
                Saved opportunities: {collection.opportunities.length} / 100
              </p>
              <div
                className="opp-allowance-quick-actions"
                aria-label="Increase monthly AI allowance"
              >
                {[5].map((amount) => (
                  <button
                    type="button"
                    key={amount}
                    disabled={
                      savingLimit ||
                      Boolean(pendingLimits[selectedUser?.id]) ||
                      (selectedUser?.monthlyLimit ?? 5) + amount > 10000
                    }
                    onClick={() =>
                      reviewAllowance(selectedUser, { increment: amount })
                    }
                  >
                    +{amount} AI attempts
                  </button>
                ))}
              </div>
              <label htmlFor="opportunity-monthly-allowance">
                Monthly AI allowance
              </label>
              <input
                id="opportunity-monthly-allowance"
                type="number"
                min="0"
                max="10000"
                step="1"
                value={allowance}
                onChange={(e) => setAllowance(e.target.value)}
                disabled={savingLimit}
              />
              <button
                type="button"
                onClick={saveAllowance}
                disabled={
                  savingLimit ||
                  allowance === "" ||
                  !Number.isInteger(Number(allowance)) ||
                  Number(allowance) < 0 ||
                  Number(allowance) > 10000
                }
              >
                {savingLimit ? "Saving…" : "Save allowance"}
              </button>
              {selectedUser?.creditRequest && (
                <blockquote>
                  <strong>Request for more credits</strong>
                  <p>{selectedUser.creditRequest.message}</p>
                  <small>
                    Email: {selectedUser.creditRequest.delivery_status}
                  </small>
                </blockquote>
              )}
              <p role="status">{limitStatus}</p>
            </section>
          )}

          {collection.loading && (
            <p className="opportunity-collection-state" role="status">
              Loading collection…
            </p>
          )}
          {!collection.loading && collection.error && (
            <p className="opportunity-collection-state is-error" role="alert">
              {collection.error}
            </p>
          )}
          {!collection.loading &&
            !collection.error &&
            collection.opportunities.length === 0 && (
              <p className="opportunity-collection-state">
                No saved opportunities yet.
              </p>
            )}
          {!collection.loading &&
            !collection.error &&
            collection.opportunities.length > 0 && (
              <ol className="opportunity-collection-list">
                {collection.opportunities.map((opportunity) => (
                  <li key={opportunity.id}>
                    <div>
                      <span>
                        {opportunity.organisation ||
                          opportunity.category ||
                          "Opportunity"}
                      </span>
                      <h4>{opportunity.title}</h4>
                      <p>
                        {opportunity.deadlineAt
                          ? `Deadline ${formatDate(opportunity.deadlineAt)}`
                          : "No deadline"}
                        {" · "}
                        {opportunity.status}
                      </p>
                    </div>
                    {opportunity.sourceUrl && (
                      <a
                        href={opportunity.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span>Source</span>
                        <ArrowUpRight
                          size={16}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      </a>
                    )}
                  </li>
                ))}
              </ol>
            )}
        </div>
      </dialog>
      <dialog
        ref={confirmationRef}
        className="opportunity-collection-dialog opp-allowance-confirmation"
        aria-labelledby="confirm-allowance-title"
        onCancel={(event) => {
          if (pendingLimits[confirmation?.user.id]) event.preventDefault();
        }}
        onClose={() => setConfirmation(null)}
      >
        <header>
          <h3 id="confirm-allowance-title">Confirm AI allowance change</h3>
        </header>
        <div className="opportunity-collection-body">
          <p>
            <strong>{confirmation?.user.displayName}</strong>
            <br />
            {confirmation?.user.email || confirmation?.user.username}
          </p>
          <p>
            Monthly allowance:{" "}
            <strong>
              {confirmation?.currentLimit} → {confirmation?.nextLimit}
            </strong>
          </p>
          <p>
            {confirmation?.user.aiUsed || 0} attempts already used this month.{" "}
            {Math.max(
              0,
              (confirmation?.nextLimit || 0) - (confirmation?.user.aiUsed || 0),
            )}{" "}
            would remain.
          </p>
          <p>
            Existing usage will be preserved. This allowance renews each month
            until you change it again.
          </p>
          <div className="opp-allowance-quick-actions">
            <button
              type="button"
              autoFocus
              disabled={Boolean(pendingLimits[confirmation?.user.id])}
              onClick={() => confirmationRef.current?.close()}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={Boolean(pendingLimits[confirmation?.user.id])}
              onClick={() => void confirmAllowance()}
            >
              {pendingLimits[confirmation?.user.id]
                ? "Updating…"
                : "Confirm allowance change"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
