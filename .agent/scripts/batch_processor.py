#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
batch_processor.py - Helper for batch translating quizzes via AI Agent
Supports collecting untranslated files and applying translated batches safely.
"""

import sys
import json
import argparse
from pathlib import Path
from quiz_tool import find_quiz_files, validate_quiz, get_md5, save_cache, load_cache
from datetime import datetime

# Force UTF-8
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

WORKSPACE_DIR = Path(__file__).resolve().parents[2]

def run_get_batch(args):
    """Find the first N untranslated files and dump their content into a single JSON."""
    quiz_files = find_quiz_files()
    cache = load_cache()
    
    pending_files = []
    for q_path in quiz_files:
        rel_path = q_path.relative_to(WORKSPACE_DIR)
        vi_path = q_path.parent / "quiz.vi.json"
        
        # Check if already translated and valid in cache
        md5_val = get_md5(q_path)
        cache_entry = cache.get(str(rel_path))
        
        is_done = False
        if vi_path.exists() and cache_entry and cache_entry.get("md5") == md5_val:
            is_done = True
            
        if not is_done:
            pending_files.append(q_path)
            if len(pending_files) >= args.size:
                break
                
    if not pending_files:
        result = {"status": "no_pending_files"}
    else:
        result = {}
        for q_path in pending_files:
            rel_path = q_path.relative_to(WORKSPACE_DIR)
            try:
                with open(q_path, 'r', encoding='utf-8') as f:
                    result[str(rel_path)] = json.load(f)
            except Exception as e:
                print(f"Error reading {rel_path}: {str(e)}", file=sys.stderr)
                
    json_str = json.dumps(result, ensure_ascii=False, indent=2)
    
    if args.out:
        out_path = Path(args.out).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(json_str)
        print(f"Đã ghi {len(result)} tệp chưa dịch vào: {out_path}")
    else:
        print(json_str)

def run_apply_batch(args):
    """Read translations from a JSON file, validate them, write them, and update cache."""
    batch_file = Path(args.file).resolve()
    if not batch_file.exists():
        print(f"Error: Batch file {batch_file} not found.")
        sys.exit(1)
        
    try:
        with open(batch_file, 'r', encoding='utf-8') as f:
            batch_data = json.load(f)
    except Exception as e:
        print(f"Error parsing batch JSON: {str(e)}")
        sys.exit(1)
        
    cache = load_cache()
    success_count = 0
    fail_count = 0
    
    print(f"=== ĐANG ÁP DỤNG BATCH DỊCH THUẬT TỪ {batch_file.name} ===")
    
    for rel_path_str, vi_data in batch_data.items():
        en_path = WORKSPACE_DIR / rel_path_str
        vi_path = en_path.parent / "quiz.vi.json"
        
        if not en_path.exists():
            print(f"[❌ LỖI] Đường dẫn tệp gốc không tồn tại: {rel_path_str}")
            fail_count += 1
            continue
            
        # Write temporarily to run validate
        try:
            vi_path.parent.mkdir(parents=True, exist_ok=True)
            with open(vi_path, 'w', encoding='utf-8') as f:
                json.dump(vi_data, f, ensure_ascii=False, indent=2)
                
            # Validate
            errs, warns = validate_quiz(en_path, vi_path)
            if errs:
                print(f"[❌ THẤT BẠI] {rel_path_str}")
                for e in errs:
                    print(f"   - {e}")
                vi_path.unlink() # remove invalid file
                fail_count += 1
            else:
                md5_val = get_md5(en_path)
                cache[rel_path_str] = {
                    "md5": md5_val,
                    "translated_at": datetime.now().isoformat(),
                    "success": True
                }
                print(f"[✓ THÀNH CÔNG] Đã ghi và cache: {rel_path_str}")
                success_count += 1
        except Exception as e:
            print(f"[❌ LỖI HỆ THỐNG] Không thể xử lý {rel_path_str}: {str(e)}")
            if vi_path.exists():
                vi_path.unlink()
            fail_count += 1
            
    save_cache(cache)
    print("=" * 60)
    print(f"Hoàn thành: Thành công={success_count} | Thất bại={fail_count}")
    
    if fail_count > 0:
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Bộ điều phối dịch thuật hàng loạt bằng Tác nhân AI")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    # get-batch
    get_parser = subparsers.add_parser("get-batch", help="Lấy ra danh sách các tệp quiz chưa dịch")
    get_parser.add_argument("--size", type=int, default=10, help="Số lượng tệp cần dịch trong đợt này")
    get_parser.add_argument("--out", help="Ghi kết quả ra tệp thay vì in ra màn hình")
    
    # apply-batch
    apply_parser = subparsers.add_parser("apply-batch", help="Áp dụng bản dịch hàng loạt từ tệp JSON")
    apply_parser.add_argument("--file", required=True, help="Đường dẫn đến tệp JSON chứa bản dịch")
    
    args = parser.parse_args()
    
    if args.command == "get-batch":
        run_get_batch(args)
    elif args.command == "apply-batch":
        run_apply_batch(args)

if __name__ == "__main__":
    main()
