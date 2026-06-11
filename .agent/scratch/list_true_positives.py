import json
from pathlib import Path

report_path = Path(".agent/scratch/clean_scan_report.json")
output_path = Path(".agent/scratch/true_positives.txt")

data = json.loads(report_path.read_text(encoding='utf-8'))
lines = []

for filepath, occurrences in data.items():
    rel_path = filepath.replace("c:\\Users\\vutm\\Desktop\\workspace\\tinix-r2ai-roadmap\\", "")
    lines.append(f"=== {rel_path} ===")
    for occ in occurrences:
        lines.append(f"Line {occ['line_number']} [{occ['term']}]: {occ['line_content']}")
    lines.append("")

output_path.write_text("\n".join(lines), encoding='utf-8')
print("Successfully wrote true positives to true_positives.txt")
