const { QdrantClient } = require('@qdrant/qdrant-js');
const { generateEmbedding } = require('../utils/vectorUtils');

/**
 * AI-generated vector search service using Qdrant
 * Handles semantic search capabilities for notes
 */
class VectorService {
  constructor() {
    this.client = null;
    this.collectionName = 'notes';
    this.vectorSize = 1536; // OpenAI embedding size
    this.isInitialized = false;
  }

  /**
   * Initialize Qdrant client and collection
   */
  async initialize() {
    try {
      if (process.env.QDRANT_URL) {
        this.client = new QdrantClient({
          url: process.env.QDRANT_URL,
          apiKey: process.env.QDRANT_API_KEY
        });

        // Create collection if it doesn't exist
        await this.ensureCollection();
        this.isInitialized = true;
        console.log('Vector service initialized successfully');
      } else {
        console.log('Qdrant URL not configured, vector search disabled');
      }
    } catch (error) {
      console.error('Failed to initialize vector service:', error.message);
      this.isInitialized = false;
    }
  }

  /**
   * Ensure the notes collection exists in Qdrant
   */
  async ensureCollection() {
    try {
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        col => col.name === this.collectionName
      );

      if (!collectionExists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine'
          }
        });
        console.log(`Created collection: ${this.collectionName}`);
      }
    } catch (error) {
      console.error('Failed to ensure collection:', error.message);
      throw error;
    }
  }

  /**
   * Index a note with vector embedding
   * @param {string} noteId - MongoDB note ID
   * @param {string} title - Note title
   * @param {string} body - Note body
   */
  async indexNote(noteId, title, body) {
    if (!this.isInitialized) {
      console.warn('Vector service not initialized, skipping indexing');
      return;
    }

    try {
      const content = `${title} ${body}`;
      const embedding = await generateEmbedding(content);

      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: noteId,
            vector: embedding,
            payload: {
              title,
              body: body.substring(0, 500), // Store truncated body
              createdAt: new Date().toISOString()
            }
          }
        ]
      });

      console.log(`Indexed note: ${noteId}`);
    } catch (error) {
      console.error('Failed to index note:', error.message);
      throw error;
    }
  }

  /**
   * Search for similar notes using vector similarity
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of similar notes with scores
   */
  async vectorSearch(query, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Vector service not initialized');
    }

    try {
      const { limit = 10, threshold = 0.7 } = options;
      
      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding(query);

      // Search for similar vectors
      const searchResult = await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        limit,
        score_threshold: threshold,
        with_payload: true
      });

      // Format results
      return searchResult.map(result => ({
        id: result.id,
        score: result.score,
        title: result.payload.title,
        body: result.payload.body,
        createdAt: result.payload.createdAt
      }));
    } catch (error) {
      console.error('Vector search failed:', error.message);
      throw error;
    }
  }

  /**
   * Remove a note from vector index
   * @param {string} noteId - MongoDB note ID
   */
  async removeNote(noteId) {
    if (!this.isInitialized) {
      return;
    }

    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: [noteId]
      });

      console.log(`Removed note from index: ${noteId}`);
    } catch (error) {
      console.error('Failed to remove note from index:', error.message);
    }
  }

  /**
   * Get collection statistics
   * @returns {Promise<Object>} Collection stats
   */
  async getStats() {
    if (!this.isInitialized) {
      return { error: 'Vector service not initialized' };
    }

    try {
      const info = await this.client.getCollection(this.collectionName);
      return {
        vectorCount: info.vectors_count,
        indexedCount: info.indexed_vectors_count,
        status: info.status
      };
    } catch (error) {
      console.error('Failed to get vector stats:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Health check for vector service
   * @returns {Promise<boolean>} Service health status
   */
  async healthCheck() {
    if (!this.isInitialized) {
      return false;
    }

    try {
      await this.client.getCollections();
      return true;
    } catch (error) {
      console.error('Vector service health check failed:', error.message);
      return false;
    }
  }
}

module.exports = new VectorService();