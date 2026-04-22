import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "./Navbar";
import { useI18n } from "./i18n/I18nProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

type RecentMatch = {
    opponent: string;
    result: "win" | "loss";
    boardSize: number;
    gameMode: "pvb" | "pvp";
    date: string;
};

type ProfileData = {
    username: string;
    realName: string | null;
    bio: string | null;
    location: { city?: string; country?: string };
    preferredLanguage: string;
    joinDate: string;
    stats: {
        totalGames: number;
        wins: number;
        losses: number;
        winRate: number;
    };
    recentMatches: RecentMatch[];
    friends: string[];
    friendRequests: string[];
};

type EditForm = {
    realName: string;
    bio: string;
    city: string;
    country: string;
    preferredLanguage: string;
};

type FriendRequestStatus = "idle" | "sending" | "sent" | "already" | "error";

// ── Avatar ────────────────────────────────────────────────────────────────────

const Avatar: React.FC<{ username: string }> = ({ username }) => (
    <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: "linear-gradient(135deg, var(--aqua), var(--navy))",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "1.6rem", fontWeight: 900, color: "#fff",
        margin: "0 auto 12px",
    }}>
        {username.slice(0, 2).toUpperCase()}
    </div>
);

// ── Edit modal ────────────────────────────────────────────────────────────────

type EditModalProps = {
    form: EditForm;
    saving: boolean;
    onChange: (field: keyof EditForm, value: string) => void;
    onSave: () => void;
    onClose: () => void;
    t: (key: string) => string;
};

const EditModal: React.FC<EditModalProps> = ({ form, saving, onChange, onSave, onClose, t }) => (
    <div style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
    }}>
        <div className="modal-card" style={{ width: "100%", maxWidth: 480,
            display: "flex", flexDirection: "column", gap: 14 }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: "1.2rem" }}>{t("profile.edit.title")}</h2>
                <button type="button" onClick={onClose}
                        style={{ background: "none", border: "none", color: "var(--muted)",
                            fontSize: "1.4rem", cursor: "pointer", lineHeight: 1 }}>
                    ✕
                </button>
            </div>

            {(["realName", "city", "country"] as const).map((field) => (
                <div key={field} className="form-group">
                    <label>{t(`profile.edit.${field}`)}</label>
                    <input
                        className="form-input"
                        type="text"
                        maxLength={60}
                        value={form[field]}
                        onChange={e => onChange(field, e.target.value)}
                        placeholder={t(`profile.edit.${field}.placeholder`)}
                    />
                </div>
            ))}

            <div className="form-group">
                <label>{t("profile.edit.bio")}</label>
                <textarea
                    className="form-input"
                    rows={3}
                    maxLength={280}
                    value={form.bio}
                    onChange={e => onChange("bio", e.target.value)}
                    placeholder={t("profile.edit.bio.placeholder")}
                    style={{ resize: "vertical", fontFamily: "inherit" }}
                />
            </div>

            <div className="form-group">
                <label>{t("profile.edit.preferredLanguage")}</label>
                <select
                    className="form-input"
                    value={form.preferredLanguage}
                    onChange={e => onChange("preferredLanguage", e.target.value)}
                >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                </select>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" className="btn btn--ghost" onClick={onClose}>
                    {t("profile.edit.cancel")}
                </button>
                <button type="button" className="btn btn--primary"
                        onClick={onSave} disabled={saving}>
                    {saving ? t("profile.edit.saving") : t("profile.edit.save")}
                </button>
            </div>
        </div>
    </div>
);

// ── FriendRequestsCard — only visible to the profile owner ───────────────────
// Shows pending requests with an Accept button for each.

type FriendRequestsCardProps = {
    requests: string[];
    token: string;
    onAccepted: () => void;
    t: (key: string) => string;
};

const FriendRequestsCard: React.FC<FriendRequestsCardProps> = ({ requests, token, onAccepted, t }) => {
    // Track per-username accepting state to give individual feedback
    const [accepting, setAccepting] = useState<Record<string, boolean>>({});
    const [errors,    setErrors]    = useState<Record<string, string>>({});

    const handleAccept = async (senderUsername: string) => {
        setAccepting(prev => ({ ...prev, [senderUsername]: true }));
        setErrors(prev => ({ ...prev, [senderUsername]: "" }));
        try {
            const res  = await fetch(`/api/friends/accept/${senderUsername}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok && data.success) {
                onAccepted(); // re-fetch profile to update both arrays
            } else {
                setErrors(prev => ({ ...prev, [senderUsername]: data.error ?? t("profile.friends.acceptError") }));
            }
        } catch {
            setErrors(prev => ({ ...prev, [senderUsername]: t("profile.friends.acceptError") }));
        } finally {
            setAccepting(prev => ({ ...prev, [senderUsername]: false }));
        }
    };

    if (requests.length === 0) {
        return (
            <div className="card">
                <h2 className="card__title">📨 {t("profile.friendRequests.title")}</h2>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>
                    {t("profile.friendRequests.empty")}
                </p>
            </div>
        );
    }

    return (
        <div className="card">
            <h2 className="card__title">
                📨 {t("profile.friendRequests.title")}
                <span style={{
                    marginLeft: 8, background: "var(--aqua)", color: "#fff",
                    borderRadius: 999, padding: "2px 9px", fontSize: "0.75rem", fontWeight: 900,
                }}>
                    {requests.length}
                </span>
            </h2>

            <div style={{
                display: "flex", flexDirection: "column", gap: 8,
                maxHeight: 220, overflowY: "auto",
                paddingRight: 4,
            }}>
                {requests.map(sender => (
                    <div key={sender} style={{
                        display: "flex", alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px", borderRadius: "var(--r)",
                        border: "1px solid var(--stroke)", background: "var(--bg)",
                        gap: 10,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                                background: "linear-gradient(135deg, var(--aqua), var(--navy))",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "0.8rem", fontWeight: 900, color: "#fff",
                            }}>
                                {sender.slice(0, 2).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{sender}</span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                            <button
                                type="button"
                                className="btn btn--primary"
                                style={{ fontSize: "0.78rem", padding: "5px 14px" }}
                                onClick={() => handleAccept(sender)}
                                disabled={accepting[sender]}
                            >
                                {accepting[sender] ? "..." : `✔ ${t("profile.friendRequests.accept")}`}
                            </button>
                            {errors[sender] && (
                                <span style={{ fontSize: "0.72rem", color: "var(--danger)" }}>
                                    {errors[sender]}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ── FriendsListCard ───────────────────────────────────────────────────────────
// Scrollable list of accepted friends, visible to the profile owner only.

type FriendsListCardProps = {
    friends: string[];
    onViewProfile: (username: string) => void;
    t: (key: string) => string;
};

const FriendsListCard: React.FC<FriendsListCardProps> = ({ friends, onViewProfile, t }) => (
    <div className="card">
        <h2 className="card__title">
            👥 {t("profile.friends.title")}
            <span style={{
                marginLeft: 8, background: "var(--panel)", color: "var(--muted)",
                borderRadius: 999, padding: "2px 9px", fontSize: "0.75rem", fontWeight: 900,
                border: "1px solid var(--stroke)",
            }}>
                {friends.length}
            </span>
        </h2>

        {friends.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>
                {t("profile.friends.empty")}
            </p>
        ) : (
            // Fixed-height scrollable area so the card doesn't grow unboundedly
            <div style={{
                display: "flex", flexDirection: "column", gap: 8,
                maxHeight: 240, overflowY: "auto",
                paddingRight: 4,
            }}>
                {friends.map(friend => (
                    <div key={friend} style={{
                        display: "flex", alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px", borderRadius: "var(--r)",
                        border: "1px solid var(--stroke)", background: "var(--bg)",
                        gap: 10, cursor: "pointer",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                                width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                                background: "linear-gradient(135deg, var(--aqua), var(--navy))",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "0.78rem", fontWeight: 900, color: "#fff",
                            }}>
                                {friend.slice(0, 2).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{friend}</span>
                        </div>

                        <button
                            type="button"
                            className="btn btn--ghost"
                            style={{ fontSize: "0.78rem", padding: "4px 12px" }}
                            onClick={() => onViewProfile(friend)}
                        >
                            {t("social.viewProfile")}
                        </button>
                    </div>
                ))}
            </div>
        )}
    </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const UserProfile: React.FC = () => {
    const { username: profileUsername } = useParams<{ username: string }>();
    const navigate = useNavigate();
    const { t }    = useI18n();

    const currentUser = useMemo(() => localStorage.getItem("username"), []);
    const token       = useMemo(() => localStorage.getItem("token") ?? "", []);
    const isOwner     = currentUser === profileUsername;

    const [profile,  setProfile]  = useState<ProfileData | null>(null);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState<string | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [saving,   setSaving]   = useState(false);
    const [editForm, setEditForm] = useState<EditForm>({
        realName: "", bio: "", city: "", country: "", preferredLanguage: "en"
    });

    // State for the "Send friend request" button on other users' profiles
    const [frStatus, setFrStatus] = useState<FriendRequestStatus>("idle");

    const fetchProfile = async () => {
        if (!profileUsername) return;
        setLoading(true);
        setError(null);
        try {
            const res  = await fetch(`/api/profile/${profileUsername}`);
            const data = await res.json();
            if (data.success) {
                setProfile(data.profile);
            } else {
                setError(data.error ?? t("profile.error.generic"));
            }
        } catch {
            setError(t("profile.error.network"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProfile(); }, [profileUsername, t]);

    const openEdit = () => {
        if (!profile) return;
        setEditForm({
            realName:          profile.realName ?? "",
            bio:               profile.bio ?? "",
            city:              profile.location?.city ?? "",
            country:           profile.location?.country ?? "",
            preferredLanguage: profile.preferredLanguage ?? "en",
        });
        setEditOpen(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/profile/${profileUsername}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(editForm),
            });
            const data = await res.json();
            if (data.success) {
                setEditOpen(false);
                await fetchProfile();
            } else {
                setError(data.error ?? t("profile.error.generic"));
            }
        } catch {
            setError(t("profile.error.network"));
        } finally {
            setSaving(false);
        }
    };

    const handleSendFriendRequest = async () => {
        if (!token || !profileUsername) return;
        setFrStatus("sending");
        try {
            const res  = await fetch(`/api/friends/request/${profileUsername}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setFrStatus("sent");
            } else if (res.status === 409) {
                setFrStatus("already");
            } else {
                setFrStatus("error");
            }
        } catch {
            setFrStatus("error");
        }
    };

    const logout = () => {
        localStorage.removeItem("username");
        localStorage.removeItem("token");
        navigate("/", { replace: true });
    };

    // ── Loading / error states ────────────────────────────────────────────────

    if (loading) return (
        <div className="page">
            <Navbar username={currentUser} onLogout={logout} />
            <main className="container" style={{ textAlign: "center", paddingTop: 60 }}>
                <p style={{ color: "var(--muted)" }}>{t("stats.loading")}</p>
            </main>
        </div>
    );

    if (error || !profile) return (
        <div className="page">
            <Navbar username={currentUser} onLogout={logout} />
            <main className="container" style={{ textAlign: "center", paddingTop: 60 }}>
                <p style={{ color: "var(--danger)", fontWeight: 800 }}>
                    {error ?? t("profile.error.generic")}
                </p>
                <button type="button" className="btn btn--primary"
                        onClick={() => navigate(-1)} style={{ marginTop: 16 }}>
                    {t("instructions.back")}
                </button>
            </main>
        </div>
    );

    const { city, country } = profile.location ?? {};
    const locationStr = [city, country].filter(Boolean).join(", ");

    // Derive whether current user already has a friend relationship with this profile
    const alreadyFriends = profile.friends.includes(currentUser ?? "");

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="page">
            {editOpen && (
                <EditModal
                    form={editForm}
                    saving={saving}
                    onChange={(field, value) =>
                        setEditForm(prev => ({ ...prev, [field]: value }))}
                    onSave={handleSave}
                    onClose={() => setEditOpen(false)}
                    t={t}
                />
            )}

            <Navbar username={currentUser} onLogout={logout} />

            <main className="container" style={{ paddingTop: 40 }}>
                <div style={{ maxWidth: 720, margin: "0 auto",
                    display: "flex", flexDirection: "column", gap: 14 }}>

                    {/* ── Header card ──────────────────────────────────────── */}
                    <div className="card" style={{ position: "relative", textAlign: "center" }}>

                        {/* Edit button — owner only */}
                        {isOwner && (
                            <button type="button" onClick={openEdit}
                                    className="navbtn"
                                    style={{ position: "absolute", top: 14, right: 14,
                                        fontSize: "0.82rem" }}>
                                ✏️ {t("profile.edit.button")}
                            </button>
                        )}

                        <Avatar username={profile.username} />

                        <h1 style={{ margin: "0 0 2px", fontSize: "1.6rem" }}>
                            {profile.username}
                        </h1>

                        {profile.realName && (
                            <p style={{ margin: "0 0 4px", color: "var(--muted)",
                                fontSize: "1rem", fontWeight: 600 }}>
                                {profile.realName}
                            </p>
                        )}

                        {profile.bio && (
                            <p style={{ margin: "8px auto 6px", maxWidth: 420,
                                color: "var(--muted)", fontSize: "0.9rem",
                                fontStyle: "italic" }}>
                                "{profile.bio}"
                            </p>
                        )}

                        <div style={{ display: "flex", gap: 12, justifyContent: "center",
                            flexWrap: "wrap", marginTop: 8 }}>
                            {locationStr && (
                                <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                                    📍 {locationStr}
                                </span>
                            )}
                            <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                                🌐 {profile.preferredLanguage === "es" ? "Español" : "English"}
                            </span>
                            <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                                📅 {t("profile.joinDate")}{" "}
                                {new Date(profile.joinDate).toLocaleDateString()}
                            </span>
                        </div>

                        {/* Send friend request — visible only when visiting another user's profile */}
                        {!isOwner && (
                            <div style={{ marginTop: 16 }}>
                                {alreadyFriends || frStatus === "already" ? (
                                    <span style={{
                                        display: "inline-block", padding: "6px 18px",
                                        borderRadius: 999, fontSize: "0.85rem", fontWeight: 700,
                                        background: "rgba(32,201,151,.15)", color: "var(--ok)",
                                        border: "1px solid var(--ok)",
                                    }}>
                                        ✔ {t("profile.friends.alreadyFriends")}
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        className="btn btn--primary"
                                        style={{ fontSize: "0.88rem" }}
                                        onClick={handleSendFriendRequest}
                                        disabled={frStatus === "sending" || frStatus === "sent"}
                                    >
                                        {frStatus === "idle"    && `➕ ${t("profile.friends.sendRequest")}`}
                                        {frStatus === "sending" && "..."}
                                        {frStatus === "sent"    && `✔ ${t("profile.friends.requestSent")}`}
                                        {frStatus === "error"   && `⚠ ${t("profile.friends.requestError")}`}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Friend requests card — owner only ────────────────── */}
                    {isOwner && (
                        <FriendRequestsCard
                            requests={profile.friendRequests}
                            token={token}
                            onAccepted={fetchProfile}
                            t={t}
                        />
                    )}

                    {/* ── Friends list card — owner only ───────────────────── */}
                    {isOwner && (
                        <FriendsListCard
                            friends={profile.friends}
                            onViewProfile={(u) => navigate(`/profile/${u}`)}
                            t={t}
                        />
                    )}

                    {/* ── Stats cards ──────────────────────────────────────── */}
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {[
                            { label: t("stats.totalGames"), value: profile.stats.totalGames, color: "var(--aqua)"    },
                            { label: t("stats.wins"),       value: profile.stats.wins,        color: "var(--ok)"     },
                            { label: t("stats.losses"),     value: profile.stats.losses,      color: "var(--danger)" },
                            { label: t("stats.winRate"),    value: `${profile.stats.winRate}%`, color: "var(--amber)" },
                        ].map(({ label, value, color }) => (
                            <div key={label} style={{
                                flex: "1 1 130px", border: "1px solid var(--stroke)",
                                background: "var(--panel)", borderRadius: "var(--r)",
                                padding: "18px", textAlign: "center", boxShadow: "var(--shadow)",
                            }}>
                                <p style={{ margin: "0 0 6px",
                                    fontSize: "clamp(28px,4vw,40px)", fontWeight: 900, color }}>
                                    {value}
                                </p>
                                <p style={{ margin: 0, color: "var(--muted)",
                                    fontWeight: 700, fontSize: "0.88rem" }}>
                                    {label}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* ── Recent matches ───────────────────────────────────── */}
                    {profile.recentMatches.length > 0 && (
                        <div className="card" style={{ overflowX: "auto" }}>
                            <h2 className="card__title">{t("stats.lastFive")}</h2>
                            <table style={{ width: "100%", borderCollapse: "collapse",
                                marginTop: 10, fontSize: "0.9rem" }}>
                                <thead>
                                <tr style={{ borderBottom: "1px solid var(--stroke)",
                                    color: "var(--muted)", fontSize: "0.8rem" }}>
                                    <th style={{ padding: "8px", textAlign: "left" }}>{t("stats.opponent")}</th>
                                    <th style={{ padding: "8px", textAlign: "center" }}>{t("stats.result")}</th>
                                    <th style={{ padding: "8px", textAlign: "center" }}>{t("stats.board")}</th>
                                    <th style={{ padding: "8px", textAlign: "right" }}>{t("stats.date")}</th>
                                </tr>
                                </thead>
                                <tbody>
                                {profile.recentMatches.map((match) => (
                                    <tr key={`${match.opponent}-${match.date}`}
                                        style={{ borderBottom: "1px solid var(--stroke)" }}>
                                        <td style={{ padding: "10px 8px", fontWeight: 700 }}>
                                            {match.opponent}
                                        </td>
                                        <td style={{ padding: "10px 8px", textAlign: "center" }}>
                                            <span style={{
                                                padding: "3px 10px", borderRadius: 999,
                                                fontWeight: 900, fontSize: "0.82rem",
                                                background: match.result === "win"
                                                    ? "rgba(32,201,151,.18)" : "rgba(255,77,77,.18)",
                                                color: match.result === "win"
                                                    ? "var(--ok)" : "var(--danger)",
                                            }}>
                                                {match.result === "win" ? t("stats.win") : t("stats.loss")}
                                            </span>
                                        </td>
                                        <td style={{ padding: "10px 8px", textAlign: "center",
                                            color: "var(--muted)", fontSize: "0.85rem" }}>
                                            {match.boardSize}×{match.boardSize}
                                        </td>
                                        <td style={{ padding: "10px 8px", textAlign: "right",
                                            color: "var(--muted)", fontSize: "0.82rem" }}>
                                            {new Date(match.date).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "center", paddingTop: 6 }}>
                        <button type="button" className="btn btn--primary"
                                onClick={() => navigate(-1)}>
                            {t("instructions.back")}
                        </button>
                    </div>

                </div>
            </main>
        </div>
    );
};

export default UserProfile;