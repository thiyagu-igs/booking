import { BaseRepository } from './BaseRepository';
import { User } from '../models';

export class UserRepository extends BaseRepository<User> {
  protected tableName = 'users';

  /**
   * Find user by email within the current tenant
   */
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db
      .select('*')
      .from(this.tableName)
      .where({ 
        tenant_id: this.tenantId, 
        email: email.toLowerCase() 
      })
      .first();
    
    return result || null;
  }

  /**
   * Create a new user with email normalization
   */
  async create(data: Omit<User, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<User> {
    const userData = {
      ...data,
      email: data.email.toLowerCase() // Normalize email to lowercase
    };

    return super.create(userData);
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.db(this.tableName)
      .where({ 
        id: userId, 
        tenant_id: this.tenantId 
      })
      .update({ 
        last_login_at: new Date(),
        updated_at: new Date()
      });
  }

  /**
   * Find all active users for the current tenant
   */
  async findActiveUsers(): Promise<User[]> {
    return this.db
      .select('*')
      .from(this.tableName)
      .where({ 
        tenant_id: this.tenantId, 
        active: true 
      })
      .orderBy('name', 'asc');
  }

  /**
   * Deactivate a user (soft delete)
   */
  async deactivate(userId: string): Promise<boolean> {
    const updated = await this.db(this.tableName)
      .where({ 
        id: userId, 
        tenant_id: this.tenantId 
      })
      .update({ 
        active: false,
        updated_at: new Date()
      });
    
    return updated > 0;
  }

  /**
   * Reactivate a user
   */
  async reactivate(userId: string): Promise<boolean> {
    const updated = await this.db(this.tableName)
      .where({ 
        id: userId, 
        tenant_id: this.tenantId 
      })
      .update({ 
        active: true,
        updated_at: new Date()
      });
    
    return updated > 0;
  }

  /**
   * Update user role
   */
  async updateRole(userId: string, role: 'admin' | 'staff' | 'manager'): Promise<User | null> {
    const updated = await this.db(this.tableName)
      .where({ 
        id: userId, 
        tenant_id: this.tenantId 
      })
      .update({ 
        role,
        updated_at: new Date()
      });
    
    if (updated === 0) {
      return null;
    }
    
    return this.findById(userId);
  }

  /**
   * Change user password
   */
  async updatePassword(userId: string, passwordHash: string): Promise<boolean> {
    const updated = await this.db(this.tableName)
      .where({ 
        id: userId, 
        tenant_id: this.tenantId 
      })
      .update({ 
        password_hash: passwordHash,
        updated_at: new Date()
      });
    
    return updated > 0;
  }

  /**
   * Get users by role
   */
  async findByRole(role: 'admin' | 'staff' | 'manager'): Promise<User[]> {
    return this.db
      .select('*')
      .from(this.tableName)
      .where({ 
        tenant_id: this.tenantId, 
        role,
        active: true 
      })
      .orderBy('name', 'asc');
  }

  /**
   * Count users by role
   */
  async countByRole(role: 'admin' | 'staff' | 'manager'): Promise<number> {
    const result = await this.db(this.tableName)
      .where({ 
        tenant_id: this.tenantId, 
        role,
        active: true 
      })
      .count('* as count')
      .first();
    
    return parseInt(result?.count as string) || 0;
  }
}