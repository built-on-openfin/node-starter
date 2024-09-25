
// notification messages
const sampleMessages = {};

// launch app notification
sampleMessages["notificationLaunchApp"] = {
    "eventId": "create",
    "payload": {
            "id": "guid-goes-here",
            "title": "Example Launches App",
            "body": "Click the button to launch an app.",
            "buttons": [
                {
                    "onClick": {
                        "task": "launch-app",
                        "customData": {
                            "id": "call-app"
                        }
                    },
                    "cta": true,
                    "title": "Open Call App",
                    "type": "button"
                }
            ]
    }
};

// launch content notification
sampleMessages["notificationLaunchContent"] = {
    "eventId": "create",
    "payload": {
            "id": "guid-goes-here",
            "title": "Example Launches Page",
            "body": "Click the button to launch or focus on a specific page.",
            "buttons": [
                {
                    "onClick": {
                        "task": "launch-content",
                        "customData": {
                            "id": "page-id"
                        }
                    },
                    "cta": true,
                    "title": "Launch Page",
                    "type": "button"
                }
            ]
    }
};

// raise intent notification
sampleMessages["notificationRaiseIntent"] = {
    "eventId": "create",
    "payload": {
            "id": "guid-goes-here",
            "title": "Example Raise Intent Notification",
            "body": "Click the button to raise an intent",
            "buttons": [
                {
                    "onClick": {
                        "task": "raise-intent",
                        "customData": {
                            "id": "StartCall",
                            "context": {
                                "type": "fdc3.contact",
                                "name": "John Example",
                                "id": {
                                    "email": "john@example.com",
                                    "phone": "Number goes here"
                                }
                            },
                            "target": {
                                "appId": "call-app",
                                "instanceId": "instanceId if available"
                            }
                        }
                    },
                    "cta": true,
                    "title": "Start A Call",
                    "type": "button"
                }
            ]
        }
};

// broadcast user notification
sampleMessages["notificationBroadcastUser"] = {
    "eventId": "create",
    "payload": {
            "id": "guid-goes-here",
            "title": "Broadcast on User Channel",
            "body": "Click the button to broadcast on a user channel.",
            "buttons": [
                {
                    "onClick": {
                        "task": "broadcast",
                        "customData": {
                            "id": "green",
                            "context": {
                                "type": "fdc3.contact",
                                "name": "John Example",
                                "id": {
                                    "email": "john@example.com",
                                    "phone": "Number goes here"
                                }
                            },
                            "broadcastOptions": {
                                "isUserChannel": true
                            }
                        }
                    },
                    "cta": true,
                    "title": "Broadcast On User Channel",
                    "type": "button"
                }
            ]
        }
};

// broadcast form user notification
sampleMessages["notificationBroadcastFormUser"] = {
    "eventId": "create",
    "payload": {
            "id": "guid-goes-here",
            "title": "Broadcast Form on User Channel",
            "body": "Click the button to broadcast on a user channel.",
            "form": [
                {
                    "type": "boolean",
                    "key": "intendedThemeChange",
                    "label": "Did you intend to change the theme?",
                    "widget": {
                        "type": "Toggle"
                    }
                }
            ],
            "buttons": [
                {
                    "onClick": {
                        "task": "broadcast",
                        "customData": {
                            "id": "green",
                            "context": {
                                "type": "custom.context",
                                "name": "Form Submitted"
                            },
                            "broadcastOptions": {
                                "isUserChannel": true
                            }
                        }
                    },
                    "cta": true,
                    "submit": true,
                    "title": "Broadcast On Green",
                    "type": "button"
                }
            ]
        }
};

// broadcast app notification
sampleMessages["notificationBroadcastAppChannel"] = {
    "eventId": "create",
    "payload": {
            "id": "guid-goes-here",
            "title": "Broadcast on App Channel",
            "body": "Click the button to broadcast on an app channel.",
            "buttons": [
                {
                    "onClick": {
                        "task": "broadcast",
                        "customData": {
                            "id": "custom-app-channel",
                            "context": {
                                "type": "fdc3.contact",
                                "name": "John Example",
                                "id": {
                                    "email": "john@example.com",
                                    "phone": "Number goes here"
                                }
                            }
                        }
                    },
                    "cta": true,
                    "title": "Broadcast On App Channel",
                    "type": "button"
                }
            ]
    }
};

// endpoint notification
sampleMessages["notificationActionEndpoint"] = {
    "eventId": "create",
    "payload": {
            "id": "guid-goes-here",
            "title": "Trigger a post to a backend through a CTA",
            "body": "Click the button to call an action on the specified endpoint.",
            "buttons": [
                {
                    "onClick": {
                        "task": "endpoint",
                        "customData": {
                            "id": "endpointId you wish to call. The notification service module must be permitted to access this endpoint through endpointClients",
                            "context": {
                                "type": "fdc3.contact",
                                "name": "John Example",
                                "id": {
                                    "email": "john@example.com",
                                    "phone": "Number goes here"
                                }
                            },
                            "endpointOptions": {
                                "request": {
                                    "description": "If request is specified then context will be ignored and this object will be sent to the endpoint as the request"
                                }
                            }
                        }
                    },
                    "cta": true,
                    "title": "Send to Endpoint",
                    "type": "button"
                }
            ]
        }
};

// update notification
sampleMessages["notificationUpdate"] = {
    "eventId": "update",
    "payload": {
            "id": "id-of-notification-to-update",
            "body": "notification has been updated and buttons have been removed.",
            "template": "markdown"
        }
};

// notification to clear
sampleMessages["notificationClear"] = {
    "eventId": "clear",
    "payload": {
            "id": "id-of-notification-to-clear"
    }
};

/**
 * Add some logging.
 * @param selectionElement The element to read the current selection.
 * @param messageElement The element to set text against.
 */
function setMessageContent(selectionElement, messageElement) {
    const selectedExample = selectionElement.value;
    if (selectedExample) {
        const sampleMessage = sampleMessages[selectedExample];
        if (sampleMessage) {
            if(sampleMessage.eventId === 'create') {
                sampleMessage.payload.id = `${Date.now().toString()}-${Math.floor(Math.random() * 1000)}`;
            }
            messageElement.value = JSON.stringify(sampleMessage, null, 2);
        }
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

    logElement.textContent = logElement.textContent + logs;
}

/**
 * Post message to server
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
        log(logElement, "Message sent successfully");
    } else {
        log(logElement, "Failed to send message");
    }
}

document.addEventListener('DOMContentLoaded', async () => {

    // reference the controls
    const messageType = document.getElementById('messageType');
    const notificationMessages = document.getElementById('notificationMessages');
    const notificationTypeExamples = document.getElementById('notificationTypeExamples');
    const message = document.getElementById('message');
    const logPreview = document.getElementById('log');
    const btnPost = document.getElementById('btnPost');
    const btnClear = document.getElementById('btnClear');

    if (messageType !== null &&
        notificationMessages !== null &&
        notificationTypeExamples !== null &&
        message !== null &&
        logPreview !== null &&
        btnPost !== null &&
        btnClear !== null) {
        // setup listeners
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
        ws.onmessage = event => {
            const message = JSON.parse(event.data);
            log(logPreview, 'Incoming websocket message', message);
        };
    }
});