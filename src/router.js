import express, { json } from "express";
import multer from "multer";
import * as auth from "./authService.js";
import * as subjects from "./subjectService.js";

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
            res.render("index", { jsonUser });
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
    if (req.body.name) {
        user.setName(req.body.name);
    }
    if ("bio" in req.body) {
        user.setBio(req.body.bio);
    }
    if ("color" in req.body) {
        user.setColor(req.body.color);
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
    const s = subjects.getSubject(key);
    if (s) return s;
    return {
        id: key,
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
    const s = getSubjectById(req.params.id);
    res.json(s);
});

//renderizar pagina de detalles de la asignatura
router.get("/subject/:id/details", withAuth, (req, res) => {
    const id = req.params.id;
    // obtener la asignatura completa (description y demás atributos)
    const subject = getSubjectById(id);
    const jsonUser = JSON.stringify({ name: req.user.getName(), email: req.user.getEmail(), bio: req.user.getBio(), color: req.user.getColor() });
    // pasar el objeto subject completo a la plantilla
    res.render("subject", { subject, jsonUser });
});

//renderizar página del foro
router.get("/subject/:id/forum", withAuth, (req, res) => {
    const id = req.params.id;
    const subject = getSubjectById(id); // ✅ usa tu función definida arriba

    if (!subject) {
        return res.status(404).send("Asignatura no encontrada");
    }

    const jsonUser = JSON.stringify({
        name: req.user.getName(),
        email: req.user.getEmail(),
        bio: req.user.getBio(),
        color: req.user.getColor(),
    });

    res.render("forum", { subject, jsonUser });
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
        const id = subjects.generateId(body.name);
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
    let code;
    if (req.body.subject) {
        const incoming = req.body.subject;
        // Normalizar créditos >= 0
        if (incoming) {
            incoming.credits = Math.max(0, Number(incoming.credits ?? 0) || 0);
        }
        code = subjects.modifySubject(incoming);
    } else {
        code = 20;
    }
    return res.json({ code });
});

router.post("/subject/:id/delete", withAdmin, (req, res) => {
    subjects.deleteSubject(req.params.id);
    return res.redirect("/");
});

router.post("/changePassword", withAuth, (req, res) => {
    const user = req.user;
    const oldPassword = req.body.oldPassword;
    const newPassword = req.body.newPassword;
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
