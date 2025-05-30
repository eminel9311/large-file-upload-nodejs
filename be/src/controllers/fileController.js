// src/controllers/fileController.js
const fs = require("fs-extra");
const path = require("path");
const mime = require("mime-types");

class FileController {
  constructor() {
    this.uploadsDir = path.join(__dirname, "../../uploads");
    this.tempDir = path.join(this.uploadsDir, "temp");
    this.processedDir = path.join(this.uploadsDir, "processed");
  }

  // Lấy danh sách files đã upload
  async getFilesList(req, res) {
    try {
      const { page = 1, limit = 10, type = "all" } = req.query;
      const offset = (page - 1) * limit;

      const files = await this.scanDirectory(this.tempDir);
      const processedFiles = await this.scanDirectory(this.processedDir);

      // Merge và sort files
      const allFiles = [...files, ...processedFiles].sort(
        (a, b) => new Date(b.uploadTime) - new Date(a.uploadTime)
      );

      // Filter by type
      const filteredFiles =
        type === "all"
          ? allFiles
          : allFiles.filter((file) => file.type.startsWith(type));

      // Pagination
      const paginatedFiles = filteredFiles.slice(
        offset,
        offset + parseInt(limit)
      );

      res.json({
        success: true,
        files: paginatedFiles,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(filteredFiles.length / limit),
          count: filteredFiles.length,
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      console.error("Get files list error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  // Lấy thông tin chi tiết của file
  async getFileInfo(req, res) {
    try {
      const { fileId } = req.params;

      // Tìm file trong temp và processed directories
      const tempFilePath = await this.findFileById(fileId, this.tempDir);
      const processedFilePath = await this.findFileById(
        fileId,
        this.processedDir
      );

      const filePath = tempFilePath || processedFilePath;

      if (!filePath) {
        return res.status(404).json({
          error: "File not found",
          fileId,
        });
      }

      const stats = await fs.stat(filePath);
      const fileInfo = {
        id: fileId,
        name: path.basename(filePath),
        path: filePath,
        size: stats.size,
        type: mime.lookup(filePath) || "application/octet-stream",
        created: stats.birthtime,
        modified: stats.mtime,
        isProcessed: filePath.includes("processed"),
      };

      // Nếu là file đã processed, lấy thêm thông tin processed files
      if (fileInfo.isProcessed) {
        const processedDir = path.dirname(filePath);
        const processedFiles = await this.getProcessedVariants(processedDir);
        fileInfo.variants = processedFiles;
      }

      res.json({
        success: true,
        file: fileInfo,
      });
    } catch (error) {
      console.error("Get file info error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  // Download file
  async downloadFile(req, res) {
    try {
      const { fileId, variant } = req.params;

      let filePath;

      if (variant === "original") {
        const tempFilePath = await this.findFileById(fileId, this.tempDir);
        const processedFilePath = await this.findFileById(
          fileId,
          this.processedDir
        );
        filePath = tempFilePath || processedFilePath;
      } else {
        // Tìm variant trong processed directory
        const processedDir = path.join(this.processedDir, fileId);
        const variantPath = path.join(processedDir, `${variant}.jpg`);

        if (await fs.pathExists(variantPath)) {
          filePath = variantPath;
        }
      }

      if (!filePath || !(await fs.pathExists(filePath))) {
        return res.status(404).json({
          error: "File not found",
          fileId,
          variant,
        });
      }

      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      const mimeType = mime.lookup(filePath) || "application/octet-stream";

      // Set headers
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Length", stats.size);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );
      res.setHeader("Accept-Ranges", "bytes");

      // Handle range requests (for video streaming)
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunkSize = end - start + 1;

        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${stats.size}`);
        res.setHeader("Content-Length", chunkSize);

        const stream = fs.createReadStream(filePath, { start, end });
        stream.pipe(res);
      } else {
        // Normal download
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
      }
    } catch (error) {
      console.error("Download file error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  // Xóa file
  async deleteFile(req, res) {
    try {
      const { fileId } = req.params;

      // Tìm và xóa file từ temp directory
      const tempFilePath = await this.findFileById(fileId, this.tempDir);
      if (tempFilePath) {
        await fs.remove(tempFilePath);
      }

      // Tìm và xóa processed directory
      const processedDir = path.join(this.processedDir, fileId);
      if (await fs.pathExists(processedDir)) {
        await fs.remove(processedDir);
      }

      res.json({
        success: true,
        message: "File deleted successfully",
        fileId,
      });
    } catch (error) {
      console.error("Delete file error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  // Lấy metadata của file
  async getFileMetadata(req, res) {
    try {
      const { fileId } = req.params;

      const filePath =
        (await this.findFileById(fileId, this.tempDir)) ||
        (await this.findFileById(fileId, this.processedDir));

      if (!filePath) {
        return res.status(404).json({ error: "File not found" });
      }

      const stats = await fs.stat(filePath);
      const metadata = {
        name: path.basename(filePath),
        size: stats.size,
        type: mime.lookup(filePath),
        created: stats.birthtime,
        modified: stats.mtime,
        extension: path.extname(filePath),
        directory: path.dirname(filePath),
      };

      // Thêm metadata specific cho từng loại file
      if (metadata.type?.startsWith("image/")) {
        // Có thể thêm EXIF data ở đây
        metadata.category = "image";
      } else if (metadata.type?.startsWith("video/")) {
        metadata.category = "video";
      } else if (metadata.type?.includes("pdf")) {
        metadata.category = "document";
      } else {
        metadata.category = "other";
      }

      res.json({
        success: true,
        metadata,
      });
    } catch (error) {
      console.error("Get metadata error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  // Search files
  async searchFiles(req, res) {
    try {
      const {
        query,
        type = "all",
        sortBy = "modified",
        order = "desc",
        page = 1,
        limit = 10,
      } = req.query;

      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }

      const files = await this.scanDirectory(this.tempDir);
      const processedFiles = await this.scanDirectory(this.processedDir);
      const allFiles = [...files, ...processedFiles];

      // Filter by search query
      const searchResults = allFiles.filter(
        (file) =>
          file.name.toLowerCase().includes(query.toLowerCase()) ||
          file.type.toLowerCase().includes(query.toLowerCase())
      );

      // Filter by type
      const typeFiltered =
        type === "all"
          ? searchResults
          : searchResults.filter((file) => file.type.startsWith(type));

      // Sort results
      const sorted = typeFiltered.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];

        if (order === "desc") {
          return bVal > aVal ? 1 : -1;
        } else {
          return aVal > bVal ? 1 : -1;
        }
      });

      // Pagination
      const offset = (page - 1) * limit;
      const paginated = sorted.slice(offset, offset + parseInt(limit));

      res.json({
        success: true,
        results: paginated,
        query,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(sorted.length / limit),
          count: sorted.length,
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      console.error("Search files error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  // Get storage statistics
  async getStorageStats(req, res) {
    try {
      const tempStats = await this.getDirectoryStats(this.tempDir);
      const processedStats = await this.getDirectoryStats(this.processedDir);

      const stats = {
        temp: tempStats,
        processed: processedStats,
        total: {
          files: tempStats.files + processedStats.files,
          size: tempStats.size + processedStats.size,
        },
      };

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error("Get storage stats error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  // Helper methods
  async scanDirectory(directory) {
    const files = [];

    if (!(await fs.pathExists(directory))) {
      return files;
    }

    const items = await fs.readdir(directory);

    for (const item of items) {
      const fullPath = path.join(directory, item);
      const stats = await fs.stat(fullPath);

      if (stats.isFile()) {
        files.push({
          id: path.parse(item).name.split("-")[0], // Extract ID from filename
          name: item,
          path: fullPath,
          size: stats.size,
          type: mime.lookup(fullPath) || "application/octet-stream",
          uploadTime: stats.birthtime,
          modified: stats.mtime,
        });
      }
    }

    return files;
  }

  async findFileById(fileId, directory) {
    if (!(await fs.pathExists(directory))) {
      return null;
    }

    const items = await fs.readdir(directory);

    for (const item of items) {
      if (item.startsWith(fileId)) {
        return path.join(directory, item);
      }
    }

    return null;
  }

  async getProcessedVariants(processedDir) {
    const variants = [];

    if (!(await fs.pathExists(processedDir))) {
      return variants;
    }

    const items = await fs.readdir(processedDir);

    for (const item of items) {
      const fullPath = path.join(processedDir, item);
      const stats = await fs.stat(fullPath);

      if (stats.isFile()) {
        variants.push({
          name: item,
          path: fullPath,
          size: stats.size,
          type: mime.lookup(fullPath),
        });
      }
    }

    return variants;
  }

  async getDirectoryStats(directory) {
    let files = 0;
    let size = 0;

    if (!(await fs.pathExists(directory))) {
      return { files, size };
    }

    const items = await fs.readdir(directory, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(directory, item.name);

      if (item.isFile()) {
        const stats = await fs.stat(fullPath);
        files++;
        size += stats.size;
      } else if (item.isDirectory()) {
        const subStats = await this.getDirectoryStats(fullPath);
        files += subStats.files;
        size += subStats.size;
      }
    }

    return { files, size };
  }
}

module.exports = new FileController();
