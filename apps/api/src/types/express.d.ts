declare namespace Express {
  interface Request {
    user?: {
      id: string;
      email: string | null;
      role: string;
      profileComplete: boolean;
    };
  }
}
