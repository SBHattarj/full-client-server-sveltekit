import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import WebSockets from "@carlosv2/adapter-node-ws/plugin";
import path from "path"
import {serverBrowserSync} from "./src/lib/plugin"

export default defineConfig({
	resolve: {
		alias: {
			"full-client-server-sveltekit": path.resolve(__dirname, "src", "lib")
		}
	},
	plugins: [
		sveltekit(), 
		WebSockets(),
		serverBrowserSync()
	],
	server: {
		hmr: { port: 3000 }
    }
});
