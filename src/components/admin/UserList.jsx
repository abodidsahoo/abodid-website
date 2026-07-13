import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ArrowBigUp,
    Bookmark,
    Check,
    Copy,
    FilePlus2,
    MailCheck,
    MoreHorizontal,
    Search,
    ShieldCheck,
    UserRound,
    X,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import "./account-directory.css";

const VIEW_OPTIONS = [
    { value: "people", label: "People" },
    { value: "curation", label: "Curation access" },
    { value: "subscribed", label: "Newsletter subscribers" },
];

const ROLE_LABELS = {
    admin: "Admin",
    curator: "Curator",
    user: "Member",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
});

const formatDate = (value) => {
    if (!value) return "Never";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown" : dateFormatter.format(date);
};

const formatLastSeen = (value) => {
    if (!value) return "Never";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";

    const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    return formatDate(value);
};

const initialsFor = (account) => {
    if (account.isAnonymous) return "A";
    return account.displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("") || "?";
};

const activitySummary = (account) => {
    const interactions = account.activity.bookmarks + account.activity.upvotes;
    const parts = [];

    if (account.activity.submissions) {
        parts.push(`${account.activity.submissions} ${account.activity.submissions === 1 ? "submission" : "submissions"}`);
    }
    if (interactions) {
        parts.push(`${interactions} ${interactions === 1 ? "interaction" : "interactions"}`);
    }

    return parts.join(" · ") || "No activity";
};

const getAccessToken = async () => {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) throw new Error("Your admin session has expired.");
    return session.access_token;
};

export default function UserList() {
    const [directory, setDirectory] = useState({ accounts: [], summary: {} });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [view, setView] = useState("people");
    const [search, setSearch] = useState("");
    const [selectedAccountId, setSelectedAccountId] = useState("");
    const [openMenuId, setOpenMenuId] = useState("");
    const [updatingAccountId, setUpdatingAccountId] = useState("");
    const [notice, setNotice] = useState("");

    const fetchAccounts = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const accessToken = await getAccessToken();
            const response = await fetch("/api/admin/accounts", {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const result = await response.json();

            if (!response.ok) throw new Error(result.error || "Could not load accounts.");
            setDirectory(result);
        } catch (loadError) {
            console.error(loadError);
            setError(loadError.message || "Could not load accounts.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

    useEffect(() => {
        const closeMenu = () => setOpenMenuId("");
        document.addEventListener("click", closeMenu);
        return () => document.removeEventListener("click", closeMenu);
    }, []);

    useEffect(() => {
        if (!selectedAccountId) return undefined;

        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = (event) => {
            if (event.key === "Escape") setSelectedAccountId("");
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [selectedAccountId]);

    useEffect(() => {
        if (!notice) return undefined;
        const timeoutId = window.setTimeout(() => setNotice(""), 3200);
        return () => window.clearTimeout(timeoutId);
    }, [notice]);

    const selectedAccount = useMemo(
        () => directory.accounts.find((account) => account.id === selectedAccountId) || null,
        [directory.accounts, selectedAccountId],
    );

    const filteredAccounts = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        return directory.accounts.filter((account) => {
            const matchesView =
                view === "people"
                    ? account.accountType === "person"
                    : view === "curation"
                        ? account.accountType === "person" && ["admin", "curator"].includes(account.role)
                        : view === "subscribed"
                            ? account.accountType === "person" && account.isNewsletterSubscriber
                            : view === "anonymous"
                                ? account.accountType === "anonymous"
                                : account.accountType === "test";

            if (!matchesView) return false;
            if (!normalizedSearch) return true;

            return [account.displayName, account.email, account.username, account.id]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(normalizedSearch));
        });
    }, [directory.accounts, search, view]);

    const updateRole = async (account, role) => {
        if (role === account.role) return;

        setUpdatingAccountId(account.id);
        setOpenMenuId("");

        try {
            const accessToken = await getAccessToken();
            const response = await fetch("/api/admin/accounts", {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ accountId: account.id, role }),
            });
            const result = await response.json();

            if (!response.ok) throw new Error(result.error || "Could not update the role.");

            setDirectory((current) => {
                const curatorDelta =
                    account.accountType === "person"
                        ? Number(role === "curator") - Number(account.role === "curator")
                        : 0;
                const curationDelta =
                    account.accountType === "person"
                        ? Number(["admin", "curator"].includes(role)) - Number(["admin", "curator"].includes(account.role))
                        : 0;

                return {
                    ...current,
                    accounts: current.accounts.map((item) =>
                        item.id === account.id ? { ...item, role } : item,
                    ),
                    summary: {
                        ...current.summary,
                        curators: Math.max(0, (current.summary.curators || 0) + curatorDelta),
                        curationAccess: Math.max(0, (current.summary.curationAccess || 0) + curationDelta),
                    },
                };
            });
            setNotice(`${account.displayName} is now ${role === "curator" ? "a curator" : "a member"}.`);
        } catch (updateError) {
            console.error(updateError);
            setNotice(updateError.message || "Could not update the role.");
        } finally {
            setUpdatingAccountId("");
        }
    };

    const copyEmail = async (account) => {
        if (!account.email) return;

        try {
            await navigator.clipboard.writeText(account.email);
            setNotice("Email copied.");
        } catch (_error) {
            setNotice("Could not copy the email.");
        }
        setOpenMenuId("");
    };

    const openAccount = (accountId) => {
        setSelectedAccountId(accountId);
        setOpenMenuId("");
    };

    if (loading) {
        return (
            <div className="account-directory-state" role="status">
                <span className="account-loader" />
                <p>Loading accounts…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="account-directory-state error" role="alert">
                <h3>Accounts could not be loaded</h3>
                <p>{error}</p>
                <button type="button" onClick={fetchAccounts}>Try again</button>
            </div>
        );
    }

    const summary = directory.summary;

    return (
        <section className="account-directory" aria-labelledby="account-directory-title">
            <header className="account-header">
                <div className="account-heading">
                    <h2 id="account-directory-title">Accounts</h2>
                    <p>
                        {summary.people} people <span>·</span> {summary.curationAccess} with curation access <span>·</span> {summary.accountSubscribers} subscribed
                    </p>
                </div>

                <div className="account-toolbar">
                    <label className="account-search">
                        <Search size={16} aria-hidden="true" />
                        <span className="sr-only">Search accounts</span>
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search accounts"
                        />
                    </label>

                    <label className="account-view-filter">
                        <span className="sr-only">Choose account view</span>
                        <select value={view} onChange={(event) => setView(event.target.value)}>
                            {VIEW_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                            <optgroup label="Maintenance">
                                <option value="anonymous">Anonymous sessions ({summary.anonymous})</option>
                                <option value="test">Likely test accounts ({summary.testAccounts})</option>
                            </optgroup>
                        </select>
                    </label>
                </div>
            </header>

            <div className="account-table-shell">
                <div className="account-table-head" aria-hidden="true">
                    <span>Account</span>
                    <span>Access</span>
                    <span>Activity</span>
                    <span>Last active</span>
                    <span />
                </div>

                <div className="account-table-body">
                    {filteredAccounts.map((account) => {
                        const isMenuOpen = openMenuId === account.id;
                        const isUpdating = updatingAccountId === account.id;

                        return (
                            <div className="account-table-row" key={account.id}>
                                <button
                                    type="button"
                                    className="account-row-main"
                                    onClick={() => openAccount(account.id)}
                                    aria-label={`View ${account.displayName}`}
                                >
                                    <span className="account-identity">
                                        <span className={`account-avatar ${account.accountType}`}>
                                            {account.avatarUrl ? <img src={account.avatarUrl} alt="" /> : initialsFor(account)}
                                        </span>
                                        <span className="account-name-block">
                                            <strong>{account.displayName}</strong>
                                            <small>{account.email || "Anonymous device session"}</small>
                                        </span>
                                    </span>

                                    <span className={`access-badge ${account.role}`}>
                                        {account.role === "admin" && <ShieldCheck size={13} />}
                                        {ROLE_LABELS[account.role] || "Member"}
                                    </span>

                                    <span className="account-row-activity">{activitySummary(account)}</span>
                                    <span className="account-row-recency">{formatLastSeen(account.lastSignInAt)}</span>
                                </button>

                                <div className="account-row-menu">
                                    <button
                                        type="button"
                                        className="account-menu-trigger"
                                        aria-label={`Actions for ${account.displayName}`}
                                        aria-expanded={isMenuOpen}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setOpenMenuId((current) => current === account.id ? "" : account.id);
                                        }}
                                    >
                                        <MoreHorizontal size={18} />
                                    </button>

                                    {isMenuOpen && (
                                        <div className="account-action-menu" onClick={(event) => event.stopPropagation()}>
                                            <button type="button" onClick={() => openAccount(account.id)}>
                                                <UserRound size={14} /> View account
                                            </button>
                                            {!account.isAnonymous && account.role !== "admin" && (
                                                <button
                                                    type="button"
                                                    disabled={isUpdating}
                                                    onClick={() => updateRole(account, account.role === "curator" ? "user" : "curator")}
                                                >
                                                    <ShieldCheck size={14} />
                                                    {account.role === "curator" ? "Return to member" : "Make curator"}
                                                </button>
                                            )}
                                            {account.email && (
                                                <button type="button" onClick={() => copyEmail(account)}>
                                                    <Copy size={14} /> Copy email
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {filteredAccounts.length === 0 && (
                        <div className="account-empty-state">
                            <UserRound size={22} />
                            <h3>No matching accounts</h3>
                            <p>Try another search or account view.</p>
                            <button type="button" onClick={() => { setSearch(""); setView("people"); }}>
                                Reset view
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {selectedAccount && (
                <div className="account-drawer-layer" role="presentation">
                    <button
                        type="button"
                        className="account-drawer-backdrop"
                        aria-label="Close account details"
                        onClick={() => setSelectedAccountId("")}
                    />
                    <aside className="account-drawer" role="dialog" aria-modal="true" aria-labelledby="account-drawer-title">
                        <div className="account-drawer-topbar">
                            <span>Account details</span>
                            <button type="button" aria-label="Close account details" onClick={() => setSelectedAccountId("")}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="account-drawer-profile">
                            <span className={`account-avatar large ${selectedAccount.accountType}`}>
                                {selectedAccount.avatarUrl ? <img src={selectedAccount.avatarUrl} alt="" /> : initialsFor(selectedAccount)}
                            </span>
                            <div>
                                <h3 id="account-drawer-title">{selectedAccount.displayName}</h3>
                                <p>{selectedAccount.email || "Anonymous device session"}</p>
                                <div className="drawer-badges">
                                    <span className={`access-badge ${selectedAccount.role}`}>{ROLE_LABELS[selectedAccount.role] || "Member"}</span>
                                    {selectedAccount.isNewsletterSubscriber && <span className="drawer-subscriber"><MailCheck size={12} /> Subscribed</span>}
                                    {selectedAccount.isLikelyTest && <span className="drawer-test">Likely test</span>}
                                </div>
                            </div>
                        </div>

                        <section className="drawer-section">
                            <h4>Activity</h4>
                            <div className="drawer-activity-grid">
                                <div><FilePlus2 size={16} /><strong>{selectedAccount.activity.submissions}</strong><span>Submissions</span></div>
                                <div><Bookmark size={16} /><strong>{selectedAccount.activity.bookmarks}</strong><span>Saves</span></div>
                                <div><ArrowBigUp size={16} /><strong>{selectedAccount.activity.upvotes}</strong><span>Upvotes</span></div>
                            </div>
                        </section>

                        <section className="drawer-section">
                            <h4>Access</h4>
                            {selectedAccount.isAnonymous ? (
                                <p className="drawer-explanation">Anonymous sessions can save and upvote resources but cannot receive community roles.</p>
                            ) : selectedAccount.role === "admin" ? (
                                <div className="drawer-access-static"><ShieldCheck size={16} /><span><strong>Admin</strong><small>Full site and curation access</small></span></div>
                            ) : (
                                <label className="drawer-role-control">
                                    <span>Community role</span>
                                    <select
                                        value={selectedAccount.role}
                                        disabled={updatingAccountId === selectedAccount.id}
                                        onChange={(event) => updateRole(selectedAccount, event.target.value)}
                                    >
                                        <option value="user">Member</option>
                                        <option value="curator">Curator</option>
                                    </select>
                                </label>
                            )}
                        </section>

                        <section className="drawer-section">
                            <h4>Account information</h4>
                            <dl className="drawer-facts">
                                <div><dt>Joined</dt><dd>{formatDate(selectedAccount.createdAt)}</dd></div>
                                <div><dt>Last sign-in</dt><dd>{formatDate(selectedAccount.lastSignInAt)}</dd></div>
                                <div><dt>Username</dt><dd>{selectedAccount.username ? `@${selectedAccount.username}` : "Not set"}</dd></div>
                                <div><dt>Newsletter</dt><dd>{selectedAccount.isNewsletterSubscriber ? <><Check size={13} /> Subscribed</> : "Not subscribed"}</dd></div>
                                <div className="full"><dt>Account ID</dt><dd><code>{selectedAccount.id}</code></dd></div>
                            </dl>
                        </section>
                    </aside>
                </div>
            )}

            {notice && <div className="account-toast" role="status">{notice}</div>}
        </section>
    );
}
