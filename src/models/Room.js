const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    type: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      default: null,
      sparse: true,
      index: true
    },
    createdBy: {
      type: String,
      default: null
    },
    members: {
      type: [String], // Danh sach clientId co quyen vao phong
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Room', RoomSchema);
