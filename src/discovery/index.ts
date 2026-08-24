import { readdirSync } from 'node:fs';
import path from 'node:path';

const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist']);
const STYLE_EXTENSIONS = new Set(['.css', '.scss']);
const SOURCE_EXTENSIONS = new Set(['.tsx']);

export interface DiscoveredFiles {
  /** repo-relative, POSIX separators, sorted */
  styleFiles: string[];
  /** repo-relative, POSIX separators, sorted */
  sourceFiles: string[];
}

/**
 * Repo root -> the files M1 knows how to analyze (.tsx, .css/.scss),
 * sorted for determinism. B14: root is the whole unit of analysis.
 */
export function discoverFiles(root: string): DiscoveredFiles {
  const entries = readdirSync(root, { recursive: true, withFileTypes: true });
  const styleFiles: string[] = [];
  const sourceFiles: string[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const absolute = path.join(entry.parentPath, entry.name);
    const relative = path.relative(root, absolute);
    const segments = relative.split(path.sep);
    if (segments.some((segment) => EXCLUDED_DIRS.has(segment))) continue;

    const ext = path.extname(entry.name);
    const posixRelative = segments.join('/');
    if (STYLE_EXTENSIONS.has(ext)) styleFiles.push(posixRelative);
    else if (SOURCE_EXTENSIONS.has(ext)) sourceFiles.push(posixRelative);
  }

  styleFiles.sort();
  sourceFiles.sort();
  return { styleFiles, sourceFiles };
}
