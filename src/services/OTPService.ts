import crypto from 'crypto';

export interface OTPData {
  phone: string;
  code: string;
  expires_at: Date;
  verified: boolean;
  attempts: number;
}

export interface OTPVerificationResult {
  success: boolean;
  message: string;
  remaining_attempts?: number;
}

export class OTPService {
  private otpStore: Map<string, OTPData> = new Map();
  private readonly OTP_LENGTH = 6;
  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly MAX_ATTEMPTS = 3;
  private readonly RATE_LIMIT_MINUTES = 1; // Minimum time between OTP requests

  /**
   * Generate and send OTP for phone verification
   */
  async generateOTP(phone: string): Promise<{ success: boolean; message: string; otp?: string }> {
    // Normalize phone number
    const normalizedPhone = this.normalizePhone(phone);
    
    // Check rate limiting
    const existingOTP = this.otpStore.get(normalizedPhone);
    if (existingOTP && !this.isExpired(existingOTP.expires_at)) {
      const timeSinceGenerated = Date.now() - (existingOTP.expires_at.getTime() - (this.OTP_EXPIRY_MINUTES * 60 * 1000));
      const rateLimitMs = this.RATE_LIMIT_MINUTES * 60 * 1000;
      
      if (timeSinceGenerated < rateLimitMs) {
        const remainingSeconds = Math.ceil((rateLimitMs - timeSinceGenerated) / 1000);
        return {
          success: false,
          message: `Please wait ${remainingSeconds} seconds before requesting another OTP`
        };
      }
    }

    // Generate 6-digit OTP
    const otp = this.generateRandomOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

    // Store OTP data
    this.otpStore.set(normalizedPhone, {
      phone: normalizedPhone,
      code: otp,
      expires_at: expiresAt,
      verified: false,
      attempts: 0
    });

    // In a real implementation, you would send the OTP via SMS
    // For now, we'll return it for testing purposes
    console.log(`OTP for ${normalizedPhone}: ${otp} (expires at ${expiresAt})`);

    return {
      success: true,
      message: 'OTP sent successfully',
      otp: process.env.NODE_ENV === 'test' ? otp : undefined // Only return OTP in test environment
    };
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(phone: string, code: string): Promise<OTPVerificationResult> {
    const normalizedPhone = this.normalizePhone(phone);
    const otpData = this.otpStore.get(normalizedPhone);

    if (!otpData) {
      return {
        success: false,
        message: 'No OTP found for this phone number. Please request a new OTP.'
      };
    }

    // Check if already verified
    if (otpData.verified) {
      return {
        success: false,
        message: 'OTP already verified. Please request a new OTP if needed.'
      };
    }

    // Check if expired
    if (this.isExpired(otpData.expires_at)) {
      this.otpStore.delete(normalizedPhone);
      return {
        success: false,
        message: 'OTP has expired. Please request a new OTP.'
      };
    }

    // Check attempts limit
    if (otpData.attempts >= this.MAX_ATTEMPTS) {
      this.otpStore.delete(normalizedPhone);
      return {
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new OTP.'
      };
    }

    // Increment attempts
    otpData.attempts++;

    // Verify code
    if (otpData.code !== code) {
      const remainingAttempts = this.MAX_ATTEMPTS - otpData.attempts;
      
      if (remainingAttempts === 0) {
        this.otpStore.delete(normalizedPhone);
        return {
          success: false,
          message: 'Invalid OTP. Maximum attempts exceeded. Please request a new OTP.'
        };
      }

      return {
        success: false,
        message: 'Invalid OTP code.',
        remaining_attempts: remainingAttempts
      };
    }

    // Mark as verified
    otpData.verified = true;

    return {
      success: true,
      message: 'Phone number verified successfully'
    };
  }

  /**
   * Check if phone number is verified
   */
  async isPhoneVerified(phone: string): Promise<boolean> {
    const normalizedPhone = this.normalizePhone(phone);
    const otpData = this.otpStore.get(normalizedPhone);
    
    return otpData?.verified === true && !this.isExpired(otpData.expires_at);
  }

  /**
   * Clean up expired OTPs
   */
  async cleanupExpiredOTPs(): Promise<number> {
    let cleanedCount = 0;
    
    for (const [phone, otpData] of this.otpStore.entries()) {
      if (this.isExpired(otpData.expires_at)) {
        this.otpStore.delete(phone);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  /**
   * Get OTP status for testing purposes
   */
  async getOTPStatus(phone: string): Promise<{
    exists: boolean;
    verified?: boolean;
    expired?: boolean;
    attempts?: number;
    remaining_attempts?: number;
  }> {
    const normalizedPhone = this.normalizePhone(phone);
    const otpData = this.otpStore.get(normalizedPhone);

    if (!otpData) {
      return { exists: false };
    }

    return {
      exists: true,
      verified: otpData.verified,
      expired: this.isExpired(otpData.expires_at),
      attempts: otpData.attempts,
      remaining_attempts: Math.max(0, this.MAX_ATTEMPTS - otpData.attempts)
    };
  }

  /**
   * Clear OTP data for a phone number (for testing)
   */
  async clearOTP(phone: string): Promise<void> {
    const normalizedPhone = this.normalizePhone(phone);
    this.otpStore.delete(normalizedPhone);
  }

  /**
   * Clear all OTP data (for testing)
   */
  async clearAllOTPs(): Promise<void> {
    this.otpStore.clear();
  }

  /**
   * Generate random 6-digit OTP
   */
  private generateRandomOTP(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Normalize phone number format
   */
  private normalizePhone(phone: string): string {
    // Remove all non-digit characters except +
    let normalized = phone.replace(/[^\d+]/g, '');
    
    // If it doesn't start with +, assume it's a US number and add +1
    if (!normalized.startsWith('+')) {
      if (normalized.length === 10) {
        normalized = '+1' + normalized;
      } else if (normalized.length === 11 && normalized.startsWith('1')) {
        normalized = '+' + normalized;
      }
    }
    
    return normalized;
  }

  /**
   * Check if a date is expired
   */
  private isExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }
}