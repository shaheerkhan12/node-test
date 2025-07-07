const mongoose = require('mongoose');

// AI-generated schema for efficient note storage and search
const noteSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  body: {
    type: String,
    required: true,
    trim: true,
    maxlength: 10000
  },
  // Vector embedding for semantic search (optional)
  embedding: {
    type: [Number],
    default: undefined
  },
  // Metadata for enhanced search and filtering
  tags: [{
    type: String,
    trim: true
  }],
  // Timestamps for tracking creation and updates
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  // Enable text search indexing
  timestamps: true
});

// Create text index for efficient search across title and body
noteSchema.index({ 
  title: 'text', 
  body: 'text' 
}, {
  weights: {
    title: 2,  // Give title higher weight in search
    body: 1
  }
});

// Create compound index for better query performance
noteSchema.index({ createdAt: -1 });

// Pre-save middleware to update the updatedAt field
noteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance method to generate search-friendly representation
noteSchema.methods.toSearchResult = function() {
  return {
    id: this._id,
    title: this.title,
    body: this.body.substring(0, 200) + (this.body.length > 200 ? '...' : ''),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Static method for advanced text search
noteSchema.statics.searchByText = function(query, options = {}) {
  const { limit = 20, skip = 0 } = options;
  
  return this.find(
    { $text: { $search: query } },
    { score: { $meta: 'textScore' } }
  )
  .sort({ score: { $meta: 'textScore' } })
  .limit(limit)
  .skip(skip);
};

// Static method for regex-based search (fallback)
noteSchema.statics.searchByRegex = function(query, options = {}) {
  const { limit = 20, skip = 0 } = options;
  const regex = new RegExp(query, 'i');
  
  return this.find({
    $or: [
      { title: regex },
      { body: regex }
    ]
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip(skip);
};

module.exports = mongoose.model('Note', noteSchema);