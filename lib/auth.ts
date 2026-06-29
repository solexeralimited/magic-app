import { NextAuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export type UserRole = 'admin' | 'driver';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email?: string | null;
      role: UserRole;
    };
  }
  interface User {
    id: string;
    name: string;
    email?: string | null;
    role: UserRole;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    name: string;
    role: UserRole;
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 }, // 12 hours
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      id: 'admin-login',
      name: 'Admin',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const admin = await prisma.adminUser.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!admin) return null;
        const valid = await bcrypt.compare(credentials.password, admin.password);
        if (!valid) return null;
        return { id: admin.id, name: admin.name, email: admin.email, role: 'admin' };
      },
    }),
    CredentialsProvider({
      id: 'driver-login',
      name: 'Driver',
      credentials: {
        name: { label: 'Driver Name', type: 'text' },
        pin: { label: 'PIN', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.name || !credentials?.pin) return null;
        const driver = await prisma.driver.findUnique({
          where: { name: credentials.name },
        });
        if (!driver || !driver.isActive || !driver.pin) return null;
        const valid = await bcrypt.compare(credentials.pin, driver.pin);
        if (!valid) return null;
        return { id: driver.id, name: driver.name, email: driver.email, role: 'driver' };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        name: token.name,
        email: token.email,
        role: token.role,
      };
      return session;
    },
  },
};

export const getSession = () => getServerSession(authOptions);

export async function requireAuth(role?: UserRole) {
  const session = await getSession();
  if (!session) return null;
  if (role && session.user.role !== role) return null;
  return session;
}
