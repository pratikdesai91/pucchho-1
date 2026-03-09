import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  role: { type: String, required: true },
  content: { type: String, required: true },
});

const chatSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  title: { type: String },
  messages: [messageSchema],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Chat ||
  mongoose.model("Chat", chatSchema);