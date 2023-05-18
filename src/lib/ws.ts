import type { WebSocketServer } from "ws";
import WSEvents, { type WSEventHandler } from "ws-events";
import { serialize, deserialize } from "full-client-server-sveltekit";
export default (function handleWs(cb: (wse: WSEventHandler) => any): (wse: WebSocketServer) => void {
    return function handleWse(wss) {
        wss.on("connection", ws => {
            const wsEvents = WSEvents(ws);
            wsEvents.on("/home/mav/test-module/full-client-serrver-sveltekit/src/routes/+page.svelte-88", async function (str) {
                let [id, update] = deserialize(str, "front", wsEvents);
                let caller = () => {
                    console.log("hello");
                };
                const result = await caller();
                update();
                wsEvents.emit(`/home/mav/test-module/full-client-serrver-sveltekit/src/routes/+page.svelte-88-${id}`, serialize(result, "back", wsEvents));
            });
            wsEvents.on("/home/mav/test-module/full-client-serrver-sveltekit/src/routes/+page.svelte-89", async function (str) {
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
                wsEvents.emit(`/home/mav/test-module/full-client-serrver-sveltekit/src/routes/+page.svelte-89-${id}`, serialize(result, "back", wsEvents));
            });
            wsEvents.on("/home/mav/test-module/full-client-serrver-sveltekit/src/routes/+page.svelte-93", async function (str) {
                let [id, $$invalidate, counter, update] = deserialize(str, "front", wsEvents);
                let caller = () => {
                    $$invalidate(1, counter = counter + 1);
                    console.log(counter);
                    console.warn("this works again");
                    return "h";
                };
                const result = await caller();
                update($$invalidate, counter);
                wsEvents.emit(`/home/mav/test-module/full-client-serrver-sveltekit/src/routes/+page.svelte-93-${id}`, serialize(result, "back", wsEvents));
            });
            cb(wsEvents);
        });
    };
});