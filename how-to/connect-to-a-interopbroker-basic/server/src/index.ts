import type OpenFin from "@openfin/node-adapter";
import { connect } from "@openfin/node-adapter";
import { setDefaultResultOrder } from "dns";

const NODE_UUID = "node-app";
const NODE_CHANNEL_NAME = "node-app";
const NODE_CHANNEL_SEND_CONTEXT_USERCHANNEL = "node-app-setContext-userChannel";
const NODE_CHANNEL_SEND_CONTEXT_APPCHANNEL = "node-app-setContext-appChannel";
const APP_CHANNEL_NAME = "custom-app-channel";

/**
 * Initializes the OpenFin Runtime.
 */
async function init(): Promise<void> {
	console.log("Establishing fin connection.");
	let interopClient: OpenFin.InteropClient;
	let appChannel: OpenFin.SessionContextGroup;

	const platformUUID = "node-platform-interopbroker";
	const fin = await connect({
		uuid: NODE_UUID,
		licenseKey: "openfin-demo-license-key",
		runtime: {
			version: "33.116.77.8"
		}
	});
	console.log("fin connection established.");
	const provider = await fin.InterApplicationBus.Channel.create(NODE_CHANNEL_NAME);
	provider.onConnection(async (identity, payload) => {
		console.log("Client Connected");
		console.log(`Client UUID: ${identity.uuid}`);
		if (payload !== undefined) {
			console.log("Client Payload:", payload);
		}
		if (interopClient === undefined) {
			console.log(`Connecting to interop broker on platform: ${platformUUID}`);
			interopClient = fin.Interop.connectSync("node-platform-interopbroker");
			console.log(`Connected to interop broker on platform: ${platformUUID}`);
			const contextGroups = await interopClient.getContextGroups();
			console.log("Interop broker has the following context groups", contextGroups);
			console.log("Joining the first context group", contextGroups[0]);
			await interopClient.joinContextGroup(contextGroups[0].id);
			console.log("Joining/Creating the session context group:", APP_CHANNEL_NAME);
			appChannel = await interopClient.joinSessionContextGroup(APP_CHANNEL_NAME);
			console.log("Connected to app channel:", APP_CHANNEL_NAME);
			console.log("Adding user context listener.");
			await interopClient.addContextHandler((context) => {
				console.log("User Context received on Node App:", context);
			});
			console.log("Added user context listener.");
			console.log("Adding app context listener.", APP_CHANNEL_NAME);
			await appChannel.addContextHandler((context) => {
				console.log("App Channel Context received on Node App:", context);
			});
			console.log("Added app context listener.", APP_CHANNEL_NAME);
		}
	});

	provider.onDisconnection((identity) => {
		console.log(`Client Disconnected: UUID: ${identity.uuid}, Name: ${identity.name}`);
	});

	provider.register(NODE_CHANNEL_SEND_CONTEXT_APPCHANNEL, async (payload, identity) => {
		console.log(
			`Message received on Node App from connected client with uuid: ${identity.uuid}. Sending context to app channel.`,
			payload
		);
		await appChannel.setContext(payload as OpenFin.Context);
		return "Done";
	});

	provider.register(NODE_CHANNEL_SEND_CONTEXT_USERCHANNEL, async (payload, identity) => {
		console.log(
			`Message received on Node App from connected client with uuid: ${identity.uuid}. Sending context to user channel.`,
			payload
		);
		await interopClient.setContext(payload as OpenFin.Context);
		return "Done";
	});
}

try {
	setDefaultResultOrder("ipv4first");
} catch {
	// Early versions of node do not support this method, but those earlier versions
	// also do not have the same issue with interface ordering, so it doesn't matter
	// that it hasn't been called. This is handling a switch introduced in node 17 which
	// is being resolved in later versions of node (e.g. 20.7.0 has been tested).
	// If you are below 17 or at or above v20 of node then this block is not needed.
}

init()
	.then(() => {
		console.log("NodeJS initialized");
		return true;
	})
	.catch((err) => {
		console.error("There was an error initializing the node app.", err);
	});
