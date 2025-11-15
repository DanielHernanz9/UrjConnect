/** =========================
 *  Forum Page Client-Side Logic
 *  ========================= */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const PRESET_COLORS = ["#6366f1", "#06b6d4", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6", "#0ea5e9", "#14b8a6"];

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
    getColor() {
        return this.getSession()?.color || "#6366f1";
    },
};

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
    },
    user: null,
    subject: null,

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

        if (this.user.role === "admin" && this.el.deleteForumForm) {
            this.el.deleteForumForm.style.display = "block";
        }

        // Cargar información del foro
        this.loadForumData();

        // Wire events
        this.wire();
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

            // Aquí se cargarían los mensajes del foro desde el servidor
            // Por ahora mostramos el placeholder
            this.renderMessages([]);
        } catch (err) {
            console.error("Error cargando datos del foro:", err);
            toast("Error al cargar el foro");
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
        messages.forEach((msg) => {
            const messageEl = document.createElement("div");
            messageEl.className = "post";
            messageEl.innerHTML = `
                <div class="post-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px">
                    <div class="avatar" style="width: 32px; height: 32px; border-radius: 8px; background: ${msg.userColor || "#6366f1"}; display: grid; place-items: center; color: #0b0e12; font-weight: 900; font-size: 14px">
                        ${initialsOf(msg.userName)}
                    </div>
                    <div style="flex: 1">
                        <div style="font-weight: 700; font-size: 15px">${msg.userName}</div>
                        <div style="font-size: 12px; color: var(--muted)">${new Date(msg.timestamp).toLocaleString()}</div>
                    </div>
                </div>
                <div class="post-title" style="font-weight: 700; font-size: 16px; margin-bottom: 8px">${this.escapeHtml(msg.title)}</div>
                <div class="post-content" style="white-space: pre-wrap; line-height: 1.6">${this.escapeHtml(msg.content)}</div>
            `;
            container.appendChild(messageEl);
        });
    },

    escapeHtml(str) {
        return str.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
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

        // Form submit (sin implementación, solo prevenir envío)
        this.el.newMessageForm?.addEventListener("submit", (e) => {
            e.preventDefault();
            toast("La funcionalidad de publicar mensajes aún no está implementada");
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
