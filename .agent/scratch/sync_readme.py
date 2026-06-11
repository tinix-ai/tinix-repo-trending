import re
import json
from pathlib import Path

WORKSPACE = Path(r"c:\Users\vutm\Desktop\workspace\tinix-r2ai-roadmap")
README_PATH = WORKSPACE / "README.md"
SCAN_PATH = WORKSPACE / ".agent" / "scratch" / "lessons_scan.json"

def sync_readme():
    # Load lessons scan data
    scan_data = json.loads(SCAN_PATH.read_text(encoding='utf-8'))
    
    # Flat dict mapping relative docs/vi.md path (lowercased, normalized slashes) to parsed data
    lessons_map = {}
    for phase_name, lessons in scan_data.items():
        for lesson in lessons:
            lesson_folder = lesson["lesson_folder"]
            # Relative path as stored in README.md links
            rel_link = f"phases/{phase_name}/{lesson_folder}/docs/vi.md"
            norm_link = rel_link.replace("\\", "/").lower()
            lessons_map[norm_link] = lesson

    # Read README
    readme_text = README_PATH.read_text(encoding='utf-8')
    
    # 1. Clean up informal slang in introductory sections
    slang_reps = [
        # Intro paragraph lines 18-20
        (r'Mỗi bài học đẻ ra một sản phẩm thực chiến', r'Mỗi bài học tạo ra một sản phẩm thực chiến'),
        
        # Section "Lộ trình này hoạt động thế nào"
        (r'Phần lớn tài liệu AI dạy theo kiểu mảnh vụn\.', r'Phần lớn tài liệu AI hiện nay tiếp cận theo hướng manh mún.'),
        (r'Một paper ở đây, một bài fine-tuning ở kia, một demo agent lòe loẹt ở chỗ khác\.', r'Một bài báo khoa học ở đây, một bài hướng dẫn tinh chỉnh (fine-tuning) ở kia, một bản demo tác nhân (agent) đơn giản ở chỗ khác.'),
        (r'Các mảnh ghép hiếm khi ăn khớp nhau\.', r'Các mảnh ghép hiếm khi có sự liên kết thống nhất.'),
        (r'Bạn ship một chatbot nhưng không giải thích nổi loss curve\.', r'Bạn có thể xây dựng một chatbot nhưng không giải thích được đồ thị hàm mất mát (loss curve).'),
        (r'Bạn gắn function vào agent nhưng không biết attention bên trong model đang làm gì\.', r'Bạn tích hợp chức năng (function calling) vào tác nhân nhưng không hiểu cơ chế chú ý (attention) bên trong mô hình đang vận hành như thế nào.'),
        
        # Section "Lộ trình này là xương sống"
        (r'Lộ trình này là xương sống\.', r'Lộ trình này là khung xương sống vững chắc.'),
        (r'20 phases, 435 bài, song ngữ Anh-Việt\.', r'20 giai đoạn (phases), 435 bài học được thiết kế theo dạng song ngữ Anh-Việt.'),
        (r'Đại số tuyến tính ở đáy, autonomous swarms ở đỉnh\.', r'Đại số tuyến tính làm nền tảng cốt lõi, và hệ thống bầy đàn tự trị (autonomous swarms) là cấp độ chuyên sâu cao nhất.'),
        (r'Mọi thuật toán được xây từ toán thô trước\.', r'Mọi thuật toán đều được xây dựng từ nền tảng toán học thô trước,'),
        (r'Khi PyTorch xuất hiện, bạn đã biết nó đang làm gì bên trong\.', r'Khi tiếp cận PyTorch, bạn đã hiểu rõ nguyên lý vận hành bên trong của nó.'),
        
        # Section "Hình dạng lộ trình"
        (r'20 phases xếp chồng lên nhau\.', r'20 giai đoạn (phases) được thiết kế xếp chồng lên nhau một cách khoa học.'),
        (r'Toán là nền\. Agents và production là mái\.', r'Toán học là nền móng, trong khi các tác nhân (agents) và hệ thống vận hành (production) là phần mái.'),
        (r'Nhảy cóc nếu bạn đã vững tầng dưới, nhưng đừng nhảy rồi thắc mắc tại sao tầng trên vỡ\.', r'Bạn có thể bỏ qua một số giai đoạn nếu đã vững kiến thức bên dưới, nhưng nên tránh việc đốt cháy giai đoạn để không gặp khó khăn khi tiếp cận các cấu phần nâng cao.')
    ]
    
    for old, new in slang_reps:
        readme_text = re.sub(old, new, readme_text)
        
    # 2. Update lesson tables in README.md
    lines = readme_text.splitlines()
    updated_lines = []
    table_row_count = 0
    
    # Regex to match README table rows for lessons
    # Example: | 01 | Dev Environment | [vi](phases/00-setup-and-tooling/01-dev-environment/docs/vi.md) |
    row_pattern = re.compile(r'^(\|\s*[0-9]{2}\s*\|)([^\|]+)(\|\s*\[vi\]\((phases/[^/]+/[^/]+/docs/vi\.md)\)\s*\|)$', re.IGNORECASE)
    
    for idx, line in enumerate(lines):
        match = row_pattern.match(line)
        if match:
            prefix = match.group(1)
            original_title = match.group(2).strip()
            suffix = match.group(3)
            rel_link = match.group(4).strip()
            
            norm_link = rel_link.replace("\\", "/").lower()
            
            if norm_link in lessons_map:
                lesson = lessons_map[norm_link]
                vi_title = lesson["extracted_vi_title"]
                en_title = lesson["extracted_vi_en_part"] or lesson["extracted_en_title"]
                
                # Format bilingual title: Vietnamese (English)
                bilingual_title = f" {vi_title} ({en_title}) "
                
                # Replace the middle part with bilingual title
                new_line = f"{prefix}{bilingual_title}{suffix}"
                updated_lines.append(new_line)
                table_row_count += 1
            else:
                print(f"Warning: Link {rel_link} not found in scan data.")
                updated_lines.append(line)
        else:
            updated_lines.append(line)
            
    # Write back to README.md
    new_content = "\n".join(updated_lines) + "\n"
    README_PATH.write_text(new_content, encoding='utf-8')
    print(f"Successfully processed README.md.")
    print(f"Colloquial slang removed from introduction.")
    print(f"Updated {table_row_count} lesson titles in tables to bilingual format.")

if __name__ == "__main__":
    sync_readme()
