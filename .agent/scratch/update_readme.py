import os
import re

def update_readme():
    readme_path = "README.md"
    with open(readme_path, "r", encoding="utf-8") as f:
        readme_content = f.read()

    phases_dir = "phases"
    phases = sorted([d for d in os.listdir(phases_dir) if os.path.isdir(os.path.join(phases_dir, d))])
    
    replacements = []
    
    for phase in phases:
        phase_path = os.path.join(phases_dir, phase)
        lessons = sorted([d for d in os.listdir(phase_path) if os.path.isdir(os.path.join(phase_path, d))])
        
        for lesson in lessons:
            lesson_path = os.path.join(phase_path, lesson)
            vi_path = os.path.join(lesson_path, "docs", "vi.md")
            en_path = os.path.join(lesson_path, "docs", "en.md")
            
            title = ""
            link_text = "vi"
            rel_path = f"phases/{phase}/{lesson}/docs/vi.md"
            
            title_vi = ""
            if os.path.exists(vi_path):
                with open(vi_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
                    if match:
                        title_vi = match.group(1).strip()
            
            title_en = ""
            if os.path.exists(en_path):
                with open(en_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
                    if match:
                        title_en = match.group(1).strip()
                        
            if not title_vi and not title_en:
                continue
                
            if not title_vi:
                title = title_en
                link_text = "en"
                rel_path = f"phases/{phase}/{lesson}/docs/en.md"
            else:
                title = title_vi
                # Check if title_vi already contains bilingual info
                if "(" not in title_vi and title_en and title_en.lower() != title_vi.lower():
                    title = f"{title_vi} ({title_en})"
            
            # Use [ \t] instead of \s so we don't match \n
            escaped_rel_path = re.escape(f"phases/{phase}/{lesson}/docs/")
            # Matches exactly one row
            search_pattern = r'^\|[ \t]*\d+[ \t]*\|(.*?)\|[ \t]*\[.*?\]\(' + escaped_rel_path + r'(vi|en)\.md\)[ \t]*\|[ \t]*$'
            
            match_readme = re.search(search_pattern, readme_content, re.MULTILINE)
            if match_readme:
                row = match_readme.group(0)
                num_match = re.search(r'\|[ \t]*(\d+)[ \t]*\|', row)
                num = num_match.group(1) if num_match else "00"
                new_row = f"| {num} | {title} | [{link_text}]({rel_path}) |"
                if row != new_row:
                    replacements.append((row, new_row))

    for old_row, new_row in replacements:
        readme_content = readme_content.replace(old_row, new_row)
        
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(readme_content)
        
    print(f"Updated {len(replacements)} rows in README.md")

if __name__ == "__main__":
    update_readme()
