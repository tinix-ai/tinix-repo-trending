import json
from pathlib import Path

REPLACEMENTS = {
    r"phases\06-speech-and-audio\04-speech-recognition-asr\docs\vi.md": [
        ("- Nhược điểm: Rất khó huấn luyện và ngốn RAM.", "- Nhược điểm: Rất khó huấn luyện và yêu cầu dung lượng RAM lớn.")
    ],
    r"phases\10-llms-from-scratch\04-pre-training-mini-gpt\docs\vi.md": [
        ("tác vụ suy luận chuỗi dài (long-context inference) cực kỳ ngốn bộ nhớ GPU.", "tác vụ suy luận chuỗi dài (long-context inference) cực kỳ tiêu tốn bộ nhớ GPU.")
    ],
    r"phases\10-llms-from-scratch\05-scaling-distributed\docs\vi.md": [
        ("Riêng phần trọng số đã ngốn mất 140GB bộ nhớ ở định dạng FP16.", "Riêng phần trọng số đã tiêu tốn tới 140GB bộ nhớ ở định dạng FP16."),
        ("đây mới chính là nơi ngốn nhiều bộ nhớ nhất của hệ thống.", "đây mới chính là nơi tiêu thụ nhiều bộ nhớ nhất của hệ thống.")
    ],
    r"phases\10-llms-from-scratch\07-rlhf\docs\vi.md": [
        ("tạo ra các câu trả lời có điểm số cao ngất ngưởng trên mô hình phần thưởng", "tạo ra các câu trả lời có điểm số cao bất thường trên mô hình phần thưởng")
    ],
    r"phases\10-llms-from-scratch\08-dpo\docs\vi.md": [
        ("Chỉ riêng mô hình phần thưởng đã ngốn hàng nghìn cặp so sánh sở thích", "Chỉ riêng mô hình phần thưởng đã tiêu tốn hàng nghìn cặp so sánh sở thích")
    ],
    r"phases\10-llms-from-scratch\09-constitutional-ai-self-improvement\docs\vi.md": [
        ("Siêu mô hình Llama 2 Chat ngốn tới hơn 1,5 triệu cặp.", "Siêu mô hình Llama 2 Chat tiêu thụ tới hơn 1,5 triệu cặp.")
    ],
    r"phases\10-llms-from-scratch\11-quantization\docs\vi.md": [
        ("riêng KV cache đã ngốn tới 40GB ở định dạng FP16.", "riêng KV cache đã chiếm tới 40GB ở định dạng FP16.")
    ],
    r"phases\10-llms-from-scratch\12-inference-optimization\docs\vi.md": [
        ("Llama 3 70B ngốn tới 40GB KV Cache —", "Llama 3 70B tiêu tốn tới 40GB KV Cache —")
    ],
    r"phases\10-llms-from-scratch\13-building-complete-llm-pipeline\docs\vi.md": [
        ("DeepSeek-V3 cũng ngốn khoảng 2.8 triệu giờ chạy", "DeepSeek-V3 cũng tiêu tốn khoảng 2.8 triệu giờ chạy")
    ],
    r"phases\10-llms-from-scratch\17-native-sparse-attention\docs\vi.md": [
        ("cơ chế Attention ngốn tới 70-80% tổng độ trễ giải mã", "cơ chế Attention chiếm tới 70-80% tổng độ trễ giải mã")
    ],
    r"phases\10-llms-from-scratch\20-deepseek-v3-walkthrough\docs\vi.md": [
        ("đầu 128) sẽ ngốn:", "đầu 128) sẽ tiêu tốn:")
    ],
    r"phases\10-llms-from-scratch\22-async-hogwild-inference\docs\vi.md": [
        ("chuỗi dài 50k tokens sẽ ngốn tới 24 phút.", "chuỗi dài 50k tokens sẽ tiêu tốn tới 24 phút.")
    ],
    r"phases\10-llms-from-scratch\34-gradient-checkpointing\docs\vi.md": [
        ("Một mô hình gồm 64 tầng sẽ ngốn tới **51 GB** bộ nhớ", "Một mô hình gồm 64 tầng sẽ tiêu tốn tới **51 GB** bộ nhớ")
    ],
    r"phases\11-llm-engineering\05-context-engineering\docs\vi.md": [
        ("bị đổ đống rác dữ liệu.", "chứa đầy dữ liệu rác ít giá trị."),
        ("nó ngốn tới 7,500 token trước khi", "nó tiêu tốn tới 7,500 token trước khi"),
        ("hội thoại dài 50 lượt có thể ngốn tới 10,000 token", "hội thoại dài 50 lượt có thể tiêu tốn tới 10,000 token"),
        ("10 lượt hội thoại cũ ngốn tới 2,000 token.", "10 lượt hội thoại cũ tiêu tốn tới 2,000 token."),
        ("thành phần ngốn quá nhiều token một cách vô ích", "thành phần tiêu tốn quá nhiều token một cách vô ích")
    ],
    r"phases\11-llm-engineering\08-fine-tuning-lora\docs\vi.md": [
        ("ngốn đến 16GB chỉ để tải trọng số", "tiêu tốn tới 16GB chỉ để tải trọng số"),
        ("cũng ngốn một lượng bộ nhớ đáng kể.", "cũng tiêu tốn một lượng bộ nhớ đáng kể.")
    ],
    r"phases\11-llm-engineering\11-caching-cost\docs\vi.md": [
        ("mười lượt gọi mỗi ngày sẽ ngốn tới $250 chỉ riêng cho token đầu vào", "mười lượt gọi mỗi ngày sẽ tiêu tốn tới $250 chỉ riêng cho token đầu vào")
    ],
    r"phases\11-llm-engineering\13-production-app\docs\vi.md": [
        ("nào đang ngốn tiền nhiều nhất.", "nào đang tiêu tốn chi vụ chi phí nhiều nhất.")
    ],
    r"phases\11-llm-engineering\15-prompt-caching\docs\vi.md": [
        ("sẽ ngốn hết $0.90 chỉ riêng cho chi phí", "sẽ tiêu tốn hết $0.90 chỉ riêng cho chi phí")
    ],
    r"phases\11-llm-engineering\17-agent-framework-tradeoffs\docs\vi.md": [
        ("định tuyến động bằng LLM ngốn thêm rất nhiều token", "định tuyến động bằng LLM tiêu tốn thêm rất nhiều token")
    ],
    r"phases\12-multimodal-ai\03-blip2-qformer-bridge\docs\vi.md": [
        ("tháp thị giác ViT đông băng xuất ra", "tháp thị giác ViT đóng băng xuất ra"),
        ("mô hình LLM 7B đông băng mong muốn nhận", "mô hình LLM 7B đóng băng mong muốn nhận"),
        ("diện thị giác đã ngốn mất 8192 token của LLM.", "diện thị giác đã tiêu tốn mất 8192 token của LLM.")
    ],
    r"phases\12-multimodal-ai\06-any-resolution-patch-n-pack\docs\vi.md": [
        ("tháp thị giác đông băng chỉ hỗ trợ", "tháp thị giác đóng băng chỉ hỗ trợ"),
        ("sẽ ngốn tới $9216 + 576 \\approx 9800$ token", "sẽ tiêu tốn tới $9216 + 576 \\approx 9800$ token")
    ],
    r"phases\13-tools-and-protocols\01-the-tool-interface\docs\vi.md": [
        ("tác nhân tự chạy vòng lặp ngốn mất $400 tiền API", "tác nhân tự chạy vòng lặp tiêu tốn mất $400 tiền API")
    ],
    r"phases\13-tools-and-protocols\03-parallel-and-streaming-tool-calls\docs\vi.md": [
        ("sẽ ngốn tới ba lượt gọi mạng (round trips).", "sẽ tiêu tốn tới ba lượt gọi mạng (round trips)."),
        ("Chu trình này ngốn tới 3 lượt gọi mạng LLM khứ hồi", "Chu trình này tiêu tốn tới 3 lượt gọi mạng LLM khứ hồi")
    ],
    r"phases\13-tools-and-protocols\04-structured-output\docs\vi.md": [
        ("lỗi cắt cụt token sẽ ngốn thêm tối thiểu một lượt gọi", "lỗi cắt cụt token sẽ tiêu tốn thêm tối thiểu một lượt gọi")
    ],
    r"phases\13-tools-and-protocols\07-building-an-mcp-server\docs\vi.md": [
        ("tiếp tục ngốn tài nguyên RAM của hệ thống.", "tiếp tục tiêu thụ tài nguyên RAM của hệ thống.")
    ],
    r"phases\13-tools-and-protocols\13-mcp-async-tasks\docs\vi.md": [
        ("ID tác vụ đã bốc hơi hoàn toàn khỏi RAM", "ID tác vụ đã biến mất hoàn toàn khỏi RAM")
    ],
    r"phases\13-tools-and-protocols\21-llm-routing-layer\docs\vi.md": [
        ("phản hồi của tác nhân AI sẽ bị đóng băng.", "phản hồi của tác nhân AI sẽ bị treo cứng.")
    ],
    r"phases\16-multi-agent-and-swarms\09-parallel-swarm-networks\docs\vi.md": [
        ("cho phép nhảy lặp (cycles) và đẻ ra đặc tính bất cứ nút nào", "cho phép nhảy lặp (cycles) và tạo ra đặc tính bất cứ nút nào")
    ]
}

def apply_fixes():
    base_dir = Path(r"c:\Users\vutm\Desktop\workspace\tinix-r2ai-roadmap")
    success_count = 0
    total_fixes = 0
    
    for rel_path, reps in REPLACEMENTS.items():
        file_path = base_dir / rel_path
        if not file_path.exists():
            print(f"File not found: {rel_path}")
            continue
            
        content = file_path.read_text(encoding='utf-8')
        modified = False
        
        for target, replacement in reps:
            if target in content:
                content = content.replace(target, replacement)
                modified = True
                total_fixes += 1
                print(f"Replaced target in file: {rel_path}")
            else:
                # Do not print non-ascii target to avoid cp1252 crash
                print(f"Target not found in: {rel_path}")
                
        if modified:
            file_path.write_text(content, encoding='utf-8')
            success_count += 1
            
    print(f"\nSuccessfully updated {success_count} files. Total replacements applied: {total_fixes}")

if __name__ == "__main__":
    apply_fixes()
