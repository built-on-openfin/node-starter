import type OpenFin from "@openfin/core";

let loggingElement: HTMLElement | null;
let clearLogsBtn: HTMLButtonElement | null;
let connectToSideCarBtn: HTMLButtonElement | null;
let dispatchMessageToSideCarBtn: HTMLButtonElement | null;
let channelClient: OpenFin.ChannelClient;

const SIDECAR_APP_ALIAS = "sidecar-app";
const SIDECAR_APP_TARGET = "node-sidecar-basic.exe";
const SIDECAR_APP_SRC = `${location.origin}/assets/sidecar-app.zip`;
const SIDECAR_CHANNEL_NAME = "node-sidecar-app";
const SIDECAR_CLIENT_FUNCTION_NAME = "node-sidecar-app-client-subscriber";
const SIDECAR_CHANNEL_FUNCTION_NAME = "node-sidecar-app-echo";

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

	connectToSideCarBtn = document.querySelector("#btnConnectToSideCarApp");
	connectToSideCarBtn?.addEventListener("click", async () => {
		await setupSideCarApp();
		if (connectToSideCarBtn !== null) {
			connectToSideCarBtn.disabled = true;
		}
		if (dispatchMessageToSideCarBtn !== null) {
			dispatchMessageToSideCarBtn.disabled = false;
		}
	});

	dispatchMessageToSideCarBtn = document.querySelector("#btnDispatchMessageToSideCarApp");
	dispatchMessageToSideCarBtn?.addEventListener("click", dispatchMessageToSideCarApp);
}

/**
 * Initialize the Platform.
 */
async function initializePlatform(): Promise<void> {
	try {
		await fin.Platform.init({});
		loggingAddEntry("Platform initialized.");
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
	const client = await fin.InterApplicationBus.Channel.connect(SIDECAR_CHANNEL_NAME, {
		payload: "Payload from platform"
	});
	loggingAddEntry(`Connection To SideCar App on channel: ${SIDECAR_CHANNEL_NAME} established.`);
	return client;
}

/**
 * Fetch the SideCar App, Launch it and Connect to it via Channels.
 */
async function setupSideCarApp(): Promise<void> {
	await fetchSideCarAppIfNeeded();
	await launchSideCarApp();
	await createChannelClientAndRegisterListeners();
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
			if (connectToSideCarBtn !== null) {
				connectToSideCarBtn.disabled = false;
			}
			if (dispatchMessageToSideCarBtn !== null) {
				dispatchMessageToSideCarBtn.disabled = true;
			}
			loggingAddEntry("Client has been disconnected from the SideCar App");
		});

		// received request over channel to display a message
		channelClient.register(SIDECAR_CLIENT_FUNCTION_NAME, async (payload) => {
			loggingAddEntry(`Message received from SideCar App: ${payload}`);
		});
	}
}

/**
 * Send an example message to the SideCar application.
 */
async function dispatchMessageToSideCarApp(): Promise<void> {
	try {
		if (channelClient !== undefined) {
			loggingAddEntry("Sending Message to SideCar App.");
			const response = await channelClient.dispatch(
				SIDECAR_CHANNEL_FUNCTION_NAME,
				"Message from platform to sidecar"
			);
			loggingAddEntry(`Message sent to SideCar App and response received: ${response}.`);
		} else {
			loggingAddEntry(
				"Unable to sending message to SideCar App as the platform is not currently connected to it."
			);
		}
	} catch (error) {
		console.error("There was an error trying to send a message to the SideCar App", error);
		loggingAddEntry(`Error sending message to SideCar App:  \n\n\t${formatError(error)}`);
	}
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

/**
 * Fetches the SideCar Asset if it hasn't been specified in the manifest.
 * We are forcing the download each time it is run but you could fetch the asset
 * info from a service and the version number would indicate whether or not it was needed.
 */
async function fetchSideCarAppIfNeeded(): Promise<void> {
	const app = await fin.Application.getCurrent();
	const manifest: OpenFin.Manifest = await app.getManifest();
	loggingAddEntry("Checking to see if SideCar App is defined as an AppAsset in the manifest.");
	if (!Array.isArray(manifest.appAssets)) {
		loggingAddEntry("No App Assets Defined. Doing a direct download of the SideCar App.");
		await fetchSideCarApp();
		return;
	}
	const appAssets: { alias: string }[] = manifest.appAssets;
	if (appAssets.some((entry) => entry.alias === SIDECAR_APP_ALIAS)) {
		loggingAddEntry("SideCar App defined in Manifest. No need to fetch through code.");
		return;
	}
	await fetchSideCarApp();
}

/**
 * Shows downloading the SideCar App as an app asset.
 */
async function fetchSideCarApp(): Promise<void> {
	try {
		const appAsset: OpenFin.AppAssetInfo & {
			/**
			 * This setting should not be used in production as it will force
			 * the app asset to be fetched every single time.
			 * It is demonstrated here as the sample focuses on the app asset being
			 * built so you would want to ensure you have the latest copy each time.
			 * The second.manifest.fin.json (you can launch by running npm run secondclient)
			 * example does not specify forceDownload so you can see that it fetches a
			 * new version of the asset only when you change the version setting of the
			 * app asset.
			 */
			forceDownload?: boolean;
		} = {
			src: SIDECAR_APP_SRC,
			alias: SIDECAR_APP_ALIAS,
			version: "1.0.4",
			target: SIDECAR_APP_TARGET,
			forceDownload: true
		};

		loggingAddEntry("Fetching SideCar App through fin.System.downloadAsset.");
		await fin.System.downloadAsset(appAsset, (progress) => {
			const downloadedPercent = Math.floor((progress.downloadedBytes / progress.totalBytes) * 100);
			loggingAddEntry(`Downloaded ${downloadedPercent}% of SideCar App`);
		});
		loggingAddEntry("SideCar App is downloaded.");
	} catch (err) {
		loggingAddEntry(`There has been an error when trying to fetch the SideCar App: ${formatError(err)}`);
	}
}

/**
 * Launch SideCar App.
 */
async function launchSideCarApp(): Promise<void> {
	const sideCarApp: OpenFin.ExternalProcessRequestType = {
		alias: SIDECAR_APP_ALIAS,
		lifetime: "application",
		listener: (result) => {
			console.log("result", result);
			if (result.exitCode === 1) {
				console.log(`Successfully exited ${SIDECAR_APP_TARGET}`);
			}
		}
	};
	try {
		loggingAddEntry("Launching SideCar App.");
		const data = await fin.System.launchExternalProcess(sideCarApp);
		console.log("successfully launched SideCar App:", data);
		loggingAddEntry("SideCar App Launched.");
	} catch (err) {
		console.error(err);
		loggingAddEntry(`There was an error launching the SideCar App: ${formatError(err)}`);
	}
}
