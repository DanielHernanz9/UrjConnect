import express from 'express';
import * as auth from './authService.js';

const router = express.Router();

const COOKIEOPTIONS = {
    httpOnly: true,
    // secure: true,         // solo HTTPS (seria lo suyo pero pues no tenemos https)
    sameSite: 'Strict',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 30  // 1 mes
}

const COOKIEOPTIONSDELETE = {
    httpOnly: true,
    // secure: true,         // solo HTTPS (seria lo suyo pero pues no tenemos https)
    sameSite: 'Strict',
    path: '/'
}

router.get("/", (req, res) => {
    if ((req.cookies && req.cookies.session_id)) {
        const user = auth.authenticate(req.cookies.session_id)
        if (user) {
            const jsonUser = JSON.stringify(user)
            res.render("index", { jsonUser });
            return;
        }
    }
    res.render("index");
});

//router.get("/dashboard",(req,res)=>{
//    res.render("general.html")
//});

router.post("/login", (req, res) => {
    const session_id = auth.login(req.body.email, req.body.password);
    if (typeof session_id === "number") {
        res.json({
            code: session_id
        })
    } else {
        res.cookie('session_id', session_id, COOKIEOPTIONS);
        const user = auth.authenticate(session_id)
        res.json({
            code: 0,
            email: user.getEmail(),
            name: user.getName(),
            bio: user.getBio()
        })
    }
});

router.post("/register", (req, res) => {
    const session_id = auth.register(req.body.email, req.body.password, req.body.name, req.body.bio);
    if (typeof session_id === "number") {
        res.json({
            code: session_id
        })
    } else {
        res.cookie('session_id', session_id, COOKIEOPTIONS);
        const user = auth.authenticate(session_id)
        res.json({
            code: 0,
            email: user.getEmail(),
            name: user.getName(),
            bio: user.getBio()
        })
    }
});

router.post("/updateUser", (req, res) => {
    if ((req.cookies && req.cookies.session_id)) {
        const user = auth.authenticate(req.cookies.session_id)
        if (user) {
            if (req.body.name) {
                user.setName(req.body.name)
            }
            if ('bio' in req.body) {
                user.setBio(req.body.bio)
            }
            res.json({code: 0});
            return;
        }
    }
    res.json({code: 21});
})

router.post("/logout", (req, res) => {
    if ((req.cookies && req.cookies.session_id)) {
        auth.logout(req.cookies.session_id)
    }
    res.clearCookie('session_id', COOKIEOPTIONSDELETE)
    res.send()
})

//renderizar pagina de detalles de la asignatura
router.get('/subject/:id/details', (req, res) => {
    const id = req.params.id;
    // Pasamos solo el id; la página cliente puede usarlo para mostrar detalles o cargar datos.
    res.render('subject', { subject: { id } });
});

//renderizar página del foro
router.get('/subject/:id/forum', (req, res) => {
    const id = req.params.id;
    // Pasamos solo el id; la página cliente puede usarlo para mostrar detalles o cargar datos.
    res.render('', { subject: { id } });
});

export default router;