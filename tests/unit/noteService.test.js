const sinon = require('sinon');
const mongoose = require('mongoose');
const Note = require('../../models/Note');
const { MongoMemoryServer } = require('mongodb-memory-server');
describe('Note Service Unit Tests', () => {
  let mongoServer;
  let connection;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    connection = await mongoose.connect(mongoUri);
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Note.deleteMany({});
  });

  describe('Create Note', () => {
    it('should create a note with valid data', async () => {
      const noteData = {
        title: 'Test Note',
        body: 'Test body content',
        tags: ['test', 'unit']
      };

      const note = new Note(noteData);
      const savedNote = await note.save();

      expect(savedNote.title).toBe(noteData.title);
      expect(savedNote.body).toBe(noteData.body);
      expect(savedNote.tags).toEqual(noteData.tags);
      expect(savedNote).toHaveProperty('createdAt');
      expect(savedNote).toHaveProperty('updatedAt');
    });

    it('should fail when required fields are missing', async () => {
      const note = new Note({});
      
      await expect(note.save()).rejects.toThrow(mongoose.Error.ValidationError);
      try {
        await note.save();
      } catch (error) {
        expect(error).toBeInstanceOf(mongoose.Error.ValidationError);
        expect(error.errors.title).toBeDefined();
        expect(error.errors.body).toBeDefined();
      }
    });

    it('should trim whitespace from fields', async () => {
      const note = new Note({
        title: '  Test Title  ',
        body: '  Test Body  ',
        tags: ['  tag1  ', '  tag2  ']
      });

      const savedNote = await note.save();
      expect(savedNote.title).toBe('Test Title');
      expect(savedNote.body).toBe('Test Body');
      expect(savedNote.tags).toEqual(['tag1', 'tag2']);
    });
  });

  describe('Retrieve Notes', () => {
    beforeEach(async () => {
      await Note.create([
        { title: 'Note 1', body: 'Body 1', tags: ['tag1'] },
        { title: 'Note 2', body: 'Body 2', tags: ['tag2'] },
        { title: 'Note 3', body: 'Body 3', tags: ['tag3'] }
      ]);
    });

    it('should retrieve all notes', async () => {
      const notes = await Note.find({}).lean();
      expect(notes).toHaveLength(3);
    });

    it('should find note by id', async () => {
      const note = await Note.findOne({ title: 'Note 1' });
      const foundNote = await Note.findById(note._id);
      expect(foundNote.title).toBe('Note 1');
    });

    it('should support pagination', async () => {
      const notes = await Note.find({})
        .skip(1)
        .limit(1)
        .lean();

      expect(notes).toHaveLength(1);
      expect(notes[0].title).toBe('Note 2');
    });
  });

  describe('Update Note', () => {
    let testNote;

    beforeEach(async () => {
      testNote = await Note.create({
        title: 'Original Title',
        body: 'Original Body',
        tags: ['original']
      });
    });

    it('should update note fields', async () => {
      const updatedNote = await Note.findByIdAndUpdate(
        testNote._id,
        {
          title: 'Updated Title',
          body: 'Updated Body',
          tags: ['updated']
        },
        { new: true }
      );

      expect(updatedNote.title).toBe('Updated Title');
      expect(updatedNote.body).toBe('Updated Body');
      expect(updatedNote.tags).toEqual(['updated']);
    });

    it('should update only provided fields', async () => {
      const updatedNote = await Note.findByIdAndUpdate(
        testNote._id,
        { title: 'Only Title Updated' },
        { new: true }
      );

      expect(updatedNote.title).toBe('Only Title Updated');
      expect(updatedNote.body).toBe('Original Body');
    });
  });

  describe('Delete Note', () => {
    let testNote;

    beforeEach(async () => {
      testNote = await Note.create({
        title: 'To Delete',
        body: 'This will be deleted',
        tags: ['delete']
      });
    });

    it('should delete a note', async () => {
      await Note.findByIdAndDelete(testNote._id);
      const deletedNote = await Note.findById(testNote._id);
      expect(deletedNote).toBeNull();
    });

    it('should handle deleting non-existent note', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const result = await Note.findByIdAndDelete(fakeId);
      expect(result).toBeNull();
    });
  });

  describe('Search Notes', () => {
    beforeEach(async () => {
      await Note.create([
        { title: 'JavaScript Guide', body: 'Learn JavaScript programming' },
        { title: 'Python Tutorial', body: 'Python for beginners' },
        { title: 'Node.js Basics', body: 'JavaScript runtime environment' }
      ]);
    });

    it('should search notes by text index', async () => {
      const notes = await Note.find({
        $text: { $search: 'JavaScript' }
      });
      expect(notes).toHaveLength(2);
    });

    it('should search notes by regex', async () => {
      const notes = await Note.find({
        $or: [
          { title: /javascript/i },
          { body: /javascript/i }
        ]
      });
      expect(notes).toHaveLength(2);
    });
  });
});
