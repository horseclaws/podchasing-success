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

        let rows;
        try {
          rows = await sql`
            SELECT id, name, email, password_hash, hubspot_owner_id, must_change_password
            FROM users
            WHERE email = ${credentials.email as string}
          `;
        } catch (error) {
          console.error('Auth database error:', error);
          return null;
        }

        if (rows.length === 0) return null;
        const user = rows[0];

        if (!user.password_hash) return null;

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
        const appUser = user as AppUser;
        token.id = appUser.id;
        token.hubspot_owner_id = appUser.hubspot_owner_id;
        token.must_change_password = appUser.must_change_password;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.hubspot_owner_id = token.hubspot_owner_id;
      session.user.must_change_password = token.must_change_password;
      return session;
    },
  },
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
});
