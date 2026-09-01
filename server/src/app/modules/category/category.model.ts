import mongoose, {
  model,
  Schema,
  type HydratedDocument,
  type Types,
} from "mongoose";

/**
 * The persisted shape only — deliberately not extending `Document`, for the
 * same reason as `IProduct`/`IUser`: mixing the two makes `Partial<ICategory>`
 * include every mongoose method and breaks `.lean()` results.
 */
export interface ICategory {
  /** `null` for the platform-wide catalogue; set for a merchant's own tree. */
  owner: Types.ObjectId | null;
  name: string;
  slug: string;
  description: string;
  image: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CategoryDocument = HydratedDocument<ICategory>;

const categorySchema = new Schema<ICategory>(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug may only contain lowercase letters, numbers and single hyphens",
      ],
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    image: {
      type: String,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Slug leads so a storefront lookup by slug alone still uses the index
// prefix, while the pair keeps slugs unique *per owner* (documents with
// `owner: null` collide with each other, which is what we want for the
// shared catalogue).
categorySchema.index({ slug: 1, owner: 1 }, { unique: true });

// The listing is always "a merchant's live categories, alphabetical".
categorySchema.index({ owner: 1, isActive: 1, name: 1 });

export const Category = model<ICategory>("Category", categorySchema);
