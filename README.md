# full-client-server-sveltekit

# Background

Inspired by [blitz.js](https://blitzjs.com/) I wanted to able to write my entire code in one file. Without thinking much about server apis and other server separation also I wanted learn to use ast so I created this.

This uses websocket to allow pretty much any data type to be shared to and from the server but it is not very optimized right now, also I'm a physics student so can't work on this very much.

# How to use

First install it by
`npm i full-client-server-sveltekit`

then change your vite config preferably ts
```js
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import WebSockets from "@carlosv2/adapter-node-ws/plugin";
import {serverBrowserSync} from "full-client-server-sveltekit/plugin";

export default defineConfig({
	plugins: [
		sveltekit(), 
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

add a hooks.server

change it's content to the follows

```js
import handleWS from "$lib/ws"
export const handleWs = handleWS((wsEvents) => {
});
```

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

Also it takes class instances as normal object normally.

You can make it able to serialize classes by giving it a serializer by using another exported function it's signature is as follows `addSerializerDeserializer(class, {serialize(class instance): "JSON.stringifiable object", deserialize("JSON.stringifiable object"): "class instance"})` this should be added to hook folder that is imported on both server and browser or somewhere else where the code runs before any and all code. Note that this is currently experimental and may not work as expected.

For a better example you may look into [this example](https://github.com/SBHattarj/full-client-server-sveltekit-example).

there are other imports which are used internally and I won't explain here.

Currently there is no options parameter unfortunatly, I'll implement that after version 1. Also I'm hoping to add a way define your own method of two way data sending, rather than using my defined way of doing the two way data sending, just to be a little more flexible, on the expense of added minute complexity.

Use this on your own discretion don't blame me for any valnearabilities it introduces I made this in over all 60 (trough out a few months due to lack of time as a physics major in college, about 60% of the mvp of this repo was done on the last 2 days due to summer vecation) hours and also I'm newly 18 at 2023 so don't expect much from me.

I hope you have fun with this.
