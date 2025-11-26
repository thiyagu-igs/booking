import { TokenPayload } from '../services/AuthService';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      tenantId?: string;
      requestId?: string;
      db?: any;
      session?: {
        csrfToken?: string;
      };
    }
  }
}

export {};
