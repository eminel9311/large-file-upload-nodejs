// src/routes/fileRoutes.js
const express = require("express");
const fileController = require("../controllers/fileController");

const router = express.Router();

// File management routes
router.get("/list", (req, res) => fileController.getFilesList(req, res));
router.get("/info/:fileId", (req, res) => fileController.getFileInfo(req, res));
router.get("/download/:fileId", (req, res) => fileController.downloadFile(req, res));
router.get("/download/:fileId/:variant", (req, res) => fileController.downloadFile(req, res));
router.delete("/:fileId", (req, res) => fileController.deleteFile(req, res));
router.get("/metadata/:fileId", (req, res) => fileController.getFileMetadata(req, res));
router.get("/search", (req, res) => fileController.searchFiles(req, res));
router.get("/stats", (req, res) => fileController.getStorageStats(req, res));

module.exports = router;
