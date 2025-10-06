import { AuthService } from '../services/AuthService';
import { UserRepository } from '../repositories/UserRepository';

// Simple integration test to verify auth components work together
describe('Authentication Integration', () => {
  let authService: AuthService;

  beforeEach(() => {
    // Set up environment for testing
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.JWT_EXPIRES_IN = '24h';
    
    authService = new AuthService();
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
  });

  describe('Password Validation', () => {
    it('should validate strong passwords correctly', () => {
      const result = authService.validatePassword('StrongPass123!');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
      const result = authService.validatePassword('weak');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should require uppercase letters', () => {
      const result = authService.validatePassword('lowercase123!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should require lowercase letters', () => {
      const result = authService.validatePassword('UPPERCASE123!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should require numbers', () => {
      const result = authService.validatePassword('NoNumbers!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should require special characters', () => {
      const result = authService.validatePassword('NoSpecial123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should require minimum length', () => {
      const result = authService.validatePassword('Short1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });
  });

  describe('UserRepository Instantiation', () => {
    it('should create UserRepository with tenant ID', () => {
      const tenantId = 'test-tenant-123';
      const userRepo = new UserRepository(tenantId);
      
      expect(userRepo).toBeInstanceOf(UserRepository);
      // Verify tenant ID is set (accessing protected property for testing)
      expect((userRepo as any).tenantId).toBe(tenantId);
    });
  });
});