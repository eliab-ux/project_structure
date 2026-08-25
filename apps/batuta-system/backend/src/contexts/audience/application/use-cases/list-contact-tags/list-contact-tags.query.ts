/**
 * No fields: the account comes from the request scope, never from the caller.
 *
 * It exists as a type anyway so the use case keeps the same shape as every other one — a query with
 * no arguments today is a query with a filter tomorrow.
 */
export class ListContactTagsQuery {}
