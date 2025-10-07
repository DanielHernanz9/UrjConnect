import express from 'express';

import * as service from './service.js';

const router = express.Router();

router.get("/", (req, res) => {
    res.render("index");
});

export default router;