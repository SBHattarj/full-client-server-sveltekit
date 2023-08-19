import WSEvents from "full-client-server-sveltekit/ws-events";
import { serialize, deserialize } from "full-client-server-sveltekit";
/** @typedef {import("full-client-server-sveltekit").CacheData} CacheData */
/** @typedef {import("full-client-server-sveltekit/ws-events").WebSocketServerLike} WebSocketServer */
/** @typedef {import("full-client-server-sveltekit/ws-events").WebSocketLike} WebSocket */


/**
* @param {(wse: import("full-client-server-sveltekit/ws-events").WSEventHandler) => any} cb
* @param {(wss: WebSocketServer, ws: WebSocket) => boolean} [validator]
* @param {(cache: CacheData, wss: WebSocketServer, ws: WebSocket) => void} [dispose]
* @return {(wse: WebSocketServer) => void}
*/
export default function handleWs(cb, validator, dispose) {
    return function handleWse(wss) {
        wss.on("connection", ws => {
            if(validator != null && !validator?.(wss, ws)) return
            /** @type {CacheData} */
            let data = {
                cache: {},
                functionRef: new Map(),
                functionMap: new Map(),
                weakRef: new WeakMap()
            }
            ws.onclose = function () {
                if(dispose != null) {
                    dispose(data, wss, ws)
                    return
                }
                delete data.cache
                delete data.functionRef
                delete data.functionMap
                delete data.weakRef
            }
            
            const wsEvents = WSEvents(ws);
            
            wsEvents.on("__internal_full_client_server_import__/routes/toBeImport?=,say=say", /** 
            * @this CacheData
            * @param {string} str
            */ async function (str) {
                if(this.cache == null) return
                if(this.functionMap == null) return
                if(this.functionRef == null) return
                if(this.weakRef == null) return
                let [id, update] = deserialize(
                    str, 
                    "front", 
                    wsEvents,
                    this.cache,
                    this.functionMap,
                    this.functionRef,
                    this.weakRef
                );
                // @ts-ignore
                let caller = async () => await import("/home/mav/repos/full-client-server-sveltekit/src/routes/toBeImport")

                const result = await caller();
                update();
                wsEvents.emit(`__internal_full_client_server_import__/routes/toBeImport?=,say=say-${id}`, serialize(
                    result, 
                    "back", 
                    wsEvents,
                    this.cache,
                    this.functionRef,
                    this.functionMap,
                    this.weakRef
                ));
            }.bind(data));
        

            wsEvents.on("__internal_full_client_server_import__ws?=WebSocket,", /** 
            * @this CacheData
            * @param {string} str
            */ async function (str) {
                if(this.cache == null) return
                if(this.functionMap == null) return
                if(this.functionRef == null) return
                if(this.weakRef == null) return
                let [id, update] = deserialize(
                    str, 
                    "front", 
                    wsEvents,
                    this.cache,
                    this.functionMap,
                    this.functionRef,
                    this.weakRef
                );
                // @ts-ignore
                let caller = async () => await import("ws")

                const result = await caller();
                update();
                wsEvents.emit(`__internal_full_client_server_import__ws?=WebSocket,-${id}`, serialize(
                    result, 
                    "back", 
                    wsEvents,
                    this.cache,
                    this.functionRef,
                    this.functionMap,
                    this.weakRef
                ));
            }.bind(data));
        

            wsEvents.on("/home/mav/repos/full-client-server-sveltekit/src/routes/+page.svelte-0", /** 
            * @this CacheData
            * @param {string} str
            */ async function (str) {
                if(this.cache == null) return
                if(this.functionMap == null) return
                if(this.functionRef == null) return
                if(this.weakRef == null) return
                let [id, update] = deserialize(
                    str, 
                    "front", 
                    wsEvents,
                    this.cache,
                    this.functionMap,
                    this.functionRef,
                    this.weakRef
                );
                const { say: say } = await import("/home/mav/repos/full-client-server-sveltekit/src/routes/toBeImport");
                const { default: WebSocket } = await import("ws");
                // @ts-ignore
                let caller = () => {
// @ts-ignore
                		say();
// @ts-ignore
                		console.log(WebSocket);
// @ts-ignore
                		console.log("hello");
// @ts-ignore
                	}

                const result = await caller();
                update();
                wsEvents.emit(`/home/mav/repos/full-client-server-sveltekit/src/routes/+page.svelte-0-${id}`, serialize(
                    result, 
                    "back", 
                    wsEvents,
                    this.cache,
                    this.functionRef,
                    this.functionMap,
                    this.weakRef
                ));
            }.bind(data));
        

            wsEvents.on("/home/mav/repos/full-client-server-sveltekit/src/routes/+page.svelte-1", /** 
            * @this CacheData
            * @param {string} str
            */ async function (str) {
                if(this.cache == null) return
                if(this.functionMap == null) return
                if(this.functionRef == null) return
                if(this.weakRef == null) return
                let [id, hello, constant, $$invalidate, fn, AInstance, bigInt, update] = deserialize(
                    str, 
                    "front", 
                    wsEvents,
                    this.cache,
                    this.functionMap,
                    this.functionRef,
                    this.weakRef
                );
                // @ts-ignore
                let caller = async () => {
// @ts-ignore
                		(await import("/home/mav/repos/full-client-server-sveltekit/src/routes/toBeImport")).say();
// @ts-ignore
                		console.log(hello);
// @ts-ignore
                		console.log(constant);
// @ts-ignore
                		$$invalidate(0, hello = "hello client");
// @ts-ignore
                		console.log(await fn());
// @ts-ignore
                		console.log(AInstance.c());
// @ts-ignore
                		console.log(AInstance.a());
// @ts-ignore
                		console.log("hello after fn");
// @ts-ignore
                		console.log(bigInt);
// @ts-ignore
                		$$invalidate(3, bigInt = 12n);
// @ts-ignore
                		console.log(bigInt);
// @ts-ignore
                		return "to client";
// @ts-ignore
                	}

                const result = await caller();
                update(hello, constant, $$invalidate, fn, AInstance, bigInt);
                wsEvents.emit(`/home/mav/repos/full-client-server-sveltekit/src/routes/+page.svelte-1-${id}`, serialize(
                    result, 
                    "back", 
                    wsEvents,
                    this.cache,
                    this.functionRef,
                    this.functionMap,
                    this.weakRef
                ));
            }.bind(data));
        

            wsEvents.on("/home/mav/repos/full-client-server-sveltekit/src/routes/+page.svelte-2", /** 
            * @this CacheData
            * @param {string} str
            */ async function (str) {
                if(this.cache == null) return
                if(this.functionMap == null) return
                if(this.functionRef == null) return
                if(this.weakRef == null) return
                let [id, $$invalidate, counter, a, update] = deserialize(
                    str, 
                    "front", 
                    wsEvents,
                    this.cache,
                    this.functionMap,
                    this.functionRef,
                    this.weakRef
                );
                // @ts-ignore
                let caller = () => {
// @ts-ignore
                			$$invalidate(1, counter = counter + 1);
// @ts-ignore
                			console.log(counter);
// @ts-ignore
                			console.warn("this works again");
// @ts-ignore
                			return { a: Promise.resolve("hello") };
// @ts-ignore
                		}

                const result = await caller();
                update($$invalidate, counter, a);
                wsEvents.emit(`/home/mav/repos/full-client-server-sveltekit/src/routes/+page.svelte-2-${id}`, serialize(
                    result, 
                    "back", 
                    wsEvents,
                    this.cache,
                    this.functionRef,
                    this.functionMap,
                    this.weakRef
                ));
            }.bind(data));
        
            cb(wsEvents);
    
        })
    }
    
};
