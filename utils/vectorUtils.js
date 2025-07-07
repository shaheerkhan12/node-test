const { OpenAI } = require('openai');

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

/**
 * Generate vector embedding for text content
 * @param {string} text - Text to embed
 * @returns {Promise<Array>} Vector embedding
 */
async function generateEmbedding(text) {
  if (!text || text.trim().length === 0) {
    throw new Error('Text content is required for embedding generation');
  }

  // If OpenAI is not configured, return a fake embedding for testing
  if (!openai) {
    console.warn('OpenAI not configured, generating fake embedding');
    return generateFakeEmbedding(text);
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.trim(),
      encoding_format: 'float'
    });

    if (!response.data || !response.data[0] || !response.data[0].embedding) {
      throw new Error('Invalid embedding response from OpenAI');
    }

    return response.data[0].embedding;
  } catch (error) {
    console.error('OpenAI embedding generation failed:', error.message);
    
    // Fallback to fake embedding
    console.warn('Falling back to fake embedding generation');
    return generateFakeEmbedding(text);
  }
}

/**
 * Generate a fake embedding for testing purposes
 * Creates a deterministic but realistic-looking embedding
 * @param {string} text - Text to generate fake embedding for
 * @returns {Array} Fake embedding vector
 */
function generateFakeEmbedding(text) {
  const dimension = 1536; // OpenAI embedding dimension
  const embedding = new Array(dimension);
  
  // Use text content to generate deterministic values
  let seed = 0;
  for (let i = 0; i < text.length; i++) {
    seed += text.charCodeAt(i);
  }
  
  // Simple pseudo-random generator for consistent results
  let random = seed;
  function pseudoRandom() {
    random = (random * 1103515245 + 12345) & 0x7fffffff;
    return random / 0x7fffffff;
  }
  
  // Generate normalized embedding values
  for (let i = 0; i < dimension; i++) {
    embedding[i] = (pseudoRandom() - 0.5) * 2; // Values between -1 and 1
  }
  
  // Normalize the vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  for (let i = 0; i < dimension; i++) {
    embedding[i] /= magnitude;
  }
  
  return embedding;
}

/**
 * Calculate cosine similarity between two vectors
 * @param {Array} vectorA - First vector
 * @param {Array} vectorB - Second vector
 * @returns {number} Cosine similarity score
 */
function cosineSimilarity(vectorA, vectorB) {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }
  
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return similarity;
}

/**
 * Find most similar embeddings in an array
 * @param {Array} queryEmbedding - Query vector
 * @param {Array} embeddings - Array of {id, embedding} objects
 * @param {number} limit - Maximum number of results
 * @returns {Array} Sorted array of similar embeddings with scores
 */
function findSimilarEmbeddings(queryEmbedding, embeddings, limit = 10) {
  const similarities = embeddings.map(item => ({
    ...item,
    similarity: cosineSimilarity(queryEmbedding, item.embedding)
  }));
  
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Validate embedding vector
 * @param {Array} embedding - Vector to validate
 * @returns {boolean} True if valid
 */
function validateEmbedding(embedding) {
  if (!Array.isArray(embedding)) {
    return false;
  }
  
  if (embedding.length === 0) {
    return false;
  }
  
  return embedding.every(val => typeof val === 'number' && !isNaN(val));
}

module.exports = {
  generateEmbedding,
  generateFakeEmbedding,
  cosineSimilarity,
  findSimilarEmbeddings,
  validateEmbedding
};