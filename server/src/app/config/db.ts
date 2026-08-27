import mongoose from "mongoose";

export const connectDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI is not defined");
    }

    await mongoose.connect(mongoUri);

    console.log("📦 MongoDB connected");
  } catch (error) {
    console.log("Error in mongodb", error);
  }
};
