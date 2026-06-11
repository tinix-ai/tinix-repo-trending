# -*- coding: utf-8 -*-
import json
import os

data = {
  "phases\\10-llms-from-scratch\\04-pre-training-mini-gpt\\quiz.json": [
    {
      "question": "Mục tiêu huấn luyện nào được GPT sử dụng trong quá trình tiền huấn luyện?",
      "options": [
        "Mô hình hóa ngôn ngữ có mặt nạ (masked language modeling - dự đoán các token bị che)",
        "Dự đoán token tiếp theo (next-token prediction): dự đoán token tiếp theo dựa trên các token phía trước",
        "Phân loại câu",
        "Căn chỉnh ảnh-văn bản"
      ],
      "correct": 1,
      "explanation": "GPT là mô hình ngôn ngữ nhân quả (tự hồi quy) được huấn luyện bằng mục tiêu dự đoán token tiếp theo. Cho trước chuỗi các token [t1, t2, ..., tn], mô hình học cách dự đoán tn+1. Hàm mất mát là entropy chéo giữa token tiếp theo được dự đoán và token thực tế.",
      "stage": "pre"
    },
    {
      "question": "Mô hình GPT-2 Small (124M) sở hữu bao nhiêu lớp transformer, đầu attention và số chiều nhúng?",
      "options": [
        "6 lớp, 6 đầu attention, chiều nhúng 512",
        "12 lớp, 12 đầu attention, chiều nhúng 768",
        "24 lớp, 16 đầu attention, chiều nhúng 1024",
        "48 lớp, 25 đầu attention, chiều nhúng 1600"
      ],
      "correct": 1,
      "explanation": "GPT-2 Small có 12 lớp transformer, 12 đầu attention trên mỗi lớp, và các vector nhúng có chiều kích thước là 768. Kiến trúc này chứa 124 triệu tham số và có thể được huấn luyện trên một GPU đơn lẻ trong vài giờ.",
      "stage": "pre"
    },
    {
      "question": "Vai trò của mặt nạ chú ý nhân quả (causal attention mask) trong GPT là gì?",
      "options": [
        "Ngăn mô hình chú ý đến các token đệm (padding tokens)",
        "Ngăn mỗi token chú ý đến các token trong tương lai, đảm bảo mô hình chỉ có thể sử dụng ngữ cảnh trong quá khứ để dự đoán",
        "Che đi các điểm số chú ý có độ tự tin thấp",
        "Giảm thiểu lượng bộ nhớ tiêu thụ trong quá trình huấn luyện"
      ],
      "correct": 1,
      "explanation": "Mặt nạ nhân quả (causal mask) là một ma trận tam giác đặt các vị trí tương lai thành giá trị cực âm vô cùng (-infinity) trước khi tính softmax. Một token ở vị trí thứ 5 có thể chú ý đến các vị trí từ 1 đến 5 nhưng không thể chú ý đến vị trí số 6 trở đi. Điều này đảm bảo mô hình tạo ra các token theo chiều từ trái sang phải.",
      "stage": "post"
    },
    {
      "question": "Thông số 'nhiệt độ' (temperature) kiểm soát điều gì trong quá trình tạo văn bản?",
      "options": [
        "Tốc độ tạo văn bản",
        "Tính ngẫu nhiên của việc chọn lựa token: nhiệt độ thấp hơn làm đầu ra mang tính xác định cao hơn, nhiệt độ cao hơn làm đầu ra đa dạng hơn",
        "Số lượng token được tạo ra",
        "Ngưỡng tự tin của mô hình"
      ],
      "correct": 1,
      "explanation": "Nhiệt độ (temperature) chia các logit trước khi thực hiện phép tính softmax. Nhiệt độ = 0.1 làm cho phân phối rất nhọn (gần như mang tính xác định hoàn toàn). Nhiệt độ = 1.0 tương đương với phân phối huấn luyện. Nhiệt độ > 1.0 làm phẳng phân phối, làm tăng tính ngẫu nhiên.",
      "stage": "post"
    },
    {
      "question": "Tại sao quá trình tiền huấn luyện yêu cầu lượng tài nguyên tính toán lớn hơn đáng kể so với tinh chỉnh?",
      "options": [
        "Huấn luyện tiền tiền đề sử dụng kích thước lô lớn hơn",
        "Quá trình tiền huấn luyện (pre-training) xử lý hàng nghìn tỷ token từ đầu để học các mẫu ngôn ngữ tổng quát, trong khi tinh chỉnh (fine-tuning) điều chỉnh một mô hình đã có năng lực trên hàng nghìn ví dụ cụ thể",
        "Quá trình tiền huấn luyện sử dụng một kiến trúc khác",
        "Quá trình tinh chỉnh không sử dụng đạo hàm (gradients)"
      ],
      "correct": 1,
      "explanation": "Quá trình tiền huấn luyện xây dựng toàn bộ tri thức ngôn ngữ từ các trọng số ngẫu nhiên trên hàng nghìn tỷ token. Quá trình tinh chỉnh bắt đầu từ các trọng số đã học này và điều chỉnh chúng trên một tập dữ liệu nhỏ hơn nhiều (hàng nghìn đến hàng triệu ví dụ).",
      "stage": "post"
    }
  ],
  "phases\\10-llms-from-scratch\\05-scaling-distributed\\quiz.json": [
    {
      "question": "Một mô hình có quy mô 7B tham số hoạt động ở định dạng FP16 yêu cầu bao nhiêu VRAM chỉ để tải các trọng số gốc?",
      "options": [
        "7 GB",
        "14 GB",
        "28 GB",
        "56 GB"
      ],
      "correct": 1,
      "explanation": "Mỗi tham số ở định dạng FP16 chiếm 2 bytes. 7 tỷ * 2 bytes = 14 GB. Khi tính thêm các trạng thái của bộ tối ưu hóa Adam (2 bản sao) và các đạo hàm (gradients), tổng bộ nhớ huấn luyện đạt khoảng 56 GB trước khi tính đến các kích hoạt (activations).",
      "stage": "pre"
    },
    {
      "question": "Ba phương pháp song song hóa nào được sử dụng phổ biến nhất trong huấn luyện phân tán?",
      "options": [
        "Song song hóa CPU, GPU và TPU",
        "Song song hóa dữ liệu (data parallelism), song song hóa tensor (tensor parallelism) và song song hóa đường ống (pipeline parallelism)",
        "Song song hóa lô, chuỗi và token",
        "Song song hóa truyền xuôi, truyền ngược và bộ tối ưu hóa"
      ],
      "correct": 1,
      "explanation": "Song song hóa dữ liệu sao chép mô hình trên mỗi GPU và phân chia dữ liệu đầu vào. Song song hóa tensor phân tách các lớp riêng lẻ trên các GPU khác nhau. Song song hóa đường ống phân tách các lớp của mô hình thành các giai đoạn chạy trên các GPU khác nhau.",
      "stage": "pre"
    },
    {
      "question": "Phương pháp FSDP (Fully Sharded Data Parallel) thực hiện điều gì mà DDP tiêu chuẩn không làm?",
      "options": [
        "Nó sử dụng một bộ tối ưu hóa khác",
        "Nó phân mảnh (shards) các tham số mô hình, đạo hàm và trạng thái bộ tối ưu hóa trên các GPU thay vì sao chép toàn bộ mô hình trên mỗi GPU",
        "Nó xử lý dữ liệu nhanh hơn",
        "Nó hỗ trợ nhiều GPU hơn"
      ],
      "correct": 1,
      "explanation": "Cơ chế DDP tiêu chuẩn sao chép toàn bộ mô hình trên mỗi GPU (gây lãng phí bộ nhớ). FSDP phân mảnh các tham số trên các GPU để mỗi GPU chỉ giữ một phần nhỏ. Các tham số được thu thập theo yêu cầu cho tính toán và được giải phóng ngay sau đó.",
      "stage": "post"
    },
    {
      "question": "DeepSpeed ZeRO Stage 3 hoạt động dựa trên cơ chế nào?",
      "options": [
        "Một phương pháp lượng tử hóa",
        "Nó phân mảnh các trạng thái bộ tối ưu hóa, đạo hàm VÀ các tham số mô hình trên các GPU, đạt hiệu quả sử dụng bộ nhớ tối đa",
        "Một lịch trình điều chỉnh tốc độ học",
        "Một đường ống tiền xử lý dữ liệu"
      ],
      "correct": 1,
      "explanation": "ZeRO Stage 1 phân mảnh trạng thái bộ tối ưu hóa, Stage 2 bổ sung phân mảnh đạo hàm, Stage 3 bổ sung phân mảnh tham số mô hình. Stage 3 mang lại khả năng tiết kiệm bộ nhớ tối đa, cho phép huấn luyện các mô hình vượt xa dung lượng bộ nhớ của một GPU đơn lẻ.",
      "stage": "post"
    },
    {
      "question": "Tại sao việc đồng bộ hóa đạo hàm (gradient synchronization) là bắt buộc trong huấn luyện song song dữ liệu?",
      "options": [
        "Để ngăn chặn hiện tượng quá khớp (overfitting)",
        "Mỗi GPU tính toán đạo hàm trên các dữ liệu khác nhau; việc tính trung bình các đạo hàm trên các GPU đảm bảo tất cả các bản sao cập nhật tham số một cách giống hệt nhau",
        "Để giảm thiểu lượng bộ nhớ tiêu thụ",
        "Để tăng tốc lượt truyền xuôi"
      ],
      "correct": 1,
      "explanation": "Trong song song hóa dữ liệu, mỗi GPU xử lý một lô dữ liệu khác nhau và tính toán các đạo hàm khác nhau. Phép toán AllReduce tính trung bình các đạo hàm này trên tất cả các GPU để mọi bản sao áp dụng cùng một bản cập nhật và duy trì tính đồng bộ.",
      "stage": "post"
    }
  ],
  "phases\\10-llms-from-scratch\\06-instruction-tuning-sft\\quiz.json": [
    {
      "question": "Sự khác biệt căn bản giữa mô hình ngôn ngữ cơ sở (base model) và mô hình được tinh chỉnh chỉ dẫn (instruction-tuned) là gì?",
      "options": [
        "Chúng có các kiến trúc khác nhau",
        "Mô hình cơ sở (base model) tiếp tục các mẫu văn bản; mô hình căn chỉnh theo chỉ dẫn (instruction-tuned model) tuân thủ chỉ dẫn và trả lời các câu hỏi",
        "Các mô hình căn chỉnh theo chỉ dẫn có kích thước lớn hơn",
        "Các mô hình cơ sở hoạt động nhanh hơn"
      ],
      "correct": 1,
      "explanation": "Mô hình cơ sở được huấn luyện với mục tiêu dự đoán token tiếp theo sẽ tiếp tục các mẫu văn bản. Nếu bạn hỏi nó một câu hỏi, nó có thể tạo ra nhiều câu hỏi hơn. SFT dạy mô hình tạo ra câu trả lời bằng cách huấn luyện trên các cặp (chỉ dẫn, phản hồi).",
      "stage": "pre"
    },
    {
      "question": "Mục đích của việc che hàm mất mát (masking loss) đối với các token không phải của trợ lý (non-assistant tokens) trong SFT là gì?",
      "options": [
        "Để tăng tốc độ huấn luyện",
        "Để chỉ huấn luyện mô hình tạo ra các phản hồi, không ghi nhớ định dạng chỉ dẫn hoặc gợi ý hệ thống (system prompts)",
        "Để giảm thiểu dung lượng bộ nhớ sử dụng",
        "Để ngăn chặn hiện tượng quá khớp (overfitting)"
      ],
      "correct": 1,
      "explanation": "Trong quá trình SFT, mục tiêu là để mô hình học cách phản hồi, chứ không phải học cách tái tạo lại chỉ dẫn. Việc che hàm mất mát (loss masking) đặt giá trị mất mát bằng 0 đối với các token của hệ thống/người dùng để các đạo hàm chỉ sinh ra từ các token phản hồi của trợ lý (assistant).",
      "stage": "pre"
    },
    {
      "question": "Dữ liệu huấn luyện SFT thường tuân theo định dạng cấu trúc nào?",
      "options": [
        "Các tài liệu văn bản thô",
        "Mẫu hội thoại (chat template) với các vai trò hệ thống, người dùng và trợ lý được đánh dấu bằng các token đặc biệt",
        "Các cặp khóa-giá trị",
        "Các truy vấn SQL và kết quả"
      ],
      "correct": 1,
      "explanation": "Dữ liệu SFT sử dụng định dạng hội thoại có cấu trúc: một gợi ý hệ thống thiết lập hành vi, một chỉ dẫn của người dùng, và một phản hồi của trợ lý. Các token đặc biệt đánh dấu ranh giới giữa các vai trò để mô hình học được cấu trúc hội thoại.",
      "stage": "post"
    },
    {
      "question": "Tại sao một mô hình SFT có thể đạt độ phân cực (perplexity) thấp trên các bài kiểm chuẩn nhưng lại có chất lượng hội thoại kém hơn?",
      "options": [
        "Các điểm chuẩn đánh giá bị sai",
        "SFT tối ưu hóa cho việc khớp mẫu trên các ví dụ huấn luyện, chứ không tối ưu cho việc đánh giá chất lượng sắc thái mà con người quan tâm -- điều này đòi hỏi các phương pháp RLHF/DPO",
        "Mô hình quá nhỏ",
        "Tốc độ học bị thiết lập sai"
      ],
      "correct": 1,
      "explanation": "SFT dạy mô hình tuân thủ các định dạng và tạo ra các phản hồi có vẻ hợp lý. Nó không dạy mô hình phản hồi nào tốt hơn khi có nhiều lựa chọn hợp lệ tồn tại. Việc căn chỉnh theo phản hồi của con người (RLHF/DPO) giải quyết khoảng trống này.",
      "stage": "post"
    },
    {
      "question": "Thông thường cần bao nhiêu cặp chỉ dẫn-phản hồi chất lượng cao để thực hiện SFT hiệu quả?",
      "options": [
        "Hàng triệu ví dụ",
        "10.000 đến 100.000 ví dụ chất lượng cao",
        "Ít hơn 100 ví dụ",
        "Hàng tỷ ví dụ"
      ],
      "correct": 1,
      "explanation": "SFT đạt hiệu quả sử dụng dữ liệu đáng ngạc nhiên. Các nghiên cứu chỉ ra rằng khoảng 10.000 - 100.000 ví dụ chất lượng cao (như tập dữ liệu Alpaca hoặc LIMA) có thể dạy mô hình tuân thủ chỉ dẫn một cách hiệu quả. Chất lượng quan trọng hơn nhiều so với số lượng.",
      "stage": "post"
    }
  ],
  "phases\\10-llms-from-scratch\\07-rlhf\\quiz.json": [
    {
      "question": "Mô hình phần thưởng (reward model) trong RLHF học từ nguồn dữ liệu nào?",
      "options": [
        "Các tài liệu văn bản thô",
        "Các cặp tùy chọn ưu tiên của con người (human preference pairs): cho trước hai phản hồi, phản hồi nào được con người ưu tiên hơn",
        "Điểm số của các bài kiểm chuẩn",
        "Đường cong mất mát của mô hình"
      ],
      "correct": 1,
      "explanation": "Mô hình phần thưởng (reward model) được huấn luyện trên dữ liệu ưu tiên: các cặp phản hồi cho cùng một gợi ý mà trong đó con người đã dán nhãn phản hồi nào tốt hơn. Nó học cách gán điểm số cao hơn cho các phản hồi phù hợp với sở thích của con người.",
      "stage": "pre"
    },
    {
      "question": "Tại sao hình phạt phân kỳ KL (KL divergence penalty) được áp dụng trong quá trình huấn luyện PPO của RLHF?",
      "options": [
        "Để tăng tốc độ huấn luyện",
        "Để ngăn chiến lược (policy) lệch quá xa khỏi mô hình SFT gốc, điều có thể dẫn đến hiện tượng khai thác lỗ hổng phần thưởng (reward hacking)",
        "Để giảm thiểu bộ nhớ sử dụng",
        "Để cải thiện việc mã hóa token (tokenization)"
      ],
      "correct": 1,
      "explanation": "Nếu không có hình phạt phân kỳ KL (KL penalty), mô hình sẽ tìm ra các cách suy biến để tối đa hóa điểm phần thưởng (ví dụ: tạo ra văn bản lặp đi lặp lại khai thác điểm yếu của mô hình phần thưởng). KL giúp mô hình nằm gần với mô hình cơ sở SFT hoạt động ổn định.",
      "stage": "pre"
    },
    {
      "question": "Cần bao nhiêu mô hình riêng biệt để vận hành một đường ống RLHF hoàn chỉnh?",
      "options": [
        "Một mô hình",
        "Hai mô hình",
        "Ba mô hình: mô hình SFT, mô hình phần thưởng, và mô hình chiến lược (policy model) đang được tối ưu hóa",
        "Bốn mô hình"
      ],
      "correct": 2,
      "explanation": "RLHF yêu cầu: (1) mô hình SFT làm điểm xuất phát và tham chiếu KL, (2) mô hình phần thưởng được huấn luyện trên sở thích, (3) mô hình chiến lược được tối ưu hóa bằng PPO. Sự phức tạp này là lý do DPO (bài 08) được phát triển.",
      "stage": "post"
    },
    {
      "question": "Hiện tượng 'reward hacking' (khai thác lỗ hổng phần thưởng) trong RLHF là gì?",
      "options": [
        "Khi mô hình phần thưởng bị tấn công bởi các tác nhân đối kháng",
        "Khi chiến lược tìm cách tối đa hóa điểm phần thưởng mà không thực sự cải thiện chất lượng phản hồi",
        "Khi dữ liệu huấn luyện bị hỏng",
        "Khi tốc độ học quá cao"
      ],
      "correct": 1,
      "explanation": "Mô hình phần thưởng là một đại diện không hoàn hảo cho đánh giá của con người. Chiến lược có thể phát hiện ra các mẫu đạt điểm phần thưởng cao (ví dụ: phản hồi quá dài dòng, rào trước đón sau quá mức) mà không thực sự hữu ích hơn. Hình phạt KL giúp giới hạn điều này.",
      "stage": "post"
    },
    {
      "question": "Cơ chế cắt xén (clipping) của PPO giúp ngăn chặn điều gì?",
      "options": [
        "Tràn số đạo hàm (gradient overflow)",
        "Các cập nhật chiến lược lớn quá mức có thể làm mất ổn định quá trình huấn luyện",
        "Tràn bộ nhớ",
        "Rò rỉ dữ liệu"
      ],
      "correct": 1,
      "explanation": "Thuật toán PPO giới hạn tỷ lệ xác suất giữa chiến lược mới và cũ trong một khoảng như [0.8, 1.2]. Điều này ngăn không cho bất kỳ cập nhật đơn lẻ nào thay đổi chiến lược quá đột ngột, giúp quá trình huấn luyện ổn định hơn so với phương pháp đạo hàm chiến lược thô.",
      "stage": "post"
    }
  ],
  "phases\\10-llms-from-scratch\\08-dpo\\quiz.json": [
    {
      "question": "Lợi thế chính của DPO so với quy trình RLHF truyền thống là gì?",
      "options": [
        "DPO tạo ra các mô hình tốt hơn",
        "DPO loại bỏ sự cần thiết của một mô hình phần thưởng riêng biệt và thuật toán PPO, huấn luyện trực tiếp trên các cặp ưu tiên trong một vòng lặp duy nhất",
        "DPO sử dụng ít dữ liệu huấn luyện hơn",
        "DPO hoạt động tốt mà không cần bất kỳ dữ liệu ưu tiên nào"
      ],
      "correct": 1,
      "explanation": "RLHF yêu cầu huấn luyện một mô hình phần thưởng riêng biệt, sau đó chạy tối ưu hóa PPO. DPO tích hợp cả hai bước vào một mục tiêu huấn luyện duy nhất để tối ưu hóa trực tiếp mô hình ngôn ngữ trên các cặp ưu tiên.",
      "stage": "pre"
    },
    {
      "question": "Mô hình tham chiếu (reference model) đóng vai trò gì trong DPO?",
      "options": [
        "Nó tạo ra dữ liệu huấn luyện",
        "Nó đóng vai trò là mốc neo ngăn mô hình huấn luyện lệch đi quá xa, tương tự như hình phạt KL trong RLHF",
        "Nó đánh giá chất lượng mô hình",
        "Nó xử lý việc mã hóa token (tokenization)"
      ],
      "correct": 1,
      "explanation": "Hàm mất mát DPO so sánh xác suất log (log probabilities) dưới chiến lược được huấn luyện và mô hình tham chiếu (thường là SFT). Mô hình tham chiếu hạn chế mức độ sai lệch của chiến lược, ngăn chặn hiện tượng khai thác lỗ hổng phần thưởng (reward hacking) mà không cần tinh chỉnh KL tường minh.",
      "stage": "pre"
    },
    {
      "question": "Tham số beta trong thuật toán DPO kiểm soát khía cạnh nào?",
      "options": [
        "Tốc độ học",
        "Mức độ ràng buộc chiến lược phải ở gần mô hình tham chiếu -- hệ số beta cao hơn tương đương với các cập nhật thận trọng hơn",
        "Kích thước lô (batch size)",
        "Số lượng kỷ nguyên huấn luyện (epochs)"
      ],
      "correct": 1,
      "explanation": "Hệ số beta điều chỉnh tỷ lệ của hình phạt phân kỳ KL ẩn. Beta = 0.1 cho phép mô hình sai lệch đáng kể so với tham chiếu (có khả năng tốt hơn nhưng rủi ro hơn). Beta = 0.5 giữ mô hình ở gần tham chiếu hơn (an toàn hơn nhưng học ít hơn).",
      "stage": "post"
    },
    {
      "question": "Làm thế nào DPO có thể biểu diễn ngầm một mô hình phần thưởng?",
      "options": [
        "Nó không biểu diễn -- DPO không có khái niệm về phần thưởng",
        "Hàm mất mát DPO có thể được suy ra bằng cách chứng minh rằng chiến lược tối ưu dưới một hàm phần thưởng có thể được biểu diễn trực tiếp qua xác suất log của chiến lược",
        "Nó huấn luyện một mô hình phần thưởng ẩn bên trong mô hình ngôn ngữ",
        "DPO sử dụng chính hàm mất mát làm phần thưởng"
      ],
      "correct": 1,
      "explanation": "Rafailov và các cộng sự đã chỉ ra rằng nghiệm giải tích của mục tiêu RLHF biểu diễn phần thưởng dưới dạng một hàm số của xác suất log của chiến lược so với tham chiếu. DPO tối ưu hóa trực tiếp biểu thức này, qua đó học ẩn hàm phần thưởng.",
      "stage": "post"
    },
    {
      "question": "Trong trường hợp nào phương pháp RLHF vẫn có thể được ưu tiên hơn DPO?",
      "options": [
        "Luôn luôn -- RLHF vượt trội hơn một cách tuyệt đối",
        "Khi bạn cần một mô hình phần thưởng có thể tái sử dụng để đánh giá nhiều chiến lược hoặc khi việc thu thập dữ liệu trực tuyến (online data) mang lại lợi ích",
        "Khi bạn có ít dữ liệu ưu tiên hơn",
        "Khi huấn luyện các mô hình nhỏ hơn"
      ],
      "correct": 1,
      "explanation": "DPO là phương pháp ngoại tuyến (dữ liệu ưu tiên cố định). RLHF cho phép thu thập dữ liệu trực tuyến nơi mô hình phần thưởng chấm điểm các thế hệ mới tạo ra, phát hiện các mẫu khai thác lỗ hổng phần thưởng. Một mô hình phần thưởng độc lập cũng hữu ích cho việc đánh giá và các chiến lược khác.",
      "stage": "post"
    }
  ],
  "phases\\10-llms-from-scratch\\10-evaluation\\quiz.json": [
    {
      "question": "Tại sao các bài kiểm chuẩn như MMLU ngày càng ít giá trị trong việc so sánh các mô hình ngôn ngữ hàng đầu?",
      "options": [
        "Chúng kiểm tra các chủ đề không phù hợp",
        "Các mô hình hàng đầu (frontier models) đã bão hòa điểm số MMLU (đạt 86-89%), thu hẹp bảng xếp hạng về một khoảng mà sự khác biệt chỉ là nhiễu thống kê",
        "MMLU được thiết kế cho các mô hình nhỏ hơn",
        "Các câu hỏi quá dễ"
      ],
      "correct": 1,
      "explanation": "Khi GPT-4, Claude 3 và Llama 3 đều đạt điểm số 86-89% trên MMLU, chênh lệch 1 điểm không còn ý nghĩa. Điểm chuẩn này không còn khả năng phân biệt giữa các mô hình, dù nó vẫn thống trị văn hóa bảng xếp hạng.",
      "stage": "pre"
    },
    {
      "question": "Định luật Goodhart (Goodhart's Law) được hiểu như thế nào trong ngữ cảnh đánh giá LLM?",
      "options": [
        "Một định luật về việc mở rộng quy mô mô hình",
        "Khi một thước đo trở thành mục tiêu, nó không còn là một thước đo tốt nữa -- các mô hình và đội ngũ phát triển tối ưu hóa cho điểm chuẩn thay vì năng lực thực tế",
        "Một quy tắc về lịch trình điều chỉnh tốc độ học",
        "Một định lý về cơ chế chú ý (attention mechanisms)"
      ],
      "correct": 1,
      "explanation": "Các phòng nghiên cứu tối ưu hóa cho điểm số chuẩn (lây nhiễm dữ liệu, gợi ý đặc thù cho điểm chuẩn). Điểm số tăng lên, nhưng năng lực thực tế trong thế giới thực không nhất thiết được cải thiện. Bộ đánh giá đặc thù cho tác vụ của riêng bạn là thước đo đáng tin cậy duy nhất.",
      "stage": "pre"
    },
    {
      "question": "Phương pháp đánh giá LLM-as-judge hoạt động dựa trên cơ chế nào?",
      "options": [
        "Sử dụng một giám khảo là con người để đánh giá mọi phản hồi",
        "Sử dụng một LLM mạnh (ví dụ: GPT-4) để chấm điểm các phản hồi dựa trên tiêu chí đánh giá, thay thế việc đánh giá thủ công tốn kém bằng con người ở quy mô lớn",
        "Huấn luyện một bộ phân loại riêng biệt cho việc đánh giá",
        "Sử dụng chính mô hình để tự đánh giá"
      ],
      "correct": 1,
      "explanation": "Phương pháp LLM-as-judge sử dụng một mô hình có năng lực cao để chấm điểm phản hồi dựa trên các tiêu chí xác định. Nó rẻ hơn và nhanh hơn so với đánh giá bằng con người, mặc dù nó có những thiên kiến riêng (ví dụ: thích phản hồi dài dòng) cần được hiệu chuẩn.",
      "stage": "post"
    },
    {
      "question": "Tại sao việc xây dựng một bộ đánh giá tùy chỉnh (custom evaluation suite) là quan trọng hơn việc dựa hoàn toàn vào các kiểm chuẩn công khai?",
      "options": [
        "Các điểm chuẩn công khai luôn luôn sai",
        "Các điểm chuẩn công khai kiểm tra năng lực chung; ứng dụng của bạn có những yêu cầu đặc thù mà chỉ có bộ đánh giá tùy chỉnh mới có thể đo lường",
        "Các bộ đánh giá tùy chỉnh dễ xây dựng hơn",
        "Các điểm chuẩn công khai quá đắt đỏ"
      ],
      "correct": 1,
      "explanation": "Một mô hình đạt 90% trên MMLU vẫn có thể thất bại trong tác vụ cụ thể của bạn (ví dụ: trích xuất ngày tháng từ tài liệu pháp lý theo định dạng của bạn). Chỉ có bộ đánh giá tùy chỉnh với dữ liệu, các trường hợp biên và tiêu chí thành công của riêng bạn mới đo lường được những gì quan trọng.",
      "stage": "post"
    },
    {
      "question": "Khái niệm 'data contamination' (lây nhiễm dữ liệu) trong các bài kiểm chuẩn LLM là gì?",
      "options": [
        "Khi dữ liệu huấn luyện bị hỏng",
        "Khi các câu hỏi kiểm chuẩn xuất hiện trong dữ liệu tiền huấn luyện của mô hình, làm tăng khống điểm số mà không phản ánh năng lực thực tế",
        "Khi mô hình tạo ra dữ liệu không chính xác",
        "Khi dữ liệu đánh giá bị gắn nhãn sai"
      ],
      "correct": 1,
      "explanation": "Nếu các câu hỏi MMLU xuất hiện trong kho dữ liệu huấn luyện, mô hình sẽ ghi nhớ câu trả lời thay vì tư duy về chúng. Điều này làm tăng khống điểm số và khiến các so sánh điểm chuẩn không đáng tin cậy. Đây là một vấn đề ngày càng nghiêm trọng khi kho dữ liệu huấn luyện mở rộng.",
      "stage": "post"
    }
  ],
  "phases\\10-llms-from-scratch\\11-quantization\\quiz.json": [
    {
      "question": "Một mô hình 70B tham số hoạt động ở định dạng FP16 tiêu tốn bao nhiêu VRAM chỉ để lưu trữ trọng số?",
      "options": [
        "35 GB",
        "70 GB",
        "140 GB",
        "280 GB"
      ],
      "correct": 2,
      "explanation": "70 tỷ tham số * 2 bytes cho mỗi tham số FP16 = 140 tỷ bytes = 140 GB. Con số này vượt quá dung lượng của một GPU A100 đơn lẻ (80GB), đòi hỏi ít nhất hai GPU chỉ để tải các trọng số.",
      "stage": "pre"
    },
    {
      "question": "Lượng tử hóa (quantization) trong ngữ cảnh LLM được hiểu là gì?",
      "options": [
        "Loại bỏ các lớp mô hình không sử dụng",
        "Giảm độ chính xác số học của các trọng số (ví dụ: từ FP16 xuống INT4) để giảm thiểu lượng bộ nhớ sử dụng và tăng tốc độ suy luận",
        "Nén dữ liệu huấn luyện",
        "Giảm kích thước từ vựng"
      ],
      "correct": 1,
      "explanation": "Lượng tử hóa (quantization) ánh xạ các trọng số dấu phẩy động có độ chính xác cao sang các số nguyên có độ chính xác thấp hơn. Lượng tử hóa INT4 lưu trữ mỗi trọng số trong 4 bits thay vì 16, giảm 4 lần dung lượng bộ nhớ với mức hao hụt độ chính xác tối thiểu.",
      "stage": "pre"
    },
    {
      "question": "Sự khác biệt then chốt giữa lượng tử hóa sau huấn luyện (PTQ) và huấn luyện nhận biết lượng tử hóa (QAT) là gì?",
      "options": [
        "PTQ có độ chính xác cao hơn",
        "PTQ lượng tử hóa sau khi huấn luyện và không cần huấn luyện lại; QAT mô phỏng lượng tử hóa trong quá trình huấn luyện để mô hình học cách chấp nhận độ chính xác giảm",
        "QAT không sử dụng đạo hàm (gradients)",
        "PTQ yêu cầu nhiều dữ liệu hơn"
      ],
      "correct": 1,
      "explanation": "PTQ hoạt động nhanh (chỉ cần hiệu chuẩn và lượng tử hóa) nhưng có thể mất độ chính xác. QAT đưa lượng tử hóa giả lập vào quá trình huấn luyện, cho phép mô hình điều chỉnh các trọng số để mạnh mẽ hơn trước hiện tượng mất độ chính xác. QAT thường mang lại độ chính xác tốt hơn.",
      "stage": "post"
    },
    {
      "question": "Lượng tử hóa 'per-channel' hoạt động thế nào và tại sao lại tối ưu hơn 'per-tensor'?",
      "options": [
        "Nó lượng tử hóa riêng biệt từng kênh đầu ra, sử dụng tỷ lệ/điểm không (scale/zero-point) khác nhau cho mỗi kênh, giúp giảm sai số lượng tử hóa",
        "Nó xử lý một kênh màu tại một thời điểm",
        "Nó sử dụng các GPU riêng biệt cho mỗi kênh",
        "Đó là một loại song song hóa dữ liệu"
      ],
      "correct": 0,
      "explanation": "Lượng tử hóa per-tensor sử dụng một hệ số tỷ lệ duy nhất cho toàn bộ ma trận trọng số. Lượng tử hóa per-channel sử dụng một hệ số tỷ lệ riêng biệt cho từng kênh đầu ra (hàng). Do các kênh khác nhau có các dải giá trị khác nhau, per-channel nắm bắt chúng chính xác hơn.",
      "stage": "post"
    },
    {
      "question": "Tại sao 95% trọng số của Llama 3 70B lại nằm tập trung trong khoảng từ -0.1 đến +0.1?",
      "options": [
        "Mô hình được huấn luyện kém",
        "Quá trình suy giảm trọng số (weight decay) và chuẩn hóa trong huấn luyện đẩy các trọng số về các giá trị nhỏ, khiến việc sử dụng toàn bộ dải giá trị của FP16 trở nên lãng phí",
        "Các trọng số vẫn chưa hội tụ",
        "Điều này là đặc thù đối với kiến trúc Llama"
      ],
      "correct": 1,
      "explanation": "Phép điều chuẩn suy giảm trọng số làm thu nhỏ các trọng số về không. Chuẩn hóa lớp (Layer normalization) giữ cho các kích hoạt tập trung tại tâm. Kết hợp lại, chúng tạo ra các phân phối trọng số tập trung gần không, giúp lượng tử hóa độ chính xác thấp đạt hiệu quả cao.",
      "stage": "post"
    }
  ],
  "phases\\10-llms-from-scratch\\12-inference-optimization\\quiz.json": [
    {
      "question": "Hai giai đoạn chính trong quá trình suy luận (inference) của LLM là gì?",
      "options": [
        "Huấn luyện và đánh giá",
        "Prefill (xử lý gợi ý song song, bị giới hạn bởi năng lực tính toán - compute-bound) và decode (tạo ra các token tại mỗi thời điểm, bị giới hạn bởi băng thông bộ nhớ - memory-bound)",
        "Mã hóa và giải mã",
        "Truyền xuôi và truyền ngược"
      ],
      "correct": 1,
      "explanation": "Giai đoạn prefill xử lý tất cả các token gợi ý song song (bị giới hạn bởi tính toán). Giai đoạn decode tạo ra các token tự hồi quy từng cái một (bị giới hạn bởi băng thông bộ nhớ để tải trọng số mô hình). Các tối ưu hóa khác nhau sẽ nhắm vào từng giai đoạn.",
      "stage": "pre"
    },
    {
      "question": "Cơ chế KV-cache giúp loại bỏ điều gì trong quá trình sinh tự hồi quy?",
      "options": [
        "Sự cần thiết của các mặt nạ chú ý (attention masks)",
        "Việc tính toán lại dư thừa các vector key và value cho tất cả các token trước đó tại mỗi bước tạo token",
        "Phép tra cứu vector nhúng (embedding lookup)",
        "Phép tính softmax"
      ],
      "correct": 1,
      "explanation": "Nếu không có KV-cache, việc tạo token thứ N yêu cầu tính toán lại các vector key và value cho tất cả N-1 token trước đó. KV-cache lưu trữ các vector này, do đó mỗi token mới chỉ tính toán K và V của riêng nó, tiết kiệm lượng tính toán O(N) ở mỗi bước.",
      "stage": "pre"
    },
    {
      "question": "Continuous batching là gì và tại sao nó lại cải thiện thông lượng hệ thống?",
      "options": [
        "Xử lý tất cả các yêu cầu trong một lô lớn duy nhất",
        "Thêm và bớt các yêu cầu một cách động khỏi lô đang chạy khi chúng bắt đầu và kết thúc, thay vì chờ đợi toàn bộ lô hoàn thành",
        "Sử dụng kích thước lô lớn hơn",
        "Xử lý lô trên nhiều mô hình khác nhau"
      ],
      "correct": 1,
      "explanation": "Trong cơ chế xử lý lô tĩnh (static batching), một yêu cầu ngắn phải chiếm vị trí trong lô cho đến khi yêu cầu dài nhất kết thúc. Cơ chế xử lý lô liên tục (continuous batching) ngay lập tức lấp đầy các vị trí đã hoàn thành bằng các yêu cầu mới, giữ cho GPU liên tục bận rộn và cải thiện thông lượng tổng thể.",
      "stage": "post"
    },
    {
      "question": "PagedAttention (sử dụng trong vLLM) giải quyết bài toán cụ thể nào?",
      "options": [
        "Nó tăng tốc độ tính toán chú ý",
        "Nó quản lý bộ nhớ KV-cache dưới dạng các khối kích thước cố định như bộ nhớ ảo, loại bỏ hiện tượng phân mảnh bộ nhớ do chuỗi có độ dài thay đổi",
        "Nó giảm kích thước mô hình",
        "Nó cải thiện tốc độ mã hóa token"
      ],
      "correct": 1,
      "explanation": "KV-cache cho các chuỗi có độ dài thay đổi gây ra hiện tượng phân mảnh bộ nhớ (các khoảng trống bị lãng phí giữa các lần cấp phát). PagedAttention cấp phát KV-cache trong các khối cố định và ánh xạ chúng bằng một bảng trang (page table), tương tự như bộ nhớ ảo của hệ điều hành.",
      "stage": "post"
    },
    {
      "question": "Giải mã suy đoán (speculative decoding) là gì?",
      "options": [
        "Tạo ra nhiều phản hồi và chọn phản hồi tốt nhất",
        "Sử dụng một mô hình nháp (draft model) nhỏ để đề xuất nhiều token mà mô hình lớn sẽ xác thực song song, giúp tăng tốc độ tạo văn bản",
        "Dự đoán token nào người dùng mong muốn",
        "Lưu bộ đệm các chuỗi thường xuyên được tạo"
      ],
      "correct": 1,
      "explanation": "Một mô hình nhỏ và nhanh tạo ra N token ứng viên. Mô hình lớn xác thực tất cả N token trong một lượt truyền xuôi duy nhất (song song). Nếu K token được chấp nhận, bạn đã tạo ra K token trong khoảng thời gian tương đương với khoảng 1 bước của mô hình lớn.",
      "stage": "post"
    }
  ],
  "phases\\11-llm-engineering\\01-prompt-engineering\\quiz.json": [
    {
      "question": "Sai lầm phổ biến nhất khi viết gợi ý (prompts) cho LLM là gì?",
      "options": [
        "Sử dụng quá nhiều token",
        "Viết các chỉ dẫn mơ hồ, thiếu chi tiết khiến mô hình phải tự đoán về định dạng, phạm vi và các ràng buộc",
        "Sử dụng sai API",
        "Không sử dụng đủ ví dụ"
      ],
      "correct": 1,
      "explanation": "LLM tuân theo chỉ dẫn một cách sát nghĩa. Yêu cầu 'Hãy viết cho tôi một email tiếp thị' không cung cấp ràng buộc nào cho mô hình. Việc chỉ rõ văn phong, đối tượng mục tiêu, độ dài, định dạng và các ràng buộc sẽ mang lại kết quả tốt hơn đáng kể.",
      "stage": "pre"
    },
    {
      "question": "Bốn thành phần cốt lõi của một gợi ý (prompt) hiệu quả là gì?",
      "options": [
        "Đầu vào, đầu ra, mô hình, nhiệt độ",
        "Vai trò (role), ngữ cảnh (context), các ràng buộc (constraints) VÀ định dạng đầu ra (output format)",
        "Hệ thống, người dùng, trợ lý, hàm",
        "Truy vấn, tài liệu, câu trả lời, điểm số"
      ],
      "correct": 1,
      "explanation": "Các gợi ý hiệu quả cần xác định rõ: mô hình nên đóng vai trò là ai (role), mô hình cần biết những gì (context), những gì mô hình nên và không nên làm (constraints), và cách cấu trúc phản hồi (output format).",
      "stage": "pre"
    },
    {
      "question": "Tại sao việc đưa ra chỉ dẫn về định dạng đầu ra vào gợi ý lại cực kỳ quan trọng?",
      "options": [
        "Nó làm gợi ý ngắn hơn",
        "Nếu không có chỉ dẫn định dạng, mô hình sẽ tự chọn cấu trúc riêng, điều này thay đổi giữa các lần gọi và rất khó để phân tích cú pháp bằng lập trình",
        "Nó giảm chi phí API",
        "Nó ngăn chặn hiện tượng ảo giác (hallucination)"
      ],
      "correct": 1,
      "explanation": "Các LLM mang tính phi xác định. Nếu không có các chỉ dẫn định dạng rõ ràng, một lần gọi có thể trả về các gạch đầu dòng, lần gọi tiếp theo là văn xuôi, lần sau nữa là markdown. Việc chỉ định rõ định dạng đảm bảo đầu ra nhất quán và dễ phân tích cú pháp.",
      "stage": "post"
    },
    {
      "question": "Mục đích chính của gợi ý hệ thống (system prompt) là gì?",
      "options": [
        "Để xác thực cuộc gọi API",
        "Để thiết lập các quy tắc hành vi, vai trò và ràng buộc nhất quán áp dụng cho toàn bộ cuộc hội thoại",
        "Để định nghĩa kiến trúc của mô hình",
        "Để nén lịch sử cuộc hội thoại"
      ],
      "correct": 1,
      "explanation": "Gợi ý hệ thống (system prompt) thiết lập thực thể, quy tắc và ràng buộc của mô hình cho toàn bộ phiên làm việc. Nó chạy trước mỗi lượt của người dùng và là cơ chế chính để kiểm soát hành vi của mô hình trong môi trường vận hành.",
      "stage": "post"
    },
    {
      "question": "Làm thế nào để đánh giá một cách khoa học xem việc thay đổi gợi ý có thực sự cải thiện chất lượng đầu ra?",
      "options": [
        "Đọc thử một vài đầu ra và tự đưa ra đánh giá trực quan",
        "Chạy gợi ý trên một tập kiểm thử đa dạng và đo lường các thay đổi trong các chỉ số xác định (độ chính xác, sự tuân thủ định dạng, tính liên quan)",
        "Hỏi mô hình xem liệu nó có đang làm tốt hơn không",
        "Kiểm tra thời gian phản hồi của API"
      ],
      "correct": 1,
      "explanation": "Đánh giá các thay đổi gợi ý trên một vài ví dụ là không đáng tin cậy. Một hệ thống đánh giá có hệ thống với các trường hợp kiểm thử đa dạng và các chỉ số rõ ràng sẽ chỉ ra liệu các thay đổi có thực sự hữu ích trên toàn bộ phân phối hay không, chứ không phải chỉ trên các ví dụ được chọn lựa.",
      "stage": "post"
    }
  ],
  "phases\\11-llm-engineering\\02-few-shot-cot\\quiz.json": [
    {
      "question": "Sự khác biệt cốt lõi giữa gợi ý zero-shot và few-shot là gì?",
      "options": [
        "Zero-shot hoạt động nhanh hơn",
        "Zero-shot chỉ cung cấp chỉ dẫn; few-shot bao gồm các ví dụ minh họa đầu vào-đầu ra trước truy vấn thực tế",
        "Few-shot sử dụng một mô hình khác",
        "Zero-shot không sử dụng gợi ý hệ thống"
      ],
      "correct": 1,
      "explanation": "Gợi ý few-shot (few-shot prompting) bao gồm các ví dụ cụ thể (minh họa) chỉ ra cho mô hình mẫu hành vi mong đợi. Điều này tương tự như việc chỉ cho ai đó cách điền vào một mẫu đơn trước khi yêu cầu họ điền vào đơn của chính họ.",
      "stage": "pre"
    },
    {
      "question": "Kỹ thuật gợi ý Chain-of-Thought (chuỗi tư duy) có cơ chế hoạt động thế nào?",
      "options": [
        "Nó liên kết nhiều cuộc gọi API lại với nhau",
        "Nó chỉ dẫn mô hình hiển thị các bước lập luận trung gian trước khi đưa ra câu trả lời cuối cùng, cải thiện độ chính xác trên các bài toán có nhiều bước",
        "Nó kết nối nhiều mô hình theo chuỗi",
        "Nó tạo ra các phản hồi dài hơn"
      ],
      "correct": 1,
      "explanation": "Gợi ý Chain of Thought (CoT - chuỗi tư duy, ví dụ: 'Hãy suy nghĩ từng bước một') cung cấp cho mô hình 'giấy nháp' để giải quyết các vấn đề. Trên các bài toán toán học GSM8K, riêng kỹ thuật này đã cải thiện độ chính xác của GPT-4o từ 78% lên 91%.",
      "stage": "pre"
    },
    {
      "question": "Tree-of-Thought khác biệt thế nào so với Chain-of-Thought?",
      "options": [
        "Nó sử dụng một cấu trúc dữ liệu cây để lưu trữ",
        "Nó khám phá nhiều lộ trình lập luận song song và đánh giá lộ trình nào dẫn đến câu trả lời tốt nhất",
        "Nó chỉ đơn giản là một chuỗi tư duy dài hơn",
        "Nó sử dụng một mô hình khác"
      ],
      "correct": 1,
      "explanation": "CoT đi theo một lộ trình lập luận duy nhất. Tree-of-Thought tạo ra nhiều lộ trình ứng viên khác nhau, tự đánh giá chúng (có thể sử dụng chính LLM), và chọn lộ trình tối ưu nhất. Điều này giúp ích cho các bài toán mà lộ trình lập luận đầu tiên có thể bị sai.",
      "stage": "post"
    },
    {
      "question": "Khi lựa chọn các ví dụ few-shot, yếu tố nào quan trọng nhất?",
      "options": [
        "Sử dụng càng nhiều ví dụ càng tốt",
        "Lựa chọn các ví dụ đa dạng bao quát các trường hợp khác nhau và thể hiện chính xác định dạng cũng như mẫu lập luận bạn mong muốn",
        "Sử dụng các ví dụ ngắn nhất",
        "Sử dụng các ví dụ từ chính tập kiểm thử"
      ],
      "correct": 1,
      "explanation": "Chất lượng ví dụ quan trọng hơn số lượng. Khoảng 3 - 5 ví dụ đa dạng, được định dạng tốt bao quát các trường hợp biên khác nhau sẽ dạy mô hình mẫu hành vi tốt hơn so với 20 ví dụ lặp đi lặp lại gây lãng phí các token trong cửa sổ ngữ cảnh.",
      "stage": "post"
    },
    {
      "question": "Tại sao CoT giúp cải thiện độ chính xác của mô hình ngay cả khi tập tri thức tĩnh của mô hình không đổi?",
      "options": [
        "Nó kích hoạt các năng lực ẩn của mô hình",
        "Việc tạo ra các token trung gian tạo ra một ngữ cảnh hiệu dụng lớn hơn cho câu trả lời cuối cùng, cho phép mô hình điều phối dựa trên chính lập luận của nó",
        "Nó sử dụng nhiều năng lực tính toán hơn",
        "Nó làm thay đổi trọng số mô hình"
      ],
      "correct": 1,
      "explanation": "Nếu không có CoT, mô hình phải nhảy trực tiếp đến câu trả lời cuối cùng trong một token duy nhất. Với CoT, mỗi bước trung gian là một token mà mô hình điều phối cho bước tiếp theo. Mô hình về cơ bản là 'suy nghĩ thành tiếng', xây dựng dần đến câu trả lời chính xác.",
      "stage": "post"
    }
  ],
  "phases\\11-llm-engineering\\03-structured-outputs\\quiz.json": [
    {
      "question": "Tại sao việc trích xuất đầu ra dạng JSON có cấu trúc từ LLM lại là một thử thách khó khăn?",
      "options": [
        "LLM không thể tạo ra định dạng JSON",
        "LLM tạo ra văn bản tự do theo từng token và có thể tạo ra định dạng JSON không hợp lệ (thiếu dấu ngoặc, sai kiểu dữ liệu, thừa văn bản) tại bất kỳ thời điểm nào",
        "JSON quá phức tạp đối với LLM",
        "LLM chỉ có thể xuất ra văn bản thô"
      ],
      "correct": 1,
      "explanation": "LLM tạo ra các token tự hồi quy. Chúng có thể thêm một dấu phẩy thừa, quên dấu ngoặc đóng, đưa định dạng markdown xung quanh JSON, hoặc tự tạo ra các trường thông tin không tồn tại. Mỗi token là độc lập, do đó tính hợp lệ của cấu trúc không được đảm bảo.",
      "stage": "pre"
    },
    {
      "question": "Constrained decoding (giải mã ràng buộc) là gì?",
      "options": [
        "Hạn chế kích thước từ vựng của mô hình",
        "Ràng buộc các token mà mô hình có thể tạo ra ở mỗi bước để đảm bảo đầu ra tuân thủ một ngữ pháp hoặc lược đồ (schema) cụ thể",
        "Sử dụng một mô hình nhỏ hơn",
        "Nén dữ liệu đầu ra"
      ],
      "correct": 1,
      "explanation": "Giải mã ràng buộc (constrained decoding) che đi các token không hợp lệ tại mỗi bước tạo token. Sau một dấu mở ngoặc nhọn, chỉ các khóa JSON hợp lệ mới được phép xuất hiện. Sau dấu hai chấm, chỉ các token giá trị hợp lệ mới được phép tạo ra. Điều này đảm bảo tính hợp lệ của cấu trúc ở cấp độ token.",
      "stage": "pre"
    },
    {
      "question": "Lợi ích của việc sử dụng các mô hình Pydantic để xác thực đầu ra của LLM là gì?",
      "options": [
        "Chúng giúp các cuộc gọi API nhanh hơn",
        "Chúng định nghĩa các lược đồ có kiểu dữ liệu (typed schemas) tự động xác thực, phân tích cú pháp và từ chối các đầu ra sai định dạng của LLM với các thông báo lỗi rõ ràng",
        "Chúng giảm lượng token sử dụng",
        "Chúng cải thiện độ chính xác của mô hình"
      ],
      "correct": 1,
      "explanation": "Pydantic bắt buộc các kiểu dữ liệu, các trường bắt buộc, các ràng buộc giá trị và các cấu trúc lồng nhau. Khi LLM tạo ra đầu ra không hợp lệ, Pydantic cung cấp các thông báo lỗi cụ thể để có thể gửi ngược lại mô hình phục vụ việc tự sửa lỗi.",
      "stage": "post"
    },
    {
      "question": "Bạn nên xử lý thế nào khi LLM trả về JSON không hợp lệ bất chấp các chỉ dẫn?",
      "options": [
        "Chuyển sang sử dụng một mô hình khác",
        "Triển khai một vòng lặp thử lại gửi thông báo lỗi xác thực ngược lại mô hình làm ngữ cảnh cho nỗ lực sửa đổi",
        "Sửa đổi định dạng JSON một cách thủ công",
        "Tăng thông số nhiệt độ (temperature)"
      ],
      "correct": 1,
      "explanation": "Vòng lặp thử lại với phản hồi lỗi hoạt động rất hiệu quả: phân tích cú pháp đầu ra, bắt các lỗi xác thực, gửi thông báo lỗi ngược lại làm ngữ cảnh ('Đầu ra của bạn gặp lỗi này: ... Hãy sửa nó'). Hầu hết các mô hình đều tự sửa lỗi thành công ở lần thử thứ hai.",
      "stage": "post"
    },
    {
      "question": "Khi nào nên ưu tiên chế độ JSON gốc của API hơn trích xuất dựa trên gợi ý (prompt-based JSON extraction)?",
      "options": [
        "Luôn luôn sử dụng chế độ JSON gốc",
        "Sử dụng chế độ gốc để đảm bảo cấu trúc; sử dụng trích xuất dựa trên gợi ý cho các tác vụ trích xuất phức tạp nơi bạn cần mô hình lập luận về những gì cần trích xuất",
        "Luôn luôn sử dụng trích xuất dựa trên gợi ý",
        "Chúng tạo ra các kết quả giống hệt nhau"
      ],
      "correct": 1,
      "explanation": "Chế độ JSON gốc của API (response_format của OpenAI, tool_use của Anthropic) đảm bảo cấu trúc JSON hợp lệ. Trích xuất dựa trên gợi ý linh hoạt hơn cho các lập luận phức tạp về việc điền trường nào. Hãy sử dụng chế độ gốc khi cấu trúc là yếu tố quan trọng nhất.",
      "stage": "post"
    }
  ],
  "phases\\11-llm-engineering\\04-embeddings\\quiz.json": [
    {
      "question": "Bài toán nào mà vector nhúng (embeddings) có thể giải quyết xuất sắc trong khi tìm kiếm từ khóa thông thường thất bại?",
      "options": [
        "Vector nhúng hoạt động nhanh hơn",
        "Vector nhúng nắm bắt ý nghĩa ngữ nghĩa, khớp cụm từ 'giao dịch không thành công' với 'thẻ bị từ chối thanh toán' mặc dù chúng không chia sẻ từ ngữ nào",
        "Vector nhúng sử dụng ít dung lượng lưu trữ hơn",
        "Vector nhúng hoạt động tốt khi ngoại tuyến"
      ],
      "correct": 1,
      "explanation": "Tìm kiếm từ khóa coi các từ là các ký hiệu độc lập. Vector nhúng (embeddings) ánh xạ văn bản sang các vector nhiều chiều nơi sự tương đồng ngữ nghĩa tương đương với khoảng cách hình học kề cận. Các văn bản có cùng ý nghĩa sẽ tập trung gần nhau bất kể cách lựa chọn từ ngữ.",
      "stage": "pre"
    },
    {
      "question": "Độ tương đồng cosine (cosine similarity) thực hiện đo lường khía cạnh nào giữa hai vector nhúng?",
      "options": [
        "Khoảng cách Euclidean",
        "Góc giữa các vector, biểu thị mức độ tương đồng về hướng của chúng bất kể độ lớn",
        "Tổng các thành phần của chúng",
        "Số lượng kích thước trùng khớp"
      ],
      "correct": 1,
      "explanation": "Độ tương đồng cosine = dot(A,B) / (|A|*|B|). Nó dao động từ -1 (ngược hướng) đến 1 (cùng hướng hoàn toàn). Hai văn bản có cùng ý nghĩa sẽ có các vector chỉ về cùng một hướng, tạo ra độ tương đồng cosine gần bằng 1.",
      "stage": "pre"
    },
    {
      "question": "Số chiều phổ biến của các mô hình nhúng văn bản hiện đại là bao nhiêu?",
      "options": [
        "2-10 chiều",
        "50-100 chiều",
        "768-3072 chiều",
        "Trển 100.000 chiều"
      ],
      "correct": 2,
      "explanation": "Các mô hình nhúng văn bản hiện đại (text-embedding-3 của OpenAI, BGE, E5) tạo ra các vector có kích thước từ 768 đến 3072 chiều. Số chiều lớn hơn giúp nắm bắt nhiều sắc thái hơn nhưng tốn chi phí lưu trữ và tìm kiếm hơn.",
      "stage": "post"
    },
    {
      "question": "Tại sao nên đánh giá chất lượng vector nhúng bằng các bài kiểm chuẩn truy xuất (retrieval benchmarks) thay vì chỉ kiểm tra điểm tương đồng trực tiếp?",
      "options": [
        "Điểm số tương đồng luôn luôn sai",
        "Các giá trị tương đồng tuyệt đối thay đổi tùy theo mô hình; điều quan trọng là liệu các tài liệu liên quan có được xếp hạng cao hơn tài liệu không liên quan hay không (precision@k, recall)",
        "Các bài kiểm chuẩn truy xuất chạy nhanh hơn",
        "Điểm số tương đồng không sử dụng khoảng cách cosine"
      ],
      "correct": 1,
      "explanation": "Một độ tương đồng cosine bằng 0.85 có thể có nghĩa là 'rất tương đồng' đối với một mô hình này và 'tương đồng vừa phải' đối với mô hình khác. Các chỉ số truy xuất (precision@k, recall) đo lường những gì thực sự quan trọng: liệu tài liệu chính xác có được trả về hay không?",
      "stage": "post"
    },
    {
      "question": "Khi nào nên lựa chọn một mô hình nhúng mã nguồn mở/cục bộ thay vì các mô hình qua API?",
      "options": [
        "Các mô hình cục bộ luôn luôn tốt hơn",
        "Khi bạn cần bảo mật dữ liệu, vận hành ngoại tuyến, chi phí thấp hơn ở quy mô lớn, hoặc tinh chỉnh đặc thù theo miền dữ liệu cụ thể",
        "Các mô hình cục bộ tạo ra các vector nhúng chất lượng cao hơn",
        "Các mô hình API không hỗ trợ xử lý theo lô"
      ],
      "correct": 1,
      "explanation": "Vector nhúng qua API (OpenAI, Cohere) dễ sử dụng nhưng gửi dữ liệu của bạn ra bên ngoài. Các mô hình cục bộ (BGE, E5, Nomic) giữ dữ liệu riêng tư, loại bỏ chi phí cho mỗi lần gọi ở quy mô lớn, và có thể được tinh chỉnh trên dữ liệu đặc thù của miền.",
      "stage": "post"
    }
  ],
  "phases\\11-llm-engineering\\05-context-engineering\\quiz.json": [
    {
      "question": "Sự khác biệt cốt lõi giữa kỹ nghệ gợi ý (prompt engineering) và kỹ nghệ ngữ cảnh (context engineering) là gì?",
      "options": [
        "Chúng là cùng một thứ",
        "Gợi ý (prompt) là truy vấn của người dùng; ngữ cảnh (context) là mọi thứ trong cửa sổ của mô hình: gợi ý hệ thống, các công cụ, tài liệu được truy xuất, lịch sử cuộc gọi và chính gợi ý đó",
        "Kỹ nghệ ngữ cảnh là về thiết kế cơ sở dữ liệu",
        "Kỹ nghệ gợi ý tiến bộ hơn"
      ],
      "correct": 1,
      "explanation": "Kỹ nghệ gợi ý tập trung vào việc tạo ra chỉ dẫn cho người dùng. Kỹ nghệ ngữ cảnh (context engineering) quản lý toàn bộ đầu vào cho mô hình: những gì được đưa vào, những gì bị loại bỏ, theo thứ tự nào, và cách phân bổ cửa sổ ngữ cảnh có hạn.",
      "stage": "pre"
    },
    {
      "question": "Tại sao thứ tự sắp xếp trong cửa sổ ngữ cảnh lại ảnh hưởng đến hiệu năng của LLM?",
      "options": [
        "Không ảnh hưởng -- LLM xử lý tất cả các token bình đẳng như nhau",
        "LLM có thiên kiến cận thời (recency) và thiên kiến ưu tiên (primacy), chú ý nhiều hơn đến phần đầu và phần cuối của cửa sổ ngữ cảnh",
        "Thứ tự bảng chữ cái giúp mô hình tìm kiếm nhanh hơn",
        "Thứ tự chỉ quan trọng đối với mã nguồn"
      ],
      "correct": 1,
      "explanation": "Nghiên cứu chỉ ra rằng các LLM chú ý nhiều hơn đến phần đầu và phần cuối của cửa sổ ngữ cảnh (hiện tượng 'lost in the middle' - lạc ở giữa). Việc đặt thông tin quan trọng nhất ở đầu hoặc cuối ngữ cảnh cải thiện hiệu quả sử dụng ngữ cảnh.",
      "stage": "pre"
    },
    {
      "question": "Một trợ lý lập trình sử dụng 22,700 tokens trên tổng số 128K của cửa sổ ngữ cảnh. Tại sao việc quản lý ngân sách token vẫn vô cùng quan trọng?",
      "options": [
        "128K là đủ cho mọi trường hợp sử dụng",
        "Các cuộc hội thoại dài, tệp mã nguồn lớn và tài liệu được truy xuất có thể nhanh chóng lấp đầy cửa sổ ngữ cảnh; nếu không quản lý ngân sách, ngữ cảnh quan trọng sẽ bị cắt bớt",
        "Việc đếm token không chính xác",
        "Chỉ có gợi ý mới là thành phần quan trọng"
      ],
      "correct": 1,
      "explanation": "22.700 token mới chỉ là mức cơ bản. Một cuộc hội thoại dài 50 lượt bổ sung thêm hơn 30.000 token. Việc truy xuất một kho mã nguồn lớn bổ sung hơn 50.000 token. Kết quả gọi công cụ bổ sung thêm nhiều hơn nữa. Nếu không quản lý chủ động, cửa sổ sẽ bị lấp đầy và ngữ cảnh cũ nhất sẽ bị mất.",
      "stage": "post"
    },
    {
      "question": "Chiến lược cửa sổ trượt (sliding window) cho lịch sử hội thoại hoạt động dựa trên nguyên lý nào?",
      "options": [
        "Di chuyển mô hình sang một máy chủ khác",
        "Chỉ giữ lại N lượt hội thoại gần nhất trong ngữ cảnh và loại bỏ các lượt cũ hơn, có thể tóm tắt chúng trước",
        "Xử lý cuộc hội thoại dưới dạng các khối có kích thước cố định",
        "Mở rộng cửa sổ ngữ cảnh một cách động"
      ],
      "correct": 1,
      "explanation": "Chiến lược cửa sổ trượt (sliding window) giữ K lượt hội thoại gần nhất trong toàn bộ ngữ cảnh. Các lượt cũ hơn bị loại bỏ hoặc thay thế bằng bản tóm tắt. Điều này giới hạn dung lượng bộ nhớ sử dụng trong khi bảo tồn ngữ cảnh gần nhất liên quan nhất.",
      "stage": "post"
    },
    {
      "question": "Một bộ lắp ráp ngữ cảnh (context assembler) nên phân bổ token thế nào cho các thành phần?",
      "options": [
        "Phân bổ bình đẳng cho từng thành phần",
        "Phân bổ động dựa trên loại truy vấn: một câu hỏi đơn giản cần ít ngữ cảnh truy xuất hơn; một câu hỏi phức tạp cần nhiều hơn, và luôn dự phòng không gian để tạo câu trả lời",
        "Luôn luôn tối đa hóa ngữ cảnh truy xuất",
        "Tối thiểu hóa các token của gợi ý hệ thống"
      ],
      "correct": 1,
      "explanation": "Một câu hỏi thực tế đơn giản có thể chỉ cần 500 token ngữ cảnh truy xuất. Một phân tích phức tạp có thể cần tới 10.000 token. Một bộ lắp ráp ngữ cảnh tốt sẽ điều chỉnh phân bổ một cách động trong khi luôn dự phòng không gian cho phản hồi của mô hình.",
      "stage": "post"
    }
  ],
  "phases\\11-llm-engineering\\06-rag\\quiz.json": [
    {
      "question": "Khái niệm RAG là viết tắt của cụm từ nào và giải quyết bài toán cụ thể nào?",
      "options": [
        "Random Augmented Generation -- tạo ra các đầu ra ngẫu nhiên",
        "Retrieval-Augmented Generation (Tạo sinh tăng cường truy xuất) -- cung cấp cho LLM quyền truy cập vào nguồn tri thức bên ngoài mà chúng không được huấn luyện trên đó",
        "Recurrent Attention Generation -- cải thiện cơ chế chú ý",
        "Reduced Architecture Generation -- làm cho mô hình nhỏ hơn"
      ],
      "correct": 1,
      "explanation": "RAG truy xuất các tài liệu liên quan từ một cơ sở tri thức bên ngoài và thêm chúng vào gợi ý. Điều này cung cấp cho LLM quyền truy cập vào thông tin cập nhật, đặc thù theo miền dữ liệu mà không cần huấn luyện lại.",
      "stage": "pre"
    },
    {
      "question": "Tại sao RAG lại được ưu tiên hơn tinh chỉnh (fine-tuning) cho hầu hết các ứng dụng cần độ chính xác tri thức?",
      "options": [
        "RAG tạo ra các mô hình tốt hơn",
        "RAG rẻ hơn, có thể cập nhật ngay lập tức khi tài liệu thay đổi, và cung cấp nguồn trích dẫn rõ ràng -- trong khi tinh chỉnh rất tốn kém và dễ bị lỗi thời",
        "Tinh chỉnh hoàn toàn không hiệu quả",
        "RAG sử dụng ít bộ nhớ hơn"
      ],
      "correct": 1,
      "explanation": "Tinh chỉnh tiêu tốn hàng ngàn đô la, tạo ra một mô hình tĩnh bị lỗi thời khi tài liệu thay đổi, và không cung cấp nguồn trích dẫn. RAG cập nhật ngay lập tức (chỉ cần cập nhật kho lưu trữ tài liệu), chỉ tốn chi phí nhúng và lưu trữ, và có thể trích dẫn nguồn cụ thể.",
      "stage": "pre"
    },
    {
      "question": "Trình tự các bước chính xác của một đường ống RAG cơ bản là gì?",
      "options": [
        "Tạo câu trả lời, truy xuất, nhúng vector, phân khối",
        "Phân khối tài liệu, nhúng các khối, lưu trữ vào cơ sở dữ liệu vector, nhúng truy vấn, truy xuất các khối tương tự, tạo câu trả lời cùng ngữ cảnh",
        "Nhúng truy vấn, tạo câu trả lời, truy xuất tài liệu",
        "Lưu trữ tài liệu, truy vấn LLM, bổ sung tài liệu vào phản hồi"
      ],
      "correct": 1,
      "explanation": "Giai đoạn nạp dữ liệu: phân khối tài liệu -> nhúng các khối -> lưu vào DB vector. Thời điểm truy vấn: nhúng truy vấn của người dùng -> truy xuất K khối tương tự nhất -> thêm các khối vào gợi ý -> tạo câu trả lời dựa trên ngữ cảnh được truy xuất.",
      "stage": "post"
    },
    {
      "question": "Một lỗi hệ thống thường gặp (failure mode) trong các hệ thống RAG cơ bản là gì?",
      "options": [
        "LLM từ chối trả lời",
        "Các khối được truy xuất tương đồng về mặt ngữ nghĩa với truy vấn nhưng không chứa câu trả lời thực tế (ví dụ: trả về 'chiến lược doanh thu' khi được hỏi về 'số liệu doanh thu Q3')",
        "Cơ sở dữ liệu vector gặp sự cố",
        "Các vector nhúng quá lớn"
      ],
      "correct": 1,
      "explanation": "Tìm kiếm ngữ nghĩa tìm kiếm văn bản có vẻ 'giống' truy vấn, chứ không nhất thiết là văn bản 'trả lời' nó. Một truy vấn về doanh thu có thể truy xuất các khối thảo luận về chiến lược doanh thu thay vì khối chứa con số thực tế.",
      "stage": "post"
    },
    {
      "question": "Làm thế nào để đánh giá toàn diện chất lượng của một hệ thống RAG?",
      "options": [
        "Bằng cách kiểm tra xem LLM có tạo ra đầu ra nào không",
        "Sử dụng cả chỉ số truy xuất (chúng ta có tìm được các khối chính xác không?) và chỉ số tạo sinh (câu trả lời có trung thực với ngữ cảnh được truy xuất không?)",
        "Bằng cách chỉ đo lường thời gian phản hồi",
        "Bằng cách đếm số lượng tài liệu được truy xuất"
      ],
      "correct": 1,
      "explanation": "Đánh giá RAG gồm hai phần: chất lượng truy xuất (precision/recall của các khối được truy xuất so với nhãn gốc) và chất lượng tạo sinh (tính trung thực với ngữ cảnh, tính liên quan đến truy vấn, không phát sinh ảo giác vượt ngoài thông tin được truy xuất).",
      "stage": "post"
    }
  ],
  "phases\\11-llm-engineering\\07-advanced-rag\\quiz.json": [
    {
      "question": "Hạn chế lớn nhất của tìm kiếm ngữ nghĩa top-k cơ bản trong RAG là gì?",
      "options": [
        "Phép toán chạy quá chậm",
        "Nó truy xuất các khối tương đồng ngữ nghĩa với truy vấn nhưng có thể không chứa câu trả lời thực tế, đặc biệt đối với các câu hỏi mơ hồ hoặc đòi hỏi nhiều bước suy luận (multi-hop)",
        "Nó không thể xử lý các tài liệu lớn",
        "Nó bắt buộc yêu cầu GPU"
      ],
      "correct": 1,
      "explanation": "Tìm kiếm ngữ nghĩa cơ bản chỉ khớp ý nghĩa ở mức bề mặt. Câu hỏi 'Doanh thu quý trước là bao nhiêu?' có thể truy xuất các khối về 'chiến lược doanh thu' (tương đồng ngữ nghĩa) thay vì khối ghi nhận '$47.2M trong Q3 2025' (sử dụng từ 'lợi nhuận/thu nhập').",
      "stage": "pre"
    },
    {
      "question": "Cơ chế tìm kiếm kết hợp (hybrid search) trong RAG hoạt động thế nào?",
      "options": [
        "Sử dụng hai LLM khác nhau",
        "Kết hợp so khớp từ khóa BM25 với tìm kiếm vector ngữ nghĩa để nắm bắt cả các thuật ngữ chính xác lẫn mức độ liên quan dựa trên ý nghĩa",
        "Tìm kiếm trên nhiều cơ sở dữ liệu",
        "Sử dụng cả CPU và GPU cho tìm kiếm"
      ],
      "correct": 1,
      "explanation": "BM25 bắt các kết quả khớp từ khóa chính xác (ví dụ: '$47.2M' hoặc 'Q3'). Tìm kiếm ngữ nghĩa bắt các kết quả khớp về mặt ý nghĩa. Kết hợp chúng với một bộ tái xếp hạng (reranker) sẽ mang lại hiệu quả tối ưu của cả hai phương pháp: độ chính xác trên các thuật ngữ cụ thể cộng với độ bao phủ trên các biến thể ngữ nghĩa.",
      "stage": "pre"
    },
    {
      "question": "Thao tác tái xếp hạng bằng cross-encoder (cross-encoder reranker) đóng vai trò gì trong một đường ống RAG nâng cao?",
      "options": [
        "Nó tạo ra câu trả lời cuối cùng",
        "Nó nhận các cặp (truy vấn, tài liệu) và chấm điểm mức độ liên quan của chúng với độ chính xác cao hơn so với độ tương đồng của vector nhúng, sắp xếp lại kết quả truy xuất ban đầu",
        "Nó mã hóa các tài liệu thành các vector",
        "Nó chia nhỏ tài liệu thành các khối"
      ],
      "correct": 1,
      "explanation": "Độ tương đồng bi-encoder (sử dụng cho truy xuất ban đầu) nhanh nhưng mang tính xấp xỉ. Một bộ cross-encoder xử lý toàn bộ cặp truy vấn-tài liệu cùng nhau với cơ chế chú ý chéo, đưa ra điểm số liên quan chính xác hơn nhiều để tái xếp hạng các ứng viên hàng đầu.",
      "stage": "post"
    },
    {
      "question": "Kỹ thuật biến đổi truy vấn HyDE (Hypothetical Document Embedding) là gì?",
      "options": [
        "Ẩn truy vấn khỏi mô hình",
        "Sử dụng LLM để tạo ra một câu trả lời giả thuyết, sau đó nhúng câu trả lời đó làm truy vấn tìm kiếm thay cho câu hỏi gốc",
        "Mã hóa truy vấn để bảo mật",
        "Mở rộng các từ viết tắt trong truy vấn"
      ],
      "correct": 1,
      "explanation": "Truy vấn gốc 'Doanh thu Q3 là bao nhiêu?' có thể không nằm gần khối câu trả lời trong không gian vector. HyDE yêu cầu LLM tạo ra một câu trả lời giả thuyết ('Doanh thu Q3 đạt xấp xỉ...'), sau đó sử dụng nó làm truy vấn tìm kiếm, giúp nó nằm gần hơn với các khối thực sự chứa câu trả lời.",
      "stage": "post"
    },
    {
      "question": "Tại sao cơ chế phân khối cha-con (parent-child chunking) mang lại hiệu năng RAG vượt trội hơn so với phân khối phẳng (flat chunking)?",
      "options": [
        "Nó giúp lập chỉ mục nhanh hơn",
        "Các khối con (child chunks) nhỏ được sử dụng để truy xuất chính xác, nhưng khối mẹ (parent chunk) lớn hơn sẽ được trả về làm ngữ cảnh, ngăn ngừa vấn đề 'mất ngữ cảnh'",
        "Nó giảm số lượng khối",
        "Nó loại bỏ sự cần thiết của vector nhúng"
      ],
      "correct": 1,
      "explanation": "Các khối nhỏ (200 token) nhúng chính xác nhưng thiếu ngữ cảnh. Các khối lớn (2000 token) có ngữ cảnh nhưng nhúng không chính xác. Kỹ thuật parent-child sử dụng các khối nhỏ cho độ chính xác tìm kiếm nhưng trả về khối mẹ lớn cho ngữ cảnh tạo câu trả lời.",
      "stage": "post"
    }
  ]
}

with open(".agent/scratch/translated_batch8.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("SUCCESSFULLY GENERATED TRANSLATED BATCH 8!")
