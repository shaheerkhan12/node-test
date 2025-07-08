const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const mongoose = require('mongoose');
const Note = require('../../models/Note');
const { MongoMemoryServer } = require('mongodb-memory-server');

chai.use(chaiAsPromised);
const { expect } = chai;
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

      expect(savedNote.title).to.equal(noteData.title);
      expect(savedNote.body).to.equal(noteData.body);
      expect(savedNote.tags).to.deep.equal(noteData.tags);
      expect(savedNote).to.have.property('createdAt');
      expect(savedNote).to.have.property('updatedAt');
    });

    it('should fail when required fields are missing', async () => {
      const note = new Note({});
      
      try {
        await note.save();
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).to.be.instanceOf(mongoose.Error.ValidationError);
        expect(error.errors.title).to.exist;
        expect(error.errors.body).to.exist;
      }
    });

    it('should trim whitespace from fields', async () => {
      const note = new Note({
        title: '  Test Title  ',
        body: '  Test Body  ',
        tags: ['  tag1  ', '  tag2  ']
      });

      const savedNote = await note.save();
      expect(savedNote.title).to.equal('Test Title');
      expect(savedNote.body).to.equal('Test Body');
      expect(savedNote.tags).to.deep.equal(['tag1', 'tag2']);
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
      expect(notes).to.have.lengthOf(3);
    });

    it('should find note by id', async () => {
      const note = await Note.findOne({ title: 'Note 1' });
      const foundNote = await Note.findById(note._id);
      expect(foundNote.title).to.equal('Note 1');
    });

    it('should support pagination', async () => {
      const notes = await Note.find({})
        .skip(1)
        .limit(1)
        .lean();

      expect(notes).to.have.lengthOf(1);
      expect(notes[0].title).to.equal('Note 2');
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

      expect(updatedNote.title).to.equal('Updated Title');
      expect(updatedNote.body).to.equal('Updated Body');
      expect(updatedNote.tags).to.deep.equal(['updated']);
    });

    it('should update only provided fields', async () => {
      const updatedNote = await Note.findByIdAndUpdate(
        testNote._id,
        { title: 'Only Title Updated' },
        { new: true }
      );

      expect(updatedNote.title).to.equal('Only Title Updated');
      expect(updatedNote.body).to.equal('Original Body');
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
      expect(deletedNote).to.be.null;
    });

    it('should handle deleting non-existent note', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const result = await Note.findByIdAndDelete(fakeId);
      expect(result).to.be.null;
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
      expect(notes).to.have.lengthOf(2);
    });

    it('should search notes by regex', async () => {
      const notes = await Note.find({
        $or: [
          { title: /javascript/i },
          { body: /javascript/i }
        ]
      });
      expect(notes).to.have.lengthOf(2);
    });
  });
});
