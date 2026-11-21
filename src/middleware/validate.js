const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => d.message.replace(/['"]/g, ''));
      return res.status(400).json({
        success: false,
        message: details.length === 1 ? details[0] : 'Validation failed',
        errors: details,
      });
    }

    // Replace request property with sanitized, coerced, stripped values
    req[property] = value;
    next();
  };
};

module.exports = validate;
