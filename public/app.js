/*!
 * Start Bootstrap - Shop Homepage v5.0.6 (https://startbootstrap.com/template/shop-homepage)
 * Copyright 2013-2023 Start Bootstrap
 * Licensed under MIT (https://github.com/StartBootstrap/startbootstrap-shop-homepage/blob/master/LICENSE)
 */
// This file is intentionally blank
// Use this file to add JavaScript to your project

/** =========================
 * Datos base
 * ========================= */
// removed static client SUBJECTS - will be loaded from server
let SUBJECTS = [];

/** =========================
 * Helpers
 * ========================= */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
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
const hash = (s) => btoa(unescape(encodeURIComponent(s)));

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

const normalizeEmail = (value) =>
    String(value || "")
        .trim()
        .toLowerCase();

const subjectHasStudent = (subject, email) => {
    if (!subject || !email) return false;
    const normalizedTarget = normalizeEmail(email);
    if (!normalizedTarget) return false;
    const { students } = subject;
    if (Array.isArray(students)) {
        return students.some((entry) => normalizeEmail(entry) === normalizedTarget);
    }
    if (typeof students === "string") {
        return normalizeEmail(students) === normalizedTarget;
    }
    return false;
};

const userCanAccessSubject = (user, subject) => {
    if (!user || !subject) return false;
    if (user.role === "admin") return true;
    if (isSubjectAdmin(user, subject)) return true;
    return subjectHasStudent(subject, user.email);
};

// 🎨 Presets de color para el avatar
const PRESET_COLORS = ["#6366f1", "#06b6d4", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6", "#0ea5e9", "#14b8a6"];

// Mensajes de error
const ERROR_MESSAGES = {
    1: "No existe ninguna cuenta con ese email.",
    2: "Contraseña incorrecta.",
    11: "Ya existe una cuenta con ese email.",
};

// HSL (antiguo) -> HEX (para compatibilidad)
function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0,
        g = 0,
        b = 0;
    if (0 <= h && h < 60) {
        r = c;
        g = x;
        b = 0;
    } else if (60 <= h && h < 120) {
        r = x;
        g = c;
        b = 0;
    } else if (120 <= h && h < 180) {
        r = 0;
        g = c;
        b = x;
    } else if (180 <= h && h < 240) {
        r = 0;
        g = x;
        b = c;
    } else if (240 <= h && h < 300) {
        r = x;
        g = 0;
        b = c;
    } else {
        r = c;
        g = 0;
        b = x;
    }
    const to255 = (n) => Math.round((n + m) * 255);
    const hex = (n) => n.toString(16).padStart(2, "0");
    return "#" + hex(to255(r)) + hex(to255(g)) + hex(to255(b));
}
function getAvatarBg(user) {
    if (user?.avatarColor) return user.avatarColor;
    const h = user?.hue ?? 210;
    return hslToHex(h, 85, 60);
}

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
        } catch (e) {
            // almacenamiento lleno o no disponible → ignorar
        }
    };

    const normalizeIso = (value) => {
        const ts = Date.parse(value);
        return Number.isNaN(ts) ? null : new Date(ts).toISOString();
    };

    return {
        get(email, subjectId) {
            const state = readState(email);
            return state[sanitizeSubject(subjectId)] || null;
        },
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
        computeUnread(email, subjectId, stats = {}) {
            const keySubject = sanitizeSubject(subjectId);
            const keyEmail = sanitizeEmail(email);
            const totalRaw = Number(stats?.totalMessages ?? 0);
            const total = Number.isFinite(totalRaw) ? Math.max(0, totalRaw) : 0;
            const lastMessageAt = normalizeIso(stats?.lastMessageAt);
            if (!keySubject || !keyEmail) {
                return {
                    count: 0,
                    totalMessages: total,
                    lastMessageAt,
                    preview: stats?.lastMessagePreview || "",
                    author: stats?.lastMessageAuthor || "",
                    kind: stats?.lastMessageKind || null,
                };
            }
            const state = readState(keyEmail);
            const entry = state[keySubject];
            let count = total;
            if (entry) {
                const lastTotal = Number(entry.lastTotal);
                if (Number.isFinite(lastTotal)) {
                    count = total - lastTotal;
                }
                if (count < 0) count = 0;
                if (lastMessageAt) {
                    const seen = entry.lastSeenAt ? Date.parse(entry.lastSeenAt) : null;
                    const event = Date.parse(lastMessageAt);
                    if (seen !== null && !Number.isNaN(seen) && !Number.isNaN(event) && event <= seen) {
                        count = 0;
                    }
                }
            }
            if (!entry && total === 0) count = 0;
            const cappedCount = count > 999 ? 999 : count;
            return {
                count: cappedCount,
                totalMessages: total,
                lastMessageAt,
                preview: stats?.lastMessagePreview || "",
                author: stats?.lastMessageAuthor || "",
                kind: stats?.lastMessageKind || null,
            };
        },
    };
}

const unreadTracker = (typeof window !== "undefined" && window.__unreadTracker) || createUnreadTracker();
if (typeof window !== "undefined") {
    window.__unreadTracker = unreadTracker;
}

const store = {
    getSession() {
        return JSON.parse(sessionStorage.getItem("session") || "null");
    },
    setSession(user) {
        sessionStorage.setItem("session", user);
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
    getFavourites() {
        const sess = this.getSession();
        const favs = sess && Array.isArray(sess.favourites) ? sess.favourites : [];
        return favs;
    },
    setFavourites(favourites) {
        const user = this.getSession();
        user.favourites = favourites;
        this.setSession(JSON.stringify(user));
    },
    setColor(color) {
        const user = this.getSession();
        user.color = color;
        this.setSession(JSON.stringify(user));
    },
    getColor() {
        return this.getSession().color;
    },
};

// Aplicar el tema guardado lo antes posible (también en pantalla de login/registro)
try {
    document.documentElement.setAttribute("data-theme", store.getTheme());
} catch (e) {}

// limpiar por si hay residuos de otra vez
store.clearSession();

try {
    const el = document.getElementById("__initialUser");
    if (el) {
        const raw = el.textContent.trim();
        if (raw) {
            const u = JSON.parse(raw);
            if (u) store.setSession(raw);
        }
    }
} catch (e) {}

/** =========================
 * Autenticación (localStorage)
 * ========================= */
const authUI = {
    authSection: $("#auth"),
    appSection: $("#app"),
    pill: $("#switchPill"),
    btnLoginTab: $("#btnLoginTab"),
    btnRegisterTab: $("#btnRegisterTab"),
    loginForm: $("#loginForm"),
    registerForm: $("#registerForm"),
    formsWrap: $("#formsWrap"),
    loginError: $("#loginError"),
    registerError: $("#registerError"),
    swapToLogin: $("#swapToLogin"),

    setTab(tab) {
        const isLogin = tab === "login";
        this.btnLoginTab.classList.toggle("active", isLogin);
        this.btnRegisterTab.classList.toggle("active", !isLogin);

        this.loginForm.classList.toggle("active", isLogin);
        this.registerForm.classList.toggle("active", !isLogin);
        this.pill.style.transform = isLogin ? "translateX(0)" : "translateX(100%)";

        // Altura suave del contenedor de formularios
        requestAnimationFrame(() => {
            const active = isLogin ? this.loginForm : this.registerForm;
            const h = active.offsetHeight;
            this.formsWrap.style.height = h + "px";
        });
    },
    showApp() {
        if (this.authSection) this.authSection.style.display = "none";
        if (this.appSection) this.appSection.style.display = "block";
    },
    showAuth() {
        if (this.authSection) this.authSection.style.display = "flex";
        if (this.appSection) this.appSection.style.display = "none";
    },
    measureInit() {
        this.formsWrap.style.height = this.loginForm.offsetHeight + "px";
    },
};

if (authUI.btnLoginTab) authUI.btnLoginTab.addEventListener("click", () => authUI.setTab("login"));
if (authUI.btnRegisterTab) authUI.btnRegisterTab.addEventListener("click", () => authUI.setTab("register"));
if (authUI.swapToLogin)
    authUI.swapToLogin.addEventListener("click", (e) => {
        e.preventDefault();
        authUI.setTab("login");
    });

if (authUI.loginForm && authUI.registerForm && authUI.formsWrap) {
    window.addEventListener("resize", () => {
        // Mantener centrado y altura correcta en cambios de viewport
        const active = authUI.loginForm.classList.contains("active") ? authUI.loginForm : authUI.registerForm;
        authUI.formsWrap.style.height = active.offsetHeight + "px";
    });
}

// LOGIN
if (authUI.loginForm)
    authUI.loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        authUI.loginError.textContent = "";
        const email = $("#li_email").value.trim().toLowerCase();
        const pass = $("#li_pass").value;
        try {
            const response = await fetch("/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: email,
                    password: pass,
                }),
            });
            const data = await response.json();
            if (data.code !== 0) {
                authUI.loginError.textContent = ERROR_MESSAGES[data.code];
                return;
            }
            store.setSession(data.user);
        } catch (err) {
            console.log(err);
            authUI.loginError.textContent = "Error al conectar con el servidor.";
            return;
        }
        // store.setSession(email);
        toast("¡Bienvenido de nuevo!");
        app.init();
        authUI.showApp();
    });

// REGISTER → volver a login (sin iniciar sesión)
if (authUI.registerForm)
    authUI.registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        authUI.registerError.textContent = "";
        const name = $("#r_name").value.trim();
        const email = $("#r_email").value.trim().toLowerCase();
        const pass = $("#r_pass").value;
        const pass2 = $("#r_pass2").value;
        const bio = $("#r_bio").value.trim();

        if (pass.length < 6) {
            authUI.registerError.textContent = "La contraseña debe tener al menos 6 caracteres.";
            return;
        }
        if (pass !== pass2) {
            authUI.registerError.textContent = "Las contraseñas no coinciden.";
            return;
        }
        try {
            const response = await fetch("/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: email,
                    password: pass,
                    name: name,
                    bio: bio,
                }),
            });
            const data = await response.json();
            if (data.code !== 0) {
                toast(ERROR_MESSAGES[data.code]);
                authUI.loginError.textContent = ERROR_MESSAGES[data.code];
                return;
            }
            store.setSession(data.user);
        } catch (err) {
            console.log(err);
            authUI.loginError.textContent = "Error al conectar con el servidor.";
            return;
        }
        // const hue = Math.floor(Math.random()*360);
        // users[email] = { name, email, pass: hash(pass), bio, hue, theme: 'dark', favorites: [] };
        // store.setUsers(users);

        // Volver a login, pre-rellenar email y enfocar la contraseña
        authUI.registerForm.reset();
        toast("Cuenta creada.");
        app.init();
        authUI.showApp();
    });

/** =========================
 * APP
 * ========================= */
const app = {
    el: {
        profileBtn: $("#profileButton"),
        profileMenu: $("#profileMenu"),
        avatar: $("#avatar"),
        avatarInitials: $("#avatarInitials"),
        profileName: $("#profileName"),
        btnEditProfile: $("#btnEditProfile"),
        btnLogout: $("#btnLogout"),
        changePasswordbtn: $("#changePasswordbtn"),
        filterFavsBtn: $("#filterFavsBtn"),
        chipsRow: $("#chipsRow"),
        cardsGrid: $("#cardsGrid"),
        themeToggle: $("#themeToggle"),
        search: $("#searchInput"),
        // admin create subject
        btnOpenCreateSubject: $("#btnOpenCreateSubject"),
        createSubjectModal: $("#createSubjectModal"),
        // Campos crear asignatura (ya no se introduce id ni código manualmente)
        cs_name: $("#cs_name"),
        cs_desc: $("#cs_desc"),
        cs_long: $("#cs_long"),
        cs_credits: $("#cs_credits"),
        cs_prof: $("#cs_prof"),
        cs_sched: $("#cs_sched"),
        cs_color: $("#cs_color"),
        cs_iconFile: $("#cs_iconFile"),
        cs_swatches: $("#cs_swatches"),
        cs_save: $("#btnCreateSubject"),
        cs_error: $("#createSubjectError"),

        // modals
        profileModal: $("#profileModal"),
        p_name: $("#p_name"),
        p_bio: $("#p_bio"),
        p_color: $("#p_color"),
        p_swatches: $("#p_swatches"),
        saveProfile: $("#saveProfile"),
        forumModal: $("#forumModal"),
        forumTitle: $("#forumTitle"),
        posts: $("#posts"),
        newPost: $("#newPost"),
        sendPost: $("#sendPost"),
    },
    user: null,
    onlyFavs: false,
    activeChipId: null,

    init() {
        this.user = store.getSession();
        if (!this.user) {
            store.clearSession();
            authUI.showAuth();
            return;
        }
        document.documentElement.setAttribute("data-theme", store.getTheme());
        this.el.profileName.textContent = this.user.name || "Tu Nombre";
        this.el.avatar.style.background = store.getColor();
        this.el.avatarInitials.textContent = initialsOf(this.user.name || this.user.email);
        if (this.user.role === "admin" && this.el.btnOpenCreateSubject) {
            this.el.btnOpenCreateSubject.style.display = "inline-flex";
        }
        // Render favoritos solo si existe el grid (páginas como editPassword no lo tienen)
        this.renderFavDropdown();
        this.renderChips();
        if (!this.el.cardsGrid) {
            // ← guard: no hay área de tarjetas en esta página
            authUI.showApp();
            return;
        }
        this.renderCards();
        authUI.showApp();
    },

    /* ---------- Favorites ---------- */
    isFav(id) {
        return store.getFavourites().includes(id);
    },
    toggleFav(id) {
        const favs = new Set(store.getFavourites());
        favs.has(id) ? favs.delete(id) : favs.add(id);
        store.setFavourites(Array.from(favs));
        fetch("/updateFavourites", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                favourites: Array.from(favs),
            }),
        });
        this.renderFavDropdown();
        this.renderChips();
        this.renderCards();
    },

    renderFavDropdown() {
        // kept for compatibility but the UI no longer has a dropdown; this builds a simple list if needed elsewhere
        const session = this.user;
        const pool = session ? SUBJECTS.filter((s) => userCanAccessSubject(session, s)) : SUBJECTS;
        return pool.map((s) => ({ id: s.id, name: s.name, checked: this.isFav(s.id) }));
    },

    renderChips() {
        const chipsRow = this.el.chipsRow;
        if (!chipsRow) return; // ← guard: página sin chips/favoritos
        chipsRow.innerHTML = "";
        const favs = store.getFavourites();
        if (!favs || favs.length === 0) return;
        const session = this.user;
        favs.forEach((id) => {
            const subj = SUBJECTS.find((s) => s.id === id);
            if (!subj) return;
            if (session && !userCanAccessSubject(session, subj)) return;
            const chip = document.createElement("button");
            chip.className = "chip starred";
            if (this.activeChipId === id) chip.classList.add("selected");
            chip.innerHTML = `⭐ ${subj.name}`;
            chip.addEventListener("click", () => {
                this.activeChipId = this.activeChipId === id ? null : id;
                this.renderChips();
                this.renderCards();
            });
            chipsRow.appendChild(chip);
        });
    },

    /* ---------- Cards ---------- */
    renderCards(filterById) {
        const g = this.el.cardsGrid;
        if (!g) return; // ← guard: página sin grid (ej. editPassword)
        g.innerHTML = "";
        const q = (this.el.search?.value || "").toLowerCase().trim();
        const chipFilter = filterById !== undefined ? filterById : this.activeChipId;
        let list = SUBJECTS;
        if (this.user) {
            list = list.filter((s) => userCanAccessSubject(this.user, s));
        }
        list = list.filter((s) => !chipFilter || s.id === chipFilter);
        if (this.onlyFavs) list = list.filter((s) => this.isFav(s.id));
        if (q) list = list.filter((s) => s.name.toLowerCase().includes(q));
        list.sort((a, b) => {
            const af = this.isFav(a.id) ? 0 : 1;
            const bf = this.isFav(b.id) ? 0 : 1;
            return af - bf || a.name.localeCompare(b.name, "es");
        });
        if (list.length === 0) {
            const empty = document.createElement("div");
            empty.className = "hint";
            empty.style.padding = "12px";
            empty.textContent = "No hay resultados con ese filtro.";
            g.appendChild(empty);
            return;
        }
        const tpl = $("#cardTemplate");
        list.forEach((s) => {
            const node = tpl.content.firstElementChild.cloneNode(true);
            $("[data-title]", node).textContent = s.name;
            $("[data-desc]", node).textContent = s.desc;
            const icon = $("[data-bg]", node);
            icon.style.background = s.color;
            if (s.icon) icon.innerHTML = `<img src="${s.icon}" alt="Icono ${s.name} "/>`;
            const favBtn = $("[data-fav]", node);
            const updateFavVisual = () => {
                favBtn.textContent = this.isFav(s.id) ? "★" : "☆";
                favBtn.classList.toggle("active", this.isFav(s.id));
            };
            updateFavVisual();
            favBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleFav(s.id);
                updateFavVisual();
            });
            const detailsBtn = $("[data-details]", node);
            detailsBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `/subject/${encodeURIComponent(s.id)}/details`;
            });
            const enterBtn = $("[data-enter]", node);
            enterBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                window.location.href = `/subject/${encodeURIComponent(s.id)}/forum`;
            });

            const stats = s.forumStats || null;
            const unreadIndicator = $("[data-unread-indicator]", node);
            const unreadCountEl = $("[data-unread-count]", node);
            const email = this.user?.email || "";
            const resetUnreadUI = () => {
                node.classList.remove("card-has-unread");
                if (unreadIndicator) {
                    unreadIndicator.hidden = true;
                    unreadIndicator.style.display = "none";
                    unreadIndicator.removeAttribute("aria-label");
                    unreadIndicator.removeAttribute("role");
                }
                if (unreadCountEl) unreadCountEl.textContent = "";
            };

            if (stats && email && unreadIndicator && unreadCountEl) {
                const unreadInfo = unreadTracker.computeUnread(email, s.id, stats);
                const hasUnread = unreadInfo.count > 0;
                if (!hasUnread) {
                    resetUnreadUI();
                } else {
                    node.classList.add("card-has-unread");
                    const capped = unreadInfo.count > 99 ? "99+" : String(unreadInfo.count);
                    unreadIndicator.hidden = false;
                    unreadIndicator.style.display = "inline-flex";
                    unreadIndicator.setAttribute("aria-label", `${capped} ${unreadInfo.count === 1 ? "mensaje sin leer" : "mensajes sin leer"}`);
                    unreadIndicator.setAttribute("role", "status");
                    unreadCountEl.textContent = capped;
                }
            } else {
                resetUnreadUI();
            }
            g.appendChild(node);
        });
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
            console.log(err);
            authUI.loginError.textContent = "Error al conectar con el servidor.";
            return;
        }
    },

    /* ---------- Events wiring ---------- */
    wire() {
        // Profile menu
        this.el.profileBtn.addEventListener("click", () => {
            const open = this.el.profileMenu.style.display === "flex";
            this.el.profileMenu.style.display = open ? "none" : "flex";
            this.el.profileBtn.setAttribute("aria-expanded", String(!open));
        });
        document.addEventListener("click", (e) => {
            if (!e.target.closest(".profile")) this.el.profileMenu.style.display = "none";
        });

        // Edit profile
        this.el.btnEditProfile.addEventListener("click", () => {
            this.el.profileMenu.style.display = "none";
            // Rellenar
            this.el.p_name.value = this.user?.name || "";
            this.el.p_bio.value = this.user?.bio || "";
            // Pintar swatches + seleccionar actual
            this.renderSwatches();
            const current = store.getColor();
            this.selectColor(current);
            this.el.p_color.value = current;
            modals.open("#profileModal");
        });
        this.el.saveProfile.addEventListener("click", () => {
            const name = this.el.p_name.value.trim();
            const bio = this.el.p_bio.value.trim();
            const avatarColor = this.el.p_color.value;
            this.user.name = name;
            this.user.bio = bio;
            this.user.color = avatarColor;
            this.updateUser();
            store.setColor(avatarColor);
            //this.saveUser({ name, bio, avatarColor }); // guardamos hex
            // Refrescar UI
            this.el.profileName.textContent = this.user.name || "Tu Nombre";
            this.el.avatar.style.background = store.getColor();
            this.el.avatarInitials.textContent = initialsOf(this.user.name || this.user.email);
            toast("Perfil actualizado");
            modals.close("#profileModal");
            // Persistir sesión actualizada en sessionStorage
            try {
                store.setSession(JSON.stringify(this.user));
            } catch (e) {}
            // Si el foro está abierto, volver a renderizar los posts
            try {
                if (typeof forum !== "undefined" && forum.subject) forum.renderPosts();
            } catch (e) {
                // no bloquear si algo falla aquí
            }
        });

        // Logout
        this.el.btnLogout.addEventListener("click", async () => {
            store.clearSession();
            try {
                const response = await fetch("/logout", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });
                toast("Sesión cerrada");
            } catch (err) {
                console.log(err);
                authUI.loginError.textContent = "Error al conectar con el servidor.";
                return;
            }
            setTimeout(() => location.reload(), 400);
        });

        // Cambiar contraseña - redirigir a editPassword.html
        this.el.changePasswordbtn?.addEventListener("click", () => {
            window.location.href = "/editPassword";
        });

        // Filter favorites button (above the grid)
        this.el.filterFavsBtn?.addEventListener("click", () => {
            this.onlyFavs = !this.onlyFavs;
            this.el.filterFavsBtn.setAttribute("aria-pressed", String(this.onlyFavs));
            this.el.filterFavsBtn.classList.toggle("pressed", this.onlyFavs);
            // Actualizar estrella visual dentro del botón
            const star = this.el.filterFavsBtn.querySelector(".star");
            if (star) star.textContent = this.onlyFavs ? "★" : "☆";
            // Actualizar aria-label para accesibilidad
            this.el.filterFavsBtn.setAttribute("aria-label", this.onlyFavs ? "Mostrar solo favoritos (activado)" : "Mostrar solo favoritos (desactivado)");
            this.renderCards();
        });

        // Theme
        // Use a fresh lookup and guard in case the element wasn't present when app.el was created
        const themeBtn = this.el.themeToggle || $("#themeToggle");
        if (themeBtn) {
            themeBtn.addEventListener("click", () => {
                const next = store.getTheme() === "dark" ? "light" : "dark";
                store.setTheme(next);
                document.documentElement.setAttribute("data-theme", next);
            });
        }

        // Search
        this.el.search?.addEventListener("input", () => this.renderCards());

        // Password toggles (login / register)
        this.initPasswordToggles();

        // Admin: abrir modal crear asignatura
        if (this.el.btnOpenCreateSubject) {
            this.el.btnOpenCreateSubject.addEventListener("click", () => {
                if (this.user?.role !== "admin") return; // safety
                // Renderizar swatches cada vez (por si tema cambia)
                this.renderCreateSubjectSwatches();
                // Valor por defecto
                if (this.el.cs_color) this.el.cs_color.value = PRESET_COLORS[0];
                modals.open("#createSubjectModal");
            });
        }
        // Admin: guardar nueva asignatura
        if (this.el.cs_save) {
            this.el.cs_save.addEventListener("click", async () => {
                if (this.user?.role !== "admin") return;
                const name = (this.el.cs_name?.value || "").trim();
                if (!name) {
                    if (this.el.cs_error) this.el.cs_error.textContent = "El nombre es obligatorio";
                    return;
                }
                // Subir icono si hay archivo
                let iconPath = "";
                try {
                    const file = this.el.cs_iconFile?.files?.[0];
                    if (file) {
                        const fd = new FormData();
                        fd.append("icon", file);
                        const up = await fetch("/uploadIcon", { method: "POST", body: fd });
                        if (!up.ok) {
                            if (this.el.cs_error) this.el.cs_error.textContent = "Error subiendo icono";
                            return;
                        }
                        const upData = await up.json().catch(() => ({}));
                        iconPath = upData.path || "";
                    }
                } catch (e) {
                    console.error(e);
                    if (this.el.cs_error) this.el.cs_error.textContent = "Fallo al subir icono";
                    return;
                }

                const subject = {
                    name,
                    desc: (this.el.cs_desc?.value || "").trim(),
                    description: (this.el.cs_long?.value || "").trim(),
                    credits: Math.max(0, Number(this.el.cs_credits?.value || 0) || 0),
                    professor: (this.el.cs_prof?.value || "").trim(),
                    schedule: (this.el.cs_sched?.value || "").trim(),
                    color: (this.el.cs_color?.value || "").trim(),
                    icon: iconPath,
                };
                if (this.el.cs_error) this.el.cs_error.textContent = "";
                try {
                    const response = await fetch("/createSubject", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ subject }),
                    });
                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        if (response.status === 403) {
                            if (this.el.cs_error) this.el.cs_error.textContent = "No tienes permisos.";
                            return;
                        }
                    }
                    if (data.code !== 0) {
                        if (data.code === 21) {
                            // ya existía id generado (raro)
                            if (this.el.cs_error) this.el.cs_error.textContent = "Ya existe una asignatura con ese identificador.";
                        } else if (data.code === 23) {
                            if (this.el.cs_error) this.el.cs_error.textContent = "Falta el nombre";
                        } else {
                            if (this.el.cs_error) this.el.cs_error.textContent = "Error al crear asignatura (código " + data.code + ")";
                        }
                        return;
                    }
                    toast("Asignatura creada");
                    await loadSubjects();
                    this.renderCards();
                    // Limpiar formulario
                    const reset = (el, def = "") => {
                        if (el) el.value = def;
                    };
                    reset(this.el.cs_name);
                    reset(this.el.cs_desc);
                    reset(this.el.cs_long);
                    reset(this.el.cs_prof);
                    reset(this.el.cs_sched);
                    reset(this.el.cs_color);
                    if (this.el.cs_iconFile) this.el.cs_iconFile.value = "";
                    reset(this.el.cs_credits, 6);
                    modals.close("#createSubjectModal");
                } catch (err) {
                    console.error(err);
                    if (this.el.cs_error) this.el.cs_error.textContent = "Error de red al crear asignatura";
                }
            });
        }

        // AUTOCOMPLETADO DE PROFESORES
        if (this.el.cs_prof) {
            const profInput = this.el.cs_prof;
            const dataList = document.getElementById("professor-list");

            if (profInput && dataList) {
                profInput.addEventListener("input", async (e) => {
                    const val = e.target.value.trim();
                    if (val.length < 1) return; // Buscar desde la primera letra

                    try {
                        const res = await fetch(`/api/users/search?q=${encodeURIComponent(val)}`);
                        if (res.ok) {
                            const users = await res.json();
                            dataList.innerHTML = ""; // Limpiar
                            users.forEach((u) => {
                                const option = document.createElement("option");
                                option.value = u.email;
                                option.textContent = `${u.name} (${u.email})`;
                                dataList.appendChild(option);
                            });
                        }
                    } catch (err) {
                        console.error("Error buscando usuarios", err);
                    }
                });
            }
        }
    },

    /* ---------- Swatches helpers ---------- */
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
        // Input color en vivo
        this.el.p_color.addEventListener(
            "input",
            () => {
                this.selectColor(this.el.p_color.value);
            },
            { once: true }
        );
    },

    // Swatches para crear asignatura (independientes del perfil)
    renderCreateSubjectSwatches() {
        const box = this.el.cs_swatches;
        if (!box) return;
        box.innerHTML = "";
        PRESET_COLORS.forEach((c, idx) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "swatch";
            b.style.background = c;
            b.dataset.color = c;
            b.addEventListener("click", () => {
                this.el.cs_color.value = c;
                this.selectCreateSubjectColor(c);
            });
            box.appendChild(b);
        });
        // Listener para input manual
        if (this.el.cs_color) {
            this.el.cs_color.addEventListener("input", () => this.selectCreateSubjectColor(this.el.cs_color.value), { once: true });
        }
        // Seleccionar primero por defecto si vacío
        if (this.el.cs_color && !this.el.cs_color.value) {
            this.el.cs_color.value = PRESET_COLORS[0];
            this.selectCreateSubjectColor(PRESET_COLORS[0]);
        }
    },

    selectCreateSubjectColor(color) {
        const sws = Array.from(this.el.cs_swatches?.querySelectorAll(".swatch") || []);
        sws.forEach((s) => s.classList.toggle("selected", s.dataset.color.toLowerCase() === (color || "").toLowerCase()));
    },

    selectColor(color) {
        const sws = Array.from(this.el.p_swatches.querySelectorAll(".swatch"));
        sws.forEach((s) => s.classList.toggle("selected", s.dataset.color.toLowerCase() === (color || "").toLowerCase()));
    },

    initPasswordToggles() {
        // Mostrar contraseña solo mientras se mantiene pulsado el botón (mouse o touch)
        const addSlash = (svg) => {
            if (!svg) return;
            if (!svg.querySelector("path[data-hide]")) {
                const slash = document.createElementNS("http://www.w3.org/2000/svg", "path");
                slash.setAttribute("d", "M3 3L21 21");
                slash.setAttribute("stroke", "currentColor");
                slash.setAttribute("stroke-width", "2");
                slash.setAttribute("stroke-linecap", "round");
                slash.setAttribute("data-hide", "");
                svg.appendChild(slash);
            }
        };
        const removeSlash = (svg) => {
            if (!svg) return;
            const hideEl = svg.querySelector("path[data-hide]");
            if (hideEl) hideEl.remove();
        };
        const showWhileHold = (btn) => {
            const id = btn.getAttribute("data-pw-toggle");
            const input = document.getElementById(id);
            if (!input) return;
            input.type = "text";
            btn.setAttribute("aria-label", "Ocultar contraseña");
            removeSlash(btn.querySelector("svg")); // ojo normal por defecto
            addSlash(btn.querySelector("svg")); // tachado solo mientras se mantiene
        };
        const hideOnRelease = (btn) => {
            const id = btn.getAttribute("data-pw-toggle");
            const input = document.getElementById(id);
            if (!input) return;
            input.type = "password";
            btn.setAttribute("aria-label", "Mostrar contraseña");
            removeSlash(btn.querySelector("svg"));
        };
        document.querySelectorAll("[data-pw-toggle]")?.forEach((btn) => {
            // Evitar persistente: no usamos click toggle
            btn.addEventListener("mousedown", (e) => {
                if (e.button !== 0) return;
                showWhileHold(btn);
            });
            btn.addEventListener("mouseup", () => hideOnRelease(btn));
            btn.addEventListener("mouseleave", () => hideOnRelease(btn));
            // Touch support
            btn.addEventListener(
                "touchstart",
                (e) => {
                    e.preventDefault();
                    showWhileHold(btn);
                },
                { passive: false }
            );
            const touchEnd = () => hideOnRelease(btn);
            btn.addEventListener("touchend", touchEnd);
            btn.addEventListener("touchcancel", touchEnd);
            // Keyboard (espacio)
            btn.addEventListener("keydown", (e) => {
                if (e.code === "Space" || e.key === " ") {
                    e.preventDefault();
                    showWhileHold(btn);
                }
            });
            btn.addEventListener("keyup", (e) => {
                if (e.code === "Space" || e.key === " ") {
                    hideOnRelease(btn);
                }
            });
        });
    },
};

/** =========================
 * Forum logic (cards desactivadas por ahora)
 * ========================= */
const forum = {
    subject: null,
    open(s) {
        this.subject = s;
        $("#forumTitle").textContent = `Foro — ${s.name}`;
        this.renderPosts();
        modals.open("#forumModal");
    },
    renderPosts() {
        const email = app.sessionEmail;
        const posts = store.getPosts(email, this.subject.id);
        const wrap = $("#posts");
        wrap.innerHTML = "";
        if (posts.length === 0) {
            const ph = document.createElement("div");
            ph.className = "hint";
            ph.textContent = "Aún no hay mensajes. ¡Sé el primero!";
            wrap.appendChild(ph);
        } else {
            posts.forEach((p) => {
                const item = document.createElement("div");
                item.className = "post";
                item.innerHTML = `
              <div class="meta">
                <div class="avatar" style="width:22px;height:22px;border-radius:7px;background:${getAvatarBg(app.user)}"></div>
                <strong>${app.user.name}</strong>
                <span>•</span>
                <span>${new Date(p.ts).toLocaleString()}</span>
              </div>
              <div class="text">${escapeHtml(p.text)}</div>
            `;
                wrap.appendChild(item);
            });
        }
    },
    send() {
        const text = ($("#newPost").value || "").trim();
        if (!text) {
            toast("Escribe un mensaje");
            return;
        }
        const email = app.sessionEmail;
        const list = store.getPosts(email, this.subject.id);
        list.push({ text, ts: Date.now() });
        store.setPosts(email, this.subject.id, list);
        $("#newPost").value = "";
        this.renderPosts();
        toast("Mensaje publicado");
    },
};

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

/** =========================
 * Modals
 * ========================= */
const modals = {
    open(sel) {
        const m = $(sel);
        if (!m) return;
        m.style.display = "grid";
    },
    close(sel) {
        const m = $(sel);
        if (!m) return;
        m.style.display = "none";
    },
};
$$("[data-close]").forEach((btn) =>
    btn.addEventListener("click", () => {
        const sel = btn.getAttribute("data-close");
        modals.close(sel);
    })
);
const sendPostBtn = $("#sendPost");
if (sendPostBtn) sendPostBtn.addEventListener("click", () => forum.send());

/** =========================
 * Start
 * ========================= */
app.wire();
// Medir altura inicial del bloque de forms y garantizar centrado (solo si existe la sección de auth)
if (authUI.authSection) {
    authUI.measureInit();
    authUI.setTab("login");
}

// Handler del formulario de cambio de contraseña
const passwordForm = document.getElementById("newPasswordForm");
if (passwordForm) {
    passwordForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const oldPassword = document.getElementById("contraseñaActual").value;
        const newPassword = document.getElementById("nuevaContraseña").value;
        const confirmar = document.getElementById("confirmarContraseña").value;

        if (!oldPassword) {
            toast("Debes ingresar tu contraseña actual");
            return;
        }

        if (!newPassword) {
            toast("Debes ingresar una nueva contraseña");
            return;
        }
        if (newPassword.length < 6) {
            toast("La nueva contraseña debe tener al menos 6 caracteres");
            return;
        }

        if (!confirmar) {
            toast("Debes confirmar la nueva contraseña");
            return;
        }

        if (newPassword !== confirmar) {
            toast("Las contraseñas nuevas no coinciden");
            return;
        }

        try {
            const respuesta = await fetch("/changePassword", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ oldPassword, newPassword }),
            });

            const data = await respuesta.json();

            if (data.code === 0) {
                alert("Contraseña cambiada correctamente");
                passwordForm.reset(); //vaciar el formulario

                // Redirigir a la página principal
                window.location.href = "/";
            } else if (data.code === 2) {
                alert("La contraseña actual es incorrecta");
            } else {
                alert("Ocurrió un error al cambiar la contraseña");
            }
        } catch (err) {
            console.error(err);
            alert("Error al comunicarse con el servidor");
        }
    });
}

async function loadSubjects() {
    try {
        const response = await fetch("/api/subjects");
        if (!response.ok) throw new Error("Error al obtener asignaturas");
        const subjects = await response.json();

        // Guardarlas en la variable global
        SUBJECTS = subjects;

        // Renderizar las tarjetas en el HTML
        //app.renderCards();

        return subjects;
    } catch (err) {
        console.error("Error cargando asignaturas:", err);
        return [];
    }
}

// cargar asignaturas y luego inicializar la app (sin hidratación de detalles)
loadSubjects()
    .then(() => {
        if (store.getSession()) {
            app.init();
            if (authUI.authSection) authUI.showApp();
        } else {
            if (authUI.authSection) authUI.showAuth();
        }
        // Hidratación cliente eliminada: confiamos en render del servidor
        // (bloque hydrateSubjectDetailsFromClient removido)
    })
    .catch((err) => {
        console.error(err);
        if (store.getSession()) {
            app.init();
            authUI.showApp();
        } else {
            authUI.showAuth();
        }
    });

// Escuchar cambios de theme desde otras pestañas y sincronizar
window.addEventListener("storage", (e) => {
    if (e.key === "theme") {
        const next = e.newValue || "dark";
        document.documentElement.setAttribute("data-theme", next);
        // Emitir event para que la app re-renderice si está activa
        try {
            window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: next } }));
        } catch (err) {}
    }
    if (e.key && e.key.startsWith("urjconnect:reads:")) {
        try {
            const session = store.getSession();
            const email = session?.email ? String(session.email).trim().toLowerCase() : "";
            if (email && e.key.endsWith(email)) {
                app.renderCards && app.renderCards();
            }
        } catch (err) {
            // noop
        }
    }
});

// Formatear fecha de baneo en la página banned.html
(function () {
    const bannedUntilDateEl = document.getElementById("bannedUntilDate");
    if (bannedUntilDateEl) {
        const bannedUntilISO = bannedUntilDateEl.dataset.bannedUntil;
        if (bannedUntilISO) {
            const date = new Date(bannedUntilISO);
            const formatted = date.toLocaleString("es-ES", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
            });
            bannedUntilDateEl.textContent = formatted;
        }
    }
})();
