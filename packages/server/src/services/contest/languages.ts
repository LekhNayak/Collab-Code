// Languages available in contests: execution language id (executionService LANG_MAP key), file
// extension used for the participant's file ("/A.cpp"), and the starter template.
// Mirrored by packages/client/src/contest/languages.ts — keep the ids and extensions in sync.

export interface ContestLanguage {
    id: string;
    label: string;
    ext: string;
    template: string;
}

export const CONTEST_LANGUAGES: ContestLanguage[] = [
    {
        id: 'python',
        label: 'Python 3',
        ext: 'py',
        template: `import sys


def main():
    data = sys.stdin.read().split()
    # your code here


main()
`,
    },
    {
        id: 'cpp',
        label: 'C++',
        ext: 'cpp',
        template: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    // your code here
    return 0;
}
`,
    },
    {
        id: 'c',
        label: 'C',
        ext: 'c',
        template: `#include <stdio.h>

int main(void) {
    // your code here
    return 0;
}
`,
    },
    {
        id: 'java',
        label: 'Java',
        ext: 'java',
        // Not public: the judge saves the file under a generic name
        template: `import java.io.*;
import java.util.*;

class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        // your code here
    }
}
`,
    },
    {
        id: 'javascript',
        label: 'JavaScript (Node)',
        ext: 'js',
        template: `const data = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/);
// your code here
`,
    },
    {
        id: 'typescript',
        label: 'TypeScript',
        ext: 'ts',
        template: `declare const require: any;
const data: string[] = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/);
// your code here
`,
    },
    {
        id: 'go',
        label: 'Go',
        ext: 'go',
        template: `package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	reader := bufio.NewReader(os.Stdin)
	writer := bufio.NewWriter(os.Stdout)
	defer writer.Flush()

	var n int
	fmt.Fscan(reader, &n)
	// your code here
}
`,
    },
    {
        id: 'rust',
        label: 'Rust',
        ext: 'rs',
        template: `use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut tokens = input.split_ascii_whitespace();
    // your code here
    let _ = tokens.next();
}
`,
    },
];

export const contestLanguage = (id: string) => CONTEST_LANGUAGES.find(l => l.id === id);

// Languages a contest allows (an empty list means all)
export const allowedLanguages = (contest: { languages: string[] }) =>
    contest.languages.length > 0 ? CONTEST_LANGUAGES.filter(l => contest.languages.includes(l.id)) : CONTEST_LANGUAGES;

// Path of a participant's file for a problem, e.g. "/A.cpp"
export const solutionPath = (problemIndex: string, lang: ContestLanguage) => `/${problemIndex}.${lang.ext}`;

// SQL problems always use this one; it isn't in CONTEST_LANGUAGES, so it never shows in the contest's
// language settings
export const SQL_LANGUAGE: ContestLanguage = {
    id: 'sql',
    label: 'SQL (SQLite)',
    ext: 'sql',
    template: `-- Write one query. The last SELECT is your answer.
SELECT
`,
};

// The language a submission for this problem may use, or undefined when it isn't allowed
export function problemLanguage(contest: { languages: string[] }, problem: { kind: string }, id: string): ContestLanguage | undefined {
    if (problem.kind === 'SQL') return id === SQL_LANGUAGE.id ? SQL_LANGUAGE : undefined;
    const language = contestLanguage(id);
    return language && allowedLanguages(contest).some(l => l.id === language.id) ? language : undefined;
}
