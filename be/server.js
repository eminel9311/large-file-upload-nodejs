// server.js
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

// const uploadRoutes = require('./src/routes/uploadRoutes');
const fileRoutes = require('./src/routes/fileRoutes');
const RealtimeService = require('./src/services/realtimeService');
const config = require('./src/config/config');

class FileUploadServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      maxHttpBufferSize: 1e8 // 100MB
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeServices();
  }

  setupMiddleware() {
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    this.app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  setupRoutes() {
    // this.app.use('/api/upload', uploadRoutes);
    // this.app.use('/api/files', fileRoutes);
    
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
  }

  initializeServices() {
    this.realtimeService = new RealtimeService(this.io);
  }

  start() {
    const PORT = process.env.PORT || config.server.port;
    this.server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📁 Upload directory: ${config.upload.directory}`);
    });
  }
}

const server = new FileUploadServer();
server.start();