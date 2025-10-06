import { AuthService } from '../../services/AuthService';
import { UserRepository } from '../../repositories/UserRepository';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../repositories/UserRepository');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

const MockedUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('AuthService', () => {
    let authService: AuthService;
    let mockUserRepository: jest.Mocked<UserRepository>;

    const mockUser = {
        id: 'user-123',
        tenant_id: 'tenant-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        name: 'Test User',
        role: 'staff' as const,
        active: true,
        created_at: new Date(),
        updated_at: new Date()
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup environment variables
        process.env.JWT_SECRET = 'test-secret';
        process.env.JWT_EXPIRES_IN = '24h';

        authService = new AuthService();

        // Create mock repository instance
        mockUserRepository = {
            findByEmail: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            updateLastLogin: jest.fn(),
        } as any;

        MockedUserRepository.mockImplementation(() => mockUserRepository);
    });

    afterEach(() => {
        delete process.env.JWT_SECRET;
        delete process.env.JWT_EXPIRES_IN;
    });

    describe('register', () => {
        const registerData = {
            email: 'test@example.com',
            password: 'Password123!',
            name: 'Test User',
            role: 'staff' as const,
            tenantId: 'tenant-123'
        };

        it('should successfully register a new user', async () => {
            // Arrange
            mockUserRepository.findByEmail.mockResolvedValue(null);
            (mockedBcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
            mockUserRepository.create.mockResolvedValue(mockUser);
            mockUserRepository.updateLastLogin.mockResolvedValue();
            (mockedJwt.sign as jest.Mock).mockReturnValue('jwt-token');

            // Act
            const result = await authService.register(registerData);

            // Assert
            expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
            expect(mockedBcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
            expect(mockUserRepository.create).toHaveBeenCalledWith({
                email: 'test@example.com',
                password_hash: 'hashed-password',
                name: 'Test User',
                role: 'staff',
                active: true
            });
            expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith('user-123');
            expect(result.user).toEqual({
                id: 'user-123',
                tenant_id: 'tenant-123',
                email: 'test@example.com',
                name: 'Test User',
                role: 'staff',
                active: true,
                created_at: mockUser.created_at,
                updated_at: mockUser.updated_at
            });
            expect(result.token).toBe('jwt-token');
        });

        it('should throw error if user already exists', async () => {
            // Arrange
            mockUserRepository.findByEmail.mockResolvedValue(mockUser);

            // Act & Assert
            await expect(authService.register(registerData)).rejects.toThrow('User with this email already exists');
            expect(mockUserRepository.create).not.toHaveBeenCalled();
        });
    });

    describe('login', () => {
        const loginCredentials = {
            email: 'test@example.com',
            password: 'Password123!',
            tenantId: 'tenant-123'
        };

        it('should successfully login with valid credentials', async () => {
            // Arrange
            mockUserRepository.findByEmail.mockResolvedValue(mockUser);
            (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
            mockUserRepository.updateLastLogin.mockResolvedValue();
            (mockedJwt.sign as jest.Mock).mockReturnValue('jwt-token');

            // Act
            const result = await authService.login(loginCredentials);

            // Assert
            expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
            expect(mockedBcrypt.compare).toHaveBeenCalledWith('Password123!', 'hashed-password');
            expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith('user-123');
            expect(result.user).toEqual({
                id: 'user-123',
                tenant_id: 'tenant-123',
                email: 'test@example.com',
                name: 'Test User',
                role: 'staff',
                active: true,
                created_at: mockUser.created_at,
                updated_at: mockUser.updated_at
            });
            expect(result.token).toBe('jwt-token');
        });

        it('should throw error if user not found', async () => {
            // Arrange
            mockUserRepository.findByEmail.mockResolvedValue(null);

            // Act & Assert
            await expect(authService.login(loginCredentials)).rejects.toThrow('Invalid credentials');
            expect(mockedBcrypt.compare).not.toHaveBeenCalled();
        });

        it('should throw error if user is inactive', async () => {
            // Arrange
            const inactiveUser = { ...mockUser, active: false };
            mockUserRepository.findByEmail.mockResolvedValue(inactiveUser);

            // Act & Assert
            await expect(authService.login(loginCredentials)).rejects.toThrow('Account is deactivated');
            expect(mockedBcrypt.compare).not.toHaveBeenCalled();
        });

        it('should throw error if password is invalid', async () => {
            // Arrange
            mockUserRepository.findByEmail.mockResolvedValue(mockUser);
            (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

            // Act & Assert
            await expect(authService.login(loginCredentials)).rejects.toThrow('Invalid credentials');
            expect(mockUserRepository.updateLastLogin).not.toHaveBeenCalled();
        });
    });

    describe('verifyToken', () => {
        const tokenPayload = {
            userId: 'user-123',
            tenantId: 'tenant-123',
            email: 'test@example.com',
            role: 'staff'
        };

        it('should successfully verify valid token', async () => {
            // Arrange
            (mockedJwt.verify as jest.Mock).mockReturnValue(tokenPayload as any);
            mockUserRepository.findById.mockResolvedValue(mockUser);

            // Act
            const result = await authService.verifyToken('valid-token');

            // Assert
            expect(mockedJwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
            expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
            expect(result).toEqual(tokenPayload);
        });

        it('should throw error if token is invalid', async () => {
            // Arrange
            (mockedJwt.verify as jest.Mock).mockImplementation(() => {
                throw new jwt.JsonWebTokenError('Invalid token');
            });

            // Act & Assert
            await expect(authService.verifyToken('invalid-token')).rejects.toThrow('Invalid token');
        });

        it('should throw error if token is expired', async () => {
            // Arrange
            (mockedJwt.verify as jest.Mock).mockImplementation(() => {
                throw new jwt.TokenExpiredError('Token expired', new Date());
            });

            // Act & Assert
            await expect(authService.verifyToken('expired-token')).rejects.toThrow('Token expired');
        });

        it('should throw error if user not found', async () => {
            // Arrange
            (mockedJwt.verify as jest.Mock).mockReturnValue(tokenPayload as any);
            mockUserRepository.findById.mockResolvedValue(null);

            // Act & Assert
            await expect(authService.verifyToken('valid-token')).rejects.toThrow('User not found or inactive');
        });

        it('should throw error if user is inactive', async () => {
            // Arrange
            const inactiveUser = { ...mockUser, active: false };
            (mockedJwt.verify as jest.Mock).mockReturnValue(tokenPayload as any);
            mockUserRepository.findById.mockResolvedValue(inactiveUser);

            // Act & Assert
            await expect(authService.verifyToken('valid-token')).rejects.toThrow('User not found or inactive');
        });
    });

    describe('validatePassword', () => {
        it('should validate strong password', () => {
            const result = authService.validatePassword('StrongPass123!');
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject password that is too short', () => {
            const result = authService.validatePassword('Short1!');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must be at least 8 characters long');
        });

        it('should reject password without uppercase letter', () => {
            const result = authService.validatePassword('lowercase123!');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one uppercase letter');
        });

        it('should reject password without lowercase letter', () => {
            const result = authService.validatePassword('UPPERCASE123!');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one lowercase letter');
        });

        it('should reject password without number', () => {
            const result = authService.validatePassword('NoNumbers!');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one number');
        });

        it('should reject password without special character', () => {
            const result = authService.validatePassword('NoSpecial123');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one special character');
        });

        it('should return multiple errors for weak password', () => {
            const result = authService.validatePassword('weak');
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(1);
        });
    });
});