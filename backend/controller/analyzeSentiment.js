const axios = require('axios');
const logger = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════════
const BASE_URL = 'https://router.huggingface.co/hf-inference/models';
const SENTIMENT_MODEL = 'wonrax/phobert-base-vietnamese-sentiment';

// ═══════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════
function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Split Vietnamese text into sentences.
 * Handles: period (.), exclamation (!), question (?), semicolons, newlines, and Vietnamese comma-based clauses.
 * Also splits on contrast conjunctions (nhưng, tuy nhiên, etc.) to isolate opposing clauses.
 */
function splitSentences(text) {
    // Step 1: Split on sentence-ending punctuation and newlines
    let parts = text.split(/[.!?\n;]+/).map(s => s.trim()).filter(s => s.length > 0);

    // Step 2: Further split on contrast conjunctions to isolate opposing clauses
    const contrastSplitter = /\s*(?:nhưng mà|nhưng lại|nhưng|tuy nhiên|thế mà|vậy mà|tuy vậy|dù vậy|song|mà lại)\s*/i;
    const result = [];
    for (const part of parts) {
        const subParts = part.split(contrastSplitter).map(s => s.trim()).filter(s => s.length > 0);
        result.push(...subParts);
    }

    // If the original text has no splits, return it as a single "sentence"
    return result.length > 0 ? result : [text.trim()];
}

/**
 * Normalize Vietnamese text: expand abbreviations, teen code, slang.
 * Runs BEFORE any regex matching so patterns stay clean.
 */
function normalizeText(text) {
    let t = text.toLowerCase().trim();

    // ── Common abbreviations & teen code ──
    const abbreviations = {
        // Quality / General
        'sp': 'sản phẩm',
        'hàg': 'hàng',
        'đc': 'được',
        'dc': 'được',
        'dk': 'được',
        'nc': 'nói chung',
        'bth': 'bình thường',
        'bt': 'bình thường',
        'cx': 'cũng',
        'cg': 'cũng',
        'vs': 'với',
        'ib': 'inbox',
        'fb': 'facebook',
        'ntn': 'như thế này',
        'nv': 'nhân viên',
        'kh': 'khách hàng',
        'mn': 'mọi người',
        'đt': 'điện thoại',
        'tl': 'trả lời',
        'r': 'rồi',
        'k': 'không',
        'ko': 'không',
        'hok': 'không',
        'hem': 'không',
        'hông': 'không',
        'kg': 'không',
        'kp': 'không phải',
        'nma': 'nhưng mà',
        'nhg': 'nhưng',
        'lun': 'luôn',
        'ln': 'luôn',
        'xl': 'xin lỗi',
        'oke': 'ok',
        'okie': 'ok',
        'okee': 'ok',
        'lm': 'lắm',
        // Shipping
        'gh': 'giao hàng',
        'vc': 'vận chuyển',
        // Rating / Score
        '10đ': 'mười điểm',
        '10 điểm': 'mười điểm',
        '100đ': 'một trăm điểm',
        '5 sao': 'năm sao',
        '5sao': 'năm sao',
        '10/10': 'mười trên mười',
        '100/100': 'một trăm trên một trăm',
    };

    // Replace abbreviations (whole word only)
    for (const [abbr, full] of Object.entries(abbreviations)) {
        const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (abbr.length <= 2) {
            t = t.replace(new RegExp(`(?<=^|\\s)${escaped}(?=\\s|[,!?.;:]|$)`, 'g'), full);
        } else {
            t = t.replace(new RegExp(`(?<=^|\\s|[,!?.])${escaped}(?=\\s|[,!?.;:]|$)`, 'g'), full);
        }
    }

    // ── Normalize repeated characters: "đẹpppp" → "đẹp", "quáááá" → "quá" ──
    t = t.replace(/(.)\1{2,}/g, '$1');

    return t;
}

// ═══════════════════════════════════════════════════════════════
//  HUGGING FACE API
// ═══════════════════════════════════════════════════════════════

/**
 * Generic helper to call Hugging Face API with retry logic
 */
async function callHuggingFaceAPI(modelId, payload, retries = 5) {
    const url = `${BASE_URL}/${modelId}`;
    const headers = {};

    if (process.env.HUGGINGFACE_API_TOKEN) {
        headers.Authorization = `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`;
    }

    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.post(url, payload, { headers });
            return response.data;
        } catch (error) {
            const errData = error.response ? error.response.data : {};

            // Model is loading (503)
            if (errData.error && typeof errData.error === 'string' && errData.error.includes('loading')) {
                const estimatedTime = errData.estimated_time || 20;
                logger.warn(`Model ${modelId} is loading... Waiting ${estimatedTime}s (Attempt ${i + 1}/${retries})`);
                await wait(Math.max(estimatedTime * 1000, 10000));
                continue;
            }

            // Other HTTP errors
            if (error.response && error.response.status !== 503) {
                logger.error(`HF API Failed (${modelId}): [${error.response.status}] ${JSON.stringify(errData)}`);
                return null;
            }

            // Network errors → retry with backoff
            logger.error(`Network error calling HF (${modelId}): ${error.message}. Retrying...`);
            await wait(3000 * (i + 1));
        }
    }
    return null;
}

/**
 * Call PhoBERT for overall sentiment (POS / NEG / NEU)
 */
async function analyzeSentiment(review) {
    const result = await callHuggingFaceAPI(SENTIMENT_MODEL, { inputs: review });
    return result;
}

/**
 * Extract the dominant label from PhoBERT output
 * PhoBERT returns [[{label: 'POS', score: 0.9}, ...]]
 */
function getDominantLabel(result) {
    const labels = Array.isArray(result) ? result[0] : result;
    if (!labels || !Array.isArray(labels) || labels.length === 0) return null;
    const dominant = labels.reduce((prev, curr) => (curr.score > prev.score ? curr : prev));
    return { label: dominant.label, score: dominant.score };
}

// ═══════════════════════════════════════════════════════════════
//  INTENSIFIER & HEDGING SCORING
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate confidence score based on intensifiers and hedging words.
 *
 * "siêu tốt"        → 0.95 (strong intensifier)
 * "rất tốt"         → 0.90
 * "khá tốt"         → 0.75 (moderate hedge)
 * "tạm được"        → 0.55 (weak hedge)
 * "tốt" (default)   → 0.85
 */
function calculateScore(sentenceText) {
    // Strong intensifiers
    if (/(?:siêu|cực kỳ|cực|vô cùng|quá trời|quá xá|đỉnh nóc|kịch trần|xuất sắc|max|rất rất|tuyệt vời|hoàn hảo|tuyệt đối)/.test(sentenceText)) {
        return 0.95;
    }
    // Medium intensifiers
    if (/(?:rất|quá|lắm|thật sự|thực sự|vô đối|khỏi\s*chê|dã man|đỉnh|mười điểm|năm sao|mười trên mười)/.test(sentenceText)) {
        return 0.90;
    }
    // Moderate hedges
    if (/(?:khá|tương đối|cũng|khá là|cũng khá)/.test(sentenceText)) {
        return 0.75;
    }
    // Weak hedges
    if (/(?:hơi|tạm|bình thường|cũng được|tàm tạm|chấp nhận|tạm ổn|cũng tạm)/.test(sentenceText)) {
        return 0.55;
    }
    return 0.85;
}

// ═══════════════════════════════════════════════════════════════
//  SARCASM / CONTRAST DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Detect sarcasm and contrast patterns across the entire normalized text.
 *
 * Patterns:
 *   1. "tốt lắm, mua về hỏng luôn"  → contrast
 *   2. "chất lượng tuyệt vời luôn 😂" → sarcasm (positive + laughing emoji)
 *   3. "5 sao cho nó vui"            → dismissive
 *   4. "khác xa hình"                → contrast with product images
 */
function detectSarcasmAndContrast(text) {
    const result = { isSarcastic: false, contrastType: null, contrastDetails: null };

    // ── Pattern 1: positive ... BUT ... negative ──
    const contrastConjunctions = /(?:nhưng|nhưng mà|nma|nhg|mà|nhưng lại|tuy nhiên|thế mà|vậy mà|song|dù vậy|tuy vậy)/;
    const positiveWords = /(?:tốt|đẹp|xịn|hay|ổn|ok|tuyệt|xuất sắc|chất lượng|nhanh|rẻ|hài lòng)/;
    const negativeWords = /(?:hỏng|vỡ|rách|chậm|tệ|xấu|lỗi|kém|sai|thất vọng|dỏm|fake|gãy|bong|tróc|bể|nát|móp)/;

    const contrastPattern = new RegExp(
        `(${positiveWords.source}).{0,40}?(${contrastConjunctions.source}).{0,40}?(${negativeWords.source})`, 'i'
    );
    const contrastMatch = text.match(contrastPattern);
    if (contrastMatch) {
        result.isSarcastic = true;
        result.contrastType = 'contrast';
        result.contrastDetails = `"${contrastMatch[1]}" → "${contrastMatch[2]}" → "${contrastMatch[3]}"`;
    }

    // ── Pattern 2: positive + sarcasm signal ──
    const sarcasmSignals = /(?:😂|🤣|😏|🙃|=\)\)|\:\)\)|haha|hehe|lol|cho vui|cho có|nói chơi|đùa|v[ậa]y thôi|chứ sao)/;
    if (!result.isSarcastic) {
        const posMatch = text.match(positiveWords);
        const sarcMatch = text.match(sarcasmSignals);
        if (posMatch && sarcMatch && sarcMatch.index > posMatch.index) {
            result.isSarcastic = true;
            result.contrastType = 'sarcasm';
        }
    }

    // ── Pattern 3: "khác xa hình / không giống mô tả" ──
    if (!result.isSarcastic) {
        if (/(?:khác xa|không giống|khác hoàn toàn|không như).{0,10}?(?:hình|ảnh|mô tả|quảng cáo)/.test(text)) {
            result.isSarcastic = true;
            result.contrastType = 'contrast';
            result.contrastDetails = 'Sản phẩm khác với mô tả/hình ảnh';
        }
    }

    return result;
}

// ═══════════════════════════════════════════════════════════════
//  SENTENCE-LEVEL ASPECT EXTRACTION
// ═══════════════════════════════════════════════════════════════

// --- shared regex building blocks ---
const WE = '(?=\\s|[,!?.;:]|$)';     // word-end boundary
const BR = '.{0,12}?';               // bridge (tightened to 12 chars)
const NEG_PREFIX = '(?:không|chẳng|chả|đâu có|chưa|hông|ko|hem|hok|kg|k )\\s*';
const NO_NEG = '(?<!không |chẳng |chả |chưa |hông |ko |hem |hok |kg |k )';

// --- Aspect category definitions ---
const ASPECT_DEFS = {
    quality: {
        subject: '(?:chất lượng|sản phẩm|hàng|vải|chất|form|dáng|mẫu mã|sản phẩm|đồ)',
        positive: '(?:tốt|cao|xịn|ổn|đẹp|mịn|dày|bền|chắc chắn|ok|okay|ưng|chuẩn|đỉnh|xuất sắc|tuyệt vời|được|ngon|xịn sò|hoàn hảo|chất|xịn xò|thích|ưng ý|ưng bụng|nịnh mắt|sang|mướt|xịn xỉu)',
        negative: '(?:kém|tệ|thấp|xấu|dỏm|mỏng|rách|hỏng|lỗi|nhăn|cũ kỹ|pha ke|fake|dở|tệ hại|rẻ tiền|gãy|vỡ|bong tróc|bể|nát|thất vọng|dơ|bẩn|cùi|nhái|tào lao|tệ quá|tệ lắm)',
        posLabel: 'Chất lượng tốt',
        negLabel: 'Chất lượng kém',
    },
    shipping: {
        subject: '(?:giao hàng|giao|ship|vận chuyển|đóng gói|shipper|đơn hàng|bưu kiện)',
        positive: '(?:nhanh|sớm|lẹ|hỏa tốc|cẩn thận|đẹp|kỹ|đúng hẹn|đúng|ổn|tốt|an toàn|nguyên vẹn|gọn gàng|chắc chắn|chu đáo|chỉn chu)',
        negative: '(?:chậm|lâu|trễ|muộn|sơ sài|nát|kém|móp|bẹp|mãi|delay|hư|vỡ|bể|ẩu|bị lỗi|bị méo|bị bẹp|lỏng lẻo|thiếu)',
        posLabel: 'Giao hàng nhanh',
        negLabel: 'Giao hàng chậm',
    },
    price: {
        subject: '(?:giá|chi phí|giá cả|giá tiền)',
        positive: '(?:rẻ|tốt|hợp lý|phải chăng|ổn|ok|vừa túi tiền|sinh viên|bình dân|mềm|hạt dẻ|xứng đáng|hời|siêu rẻ|rẻ bất ngờ)',
        negative: '(?:đắt|cao|chát|mắc|cắt cổ|trên trời|chặt chém|đắt đỏ|siêu đắt|hơi mắc)',
        posLabel: 'Giá hợp lý',
        negLabel: 'Giá cao',
    },
    service: {
        subject: '(?:shop|tư vấn|phục vụ|rep|trả lời|nhân viên|chăm sóc|cskh|seller|người bán|admin|chủ shop|hỗ trợ)',
        positive: '(?:nhiệt tình|tốt|nhanh|dễ thương|chu đáo|thân thiện|chi tiết|tận tâm|chuyên nghiệp|lịch sự|vui vẻ|ổn|tâm huyết|rep nhanh|tư vấn kỹ|nhiệt huyết|dễ chịu)',
        negative: '(?:tệ|chậm|láo|thái độ|vô duyên|cọc|hách dịch|kém|bất lịch sự|khó chịu|lừa đảo|hờ hững|vô trách nhiệm|im lặng)',
        posLabel: 'Phục vụ tốt',
        negLabel: 'Phục vụ kém',
    },
};

/**
 * Analyze a single sentence and return the aspects found.
 * Each aspect = { label, score, source }
 */
function analyzeSentenceAspects(sentence) {
    const aspects = [];
    const score = calculateScore(sentence);

    for (const [, def] of Object.entries(ASPECT_DEFS)) {
        // Positive: subject + bridge + positive adj (no negation before adj)
        const posRegex = new RegExp(`${def.subject}${BR}${NO_NEG}(${def.positive})${WE}`);
        // Negative: subject + bridge + negative adj (no negation before adj)
        const negRegex = new RegExp(`${def.subject}${BR}${NO_NEG}(${def.negative})${WE}`);
        // Negated positive → negative meaning  ("không tốt" → kém)
        const negatedPosRegex = new RegExp(`${def.subject}${BR}${NEG_PREFIX}(${def.positive})${WE}`);
        // Negated negative → positive meaning  ("không kém" → tốt)
        const negatedNegRegex = new RegExp(`${def.subject}${BR}${NEG_PREFIX}(${def.negative})${WE}`);

        const hasPos = posRegex.test(sentence) || negatedNegRegex.test(sentence);
        const hasNeg = negRegex.test(sentence) || negatedPosRegex.test(sentence);

        if (hasPos) aspects.push({ label: def.posLabel, score, source: sentence });
        if (hasNeg) aspects.push({ label: def.negLabel, score, source: sentence });
    }

    // ── Extra patterns that don't follow subject+adj ──

    // Packaging damage
    if (/(?:hộp|thùng|kiện hàng|bưu kiện|gói hàng).{0,12}?(?:móp|nát|bẹp|rách|vỡ|hư|bể|méo|ướt|bẩn)/.test(sentence)) {
        aspects.push({ label: 'Giao hàng chậm', score, source: sentence }); // packaging issue → shipping negative
    }

    // Waiting too long
    if (/chờ.{0,10}?(?:lâu|mãi|hoài|dài cổ)/.test(sentence)) {
        aspects.push({ label: 'Giao hàng chậm', score, source: sentence });
    }

    // Price idioms
    if (/(?:đáng tiền|đáng đồng tiền|xứng đáng|giá hời|rẻ bèo|rẻ mà tốt|rẻ mà chất|giảm giá|sale|hời)/.test(sentence)) {
        aspects.push({ label: 'Giá hợp lý', score, source: sentence });
    }
    if (/(?:phí ship.{0,10}?(?:cao|đắt|chát|mắc))/.test(sentence)) {
        aspects.push({ label: 'Giá cao', score, source: sentence });
    }
    if (/(?:không đáng tiền|không đáng đồng tiền|không xứng|phí tiền|lãng phí|tiền mất tật mang)/.test(sentence)) {
        aspects.push({ label: 'Giá cao', score, source: sentence });
    }

    // Service idioms
    if (/(?:không\s*rep|ko\s*rep|lừa đảo|bom hàng|scam|gian lận)/.test(sentence)) {
        aspects.push({ label: 'Phục vụ kém', score: 0.90, source: sentence });
    }

    // Image match
    if (/(?:y hình|giống hình|đúng hình|như hình|giống ảnh|đúng mô tả|giống mô tả|hàng y ảnh)/.test(sentence)) {
        aspects.push({ label: 'Đúng mô tả', score: 0.90, source: sentence });
    }
    if (/(?:khác xa hình|khác hình|không giống hình|không như hình|khác xa ảnh|sai mô tả|không đúng mô tả|hàng khác ảnh)/.test(sentence)) {
        aspects.push({ label: 'Khác mô tả', score: 0.90, source: sentence });
    }

    return aspects;
}

// ═══════════════════════════════════════════════════════════════
//  OVERALL EXPERIENCE DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Detect global experience phrases that indicate overall satisfaction/dissatisfaction.
 * These often don't target a specific aspect.
 *
 * Examples:
 *   "sẽ mua lại"    → positive experience
 *   "giới thiệu bạn bè" → positive experience
 *   "thất vọng"     → negative experience
 *   "1 sao"         → negative experience
 */
function detectOverallExperience(text) {
    const experiences = [];

    // ── Positive overall ──
    const posPatterns = [
        { regex: /(?:sẽ mua lại|mua lại lần nữa|mua thêm|sẽ ủng hộ|tiếp tục ủng hộ|ủng hộ shop|quay lại)/, label: 'Sẽ mua lại' },
        { regex: /(?:giới thiệu|recommend|gợi ý|khuyên|nên mua)/, label: 'Giới thiệu bạn bè' },
        { regex: /(?:hài lòng|vừa ý|ưng ý|ưng lắm|rất thích|yêu thích|thích lắm|thích quá|quá thích)/, label: 'Hài lòng' },
        { regex: /(?:năm sao|mười điểm|mười trên mười|một trăm điểm|5\s*\*|tuyệt vời|hoàn hảo|10 điểm)/, label: 'Đánh giá cao' },
        { regex: /(?:tốt hơn mong đợi|hơn kỳ vọng|wow|vượt mong đợi|ngoài mong đợi|bất ngờ.*?tốt|bất ngờ.*?đẹp)/, label: 'Vượt kỳ vọng' },
    ];

    // ── Negative overall ──
    const negPatterns = [
        { regex: /(?:thất vọng|rất thất vọng|quá thất vọng|không hài lòng|chán|hối hận|tiếc tiền)/, label: 'Thất vọng' },
        { regex: /(?:trả hàng|đổi trả|hoàn tiền|refund|muốn trả|yêu cầu hoàn)/, label: 'Muốn trả hàng' },
        { regex: /(?:không bao giờ mua|lần cuối|không mua nữa|không quay lại|tẩy chay|boycott)/, label: 'Không mua lại' },
        { regex: /(?:không như kỳ vọng|dưới mong đợi|không như mong đợi|không xứng)/, label: 'Dưới kỳ vọng' },
        { regex: /(?:1\s*sao|một sao|2\s*sao|hai sao)/, label: 'Đánh giá thấp' },
    ];

    for (const p of posPatterns) {
        if (p.regex.test(text)) {
            experiences.push({ label: p.label, type: 'positive', score: 0.85 });
        }
    }
    for (const p of negPatterns) {
        if (p.regex.test(text)) {
            experiences.push({ label: p.label, type: 'negative', score: 0.85 });
        }
    }

    return experiences;
}

// ═══════════════════════════════════════════════════════════════
//  FULL ASPECT ANALYSIS (main entry point)
// ═══════════════════════════════════════════════════════════════

/**
 * Full pipeline:
 *   1. Normalize text
 *   2. Split into sentences
 *   3. Run per-sentence aspect extraction
 *   4. Detect overall experience phrases
 *   5. Merge & deduplicate (keep highest score per label)
 *   6. Apply sarcasm adjustments
 *
 * Returns: Array<{ label, score, source? }>
 */
async function analyzeAspects(review) {
    const text = normalizeText(review);
    const sentences = splitSentences(text);
    const rawAspects = [];

    // Step 1: Per-sentence analysis
    for (const sentence of sentences) {
        const sentenceAspects = analyzeSentenceAspects(sentence);
        rawAspects.push(...sentenceAspects);
    }

    // Step 2: Overall experience
    const experiences = detectOverallExperience(text);
    for (const exp of experiences) {
        rawAspects.push({ label: exp.label, score: exp.score, source: 'overall' });
    }

    // Step 3: Merge & deduplicate — keep highest score per label
    const mergedMap = new Map();
    for (const aspect of rawAspects) {
        const existing = mergedMap.get(aspect.label);
        if (!existing || aspect.score > existing.score) {
            mergedMap.set(aspect.label, { label: aspect.label, score: aspect.score });
        }
    }

    // Step 4: Resolve conflicts between pos/neg for same category
    const aspects = resolveConflicts([...mergedMap.values()], sentences);

    // Step 5: Sarcasm adjustments
    const sarcasmResult = detectSarcasmAndContrast(text);
    if (sarcasmResult.isSarcastic) {
        applySarcasmAdjustments(aspects, sarcasmResult);
    }

    return aspects;
}

/**
 * Resolve conflicts when both positive and negative aspects appear for the same category.
 *
 * Strategy: Count how many sentences support each side.
 * If one side has more sentences: keep only that side.
 * If tied: keep both (genuinely mixed).
 */
function resolveConflicts(aspects, sentences) {
    const conflictPairs = [
        ['Chất lượng tốt', 'Chất lượng kém'],
        ['Giao hàng nhanh', 'Giao hàng chậm'],
        ['Giá hợp lý', 'Giá cao'],
        ['Phục vụ tốt', 'Phục vụ kém'],
        ['Đúng mô tả', 'Khác mô tả'],
    ];

    const resolved = [...aspects];

    for (const [posLabel, negLabel] of conflictPairs) {
        const posAspect = resolved.find(a => a.label === posLabel);
        const negAspect = resolved.find(a => a.label === negLabel);

        if (posAspect && negAspect) {
            // Count sentence support for each
            let posCount = 0, negCount = 0;
            for (const sent of sentences) {
                const cat = Object.values(ASPECT_DEFS).find(d => d.posLabel === posLabel);
                if (cat) {
                    const posR = new RegExp(`${cat.subject}${BR}${NO_NEG}(?:${cat.positive})${WE}`);
                    const negR = new RegExp(`${cat.subject}${BR}${NO_NEG}(?:${cat.negative})${WE}`);
                    if (posR.test(sent)) posCount++;
                    if (negR.test(sent)) negCount++;
                }
            }

            if (posCount > negCount) {
                // Remove the negative aspect
                const idx = resolved.findIndex(a => a.label === negLabel);
                if (idx >= 0) resolved.splice(idx, 1);
            } else if (negCount > posCount) {
                // Remove the positive aspect
                const idx = resolved.findIndex(a => a.label === posLabel);
                if (idx >= 0) resolved.splice(idx, 1);
            }
            // If tied, keep both — it's genuinely mixed
        }
    }

    return resolved;
}

/**
 * Reduce confidence of positive aspects when sarcasm is detected.
 * Also adds a contrast indicator when applicable.
 */
function applySarcasmAdjustments(aspects, sarcasmResult) {
    const positiveLabels = ['tốt', 'nhanh', 'hợp lý', 'Đúng', 'Hài lòng', 'Sẽ mua', 'Giới thiệu', 'Đánh giá cao', 'Vượt kỳ vọng'];
    let hasWarning = false;

    for (const aspect of aspects) {
        if (positiveLabels.some(pLabel => aspect.label.includes(pLabel))) {
            aspect.score = Math.max(0.3, aspect.score - 0.3);
            aspect.sarcasmWarning = true;
            hasWarning = true;
        }
    }

    if (hasWarning && sarcasmResult.contrastType === 'contrast' && sarcasmResult.contrastDetails) {
        aspects.push({
            label: '⚠ Có mâu thuẫn',
            score: 0.80,
            detail: sarcasmResult.contrastDetails,
        });
    }
}

// ═══════════════════════════════════════════════════════════════
//  BUILD FINAL SENTIMENT RESULT
// ═══════════════════════════════════════════════════════════════

/**
 * Combine PhoBERT overall result + aspect results + sarcasm check
 * into one coherent sentiment object.
 *
 * Cross-validates star rating with sentiment when available.
 */
function buildSentimentResult(phobertResult, aspects, originalComment, rating) {
    const dominant = getDominantLabel(phobertResult);
    if (!dominant) return null;

    const normalizedComment = normalizeText(originalComment);
    const sarcasm = detectSarcasmAndContrast(normalizedComment);

    // ── Mixed sentiment detection ──
    const positiveLabels = ['tốt', 'nhanh', 'hợp lý', 'Đúng', 'Hài lòng', 'Sẽ mua', 'Giới thiệu', 'Đánh giá cao', 'Vượt kỳ vọng'];
    const negativeLabels = ['kém', 'chậm', 'cao', 'Khác', 'Thất vọng', 'Muốn trả', 'Không mua', 'Dưới kỳ vọng', 'Đánh giá thấp'];

    const hasPositiveAspect = aspects.some(a => positiveLabels.some(p => a.label.includes(p)));
    const hasNegativeAspect = aspects.some(a => negativeLabels.some(n => a.label.includes(n)));
    const isMixed = hasPositiveAspect && hasNegativeAspect;

    let finalLabel = dominant.label;
    let finalScore = dominant.score;

    // ── Sarcasm adjustments on overall label ──
    if (sarcasm.isSarcastic && sarcasm.contrastType === 'contrast') {
        if (finalLabel === 'POS' && hasNegativeAspect) {
            finalLabel = 'NEG';
            finalScore = Math.max(0.6, finalScore - 0.2);
        }
    }
    if (sarcasm.isSarcastic && sarcasm.contrastType === 'sarcasm') {
        if (finalLabel === 'POS') {
            finalLabel = 'NEG';
            finalScore = 0.65;
        }
    }

    // ── Cross-validation with star rating ──
    // If the user gave 1-2 stars but AI says POS, trust the stars more
    // If the user gave 4-5 stars but AI says NEG, trust the stars more
    let ratingMismatch = false;
    if (typeof rating === 'number' && rating >= 1 && rating <= 5) {
        if ((rating <= 2 && finalLabel === 'POS') || (rating >= 4 && finalLabel === 'NEG')) {
            ratingMismatch = true;
            // When there's a mismatch, reduce confidence
            finalScore = Math.max(0.4, finalScore - 0.2);
        }
    }

    const result = {
        label: finalLabel,
        score: parseFloat(finalScore.toFixed(4)),
        isMixed,
        sarcasmDetected: sarcasm.isSarcastic,
    };

    if (ratingMismatch) {
        result.ratingMismatch = true;
    }

    if (aspects.length > 0) {
        // Remove internal fields before storing
        result.aspects = aspects.map(a => {
            const clean = { label: a.label, score: a.score };
            if (a.sarcasmWarning) clean.sarcasmWarning = true;
            if (a.detail) clean.detail = a.detail;
            return clean;
        });
    }

    return result;
}

// ═══════════════════════════════════════════════════════════════
//  SENTIMENT AGGREGATION (For Shop Stats)
// ═══════════════════════════════════════════════════════════════

/**
 * Aggregate sentiment data across all reviews for a product or shop.
 */
function aggregateSentiments(reviews) {
    const stats = {
        total: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        positivePercent: '0',
        negativePercent: '0',
        neutralPercent: '0',
        aspectSummary: {},
        mixedCount: 0,
        sarcasmCount: 0,
    };

    if (!reviews || reviews.length === 0) return stats;

    for (const review of reviews) {
        if (!review.sentiment) continue;
        stats.total++;

        const label = review.sentiment.label;
        if (label === 'POS') stats.positive++;
        else if (label === 'NEG') stats.negative++;
        else stats.neutral++;

        if (review.sentiment.isMixed) stats.mixedCount++;
        if (review.sentiment.sarcasmDetected) stats.sarcasmCount++;

        // Aggregate aspects
        if (review.sentiment.aspects && Array.isArray(review.sentiment.aspects)) {
            for (const aspect of review.sentiment.aspects) {
                if (aspect.label.startsWith('⚠')) continue; // skip warning labels
                if (!stats.aspectSummary[aspect.label]) {
                    stats.aspectSummary[aspect.label] = { count: 0, totalScore: 0, avgScore: 0 };
                }
                stats.aspectSummary[aspect.label].count++;
                stats.aspectSummary[aspect.label].totalScore += aspect.score;
            }
        }
    }

    if (stats.total > 0) {
        stats.positivePercent = ((stats.positive / stats.total) * 100).toFixed(1);
        stats.negativePercent = ((stats.negative / stats.total) * 100).toFixed(1);
        stats.neutralPercent = ((stats.neutral / stats.total) * 100).toFixed(1);
    }

    for (const key of Object.keys(stats.aspectSummary)) {
        const asp = stats.aspectSummary[key];
        asp.avgScore = parseFloat((asp.totalScore / asp.count).toFixed(2));
        delete asp.totalScore;
    }

    return stats;
}

// ═══════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════
module.exports = {
    analyzeSentiment,
    analyzeAspects,
    getDominantLabel,
    buildSentimentResult,
    aggregateSentiments,
    normalizeText,
    splitSentences,
    detectSarcasmAndContrast,
    detectOverallExperience,
    calculateScore,
};
