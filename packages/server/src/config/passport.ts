import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

passport.serializeUser((user: any, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    callbackURL: process.env.CallbackURL || "http://localhost:3001/auth/github/callback"
},
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
        try {
            const email = profile.emails?.[0]?.value;

            let user = await prisma.user.findUnique({
                where: { username: profile.username }
            });

            if (!user) {
                user = await prisma.user.create({
                    data: {
                        username: profile.username,
                        email: email || `${profile.username}@github.com`,
                        avatarUrl: profile.photos?.[0]?.value,
                    }
                });
            }

            return done(null, user);
        } catch (error) {
            return done(error, null);
        }
    }
));

export default passport;
