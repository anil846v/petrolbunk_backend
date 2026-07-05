/**
 * Uniform JSON response helpers — every endpoint uses these so the
 * frontend always gets the same envelope shape.
 *
 * Success:  { success: true,  message, data, meta? }
 * Error:    { success: false, message }
 */

const sendSuccess = (res, data = null, message = 'Success', statusCode = 200, meta = null) => {
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  if (meta !== null) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

const sendError = (res, message = 'Something went wrong', statusCode = 500) =>
  res.status(statusCode).json({ success: false, message });

module.exports = { sendSuccess, sendError };
