import json
from pathlib import Path

WORKSPACE = Path(r"c:\Users\vutm\Desktop\workspace\tinix-r2ai-roadmap")
PHASES_DIR = WORKSPACE / "phases"

def check_gaps():
    phases = sorted([d for d in PHASES_DIR.iterdir() if d.is_dir()])
    gaps = []
    identical_count = 0
    todo_count = 0
    small_count = 0
    
    for phase_dir in phases:
        lessons = sorted([d for d in phase_dir.iterdir() if d.is_dir()])
        for lesson_dir in lessons:
            vi_path = lesson_dir / "docs" / "vi.md"
            en_path = lesson_dir / "docs" / "en.md"
            
            if not vi_path.exists():
                gaps.append({
                    "lesson": lesson_dir.name,
                    "phase": phase_dir.name,
                    "reason": "Missing vi.md entirely"
                })
                continue
                
            vi_content = vi_path.read_text(encoding='utf-8')
            
            # Check if vi.md is identical to en.md
            if en_path.exists():
                en_content = en_path.read_text(encoding='utf-8')
                if vi_content.strip() == en_content.strip():
                    gaps.append({
                        "lesson": lesson_dir.name,
                        "phase": phase_dir.name,
                        "reason": "vi.md is identical to en.md (not translated)"
                    })
                    identical_count += 1
                    continue
            
            # Check if vi.md is unusually small (e.g., less than 100 characters)
            if len(vi_content.strip()) < 100:
                gaps.append({
                    "lesson": lesson_dir.name,
                    "phase": phase_dir.name,
                    "reason": f"vi.md is extremely small ({len(vi_content.strip())} chars)"
                })
                small_count += 1
                continue
                
            # Check for TODO placeholders
            if "TODO" in vi_content:
                gaps.append({
                    "lesson": lesson_dir.name,
                    "phase": phase_dir.name,
                    "reason": "Contains 'TODO' placeholders"
                })
                todo_count += 1
                
    return gaps, {
        "identical": identical_count,
        "small": small_count,
        "todo": todo_count
    }

if __name__ == "__main__":
    gaps, stats = check_gaps()
    print(f"Total gaps/issues found: {len(gaps)}")
    print(f"Stats: {stats}")
    
    # Save the detailed findings
    report_path = WORKSPACE / ".agent" / "scratch" / "translation_gaps.json"
    report_path.write_text(json.dumps(gaps, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Saved gaps list to {report_path}")
