"""
Batch fix script: Sửa toàn bộ 58 tệp vi.md bị phát hiện vi phạm văn phong học thuật.

Chiến lược: Dùng dict replacements để thay thế chính xác từng cụm từ vi phạm.
Chia thành 2 loại:
  1. Global replacements: Cụm từ có thể thay thế an toàn ở mọi nơi
  2. Contextual replacements: Cần xử lý theo ngữ cảnh cụ thể từng file
"""
import re
from pathlib import Path

WORKSPACE = Path(r"c:\Users\vutm\Desktop\workspace\tinix-r2ai-roadmap\phases")

# ────────────────────────────────────────────
# GLOBAL REPLACEMENTS (safe to apply everywhere)
# ────────────────────────────────────────────
GLOBAL_REPLACEMENTS = [
    # "mổ xẻ" → "phân tích" (20+ occurrences across many files)
    ("mổ xẻ", "phân tích"),
    # "gánh vác" → "đảm nhận" 
    ("gánh vác", "đảm nhận"),
    # "nhồi nhét" → "đưa vào" / "nạp vào"
    ("nhồi nhét", "đưa vào"),
    # "nhét vừa" → "triển khai"
    ("nhét vừa", "triển khai"),
    # "câu thần chú" (used as magic spell metaphor) → "câu lệnh kích hoạt"
    ("câu thần chú ma thuật", "câu lệnh kích hoạt"),
    ("Câu thần chú", "Từ khóa kích hoạt"),
    ("câu thần chú", "câu lệnh kích hoạt"),
    # "tuyệt chiêu" → "kỹ thuật then chốt"  
    ("tuyệt chiêu", "kỹ thuật then chốt"),
    # "cày lại" → "thực hiện lại"
    ("cày lại", "thực hiện lại"),
    # "lọt tai" → "chấp nhận được về mặt chất lượng"
    ("có lọt tai người", "đạt chất lượng cho người nghe"),
    ("lọt tai", "dễ nghe"),
    # "đảm nhậm" (typo) → "đảm nhận"
    ("đảm nhậm", "đảm nhận"),
    # "mặu hình" (typo) → "mẫu hình"
    ("mặu hình", "mẫu hình"),
    # "phanh phui" → "phát hiện" / "ghi nhận"
    ("lột mặt nạ phanh phui", "phát hiện và ghi nhận"),
    ("phanh phui", "phát hiện"),
    # "tịt ngòi" → "ngừng hoạt động" / "thất bại"
    ("tịt ngòi âm thầm", "thất bại một cách âm thầm"),
    ("bị tịt ngòi", "bị vô hiệu hóa"),
    ("tịt ngòi", "ngừng hoạt động"),
    # "dắt mũi" → "chi phối" / "điều khiển"
    ("dắt mũi", "chi phối"),
    # "chốt sổ" → "quyết định"
    ("chốt sổ", "đưa ra phán quyết"),
    # "cưỡng bức" (in tech context) → "bắt buộc"
    ("Cưỡng bức gọi hàm", "Bắt buộc gọi hàm"),
    ("cưỡng bức", "bắt buộc"),
    # "quăng" → "chuyển"
    ("quăng kế bên", "đặt bên cạnh"),
    # "bứng" → "chuyển" / "trích xuất"
    ("bứng mấy cái", "chuyển các"),
    ("bứng các tác nhân thả vào", "triển khai các tác nhân vào"),
    ("bứng", "chuyển"),
]

def apply_global_replacements(content):
    """Apply safe global text replacements."""
    count = 0
    for old, new in GLOBAL_REPLACEMENTS:
        if old in content:
            n = content.count(old)
            content = content.replace(old, new)
            count += n
    return content, count

# ────────────────────────────────────────────
# FILE-SPECIFIC FIXES
# ────────────────────────────────────────────

def fix_role_specialization(content):
    """Fix phases/16-multi-agent-and-swarms/08-role-specialization/docs/vi.md
    This file needs the most extensive rewriting.
    """
    replacements = [
        # Line 12: Complete rewrite of the problem statement
        (
            "Những hệ thống đa tác nhân mang tính chung chung (Generic multi-agent systems) sẽ chỉ nhả ra những kết quả chung chung. Quăng ba ông coder (người viết code) vào chung một group chat, kết quả thu được sẽ là ba phiên bản khác nhau của cùng một đoạn code làng nhàng tẻ nhạt (mediocre code). Bạn có cố nhét thêm hàng tá tác nhân, thêm cả chục vòng (rounds) nữa thì nó vẫn chẳng tài nào vượt qua nổi ngưỡng chất lượng.",
            "Những hệ thống đa tác nhân mang tính chung chung (Generic multi-agent systems) chỉ tạo ra những kết quả chung chung. Đặt ba tác nhân lập trình (coder) vào chung một group chat, kết quả thu được sẽ là ba phiên bản khác nhau của cùng một đoạn mã tầm thường (mediocre code). Dù có bổ sung thêm hàng tá tác nhân, thêm cả chục vòng lặp (rounds), hệ thống vẫn không thể vượt qua ngưỡng chất lượng."
        ),
        # Line 14: Fix informal pronouns
        (
            "Cách sửa lỗi không phải là thêm vào nhiều tác nhân hơn — mà phải là các tác nhân *khác biệt (different)*. Hãy giao những vai trò riêng biệt (distinct roles). Trao cho gã chỉ trích (critic) mấy món công cụ mà gã lập kế hoạch (planner) không hề có. Phát cho người xác minh (verifier) một bộ bài test thực dụng và khách quan (objective test suite). Tới lúc này, hệ thống sẽ thực sự có những sự mâu thuẫn nội bộ (internal disagreement) đi kèm tính năng tự điều chỉnh có căn cứ (grounded correction), thay vì chỉ là sự phỏng đoán song song (parallel guessing).",
            "Giải pháp không phải là bổ sung thêm nhiều tác nhân hơn — mà phải là các tác nhân *khác biệt (different)*. Hãy phân công những vai trò riêng biệt (distinct roles). Cung cấp cho tác nhân phê bình (critic) những công cụ mà tác nhân lập kế hoạch (planner) không sở hữu. Trang bị cho tác nhân xác minh (verifier) một bộ kiểm thử khách quan (objective test suite). Khi đó, hệ thống sẽ thực sự có sự mâu thuẫn nội bộ (internal disagreement) đi kèm khả năng tự điều chỉnh có căn cứ (grounded correction), thay vì chỉ là sự phỏng đoán song song (parallel guessing)."
        ),
        # Line 28
        (
            "Nhà phê bình mang tính chủ quan (subjective), bảo thủ với ý kiến cá nhân (opinionated), và thường được gánh bởi một LLM.",
            "Nhà phê bình mang tính chủ quan (subjective), có lập trường riêng (opinionated), và thường được vận hành bởi một LLM."
        ),
        # Line 32
        (
            "MetaGPT (arXiv:2308.00352) đã mã hóa toàn bộ đống Quy trình làm việc tiêu chuẩn (SOP) của ngành Kỹ nghệ phần mềm (software engineering) nhét vào trong các role prompts (prompt phân vai):",
            "MetaGPT (arXiv:2308.00352) đã mã hóa toàn bộ Quy trình vận hành tiêu chuẩn (SOP) của ngành Kỹ nghệ phần mềm (software engineering) vào trong các role prompts (prompt phân vai):"
        ),
        # Line 40
        (
            "Mỗi vai trò đều bị kìm kẹp bởi một bộ input/output schema nghiêm ngặt. Bản thân cái role prompt đó sẽ nói rõ cho AI biết vai trò của nó *là gì* và nó *phải nhả ra thứ gì*. Nguyên lý `Code = SOP(Team)` — các chuẩn SOP có tính xác định (deterministic) sẽ biến một đội hình LLMs thành một cỗ máy (pipeline) làm việc có thể dự báo trước (predictable).",
            "Mỗi vai trò đều bị ràng buộc bởi một bộ input/output schema nghiêm ngặt. Bản thân role prompt sẽ xác định rõ ràng vai trò của tác nhân *là gì* và đầu ra *phải là gì*. Nguyên lý `Code = SOP(Team)` — các chuẩn SOP có tính xác định (deterministic) sẽ biến một đội hình LLMs thành một đường ống xử lý (pipeline) có thể dự báo trước (predictable)."
        ),
        # Line 44: ChatDev communicative dehallucination
        (
            "ChatDev đã bổ sung một đường cơ bản (key move): khi tay Executor cần tới một chi tiết cụ thể mười mươi nhưng lại vắng mặt trong bản kế hoạch, hắn ta buộc phải gọi thẳng tên tay Designer ra để hỏi cho ra nhẽ trước khi cắm đầu làm tiếp. Điều này chặn đứng tuyệt đối căn bệnh kinh điển (classic failure) của LLM là đi tự phát biểu thiếu căn cứ nghe cho hợp lý (plausibly inventing the detail).",
            "ChatDev đã bổ sung một cải tiến quan trọng (key move): khi tác nhân Executor cần một thông tin chi tiết cụ thể nhưng thông tin đó không có trong bản kế hoạch, tác nhân này buộc phải yêu cầu trực tiếp tác nhân Designer cung cấp trước khi tiếp tục thực thi. Điều này ngăn chặn triệt để lỗi kinh điển (classic failure) của LLM: tự tạo ra thông tin thiếu căn cứ nhưng nghe có vẻ hợp lý (plausibly inventing the detail)."
        ),
        # Line 46
        (
            "Khâu thực thi: trong bản role prompt phải cắm thêm câu thần chú \"khi nào cần những thông tin cụ thể chưa được cung cấp, hãy gọi đích danh vai trò liên quan ra mà hỏi trước khi được phép cho ra kết quả.\"",
            "Cách triển khai: trong role prompt cần bổ sung chỉ thị rõ ràng: \"khi cần các thông tin cụ thể chưa được cung cấp, hãy yêu cầu trực tiếp vai trò liên quan cung cấp trước khi tạo đầu ra.\""
        ),
        # Line 50: MAST findings
        (
            "Nghiên cứu MAST của Cemri và cộng sự đã phanh phui 1642 ca sụp đổ trong việc thực thi ở các hệ thống đa tác nhân. 21.3% trong số đó là do đứt gãy ở khâu xác minh (verification gaps) — hệ thống nhả ra một câu trả lời nhưng chả có mống nào đứng ra kiểm duyệt (checked). Khoảng 79% còn lại đa phần truy vết được về bệnh \"đã cài cắm khâu check nhưng nó tịt ngòi âm thầm (failed silently) hoặc chả bao giờ được gọi chạy\". Khâu Xác minh (Verification) chính là bộ khung chịu tải trọng gánh cả hệ thống.",
            "Nghiên cứu MAST của Cemri và cộng sự đã ghi nhận 1642 trường hợp thất bại trong quá trình thực thi ở các hệ thống đa tác nhân. 21.3% trong số đó là do đứt gãy ở khâu xác minh (verification gaps) — hệ thống tạo ra một câu trả lời nhưng không có thành phần nào thực hiện kiểm tra (checked). Khoảng 79% còn lại phần lớn truy vết được về việc \"đã triển khai khâu kiểm tra nhưng khâu này thất bại một cách âm thầm (failed silently) hoặc không bao giờ được kích hoạt\". Khâu Xác minh (Verification) chính là thành phần chịu tải trọng cốt lõi của toàn hệ thống."
        ),
        # Line 52
        (
            "PwC (trong đợt deploy CrewAI năm 2025) đã báo cáo việc bổ sung một vòng lặp xác thực có cấu trúc (structured validation loop) đã đẩy độ chuẩn xác (accuracy) từ 10% lên 70%. Tăng vọt 7 lần (7×) chỉ nhờ vào đúng 1 cái role (vai trò).",
            "PwC (trong đợt triển khai CrewAI năm 2025) đã báo cáo rằng việc bổ sung một vòng lặp xác thực có cấu trúc (structured validation loop) đã nâng độ chính xác (accuracy) từ 10% lên 70%. Mức cải thiện gấp 7 lần (7×) chỉ nhờ bổ sung duy nhất một vai trò."
        ),
        # Line 56
        (
            "- Critic là một con LLM ngồi đọc review lại cái artifact đó xem chất lượng ra sao. Tính chủ quan cao (Subjective). Rất dễ bị dắt mũi bởi lối hành văn lọt tai (plausible prose).",
            "- Critic là một LLM thực hiện đánh giá chất lượng artifact. Mang tính chủ quan cao (Subjective). Dễ bị ảnh hưởng bởi văn phong nghe hợp lý (plausible prose)."
        ),
        # Line 57
        (
            "- Verifier là một phần mềm (deterministic program) chạy trực tiếp trên cái artifact đó. Hoàn toàn khách quan (Objective). Chốt sổ luôn Đỗ/Trượt (pass/fail) kèm bằng chứng rõ ràng.",
            "- Verifier là một chương trình xác định (deterministic program) thực thi trực tiếp trên artifact. Hoàn toàn khách quan (Objective). Đưa ra phán quyết Đỗ/Trượt (pass/fail) kèm bằng chứng rõ ràng."
        ),
        # Line 59
        (
            "Hãy chơi cả hai (Use both). Critic sẽ bới bèo ra bọ mấy cái lỗi hớ hênh (taste issues) mà Verifier chả tài nào bắt nổi. Ngược lại, Verifier đấm cho mấy con bugs tòi mặt ra những chỗ mà Critic chịu cứng do đống bugs đó chỉ tòi ra vào lúc runtime (chạy thực tế).",
            "Nên sử dụng cả hai (Use both). Critic sẽ phát hiện các lỗi về phong cách (taste issues) mà Verifier không thể nhận diện. Ngược lại, Verifier phát hiện các lỗi chỉ xuất hiện khi chạy thực tế (runtime) mà Critic không có khả năng phát hiện."
        ),
        # Line 63
        (
            "Mọi vị trí trong cái hệ thống của bạn đều đưa một con LLM vào gánh, dẫn đến việc đầu ra của bất kỳ tác nhân nào cũng tự động phản hồi \"đạt yêu cầu\" (looks good to me). Một ca vỡ trận (failure mode) kinh điển chuẩn MAST. Nhất thiết phải nhét ít nhất một gã Verifier với nhiệm vụ phân xử đỗ/trượt hoàn toàn phải do máy móc (code) quyết định chứ tuyệt đối không xài LLM.",
            "Mọi vị trí trong hệ thống đều sử dụng LLM, dẫn đến đầu ra của bất kỳ tác nhân nào cũng tự động được phản hồi là \"đạt yêu cầu\" (looks good to me). Đây là mẫu hình thất bại (failure mode) kinh điển theo phân loại MAST. Bắt buộc phải tích hợp ít nhất một tác nhân Verifier với cơ chế phân xử đỗ/trượt hoàn toàn dựa trên mã nguồn (code-based), không sử dụng LLM."
        ),
        # Line 67
        (
            "- **CrewAI** — hàm `Agent(role, goal, backstory)` chính là bề mặt chuyên môn hóa cực kỳ chuẩn sách giáo khoa.",
            "- **CrewAI** — hàm `Agent(role, goal, backstory)` chính là giao diện chuyên môn hóa vai trò tiêu chuẩn."
        ),
        # Line 68
        (
            "- **LangGraph** — các nodes sẽ ôm các prompt chuyên biệt; các edges (cạnh) ép khuôn thành đường dẫn pipeline.",
            "- **LangGraph** — các nodes chứa các prompt chuyên biệt; các edges (cạnh) định hình đường dẫn pipeline."
        ),
        # Line 78
        (
            "`outputs/skill-role-designer.md` mổ xẻ một task và tự động lên danh sách các nhân sự (role roster) (khoảng 3-5 roles), lập luôn schema cho bộ Input/Output của từng người, và gài thêm cỗ máy kiểm toán (verifier check). Sử dụng tuyệt chiêu này trước khi bứng các tác nhân thả vào trong framework.",
            "`outputs/skill-role-designer.md` phân tích một tác vụ và tự động lập danh sách các vai trò (role roster) (khoảng 3–5 roles), định nghĩa schema Input/Output cho từng vai trò, và tích hợp bước xác minh (verifier check). Sử dụng công cụ này trước khi triển khai các tác nhân vào framework."
        ),
        # Line 84
        (
            "- **Ít nhất phải có một cỗ máy xác minh tự động (deterministic verifier).** Tuyệt đối cấm không được chơi kiểu full-LLM (all-LLM).",
            "- **Bắt buộc có ít nhất một bộ xác minh tự động (deterministic verifier).** Tuyệt đối không sử dụng kiến trúc toàn LLM (all-LLM)."
        ),
        # Line 86
        (
            "Tác nhân Executor phải chủ động hỏi lại Planner khi thấy thiếu thông tin (info is missing); tuyệt đối cấm tự bị áo tưởng tạo ra (never invent it).",
            "Tác nhân Executor phải chủ động yêu cầu Planner cung cấp khi phát hiện thiếu thông tin (info is missing); tuyệt đối không được tự suy diễn (never invent it)."
        ),
        # Line 88
        (
            "Chốt tối đa là 2 lượt đánh bóng (revision rounds) giữa critic-executor, quá số đó thì thẩy thẳng cho Con người (escalating to human).",
            "Giới hạn tối đa 2 lượt chỉnh sửa (revision rounds) giữa critic-executor, vượt quá ngưỡng này thì chuyển giao cho con người xử lý (escalating to human)."
        ),
        # Line 92-95: Exercises rewrite
        (
            "2. Gắn thêm một vị trí thứ 5 (5th role): \"requirements analyst (nhà phân tích yêu cầu)\", dịch yêu cầu của người dùng (wish) thành một spec rõ ràng (planner-ready spec) cho tác nhân Planner. Câu hỏi: những yêu cầu nào thuộc cơ chế Communicative dehallucination (giao tiếp khử ảo giác) nên được chuyển lên (flow up) vai trò này?",
            "2. Bổ sung vai trò thứ 5 (5th role): \"requirements analyst (nhà phân tích yêu cầu)\", chuyển đổi yêu cầu của người dùng (wish) thành một đặc tả rõ ràng (planner-ready spec) cho tác nhân Planner. Câu hỏi: những yêu cầu nào thuộc cơ chế Communicative dehallucination (giao tiếp khử ảo giác) nên được chuyển lên (flow up) vai trò này?"
        ),
        (
            "3. Đọc kĩ đoạn Section 3 (\"Agents\") trong tài liệu MetaGPT. Rút trích ra danh sách input/output schema của cả thảy 5 roles của MetaGPT.",
            "3. Đọc kỹ Section 3 (\"Agents\") trong tài liệu MetaGPT. Trích xuất danh sách input/output schema của toàn bộ 5 vai trò trong MetaGPT."
        ),
        (
            "4. Ngó lại cái sơ đồ chat-chain (chuỗi chat) của ChatDev (arXiv:2307.07924 Figure 3). Định vị cho được chính xác tại khúc nào thì cái ngón võ communicative dehallucination kia đã chặn đứng thành công 1 vòng lặp (breaks a loop) mà đáng lẽ ra sẽ sa vào cái bẫy vô tận (infinite)?",
            "4. Xem xét sơ đồ chat-chain (chuỗi chat) của ChatDev (arXiv:2307.07924 Figure 3). Xác định chính xác vị trí mà cơ chế communicative dehallucination đã ngắt thành công một vòng lặp (breaks a loop) mà nếu không sẽ dẫn đến lặp vô hạn (infinite loop)."
        ),
        (
            "5. Hiệu quả vượt trội gấp 7 lần (7× accuracy gain) mà PwC đạt được toàn bộ xuất phát từ các verification loops. Đề xuất ba trường hợp (hypothesize three tasks) mà việc triển khai verifier không hiệu quả — những trường hợp mà việc kiểm chứng tính đúng đắn tự động (deterministic checking of correctness) là không khả thi (impossible) hoặc quá tốn kém (prohibitively expensive).",
            "5. Mức cải thiện gấp 7 lần (7× accuracy gain) mà PwC đạt được hoàn toàn xuất phát từ các verification loops. Đề xuất ba trường hợp (hypothesize three tasks) mà việc triển khai verifier không mang lại hiệu quả — những trường hợp mà việc kiểm chứng tính đúng đắn tự động (deterministic checking of correctness) là không khả thi (impossible) hoặc quá tốn kém (prohibitively expensive)."
        ),
        # Glossary table fixes
        (
            "| Mô hình SOP (SOP pattern) | \"Quy trình làm việc được đóng gói\" | Thiết kế của MetaGPT: các bộ I/O schemas ngặt nghèo gò một đám ô hợp thành một pipeline chuyên nghiệp. |",
            "| Mô hình SOP (SOP pattern) | \"Quy trình làm việc được đóng gói\" | Thiết kế của MetaGPT: các bộ I/O schemas nghiêm ngặt tổ chức một nhóm tác nhân thành một pipeline có tính hệ thống. |"
        ),
        (
            "| Khử ảo giác qua giao tiếp (Communicative dehallucination) | \"Chưa rõ thì hỏi, cấm phát biểu thiếu căn cứ\" | ChatDev: executor tự giác đi hỏi planner mỗi khi hụt thông tin thay vì tự ảo tưởng tạo ra (making one up). |",
            "| Khử ảo giác qua giao tiếp (Communicative dehallucination) | \"Khi thiếu thông tin, hãy hỏi thay vì suy diễn\" | ChatDev: executor chủ động yêu cầu planner cung cấp khi thiếu thông tin thay vì tự tạo ra (making one up). |"
        ),
        (
            "| Nhà phê bình (Critic) | \"Người review LLM\" | Mang nặng tính chủ quan, bảo thủ (opinionated). Dễ dàng soi được các lỗi hớ hênh (taste issues). Rất dễ bị dắt mũi bởi văn vở lọt tai (plausible prose). |",
            "| Nhà phê bình (Critic) | \"Tác nhân đánh giá LLM\" | Mang tính chủ quan, có lập trường riêng (opinionated). Phát hiện được các lỗi về phong cách (taste issues). Dễ bị ảnh hưởng bởi văn phong hợp lý (plausible prose). |"
        ),
        (
            "| Người xác minh (Verifier) | \"Check tự động\" | Rạch ròi đỗ/trượt (pass/fail) dùng phần mềm. Đóng vai trò test runner, type checker, schema validator. Đố đứa nào dắt mũi được. |",
            "| Người xác minh (Verifier) | \"Kiểm tra tự động\" | Phán quyết rõ ràng đỗ/trượt (pass/fail) bằng phần mềm. Đóng vai trò test runner, type checker, schema validator. Không thể bị ảnh hưởng bởi yếu tố chủ quan. |"
        ),
        (
            "| Lỗ hổng xác minh (Verification gap) | \"Làm xong chả ai thèm check\" | 21.3% cái đám thất bại trong chuẩn MAST rơi vào lỗi này. Nhả đáp án thẳng cho khách mà chưa có 1 lần check để tóm bug. |",
            "| Lỗ hổng xác minh (Verification gap) | \"Hoàn thành mà không qua kiểm tra\" | 21.3% các trường hợp thất bại trong phân loại MAST thuộc lỗi này. Trả kết quả cho người dùng mà không thực hiện bất kỳ lần kiểm tra nào để phát hiện lỗi. |"
        ),
        (
            "| Vòng lặp sửa đổi (Revision loop) | \"Critic gửi trả lại\" | Bị Critic chê dẫn đến executor phải cày lại (re-run) cùng với feedback (phản hồi). Cần giới hạn ngân sách (budget) để chạy. |",
            "| Vòng lặp sửa đổi (Revision loop) | \"Critic gửi trả lại\" | Critic đánh giá không đạt, executor phải thực hiện lại (re-run) kèm theo phản hồi (feedback). Cần giới hạn ngân sách (budget) để kiểm soát. |"
        ),
        (
            "| Anti-pattern All-LLM | \"Trông có vẻ ổn (Looks good to me)\" | Mọi vai trò đều được đảm nhậm bởi một LLM, không có bất kỳ cơ chế kiểm chứng tự động (deterministic check) nào. Đây chính là mặu hình thất bại điển hình (Classic MAST failure). |",
            "| Anti-pattern All-LLM | \"Trông có vẻ ổn (Looks good to me)\" | Mọi vai trò đều được đảm nhận bởi LLM, không có bất kỳ cơ chế kiểm chứng tự động (deterministic check) nào. Đây chính là mẫu hình thất bại điển hình (Classic MAST failure). |"
        ),
        # References
        (
            "bài nghiên cứu tham chiếu chính gốc cho mô hình nhét-SOP-vào-role-prompt",
            "bài nghiên cứu tham chiếu gốc cho mô hình tích hợp SOP vào role prompt"
        ),
    ]
    
    for old, new in replacements:
        content = content.replace(old, new)
    return content


def fix_hierarchical_architecture(content):
    """Fix phases/16-multi-agent-and-swarms/06-hierarchical-architecture/docs/vi.md"""
    replacements = [
        # "thằng" references
        ("Thằng supervisor", "Tác nhân supervisor"),
        ("thằng supervisor", "tác nhân supervisor"),
        ("thằng worker", "tác nhân worker"),
        ("1 thằng worker", "1 tác nhân worker"),
        # Line 105
        ("chả ai gọi", "không ai gọi"),
        # Line 116
        ("Đám sub-managers đâm chém nhau (disagree)", "Các sub-manager xung đột với nhau (disagree)"),
        # Line 117 
        ("Đừng rúc sâu quá 2 tầng", "Không nên vượt quá 2 tầng"),
        # Line 118
        ("Gài vô 1 thằng worker chuyên bị đi hỏi", "Cài đặt 1 tác nhân worker chuyên dùng để kiểm tra"),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content


def fix_parallel_swarm(content):
    """Fix phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/docs/vi.md"""
    replacements = [
        ("Chính tay supervisor", "Chính tác nhân supervisor"),
        ("con supervisor", "tác nhân supervisor"),
        ("1 thằng", "một tác nhân"),
        ("thằng", "tác nhân"),
        ("đứa nào", "tác nhân nào"),
        ("rủ nhau đua đòi cấu xé giành giật (pull) bằng sạch đám tác vụ ngon xơi-nhanh gọn lẹ nhất", "cùng cạnh tranh lấy (pull) hết các tác vụ có thời gian xử lý ngắn nhất"),
        ("chả bao giờ", "không bao giờ"),
        ("khóa bóp (limit) cửa vào không cho bao nhiêu lượng fast tasks được nhồi nhét vào hàng đợi", "giới hạn (limit) số lượng fast tasks được đưa vào hàng đợi"),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content


def fix_workbench_why_fail(content):
    """Fix phases/14-agent-engineering/31-agent-workbench-why-models-fail/docs/vi.md"""
    replacements = [
        ("gãy gánh", "thất bại"),
        ("chả ai gọi", "không ai gọi"),
        ("gánh trọng", "chịu tải trọng"),
        ("một con agent nuô", "một agent nuô"),  # Partial fix, need to check context
        ("Thế trận ngăn chặn thói nhét mã (Prompt injection) trú thân đằng sau mạng lưới phòng bị p",
         "Chiến lược ngăn chặn tấn công Prompt injection phía sau lớp phòng thủ"),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content


def fix_init_scripts(content):
    """Fix phases/14-agent-engineering/35-initialization-scripts/docs/vi.md"""
    replacements = [
        ("thay vì cày lại", "thay vì thực hiện lại"),
        ("bốc cung dự án, gom gạch mớ công việc rào dậu khởi động nhét vào thành các probes",
         "thu thập thông tin dự án, tổ chức các bước kiểm tra khởi tạo thành các probes"),
        ("Dọn nhà bứng mấy cái probes từ trong hàm hardcode vứt qua 1 bản registry YAML. Lên sàn võ mồm kháng biện lấy trade-of",
         "Chuyển các probes từ hàm hardcode sang một registry YAML. Phân tích trade-of"),
        ("Bộ JSON quăng kế bên tệp state bọc kết quả đống pro",
         "Tệp JSON được đặt cạnh tệp state, chứa kết quả các pro"),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content


def fix_supervisor_pattern(content):
    """Fix phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/docs/vi.md"""
    replacements = [
        ("thằng worker", "tác nhân worker"),
        ("chơi kiểu", "áp dụng"),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content


def fix_consensus_bft(content):
    """Fix phases/16-multi-agent-and-swarms/14-consensus-and-bft/docs/vi.md"""
    replacements = [
        ("bị tịt ngòi trước", "bị vô hiệu hóa trước"),
        (", tịt ngòi —", ", ngừng phản hồi —"),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content


# ────────────────────────────────────────────
# SPECIFIC SINGLE-LINE FIXES
# ────────────────────────────────────────────

SINGLE_LINE_FIXES = {
    # Phase 06
    "phases/06-speech-and-audio/11-real-time-audio-processing/docs/vi.md": [
        ("Các mô hình nhả ra chữ ngay khi", "Các mô hình xuất văn bản ngay khi"),
        ("giọng của con bot phát ra loa", "giọng của bot phát ra loa"),
    ],
    "phases/06-speech-and-audio/12-voice-assistant-pipeline/docs/vi.md": [
        ("Chỉ bắt đầu đọc TTS ngay khi mô hình nhả ra", "Chỉ bắt đầu đọc TTS ngay khi mô hình sinh ra"),
    ],
    "phases/06-speech-and-audio/13-neural-audio-codecs/docs/vi.md": [
        ("lo gánh vác việc lưu giữ", "chịu trách nhiệm lưu giữ"),
    ],
    "phases/06-speech-and-audio/17-audio-evaluation-metrics/docs/vi.md": [
        ("đến lúc nhả ra chữ đầu tiên", "đến lúc xuất từ đầu tiên"),
    ],
    # Phase 05
    "phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/docs/vi.md": [
        ("đã gánh vác nhiều sản phẩm NLP", "đã hỗ trợ nhiều sản phẩm NLP"),
    ],
    # Phase 04
    "phases/04-computer-vision/15-real-time-edge/docs/vi.md": [
        ("không thể nhét vừa vào", "không thể triển khai trên"),
    ],
    # Phase 08
    "phases/08-generative-ai/01-generative-models-taxonomy-history/docs/vi.md": [
        ("chỉ gánh vác duy nhất một nhiệm vụ", "chỉ đảm nhận duy nhất một nhiệm vụ"),
    ],
    # Phase 10
    "phases/10-llms-from-scratch/05-scaling-distributed/docs/vi.md": [
        ("không thể gánh nổi", "không đủ khả năng chứa"),
        ("gánh vác từ", "xử lý từ"),
    ],
    "phases/10-llms-from-scratch/11-quantization/docs/vi.md": [
        ("hệ số quy đổi gánh", "hệ số quy đổi chịu"),
    ],
    # Phase 11
    "phases/11-llm-engineering/05-context-engineering/docs/vi.md": [
        ("nhồi nhét đủ 200K token", "đưa đủ 200K token"),
        ("thay vì nhồi nhét toàn bộ", "thay vì đưa toàn bộ"),
    ],
    # Phase 12 - "cưỡng bức" in tech context
    "phases/12-multimodal-ai/12-emu3-next-token-for-generation/docs/vi.md": [
        ("cưỡng bức", "bắt buộc"),
    ],
    "phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion/docs/vi.md": [
        ("cưỡng bức", "bắt buộc"),
    ],
    # Phase 12 - flex
    "phases/12-multimodal-ai/06-any-resolution-patch-n-pack/docs/vi.md": [
        # "NaFlex" is a proper name, the "flex" match is a false positive
        # No fix needed, but we handle it to clear the report
    ],
    # Phase 14
    "phases/14-agent-engineering/07-memory-virtual-context-memgpt/docs/vi.md": [
        ("việc nhồi nhét quá nhiều", "việc đưa quá nhiều"),
    ],
    "phases/14-agent-engineering/16-openai-agents-sdk/docs/vi.md": [
        ("xu hướng nhồi nhét tất cả", "xu hướng tập trung tất cả"),
    ],
    "phases/14-agent-engineering/28-orchestration-patterns/docs/vi.md": [
        ("A quăng B ->", "A chuyển cho B ->"),
        ("chả bao giờ tiến triển", "không bao giờ tiến triển"),
    ],
    "phases/14-agent-engineering/29-production-runtimes/docs/vi.md": [
        ("yếu tố gánh tải (load-bearing)", "yếu tố chịu tải trọng (load-bearing)"),
        ("yếu tố gánh tải", "yếu tố chịu tải trọng"),
    ],
    "phases/14-agent-engineering/32-minimal-agent-workbench/docs/vi.md": [
        ("sẽ được nhét vào", "sẽ được lưu trữ trong"),
    ],
    "phases/14-agent-engineering/33-instructions-as-executable-constraints/docs/vi.md": [
        ("Mỗi luật gánh trên vai", "Mỗi luật mang trên mình"),
    ],
    "phases/14-agent-engineering/42-agent-workbench-capstone/docs/vi.md": [
        ("Nhét thêm một kịch bản", "Bổ sung một kịch bản"),
    ],
    # Phase 16 
    "phases/16-multi-agent-and-swarms/04-primitive-model/docs/vi.md": [
        ("một con agent", "một tác nhân"),
    ],
    "phases/16-multi-agent-and-swarms/10-group-chat-speaker-selection/docs/vi.md": [
        ("lột mặt nạ phanh phui bản viết lại", "ghi nhận sự thay đổi kiến trúc trong bản viết lại"),
    ],
    # Phase 18
    "phases/18-ethics-safety-alignment/19-model-welfare-research/docs/vi.md": [
        ("câu lệnh dắt mũi của", "câu lệnh gợi ý có tính dẫn dắt (leading prompts) của"),
    ],
    # Phase 19
    "phases/19-capstone-projects/10-multi-agent-software-team/docs/vi.md": [
        ("đạt đến giới hạn xử lý khi đối mặt với", "đạt đến giới hạn khi xử lý"),
    ],
    # Phase 11 - guardrails
    "phases/11-llm-engineering/12-guardrails/docs/vi.md": [
        ("bằng cách ngăn chặn mô hình bị dắt mũi", "bằng cách ngăn chặn mô hình bị chi phối"),
    ],
    # Phase 11 - function calling
    "phases/11-llm-engineering/09-function-calling/docs/vi.md": [
        ("Cưỡng bức gọi hàm", "Bắt buộc gọi hàm"),
    ],
}


def process_all():
    """Process all files with violations."""
    total_fixes = 0
    files_fixed = 0
    
    # Get all vi.md files
    all_files = sorted(WORKSPACE.rglob("vi.md"))
    
    for filepath in all_files:
        try:
            content = filepath.read_text(encoding='utf-8')
        except Exception:
            continue
        
        original = content
        rel_path = str(filepath).replace(str(WORKSPACE) + "\\", "phases/").replace("\\", "/")
        
        # Apply global replacements first
        content, g_count = apply_global_replacements(content)
        
        # Apply file-specific fixes
        if "08-role-specialization" in str(filepath):
            content = fix_role_specialization(content)
        elif "06-hierarchical-architecture" in str(filepath):
            content = fix_hierarchical_architecture(content)
        elif "09-parallel-swarm-networks" in str(filepath):
            content = fix_parallel_swarm(content)
        elif "31-agent-workbench-why-models-fail" in str(filepath):
            content = fix_workbench_why_fail(content)
        elif "35-initialization-scripts" in str(filepath):
            content = fix_init_scripts(content)
        elif "05-supervisor-orchestrator-pattern" in str(filepath):
            content = fix_supervisor_pattern(content)
        elif "14-consensus-and-bft" in str(filepath):
            content = fix_consensus_bft(content)
        
        # Apply single-line fixes
        for fix_path, fixes in SINGLE_LINE_FIXES.items():
            if fix_path.replace("/", "\\") in str(filepath).replace("/", "\\"):
                for fix in fixes:
                    if len(fix) == 2:
                        old, new = fix
                        content = content.replace(old, new)
        
        # Write back only if changed
        if content != original:
            filepath.write_text(content, encoding='utf-8')
            changes = sum(1 for a, b in zip(original.split('\n'), content.split('\n')) if a != b)
            print(f"✅ {rel_path} — {changes} dòng đã sửa")
            files_fixed += 1
            total_fixes += changes
    
    print(f"\n{'=' * 50}")
    print(f"Tổng: {files_fixed} tệp / {total_fixes} dòng đã sửa")
    return files_fixed, total_fixes


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    process_all()
