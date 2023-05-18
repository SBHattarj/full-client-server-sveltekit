import type { WebSocketServer } from "ws";
import WsEvents from "ws-events";
import { deserialize, serialize } from "$lib";
import handleWS from "$lib/ws"
export const handleWs = handleWS((wsEvents) => {
});