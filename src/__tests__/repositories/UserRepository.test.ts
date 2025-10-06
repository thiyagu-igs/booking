import { UserRepository } from '../../repositories/UserRepository';
import { User } from '../../models';
import db from '../../database/connection';

// Mock the database connection
jest.mock('../../database/connection', () => {
  const mockDb = jest.fn().mockReturnThis();
  mockDb.select = jest.fn().mockReturnThis();
  mockDb.from = jest.fn().mockReturnThis();
  mockDb.where = jest.fn().mockReturnThis();
  mockDb.first = jest.fn();
  mockDb.insert = jest.fn().mockReturnThis();
  mockDb.into = jest.fn();
  mockDb.update = jest.fn();
  mockDb.orderBy = jest.fn().mockReturnThis();
  mockDb.count = jest.fn().mockReturnThis();
  
  return {
    __esModule: true,
    default: mockDb
  };
});

const mockDb = db as jest.Mocked<typeof db>;

describe('UserRepository', () => {
  let userRepository: UserRepository;
  const tenantId = 'tenant-123';

  const mockUser: User = {
    id: 'user-123',
    tenant_id: tenantId,
    email: 'test@example.com',
    password_hash: 'hashed-password',
    name: 'Test User',
    role: 'staff',
    active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository = new UserRepository(tenantId);
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      // Arrange
      mockDb.first.mockResolvedValue(mockUser);

      // Act
      const result = await userRepository.findByEmail('test@example.com');

      // Assert
      expect(mockDb.select).toHaveBeenCalledWith('*');
      expect(mockDb.from).toHaveBeenCalledWith('users');
      expect(mockDb.where).toHaveBeenCalledWith({
        tenant_id: tenantId,
        email: 'test@example.com'
      });
      expect(result).toEqual(mockUser);
    });

    it('should normalize email to lowercase', async () => {
      // Arrange
      mockDb.first.mockResolvedValue(mockUser);

      // Act
      await userRepository.findByEmail('TEST@EXAMPLE.COM');

      // Assert
      expect(mockDb.where).toHaveBeenCalledWith({
        tenant_id: tenantId,
        email: 'test@example.com'
      });
    });

    it('should return null if user not found', async () => {
      // Arrange
      mockDb.first.mockResolvedValue(undefined);

      // Act
      const result = await userRepository.findByEmail('notfound@example.com');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create user with normalized email', async () => {
      // Arrange
      const userData = {
        email: 'TEST@EXAMPLE.COM',
        password_hash: 'hashed-password',
        name: 'Test User',
        role: 'staff' as const,
        active: true
      };

      mockDb.insert.mockResolvedValue([1]);
      mockDb.first.mockResolvedValue(mockUser);

      // Act
      const result = await userRepository.create(userData);

      // Assert
      expect(mockDb.insert).toHaveBeenCalledWith({
        ...userData,
        email: 'test@example.com',
        tenant_id: tenantId
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      // Arrange
      const userId = 'user-123';
      mockDb.update.mockResolvedValue(1);

      // Act
      await userRepository.updateLastLogin(userId);

      // Assert
      expect(mockDb.where).toHaveBeenCalledWith({
        id: userId,
        tenant_id: tenantId
      });
      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          last_login_at: expect.any(Date),
          updated_at: expect.any(Date)
        })
      );
    });
  });

  describe('findActiveUsers', () => {
    it('should find all active users', async () => {
      // Arrange
      const activeUsers = [mockUser, { ...mockUser, id: 'user-456' }];
      mockDb.orderBy.mockResolvedValue(activeUsers);

      // Act
      const result = await userRepository.findActiveUsers();

      // Assert
      expect(mockDb.select).toHaveBeenCalledWith('*');
      expect(mockDb.from).toHaveBeenCalledWith('users');
      expect(mockDb.where).toHaveBeenCalledWith({
        tenant_id: tenantId,
        active: true
      });
      expect(mockDb.orderBy).toHaveBeenCalledWith('name', 'asc');
      expect(result).toEqual(activeUsers);
    });
  });

  describe('deactivate', () => {
    it('should deactivate user successfully', async () => {
      // Arrange
      const userId = 'user-123';
      mockDb.update.mockResolvedValue(1);

      // Act
      const result = await userRepository.deactivate(userId);

      // Assert
      expect(mockDb.where).toHaveBeenCalledWith({
        id: userId,
        tenant_id: tenantId
      });
      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          active: false,
          updated_at: expect.any(Date)
        })
      );
      expect(result).toBe(true);
    });

    it('should return false if user not found', async () => {
      // Arrange
      const userId = 'nonexistent-user';
      mockDb.update.mockResolvedValue(0);

      // Act
      const result = await userRepository.deactivate(userId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('reactivate', () => {
    it('should reactivate user successfully', async () => {
      // Arrange
      const userId = 'user-123';
      mockDb.update.mockResolvedValue(1);

      // Act
      const result = await userRepository.reactivate(userId);

      // Assert
      expect(mockDb.where).toHaveBeenCalledWith({
        id: userId,
        tenant_id: tenantId
      });
      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          active: true,
          updated_at: expect.any(Date)
        })
      );
      expect(result).toBe(true);
    });
  });

  describe('updateRole', () => {
    it('should update user role successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const newRole = 'admin';
      const updatedUser = { ...mockUser, role: 'admin' as const };
      
      mockDb.update.mockResolvedValue(1);
      mockDb.first.mockResolvedValue(updatedUser);

      // Act
      const result = await userRepository.updateRole(userId, newRole);

      // Assert
      expect(mockDb.where).toHaveBeenCalledWith({
        id: userId,
        tenant_id: tenantId
      });
      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          role: newRole,
          updated_at: expect.any(Date)
        })
      );
      expect(result).toEqual(updatedUser);
    });

    it('should return null if user not found', async () => {
      // Arrange
      const userId = 'nonexistent-user';
      mockDb.update.mockResolvedValue(0);

      // Act
      const result = await userRepository.updateRole(userId, 'admin');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updatePassword', () => {
    it('should update user password successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const newPasswordHash = 'new-hashed-password';
      mockDb.update.mockResolvedValue(1);

      // Act
      const result = await userRepository.updatePassword(userId, newPasswordHash);

      // Assert
      expect(mockDb.where).toHaveBeenCalledWith({
        id: userId,
        tenant_id: tenantId
      });
      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          password_hash: newPasswordHash,
          updated_at: expect.any(Date)
        })
      );
      expect(result).toBe(true);
    });
  });

  describe('findByRole', () => {
    it('should find users by role', async () => {
      // Arrange
      const adminUsers = [{ ...mockUser, role: 'admin' as const }];
      mockDb.orderBy.mockResolvedValue(adminUsers);

      // Act
      const result = await userRepository.findByRole('admin');

      // Assert
      expect(mockDb.where).toHaveBeenCalledWith({
        tenant_id: tenantId,
        role: 'admin',
        active: true
      });
      expect(result).toEqual(adminUsers);
    });
  });

  describe('countByRole', () => {
    it('should count users by role', async () => {
      // Arrange
      mockDb.first.mockResolvedValue({ count: '5' });

      // Act
      const result = await userRepository.countByRole('staff');

      // Assert
      expect(mockDb.where).toHaveBeenCalledWith({
        tenant_id: tenantId,
        role: 'staff',
        active: true
      });
      expect(result).toBe(5);
    });

    it('should return 0 if count is null', async () => {
      // Arrange
      mockDb.first.mockResolvedValue({ count: null });

      // Act
      const result = await userRepository.countByRole('staff');

      // Assert
      expect(result).toBe(0);
    });
  });
});