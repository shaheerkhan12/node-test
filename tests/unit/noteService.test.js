const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const noteService = require('../../services/noteService');
const Note = require('../../models/Note');

/**
 * AI-generated unit tests for note service
 * Tests core business logic with in-memory MongoDB
 */
describe('NoteService', () => {
  let mongoServer;

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear database before each test
    await Note.deleteMany({});
  });

  describe('createNote', () => {
    it('should create a note with valid data', async () => {
      const noteData = {
        title: 'Test Note',
        body: 'This is a test note body',
        tags: ['test', 'unit']
      };

      const result = await noteService.createNote(noteData);

      expect(result).toHaveProperty('_id');
      expect(result.title).toBe('Test Note');
      expect(result.body).toBe('This is a test note body');
      expect(result.tags).toEqual(['test', 'unit']);
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });

    it('should trim whitespace from title and body', async () => {
      const noteData = {
        title: '  Test Note  ',
        body: '  This is a test note body  ',
        tags: ['  test  ', '  unit  ']
      };

      const result = await noteService.createNote(noteData);

      expect(result.title).toBe('Test Note');
      expect(result.body).toBe('This is a test note body');
      expect(result.tags).toEqual(['test', 'unit']);
    });

    it('should throw error when title is missing', async () => {
      const noteData = {
        body: 'This is a test note body'
      };

      await expect(noteService.createNote(noteData)).rejects.toThrow('Title and body are required');
    });

    it('should throw error when body is missing', async () => {
      const noteData = {
        title: 'Test Note'
      };

      await expect(noteService.createNote(noteData)).rejects.toThrow('Title and body are required');
    });

    it('should handle empty tags array', async () => {
      const noteData = {
        title: 'Test Note',
        body: 'This is a test note body',
        tags: []
      };

      const result = await noteService.createNote(noteData);

      expect(result.tags).toEqual([]);
    });

    it('should filter out empty tags', async () => {
      const noteData = {
        title: 'Test Note',
        body: 'This is a test note body',
        tags: ['test', '', '  ', 'unit']
      };

      const result = await noteService.createNote(noteData);

      expect(result.tags).toEqual(['test', 'unit']);
    });

    it('should handle very long title and body', async () => {
      const noteData = {
        title: 'A'.repeat(200),
        body: 'B'.repeat(1000),
        tags: ['test']
      };

      const result = await noteService.createNote(noteData);
      expect(result.title.length).toBe(200);
      expect(result.body.length).toBe(1000);
    });
  });

  describe('getAllNotes', () => {
    beforeEach(async () => {
      // Create test notes
      await Note.create([
        { title: 'Note 1', body: 'Body 1', createdAt: new Date('2023-01-01') },
        { title: 'Note 2', body: 'Body 2', createdAt: new Date('2023-01-02') },
        { title: 'Note 3', body: 'Body 3', createdAt: new Date('2023-01-03') }
      ]);
    });

    it('should return all notes sorted by creation date (newest first)', async () => {
      const result = await noteService.getAllNotes();

      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('Note 3');
      expect(result[1].title).toBe('Note 2');
      expect(result[2].title).toBe('Note 1');
    });

    it('should respect limit parameter', async () => {
      const result = await noteService.getAllNotes({ limit: 2 });

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Note 3');
      expect(result[1].title).toBe('Note 2');
    });

    it('should respect skip parameter', async () => {
      const result = await noteService.getAllNotes({ skip: 1, limit: 2 });

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Note 2');
      expect(result[1].title).toBe('Note 1');
    });

    it('should sort by title when specified', async () => {
      const result = await noteService.getAllNotes({ 
        sortBy: 'title', 
        sortOrder: 1 
      });

      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('Note 1');
      expect(result[1].title).toBe('Note 2');
      expect(result[2].title).toBe('Note 3');
    });

    it('should handle empty collection', async () => {
      await Note.deleteMany({});
      const result = await noteService.getAllNotes();
      expect(result).toHaveLength(0);
    });
  });

  describe('getNoteById', () => {
    let testNote;

    beforeEach(async () => {
      testNote = await Note.create({
        title: 'Test Note',
        body: 'Test Body'
      });
    });

    it('should return note when valid ID is provided', async () => {
      const result = await noteService.getNoteById(testNote._id.toString());

      expect(result).toBeTruthy();
      expect(result.title).toBe('Test Note');
      expect(result.body).toBe('Test Body');
    });

    it('should return null when note is not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const result = await noteService.getNoteById(nonExistentId);

      expect(result).toBeNull();
    });

    it('should return null when invalid ID format is provided', async () => {
      const result = await noteService.getNoteById('invalid-id');

      expect(result).toBeNull();
    });

    it('should handle undefined ID', async () => {
      const result = await noteService.getNoteById(undefined);
      expect(result).toBeNull();
    });
  });

  describe('searchNotes', () => {
    beforeEach(async () => {
      await Note.create([
        { title: 'JavaScript Tutorial', body: 'Learn JavaScript programming' },
        { title: 'Python Guide', body: 'Python is a great programming language' },
        { title: 'Web Development', body: 'HTML, CSS, and JavaScript for web' }
      ]);
    });

    it('should find notes by title match', async () => {
      const result = await noteService.searchNotes('JavaScript');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(note => note.title.includes('JavaScript'))).toBe(true);
    });

    it('should find notes by body match', async () => {
      const result = await noteService.searchNotes('programming');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(note => note.body.includes('programming'))).toBe(true);
    });

    it('should return empty array for no matches', async () => {
      const result = await noteService.searchNotes('nonexistent');

      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty query', async () => {
      const result = await noteService.searchNotes('');

      expect(result).toHaveLength(0);
    });

    it('should handle case-insensitive search with regex', async () => {
      const result = await noteService.searchNotes('javascript', { useRegex: true });

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(note => 
        note.title.toLowerCase().includes('javascript') || 
        note.body.toLowerCase().includes('javascript')
      )).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const result = await noteService.searchNotes('programming', { limit: 1 });

      expect(result).toHaveLength(1);
    });

    it('should handle special characters in search query', async () => {
      await Note.create({
        title: 'Special #$%^',
        body: 'Content with @#$%^'
      });

      const result = await noteService.searchNotes('#$%^', { useRegex: true });
      expect(result.length).toBeGreaterThan(0);
    });
  });


  describe('deleteNote', () => {
    let testNote;

    beforeEach(async () => {
      testNote = await Note.create({
        title: 'To Delete',
        body: 'This note will be deleted'
      });
    });

    it('should delete existing note', async () => {
      const result = await noteService.deleteNote(testNote._id.toString());
      expect(result).toBe(true);

      const deleted = await Note.findById(testNote._id);
      expect(deleted).toBeNull();
    });

    it('should return false for non-existent note', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const result = await noteService.deleteNote(fakeId);
      expect(result).toBe(false);
    });

    it('should handle invalid ID format', async () => {
      const result = await noteService.deleteNote('invalid-id');
      expect(result).toBe(false);
    });
  });

  describe('getNotesStats', () => {
    beforeEach(async () => {
      await Note.deleteMany({});
      
      // Create some test notes with different dates
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      
      await Note.create([
        { title: 'Recent Note 1', body: 'Body 1', createdAt: now },
        { title: 'Recent Note 2', body: 'Body 2', createdAt: now },
        { title: 'Old Note', body: 'Body 3', createdAt: weekAgo }
      ]);
    });

    it('should return correct statistics', async () => {
      const stats = await noteService.getNotesStats();
      
      expect(stats).toHaveProperty('totalNotes', 3);
      expect(stats).toHaveProperty('recentNotes', 2);
    });

    it('should handle empty collection', async () => {
      await Note.deleteMany({});
      const stats = await noteService.getNotesStats();
      
      expect(stats.totalNotes).toBe(0);
      expect(stats.recentNotes).toBe(0);
    });
  });

  describe('updateNote', () => {
    let testNote;

    beforeEach(async () => {
      testNote = await Note.create({
        title: 'Original Title',
        body: 'Original Body',
        tags: ['original']
      });
    });

    it('should update note with valid data', async () => {
      const updateData = {
        title: 'Updated Title',
        body: 'Updated Body',
        tags: ['updated']
      };

      const result = await noteService.updateNote(testNote._id.toString(), updateData);

      expect(result).toBeTruthy();
      expect(result.title).toBe('Updated Title');
      expect(result.body).toBe('Updated Body');
      expect(result.tags).toEqual(['updated']);
      expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(new Date(result.createdAt).getTime());
    });

    it('should update only provided fields', async () => {
      const updateData = {
        title: 'Updated Title Only'
      };

      const result = await noteService.updateNote(testNote._id.toString(), updateData);

      expect(result.title).toBe('Updated Title Only');
      expect(result.body).toBe('Original Body');
      expect(result.tags).toEqual(['original']);
    });

    it('should return null when note is not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const result = await noteService.updateNote(nonExistentId, { title: 'Updated' });

      expect(result).toBeNull();
    });

    it('should return null when invalid ID format is provided', async () => {
      const result = await noteService.updateNote('invalid-id', { title: 'Updated' });

      expect(result).toBeNull();
    });

    it('should trim whitespace from updated fields', async () => {
      const updateData = {
        title: '  Updated Title  ',
        body: '  Updated Body  ',
        tags: ['  updated  ', '  tag  ']
      };

      const result = await noteService.updateNote(testNote._id.toString(), updateData);

      expect(result.title).toBe('Updated Title');
      
      it('should filter out empty tags during update', async () => {
        const updateData = {
          tags: ['valid', '', '  ', 'also-valid']
        };
        
        const result = await noteService.updateNote(testNote._id.toString(), updateData);
        expect(result.tags).toEqual(['valid', 'also-valid']);
      });
      
      it('should handle undefined tags during update', async () => {
        const updateData = {
          title: 'New Title',
          tags: undefined
        };
        
        const result = await noteService.updateNote(testNote._id.toString(), updateData);
        expect(result.tags).toEqual(['original']); // Should keep existing tags
      });
