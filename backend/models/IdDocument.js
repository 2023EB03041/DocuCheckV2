import mongoose from "mongoose";

const idDocumentSchema = new mongoose.Schema({
	filename: {
		type: String,
		required: true,
	},
	contentType: {
		type: String,
		required: true,
	},
	data: {
		type: Buffer,
		required: true,
	},
	documentHash: {
		type: String,
		required: true,
		index: true,
	},
	uploadedAt: {
		type: Date,
		default: Date.now,
		expires: 94608000, //  deletes document after 3 years
	},
});

const IdDocument = mongoose.model("IdDocument", idDocumentSchema);

export default IdDocument;
