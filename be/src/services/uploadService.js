// src/services/uploadService.js
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const FileProcessor = require('./fileProcessor');

class UploadService {
  constructor() {
    this.uploadDir = path.join(__dirname, '../../uploads');
    this.tempDir = path.join(this.uploadDir, 'temp');
    this.chunksDir = path.join(this.uploadDir, 'chunks');
    this.processedDir = path.join(this.uploadDir, 'processed');
    
    this.initializeDirectories();
    this.fileProcessor = new FileProcessor();
    this.activeUploads = new Map();
  }

  async initializeDirectories() {
    await fs.ensureDir(this.uploadDir);
    await fs.ensureDir(this.tempDir);
    await fs.ensureDir(this.chunksDir);
    await fs.ensureDir(this.processedDir);
  }

  // Khởi tạo upload session
  async initializeUpload(fileName, fileSize, chunkSize, mimeType) {
    const uploadId = uuidv4();
    const totalChunks = Math.ceil(fileSize / chunkSize);
    
    const uploadSession = {
      uploadId,
      fileName,
      fileSize,
      chunkSize,
      totalChunks,
      mimeType,
      receivedChunks: new Set(),
      startTime: Date.now(),
      status: 'initialized'
    };


    this.activeUploads.set(uploadId, uploadSession);
    
    // Tạo thư mục cho chunks
    const chunkDir = path.join(this.chunksDir, uploadId);
    await fs.ensureDir(chunkDir);

    return uploadSession;
  }

  // Xử lý chunk upload
  async handleChunkUpload(uploadId, chunkIndex, chunkBuffer, io) {
    const session = this.activeUploads.get(uploadId);
    if (!session) {
      throw new Error('Upload session not found');
    }

    const chunkPath = path.join(this.chunksDir, uploadId, `chunk-${chunkIndex}`);
    await fs.writeFile(chunkPath, chunkBuffer);
    
    session.receivedChunks.add(chunkIndex);
    
    // Tính toán progress
    const progress = (session.receivedChunks.size / session.totalChunks) * 100;
    
    // Broadcast progress
    io.emit('upload-progress', {
      uploadId,
      progress: Math.round(progress),
      receivedChunks: session.receivedChunks.size,
      totalChunks: session.totalChunks
    });

    // Kiểm tra nếu đã nhận đủ chunks
    if (session.receivedChunks.size === session.totalChunks) {
      await this.assembleFile(uploadId, io);
    }

    return {
      uploadId,
      chunkIndex,
      progress,
      status: session.receivedChunks.size === session.totalChunks ? 'complete' : 'uploading'
    };
  }

  // Ghép các chunks thành file hoàn chỉnh
  async assembleFile(uploadId, io) {
    const session = this.activeUploads.get(uploadId);
    if (!session) {
      throw new Error('Upload session not found');
    }

    io.emit('upload-status', {
      uploadId,
      status: 'assembling',
      message: 'Đang ghép file...'
    });

    const finalPath = path.join(this.tempDir, `${uploadId}-${session.fileName}`);
    const writeStream = fs.createWriteStream(finalPath);
    
    try {
      // Ghép chunks theo thứ tự
      for (let i = 0; i < session.totalChunks; i++) {
        const chunkPath = path.join(this.chunksDir, uploadId, `chunk-${i}`);
        const chunkBuffer = await fs.readFile(chunkPath);
        writeStream.write(chunkBuffer);
      }
      
      writeStream.end();
      
      // Cleanup chunks
      await fs.remove(path.join(this.chunksDir, uploadId));
      
      // Update session
      session.status = 'assembled';
      session.filePath = finalPath;
      session.assembledTime = Date.now();

      io.emit('upload-complete', {
        uploadId,
        fileName: session.fileName,
        fileSize: session.fileSize,
        uploadTime: session.assembledTime - session.startTime,
        filePath: finalPath
      });

      // Bắt đầu processing
      await this.fileProcessor.processFile(uploadId, session, io);
      
    } catch (error) {
      console.error('Error assembling file:', error);
      throw error;
    }
  }

  // Lấy thông tin upload
  getUploadInfo(uploadId) {
    return this.activeUploads.get(uploadId);
  }

  // Cleanup completed uploads
  async cleanupUpload(uploadId) {
    const session = this.activeUploads.get(uploadId);
    if (session) {
      // Xóa file tạm nếu tồn tại
      if (session.filePath) {
        await fs.remove(session.filePath).catch(() => {});
      }
      
      // Xóa chunks nếu tồn tại
      const chunkDir = path.join(this.chunksDir, uploadId);
      await fs.remove(chunkDir).catch(() => {});
      
      this.activeUploads.delete(uploadId);
    }
  }

  // Lấy danh sách active uploads
  getActiveUploads() {
    return Array.from(this.activeUploads.values());
  }
}

module.exports = UploadService;