require('dotenv').config();
const fastify = require('fastify');

/**
 * AI-generated server setup for mod-notes application
 * Includes comprehensive logging, error handling, and graceful shutdown
 */
async function startServer() {
  // Create Fastify instance with enhanced logging
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      } : undefined
    }
  });

  try {
    // Register the mod-notes plugin
    await app.register(require('./index.js'), {
      mongoUri: process.env.MONGODB_URI
    });

    // Global error handler
    app.setErrorHandler(async (error, request, reply) => {
      app.log.error(error);
      
      // Handle specific error types
      if (error.validation) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: error.message,
          statusCode: 400,
          details: error.validation
        });
      }
      
      if (error.statusCode) {
        return reply.status(error.statusCode).send({
          error: error.name || 'Error',
          message: error.message,
          statusCode: error.statusCode
        });
      }
      
      // Default server error
      reply.status(500).send({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        statusCode: 500
      });
    });

    // Not found handler
    app.setNotFoundHandler(async (request, reply) => {
      reply.status(404).send({
        error: 'Not Found',
        message: `Route ${request.method} ${request.url} not found`,
        statusCode: 404
      });
    });

    // CORS handling for development
    if (process.env.NODE_ENV === 'development') {
        await app.register(require('@fastify/cors'), {
            origin: true,
            methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
            credentials: true,
            maxAge: 86400
          });
    }

    // Start the server
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    await app.listen({ port, host });
    
    app.log.info(`🚀 mod-notes server is running on http://${host}:${port}`);
    app.log.info(`📚 API documentation available at http://${host}:${port}/docs`);
    app.log.info(`🔍 Health check at http://${host}:${port}/health`);
    
    // Log available endpoints
    const routes = app.printRoutes();
    app.log.info('Available routes:', routes);
    
  } catch (error) {
    app.log.error('Failed to start server:', error);
    process.exit(1);
  }

  // Graceful shutdown handling
  const signals = ['SIGTERM', 'SIGINT'];
  
  signals.forEach((signal) => {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await app.close();
        app.log.info('Server closed successfully');
        process.exit(0);
      } catch (error) {
        app.log.error('Error during shutdown:', error);
        process.exit(1);
      }
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    app.log.fatal('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    app.log.fatal('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  return app;
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = startServer;