import os
from pathlib import Path
import re
import json

WORKSPACE = Path(r"c:\Users\vutm\Desktop\workspace\tinix-r2ai-roadmap")
PHASES_DIR = WORKSPACE / "phases"

def clean_title(title_text):
    title_text = title_text.strip().lstrip('#').strip()
    # Remove any markdown links or styling
    title_text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', title_text)
    # Extract only the Vietnamese part if it has "Việt (Anh)" format
    match = re.match(r'^(.*?)\s*[\(\[](.*?)[\)\]]\s*$', title_text)
    if match:
        vi_part = match.group(1).strip()
        en_part = match.group(2).strip()
        return vi_part, en_part
    return title_text, None

def scan_repository():
    phases = sorted([d for d in PHASES_DIR.iterdir() if d.is_dir()])
    repo_data = {}
    
    for phase_dir in phases:
        phase_name = phase_dir.name
        lessons = sorted([d for d in phase_dir.iterdir() if d.is_dir()])
        repo_data[phase_name] = []
        
        for lesson_dir in lessons:
            lesson_name = lesson_dir.name
            
            # Check for vi.md and en.md
            vi_path = lesson_dir / "docs" / "vi.md"
            en_path = lesson_dir / "docs" / "en.md"
            
            vi_title, vi_en_part = None, None
            en_title = None
            
            if vi_path.exists():
                try:
                    content = vi_path.read_text(encoding='utf-8')
                    # Find first H1
                    for line in content.splitlines():
                        if line.startswith('# '):
                            vi_title, vi_en_part = clean_title(line)
                            break
                except Exception as e:
                    print(f"Error reading {vi_path}: {e}")
                    
            if en_path.exists():
                try:
                    content = en_path.read_text(encoding='utf-8')
                    # Find first H1
                    for line in content.splitlines():
                        if line.startswith('# '):
                            en_title, _ = clean_title(line)
                            break
                except Exception as e:
                    print(f"Error reading {en_path}: {e}")
            
            # Fallback to folder name formatting if titles not found
            if not en_title:
                # Convert "01-dev-environment" to "Dev Environment"
                parts = lesson_name.split('-')[1:]
                en_title = " ".join(parts).title()
                
            repo_data[phase_name].append({
                "lesson_folder": lesson_name,
                "vi_path_exists": vi_path.exists(),
                "en_path_exists": en_path.exists(),
                "extracted_vi_title": vi_title,
                "extracted_vi_en_part": vi_en_part,
                "extracted_en_title": en_title
            })
            
    return repo_data

if __name__ == "__main__":
    data = scan_repository()
    out_path = WORKSPACE / ".agent" / "scratch" / "lessons_scan.json"
    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    
    total_lessons = sum(len(lessons) for lessons in data.values())
    translated_count = sum(sum(1 for l in lessons if l["vi_path_exists"]) for lessons in data.values())
    
    print(f"Scanned {len(data)} phases.")
    print(f"Total lessons found in folders: {total_lessons}")
    print(f"Lessons with vi.md: {translated_count} ({translated_count / total_lessons * 100:.2f}%)")
    print(f"Scan report saved to: {out_path}")
