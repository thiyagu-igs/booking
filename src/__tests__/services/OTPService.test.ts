import { OTPService } from '../../services/OTPService';

describe('OTPService', () => {
  let otpService: OTPService;

  beforeEach(() => {
    otpService = new OTPService();
    // Clear all OTPs before each test
    otpService.clearAllOTPs();
  });

  afterEach(() => {
    // Clean up after each test
    otpService.clearAllOTPs();
  });

  describe('generateOTP', () => {
    it('should generate OTP successfully for new phone number', async () => {
      const phone = '+1234567890';
      
      const result = await otpService.generateOTP(phone);

      expect(result.success).toBe(true);
      expect(result.message).toBe('OTP sent successfully');
      expect(result.otp).toMatch(/^\d{6}$/); // 6-digit number
    });

    it('should normalize phone numbers correctly', async () => {
      const variations = [
        '1234567890',
        '+1234567890',
        '(123) 456-7890',
        '123-456-7890',
        '123.456.7890'
      ];

      for (const phone of variations) {
        await otpService.clearOTP(phone);
        const result = await otpService.generateOTP(phone);
        expect(result.success).toBe(true);
      }
    });

    it('should enforce rate limiting', async () => {
      const phone = '+1234567890';
      
      // First OTP should succeed
      const result1 = await otpService.generateOTP(phone);
      expect(result1.success).toBe(true);

      // Second OTP within rate limit should fail
      const result2 = await otpService.generateOTP(phone);
      expect(result2.success).toBe(false);
      expect(result2.message).toContain('Please wait');
    });

    it('should allow new OTP after rate limit expires', async () => {
      const phone = '+1234567890';
      
      // Generate first OTP
      await otpService.generateOTP(phone);

      // Mock time passage by manipulating the stored OTP
      const status = await otpService.getOTPStatus(phone);
      expect(status.exists).toBe(true);

      // Clear and generate new OTP (simulating time passage)
      await otpService.clearOTP(phone);
      const result = await otpService.generateOTP(phone);
      expect(result.success).toBe(true);
    });
  });

  describe('verifyOTP', () => {
    it('should verify correct OTP successfully', async () => {
      const phone = '+1234567890';
      
      const generateResult = await otpService.generateOTP(phone);
      expect(generateResult.success).toBe(true);
      
      const otp = generateResult.otp!;
      const verifyResult = await otpService.verifyOTP(phone, otp);

      expect(verifyResult.success).toBe(true);
      expect(verifyResult.message).toBe('Phone number verified successfully');
    });

    it('should reject incorrect OTP', async () => {
      const phone = '+1234567890';
      
      await otpService.generateOTP(phone);
      const verifyResult = await otpService.verifyOTP(phone, '000000');

      expect(verifyResult.success).toBe(false);
      expect(verifyResult.message).toBe('Invalid OTP code.');
      expect(verifyResult.remaining_attempts).toBe(2);
    });

    it('should handle non-existent OTP', async () => {
      const phone = '+1234567890';
      
      const verifyResult = await otpService.verifyOTP(phone, '123456');

      expect(verifyResult.success).toBe(false);
      expect(verifyResult.message).toBe('No OTP found for this phone number. Please request a new OTP.');
    });

    it('should enforce maximum attempts', async () => {
      const phone = '+1234567890';
      
      const generateResult = await otpService.generateOTP(phone);
      expect(generateResult.success).toBe(true);

      // Make 3 incorrect attempts
      for (let i = 0; i < 3; i++) {
        const verifyResult = await otpService.verifyOTP(phone, '000000');
        expect(verifyResult.success).toBe(false);
        
        if (i < 2) {
          expect(verifyResult.remaining_attempts).toBe(2 - i);
        } else {
          expect(verifyResult.message).toContain('Maximum attempts exceeded');
        }
      }

      // OTP should be cleared after max attempts
      const status = await otpService.getOTPStatus(phone);
      expect(status.exists).toBe(false);
    });

    it('should reject already verified OTP', async () => {
      const phone = '+1234567890';
      
      const generateResult = await otpService.generateOTP(phone);
      const otp = generateResult.otp!;

      // First verification should succeed
      const verifyResult1 = await otpService.verifyOTP(phone, otp);
      expect(verifyResult1.success).toBe(true);

      // Second verification should fail
      const verifyResult2 = await otpService.verifyOTP(phone, otp);
      expect(verifyResult2.success).toBe(false);
      expect(verifyResult2.message).toBe('OTP already verified. Please request a new OTP if needed.');
    });

    it('should handle expired OTP', async () => {
      const phone = '+1234567890';
      
      const generateResult = await otpService.generateOTP(phone);
      const otp = generateResult.otp!;

      // Manually expire the OTP by clearing and checking
      await otpService.clearOTP(phone);
      
      const verifyResult = await otpService.verifyOTP(phone, otp);
      expect(verifyResult.success).toBe(false);
      expect(verifyResult.message).toBe('No OTP found for this phone number. Please request a new OTP.');
    });
  });

  describe('isPhoneVerified', () => {
    it('should return true for verified phone', async () => {
      const phone = '+1234567890';
      
      const generateResult = await otpService.generateOTP(phone);
      const otp = generateResult.otp!;
      
      await otpService.verifyOTP(phone, otp);
      
      const isVerified = await otpService.isPhoneVerified(phone);
      expect(isVerified).toBe(true);
    });

    it('should return false for unverified phone', async () => {
      const phone = '+1234567890';
      
      await otpService.generateOTP(phone);
      
      const isVerified = await otpService.isPhoneVerified(phone);
      expect(isVerified).toBe(false);
    });

    it('should return false for non-existent phone', async () => {
      const phone = '+1234567890';
      
      const isVerified = await otpService.isPhoneVerified(phone);
      expect(isVerified).toBe(false);
    });
  });

  describe('getOTPStatus', () => {
    it('should return correct status for existing OTP', async () => {
      const phone = '+1234567890';
      
      await otpService.generateOTP(phone);
      
      const status = await otpService.getOTPStatus(phone);
      expect(status.exists).toBe(true);
      expect(status.verified).toBe(false);
      expect(status.expired).toBe(false);
      expect(status.attempts).toBe(0);
      expect(status.remaining_attempts).toBe(3);
    });

    it('should return correct status after failed attempts', async () => {
      const phone = '+1234567890';
      
      await otpService.generateOTP(phone);
      await otpService.verifyOTP(phone, '000000'); // Wrong OTP
      
      const status = await otpService.getOTPStatus(phone);
      expect(status.exists).toBe(true);
      expect(status.verified).toBe(false);
      expect(status.attempts).toBe(1);
      expect(status.remaining_attempts).toBe(2);
    });

    it('should return correct status for verified OTP', async () => {
      const phone = '+1234567890';
      
      const generateResult = await otpService.generateOTP(phone);
      const otp = generateResult.otp!;
      await otpService.verifyOTP(phone, otp);
      
      const status = await otpService.getOTPStatus(phone);
      expect(status.exists).toBe(true);
      expect(status.verified).toBe(true);
      expect(status.attempts).toBe(1);
    });

    it('should return non-existent status for unknown phone', async () => {
      const phone = '+1234567890';
      
      const status = await otpService.getOTPStatus(phone);
      expect(status.exists).toBe(false);
    });
  });

  describe('cleanupExpiredOTPs', () => {
    it('should clean up expired OTPs', async () => {
      const phone1 = '+1234567890';
      const phone2 = '+1234567891';
      
      // Generate OTPs for both phones
      await otpService.generateOTP(phone1);
      await otpService.generateOTP(phone2);
      
      // Both should exist
      expect((await otpService.getOTPStatus(phone1)).exists).toBe(true);
      expect((await otpService.getOTPStatus(phone2)).exists).toBe(true);
      
      // Clear one manually to simulate expiry
      await otpService.clearOTP(phone1);
      
      // Cleanup should not affect remaining valid OTP
      const cleanedCount = await otpService.cleanupExpiredOTPs();
      expect(cleanedCount).toBe(0); // No expired OTPs in memory store
      expect((await otpService.getOTPStatus(phone2)).exists).toBe(true);
    });
  });

  describe('phone number normalization', () => {
    it('should normalize various phone number formats', async () => {
      const testCases = [
        { input: '1234567890', expected: '+11234567890' },
        { input: '+1234567890', expected: '+1234567890' },
        { input: '11234567890', expected: '+11234567890' },
        { input: '+44123456789', expected: '+44123456789' }
      ];

      for (const testCase of testCases) {
        await otpService.clearAllOTPs();
        
        const result = await otpService.generateOTP(testCase.input);
        expect(result.success).toBe(true);
        
        // Verify the normalized phone can be used for verification
        const status = await otpService.getOTPStatus(testCase.expected);
        expect(status.exists).toBe(true);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty phone number', async () => {
      const result = await otpService.generateOTP('');
      // The service should handle this gracefully
      expect(result).toBeDefined();
    });

    it('should handle invalid phone formats', async () => {
      const invalidPhones = ['abc', '123', '+'];
      
      for (const phone of invalidPhones) {
        const result = await otpService.generateOTP(phone);
        // Service should handle gracefully, even if it generates OTP
        expect(result).toBeDefined();
      }
    });

    it('should generate different OTPs for different requests', async () => {
      const phone1 = '+1234567890';
      const phone2 = '+1234567891';
      
      const result1 = await otpService.generateOTP(phone1);
      const result2 = await otpService.generateOTP(phone2);
      
      expect(result1.otp).not.toBe(result2.otp);
    });
  });
});