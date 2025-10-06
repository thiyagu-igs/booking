import Joi from 'joi';

export const slotSchemas = {
  createSlot: {
    body: Joi.object({
      staff_id: Joi.string().uuid().required()
        .messages({
          'string.uuid': 'Staff ID must be a valid UUID',
          'any.required': 'Staff ID is required'
        }),
      service_id: Joi.string().uuid().required()
        .messages({
          'string.uuid': 'Service ID must be a valid UUID',
          'any.required': 'Service ID is required'
        }),
      start_time: Joi.date().iso().greater('now').required()
        .messages({
          'date.iso': 'Start time must be a valid ISO date',
          'date.greater': 'Start time must be in the future',
          'any.required': 'Start time is required'
        }),
      end_time: Joi.date().iso().greater(Joi.ref('start_time')).required()
        .messages({
          'date.iso': 'End time must be a valid ISO date',
          'date.greater': 'End time must be after start time',
          'any.required': 'End time is required'
        })
    })
  },

  updateSlot: {
    body: Joi.object({
      staff_id: Joi.string().uuid().optional()
        .messages({
          'string.uuid': 'Staff ID must be a valid UUID'
        }),
      service_id: Joi.string().uuid().optional()
        .messages({
          'string.uuid': 'Service ID must be a valid UUID'
        }),
      start_time: Joi.date().iso().greater('now').optional()
        .messages({
          'date.iso': 'Start time must be a valid ISO date',
          'date.greater': 'Start time must be in the future'
        }),
      end_time: Joi.date().iso().when('start_time', {
        is: Joi.exist(),
        then: Joi.date().greater(Joi.ref('start_time')),
        otherwise: Joi.date().iso()
      }).optional()
        .messages({
          'date.iso': 'End time must be a valid ISO date',
          'date.greater': 'End time must be after start time'
        })
    }).min(1).messages({
      'object.min': 'At least one field must be provided for update'
    })
  },

  holdSlot: {
    body: Joi.object({
      hold_duration_minutes: Joi.number().integer().min(1).max(60).optional().default(10)
        .messages({
          'number.base': 'Hold duration must be a number',
          'number.integer': 'Hold duration must be an integer',
          'number.min': 'Hold duration must be at least 1 minute',
          'number.max': 'Hold duration cannot exceed 60 minutes'
        })
    })
  }
};