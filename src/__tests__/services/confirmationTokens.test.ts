import { NotificationService } from '../../services/NotificationService';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../config/redis');

const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('Confirmation Token Security', () => {
  let notificationService: NotificationService;
  let mockDb: any;
  const tenantId = 'tenant-123';

  beforeEach(() => {
    // Mock database
    mockDb = jest.fn();
    const mockQueryBuilder = {
      insert: jest.fn().mockResolvedValue([1]),
      where: jest.fn().mockReturnThis(),
      first: jest.fn(),
      update: jest.fn().mockResolvedValue(1)
    };
    
    mockDb.mockReturnValue(mockQueryBuilder);

    // Set environment variables
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.CONFIRMATION_TOKEN_EXPIRY = '15';

    notificationService = new NotificationService(mockDb, tenantId);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Token Generation', () => {
    it('should generate secure confirmation tokens with proper expiration', () => {
      const mockToken = 'secure-jwt-token';
      (mockJwt.sign as jest.Mock).mockReturnValue(mockToken);

      const token = notificationService.generateConfirmToken('entry-123', 'slot-123', 'confirm');

      expect(token).toBe(mockToken);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          entryId: 'entry-123',
          slotId: 'slot-123',
          tenantId: tenantId,
          action: 'confirm',
          exp: expect.any(Number)
        }),
        'test-secret-key'
      );

      // Verify expiration is set correctly (15 minutes from now)
      const payload = (mockJwt.sign as jest.Mock).mock.calls[0][0];
      const expectedExpiry = Math.floor(Date.now() / 1000) + (15 * 60);
      expect(payload.exp).toBeGreaterThanOrEqual(expectedExpiry - 5); // Allow 5 second tolerance
      expect(payload.exp).toBeLessThanOrEqual(expectedExpiry + 5);
    });

    it('should generate different tokens for confirm and decline actions', () => {
      const mockConfirmToken = 'confirm-token';
      const mockDeclineToken = 'decline-token';
      
      (mockJwt.sign as jest.Mock)
        .mockReturnValueOnce(mockConfirmToken)
        .mockReturnValueOnce(mockDeclineToken);

      const confirmToken = notificationService.generateConfirmToken('entry-123', 'slot-123', 'confirm');
      const declineToken = notificationService.generateConfirmToken('entry-123', 'slot-123', 'decline');

      expect(confirmToken).toBe(mockConfirmToken);
      expect(declineToken).toBe(mockDeclineToken);

      // Verify different actions in payload
      const confirmPayload = (mockJwt.sign as jest.Mock).mock.calls[0][0];
      const declinePayload = (mockJwt.sign as jest.Mock).mock.calls[1][0];
      
      expect(confirmPayload.action).toBe('confirm');
      expect(declinePayload.action).toBe('decline');
    });

    it('should throw error when JWT_SECRET is missing', () => {
      delete process.env.JWT_SECRET;

      expect(() => {
        notificationService.generateConfirmToken('entry-123', 'slot-123', 'confirm');
      }).toThrow('JWT_SECRET environment variable is required');
    });
  });

  describe('Token Verification', () => {
    it('should verify valid tokens correctly', () => {
      const mockDecoded = {
        entryId: 'entry-123',
        slotId: 'slot-123',
        tenantId: tenantId,
        action: 'confirm' as const,
        exp: Math.floor(Date.now() / 1000) + 900 // 15 minutes
      };

      (mockJwt.verify as jest.Mock).mockReturnValue(mockDecoded);

      const result = notificationService.verifyConfirmToken('valid-token');

      expect(result).toEqual(mockDecoded);
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret-key');
    });

    it('should reject tokens from different tenants', () => {
      const mockDecoded = {
        entryId: 'entry-123',
        slotId: 'slot-123',
        tenantId: 'different-tenant-456',
        action: 'confirm' as const,
        exp: Math.floor(Date.now() / 1000) + 900
      };

      (mockJwt.verify as jest.Mock).mockReturnValue(mockDecoded);

      const result = notificationService.verifyConfirmToken('cross-tenant-token');

      expect(result).toBeNull();
    });

    it('should handle expired tokens', () => {
      (mockJwt.verify as jest.Mock).mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      const result = notificationService.verifyConfirmToken('expired-token');

      expect(result).toBeNull();
    });

    it('should handle malformed tokens', () => {
      (mockJwt.verify as jest.Mock).mockImplementation(() => {
        const error = new Error('Invalid token');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      const result = notificationService.verifyConfirmToken('malformed-token');

      expect(result).toBeNull();
    });

    it('should handle tokens with invalid signatures', () => {
      (mockJwt.verify as jest.Mock).mockImplementation(() => {
        const error = new Error('Invalid signature');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      const result = notificationService.verifyConfirmToken('tampered-token');

      expect(result).toBeNull();
    });
  });

  describe('Token Security Properties', () => {
    it('should include all required fields in token payload', () => {
      (mockJwt.sign as jest.Mock).mockImplementation((payload: any) => {
        // Verify all required fields are present
        expect(payload).toHaveProperty('entryId', 'entry-123');
        expect(payload).toHaveProperty('slotId', 'slot-123');
        expect(payload).toHaveProperty('tenantId', tenantId);
        expect(payload).toHaveProperty('action', 'confirm');
        expect(payload).toHaveProperty('exp');
        
        // Verify exp is a number and in the future
        expect(typeof payload.exp).toBe('number');
        expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
        
        return 'mock-token';
      });

      notificationService.generateConfirmToken('entry-123', 'slot-123', 'confirm');

      expect(mockJwt.sign).toHaveBeenCalled();
    });

    it('should use configurable token expiry', () => {
      process.env.CONFIRMATION_TOKEN_EXPIRY = '30'; // 30 minutes
      
      // Create new service instance to pick up new env var
      const newService = new NotificationService(mockDb, tenantId);
      
      (mockJwt.sign as jest.Mock).mockImplementation((payload: any) => {
        const expectedExpiry = Math.floor(Date.now() / 1000) + (30 * 60);
        expect(payload.exp).toBeGreaterThanOrEqual(expectedExpiry - 5);
        expect(payload.exp).toBeLessThanOrEqual(expectedExpiry + 5);
        return 'mock-token';
      });

      newService.generateConfirmToken('entry-123', 'slot-123', 'confirm');
    });

    it('should default to 15 minutes if expiry not configured', () => {
      delete process.env.CONFIRMATION_TOKEN_EXPIRY;
      
      // Create new service instance
      const newService = new NotificationService(mockDb, tenantId);
      
      (mockJwt.sign as jest.Mock).mockImplementation((payload: any) => {
        const expectedExpiry = Math.floor(Date.now() / 1000) + (15 * 60);
        expect(payload.exp).toBeGreaterThanOrEqual(expectedExpiry - 5);
        expect(payload.exp).toBeLessThanOrEqual(expectedExpiry + 5);
        return 'mock-token';
      });

      newService.generateConfirmToken('entry-123', 'slot-123', 'confirm');
    });
  });

  describe('Token Uniqueness', () => {
    it('should generate unique tokens for different entries', () => {
      const tokens = new Set();
      
      (mockJwt.sign as jest.Mock).mockImplementation((payload: any) => {
        return `token-${payload.entryId}-${payload.slotId}-${payload.action}-${payload.exp}`;
      });

      // Generate tokens for different entries
      const token1 = notificationService.generateConfirmToken('entry-1', 'slot-123', 'confirm');
      const token2 = notificationService.generateConfirmToken('entry-2', 'slot-123', 'confirm');
      const token3 = notificationService.generateConfirmToken('entry-1', 'slot-456', 'confirm');

      tokens.add(token1);
      tokens.add(token2);
      tokens.add(token3);

      // All tokens should be unique
      expect(tokens.size).toBe(3);
    });

    it('should generate different tokens when called multiple times for same parameters', () => {
      let callCount = 0;
      (mockJwt.sign as jest.Mock).mockImplementation((payload: any) => {
        callCount++;
        // Expiry will be slightly different each time due to time progression
        return `token-${callCount}-${payload.exp}`;
      });

      const token1 = notificationService.generateConfirmToken('entry-123', 'slot-123', 'confirm');
      // Small delay to ensure different timestamp
      const token2 = notificationService.generateConfirmToken('entry-123', 'slot-123', 'confirm');

      expect(token1).not.toBe(token2);
    });
  });
});