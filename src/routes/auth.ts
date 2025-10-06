import { Router, Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { authSchemas } from '../validation/authSchemas';

const router = Router();
const authService = new AuthService();

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', validateRequest(authSchemas.register), async (req: Request, res: Response) => {
  try {
    const { email, password, name, role, tenantId } = req.body;

    // Validate password strength
    const passwordValidation = authService.validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'INVALID_PASSWORD',
        message: 'Password does not meet requirements',
        details: passwordValidation.errors
      });
    }

    const result = await authService.register({
      email,
      password,
      name,
      role,
      tenantId
    });

    res.status(201).json({
      message: 'User registered successfully',
      data: result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    
    if (message.includes('already exists')) {
      return res.status(409).json({
        error: 'USER_EXISTS',
        message
      });
    }

    res.status(400).json({
      error: 'REGISTRATION_FAILED',
      message
    });
  }
});

/**
 * POST /auth/login
 * Login user
 */
router.post('/login', validateRequest(authSchemas.login), async (req: Request, res: Response) => {
  try {
    const { email, password, tenantId } = req.body;

    const result = await authService.login({
      email,
      password,
      tenantId
    });

    res.json({
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    
    res.status(401).json({
      error: 'LOGIN_FAILED',
      message
    });
  }
});

/**
 * POST /auth/verify
 * Verify JWT token
 */
router.post('/verify', authenticate, async (req: Request, res: Response) => {
  try {
    // If we reach here, the token is valid (authenticate middleware passed)
    res.json({
      message: 'Token is valid',
      data: {
        user: req.user
      }
    });
  } catch (error) {
    res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Token verification failed'
    });
  }
});

/**
 * GET /auth/me
 * Get current user profile
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.repositories) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const user = await req.repositories.user.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    // Remove password hash from response
    const { password_hash, ...userProfile } = user;

    res.json({
      message: 'User profile retrieved successfully',
      data: userProfile
    });
  } catch (error) {
    res.status(500).json({
      error: 'PROFILE_FETCH_FAILED',
      message: 'Failed to retrieve user profile'
    });
  }
});

/**
 * POST /auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  // Since we're using stateless JWT tokens, logout is handled client-side
  // This endpoint exists for consistency and potential future token blacklisting
  res.json({
    message: 'Logout successful'
  });
});

export default router;