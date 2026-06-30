<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CodeGraph Guidelines

Prioritize using CodeGraph before reading files or using search/grep to locate or understand code in this repository:

- **Primary Source**: Use the CodeGraph tool (`codegraph_explore`) or the CLI command `codegraph explore "<symbol name or question>"` as your first step when investigating code symbols, call paths, or file contents.
- **Fallback**: Only use direct file reading (`view_file`), directory listing (`list_dir`), or ripgrep (`grep_search`) if CodeGraph is not available or does not contain the required information.
