import { Router } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';

const router = Router();

router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get('/github/callback',
    passport.authenticate('github', { failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication, create JWT
        const user = req.user as any;
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        // Redirect to frontend with token
        res.redirect(`http://localhost:5173/auth/callback?token=${token}`);
    }
);

router.post('/guest', (req, res) => {
    const guestId = 'guest-' + Math.random().toString(36).substring(7);
    const token = jwt.sign(
        { id: guestId, username: `Guest_${guestId.substring(6)}` },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '7d' }
    );
    res.json({ token, user: { id: guestId, username: `Guest_${guestId.substring(6)}` } });
});

router.get('/me', (req, res) => {
    // verify token from header and return user
    // To be implemented properly with middleware
    res.json({ user: req.user });
});

export default router;
