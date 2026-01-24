import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema({
  rating: { type: Number },
  text: { type: String },
});

const PlaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String },
  location: {
    address: { type: String },
    lat: { type: Number },
    lng: { type: Number },
  },
  description: { type: String },
  costLevel: { type: String },
  reviews: [ReviewSchema],
  imageUrl: { type: String },
  tags: [String],
  // users who bookmarked this place
  bookmarkedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Place || mongoose.model("Place", PlaceSchema);
