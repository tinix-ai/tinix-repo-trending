"""
Tầng 1: Expanded Academic Style Audit Scanner
Scans all vi.md and quiz.vi.json files for informal/colloquial language
that the original scan_informal.py missed.

Categories:
  A. Personalized pronouns for tech components
  B. Street/violence/vivid metaphors  
  C. Colloquial verbs and phrases
  D. Informal expressions
  E. Common typos
  F. Hacker/gamer culture language
"""
import re
import json
from pathlib import Path

WORKSPACE = Path(r"c:\Users\vutm\Desktop\workspace\tinix-r2ai-roadmap\phases")

# ── Category A: Personalized pronouns for technical components ──
# These are used informally to refer to agents/models/components
CAT_A = [
    # "gã" (dude/guy) used for technical roles
    (r'\bgã\s+(?:chỉ trích|lập kế hoạch|Executor|Planner|Critic|Verifier|Designer|Engineer|coder|reviewer|checker|agent|tác nhân)', 'A-pronoun', 'Đại từ nhân hóa "gã" cho thành phần kỹ thuật'),
    # "tay" (fellow) used for technical roles
    (r'\btay\s+(?:Executor|Planner|Critic|Verifier|Designer|Engineer|coder|reviewer|checker|agent|tác nhân)', 'A-pronoun', 'Đại từ nhân hóa "tay" cho thành phần kỹ thuật'),
    # "hắn ta" referring to a system component
    (r'\bhắn\s+ta\b', 'A-pronoun', 'Đại từ "hắn ta" — phi học thuật'),
    # "con" used as classifier for LLM/AI/model (animal classifier)
    (r'\bcon\s+(?:LLM|AI|model|mô hình|bot|chatbot|bugs?|bug|agent|tác nhân)', 'A-pronoun', 'Lượng từ "con" cho LLM/model — phi học thuật'),
    # "ông" used informally for coder/developer
    (r'\bông\s+(?:coder|developer|kỹ sư|engineer|reviewer|designer)', 'A-pronoun', 'Đại từ "ông" cho vai trò kỹ thuật'),
    # "mống" — "chả có mống nào" (not a single soul)
    (r'\bmống\s+nào\b', 'A-pronoun', '"mống nào" — khẩu ngữ cực kỳ thô'),
    # "đứa nào" (which kid) — very informal
    (r'\bđứa\s+nào\b', 'A-pronoun', '"đứa nào" — khẩu ngữ thô'),
    # "thằng" (that guy - very rude) for tech
    (r'\bthằng\s+\w+', 'A-pronoun', '"thằng" — khẩu ngữ rất thô'),
    # standalone "gã" near technical context
    (r'\bgã\s+(?:này|đó|kia)\b', 'A-pronoun', '"gã này/đó" — phi học thuật'),
]

# ── Category B: Street/violence/vivid metaphors ──
CAT_B = [
    (r'\bđấm\s+cho\b', 'B-metaphor', 'Ẩn dụ bạo lực "đấm cho"'),
    (r'\btòi\s+mặt\b', 'B-metaphor', 'Ẩn dụ "tòi mặt"'),
    (r'\bbới\s+bèo\s+ra\s+bọ\b', 'B-metaphor', '"bới bèo ra bọ" — thành ngữ khẩu ngữ'),
    (r'\bphanh\s+phui\b', 'B-metaphor', '"phanh phui" — quá kịch tính'),
    (r'\bdắt\s+mũi\b', 'B-metaphor', '"dắt mũi" — ẩn dụ đường phố'),
    (r'\btịt\s+ngòi\b', 'B-metaphor', '"tịt ngòi" — khẩu ngữ thô'),
    (r'\bnhả\s+ra\b', 'B-metaphor', '"nhả ra" — quá hình tượng (nên dùng: tạo ra, sinh ra, xuất ra)'),
    (r'\bchả\s+(?:có|thèm|bao\s+giờ|tài\s+nào|ai|được)\b', 'B-colloquial', '"chả" — khẩu ngữ (nên dùng: không, chẳng)'),
    (r'\bchẳng\s+tài\s+nào\b', 'B-colloquial', '"chẳng tài nào" — khẩu ngữ'),
    (r'\bcắm\s+đầu\b', 'B-metaphor', '"cắm đầu" — khẩu ngữ'),
    (r'\bcâu\s+thần\s+chú\b', 'B-metaphor', '"câu thần chú" — ẩn dụ phi học thuật'),
    (r'\btuyệt\s+chiêu\b', 'B-metaphor', '"tuyệt chiêu" — ngôn ngữ game/hacker'),
    (r'\bđám\s+ô\s+hợp\b', 'B-metaphor', '"đám ô hợp" — miệt thị'),
    (r'\bvăn\s+vở\b', 'B-metaphor', '"văn vở" — khẩu ngữ mỉa mai'),
    (r'\blọt\s+tai\b', 'B-metaphor', '"lọt tai" — khẩu ngữ'),
    (r'\bhớ\s+hênh\b', 'B-metaphor', '"hớ hênh" — khẩu ngữ'),
    (r'\bchịu\s+cứng\b', 'B-colloquial', '"chịu cứng" — khẩu ngữ'),
    (r'\bcày\s+lại\b', 'B-colloquial', '"cày lại" — tiếng lóng game'),
    (r'\bthẩy\s+thẳng\b', 'B-colloquial', '"thẩy thẳng" — khẩu ngữ thô'),
    (r'\bcho\s+ra\s+nhẽ\b', 'B-colloquial', '"cho ra nhẽ" — khẩu ngữ'),
    (r'\bhỏi\s+cho\s+ra\s+nhẽ\b', 'B-colloquial', '"hỏi cho ra nhẽ" — khẩu ngữ'),
    (r'\bquăng\b(?!\s+(?:bom|lựu|đạn))', 'B-colloquial', '"quăng" — khẩu ngữ (nên dùng: đưa vào, đặt vào)'),
    (r'\bbứng\b', 'B-colloquial', '"bứng" — khẩu ngữ (nên dùng: trích xuất, chuyển)'),
    (r'\bnhét\b(?!\s+(?:vào|thêm)\s+(?:túi|bao|hộp))', 'B-colloquial', '"nhét" — khẩu ngữ (nên dùng: tích hợp, thêm vào, cài đặt)'),
    (r'\bgánh\b(?!\s+(?:nặng|hàng|chịu))', 'B-colloquial', '"gánh" — khẩu ngữ (nên dùng: đảm nhận, xử lý)'),
    (r'\blàng\s+nhàng\b', 'B-colloquial', '"làng nhàng" — khẩu ngữ (nên dùng: tầm thường, trung bình)'),
    (r'\btẻ\s+nhạt\b', 'B-colloquial', '"tẻ nhạt" — borderline nhưng OK nếu ngữ cảnh phù hợp'),
    (r'\bkìm\s+kẹp\b', 'B-metaphor', '"kìm kẹp" — ẩn dụ quá hình tượng'),
    (r'\bcỗ\s+máy\s+kiểm\s+toán\b', 'B-metaphor', '"cỗ máy kiểm toán" — cần đơn giản hóa'),
    (r'\bmổ\s+xẻ\b', 'B-metaphor', '"mổ xẻ" — quá hình tượng cho học thuật (nên dùng: phân tích)'),
    (r'\bsoi\s+được\b', 'B-colloquial', '"soi được" — khẩu ngữ (nên dùng: phát hiện)'),
    (r'\btóm\s+bug\b', 'B-colloquial', '"tóm bug" — tiếng lóng lập trình'),
    (r'\bcưỡng\s+bức\b(?!.*(?:tình|dục|thể\s+chất))', 'B-metaphor', '"cưỡng bức" — ẩn dụ không phù hợp nếu dùng cho kỹ thuật'),
    (r'\bép\s+khuôn\b', 'B-metaphor', '"ép khuôn" — khẩu ngữ (nên dùng: cấu trúc hóa, ràng buộc)'),
    (r'\bôm\b(?=\s+(?:các|những|prompt|code|schema))', 'B-colloquial', '"ôm" — khẩu ngữ (nên dùng: chứa, quản lý)'),
    # Extreme informal
    (r'\bđố\s+đứa\s+nào\b', 'B-extreme', '"đố đứa nào" — cực kỳ phi học thuật'),
    (r'\bchơi\s+kiểu\b', 'B-extreme', '"chơi kiểu" — tiếng lóng'),
    (r'\bgọi\s+thẳng\s+tên\b', 'B-colloquial', '"gọi thẳng tên" — quá trực tiếp'),
    (r'\bcả\s+thảy\b', 'B-colloquial', '"cả thảy" — khẩu ngữ (nên dùng: tổng cộng, tất cả)'),
    (r'\bvỡ\s+trận\b', 'B-metaphor', '"vỡ trận" — ẩn dụ quân sự khẩu ngữ'),
    (r'\bngón\s+võ\b', 'B-metaphor', '"ngón võ" — ẩn dụ võ thuật'),
    (r'\bcái\s+bẫy\s+vô\s+tận\b', 'B-metaphor', '"cái bẫy vô tận" — quá kịch tính'),
    (r'\bchê\s+dẫn\s+đến\b', 'B-colloquial', '"chê dẫn đến" — khẩu ngữ'),
    (r'\bchốt\s+sổ\b', 'B-colloquial', '"chốt sổ" — tiếng lóng kế toán/đường phố'),
    (r'\bđi\s+tự\s+phát\s+biểu\b', 'B-colloquial', '"đi tự phát biểu" — khẩu ngữ'),
    (r'\bảo\s+tưởng\s+tạo\s+ra\b', 'B-colloquial', '"ảo tưởng tạo ra" — phi học thuật'),
]

# ── Category C: Common typos in Vietnamese ──
CAT_C = [
    (r'\bđảm\s+nhậm\b', 'C-typo', 'Lỗi chính tả: "đảm nhậm" → "đảm nhận"'),
    (r'\bmặu\s+hình\b', 'C-typo', 'Lỗi chính tả: "mặu hình" → "mẫu hình"'),
    (r'\bkháng\s+nghị\b(?=.*(?:bug|lỗi|code))', 'C-typo', 'Khả năng lỗi dùng từ: "kháng nghị" trong ngữ cảnh kỹ thuật'),
]

# ── Category D: Hacker/gamer culture ──  
CAT_D = [
    (r'\bnerd\b', 'D-culture', 'Từ tiếng lóng văn hóa'),
    (r'\bhack\s+não\b', 'D-culture', '"hack não" — tiếng lóng'),
    (r'\bpro\s+max\b', 'D-culture', '"pro max" — tiếng lóng'),
    (r'\bflex\b(?!ible|ibility|box)', 'D-culture', '"flex" — tiếng lóng mạng'),
    (r'\bchill\b', 'D-culture', '"chill" — tiếng lóng mạng'),
]

ALL_PATTERNS = CAT_A + CAT_B + CAT_C + CAT_D

# Compile all
COMPILED = [(re.compile(pat, re.IGNORECASE), cat, desc) for pat, cat, desc in ALL_PATTERNS]

def scan_file(filepath):
    """Scan a single file and return list of findings."""
    try:
        content = filepath.read_text(encoding='utf-8')
    except Exception as e:
        return [{'error': str(e)}]
    
    findings = []
    lines = content.splitlines()
    
    for idx, line in enumerate(lines):
        # Skip code blocks
        stripped = line.strip()
        if stripped.startswith('```') or stripped.startswith('|') and '---' in stripped:
            continue
        # Skip lines that are pure code/math
        if stripped.startswith('$') or stripped.startswith('import ') or stripped.startswith('def ') or stripped.startswith('class '):
            continue
            
        for pattern, cat, desc in COMPILED:
            matches = pattern.findall(line)
            if matches:
                findings.append({
                    'line': idx + 1,
                    'category': cat,
                    'description': desc,
                    'matched': matches[0] if isinstance(matches[0], str) else matches[0],
                    'context': stripped[:200]
                })
    
    return findings

def scan_all():
    """Scan all vi.md and quiz.vi.json files."""
    vi_files = sorted(WORKSPACE.rglob("vi.md"))
    quiz_files = sorted(WORKSPACE.rglob("quiz.vi.json"))
    
    results = {}
    total_findings = 0
    files_with_issues = 0
    
    # Scan vi.md files
    for fp in vi_files:
        findings = scan_file(fp)
        if findings:
            rel = str(fp).replace(str(WORKSPACE.parent) + "\\", "")
            results[rel] = findings
            total_findings += len(findings)
            files_with_issues += 1
    
    # Scan quiz.vi.json files
    for fp in quiz_files:
        findings = scan_file(fp)
        if findings:
            rel = str(fp).replace(str(WORKSPACE.parent) + "\\", "")
            results[rel] = findings
            total_findings += len(findings)
            files_with_issues += 1
    
    return results, total_findings, files_with_issues, len(vi_files), len(quiz_files)

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    
    results, total, flagged, vi_count, quiz_count = scan_all()
    
    print(f"=" * 70)
    print(f"TẦNG 1: KẾT QUẢ RÀ SOÁT HỌC THUẬT MỞ RỘNG")
    print(f"=" * 70)
    print(f"Tổng tệp vi.md quét:       {vi_count}")
    print(f"Tổng tệp quiz.vi.json quét: {quiz_count}")
    print(f"Tổng vi phạm phát hiện:     {total}")
    print(f"Số tệp có vi phạm:         {flagged}")
    print(f"=" * 70)
    
    # Group by category
    cat_counts = {}
    for file, findings in results.items():
        for f in findings:
            cat = f.get('category', 'unknown')
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
    
    print(f"\nPhân loại vi phạm:")
    for cat, count in sorted(cat_counts.items()):
        print(f"  {cat:20s}: {count:4d} lần")
    
    print(f"\n{'=' * 70}")
    print(f"CHI TIẾT THEO TỆP (sắp xếp theo số lượng vi phạm giảm dần):")
    print(f"{'=' * 70}")
    
    sorted_results = sorted(results.items(), key=lambda x: len(x[1]), reverse=True)
    
    for file, findings in sorted_results:
        print(f"\n📄 {file} ({len(findings)} vi phạm)")
        for f in findings:
            if 'error' in f:
                print(f"  ⚠️  Error: {f['error']}")
            else:
                print(f"  L{f['line']:4d} [{f['category']:12s}] {f['description']}")
                print(f"         → \"{f['context'][:120]}\"")
    
    # Save report
    report_path = WORKSPACE.parent / ".agent" / "scratch" / "audit_report.json"
    report_path.write_text(json.dumps({
        'summary': {
            'vi_files_scanned': vi_count,
            'quiz_files_scanned': quiz_count,
            'total_findings': total,
            'files_flagged': flagged,
            'category_counts': cat_counts,
        },
        'details': {k: v for k, v in sorted_results}
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"\n💾 Báo cáo chi tiết đã lưu: {report_path}")
