const fp = require('fastify-plugin');
const mongoose = require('mongoose');
const vectorService = require('./services/vectorService');

/**
 * AI-generated Fastify plugin for mod-notes
 * Provides comprehensive note management with MongoDB and vector search capabilities
 */
async function modNotesPlugin(fastify, options) {
  // Initialize MongoDB connection
  await initializeDatabase(fastify, options);
  
  // Initialize vector service
//   await vectorService.initialize();
  
  // Register Swagger for API documentation
  await fastify.register(require('@fastify/swagger'), {
    swagger: {
      info: {
        title: 'mod-notes API',
        description: 'AI-First note management system with vector search capabilities',
        version: '1.0.0'
      },
      host: process.env.API_HOST || 'localhost',
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'Notes', description: 'Note management operations' },
        { name: 'Vector Search', description: 'Semantic search operations' }
      ]
    },
    exposeRoute: true
  });

  // Register Swagger UI
  await fastify.register(require('@fastify/swagger-ui'), {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false
    },
    uiHooks: {
      onRequest: function (request, reply, next) { next(); },
      preHandler: function (request, reply, next) { next(); }
    },
    staticCSP: false,
    transformSpecification: (swaggerObject, request, reply) => {
      return swaggerObject;
    },
    transformSpecificationClone: true
  });

  // Register note routes
  await fastify.register(require('./routes/noteRoutes'), { prefix: '/api/v1' });

  // Health check endpoint
  fastify.get('/health', {
    schema: {
      tags: ['Health'],
      description: 'Health check endpoint',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            database: { type: 'string' },
            vectorService: { type: 'boolean' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const vectorStatus = await vectorService.healthCheck();
    
    reply.send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      vectorService: vectorStatus
    });
  });

  // Root endpoint with API information
  fastify.get('/', {
    schema: {
      tags: ['Info'],
      description: 'API information and available endpoints',
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            description: { type: 'string' },
            endpoints: { type: 'object' },
            documentation: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    reply.send({
      name: 'mod-notes API',
      version: '1.0.0',
      description: 'AI-First note management system with MongoDB and vector search',
      endpoints: {
        notes: '/api/v1/notes',
        search: '/api/v1/notes/search',
        vectorSearch: '/api/v1/notes/vector-search',
        health: '/health',
        stats: '/api/v1/notes/stats'
      },
      documentation: '/docs'
    });
  });

  // Graceful shutdown handling
  fastify.addHook('onClose', async (instance) => {
    await mongoose.connection.close();
    fastify.log.info('MongoDB connection closed');
  });

  fastify.log.info('mod-notes plugin registered successfully');
}

/**
 * Initialize database connection with proper error handling
 */
async function initializeDatabase(fastify, options) {
  try {
    const mongoUri = options.mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/mod-notes';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    fastify.log.info(`Connected to MongoDB: ${mongoUri}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      fastify.log.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      fastify.log.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      fastify.log.info('MongoDB reconnected');
    });

  } catch (error) {
    fastify.log.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

// Export as Fastify plugin
module.exports = fp(modNotesPlugin, {
  name: 'mod-notes',
  fastify: '4.x'
});
