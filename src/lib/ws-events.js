import { EventEmitter } from "events"
/** 
 * @typedef {{
        on(event: string, callback: (data: any) => void): void
        off(event: string, callback: (data: any) => void): void
        emit(event: string, data: any): void
 }} WSEventHandler 
 * @typedef  {{
    addEventListener(
        event: string,
        callback: (event: {
            data: {
                toString(): string
            }
        }) => void
    ): void
    send(data: string): void
    onclose?: ((...arhs: any[]) => any) | null
 }} WebSocketLike
 * @typedef {{
    on(event: "connection", callback: (ws: WebSocketLike) => void): WebSocketServerLike,
 }} WebSocketServerLike
 */
class WSEventInterface {
    /**
     * @param {WebSocketLike} ws
     */
    constructor(ws) {
        this.internalEvents = new EventEmitter()
        this.internalEvents.setMaxListeners(100000)
        ws.addEventListener("message", wsEvent => {
            try {
                const {event, eventData} = JSON.parse(wsEvent.data.toString())
                this.internalEvents.emit(event, eventData)
            }
            catch {
            }
        })
        this.ws = ws
    }
    /**
     * @param {string} event
     * @param {(data: any) => void} callback
     */
    on(event, callback) {
        this.internalEvents.on(event, callback)
        return this
    }
    /**
     * @param {string} event
     * @param {*} eventData
     * @return {boolean}
     */
    emit(event, eventData) {
        this.ws.send(JSON.stringify({event, eventData}))
        return true
    }
    /**
     * @param {string} event
     * @param {(data: any) => void} callback
     * @return {this}
     */
    off(event, callback) {
        this.internalEvents.off(event, callback)
        return this
    }
}
/** @type {typeof WSEventInterface} */
let wsEvents = WSEventInterface

/**
 * @param {WebSocketLike} ws
 */
export default function WsEvents(ws) {
    return new wsEvents(ws)
}
