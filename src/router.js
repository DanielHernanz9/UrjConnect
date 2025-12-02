import express, { json } from "express";
import multer from "multer";
import * as auth from "./authService.js";
import * as subjects from "./subjectService.js";
import * as forum from "./forumService.js";

const router = express.Router();
// Configuración de subida de iconos a /public/assets
const upload = multer({
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

router.get("/", (req, res) => {
    if (req.cookies && req.cookies.session_id) {
        const user = auth.authenticate(req.cookies.session_id);
        
        if (user) {
           
            const jsonUser = user.toJson();
            if (user.isBanned()){
                res.render("banned", { jsonUser });
            }else{
                res.render("index", { jsonUser });
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
        console.error('Error updating forum posts for user:', e);
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
    res.json(subjects.getArray());
});

// API: obtener una asignatura por id
router.get("/api/subjects/:id", (req, res) => {
    const id = req.params.id;
    const alias = subjects.getAlias ? subjects.getAlias(id) : null;
    const s = getSubjectById(alias || id);
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

    res.render("forum", { subject, jsonUser });
});

// Publicar un mensaje en el foro de una asignatura
router.post("/subject/:id/forum/post", withAuth, (req, res) => {
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

    const post = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        subjectId: subject.id,
        title: String(title).trim().slice(0, 140),
        content: String(content).trim().slice(0, 5000),
        userName: req.user.name || req.user.email,
        userEmail: req.user.email,
        userColor: req.user.color || "#6366f1",
        timestamp: new Date().toISOString(),
    };

    forum.addPost(subject.id, post);
    res.status(201).json(post);
});

export default router;

router.post("/uploadIcon", withAdmin, upload.single("icon"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: { code: "NO_FILE", message: "Falta archivo" } });
    const webPath = "/assets/" + req.file.filename;
    return res.json({ path: webPath });
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

router.post("/subject/:id/modify", withAdmin, (req, res) => {
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

router.post("/subject/:id/delete", withAdmin, (req, res) => {
    subjects.deleteSubject(req.params.id);
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
// DELETE mensaje por id (autor o administradores)
router.delete('/api/messages/:id', withAuth, async (req, res) => {
  const messageId = req.params.id;
  try {
    const found = forum.findMessageById(messageId);
    if (!found || !found.post) return res.status(404).json({ error: 'Not found' });

    const post = found.post;
    const user = req.user || null;
    const isAdmin = user ? (user.isAdmin === true || user.role === 'admin') : false;
    const isOwner = user && (post.userName === user.name || post.userEmail === user.email);

    if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Forbidden' });

    const deleted = forum.deleteMessage(messageId);
    if (!deleted) return res.status(404).json({ error: 'Not found' });

    res.json({ success: true, deleted });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST respuesta a un mensaje del foro
router.post('/api/messages/:id/reply', withAuth, (req, res) => {
  const messageId = req.params.id;
  const { content, replyToUser, replyToId } = req.body || {};
  
  if (!content) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Falta contenido' } });
  }
  
  const found = forum.findMessageById(messageId);
  if (!found || !found.post) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Mensaje no encontrado' } });
  }
  
  const reply = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    content: String(content).trim().slice(0, 5000),
    userName: req.user.name || req.user.email,
    userEmail: req.user.email,
    userColor: req.user.color || '#6366f1',
    replyToUser: replyToUser || null,
    replyToId: replyToId || null,
    timestamp: new Date().toISOString()
  };
  
  const added = forum.addReply(messageId, reply);
  if (!added) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Error al añadir respuesta' } });
  }
  
  res.status(201).json(reply);
});

// DELETE respuesta específica de un mensaje
router.delete('/api/messages/:messageId/reply/:replyId', withAuth, async (req, res) => {
  const { messageId, replyId } = req.params;
  
  try {
    const found = forum.findMessageById(messageId);
    if (!found || !found.post) {
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }
    
    const reply = forum.findReply(messageId, replyId);
    if (!reply) {
      return res.status(404).json({ error: 'Respuesta no encontrada' });
    }
    
    const user = req.user || null;
    const isAdmin = user ? (user.isAdmin === true || user.role === 'admin') : false;
    const isOwner = user && (reply.userName === user.name || reply.userEmail === user.email);
    
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'No tienes permisos para borrar esta respuesta' });
    }
    
    // Si no es admin y es una respuesta directa (sin replyToUser), verificar que no haya respuestas a ella
    if (!isAdmin && !reply.replyToUser) {
      const replies = found.post.replies || [];
      // Verificar si hay respuestas que apunten a esta respuesta específica
      const hasChildReplies = replies.some(r => {
        if (r.id === replyId) return false; // No contar la misma respuesta
        // Verificar por replyToId (nuevo sistema) - debe coincidir con el ID de esta respuesta
        if (r.replyToId && r.replyToId === replyId) return true;
        // Para sistema antiguo sin replyToId, solo contar si el nombre coincide Y es una respuesta
        // que lógicamente debería pertenecer a este hilo (verificar timestamp)
        if (!r.replyToId && r.replyToUser === reply.userName) {
          // Solo contar si la respuesta es posterior a esta
          if (new Date(r.timestamp) > new Date(reply.timestamp)) {
            return true;
          }
        }
        return false;
      });
      
      if (hasChildReplies) {
        return res.status(400).json({ error: 'No puedes borrar esta respuesta porque hay otras respuestas dirigidas a ella' });
      }
    }
    // Las respuestas con @ (reply.replyToUser existe) siempre se pueden borrar por el propietario
    
    const deleted = forum.deleteReply(messageId, replyId);
    if (!deleted) {
      return res.status(500).json({ error: 'Error al borrar la respuesta' });
    }
    
    res.json({ success: true, deleted });
  } catch (err) {
    console.error('Error deleting reply:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});
