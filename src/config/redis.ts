import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

export const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
};

// Check if Redis should be mocked
const MOCK_REDIS = process.env.MOCK_REDIS === 'true' || process.env.NODE_ENV === 'test';

// Mock Redis client for development/testing
const createMockRedisClient = () => {
  const mockStore = new Map<string, { value: string; expiry?: number }>();

  const mockClient = {
    connect: async () => {
      console.log('Mock Redis Client Connected');
    },
    disconnect: async () => {
      console.log('Mock Redis Client Disconnected');
    },
    get: async (key: string) => {
      const item = mockStore.get(key);
      if (!item) return null;
      if (item.expiry && Date.now() > item.expiry) {
        mockStore.delete(key);
        return null;
      }
      return item.value;
    },
    set: async (key: string, value: string, options?: any) => {
      const expiry = options?.EX ? Date.now() + (options.EX * 1000) : undefined;
      mockStore.set(key, { value, expiry });
      return 'OK';
    },
    incr: async (key: string) => {
      const current = await mockClient.get(key);
      const newValue = (parseInt(current || '0') + 1).toString();
      await mockClient.set(key, newValue);
      return parseInt(newValue);
    },
    expire: async (key: string, seconds: number) => {
      const item = mockStore.get(key);
      if (item) {
        item.expiry = Date.now() + (seconds * 1000);
        return 1;
      }
      return 0;
    },
    ttl: async (key: string) => {
      const item = mockStore.get(key);
      if (!item || !item.expiry) return -1;
      const remaining = Math.ceil((item.expiry - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    },
    lpush: async (key: string, value: string) => {
      // Simple mock - just store the latest value
      await mockClient.set(key, value);
      return 1;
    },
    ltrim: async (key: string, start: number, stop: number) => {
      return 'OK';
    },
    multi: () => ({
      incr: (key: string) => ({ expire: (key: string, seconds: number) => ({ exec: async () => [1, 1] }) }),
    }),
    on: (event: string, callback: Function) => {
      // Mock event handlers
      if (event === 'connect') {
        setTimeout(() => callback(), 0);
      }
    },
  };

  return mockClient;
};

// Create Redis client (real or mock)
export const redisClient = MOCK_REDIS ? createMockRedisClient() : createClient({
  url: redisConfig.url,
  socket: {
    host: redisConfig.host,
    port: redisConfig.port,
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  }
});

// Handle Redis connection events (only for real Redis)
if (!MOCK_REDIS) {
  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('Redis Client Connected');
  });

  redisClient.on('ready', () => {
    console.log('Redis Client Ready');
  });

  redisClient.on('end', () => {
    console.log('Redis Client Disconnected');
  });
}

// Connect to Redis
export const connectRedis = async (): Promise<void> => {
  try {
    if (MOCK_REDIS) {
      console.log('🔧 Using Mock Redis (MOCK_REDIS=true)');
      await redisClient.connect();
      return;
    }

    await redisClient.connect();
  } catch (error) {
    if (MOCK_REDIS) {
      console.warn('Mock Redis connection failed, continuing anyway');
      return;
    }
    console.error('Failed to connect to Redis:', error);
    throw error;
  }
};

// Disconnect from Redis
export const disconnectRedis = async (): Promise<void> => {
  try {
    await redisClient.disconnect();
  } catch (error) {
    if (MOCK_REDIS) {
      console.warn('Mock Redis disconnection failed, continuing anyway');
      return;
    }
    console.error('Failed to disconnect from Redis:', error);
    throw error;
  }
};

export default redisClient;