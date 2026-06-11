import json
import re
from pathlib import Path

report_path = Path(r"c:\Users\vutm\Desktop\workspace\tinix-r2ai-roadmap\.agent\scratch\scan_report.json")
data = json.loads(report_path.read_text(encoding='utf-8'))

true_positives = {}
false_positives_count = 0
true_positives_count = 0

for file, occurrences in data.items():
    filtered_occurrences = []
    for occ in occurrences:
        term = occ['term']
        line = occ['line_content']
        line_num = occ['line_number']
        
        # 1. Filter out 'thưa thớt' from 'thớt'
        if term == "thớt" and "thưa thớt" in line.lower():
            false_positives_count += 1
            continue
            
        # 2. Filter out 'đóng băng' when it means freeze weights/layers/states/accounts/parameters/policies (academic)
        if term == "đóng băng" and any(w in line.lower() for w in ["trọng số", "xương sống", "encoder", "layer", "lớp", "mô hình", "tài khoản", "ref_model", "reference", "trạng thái", "bộ nhớ", "tiến trình", "chụp nhanh gpu", "chế độ", "mục tiêu", "giá trị", "chiến lược", "ma trận", "bách khoa toàn thư", "tháp thị giác", "thông số", "tham số", "w_0", "w"]):
            false_positives_count += 1
            continue
            
        # 3. Filter out 'mùi' when it means 'pheromone' or 'vệt mùi' (academic ACO)
        if term == "mùi" and any(w in line.lower() for w in ["pheromone", "vệt mùi", "nồng độ", "đường đi"]):
            false_positives_count += 1
            continue
            
        # 4. Filter out 'sừng' if it means anatomical sừng (like horn of cow, etc.) or something valid
        
        # 5. Filter out 'râu' when it refers to actual hair/whiskers in image generation (StyleGAN, facial hair)
        if term == "râu" and any(w in line.lower() for w in ["sợi râu", "nếp nhăn", "sợi tóc", "khuôn mặt"]):
            false_positives_count += 1
            continue

        # If it passes all filters, it is a True Positive!
        filtered_occurrences.append(occ)
        true_positives_count += 1
        
    if filtered_occurrences:
        true_positives[file] = filtered_occurrences

print(f"Total True Positives: {true_positives_count}")
print(f"Total False Positives filtered out: {false_positives_count}")
print(f"Files with True Positives: {len(true_positives)}\n")

# Save a clean report
clean_report_path = Path(r"c:\Users\vutm\Desktop\workspace\tinix-r2ai-roadmap\.agent\scratch\clean_scan_report.json")
clean_report_path.write_text(json.dumps(true_positives, ensure_ascii=False, indent=2), encoding='utf-8')

for file, occurrences in sorted(true_positives.items()):
    rel_path = file.replace("c:\\Users\\vutm\\Desktop\\workspace\\tinix-r2ai-roadmap\\", "")
    try:
        print(f"File: {rel_path} ({len(occurrences)} true occurrences)")
        for occ in occurrences:
            print(f"  Line {occ['line_number']} [{occ['term']}]: {occ['line_content']}")
        print("-" * 60)
    except Exception:
        try:
            print(f"File (safe print): {rel_path} ({len(occurrences)} true occurrences)")
        except Exception:
            pass

