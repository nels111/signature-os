import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import * as bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { checkRateLimit, RATE_LIMITS } from './rate-limit';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Throttle login attempts per email address. Limit (RATE_LIMITS.login)
        // is currently 10 per 15 minutes. Using the email (lower-cased) as the
        // key throttles credential stuffing without needing a reliable client IP.
        const emailKey = String(credentials.email).trim().toLowerCase();
        if (!emailKey) return null;
        const rate = checkRateLimit(`login:${emailKey}`, RATE_LIMITS.login);
        if (rate.limited) {
          // Returning null surfaces as "invalid credentials" to the client which
          // is the safer UX (don't disclose that rate limiting is in effect).
          return null;
        }

        const result = await pool.query(
          'SELECT id, name, email, password, role FROM users WHERE email = $1',
          [emailKey]
        );

        const user = result.rows[0];
        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as Record<string, unknown>).role as string;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
