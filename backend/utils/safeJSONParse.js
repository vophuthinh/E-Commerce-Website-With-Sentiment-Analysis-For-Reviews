/**
 * Safely parses a JSON string into a JavaScript object/array.
 * If parsing fails or the input is not a string, returns the fallback value.
 *
 * @param {string|any} data - The data to parse.
 * @param {any} [fallbackValue=[]] - The value to return if parsing fails.
 * @returns {any} - The parsed JSON object or the fallback value.
 */
function safeJSONParse(data, fallbackValue = []) {
    if (typeof data !== 'string') {
        return data || fallbackValue;
    }
    try {
        return JSON.parse(data);
    } catch (e) {
        return fallbackValue;
    }
}

module.exports = safeJSONParse;
