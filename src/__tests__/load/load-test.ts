import request from 'supertest';
import { app } from '../../index';
import { setupTestDatabase, cleanupTestDatabase, createTestTenant, createTestUser } from '../helpers/database';

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  requestsPerSecond: number;
  errors: string[];
}

class LoadTester {
  private results: LoadTestResult = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    maxResponseTime: 0,
    minResponseTime: Infinity,
    requestsPerSecond: 0,
    errors: []
  };

  private responseTimes: number[] = [];
  private startTime: number = 0;

  async runConcurrentRequests(
    requestFn: () => Promise<any>,
    concurrency: number,
    totalRequests: number
  ): Promise<LoadTestResult> {
    this.startTime = Date.now();
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < concurrency; i++) {
      promises.push(this.runRequestBatch(requestFn, Math.ceil(totalRequests / concurrency)));
    }

    await Promise.all(promises);
    
    const totalTime = (Date.now() - this.startTime) / 1000;
    this.results.requestsPerSecond = this.results.totalRequests / totalTime;
    this.results.averageResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    
    return this.results;
  }

  private async runRequestBatch(requestFn: () => Promise<any>, batchSize: number): Promise<void> {
    for (let i = 0; i < batchSize; i++) {
      const startTime = Date.now();
      
      try {
        await requestFn();
        const responseTime = Date.now() - startTime;
        
        this.results.successfulRequests++;
        this.responseTimes.push(responseTime);
        this.results.maxResponseTime = Math.max(this.results.maxResponseTime, responseTime);
        this.results.minResponseTime = Math.min(this.results.minResponseTime, responseTime);
      } catch (error) {
        this.results.failedRequests++;
        this.results.errors.push(error instanceof Error ? error.message : String(error));
      }
      
      this.results.totalRequests++;
    }
  }
}

describe('Load Testing', () => {
  let tenantId: string;
  let authToken: string;
  let staffId: string;
  let serviceId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    
    const tenant = await createTestTenant();
    tenantId = tenant.id;
    
    const user = await createTestUser(tenantId);
    
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: user.email,
        password: 'testpassword123'
      });
    
    authToken = loginResponse.body.token;

    // Create test staff and service
    const staffResponse = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Load Test Staff',
        role: 'Stylist'
      });
    staffId = staffResponse.body.id;

    const serviceResponse = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Load Test Service',
        duration_minutes: 60,
        price: 50.00
      });
    serviceId = serviceResponse.body.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Waitlist Creation Load Test', () => {
    it('should handle 100 concurrent waitlist creations', async () => {
      const loadTester = new LoadTester();
      let requestCounter = 0;

      const createWaitlistRequest = async () => {
        const uniquePhone = `+123456${String(requestCounter++).padStart(4, '0')}`;
        
        const response = await request(app)
          .post('/api/waitlist')
          .send({
            customer_name: `Load Test Customer ${requestCounter}`,
            phone: uniquePhone,
            email: `loadtest${requestCounter}@example.com`,
            service_id: serviceId,
            staff_id: staffId,
            earliest_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            latest_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
            consent: true
          });

        if (response.status !== 201) {
          throw new Error(`Expected 201, got ${response.status}: ${response.text}`);
        }
      };

      const results = await loadTester.runConcurrentRequests(
        createWaitlistRequest,
        10, // 10 concurrent users
        100 // 100 total requests
      );

      console.log('Waitlist Creation Load Test Results:', results);

      expect(results.successfulRequests).toBeGreaterThan(90); // 90% success rate
      expect(results.averageResponseTime).toBeLessThan(1000); // Under 1 second average
      expect(results.requestsPerSecond).toBeGreaterThan(10); // At least 10 RPS
    }, 30000);
  });

  describe('Slot Opening Load Test', () => {
    beforeEach(async () => {
      // Create multiple waitlist entries for testing
      for (let i = 0; i < 50; i++) {
        await request(app)
          .post('/api/waitlist')
          .send({
            customer_name: `Bulk Customer ${i}`,
            phone: `+12345${String(i).padStart(5, '0')}`,
            email: `bulk${i}@example.com`,
            service_id: serviceId,
            staff_id: staffId,
            earliest_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            latest_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
            consent: true
          });
      }
    });

    it('should handle 50 concurrent slot openings', async () => {
      const loadTester = new LoadTester();
      let slotCounter = 0;

      const openSlotRequest = async () => {
        // Create slot
        const slotTime = new Date(Date.now() + (2 + slotCounter) * 60 * 60 * 1000);
        const slotResponse = await request(app)
          .post('/api/slots')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            staff_id: staffId,
            service_id: serviceId,
            start_time: slotTime.toISOString(),
            end_time: new Date(slotTime.getTime() + 60 * 60 * 1000).toISOString()
          });

        if (slotResponse.status !== 201) {
          throw new Error(`Slot creation failed: ${slotResponse.status}`);
        }

        // Open slot (triggers matching)
        const openResponse = await request(app)
          .post(`/api/slots/${slotResponse.body.id}/open`)
          .set('Authorization', `Bearer ${authToken}`);

        if (openResponse.status !== 200) {
          throw new Error(`Slot opening failed: ${openResponse.status}`);
        }

        slotCounter++;
      };

      const results = await loadTester.runConcurrentRequests(
        openSlotRequest,
        5, // 5 concurrent slot openings
        50 // 50 total slots
      );

      console.log('Slot Opening Load Test Results:', results);

      expect(results.successfulRequests).toBeGreaterThan(45); // 90% success rate
      expect(results.averageResponseTime).toBeLessThan(2000); // Under 2 seconds (includes matching logic)
    }, 60000);
  });

  describe('API Endpoint Load Test', () => {
    it('should handle high read traffic on dashboard endpoints', async () => {
      const loadTester = new LoadTester();

      const dashboardRequest = async () => {
        const response = await request(app)
          .get('/api/dashboard')
          .set('Authorization', `Bearer ${authToken}`);

        if (response.status !== 200) {
          throw new Error(`Dashboard request failed: ${response.status}`);
        }
      };

      const results = await loadTester.runConcurrentRequests(
        dashboardRequest,
        20, // 20 concurrent users
        200 // 200 total requests
      );

      console.log('Dashboard Load Test Results:', results);

      expect(results.successfulRequests).toBeGreaterThan(190); // 95% success rate
      expect(results.averageResponseTime).toBeLessThan(500); // Under 500ms for read operations
      expect(results.requestsPerSecond).toBeGreaterThan(50); // At least 50 RPS for reads
    }, 30000);
  });

  describe('Memory and Resource Usage', () => {
    it('should not have memory leaks during sustained load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Run sustained load for 30 seconds
      const loadTester = new LoadTester();
      let requestCounter = 0;

      const sustainedRequest = async () => {
        const response = await request(app)
          .get('/api/waitlist')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ page: 1, limit: 10 });

        if (response.status !== 200) {
          throw new Error(`Request failed: ${response.status}`);
        }
        requestCounter++;
      };

      await loadTester.runConcurrentRequests(
        sustainedRequest,
        10, // 10 concurrent users
        300 // 300 total requests over 30 seconds
      );

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      console.log('Memory Usage:', {
        initial: Math.round(initialMemory.heapUsed / 1024 / 1024) + 'MB',
        final: Math.round(finalMemory.heapUsed / 1024 / 1024) + 'MB',
        increase: Math.round(memoryIncrease / 1024 / 1024) + 'MB',
        increasePercent: Math.round(memoryIncreasePercent) + '%'
      });

      // Memory increase should be reasonable (less than 50% increase)
      expect(memoryIncreasePercent).toBeLessThan(50);
    }, 45000);
  });
});

// Utility function to run load tests from command line
export async function runLoadTests() {
  console.log('Starting load tests...');
  
  // This would be called from a separate script
  // npm run test:load
}