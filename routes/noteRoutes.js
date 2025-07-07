const noteService = require('../services/noteService');
const vectorService = require('../services/vectorService');

/**
 * AI-generated Fastify routes for note management
 * Includes comprehensive error handling and Swagger documentation
 */
async function noteRoutes(fastify, options) {
  
  // Swagger schemas for consistent API documentation
  const noteSchemas = {
    note: {
      type: 'object',
      properties: {
        _id: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
        tags: { 
          type: 'array',
          items: { type: 'string' }
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    },
    createNote: {
      type: 'object',
      required: ['title', 'body'],
      properties: {
        title: { 
          type: 'string',
          minLength: 1,
          maxLength: 200,
          description: 'Note title'
        },
        body: { 
          type: 'string',
          minLength: 1,
          maxLength: 10000,
          description: 'Note content'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for the note'
        }
      }
    },
    searchResult: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
        score: { type: 'number' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    },
    error: {
      type: 'object',
      properties: {
        error: { type: 'string' },
        message: { type: 'string' },
        statusCode: { type: 'number' }
      }
    }
  };

  // POST /notes - Create a new note
  fastify.post('/notes', {
    schema: {
      tags: ['Notes'],
      description: 'Create a new note',
      body: noteSchemas.createNote,
      response: {
        201: noteSchemas.note,
        400: noteSchemas.error,
        500: noteSchemas.error
      }
    }
  }, async (request, reply) => {
    try {
      const { title, body, tags } = request.body;
      
      // Validate input
      if (!title || !body) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Title and body are required',
          statusCode: 400
        });
      }
      
      // Create note with optional vector generation
      const generateVector = process.env.OPENAI_API_KEY ? true : false;
      const note = await noteService.createNote({ title, body, tags }, generateVector);
      
      // Index in vector database if available
      if (generateVector) {
        try {
          await vectorService.indexNote(note._id.toString(), title, body);
        } catch (vectorError) {
          // Log warning but don't fail the request
          fastify.log.warn('Failed to index note in vector database:', vectorError.message);
        }
      }
      
      reply.status(201).send(note);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message,
        statusCode: 500
      });
    }
  });

  // GET /notes - Retrieve all notes
  fastify.get('/notes', {
    schema: {
      tags: ['Notes'],
      description: 'Retrieve all notes',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          skip: { type: 'integer', minimum: 0, default: 0 },
          sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'title'], default: 'createdAt' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      },
      response: {
        200: {
          type: 'array',
          items: noteSchemas.note
        },
        500: noteSchemas.error
      }
    }
  }, async (request, reply) => {
    try {
      const { limit = 50, skip = 0, sortBy = 'createdAt', sortOrder = 'desc' } = request.query;
      
      const options = {
        limit: parseInt(limit),
        skip: parseInt(skip),
        sortBy,
        sortOrder: sortOrder === 'asc' ? 1 : -1
      };
      
      const notes = await noteService.getAllNotes(options);
      reply.send(notes);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message,
        statusCode: 500
      });
    }
  });

  // GET /notes/:id - Get a specific note by ID
  fastify.get('/notes/:id', {
    schema: {
      tags: ['Notes'],
      description: 'Get a note by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'MongoDB ObjectId' }
        }
      },
      response: {
        200: noteSchemas.note,
        404: noteSchemas.error,
        500: noteSchemas.error
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      
      const note = await noteService.getNoteById(id);
      
      if (!note) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Note not found',
          statusCode: 404
        });
      }
      
      reply.send(note);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message,
        statusCode: 500
      });
    }
  });

  // GET /notes/search - Search notes by title/body
  fastify.get('/notes/search', {
    schema: {
      tags: ['Notes'],
      description: 'Search notes by title and body content',
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 1, description: 'Search query' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          skip: { type: 'integer', minimum: 0, default: 0 },
          useRegex: { type: 'boolean', default: false, description: 'Use regex search instead of text search' }
        }
      },
      response: {
        200: {
          type: 'array',
          items: noteSchemas.searchResult
        },
        400: noteSchemas.error,
        500: noteSchemas.error
      }
    }
  }, async (request, reply) => {
    try {
      const { q, limit = 20, skip = 0, useRegex = false } = request.query;
      
      if (!q || q.trim().length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Search query is required',
          statusCode: 400
        });
      }
      
      const options = {
        limit: parseInt(limit),
        skip: parseInt(skip),
        useRegex: useRegex === 'true' || useRegex === true
      };
      
      const results = await noteService.searchNotes(q, options);
      reply.send(results);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message,
        statusCode: 500
      });
    }
  });

  // GET /notes/vector-search - Semantic search using vector embeddings (Bonus feature)
  fastify.get('/notes/vector-search', {
    schema: {
      tags: ['Notes', 'Vector Search'],
      description: 'Semantic search using vector embeddings',
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 1, description: 'Search query' },
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
          threshold: { type: 'number', minimum: 0, maximum: 1, default: 0.7, description: 'Similarity threshold' }
        }
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              body: { type: 'string' },
              score: { type: 'number' },
              createdAt: { type: 'string' }
            }
          }
        },
        400: noteSchemas.error,
        503: noteSchemas.error,
        500: noteSchemas.error
      }
    }
  }, async (request, reply) => {
    try {
      const { q, limit = 10, threshold = 0.7 } = request.query;
      
      if (!q || q.trim().length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Search query is required',
          statusCode: 400
        });
      }
      
      // Check if vector service is available
      const isHealthy = await vectorService.healthCheck();
      if (!isHealthy) {
        return reply.status(503).send({
          error: 'Service Unavailable',
          message: 'Vector search service is not available',
          statusCode: 503
        });
      }
      
      const options = {
        limit: parseInt(limit),
        threshold: parseFloat(threshold)
      };
      
      const results = await vectorService.vectorSearch(q, options);
      reply.send(results);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message,
        statusCode: 500
      });
    }
  });

  // PUT /notes/:id - Update a note
  fastify.put('/notes/:id', {
    schema: {
      tags: ['Notes'],
      description: 'Update a note by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'MongoDB ObjectId' }
        }
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 200 },
          body: { type: 'string', maxLength: 10000 },
          tags: { type: 'array', items: { type: 'string' } }
        }
      },
      response: {
        200: noteSchemas.note,
        404: noteSchemas.error,
        500: noteSchemas.error
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const updateData = request.body;
      
      const note = await noteService.updateNote(id, updateData);
      
      if (!note) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Note not found',
          statusCode: 404
        });
      }
      
      reply.send(note);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message,
        statusCode: 500
      });
    }
  });

  // DELETE /notes/:id - Delete a note
  fastify.delete('/notes/:id', {
    schema: {
      tags: ['Notes'],
      description: 'Delete a note by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'MongoDB ObjectId' }
        }
      },
      response: {
        204: { type: 'null' },
        404: noteSchemas.error,
        500: noteSchemas.error
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      
      const deleted = await noteService.deleteNote(id);
      
      if (!deleted) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Note not found',
          statusCode: 404
        });
      }
      
      // Remove from vector index
      try {
        await vectorService.removeNote(id);
      } catch (vectorError) {
        fastify.log.warn('Failed to remove note from vector index:', vectorError.message);
      }
      
      reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message,
        statusCode: 500
      });
    }
  });

  // GET /notes/stats - Get notes statistics
  fastify.get('/notes/stats', {
    schema: {
      tags: ['Notes'],
      description: 'Get notes statistics',
      response: {
        200: {
          type: 'object',
          properties: {
            totalNotes: { type: 'number' },
            recentNotes: { type: 'number' },
            lastWeek: { type: 'number' },
            vectorStats: { type: 'object' }
          }
        },
        500: noteSchemas.error
      }
    }
  }, async (request, reply) => {
    try {
      const stats = await noteService.getNotesStats();
      const vectorStats = await vectorService.getStats();
      
      reply.send({
        ...stats,
        vectorStats
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message,
        statusCode: 500
      });
    }
  });
}

module.exports = noteRoutes;