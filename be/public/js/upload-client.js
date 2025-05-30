// public/js/upload-client.js
class LargeFileUploader {
  constructor() {
    this.socket = io();
    this.chunkSize = 1024 * 1024; // 1MB chunks
    this.activeUploads = new Map();
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.socket.on('upload-progress', (data) => {
      this.updateProgress(data);
    });

    this.socket.on('upload-complete', (data) => {
      this.handleUploadComplete(data);
    });

    this.socket.on('processing-start', (data) => {
      this.updateStatus(data.uploadId, 'Bắt đầu xử lý...');
    });

    this.socket.on('processing-update', (data) => {
      this.updateProcessingProgress(data);
    });

    this.socket.on('processing-complete', (data) => {
      this.handleProcessingComplete(data);
    });
  }

  async uploadFile(file) {
    const uploadId = await this.initializeUpload(file);
    if (!uploadId) return;

    // Tạo UI động cho từng uploadId
    const uploadsDiv = document.getElementById('uploads') || document.body;
    const block = document.createElement('div');
    block.innerHTML = `
      <div><b>${file.name}</b></div>
      <progress id="progress-${uploadId}" max="100" value="0" style="width:100%"></progress>
      <div id="progress-text-${uploadId}">0%</div>
      <progress id="processing-progress-${uploadId}" max="100" value="0" style="width:100%; display:none"></progress>
      <div id="processing-text-${uploadId}" style="display:none"></div>
      <div id="status-${uploadId}"></div>
    `;
    uploadsDiv.appendChild(block);

    const totalChunks = Math.ceil(file.size / this.chunkSize);
    this.activeUploads.set(uploadId, {
      file,
      totalChunks,
      uploadedChunks: 0
    });

    // Upload chunks parallel (with limit)
    const concurrency = 3;
    const chunks = [];
    for (let i = 0; i < totalChunks; i++) {
      chunks.push(i);
    }
    await this.uploadChunksWithConcurrency(uploadId, file, chunks, concurrency);
  }

  async initializeUpload(file) {
    try {
      const response = await fetch('/api/upload/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          chunkSize: this.chunkSize,
          mimeType: file.type
        })
      });

      const result = await response.json();
      return result.success ? result.uploadId : null;
    } catch (error) {
      console.error('Initialize upload failed:', error);
      return null;
    }
  }

  async uploadChunksWithConcurrency(uploadId, file, chunks, concurrency) {
    const executing = [];
    
    for (const chunkIndex of chunks) {
      const promise = this.uploadChunk(uploadId, file, chunkIndex);
      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(executing.findIndex(p => p.completed), 1);
      }
    }

    await Promise.all(executing);
  }

  async uploadChunk(uploadId, file, chunkIndex) {
    const start = chunkIndex * this.chunkSize;
    const end = Math.min(start + this.chunkSize, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', chunkIndex);

    try {
      const response = await fetch('/api/upload/chunk', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error(`Chunk ${chunkIndex} upload failed:`, error);
      throw error;
    }
  }

  updateProgress(data) {
    const progressBar = document.getElementById(`progress-${data.uploadId}`);
    const progressText = document.getElementById(`progress-text-${data.uploadId}`);
    
    if (progressBar) {
      progressBar.value = data.progress;
    }
    
    if (progressText) {
      progressText.textContent = `${data.progress}% (${data.receivedChunks}/${data.totalChunks} chunks)`;
    }
  }

  updateStatus(uploadId, status) {
    const statusElement = document.getElementById(`status-${uploadId}`);
    if (statusElement) {
      statusElement.textContent = status;
    }
  }

  updateProcessingProgress(data) {
    const progressBar = document.getElementById(`processing-progress-${data.uploadId}`);
    const progressText = document.getElementById(`processing-text-${data.uploadId}`);
    
    if (progressBar) {
      progressBar.value = data.progress;
    }
    
    if (progressText) {
      progressText.textContent = `${data.progress}% - ${data.message}`;
    }
    this.updateStatus(data.uploadId, `Đang xử lý: ${data.message}`);
    console.log('Processing update:', data);
  }

  handleUploadComplete(data) {
    this.updateStatus(data.uploadId, `Upload hoàn tất - ${data.fileName}`);
    console.log('Upload completed:', data);
  }

  handleProcessingComplete(data) {
    this.updateStatus(data.uploadId, 'Xử lý hoàn tất!');
    console.log('Processing completed:', data);
  }
}

// Initialize uploader
const uploader = new LargeFileUploader();

// Attach uploader to file input
document.getElementById('fileInput').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    uploader.uploadFile(file);
  } else {
    console.error('No file selected');
  }
});