// src/config/config.js
const path = require('path');

module.exports = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },
  
  upload: {
    directory: path.join(__dirname, '../../uploads'),
    tempDirectory: path.join(__dirname, '../../uploads/temp'),
    chunksDirectory: path.join(__dirname, '../../uploads/chunks'),
    processedDirectory: path.join(__dirname, '../../uploads/processed'),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 * 1024, // 5GB
    chunkSize: parseInt(process.env.CHUNK_SIZE) || 1024 * 1024, // 1MB
    allowedTypes: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv',
      'application/pdf', 'text/plain',
      'application/zip', 'application/x-rar-compressed'
    ]
  },

  processing: {
    image: {
      thumbnailSize: { width: 300, height: 300 },
      mediumSize: { width: 800, height: 600 },
      quality: {
        thumbnail: 80,
        medium: 85,
        optimized: 90
      }
    },
    video: {
      thumbnailTime: '10%',
      previewQuality: '720p',
      compressionBitrate: '1000k'
    }
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: 24 * 60 * 60 // 24 hours
  },

  cleanup: {
    tempFileAge: 24 * 60 * 60 * 1000, // 24 hours
    sessionAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    cleanupInterval: 60 * 60 * 1000 // 1 hour
  }
};