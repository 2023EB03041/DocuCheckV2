import express from "express";
import multer from "multer";
import verifyController from "../controllers/verifyController.js";
import requireGuest from "../middleware/requireGuest.js";

const router = express.Router();

// Configure Multer for memory storage
const storage = multer.memoryStorage();

const upload = multer({
	storage: storage,
	limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

router.post(
	"/",
	requireGuest,
	upload.single("idDocument"),
	verifyController.verify,
);

export default router;
