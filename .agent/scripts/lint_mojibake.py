#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
lint_mojibake.py
Pre-commit lint script that checks staged markdown files for double-UTF-8 encoding (mojibake).
Returns exit code 1 if any mojibake is detected, blocking the commit.
"""

import sys
import subprocess
from pathlib import Path

# Force UTF-8 output
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Common double-encoded signature patterns in Vietnamese
INDICATORS = ['Ãº', 'á»ƒ', 'vÄƒn', 'NhÃºng', 'Biá»ƒu', 'há»™i', 'trÃ¬nh', 'nghÄ©a', 'dá»±a', 'áº£nh', 'tiáº¿p', 'hÃ nh']

def get_staged_files():
    try:
        # Run git diff to get staged files
        res = subprocess.run(
            ['git', 'diff', '--cached', '--name-only', '--diff-filter=ACM'],
            capture_output=True,
            text=True,
            check=True
        )
        return [line.strip() for line in res.stdout.splitlines() if line.strip()]
    except Exception as e:
        print(f"Error getting staged files: {e}")
        return []

def main():
    staged = get_staged_files()
    md_files = [Path(f) for f in staged if f.endswith('.md')]
    
    if not md_files:
        sys.exit(0)
        
    failed = False
    print("=" * 60)
    print("🔍 CHECKING FOR MOJIBAKE ENCODING ERRORS...")
    print("=" * 60)
    
    for path in md_files:
        if not path.exists():
            continue
        try:
            content = path.read_text(encoding='utf-8-sig', errors='ignore')
            for indicator in INDICATORS:
                if indicator in content:
                    print(f"❌ ERROR: Mojibake detected in '{path}' (pattern: '{indicator}')")
                    print("   This file seems to have double-UTF-8 encoding issues.")
                    print("   Please run: py .agent/scripts/fix_mojibake_run.py")
                    failed = True
                    break
        except Exception as e:
            print(f"⚠️ Warning: Could not read {path}: {e}")
            
    if failed:
        print("=" * 60)
        print("❌ COMMIT BLOCKED: Please fix encoding errors before committing.")
        print("=" * 60)
        sys.exit(1)
    else:
        print("✅ No mojibake detected. Codebase is clean!")
        print("=" * 60)
        sys.exit(0)

if __name__ == "__main__":
    main()
