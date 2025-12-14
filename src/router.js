import express, { json } from "express";
import fs from "fs";
import multer from "multer";
import * as auth from "./authService.js";
import * as subjects from "./subjectService.js";
import * as forum from "./forumService.js";
import * as calendar from "./calendarService.js";
import User from "./User.js";

const router = express.Router();

// Configuración de subida de iconos a /public/assets
const uploadAssets = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, "public/assets");
        },
        filename: function (req, file, cb) {
            const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]+/g, "-");
            cb(null, Date.now() + "-" + safe);
        },
    }),
});

// Configuración de subida de adjuntos a /public/uploads
const uploadAttachments = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            try {
                const dir = "public/uploads";
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                cb(null, dir);
            } catch (e) {
                cb(e);
            }
        },
        filename: function (req, file, cb) {
            const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]+/g, "-");
            cb(null, Date.now() + "-" + safe);
        },
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 5 }, // 5MB, máx 5 archivos
    fileFilter: (req, file, cb) => {
        // Aceptar imágenes y tipos comunes de documentos
        const ok = /\.(png|jpg|jpeg|gif|webp|pdf|docx?|xlsx?|pptx?|txt|zip|rar)$/i.test(file.originalname);
        if (ok) return cb(null, true);
        cb(new Error("Tipo de archivo no permitido"));
    },
});

const COOKIEOPTIONS = {
    httpOnly: true,
    // secure: true,         // solo HTTPS (seria lo suyo pero pues no tenemos https)
    sameSite: "Strict",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 30, // 1 mes
};

const COOKIEOPTIONSDELETE = {
    httpOnly: true,
    // secure: true,         // solo HTTPS (seria lo suyo pero pues no tenemos https)
    sameSite: "Strict",
    path: "/",
};

// middleware para rutas que requieren sesión
function withAuth(req, res, next) {
    if (req.cookies && req.cookies.session_id) {
        const user = auth.authenticate(req.cookies.session_id);
        if (user) {
            // Si el usuario está baneado, redirigir a la página 'banned' para peticiones HTML
            if (user.isBanned && user.isBanned()) {
                // Si el cliente espera HTML (navegador), renderizar la vista banned
                const accepts = String(req.headers.accept || "");
                if (accepts.indexOf("text/html") !== -1) {
                    try {
                        const jsonUser = user.toJson();
                        const userName = user.name || user.email;
                        const bannedUntil = user.banned_finish_date || null;
                        return res.render("banned", { jsonUser, userName, bannedUntil });
                    } catch (e) {
                        // Si no se puede renderizar por alguna razón, devolver 403
                        return res.status(403).send("Cuenta suspendida");
                    }
                }
                // Para llamadas API (JSON), devolver error 403 con código BANNED
                return res.status(403).json({ error: { code: "BANNED", message: "Cuenta suspendida" } });
            }
            req.user = user;
            return next();
        }
        res.clearCookie("session_id", COOKIEOPTIONSDELETE);
    }
    return res.redirect("/");
}

function withAdmin(req, res, next) {
    if (req.cookies && req.cookies.session_id) {
        const user = auth.authenticate(req.cookies.session_id);
        if (user) {
            // Rechazar usuarios baneados también
            if (user.isBanned && user.isBanned()) {
                const accepts = String(req.headers.accept || "");
                if (accepts.indexOf("text/html") !== -1) {
                    try {
                        const jsonUser = user.toJson();
                        const userName = user.name || user.email;
                        const bannedUntil = user.banned_finish_date || null;
                        return res.render("banned", { jsonUser, userName, bannedUntil });
                    } catch (e) {
                        return res.status(403).json({ error: { code: "BANNED", message: "Cuenta suspendida" } });
                    }
                }
                return res.status(403).json({ error: { code: "BANNED", message: "Cuenta suspendida" } });
            }

            if (!user.isRole("admin")) {
                return res.status(403).json({
                    error: { code: "FORBIDDEN", message: "No tienes permisos para realizar esta acción." },
                });
            }
            req.user = user;
            return next();
        }
        res.clearCookie("session_id", COOKIEOPTIONSDELETE);
    }
    return res.redirect("/");
}

// Middleware para rutas que requieren admin global o permisos de profesor en una asignatura
function withSubjectAdmin(req, res, next) {
    if (req.cookies && req.cookies.session_id) {
        const user = auth.authenticate(req.cookies.session_id);
        if (user) {
            // Rechazar usuarios baneados
            if (user.isBanned && user.isBanned()) {
                const accepts = String(req.headers.accept || "");
                if (accepts.indexOf("text/html") !== -1) {
                    try {
                        const jsonUser = user.toJson();
                        const userName = user.name || user.email;
                        const bannedUntil = user.banned_finish_date || null;
                        return res.render("banned", { jsonUser, userName, bannedUntil });
                    } catch (e) {
                        return res.status(403).json({ error: { code: "BANNED", message: "Cuenta suspendida" } });
                    }
                }
                return res.status(403).json({ error: { code: "BANNED", message: "Cuenta suspendida" } });
            }

            // Admins globales tienen siempre acceso
            if (user.isRole("admin")) {
                req.user = user;
                return next();
            }

            // Para no-admins, verificar si es profesor de la asignatura
            const subjectId = req.params.id;
            if (!subjectId) {
                return res.status(403).json({
                    error: { code: "FORBIDDEN", message: "No tienes permisos para realizar esta acción." },
                });
            }

            const subject = subjects.getSubject(subjectId);
            if (!subject) {
                return res.status(404).json({
                    error: { code: "NOT_FOUND", message: "Asignatura no encontrada." },
                });
            }

            // Verificar si el usuario es profesor de esta asignatura
            if (!subjects.isUserProfessor(subject, user.email)) {
                return res.status(403).json({
                    error: { code: "FORBIDDEN", message: "No tienes permisos para realizar esta acción." },
                });
            }

            req.user = user;
            return next();
        }
        res.clearCookie("session_id", COOKIEOPTIONSDELETE);
    }
    return res.redirect("/");
}

// Función auxiliar para verificar si un usuario es administrador de una asignatura
// (considerer tanto admin global como profesor de la asignatura)
function isSubjectAdmin(user, subjectId) {
    // Los admins globales siempre tienen permisos
    if (!user || user.isRole("admin")) return true;

    // Para no-admins, verificar si es profesor de la asignatura
    const subject = subjects.getSubject(subjectId);
    if (!subject) return false;

    return subjects.isUserProfessor(subject, user.email);
}

router.get("/", (req, res) => {
    if (req.cookies && req.cookies.session_id) {
        const user = auth.authenticate(req.cookies.session_id);

        if (user) {
            const jsonUser = user.toJson();
            const userName = user.name || user.email;
            if (user.isBanned()) {
                const bannedUntil = user.banned_finish_date || null;
                res.render("banned", { jsonUser, userName, bannedUntil });
            } else {
                res.render("index", { jsonUser, userName });
            }

            return;
        }
    }
    // No autenticado: mostrar página de login separada
    res.render("login");
});

// Ruta explícita de login
router.get("/login", (req, res) => {
    if (req.cookies && req.cookies.session_id) {
        const user = auth.authenticate(req.cookies.session_id);
        if (user) {
            return res.redirect("/");
        }
    }
    res.render("login");
});

//Router para redireccionar a la pagina de editar contraseña
router.get("/editPassword", withAuth, (req, res) => {
    const jsonUser = req.user.toJson();
    res.render("editPassword", { jsonUser });
});

//router.get("/dashboard",(req,res)=>{
//    res.render("general.html")
//});

router.post("/login", (req, res) => {
    const session_id = auth.login(req.body.email, req.body.password);
    if (typeof session_id === "number") {
        res.json({
            code: session_id,
        });
    } else {
        res.cookie("session_id", session_id, COOKIEOPTIONS);
        const user = auth.authenticate(session_id).toJson();
        res.json({ code: 0, user });
    }
});

router.post("/register", (req, res) => {
    const session_id = auth.register(req.body.email, req.body.password, req.body.name, req.body.bio);
    if (typeof session_id === "number") {
        res.json({
            code: session_id,
        });
    } else {
        res.cookie("session_id", session_id, COOKIEOPTIONS);
        const user = auth.authenticate(session_id).toJson();
        res.json({ code: 0, user });
    }
});

router.post("/updateUser", withAuth, (req, res) => {
    const user = req.user;
    const oldName = user.name;
    if (req.body.name) {
        user.setName(req.body.name);
    }
    if ("bio" in req.body) {
        user.setBio(req.body.bio);
    }
    if ("color" in req.body) {
        user.setColor(req.body.color);
    }
    // Actualizar retroactivamente posts del usuario para que otros vean el perfil nuevo
    try {
        const updated = forum.updatePostsForUser(user.email, { userName: user.name, userColor: user.color }, oldName);
        return res.json({ code: 0, updatedPosts: updated });
    } catch (e) {
        console.error("Error updating forum posts for user:", e);
        return res.json({ code: 0, updatedPosts: 0 });
    }
});

router.post("/updateFavourites", withAuth, (req, res) => {
    const user = req.user;
    user.setFavourites(req.body.favourites);
});

router.post("/logout", (req, res) => {
    if (req.cookies && req.cookies.session_id) {
        auth.logout(req.cookies.session_id);
    }
    res.clearCookie("session_id", COOKIEOPTIONSDELETE);
    res.send();
});

router.post("/changePassword", withAuth, (req, res) => {
    const user = req.user;
    const oldPassword = req.body.oldPassword;
    const newPassword = req.body.newPassword;

    // Validar longitud mínima
    if (!newPassword || newPassword.length < 6) {
        return res.json({
            code: 5, // Contraseña demasiado corta
            msg: "La nueva contraseña debe tener al menos 6 caracteres",
        });
    }

    // Verificar contraseña actual
    if (user.isPassword(oldPassword)) {
        user.changePassword(newPassword);
        return res.json({
            code: 0,
        });
    }
    return res.json({
        code: 2,
    });
});

function getSubjectById(id) {
    if (!id) return null;
    const key = String(id);
    // Resolver alias (oldId -> newId) si existe
    const alias = subjects.getAlias ? subjects.getAlias(key) : null;
    const lookupKey = alias || key;
    const s = subjects.getSubject(lookupKey);
    if (s) return s;
    return {
        id: lookupKey,
        code: "",
        title: "Asignatura no encontrada",
        desc: "No se encontró descripción para esta asignatura.",
        credits: 0,
        professor: "",
        schedule: "",
        color: "",
        icon: "",
    };
}

// API: listar todas las asignaturas (cliente las consumirá)
router.get("/api/subjects", (req, res) => {
    try {
        const allSubjects = subjects.getArray();

        let currentUser = null;
        if (req.cookies && req.cookies.session_id) {
            currentUser = auth.authenticate(req.cookies.session_id) || null;
            if (!currentUser) {
                try {
                    res.clearCookie("session_id", COOKIEOPTIONSDELETE);
                } catch (e) {
                    // noop: si no se puede limpiar la cookie continuamos igualmente
                }
            }
        }

        let visibleSubjects = allSubjects;
        if (currentUser && !currentUser.isRole("admin")) {
            const userEmail = String(currentUser.email || "").toLowerCase();
            visibleSubjects = allSubjects.filter((subject) => {
                if (!subject) return false;
                const isProfessor = subjects.isUserProfessor(subject, currentUser.email);
                if (isProfessor) return true;
                const studentsRaw = subject.students;
                const students = Array.isArray(studentsRaw) ? studentsRaw : typeof studentsRaw === "string" && studentsRaw.trim().length ? [studentsRaw] : [];
                return students.some((email) => String(email || "").toLowerCase() === userEmail);
            });
        }

        const enriched = visibleSubjects.map((subject) => {
            try {
                const stats = forum.getForumStats ? forum.getForumStats(subject.id) : null;
                return stats ? Object.assign({}, subject, { forumStats: stats }) : subject;
            } catch (e) {
                return subject;
            }
        });
        res.json(enriched);
    } catch (e) {
        console.error("Error building subjects payload:", e);
        res.json(subjects.getArray());
    }
});

// API: obtener una asignatura por id
router.get("/api/subjects/:id", (req, res) => {
    const id = req.params.id;
    const alias = subjects.getAlias ? subjects.getAlias(id) : null;
    const s = getSubjectById(alias || id);
    if (s && s.id) {
        try {
            const stats = forum.getForumStats ? forum.getForumStats(s.id) : null;
            if (stats) {
                return res.json(Object.assign({}, s, { forumStats: stats }));
            }
        } catch (e) {
            // ignorar errores de estadísticas individuales, devolvemos objeto base
        }
    }
    res.json(s);
});

// API: obtener mensajes del foro de una asignatura
router.get("/api/subjects/:id/posts", withAuth, (req, res) => {
    const id = req.params.id;
    const alias = subjects.getAlias ? subjects.getAlias(id) : null;
    const subject = getSubjectById(alias || id);
    if (!subject || subject.title === "Asignatura no encontrada") {
        return res.status(404).json({ error: { code: "NOT_FOUND" } });
    }
    const posts = forum.getPosts(subject.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(posts);
});

// API: Obtener lista de alumnos (Solo profesor/admin)
router.get("/api/subjects/:id/students", withSubjectAdmin, (req, res) => {
    const list = subjects.getSubjectStudents(req.params.id);
    res.json(list);
});

// API: Añadir alumno (Solo profesor/admin)
router.post("/api/subjects/:id/students", withSubjectAdmin, (req, res) => {
    const email = req.body.email;
    const result = subjects.addStudentToSubject(req.params.id, email);
    res.json(result);
});

// API: Eliminar alumno (Solo profesor/admin)
router.delete("/api/subjects/:id/students/:email", withSubjectAdmin, (req, res) => {
    const result = subjects.removeStudentFromSubject(req.params.id, req.params.email);
    res.json(result);
});

// API: Buscar usuarios para autocompletado (profesores o alumnos)
router.get("/api/users/search", withAuth, (req, res) => {
    const query = (req.query.q || "").toLowerCase().trim();
    if (!query) return res.json([]);

    try {
        const usersDir = "data/users/";
        if (!fs.existsSync(usersDir)) return res.json([]);

        const files = fs.readdirSync(usersDir);
        const matches = [];

        // Leemos los ficheros de usuarios y filtramos (límite 5 para no saturar)
        for (const file of files) {
            if (matches.length >= 5) break;
            try {
                const content = fs.readFileSync(usersDir + file, "utf-8");
                const u = JSON.parse(content);
                // Buscamos por nombre o por email
                if (u.email.toLowerCase().includes(query) || u.name.toLowerCase().includes(query)) {
                    matches.push({ email: u.email, name: u.name });
                }
            } catch (e) {
                continue;
            }
        }
        res.json(matches);
    } catch (e) {
        console.error(e);
        res.json([]);
    }
});

router.get("/api/subjects/:id/reports", withSubjectAdmin, (req, res) => {
    try {
        const subjectId = req.params.id;
        const reports = forum.getReports() || [];
        const activeReports = reports
            .filter((r) => !r.resolved)
            .filter((r) => {
                const sid = r.subjectId || (r.message && r.message.subjectId);
                return String(sid) === String(subjectId);
            });

        const enriched = activeReports
            .map((r) => {
                const found = forum.findMessageById(r.messageId);
                const msg =
                    found && found.post
                        ? {
                              id: found.post.id,
                              title: found.post.title,
                              content: found.post.content,
                              timestamp: found.post.timestamp,
                              subjectId: found.post.subjectId,
                              userName: found.post.userName || null,
                              userEmail: found.post.userEmail || null,
                          }
                        : null;
                let reply = null;
                if (msg && r.replyId) {
                    const rep = forum.findReply(r.messageId, r.replyId);
                    if (rep) {
                        reply = {
                            id: rep.id,
                            content: rep.content,
                            timestamp: rep.timestamp,
                            userName: rep.userName || null,
                            userEmail: rep.userEmail || null,
                            replyToUser: rep.replyToUser || null,
                        };
                    }
                }
                return Object.assign({}, r, { message: msg, reply });
            })
            .filter((r) => r.message);

        return res.json(enriched);
    } catch (e) {
        console.error("Error getting subject reports:", e);
        return res.status(500).json({ error: { code: "SERVER", message: "Error recuperando reportes" } });
    }
});

//renderizar pagina de detalles de la asignatura
router.get("/subject/:id/details", withAuth, (req, res) => {
    const id = req.params.id;
    // Redirigir si hay alias (id antiguo => id nuevo)
    const alias = subjects.getAlias ? subjects.getAlias(id) : null;
    if (alias) {
        return res.redirect(`/subject/${encodeURIComponent(alias)}/details`);
    }
    // obtener la asignatura completa (description y demás atributos)
    const subject = getSubjectById(id);
    // Incluir todos los campos del usuario (incluido role) para que el cliente pueda decidir la UI (botones admin, etc.)
    const jsonUser = req.user.toJson();
    // pasar el objeto subject completo a la plantilla
    res.render("subject", { subject, jsonUser });
});

//renderizar página del foro
router.get("/subject/:id/forum", withAuth, (req, res) => {
    const id = req.params.id;
    // Redirigir si hay alias (id antiguo => id nuevo)
    const alias = subjects.getAlias ? subjects.getAlias(id) : null;
    if (alias) {
        return res.redirect(`/subject/${encodeURIComponent(alias)}/forum`);
    }
    const subject = getSubjectById(id); // ✅ usa tu función definida arriba

    if (!subject) {
        return res.status(404).send("Asignatura no encontrada");
    }

    // Enviar el usuario completo (incluye role) para que el cliente pueda mostrar acciones de admin
    const jsonUser = req.user.toJson();

    // Inicial de la asignatura para fallback de icono (plantilla no soporta indexado {{name.[0]}})
    const subjectInitial = String(subject.name || subject.title || "?")
        .trim()
        .charAt(0)
        .toUpperCase();

    res.render("forum", { subject, subjectInitial, jsonUser });
});

// Publicar un mensaje en el foro de una asignatura
router.post("/subject/:id/forum/post", withAuth, uploadAttachments.array("attachments", 5), (req, res) => {
    const id = req.params.id;
    const alias = subjects.getAlias ? subjects.getAlias(id) : null;
    const subject = getSubjectById(alias || id);
    if (!subject || subject.title === "Asignatura no encontrada") {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Asignatura no encontrada" } });
    }

    const { title, content } = req.body || {};
    if (!title || !content) {
        return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Faltan campos" } });
    }

    // Aplicar filtros de la asignatura: si coincide, no crear el post
    try {
        if (forum.textMatchesFilters && forum.textMatchesFilters(subject.id, String(title), String(content))) {
            return res.status(200).json({ filtered: true });
        }
    } catch (e) {
        console.error("Error evaluando filtros en post:", e);
        // En caso de error evaluando filtros, seguimos creando para no bloquear uso
    }

    const post = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        subjectId: subject.id,
        title: String(title).trim().slice(0, 140),
        content: String(content).trim().slice(0, 5000),
        userName: req.user.name || req.user.email,
        userEmail: req.user.email,
        userColor: req.user.color || "#6366f1",
        timestamp: new Date().toISOString(),
        attachments: Array.isArray(req.files)
            ? req.files.map((f) => ({
                  url: "/uploads/" + f.filename,
                  name: f.originalname,
                  type: f.mimetype,
                  size: f.size,
              }))
            : [],
    };

    forum.addPost(subject.id, post);
    res.status(201).json(post);
});

router.post("/uploadIcon", withAdmin, uploadAssets.single("icon"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: { code: "NO_FILE", message: "Falta archivo" } });
    const webPath = "/assets/" + req.file.filename;
    return res.json({ path: webPath });
});

// Filtros por asignatura
router.get("/api/subjects/:id/filters", withSubjectAdmin, (req, res) => {
    try {
        const id = req.params.id;
        const alias = subjects.getAlias ? subjects.getAlias(id) : null;
        const subject = getSubjectById(alias || id);
        if (!subject || subject.title === "Asignatura no encontrada") {
            return res.status(404).json({ error: { code: "NOT_FOUND" } });
        }
        const filters = forum.getFilters(subject.id);
        return res.json({ subjectId: subject.id, filters });
    } catch (e) {
        console.error("Error obteniendo filtros:", e);
        return res.status(500).json({ error: { code: "SERVER", message: "Error recuperando filtros" } });
    }
});

router.post("/api/subjects/:id/filters", withSubjectAdmin, (req, res) => {
    try {
        const id = req.params.id;
        const alias = subjects.getAlias ? subjects.getAlias(id) : null;
        const subject = getSubjectById(alias || id);
        if (!subject || subject.title === "Asignatura no encontrada") {
            return res.status(404).json({ error: { code: "NOT_FOUND" } });
        }
        const list = Array.isArray(req.body?.filters) ? req.body.filters : [];
        forum.setFilters(subject.id, list);
        return res.json({ success: true, subjectId: subject.id, filters: forum.getFilters(subject.id) });
    } catch (e) {
        console.error("Error guardando filtros:", e);
        return res.status(500).json({ error: { code: "SERVER", message: "Error guardando filtros" } });
    }
});

// Calendario
router.get("/api/subjects/:id/calendar", withAuth, (req, res) => {
    try {
        const id = req.params.id;
        const alias = subjects.getAlias ? subjects.getAlias(id) : null;
        const subject = getSubjectById(alias || id);
        if (!subject || subject.title === "Asignatura no encontrada") {
            return res.status(404).json({ error: { code: "NOT_FOUND" } });
        }
        const data = calendar.getCalendar(subject.id);
        data.subjectId = subject.id;
        return res.json(data);
    } catch (e) {
        console.error("Error obteniendo calendario:", e);
        return res.status(500).json({ error: { code: "SERVER", message: "Error recuperando calendario" } });
    }
});

router.post("/api/subjects/:id/calendar/events", withSubjectAdmin, (req, res) => {
    try {
        const id = req.params.id;
        const alias = subjects.getAlias ? subjects.getAlias(id) : null;
        const subject = getSubjectById(alias || id);
        if (!subject || subject.title === "Asignatura no encontrada") {
            return res.status(404).json({ error: { code: "NOT_FOUND" } });
        }
        const event = calendar.addEvent(subject.id, req.body || {});
        const updated = calendar.getCalendar(subject.id);
        updated.subjectId = subject.id;
        return res.status(201).json({ event, calendar: updated });
    } catch (e) {
        if (e && (e.code === "INVALID_DATE" || e.code === "TITLE_REQUIRED" || e.code === "DATE_IN_PAST")) {
            return res.status(400).json({ error: { code: e.code, message: e.message || "Datos inválidos" } });
        }
        console.error("Error añadiendo evento de calendario:", e);
        return res.status(500).json({ error: { code: "SERVER", message: "Error guardando evento" } });
    }
});

router.delete("/api/subjects/:id/calendar/events/:eventId", withSubjectAdmin, (req, res) => {
    try {
        const id = req.params.id;
        const alias = subjects.getAlias ? subjects.getAlias(id) : null;
        const subject = getSubjectById(alias || id);
        if (!subject || subject.title === "Asignatura no encontrada") {
            return res.status(404).json({ error: { code: "NOT_FOUND" } });
        }
        const removed = calendar.removeEvent(subject.id, req.params.eventId);
        if (!removed) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Evento no encontrado" } });
        }
        const updated = calendar.getCalendar(subject.id);
        updated.subjectId = subject.id;
        return res.json({ removed, calendar: updated });
    } catch (e) {
        console.error("Error eliminando evento de calendario:", e);
        return res.status(500).json({ error: { code: "SERVER", message: "Error eliminando evento" } });
    }
});

router.post("/createSubject", withAdmin, (req, res) => {
    try {
        const body = req.body.subject || req.body || {};
        if (!body.name) return res.json({ code: 23, error: { message: "Falta nombre" } });
        // autogenerar id, code y title
        // id = nombre en minúsculas
        const id = subjects.idFromNameLower(body.name);
        if (subjects.exists(id)) {
            return res.json({ code: 21, error: { message: "Ya existe una asignatura con ese id (derivado del nombre)" } });
        }
        const code = subjects.generateCode(body.name);
        const credits = Math.max(0, Number(body.credits ?? 0) || 0);
        const subject = {
            id,
            name: body.name,
            code,
            title: body.name,
            desc: body.desc || "",
            description: body.description || "",
            credits,
            professor: body.professor || "",
            schedule: body.schedule || "",
            color: body.color || "",
            icon: body.icon || "",
        };
        const rc = subjects.addSubject(subject);
        return res.json({ code: rc, subject });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: { code: "SERVER", message: "Error creando asignatura" } });
    }
});

// Modificar y borrar asignatura
router.post("/subject/:id/modify", withSubjectAdmin, (req, res) => {
    if (!req.body.subject) {
        return res.json({ code: 20 });
    }
    const incoming = req.body.subject;
    // Normalizar créditos >= 0
    if (incoming) {
        incoming.credits = Math.max(0, Number(incoming.credits ?? 0) || 0);
    }
    const result = subjects.modifySubjectById(req.params.id, incoming);
    return res.json({ code: result.code, id: result.id, newCode: result.newCode });
});

router.post("/subject/:id/delete", withSubjectAdmin, (req, res) => {
    // Resolver alias antes de borrar
    const id = req.params.id;
    const alias = subjects.getAlias ? subjects.getAlias(id) : null;
    const subjectId = alias || id;
    try {
        // Borrar asignatura del catálogo
        subjects.deleteSubject(subjectId);
    } catch (e) {
        console.error("Error borrando asignatura:", e);
    }
    try {
        // Borrar foro y su JSON + adjuntos + reportes del subject
        forum.deleteForum(subjectId);
    } catch (e) {
        console.error("Error borrando foro de asignatura:", e);
    }
    return res.redirect("/");
});

router.post("/changePassword", withAuth, (req, res) => {
    const user = req.user;
    const oldPassword = req.body.oldPassword;
    const newPassword = req.body.newPassword;

    // Validar longitud mínima
    if (!newPassword || newPassword.length < 6) {
        return res.json({
            code: 5, // Contraseña demasiado corta
            msg: "La nueva contraseña debe tener al menos 6 caracteres",
        });
    }

    // Verificar contraseña actual
    if (user.isPassword(oldPassword)) {
        user.changePassword(newPassword);
        return res.json({
            code: 0,
        });
    }
    return res.json({
        code: 2,
    });
});

// DELETE mensaje
router.delete("/api/messages/:id", withAuth, async (req, res) => {
    const messageId = req.params.id;
    try {
        const found = forum.findMessageById(messageId);
        if (!found || !found.post) return res.status(404).json({ error: "Not found" });

        const post = found.post;
        const user = req.user || null;

        // Extraer subjectId del archivo (data/forums/{subjectId}.json)
        const filePath = found.file;
        const fileMatch = filePath.match(/forums[\/\\]([^\/\\]+)\.json$/);
        const subjectId = fileMatch ? fileMatch[1] : null;

        const isAdmin = subjectId && user ? isSubjectAdmin(user, subjectId) : user && (user.isAdmin === true || user.role === "admin");
        const isOwner = user && (post.userName === user.name || post.userEmail === user.email);

        if (!isAdmin && !isOwner) return res.status(403).json({ error: "Forbidden" });

        // Borrado en cascada: deleteMessage ya elimina adjuntos del post y de sus respuestas,
        // borra el mensaje del JSON y limpia cualquier reporte asociado (post y replies).
        const deleted = forum.deleteMessage(messageId);
        if (!deleted) return res.status(404).json({ error: "Not found" });

        res.json({ success: true, deleted, cascade: true });
    } catch (err) {
        console.error("Error deleting message:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// Reportar mensaje
router.post("/api/messages/:id/report", withAuth, (req, res) => {
    const messageId = req.params.id;
    const reason = String(req.body.reason || "")
        .trim()
        .slice(0, 1000);

    const found = forum.findMessageById(messageId);
    if (!found || !found.post) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Mensaje no encontrado" } });

    const ownerEmail = found.post.userEmail ? String(found.post.userEmail).toLowerCase() : null;
    const requesterEmail = req.user?.email ? String(req.user.email).toLowerCase() : null;
    if (ownerEmail && requesterEmail && ownerEmail === requesterEmail) {
        return res.status(400).json({ error: { code: "SELF_REPORT", message: "No puedes reportar tus propios mensajes" } });
    }
    // Evitar reportes duplicados por el mismo usuario
    try {
        if (forum.hasReport && forum.hasReport(messageId, req.user.email)) {
            return res.status(409).json({ error: { code: "ALREADY_REPORTED", message: "Ya has reportado este mensaje" } });
        }

        const report = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            messageId: String(messageId),
            subjectId: found.post.subjectId || null,
            reporterEmail: req.user.email,
            reporterName: req.user.name || req.user.email,
            reason,
            timestamp: new Date().toISOString(),
        };

        const saved = forum.addReport(report);
        if (!saved) return res.status(500).json({ error: { code: "SERVER", message: "No se pudo registrar el reporte" } });

        res.status(201).json(report);
    } catch (e) {
        console.error("Error creando reporte:", e);
        res.status(500).json({ error: { code: "SERVER", message: "Error creando reporte" } });
    }
});

// Obtener reportes (admin)
router.get("/api/reports", withAdmin, (req, res) => {
    try {
        const reports = forum.getReports();
        // Mostrar solo reportes no resueltos
        const activeReports = (reports || []).filter((r) => !r.resolved);
        // Enriquecer con contexto del mensaje cuando esté disponible
        // Enriquecer con contexto del mensaje y filtrar reportes cuyo mensaje ya no exista
        const enriched = activeReports
            .map((r) => {
                const found = forum.findMessageById(r.messageId);
                const msg =
                    found && found.post
                        ? {
                              id: found.post.id,
                              title: found.post.title,
                              content: found.post.content,
                              timestamp: found.post.timestamp,
                              subjectId: found.post.subjectId,
                              userName: found.post.userName || null,
                              userEmail: found.post.userEmail || null,
                          }
                        : null;
                // Si es un reporte de respuesta, incluir datos básicos de la respuesta
                let reply = null;
                if (msg && r.replyId) {
                    const rep = forum.findReply(r.messageId, r.replyId);
                    if (rep) {
                        reply = {
                            id: rep.id,
                            content: rep.content,
                            timestamp: rep.timestamp,
                            userName: rep.userName || null,
                            userEmail: rep.userEmail || null,
                            replyToUser: rep.replyToUser || null,
                        };
                    }
                }
                return Object.assign({}, r, { message: msg, reply });
            })
            .filter((r) => r.message); // excluir reportes cuyo mensaje fue borrado
        res.json(enriched);
    } catch (e) {
        console.error("Error getting reports:", e);
        res.status(500).json({ error: { code: "SERVER", message: "Error recuperando reportes" } });
    }
});

// Obtener mis reportes
router.get("/api/reports/my", withAuth, (req, res) => {
    try {
        const all = forum.getReports();
        // Solo devolver reportes activos (no resueltos) del usuario actual
        const mine = (all || []).filter((r) => !r.resolved).filter((r) => r.reporterEmail && String(r.reporterEmail).toLowerCase() === String(req.user.email).toLowerCase());
        res.json(mine);
    } catch (e) {
        console.error("Error getting reports:", e);
        res.status(500).json({ error: { code: "SERVER", message: "Error recuperando reportes" } });
    }
});

// Resolver reporte
router.post("/api/reports/:id/resolve", withAdmin, (req, res) => {
    const id = req.params.id;
    try {
        if (!forum.markReportResolved) return res.status(501).json({ error: { code: "NOT_IMPLEMENTED" } });
        const updated = forum.markReportResolved(id, req.user.email || null);
        if (!updated) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Reporte no encontrado" } });
        return res.json(updated);
    } catch (e) {
        console.error("Error resolving report:", e);
        return res.status(500).json({ error: { code: "SERVER", message: "Error marcando reporte" } });
    }
});

// Eliminar reporte
router.delete("/api/reports/:id", withAdmin, (req, res) => {
    const id = req.params.id;
    try {
        if (!forum.deleteReportById) return res.status(501).json({ error: { code: "NOT_IMPLEMENTED" } });
        const ok = forum.deleteReportById(id);
        if (!ok) return res.status(404).json({ error: { code: "NOT_FOUND" } });
        return res.json({ success: true });
    } catch (e) {
        console.error("Error deleting report:", e);
        return res.status(500).json({ error: { code: "SERVER", message: "Error borrando reporte" } });
    }
});

// Banear usuario
router.post("/api/users/ban", withAdmin, (req, res) => {
    try {
        const email = String((req.body && req.body.email) || "")
            .trim()
            .toLowerCase();
        if (!email) return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Falta el email del usuario" } });
        const u = User.getFromFile(email);
        if (typeof u === "number") return res.status(404).json({ error: { code: "NOT_FOUND", message: "Usuario no encontrado" } });

        const banDuration = req.body.banDuration ? parseInt(req.body.banDuration) : null;
        u.setBanned(true, banDuration);

        return res.json({ success: true });
    } catch (e) {
        console.error("Error baneando usuario:", e);
        return res.status(500).json({ error: { code: "SERVER", message: "Error al banear usuario" } });
    }
});

// Resolver todos los reportes de un mensaje
router.post("/api/reports/resolve-message/:messageId", withAuth, (req, res) => {
    const messageId = req.params.messageId;
    const user = req.user;

    try {
        const found = forum.findMessageById(messageId);
        if (!found || !found.post) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Mensaje no encontrado" } });
        }
        const filePath = found.file;
        const fileMatch = filePath.match(/forums[\/\\]([^\/\\]+)\.json$/);
        const subjectId = fileMatch ? fileMatch[1] : null;

        if (!subjectId || !isSubjectAdmin(user, subjectId)) {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "No tienes permisos para resolver reportes de esta asignatura" } });
        }

        if (!forum.markReportsResolvedForMessage) return res.status(501).json({ error: { code: "NOT_IMPLEMENTED" } });
        const result = forum.markReportsResolvedForMessage(messageId, user.email || null);
        return res.json({ success: true, updated: result.updated });
    } catch (e) {
        console.error("Error resolving reports for message:", e);
        return res.status(500).json({ error: { code: "SERVER", message: "Error marcando reportes" } });
    }
});

// Publicar respuesta
router.post("/api/messages/:messageId/reply", withAuth, uploadAttachments.array("attachments", 5), (req, res) => {
    const messageId = req.params.messageId;
    const { content, replyToUser, replyToId } = req.body || {};

    if (!content) {
        return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Falta contenido" } });
    }

    const found = forum.findMessageById(messageId);
    if (!found || !found.post) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Mensaje no encontrado" } });
    }

    try {
        const subjId = found.post.subjectId;
        if (forum.textMatchesFilters && forum.textMatchesFilters(subjId, String(content))) {
            return res.status(200).json({ filtered: true });
        }
    } catch (e) {
        console.error("Error evaluando filtros en reply:", e);
    }

    const reply = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        content: String(content).trim().slice(0, 5000),
        userName: req.user.name || req.user.email,
        userEmail: req.user.email,
        userColor: req.user.color || "#6366f1",
        replyToUser: replyToUser || null,
        replyToId: replyToId || null,
        timestamp: new Date().toISOString(),
        attachments: Array.isArray(req.files)
            ? req.files.map((f) => ({
                  url: "/uploads/" + f.filename,
                  name: f.originalname,
                  type: f.mimetype,
                  size: f.size,
              }))
            : [],
    };

    const added = forum.addReply(messageId, reply);
    if (!added) {
        return res.status(500).json({ error: { code: "SERVER_ERROR", message: "Error al añadir respuesta" } });
    }

    res.status(201).json(reply);
});

// Reportar respuesta
router.post("/api/messages/:messageId/reply/:replyId/report", withAuth, (req, res) => {
    const { messageId, replyId } = req.params;
    try {
        const found = forum.findMessageById(messageId);
        if (!found || !found.post) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Mensaje no encontrado" } });
        }
        const reply = forum.findReply(messageId, replyId);
        if (!reply) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Respuesta no encontrada" } });
        }
        const ownerEmail = reply.userEmail ? String(reply.userEmail).toLowerCase() : null;
        const requesterEmail = req.user?.email ? String(req.user.email).toLowerCase() : null;
        if (ownerEmail && requesterEmail && ownerEmail === requesterEmail) {
            return res.status(400).json({ error: { code: "SELF_REPORT", message: "No puedes reportar tus propias respuestas" } });
        }
        const already = forum.hasReportForReply(messageId, replyId, req.user.email);
        if (already) {
            return res.status(409).json({ error: { code: "ALREADY_REPORTED", message: "Ya has reportado esta respuesta" } });
        }
        const report = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            messageId: String(messageId),
            replyId: String(replyId),
            reporterName: req.user.name || req.user.email,
            reporterEmail: req.user.email,
            subjectId: found.post.subjectId,
            timestamp: new Date().toISOString(),
            resolved: false,
        };
        const ok = forum.addReport(report);
        if (!ok) return res.status(500).json({ error: { code: "SERVER", message: "Error al crear reporte" } });
        return res.status(201).json(report);
    } catch (e) {
        console.error("Error reportando respuesta:", e);
        return res.status(500).json({ error: { code: "SERVER", message: "Error del servidor" } });
    }
});

// Resolver reportes de respuesta
router.post("/api/reports/resolve-reply/:messageId/:replyId", withAuth, (req, res) => {
    const { messageId, replyId } = req.params;
    const user = req.user;
    try {
        const found = forum.findMessageById(messageId);
        if (!found || !found.post) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Mensaje no encontrado" } });
        }
        const filePath = found.file;
        const fileMatch = filePath.match(/forums[\/\\]([^\/\\]+)\.json$/);
        const subjectId = fileMatch ? fileMatch[1] : null;

        if (!subjectId || !isSubjectAdmin(user, subjectId)) {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "No tienes permisos para resolver reportes de esta asignatura" } });
        }

        const result = forum.markReportsResolvedForReply(messageId, replyId, user.email);
        return res.json({ success: true, updated: result.updated });
    } catch (e) {
        console.error("Error resolviendo reportes de respuesta:", e);
        return res.status(500).json({ error: { code: "SERVER", message: "Error marcando reportes" } });
    }
});

// DELETE respuesta
router.delete("/api/messages/:messageId/reply/:replyId", withAuth, async (req, res) => {
    const { messageId, replyId } = req.params;
    try {
        const found = forum.findMessageById(messageId);
        if (!found || !found.post) return res.status(404).json({ error: "Mensaje no encontrado" });

        const reply = forum.findReply(messageId, replyId);
        if (!reply) return res.status(404).json({ error: "Respuesta no encontrada" });

        const user = req.user || null;
        const filePath = found.file;
        const fileMatch = filePath.match(/forums[\/\\]([^\/\\]+)\.json$/);
        const subjectId = fileMatch ? fileMatch[1] : null;

        const isAdmin = subjectId && user ? isSubjectAdmin(user, subjectId) : user && (user.isAdmin === true || user.role === "admin");
        const isOwner = user && (reply.userName === user.name || reply.userEmail === user.email);

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ error: "No tienes permisos para borrar esta respuesta" });
        }

        const deleted = forum.deleteReply(messageId, replyId);
        if (!deleted) return res.status(500).json({ error: "Error al borrar la respuesta" });

        res.json({ success: true, deleted });
    } catch (err) {
        console.error("Error deleting reply:", err);
        res.status(500).json({ error: "Error del servidor" });
    }
});

export default router;
