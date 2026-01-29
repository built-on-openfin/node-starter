![OpenFin Node Adapter Example -- How To Connect To An Interop Broker Basic](../../assets/OpenFin-Starter.png)

> **_:information_source: OpenFin Node Adapter:_** [OpenFin Node Adapter](https://www.openfin.co/workspace/) is a commercial product and this repo is for evaluation purposes. Use of the OpenFin Node Adapter, OpenFin Container and OpenFin Workspace components is only granted pursuant to a license from OpenFin. Please [**contact us**](https://www.openfin.co/workspace/poc/) if you would like to request a developer evaluation key or to discuss a production license.

## Learning more about Node

This example is a simple Node Server that exposes:

- A web form that lets you post messages to the server which in turn will be pushed via a websocket to anyone who is listening.
- A rest endpoint /api/messages which the form can post to.
- A rest endpoint /api/messages which will return all queued posts when a get request is made (this is to provide an option for long poll testing).
- A Websocket Server that is instantiated and is fed messages to send out via the POST rest endpoint.

The server stores each message and keeps the last 100. It will serve all stored messages on the first connection (if you want to simulate a batch of messages you can send multiple messages and then connect a platform to the server).

The web form lets you specify custom JSON objects to post but it also has a collection of example messages that work with a sample client notification service: <https://github.com/built-on-openfin/workspace-starter/blob/workspace/v19.1.0/how-to/workspace-platform-starter/client/src/modules/lifecycle/example-notification-service/README.md>.

This example service listens to a stream of events from an endpoint. We have included an example endpoint that can generate notifications based on lifecycle events e.g theme changed or it can listen on a specified websocket address: <https://github.com/built-on-openfin/workspace-starter/tree/workspace/v19.1.0/how-to/workspace-platform-starter/client/src/modules/endpoint/example-notification-source/README.md>

These examples run under our [workspace platform starter example](https://github.com/built-on-openfin/workspace-starter/blob/workspace/v19.1.0/how-to/workspace-platform-starter/) platform and are enabled by default in our [example manifest](https://github.com/built-on-openfin/workspace-starter/blob/workspace/v19.1.0/how-to/workspace-platform-starter/public/manifest.fin.json).

Inside of the manifest you need to set the websocket url setting: "websocket": { "url": "ws://localhost:6060" }. If you want to test long polling that set the longpoll url: "longpoll": { url:"<http://localhost:6060/api/messages>" }

### Node App

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

   to start the server that will serve static files and support the websocket and rest endpoints.

5. Open your desktop browser and visit <http://localhost:6060> to see the web form. The web form listens to the websocket and logs the results so you can confirm it is working.

## Testing end to end process flow

- The webpage served on localhost:3000 will let you post messages and see the websocket response through the log panel.
- The webpage also lets you see messages fetched through long polling. This is for scenarios where websockets may not be allowed and someone wants to see if long polling would work as well.
- To enable the workspace platform starter integration you will need workspace platform starter version 19.1.0+ and you will need to specify ws://localhost:3000 in the manifest.fin.json file's example-notification-source endpoint data configuration e.g. "websocket": {"url": "ws://localhost:6060"} or you would set the "longpoll": { "url": "<http://localhost:6060/api/messages>"}.
