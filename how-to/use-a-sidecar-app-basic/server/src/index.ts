import type OpenFin from "@openfin/node-adapter";
import { connect } from "@openfin/node-adapter";

const SIDECAR_UUID = "node-sidecar-app";
const SIDECAR_CHANNEL_NAME = "node-sidecar-app";
const SIDECAR_CLIENT_FUNCTION_NAME = "node-sidecar-app-client-subscriber";
const SIDECAR_CHANNEL_FUNCTION_NAME = "node-sidecar-app-echo";

/**
 * Publish a message to connected clients.
 * @param provider The provider to publish against.
 * @param message The message to send.
 */
function publish(provider: OpenFin.ChannelProvider, message: string): void {
	if (provider !== undefined && message !== undefined) {
		console.log(
			`Publishing message to connected clients with registered function: ${SIDECAR_CLIENT_FUNCTION_NAME}`
		);
		provider.publish(SIDECAR_CLIENT_FUNCTION_NAME, message);
	} else {
		console.error("Publish was called without being passed a provider and/or a message.");
	}
}

/**
 * Initializes the OpenFin Runtime.
 */
async function init(): Promise<void> {
	console.log("Establishing fin connection.");
	const fin = await connect({
		uuid: SIDECAR_UUID,
		licenseKey: "openfin-demo-license-key",
		runtime: {
			version: "33.116.77.8"
		}
	});
	console.log("fin connection established.");
	const provider = await fin.InterApplicationBus.Channel.create(SIDECAR_CHANNEL_NAME);
	provider.onConnection((identity, payload) => {
		console.log("Client Connected");
		if (payload !== undefined) {
			console.log("Client Payload:", payload);
		}

		console.log(`Client UUID: ${identity.uuid}`);

		if (provider !== undefined) {
			setTimeout(() => {
				const message = `Sending message to connected client: ${new Date()}`;
				publish(provider, message);
			}, 10000);
		}
	});

	provider.onDisconnection((identity) => {
		console.log(`Client Disconnected: UUID: ${identity.uuid}, Name: ${identity.name}`);
	});

	provider.register(SIDECAR_CHANNEL_FUNCTION_NAME, (payload, identity) => {
		console.log(
			`Message received on SideCar App from connected client with uuid: ${identity.uuid}. Responding with Echo prefixed to received message.`
		);
		return `echo: ${payload}`;
	});
}

init()
	.then(() => {
		console.log("NodeJS initialized");
		return true;
	})
	.catch((err) => {
		console.error("There was an error initializing the node sidecar.", err);
	});
