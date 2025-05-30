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
router.post("/initialize", uploadController.initializeUpload);
router.post(
  "/chunk",
  upload.single("chunk"),
  attachIO,
  uploadController.uploadChunk
);
router.get("/info/:uploadId", uploadController.getUploadInfo);
router.delete("/cleanup/:uploadId", uploadController.cleanupUpload);
router.get("/active", uploadController.getActiveUploads);

module.exports = router;
