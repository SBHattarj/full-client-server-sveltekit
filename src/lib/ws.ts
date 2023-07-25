import type { WebSocketServer } from "ws";
import WSEvents, { type WSEventHandler } from "ws-events";
import { serialize, deserialize } from "full-client-server-sveltekit";


export default function handleWs(cb: (wse: WSEventHandler) => any): (wse: WebSocketServer) => void {
    return function handleWse(wse) {
        wse.on("connection", ws => {
            let data = {
                cache: {}
            }
            ws.onclose = function () {
                delete (data as any).cache
            }
            
            const wsEvents = WSEvents(ws);
            
            wsEvents.on("__internal_full_client_server_import__/routes/toBeImport?=,say=say", async function (this: typeof data, str: string) {
                let [id, update] = deserialize(
                    str, 
                    "front", 
                    wsEvents,
                    this.cache
                );
                let caller = async () => await import("/home/mav/full-client-server-sveltekit/src/routes/toBeImport")

                const result = await caller();
                update();
                wsEvents.emit(`__internal_full_client_server_import__/routes/toBeImport?=,say=say-${id}`, serialize(
                    result, 
                    "back", 
                    wsEvents,
                    this.cache
                ));
            }.bind(data));
        

            wsEvents.on("/home/mav/full-client-server-sveltekit/src/routes/+page.svelte-0", async function (this: typeof data, str: string) {
                let [id, update] = deserialize(
                    str, 
                    "front", 
                    wsEvents,
                    this.cache
                );
                const { say: say } = await import("/home/mav/full-client-server-sveltekit/src/routes/toBeImport");
                let caller = () => {
		say();
		console.log("hello");
	}

                const result = await caller();
                update();
                wsEvents.emit(`/home/mav/full-client-server-sveltekit/src/routes/+page.svelte-0-${id}`, serialize(
                    result, 
                    "back", 
                    wsEvents,
                    this.cache
                ));
            }.bind(data));
        

            wsEvents.on("/home/mav/full-client-server-sveltekit/src/routes/+page.svelte-1", async function (this: typeof data, str: string) {
                let [id, hello, constant, $$invalidate, fn, AInstance, bigInt, update] = deserialize(
                    str, 
                    "front", 
                    wsEvents,
                    this.cache
                );
                let caller = async () => {
		(await import("/home/mav/full-client-server-sveltekit/src/routes/toBeImport")).say();
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
                wsEvents.emit(`/home/mav/full-client-server-sveltekit/src/routes/+page.svelte-1-${id}`, serialize(
                    result, 
                    "back", 
                    wsEvents,
                    this.cache
                ));
            }.bind(data));
        

            wsEvents.on("/home/mav/full-client-server-sveltekit/src/routes/+page.svelte-2", async function (this: typeof data, str: string) {
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
                wsEvents.emit(`/home/mav/full-client-server-sveltekit/src/routes/+page.svelte-2-${id}`, serialize(
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
    