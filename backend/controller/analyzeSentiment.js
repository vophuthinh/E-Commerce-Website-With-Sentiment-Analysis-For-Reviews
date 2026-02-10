const axios = require('axios');
const logger = require('../utils/logger');

// Using the new Router URL which is more stable for some regions/models
const BASE_URL = 'https://router.huggingface.co/hf-inference/models';

const SENTIMENT_MODEL = 'wonrax/phobert-base-vietnamese-sentiment';
// Removed: ABSA_API_URL (Using Rule-Based Logic)

async function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generic helper to call Hugging Face API with Retry logic for "Model Loading" state
 */
async function callHuggingFaceAPI(modelId, payload, retries = 5) {
    const url = `${BASE_URL}/${modelId}`;
    const headers = {};

    // Always use the token if available
    if (process.env.HUGGINGFACE_API_TOKEN) {
        headers.Authorization = `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`;
    }

    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.post(url, payload, { headers });
            return response.data;
        } catch (error) {
            const errData = error.response ? error.response.data : {};

            // Case 1: Model is loading (503 Service Unavailable)
            if (errData.error && typeof errData.error === 'string' && errData.error.includes('loading')) {
                const estimatedTime = errData.estimated_time || 20;
                logger.warn(`Model ${modelId} is loading... Waiting ${estimatedTime}s (Attempt ${i + 1}/${retries})`);
                await wait(Math.max(estimatedTime * 1000, 10000)); // Wait at least 10s
                continue;
            }

            // Case 2: Other errors (400, 401, etc.) -> Log and return null immediately (don't retry unless it's network error)
            if (error.response && error.response.status !== 503) {
                logger.error(`HF API Failed (${modelId}): [${error.response.status}] ${JSON.stringify(errData)}`);
                return null;
            }

            // Case 3: Network errors -> Retry with backoff
            logger.error(`Network error calling HF (${modelId}): ${error.message}. Retrying...`);
            await wait(3000);
        }
    }
    return null;
}

async function checkModelStatus() {
    // Just try a dummy lightweight call or check generic availability
    // For simplicity, we assume true and let the retry logic handle the "loading" state in actual calls
    return true;
}

async function analyzeSentiment(review) {
    const result = await callHuggingFaceAPI(SENTIMENT_MODEL, { inputs: review });
    return result;
}

/**
 * Rule-based Aspect Analysis (No API dependency)
 * Fast and reliable for common e-commerce patterns
 *
 * Pattern design:
 *   SUBJECT .{0,20}? ADJECTIVE(?=END)
 *
 * - .{0,20}?  : lazy bridge allowing 0-3 filler words (hơi, quá, rất, bị, cực kỳ, siêu...)
 * - (?=END)   : word-end lookahead (?=\s|[,!?.]|$) prevents partial matches (e.g. "cũ" inside "cũng")
 *
 * Additional feature: Negation awareness
 *   "không tốt" / "chẳng đẹp"  → flips polarity
 *   "không đắt" / "không chậm" → flips polarity
 */

// Word-end boundary: ensures matched adjective is a whole word, not a substring
const WE = '(?=\\s|[,!?.;:]|$)';

// Bridge: allows 0-3 filler words between subject and adjective
const BR = '.{0,20}?';

// Negation prefix: checks if "không/chẳng/chả/đâu có" appears right before the adjective
const NEG_PREFIX = '(?:không|chẳng|chả|đâu có|chưa|hông|ko)\\s+';

// Negative lookbehind: ensures the adjective is NOT preceded by a negation word
// This prevents the bridge (.{0,20}?) from absorbing negation as filler
const NO_NEG = '(?<!không |chẳng |chả |chưa |hông |ko )';

async function analyzeAspects(review) {
    const text = review.toLowerCase();
    const aspects = [];

    // ═══════════════════════════════════════════════════
    //  QUALITY (Chất lượng)
    // ═══════════════════════════════════════════════════
    const qualitySubject = '(?:chất lượng|sản phẩm|hàng|vải|chất|form|dáng|mẫu mã)';
    const qualityPos =
        '(?:tốt|cao|xịn|ổn|đẹp|mịn|dày|bền|chắc chắn|ok|okay|ưng|chuẩn|đỉnh|xuất sắc|tuyệt vời|được|ngon|xịn sò)';
    const qualityNeg =
        '(?:kém|tệ|thấp|xấu|dỏm|mỏng|rách|hỏng|lỗi|nhăn|cũ kỹ|pha ke|fake|dở|tệ hại|rẻ tiền|gãy|vỡ|bong tróc)';

    // Positive quality (direct or negated negative)
    if (
        text.match(new RegExp(`${qualitySubject}${BR}${NO_NEG}${qualityPos}${WE}`)) ||
        text.match(new RegExp(`${qualitySubject}${BR}${NEG_PREFIX}${qualityNeg}${WE}`))
    ) {
        aspects.push({ label: 'Chất lượng tốt', score: 0.95 });
    }
    // Negative quality (direct or negated positive)
    if (
        text.match(new RegExp(`${qualitySubject}${BR}${NO_NEG}${qualityNeg}${WE}`)) ||
        text.match(new RegExp(`${qualitySubject}${BR}${NEG_PREFIX}${qualityPos}${WE}`))
    ) {
        aspects.push({ label: 'Chất lượng kém', score: 0.95 });
    }

    // ═══════════════════════════════════════════════════
    //  SHIPPING (Giao hàng)
    // ═══════════════════════════════════════════════════
    const shipSubject = '(?:giao hàng|giao|ship|vận chuyển|đóng gói|shipper)';
    const shipPos = '(?:nhanh|sớm|lẹ|hỏa tốc|cẩn thận|đẹp|kỹ|đúng hẹn|đúng|ổn|tốt|an toàn|nguyên vẹn)';
    const shipNeg = '(?:chậm|lâu|trễ|muộn|sơ sài|nát|kém|móp|bẹp|mãi|chờ|delay|hư|vỡ|bể|ẩu|bị lỗi)';
    const boxSubject = '(?:hộp|thùng|kiện hàng|bưu kiện)';
    const boxNeg = '(?:móp|nát|bẹp|rách|vỡ|hư|bể|méo)';

    if (
        text.match(new RegExp(`${shipSubject}${BR}${NO_NEG}${shipPos}${WE}`)) ||
        text.match(new RegExp(`${shipSubject}${BR}${NEG_PREFIX}${shipNeg}${WE}`))
    ) {
        aspects.push({ label: 'Giao hàng nhanh', score: 0.95 });
    }
    if (
        text.match(new RegExp(`${shipSubject}${BR}${NO_NEG}${shipNeg}${WE}`)) ||
        text.match(new RegExp(`${boxSubject}${BR}${NO_NEG}${boxNeg}${WE}`)) ||
        text.match(new RegExp(`chờ${BR}${NO_NEG}(?:lâu|mãi|hoài|dài cổ)${WE}`)) ||
        text.match(new RegExp(`${shipSubject}${BR}${NEG_PREFIX}${shipPos}${WE}`))
    ) {
        aspects.push({ label: 'Giao hàng chậm', score: 0.95 });
    }

    // ═══════════════════════════════════════════════════
    //  PRICE (Giá cả)
    // ═══════════════════════════════════════════════════
    const priceSubject = '(?:giá|chi phí|giá cả|giá tiền)';
    const pricePos = '(?:rẻ|tốt|hợp lý|phải chăng|ổn|ok|vừa túi tiền|sinh viên|bình dân|mềm|hạt dẻ)';
    const priceNeg = '(?:đắt|cao|chát|mắc|cắt cổ|trên trời|chặt chém|max)';

    if (
        text.match(new RegExp(`${priceSubject}${BR}${NO_NEG}${pricePos}${WE}`)) ||
        text.match(/đáng tiền|đáng đồng tiền|sale|giảm giá|hời|xả hàng/) ||
        text.match(new RegExp(`${priceSubject}${BR}${NEG_PREFIX}${priceNeg}${WE}`))
    ) {
        aspects.push({ label: 'Giá rẻ', score: 0.95 });
    }
    if (
        text.match(new RegExp(`${priceSubject}${BR}${NO_NEG}${priceNeg}${WE}`)) ||
        text.match(new RegExp(`phí ship${BR}${NO_NEG}(?:cao|đắt|chát|mắc)${WE}`)) ||
        text.match(/không đáng tiền|không đáng đồng tiền/) ||
        text.match(new RegExp(`${priceSubject}${BR}${NEG_PREFIX}${pricePos}${WE}`))
    ) {
        aspects.push({ label: 'Giá đắt', score: 0.95 });
    }

    // ═══════════════════════════════════════════════════
    //  SERVICE (Phục vụ / CSKH)
    // ═══════════════════════════════════════════════════
    const serviceSubject = '(?:shop|tư vấn|phục vụ|rep|trả lời|nhân viên|chăm sóc|cskh|seller|người bán)';
    const servicePos =
        '(?:nhiệt tình|tốt|nhanh|dễ thương|chu đáo|thân thiện|chi tiết|tận tâm|chuyên nghiệp|lịch sự|vui vẻ|ổn)';
    const serviceNeg = '(?:tệ|chậm|láo|thái độ|vô duyên|cọc|hách dịch|kém|bất lịch sự|khó chịu|lừa đảo|ghê|grumpy)';

    if (
        text.match(new RegExp(`${serviceSubject}${BR}${NO_NEG}${servicePos}${WE}`)) ||
        text.match(new RegExp(`${serviceSubject}${BR}${NEG_PREFIX}${serviceNeg}${WE}`))
    ) {
        aspects.push({ label: 'Phục vụ tốt', score: 0.95 });
    }
    if (
        text.match(new RegExp(`${serviceSubject}${BR}${NO_NEG}${serviceNeg}${WE}`)) ||
        text.match(/không\s*rep|lừa đảo|bom hàng/) ||
        text.match(new RegExp(`${serviceSubject}${BR}${NEG_PREFIX}${servicePos}${WE}`))
    ) {
        aspects.push({ label: 'Phục vụ tệ', score: 0.95 });
    }

    return aspects;
}

function getDominantLabel(result) {
    // PhoBERT sentiment output is usually [[{label: 'TXT', score: ...}, ...]] (nested array)
    const labels = Array.isArray(result) ? result[0] : result;

    if (!labels || !Array.isArray(labels) || labels.length === 0) return null;

    // Find max score
    const dominant = labels.reduce((prev, curr) => (curr.score > prev.score ? curr : prev));

    return { label: dominant.label, score: dominant.score };
}

module.exports = {
    checkModelStatus,
    analyzeSentiment,
    analyzeAspects,
    getDominantLabel,
};
