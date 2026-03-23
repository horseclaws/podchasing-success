import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  hubspot_owner_id: string;
  must_change_password: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const rows = await sql`
          SELECT id, name, email, password_hash, hubspot_owner_id, must_change_password
          FROM users
          WHERE email = ${credentials.email as string}
        `;

        if (rows.length === 0) return null;
        const user = rows[0];

        const valid = await verifyPassword(credentials.password as string, user.password_hash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          hubspot_owner_id: user.hubspot_owner_id,
          must_change_password: user.must_change_password,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.hubspot_owner_id = (user as AppUser).hubspot_owner_id;
        token.must_change_password = (user as AppUser).must_change_password;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as AppUser & { id: string }).hubspot_owner_id = token.hubspot_owner_id as string;
        (session.user as AppUser & { id: string }).must_change_password = token.must_change_password as boolean;
      }
      return session;
    },
  },
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
});
