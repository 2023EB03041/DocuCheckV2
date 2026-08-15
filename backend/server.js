import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import reservationRoutes from "./routes/reservationRoutes.js";
import verifyRoutes from "./routes/verifyRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import guestRoutes from "./routes/guestRoutes.js";

dotenv.config();

if (!process.env.JWT_SECRET) {
	console.error(
		"FATAL ERROR: JWT_SECRET is not defined. Set it in the environment before starting.",
	);
	process.exit(1);
}

const app = express();

const DEFAULT_ORIGINS = [
	"https://docucheckv2.pages.dev",
	"http://localhost:5173",
	"http://127.0.0.1:5173",
];

const allowedOrigins = (process.env.CORS_ORIGINS || "")
	.split(",")
	.map((entry) => entry.trim())
	.filter(Boolean);

const originAllowList = allowedOrigins.length
	? allowedOrigins
	: DEFAULT_ORIGINS;

app.use(
	cors({
		origin: (origin, callback) =>
			callback(null, !origin || originAllowList.includes(origin)),
		credentials: true,
	}),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/reservations", reservationRoutes);
app.use("/api/verify", verifyRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/guest", guestRoutes);

import Room from "./models/Room.js";
import User from "./models/User.js";
import bcrypt from "bcryptjs";
import { buildRoomInventory } from "./config/roomPricing.js";

const PORT = process.env.PORT || 5000;

const connectDB = async () => {
	try {
		let uri = process.env.MONGO_URI;

		if (!uri) {
			console.error("FATAL ERROR: MONGO_URI is not defined in .env file.");
			process.exit(1);
		}

		await mongoose.connect(uri);
		console.log("Connected to MongoDB Atlas");

		const desiredRooms = buildRoomInventory();

		await Room.bulkWrite(
			desiredRooms.map((r) => ({
				updateOne: {
					filter: { roomNumber: r.roomNumber },
					update: {
						$set: { type: r.type, pricePerNight: r.pricePerNight },
						$setOnInsert: { status: "Available" },
					},
					upsert: true,
				},
			})),
		);

		const retired = await Room.deleteMany({
			roomNumber: { $nin: desiredRooms.map((r) => r.roomNumber) },
			currentReservation: { $in: [null, undefined] },
		});

		const stranded = await Room.countDocuments({
			roomNumber: { $nin: desiredRooms.map((r) => r.roomNumber) },
		});

		console.log(
			`Room inventory ensured: ${desiredRooms.length} rooms.` +
				(retired.deletedCount
					? ` Withdrew ${retired.deletedCount} no longer in the rate card.`
					: "") +
				(stranded ? ` ${stranded} kept until their current stay ends.` : ""),
		);

		// Seed default Superuser for PMS Demo
		const userCount = await User.countDocuments();
		if (userCount === 0) {
			console.log("Seeding default Superuser...");
			const salt = await bcrypt.genSalt(10);
			const hashedPassword = await bcrypt.hash("password123", salt);
			await User.create({
				name: "System Admin",
				email: "admin@lumina.com",
				phone: "9999999999",
				username: "admin",
				password: hashedPassword,
				role: "Superuser",
			});
		}

		app.listen(PORT, () => {
			console.log(`Server running on port ${PORT}`);
		});
	} catch (error) {
		console.error("Error connecting to MongoDB:", error.message);
	}
};

connectDB();
