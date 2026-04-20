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
};

type EditForm = {
    realName: string;
    bio: string;
    city: string;
    country: string;
    preferredLanguage: string;
};

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
        <div className="modal-card" style={{ width: "100%", maxWidth: 480, display: "flex",
            flexDirection: "column", gap: 14 }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: "1.2rem" }}>{t("profile.edit.title")}</h2>
                <button type="button" onClick={onClose}
                        style={{ background: "none", border: "none", color: "var(--muted)",
                            fontSize: "1.4rem", cursor: "pointer", lineHeight: 1 }}>
                    ✕
                </button>
            </div>

            {/* Text inputs */}
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

            {/* Bio — textarea separate from the map to avoid type narrowing issues */}
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

// ── Main component ────────────────────────────────────────────────────────────

const UserProfile: React.FC = () => {
    const { username: profileUsername } = useParams<{ username: string }>();
    const navigate = useNavigate();
    const { t } = useI18n();

    const currentUser = useMemo(() => localStorage.getItem("username"), []);
    const token       = useMemo(() => localStorage.getItem("token") ?? "", []);
    const isOwner     = currentUser === profileUsername;

    const [profile,    setProfile]    = useState<ProfileData | null>(null);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState<string | null>(null);
    const [editOpen,   setEditOpen]   = useState(false);
    const [saving,     setSaving]     = useState(false);
    const [editForm,   setEditForm]   = useState<EditForm>({
        realName: "", bio: "", city: "", country: "", preferredLanguage: "en"
    });

    const fetchProfile = async () => {
        if (!profileUsername) return;
        setLoading(true);
        setError(null);
        try {
            const res  = await fetch(`/api/profile/${profileUsername}`);
            const data = await res.json();
            if (!data.success) setError(data.error ?? t("profile.error.generic"));
            else setProfile(data.profile);
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

    const logout = () => {
        localStorage.removeItem("username");
        localStorage.removeItem("token");
        navigate("/", { replace: true });
    };

    // ── Loading / error states ─────────────────────────────────────────────────

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

    // ── Render ─────────────────────────────────────────────────────────────────

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

                    {/* ── Header card ─────────────────────────────────────── */}
                    <div className="card" style={{ position: "relative", textAlign: "center" }}>

                        {/* Edit button — only visible to the profile owner */}
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
                    </div>

                    {/* ── Friends placeholder ─────────────────────────────── */}
                    <div className="card" style={{ opacity: 0.5, textAlign: "center",
                        border: "1px dashed var(--stroke)" }}>
                        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
                            👥 {t("profile.friends.placeholder")}
                        </p>
                    </div>

                    {/* ── Stats cards ─────────────────────────────────────── */}
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {[
                            { label: t("stats.totalGames"), value: profile.stats.totalGames, color: "var(--aqua)"   },
                            { label: t("stats.wins"),       value: profile.stats.wins,        color: "var(--ok)"    },
                            { label: t("stats.losses"),     value: profile.stats.losses,      color: "var(--danger)"},
                            { label: t("stats.winRate"),    value: `${profile.stats.winRate}%`, color: "var(--amber)"},
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

                    {/* ── Recent matches ──────────────────────────────────── */}
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
                                {profile.recentMatches.map((match, i) => (
                                    <tr key={i} style={{ borderBottom: "1px solid var(--stroke)" }}>
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