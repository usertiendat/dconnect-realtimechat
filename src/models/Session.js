const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema(
  {
    sessionToken: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    clientId: {
      type: String,
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: '0s' } // TTL index: tu dong xoa document khi het han
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Session', SessionSchema);
