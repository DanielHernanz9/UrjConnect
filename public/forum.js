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

            // Cargar mensajes del foro
            const rPosts = await fetch(`/api/subjects/${this.subject.id}/posts`);
            const messages = rPosts.ok ? await rPosts.json() : [];
            this.renderMessages(messages);
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
        // Obtener sesión local para poder sustituir nombre/color si el post es nuestro
        const session = store.getSession();
        messages.forEach((msg) => {
            const isMine = session && msg.userEmail && session.email && msg.userEmail === session.email;
            //Si tengo iniciada la sesión, muestro mi nombre y color actual, sino muestra los datos guardados al enviar el mensaje
            const displayName = isMine ? session.name || session.email : msg.userName;
            const displayColor = isMine ? session.color || msg.userColor : msg.userColor;

            const messageEl = document.createElement("div");
            messageEl.className = "post";
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
                    ${this.user && this.user.role === "admin" ? `<button class="btn-delete-post" data-id="${msg.id}" title="Borrar">Borrar</button>` : ""}
                </div>
                <div class="post-title" style="font-weight: 700; font-size: 16px; margin-bottom: 8px">${this.escapeHtml(msg.title)}</div>
                <div class="post-content" style="white-space: pre-wrap; line-height: 1.6">${this.escapeHtml(msg.content)}</div>
                <div class="post-actions" style="margin-top: 12px; display: flex; gap: 8px">
                    <button class="btn-reply" data-message-id="${msg.id}" data-reply-to="${this.escapeHtml(displayName)}" title="Responder">
                        Responder
                    </button>
                </div>
                ${this.renderReplies(msg.replies || [], msg.id)}
            `;
            container.appendChild(messageEl);
        });
    },

    renderReplies(replies, parentId) {
        if (!replies || replies.length === 0) return "";

        const session = store.getSession();
        const isAdmin = this.user && this.user.role === "admin";

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
                        <div style="margin-top: 6px; display: flex; gap: 8px;">
                            <button class="btn-reply-to-reply" data-parent-id="${parentId}" data-reply-to="${this.escapeHtml(displayName)}" data-reply-id="${reply.id}" data-thread-root="${reply.id}" title="Responder">
                                Responder
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
                            <div style="margin-top: 4px">
                                <button class="btn-reply-to-reply" data-parent-id="${parentId}" data-reply-to="${this.escapeHtml(subDisplayName)}" data-reply-id="${subReply.id}" data-thread-root="${reply.id}" title="Responder">
                                    Responder
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
                const res = await fetch(`/subject/${encodeURIComponent(this.subject.id)}/forum/post`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title, content }),
                });
                if (!res.ok) throw new Error("Error publicando");
                const created = await res.json();
                // Añadir al inicio y re-renderizar
                const current = Array.from(this.el.postsContainer.querySelectorAll(".post")).length > 0 ? [] : null;
                // Recargar lista completa para mantener orden desde server
                const rPosts = await fetch(`/api/subjects/${this.subject.id}/posts`);
                const messages = rPosts.ok ? await rPosts.json() : [];
                this.renderMessages(messages);
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
                    return;
                }
                if (!res.ok) {
                    toast("Error al borrar el mensaje");
                    return;
                }
                // borrar del DOM
                const postEl = btn.closest(".post");
                if (postEl) postEl.remove();
                toast("Mensaje borrado");
            } catch (err) {
                console.error("Error borrando mensaje", err);
                toast("Error al borrar el mensaje");
            }
        });

        // Delegación para botones de responder, borrar y toggle
        this.el.postsContainer?.addEventListener("click", async (e) => {
            const btnReply = e.target.closest(".btn-reply");
            const btnReplyToReply = e.target.closest(".btn-reply-to-reply");
            const btnDeleteReply = e.target.closest(".btn-delete-reply");
            const btnToggleReplies = e.target.closest(".btn-toggle-replies");

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

            if (btnReplyToReply) {
                const parentId = btnReplyToReply.dataset.parentId;
                const replyTo = btnReplyToReply.dataset.replyTo;
                const replyId = btnReplyToReply.dataset.replyId;
                this.openReplyModal(parentId, replyTo, replyTo, replyId);
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

                    toast("Respuesta borrada");
                } catch (err) {
                    console.error("Error borrando respuesta:", err);
                    toast("Error al borrar la respuesta");
                }
                return;
            }
        });

        // Formulario de respuesta
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
                const res = await fetch(`/api/messages/${encodeURIComponent(messageId)}/reply`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content, replyToUser, replyToId }),
                });

                if (!res.ok) throw new Error("Error al enviar respuesta");

                // Recargar mensajes para mostrar la nueva respuesta
                const rPosts = await fetch(`/api/subjects/${this.subject.id}/posts`);
                const messages = rPosts.ok ? await rPosts.json() : [];
                this.renderMessages(messages);

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

    openReplyModal(messageId, replyTo, replyToUser, replyToId) {
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
