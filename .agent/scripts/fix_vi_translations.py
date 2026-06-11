#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_vi_translations.py - Safe version
Review and fix informal Vietnamese translations in all vi.md files.
Avoids damaging legitimate technical terms like 'ma trận' (matrix), 'chiến lược', etc.
"""

import re
import json
import sys
from pathlib import Path
from datetime import datetime

# Force UTF-8 output
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

WORKSPACE = Path(r"c:\Users\vutm\Desktop\workspace\tinix-r2ai-roadmap\phases")

# ===================================================================
# REPLACEMENT RULES - SAFE PATTERNS ONLY
# Each entry: (pattern, replacement, use_regex, description)
# IMPORTANT: All patterns must be safe to avoid breaking legitimate words
# ===================================================================

# Patterns that are SAFE - these words don't appear in technical contexts
SIMPLE_PHRASE_REPLACEMENTS = [
    # ---- Informal subject pronouns ----
    ("Gã mô hình", "Mô hình", "Informal pronoun 'Gã' (guy)"),
    ("gã mô hình", "mô hình", "Informal pronoun 'gã'"),
    ("Gã tác nhân", "Tác nhân", "Informal pronoun 'Gã'"),
    ("gã tác nhân", "tác nhân", "Informal pronoun 'gã'"),
    ("Đám tác nhân", "Các tác nhân", "Informal collective 'Đám'"),
    ("đám tác nhân", "các tác nhân", "Informal collective 'đám'"),
    ("đám mô hình", "các mô hình", "Informal collective 'đám'"),
    ("Đám quản binh", "Các quản lý", "Informal collective + military term"),
    ("quản binh", "quản lý", "Military term"),
    ("gã Human", "người dùng (Human)", "Informal pronoun"),
    ("anh Human", "người dùng (Human)", "Informal pronoun"),
    ("Quý ngài đặc phái viên", "Tác nhân thẩm định", "Overly formal/archaic pronoun"),
    ("quý ngài đặc phái viên", "tác nhân thẩm định", "Overly formal/archaic"),
    ("tay sai", "hệ thống phụ trợ", "Derogatory term"),
    ("tay tác nhân", "tác nhân", "Informal 'tay'"),
    ("lão xét duyệt", "giai đoạn thẩm định", "Disrespectful term"),
    ("Lão xét duyệt", "Giai đoạn thẩm định", "Disrespectful"),

    # ---- Informal/hacker verbs ----
    ("khua chiêng gõ mõ báo tin", "thông báo", "Informal idiom"),
    ("khua chiêng gõ mõ", "thông báo rầm rộ", "Informal idiom"),
    ("chém gió", "phát biểu thiếu căn cứ", "Slang"),
    ("vỗ ngực tự khen mình", "tự đánh giá", "Informal idiom"),
    ("vỗ ngực tự khen", "tự đánh giá", "Informal idiom"),
    ("hất cằm phán", "đưa ra phán quyết", "Informal gesture verb"),
    ("hất cằm", "đưa ra", "Informal gesture verb"),
    ("phọt ra", "xuất ra", "Vulgar/informal"),
    ("ọc ra kết quả", "xuất ra kết quả", "Informal"),
    ("phun trào mớ dòng", "ghi thêm dòng", "Informal/vulgar"),
    ("phun trào", "phát sinh", "Informal/vulgar"),
    ("gào tên Human", "cảnh báo người dùng", "Informal/aggressive"),
    ("gào tên", "cảnh báo", "Informal/aggressive"),
    ("gào lên", "cảnh báo", "Informal/aggressive"),
    ("lời văn múa bút", "nội dung phản hồi", "Informal idiom"),
    ("múa bút trên dòng chat", "phản hồi trong cuộc trò chuyện", "Informal"),
    ("bày biện nặn ra", "tạo ra", "Informal/vulgar"),
    ("nặn ra", "tạo ra", "Informal/vulgar"),
    ("nặn đẻ", "tạo ra", "Vulgar"),
    ("rặn đẻ", "tạo ra", "Vulgar"),
    ("rặn ra", "xuất ra", "Vulgar"),
    ("rỉa rói", "kiểm tra kỹ", "Informal"),
    ("lùng sục rỉa rói", "tìm kiếm và kiểm tra kỹ", "Informal"),
    ("lùng sục", "tìm kiếm", "Informal"),
    ("bói không ra", "không tìm thấy", "Informal"),
    ("hóng hớt", "lắng nghe", "Informal/slang"),
    ("bịt miệng", "vô hiệu hóa", "Informal"),
    ("mớm tiền hay bịt miệng", "tác động hoặc vô hiệu hóa", "Informal"),
    ("mớm tiền", "tác động không hợp lệ", "Informal"),
    ("giơ tay bôi trơn", "thực hiện ghi đè thủ công", "Informal"),
    ("bôi trơn", "tác động không hợp lệ", "Informal"),
    ("khinh khỉnh ngúng nguẩy", "từ chối", "Informal/contemptuous"),
    ("khinh khỉnh", "từ chối một cách kiên quyết", "Informal"),
    ("ngúng nguẩy", "từ chối", "Informal"),
    ("phi tang hót dọn", "xóa bỏ âm thầm", "Informal"),
    ("giật lủi phi tang", "âm thầm xóa bỏ", "Informal"),
    ("phi tang", "xóa bỏ", "Informal/criminal slang"),
    ("hót dọn", "xóa bỏ", "Informal"),
    ("bón phân hất thảy vô mâm cho", "cung cấp tất cả dữ liệu vào", "Vulgar idiom"),
    ("bón phân", "cung cấp đầu vào", "Vulgar"),
    ("hất thảy vô mâm", "chuyển tất cả vào", "Informal"),
    ("dùng chiêu", "áp dụng", "Informal"),
    ("rước bùa", "áp dụng nguyên tắc", "Superstitious/informal"),
    ("rước vô", "chuyển sang", "Informal"),

    # ---- Hacker slang for processes ----
    ("tự biên tự diễn báo cáo", "tự ý báo cáo", "Informal"),
    ("tự biên tự diễn", "tự ý", "Informal"),
    ("trịch thượng chém gió mượt mà tự tin", "tự tin khẳng định", "Informal"),
    ("trịch thượng", "một cách tự tin", "Informal/arrogant"),
    ("bóp méo vặn vẹo tự diễn dịch xõa xượi", "tự diễn giải tùy tiện và sai lệch", "Informal"),
    ("tự diễn dịch xõa xượi", "tự diễn giải tùy tiện", "Informal"),
    ("bóp méo vặn vẹo", "bóp méo", "Informal"),
    ("nhang nhác hao hao", "gần giống với", "Informal"),
    ("xòe cánh điển hình hỏng hóc hay hoành hành nhất", "phổ biến nhất", "Informal"),
    ("hỏng hóc hay hoành hành", "phổ biến nhất", "Informal"),
    ("xòe cánh điển hình", "dạng thất bại điển hình", "Informal"),
    ("kiểu xòe cánh", "dạng thất bại", "Informal"),
    ("xòe cánh", "biểu hiện lỗi", "Informal"),
    ("Có 3 kiểu xòe cánh điển hình", "Có 3 dạng thất bại điển hình", "Informal"),

    # ---- Battle/war metaphors inappropriate ----
    ("tin thắng trận quá sức dễ dãi", "kết quả thành công quá dễ dàng", "War metaphor"),
    ("tin thắng trận", "kết quả thành công", "War metaphor"),
    ("khua chiêng gõ mõ báo tin thắng trận", "thông báo hoàn thành thành công", "War metaphor"),
    ("thắng trận", "hoàn thành", "War metaphor"),
    ("xuất chuồng", "phát hành", "Animal metaphor"),
    ("ra trận", "thực thi", "War metaphor"),

    # ---- Architecture/structure informal ----
    ("dựng lên một tháp gác cổng xác minh độc tôn", "thiết lập một cổng xác minh duy nhất", "Informal"),
    ("tháp gác cổng xác minh", "cơ chế cổng xác minh", "Informal"),
    ("Phương thuốc cứu mạng từ workbench", "Giải pháp từ workbench", "Informal idiom"),
    ("Phương thuốc cứu mạng", "Giải pháp", "Informal idiom"),
    ("phương thuốc cứu mạng", "giải pháp", "Informal idiom"),
    ("Trạm gác", "Cổng kiểm tra", "Military metaphor"),
    ("trạm gác", "cổng kiểm tra", "Military metaphor"),
    ("trạm kiểm này hàn cứng câu dây hòa lưới vô cả CI", "cổng kiểm tra này được tích hợp vào CI", "Informal"),
    ("hàn cứng câu dây hòa lưới vô", "được tích hợp vào", "Informal metaphor"),
    ("hàn cứng", "tích hợp chặt chẽ", "Informal metalworking metaphor"),
    ("Đài kiểm môn", "Cổng kiểm tra", "Informal"),
    ("đài kiểm môn", "cổng kiểm tra", "Informal"),
    ("Đài cổng", "Cổng", "Informal"),
    ("đài cổng", "cổng", "Informal"),
    ("cổng soát", "cổng kiểm tra", "Informal"),
    ("tháp gác", "cơ chế kiểm soát", "Military metaphor"),
    ("tháp cổng", "cơ chế cổng", "Informal"),

    # ---- Flowchart/table informal words ----
    ("Lọt khe?", "Đạt yêu cầu?", "Informal"),
    ("lọt khe", "đạt yêu cầu", "Informal"),
    ("quay xe tước ấn done + gào tên Human", "thu hồi trạng thái hoàn thành + cảnh báo người dùng", "Informal"),
    ("quay xe tước ấn done", "thu hồi trạng thái hoàn thành", "Informal"),
    ("tước ấn done", "hủy trạng thái hoàn thành", "Informal"),
    ("quay xe", "quay lại", "Informal/slang"),

    # ---- Informal description words ----
    ("ngấu nghiến toàn bộ di sản", "xử lý toàn bộ các sản phẩm đầu ra (artifacts)", "Eating metaphor"),
    ("ngấu nghiến", "xử lý toàn bộ", "Eating metaphor"),
    ("nhai nát", "xử lý", "Eating metaphor"),
    ("nhài nát", "xử lý", "Eating metaphor"),
    ("di sản gã tác nhân bày biện nặn ra", "các sản phẩm đầu ra do tác nhân tạo ra", "Informal"),
    ("di sản", "các sản phẩm đầu ra (artifacts)", "Inappropriate word choice"),
    ("ngồi xổm lên dàn thánh vật workbench artifacts", "hoạt động trên toàn bộ workbench artifacts", "Vulgar idiom"),
    ("ngồi xổm lên", "hoạt động trên", "Vulgar idiom"),
    ("ngồi xổm", "hoạt động trực tiếp trên", "Vulgar idiom"),
    ("chui ụp phọt ra", "xử lý và xuất ra", "Informal"),
    ("chui ụp", "xử lý", "Informal"),
    ("hất cằm phán", "đưa ra phán quyết", "Informal gesture"),
    ("Tháp cổng phải đều đặn rặn đẻ tuồn ra", "Cổng kiểm tra phải luôn xuất ra", "Vulgar"),
    ("đều đặn rặn đẻ tuồn ra", "luôn luôn xuất ra", "Vulgar"),
    ("tuồn ra", "xuất ra", "Informal"),
    ("mớm cho nó cùng một lô artifact set", "khi cung cấp cùng một bộ artifact", "Informal"),
    ("mớm cho", "khi cung cấp", "Informal"),

    # ---- Inappropriate legal/financial metaphors ----
    ("bản kết tội", "bản phán quyết", "Legal informal"),
    ("bản luận tội", "bản phán quyết", "Legal informal"),
    ("kết tội", "kết luận (verdict)", "Legal informal"),
    ("đám tàn tích vệt nhơ mức độ block-severity", "các phát hiện có mức độ block-severity", "Informal"),
    ("tàn tích vệt nhơ", "phát hiện lỗi", "Informal"),
    ("nằm ngoài vòng kháng cáo của tay tác nhân", "không thể được ghi đè bởi tác nhân", "Informal"),
    ("giơ tay bôi trơn, mang theo nhãn hiệu lý do", "thực hiện ghi đè thủ công với thuộc tính lý do", "Informal"),
    ("nhãn hiệu lý do", "thuộc tính lý do (override_reason)", "Informal"),
    ("điểm tay chỉ mặt", "chỉ định", "Informal gesture"),
    ("Cú gạt bẻ lái này (override)", "Thao tác ghi đè (override) này", "Informal"),
    ("cú gạt bẻ lái", "thao tác ghi đè", "Informal"),
    ("bẻ lái", "ghi đè (override)", "Informal metaphor"),
    ("miễn bàn nó là hệ lụy rặn nghĩ từ agent", "rõ ràng đây không phải là quyết định từ agent", "Informal"),
    ("hệ lụy rặn nghĩ", "quyết định", "Informal"),
    ("quyền ân xá", "ghi đè được phê duyệt (signed override)", "Inappropriate religious/royal term"),
    ("bản hiệp ước có ký nháy", "thay đổi có xác nhận (signed change)", "Informal"),

    # ---- Build It section informal ----
    ("Sạp mồi tải đồ rinh trọn đống input artifact", "Tải toàn bộ các input artifact", "Informal"),
    ("rinh trọn đống", "toàn bộ", "Informal"),
    ("Trổ tài 1 họng hàm tinh khiết", "Triển khai một hàm thuần túy (pure function)", "Informal"),
    ("Trổ tài", "Triển khai", "Informal"),
    ("họng hàm", "hàm", "Informal"),
    ("Dàn phím xòe tung báo cáo ọc ra kết quả thi thố", "Xuất báo cáo kết quả kiểm tra", "Informal"),
    ("Dàn phím xòe tung", "Xuất ra", "Informal"),
    ("thi thố", "kiểm tra", "Informal"),
    ("Cất sóng màn đề mô 3 vòng luân chiến", "Minh họa với 3 kịch bản", "Informal"),
    ("vòng luân chiến", "kịch bản", "War metaphor"),
    ("Xưởng vọt ra: 3 tay biên khảo cáo buộc", "Chương trình xuất ra 3 bản phán quyết", "Informal"),
    ("Xưởng vọt ra", "Chương trình xuất ra", "Informal"),
    ("tay biên khảo cáo buộc", "bản phán quyết (verdict report)", "Informal"),

    # ---- Production patterns section informal ----
    ("Móc vào bốn bùa chú độ cổng môn lột xác thoát thai từ mác", 
     "Bốn nguyên tắc nâng cấp cổng kiểm tra từ nhãn", "Informal"),
    ("bùa chú", "nguyên tắc", "Superstitious term"),
    ("lột xác thoát thai", "chuyển đổi", "Informal"),
    ("lột xác", "chuyển đổi", "Informal"),
    ("thoát thai", "phát triển vượt bậc", "Informal"),
    ("từ mác", "từ mức", "Informal"),
    ("mác", "nhãn/mức", "Informal"),
    ("Chiều kích phòng thủ tầng tầng lớp lớp", "Phòng thủ theo chiều sâu (Defense-in-depth)", "Informal"),
    ("tầng tầng lớp lớp", "nhiều lớp", "Informal"),
    ("Dây chuyền rải rác từng nấc vắt theo nếp sống tất định", 
     "Chuỗi kiểm tra tất định phân bổ qua từng lớp", "Informal"),
    ("rải rác từng nấc", "phân bổ qua từng lớp", "Informal"),
    ("nếp sống tất định", "nguyên tắc tất định", "Informal"),
    ("vết rạn lủng ở một lớp sẽ mắc lưới chộp lại bởi nấc tiếp sau", 
     "lỗi xảy ra ở một lớp sẽ được phát hiện bởi lớp tiếp theo", "Informal"),
    ("vết rạn", "lỗi", "Informal"),
    ("mắc lưới chộp lại", "được phát hiện bởi", "Informal"),
    ("Chắn ngự bằng vòng kiểm tra tất định, thẩm phán mô hình", 
     "Sử dụng kiểm tra tất định, để mô hình đóng vai trò", "Informal"),
    ("Ứng nghiệm chuẩn 2026 Hybrid Norm (Mảng ghép định mức đôi) của Anthropic rước bùa", 
     "Tiêu chuẩn Hybrid Norm 2026 của Anthropic áp dụng nguyên tắc", "Informal"),
    ("rước bùa", "áp dụng nguyên tắc", "Superstitious term"),
    ("giơ tay đỡ đạn trả lời", "đảm nhận việc trả lời", "War metaphor"),
    ("giơ tay đỡ đạn", "đảm nhận", "War metaphor"),
    ("vuốt mặt phán quyết", "đánh giá", "Informal"),
    ("vuốt mặt", "đánh giá", "Informal"),
    ("Gắp ném loạn xạ 2 tụ này vô lò cừu", "Trộn lẫn hai thành phần này", "Vulgar idiom"),
    ("gắp ném loạn xạ", "trộn lẫn", "Informal"),
    ("vô lò cừu", "vào cùng một nơi", "Informal"),
    ("san bằng tín hiệu", "làm mất đi tín hiệu rõ ràng", "Informal"),
    ("Ghi danh nhật ký (log) vượt rào, ứ màng mấy cuộn rác vướng víu Slack threads",
     "Ghi nhật ký (log) cho mọi lần ghi đè, thay vì chỉ ghi vào Slack threads", "Informal"),
    ("ứ màng mấy cuộn rác vướng víu", "thay vì chỉ dùng", "Informal/vulgar"),
    ("chốt hạ ở bãi", "được lưu vào", "Informal"),
    ("bám đuôi", "hiện tại", "Informal"),
    ("mớ vấp override nào bị khiếm khuyết chữ ký", "bất kỳ ghi đè nào thiếu chữ ký", "Informal"),
    ("hệ thống theo dấu thắt mớ dây cương bởi rễ git-tracked", 
     "hệ thống kiểm tra (audit trail) được neo vào git-tracked", "Informal"),
    ("lột xác ra cái vạch định giới mỏng tang", "định nghĩa ranh giới mỏng manh", "Informal"),
    ("so đo phân tranh rạch ròi", "phân biệt rõ ràng", "Informal"),
    ("Phủ bạt dặm nền bao vây Coverage floor như một ngón check cao thâm thượng thừa", 
     "Sử dụng coverage floor như một kiểm tra quan trọng (first-class check)", "Informal"),
    ("ngón check cao thâm thượng thừa", "kiểm tra quan trọng (first-class check)", "Informal"),
    ("Cổng gate ngã ngửa đứt quãng", "Cổng kiểm tra thất bại", "Informal"),
    ("ngã ngửa đứt quãng", "thất bại", "Informal"),
    ("đường đua tỷ lệ đo lường sụt tụt quá mức nền", "tỷ lệ giảm xuống dưới mức nền", "Informal"),
    ("sụt tụt quá mức", "giảm dưới mức", "Informal"),
    ("thê thảm rụng dưới mốc lùi sàn", "hoặc thấp hơn mốc giảm sàn", "Informal"),
    ("hụt quá chớn mốc", "vượt quá ngưỡng", "Informal"),
    ("Hễ vắng gã kiểm định này", "Nếu thiếu kiểm tra này", "Informal"),
    ("ngấm ngầm giật lủi phi tang hót dọn chùm bài test cản lối đang vướng vòng rớt",
     "âm thầm xóa bỏ các bài test đang thất bại", "Informal/vulgar"),
    ("cản lối đang vướng vòng rớt", "đang trong trạng thái thất bại", "Informal"),
    ("để đánh đu cho biên khảo reports múa khoe màu xanh lấp lóa", 
     "để báo cáo hiển thị màu xanh (trạng thái thành công)", "Informal"),
    ("múa khoe màu xanh lấp lóa", "hiển thị màu xanh (trạng thái thành công)", "Informal"),
    ("Nút thắt `--strict` (khắt khe) hô biến phong chức mớ dằn mặt warns mọc sừng lên hàng blocks",
     "Cờ `--strict` nâng cấp tất cả cảnh báo (warns) thành lỗi chặn (blocks)", "Informal"),
    ("hô biến phong chức", "nâng cấp", "Magic metaphor"),
    ("mớ dằn mặt warns mọc sừng lên hàng blocks", "cảnh báo thành lỗi chặn (blocks)", "Informal"),
    ("mọc sừng lên hàng", "được nâng cấp thành", "Informal"),
    ("Phục vụ riêng các cành (branches) đợi xuất chuồng", 
     "Dành cho các nhánh (branches) chuẩn bị phát hành", "Informal"),
    ("cành (branches) đợi xuất chuồng", "nhánh (branches) chuẩn bị phát hành", "Informal"),
    ("rào PRs ngáng cổng xuất tàu", "chặn các PR trước khi phát hành", "Informal"),
    ("mũi nhọn `--strict` găm mọi hạt vạch báo động", 
     "cờ `--strict` ghi lại mọi cảnh báo (warning)", "Informal"),
    ("găm mọi hạt vạch báo động", "ghi lại mọi cảnh báo", "Informal"),
    ("đội lớp ván đo ván sụp gãy cứng", "được nâng cấp thành lỗi cứng (hard fail)", "Informal"),
    ("ván đo ván sụp", "thất bại", "Informal"),
    ("gãy cứng", "hard fail", "Informal"),
    ("Cờ báo này hoạt động theo cách chọn lựa tùy lúc (opt-in) nương nhờ từng chi nhánh (by branch)",
     "Cờ này hoạt động theo cách tùy chọn (opt-in) theo từng nhánh (by branch)", "Informal"),
    ("nương nhờ từng chi nhánh", "theo từng nhánh (by branch)", "Informal"),
    ("chứ không gieo rắc nhan nhản (global default)", 
     "chứ không áp dụng làm mặc định toàn cục (global default)", "Informal"),
    ("gieo rắc nhan nhản", "áp dụng rộng rãi", "Informal"),
    ("cái thói nghiệt ngã xét nét mọi bề (strict-on-everything) bào mòn nát tươm nhựa sống dòng nhịp điệu sinh hoạt mỗi ngày",
     "cách tiếp cận nghiêm ngặt về mọi mặt (strict-on-everything) ảnh hưởng tiêu cực đến quy trình làm việc hàng ngày", "Informal"),
    ("nghiệt ngã xét nét mọi bề", "nghiêm ngặt về mọi mặt", "Informal"),
    ("bào mòn nát tươm nhựa sống", "gây ảnh hưởng tiêu cực", "Informal"),
    ("nhựa sống dòng nhịp điệu sinh hoạt mỗi ngày", "quy trình làm việc hàng ngày", "Informal"),

    # ---- Use It section informal ----
    ("Cỗ việc `verify_agent` nẹt bô chà hoạt động nã gate ụp dính lên mớ thảm artifact sau rốt",
     "Tác vụ `verify_agent` chạy cổng kiểm tra trên toàn bộ artifact cuối cùng", "Informal"),
    ("nẹt bô chà hoạt động", "chạy", "Informal"),
    ("nã gate ụp dính lên", "áp dụng cổng kiểm tra lên", "Informal"),
    ("mớ thảm artifact sau rốt", "toàn bộ artifact cuối cùng", "Informal"),
    ("Khiên chắn vòng ải Merge protection khinh khỉnh ngúng nguẩy", 
     "Cơ chế Merge protection từ chối", "Informal"),
    ("Tay sai cõi runtime réo inh ỏi gọi điện giật gate", 
     "Hệ thống runtime gọi cổng kiểm tra", "Informal"),
    ("réo inh ỏi gọi điện giật gate", "gọi cổng kiểm tra", "Informal"),
    ("cõi runtime", "môi trường runtime", "Informal"),
    ("Mảng xanh (green verdict) vô phương héo úa thì đừng mơ hòng trao ấn mộc (no handoff)",
     "Phán quyết thành công (green verdict) là bắt buộc; không có thì không bàn giao (no handoff)", "Informal"),
    ("vô phương héo úa", "là bắt buộc", "Informal"),
    ("đừng mơ hòng trao ấn mộc", "không thực hiện bàn giao", "Informal"),
    ("trao ấn mộc", "bàn giao", "Informal"),
    ("Đám quản binh lôi cổ tệp báo cáo ra vuốt mắt coi kĩ",
     "Các quản lý xem xét kỹ tệp báo cáo", "Informal"),
    ("lôi cổ tệp báo cáo ra vuốt mắt coi kĩ", "xem xét kỹ tệp báo cáo", "Informal"),
    ("mỗi lúc 1 con agent hớt hải lôi kèn báo công đắc thắng", 
     "mỗi khi một agent thông báo hoàn thành", "Informal"),
    ("hớt hải lôi kèn báo công đắc thắng", "thông báo hoàn thành", "Informal"),
    ("dẫu mà anh Human (nhân loại) thấy có mùi ám muội ngờ ngợ (suspects it)",
     "mặc dù người dùng (Human) có nghi ngờ (suspects it)", "Informal"),
    ("có mùi ám muội ngờ ngợ", "có dấu hiệu đáng ngờ", "Informal"),
    ("Đài kiểm môn (gate) khoác mão vương vị là chốn định đoạt (deciding edge) dõng dạc trong hệ trôi nổi dòng chảy workbench flow",
     "Cổng kiểm tra (gate) giữ vai trò là điểm quyết định (deciding edge) trong luồng workbench", "Informal"),
    ("khoác mão vương vị là chốn định đoạt", "giữ vai trò là điểm quyết định", "Informal"),
    ("dõng dạc trong hệ trôi nổi dòng chảy", "trong luồng", "Informal"),
    ("Hết thảy các luồng lạch nhấp nhô râu ria còn lại đều ngậm ngùi quỳ gối dưới ngọn nguồn mạn thượng nguồn",
     "Tất cả các luồng xử lý còn lại đều phụ thuộc vào nó ở thượng nguồn", "Informal"),
    ("luồng lạch nhấp nhô râu ria còn lại", "luồng xử lý còn lại", "Informal"),
    ("ngậm ngùi quỳ gối dưới", "phụ thuộc vào", "Informal/dramatic"),

    # ---- Ship It section informal ----
    ("Lệnh `outputs/skill-verification-gate.md` nối cáp hàn đấu gate rập vào thân hình (wires) của 1 project cụ tỷ",
     "Tệp `outputs/skill-verification-gate.md` kết nối cổng kiểm tra vào một project cụ thể", "Informal"),
    ("nối cáp hàn đấu gate rập vào thân hình", "kết nối cổng kiểm tra vào", "Informal"),
    ("wires", "kết nối", "Informal"),

    # ---- Exercise section informal ----
    ("tiếng thét gọi test bắt buộc đơm quả (produce) 1 báo cáo", 
     "lệnh test bắt buộc tạo ra (produce) một báo cáo", "Informal"),
    ("tiếng thét gọi test", "lệnh test", "Informal"),
    ("đơm quả", "tạo ra", "Informal"),
    ("Tự biên rạch ròi dòm coi xem cái lán (artifact) nào oằn lưng chở vác cái mốc (floor) này",
     "Hãy xác định rõ artifact nào chứa mốc (floor) này", "Informal"),
    ("Tự biên rạch ròi dòm coi xem", "Hãy xác định rõ", "Informal"),
    ("cái lán (artifact) nào oằn lưng chở vác cái mốc (floor) này",
     "artifact nào chứa mốc (floor) này", "Informal"),
    ("Nới rộng vòng tay chứa chấp chế độ `--strict`", 
     "Mở rộng để hỗ trợ chế độ `--strict`", "Informal"),
    ("Nới rộng vòng tay chứa chấp", "Mở rộng để hỗ trợ", "Informal"),
    ("độ lên hàng ngũ mọi chiếc mác `warn` phi thăng (promotes) thành `block`",
     "nâng cấp (promotes) mọi cảnh báo `warn` thành `block`", "Informal"),
    ("phi thăng", "nâng cấp lên", "Informal"),
    ("Nặn ra vài dòng bút lục bào chữa", "Viết vài dòng lý giải", "Informal"),
    ("Nặn ra", "Viết", "Informal"),
    ("bút lục bào chữa", "lý giải", "Informal"),
    ("cái nếp sinh hoạt strict mode lại chiếm suất 1 khuôn đúc định dạng khôn ngoan (right default)",
     "tại sao strict mode lại là cách tiếp cận khôn ngoan (right default)", "Informal"),
    ("nếp sinh hoạt", "cách tiếp cận", "Informal"),
    ("chiếm suất 1 khuôn đúc định dạng", "là", "Informal"),
    ("Đuổi ẹo cái tháp gate oằn mình nặn đẻ (produce) ngòi tóm lược (summary) kiểu Markdown",
     "Mở rộng cổng kiểm tra để tạo ra (produce) một tóm tắt (summary) dạng Markdown", "Informal"),
    ("Đuổi ẹo", "Mở rộng", "Informal"),
    ("oằn mình nặn đẻ", "tạo ra", "Informal"),
    ("ngòi tóm lược", "bản tóm tắt", "Informal"),
    ("Há mỏ tranh biện liệt kê rạch ròi (Defend) ngóc ngách trường phái (fields)",
     "Hãy lập luận rõ ràng (Defend) các trường (fields)", "Informal"),
    ("Há mỏ tranh biện liệt kê rạch ròi", "Hãy lập luận rõ ràng", "Informal"),
    ("ngóc ngách trường phái (fields)", "các trường (fields)", "Informal"),
    ("vinh dự đáp bãi điểm tô cho bãi summary đó", "đáng được đưa vào bản tóm tắt đó", "Informal"),
    ("Móc kẹp đòn kiểm soát độ trễ `time_since_last_human_touch`",
     "Thêm kiểm tra `time_since_last_human_touch`", "Informal"),
    ("Móc kẹp đòn kiểm soát", "Thêm kiểm tra", "Informal"),
    ("bất kể ngóc file nào oằn lưng chỉnh sửa (edited) lọt trong khe 60 giây",
     "bất kỳ file nào được chỉnh sửa (edited) trong vòng 60 giây", "Informal"),
    ("ngóc file nào oằn lưng chỉnh sửa", "file nào được chỉnh sửa", "Informal"),
    ("lọt trong khe 60 giây", "trong vòng 60 giây", "Informal"),
    ("của vết tay người (human keystroke) đều miễn tử bài trừ xé bỏ khỏi nhãn thẻ vi phạm off-scope cắm cờ (flags)",
     "của thao tác người dùng (human keystroke) đều được miễn trừ khỏi vi phạm off-scope được đánh dấu (flags)", "Informal"),
    ("miễn tử bài trừ xé bỏ", "được miễn trừ", "Informal"),
    ("nhãn thẻ vi phạm off-scope cắm cờ", "vi phạm off-scope được đánh dấu", "Informal"),
    ("Buộc tay kéo tháp gate đọ sức cưỡi (Run) vần 1 màn agent diff đời thực (real)",
     "Thực thi cổng kiểm tra trên một agent diff thực tế (real)", "Informal"),
    ("Buộc tay kéo tháp gate đọ sức cưỡi", "Thực thi cổng kiểm tra", "Informal"),
    ("vần 1 màn agent diff đời thực", "trên một agent diff thực tế", "Informal"),
    ("So kè thử đo lường đếm chục phát bắt mốc (findings)",
     "So sánh số lượng phát hiện (findings)", "Informal"),
    ("So kè thử đo lường", "So sánh và đo lường", "Informal"),
    ("nào là thực cốt (real) so đo nếm thử bao nhiêu là rác ồn nhiễu (noise)",
     "nào là thực sự (real) và bao nhiêu là nhiễu (noise)", "Informal"),
    ("nào là thực cốt", "nào là thực sự", "Informal"),
    ("so đo nếm thử", "và", "Informal"),
    ("Lóng ngóng đoán coi trạm cổng (gate) sẽ ấp ủ lột xác mọc thêm nhánh rễ nào đặng hòng vươn xa",
     "Hãy dự đoán cổng kiểm tra (gate) cần được mở rộng thêm theo hướng nào", "Informal"),
    ("Lóng ngóng đoán coi", "Hãy dự đoán", "Informal"),
    ("sẽ ấp ủ lột xác mọc thêm nhánh rễ nào đặng hòng vươn xa",
     "cần được mở rộng thêm theo hướng nào", "Informal"),

    # ---- Glossary table informal ----
    ("\"The check that stops things (Lệnh trạm kiểm dừng mọi sự)\"",
     "\"Lệnh kiểm tra dừng mọi tiến trình\"", "Informal"),
    ("Mảng hàm lượng (Deterministic function) tất định ngồi xổm lên dàn thánh vật workbench artifacts chui ụp phọt ra tiếng phán 1 màu đậu/rớt (pass/fail)",
     "Hàm tất định (Deterministic function) hoạt động trên workbench artifacts và xuất ra kết quả đạt/không đạt (pass/fail)", "Informal"),
    ("chui ụp phọt ra tiếng phán", "và xuất ra kết quả", "Informal"),
    ("1 phốt phát giác (finding) rào đường đánh sập `passed: true` ép lòi móng bắt nôn ra quyền ân xá (signed override)",
     "Một phát hiện lỗi (finding) vô hiệu hóa `passed: true` và bắt buộc phải có ghi đè được phê duyệt (signed override)", "Informal"),
    ("rào đường đánh sập", "vô hiệu hóa", "Informal"),
    ("ép lòi móng bắt nôn ra", "và bắt buộc phải có", "Informal"),
    ("Giấy chứng nhận (Signed entries) chép mộc vạch chỉ nguyên cớ kèm mã User id, chịu nguyền nhăm nhe móc ra sờ gáy (audited) dịp hạch họe (review)",
     "Các mục có ký xác nhận (Signed entries) ghi rõ lý do kèm User ID, có thể được kiểm tra (audited) trong quá trình review", "Informal"),
    ("chép mộc vạch chỉ nguyên cớ", "ghi rõ lý do", "Informal"),
    ("chịu nguyền nhăm nhe móc ra sờ gáy", "có thể được kiểm tra", "Informal"),
    ("dịp hạch họe", "trong quá trình review", "Informal"),
    ("Còi hiệu gõ lệnh the thé shell command phả ra họng thoái lui ngả mũ bằng 0 (zero exit) đồng nhãn cùng ngụ ngôn `done`",
     "Lệnh shell khi thực thi trả về mã thoát 0 (zero exit) đồng nghĩa với trạng thái `done`", "Informal"),
    ("Còi hiệu gõ lệnh the thé shell command", "Lệnh shell", "Informal"),
    ("phả ra họng thoái lui ngả mũ bằng 0", "trả về mã thoát 0 (zero exit)", "Informal"),
    ("đồng nhãn cùng ngụ ngôn", "đồng nghĩa với", "Informal"),
    ("Đường chạy `outputs/verification/<task_id>.json`, mớ đĩa tiệc chiêu đãi nhai nát 2 cửa miệng cho dân CI đớp chung bầy với bọn Human chỏ mỏ hóng",
     "Đường dẫn `outputs/verification/<task_id>.json`, là nguồn dữ liệu duy nhất phục vụ cả hệ thống CI lẫn người dùng (Human)", "Informal"),
    ("mớ đĩa tiệc chiêu đãi nhai nát 2 cửa miệng", "là nguồn dữ liệu duy nhất", "Informal"),
    ("cho dân CI đớp chung bầy với bọn Human chỏ mỏ hóng", "phục vụ cả CI lẫn người dùng", "Informal"),

    # ---- Related lessons references informal ----
    ("Cụm tường chắn tiêm prompt phòng the (cặp lọng che hắt đối đầu song hành cõi gate)",
     "Cụm bảo vệ chống tiêm nhiễm prompt (hoạt động song song với cổng kiểm tra)", "Informal"),
    ("cặp lọng che hắt đối đầu song hành cõi gate", "hoạt động song song với cổng kiểm tra", "Informal"),
    ("Mẩu hợp đồng scope giật cương khóa cứng quyền gate ngự trị",
     "Hợp đồng phạm vi (scope contract) giữ quyền kiểm soát cổng", "Informal"),
    ("giật cương khóa cứng quyền gate ngự trị", "giữ quyền kiểm soát cổng", "Informal"),
    ("Cục lưu log (feedback log) phơi thây làm mồi cho cổng gate đăng ký nhận xé quăng điểm (scores)",
     "Nhật ký phản hồi (feedback log) cung cấp dữ liệu cho cổng kiểm tra tính điểm (scores)", "Informal"),
    ("phơi thây làm mồi cho", "cung cấp dữ liệu cho", "Informal"),
    ("đăng ký nhận xé quăng điểm", "tính điểm", "Informal"),
    ("Quý ngài đặc phái viên reviewer agent đón tay chuỗi bàn giao từ gã gate sập ngõ",
     "Tác nhân thẩm định (reviewer agent) nhận kết quả bàn giao từ cổng kiểm tra", "Informal"),
    ("đón tay chuỗi bàn giao", "nhận kết quả bàn giao", "Informal"),
    ("gã gate sập ngõ", "cổng kiểm tra", "Informal"),

    # ---- General informal descriptions (global) ----
    ("mặc kệ lời văn múa bút trên dòng chat có hay tới đâu",
     "bất kể nội dung phản hồi trong cuộc trò chuyện có hấp dẫn đến đâu", "Informal"),
    ("cổng gác phán không, tức là nhiệm vụ chưa xong",
     "cổng xác minh trả về kết quả không đạt, tức là nhiệm vụ chưa hoàn thành", "Informal"),
    ("cổng gác phán", "cổng xác minh kết luận", "Informal"),
    ("Quyện nhào đủ báo cáo luật (rule report), báo cáo phạm vi (scope report), các mảng bản ghi phản hồi (feedback records), và mảng diff gom bóp thành 1 bản luận tội (verdict) đanh thép duy nhất",
     "Tổng hợp báo cáo luật (rule report), báo cáo phạm vi (scope report), bản ghi phản hồi (feedback records), và diff thành một bản phán quyết (verdict) duy nhất và chắc chắn", "Informal"),
    ("gom bóp thành 1 bản luận tội (verdict) đanh thép duy nhất",
     "thành một bản phán quyết (verdict) duy nhất và chắc chắn", "Informal"),
    ("Phóng ra tờ `verification_report.json`", "Xuất tệp `verification_report.json`", "Informal"),
    ("Ngoảnh mặt cự tuyệt lách luật đặc quyền ép lùi tiến trình tác vụ khi vấp bất cứ một lỗi cấm cửa (block-severity failure) nào xướng tên, miễn nói nhiều (without exception)",
     "Từ chối hoàn toàn mọi cố gắng ghi đè, thu hồi trạng thái hoàn thành khi gặp bất kỳ lỗi chặn (block-severity failure) nào, không có ngoại lệ (without exception)", "Informal"),
    ("lách luật đặc quyền ép lùi tiến trình tác vụ", "thu hồi trạng thái hoàn thành", "Informal"),
    ("khi vấp bất cứ một lỗi cấm cửa", "khi gặp bất kỳ lỗi chặn", "Informal"),
    ("xướng tên, miễn nói nhiều (without exception)", "không có ngoại lệ (without exception)", "Informal"),
]


def simple_replace(text: str, changes: list) -> str:
    """Apply simple string replacements (case-sensitive, exact match)."""
    for old, new, desc in SIMPLE_PHRASE_REPLACEMENTS:
        if old in text:
            text = text.replace(old, new)
            changes.append(f"    '{old[:50]}...' → '{new[:50]}...'" if len(old) > 50 
                          else f"    '{old}' → '{new}'")
    return text


def process_file(filepath: Path) -> dict:
    """Process a single vi.md file."""
    try:
        content = filepath.read_text(encoding='utf-8')
        changes = []
        
        new_content = simple_replace(content, changes)
        
        if new_content != content:
            filepath.write_text(new_content, encoding='utf-8')
            return {
                'file': str(filepath),
                'changed': True,
                'changes': changes,
                'error': None
            }
        return {
            'file': str(filepath),
            'changed': False,
            'changes': [],
            'error': None
        }
    except Exception as e:
        return {
            'file': str(filepath),
            'changed': False,
            'changes': [],
            'error': str(e)
        }


def main():
    print("=" * 70)
    print("SCRIPT FIX VIETNAMESE TRANSLATIONS (v2 - Safe)")
    print(f"Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    vi_files = sorted(WORKSPACE.rglob("vi.md"))
    total = len(vi_files)
    print(f"\nFound {total} vi.md files\n")
    
    results = []
    changed_count = 0
    error_count = 0
    
    for i, filepath in enumerate(vi_files, 1):
        result = process_file(filepath)
        results.append(result)
        
        if result['error']:
            error_count += 1
            print(f"[{i:3d}/{total}] ERROR: {filepath.parent.parent.name}/{filepath.parent.name} - {result['error']}")
        elif result['changed']:
            changed_count += 1
            rel_path = str(filepath).replace(str(WORKSPACE.parent.parent) + "\\", "")
            print(f"[{i:3d}/{total}] FIXED: {rel_path}")
            for change in result['changes'][:3]:
                print(f"{change}")
            if len(result['changes']) > 3:
                print(f"         ... and {len(result['changes']) - 3} more")
        else:
            rel_path = str(filepath.parent.parent.name) + "/" + str(filepath.parent.parent.parent.name)
            print(f"[{i:3d}/{total}]    ok: {filepath.parent.parent.name}")
    
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total files:  {total}")
    print(f"Files fixed:  {changed_count}")
    print(f"Files ok:     {total - changed_count - error_count}")
    print(f"Files errors: {error_count}")
    print(f"Done: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    report_path = Path(r"c:\Users\vutm\Desktop\workspace\tinix-r2ai-roadmap\.agent\scripts\vi_fix_report.json")
    report_data = {
        'timestamp': datetime.now().isoformat(),
        'total_files': total,
        'changed_count': changed_count,
        'error_count': error_count,
        'results': [r for r in results if r['changed'] or r['error']]
    }
    report_path.write_text(json.dumps(report_data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Report saved: {report_path}")


if __name__ == '__main__':
    main()
