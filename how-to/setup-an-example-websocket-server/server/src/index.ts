import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import WebSocket, { Server as WebSocketServer } from 'ws';

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Serve static files from the "public" directory
app.use(express.static('public'));

// REST API endpoint for posting messages
app.post('/api/messages', (req: Request, res: Response) => {
    console.log('Received POST request to /api/messages', req.body);
    const message: string = req.body.message;
    if (message) {
        // Broadcast message to all WebSocket clients
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
        res.status(200).send('Message sent');
    } else {
        res.status(400).send('Message is required');
    }
});

// Start the server
const server = app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

// Set up WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
    console.log('New WebSocket connection');
    ws.on('message', (message: string) => {
        console.log(`Received message: ${message}`);
    });
});