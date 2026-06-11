import os
import re

def check_missing():
    readme_path = "README.md"
    with open(readme_path, "r", encoding="utf-8") as f:
        readme_content = f.read()

    phases_dir = "phases"
    phases = sorted([d for d in os.listdir(phases_dir) if os.path.isdir(os.path.join(phases_dir, d))])
    
    missing = []
    
    for phase in phases:
        phase_path = os.path.join(phases_dir, phase)
        lessons = sorted([d for d in os.listdir(phase_path) if os.path.isdir(os.path.join(phase_path, d))])
        for lesson in lessons:
            rel_path = f"phases/{phase}/{lesson}/docs/"
            if rel_path not in readme_content:
                missing.append(rel_path)
                
    if missing:
        print(f"Found {len(missing)} missing lessons:")
        for m in missing:
            print(m)
    else:
        print("No missing lessons found!")

if __name__ == "__main__":
    check_missing()
