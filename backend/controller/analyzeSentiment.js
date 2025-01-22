// sentimentAnalysis.js
const axios = require('axios');

// const API_TOKEN = 'token';
const API_URL = 'https://api-inference.huggingface.co/models/finiteautomata/bertweet-base-sentiment-analysis';

// Checking model status
async function checkModelStatus() {
    try {
        const headers = {
            Authorization: `Bearer ${API_TOKEN}`,
        };
        const response = await axios.get(API_URL, { headers });
        if (response.data.loading) {
            console.log('Model is loading, please wait...');
            return false;
        }
        return true;
    } catch (error) {
        console.error('Unable to check model status:', error.message);
        return false;
    }
}

// Sentiment analysis for a review
async function analyzeSentiment(review) {
    try {
        const headers = {
            Authorization: `Bearer ${API_TOKEN}`,
        };
        const response = await axios.post(API_URL, { inputs: review }, { headers });
        return response.data;
    } catch (error) {
        console.error('Sentiment analysis error:', error.response ? error.response.data : error.message);
        return null;
    }
}

// Retrieving primary sentiment label
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
