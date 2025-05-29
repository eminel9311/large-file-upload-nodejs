// src/services/realtimeService.js
const EventEmitter = require('events');
const fs = require('fs-extra');
const path = require('path');

class RealtimeService extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.connectedClients = new Map();
    this.uploadSessions = new Map();
    this.roomSubscriptions = new Map();
    
    this.setupSocketHandlers();
    this.startHeartbeat();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);
      
      this.connectedClients.set(socket.id, {
        socket,
        connectedAt: Date.now(),
        rooms: new Set()
      });

      // Join upload room for receiving updates
      socket.on('join-upload-room', (uploadId) => {
        socket.join(`upload-${uploadId}`);
        
        const client = this.connectedClients.get(socket.id);
        client.rooms.add(`upload-${uploadId}`);
        
        // Track room subscriptions
        if (!this.roomSubscriptions.has(uploadId)) {
          this.roomSubscriptions.set(uploadId, new Set());
        }
        this.roomSubscriptions.get(uploadId).add(socket.id);

        socket.emit('room-joined', { 
          uploadId, 
          message: `Joined upload room: ${uploadId}` 
        });

        console.log(`📡 Client ${socket.id} joined upload room: ${uploadId}`);
      });

      // Leave upload room
      socket.on('leave-upload-room', (uploadId) => {
        socket.leave(`upload-${uploadId}`);
        
        const client = this.connectedClients.get(socket.id);
        if (client) {
          client.rooms.delete(`upload-${uploadId}`);
        }

        if (this.roomSubscriptions.has(uploadId)) {
          this.roomSubscriptions.get(uploadId).delete(socket.id);
        }

        socket.emit('room-left', { 
          uploadId, 
          message: `Left upload room: ${uploadId}` 
        });
      });

      // Request current upload status
      socket.on('get-upload-status', (uploadId) => {
        const status = this.getUploadStatus(uploadId);
        socket.emit('upload-status-response', { uploadId, status });
      });

      // Client heartbeat
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`);
        this.handleClientDisconnect(socket.id);
      });

      // Error handling
      socket.on('error', (error) => {
        console.error(`❌ Socket error for ${socket.id}:`, error);
      });
    });
  }

  handleClientDisconnect(socketId) {
    const client = this.connectedClients.get(socketId);
    if (client) {
      // Remove from room subscriptions
      client.rooms.forEach(room => {
        const uploadId = room.replace('upload-', '');
        if (this.roomSubscriptions.has(uploadId)) {
          this.roomSubscriptions.get(uploadId).delete(socketId);
          
          // Clean up empty room subscriptions
          if (this.roomSubscriptions.get(uploadId).size === 0) {
            this.roomSubscriptions.delete(uploadId);
          }
        }
      });
      
      this.connectedClients.delete(socketId);
    }
  }

  // Broadcast upload progress
  broadcastUploadProgress(uploadId, progressData) {
    const room = `upload-${uploadId}`;
    
    // Store latest progress
    this.uploadSessions.set(uploadId, {
      ...this.uploadSessions.get(uploadId),
      progress: progressData,
      lastUpdate: Date.now()
    });

    this.io.to(room).emit('upload-progress', {
      uploadId,
      ...progressData,
      timestamp: Date.now()
    });

    console.log(`📊 Progress broadcast to room ${room}:`, progressData);
  }

  // Broadcast upload completion
  broadcastUploadComplete(uploadId, completionData) {
    const room = `upload-${uploadId}`;
    
    this.uploadSessions.set(uploadId, {
      ...this.uploadSessions.get(uploadId),
      status: 'completed',
      completedAt: Date.now(),
      ...completionData
    });

    this.io.to(room).emit('upload-complete', {
      uploadId,
      ...completionData,
      timestamp: Date.now()
    });

    console.log(`✅ Upload completion broadcast to room ${room}`);
  }

  // Broadcast processing updates
  broadcastProcessingUpdate(uploadId, updateData) {
    const room = `upload-${uploadId}`;
    
    const session = this.uploadSessions.get(uploadId) || {};
    session.processing = {
      ...session.processing,
      ...updateData,
      lastUpdate: Date.now()
    };
    this.uploadSessions.set(uploadId, session);

    this.io.to(room).emit('processing-update', {
      uploadId,
      ...updateData,
      timestamp: Date.now()
    });

    console.log(`🔄 Processing update broadcast to room ${room}:`, updateData);
  }

  // Broadcast processing completion
  broadcastProcessingComplete(uploadId, result) {
    const room = `upload-${uploadId}`;
    
    const session = this.uploadSessions.get(uploadId) || {};
    session.processing = {
      ...session.processing,
      status: 'completed',
      result,
      completedAt: Date.now()
    };
    this.uploadSessions.set(uploadId, session);

    this.io.to(room).emit('processing-complete', {
      uploadId,
      result,
      timestamp: Date.now()
    });

    console.log(`🎉 Processing completion broadcast to room ${room}`);
  }

  // Broadcast error messages
  broadcastError(uploadId, error) {
    const room = `upload-${uploadId}`;
    
    this.io.to(room).emit('upload-error', {
      uploadId,
      error: error.message || error,
      timestamp: Date.now()
    });

    console.error(`❌ Error broadcast to room ${room}:`, error);
  }

  // Get upload status
  getUploadStatus(uploadId) {
    return this.uploadSessions.get(uploadId) || null;
  }

  // Get connected clients count
  getConnectedClientsCount() {
    return this.connectedClients.size;
  }

  // Get room subscribers count
  getRoomSubscribersCount(uploadId) {
    return this.roomSubscriptions.get(uploadId)?.size || 0;
  }

  // Broadcast system status
  broadcastSystemStatus() {
    const status = {
      connectedClients: this.getConnectedClientsCount(),
      activeUploads: this.uploadSessions.size,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: Date.now()
    };

    this.io.emit('system-status', status);
  }

  // Start heartbeat to keep connections alive
  startHeartbeat() {
    setInterval(() => {
      this.io.emit('heartbeat', { 
        timestamp: Date.now(),
        connectedClients: this.getConnectedClientsCount()
      });
    }, 30000); // Every 30 seconds

    // Broadcast system status every 5 minutes
    setInterval(() => {
      this.broadcastSystemStatus();
    }, 300000);
  }

  // Cleanup old upload sessions
  cleanupOldSessions() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [uploadId, session] of this.uploadSessions.entries()) {
      if (session.lastUpdate && (now - session.lastUpdate) > maxAge) {
        this.uploadSessions.delete(uploadId);
        console.log(`🧹 Cleaned up old session: ${uploadId}`);
      }
    }
  }

  // Send notification to specific client
  sendToClient(socketId, event, data) {
    const client = this.connectedClients.get(socketId);
    if (client) {
      client.socket.emit(event, data);
    }
  }

  // Send notification to all clients
  broadcastToAll(event, data) {
    this.io.emit(event, data);
  }

  // Get statistics
  getStatistics() {
    return {
      connectedClients: this.getConnectedClientsCount(),
      activeUploads: this.uploadSessions.size,
      roomSubscriptions: Array.from(this.roomSubscriptions.entries()).map(([uploadId, clients]) => ({
        uploadId,
        subscriberCount: clients.size
      })),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }
}

module.exports = RealtimeService;