import { AuditService } from '../../services/AuditService';

// Mock database connection
jest.mock('../../database/connection', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    insert: jest.fn().mockResolvedValue([]),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
  }))
}));

describe('AuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should log audit events successfully', async () => {
      const auditEntry = {
        tenantId: 'test-tenant',
        userId: 'test-user',
        actorType: 'user' as const,
        action: 'CREATE',
        resourceType: 'waitlist_entry',
        resourceId: 'test-resource',
        severity: 'low' as const
      };

      // Should not throw
      await expect(AuditService.log(auditEntry)).resolves.not.toThrow();
    });

    it('should handle logging failures gracefully', async () => {
      const auditEntry = {
        tenantId: 'test-tenant',
        actorType: 'user' as const,
        action: 'CREATE',
        resourceType: 'waitlist_entry'
      };

      // Mock database error
      const mockDb = require('../../database/connection').default;
      mockDb.mockImplementation(() => {
        throw new Error('Database error');
      });

      // Should not throw even if database fails
      await expect(AuditService.log(auditEntry)).resolves.not.toThrow();
    });
  });

  describe('logAuth', () => {
    it('should log authentication events', async () => {
      const mockReq = {
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-user-agent'),
        method: 'POST',
        originalUrl: '/api/auth/login'
      };

      await expect(
        AuditService.logAuth(
          'test-tenant',
          'test-user',
          'LOGIN',
          mockReq as any,
          true
        )
      ).resolves.not.toThrow();
    });
  });

  describe('logSecurity', () => {
    it('should log security events', async () => {
      const mockReq = {
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-user-agent'),
        method: 'POST',
        originalUrl: '/api/test',
        user: { id: 'test-user' }
      };

      await expect(
        AuditService.logSecurity(
          'test-tenant',
          'RATE_LIMIT_EXCEEDED',
          mockReq as any,
          'high',
          { details: 'test' }
        )
      ).resolves.not.toThrow();
    });
  });

  describe('logSystem', () => {
    it('should log system events', async () => {
      await expect(
        AuditService.logSystem(
          'BACKUP_CREATED',
          'database',
          'test-db',
          { size: 1024 },
          'low'
        )
      ).resolves.not.toThrow();
    });
  });
});