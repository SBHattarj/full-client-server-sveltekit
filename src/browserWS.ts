import type { WebSocketLike } from "full-client-server-sveltekit";

export function ws(): Promise<WebSocketLike> {
    let url = new URL(window.location.href)
    url.protocol = url.protocol.replace('http', 'ws');

    let ws = new WebSocket(url)
    let result = new Promise<WebSocket>((resolve) => {
        ws.onopen = function () {
            resolve(ws)
        }
    })
    return result
}
export function wsInit() {
    let url = new URL(window.location.href)
    url.protocol = url.protocol.replace('http', 'ws');

    let ws = new WebSocket(url)
    let result = new Promise<WebSocket>((resolve) => {
        ws.onopen = function () {
            resolve(ws)
        }
    })
    return result
}
