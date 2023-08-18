<script lang="ts">
    import node from "full-client-server-sveltekit"
    import { say } from "server:/routes/toBeImport"
    import WebSocket from "server:npm:ws";
    
    class A {
        c() {
            console.log(this.b)
        }
        a() {
            console.log("a", this.b)
        }
        constructor(public b: number) {
            
        }
    }
    const AInstance = new A(1)
    node(() => {
        say()
        console.log(WebSocket)
        console.log("hello")
    })
    function fn() {
        console.log("client")
        return "to server"
    }
    let hello = "hello server"
    let bigInt = 100n
    const constant = "constant"
    $: setTimeout(() => console.log("update", bigInt), 10)
    let a = node(async () => {
        (await import("./toBeImport")).say()
        console.log(hello)
        console.log(constant)
        hello = "hello client"
        console.log(await fn())
        console.log(AInstance.c())
        console.log(AInstance.a())
        console.log("hello after fn")
        console.log(bigInt)
        bigInt = 12n
        console.log(bigInt)
        return "to client"
    })
    let counter = 0
</script>

<h1>Welcome to your library project</h1>
<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>
{hello}
{#await a}
    hello
{:then a} 
    <h1>{a}</h1>
{/await}

<button on:click={function () {
    console.log(counter)
    node(() => {
        counter = counter + 1
        console.log(counter)
        console.warn("this works again")
        return {
            a: Promise.resolve("hello"),
        }
    }).then(async (e) => {
        console.log(await e.a)
    })
}}>
    increment {counter}
</button>
