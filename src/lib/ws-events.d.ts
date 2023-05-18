declare module "ws-events" {
    import { WebSocket as NodeWebSocket } from "ws";
    export type WSEventHandler = {
		on(event: string, callback: (data: any) => void): void
		off(event: string, callback: (data: any) => void): void
		off(event: string): void
		off(): void
		emit(event: string, data: any): void
	}
	export default function wsEvents(socket: WebSocket | NodeWebSocket): WSEventHandler
};
