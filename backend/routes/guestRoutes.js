import express from "express";
import guestController from "../controllers/guestController.js";
import requireGuest from "../middleware/requireGuest.js";

const router = express.Router();

router.post("/login/request", guestController.requestLoginCode);
router.post("/login/verify", guestController.confirmLoginCode);

router.get("/session", requireGuest, guestController.getSession);
router.get("/reservations", requireGuest, guestController.getMyReservations);

export default router;
