import express from 'express';

import { addReport } from '../controllers/reportController.js';

const router = express.Router();

router.post('/', addReport);

export default router;
