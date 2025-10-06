import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { AuditService } from '../services/AuditService';

const execAsync = promisify(exec);

interface BackupConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  backupDir: string;
  retentionDays: number;
}

export class DatabaseBackupService {
  private config: BackupConfig;

  constructor() {
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'waitlist_management',
      backupDir: process.env.BACKUP_DIR || './backups',
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30')
    };
  }

  /**
   * Create a full database backup
   */
  async createBackup(): Promise<string> {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.config.backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `backup_${this.config.database}_${timestamp}.sql`;
      const backupPath = path.join(this.config.backupDir, backupFileName);

      // Create mysqldump command
      const dumpCommand = [
        'mysqldump',
        `--host=${this.config.host}`,
        `--port=${this.config.port}`,
        `--user=${this.config.user}`,
        `--password=${this.config.password}`,
        '--single-transaction',
        '--routines',
        '--triggers',
        '--events',
        '--add-drop-table',
        '--add-locks',
        '--create-options',
        '--disable-keys',
        '--extended-insert',
        '--quick',
        '--lock-tables=false',
        this.config.database
      ].join(' ');

      console.log(`Creating backup: ${backupFileName}`);
      
      // Execute backup
      const { stdout } = await execAsync(`${dumpCommand} > "${backupPath}"`);
      
      // Verify backup file was created and has content
      const stats = await fs.stat(backupPath);
      if (stats.size === 0) {
        throw new Error('Backup file is empty');
      }

      // Compress backup
      const compressedPath = `${backupPath}.gz`;
      await execAsync(`gzip "${backupPath}"`);

      console.log(`Backup created successfully: ${compressedPath}`);
      console.log(`Backup size: ${(await fs.stat(compressedPath)).size} bytes`);

      // Log backup creation
      await AuditService.logSystem(
        'BACKUP_CREATED',
        'database',
        this.config.database,
        {
          backupFile: compressedPath,
          size: (await fs.stat(compressedPath)).size,
          timestamp: new Date().toISOString()
        },
        'low'
      );

      return compressedPath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Backup failed:', errorMessage);

      // Log backup failure
      await AuditService.logSystem(
        'BACKUP_FAILED',
        'database',
        this.config.database,
        {
          error: errorMessage,
          timestamp: new Date().toISOString()
        },
        'high'
      );

      throw error;
    }
  }

  /**
   * Restore database from backup
   */
  async restoreBackup(backupPath: string): Promise<void> {
    try {
      console.log(`Restoring backup: ${backupPath}`);

      // Check if backup file exists
      await fs.access(backupPath);

      // Decompress if needed
      let sqlFile = backupPath;
      if (backupPath.endsWith('.gz')) {
        sqlFile = backupPath.replace('.gz', '');
        await execAsync(`gunzip -c "${backupPath}" > "${sqlFile}"`);
      }

      // Create restore command
      const restoreCommand = [
        'mysql',
        `--host=${this.config.host}`,
        `--port=${this.config.port}`,
        `--user=${this.config.user}`,
        `--password=${this.config.password}`,
        this.config.database
      ].join(' ');

      // Execute restore
      await execAsync(`${restoreCommand} < "${sqlFile}"`);

      // Clean up decompressed file if we created it
      if (backupPath.endsWith('.gz')) {
        await fs.unlink(sqlFile);
      }

      console.log('Database restored successfully');

      // Log restore
      await AuditService.logSystem(
        'BACKUP_RESTORED',
        'database',
        this.config.database,
        {
          backupFile: backupPath,
          timestamp: new Date().toISOString()
        },
        'medium'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Restore failed:', errorMessage);

      // Log restore failure
      await AuditService.logSystem(
        'BACKUP_RESTORE_FAILED',
        'database',
        this.config.database,
        {
          backupFile: backupPath,
          error: errorMessage,
          timestamp: new Date().toISOString()
        },
        'critical'
      );

      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<Array<{ file: string; size: number; created: Date }>> {
    try {
      const files = await fs.readdir(this.config.backupDir);
      const backupFiles = files.filter(file => 
        file.startsWith('backup_') && (file.endsWith('.sql') || file.endsWith('.sql.gz'))
      );

      const backups = await Promise.all(
        backupFiles.map(async (file) => {
          const filePath = path.join(this.config.backupDir, file);
          const stats = await fs.stat(filePath);
          return {
            file,
            size: stats.size,
            created: stats.birthtime
          };
        })
      );

      return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      const oldBackups = backups.filter(backup => backup.created < cutoffDate);

      for (const backup of oldBackups) {
        const filePath = path.join(this.config.backupDir, backup.file);
        await fs.unlink(filePath);
        console.log(`Deleted old backup: ${backup.file}`);
      }

      if (oldBackups.length > 0) {
        await AuditService.logSystem(
          'BACKUP_CLEANUP',
          'database',
          this.config.database,
          {
            deletedCount: oldBackups.length,
            retentionDays: this.config.retentionDays,
            timestamp: new Date().toISOString()
          },
          'low'
        );
      }
    } catch (error) {
      console.error('Backup cleanup failed:', error);
      
      await AuditService.logSystem(
        'BACKUP_CLEANUP_FAILED',
        'database',
        this.config.database,
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        },
        'medium'
      );
    }
  }

  /**
   * Schedule automatic backups
   */
  async scheduleBackups(): Promise<void> {
    const backupInterval = parseInt(process.env.BACKUP_INTERVAL_HOURS || '24') * 60 * 60 * 1000;

    const performBackup = async () => {
      try {
        await this.createBackup();
        await this.cleanupOldBackups();
      } catch (error) {
        console.error('Scheduled backup failed:', error);
      }
    };

    // Perform initial backup
    await performBackup();

    // Schedule recurring backups
    setInterval(performBackup, backupInterval);
    
    console.log(`Backup scheduled every ${backupInterval / (60 * 60 * 1000)} hours`);
  }
}

// CLI interface for manual backup operations
if (require.main === module) {
  const backupService = new DatabaseBackupService();
  const command = process.argv[2];

  switch (command) {
    case 'create':
      backupService.createBackup()
        .then(path => console.log(`Backup created: ${path}`))
        .catch(error => {
          console.error('Backup failed:', error);
          process.exit(1);
        });
      break;

    case 'restore':
      const backupPath = process.argv[3];
      if (!backupPath) {
        console.error('Usage: npm run backup restore <backup-file-path>');
        process.exit(1);
      }
      backupService.restoreBackup(backupPath)
        .then(() => console.log('Restore completed'))
        .catch(error => {
          console.error('Restore failed:', error);
          process.exit(1);
        });
      break;

    case 'list':
      backupService.listBackups()
        .then(backups => {
          console.log('Available backups:');
          backups.forEach(backup => {
            console.log(`  ${backup.file} (${backup.size} bytes, ${backup.created})`);
          });
        })
        .catch(error => {
          console.error('Failed to list backups:', error);
          process.exit(1);
        });
      break;

    case 'cleanup':
      backupService.cleanupOldBackups()
        .then(() => console.log('Cleanup completed'))
        .catch(error => {
          console.error('Cleanup failed:', error);
          process.exit(1);
        });
      break;

    default:
      console.log('Usage: npm run backup <create|restore|list|cleanup>');
      console.log('  create - Create a new backup');
      console.log('  restore <file> - Restore from backup file');
      console.log('  list - List available backups');
      console.log('  cleanup - Remove old backups');
      process.exit(1);
  }
}