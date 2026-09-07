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

/**
 * The other page envelope, used by every list endpoint except the
 * catalogue: `{ data, pagination }`.
 *
 * Two shapes exist because the server's product module pages with
 * `mongoose-aggregate-paginate-v2` (which defines `docs`/`totalDocs`)
 * while the modules written later hand-roll a `skip`/`limit` count. Both
 * are modelled here rather than normalised in the client, so a response
 * that changes shape on the server is a type error rather than a page of
 * `undefined`.
 */
export interface Page<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

/** A well-formed empty `Page`, for the fallback when a list read fails. */
export const emptyResultPage = <T>(limit: number): Page<T> => ({
  data: [],
  pagination: { page: 1, limit, total: 0, pages: 0 },
});
