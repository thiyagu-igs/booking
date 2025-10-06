import { getQueueHealth } from '../../config/queue';

// Mock Bull queues
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    getWaiting: jest.fn().mockResolvedValue([]),
    getActive: jest.fn().mockResolvedValue([]),
    getCompleted: jest.fn().mockResolvedValue([]),
    getFailed: jest.fn().mockResolvedValue([]),
    getDelayed: jest.fn().mockResolvedValue([]),
    isPaused: jest.fn().mockResolvedValue(false),
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  }));
});

describe('Queue Configuration', () => {
  describe('getQueueHealth', () => {
    it('should return health data for all queues', async () => {
      const health = await getQueueHealth();
      
      expect(health).toHaveLength(4);
      expect(health[0]).toHaveProperty('name');
      expect(health[0]).toHaveProperty('waiting');
      expect(health[0]).toHaveProperty('active');
      expect(health[0]).toHaveProperty('completed');
      expect(health[0]).toHaveProperty('failed');
      expect(health[0]).toHaveProperty('delayed');
      expect(health[0]).toHaveProperty('paused');
    });

    it('should include all expected queue names', async () => {
      const health = await getQueueHealth();
      const queueNames = health.map(q => q.name);
      
      expect(queueNames).toContain('expired-holds');
      expect(queueNames).toContain('notification-cascade');
      expect(queueNames).toContain('retry-notification');
      expect(queueNames).toContain('cleanup');
    });
  });
});