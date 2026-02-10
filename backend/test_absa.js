const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, 'config/.env') });

const { analyzeAspects, analyzeSentiment } = require('./controller/analyzeSentiment');

// ─── Test Cases: [input, expectedLabels[]] ───
const ASPECT_TESTS = [
    // ── Shipping with filler words ──
    ['giao hàng hơi chậm', ['Giao hàng chậm']],
    ['giao hàng hơi bị chậm', ['Giao hàng chậm']],
    ['ship quá là lâu', ['Giao hàng chậm']],
    ['vận chuyển rất trễ', ['Giao hàng chậm']],
    ['giao chậm quá', ['Giao hàng chậm']],
    ['giao hàng nhanh lắm', ['Giao hàng nhanh']],
    ['giao hàng cực nhanh', ['Giao hàng nhanh']],
    ['ship siêu lẹ', ['Giao hàng nhanh']],
    ['đóng gói rất cẩn thận', ['Giao hàng nhanh']],
    ['hộp bị móp', ['Giao hàng chậm']],
    ['chờ mãi mới nhận được', ['Giao hàng chậm']],

    // ── Quality with filler words ──
    ['chất lượng rất là tốt', ['Chất lượng tốt']],
    ['chất lượng cũng tạm ổn', ['Chất lượng tốt']], // should NOT match "CL kém"
    ['hàng quá đẹp', ['Chất lượng tốt']],
    ['chất lượng hơi kém', ['Chất lượng kém']],
    ['sản phẩm rất bền', ['Chất lượng tốt']],
    ['hàng bị lỗi', ['Chất lượng kém']],
    ['chất lượng xịn sò', ['Chất lượng tốt']],

    // ── Price with filler words ──
    ['giá quá là đắt', ['Giá đắt']],
    ['giá hơi cao', ['Giá đắt']],
    ['giá rất rẻ', ['Giá rẻ']],
    ['giá cũng hợp lý', ['Giá rẻ']],
    ['đáng tiền', ['Giá rẻ']],
    ['phí ship cao quá', ['Giá đắt']],
    ['giá mềm lắm', ['Giá rẻ']],

    // ── Service with filler words ──
    ['shop tư vấn cực kỳ nhiệt tình', ['Phục vụ tốt']],
    ['phục vụ hơi bị tệ', ['Phục vụ tệ']],
    ['shop rep rất nhanh', ['Phục vụ tốt']],
    ['không rep gì cả', ['Phục vụ tệ']],
    ['nhân viên thân thiện', ['Phục vụ tốt']],

    // ── Negation handling ──
    ['chất lượng không tốt', ['Chất lượng kém']],
    ['giao hàng không nhanh', ['Giao hàng chậm']],
    ['giá không đắt', ['Giá rẻ']],
    ['shop ko nhiệt tình', ['Phục vụ tệ']],

    // ── Mixed review ──
    ['sản phẩm dùng rất thích, chất lượng tốt nhưng giao hàng hơi chậm.', ['Chất lượng tốt', 'Giao hàng chậm']],
    ['hàng đẹp giá rẻ nhưng ship chậm', ['Chất lượng tốt', 'Giá rẻ', 'Giao hàng chậm']],
];

async function test() {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║      KIỂM TRA TÍNH NĂNG PHÂN TÍCH CẢM XÚC         ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    // ── Part 1: PhoBERT Sentiment Test ──
    const text = 'Sản phẩm dùng rất thích, chất lượng tốt nhưng giao hàng hơi chậm.';
    try {
        console.log(`[PhoBERT] Input: "${text}"`);
        console.log('  Đang gọi PhoBERT (Cảm xúc chung)...');
        const sentiment = await analyzeSentiment(text);
        console.log('  → Kết quả:', JSON.stringify(sentiment, null, 2));
    } catch (error) {
        console.error('  ⚠ PhoBERT Error:', error.message);
    }

    // ── Part 2: Aspect Regex Tests ──
    console.log('\n────────────────────────────────────────────────────');
    console.log('  ASPECT-BASED ANALYSIS (Rule-based Regex Tests)');
    console.log('────────────────────────────────────────────────────\n');

    let passed = 0;
    let failed = 0;

    for (const [input, expected] of ASPECT_TESTS) {
        const result = await analyzeAspects(input);
        const resultLabels = result.map((r) => r.label).sort();
        const expectedSorted = [...expected].sort();

        const match = JSON.stringify(resultLabels) === JSON.stringify(expectedSorted);

        if (match) {
            passed++;
            console.log(`  ✓ "${input}"`);
            console.log(`    → ${resultLabels.join(', ')}`);
        } else {
            failed++;
            console.log(`  ✗ "${input}"`);
            console.log(`    Expected: ${expectedSorted.join(', ')}`);
            console.log(`    Got:      ${resultLabels.join(', ') || '(none)'}`);
        }
    }

    console.log('\n────────────────────────────────────────────────────');
    console.log(`  KẾT QUẢ: ${passed}/${passed + failed} passed, ${failed} failed`);
    console.log('────────────────────────────────────────────────────');
}

test();
