/**
 * Offset-based pagination helpers.
 * Max limit is capped at 100 to prevent memory blow-ups.
 */

const getPagination = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

const buildMeta = (count, page, limit) => ({
  total:       count,
  page,
  limit,
  totalPages:  Math.ceil(count / limit),
  hasNextPage: page * limit < count,
  hasPrevPage: page > 1,
});

/**
 * Validate a client-supplied sort column against an explicit allowlist.
 * Never pass req.query.sortBy straight into ORDER BY — SQL injection risk.
 */
const getSortOrder = (query, allowedColumns, defaultColumn = 'created_at') => {
  const sortBy = allowedColumns.includes(query.sortBy) ? query.sortBy : defaultColumn;
  const order  = query.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  return [[sortBy, order]];
};

module.exports = { getPagination, buildMeta, getSortOrder };
