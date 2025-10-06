import Joi from 'joi';

export const authSchemas = {
  register: Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    
    password: Joi.string()
      .min(8)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'any.required': 'Password is required'
      }),
    
    name: Joi.string()
      .min(2)
      .max(255)
      .required()
      .messages({
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 255 characters',
        'any.required': 'Name is required'
      }),
    
    role: Joi.string()
      .valid('admin', 'staff', 'manager')
      .default('staff')
      .messages({
        'any.only': 'Role must be one of: admin, staff, manager'
      }),
    
    tenantId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.guid': 'Tenant ID must be a valid UUID',
        'any.required': 'Tenant ID is required'
      })
  }),

  login: Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required'
      }),
    
    tenantId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.guid': 'Tenant ID must be a valid UUID',
        'any.required': 'Tenant ID is required'
      })
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string()
      .required()
      .messages({
        'any.required': 'Current password is required'
      }),
    
    newPassword: Joi.string()
      .min(8)
      .required()
      .messages({
        'string.min': 'New password must be at least 8 characters long',
        'any.required': 'New password is required'
      }),
    
    confirmPassword: Joi.string()
      .valid(Joi.ref('newPassword'))
      .required()
      .messages({
        'any.only': 'Password confirmation does not match new password',
        'any.required': 'Password confirmation is required'
      })
  }),

  updateProfile: Joi.object({
    name: Joi.string()
      .min(2)
      .max(255)
      .messages({
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 255 characters'
      }),
    
    email: Joi.string()
      .email()
      .messages({
        'string.email': 'Please provide a valid email address'
      })
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update'
  })
};