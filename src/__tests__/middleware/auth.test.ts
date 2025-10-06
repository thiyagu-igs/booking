import { Request, Response, NextFunction } from 'express';
import { AuthMiddleware } from '../../middleware/auth';
import { AuthService } from '../../services/AuthService';

// Mock dependencies
jest.mock('../../services/AuthService');
jest.mock('../../repositories/UserRepository');
jest.mock('../../repositories/TenantRepository');

const MockedAuthService = AuthService as jest.MockedClass<typeof AuthService>;

describe('AuthMiddleware', () => {
  let authMiddleware: AuthMiddleware;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  const mockTokenPayload = {
    userId: 'user-123',
    tenantId: 'tenant-123',
    email: 'test@example.com',
    role: 'staff'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock AuthService instance
    mockAuthService = {
      verifyToken: jest.fn(),
    } as any;
    MockedAuthService.mockImplementation(() => mockAuthService);

    authMiddleware = new AuthMiddleware();

    // Setup mock request, response, and next
    mockRequest = {
      headers: {},
      user: undefined,
      tenantId: undefined,
      repositories: undefined
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  describe('authenticate', () => {
    it('should successfully authenticate with valid token', async () => {
      // Arrange
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      mockAuthService.verifyToken.mockResolvedValue(mockTokenPayload);

      // Act
      await authMiddleware.authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual(mockTokenPayload);
      expect(mockRequest.tenantId).toBe('tenant-123');
      expect(mockRequest.repositories).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 401 if no authorization header', async () => {
      // Arrange
      mockRequest.headers = {};

      // Act
      await authMiddleware.authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'UNAUTHORIZED',
        message: 'Authorization header is required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if authorization header format is invalid', async () => {
      // Arrange
      mockRequest.headers = { authorization: 'InvalidFormat' };

      // Act
      await authMiddleware.authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'UNAUTHORIZED',
        message: 'Invalid authorization header format'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if token verification fails', async () => {
      // Arrange
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      mockAuthService.verifyToken.mockRejectedValue(new Error('Invalid token'));

      // Act
      await authMiddleware.authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('invalid-token');
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'UNAUTHORIZED',
        message: 'Invalid token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    beforeEach(() => {
      mockRequest.user = mockTokenPayload;
    });

    it('should allow access for user with required role', () => {
      // Arrange
      const middleware = authMiddleware.requireRole('staff');

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow access for user with one of multiple required roles', () => {
      // Arrange
      const middleware = authMiddleware.requireRole(['admin', 'staff']);

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access for user without required role', () => {
      // Arrange
      const middleware = authMiddleware.requireRole('admin');

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'FORBIDDEN',
        message: 'Access denied. Required role: admin'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access if user is not authenticated', () => {
      // Arrange
      mockRequest.user = undefined;
      const middleware = authMiddleware.requireRole('staff');

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should allow access for admin user', () => {
      // Arrange
      mockRequest.user = { ...mockTokenPayload, role: 'admin' };

      // Act
      authMiddleware.requireAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access for non-admin user', () => {
      // Arrange
      mockRequest.user = mockTokenPayload; // role: 'staff'

      // Act
      authMiddleware.requireAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireManager', () => {
    it('should allow access for admin user', () => {
      // Arrange
      mockRequest.user = { ...mockTokenPayload, role: 'admin' };

      // Act
      authMiddleware.requireManager(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow access for manager user', () => {
      // Arrange
      mockRequest.user = { ...mockTokenPayload, role: 'manager' };

      // Act
      authMiddleware.requireManager(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access for staff user', () => {
      // Arrange
      mockRequest.user = mockTokenPayload; // role: 'staff'

      // Act
      authMiddleware.requireManager(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should set user context if valid token provided', async () => {
      // Arrange
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      mockAuthService.verifyToken.mockResolvedValue(mockTokenPayload);

      // Act
      await authMiddleware.optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual(mockTokenPayload);
      expect(mockRequest.tenantId).toBe('tenant-123');
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without user context if no token provided', async () => {
      // Arrange
      mockRequest.headers = {};

      // Act
      await authMiddleware.optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockAuthService.verifyToken).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without user context if token is invalid', async () => {
      // Arrange
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      mockAuthService.verifyToken.mockRejectedValue(new Error('Invalid token'));

      // Act
      await authMiddleware.optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('invalid-token');
      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
});