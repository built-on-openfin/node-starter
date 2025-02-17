import bodyParser from "body-parser";
import cors from "cors";
import express, { type Request, type Response } from "express";
import WebSocket, { Server as WebSocketServer } from "ws";

const app = express();
const port = 6060;
const pendingMessages: { received: number; message: unknown }[] = [];
const lastSeenTimestamps = new Map<string, number>();
const maxPendingMessages = 100;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Enable CORS for localhost sites
app.use(
	cors({
		origin: [
			"http://localhost:3000",
			"http://localhost:4200",
			"http://localhost:5050",
			"http://localhost:6060",
			"http://localhost:8080"
		] // Add other localhost ports as needed
	})
);

// Serve static files from the "public" directory
app.use(express.static("public"));

// REST API endpoint for getting the array of objects
app.get("/api/messages", (req: Request, res: Response) => {
	const defaultOrigin = "Unknown";
	let source: string = defaultOrigin;
	if (req.headers.origin !== undefined) {
		source = req.headers.origin;
	} else if (req.headers.referer !== undefined) {
		source = new URL(req.headers.referer).origin;
	}
	console.log(`Received GET request to /api/messages from ${source}`);

	const lastSeenTimestamp = lastSeenTimestamps.get(source) ?? 0;

	const newMessages = pendingMessages.filter((entry) => entry.received > lastSeenTimestamp);

	// clear array of pending messages
	console.log(
		`Received GET request to /api/messages from ${source} with ${newMessages.length} pending messages`
	);

	if (newMessages.length > 0 && source !== defaultOrigin) {
		lastSeenTimestamps.set(source, newMessages[newMessages.length - 1].received);
	}
	const messagesToReturn = newMessages.map((entry) => entry.message);
	res.status(200).json(messagesToReturn);
});

// REST API endpoint for posting messages
app.post("/api/messages", (req: Request, res: Response) => {
	console.log("Received POST request to /api/messages", req.body);
	const message: unknown = req.body.message;
	if (message) {
		if (pendingMessages.length >= maxPendingMessages) {
			pendingMessages.shift();
		}
		// store the message in the pendingMessages array for get messages polling
		pendingMessages.push({ received: Date.now(), message });

		// Broadcast message to all WebSocket clients
		for (const client of wss.clients) {
			if (client.readyState === WebSocket.OPEN) {
				client.send(JSON.stringify(message));
			}
		}
		res.status(200).send("Message sent");
	} else {
		res.status(400).send("Message is required");
	}
});

// Start the server
const server = app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
	console.log(`POST a message to http://localhost:${port}/api/messages`);
	console.log(
		`Get and clear pending messages through a GET request to http://localhost:${port}/api/messages`
	);
});

// Set up WebSocket server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
	console.log("New WebSocket connection");
	ws.on("message", (message: string) => {
		console.log(`Received message: ${message}`);
	});
});
