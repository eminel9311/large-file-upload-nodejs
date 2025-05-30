// src/controllers/uploadController.js
const UploadService = require("../services/uploadService");

class UploadController {
  constructor() {
    this.uploadService = new UploadService();
  }

  // Khởi tạo upload session
  async initializeUpload(req, res) {

    try {
      const { fileName, fileSize, chunkSize, mimeType } = req.body;

      if (!fileName || !fileSize || !chunkSize) {
        return res.status(400).json({
          error: "Missing required parameters",
        });
      }
      const session = await this.uploadService.initializeUpload(
        fileName,
        fileSize,
        chunkSize,
        mimeType
      );

      res.json({
        success: true,
        uploadId: session.uploadId,
        totalChunks: session.totalChunks,
      });
    } catch (error) {
      console.error("Initialize upload error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  // Upload chunk
  async uploadChunk(req, res) {
    try {
      const { uploadId, chunkIndex } = req.body;
      const chunkBuffer = req.file.buffer;
      const result = await this.uploadService.handleChunkUpload(
        uploadId,
        parseInt(chunkIndex),
        chunkBuffer,
        req.io
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("Chunk upload error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  // Lấy thông tin upload
  async getUploadInfo(req, res) {
    try {
      const { uploadId } = req.params;
      const info = this.uploadService.getUploadInfo(uploadId);

      if (!info) {
        return res.status(404).json({ error: "Upload not found" });
      }

      res.json({
        success: true,
        info: {
          uploadId: info.uploadId,
          fileName: info.fileName,
          progress: (info.receivedChunks.size / info.totalChunks) * 100,
          status: info.status,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Cleanup upload
  async cleanupUpload(req, res) {
    try {
      const { uploadId } = req.params;
      await this.uploadService.cleanupUpload(uploadId);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Lấy danh sách upload đang hoạt động
  async getActiveUploads(req, res) {
    try {
      const uploads = this.uploadService.getActiveUploads();

      res.json({
        success: true,
        uploads: Array.from(uploads.values()).map(upload => ({
          uploadId: upload.uploadId,
          fileName: upload.fileName,
          totalChunks: upload.totalChunks,
          receivedChunks: upload.receivedChunks.size,
          status: upload.status,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
// Lấy danh sách upload đã hoàn thành
  async getCompletedUploads(req, res) {
    try {
      const completedUploads = this.uploadService.getCompletedUploads();

      res.json({
        success: true,
        uploads: completedUploads.map(upload => ({
          uploadId: upload.uploadId,
          fileName: upload.fileName,
          totalChunks: upload.totalChunks,
          status: upload.status,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  // Lấy danh sách upload đã hủy
  async getCancelledUploads(req, res) {
    try {
      const cancelledUploads = this.uploadService.getCancelledUploads();

      res.json({
        success: true,
        uploads: cancelledUploads.map(upload => ({
          uploadId: upload.uploadId,
          fileName: upload.fileName,
          totalChunks: upload.totalChunks,
          status: upload.status,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  // Hủy upload
  async cancelUpload(req, res) {
    try {
      const { uploadId } = req.params;
      await this.uploadService.cancelUpload(uploadId);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  // Lấy danh sách upload đã hủy
  async getCancelledUploads(req, res) {
    try {
      const cancelledUploads = this.uploadService.getCancelledUploads();

      res.json({
        success: true,
        uploads: cancelledUploads.map(upload => ({
          uploadId: upload.uploadId,
          fileName: upload.fileName,
          totalChunks: upload.totalChunks,
          status: upload.status,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new UploadController();
