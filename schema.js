var Joi = require('joi')

exports.options = Joi.alternatives().try(
  Joi.string(),
  Joi.object().keys({
    path: Joi.string().required(),
    format: Joi.string(),
    hup: Joi.boolean()
  })
)
