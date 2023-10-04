import type OpenFin from "@openfin/core";

let loggingElement: HTMLElement | null;
let clearLogsBtn: HTMLButtonElement | null;
let connectToNodeBtn: HTMLButtonElement | null;
let dispatchMessageToNodeAppBtn: HTMLButtonElement | null;
let launchFDC3WindowBtn: HTMLButtonElement | null;
let channelClient: OpenFin.ChannelClient;
let userContextChannelName: string;

const NODE_CHANNEL_NAME = "node-app";
const NODE_CHANNEL_SEND_CONTEXT_USERCHANNEL = "node-app-setContext-userChannel";
const NODE_CHANNEL_SEND_CONTEXT_APPCHANNEL = "node-app-setContext-appChannel";
const APP_CHANNEL_NAME = "custom-app-channel";

/**
 * Wait for the DOM to have been loaded before we connect the UI elements and initialize the platform.
 */
window.addEventListener("DOMContentLoaded", async () => {
	await initializeDom();
	await initializePlatform();
});

/**
 * Initialize the DOM elements.
 */
async function initializeDom(): Promise<void> {
	loggingElement = document.querySelector("#logging");
	const loggingContainer = document.querySelector<HTMLDivElement>("#logging-container");

	if (!loggingElement || !loggingContainer) {
		return;
	}

	loggingContainer.style.display = "flex";

	clearLogsBtn = document.querySelector("#btnClear");
	clearLogsBtn?.addEventListener("click", () => {
		if (loggingElement !== null) {
			loggingElement.textContent = "";
		}
	});

	connectToNodeBtn = document.querySelector("#btnConnectToNodeApp");
	connectToNodeBtn?.addEventListener("click", async () => {
		if (connectToNodeBtn !== null) {
			connectToNodeBtn.disabled = true;
			await createChannelClientAndRegisterListeners();
		}
		if (dispatchMessageToNodeAppBtn !== null) {
			dispatchMessageToNodeAppBtn.disabled = false;
		}
	});

	dispatchMessageToNodeAppBtn = document.querySelector("#btnDispatchMessageToNodeApp");
	dispatchMessageToNodeAppBtn?.addEventListener("click", dispatchMessageToNodeApp);

	launchFDC3WindowBtn = document.querySelector("#btnLaunchFDC3Window");
	launchFDC3WindowBtn?.addEventListener("click", launchFDC3ContextWindow);
}

/**
 * Initialize the Platform.
 */
async function initializePlatform(): Promise<void> {
	try {
		await fin.Platform.init({});
		loggingAddEntry("Platform initialized.");
		// Providers need to have fin.me.interop set if they wish to add context listeners.
		fin.me.interop = fin.Interop.connectSync(fin.me.identity.uuid);
		await setupContextListeners();
	} catch (error) {
		loggingAddEntry(
			`There was an error while trying to initialize your platform. Error: ${formatError(error)}`
		);
	}
}

/**
 * Format an error to a readable string.
 * @param err The error to format.
 * @returns The formatted error.
 */
function formatError(err: unknown): string {
	if (err instanceof Error) {
		return err.message;
	} else if (typeof err === "string") {
		return err;
	}
	return JSON.stringify(err);
}

/**
 * Create and assign a channel client.
 * @returns channel client
 */
async function createChannelClient(): Promise<OpenFin.ChannelClient> {
	const client = await fin.InterApplicationBus.Channel.connect(NODE_CHANNEL_NAME, {
		payload: "Payload from platform"
	});
	loggingAddEntry(`Connection To Node App on channel: ${NODE_CHANNEL_NAME} established.`);
	return client;
}

/**
 * Create a connection to the SideCar application.
 */
async function createChannelClientAndRegisterListeners(): Promise<void> {
	channelClient = await createChannelClient();

	if (channelClient !== null) {
		channelClient.onDisconnection((identity) => {
			console.log("onDisconnection identity:", identity);
			loggingAddEntry(`onDisconnection identity: ${JSON.stringify(identity)}`);
			if (connectToNodeBtn !== null) {
				connectToNodeBtn.disabled = false;
			}
			if (dispatchMessageToNodeAppBtn !== null) {
				dispatchMessageToNodeAppBtn.disabled = true;
			}
			loggingAddEntry("Client has been disconnected from the Node App");
		});
	}
}

/**
 * Send an example message to the Node application.
 */
async function dispatchMessageToNodeApp(): Promise<void> {
	try {
		const context = {
			type: "fdc3.instrument",
			name: "Apple",
			id: {
				ticker: "AAPL"
			}
		};
		if (channelClient !== undefined) {
			loggingAddEntry("Sending User Channel Context Message to Node App.");
			const response = await channelClient.dispatch(NODE_CHANNEL_SEND_CONTEXT_USERCHANNEL, context);
			loggingAddEntry(`Message sent to Node App User Channel function and response received: ${response}.`);
			loggingAddEntry("Sending App Channel Context Message to Node App.");
			const appChannelResponse = await channelClient.dispatch(NODE_CHANNEL_SEND_CONTEXT_APPCHANNEL, context);
			loggingAddEntry(
				`Message sent to Node App Channel function and response received: ${appChannelResponse}.`
			);
		} else {
			loggingAddEntry(
				"Unable to sending message to Node App as the platform is not currently connected to it."
			);
		}
	} catch (error) {
		console.error("There was an error trying to send a message to the Node App", error);
		loggingAddEntry(`Error sending message to Node App:  \n\n\t${formatError(error)}`);
	}
}

/**
 * Launch a FDC3 Window that can be used to share context.
 */
async function launchFDC3ContextWindow(): Promise<void> {
	await fin.Window.create({
		name: `fdc3-context-window-${Date.now()}`,
		url: "https://built-on-openfin.github.io/dev-extensions/extensions/v14.0.0/interop/fdc3/context/2-0/fdc3-broadcast-view.html",
		fdc3InteropApi: "2.0",
		interop: {
			currentContextGroup: userContextChannelName ?? "green"
		}
	});
}

/**
 * Listen to context.
 */
async function setupContextListeners(): Promise<void> {
	const groups = await fin.me.interop.getContextGroups();
	userContextChannelName = groups[0].id;
	loggingAddEntry(`Joining user context group: ${userContextChannelName}`);
	await fin.me.interop.joinContextGroup(userContextChannelName);
	loggingAddEntry("Adding user context listener.");
	await fin.me.interop.addContextHandler((context) => {
		loggingAddEntry(`Received user context: ${JSON.stringify(context)}`);
	});
	loggingAddEntry("Added user context listener.");
	const appChannel = await fin.me.interop.joinSessionContextGroup(APP_CHANNEL_NAME);
	loggingAddEntry("Adding app channel context listener.");
	await appChannel.addContextHandler((context) => {
		loggingAddEntry(`Received app channel context: ${JSON.stringify(context)}`);
	});
	loggingAddEntry("Added app channel context listener.");
}

/**
 * Add a new entry in to the logging window.
 * @param entry The entry to add.
 */
function loggingAddEntry(entry: string): void {
	if (loggingElement) {
		loggingElement.textContent = `${entry}\n\n${loggingElement.textContent}`;
	}
}
