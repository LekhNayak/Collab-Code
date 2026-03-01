import React from 'react';
import { motion } from 'framer-motion';

interface BrutalCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    hoverable?: boolean;
    delay?: number;
}

export default function BrutalCard({ children, className = '', onClick, hoverable = false, delay = 0 }: BrutalCardProps) {
    return (
        <motion.div
            className={`bg-neo-surface border-4 border-neo-border p-6 md:p-8 ${hoverable ? 'cursor-pointer' : ''} ${className}`}
            style={{ boxShadow: '8px 8px 0px 0px var(--neo-shadow)' }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.35,
                delay: delay * 0.1,
                ease: [0.34, 1.56, 0.64, 1],
            }}
            whileHover={hoverable ? {
                x: -6,
                y: -6,
                boxShadow: '14px 14px 0px 0px var(--neo-shadow)',
                transition: { duration: 0.2, ease: [0.34, 1.56, 0.64, 1] },
            } : {}}
            whileTap={hoverable ? {
                x: 4,
                y: 4,
                boxShadow: '4px 4px 0px 0px var(--neo-shadow)',
                transition: { duration: 0.1 },
            } : {}}
            onClick={onClick}
        >
            {children}
        </motion.div>
    );
}
