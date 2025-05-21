// lib/mongodb.ts
import mongoose from "mongoose";

const connectMongo = async () => {
  // if already connected, do nothing
  if (mongoose.connection.readyState >= 1) return;

  // read your connection string
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error(
      "Please define the MONGO_URI environment variable in .env.local"
    );
  }

  // actually connect
  await mongoose.connect(uri);
};

export default connectMongo;
