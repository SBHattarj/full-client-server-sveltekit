# full-client-server-sveltekit

# Background

Inspired by [blitz.js](https://blitzjs.com/) I wanted to able to write my entire code in one file. Without thinking much about server apis and other server separation also I wanted learn to use ast so I created this.

This uses websocket to allow pretty much any data type to be shared to and from the server but it is not very optimized right now, also I'm a physics student so can't work on this very much.

# How to use

First install it by
`npm i full-client-server-sveltekit`

then change your vite config preferably ts (it forcibly uses ts right now you'll see in a minute)
```ts
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

also add a file `src/lib/ws.ts`

and give the following content to that file

```ts
import type { WebSocketServer } from "ws";
import WSEvents, { type WSEventHandler } from "ws-events";
import { serialize, deserialize } from "full-client-server-sveltekit";
export default (function handleWs(cb: (wse: WSEventHandler) => any): (wse: WebSocketServer) => void {
    return function handleWse(wss) {
        wss.on("connection", ws => {
            const wsEvents = WSEvents(ws);
            cb(wsEvents);
        });
    };
});
```

This is required to allow the ws to get what function needs to run at which point you'll see this changes when you add the node calls to your browser code

And to make a part run in the server from the browser you can try the given example

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
    import node from "full-client-server-sveltekit"
    node(() => {
        console.log("hello")
    })
    function fn() {
        console.log("client")
        return "to server"
    }
    let hello = "hello server"
    let bigInt = 100n
    $: setTimeout(() => console.log("update", bigInt), 10)
    let a = node(async () => {
        console.log(hello)
        hello = "hello client"
        console.log(await fn())
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
        return "h"
    })
}}>
    increment {counter}
</button>
```

here the node function is ssr directly calls the function in the node call
on browser it transpiles to `nodeCall(id, [...dependencies], (...updats) => ...(dependencies = updates))` where id is the file name followed by -<some number> which is not 1, 2, 3 for some reason, but it goes like 80, 80 84, I don't understand what went wrong

Also the ws.ts file should become something like

```ts
import type { WebSocketServer } from "ws";
import WSEvents, { type WSEventHandler } from "ws-events";
import { serialize, deserialize } from "full-client-server-sveltekit";
export default (function handleWs(cb: (wse: WSEventHandler) => any): (wse: WebSocketServer) => void {
    return function handleWse(wss) {
        wss.on("connection", ws => {
            const wsEvents = WSEvents(ws);
            wsEvents.on("/path/to/repo/src/routes/+page.svelte-88", async function (str) {
                let [id, update] = deserialize(str, "front", wsEvents);
                let caller = () => {
                    console.log("hello");
                };
                const result = await caller();
                update();
                wsEvents.emit(`/path/to/repo/src/routes/+page.svelte-88-${id}`, serialize(result, "back", wsEvents));
            });
            wsEvents.on("/path/to/repo/src/routes/+page.svelte-89", async function (str) {
                let [id, hello, $$invalidate, fn, bigInt, update] = deserialize(str, "front", wsEvents);
                let caller = async () => {
                    console.log(hello);
                    $$invalidate(0, hello = "hello client");
                    console.log(await fn());
                    console.log("hello after fn");
                    console.log(bigInt);
                    $$invalidate(3, bigInt = 12n);
                    console.log(bigInt);
                    return "to client";
                };
                const result = await caller();
                update(hello, $$invalidate, fn, bigInt);
                wsEvents.emit(`/path/to/repo/src/routes/+page.svelte-89-${id}`, serialize(result, "back", wsEvents));
            });
            wsEvents.on("/path/to/repo/src/routes/+page.svelte-93", async function (str) {
                let [id, $$invalidate, counter, update] = deserialize(str, "front", wsEvents);
                let caller = () => {
                    $$invalidate(1, counter = counter + 1);
                    console.log(counter);
                    console.warn("this works again");
                    return "h";
                };
                const result = await caller();
                update($$invalidate, counter);
                wsEvents.emit(`/path/to/repo/src/routes/+page.svelte-93-${id}`, serialize(result, "back", wsEvents));
            });
            cb(wsEvents);
        });
    };
});
```

Then it should work as if everything is done synchronously but the console logs in the node function will run in the server and will appear in your terminal

Also you can import the [`wse`](https://www.npmjs.com/package/ws-events) to import the ws event instance which lets you emit events which can be handles on the handleWS hook

Also it takes class instances as normal object normally.

You can make it able to serialize classes by giving it a serializer by using another exported function it's signature is as follows `addSerializerDeserializer(class, {serialize(class instance): "JSON.stringifiable object", deserialize("JSON.stringifiable object"): "class instance"})` this should be added to hook folder that is imported on both server and browser or somewhere else where the code runs before any and all code.

there are other imports which are used internally and I won't explain here.

Use this on your own discretion don't blame me for any valnearabilities it introduces I made this in over all 60 (trough out a few months due to lack of time as a physics major in college, about 60% of the mvp of this repo was done on the last 2 days due to summer vecation) hours and also I'm newly 18 at 2023 so don't expect much from me.

I hope you have fun with this.