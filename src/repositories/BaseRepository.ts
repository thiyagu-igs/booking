import { Knex } from 'knex';
import db from '../database/connection';

/**
 * Base repository class that provides tenant-scoped database operations
 * All queries automatically include tenant_id filtering for data isolation
 */
export abstract class BaseRepository<T = any> {
  protected db: Knex;
  protected tenantId: string;
  protected abstract tableName: string;

  constructor(tenantId: string) {
    this.db = db;
    this.tenantId = tenantId;
  }

  /**
   * Find all records for the current tenant with optional conditions
   */
  async findAll(conditions: Partial<T> = {}): Promise<T[]> {
    return this.db
      .select('*')
      .from(this.tableName)
      .where({ tenant_id: this.tenantId, ...conditions });
  }

  /**
   * Find a single record by ID for the current tenant
   */
  async findById(id: string): Promise<T | null> {
    const result = await this.db
      .select('*')
      .from(this.tableName)
      .where({ id, tenant_id: this.tenantId })
      .first();
    
    return result || null;
  }

  /**
   * Find a single record with conditions for the current tenant
   */
  async findOne(conditions: Partial<T>): Promise<T | null> {
    const result = await this.db
      .select('*')
      .from(this.tableName)
      .where({ tenant_id: this.tenantId, ...conditions })
      .first();
    
    return result || null;
  }

  /**
   * Create a new record for the current tenant
   */
  async create(data: Omit<T, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<T> {
    const [result] = await this.db
      .insert({ ...data, tenant_id: this.tenantId })
      .into(this.tableName);
    
    // MySQL returns insertId, we need to get the UUID that was generated
    const inserted = await this.db
      .select('*')
      .from(this.tableName)
      .where({ tenant_id: this.tenantId })
      .orderBy('created_at', 'desc')
      .first();
    
    return inserted as T;
  }

  /**
   * Update a record by ID for the current tenant
   */
  async update(id: string, data: Partial<Omit<T, 'id' | 'tenant_id' | 'created_at'>>): Promise<T | null> {
    const updated = await this.db(this.tableName)
      .where({ id, tenant_id: this.tenantId })
      .update({ ...data, updated_at: new Date() });
    
    if (updated === 0) {
      return null;
    }
    
    return this.findById(id);
  }

  /**
   * Delete a record by ID for the current tenant
   */
  async delete(id: string): Promise<boolean> {
    const deleted = await this.db(this.tableName)
      .where({ id, tenant_id: this.tenantId })
      .del();
    
    return deleted > 0;
  }

  /**
   * Count records for the current tenant with optional conditions
   */
  async count(conditions: Partial<T> = {}): Promise<number> {
    const result = await this.db(this.tableName)
      .where({ tenant_id: this.tenantId, ...conditions })
      .count('* as count')
      .first();
    
    return parseInt(result?.count as string) || 0;
  }

  /**
   * Check if a record exists for the current tenant
   */
  async exists(conditions: Partial<T>): Promise<boolean> {
    const count = await this.count(conditions);
    return count > 0;
  }

  /**
   * Execute a raw query with tenant_id automatically included
   * Use with caution - ensure tenant isolation is maintained
   */
  protected async rawQuery(query: string, bindings: any[] = []): Promise<any> {
    return this.db.raw(query, [...bindings, this.tenantId]);
  }

  /**
   * Start a database transaction
   */
  async transaction<R>(callback: (trx: Knex.Transaction) => Promise<R>): Promise<R> {
    return this.db.transaction(callback);
  }
}