const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true
    },
    avatarColor: {
      type: String,
      required: true
    },
    lastSeenAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Client', ClientSchema);
