// src/services/fileProcessor.js
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

class FileProcessor {
  constructor() {
    this.processedDir = path.join(__dirname, '../../uploads/processed');
  }

  async processFile(uploadId, session, io) {
    try {
      io.emit('processing-start', {
        uploadId,
        fileName: session.fileName,
        message: 'Bắt đầu xử lý file...'
      });

      const fileType = this.getFileType(session.mimeType);
      let result;

      switch (fileType) {
        case 'image':
          result = await this.processImage(uploadId, session, io);
          break;
        case 'video':
          result = await this.processVideo(uploadId, session, io);
          break;
        case 'document':
          result = await this.processDocument(uploadId, session, io);
          break;
        default:
          result = await this.processGenericFile(uploadId, session, io);
      }

      io.emit('processing-complete', {
        uploadId,
        result,
        message: 'Xử lý file hoàn tất!'
      });

    } catch (error) {
      console.error('Processing error:', error);
      io.emit('processing-error', {
        uploadId,
        error: error.message
      });
    }
  }

  getFileType(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.includes('pdf') || mimeType.includes('document')) return 'document';
    return 'generic';
  }

  async processImage(uploadId, session, io) {
    const inputPath = session.filePath;
    const outputDir = path.join(this.processedDir, uploadId);
    await fs.ensureDir(outputDir);

    const results = {
      original: inputPath,
      processed: []
    };

    // Tạo thumbnail
    io.emit('processing-update', {
      uploadId,
      step: 'Tạo thumbnail...',
      progress: 25
    });

    const thumbnailPath = path.join(outputDir, 'thumbnail.jpg');
    await sharp(inputPath)
      .resize(300, 300, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);
    
    results.processed.push({
      type: 'thumbnail',
      path: thumbnailPath,
      size: '300x300'
    });

    // Tạo medium size
    io.emit('processing-update', {
      uploadId,
      step: 'Tạo ảnh kích thước trung bình...',
      progress: 50
    });

    const mediumPath = path.join(outputDir, 'medium.jpg');
    await sharp(inputPath)
      .resize(800, 600, { fit: 'inside' })
      .jpeg({ quality: 85 })
      .toFile(mediumPath);
    
    results.processed.push({
      type: 'medium',
      path: mediumPath,
      size: '800x600'
    });

    // Tối ưu hóa ảnh gốc
    io.emit('processing-update', {
      uploadId,
      step: 'Tối ưu hóa ảnh gốc...',
      progress: 75
    });

    const optimizedPath = path.join(outputDir, 'optimized.jpg');
    await sharp(inputPath)
      .jpeg({ quality: 90, progressive: true })
      .toFile(optimizedPath);
    
    results.processed.push({
      type: 'optimized',
      path: optimizedPath,
      size: 'original'
    });

    io.emit('processing-update', {
      uploadId,
      step: 'Hoàn tất xử lý ảnh',
      progress: 100
    });

    return results;
  }

  async processVideo(uploadId, session, io) {
    const inputPath = session.filePath;
    const outputDir = path.join(this.processedDir, uploadId);
    await fs.ensureDir(outputDir);

    const results = {
      original: inputPath,
      processed: []
    };

    return new Promise((resolve, reject) => {
      // Tạo thumbnail từ video
      io.emit('processing-update', {
        uploadId,
        step: 'Tạo thumbnail từ video...',
        progress: 20
      });

      const thumbnailPath = path.join(outputDir, 'thumbnail.jpg');
      
      ffmpeg(inputPath)
        .screenshots({
          timestamps: ['10%'],
          filename: 'thumbnail.jpg',
          folder: outputDir,
          size: '320x240'
        })
        .on('end', async () => {
          results.processed.push({
            type: 'thumbnail',
            path: thumbnailPath
          });

          // Tạo preview video (compressed)
          io.emit('processing-update', {
            uploadId,
            step: 'Tạo video preview...',
            progress: 60
          });

          const previewPath = path.join(outputDir, 'preview.mp4');
          
          ffmpeg(inputPath)
            .output(previewPath)
            .videoCodec('libx264')
            .audioCodec('aac')
            .size('720x480')
            .videoBitrate('1000k')
            .on('progress', (progress) => {
              const percent = Math.round(60 + (progress.percent * 0.4));
              io.emit('processing-update', {
                uploadId,
                step: `Nén video: ${Math.round(progress.percent)}%`,
                progress: percent
              });
            })
            .on('end', () => {
              results.processed.push({
                type: 'preview',
                path: previewPath,
                quality: '720p'
              });
              resolve(results);
            })
            .on('error', reject)
            .run();
        })
        .on('error', reject);
    });
  }

  async processDocument(uploadId, session, io) {
    // Xử lý cơ bản cho document
    io.emit('processing-update', {
      uploadId,
      step: 'Phân tích document...',
      progress: 50
    });

    const stats = await fs.stat(session.filePath);
    
    return {
      original: session.filePath,
      metadata: {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      }
    };
  }

  async processGenericFile(uploadId, session, io) {
    io.emit('processing-update', {
      uploadId,
      step: 'Xử lý file thông thường...',
      progress: 100
    });

    const stats = await fs.stat(session.filePath);
    
    return {
      original: session.filePath,
      metadata: {
        size: stats.size,
        type: session.mimeType,
        created: stats.birthtime
      }
    };
  }
}

module.exports = FileProcessor;