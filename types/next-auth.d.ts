import 'next-auth';

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
