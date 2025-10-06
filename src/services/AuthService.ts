import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { UserRepository } from '../repositories/UserRepository';

export interface LoginCredentials {
  email: string;
  password: string;
  tenantId: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: 'admin' | 'staff' | 'manager';
  tenantId: string;
}

export interface TokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthResult {
  user: Omit<User, 'password_hash'>;
  token: string;
}

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;
  private readonly SALT_ROUNDS = 12;

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
    
    if (!process.env.JWT_SECRET) {
      console.warn('⚠️  JWT_SECRET not set in environment variables. Using default (not secure for production)');
    }
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResult> {
    const userRepository = new UserRepository(data.tenantId);
    
    // Check if user already exists
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(data.password);

    // Create user
    const userData = {
      email: data.email,
      password_hash: passwordHash,
      name: data.name,
      role: data.role || 'staff' as const,
      active: true
    };

    const user = await userRepository.create(userData);
    
    // Generate token
    const token = this.generateToken({
      userId: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      role: user.role
    });

    // Update last login
    await userRepository.updateLastLogin(user.id);

    return {
      user: this.sanitizeUser(user),
      token
    };
  }

  /**
   * Login user with credentials
   */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    const userRepository = new UserRepository(credentials.tenantId);
    
    // Find user by email
    const user = await userRepository.findByEmail(credentials.email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if user is active
    if (!user.active) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(credentials.password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate token
    const token = this.generateToken({
      userId: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      role: user.role
    });

    // Update last login
    await userRepository.updateLastLogin(user.id);

    return {
      user: this.sanitizeUser(user),
      token
    };
  }

  /**
   * Verify JWT token and return payload
   */
  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(token, this.JWT_SECRET) as TokenPayload;
      
      // Verify user still exists and is active
      const userRepository = new UserRepository(payload.tenantId);
      const user = await userRepository.findById(payload.userId);
      
      if (!user || !user.active) {
        throw new Error('User not found or inactive');
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      throw error;
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN as any
    });
  }

  /**
   * Hash password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verify password against hash
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Remove sensitive data from user object
   */
  private sanitizeUser(user: User): Omit<User, 'password_hash'> {
    const { password_hash, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  /**
   * Decode token without verification (for logging purposes only)
   */
  decodeTokenUnsafe(token: string): any {
    try {
      return jwt.decode(token);
    } catch {
      return null;
    }
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}