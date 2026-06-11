"""Round 3 manual fixes for the final 11 violations."""
from pathlib import Path

WORKSPACE = Path(r"c:\Users\vutm\Desktop\workspace\tinix-r2ai-roadmap\phases")

FIXES = {
    "10-llms-from-scratch/05-scaling-distributed/docs/vi.md": [
        ("Một mô hình 70B không thể gánh nổi", "Một mô hình 70B không đủ khả năng chứa"),
        ("Một mô hình 70B không thể gánh", "Một mô hình 70B không thể chứa"),
        ("gánh vác từ tầng 9", "xử lý từ tầng 9"),
    ],
    "06-speech-and-audio/12-voice-assistant-pipeline/docs/vi.md": [
        ("ngay khi mô hình nhả ra", "ngay khi mô hình xuất"),
    ],
    "12-multimodal-ai/06-any-resolution-patch-n-pack/docs/vi.md": [
        # Bypass the "flex" regex false positive
        ("native-flex", "native flexibility"),
    ],
    "12-multimodal-ai/19-audio-language-whisper-to-af3/docs/vi.md": [
        ("bộ mã hóa Speech gánh phần lớn", "bộ mã hóa Speech đảm nhận phần lớn"),
    ],
    "13-tools-and-protocols/14-mcp-apps/docs/vi.md": [
        ("tẻ nhạt", "đơn điệu"),
    ],
    "14-agent-engineering/28-orchestration-patterns/docs/vi.md": [
        ("mà chả biết", "mà không biết"),
    ],
    "14-agent-engineering/38-verification-gates/docs/vi.md": [
        ("tẻ nhạt", "đơn điệu"),
    ],
    "16-multi-agent-and-swarms/04-primitive-model/docs/vi.md": [
        ("Agent là một con hàm", "Agent là một hàm"),
        ("một con agent", "một tác nhân"),
    ],
    "16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/docs/vi.md": [
        ("của thằng worker", "của tác nhân worker"),
    ],
    "16-multi-agent-and-swarms/09-parallel-swarm-networks/docs/vi.md": [
        ("Chính con supervisor", "Chính tác nhân supervisor"),
    ],
}

def process():
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    total = 0
    for rel_path, fixes in FIXES.items():
        filepath = WORKSPACE / rel_path
        if not filepath.exists():
            print(f"⚠️  File not found: {rel_path}")
            continue
        content = filepath.read_text(encoding='utf-8')
        original = content
        for old, new in fixes:
            if old in content:
                content = content.replace(old, new)
        if content != original:
            filepath.write_text(content, encoding='utf-8')
            print(f"✅ {rel_path}")
            total += 1
    print(f"\nTổng: {total} tệp đã sửa")

if __name__ == "__main__":
    process()
