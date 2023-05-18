// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface Platform {}
	}

	var shareMap: Map<function, {serialize(obj: any): any, deserialize(str: any): any}>
}

export {};
