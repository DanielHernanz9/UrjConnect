import express from 'express';
import * as auth from './authService.js';

const router = express.Router();

router.get("/", (req, res) => {
    res.render("index");
});

//router.get("/dashboard",(req,res)=>{
//    res.render("general.html")
//});

router.post("/login", (req, res) => {
    const token = auth.login(req.body.email, req.body.password);
    if (typeof token === "number") {
        res.json({
            code: token
        })
    } else {
        res.json({
            code: 0,
            token: token
        })
    }
});

router.post("/register", (req, res) => {
    const token = auth.register(req.body.email, req.body.password, req.body.name, req.body.bio);
    if (typeof token === "number") {
        res.json({
            code: token
        })
    } else {
        res.json({
            code: 0,
            token: token
        })
    }
});

export default router;