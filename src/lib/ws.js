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
