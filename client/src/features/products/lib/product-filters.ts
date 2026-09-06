import {
  PRODUCT_SORTS,
  type ProductFilters,
  type ProductSort,
} from "../types";

/**
 * The catalogue's URL contract.
 *
 * The keys are deliberately the same strings the API accepts, so the
 * address bar and the outgoing request never need translating between two
 * vocabularies — one rename here changes both.
 */
export const PRODUCT_PARAM = {
  search: "search",
  categoryId: "categoryId",
  vendor: "vendor",
  minPrice: "minPrice",
  maxPrice: "maxPrice",
  tags: "tags",
  sort: "sort",
  page: "page",
} as const;

/** Matches `PAGINATION.DEFAULT_PAGE` / a grid-friendly page size. */
export const DEFAULT_PRODUCT_LIMIT = 12;

export const DEFAULT_PRODUCT_FILTERS: ProductFilters = {
  search: "",
  categoryId: null,
  vendor: null,
  minPrice: null,
  maxPrice: null,
  tags: [],
  sort: "newest",
  page: 1,
  limit: DEFAULT_PRODUCT_LIMIT,
};

/** `searchParams` hands back `string[]` for repeated keys; take the first. */
const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const toPositiveNumber = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const isSort = (value: string | undefined): value is ProductSort =>
  PRODUCT_SORTS.includes(value as ProductSort);

export const parseTags = (value: string | undefined | null): string[] =>
  (value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

/**
 * Reads filters out of a URL.
 *
 * Anything unparseable falls back to its default rather than throwing: a
 * hand-edited `?page=banana` should show page one, not a 500.
 */
export function parseProductFilters(
  params: Record<string, string | string[] | undefined> | URLSearchParams,
): ProductFilters {
  const read = (key: string): string | undefined =>
    params instanceof URLSearchParams
      ? (params.get(key) ?? undefined)
      : first(params[key]);

  const sort = read(PRODUCT_PARAM.sort);
  const page = Number(read(PRODUCT_PARAM.page));

  return {
    search: read(PRODUCT_PARAM.search)?.trim() ?? "",
    categoryId: read(PRODUCT_PARAM.categoryId) || null,
    vendor: read(PRODUCT_PARAM.vendor) || null,
    minPrice: toPositiveNumber(read(PRODUCT_PARAM.minPrice)),
    maxPrice: toPositiveNumber(read(PRODUCT_PARAM.maxPrice)),
    tags: parseTags(read(PRODUCT_PARAM.tags)),
    sort: isSort(sort) ? sort : DEFAULT_PRODUCT_FILTERS.sort,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    limit: DEFAULT_PRODUCT_LIMIT,
  };
}

/**
 * Serializes filters back into query params, omitting anything left at its
 * default so a clean catalogue stays at a clean `/products`.
 */
export function toProductSearchParams(
  filters: ProductFilters,
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.search) params.set(PRODUCT_PARAM.search, filters.search);
  if (filters.categoryId)
    params.set(PRODUCT_PARAM.categoryId, filters.categoryId);
  if (filters.vendor) params.set(PRODUCT_PARAM.vendor, filters.vendor);
  if (filters.minPrice !== null)
    params.set(PRODUCT_PARAM.minPrice, String(filters.minPrice));
  if (filters.maxPrice !== null)
    params.set(PRODUCT_PARAM.maxPrice, String(filters.maxPrice));
  if (filters.tags.length > 0)
    params.set(PRODUCT_PARAM.tags, filters.tags.join(","));
  if (filters.sort !== DEFAULT_PRODUCT_FILTERS.sort)
    params.set(PRODUCT_PARAM.sort, filters.sort);
  if (filters.page > 1) params.set(PRODUCT_PARAM.page, String(filters.page));

  return params;
}

/**
 * A `/products` href for these filters.
 *
 * Typed as a template literal because `typedRoutes` accepts
 * `` `${StaticRoute}?${string}` `` but not a plain `string`.
 */
export function productsHref(
  filters: ProductFilters,
): "/products" | `/products?${string}` {
  const query = toProductSearchParams(filters).toString();
  return query ? `/products?${query}` : "/products";
}

/** Applies a partial change and returns to page one, which is almost always
 * what changing a filter means — page 5 of the old result set is nonsense
 * against a new one. Pass `page` explicitly to page through. */
export function withFilters(
  filters: ProductFilters,
  changes: Partial<ProductFilters>,
): ProductFilters {
  return { ...filters, page: 1, ...changes };
}

/** How many facets are narrowing the catalogue — the badge on the Filters
 * button. Sort is excluded: it reorders, it doesn't narrow. */
export function countActiveFilters(filters: ProductFilters): number {
  return (
    (filters.search ? 1 : 0) +
    (filters.categoryId ? 1 : 0) +
    (filters.vendor ? 1 : 0) +
    (filters.minPrice !== null ? 1 : 0) +
    (filters.maxPrice !== null ? 1 : 0) +
    filters.tags.length
  );
}

export const hasActiveFilters = (filters: ProductFilters): boolean =>
  countActiveFilters(filters) > 0;
