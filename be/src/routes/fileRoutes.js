// src/routes/fileRoutes.js
const express = require('express');
const fileController = require('../controllers/fileController');

const router = express.Router();

// File management routes
router.get('/list', fileController.getFilesList);
router.get('/info/:fileId', fileController.getFileInfo);
router.get('/download/:fileId', fileController.downloadFile);
router.get('/download/:fileId/:variant', fileController.downloadFile);
// router.delete('/:fileId', fileController.deleteFile);
// router.get('/metadata/:fileId', fileController.getFileMetadata);
// router.get('/search', fileController.searchFiles);
// router.get('/stats', fileController.getStorageStats);

module.exports = router;