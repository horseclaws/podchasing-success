import 'next-auth';
import type { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      hubspot_owner_id: string;
      must_change_password: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    hubspot_owner_id: string;
    must_change_password: boolean;
  }
}
