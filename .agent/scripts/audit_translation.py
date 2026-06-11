#!/usr/bin/env python3
import os
import sys
import re
from pathlib import Path

# ANSI colors for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

# List of forbidden slangs/vulgar words
FORBIDDEN_WORDS = [
    r'\bđéo\b',
    r'\bchóp ngáo\b',
    r'\brác mỏ\b',
    r'\bmỏ rác\b',
    r'\bvả dọng\b',
    r'\brảnh háng\b',
    r'\bphơi háng\b',
    r'\bchó má\b',
    r'\bmẹ kiếp\b',
    r'\bđụ\b',
    r'\bvãi\b',
]

def check_file(file_path: Path) -> list:
    """
    Checks a single vi.md file for slang, structural issues, and broken markdown links.
    Returns a list of error/warning messages.
    """
    errors = []
    try:
        content = file_path.read_text(encoding='utf-8')
    except Exception as e:
        return [f"Unable to read file: {e}"]

    # 1. Check for extremely short files
    if len(content.strip()) < 100:
        errors.append("File is too short (< 100 chars), might be empty or a placeholder.")

    # 2. Check for forbidden slang words (case-insensitive regex match)
    for pattern in FORBIDDEN_WORDS:
        matches = list(re.finditer(pattern, content, re.IGNORECASE))
        for match in matches:
            # Find the line number of the match
            line_no = content[:match.start()].count('\n') + 1
            matched_text = match.group(0)
            errors.append(f"Line {line_no}: Found forbidden word/slang '{matched_text}'")

    # 3. Check for broken relative links in markdown
    # Exclude fenced code blocks and inline code to prevent false positives in code snippets
    content_no_code = re.sub(r'```.*?```', '', content, flags=re.DOTALL)
    content_no_code = re.sub(r'`[^`\n]+`', '', content_no_code)

    # Pattern to match links like [label](relative_path)
    # Exclude external HTTP links, mailto, anchor links, and absolute paths
    link_pattern = r'\[([^\]]+)\]\(([^)]+)\)'
    links = re.findall(link_pattern, content_no_code)
    for label, link_target in links:
        link_target = link_target.strip()
        if (
            link_target.startswith('http://') or 
            link_target.startswith('https://') or 
            link_target.startswith('mailto:') or 
            link_target.startswith('#') or
            link_target.startswith('file://')
        ):
            continue
        
        # Resolve target path relative to the current file's directory
        try:
            target_path = (file_path.parent / link_target).resolve()
            if not target_path.exists():
                errors.append(f"Broken relative link: [{label}]({link_target}) (Resolved target path {target_path} does not exist)")
        except (OSError, ValueError) as e:
            errors.append(f"Invalid path in relative link target: [{label}]({link_target}) - {str(e)}")

    return errors

def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        # Fallback for Python versions that don't support reconfigure
        pass
    if len(sys.argv) > 1:
        root_dir = Path(sys.argv[1]).resolve()
    else:
        root_dir = Path('.').resolve()

    if not root_dir.exists():
        print(f"{Colors.RED}Root directory does not exist: {root_dir}{Colors.ENDC}")
        sys.exit(1)

    print(f"{Colors.BOLD}{Colors.CYAN}============================================================{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.CYAN}          TINIX R2AI TRANSLATION & QUALITY AUDITOR          {Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.CYAN}============================================================{Colors.ENDC}")
    print(f"Target Directory: {root_dir}")
    print("Auditing Phases: All Phases (Phase 00 to Phase 19)\n")

    target_phases = [f"{i:02d}-" for i in range(20)]
    
    vi_files_found = []
    # Recursively find all docs/vi.md files in the targeted phases
    for dirpath, _, filenames in os.walk(root_dir):
        path_parts = Path(dirpath).parts
        # Filter for subdirectories under 'phases' and belonging to targeted phases
        if "phases" in path_parts:
            phases_idx = path_parts.index("phases")
            if phases_idx + 1 < len(path_parts):
                phase_dir = path_parts[phases_idx + 1]
                if any(phase_dir.startswith(prefix) for prefix in target_phases):
                    for filename in filenames:
                        if filename == "vi.md":
                            vi_files_found.append(Path(dirpath) / filename)

    print(f"Found {len(vi_files_found)} 'vi.md' files to audit.")
    print("------------------------------------------------------------\n")

    failed_files_count = 0
    total_errors_count = 0

    for file_path in sorted(vi_files_found):
        # Get relative path for clean printing
        rel_path = file_path.relative_to(root_dir)
        errors = check_file(file_path)
        
        if errors:
            failed_files_count += 1
            total_errors_count += len(errors)
            print(f"{Colors.RED}❌ {rel_path}{Colors.ENDC}")
            for err in errors:
                print(f"   - {err}")
        else:
            print(f"{Colors.GREEN}✅ {rel_path}{Colors.ENDC}")

    print("\n------------------------------------------------------------")
    print(f"{Colors.BOLD}AUDIT SUMMARY:{Colors.ENDC}")
    print(f"Total files checked: {len(vi_files_found)}")
    print(f"Files with issues: {failed_files_count}")
    print(f"Total translation errors found: {total_errors_count}")

    if total_errors_count > 0:
        print(f"\n{Colors.RED}❌ Quality Audit Failed: Please fix all the issues listed above.{Colors.ENDC}")
        sys.exit(1)
    else:
        print(f"\n{Colors.GREEN}✅ Quality Audit Passed: All translations are perfectly pristine! ✨{Colors.ENDC}")
        sys.exit(0)

if __name__ == "__main__":
    main()
