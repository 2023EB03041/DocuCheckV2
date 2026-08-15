import express from "express";
import documentController from "../controllers/documentController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:id", authMiddleware, documentController.getDocument);

export default router;
