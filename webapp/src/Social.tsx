import React, { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import { useI18n } from "./i18n/I18nProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

type SearchResult = {
    username: string;
    email: string | null;
    realName: string | null;
};

type RequestStatus = "idle" | "sending" | "sent" | "error" | "already_friends";

// ── UserCard ──────────────────────────────────────────────────────────────────

type UserCardProps = {
    user: SearchResult;
    currentUser: string | null;
    token: string;
    onViewProfile: (username: string) => void;
};

const UserCard: React.FC<UserCardProps> = ({ user, currentUser, token, onViewProfile }) => {
    const { t } = useI18n();
    const [status, setStatus] = useState<RequestStatus>("idle");

    const handleSendRequest = async () => {
        if (!token) return;
        setStatus("sending");
        try {
            const res  = await fetch(`/api/friends/request/${user.username}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();

            if (res.ok && data.success) {
                setStatus("sent");
            } else if (res.status === 409) {
                setStatus("already_friends");
            } else {
                setStatus("error");
            }
        } catch {
            setStatus("error");
        }
    };

    const isSelf = currentUser === user.username;

    return (
        <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px", borderRadius: "var(--r)",
            border: "1px solid var(--stroke)", background: "var(--panel)",
            boxShadow: "var(--shadow)", gap: 12,
        }}>
            {/* Avatar + info */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                    width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg, var(--aqua), var(--navy))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1rem", fontWeight: 900, color: "#fff",
                }}>
                    {user.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem" }}>
                        {user.username}
                    </p>
                    {user.realName && (
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>
                            {user.realName}
                        </p>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                    onClick={() => onViewProfile(user.username)}
                >
                    {t("social.viewProfile")}
                </button>

                {!isSelf && (
                    <button
                        type="button"
                        className={`btn ${status === "sent" || status === "already_friends" ? "btn--ghost" : "btn--primary"}`}
                        style={{ fontSize: "0.8rem", padding: "6px 12px", minWidth: 120 }}
                        onClick={handleSendRequest}
                        disabled={status === "sending" || status === "sent" || status === "already_friends"}
                    >
                        {status === "idle"            && `➕ ${t("social.sendRequest")}`}
                        {status === "sending"         && "..."}
                        {status === "sent"            && `✔ ${t("social.requestSent")}`}
                        {status === "already_friends" && `✔ ${t("social.alreadyFriends")}`}
                        {status === "error"           && `⚠ ${t("social.requestError")}`}
                    </button>
                )}
            </div>
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

const Social: React.FC = () => {
    const navigate    = useNavigate();
    const { t }       = useI18n();

    const currentUser = localStorage.getItem("username");
    const token       = localStorage.getItem("token") ?? "";

    const [query,   setQuery]   = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [error,   setError]   = useState<string | null>(null);

    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Debounced search — fires after user stops typing for 400 ms
    const handleSearch = useCallback(async (value: string) => {
        const q = value.trim();
        if (q.length < 1) {
            setResults([]);
            setSearched(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
            const data = await res.json();

            if (data.success) {
                // Ensure data.users is always an array
                setResults(data.users ?? []);
            } else {
                setError(data.error ?? t("social.searchError"));
                setResults([]); // Clear results on error
            }
        } catch {
            setError(t("social.searchError"));
            setResults([]);
        } finally {
            setLoading(false);
            setSearched(true);
        }
    }, [t]);

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);

        // Clear previous timeout
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => handleSearch(value), 400);
    };

    return (
        <div className="page">
            <Navbar username={currentUser} />

            <main className="container" style={{ paddingTop: 40 }}>
                <div style={{ maxWidth: 680, margin: "0 auto",
                    display: "flex", flexDirection: "column", gap: 24 }}>

                    {/* ── Page title ───────────────────────────────────────── */}
                    <div>
                        <h1 style={{ margin: "0 0 4px", fontSize: "1.8rem" }}>
                            👥 {t("social.title")}
                        </h1>
                        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
                            {t("social.subtitle")}
                        </p>
                    </div>

                    {/* ── Search bar ───────────────────────────────────────── */}
                    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <label style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                            🔍 {t("social.searchLabel")}
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder={t("social.searchPlaceholder")}
                            value={query}
                            onChange={onInputChange}
                            style={{ fontSize: "1rem" }}
                            autoFocus
                        />
                    </div>

                    {/* ── Search results ───────────────────────────────────── */}
                    {(searched || loading) && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <h2 style={{ margin: 0, fontSize: "1rem",
                                color: "var(--muted)", fontWeight: 700 }}>
                                {loading
                                    ? t("social.searching")
                                    : `${t("social.resultsLabel")} (${results?.length ?? 0})`}
                            </h2>

                            {error && (
                                <p style={{ color: "var(--danger)", fontWeight: 700 }}>{error}</p>
                            )}

                            {!loading && !error && (results?.length ?? 0) === 0 && (
                                <div className="card" style={{ textAlign: "center",
                                    opacity: 0.6, padding: "28px 0" }}>
                                    <p style={{ margin: 0, color: "var(--muted)" }}>
                                        {t("social.noResults")}
                                    </p>
                                </div>
                            )}

                            {/* Safe map: results is always array now, but we add optional chaining for extra safety */}
                            {!loading && results?.map(user => (
                                <UserCard
                                    key={user.username}
                                    user={user}
                                    currentUser={currentUser}
                                    token={token}
                                    onViewProfile={(u) => navigate(`/profile/${u}`)}
                                />
                            ))}
                        </div>
                    )}

                    {/* ── Groups — coming soon ─────────────────────────────── */}
                    <div className="card" style={{
                        opacity: 0.55, border: "1px dashed var(--stroke)",
                        textAlign: "center", padding: "32px 0",
                    }}>
                        <p style={{ margin: "0 0 6px", fontSize: "1.5rem" }}>🏘️</p>
                        <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: "1rem" }}>
                            {t("social.groupsTitle")}
                        </p>
                        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
                            {t("social.groupsSubtitle")}
                        </p>
                    </div>

                </div>
            </main>
        </div>
    );
};

export default Social;