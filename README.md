# full-client-server-sveltekit

# Background

Inspired by [blitz.js](https://blitzjs.com/) I wanted to able to write my entire code in one file. Without thinking much about server apis and other server separation also I wanted learn to use ast so I created this.

This uses websocket to allow pretty much any data type to be shared to and from the server but it is not very optimized right now, also I'm a physics student so can't work on this very much.

# How to use

First install it by
`npm i full-client-server-sveltekit`

If you want to use the default ws implementation you may also install:

`npm i @carlosv2/adapter-node-ws ws`

then change your vite config
```js
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
// add this line if using the default ws implementation
import WebSockets from "@carlosv2/adapter-node-ws/plugin";
import {serverBrowserSync} from "full-client-server-sveltekit/plugin";

export default defineConfig({
	plugins: [
		sveltekit(), 
        // add this if using the default ws implementation
		WebSockets(),
		serverBrowserSync(),
	],
	server: {
		hmr: { port: 3000 } // any port that is not the port that the development server runs on
    }
});

```

change your svelte config as follows
```js
// if using the default ws implementation otherwise use whickever one your want
import adapter from "@carlosv2/adapter-node-ws/adapter";
import { vitePreprocess } from '@sveltejs/kit/vite';
import path from "path"

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	
	kit: {
		// adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
		// If your environment is not supported or you settled on a specific environment, switch out the adapter.
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter: adapter()
	}
};

export default config;

```

When using the default ws implementation you will also want the hooks.server.ts to look like as follows:
```js
import handleWS from "$lib/ws"
export const handleWs = handleWS((wsEvents) => {
});

```
You may also add the ws config.

ws config can only export one thing that is a wsInit function (not defualt export) which should return a WebSocketLike object, to know about the WebSocketLike object read ahead, it would be documented later.

Also in case you are not using the default implementation with ws you have to use the function handleWS function's return type on the WebSocketServer or WebSocketServerLike object.


This library adds the ws.js file for you with jsdoc typing. And it is added in the lib folder.

And to make a part run in the server from the browser you can try the given example

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
    import node from "full-client-server-sveltekit"
    import { say } from "server:/routes/toBeImport"
    import WebSocket from "server:npm:ws";
    
    class A {
        c() {
            console.log(this.b)
        }
        a() {
            console.log("a", this.b)
        }
        constructor(public b: number) {
            
        }
    }
    const AInstance = new A(1)
    node(() => {
        say()
        console.log(WebSocket)
        console.log("hello")
    })
    function fn() {
        console.log("client")
        return "to server"
    }
    let hello = "hello server"
    let bigInt = 100n
    const constant = "constant"
    $: setTimeout(() => console.log("update", bigInt), 10)
    let a = node(async () => {
        (await import("./toBeImport")).say()
        console.log(hello)
        console.log(constant)
        hello = "hello client"
        console.log(await fn())
        console.log(AInstance.c())
        console.log(AInstance.a())
        console.log("hello after fn")
        console.log(bigInt)
        bigInt = 12n
        console.log(bigInt)
        return "to client"
    })
    let counter = 0
</script>

<h1>Welcome to your library project</h1>
<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>
{hello}
{#await a}
    hello
{:then a} 
    <h1>{a}</h1>
{/await}

<button on:click={function () {
    console.log(counter)
    node(() => {
        counter = counter + 1
        console.log(counter)
        console.warn("this works again")
        return {
            a: Promise.resolve("hello"),
        }
    }).then(async (e) => {
        console.log(await e.a)
    })
}}>
    increment {counter}
</button>
```
Also you will have to add the toBeImport file in src/routes, that will run on the server only.

here the node function in ssr directly calls the function in the node call
on browser it transpiles to `nodeCall(id, [...dependencies], (...updats) => ...(dependencies = updates))` where id is the file name followed by -<some number> which is not 1, 2, 3 for some reason, but it goes like 80, 80 84, I don't understand what went wrong

Also the `server:/` import, imports from `src/` that is `server:/routes/toBeImport` becomes `/routes/toBeImport`. also `server:npm:` imports npm packages as server only. In the browser, the import is done through a virtual file, which imports the file through a node call. Also if you import a function and use it as a function, it will not call it as a value but call it similarly to nodeCall, so any in place value like a string or and options object won't be exposed to the browser. You still should'n do backend query outside of the node function.

Also the ws.js file should become something like

```js
import WSEvents from "full-client-server-sveltekit/ws-events";
import { serialize, deserialize } from "full-client-server-sveltekit";
/** @typedef {import("ws").WebSocketServer} WebSocketServer */


/**
* @param {(wse: import("full-client-server-sveltekit/ws-events").WSEventHandler) => any} cb
* @return {(wse: WebSocketServer) => void}
*/
export default function handleWs(cb) {
    return function handleWse(wse) {
        wse.on("connection", ws => {
            /** @typedef {Record<string, Record<string, any>>} CacheType */
            /** @type {CacheType} */
            let data = {
                cache: {}
            }
            ws.onclose = function () {
                delete data.cache
            }
            
            const wsEvents = WSEvents(ws);
            
            wsEvents.on("__internal_full_client_server_import__/routes/toBeImport?=,say=say", /** 
            * @this CacheType
            * @param {string} str
            */ async function (str) {
                let [id, update] = deserialize(
                    str, 
                    "front", 
                    wsEvents,
                    this.cache
                );
                let caller = async () => await import("/home/mav/repos/full-client-server-sveltekit/src/routes/toBeImport")

                const result = await caller();
                update();
                wsEvents.emit(`__internal_full_client_server_import__/routes/toBeImport?=,say=say-${id}`, serialize(
                    result, 
                    "back", 
                    wsEvents,
                    this.cache
                ));
            }.bind(data));
        

            wsEvents.on("__internal_full_client_server_import__ws?=WebSocket,", /** 
            * @this CacheType
            * @param {string} str
            */ async function (str) {
                let [id, update] = deserialize(
                    str, 
                    "front", 
                    wsEvents,
                    this.cache
                );
                let caller = async () => await import("ws")

                const result = await caller();
                update();
                wsEvents.emit(`__internal_full_client_server_import__ws?=WebSocket,-${id}`, serialize(
                    result, 
                    "back", 
                    wsEvents,
                    this.cache
                ));
            }.bind(data));
        

            wsEvents.on("/home/mav/repos/full-client-server-sveltekit/src/routes/+page.svelte-0", /** 
            * @this CacheType
            * @param {string} str
            */ async function (str) {
                let [id, update] = deserialize(
                    str, 
                    "front", 
                    wsEvents,
                    this.cache
                );
                const { say: say } = await import("/home/mav/repos/full-client-server-sveltekit/src/routes/toBeImport");
                const { default: WebSocket } = await import("ws");
                let caller = () => {
               		say();
               		console.log(WebSocket);
               		console.log("hello");
               	}

                const result = await caller();
                update();
                wsEvents.emit(`/home/mav/repos/full-client-server-sveltekit/src/routes/+page.svelte-0-${id}`, serialize(
                    result, 
                    "back", 
                    wsEvents,
                    this.cache
                ));
            }.bind(data));
        

            wsEvents.on("/home/mav/repos/full-client-server-sveltekit/src/routes/+page.svelte-1", /** 
            * @this CacheType
            * @param {string} str
            */ async function (str) {
                let [id, hello, constant, $$invalidate, fn, AInstance, bigInt, update] = deserialize(
                    str, 
                    "front", 
                    wsEvents,
                    this.cache
                );
                let caller = async () => {
               		(await import("/home/mav/repos/full-client-server-sveltekit/src/routes/toBeImport")).say();
               		console.log(hello);
               		console.log(constant);
               		$$invalidate(0, hello = "hello client");
               		console.log(await fn());
               		console.log(AInstance.c());
               		console.log(AInstance.a());
               		console.log("hello after fn");
               		console.log(bigInt);
               		$$invalidate(3, bigInt = 12n);
               		console.log(bigInt);
               		return "to client";
               	}

                const result = await caller();
                update(hello, constant, $$invalidate, fn, AInstance, bigInt);
                wsEvents.emit(`/home/mav/repos/full-client-server-sveltekit/src/routes/+page.svelte-1-${id}`, serialize(
                    result, 
                    "back", 
                    wsEvents,
                    this.cache
                ));
            }.bind(data));
        

            wsEvents.on("/home/mav/repos/full-client-server-sveltekit/src/routes/+page.svelte-2", /** 
            * @this CacheType
            * @param {string} str
            */ async function (str) {
                let [id, $$invalidate, counter, a, update] = deserialize(
                    str, 
                    "front", 
                    wsEvents,
                    this.cache
                );
                let caller = () => {
               			$$invalidate(1, counter = counter + 1);
               			console.log(counter);
               			console.warn("this works again");
               			return { a: Promise.resolve("hello") };
               		}

                const result = await caller();
                update($$invalidate, counter, a);
                wsEvents.emit(`/home/mav/repos/full-client-server-sveltekit/src/routes/+page.svelte-2-${id}`, serialize(
                    result, 
                    "back", 
                    wsEvents,
                    this.cache
                ));
            }.bind(data));
        
            cb(wsEvents);
    
        })
    }
    
};
```

Then it should work as if everything is done synchronously but the console logs in the node function will run in the server and will appear in your terminal

Also you can import the wse to import the ws event instance which lets you emit events which can be handles on the handleWS hook

Also it takes class instances as normal objecta normally.

You can make it able to serialize classes by giving it a serializer by using another exported function it's signature is as follows `addSerializerDeserializer(class, {serialize(class instance): "JSON.stringifiable object", deserialize("JSON.stringifiable object"): "class instance"})` this should be added to hook folder that is imported on both server and browser or somewhere else where the code runs before any and all code. Note that this is currently experimental and may not work as expected.

For a better example you may look into [this example](https://github.com/SBHattarj/full-client-server-sveltekit-example).

there are other imports which are used internally and I won't explain here.

# Exports
## Main module (".")

export | types | description
-------|-------|-------------
default | `function <T>(cb: T): Promise<Awaited<ReturnType<T>>>` | The node function makes certain parts of code only run on the server

### Note
The other exports are not to be used by the consumer

## plugin module ("./plugin")

export | types | description
-------|-------|--------------
default | `function (option: PluginOptions): Plugin)` | The plugin function

### PluginOption

property | types | description | default
---------|-------|-------------|----------
cwd | `string` | current working directory | `process.cwd()`
wsOutput | `string` | the output file for the wsHandle function, relative to cwd, must not start with "/", "./" or "../" must not contain extension | `"src/lib/ws"`
browserWSConfig | `string` | the location for the browserWSConfig file, simalar to wsOutput, relative to cwd, must not contain extenstion | `"src/browserWS.config"`
configExtensions | `stirng[]` | the posible extensions for the config file | `[".js", ".ts"]`
connectionTimeout | `number` | the number of miliseconds before throwing timeout error on the node functions | `10 * 1000`

## ws-events module ("./ws-events")
export | types | description
-------|-------|-------------
default | `function (ws: WebSocketLike): WSEvents` | The function initialize the WSEvents
WSEvents | `class` | The class of the WSEvents
WebSocketLike | `type` | An object that is similar to WebSocket object
WebSocketServerLike | `type` | An object that is similar to WebSocketServer object from `"ws"`

### WSEvents

property | types | description
---------|-------|-------------
constructor | `function(ws: WebSocketLike)` | The constructor
on | `function (event: string, cb: (data: any) => any): this` | function add a callback for event sent from the other side (server/browser)
off | `function (event: string, cb: (data: any) => any): this` | function remove a callback
emit | `function (event: string, data: any): this` | function emit an event to be sent to the other side

### WebSocketLike

property | types | description
---------|-------|-------------
addEventListener | `fucntion (event: stirng, cb: ({data: {toString(): string}}) => void): void` | function to add listener for events over web socket. The `"message"` event is used by WSEvents to handle the ws data sent from the other side and then emit proper events.
send | `function (data: string): void` | function to send data over web socket
onCloke | `function (...args: any[]): any | null` | Callback ran when the socket connection is closed
onopen | `function (...args: any[]): any | null` | Callback ran when the socket connection is established

### WebSocketServerLike

property | types | description
---------|-------|-------------
on | `function (event: "connection", callback: (ws: WebSocketLike) => void): WebSocketServerLike` | function to add evnet from WebSocketServer, only`"connection"` event is apperantly triggered by this object

This plugin now supports the ussage of other means of two way communication to be used other than ws, but it may not be the easiest to implement, thus the default implementation is provided, you are encouraged experiment and try to use other methods, for example you might find [this](https://github.com/SBHattarj/full-client-server-sveltekit-example/tree/rest) to be interesting 
I hope you have fun with this.
