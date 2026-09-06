/**
 * The page envelope the API's list endpoints answer with.
 *
 * It is produced by `mongoose-aggregate-paginate-v2` on the server and
 * spread straight onto the response body (`{ success: true, ...result }`)
 * rather than nested under `data`. That is why paginated calls pass
 * `unwrap: false` — see `RequestOptions.unwrap` in `http.ts`.
 */
export interface Paginated<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
}

/**
 * A well-formed empty page.
 *
 * Used as the fallback when a list request fails, so a page that renders a
 * grid plus a pager doesn't have to branch on `null` in six places.
 */
export const emptyPage = <T>(limit: number): Paginated<T> => ({
  docs: [],
  totalDocs: 0,
  limit,
  page: 1,
  totalPages: 0,
  pagingCounter: 0,
  hasPrevPage: false,
  hasNextPage: false,
  prevPage: null,
  nextPage: null,
});
