import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '../../contest/contest.css';

// Renders organizer-written markdown (statements, descriptions). Raw HTML is not rendered.
export default function Markdown({ children, className = '' }: { children: string; className?: string }) {
    return (
        <div className={`contest-markdown ${className}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
        </div>
    );
}
