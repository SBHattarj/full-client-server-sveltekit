import type { WebSocketServer } from "ws";
import WSEvents, { type WSEventHandler } from "ws-events";
import { serialize, deserialize } from "full-client-server-sveltekit";


export default function handleWs(cb: (wse: WSEventHandler) => any): (wse: WebSocketServer) => void {
    return function handleWse(wse) {
        wse.on("connection", ws => {
            
            const wsEvents = WSEvents(ws);
            
            wsEvents.on("/home/mav/full-client-server-sveltekit/src/routes/+page.svelte-0", async function (str) {
                let [id, update] = deserialize(str, "front", wsEvents);
                let caller = () => {
		console.log("hello");
	}

                const result = await caller();
                update();
                wsEvents.emit(`/home/mav/full-client-server-sveltekit/src/routes/+page.svelte-0-${id}`, serialize(result, "back", wsEvents));
            });
        

            wsEvents.on("/home/mav/full-client-server-sveltekit/src/routes/+page.svelte-1", async function (str) {
                let [id, hello, constant, $$invalidate, fn, bigInt, update] = deserialize(str, "front", wsEvents);
                let caller = async () => {
		(await import("/home/mav/full-client-server-sveltekit/src/routes/toBeImport")).say();
		console.log(hello);
		console.log(constant);
		$$invalidate(0, hello = "hello client");
		console.log(await fn());
		console.log("hello after fn");
		console.log(bigInt);
		$$invalidate(3, bigInt = 12n);
		console.log(bigInt);
		return "to client";
	}

                const result = await caller();
                update(hello, constant, $$invalidate, fn, bigInt);
                wsEvents.emit(`/home/mav/full-client-server-sveltekit/src/routes/+page.svelte-1-${id}`, serialize(result, "back", wsEvents));
            });
        

            wsEvents.on("/home/mav/full-client-server-sveltekit/src/routes/+page.svelte-2", async function (str) {
                let [id, $$invalidate, counter, update] = deserialize(str, "front", wsEvents);
                let caller = () => {
			$$invalidate(1, counter = counter + 1);
			console.log(counter);
			console.warn("this works again");
			return "h";
		}

                const result = await caller();
                update($$invalidate, counter);
                wsEvents.emit(`/home/mav/full-client-server-sveltekit/src/routes/+page.svelte-2-${id}`, serialize(result, "back", wsEvents));
            });
        
            cb(wsEvents);
    
        })
    }
    
};
    