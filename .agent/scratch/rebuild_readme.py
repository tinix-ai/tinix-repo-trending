import os
import re

def rebuild_readme_tables():
    readme_path = "README.md"
    with open(readme_path, "r", encoding="utf-8") as f:
        readme_content = f.read()

    phases_dir = "phases"
    phases = sorted([d for d in os.listdir(phases_dir) if os.path.isdir(os.path.join(phases_dir, d))])
    
    for phase in phases:
        phase_path = os.path.join(phases_dir, phase)
        lessons = sorted([d for d in os.listdir(phase_path) if os.path.isdir(os.path.join(phase_path, d))])
        
        # Build new table for this phase
        table_rows = []
        
        for index, lesson in enumerate(lessons, 1):
            lesson_path = os.path.join(phase_path, lesson)
            vi_path = os.path.join(lesson_path, "docs", "vi.md")
            en_path = os.path.join(lesson_path, "docs", "en.md")
            
            md_to_read = None
            link_text = "vi"
            rel_path = f"phases/{phase}/{lesson}/docs/vi.md"
            if os.path.exists(vi_path):
                md_to_read = vi_path
            elif os.path.exists(en_path):
                md_to_read = en_path
                link_text = "en"
                rel_path = f"phases/{phase}/{lesson}/docs/en.md"
                
            title = lesson.replace('-', ' ').title()
            if md_to_read:
                with open(md_to_read, "r", encoding="utf-8") as f:
                    content = f.read()
                    match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
                    if match:
                        title = match.group(1).strip()
            
            # Bilingual formatting logic
            # Ensure "Vietnamese (English)" format if the title isn't already formatted
            # If the user's docs already have English in parenthesis, it's fine.
            # If it's pure Vietnamese, maybe we should extract the English from en.md?
            # But the requirement says "tiêu đề các phần bài học cũng cần theo chuẩn tiếng Việt đã dịch", so using the title from vi.md is correct.
            # Wait, user also said "1. song ngữ". Let's check if the title from vi.md already has "(English)".
            if "(" not in title and os.path.exists(en_path) and os.path.exists(vi_path):
                # Try to get English title
                with open(en_path, "r", encoding="utf-8") as f:
                    en_content = f.read()
                    en_match = re.search(r'^#\s+(.+)$', en_content, re.MULTILINE)
                    if en_match:
                        en_title = en_match.group(1).strip()
                        # Some English titles might already have parenthesis.
                        if en_title.lower() != title.lower():
                            title = f"{title} ({en_title})"

            num_str = f"{index:02d}"
            row = f"| {num_str} | {title} | [{link_text}]({rel_path}) |"
            table_rows.append(row)
            
        # Now find the section in README to replace
        # We look for the table under the phase heading.
        # Phase headings look like `<summary><b>Phase X...</b>` or `### Phase 0`
        phase_num_match = re.match(r'^(\d+)-', phase)
        if not phase_num_match:
            continue
        phase_num = phase_num_match.group(1)
        
        # Regex to find the table for this phase
        # The table starts with `| # | Bài học | Tài liệu |` and ends with a blank line or `</details>`
        # To be safe, we can match the phase heading, the table header, and then replace the rows.
        
        # Search for the table header after the phase identifier
        # Example: Phase 0... \n\n | # | Bài học | Tài liệu |\n|:-:|--------|:---------:|\n
        header_pattern = re.compile(rf'(Phase {int(phase_num)}\b.*?\|\s*#\s*\|\s*Bài học\s*\|\s*Tài liệu\s*\|\n\|.*?:-+:.*?:-+:.*?:-+:\s*\|\n)(.*?)(?=\n\n|\n</details>)', re.DOTALL | re.IGNORECASE)
        
        match = header_pattern.search(readme_content)
        if match:
            prefix = match.group(1)
            new_table_body = "\n".join(table_rows)
            readme_content = readme_content[:match.start()] + prefix + new_table_body + readme_content[match.end():]
        else:
            print(f"Warning: Table for Phase {phase_num} not found in README.")

    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(readme_content)
        
    print("Rebuilt README.md tables.")

if __name__ == "__main__":
    rebuild_readme_tables()
