<script lang="ts">
    import node from "full-client-server-sveltekit"
    import { browser } from "$app/environment";
    node(() => {
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
        return "h"
    })
}}>
    increment {counter}
</button>
