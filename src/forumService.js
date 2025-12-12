import fs from "fs";
import path from "path";

const FORUM_DIR = "data/forums";
const FILTERS_DIR = path.join("data", "filters");
const LEGACY_FILTERS_FILE = path.join("data", "filters.json");

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

function safeTimestamp(value) {
    if (!value) return null;
    const ts = Date.parse(value);
    return Number.isNaN(ts) ? null : ts;
}

function summarizeForum(posts = []) {
    let total = 0;
    let latestTs = null;
    let latestPayload = null;

    const consider = (payload) => {
        total++;
        const ts = safeTimestamp(payload?.timestamp);
        if (ts === null) return;
        if (latestTs === null || ts > latestTs) {
            latestTs = ts;
            latestPayload = payload;
        }
    };

    posts.forEach((post) => {
        if (!post || typeof post !== "object") return;
        consider({
            kind: "post",
            id: post.id,
            subjectId: post.subjectId,
            title: post.title || "",
            content: post.content || "",
            timestamp: post.timestamp,
            userName: post.userName || post.userEmail || "",
        });
        const replies = Array.isArray(post.replies) ? post.replies : [];
        replies.forEach((reply) => {
            if (!reply || typeof reply !== "object") return;
            consider({
                kind: "reply",
                id: reply.id,
                subjectId: post.subjectId,
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
        lastMessageAuthor: latestPayload?.userName || null,
        lastMessageTitle: latestPayload?.kind === "post" ? latestPayload?.title || "" : "",
        lastMessagePreview: latestPayload?.kind === "post" ? normalizePreview(latestPayload?.content || latestPayload?.title || "") : normalizePreview(latestPayload?.content || ""),
    };
}

export function getForumStats(subjectId) {
    const posts = getPosts(subjectId);
    return summarizeForum(posts);
}

export function getForumsStatsMap(subjectIds = []) {
    const result = {};
    subjectIds.forEach((id) => {
        const key = String(id);
        result[key] = getForumStats(id);
    });
    return result;
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
        const map = readAllReportsMap();
        let changed = false;
        map.forEach((arr, key) => {
            const next = arr.filter((r) => String(r?.subjectId || keyToSubjectId(key)) !== String(subjectId));
            if (next.length !== arr.length) {
                changed = true;
                map.set(key, next);
            }
        });
        if (changed) {
            writeAllReportsMap(map);
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
    const map = readAllReportsMap();
    let removed = 0;
    map.forEach((arr, key) => {
        const next = arr.filter((r) => !(r && String(r.messageId) === String(messageId)));
        if (next.length !== arr.length) {
            removed += arr.length - next.length;
            map.set(key, next);
        }
    });
    if (removed > 0) {
        writeAllReportsMap(map);
    }
    return removed;
}

export function removeReportsForReply(messageId, replyId) {
    if (!messageId || !replyId) return 0;
    const map = readAllReportsMap();
    let removed = 0;
    map.forEach((arr, key) => {
        const next = arr.filter((r) => !(r && String(r.messageId) === String(messageId) && String(r.replyId) === String(replyId)));
        if (next.length !== arr.length) {
            removed += arr.length - next.length;
            map.set(key, next);
        }
    });
    if (removed > 0) {
        writeAllReportsMap(map);
    }
    return removed;
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

    // Limpiar reportes asociados a esta respuesta si existen
    try {
        removeReportsForReply(messageId, replyId);
    } catch (e) {
        // noop en caso de fallo al limpiar reportes
    }

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
const REPORTS_DIR = path.join("data", "reports");
const LEGACY_REPORTS_FILE = path.join("data", "reports.json");
const DEFAULT_REPORT_SUBJECT_KEY = "__default__";
let legacyReportsMigrated = false;

function ensureReportsDir() {
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
}

function sanitizeReportSubject(subjectId) {
    const base = String(subjectId || "").trim();
    if (!base) return "default";
    return base.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function normalizeReportKey(subjectId) {
    const value = String(subjectId ?? "").trim();
    return value.length ? value : DEFAULT_REPORT_SUBJECT_KEY;
}

function keyToSubjectId(key) {
    return key === DEFAULT_REPORT_SUBJECT_KEY ? "" : key;
}

function reportFileForKey(key) {
    ensureReportsDir();
    const subjectId = keyToSubjectId(key);
    const safe = sanitizeReportSubject(subjectId || key);
    return path.join(REPORTS_DIR, `${safe}.json`);
}

function readReportsFile(filePath) {
    try {
        const raw = fs.readFileSync(filePath, "utf8");
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        return [];
    }
}

function writeAllReportsMap(map) {
    ensureReportsDir();
    const seen = new Set();
    map.forEach((arr, key) => {
        const file = reportFileForKey(key);
        if (arr && arr.length) {
            fs.writeFileSync(file, JSON.stringify(arr, null, 2), "utf8");
            seen.add(file);
        } else if (fs.existsSync(file)) {
            try {
                fs.unlinkSync(file);
            } catch (e) {}
        }
    });

    const existing = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith(".json"));
    existing.forEach((file) => {
        const full = path.join(REPORTS_DIR, file);
        if (!seen.has(full)) {
            try {
                const arr = readReportsFile(full);
                if (!arr.length) fs.unlinkSync(full);
            } catch (e) {}
        }
    });

    if (fs.existsSync(LEGACY_REPORTS_FILE)) {
        try {
            fs.writeFileSync(LEGACY_REPORTS_FILE, JSON.stringify([], null, 2), "utf8");
        } catch (e) {}
    }
}

function migrateLegacyReportsIfNeeded() {
    if (legacyReportsMigrated) return;
    legacyReportsMigrated = true;
    if (!fs.existsSync(LEGACY_REPORTS_FILE)) return;
    try {
        const raw = fs.readFileSync(LEGACY_REPORTS_FILE, "utf8");
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr) || !arr.length) {
            return;
        }
        const map = new Map();
        arr.forEach((report) => {
            if (!report || typeof report !== "object") return;
            const key = normalizeReportKey(report.subjectId);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(report);
        });
        writeAllReportsMap(map);
        fs.writeFileSync(LEGACY_REPORTS_FILE, JSON.stringify([], null, 2), "utf8");
    } catch (e) {
        legacyReportsMigrated = false;
    }
}

function readAllReportsMap() {
    ensureReportsDir();
    migrateLegacyReportsIfNeeded();
    const map = new Map();
    if (fs.existsSync(REPORTS_DIR)) {
        const files = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith(".json"));
        files.forEach((file) => {
            const full = path.join(REPORTS_DIR, file);
            const list = readReportsFile(full);
            if (!list.length) {
                try {
                    fs.unlinkSync(full);
                } catch (e) {}
                return;
            }
            list.forEach((report) => {
                if (!report || typeof report !== "object") return;
                const key = normalizeReportKey(report.subjectId);
                if (!map.has(key)) map.set(key, []);
                if (!report.subjectId && key !== DEFAULT_REPORT_SUBJECT_KEY) {
                    report.subjectId = keyToSubjectId(key);
                }
                map.get(key).push(report);
            });
        });
    }

    if (fs.existsSync(LEGACY_REPORTS_FILE)) {
        try {
            const raw = fs.readFileSync(LEGACY_REPORTS_FILE, "utf8");
            const legacy = JSON.parse(raw);
            if (Array.isArray(legacy) && legacy.length) {
                legacy.forEach((report) => {
                    if (!report || typeof report !== "object") return;
                    const key = normalizeReportKey(report.subjectId);
                    if (!map.has(key)) map.set(key, []);
                    map.get(key).push(report);
                });
            }
        } catch (e) {}
    }

    return map;
}

function flattenReports(map) {
    const all = [];
    map.forEach((arr) => {
        arr.forEach((report) => {
            all.push(report);
        });
    });
    return all;
}

export function getReports() {
    return flattenReports(readAllReportsMap());
}

export function addReport(report) {
    if (!report || !report.messageId) return false;
    const map = readAllReportsMap();
    let subjectId = report.subjectId;
    if (!subjectId) {
        const found = findMessageById(report.messageId);
        if (found && found.post && found.post.subjectId) {
            subjectId = found.post.subjectId;
            report.subjectId = subjectId;
        } else {
            subjectId = "";
        }
    }
    const key = normalizeReportKey(subjectId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(report);
    writeAllReportsMap(map);
    return true;
}

export function hasReportForReply(messageId, replyId, email) {
    if (!messageId || !replyId || !email) return false;
    const all = flattenReports(readAllReportsMap());
    return all.some((r) => r && !r.resolved && String(r.messageId) === String(messageId) && String(r.replyId) === String(replyId) && r.reporterEmail && String(r.reporterEmail).toLowerCase() === String(email).toLowerCase());
}

export function markReportsResolvedForReply(messageId, replyId, resolverEmail) {
    const map = readAllReportsMap();
    let updated = 0;
    const now = new Date().toISOString();
    map.forEach((arr, key) => {
        let changed = false;
        const next = arr.map((r) => {
            if (r && !r.resolved && String(r.messageId) === String(messageId) && String(r.replyId) === String(replyId)) {
                updated++;
                changed = true;
                return { ...r, resolved: true, resolvedBy: resolverEmail, resolvedAt: now };
            }
            return r;
        });
        if (changed) {
            map.set(key, next);
        }
    });
    if (updated > 0) {
        writeAllReportsMap(map);
    }
    return { updated };
}

// (Eliminado duplicado) addReport ya está declarado más arriba

/**
 * Obtener reportes realizados por un usuario (reporterEmail)
 */
export function getReportsByReporter(email) {
    if (!email) return [];
    const all = flattenReports(readAllReportsMap());
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
    const all = flattenReports(readAllReportsMap());
    return all.some((r) => r && !r.resolved && String(r.messageId) === String(messageId) && r.reporterEmail && String(r.reporterEmail).toLowerCase() === String(email).toLowerCase());
}

/**
 * Eliminar un reporte por su id
 */
export function deleteReportById(reportId) {
    if (!reportId) return false;
    const map = readAllReportsMap();
    let removed = false;
    map.forEach((arr, key) => {
        const next = arr.filter((r) => !(r && String(r.id) === String(reportId)));
        if (next.length !== arr.length) {
            removed = true;
            map.set(key, next);
        }
    });
    if (removed) {
        writeAllReportsMap(map);
    }
    return removed;
}

/**
 * Obtener todos los reportes activos para un mensaje concreto
 */
export function getReportsByMessage(messageId) {
    if (!messageId) return [];
    const all = flattenReports(readAllReportsMap());
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
    const map = readAllReportsMap();
    const now = new Date().toISOString();
    let updated = 0;
    const resolvedReports = [];
    map.forEach((arr, key) => {
        let changed = false;
        const next = arr.map((r) => {
            if (r && String(r.messageId) === String(messageId) && !r.resolved && (r.replyId === undefined || r.replyId === null)) {
                const resolved = { ...r, resolved: true, resolvedBy: resolverEmail || null, resolvedAt: now };
                resolvedReports.push(resolved);
                updated++;
                changed = true;
                return resolved;
            }
            return r;
        });
        if (changed) {
            map.set(key, next);
        }
    });
    if (updated > 0) {
        writeAllReportsMap(map);
    }
    return { updated, reports: resolvedReports };
}

/**
 * Marcar un reporte como resuelto
 */
export function markReportResolved(reportId, resolverEmail) {
    if (!reportId) return null;
    const map = readAllReportsMap();
    const now = new Date().toISOString();
    let resolved = null;
    map.forEach((arr, key) => {
        if (resolved) return;
        let changed = false;
        const next = arr.map((r) => {
            if (!resolved && r && String(r.id) === String(reportId)) {
                resolved = { ...r, resolved: true, resolvedBy: resolverEmail || null, resolvedAt: now };
                changed = true;
                return resolved;
            }
            return r;
        });
        if (changed) {
            map.set(key, next);
        }
    });
    if (resolved) {
        writeAllReportsMap(map);
    }
    return resolved;
}

// ===== Filtros de contenido (por asignatura) =====
function ensureFiltersDir() {
    if (!fs.existsSync(FILTERS_DIR)) {
        fs.mkdirSync(FILTERS_DIR, { recursive: true });
    }
}

function filtersFileFor(subjectId) {
    ensureFiltersDir();
    let safe = String(subjectId || "")
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, "-");
    if (!safe) safe = "default";
    return path.join(FILTERS_DIR, `${safe}.json`);
}

function readFiltersFromFile(filePath) {
    try {
        const raw = fs.readFileSync(filePath, "utf8");
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        return [];
    }
}

function readLegacyFilters(subjectId) {
    if (!fs.existsSync(LEGACY_FILTERS_FILE)) return [];
    try {
        const raw = fs.readFileSync(LEGACY_FILTERS_FILE, "utf8");
        const map = JSON.parse(raw) || {};
        const key = String(subjectId);
        const arr = map[key] || map[subjectId] || [];
        if (!Array.isArray(arr) || arr.length === 0) return [];

        const safeList = arr
            .map((w) => String(w || "").trim())
            .filter((w) => w.length > 0)
            .slice(0, 200);

        if (!safeList.length) return [];

        // Migrar a fichero individual y eliminar del archivo legado
        try {
            const file = filtersFileFor(subjectId);
            fs.writeFileSync(file, JSON.stringify(safeList, null, 2), "utf8");
        } catch (err) {
            // Si falla la escritura, simplemente devolvemos la lista para uso temporal
        }

        try {
            delete map[key];
            fs.writeFileSync(LEGACY_FILTERS_FILE, JSON.stringify(map, null, 2), "utf8");
        } catch (err) {
            // Ignorar fallos al depurar el archivo legado
        }

        return safeList;
    } catch (e) {
        return [];
    }
}

export function getFilters(subjectId) {
    const file = filtersFileFor(subjectId);
    if (fs.existsSync(file)) {
        return readFiltersFromFile(file);
    }
    return readLegacyFilters(subjectId);
}

export function setFilters(subjectId, filters) {
    ensureFiltersDir();
    const safeList = (Array.isArray(filters) ? filters : [])
        .map((w) => String(w || "").trim())
        .filter((w) => w.length > 0)
        .slice(0, 200);
    const file = filtersFileFor(subjectId);
    fs.writeFileSync(file, JSON.stringify(safeList, null, 2), "utf8");
    if (fs.existsSync(LEGACY_FILTERS_FILE)) {
        try {
            const raw = fs.readFileSync(LEGACY_FILTERS_FILE, "utf8");
            const map = JSON.parse(raw) || {};
            const key = String(subjectId);
            if (map[key]) {
                delete map[key];
                fs.writeFileSync(LEGACY_FILTERS_FILE, JSON.stringify(map, null, 2), "utf8");
            }
        } catch (e) {
            // noop: si no se puede actualizar el archivo legado no bloqueamos la funcionalidad principal
        }
    }
    return safeList;
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
