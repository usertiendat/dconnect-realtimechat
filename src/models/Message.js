const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    roomId: {
      type: String,
      required: true,
      index: true
    },
    senderId: {
      type: String,
      required: true,
      index: true
    },
    senderName: {
      type: String,
      required: true
    },
    avatarColor: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true,
      maxlength: 1000
    },
    clientTempId: {
      type: String,
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index de truy van lich su tin nhan theo phong va thoi gian cuc nhanh
MessageSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
