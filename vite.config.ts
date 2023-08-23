import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import WebSockets from "@carlosv2/adapter-node-ws/plugin";
import path from "path"
import {serverBrowserSync} from "./src/lib/plugin"

export default defineConfig({
	resolve: {
		alias: {
			"full-client-server-sveltekit": path.resolve(__dirname, "src", "lib"),
            "server:": path.resolve(__dirname, "src"),
            "server:npm:": path.resolve(__dirname, "node_modules"),
		}
	},
	plugins: [
		sveltekit(), 
		WebSockets(),
		serverBrowserSync({
            __internal_is_dev_module__: false,
            wsOutput: "src/ws"
        })
	],
	server: {
		hmr: { port: 3000 }
    },
    build: {
        target: "esnext"
    },
});
