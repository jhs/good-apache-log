var Joi = require('joi')

exports.options = Joi.alternatives().try(
  Joi.string(),
  Joi.object().keys({
    file  : Joi.string().required(),
    format: Joi.string(),
    hup: Joi.boolean()
  })
)
