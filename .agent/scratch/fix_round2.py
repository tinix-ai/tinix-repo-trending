"""Round 2 fixes for remaining violations after first batch fix."""
from pathlib import Path

WORKSPACE = Path(r"c:\Users\vutm\Desktop\workspace\tinix-r2ai-roadmap\phases")

FIXES = {
    # Phase 10 scaling - "gánh" remaining  
    "10-llms-from-scratch/05-scaling-distributed/docs/vi.md": [
        ("không thể gánh nổi cùng lúc", "không đủ dung lượng để chứa cùng lúc"),
        ("gánh vác từ tầng", "xử lý từ tầng"),
    ],
    # Phase 12 - "mổ xẻ" in heading
    "16-multi-agent-and-swarms/04-primitive-model/docs/vi.md": [
        ("### Mổ xẻ từng thành phần nguyên thủy", "### Phân tích từng thành phần nguyên thủy"),
        ("một con agent", "một tác nhân (agent)"),
    ],
    # Phase 06 voice assistant - "nhả ra"
    "06-speech-and-audio/12-voice-assistant-pipeline/docs/vi.md": [
        ("khi mô hình nhả ra", "khi mô hình xuất"),
    ],
    # Phase 12 audio - "gánh"
    "12-multimodal-ai/19-audio-language-whisper-to-af3/docs/vi.md": [
        ("gánh phần lớn", "chịu trách nhiệm xử lý phần lớn"),
    ],
    # Phase 14 orchestration - "chả"
    "14-agent-engineering/28-orchestration-patterns/docs/vi.md": [
        ("chả bao giờ tiến triển", "không bao giờ tiến triển"),
    ],
    # Phase 16 supervisor - "thằng"  
    "16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/docs/vi.md": [
        ("thằng worker", "tác nhân worker"),
    ],
    # Phase 16 parallel swarm - "con supervisor"
    "16-multi-agent-and-swarms/09-parallel-swarm-networks/docs/vi.md": [
        ("con supervisor", "tác nhân supervisor"),
    ],
    # Phase 12 flex - false positive (NaFlex is a proper name)
    # No fix needed
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
