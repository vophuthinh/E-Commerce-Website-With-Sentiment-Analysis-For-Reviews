const axios = require('axios');
const logger = require('../utils/logger');

const API_URL = 'https://api-inference.huggingface.co/models/finiteautomata/bertweet-base-sentiment-analysis';

async function checkModelStatus() {
    try {
        const headers = {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_TOKEN || ''}`,
        };
        const response = await axios.get(API_URL, { headers });
        if (response.data.loading) {
            logger.debug('Model is loading, please wait...');
            return false;
        }
        return true;
    } catch (error) {
        logger.error('Unable to check model status:', error.message);
        return false;
    }
}

async function analyzeSentiment(review) {
    try {
        const headers = {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_TOKEN || ''}`,
        };
        const response = await axios.post(API_URL, { inputs: review }, { headers });
        return response.data;
    } catch (error) {
        logger.error('Sentiment analysis error:', error.response ? error.response.data : error.message);
        return null;
    }
}

function getDominantLabel(result) {
    const labels = result[0];
    const dominant = labels.reduce((prev, curr) => (curr.score > prev.score ? curr : prev));
    return { label: dominant.label, score: dominant.score };
}

module.exports = {
    checkModelStatus,
    analyzeSentiment,
    getDominantLabel,
};
