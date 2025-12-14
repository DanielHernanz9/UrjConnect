/** =========================
 *  Forum Page Client-Side Logic
 *  ========================= */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const PRESET_COLORS = ["#6366f1", "#06b6d4", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6", "#0ea5e9", "#14b8a6"];
const CALENDAR_MAX_YEAR = 2035;

const store = {
    getSession() {
        try {
            return JSON.parse(sessionStorage.getItem("session") || "null");
        } catch {
            return null;
        }
    },

    // Permite string (JSON) u objeto
    setSession(user) {
        const payload = typeof user === "string" ? user : JSON.stringify(user || null);
        sessionStorage.setItem("session", payload);
    },
    clearSession() {
        sessionStorage.removeItem("session");
    },
    setTheme(theme) {
        localStorage.setItem("theme", theme);
    },
    getTheme() {
        return localStorage.getItem("theme") || "dark";
    },
    getColor() {
        return this.getSession()?.color || "#6366f1";
    },
};

function createUnreadTracker() {
    const KEY_PREFIX = "urjconnect:reads:";
    const sanitizeEmail = (email) =>
        String(email || "")
            .trim()
            .toLowerCase();
    const sanitizeSubject = (subjectId) => String(subjectId || "").trim();

    const parseState = (raw) => {
        if (!raw) return {};
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (e) {
            return {};
        }
    };

    const readState = (email) => {
        const keyEmail = sanitizeEmail(email);
        if (!keyEmail) return {};
        try {
            const raw = localStorage.getItem(KEY_PREFIX + keyEmail);
            return parseState(raw);
        } catch (e) {
            return {};
        }
    };

    const writeState = (email, state) => {
        const keyEmail = sanitizeEmail(email);
        if (!keyEmail) return;
        try {
            localStorage.setItem(KEY_PREFIX + keyEmail, JSON.stringify(state || {}));
        } catch (e) {}
    };

    const normalizeIso = (value) => {
        const ts = Date.parse(value);
        return Number.isNaN(ts) ? null : new Date(ts).toISOString();
    };

    return {
        markRead(email, subjectId, stats = {}) {
            const keySubject = sanitizeSubject(subjectId);
            const keyEmail = sanitizeEmail(email);
            if (!keySubject || !keyEmail) return;
            const state = readState(keyEmail);
            const total = Number(stats?.totalMessages ?? 0);
            const normalizedTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
            const nowIso = new Date().toISOString();
            const lastActivityIso = normalizeIso(stats?.lastMessageAt) || nowIso;
            state[keySubject] = {
                lastTotal: normalizedTotal,
                lastSeenAt: lastActivityIso,
                lastMarkedAt: nowIso,
            };
            writeState(keyEmail, state);
        },
    };
}

const unreadTracker = (typeof window !== "undefined" && window.__unreadTracker) || createUnreadTracker();
if (typeof window !== "undefined") {
    window.__unreadTracker = unreadTracker;
}

const toast = (msg) => {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2000);
};

const initialsOf = (name = "?") =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() || "")
        .join("") || "UX";

// Verificar si un usuario es profesor de una asignatura o admin global
const isSubjectAdmin = (user, subject) => {
    if (!user) return false;
    // Admin global siempre tiene permisos
    if (user.role === "admin") return true;
    // Verificar si es profesor
    if (!subject) return false;
    const professors = subject.professors || subject.professor;
    if (Array.isArray(professors)) {
        return professors.includes(user.email);
    }
    if (typeof professors === "string") {
        return professors === user.email;
    }
    return false;
};

/** =========================
 *  Forum App
 *  ========================= */
const forumApp = {
    el: {
        profileBtn: $("#profileButton"),
        profileMenu: $("#profileMenu"),
        avatar: $("#avatar"),
        avatarInitials: $("#avatarInitials"),
        profileName: $("#profileName"),
        btnEditProfile: $("#btnEditProfile"),
        btnLogout: $("#btnLogout"),
        themeToggle: $("#themeToggle"),
        profileModal: $("#profileModal"),
        p_name: $("#p_name"),
        p_bio: $("#p_bio"),
        p_color: $("#p_color"),
        p_swatches: $("#p_swatches"),
        saveProfile: $("#saveProfile"),
        postsContainer: $("#postsContainer"),
        newMessageForm: $("#newMessageForm"),
        deleteForumForm: $("#deleteForumForm"),
        calendarCard: $("#calendarCard"),
        calendarMonthLabel: $("#calendarMonthLabel"),
        calendarDays: $("#calendarDays"),
        calendarSelectedLabel: $("#calendarSelectedLabel"),
        calendarEventList: $("#calendarEventList"),
        calendarPrev: $("#calendarPrev"),
        calendarNext: $("#calendarNext"),
        calendarAddForm: $("#calendarAddForm"),
        calendarEventDate: $("#calendarEventDate"),
        calendarEventDay: $("#calendarEventDay"),
        calendarEventMonth: $("#calendarEventMonth"),
        calendarEventYear: $("#calendarEventYear"),
        calendarEventTitle: $("#calendarEventTitle"),
        calendarEventDescription: $("#calendarEventDescription"),
        calendarDetail: $("#calendarDetail"),
        calendarAddWrapper: $("#calendarAddWrapper"),
    },
    user: null,
    subject: null,
    calendarData: null,
    calendarState: null,
    calendarEventsByDate: new Map(),
    calendarEvents: [],
    isCalendarAdmin: false,
    _calendarYearRange: null,
    _datePickerSyncing: false,

    // Muestra el hint de "Aún no hay mensajes" si no queda ningún post renderizado
    updateEmptyHint() {
        try {
            const container = this.el.postsContainer;
            if (!container) return;
            const hasPosts = container.querySelectorAll && container.querySelectorAll(".post").length > 0;
            if (!hasPosts) {
                container.innerHTML = `
                    <div class="hint" style="padding: 24px; text-align: center">
                        <p style="margin: 0">Aún no hay mensajes en este foro.</p>
                        <p style="margin: 8px 0 0; font-size: 13px">¡Sé el primero en publicar algo!</p>
                    </div>
                `;
            }
        } catch (e) {}
    },

    initCalendarState() {
        const today = new Date();
        const todayStr = this.formatDate(today);
        this.calendarState = {
            year: today.getFullYear(),
            month: today.getMonth(),
            selectedDate: null,
            today: todayStr,
        };
        this.clampCalendarStateToLimit();
    },

    init() {
        this.user = store.getSession();
        if (!this.user) {
            window.location.href = "/";
            return;
        }

        // Aplicar tema
        document.documentElement.setAttribute("data-theme", store.getTheme());

        // Header info
        this.el.profileName.textContent = this.user.name || "Tu Nombre";
        this.el.avatar.style.background = store.getColor();
        this.el.avatarInitials.textContent = initialsOf(this.user.name || this.user.email);

        this.initCalendarState();
        this.setupCalendarDatePicker();
        this.bindCalendarControls();

        // Elementos del modal de respuesta
        this.el.replyModal = $("#replyModal");
        this.el.replyForm = $("#replyForm");
        this.el.replyMessageId = $("#replyMessageId");
        this.el.replyToUser = $("#replyToUser");
        this.el.replyToId = $("#replyToId");
        this.el.replyContent = $("#replyContent");
        this.el.replyToHint = $("#replyToHint");

        // Cargar información del foro
        this.loadForumData();

        // Wire events
        this.wire();
    },

    bindCalendarControls() {
        if (this._calendarBound) return;
        this._calendarBound = true;

        this.el.calendarPrev?.addEventListener("click", () => {
            this.shiftCalendar(-1);
        });

        this.el.calendarNext?.addEventListener("click", () => {
            this.shiftCalendar(1);
        });

        this.el.calendarDays?.addEventListener("click", (ev) => {
            const target = ev.target;
            const btn = target && target.closest ? target.closest(".calendar-day") : null;
            if (!btn || btn.classList.contains("calendar-day--placeholder")) return;
            const date = btn.dataset.date;
            if (date) {
                this.selectCalendarDate(date);
            }
        });

        if (this.el.calendarAddForm) {
            this.el.calendarAddForm.addEventListener("submit", (ev) => this.handleCalendarSubmit(ev));
        }

        this.el.calendarEventList?.addEventListener("click", (ev) => {
            const target = ev.target;
            const btn = target && target.closest ? target.closest(".calendar-event-delete") : null;
            if (!btn) return;
            const eventId = btn.dataset.eventId;
            if (!eventId) return;
            if (!confirm("¿Eliminar este evento del calendario?")) return;
            this.handleCalendarDelete(eventId);
        });
    },

    async fetchAndRenderReports() {
        try {
            // Cargar sólo reportes del foro actual
            const currentSubjectId = this.subject?.id;
            if (!currentSubjectId) {
                toast("Foro no cargado");
                return;
            }

            let reports = [];
            let usedSubjectEndpoint = false;
            const debugPayload = { bySubject: null, allReports: null };
            // Preferir endpoint filtrado por asignatura si existe
            try {
                const urlBySubject = `/api/subjects/${encodeURIComponent(currentSubjectId)}/reports`;
                const resBySubject = await fetch(urlBySubject);
                if (resBySubject.ok) {
                    const json = await resBySubject.json();
                    debugPayload.bySubject = json;
                    reports = json;
                    usedSubjectEndpoint = true;
                } else {
                }
            } catch (e) {
                console.error && console.error("fetchAndRenderReports: error fetching subject reports", e);
            }
            if (!usedSubjectEndpoint) {
                try {
                    const urlAll = "/api/reports";
                    const res = await fetch(urlAll);
                    if (!res.ok) throw new Error("No se pudieron cargar los reportes");
                    const allReports = await res.json();
                    debugPayload.allReports = allReports;
                    reports = (allReports || []).filter((r) => {
                        const sid = r.subjectId || (r.message && r.message.subjectId);
                        return String(sid) === String(currentSubjectId);
                    });
                } catch (e) {
                    console.error && console.error("fetchAndRenderReports: error fetching all reports", e);
                    throw e;
                }
            }
            const list = $("#reportsList");
            if (!list) return;
            list.innerHTML = "";
            const debugMode = location.search && location.search.indexOf("debugReports=1") !== -1;
            if (!reports || reports.length === 0) {
                if (debugMode) {
                    list.innerHTML = `<div style="padding:12px"><strong>Debug payload (subject endpoint):</strong><pre style="white-space:pre-wrap;max-height:360px;overflow:auto">${this.escapeHtml(JSON.stringify(debugPayload, null, 2))}</pre></div>`;
                    return;
                }
                list.innerHTML = `
                    <div class="hint" style="padding: 24px; text-align: center">
                        <p style="margin: 0; font-weight: 700">No hay reportes de este foro</p>
                        <p style="margin: 8px 0 0; font-size: 13px; color: var(--muted)">Este modal solo muestra reportes del foro actual.</p>
                    </div>
                `;
                return;
            }

            // Agrupar reportes por messageId para mostrar un único bloque por mensaje con contador
            const groups = new Map();
            reports.forEach((r) => {
                const mid = String(r.messageId || "");
                if (!mid) return;
                const key = r.replyId ? `reply:${mid}:${r.replyId}` : `msg:${mid}`;
                const subjectId = r.subjectId || (r.message && r.message.subjectId) || null;
                const base = r.reply ? { kind: "reply", message: r.message || null, reply: r.reply, subjectId } : { kind: "message", message: r.message || null, reply: null, subjectId };
                const g = groups.get(key) || { ...base, reports: [] };
                g.reports.push(r);
                groups.set(key, g);
            });

            // Sincronizar badges y estado en la vista principal (si está cargada)
            try {
                this.syncReportBadges && this.syncReportBadges(groups);
            } catch (e) {
                // noop
            }

            // Renderizar cada grupo (diseño moderno con meta, título, snippet y badge de contador)
            Array.from(groups.entries()).forEach(([key, g]) => {
                const count = g.reports.length;
                const first = g.reports[0];
                const msg = g.message;
                if (!msg) return; // si el mensaje fue borrado, omitir
                const isReply = g.kind === "reply" && g.reply;
                const title = isReply ? `Respuesta de ${this.escapeHtml(g.reply.userName || g.reply.userEmail || "Desconocido")}` : msg.title || "(sin título)";
                const rawSnippet = isReply ? g.reply.content : msg.content;
                const snippet = rawSnippet ? (rawSnippet.length > 220 ? rawSnippet.slice(0, 220) + "…" : rawSnippet) : "";

                // deduplicar reportantes
                const rmap = new Map();
                g.reports.forEach((r) => {
                    const k = (r.reporterEmail || r.reporterName || Math.random()).toString().toLowerCase();
                    if (!rmap.has(k)) rmap.set(k, r);
                });
                const uniq = Array.from(rmap.values());
                const dedupCount = uniq.length;
                const countLabel = dedupCount === 1 ? `${dedupCount} reporte` : `${dedupCount} reportes`;

                const item = document.createElement("div");
                item.className = "report-card";
                item.innerHTML = `
                    <div class="report-card-grid">
                        <div class="report-card-main">
                            <div class="report-card-meta">Mensaje enviado por: <strong>${this.escapeHtml(msg.userName || msg.userEmail || "Desconocido")}</strong><br><small>Último reporte: ${new Date(first.timestamp).toLocaleString()}</small></div>
                            <div class="report-card-title">${title}</div>
                            <div class="report-card-snippet">${this.escapeHtml(snippet)}</div>
                            <div class="report-actions-row" style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                                <div style="flex:1; display:flex; gap:8px; align-items:center;">
                                    <span class="report-count-badge" aria-hidden="false" title="${this.escapeHtml(countLabel)}"><span class="count">${dedupCount}</span>&nbsp;${this.escapeHtml(dedupCount === 1 ? "reporte" : "reportes")}</span>
                                </div>
                                <div style="display:flex; gap:8px;">
                                    <button class="btn report-action-context" data-kind="${g.kind}" data-message-id="${msg.id}" data-reply-id="${isReply ? g.reply.id : ""}" data-subject-id="${g.subjectId}" title="Ir al contexto">Contexto</button>
                                    ${dedupCount > 1 ? `<button class="btn secondary report-action-view-reporters" data-key="${key}" title="Ver reportantes">Ver reportantes</button>` : ""}
                                    ${
                                        isReply
                                            ? `<button class="btn secondary report-action-ignore-reply" data-message-id="${msg.id}" data-reply-id="${g.reply.id}" title="Marcar como revisado">Dejar</button>`
                                            : `<button class="btn secondary report-action-ignore" data-message-id="${msg.id}" title="Marcar como revisado">Dejar</button>`
                                    }
                                    ${
                                        this.user && isSubjectAdmin(this.user, this.subject)
                                            ? `<button class="btn ban report-action-ban" data-message-id="${msg.id}" data-reply-id="${isReply ? this.escapeHtml(g.reply.id) : ""}" data-user-email="${this.escapeHtml(
                                                  msg.userEmail || ""
                                              )}" title="Banear usuario">Banear</button>`
                                            : ``
                                    }
                                    ${
                                        isReply
                                            ? `<button class="btn report-action-delete-reply" data-message-id="${msg.id}" data-reply-id="${g.reply.id}" title="Borrar respuesta">Borrar</button>`
                                            : `<button class="btn report-action-delete" data-message-id="${msg.id}" title="Borrar mensaje">Borrar</button>`
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="reporters-list" data-key="${key}" style="display:none; margin-top:10px; padding:10px; border-radius:8px; background:var(--bg-2); border:1px solid var(--border); max-height:260px; overflow:auto; font-size:13px; color:var(--muted);"></div>
                `;
                list.appendChild(item);
            });

            // Delegación para botones dentro de la lista (operan sobre messageId para grupos)
            list.querySelectorAll(".report-action-context, .report-action-delete, .report-action-ignore, .report-action-view-reporters, .report-action-delete-reply, .report-action-ignore-reply, .report-action-ban").forEach((btn) => {
                btn.addEventListener("click", (e) => {
                    const b = e.currentTarget;
                    if (b.classList.contains("report-action-context")) {
                        const messageId = b.dataset.messageId;
                        const replyId = b.dataset.replyId;
                        const subjectId = b.dataset.subjectId;
                        if (!subjectId || !messageId) return toast("Contexto no disponible");

                        // Si el reporte pertenece a la asignatura actual, evita recargar y navega en la misma página
                        if (this.subject && String(subjectId) === String(this.subject.id)) {
                            this.closeModal("#reportsModal");
                            // Actualiza el hash y aplica el contexto inmediatamente
                            const hash = replyId ? `#reply-${encodeURIComponent(replyId)}` : `#msg-${encodeURIComponent(messageId)}`;
                            try {
                                window.location.hash = hash;
                                // Ejecutar después de actualizar el hash para expandir/enfocar
                                setTimeout(() => {
                                    this.applyHashContext && this.applyHashContext();
                                }, 0);
                            } catch (e) {
                                // Fallback: si algo falla, recarga como antes
                                window.location.href = `/subject/${encodeURIComponent(subjectId)}/forum${hash}`;
                            }
                        } else {
                            // Si es otra asignatura, navegar (recargar) a su foro correspondiente
                            this.closeModal("#reportsModal");
                            const hash = replyId ? `#reply-${encodeURIComponent(replyId)}` : `#msg-${encodeURIComponent(messageId)}`;
                            window.location.href = `/subject/${encodeURIComponent(subjectId)}/forum${hash}`;
                        }
                    } else if (b.classList.contains("report-action-view-reporters")) {
                        const key = b.dataset.key;
                        if (!key) return toast("Grupo no disponible");
                        const itemEl = b.closest(".report-card") || b.closest(".report-item");
                        if (!itemEl) return;
                        const listEl = itemEl.querySelector(`.reporters-list[data-key="${CSS.escape(key)}"]`);
                        const group = groups.get(String(key));
                        if (!group) return toast("No hay reportes para este elemento");
                        if (listEl.style.display === "none") {
                            const rows = group.reports.map((r) => {
                                const name = r.reporterName || r.reporterEmail || "Anon";
                                const when = r.timestamp ? new Date(r.timestamp).toLocaleString() : "";
                                const email = r.reporterEmail ? ` <span style="color:var(--muted);">(${r.reporterEmail})</span>` : "";
                                return `<div style="padding:6px 4px; border-bottom:1px solid var(--chip-border)"><strong>${forumApp.escapeHtml(
                                    name
                                )}</strong>${email} <div style="font-size:12px; color:var(--muted); margin-top:4px">${when}</div></div>`;
                            });
                            listEl.innerHTML = rows.join("") || '<div class="hint">No hay reportantes disponibles</div>';
                            listEl.style.display = "block";
                            b.textContent = "Ocultar reportantes";
                        } else {
                            listEl.style.display = "none";
                            b.textContent = "Ver reportantes";
                        }
                    } else if (b.classList.contains("report-action-ban")) {
                        const userEmail = b.dataset.userEmail;
                        const messageId = b.dataset.messageId;
                        const replyId = b.dataset.replyId;
                        if (!userEmail) return toast("No se puede banear: falta email del usuario");

                        // Mostrar modal personalizado para seleccionar duración
                        this.showBanDurationModal(userEmail, messageId, replyId);
                    } else if (b.classList.contains("report-action-delete")) {
                        const messageId = b.dataset.messageId;
                        if (!messageId) return toast("ID de mensaje no disponible");
                        if (!confirm("¿Borrar este mensaje? Esta acción es irreversible.")) return;
                        fetch(`/api/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" })
                            .then(async (r) => {
                                if (!r.ok) {
                                    const err = await r.json().catch(() => ({}));
                                    return Promise.reject(err || { message: "Error" });
                                }
                                toast("Mensaje borrado");
                                try {
                                    const postEl = document.querySelector(`#msg-${CSS.escape(messageId)}`);
                                    if (postEl) postEl.remove();
                                    // Si ya no quedan mensajes, mostrar el hint sin recargar
                                    this.updateEmptyHint && this.updateEmptyHint();
                                } catch (e) {}
                                await this.fetchAndRenderReports();
                            })
                            .catch((err) => {
                                console.error("Error borrando mensaje desde modal:", err);
                                toast(err && err.error && err.error.message ? err.error.message : "No tienes permisos para borrar este mensaje");
                            });
                    } else if (b.classList.contains("report-action-ignore")) {
                        const messageId = b.dataset.messageId;
                        if (!messageId) return toast("ID de mensaje no disponible");
                        fetch(`/api/reports/resolve-message/${encodeURIComponent(messageId)}`, { method: "POST" })
                            .then(async (r) => {
                                if (!r.ok) {
                                    const err = await r.json().catch(() => ({}));
                                    return Promise.reject(err || { message: "Error" });
                                }
                                toast("Reportes marcados como resueltos");
                                try {
                                    const postEl = document.querySelector(`#msg-${CSS.escape(messageId)}`);
                                    if (postEl) {
                                        const btn = postEl.querySelector(`.btn-report[data-message-id="${messageId}"]`);
                                        if (btn) {
                                            btn.classList.remove("reported");
                                            btn.textContent = "Reportar";
                                            btn.setAttribute("title", "Reportar");
                                        }
                                    }
                                    if (this.reportedSet) this.reportedSet.delete(String(messageId));
                                } catch (e) {}
                                await this.fetchAndRenderReports();
                            })
                            .catch((err) => {
                                console.error("Error marcando reportes como resueltos:", err);
                                toast(err && err.error && err.error.message ? err.error.message : "No tienes permisos para resolver estos reportes");
                            });
                    } else if (b.classList.contains("report-action-delete-reply")) {
                        const mid = b.dataset.messageId;
                        const rid = b.dataset.replyId;
                        if (!mid || !rid) return toast("Faltan IDs");
                        if (!confirm("¿Borrar esta respuesta?")) return;
                        fetch(`/api/messages/${encodeURIComponent(mid)}/reply/${encodeURIComponent(rid)}`, { method: "DELETE" })
                            .then(async (r) => {
                                if (!r.ok) {
                                    const err = await r.json().catch(() => ({}));
                                    return Promise.reject(err || { message: "Error" });
                                }
                                toast("Respuesta borrada");
                                await this.fetchAndRenderReports();
                            })
                            .catch((err) => {
                                console.error("Error borrando respuesta desde modal:", err);
                                toast(err && err.error && err.error.message ? err.error.message : "No tienes permisos para borrar esta respuesta");
                            });
                    } else if (b.classList.contains("report-action-ignore-reply")) {
                        const mid = b.dataset.messageId;
                        const rid = b.dataset.replyId;
                        if (!mid || !rid) return toast("Faltan IDs");
                        fetch(`/api/reports/resolve-reply/${encodeURIComponent(mid)}/${encodeURIComponent(rid)}`, { method: "POST" })
                            .then(async (r) => {
                                if (!r.ok) {
                                    const err = await r.json().catch(() => ({}));
                                    return Promise.reject(err || { message: "Error" });
                                }
                                toast("Reportes de la respuesta marcados como resueltos");
                                try {
                                    const postEl = document.querySelector(`#msg-${CSS.escape(mid)}`);
                                    if (postEl) {
                                        const btns = postEl.querySelectorAll(`.btn-report-reply[data-parent-id="${CSS.escape(mid)}"][data-reply-id="${CSS.escape(rid)}"]`);
                                        btns.forEach((btn) => {
                                            btn.classList.remove("reported");
                                            btn.textContent = "Reportar";
                                            btn.setAttribute("title", "Reportar respuesta");
                                        });
                                    }
                                    if (this.reportedRepliesSet) this.reportedRepliesSet.delete(`${mid}:${rid}`);
                                } catch (e) {}
                                await this.fetchAndRenderReports();
                            })
                            .catch((err) => {
                                console.error("Error marcando reportes de respuesta como resueltos:", err);
                                toast(err && err.error && err.error.message ? err.error.message : "No tienes permisos para resolver estos reportes");
                            });
                    }
                });
            });
        } catch (err) {
            console.error("Error cargando reportes", err);
            toast("No se pudieron cargar los reportes");
        }
    },

    // Sincroniza los badges y el estado 'reported' en la vista principal según los grupos de reportes
    syncReportBadges(groups) {
        try {
            const container = this.el.postsContainer;
            if (!container) return;
            const posts = Array.from(container.querySelectorAll(".post"));
            posts.forEach((post) => {
                const mid = String(post.dataset.messageId || "");
                const btn = post.querySelector(`.btn-report[data-message-id="${mid}"]`);
                if (!btn) return;
                // calcular total de reportes activos asociados al mensaje en todas las claves del Map
                let count = 0;
                groups.forEach((g, key) => {
                    // keys pueden ser 'msg:<mid>' o 'reply:<mid>:<rid>'
                    if (key.startsWith(`msg:${mid}`) || key.startsWith(`reply:${mid}:`)) {
                        count += g && Array.isArray(g.reports) ? g.reports.length : 0;
                    }
                });

                if (count > 0) {
                    // Si hay reportes activos, dejamos el estado 'reported' tal cual (si el usuario lo reportó)
                    // No mostramos contadores en la vista principal por diseño (solo en el modal)
                } else {
                    // quitar estado 'reported' y permitir re-reportar
                    btn.classList.remove("reported");
                    btn.textContent = "Reportar";
                    btn.setAttribute("title", "Reportar");
                    if (this.reportedSet) this.reportedSet.delete(mid);
                }
            });
        } catch (e) {
            // noop
        }
    },

    async loadForumData() {
        // Extraer el ID de la asignatura de la URL
        const match = location.pathname.match(/^\/subject\/([^/]+)\/forum\/?$/);
        if (!match) {
            toast("Error: URL inválida");
            return;
        }

        const subjectId = decodeURIComponent(match[1]);

        try {
            // Cargar datos de la asignatura
            const response = await fetch(`/api/subjects/${subjectId}`);
            if (!response.ok) throw new Error("Error al cargar la asignatura");

            this.subject = await response.json();

            try {
                const subjectColor = this.subject?.color || "var(--accent-2)";
                document.querySelectorAll("[data-subject-color]").forEach((el) => {
                    el.style.background = subjectColor;
                });
            } catch (e) {
                console.error("No se pudo aplicar el color de la asignatura:", e);
            }

            // Mostrar botón de editar asignatura si el usuario es profesor o admin
            const editSubjectBtn = document.getElementById("editSubjectBtn");
            if (editSubjectBtn && isSubjectAdmin(this.user, this.subject)) {
                editSubjectBtn.style.display = "inline-block";
            }

            this.isCalendarAdmin = !!isSubjectAdmin(this.user, this.subject);
            this.toggleCalendarAdminControls();

            let messages = [];
            let calendarData = null;
            let calendarError = false;

            const [rPosts, rCalendar] = await Promise.allSettled([fetch(`/api/subjects/${this.subject.id}/posts`), fetch(`/api/subjects/${this.subject.id}/calendar`)]);

            if (rPosts.status === "fulfilled") {
                const res = rPosts.value;
                if (res.ok) {
                    messages = await res.json();
                } else {
                    console.error("Error HTTP cargando mensajes del foro:", res.status, res.statusText);
                }
            } else {
                console.error("Error cargando mensajes del foro:", rPosts.reason);
            }

            if (rCalendar.status === "fulfilled") {
                const res = rCalendar.value;
                if (res.ok) {
                    calendarData = await res.json();
                } else {
                    calendarError = true;
                    console.error("Error HTTP cargando calendario:", res.status, res.statusText);
                }
            } else {
                calendarError = true;
                console.error("Error cargando calendario:", rCalendar.reason);
            }

            if (!calendarData) {
                calendarData = { subjectId: this.subject.id, events: [] };
            }
            this.applyCalendarData(calendarData);
            if (calendarError) {
                toast("No se pudo cargar el calendario");
            }

            // Cargar reportes del usuario actual para deshabilitar botones ya reportados
            try {
                const rMy = await fetch("/api/reports/my");
                if (rMy.ok) {
                    const myReports = await rMy.json();
                    this.reportedSet = new Set((myReports || []).filter((r) => !r.replyId).map((r) => String(r.messageId)));
                    this.reportedRepliesSet = new Set((myReports || []).filter((r) => r.replyId).map((r) => `${r.messageId}:${r.replyId}`));
                } else {
                    this.reportedSet = new Set();
                    this.reportedRepliesSet = new Set();
                }
            } catch (e) {
                this.reportedSet = new Set();
                this.reportedRepliesSet = new Set();
            }

            this.renderMessages(messages);
            this.syncUnreadWithMessages(messages);

            // Setup de permisos de profesor/admin después de cargar los datos
            this.setupProfessorPermissions();
        } catch (err) {
            console.error("Error cargando datos del foro:", err);
            toast("Error al cargar el foro");
        }
    },

    setupProfessorPermissions() {
        // Solo ejecutar si el usuario es profesor o admin
        if (!this.user || !isSubjectAdmin(this.user, this.subject)) {
            return;
        }

        // Mostrar botón de eliminar foro
        if (this.el.deleteForumForm) {
            this.el.deleteForumForm.style.display = "block";
        }

        // Mostrar y configurar botón de reportes
        const reportsBtn = document.getElementById("reportsBtn");
        if (reportsBtn) {
            reportsBtn.style.display = "inline-flex";
            reportsBtn.removeEventListener("click", this.handleReportsClick);
            reportsBtn.addEventListener("click", async () => {
                this.openModal("#reportsModal");
                await this.fetchAndRenderReports();
            });
        }

        // Mostrar y configurar botón de filtros
        const filtersBtn = document.getElementById("filtersBtn");
        if (filtersBtn) {
            filtersBtn.style.display = "inline-flex";
            filtersBtn.removeEventListener("click", this.handleFiltersClick);
            filtersBtn.addEventListener("click", async () => {
                try {
                    if (!this.subject || !this.subject.id) return toast("Foro no cargado");
                    const res = await fetch(`/api/subjects/${encodeURIComponent(this.subject.id)}/filters`);
                    if (!res.ok) throw new Error("Cargar filtros falló");
                    const data = await res.json();
                    const list = (data.filters || []).join("\n");
                    const ta = document.getElementById("filtersTextarea");
                    if (ta) ta.value = list;
                    this.openModal("#filtersModal");
                } catch (e) {
                    console.error("Error cargando filtros", e);
                    toast("No se pudieron cargar los filtros");
                }
            });
        }

        // Registrar listener del formulario de filtros aquí (se ejecuta después de cargar subject)
        try {
            const filtersForm = document.getElementById("filtersForm");
            const filtersTextarea = document.getElementById("filtersTextarea");
            if (filtersForm) {
                // remover posibles listeners previos para evitar duplicados
                filtersForm.removeEventListener && filtersForm.removeEventListener("submit", this._filtersSubmitHandler);
                this._filtersSubmitHandler = async (ev) => {
                    ev.preventDefault();
                    try {
                        if (!this.subject || !this.subject.id) return toast("Foro no cargado");
                        const raw = (filtersTextarea?.value || "")
                            .split(/\r?\n/)
                            .map((s) => s.trim())
                            .filter(Boolean);
                        const res = await fetch(`/api/subjects/${encodeURIComponent(this.subject.id)}/filters`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ filters: raw }),
                        });
                        if (!res.ok) throw new Error("Guardar filtros falló");
                        toast("Filtros guardados");
                        this.closeModal("#filtersModal");
                    } catch (err) {
                        console.error("Error guardando filtros", err);
                        toast("Error guardando filtros");
                    }
                };
                filtersForm.addEventListener("submit", this._filtersSubmitHandler);
            }
        } catch (e) {
            // noop
        }
    },

    toggleCalendarAdminControls() {
        const isAdmin = !!this.isCalendarAdmin;
        if (this.el.calendarAddForm) {
            this.el.calendarAddForm.style.display = isAdmin ? "grid" : "none";
            this.el.calendarAddForm.setAttribute("aria-hidden", String(!isAdmin));
            const inputs = this.el.calendarAddForm.querySelectorAll("input, textarea, button, select");
            inputs.forEach((el) => {
                if (!el) return;
                if (el.type === "hidden") return;
                el.disabled = !isAdmin;
            });
        }
        if (this.el.calendarAddWrapper) {
            this.el.calendarAddWrapper.hidden = !isAdmin;
        }
        if (this.el.calendarCard) {
            this.el.calendarCard.classList.toggle("calendar-card--admin", isAdmin);
            this.el.calendarCard.classList.toggle("calendar-card--readonly", !isAdmin);
        }
        this.renderCalendarEvents();
    },

    setupCalendarDatePicker() {
        const dayInput = this.el.calendarEventDay;
        const monthSelect = this.el.calendarEventMonth;
        const yearInput = this.el.calendarEventYear;
        const hidden = this.el.calendarEventDate;
        if (!dayInput || !monthSelect || !yearInput || !hidden) return;

        monthSelect.innerHTML = "";
        const monthPlaceholder = document.createElement("option");
        monthPlaceholder.value = "";
        monthPlaceholder.textContent = "Mes";
        monthPlaceholder.disabled = true;
        monthPlaceholder.selected = true;
        monthSelect.appendChild(monthPlaceholder);

        const monthFormatter = new Intl.DateTimeFormat("es-ES", { month: "long" });
        for (let m = 0; m < 12; m++) {
            const option = document.createElement("option");
            option.value = String(m);
            const label = monthFormatter.format(new Date(2024, m, 1));
            option.textContent = label.charAt(0).toUpperCase() + label.slice(1);
            monthSelect.appendChild(option);
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const initialMax = Math.min(CALENDAR_MAX_YEAR, currentYear + 5);
        let initialMin = Number.isFinite(currentYear) ? Math.min(initialMax, currentYear - 1) : initialMax;
        if (!Number.isFinite(initialMin)) initialMin = initialMax;
        this._calendarYearRange = { min: initialMin, max: initialMax };
        dayInput.min = 1;
        dayInput.max = 31;
        dayInput.value = "";

        yearInput.min = this._calendarYearRange.min;
        yearInput.max = this._calendarYearRange.max;
        yearInput.value = "";

        const enforceNumeric = (inputEl, { maxLength } = {}) => {
            inputEl.addEventListener("input", () => {
                const digitsOnly = (inputEl.value || "").replace(/\D+/g, "");
                inputEl.value = maxLength ? digitsOnly.slice(0, maxLength) : digitsOnly;
            });
        };

        enforceNumeric(dayInput, { maxLength: 2 });
        enforceNumeric(yearInput, { maxLength: 4 });

        const onChange = () => this.handleDatePickerChange();
        dayInput.addEventListener("input", onChange);
        dayInput.addEventListener("blur", onChange);
        monthSelect.addEventListener("change", onChange);
        yearInput.addEventListener("input", onChange);
        yearInput.addEventListener("blur", onChange);

        hidden.value = "";

        if (this.calendarState?.selectedDate) {
            this.syncCalendarDatePicker(this.calendarState.selectedDate, { keepCurrent: false });
        }
    },

    ensureDatePickerYearRange(year) {
        if (typeof year !== "number" || !Number.isFinite(year)) return null;
        const limit = CALENDAR_MAX_YEAR;
        if (!this._calendarYearRange) {
            this._calendarYearRange = { min: Math.min(year, limit), max: limit };
        }
        if (year < this._calendarYearRange.min) {
            this._calendarYearRange.min = year;
        }
        if (year > limit) {
            year = limit;
        }
        this._calendarYearRange.max = limit;
        if (this._calendarYearRange.min > limit) {
            this._calendarYearRange.min = limit;
        }
        const yearInput = this.el.calendarEventYear;
        if (yearInput) {
            yearInput.min = this._calendarYearRange.min;
            yearInput.max = limit;
        }
        return year;
    },

    handleDatePickerChange() {
        if (this._datePickerSyncing) return;
        const dayInput = this.el.calendarEventDay;
        const monthSelect = this.el.calendarEventMonth;
        const yearInput = this.el.calendarEventYear;
        const hidden = this.el.calendarEventDate;
        if (!dayInput || !monthSelect || !yearInput || !hidden) return;

        const rawYear = (yearInput.value || "").trim();
        const rawMonth = monthSelect.value;
        const rawDay = (dayInput.value || "").trim();

        if (!rawMonth || !rawYear) {
            hidden.value = "";
            return;
        }

        let year = Number(rawYear);
        let month = Number(rawMonth);

        if (!Number.isFinite(year) || !Number.isFinite(month)) {
            hidden.value = "";
            return;
        }

        const normalizedYear = this.ensureDatePickerYearRange(year);
        if (typeof normalizedYear === "number") {
            year = normalizedYear;
        }

        if (month < 0) month = 0;
        if (month > 11) month = 11;

        const maxDays = this.daysInMonth(year, month);
        if (Number(dayInput.max) !== maxDays) {
            dayInput.max = maxDays;
        }

        if (!rawDay) {
            hidden.value = "";
            this._datePickerSyncing = true;
            try {
                yearInput.value = String(year);
                monthSelect.value = String(month);
            } finally {
                this._datePickerSyncing = false;
            }
            return;
        }

        let day = Number(rawDay);

        if (!Number.isFinite(day)) {
            hidden.value = "";
            return;
        }

        if (day < 1) day = 1;
        if (day > maxDays) day = maxDays;

        this._datePickerSyncing = true;
        try {
            yearInput.value = String(year);
            monthSelect.value = String(month);
            dayInput.value = String(day);
        } finally {
            this._datePickerSyncing = false;
        }

        const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        hidden.value = iso;

        if (this.calendarState?.selectedDate !== iso) {
            this.selectCalendarDate(iso, { focus: false, ensureMonthVisible: true });
        }
    },

    syncCalendarDatePicker(iso, { keepCurrent = false } = {}) {
        const dayInput = this.el.calendarEventDay;
        const monthSelect = this.el.calendarEventMonth;
        const yearInput = this.el.calendarEventYear;
        const hidden = this.el.calendarEventDate;
        if (!dayInput || !monthSelect || !yearInput || !hidden) return;

        if (this._datePickerSyncing) return;
        this._datePickerSyncing = true;
        try {
            if (!iso) {
                if (!keepCurrent) {
                    dayInput.value = "";
                    monthSelect.value = "";
                    yearInput.value = "";
                    hidden.value = "";
                }
                return;
            }

            const date = this.parseISODate(iso);
            if (!date) {
                if (!keepCurrent) hidden.value = "";
                return;
            }

            let year = date.getFullYear();
            const month = date.getMonth();
            let day = date.getDate();

            const normalizedYear = this.ensureDatePickerYearRange(year);
            if (typeof normalizedYear === "number") {
                year = normalizedYear;
            }

            const maxDays = this.daysInMonth(year, month);
            dayInput.max = maxDays;
            if (day > maxDays) {
                day = maxDays;
            }

            dayInput.value = String(day);
            monthSelect.value = String(month);
            yearInput.value = String(year);
            const normalizedDate = new Date(year, month, day);
            hidden.value = this.formatDate(normalizedDate);
        } finally {
            this._datePickerSyncing = false;
        }
    },

    applyCalendarData(data = {}) {
        this.calendarData = data || {};
        const events = Array.isArray(data.events) ? data.events : [];
        this.calendarEvents = events;
        this.buildCalendarIndex(events);
        this.ensureCalendarSelection();
        this.renderCalendar();
    },

    buildCalendarIndex(events = []) {
        this.calendarEventsByDate = new Map();
        events.forEach((evt) => {
            if (!evt || !evt.date) return;
            const iso = String(evt.date);
            if (!this.calendarEventsByDate.has(iso)) {
                this.calendarEventsByDate.set(iso, []);
            }
            this.calendarEventsByDate.get(iso).push(evt);
        });
        this.calendarEventsByDate.forEach((list) => {
            list.sort((a, b) => a.title.localeCompare(b.title, "es", { sensitivity: "base" }));
        });
    },

    ensureCalendarSelection() {
        if (!this.calendarState) this.initCalendarState();
        const state = this.calendarState;
        if (!state) return;

        if (typeof state.year !== "number" || typeof state.month !== "number") {
            const reference = this.parseISODate(state.today) || new Date();
            state.year = reference.getFullYear();
            state.month = reference.getMonth();
        }

        if (state.selectedDate && !this.parseISODate(state.selectedDate)) {
            state.selectedDate = null;
        }

        this.clampCalendarStateToLimit();
    },

    clampCalendarStateToLimit() {
        if (!this.calendarState) return;
        const state = this.calendarState;
        const limit = CALENDAR_MAX_YEAR;
        if (typeof state.year === "number" && state.year > limit) {
            state.year = limit;
            if (typeof state.month === "number") {
                state.month = Math.min(Math.max(state.month, 0), 11);
            } else {
                state.month = 0;
            }
        }

        if (state.selectedDate) {
            const selected = this.parseISODate(state.selectedDate);
            if (!selected || selected.getFullYear() > limit) {
                state.selectedDate = null;
            }
        }
    },

    renderCalendar() {
        if (!this.el.calendarCard || !this.calendarState) return;
        const { year, month } = this.calendarState;
        if (this.el.calendarMonthLabel) {
            this.el.calendarMonthLabel.textContent = this.formatMonthLabel(year, month);
        }
        this.renderCalendarDays();
        this.renderCalendarEvents();
    },

    renderCalendarDays() {
        const grid = this.el.calendarDays;
        if (!grid || !this.calendarState) return;
        grid.innerHTML = "";

        const { year, month, selectedDate, today } = this.calendarState;
        const firstOfMonth = new Date(year, month, 1);
        const totalDays = new Date(year, month + 1, 0).getDate();
        const offset = (firstOfMonth.getDay() + 6) % 7; // Lunes como primer día

        for (let i = 0; i < offset; i++) {
            const placeholder = document.createElement("div");
            placeholder.className = "calendar-day calendar-day--placeholder";
            placeholder.setAttribute("aria-hidden", "true");
            grid.appendChild(placeholder);
        }

        for (let day = 1; day <= totalDays; day++) {
            const date = new Date(year, month, day);
            const iso = this.formatDate(date);
            const events = this.calendarEventsByDate.get(iso) || [];
            const button = document.createElement("button");
            button.type = "button";
            button.className = "calendar-day";
            button.dataset.date = iso;

            if (iso === today) button.classList.add("calendar-day--today");
            if (iso === selectedDate) button.classList.add("calendar-day--selected");
            if (events.length) button.classList.add("calendar-day--has-events");

            button.setAttribute("aria-label", `${day} de ${this.formatMonthLabel(year, month)}${events.length ? `, ${events.length} evento${events.length > 1 ? "s" : ""}` : ""}`);

            const number = document.createElement("span");
            number.className = "calendar-day-number";
            number.textContent = String(day);
            button.appendChild(number);

            if (events.length) {
                const eventsWrap = document.createElement("div");
                eventsWrap.className = "calendar-day-events";
                const preview = events.slice(0, 2);
                preview.forEach((evt) => {
                    const pill = document.createElement("span");
                    pill.className = "calendar-day-event";
                    const label = (evt.title || "Evento").toString().trim() || "Evento";
                    pill.textContent = label.slice(0, 18);
                    pill.title = label;
                    eventsWrap.appendChild(pill);
                });
                if (events.length > 2) {
                    const more = document.createElement("span");
                    more.className = "calendar-day-more";
                    more.textContent = `+${events.length - 2}`;
                    eventsWrap.appendChild(more);
                }
                button.appendChild(eventsWrap);
            }

            grid.appendChild(button);
        }

        const totalCells = offset + totalDays;
        const remainder = totalCells % 7;
        if (remainder) {
            for (let i = remainder; i < 7; i++) {
                const placeholder = document.createElement("div");
                placeholder.className = "calendar-day calendar-day--placeholder";
                placeholder.setAttribute("aria-hidden", "true");
                grid.appendChild(placeholder);
            }
        }
    },

    renderCalendarEvents() {
        const list = this.el.calendarEventList;
        const label = this.el.calendarSelectedLabel;
        const detail = this.el.calendarDetail;
        if (!this.calendarState) return;
        const selectedDate = this.calendarState.selectedDate;
        const hasSelection = !!selectedDate;

        this.syncCalendarDatePicker(selectedDate || null, { keepCurrent: false });

        if (detail) {
            detail.hidden = !hasSelection;
        }

        if (label) {
            const text = hasSelection ? this.formatHumanDate(selectedDate) : "Selecciona un día";
            label.textContent = text;
        }

        if (!list) return;
        list.innerHTML = "";

        if (!hasSelection) {
            const prompt = document.createElement("li");
            prompt.className = "calendar-empty";
            prompt.textContent = "Selecciona un día para ver eventos.";
            list.appendChild(prompt);
            return;
        }

        if (this.el.calendarEventDate) {
            this.el.calendarEventDate.value = selectedDate;
        }

        const events = this.calendarEventsByDate.get(selectedDate) || [];

        if (!events.length) {
            const empty = document.createElement("li");
            empty.className = "calendar-empty";
            empty.textContent = "No hay eventos para este día.";
            list.appendChild(empty);
            return;
        }

        events.forEach((evt) => {
            const item = document.createElement("li");
            item.className = "calendar-event";
            item.dataset.eventId = evt.id;

            const main = document.createElement("div");
            main.className = "calendar-event-main";
            const titleHtml = this.escapeHtml(evt.title || "Evento");
            const descHtml = evt.description ? `<div class="calendar-event-desc">${this.escapeHtml(evt.description)}</div>` : "";
            main.innerHTML = `<div class="calendar-event-title">${titleHtml}</div>${descHtml}`;
            item.appendChild(main);

            if (this.isCalendarAdmin) {
                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "calendar-event-delete";
                remove.dataset.eventId = evt.id;
                remove.title = "Eliminar evento";
                remove.setAttribute("aria-label", "Eliminar evento");
                remove.textContent = "✕";
                item.appendChild(remove);
            }

            list.appendChild(item);
        });
    },

    selectCalendarDate(date, opts = {}) {
        const parsed = this.parseISODate(date);
        if (!parsed) {
            toast("Fecha de calendario inválida");
            return;
        }
        if (!this.calendarState) this.initCalendarState();
        const iso = this.formatDate(parsed);
        this.calendarState.selectedDate = iso;
        if (opts.ensureMonthVisible !== false) {
            this.calendarState.year = parsed.getFullYear();
            this.calendarState.month = parsed.getMonth();
        }
        this.renderCalendar();

        if (opts.focus !== false) {
            const selectorDate = window.CSS && typeof window.CSS.escape === "function" ? window.CSS.escape(iso) : iso.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
            const dayBtn = this.el.calendarDays?.querySelector?.(`.calendar-day[data-date="${selectorDate}"]`);
            dayBtn?.focus({ preventScroll: false });
        }
    },

    shiftCalendar(delta) {
        if (!this.calendarState) this.initCalendarState();
        const state = this.calendarState;
        if (delta > 0 && state.year === CALENDAR_MAX_YEAR && state.month === 11) {
            return;
        }
        const current = new Date(state.year, state.month, 1);
        current.setMonth(current.getMonth() + delta);
        state.year = current.getFullYear();
        state.month = current.getMonth();

        this.clampCalendarStateToLimit();

        const selected = this.parseISODate(state.selectedDate);
        if (!selected || selected.getFullYear() !== state.year || selected.getMonth() !== state.month) {
            state.selectedDate = null;
        }

        this.renderCalendar();
    },

    async handleCalendarSubmit(ev) {
        ev.preventDefault();
        if (!this.isCalendarAdmin) {
            toast("No tienes permisos para modificar el calendario");
            return;
        }
        if (!this.subject || !this.subject.id) {
            toast("Foro no cargado");
            return;
        }

        const date = this.el.calendarEventDate?.value;
        const title = (this.el.calendarEventTitle?.value || "").trim();
        const description = (this.el.calendarEventDescription?.value || "").trim();

        const parsedDate = this.parseISODate(date);
        if (!parsedDate) {
            toast("Selecciona una fecha válida");
            return;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const eventDay = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
        if (eventDay < today) {
            toast("No puedes crear eventos en fechas pasadas");
            return;
        }
        if (!title) {
            toast("Añade un título para el evento");
            return;
        }

        try {
            const res = await fetch(`/api/subjects/${encodeURIComponent(this.subject.id)}/calendar/events`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date, title, description }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                const message = err?.error?.message || "No se pudo guardar el evento";
                throw new Error(message);
            }

            const payload = await res.json();
            if (payload?.calendar) {
                this.applyCalendarData(payload.calendar);
                this.selectCalendarDate(date, { focus: false, ensureMonthVisible: true });
            }
            this.el.calendarAddForm?.reset();
            if (this.el.calendarEventDate) this.el.calendarEventDate.value = date;
            toast("Evento guardado");
        } catch (e) {
            console.error("Error guardando evento de calendario:", e);
            toast(e.message || "No se pudo guardar el evento");
        }
    },

    async handleCalendarDelete(eventId) {
        if (!this.isCalendarAdmin) {
            toast("No tienes permisos para modificar el calendario");
            return;
        }
        if (!this.subject || !this.subject.id) {
            toast("Foro no cargado");
            return;
        }

        try {
            const res = await fetch(`/api/subjects/${encodeURIComponent(this.subject.id)}/calendar/events/${encodeURIComponent(eventId)}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                const message = err?.error?.message || "No se pudo eliminar el evento";
                throw new Error(message);
            }

            const payload = await res.json();
            if (payload?.calendar) {
                this.applyCalendarData(payload.calendar);
            }
            toast("Evento eliminado");
        } catch (e) {
            console.error("Error eliminando evento del calendario:", e);
            toast(e.message || "No se pudo eliminar el evento");
        }
    },

    formatDate(value) {
        const date = value instanceof Date ? value : this.parseISODate(value);
        if (!date || Number.isNaN(date.getTime())) return null;
        const y = String(date.getFullYear());
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    },

    parseISODate(value) {
        if (!value) return null;
        if (value instanceof Date) return value;
        const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        if (Number.isNaN(date.getTime())) return null;
        if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) {
            return null;
        }
        return date;
    },

    formatHumanDate(iso) {
        const date = this.parseISODate(iso);
        if (!date) return "Selecciona un día";
        const formatted = date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    },

    formatMonthLabel(year, month) {
        const date = new Date(year, month, 1);
        const formatted = date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    },

    daysInMonth(year, monthIndex) {
        return new Date(year, monthIndex + 1, 0).getDate();
    },

    computeLocalForumStats(messages = []) {
        let total = 0;
        let latestTs = null;
        let latestPayload = null;

        const consider = (payload) => {
            total++;
            const ts = payload?.timestamp ? Date.parse(payload.timestamp) : NaN;
            if (Number.isNaN(ts)) return;
            if (latestTs === null || ts > latestTs) {
                latestTs = ts;
                latestPayload = payload;
            }
        };

        messages.forEach((msg) => {
            if (!msg || typeof msg !== "object") return;
            consider({
                kind: "post",
                id: msg.id,
                subjectId: msg.subjectId,
                title: msg.title || "",
                content: msg.content || "",
                timestamp: msg.timestamp,
                userName: msg.userName || msg.userEmail || "",
            });
            const replies = Array.isArray(msg.replies) ? msg.replies : [];
            replies.forEach((reply) => {
                if (!reply || typeof reply !== "object") return;
                consider({
                    kind: "reply",
                    id: reply.id,
                    subjectId: msg.subjectId,
                    content: reply.content || "",
                    timestamp: reply.timestamp,
                    userName: reply.userName || reply.userEmail || "",
                });
            });
        });

        const normalizePreview = (text = "") => {
            const clean = String(text).replace(/\s+/g, " ").trim();
            if (clean.length <= 140) return clean;
            return clean.slice(0, 137) + "…";
        };

        return {
            totalMessages: total,
            lastMessageAt: latestTs !== null ? new Date(latestTs).toISOString() : null,
            lastMessageKind: latestPayload?.kind || null,
            lastMessageAuthor: latestPayload?.userName || "",
            lastMessageTitle: latestPayload?.kind === "post" ? latestPayload?.title || "" : "",
            lastMessagePreview: latestPayload?.kind === "post" ? normalizePreview(latestPayload?.content || latestPayload?.title || "") : normalizePreview(latestPayload?.content || ""),
        };
    },

    syncUnreadWithMessages(messages = []) {
        try {
            const email = this.user?.email;
            const subjectId = this.subject?.id;
            if (!email || !subjectId) return;
            const stats = this.computeLocalForumStats(messages);
            unreadTracker.markRead(email, subjectId, stats);
        } catch (e) {
            // noop
        }
    },

    renderMessages(messages) {
        const container = this.el.postsContainer;

        if (!messages || messages.length === 0) {
            container.innerHTML = `
                <div class="hint" style="padding: 24px; text-align: center">
                    <p style="margin: 0">Aún no hay mensajes en este foro.</p>
                    <p style="margin: 8px 0 0; font-size: 13px">¡Sé el primero en publicar algo!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = "";
        // Obtener sesión local para poder sustituir nombre/color si el post es nuestro
        const session = store.getSession();
        messages.forEach((msg) => {
            const isMine = session && msg.userEmail && session.email && msg.userEmail === session.email;
            //Si tengo iniciada la sesión, muestro mi nombre y color actual, sino muestra los datos guardados al enviar el mensaje
            const displayName = isMine ? session.name || session.email : msg.userName;
            const displayColor = isMine ? session.color || msg.userColor : msg.userColor;

            const messageEl = document.createElement("div");
            messageEl.className = "post";
            messageEl.id = `msg-${msg.id}`;
            messageEl.dataset.messageId = msg.id;
            messageEl.innerHTML = `
                <div class="post-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px">
                    <div class="avatar" style="width: 32px; height: 32px; border-radius: 8px; background: ${displayColor || "#6366f1"}; display: grid; place-items: center; color: #0b0e12; font-weight: 900; font-size: 14px">
                        ${initialsOf(displayName)}
                    </div>
                    <div style="flex: 1">
                        <div style="font-weight: 700; font-size: 15px">${this.escapeHtml(displayName)}</div>
                        <div style="font-size: 12px; color: var(--muted)">${new Date(msg.timestamp).toLocaleString()}</div>
                    </div>
                    ${this.user && isSubjectAdmin(this.user, this.subject) ? `<button class="btn-delete-post" data-id="${msg.id}" title="Borrar">Borrar</button>` : ""}
                </div>
                <div class="post-title" style="font-weight: 700; font-size: 16px; margin-bottom: 8px">${this.escapeHtml(msg.title)}</div>
                <div class="post-content" style="white-space: pre-wrap; line-height: 1.6">${this.escapeHtml(msg.content)}</div>
                ${
                    Array.isArray(msg.attachments) && msg.attachments.length > 0
                        ? `
                <div class="attachments" style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
                    ${msg.attachments
                        .map((a) => {
                            const isImage = /^image\//.test(a.type || "");
                            const safeName = forumApp.escapeHtml(a.name || "archivo");
                            if (isImage) {
                                return `<a href="${a.url}" target="_blank" rel="noopener" class="attachment-thumb" title="${safeName}"><img src="${a.url}" alt="${safeName}" style="width:120px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--chip-border)"/></a>`;
                            }
                            return `<a href="${a.url}" target="_blank" rel="noopener" class="attachment-file" style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--chip-border);border-radius:8px;padding:6px 8px;background:var(--chip)">${safeName}</a>`;
                        })
                        .join("")}
                </div>
                `
                        : ""
                }
                <div class="post-actions" style="margin-top: 12px; display: flex; gap: 8px">
                    <button class="btn-reply" data-message-id="${msg.id}" data-reply-to="${this.escapeHtml(displayName)}" title="Responder">
                        Responder
                    </button>
                    <button class="btn-report ${this.reportedSet && this.reportedSet.has(String(msg.id)) ? "reported" : ""}" data-message-id="${msg.id}" title="${
                this.reportedSet && this.reportedSet.has(String(msg.id)) ? "Ya reportado" : "Reportar"
            }">
                        ${this.reportedSet && this.reportedSet.has(String(msg.id)) ? "Reportado" : "Reportar"}
                    </button>
                </div>
                ${this.renderReplies(msg.replies || [], msg.id)}
            `;
            container.appendChild(messageEl);
        });

        // Tras renderizar, aplicar el contexto del hash (expandir hilos y enfocar objetivo)
        try {
            // Ejecutar al final del frame para asegurar que el DOM esté listo
            setTimeout(() => {
                forumApp.applyHashContext && forumApp.applyHashContext();
            }, 0);
        } catch (e) {
            // noop
        }
    },

    async refreshPostsAfterModeration() {
        try {
            if (!this.subject || !this.subject.id) return;
            const res = await fetch(`/api/subjects/${encodeURIComponent(this.subject.id)}/posts`);
            if (!res.ok) return;
            const messages = await res.json();
            this.renderMessages(messages);
            this.syncUnreadWithMessages(messages);
        } catch (err) {
            console.error("Error actualizando mensajes tras moderación:", err);
        }
    },

    // Aplica el contexto del hash para mostrar y enfocar el elemento objetivo
    applyHashContext() {
        // Quitar cualquier resaltado previo para que sólo haya uno activo
        this.clearContextHighlight();

        const hash = window.location.hash || "";
        if (!hash) return;

        // Mensaje principal
        const mMsg = hash.match(/^#msg-(.+)$/);
        if (mMsg) {
            const msgId = decodeURIComponent(mMsg[1]);
            const postEl = document.querySelector(`#msg-${CSS.escape(msgId)}`);
            if (postEl) {
                this.scrollElementToCenter(postEl, () => {
                    // Esperar 0.5s antes de mostrar el borde
                    setTimeout(() => {
                        // Usar clase con pseudo-elemento para borde limpio que respeta border-radius
                        postEl.classList.add("context-highlight");
                        // Hacer fade-in del borde
                        postEl.classList.add("context-visible");
                        // Mantener el borde hasta que el usuario haga scroll
                        this.installScrollClear(postEl);
                    }, 500);
                });
            }
            return;
        }

        // Respuesta (incluye anidadas)
        const mReply = hash.match(/^#reply-(.+)$/);
        if (!mReply) return;
        const replyId = decodeURIComponent(mReply[1]);

        const anyBtn = document.querySelector(`.btn-reply-to-reply[data-reply-id="${CSS.escape(replyId)}"], .btn-report-reply[data-reply-id="${CSS.escape(replyId)}"]`);
        const threadRoot = anyBtn?.dataset.threadRoot;
        const rootId = threadRoot || replyId;

        const sub = document.querySelector(`.sub-replies[data-reply-id="${CSS.escape(rootId)}"]`);
        if (sub) {
            sub.style.display = "block";
            const toggle = document.querySelector(`.btn-toggle-replies[data-reply-id="${CSS.escape(rootId)}"]`);
            if (toggle) {
                const cnt = sub.querySelectorAll(".reply").length;
                toggle.textContent = `Ocultar respuestas (${cnt})`;
            }
        }

        const targetBlock = anyBtn ? anyBtn.closest(".reply") : document.querySelector(`#reply-${CSS.escape(replyId)}`) || document.querySelector(`[data-reply-id="${CSS.escape(replyId)}"]`);
        if (targetBlock) {
            this.scrollElementToCenter(targetBlock, () => {
                // Esperar 0.5s antes de mostrar el borde
                setTimeout(() => {
                    targetBlock.classList.add("context-highlight");
                    // Hacer fade-in del borde
                    targetBlock.classList.add("context-visible");
                    // Mantener el borde hasta que el usuario haga scroll
                    this.installScrollClear(targetBlock);
                }, 500);
            });
        } else if (sub) {
            this.scrollElementToCenter(sub);
        }
    },

    // Elimina la clase de resaltado de cualquier elemento previamente marcado
    clearContextHighlight() {
        try {
            document.querySelectorAll(".context-highlight").forEach((el) => {
                el.classList.remove("context-highlight");
            });
            // Desinstalar listener de scroll si estaba activo
            if (this._onScrollClear) {
                window.removeEventListener("scroll", this._onScrollClear);
                this._onScrollClear = null;
            }
            this._activeHighlightEl = null;
        } catch (e) {
            // noop
        }
    },

    // Instala un listener de scroll para limpiar el resaltado cuando el usuario se mueva
    installScrollClear(el) {
        this._activeHighlightEl = el;
        // Si existía un handler anterior, quitarlo
        if (this._onScrollClear) {
            window.removeEventListener("scroll", this._onScrollClear);
            this._onScrollClear = null;
        }
        this._onScrollClear = () => {
            try {
                if (this._activeHighlightEl) {
                    // Iniciar fade-out quitando la visibilidad
                    this._activeHighlightEl.classList.remove("context-visible");
                    // Tras la transición (match CSS 1200ms), quitar la clase principal
                    setTimeout(() => {
                        this._activeHighlightEl && this._activeHighlightEl.classList.remove("context-highlight");
                    }, 1200);
                }
            } catch (e) {}
            // Limpieza del handler
            window.removeEventListener("scroll", this._onScrollClear);
            this._onScrollClear = null;
            // Quitar referencia activa tras el fade
            setTimeout(() => {
                this._activeHighlightEl = null;
            }, 1220);
        };
        // Usar { passive: true } para no bloquear el scroll
        window.addEventListener("scroll", this._onScrollClear, { passive: true });
    },

    // Desplaza suavemente para colocar el elemento en el centro de la pantalla y ejecuta un callback al llegar
    scrollElementToCenter(el, onArrive) {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const targetY = Math.max(0, window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2);

        // Iniciar scroll suave
        window.scrollTo({ top: targetY, behavior: "smooth" });

        // Si no hay callback, salir
        if (typeof onArrive !== "function") return;

        // Observador de llegada: cuando el scroll esté cerca del objetivo, lanzar callback
        let lastY = window.scrollY;
        const threshold = 2; // px
        const checkArrival = () => {
            const currentY = window.scrollY;
            const dist = Math.abs(currentY - targetY);
            // Consideramos llegada si está dentro del umbral o si el scroll se ha detenido cerca
            if (dist <= threshold || Math.abs(currentY - lastY) < 0.5) {
                onArrive();
                return; // detener comprobación
            }
            lastY = currentY;
            requestAnimationFrame(checkArrival);
        };
        requestAnimationFrame(checkArrival);
    },

    renderReplies(replies, parentId) {
        if (!replies || replies.length === 0) return "";

        const session = store.getSession();
        const isAdmin = this.user && isSubjectAdmin(this.user, this.subject);

        // Separar respuestas directas de respuestas a respuestas
        const directReplies = [];
        const nestedReplies = [];

        replies.forEach((reply) => {
            if (reply.replyToUser) {
                nestedReplies.push(reply);
            } else {
                directReplies.push(reply);
            }
        });

        let html = '<div class="replies-container" style="margin-top: 16px;">';

        // Crear mapas para búsqueda rápida
        const allRepliesById = {};
        directReplies.forEach((r) => (allRepliesById[r.id] = r));
        nestedReplies.forEach((r) => (allRepliesById[r.id] = r));

        // Crear un Set para rastrear las respuestas anidadas ya renderizadas
        const renderedNestedIds = new Set();

        // Función para encontrar a qué respuesta directa pertenece una respuesta anidada
        // usando el campo replyToId si existe, si no usa timestamps
        const findRootDirectReply = (reply) => {
            // Si tiene replyToId, usarlo directamente
            if (reply.replyToId) {
                const parent = allRepliesById[reply.replyToId];
                if (parent) {
                    // Si el parent es directo, retornarlo
                    if (!parent.replyToUser) {
                        return parent;
                    }
                    // Si el parent es anidado, seguir buscando
                    return findRootDirectReply(parent);
                }
            }

            // Fallback: buscar por timestamps (para respuestas antiguas sin replyToId)
            const replyToUserName = reply.replyToUser;
            if (!replyToUserName) return null;

            // Buscar respuestas directas anteriores de ese usuario
            const possibleRoots = directReplies.filter((root) => root.userName === replyToUserName && new Date(root.timestamp) < new Date(reply.timestamp));

            if (possibleRoots.length > 0) {
                return possibleRoots.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
            }

            // Buscar en respuestas anidadas
            const nestedParents = nestedReplies.filter((r) => r.userName === replyToUserName && new Date(r.timestamp) < new Date(reply.timestamp));

            if (nestedParents.length > 0) {
                const nestedParent = nestedParents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
                return findRootDirectReply(nestedParent);
            }

            return null;
        };

        // Función recursiva para obtener SOLO las respuestas que pertenecen a un hilo específico
        const getThreadReplies = (rootReply, collectedIds = new Set(), depth = 0) => {
            if (depth > 50) return; // Prevenir recursión infinita

            nestedReplies.forEach((r) => {
                if (collectedIds.has(r.id)) return; // Ya procesada

                // Verificar si esta respuesta pertenece a este hilo específico
                const rootOfThisReply = findRootDirectReply(r);

                if (rootOfThisReply && rootOfThisReply.id === rootReply.id) {
                    collectedIds.add(r.id);
                    // Buscar recursivamente respuestas que apunten a esta respuesta
                    getThreadReplies(rootReply, collectedIds, depth + 1);
                }
            });

            return collectedIds;
        };

        // Renderizar cada respuesta directa como un hilo separado
        directReplies.forEach((reply) => {
            const isMine = session && reply.userEmail && session.email && reply.userEmail === session.email;
            const displayName = isMine ? session.name || session.email : reply.userName;
            const displayColor = isMine ? session.color || reply.userColor : reply.userColor;
            const canDelete = isAdmin || isMine;

            // Obtener SOLO las respuestas que pertenecen a ESTE hilo específico
            const threadReplyIds = new Set();
            getThreadReplies(reply, threadReplyIds);

            html += `
                <div class="reply-thread" style="margin-bottom: 16px; margin-left: 20px; border-left: 3px solid ${displayColor || "#6366f1"}; padding-left: 16px;">
                    <div class="reply" style="padding: 10px; background: var(--glass-bg); border-radius: 8px; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px">
                            <div class="avatar" style="width: 24px; height: 24px; border-radius: 6px; background: ${displayColor || "#6366f1"}; display: grid; place-items: center; color: #0b0e12; font-weight: 900; font-size: 11px">
                                ${initialsOf(displayName)}
                            </div>
                            <div style="flex: 1;">
                                <div style="font-weight: 700; font-size: 13px">${this.escapeHtml(displayName)}</div>
                                <div style="font-size: 11px; color: var(--muted)">${new Date(reply.timestamp).toLocaleString()}</div>
                            </div>
                            ${canDelete ? `<button class="btn-delete-reply" data-parent-id="${parentId}" data-reply-id="${reply.id}" title="Borrar respuesta">Borrar</button>` : ""}
                        </div>
                        <div style="font-size: 14px; line-height: 1.5; white-space: pre-wrap;">
                            ${this.escapeHtml(reply.content)}
                        </div>
                        ${
                            Array.isArray(reply.attachments) && reply.attachments.length > 0
                                ? `
                        <div class="attachments" style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
                            ${reply.attachments
                                .map((a) => {
                                    const isImage = /^image\//.test(a.type || "");
                                    const safeName = forumApp.escapeHtml(a.name || "archivo");
                                    if (isImage) {
                                        return `<a href="${a.url}" target="_blank" rel="noopener" class="attachment-thumb" title="${safeName}"><img src="${a.url}" alt="${safeName}" style="width:110px;height:74px;object-fit:cover;border-radius:6px;border:1px solid var(--chip-border)"/></a>`;
                                    }
                                    return `<a href="${a.url}" target="_blank" rel="noopener" class="attachment-file" style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--chip-border);border-radius:8px;padding:6px 8px;background:var(--chip)">${safeName}</a>`;
                                })
                                .join("")}
                        </div>
                        `
                                : ""
                        }
                        <div style="margin-top: 6px; display: flex; gap: 8px;">
                            <button class="btn-reply-to-reply" data-parent-id="${parentId}" data-reply-to="${this.escapeHtml(displayName)}" data-reply-id="${reply.id}" data-thread-root="${reply.id}" title="Responder">
                                Responder
                            </button>
                            <button class="btn-report-reply ${this.reportedRepliesSet && this.reportedRepliesSet.has(`${parentId}:${reply.id}`) ? "reported" : ""}" data-parent-id="${parentId}" data-reply-id="${reply.id}" title="${
                this.reportedRepliesSet && this.reportedRepliesSet.has(`${parentId}:${reply.id}`) ? "Ya reportado" : "Reportar respuesta"
            }">
                                ${this.reportedRepliesSet && this.reportedRepliesSet.has(`${parentId}:${reply.id}`) ? "Reportado" : "Reportar"}
                            </button>
            `;

            // Filtrar solo las respuestas que pertenecen a este hilo y no han sido renderizadas
            const threadReplies = nestedReplies.filter((r) => threadReplyIds.has(r.id) && !renderedNestedIds.has(r.id));

            // Ordenar por timestamp para mantener el orden cronológico
            threadReplies.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            if (threadReplies.length > 0) {
                html += `
                            <button class="btn-toggle-replies" data-reply-id="${reply.id}" title="Ver respuestas (${threadReplies.length})">
                                Ver respuestas (${threadReplies.length})
                            </button>
                        </div>
                    </div>
                    <div class="sub-replies" data-reply-id="${reply.id}" style="display: none; margin-left: 16px; padding-left: 12px; border-left: 2px solid var(--border);">
                `;
            } else {
                html += `
                        </div>
                    </div>
                `;
            }

            if (threadReplies.length > 0) {
                threadReplies.forEach((subReply) => {
                    renderedNestedIds.add(subReply.id);

                    const subIsMine = session && subReply.userEmail && session.email && subReply.userEmail === session.email;
                    const subDisplayName = subIsMine ? session.name || session.email : subReply.userName;
                    const subDisplayColor = subIsMine ? session.color || subReply.userColor : subReply.userColor;
                    const subCanDelete = isAdmin || subIsMine;

                    html += `
                        <div class="reply" style="padding: 8px; background: var(--glass-bg); border-radius: 6px; margin-bottom: 6px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px">
                                <div class="avatar" style="width: 20px; height: 20px; border-radius: 5px; background: ${subDisplayColor || "#6366f1"}; display: grid; place-items: center; color: #0b0e12; font-weight: 900; font-size: 10px">
                                    ${initialsOf(subDisplayName)}
                                </div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 700; font-size: 12px">${this.escapeHtml(subDisplayName)}</div>
                                    <div style="font-size: 10px; color: var(--muted)">${new Date(subReply.timestamp).toLocaleString()}</div>
                                </div>
                                ${subCanDelete ? `<button class="btn-delete-reply" data-parent-id="${parentId}" data-reply-id="${subReply.id}" title="Borrar respuesta">Borrar</button>` : ""}
                            </div>
                            <div style="font-size: 13px; line-height: 1.5; white-space: pre-wrap;">
                                <span style="color: var(--primary); font-weight: 600;">@${this.escapeHtml(subReply.replyToUser)}</span> ${this.escapeHtml(subReply.content)}
                            </div>
                            ${
                                Array.isArray(subReply.attachments) && subReply.attachments.length > 0
                                    ? `
                            <div class="attachments" style="margin-top: 6px; display: flex; gap: 8px; flex-wrap: wrap;">
                                ${subReply.attachments
                                    .map((a) => {
                                        const isImage = /^image\//.test(a.type || "");
                                        const safeName = forumApp.escapeHtml(a.name || "archivo");
                                        if (isImage) {
                                            return `<a href="${a.url}" target="_blank" rel="noopener" class="attachment-thumb" title="${safeName}"><img src="${a.url}" alt="${safeName}" style="width:100px;height:68px;object-fit:cover;border-radius:6px;border:1px solid var(--chip-border)"/></a>`;
                                        }
                                        return `<a href="${a.url}" target="_blank" rel="noopener" class="attachment-file" style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--chip-border);border-radius:8px;padding:6px 8px;background:var(--chip)">${safeName}</a>`;
                                    })
                                    .join("")}
                            </div>
                            `
                                    : ""
                            }
                            <div style="margin-top: 4px">
                                <button class="btn-reply-to-reply" data-parent-id="${parentId}" data-reply-to="${this.escapeHtml(subDisplayName)}" data-reply-id="${subReply.id}" data-thread-root="${reply.id}" title="Responder">
                                    Responder
                                </button>
                                <button class="btn-report-reply ${this.reportedRepliesSet && this.reportedRepliesSet.has(`${parentId}:${subReply.id}`) ? "reported" : ""}" data-parent-id="${parentId}" data-reply-id="${subReply.id}" title="${
                        this.reportedRepliesSet && this.reportedRepliesSet.has(`${parentId}:${subReply.id}`) ? "Ya reportado" : "Reportar respuesta"
                    }">
                                    ${this.reportedRepliesSet && this.reportedRepliesSet.has(`${parentId}:${subReply.id}`) ? "Reportado" : "Reportar"}
                                </button>
                            </div>
                        </div>
                    `;
                });
                html += "</div>";
                html += "</div>";
            }
        });

        html += "</div>";
        return html;
    },

    escapeHtml(str) {
        const s = str == null ? "" : String(str);
        return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
    },

    async updateUser() {
        try {
            const response = await fetch("/updateUser", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: this.user.name,
                    bio: this.user.bio,
                    color: this.user.color,
                }),
            });
            await response.json();
        } catch (err) {
            console.error("Error al actualizar usuario:", err);
            toast("Error al actualizar el perfil");
        }
    },

    wire() {
        // Profile menu
        this.el.profileBtn?.addEventListener("click", () => {
            const open = this.el.profileMenu.style.display === "flex";
            this.el.profileMenu.style.display = open ? "none" : "flex";
            this.el.profileBtn.setAttribute("aria-expanded", String(!open));
        });

        document.addEventListener("click", (e) => {
            if (!e.target.closest(".profile")) {
                this.el.profileMenu.style.display = "none";
            }
        });

        // Edit profile
        this.el.btnEditProfile?.addEventListener("click", () => {
            this.el.profileMenu.style.display = "none";
            this.el.p_name.value = this.user?.name || "";
            this.el.p_bio.value = this.user?.bio || "";
            this.renderSwatches();
            const current = store.getColor();
            this.selectColor(current);
            this.el.p_color.value = current;
            this.openModal("#profileModal");
        });

        this.el.saveProfile?.addEventListener("click", () => {
            const name = this.el.p_name.value.trim();
            const bio = this.el.p_bio.value.trim();
            const avatarColor = this.el.p_color.value;

            this.user.name = name;
            this.user.bio = bio;
            this.user.color = avatarColor;

            store.setSession(JSON.stringify(this.user));
            this.updateUser();

            this.el.profileName.textContent = this.user.name || "Tu Nombre";
            this.el.avatar.style.background = this.user.color;
            this.el.avatarInitials.textContent = initialsOf(this.user.name || this.user.email);

            toast("Perfil actualizado");
            this.closeModal("#profileModal");
        });

        // Logout
        this.el.btnLogout?.addEventListener("click", async () => {
            store.clearSession();
            try {
                await fetch("/logout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                });
                toast("Sesión cerrada");
            } catch (err) {
                console.error("Error al cerrar sesión:", err);
            }
            setTimeout(() => (window.location.href = "/"), 400);
        });

        // Theme toggle
        this.el.themeToggle?.addEventListener("click", () => {
            const next = store.getTheme() === "dark" ? "light" : "dark";
            store.setTheme(next);
            document.documentElement.setAttribute("data-theme", next);
        });

        // Guardar filtros
        const filtersForm = document.getElementById("filtersForm");
        const filtersTextarea = document.getElementById("filtersTextarea");
        if (filtersForm && this.user && isSubjectAdmin(this.user, this.subject)) {
            filtersForm.addEventListener("submit", async (ev) => {
                ev.preventDefault();
                try {
                    if (!this.subject || !this.subject.id) return toast("Foro no cargado");
                    const raw = (filtersTextarea?.value || "")
                        .split(/\r?\n/)
                        .map((s) => s.trim())
                        .filter(Boolean);
                    const res = await fetch(`/api/subjects/${encodeURIComponent(this.subject.id)}/filters`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ filters: raw }),
                    });
                    if (!res.ok) throw new Error("Guardar filtros falló");
                    toast("Filtros guardados");
                    this.closeModal("#filtersModal");
                } catch (e) {
                    console.error("Error guardando filtros", e);
                    toast("Error guardando filtros");
                }
            });
        }

        // Form submit: publicar mensaje
        this.el.newMessageForm?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const form = this.el.newMessageForm;
            const title = (form.title?.value || "").trim();
            const content = (form.content?.value || "").trim();
            if (!title || !content) {
                toast("Rellena título y contenido");
                return;
            }
            try {
                // Construir multipart/form-data incluyendo adjuntos
                const fd = new FormData();
                fd.append("title", title);
                fd.append("content", content);
                const files = form.querySelector("#messageAttachments")?.files || [];
                const maxFiles = 5;
                const maxSize = 5 * 1024 * 1024;
                for (let i = 0; i < Math.min(files.length, maxFiles); i++) {
                    const f = files[i];
                    if (f.size > maxSize) {
                        toast(`Archivo demasiado grande: ${f.name}`);
                        return;
                    }
                    fd.append("attachments", f, f.name);
                }
                const res = await fetch(`/subject/${encodeURIComponent(this.subject.id)}/forum/post`, {
                    method: "POST",
                    body: fd,
                });
                if (!res.ok) throw new Error("Error publicando");
                const created = await res.json();

                // Si el servidor ha eliminado automáticamente por filtros, informar al usuario y no refrescar como 'publicado'
                if (created && created.filtered) {
                    // Mensaje claro para el usuario
                    toast("Tu mensaje contiene palabras filtradas y ha sido eliminado automáticamente");
                    // Opcional: mantener el contenido en el formulario para que pueda editarlo
                    // No recargamos la lista de posts ni mostramos 'Mensaje publicado'
                    return;
                }

                // Recargar lista completa para mantener orden desde server
                const rPosts = await fetch(`/api/subjects/${this.subject.id}/posts`);
                const messages = rPosts.ok ? await rPosts.json() : [];
                this.renderMessages(messages);
                this.syncUnreadWithMessages(messages);
                form.reset();
                toast("Mensaje publicado");
            } catch (err) {
                console.error(err);
                toast("No se pudo publicar el mensaje");
            }
        });

        // Delegación para borrar posts (copiado de UrjConnect-6)
        this.el.postsContainer?.addEventListener("click", async (e) => {
            const btn = e.target.closest && e.target.closest(".btn-delete-post");
            if (!btn) return;
            const id = btn.dataset.id;
            if (!id) return;
            if (!confirm("¿Deseas borrar este mensaje?")) return;

            try {
                const res = await fetch(`/api/messages/${encodeURIComponent(id)}`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                });
                if (res.status === 403) {
                    toast("No tienes permisos para borrar este mensaje");
                    return;
                }
                if (res.status === 404) {
                    toast("Mensaje no encontrado");
                    // opcional: eliminar del DOM
                    const postEl = btn.closest(".post");
                    if (postEl) postEl.remove();
                    // si ya no quedan posts, mostrar hint
                    const container = this.el.postsContainer;
                    if (container && container.querySelectorAll && container.querySelectorAll(".post").length === 0) {
                        container.innerHTML = `
                            <div class="hint" style="padding: 24px; text-align: center">
                                <p style="margin: 0">Aún no hay mensajes en este foro.</p>
                                <p style="margin: 8px 0 0; font-size: 13px">¡Sé el primero en publicar algo!</p>
                            </div>
                        `;
                    }
                    return;
                }
                if (!res.ok) {
                    toast("Error al borrar el mensaje");
                    return;
                }
                // borrar del DOM
                const postEl = btn.closest(".post");
                if (postEl) postEl.remove();
                // Si no quedan mensajes, mostrar el hint de "Aún no hay mensajes"
                const container = this.el.postsContainer;
                if (container && container.querySelectorAll && container.querySelectorAll(".post").length === 0) {
                    container.innerHTML = `
                        <div class="hint" style="padding: 24px; text-align: center">
                            <p style="margin: 0">Aún no hay mensajes en este foro.</p>
                            <p style="margin: 8px 0 0; font-size: 13px">¡Sé el primero en publicar algo!</p>
                        </div>
                    `;
                }
                toast("Mensaje borrado");
            } catch (err) {
                console.error("Error borrando mensaje", err);
                toast("Error al borrar el mensaje");
            }
        });

        // Delegación para botones de responder, borrar y toggle
        this.el.postsContainer?.addEventListener("click", async (e) => {
            const attThumb = e.target.closest && e.target.closest(".attachment-thumb");
            const attFile = e.target.closest && e.target.closest(".attachment-file");
            if (attThumb || attFile) {
                e.preventDefault();
                const href = (attThumb || attFile).getAttribute("href");
                // Intentar reconstruir metadatos mínimos del adjunto desde el contexto
                const name = (attThumb || attFile).getAttribute("title") || (attThumb || attFile).textContent || "adjunto";
                // tipo no está en el DOM; inferencia básica por extensión
                const ext = href.split(".").pop().toLowerCase();
                const mimeByExt = {
                    png: "image/png",
                    jpg: "image/jpeg",
                    jpeg: "image/jpeg",
                    gif: "image/gif",
                    webp: "image/webp",
                    pdf: "application/pdf",
                };
                const type = mimeByExt[ext] || "";
                this.openAttachmentModal({ url: href, name, type });
                return;
            }
            const btnReply = e.target.closest(".btn-reply");
            const btnReport = e.target.closest(".btn-report");
            const btnReplyToReply = e.target.closest(".btn-reply-to-reply");
            const btnDeleteReply = e.target.closest(".btn-delete-reply");
            const btnToggleReplies = e.target.closest(".btn-toggle-replies");
            const btnReportReply = e.target.closest(".btn-report-reply");

            if (btnToggleReplies) {
                const replyId = btnToggleReplies.dataset.replyId;
                const subRepliesEl = this.el.postsContainer.querySelector(`.sub-replies[data-reply-id="${replyId}"]`);

                if (subRepliesEl) {
                    const isHidden = subRepliesEl.style.display === "none";
                    subRepliesEl.style.display = isHidden ? "block" : "none";

                    // Contar respuestas
                    const replyCount = subRepliesEl.querySelectorAll(".reply").length;
                    btnToggleReplies.textContent = isHidden ? `Ocultar respuestas (${replyCount})` : `Ver respuestas (${replyCount})`;
                }
                return;
            }

            if (btnReply) {
                const messageId = btnReply.dataset.messageId;
                const replyTo = btnReply.dataset.replyTo;
                const replyId = btnReply.dataset.replyId;
                this.openReplyModal(messageId, replyTo, null, replyId);
                return;
            }

            if (btnReport) {
                const messageId = btnReport.dataset.messageId;
                if (!messageId) return;
                try {
                    const res = await fetch(`/api/messages/${encodeURIComponent(messageId)}/report`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ reason: "" }),
                    });
                    if (!res.ok) {
                        if (res.status === 409) {
                            // Ya reportado por este usuario
                            toast("Ya has reportado este mensaje");
                            // marcar en el conjunto local y aplicar clase visual 'reported'
                            if (!this.reportedSet) this.reportedSet = new Set();
                            this.reportedSet.add(String(messageId));
                            btnReport.classList.add("reported");
                            btnReport.textContent = "Reportado";
                            // no mostrar contadores en la vista principal; solo cambiar estado visual
                            // (el modal muestra el conteo)
                            return;
                        }
                        toast("Error reportando el mensaje");
                        return;
                    }
                    toast("Mensaje reportado");
                    // marcar en el conjunto local y aplicar clase visual 'reported'
                    if (!this.reportedSet) this.reportedSet = new Set();
                    this.reportedSet.add(String(messageId));
                    btnReport.classList.add("reported");
                    btnReport.textContent = "Reportado";
                    // no mostrar contadores en la vista principal; solo cambiar estado visual
                } catch (err) {
                    console.error(err);
                    toast("Error reportando el mensaje");
                }
                return;
            }

            if (btnReplyToReply) {
                const parentId = btnReplyToReply.dataset.parentId;
                const replyTo = btnReplyToReply.dataset.replyTo;
                const replyId = btnReplyToReply.dataset.replyId;
                this.openReplyModal(parentId, replyTo, replyTo, replyId);
                return;
            }

            if (btnReportReply) {
                const parentId = btnReportReply.dataset.parentId;
                const replyId = btnReportReply.dataset.replyId;
                if (!parentId || !replyId) return;
                try {
                    const res = await fetch(`/api/messages/${encodeURIComponent(parentId)}/reply/${encodeURIComponent(replyId)}/report`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ reason: "" }),
                    });
                    if (!res.ok) {
                        if (res.status === 409) {
                            toast("Ya has reportado esta respuesta");
                            // marcar estado visual como reportado
                            if (!this.reportedRepliesSet) this.reportedRepliesSet = new Set();
                            this.reportedRepliesSet.add(`${parentId}:${replyId}`);
                            btnReportReply.classList.add("reported");
                            btnReportReply.textContent = "Reportado";
                            btnReportReply.setAttribute("title", "Ya reportado");
                            return;
                        }
                        toast("Error reportando la respuesta");
                        return;
                    }
                    toast("Respuesta reportada");
                    // marcar estado visual como reportado
                    if (!this.reportedRepliesSet) this.reportedRepliesSet = new Set();
                    this.reportedRepliesSet.add(`${parentId}:${replyId}`);
                    btnReportReply.classList.add("reported");
                    btnReportReply.textContent = "Reportado";
                    btnReportReply.setAttribute("title", "Ya reportado");
                } catch (err) {
                    console.error("Error reportando respuesta:", err);
                    toast("Error reportando la respuesta");
                }
                return;
            }
            if (btnDeleteReply) {
                const parentId = btnDeleteReply.dataset.parentId;
                const replyId = btnDeleteReply.dataset.replyId;

                if (!confirm("¿Deseas borrar esta respuesta?")) return;

                try {
                    const res = await fetch(`/api/messages/${encodeURIComponent(parentId)}/reply/${encodeURIComponent(replyId)}`, {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                    });

                    if (res.status === 403) {
                        toast("No tienes permisos para borrar esta respuesta");
                        return;
                    }
                    if (res.status === 400) {
                        const data = await res.json();
                        toast(data.error || "No puedes borrar esta respuesta porque hay respuestas a ella");
                        return;
                    }
                    if (!res.ok) {
                        toast("Error al borrar la respuesta");
                        return;
                    }

                    // Recargar mensajes
                    const rPosts = await fetch(`/api/subjects/${this.subject.id}/posts`);
                    const messages = rPosts.ok ? await rPosts.json() : [];
                    this.renderMessages(messages);
                    this.syncUnreadWithMessages(messages);

                    toast("Respuesta borrada");
                } catch (err) {
                    console.error("Error borrando respuesta:", err);
                    toast("Error al borrar la respuesta");
                }
                return;
            }

            // (el handler de btnReportReply ya gestiona el estado visual arriba)
        });

        // Formulario de respuesta con adjuntos
        this.el.replyForm?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const messageId = this.el.replyMessageId.value;
            const content = this.el.replyContent.value.trim();
            const replyToUser = this.el.replyToUser.value || null;
            const replyToId = this.el.replyToId?.value || null;

            if (!content) {
                toast("Escribe una respuesta");
                return;
            }

            try {
                const fd = new FormData();
                fd.append("content", content);
                if (replyToUser) fd.append("replyToUser", replyToUser);
                if (replyToId) fd.append("replyToId", replyToId);
                const files = document.getElementById("replyAttachments")?.files || [];
                const maxFiles = 5;
                const maxSize = 5 * 1024 * 1024;
                for (let i = 0; i < Math.min(files.length, maxFiles); i++) {
                    const f = files[i];
                    if (f.size > maxSize) {
                        toast(`Archivo demasiado grande: ${f.name}`);
                        return;
                    }
                    fd.append("attachments", f, f.name);
                }
                const res = await fetch(`/api/messages/${encodeURIComponent(messageId)}/reply`, {
                    method: "POST",
                    body: fd,
                });
                if (!res.ok) throw new Error("Error al enviar respuesta");
                const created = await res.json();

                if (created && created.filtered) {
                    toast("Tu respuesta contiene palabras filtradas y no se ha publicado");
                    // mantener texto para edición
                    return;
                }

                // Recargar mensajes para mostrar la nueva respuesta
                const rPosts = await fetch(`/api/subjects/${this.subject.id}/posts`);
                const messages = rPosts.ok ? await rPosts.json() : [];
                this.renderMessages(messages);
                this.syncUnreadWithMessages(messages);

                this.closeModal("#replyModal");
                this.el.replyForm.reset();
                toast("Respuesta publicada");
            } catch (err) {
                console.error(err);
                toast("Error al publicar respuesta");
            }
        });

        // Close modals
        $$("[data-close]").forEach((btn) =>
            btn.addEventListener("click", () => {
                const sel = btn.getAttribute("data-close");
                this.closeModal(sel);
            })
        );
    },

    renderSwatches() {
        const box = this.el.p_swatches;
        box.innerHTML = "";
        PRESET_COLORS.forEach((c) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "swatch";
            b.style.background = c;
            b.dataset.color = c;
            b.addEventListener("click", () => {
                this.selectColor(c);
                this.el.p_color.value = c;
            });
            box.appendChild(b);
        });

        this.el.p_color.addEventListener("input", () => {
            this.selectColor(this.el.p_color.value);
        });
    },

    selectColor(color) {
        const sws = Array.from(this.el.p_swatches.querySelectorAll(".swatch"));
        sws.forEach((s) => s.classList.toggle("selected", s.dataset.color.toLowerCase() === (color || "").toLowerCase()));
    },

    openModal(sel) {
        const m = $(sel);
        if (m) m.style.display = "grid";
    },

    closeModal(sel) {
        const m = $(sel);
        if (m) m.style.display = "none";
    },

    // Abre modal de adjunto con vista previa
    openAttachmentModal(att) {
        try {
            const modal = document.getElementById("attachmentModal");
            const preview = document.getElementById("attachmentPreview");
            const download = document.getElementById("attachmentDownload");
            if (!modal || !preview || !download) return;
            preview.innerHTML = "";
            const url = att.url;
            const name = this.escapeHtml(att.name || "adjunto");
            const type = att.type || "";
            // Establecer destino de descarga
            download.setAttribute("href", url);
            download.setAttribute("download", name);
            // Renderizar según tipo
            if (/^image\//.test(type)) {
                const img = document.createElement("img");
                img.src = url;
                img.alt = name;
                img.style.maxWidth = "min(820px, 94vw)";
                img.style.maxHeight = "56vh";
                img.style.objectFit = "contain";
                img.style.borderRadius = "12px";
                preview.appendChild(img);
            } else {
                // Para otros tipos, mostrar nombre y un iframe si es seguro (pdf)
                const label = document.createElement("div");
                label.textContent = name;
                label.style.fontWeight = "700";
                preview.appendChild(label);
                if (/pdf$/i.test(name) || /application\/pdf/.test(type)) {
                    const iframe = document.createElement("iframe");
                    iframe.src = url;
                    iframe.style.width = "min(820px, 94vw)";
                    iframe.style.height = "56vh";
                    iframe.style.border = "0";
                    preview.appendChild(iframe);
                }
            }
            this.openModal("#attachmentModal");
        } catch (e) {
            console.error("Error abriendo adjunto", e);
            window.open(att.url, "_blank");
        }
    },

    openReplyModal(messageId, replyTo, replyToUser, replyToId) {
        // Al iniciar la acción de comentar, parar y limpiar cualquier animación de contexto activa
        try {
            this.clearContextHighlight && this.clearContextHighlight();
        } catch (e) {}
        this.el.replyMessageId.value = messageId;
        this.el.replyToUser.value = replyToUser || "";
        this.el.replyToId.value = replyToId || "";
        this.el.replyToHint.textContent = replyToUser ? `Respondiendo a @${replyToUser}` : `Respondiendo a ${replyTo}`;
        this.el.replyContent.value = "";
        this.openModal("#replyModal");
    },
};

/** =========================
 *  Initialize
 *  ========================= */
document.addEventListener("DOMContentLoaded", () => {
    // Aplicar tema lo antes posible
    document.documentElement.setAttribute("data-theme", store.getTheme());
    // Hidratar sesión desde el servidor si está disponible (incluye role)
    try {
        const el = document.getElementById("__initialUser");
        if (el) {
            const raw = (el.textContent || "").trim();
            if (raw) {
                // Sobrescribe/establece la sesión para asegurar que role esté presente
                store.setSession(raw);
            }
        }
    } catch (e) {
        // noop
    }

    // Inicializar la app
    forumApp.init();
});

// Sincronizar tema entre pestañas
window.addEventListener("storage", (e) => {
    if (e.key === "theme") {
        const next = e.newValue || "dark";
        document.documentElement.setAttribute("data-theme", next);
    }
});

// On forum page load, expand reply/message context if location.hash matches
window.addEventListener("DOMContentLoaded", () => {
    // Aplicar el mismo flujo de contexto (scroll + delay + fade) que usamos al abrir desde el modal
    setTimeout(() => {
        if (typeof forumApp.applyHashContext === "function") {
            forumApp.applyHashContext();
        }
    }, 0);

    // Configurar modal de duración de baneo
    const banDurationModal = document.getElementById("banDurationModal");
    const closeBanModalBtn = document.getElementById("closeBanModal");
    const cancelBanBtn = document.getElementById("cancelBan");
    const banDurationOptions = document.getElementById("banDurationOptions");

    if (closeBanModalBtn) {
        closeBanModalBtn.addEventListener("click", () => {
            if (banDurationModal) banDurationModal.classList.remove("show");
        });
    }

    if (cancelBanBtn) {
        cancelBanBtn.addEventListener("click", () => {
            if (banDurationModal) banDurationModal.classList.remove("show");
        });
    }

    // Cerrar modal al hacer clic fuera del contenido
    if (banDurationModal) {
        banDurationModal.addEventListener("click", (e) => {
            if (e.target === banDurationModal) {
                banDurationModal.classList.remove("show");
            }
        });
    }

    // Método para mostrar el modal de duración de baneo
    if (typeof forumApp !== "undefined") {
        forumApp.showBanDurationModal = function (userEmail, messageId, replyId) {
            const modal = document.getElementById("banDurationModal");
            const userEmailEl = document.getElementById("banUserEmail");
            const optionsContainer = document.getElementById("banDurationOptions");

            if (!modal || !userEmailEl || !optionsContainer) return;

            // Establecer email del usuario
            userEmailEl.textContent = userEmail;

            const targetMessageId = messageId ? String(messageId) : null;
            const targetReplyId = replyId ? String(replyId) : null;

            // Limpiar listeners anteriores
            const newOptionsContainer = optionsContainer.cloneNode(true);
            optionsContainer.parentNode.replaceChild(newOptionsContainer, optionsContainer);

            // Añadir listeners a las opciones
            newOptionsContainer.querySelectorAll(".ban-option").forEach((option) => {
                option.addEventListener("click", async () => {
                    const hours = parseFloat(option.dataset.hours);
                    let banDuration = null;
                    let durationText = "permanentemente";

                    if (hours > 0) {
                        banDuration = hours * 60 * 60 * 1000; // Convertir a milisegundos
                        if (hours === 1) durationText = "por 1 hora";
                        else if (hours === 24) durationText = "por 24 horas (1 día)";
                        else if (hours === 168) durationText = "por 7 días";
                        else if (hours === 720) durationText = "por 30 días";
                        else durationText = `por ${hours} horas`;
                    }

                    if (!confirm(`¿Banear a ${userEmail} ${durationText}?`)) return;

                    // Cerrar modal
                    modal.classList.remove("show");

                    // Realizar el baneo
                    try {
                        const response = await fetch("/api/users/ban", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email: userEmail, banDuration: banDuration, messageId: targetMessageId, replyId: targetReplyId }),
                        });

                        if (!response.ok) {
                            const err = await response.json().catch(() => ({}));
                            throw err || { message: "Error" };
                        }

                        let deletedContentType = null; // 'message' | 'reply'
                        let deleteFailed = false;
                        let deleteErrorMessage = null;

                        if (targetReplyId) {
                            if (!targetMessageId) {
                                deleteFailed = true;
                                deleteErrorMessage = "no se pudo borrar la respuesta (ID de mensaje no disponible)";
                            } else {
                                try {
                                    const deleteResponse = await fetch(`/api/messages/${encodeURIComponent(targetMessageId)}/reply/${encodeURIComponent(targetReplyId)}`, { method: "DELETE" });
                                    if (deleteResponse.status === 404) {
                                        deletedContentType = "reply";
                                    } else if (!deleteResponse.ok) {
                                        const deleteErr = await deleteResponse.json().catch(() => ({}));
                                        throw deleteErr || { message: "Error" };
                                    } else {
                                        deletedContentType = "reply";
                                    }
                                    await this.refreshPostsAfterModeration();
                                } catch (deleteErr) {
                                    deleteFailed = true;
                                    deleteErrorMessage = deleteErr && deleteErr.error && deleteErr.error.message ? deleteErr.error.message : deleteErr?.message || null;
                                    console.error("Error borrando respuesta tras baneo:", deleteErr);
                                }
                            }
                        } else if (targetMessageId) {
                            try {
                                const deleteResponse = await fetch(`/api/messages/${encodeURIComponent(targetMessageId)}`, { method: "DELETE" });
                                if (deleteResponse.status === 404) {
                                    deletedContentType = "message";
                                } else if (!deleteResponse.ok) {
                                    const deleteErr = await deleteResponse.json().catch(() => ({}));
                                    throw deleteErr || { message: "Error" };
                                } else {
                                    deletedContentType = "message";
                                }
                                try {
                                    const postEl = document.querySelector(`#msg-${CSS.escape(targetMessageId)}`);
                                    if (postEl) postEl.remove();
                                } catch (e) {}
                                this.updateEmptyHint && this.updateEmptyHint();
                                await this.refreshPostsAfterModeration();
                            } catch (deleteErr) {
                                deleteFailed = true;
                                deleteErrorMessage = deleteErr && deleteErr.error && deleteErr.error.message ? deleteErr.error.message : deleteErr?.message || null;
                                console.error("Error borrando mensaje tras baneo:", deleteErr);
                            }
                        }

                        if (deletedContentType === "message") {
                            toast("Usuario baneado y mensaje borrado");
                        } else if (deletedContentType === "reply") {
                            toast("Usuario baneado y respuesta borrada");
                        } else if (deleteFailed) {
                            const fallback = deleteErrorMessage ? `Usuario baneado, pero ${deleteErrorMessage}` : targetReplyId ? "Usuario baneado, pero no se pudo borrar la respuesta" : "Usuario baneado, pero no se pudo borrar el mensaje";
                            toast(fallback);
                        } else {
                            toast("Usuario baneado correctamente");
                        }
                        await this.fetchAndRenderReports();
                    } catch (err) {
                        console.error("Error baneando usuario:", err);
                        toast(err && err.error && err.error.message ? err.error.message : "Error al banear usuario");
                    }
                });
            });

            // Mostrar modal
            modal.classList.add("show");
        };
    }
});
