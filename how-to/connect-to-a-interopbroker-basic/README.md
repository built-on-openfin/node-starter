![OpenFin Node Adapter Example -- How To Connect To An Interop Broker Basic](../../assets/OpenFin-Starter.png)

> **_:information_source: OpenFin Node Adapter:_** [OpenFin Node Adapter](https://www.openfin.co/workspace/) is a commercial product and this repo is for evaluation purposes. Use of the OpenFin Node Adapter, OpenFin Container and OpenFin Workspace components is only granted pursuant to a license from OpenFin. Please [**contact us**](https://www.openfin.co/workspace/poc/) if you would like to request a developer evaluation key or to discuss a production license.

## Learning more about Node, Interop and FDC3

This example shows how you can use the node adapter to connect to a platform's interop broker to share or receive context on either a user channel or app channel.

## Platform App

We've created a basic platform. The platform app shows it's provider window and adds a number of buttons on there for:

- Connecting to a Channel API exposed by the node app
- Pushing messages to the node app that will then be broadcast via setContext to user channels and app channels.
- Launch a window containing our FDC3 Context UI (so that you can listen to and broadcast information and see the code required to broadcast or listen).
- Clear Logs - Clears the log panel. The log panel shows what the platform setup steps but also logs the actions it is doing and the context it receives.

### Node App

> **_:information_source: Node version used:_** This sample was built and tested against node v16.19.1.

The node app exposes a Channel API service that the web platform can connect to. It needs this so that it can receive context messages that should be sent out on app channels and user channels(as the Node App doesn't have a UI).

When the platform connects the node app connect's to the platform's interop broker. The interop client it receives is then used to listen to and send out context messages.

The node app project can be found in [server/src/index.ts](./server/src/index.ts).

The node app is built when npm run build is run.

The node app is started when npm run server is run.

## Build the Platform and Node application

1. Ensure that you are in the sub-folder that contains the code.

2. Run

   ```bash
   npm run setup
   ```

   to install the dependencies

3. Run

   ```bash
   npm run build
   ```

   to build the client component.

   - **Note**. Please remember to repeat steps 1 though 3 each time you modify the code.

4. Run

   ```bash
   npm run start
   ```

   to start the generic http server that will serve static files.

5. Open a new Terminal / Command Window in the same sub-folder as step 1. Run

   ```bash
   npm run client
   ```

   to run the client component.

6. Open a new Terminal / Command Window in the same sub-folder as step 1. Run

   ```bash
   npm run server
   ```

   to run the server (node) component.

## Testing end to end process flow

- You can run the client and the server.
- When both are running and the node application says it is initialized you are ready for the client to connect to it.
- Click the "Connect To Node App" button and you will see the connection logged to the log panel. You will also see logging information in the Node App.
- Click the Dispatch Message to Node App button. This will send two messages to the Node App via the Channel API. The Node App will then send those context messages on a user and app channel to be received by the provider and anything else listening.
- Click the Clear Logs button
- Click the Launch FDC3 Context App to launch our FDC3 Context Tool in a new Window. You can now send context from the FDC3 Context App and see it appear on the Platform Window and the Node App.
- Click the Dispatch Message To Node App and you will now see the message broadcast from Node appear on the Platform and FDC3 Context Window.

![Node Platform App Flow](./connect-to-an-interopbroker-example.gif)

> **_:warning: A Note about Node:_** Node 17 changed their behavior and "localhost" favours IPv6 when it used to favour IPv4. This would cause your node-adapter connection to fail. Node 20+ has been updated and this is no longer and issue. Our example runs some code to set the preference to IPv4 in the [provider.ts](./server/src/index.ts) file. If you are using node 20 and above or 16 or below then this try/catch logic can be removed if you want. More information can be found [here](https://github.com/nodejs/node/issues/40537).

## APIs

The **node adapter** does not have an FDC3 API but you can connect to an Interop Broker and receive an interop client. As you can see from this example FDC3 and the Interop API work together.

The **provider** does not have an FDC3 API and it doesn't have a fin.me.interop API enabled. You can however assign an interop client to fin.me.interop once your platform (and the broker) is initialized.

**Windows and Views** can use the FDC3 API (like you can see in our FDC3 Context Window) if they opt for it through the manifest by specifying fdc3InteropApi and a giving it a version e.g. "2.0" as part of default View Options or default Window Options. Or as shown in the example you can opt into FDC3 when launching the Window by specifying fdc3InteropApi as part of the Window Options.
