const Note = require('../models/Note');
const { generateEmbedding } = require('../utils/vectorUtils');

/**
 * AI-generated service layer for note operations
 * Handles business logic and data persistence
 */
class NoteService {
  
  /**
   * Create a new note with optional vector embedding
   * @param {Object} noteData - Note data containing title and body
   * @param {boolean} generateVector - Whether to generate vector embedding
   * @returns {Promise<Object>} Created note
   */
  async createNote(noteData, generateVector = false) {
    try {
      const { title, body, tags = [] } = noteData;
      
      // Validate required fields
      if (!title || !body) {
        throw new Error('Title and body are required');
      }
      
      // Create base note object
      const noteObj = {
        title: title.trim(),
        body: body.trim(),
        tags: tags.map(tag => tag.trim()).filter(Boolean)
      };
      
      // Generate vector embedding if requested
      if (generateVector) {
        try {
          const content = `${title} ${body}`;
          noteObj.embedding = await generateEmbedding(content);
        } catch (embeddingError) {
          // Log warning but don't fail the operation
          console.warn('Failed to generate embedding:', embeddingError.message);
        }
      }
      
      const note = new Note(noteObj);
      const savedNote = await note.save();
      
      return savedNote.toObject();
    } catch (error) {
      throw new Error(`Failed to create note: ${error.message}`);
    }
  }
  
  /**
   * Retrieve all notes with pagination
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of notes
   */
  async getAllNotes(options = {}) {
    try {
      const { limit = 50, skip = 0, sortBy = 'createdAt', sortOrder = -1 } = options;
      
      const notes = await Note.find({})
        .sort({ [sortBy]: sortOrder })
        .limit(limit)
        .skip(skip)
        .lean();
      
      return notes;
    } catch (error) {
      throw new Error(`Failed to retrieve notes: ${error.message}`);
    }
  }
  
  /**
   * Get a note by its MongoDB _id
   * @param {string} id - MongoDB ObjectId
   * @returns {Promise<Object|null>} Note or null if not found
   */
  async getNoteById(id) {
    try {
      const note = await Note.findById(id).lean();
      return note;
    } catch (error) {
      if (error.name === 'CastError') {
        return null; // Invalid ObjectId format
      }
      throw new Error(`Failed to retrieve note: ${error.message}`);
    }
  }
  
  /**
   * Search notes by title and body using MongoDB text search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of matching notes
   */
  async searchNotes(query, options = {}) {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }
      
      const { limit = 20, skip = 0, useRegex = false } = options;
      
      let results;
      
      if (useRegex) {
        // Use regex search as fallback
        results = await Note.searchByRegex(query.trim(), { limit, skip });
      } else {
        // Use MongoDB text search (preferred)
        try {
          results = await Note.searchByText(query.trim(), { limit, skip });
        } catch (textSearchError) {
          // Fall back to regex search if text search fails
          console.warn('Text search failed, falling back to regex:', textSearchError.message);
          results = await Note.searchByRegex(query.trim(), { limit, skip });
        }
      }
      
      return results.map(note => note.toSearchResult ? note.toSearchResult() : note);
    } catch (error) {
      throw new Error(`Failed to search notes: ${error.message}`);
    }
  }
  
  /**
   * Update a note by ID
   * @param {string} id - MongoDB ObjectId
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object|null>} Updated note or null if not found
   */
  async updateNote(id, updateData) {
    try {
      const { title, body, tags } = updateData;
      
      const updateObj = {
        updatedAt: Date.now()
      };
      
      if (title) updateObj.title = title.trim();
      if (body) updateObj.body = body.trim();
      if (tags) updateObj.tags = tags.map(tag => tag.trim()).filter(Boolean);
      
      const note = await Note.findByIdAndUpdate(
        id,
        updateObj,
        { new: true, runValidators: true }
      ).lean();
      
      return note;
    } catch (error) {
      if (error.name === 'CastError') {
        return null;
      }
      throw new Error(`Failed to update note: ${error.message}`);
    }
  }
  
  /**
   * Delete a note by ID
   * @param {string} id - MongoDB ObjectId
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteNote(id) {
    try {
      const result = await Note.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      if (error.name === 'CastError') {
        return false;
      }
      throw new Error(`Failed to delete note: ${error.message}`);
    }
  }
  
  /**
   * Get notes statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getNotesStats() {
    try {
      const totalNotes = await Note.countDocuments();
      const recentNotes = await Note.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });
      
      return {
        totalNotes,
        recentNotes,
        lastWeek: recentNotes
      };
    } catch (error) {
      throw new Error(`Failed to get notes statistics: ${error.message}`);
    }
  }
}

module.exports = new NoteService();