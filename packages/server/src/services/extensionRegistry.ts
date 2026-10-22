// Built-in extension registry + custom extension support for the Colab Code Editor
// Extensions are lightweight configs — themes, snippets, formatters, keybindings

import fs from 'fs';
import path from 'path';
import prisma from '../db';

export interface Extension {
    id: string;
    name: string;
    description: string;
    category: 'theme' | 'snippets' | 'formatter' | 'keybindings' | 'visual' | 'tool';
    icon: string; // emoji
    author: string;
    version: string;
    custom?: boolean; // true for user-uploaded extensions
    config?: Record<string, any>;
}

const EXTENSION_REGISTRY: Extension[] = [
    // ===================== THEMES =====================
    {
        id: 'theme-dracula',
        name: 'Dracula',
        description: 'Dark theme with vibrant purple, pink, and green accents.',
        category: 'theme',
        icon: '🧛',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            bgPrimary: '#282a36', bgSecondary: '#21222c', bgElevated: '#44475a', bgActive: '#6272a4',
            textPrimary: '#f8f8f2', textSecondary: '#bd93f9', textMuted: '#6272a4',
            accentPrimary: '#bd93f9', accentSecondary: '#ff79c6', accentError: '#ff5555',
            borderSubtle: '#44475a',
        },
    },
    {
        id: 'theme-monokai',
        name: 'Monokai Pro',
        description: 'Classic Monokai color scheme with warm tones.',
        category: 'theme',
        icon: '🎨',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            bgPrimary: '#2d2a2e', bgSecondary: '#221f22', bgElevated: '#403e41', bgActive: '#5b595c',
            textPrimary: '#fcfcfa', textSecondary: '#a9dc76', textMuted: '#727072',
            accentPrimary: '#ffd866', accentSecondary: '#fc9867', accentError: '#ff6188',
            borderSubtle: '#403e41',
        },
    },
    {
        id: 'theme-github-dark',
        name: 'GitHub Dark',
        description: 'GitHub-inspired dark theme with blue accents.',
        category: 'theme',
        icon: '🐙',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            bgPrimary: '#0d1117', bgSecondary: '#010409', bgElevated: '#161b22', bgActive: '#21262d',
            textPrimary: '#c9d1d9', textSecondary: '#8b949e', textMuted: '#484f58',
            accentPrimary: '#58a6ff', accentSecondary: '#3fb950', accentError: '#f85149',
            borderSubtle: '#21262d',
        },
    },
    {
        id: 'theme-solarized',
        name: 'Solarized Dark',
        description: 'Precision color scheme with carefully chosen contrast.',
        category: 'theme',
        icon: '☀️',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            bgPrimary: '#002b36', bgSecondary: '#073642', bgElevated: '#073642', bgActive: '#586e75',
            textPrimary: '#839496', textSecondary: '#93a1a1', textMuted: '#586e75',
            accentPrimary: '#268bd2', accentSecondary: '#2aa198', accentError: '#dc322f',
            borderSubtle: '#073642',
        },
    },
    {
        id: 'theme-nord',
        name: 'Nord',
        description: 'Arctic, north-bluish clean and elegant theme.',
        category: 'theme',
        icon: '❄️',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            bgPrimary: '#2e3440', bgSecondary: '#3b4252', bgElevated: '#434c5e', bgActive: '#4c566a',
            textPrimary: '#eceff4', textSecondary: '#d8dee9', textMuted: '#4c566a',
            accentPrimary: '#88c0d0', accentSecondary: '#a3be8c', accentError: '#bf616a',
            borderSubtle: '#3b4252',
        },
    },
    {
        id: 'theme-one-dark',
        name: 'One Dark Pro',
        description: 'Atom One Dark theme — the most popular dark theme.',
        category: 'theme',
        icon: '🌑',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            bgPrimary: '#282c34', bgSecondary: '#21252b', bgElevated: '#2c313a', bgActive: '#3e4451',
            textPrimary: '#abb2bf', textSecondary: '#61afef', textMuted: '#5c6370',
            accentPrimary: '#61afef', accentSecondary: '#98c379', accentError: '#e06c75',
            borderSubtle: '#3e4451',
        },
    },
    {
        id: 'theme-catppuccin',
        name: 'Catppuccin Mocha',
        description: 'Soothing pastel theme for the high-spirited!',
        category: 'theme',
        icon: '🐱',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            bgPrimary: '#1e1e2e', bgSecondary: '#181825', bgElevated: '#313244', bgActive: '#45475a',
            textPrimary: '#cdd6f4', textSecondary: '#bac2de', textMuted: '#585b70',
            accentPrimary: '#cba6f7', accentSecondary: '#a6e3a1', accentError: '#f38ba8',
            borderSubtle: '#313244',
        },
    },
    {
        id: 'theme-tokyo-night',
        name: 'Tokyo Night',
        description: 'Clean dark theme inspired by Tokyo city lights.',
        category: 'theme',
        icon: '🌃',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            bgPrimary: '#1a1b26', bgSecondary: '#16161e', bgElevated: '#24283b', bgActive: '#414868',
            textPrimary: '#c0caf5', textSecondary: '#a9b1d6', textMuted: '#565f89',
            accentPrimary: '#7aa2f7', accentSecondary: '#9ece6a', accentError: '#f7768e',
            borderSubtle: '#24283b',
        },
    },
    {
        id: 'theme-gruvbox',
        name: 'Gruvbox Dark',
        description: 'Retro groove color scheme with warm, earthy tones.',
        category: 'theme',
        icon: '🟤',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            bgPrimary: '#282828', bgSecondary: '#1d2021', bgElevated: '#3c3836', bgActive: '#504945',
            textPrimary: '#ebdbb2', textSecondary: '#d5c4a1', textMuted: '#665c54',
            accentPrimary: '#fabd2f', accentSecondary: '#b8bb26', accentError: '#fb4934',
            borderSubtle: '#3c3836',
        },
    },
    {
        id: 'theme-rose-pine',
        name: 'Rosé Pine',
        description: 'All natural pine, faux fur, and a bit of soho vibes.',
        category: 'theme',
        icon: '🌹',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            bgPrimary: '#191724', bgSecondary: '#1f1d2e', bgElevated: '#26233a', bgActive: '#403d52',
            textPrimary: '#e0def4', textSecondary: '#908caa', textMuted: '#6e6a86',
            accentPrimary: '#c4a7e7', accentSecondary: '#9ccfd8', accentError: '#eb6f92',
            borderSubtle: '#26233a',
        },
    },
    {
        id: 'theme-cyberpunk',
        name: 'Cyberpunk 2077',
        description: 'Neon-lit futuristic theme with hot pink and cyan.',
        category: 'theme',
        icon: '🤖',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            bgPrimary: '#0a0a1a', bgSecondary: '#060612', bgElevated: '#1a1a3e', bgActive: '#2a2a5e',
            textPrimary: '#e0e0ff', textSecondary: '#00ffff', textMuted: '#4a4a8a',
            accentPrimary: '#ff2cf1', accentSecondary: '#00ffff', accentError: '#ff3a3a',
            borderSubtle: '#1a1a3e',
        },
    },
    {
        id: 'theme-ayu-dark',
        name: 'Ayu Dark',
        description: 'Simple theme with bright colors and warm orange accent.',
        category: 'theme',
        icon: '🔥',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            bgPrimary: '#0d1017', bgSecondary: '#0b0e14', bgElevated: '#131721', bgActive: '#1c212b',
            textPrimary: '#bfbdb6', textSecondary: '#acb6bf', textMuted: '#565b66',
            accentPrimary: '#e6b450', accentSecondary: '#7fd962', accentError: '#d95757',
            borderSubtle: '#131721',
        },
    },

    // ===================== SNIPPETS =====================
    {
        id: 'snippets-python',
        name: 'Python Snippets',
        description: 'Common Python patterns — classes, decorators, list comprehensions, async/await.',
        category: 'snippets',
        icon: '🐍',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            snippets: {
                'def': 'def ${1:fn}(${2:params}):\n    ${3:pass}',
                'class': 'class ${1:Cls}:\n    def __init__(self${2:, params}):\n        ${3:pass}',
                'for': 'for ${1:item} in ${2:iterable}:\n    ${3:pass}',
                'ifmain': 'if __name__ == "__main__":\n    ${1:main()}',
                'try': 'try:\n    ${1:pass}\nexcept ${2:Exception} as e:\n    ${3:print(e)}',
                'with': 'with open("${1:file}", "${2:r}") as f:\n    ${3:data = f.read()}',
                'async': 'async def ${1:fn}(${2:params}):\n    ${3:await}',
                'list': '[${1:expr} for ${2:item} in ${3:iterable}]',
                'lambda': 'lambda ${1:x}: ${2:x}',
                'deco': '@${1:decorator}\ndef ${2:fn}(${3:}):\n    ${4:pass}',
            }
        },
    },
    {
        id: 'snippets-react',
        name: 'React / JS Snippets',
        description: 'React hooks, components, common JavaScript/TypeScript patterns.',
        category: 'snippets',
        icon: '⚛️',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            snippets: {
                'rfc': 'export default function ${1:Component}() {\n    return (\n        <div>\n            ${2:content}\n        </div>\n    );\n}',
                'useState': 'const [${1:state}, set${2:State}] = useState(${3:init});',
                'useEffect': 'useEffect(() => {\n    ${1}\n    return () => { ${2} };\n}, [${3}]);',
                'useCallback': 'const ${1:fn} = useCallback((${2:}) => {\n    ${3}\n}, [${4}]);',
                'useMemo': 'const ${1:val} = useMemo(() => ${2:value}, [${3}]);',
                'useRef': 'const ${1:ref} = useRef<${2:HTMLDivElement}>(null);',
                'fetch': 'const res = await fetch("${1:url}");\nconst data = await res.json();',
                'map': '${1:arr}.map((${2:item}) => (\n    ${3:<div key={item.id}>{item}</div>}\n))',
                'arrow': 'const ${1:name} = (${2:params}) => {\n    ${3}\n};',
                'interface': 'interface ${1:Name} {\n    ${2:key}: ${3:type};\n}',
            }
        },
    },
    {
        id: 'snippets-html',
        name: 'HTML Snippets',
        description: 'HTML5 boilerplate, common tags, forms, tables, and metadata.',
        category: 'snippets',
        icon: '🌐',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            snippets: {
                'html5': '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>${1:Document}</title>\n</head>\n<body>\n    ${2}\n</body>\n</html>',
                'link': '<link rel="stylesheet" href="${1:style.css}">',
                'script': '<script src="${1:script.js}"></script>',
                'form': '<form action="${1:#}" method="${2:post}">\n    ${3}\n    <button type="submit">${4:Submit}</button>\n</form>',
                'input': '<input type="${1:text}" name="${2:name}" placeholder="${3:}">',
                'img': '<img src="${1:src}" alt="${2:alt}">',
                'table': '<table>\n    <thead>\n        <tr><th>${1:Header}</th></tr>\n    </thead>\n    <tbody>\n        <tr><td>${2:Data}</td></tr>\n    </tbody>\n</table>',
            }
        },
    },
    {
        id: 'snippets-css',
        name: 'CSS Snippets',
        description: 'Common CSS patterns — flexbox, grid, animations, media queries.',
        category: 'snippets',
        icon: '🎭',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            snippets: {
                'flex-center': 'display: flex;\njustify-content: center;\nalign-items: center;',
                'grid': 'display: grid;\ngrid-template-columns: repeat(${1:3}, 1fr);\ngap: ${2:16px};',
                'media': '@media (max-width: ${1:768px}) {\n    ${2}\n}',
                'animate': '@keyframes ${1:name} {\n    from { ${2:opacity: 0;} }\n    to { ${3:opacity: 1;} }\n}',
                'transition': 'transition: ${1:all} ${2:0.3s} ${3:ease};',
                'shadow': 'box-shadow: ${1:0} ${2:2px} ${3:8px} rgba(0, 0, 0, ${4:0.15});',
                'gradient': 'background: linear-gradient(${1:135deg}, ${2:#667eea} 0%, ${3:#764ba2} 100%);',
                'reset': '* {\n    margin: 0;\n    padding: 0;\n    box-sizing: border-box;\n}',
            }
        },
    },
    {
        id: 'snippets-java',
        name: 'Java Snippets',
        description: 'Java classes, methods, try-catch, streams, and common patterns.',
        category: 'snippets',
        icon: '☕',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            snippets: {
                'main': 'public static void main(String[] args) {\n    ${1}\n}',
                'sout': 'System.out.println(${1:});',
                'class': 'public class ${1:ClassName} {\n    ${2}\n}',
                'for': 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3}\n}',
                'foreach': 'for (${1:Type} ${2:item} : ${3:collection}) {\n    ${4}\n}',
                'try': 'try {\n    ${1}\n} catch (${2:Exception} e) {\n    ${3:e.printStackTrace();}\n}',
                'interface': 'public interface ${1:Name} {\n    ${2:void method();}\n}',
            }
        },
    },
    {
        id: 'snippets-go',
        name: 'Go Snippets',
        description: 'Go functions, structs, goroutines, error handling, and HTTP handlers.',
        category: 'snippets',
        icon: '🐹',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            snippets: {
                'func': 'func ${1:name}(${2:params}) ${3:error} {\n    ${4}\n}',
                'main': 'package main\n\nimport "fmt"\n\nfunc main() {\n    ${1:fmt.Println("Hello")}\n}',
                'struct': 'type ${1:Name} struct {\n    ${2:Field} ${3:string}\n}',
                'iferr': 'if err != nil {\n    ${1:return err}\n}',
                'goroutine': 'go func() {\n    ${1}\n}()',
                'http': 'http.HandleFunc("/${1:path}", func(w http.ResponseWriter, r *http.Request) {\n    ${2}\n})',
                'test': 'func Test${1:Name}(t *testing.T) {\n    ${2}\n}',
            }
        },
    },
    {
        id: 'snippets-rust',
        name: 'Rust Snippets',
        description: 'Rust functions, structs, match, Result/Option, and impl blocks.',
        category: 'snippets',
        icon: '🦀',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            snippets: {
                'fn': 'fn ${1:name}(${2:params}) -> ${3:ReturnType} {\n    ${4}\n}',
                'main': 'fn main() {\n    ${1:println!("Hello");}\n}',
                'struct': 'struct ${1:Name} {\n    ${2:field}: ${3:Type},\n}',
                'impl': 'impl ${1:Name} {\n    fn ${2:new}(${3:}) -> Self {\n        ${4}\n    }\n}',
                'match': 'match ${1:value} {\n    ${2:pattern} => ${3:result},\n    _ => ${4:default},\n}',
                'enum': 'enum ${1:Name} {\n    ${2:Variant1},\n    ${3:Variant2},\n}',
                'test': '#[test]\nfn ${1:test_name}() {\n    ${2:assert_eq!(1, 1);}\n}',
            }
        },
    },

    // ===================== FORMATTERS =====================
    {
        id: 'formatter-prettier',
        name: 'Prettier',
        description: 'Opinionated code formatter. Auto-formats on save.',
        category: 'formatter',
        icon: '✨',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            tabWidth: 2, useTabs: false, semi: true, singleQuote: true,
            trailingComma: 'es5', bracketSpacing: true, printWidth: 80,
        },
    },
    {
        id: 'formatter-black',
        name: 'Black (Python)',
        description: 'The uncompromising Python code formatter.',
        category: 'formatter',
        icon: '🖤',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: { lineLength: 88, targetVersion: 'py311', stringNormalization: true },
    },

    // ===================== KEYBINDINGS =====================
    {
        id: 'keybindings-vim',
        name: 'Vim Keybindings',
        description: 'Vim modal editing mode for the code editor.',
        category: 'keybindings',
        icon: '⌨️',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: { mode: 'vim' },
    },
    {
        id: 'keybindings-emacs',
        name: 'Emacs Keybindings',
        description: 'Emacs-style keybindings for the editor.',
        category: 'keybindings',
        icon: '🔤',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: { mode: 'emacs' },
    },

    // ===================== VISUAL =====================
    {
        id: 'visual-bracket-colors',
        name: 'Bracket Colorizer',
        description: 'Rainbow brackets — matching brackets get matching colors.',
        category: 'visual',
        icon: '🌈',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            enabled: true,
            colors: ['#ffd700', '#da70d6', '#179fff', '#00ff7f', '#ff6b6b', '#45b7d1'],
        },
    },
    {
        id: 'visual-minimap',
        name: 'Minimap',
        description: 'Show a minimap code overview on the right side of the editor.',
        category: 'visual',
        icon: '🗺️',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: { enabled: true, maxColumn: 80 },
    },
    {
        id: 'visual-indent-rainbow',
        name: 'Indent Rainbow',
        description: 'Colorize indentation levels for better readability.',
        category: 'visual',
        icon: '🎋',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: {
            enabled: true,
            colors: ['rgba(255,255,64,0.07)', 'rgba(127,255,127,0.07)', 'rgba(255,127,255,0.07)', 'rgba(79,236,236,0.07)'],
        },
    },
    {
        id: 'visual-smooth-cursor',
        name: 'Smooth Cursor',
        description: 'Smooth animated cursor movement in the editor.',
        category: 'visual',
        icon: '🖱️',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: { cursorSmoothCaretAnimation: 'on', cursorBlinking: 'smooth' },
    },
    {
        id: 'visual-font-ligatures',
        name: 'Font Ligatures',
        description: 'Enable programming ligatures (=> -> !== etc).',
        category: 'visual',
        icon: '🔗',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: { fontLigatures: true, fontFamily: "'Fira Code', 'JetBrains Mono', monospace" },
    },

    // ===================== TOOLS =====================
    {
        id: 'tool-auto-save',
        name: 'Auto Save',
        description: 'Automatically save files after a delay. Configurable interval.',
        category: 'tool',
        icon: '💾',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: { enabled: true, delayMs: 1000 },
    },
    {
        id: 'tool-word-wrap',
        name: 'Word Wrap Toggle',
        description: 'Toggle word wrapping in the editor.',
        category: 'tool',
        icon: '↩️',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: { wordWrap: 'on' },
    },
    {
        id: 'tool-zen-mode',
        name: 'Zen Mode',
        description: 'Distraction-free writing mode — hides sidebar and panels.',
        category: 'tool',
        icon: '🧘',
        author: 'Colab Extensions',
        version: '1.0.0',
        config: { hideSidebar: true, hidePanel: true, fullWidth: true },
    },
];

// ---- Custom extension storage ----
// Kept in Postgres (CustomExtension table) and cached in memory, so lookups stay synchronous.
// loadCustomExtensions() runs at startup and also imports files written by earlier versions.
const LEGACY_CUSTOM_EXT_DIR = process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, 'custom-extensions')
    : path.join(process.cwd(), 'custom-extensions');

let customExtensions: Extension[] = [];

export async function loadCustomExtensions(): Promise<void> {
    if (fs.existsSync(LEGACY_CUSTOM_EXT_DIR)) {
        const legacy: Array<{ id: string; data: any }> = [];
        for (const f of fs.readdirSync(LEGACY_CUSTOM_EXT_DIR).filter(f => f.endsWith('.json'))) {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(LEGACY_CUSTOM_EXT_DIR, f), 'utf-8'));
                if (data.id) legacy.push({ id: data.id, data: { ...data, custom: true } });
            } catch {
                // skip corrupt files
            }
        }
        if (legacy.length > 0) await prisma.customExtension.createMany({ data: legacy, skipDuplicates: true });
    }
    const rows = await prisma.customExtension.findMany({ orderBy: { createdAt: 'asc' } });
    customExtensions = rows.map(r => ({ ...(r.data as unknown as Extension), custom: true }));
}

// ---- Public API ----

export function getAllExtensions(): Extension[] {
    return [...EXTENSION_REGISTRY, ...customExtensions];
}

export function getExtension(id: string): Extension | undefined {
    return getAllExtensions().find(e => e.id === id);
}

export function getExtensionsByCategory(category: Extension['category']): Extension[] {
    return getAllExtensions().filter(e => e.category === category);
}

export async function addCustomExtension(ext: Omit<Extension, 'custom'>): Promise<Extension> {
    const full: Extension = { ...ext, custom: true };
    await prisma.customExtension.create({ data: { id: full.id, data: full as any } });
    customExtensions.push(full);
    return full;
}

export async function deleteCustomExtension(id: string): Promise<boolean> {
    const { count } = await prisma.customExtension.deleteMany({ where: { id } });
    customExtensions = customExtensions.filter(e => e.id !== id);
    return count > 0;
}
