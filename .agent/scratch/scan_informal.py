import os
import re
import json
from pathlib import Path

WORKSPACE = Path(r"c:\Users\vutm\Desktop\workspace\tinix-r2ai-roadmap\phases")

# List of informal words/phrases with regex word boundaries
# Using \b to ensure we match whole syllables
INFORMAL_WORDS = [
    r'\bgăm\b',
    r'\brâu\b',
    r'\bsừng\b',
    r'\bmùi\b',
    r'\bđếch\b',
    r'\bđếu\b',
    r'\bmẹ kiếp\b',
    r'\bchó má\b',
    r'\bvãi\b',
    r'\bthớt\b',
    r'\bngã ngũ\b',
    r'\bnẹt bô\b',
    r'\bchém gió\b',
    r'\bnặn ra\b',
    r'\brặn đẻ\b',
    r'\brặn nghĩ\b',
    r'\bphun trào\b',
    r'\btuồn ra\b',
    r'\bngốn\b',
    r'\băn chặn\b',
    r'\bcá kiếm\b',
    r'\bvòi tiền\b',
    r'\bbịt miệng\b',
    r'\bđỡ đạn\b',
    r'\bbẻ lái\b',
    r'\bquay xe\b',
    r'\blọt khe\b',
    r'\bhót dọn\b',
    r'\bphi tang\b',
    r'\blôi cổ\b',
    r'\bchui ụp\b',
    r'\bxả ra\b',
    r'\bnháy lệnh\b',
    r'\btem thời gian\b',
    r'\btem đồng hồ\b',
    r'\bbùa chú\b',
    r'\brước bùa\b',
    r'\bmúa bút\b',
    r'\bđống rác\b',
    r'\bđống xà bần\b',
    r'\bthánh vật\b',
    r'\bngồi xổm\b',
    r'\báo gấm đi đêm\b',
    r'\bđơn thương độc mã\b',
    r'\bđeo bám\b',
    r'\bđớp\b',
    r'\bhá mỏ\b',
    r'\bchỏ mỏ\b',
    r'\bhóng hớt\b',
    r'\blóng ngóng\b',
    r'\bđuổi ẹo\b',
    r'\bsờ gáy\b',
    r'\bhạch họe\b',
    r'\bcòi hiệu\b',
    r'\bthe thé\b',
    r'\boằn mình\b',
    r'\boằn lưng\b',
    r'\băn đứt\b',
    r'\bbá đạo\b',
    r'\bngon lành\b',
    r'\bngon nghẻ\b',
    r'\bxịn\b',
    r'\bxịn mịn\b',
    r'\bngất ngưởng\b',
    r'\bchạy mất dép\b',
    r'\bkhóc thét\b',
    r'\bquỳ gối\b',
    r'\bphất cờ\b',
    r'\bchĩa súng\b',
    r'\bđắt cắt cổ\b',
    r'\bcắt cổ\b',
    r'\bđầu sỏ\b',
    r'\bcướp mồi\b',
    r'\btha mồi\b',
    r'\bmớm\b',
    r'\bmớm mồi\b',
    r'\bvọc\b',
    r'\bvọc vạch\b',
    r'\btọc mạch\b',
    r'\bphọt\b',
    r'\bđẻ ra\b',
    r'\blột xác\b',
    r'\bchết yểu\b',
    r'\bsập tiệm\b',
    r'\bbay màu\b',
    r'\bbốc hơi\b',
    r'\bđắp chiếu\b',
    r'\bđóng băng\b',
    r'\băn cháo đá bát\b',
    r'\bqua cầu rút ván\b',
    r'\bđem con bỏ chợ\b',
    r'\bnước đổ đầu vịt\b',
    r'\bnước đổ lá khoai\b',
    r'\bcưỡi ngựa xem hoa\b',
    r'\bđầu voi đuôi chuột\b',
    r'\bthượng vàng hạ cám\b',
    r'\brâu ông nọ cắm cằm bà kia\b'
]

# Compile regexes
REGEX_PATTERNS = [(term, re.compile(term, re.IGNORECASE)) for term in INFORMAL_WORDS]

def scan_files():
    vi_files = sorted(WORKSPACE.rglob("vi.md"))
    results = {}
    total_matches = 0
    
    for filepath in vi_files:
        try:
            content = filepath.read_text(encoding='utf-8')
            found_terms = []
            
            # Find all matches using compiled regexes
            lines = content.splitlines()
            for idx, line in enumerate(lines):
                for term_raw, pattern in REGEX_PATTERNS:
                    matches = pattern.findall(line)
                    if matches:
                        # Apply smart exclusions
                        # 1. Pheromone in swarm optimization
                        if term_raw == r'\bmùi\b' and ("pheromone" in line.lower() or "vệt mùi" in line.lower()):
                            continue
                        # 2. Actual facial hair in StyleGAN/Multimodal
                        if term_raw == r'\brâu\b' and ("sợi râu" in line.lower() or "nếp nhăn" in line.lower() or "sợi tóc" in line.lower()):
                            continue
                        # 3. Legitimate RL terms (kẹt vĩnh viễn) or similar
                        
                        found_terms.append({
                            'term': term_raw.replace(r'\b', ''),
                            'line_number': idx + 1,
                            'line_content': line.strip()
                        })
                        total_matches += 1
            
            if found_terms:
                results[str(filepath)] = found_terms
        except Exception as e:
            print(f"Error reading {filepath}: {e}")
            
    return results, total_matches

if __name__ == "__main__":
    scan_results, total_count = scan_files()
    print(f"Found {len(scan_results)} files with potential informal terms. Total matches: {total_count}\n")
    
    # Save detailed JSON report
    report_path = Path(r"c:\Users\vutm\Desktop\workspace\tinix-r2ai-roadmap\.agent\scratch\scan_report.json")
    # Make dict serializable by converting Path to str
    serializable_results = {str(k): v for k, v in scan_results.items()}
    report_path.write_text(json.dumps(serializable_results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Detailed scan report saved to: {report_path}\n")
    
    # Print the findings
    for file, terms in scan_results.items():
        rel_path = file.replace(str(WORKSPACE.parent) + "\\", "")
        try:
            print(f"File: {rel_path} ({len(terms)} occurrences)")
            for item in terms[:3]: # Show top 3
                print(f"  Line {item['line_number']} [{item['term']}]: {item['line_content']}")
            if len(terms) > 3:
                print(f"  ... and {len(terms) - 3} more")
            print("-" * 50)
        except Exception:
            # Fallback if Windows terminal doesn't support UTF-8 print
            try:
                print(f"File (safe print): {rel_path} ({len(terms)} occurrences)")
            except Exception:
                pass

