#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
quiz_tool.py - Zero-dependency CLI Tool for Quiz Translation and Validation
Supports: MD5 caching, structural consistency verification, slang detection, and Gemini API translations.
"""

import os
import sys
import json
import hashlib
import argparse
import urllib.request
import urllib.error
import re
from pathlib import Path
from datetime import datetime

# Force UTF-8 output on Windows
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

WORKSPACE_DIR = Path(__file__).resolve().parents[2]
PHASES_DIR = WORKSPACE_DIR / "phases"
CACHE_FILE = WORKSPACE_DIR / ".agent" / "scratch" / "quiz_cache.json"

# Prohibited slang/informal patterns and their academic recommendations
SLANG_PATTERNS = {
    r"\bbốc hơi\b": "bị phá hủy / bị mất mát",
    r"\bđắp chiếu\b": "vô hiệu hóa / ngừng hoạt động",
    r"\bmớm\b": "cung cấp đầu vào / chuyển dữ liệu",
    r"\bđẻ ra\b": "tạo ra / phát sinh",
    r"\bngốn\b": "tiêu thụ / tiêu tốn",
    r"\bngon lành\b": "ổn định / đạt yêu cầu",
    r"\bquay xe\b": "quay lại / hủy bỏ",
    r"\blọt khe\b": "đạt yêu cầu / bỏ sót",
    r"\bsập\b": "gặp sự cố / ngừng hoạt động",
    r"\bchém gió\b": "phát biểu thiếu căn cứ",
    r"\brâu ông nọ\b": "lẫn lộn thông tin",
    r"\bphọt ra\b": "xuất ra",
    r"\bọc ra\b": "xuất ra",
    r"\bphun trào\b": "phát sinh",
    r"\brặn\b": "tạo / xuất",
    r"\bgã tác nhân\b": "tác nhân",
    r"\bgã mô hình\b": "mô hình",
    r"\btay tác nhân\b": "tác nhân",
    r"\bnhai nát\b": "xử lý toàn bộ",
}

def get_md5(file_path):
    """Compute MD5 checksum of a file."""
    hasher = hashlib.md5()
    with open(file_path, 'rb') as f:
        buf = f.read()
        hasher.update(buf)
    return hasher.hexdigest()

def load_cache():
    """Load translation cache."""
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_cache(cache):
    """Save translation cache."""
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

def find_quiz_files():
    """Recursively find all quiz.json files in the phases directory."""
    quiz_files = []
    for root, _, files in os.walk(PHASES_DIR):
        for file in files:
            if file == "quiz.json":
                quiz_files.append(Path(root) / file)
    return sorted(quiz_files)

def validate_quiz(en_path, vi_path):
    """Validate a translated quiz.vi.json against the original quiz.json."""
    errors = []
    warnings = []

    if not vi_path.exists():
        errors.append(f"Tệp dịch {vi_path.name} không tồn tại.")
        return errors, warnings

    try:
        with open(en_path, 'r', encoding='utf-8') as f:
            en_data = json.load(f)
    except Exception as e:
        errors.append(f"Không thể đọc tệp gốc {en_path.name}: {str(e)}")
        return errors, warnings

    try:
        with open(vi_path, 'r', encoding='utf-8') as f:
            vi_data = json.load(f)
    except Exception as e:
        errors.append(f"Tệp dịch {vi_path.name} không đúng định dạng JSON: {str(e)}")
        return errors, warnings

    # Check top-level structure
    if isinstance(en_data, list):
        if not isinstance(vi_data, list):
            errors.append("Định dạng cấp cao nhất không khớp: gốc là danh sách (array) nhưng bản dịch không phải.")
            return errors, warnings
        en_questions = en_data
        vi_questions = vi_data
    else:
        if not isinstance(en_data, dict):
            errors.append("Định dạng tệp gốc không hợp lệ (không phải danh sách cũng không phải từ điển).")
            return errors, warnings
        if not isinstance(vi_data, dict):
            errors.append("Định dạng cấp cao nhất không khớp: gốc là từ điển (object) nhưng bản dịch không phải.")
            return errors, warnings
        if "questions" not in vi_data:
            errors.append("Thiếu trường 'questions' ở cấp cao nhất trong tệp dịch.")
            return errors, warnings
        en_questions = en_data.get("questions", [])
        vi_questions = vi_data.get("questions", [])

    if len(en_questions) != len(vi_questions):
        errors.append(f"Số lượng câu hỏi không khớp: gốc={len(en_questions)}, dịch={len(vi_questions)}")
        return errors, warnings

    for idx, (en_q, vi_q) in enumerate(zip(en_questions, vi_questions)):
        q_label = f"Câu hỏi {idx + 1}"

        # 1. Check required fields
        for field in ["stage", "question", "options", "correct", "explanation"]:
            if field not in vi_q:
                errors.append(f"{q_label}: Thiếu trường bắt buộc '{field}'")
                return errors, warnings

        # 2. Verify stage matches
        if en_q["stage"] != vi_q["stage"]:
            errors.append(f"{q_label}: Trường 'stage' không khớp (gốc='{en_q['stage']}', dịch='{vi_q['stage']}')")

        # 3. Verify correct index matches
        if en_q["correct"] != vi_q["correct"]:
            errors.append(f"{q_label}: Trường 'correct' không khớp (gốc={en_q['correct']}, dịch={vi_q['correct']})")

        # 4. Verify options length matches
        en_opt = en_q.get("options", [])
        vi_opt = vi_q.get("options", [])
        if len(en_opt) != len(vi_opt):
            errors.append(f"{q_label}: Số lượng phương án lựa chọn không khớp (gốc={len(en_opt)}, dịch={len(vi_opt)})")

        # 5. Check empty strings
        if not str(vi_q["question"]).strip():
            errors.append(f"{q_label}: Nội dung câu hỏi trống.")
        if not str(vi_q["explanation"]).strip():
            errors.append(f"{q_label}: Giải thích câu hỏi trống.")
        for o_idx, opt in enumerate(vi_opt):
            if not str(opt).strip():
                errors.append(f"{q_label}, phương án {o_idx + 1}: Nội dung trống.")

        # 6. Slang check in translated texts (question, options, explanation)
        texts_to_check = [
            ("question", vi_q["question"]),
            ("explanation", vi_q["explanation"])
        ]
        for o_idx, opt in enumerate(vi_opt):
            texts_to_check.append((f"options[{o_idx}]", opt))

        for text_label, text in texts_to_check:
            for slang_pat, replacement in SLANG_PATTERNS.items():
                if re.search(slang_pat, str(text), re.IGNORECASE):
                    # Check exceptions (like 'mùi' in 'pheromone' or 'đóng băng' in weights)
                    if "pheromone" in str(text).lower() and slang_pat == r"\bmùi\b":
                        continue
                    errors.append(
                        f"{q_label} ({text_label}): Phát hiện từ lóng '{re.findall(slang_pat, str(text), re.IGNORECASE)[0]}'. "
                        f"Vui lòng thay thế bằng văn phong học thuật hơn (ví dụ: {replacement})."
                    )

    return errors, warnings

def run_status(args):
    """Display status of all quiz files in the workspace."""
    quiz_files = find_quiz_files()
    cache = load_cache()

    total = len(quiz_files)
    translated = 0
    pending = 0
    outdated = 0
    invalid = 0

    print(f"=== BÁO CÁO TRẠNG THÁI QUIZ (Tổng số: {total} tệp) ===")
    print(f"{'Tệp':<85} | {'Trạng thái':<15} | {'Mã MD5':<32}")
    print("-" * 140)

    for q_path in quiz_files:
        rel_path = q_path.relative_to(WORKSPACE_DIR)
        vi_path = q_path.parent / "quiz.vi.json"
        
        status_str = "Chưa dịch"
        md5_val = get_md5(q_path)
        
        if vi_path.exists():
            # Check cache
            cache_entry = cache.get(str(rel_path))
            if cache_entry and cache_entry.get("md5") == md5_val:
                # Let's perform a validation check just to be sure
                errs, _ = validate_quiz(q_path, vi_path)
                if not errs:
                    status_str = "Đã hoàn thành"
                    translated += 1
                else:
                    status_str = "Lỗi kiểm chuẩn"
                    invalid += 1
            else:
                if not cache_entry:
                    status_str = "Chưa lưu cache"
                    # Validate
                    errs, _ = validate_quiz(q_path, vi_path)
                    if not errs:
                        status_str = "Đã dịch (Chưa cache)"
                        translated += 1
                    else:
                        status_str = "Lỗi kiểm chuẩn"
                        invalid += 1
                else:
                    status_str = "Gốc bị sửa đổi"
                    outdated += 1
        else:
            pending += 1

        print(f"{str(rel_path):<85} | {status_str:<15} | {md5_val:<32}")

    print("-" * 140)
    print(f"Tóm tắt: Đã dịch={translated} | Chưa dịch={pending} | Bị thay đổi={outdated} | Lỗi kiểm chuẩn={invalid} | Tổng={total}")

def run_validate(args):
    """Validate specific or all quiz files in the workspace."""
    quiz_files = find_quiz_files()
    cache = load_cache()
    
    target_files = []
    if args.file:
        file_path = Path(args.file).resolve()
        if file_path.name == "quiz.json":
            target_files.append(file_path)
        elif file_path.name == "quiz.vi.json":
            target_files.append(file_path.parent / "quiz.json")
        else:
            print(f"Lỗi: Đường dẫn phải trỏ tới quiz.json hoặc quiz.vi.json. Nhận được: {args.file}")
            sys.exit(1)
    else:
        target_files = quiz_files

    print(f"=== ĐANG CHẠY KIỂM CHUẨN TRÊN {len(target_files)} TỆP TRẮC NGHIỆM ===")
    
    total_errors = 0
    total_warnings = 0
    validated_count = 0
    
    for en_path in target_files:
        vi_path = en_path.parent / "quiz.vi.json"
        rel_path = en_path.relative_to(WORKSPACE_DIR)
        
        if not vi_path.exists():
            print(f"[⚠️ CHƯA DỊCH] {str(rel_path)}")
            continue
            
        errs, warns = validate_quiz(en_path, vi_path)
        validated_count += 1
        
        if errs or warns:
            print(f"[❌ LỖI] {str(rel_path)}")
            for e in errs:
                print(f"   - Error: {e}")
                total_errors += 1
            for w in warns:
                print(f"   - Warning: {w}")
                total_warnings += 1
        else:
            # Update cache if valid
            md5_val = get_md5(en_path)
            cache[str(rel_path)] = {
                "md5": md5_val,
                "translated_at": datetime.now().isoformat(),
                "success": True
            }
            print(f"[✓ HỢP LỆ] {str(rel_path)}")

    save_cache(cache)
    print("=" * 60)
    print(f"Kết quả: Đã quét={validated_count} tệp | Lỗi cấu trúc/từ lóng={total_errors} | Cảnh báo={total_warnings}")
    
    if total_errors > 0:
        sys.exit(1)
    else:
        print("Mọi tệp trắc nghiệm được quét đều HỢP LỆ và ĐẠT CHUẨN học thuật!")

def translate_quiz_via_gemini(en_data, api_key):
    """Translate quiz content using Gemini 1.5 Flash via standard library urllib."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    # Prompt enforcing structural outputs and strictly academic tone
    prompt = f"""
Translate the following English quiz structure into Vietnamese (Academic tone).
Strictly follow these rules:
1. Preserve the JSON keys and structure completely. Only translate the values of "question", "options" array, and "explanation".
2. Keep the number of options exactly the same, and preserve their relative ordering so the 0-indexed "correct" answer index is still 100% correct.
3. Translate into high-quality, professional, serious, and formal academic Vietnamese.
4. Avoid any informal slang, hacker slang, or casual language. DO NOT use: "bốc hơi", "đắp chiếu", "mớm", "đẻ ra", "ngốn", "ngon lành", "sập", "quay xe", "lọt khe".
5. Keep specialized technical terms in English if they are common and do not have an established academic Vietnamese translation (e.g., PyTorch, CUDA, GPU, uv, pipeline, JAX, Hugging Face, etc.).

Original JSON to translate:
{json.dumps(en_data, ensure_ascii=False, indent=2)}

Respond with ONLY the raw translated JSON. No markdown wrappers like ```json or similar, just the raw JSON.
"""

    payload = {
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }

    req_data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=req_data,
        headers={'Content-Type': 'application/json'}
    )

    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode('utf-8')
            res_json = json.loads(res_body)
            # Extract generated text
            text_out = res_json['candidates'][0]['content']['parts'][0]['text']
            # Clean up potential markdown wrapper just in case
            text_out = text_out.strip()
            if text_out.startswith("```json"):
                text_out = text_out[7:]
            if text_out.endswith("```"):
                text_out = text_out[:-3]
            translated_data = json.loads(text_out.strip())
            return translated_data
    except Exception as e:
        raise RuntimeError(f"API Call failed: {str(e)}")

def run_translate(args):
    """Automatically translate quizzes using Gemini API."""
    api_key = args.api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Lỗi: Bạn cần cung cấp khóa API bằng tham số --api-key hoặc biến môi trường GEMINI_API_KEY.")
        sys.exit(1)

    quiz_files = find_quiz_files()
    cache = load_cache()
    
    target_files = []
    if args.file:
        file_path = Path(args.file).resolve()
        if file_path.name == "quiz.json":
            target_files.append(file_path)
        else:
            print(f"Lỗi: Đường dẫn phải trỏ tới quiz.json. Nhận được: {args.file}")
            sys.exit(1)
    else:
        # Translate pending or modified files
        for q_path in quiz_files:
            rel_path = q_path.relative_to(WORKSPACE_DIR)
            vi_path = q_path.parent / "quiz.vi.json"
            md5_val = get_md5(q_path)
            
            cache_entry = cache.get(str(rel_path))
            if args.force or not vi_path.exists() or not cache_entry or cache_entry.get("md5") != md5_val:
                target_files.append(q_path)

    if not target_files:
        print("Không có tệp nào cần dịch hoặc cập nhật.")
        return

    print(f"=== ĐANG TIẾN HÀNH DỊCH TỰ ĐỘNG KHỞI CHẠY CHO {len(target_files)} TỆP ===")
    
    success_count = 0
    for idx, en_path in enumerate(target_files):
        rel_path = en_path.relative_to(WORKSPACE_DIR)
        vi_path = en_path.parent / "quiz.vi.json"
        
        print(f"[{idx+1}/{len(target_files)}] Đang dịch {str(rel_path)}...")
        
        try:
            with open(en_path, 'r', encoding='utf-8') as f:
                en_data = json.load(f)
            
            # API Translation call
            translated_json = translate_quiz_via_gemini(en_data, api_key)
            
            # Write temporary output to validate
            with open(vi_path, 'w', encoding='utf-8') as f:
                json.dump(translated_json, f, ensure_ascii=False, indent=2)
                
            # Immediately validate
            errs, _ = validate_quiz(en_path, vi_path)
            if errs:
                print(f"   [❌ LỖI KIỂM CHUẨN BẢN DỊCH TỪ API]")
                for e in errs:
                    print(f"      - {e}")
                # Remove invalid file so it gets retried
                if vi_path.exists():
                    vi_path.unlink()
            else:
                md5_val = get_md5(en_path)
                cache[str(rel_path)] = {
                    "md5": md5_val,
                    "translated_at": datetime.now().isoformat(),
                    "success": True
                }
                print(f"   [✓ THÀNH CÔNG] Đã lưu {vi_path.name} và ghi cache.")
                success_count += 1
                
        except Exception as e:
            print(f"   [❌ LỖI TIẾN TRÌNH] {str(e)}")
            
    save_cache(cache)
    print("=" * 60)
    print(f"Hoàn tất dịch thuật: {success_count}/{len(target_files)} tệp thành công.")

def run_clean(args):
    """Remove quiz.vi.json files and reset cache."""
    quiz_files = find_quiz_files()
    removed_files = 0
    
    print("=== ĐANG DỌN DẸP BẢN DỊCH VÀ BỘ ĐỆM CACHE ===")
    for q_path in quiz_files:
        vi_path = q_path.parent / "quiz.vi.json"
        if vi_path.exists():
            vi_path.unlink()
            removed_files += 1
            
    if CACHE_FILE.exists():
        CACHE_FILE.unlink()
        print("Đã xóa bộ đệm cache .quiz_cache.json")
        
    print(f"Đã dọn dẹp thành công. Đã xóa {removed_files} tệp quiz.vi.json.")

def main():
    parser = argparse.ArgumentParser(description="Công cụ quản lý dịch thuật và kiểm chuẩn hệ thống Quiz JSON")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # status
    subparsers.add_parser("status", help="Hiển thị trạng thái dịch thuật và cache của tất cả các tệp quiz.json")

    # validate
    val_parser = subparsers.add_parser("validate", help="Xác thực chất lượng dịch thuật và cấu trúc JSON")
    val_parser.add_argument("--file", help="Đường dẫn đến tệp quiz.json hoặc quiz.vi.json cụ thể cần xác thực")

    # translate
    trans_parser = subparsers.add_parser("translate", help="Tự động dịch các tệp quiz chưa dịch qua Gemini API")
    trans_parser.add_argument("--file", help="Đường dẫn đến tệp quiz.json cụ thể cần dịch")
    trans_parser.add_argument("--api-key", help="Khóa API Gemini (nếu không được thiết lập trong biến môi trường)")
    trans_parser.add_argument("--force", action="store_true", help="Ép buộc dịch lại kể cả khi tệp đã được dịch và lưu cache")

    # clean
    subparsers.add_parser("clean", help="Xóa bỏ toàn bộ tệp quiz.vi.json đã tạo và làm sạch cache")

    args = parser.parse_args()

    if args.command == "status":
        run_status(args)
    elif args.command == "validate":
        run_validate(args)
    elif args.command == "translate":
        run_translate(args)
    elif args.command == "clean":
        run_clean(args)

if __name__ == "__main__":
    main()
