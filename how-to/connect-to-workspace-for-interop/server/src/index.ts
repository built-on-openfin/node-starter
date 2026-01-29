/* eslint-disable linebreak-style */
/* eslint-disable jsdoc/check-tag-names */
/* eslint-disable jsdoc/match-description */
/* eslint-disable jsdoc/require-param-description */
/* eslint-disable no-trailing-spaces */
/* eslint-disable linebreak-style */
import type OpenFin from "@openfin/node-adapter";
import { connect } from "@openfin/node-adapter";
import { setDefaultResultOrder } from "dns";

/**
 * Initializes the OpenFin Runtime.
 */
async function init(): Promise<void> {
	console.log("Processing command line args.");

	const args = process.argv.slice(2); // Slice to remove the first two elements (node and script path)
	const contextArg = "context";
	const intentArg = "intent";
	const intentWithTargetArg = "intentwithtarget";

	if (args.length === 1) {
		const passedArg = args[0].toLowerCase();

		if (passedArg !== contextArg && passedArg !== intentArg && passedArg !== intentWithTargetArg) {
			throw new Error(`Invalid command line argument passed in: ${args[0]}`);
		}

		console.log("Establishing fin connection.");

		const fin = await connect({
			uuid: "node-app",
			licenseKey: "openfin-demo-license-key",
			runtime: {
				version: "33.116.77.8"
			}
		});
		console.log("fin connection established.");

		const interopClient = fin.Interop.connectSync("workspace-platform-starter");
		console.log(`Connected to interop broker on platform: ${interopClient.me.uuid}`);

		const contextGroups = await interopClient.getContextGroups();
		console.log("Interop broker has the following context groups", contextGroups);
		console.log("Joining the first context group", contextGroups[0]);

		await interopClient.joinContextGroup(contextGroups[0].id);

		// set up a context handler
		console.log("Setting up listener for Context changes.");
		await interopClient.addContextHandler(handleIncomingContext);

		// set up an intent handler for ViewContact
		console.log("Setting up listener for Intents changes.");
		await interopClient.registerIntentHandler(async (intentHandlerContact) => {
			console.log("Received intent", intentHandlerContact.context.type);
			console.log(intentHandlerContact.context.name);
		}, "ViewContact");

		// create a sample context object
		const myContext: OpenFin.Context = {
			type: "fdc3.contact",
			name: "Avi Green",
			id: {
				email: "avi.green@example.com"
			}
		};

		// create a sample intent object
		const intent = {
			name: "ViewContact",
			context: myContext
		};

		const intentWithTarget = {
			name: "ViewContact",
			context: myContext,
			metadata: { target: { appId: "participant-summary-view" } }
		};

		if (passedArg === contextArg) {
			console.log("Waiting 5 seconds before firing the context.");
			setTimeout(async () => {
				await interopClient.setContext(myContext);
			}, 5000);
		} else if (passedArg === intentArg) {
			console.log("Waiting 5 seconds before firing the intent.");
			setTimeout(async () => {
				await interopClient.fireIntent(intent);
			}, 5000);
		} else if (passedArg === intentWithTargetArg) {
			console.log("Waiting 5 seconds before firing the intent with target app.");
			setTimeout(async () => {
				await interopClient.fireIntent(intentWithTarget);
			}, 5000);
		}
	} else {
		throw new Error(
			"\r\n>> You must provide ONLY one command line argument. Eg. 'npm run server context' OR 'npm run server intent' OR 'npm run server intentWithTarget'. <<"
		);
	}
}

/**
 * handle incoming context
 * @param contextInfo
 * @return void
 */
function handleIncomingContext(contextInfo: OpenFin.Context): void {
	const { type } = contextInfo;
	console.log(`Received context of type ${type}`);
	console.log(`Context Name: ${contextInfo.name}`);
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
		console.log("Done.");
		return true;
	})
	.catch((err) => {
		console.error("There was an error initializing the node app.", err);
	});
