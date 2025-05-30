# Large File Upload Node.js Server

A robust Node.js server application designed for handling large file uploads with real-time progress tracking and file processing capabilities.

## Features

- Large file upload support with progress tracking
- Real-time updates using Socket.IO
- File processing capabilities (using FFmpeg and Sharp)
- Background job processing with Bull queue
- Redis integration for caching and job management
- Secure file handling with proper middleware
- Compression and performance optimizations
- Docker support for containerization

## Tech Stack

- Node.js
- Express.js
- Socket.IO for real-time communication
- Bull for job queue management
- Redis for caching and job storage
- FFmpeg for video processing
- Sharp for image processing
- Multer for file upload handling
- Docker for containerization

## Prerequisites

- Node.js (v14 or higher)
- Redis server
- FFmpeg (for video processing)
- Docker (optional)

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd large-file-upload-nodejs
```

2. Install dependencies:

```bash
cd be
yarn install
```

3. Configure environment variables (if needed)

## Running the Application

### Development Mode

```bash
yarn dev
```

### Production Mode

```bash
yarn start
```

### Using Docker

```bash
docker build -t large-file-upload-server .
docker run -p 3000:3000 large-file-upload-server
```

## API Endpoints

- `/api/upload` - File upload endpoints
- `/api/files` - File management endpoints
- WebSocket connection for real-time updates

## Project Structure

```
be/
├── src/
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── config/         # Configuration files
│   └── utils/          # Utility functions
├── public/             # Static files
├── uploads/            # Uploaded files storage
├── server.js           # Main application file
├── package.json        # Project dependencies
└── Dockerfile          # Docker configuration
```

## Security Features

- Helmet for security headers
- CORS configuration
- File size limits
- Secure file handling
- Input validation

## Performance Optimizations

- Compression middleware
- Static file serving
- Redis caching
- Background job processing

## License

ISC

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
