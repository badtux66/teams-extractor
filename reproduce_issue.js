const axios = require('axios');

const payload = {
    extractionId: 'test_extraction_' + Date.now(),
    conversationId: 'channel_123',
    conversationName: 'Test Channel',
    conversationType: 'channel',
    messages: [
        {
            messageId: 'msg_' + Date.now(),
            channelId: 'channel_123',
            channelName: 'Test Channel',
            content: 'Test message content',
            sender: {
                id: 'sender_123',
                name: 'Test Sender',
                email: 'test@example.com'
            },
            timestamp: new Date().toISOString(),
            url: 'https://teams.microsoft.com/test',
            type: 'message',
            metadata: {
                source: 'reproduction_script'
            }
        }
    ],
    metadata: {
        userAgent: 'reproduction_script'
    }
};

async function run() {
    try {
        console.log('Sending payload...');
        const response = await axios.post('http://localhost:5000/api/messages/batch', payload);
        console.log('Success:', response.data);
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

run();
