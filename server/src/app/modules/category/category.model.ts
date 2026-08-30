import mongoose, { Document, model, Schema, Types } from "mongoose";

export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  owner?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      requierd: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

export const Category = model<ICategory>("Category", categorySchema);
