# Advanced Note-Taking API

A powerful note-taking API built with Node.js, Fastify, MongoDB, and vector search capabilities. This application provides a robust backend for managing notes with advanced search features including text-based search and semantic vector search.

## Features

- **CRUD Operations**: Create, read, update, and delete notes
- **Advanced Search Capabilities**:
  - Full-text search using MongoDB text indices
  - Regex-based search for flexible matching
  - Vector/semantic search using embeddings (powered by Qdrant)
- **Rich Note Content**:
  - Title and body content
  - Tags support
  - Automatic timestamps
  - Vector embeddings for semantic search
- **Performance Optimized**:
  - Connection pooling
  - Configurable pagination
  - Efficient search algorithms

## Technical Stack

- **Backend Framework**: Fastify
- **Database**: MongoDB
- **Vector Store**: Qdrant
- **Vector Embeddings**: OpenAI API (with fallback to mock embeddings)
- **Development Tools**:
  - Pino logging
  - Environment-based configuration
  - Comprehensive testing suite

## Getting Started

1. Clone the repository
2. Copy `.env.example` to `.env` and configure your environment variables
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start MongoDB and Qdrant services
5. Start the server:
   ```bash
   npm start
   ```

## API Endpoints

### Notes Management
- `POST /notes`
  - Create a new note
  - Body: `{ title: string, body: string, tags?: string[] }`
  - Returns: Created note object (201)

- `GET /notes`
  - List all notes with pagination
  - Query params:
    - `limit`: 1-100 (default: 50)
    - `skip`: 0+ (default: 0)
    - `sortBy`: 'createdAt'|'updatedAt'|'title' (default: 'createdAt')
    - `sortOrder`: 'asc'|'desc' (default: 'desc')
  - Returns: Array of notes

- `GET /notes/:id`
  - Get a specific note by ID
  - Returns: Note object or 404

- `PUT /notes/:id`
  - Update a note
  - Body: `{ title?: string, body?: string, tags?: string[] }`
  - Returns: Updated note object or 404

- `DELETE /notes/:id`
  - Delete a note
  - Returns: 204 on success, 404 if not found

### Search Endpoints
- `GET /notes/search`
  - Text-based search
  - Query params:
    - `q`: Search query (required)
    - `limit`: 1-50 (default: 20)
    - `skip`: 0+ (default: 0)
    - `useRegex`: boolean (default: false)
  - Returns: Array of matching notes

- `GET /notes/vector-search`
  - Semantic vector search
  - Query params:
    - `q`: Search query (required)
    - `limit`: 1-20 (default: 10)
    - `threshold`: 0-1 (default: 0.7)
  - Returns: Array of semantically similar notes

- `GET /notes/stats`
  - Get system statistics
  - Returns: Object with note counts and vector stats

## Note Schema

```javascript
{
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  body: {
    type: String,
    required: true,
    maxlength: 10000
  },
  tags: [String],
  embedding: [Number],  // Vector embedding for semantic search
  createdAt: Date,
  updatedAt: Date
}
```

### Environment Variables

Create a `.env` file based on `.env.example` with the following configurations:

#### Required Configuration
- `MONGODB_URI` - MongoDB connection string (default: mongodb://localhost:27017/mod-notes)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment ('development' or 'production')
- `API_HOST` - API host (default: localhost)
- `API_PORT` - API port (default: 3000)

#### Optional Vector Search Configuration
- `OPENAI_API_KEY` - OpenAI API key for generating embeddings
- `QDRANT_URL` - Qdrant vector database URL (default: http://localhost:6333)
- `QDRANT_API_KEY` - Qdrant API key for authentication

## Development

Run tests:
```bash
npm test
```

Run in development mode:
```bash
npm run dev
```

## Vector Search

The application includes a sophisticated vector search implementation:
- Generates embeddings for note content
- Stores vectors in Qdrant
- Supports semantic similarity search
- Falls back to mock embeddings when OpenAI is not configured

## License

MIT License
