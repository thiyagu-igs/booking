import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

/**
 * Middleware to validate request data against Joi schema
 */
export const validateRequest = (schema: Joi.ObjectSchema | any, source: 'body' | 'query' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const dataToValidate = source === 'query' ? req.query : req.body;
    
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Return all validation errors
      stripUnknown: true, // Remove unknown fields
      convert: true // Convert types when possible
    });

    if (error) {
      const validationErrors = error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: validationErrors
      });
      return;
    }

    // Replace req.body or req.query with validated and sanitized data
    if (source === 'query') {
      req.query = value;
    } else {
      req.body = value;
    }
    next();
  };
};

/**
 * Middleware to validate query parameters
 */
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Query parameter validation failed',
        details: validationErrors
      });
      return;
    }

    req.query = value;
    next();
  };
};

/**
 * Middleware to validate URL parameters
 */
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'URL parameter validation failed',
        details: validationErrors
      });
      return;
    }

    req.params = value;
    next();
  };
};