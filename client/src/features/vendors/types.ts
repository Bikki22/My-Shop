/**
 * Mirrors the public projection of `IVendor` on the server — the fields
 * `PUBLIC_FIELDS` in `modules/vendors/vendor.service.ts` selects.
 *
 * Everything a shop would not want published (KYC documents, payout account,
 * the negotiated commission rate) is absent there, and so absent here.
 */
export interface VendorSummary {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl: string | null;
  bannerUrl?: string | null;
  productCount: number;
  ratingAverage: number;
  ratingCount: number;
  createdAt: string;
}
