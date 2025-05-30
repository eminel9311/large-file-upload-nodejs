// src/routes/uploadRoutes.js
const express = require("express");
const multer = require("multer");
const uploadController = require("../controllers/uploadController");

const router = express.Router();

// Configure multer for chunk uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per chunk
  },
});

// Middleware to attach socket.io to request
const attachIO = (req, res, next) => {
  req.io = req.app.get("io");
  next();
};

// Routes
router.post("/initialize", (req, res) => uploadController.initializeUpload(req, res));
router.post(
  "/chunk",
  upload.single("chunk"),
  attachIO,
  (req, res) => uploadController.uploadChunk(req, res)
);
router.get("/info/:uploadId", (req, res) => uploadController.getUploadInfo(req, res));
router.delete("/cleanup/:uploadId", (req, res) => uploadController.cleanupUpload(req, res));
router.get("/active", (req, res) => uploadController.getActiveUploads(req, res));

module.exports = router;
