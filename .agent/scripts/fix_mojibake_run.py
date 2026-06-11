#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_mojibake_run.py
Automatically detects and fixes double-UTF-8 encoding (mojibake) in all markdown files
across the knowledgebase.
"""

import os
import sys
from pathlib import Path

# Force UTF-8 output
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

KB_DIR = Path(__file__).resolve().parent.parent.parent / "knowledgebase"

# Create a mapping from CP1252 character to byte value
cp1252_to_byte = {
    bytes([i]).decode('cp1252', errors='ignore'): i 
    for i in range(256) 
    if len(bytes([i]).decode('cp1252', errors='ignore')) > 0
}
# Map undefined CP1252 control bytes
cp1252_to_byte.update({chr(b): b for b in [0x81, 0x8d, 0x8f, 0x90, 0x9d]})

def is_double_encoded(text: str) -> bool:
    # Common double-encoded signature patterns in Vietnamese
    indicators = ['Ãº', 'á»ƒ', 'vÄƒn', 'NhÃºng', 'Biá»ƒu', 'há»™i', 'trÃ¬nh', 'nghÄ©a', 'dá»±a', 'áº£nh', 'tiáº¿p', 'hÃ nh']
    return any(ind in text for ind in indicators)

def fix_text(text: str) -> str:
    b = bytes(cp1252_to_byte.get(c, ord(c) if ord(c) < 256 else 63) for c in text)
    return b.decode('utf-8', errors='replace')

def main():
    print("=" * 80)
    print("🧹 MOJIBAKE CLEANER (Double-UTF-8 -> Standard UTF-8)")
    print("=" * 80)
    
    if not KB_DIR.exists():
        print(f"ERROR: Knowledgebase directory not found at: {KB_DIR}")
        sys.exit(1)
        
    md_files = list(KB_DIR.glob("**/*.md"))
    fixed_count = 0
    
    for path in md_files:
        try:
            content = path.read_text(encoding='utf-8-sig')
            if is_double_encoded(content):
                print(f"Detecting mojibake in: {path.relative_to(KB_DIR)}")
                fixed_content = fix_text(content)
                
                # Write back with standard UTF-8
                path.write_text(fixed_content, encoding='utf-8')
                fixed_count += 1
                print(f"    -> FIXED successfully!")
        except Exception as e:
            print(f"    -> ERROR processing {path.name}: {e}")
            
    print("\n" + "=" * 80)
    print(f"🎉 Process completed! Fixed {fixed_count} files.")
    print("=" * 80)

if __name__ == "__main__":
    main()
