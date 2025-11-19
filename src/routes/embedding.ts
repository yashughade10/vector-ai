import { Router } from "express";
import { generateExcelEmbedding, generatePdfEmbedding } from "../controllers/embeddings.controller";

const router = Router();

router.get('/embedding/pdf', generatePdfEmbedding);

router.get('/embedding/excel', generateExcelEmbedding);

export default router;