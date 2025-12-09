import fs from "fs";
import path from "path";

const FORUM_DIR = "data/forums";
const FILTERS_FILE = path.join("data", "filters.json");

function ensureDir() {
    if (!fs.existsSync(FORUM_DIR)) {
        fs.mkdirSync(FORUM_DIR, { recursive: true });
    }
}

function fileFor(subjectId) {
    ensureDir();
    const safe = String(subjectId).replace(/[^a-zA-Z0-9._-]+/g, "-");
    return path.join(FORUM_DIR, `${safe}.json`);
}

export function getPosts(subjectId) {
    const file = fileFor(subjectId);
    if (!fs.existsSync(file)) return [];
    try {
        const raw = fs.readFileSync(file, "utf-8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function addPost(subjectId, post) {
    const file = fileFor(subjectId);
    const list = getPosts(subjectId);
    list.push(post);
    fs.writeFileSync(file, JSON.stringify(list, null, 2));
    return post;
}

export function clearPosts(subjectId) {
    const file = fileFor(subjectId);
    fs.writeFileSync(file, JSON.stringify([], null, 2));
}

/**
 * Eliminar completamente el foro de una asignatura:
 * - Borra adjuntos de posts y respuestas
 * - Elimina el fichero JSON de `data/forums/<subject>.json`
 * - Limpia reportes asociados (por subjectId)
 */
export function deleteForum(subjectId) {
    const file = fileFor(subjectId);
    try {
        if (fs.existsSync(file)) {
            // Borrar adjuntos de todos los posts y respuestas
            try {
                const raw = fs.readFileSync(file, "utf-8");
                const posts = JSON.parse(raw);
                if (Array.isArray(posts)) {
                    posts.forEach((p) => {
                        const postAtts = Array.isArray(p?.attachments) ? p.attachments : [];
                        const replyAtts = (p?.replies || []).flatMap((r) => (Array.isArray(r?.attachments) ? r.attachments : []));
                        const all = postAtts.concat(replyAtts);
                        all.forEach((a) => {
                            if (!a || !a.url) return;
                            const rel = String(a.url).replace(/^\//, "");
                            const physical = path.join("public", rel);
                            try {
                                if (fs.existsSync(physical)) fs.unlinkSync(physical);
                            } catch (e) {
                                // ignorar fallos individuales
                            }
                        });
                    });
                }
            } catch (e) {
                // ignorar errores leyendo o parseando
            }
            // Eliminar fichero del foro
            try {
                fs.unlinkSync(file);
            } catch (e) {
                // Si no se pudo borrar, al menos vaciar
                try {
                    fs.writeFileSync(file, JSON.stringify([], null, 2), "utf8");
                } catch {}
            }
        }
    } catch (e) {}
    // Limpiar reportes por subjectId (si está presente en los reportes)
    try {
        ensureReportsFile();
        const all = getReports();
        const next = all.filter((r) => String(r?.subjectId || "") !== String(subjectId));
        if (next.length !== all.length) {
            fs.writeFileSync(REPORTS_FILE, JSON.stringify(next, null, 2), "utf8");
        }
    } catch (e) {}
}

export function updatePostsForUser(email, updates = {}, oldName = null) {
    ensureDir();
    let total = 0;
    const files = fs.readdirSync(FORUM_DIR).filter((f) => f.endsWith(".json"));
    files.forEach((f) => {
        const file = path.join(FORUM_DIR, f);
        try {
            const raw = fs.readFileSync(file, "utf-8");
            const posts = JSON.parse(raw);
            if (!Array.isArray(posts)) return;
            let changed = false;
            const updated = posts.map((p) => {
                // Match by explicit userEmail if present
                if (p && p.userEmail && String(p.userEmail).toLowerCase() === String(email).toLowerCase()) {
                    changed = true;
                    total++;
                    return Object.assign({}, p, {
                        userName: updates.userName !== undefined ? updates.userName : p.userName,
                        userColor: updates.userColor !== undefined ? updates.userColor : p.userColor,
                        userEmail: p.userEmail || email,
                    });
                }
                // Fallback: if post has no userEmail but matches oldName, update as well
                if (!p.userEmail && oldName && p.userName && String(p.userName) === String(oldName)) {
                    changed = true;
                    total++;
                    return Object.assign({}, p, {
                        userName: updates.userName !== undefined ? updates.userName : p.userName,
                        userColor: updates.userColor !== undefined ? updates.userColor : p.userColor,
                        userEmail: email,
                    });
                }
                return p;
            });
            if (changed) {
                fs.writeFileSync(file, JSON.stringify(updated, null, 2));
            }
        } catch (e) {
            // Ignore malformed forum files
        }
    });
    return total;
}

// === Nuevas funciones (copiadas de UrjConnect-6) ===

/**
 * Buscar un mensaje por su id en todos los ficheros de FORUM_DIR.
 * Devuelve { post, file, index, posts } o null si no se encuentra.
 */
export function findMessageById(messageId) {
    ensureDir();
    const files = fs.readdirSync(FORUM_DIR).filter((f) => f.endsWith(".json"));
    for (const f of files) {
        const full = path.join(FORUM_DIR, f);
        try {
            const raw = fs.readFileSync(full, "utf8");
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) continue;
            const idx = arr.findIndex((p) => p && String(p.id) === String(messageId));
            if (idx !== -1) {
                return { post: arr[idx], file: full, index: idx, posts: arr };
            }
        } catch (e) {
            // ignorar ficheros inválidos
            continue;
        }
    }
    return null;
}

/**
 * Elimina un mensaje por id. Devuelve el mensaje eliminado o null.
 */
export function deleteMessage(messageId) {
    ensureDir();
    const files = fs.readdirSync(FORUM_DIR).filter((f) => f.endsWith(".json"));
    for (const f of files) {
        const full = path.join(FORUM_DIR, f);
        try {
            const raw = fs.readFileSync(full, "utf8");
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) continue;
            const idx = arr.findIndex((p) => p && String(p.id) === String(messageId));
            if (idx !== -1) {
                // Antes de eliminar, borrar ficheros adjuntos del mensaje y sus respuestas
                try {
                    const post = arr[idx];
                    const attachments = Array.isArray(post.attachments) ? post.attachments : [];
                    const replyAttachments = (post.replies || []).flatMap((r) => (Array.isArray(r.attachments) ? r.attachments : []));
                    const all = attachments.concat(replyAttachments);
                    all.forEach((a) => {
                        if (!a || !a.url) return;
                        // Mapear URL /uploads/xxx a ruta física public/uploads/xxx
                        const rel = a.url.replace(/^\//, "");
                        const physical = path.join("public", rel);
                        try {
                            if (fs.existsSync(physical)) fs.unlinkSync(physical);
                        } catch (e) {
                            // ignorar errores de borrado individual
                        }
                    });
                } catch (e) {}
                const [deleted] = arr.splice(idx, 1);
                fs.writeFileSync(full, JSON.stringify(arr, null, 2), "utf8");
                // También eliminar reportes asociados a este mensaje
                try {
                    removeReportsForMessage(messageId);
                } catch (e) {
                    // si falla la limpieza de reportes, lo registramos pero seguimos con la eliminación del mensaje
                    // console.error('Error removing reports for message', e);
                }
                return deleted;
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}

/**
 * Eliminar todos los reportes asociados a un messageId
 */
export function removeReportsForMessage(messageId) {
    if (!messageId) return 0;
    ensureReportsFile();
    try {
        const arr = getReports();
        const filtered = arr.filter((r) => !(r && String(r.messageId) === String(messageId)));
        if (filtered.length === arr.length) return 0;
        fs.writeFileSync(REPORTS_FILE, JSON.stringify(filtered, null, 2), "utf8");
        return arr.length - filtered.length;
    } catch (e) {
        return 0;
    }
}

/**
 * Añade una respuesta a un mensaje existente.
 * @param {string} messageId - ID del mensaje al que se responde
 * @param {object} reply - Objeto con la respuesta
 * @returns {object|null} - La respuesta añadida o null si no se encontró el mensaje
 */
export function addReply(messageId, reply) {
    const found = findMessageById(messageId);
    if (!found) return null;

    const { post, file, posts } = found;

    // Inicializar array de respuestas si no existe
    if (!post.replies) {
        post.replies = [];
    }

    // Añadir la respuesta
    post.replies.push(reply);

    // Guardar el archivo actualizado
    fs.writeFileSync(file, JSON.stringify(posts, null, 2), "utf8");

    return reply;
}

/**
 * Elimina una respuesta específica de un mensaje.
 * @param {string} messageId - ID del mensaje principal
 * @param {string} replyId - ID de la respuesta a eliminar
 * @returns {object|null} - La respuesta eliminada o null si no se encontró
 */
export function deleteReply(messageId, replyId) {
    const found = findMessageById(messageId);
    if (!found) return null;

    const { post, file, posts } = found;

    if (!post.replies || !Array.isArray(post.replies)) return null;

    const replyIndex = post.replies.findIndex((r) => r && String(r.id) === String(replyId));
    if (replyIndex === -1) return null;

    const [deletedReply] = post.replies.splice(replyIndex, 1);
    // Borrar ficheros adjuntos de la respuesta eliminada
    try {
        const atts = Array.isArray(deletedReply.attachments) ? deletedReply.attachments : [];
        atts.forEach((a) => {
            if (!a || !a.url) return;
            const rel = a.url.replace(/^\//, "");
            const physical = path.join("public", rel);
            try {
                if (fs.existsSync(physical)) fs.unlinkSync(physical);
            } catch (e) {}
        });
    } catch (e) {}

    // Guardar el archivo actualizado
    fs.writeFileSync(file, JSON.stringify(posts, null, 2), "utf8");

    return deletedReply;
}

/**
 * Busca una respuesta específica dentro de un mensaje.
 * @param {string} messageId - ID del mensaje principal
 * @param {string} replyId - ID de la respuesta a buscar
 * @returns {object|null} - La respuesta encontrada o null
 */
export function findReply(messageId, replyId) {
    const found = findMessageById(messageId);
    if (!found) return null;

    const { post } = found;

    if (!post.replies || !Array.isArray(post.replies)) return null;

    return post.replies.find((r) => r && String(r.id) === String(replyId)) || null;
}

// === Reportes ===
const REPORTS_FILE = path.join("data", "reports.json");

function ensureReportsFile() {
    const dir = path.dirname(REPORTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(REPORTS_FILE)) fs.writeFileSync(REPORTS_FILE, JSON.stringify([], null, 2), "utf8");
}

export function getReports() {
    ensureReportsFile();
    try {
        const raw = fs.readFileSync(REPORTS_FILE, "utf8");
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        return [];
    }
}

export function addReport(report) {
    ensureReportsFile();
    try {
        const arr = getReports();
        arr.push(report);
        fs.writeFileSync(REPORTS_FILE, JSON.stringify(arr, null, 2), "utf8");
        return true;
    } catch (e) {
        return false;
    }
}

export function hasReportForReply(messageId, replyId, email) {
    if (!messageId || !replyId || !email) return false;
    const all = getReports();
    return all.some((r) => r && !r.resolved && String(r.messageId) === String(messageId) && String(r.replyId) === String(replyId) && r.reporterEmail && String(r.reporterEmail).toLowerCase() === String(email).toLowerCase());
}

export function markReportsResolvedForReply(messageId, replyId, resolverEmail) {
    ensureReportsFile();
    try {
        const arr = getReports();
        let updated = 0;
        const next = arr.map((r) => {
            if (r && !r.resolved && String(r.messageId) === String(messageId) && String(r.replyId) === String(replyId)) {
                updated++;
                return { ...r, resolved: true, resolvedBy: resolverEmail, resolvedAt: new Date().toISOString() };
            }
            return r;
        });
        fs.writeFileSync(REPORTS_FILE, JSON.stringify(next, null, 2), "utf8");
        return { updated };
    } catch (e) {
        return { updated: 0 };
    }
}

// (Eliminado duplicado) addReport ya está declarado más arriba

/**
 * Obtener reportes realizados por un usuario (reporterEmail)
 */
export function getReportsByReporter(email) {
    if (!email) return [];
    const all = getReports();
    try {
        return all.filter((r) => r && r.reporterEmail && String(r.reporterEmail).toLowerCase() === String(email).toLowerCase());
    } catch (e) {
        return [];
    }
}

/**
 * Comprueba si un usuario ya ha reportado un mensaje concreto
 */
export function hasReport(messageId, email) {
    if (!messageId || !email) return false;
    const all = getReports();
    // Only consider active (not resolved) reports when determining if the user has already reported
    return all.some((r) => r && !r.resolved && String(r.messageId) === String(messageId) && r.reporterEmail && String(r.reporterEmail).toLowerCase() === String(email).toLowerCase());
}

/**
 * Eliminar un reporte por su id
 */
export function deleteReportById(reportId) {
    if (!reportId) return false;
    ensureReportsFile();
    try {
        const arr = getReports();
        const idx = arr.findIndex((r) => r && String(r.id) === String(reportId));
        if (idx === -1) return false;
        arr.splice(idx, 1);
        fs.writeFileSync(REPORTS_FILE, JSON.stringify(arr, null, 2), "utf8");
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Obtener todos los reportes activos para un mensaje concreto
 */
export function getReportsByMessage(messageId) {
    if (!messageId) return [];
    const all = getReports();
    try {
        return all.filter((r) => r && String(r.messageId) === String(messageId) && !r.resolved);
    } catch (e) {
        return [];
    }
}

/**
 * Marcar todos los reportes de un mensaje como resueltos.
 * Devuelve el número de reportes actualizados y el array de reportes actualizados.
 */
export function markReportsResolvedForMessage(messageId, resolverEmail) {
    if (!messageId) return { updated: 0, reports: [] };
    ensureReportsFile();
    try {
        const arr = getReports();
        let updated = 0;
        const now = new Date().toISOString();
        const updatedReports = arr.map((r) => {
            // Solo resolver reportes del mensaje principal (sin replyId)
            if (r && String(r.messageId) === String(messageId) && !r.resolved && (r.replyId === undefined || r.replyId === null)) {
                r.resolved = true;
                r.resolvedBy = resolverEmail || null;
                r.resolvedAt = now;
                updated++;
            }
            return r;
        });
        if (updated > 0) {
            fs.writeFileSync(REPORTS_FILE, JSON.stringify(updatedReports, null, 2), "utf8");
        }
        return { updated, reports: updatedReports.filter((r) => r && String(r.messageId) === String(messageId) && (r.replyId === undefined || r.replyId === null)) };
    } catch (e) {
        return { updated: 0, reports: [] };
    }
}

/**
 * Marcar un reporte como resuelto
 */
export function markReportResolved(reportId, resolverEmail) {
    if (!reportId) return null;
    ensureReportsFile();
    try {
        const arr = getReports();
        const idx = arr.findIndex((r) => r && String(r.id) === String(reportId));
        if (idx === -1) return null;
        const now = new Date().toISOString();
        arr[idx].resolved = true;
        arr[idx].resolvedBy = resolverEmail || null;
        arr[idx].resolvedAt = now;
        fs.writeFileSync(REPORTS_FILE, JSON.stringify(arr, null, 2), "utf8");
        return arr[idx];
    } catch (e) {
        return null;
    }
}

// ===== Filtros de contenido (por asignatura) =====
function ensureFiltersFile() {
    const dir = path.dirname(FILTERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(FILTERS_FILE)) fs.writeFileSync(FILTERS_FILE, JSON.stringify({}, null, 2), "utf8");
}

export function getFilters(subjectId) {
    ensureFiltersFile();
    try {
        const raw = fs.readFileSync(FILTERS_FILE, "utf8");
        const map = JSON.parse(raw) || {};
        const arr = map[subjectId] || map[String(subjectId)] || [];
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        return [];
    }
}

export function setFilters(subjectId, filters) {
    ensureFiltersFile();
    const safeList = (Array.isArray(filters) ? filters : [])
        .map((w) => String(w || "").trim())
        .filter((w) => w.length > 0)
        .slice(0, 200);
    try {
        const raw = fs.readFileSync(FILTERS_FILE, "utf8");
        const map = JSON.parse(raw) || {};
        map[String(subjectId)] = safeList;
        fs.writeFileSync(FILTERS_FILE, JSON.stringify(map, null, 2), "utf8");
        return safeList;
    } catch (e) {
        const map = {};
        map[String(subjectId)] = safeList;
        fs.writeFileSync(FILTERS_FILE, JSON.stringify(map, null, 2), "utf8");
        return safeList;
    }
}

export function textMatchesFilters(subjectId, ...texts) {
    const filters = getFilters(subjectId).map((w) => w.toLowerCase());
    if (!filters.length) return false;
    const combined = texts
        .filter(Boolean)
        .map((t) => String(t).toLowerCase())
        .join(" \n ");
    // Coincidencia simple por substring; si se quiere exactitud de palabra, se puede mejorar con regex de límites
    return filters.some((w) => combined.includes(w));
}
