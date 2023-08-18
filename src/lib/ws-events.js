/** @typedef {import("ws").WebSocket} NodeWebSocket */
import { EventEmitter } from "events"
import { BROWSER } from "esm-env"
/** @typedef {{
    on(event: string, callback: (data: any) => void): void
    off(event: string, callback: (data: any) => void): void
    emit(event: string, data: any): void
 }} WSEventHandler */
class WSEventInterface {
    /**
     * @param {NodeWebSocket | WebSocket} ws
     */
    constructor(ws) {
    }
    /** @typedef
     * @param {string} event
     * @param {(data: any) => void} callback
     * @return {this}
     */
    on(event, callback) {
        return this
    }
    /** @typedef
     * @param {string} event
     * @param {string} eventData
     * @return {boolean}
     */
    emit(event, eventData) {
        return true
    }
    /** @typedef
     * @param {string} event
     * @param {(data: any) => void} callback
     * @return {this}
     */
    off(event, callback) {
        return this
    }
}
/** @type {typeof WSEventInterface} */
let wsEvents
if(BROWSER) {
    wsEvents = class WSEventServer {
        /**
         * @param {WebSocket} ws
         */
        constructor(ws) {
            this.internalEvents = new EventEmitter()
            this.internalEvents.setMaxListeners(100000000)
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
} else {
    wsEvents = class WSEventServer {
        /**
         * @param {NodeWebSocket} ws
         */
        constructor(ws) {
            this.internalEvents = new EventEmitter()
            this.internalEvents.setMaxListeners(100000000)
            ws.on("message", (data) => {
                try {
                    const {event, eventData} = JSON.parse(data.toString())
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
}

/**
 * @param {WebSocket | NodeWebSocket} ws
 */
export default function WsEvents(ws) {
    return new wsEvents(ws)
}
