const mongoose = require('mongoose');
const Note = require('../../models/Note');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('Note Service Integration Tests', () => {
  let mongoServer;
  let connection;

  before(async () => {
    try {
      mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();
      connection = await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    } catch (error) {
      console.error('Failed to start test database:', error);
      throw error;
    }
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Note.deleteMany({});
  });

  describe('Note Lifecycle', () => {
    it('should support full CRUD lifecycle', async () => {
      // Create
      const noteData = {
        title: 'Integration Test Note',
        body: 'Testing the full lifecycle',
        tags: ['test', 'integration']
      };
      const note = new Note(noteData);
      const savedNote = await note.save();
      
      expect(savedNote.title).to.equal(noteData.title);
      expect(savedNote.body).to.equal(noteData.body);
      
      // Read
      const foundNote = await Note.findById(savedNote._id);
      expect(foundNote.title).to.equal(noteData.title);
      
      // Update
      foundNote.title = 'Updated Title';
      const updatedNote = await foundNote.save();
      expect(updatedNote.title).to.equal('Updated Title');
      
      // Delete
      await Note.findByIdAndDelete(updatedNote._id);
      const deletedNote = await Note.findById(updatedNote._id);
      expect(deletedNote).to.be.null;
    });
  });

  describe('Bulk Operations', () => {
    it('should handle bulk create and retrieve', async () => {
      const notesData = [
        { title: 'Note 1', body: 'Body 1', tags: ['tag1'] },
        { title: 'Note 2', body: 'Body 2', tags: ['tag2'] },
        { title: 'Note 3', body: 'Body 3', tags: ['tag3'] }
      ];

      await Note.insertMany(notesData);
      
      const notes = await Note.find({}).sort({ title: 1 });
      expect(notes).to.have.lengthOf(3);
      expect(notes[0].title).to.equal('Note 1');
    });
  });

  describe('Search and Filter', () => {
    beforeEach(async () => {
      await Note.create([
        { 
          title: 'JavaScript Guide', 
          body: 'Learn JavaScript programming',
          tags: ['javascript', 'programming']
        },
        { 
          title: 'Python Tutorial', 
          body: 'Python for beginners',
          tags: ['python', 'programming']
        },
        { 
          title: 'Node.js Basics', 
          body: 'JavaScript runtime environment',
          tags: ['javascript', 'node']
        }
      ]);
    });

    it('should search across all fields', async () => {
      const javaScriptNotes = await Note.find({
        $or: [
          { title: /javascript/i },
          { body: /javascript/i },
          { tags: 'javascript' }
        ]
      });
      expect(javaScriptNotes).to.have.lengthOf(2);

      const programmingNotes = await Note.find({
        tags: 'programming'
      });
      expect(programmingNotes).to.have.lengthOf(2);
    });

    it('should support complex queries', async () => {
      const notes = await Note.find({
        $and: [
          { tags: 'javascript' },
          { title: { $regex: /guide|basics/i } }
        ]
      });
      expect(notes).to.have.lengthOf(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle maximum length content', async () => {
      const longTitle = 'A'.repeat(200);
      const longBody = 'B'.repeat(10000);
      
      const note = new Note({
        title: longTitle,
        body: longBody,
        tags: ['test']
      });
      
      const savedNote = await note.save();
      expect(savedNote.title).to.have.lengthOf(200);
      expect(savedNote.body).to.have.lengthOf(10000);
    });

    it('should handle special characters', async () => {
      const note = new Note({
        title: 'Special !@#$%^&*()',
        body: 'Content with special chars: !@#$%^&*()',
        tags: ['special!@#']
      });
      
      const savedNote = await note.save();
      expect(savedNote.title).to.equal('Special !@#$%^&*()');
    });

    it('should handle empty tags array', async () => {
      const note = new Note({
        title: 'No Tags',
        body: 'This note has no tags',
        tags: []
      });
      
      const savedNote = await note.save();
      expect(savedNote.tags).to.be.an('array').that.is.empty;
    });
  });

  describe('Timestamps', () => {
    it('should auto-generate timestamps', async () => {
      const note = new Note({
        title: 'Timestamp Test',
        body: 'Testing timestamps'
      });
      
      const savedNote = await note.save();
      expect(savedNote.createdAt).to.be.instanceOf(Date);
      expect(savedNote.updatedAt).to.be.instanceOf(Date);
    });

    it('should update timestamps on modification', async () => {
      const note = await Note.create({
        title: 'Original Title',
        body: 'Original Body'
      });
      
      const originalUpdatedAt = note.updatedAt;
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      note.title = 'Modified Title';
      const updatedNote = await note.save();
      
      expect(updatedNote.updatedAt.getTime()).to.be.greaterThan(originalUpdatedAt.getTime());
    });
  });
});
