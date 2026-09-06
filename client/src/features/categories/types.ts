/**
 * Mirrors `ICategory` from the server's
 * `modules/category/category.model.ts`, as it arrives over the wire.
 */
export interface Category {
  _id: string;
  /** `null` for the platform-wide catalogue; set for a merchant's own tree. */
  owner: string | null;
  name: string;
  slug: string;
  description: string;
  image: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
