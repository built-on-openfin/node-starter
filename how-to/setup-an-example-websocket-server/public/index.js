// notification messages
let messages = [];

/**
 * Set Message Content.
 * @param selectionElement The element to read the current selection.
 * @param messageElement The element to set text against.
 */
function setMessageContent(selectionElement, messageElement) {
	const selectedExample = selectionElement.value;
	if (selectedExample) {
		// eslint-disable-next-line no-shadow
		const entry = messages.find((entry) => entry.messageId === selectedExample);
		if (entry) {
			if (entry.message.eventId === 'create') {
				entry.message.payload.id = `${Date.now().toString()}-${Math.floor(Math.random() * 1000)}`;
			}
			messageElement.value = JSON.stringify(entry.message, null, 2);
		}
	}
}

/**
 * Fetch messages from messages.json.
 */
async function fetchMessages() {
	try {
		const response = await fetch('./messages.json');
		if (!response.ok) {
			throw new Error('Network response was not ok when trying to get messages.json');
		}
		messages = await response.json();

		console.log('messages populated:', messages);
	} catch (error) {
		console.error('Failed to fetch messages:', error);
	}
}

/**
 * Add some logging.
 * @param logElement The element to use to store previews
 * @param text The text for the log entry.
 * @param data Associated data for the log entry.
 */
function log(logElement, text, data) {
	let logs = `
${new Date(Date.now()).toLocaleTimeString()}: ${text}`;

	if (data !== undefined) {
		logs += `
${JSON.stringify(data, null, 3)}`;
	}

	console.log(text, data);

	logElement.textContent += logs;
}

/**
 * Post message to server.
 * @param message the message to send
 * @param logElement The element to log to
 */
async function postMessage(message, logElement) {
	const response = await fetch('/api/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ message })
	});
	if (response.ok) {
		log(logElement, 'Message sent successfully');
	} else {
		log(logElement, 'Failed to send message');
	}
}

/**
 * Get pending messages from the server.
 * @param logElement Element to log to.
 * @returns The messages.
 */
async function getMessage(logElement) {
	const response = await fetch('/api/messages', {
		headers: {
			'Content-Type': 'application/json'
		}
	});
	if (response.ok) {
		return response.json();
	}
	return [];
}

document.addEventListener('DOMContentLoaded', async () => {
	// reference the controls
	const messageType = document.querySelector('#messageType');
	const notificationMessages = document.querySelector('#notificationMessages');
	const notificationTypeExamples = document.querySelector('#notificationTypeExamples');
	const message = document.querySelector('#message');
	const logPreview = document.querySelector('#log');
	const btnPost = document.querySelector('#btnPost');
	const btnClear = document.querySelector('#btnClear');

	if (
		messageType !== null &&
		notificationMessages !== null &&
		notificationTypeExamples !== null &&
		message !== null &&
		logPreview !== null &&
		btnPost !== null &&
		btnClear !== null
	) {
		// setup listeners
		await fetchMessages();
		messageType.addEventListener('change', () => {
			const selectedType = messageType.value;
			if (selectedType === 'custom') {
				notificationMessages.style.display = 'none';
				message.value = '';
			} else {
				notificationMessages.style.display = 'flex';
				setMessageContent(notificationTypeExamples, message);
			}
		});

		for (const entry of messages) {
			// Create a new option element
			const option = document.createElement('option');
			option.value = entry.messageId;
			option.id = entry.messageId;
			option.textContent = entry.title;

			// Append the option to the select element
			notificationTypeExamples.append(option);
		}

		notificationTypeExamples.addEventListener('change', () => {
			setMessageContent(notificationTypeExamples, message);
		});

		setMessageContent(notificationTypeExamples, message);

		btnPost.addEventListener('click', async () => {
			try {
				log(logPreview, 'Preparing message to send.');
				const messageValue = JSON.parse(message.value);
				log(logPreview, 'Message to send', messageValue);
				await postMessage(messageValue, logPreview);
			} catch (error) {
				log(logPreview, `Error preparing message: ${error.message}`);
			}
		});
		btnClear.addEventListener('click', () => {
			logPreview.textContent = '';
		});

		// setup the WebSocket connection
		// WebSocket connection
		log(logPreview, 'Connecting to WebSocket server');
		const ws = new WebSocket(`ws://${window.location.host}`);
		log(logPreview, 'Listening for messages');
		// listen for messages
		// eslint-disable-next-line unicorn/prefer-add-event-listener
		ws.onmessage = (event) => {
			// eslint-disable-next-line no-shadow
			const message = JSON.parse(event.data);
			log(logPreview, 'Incoming websocket message', message);
		};

		// Setup the long polling example for scenarios where websockets are not supported
		const longPollingSecondsInterval = 5;
		setInterval(async () => {
			// eslint-disable-next-line no-shadow
			const messages = await getMessage(logPreview);
			if (messages.length > 0) {
				log(
					logPreview,
					`Messages received from server through long polling. Current interval in seconds: ${longPollingSecondsInterval}`,
					messages
				);
			}
		}, longPollingSecondsInterval * 1000);
	}
});
