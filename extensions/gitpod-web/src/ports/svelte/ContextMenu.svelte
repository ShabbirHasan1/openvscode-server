<script>
    // TODO(hw): Make options configurable
    import { createEventDispatcher } from "svelte";

    export let x = 0;
    export let y = 0;
    export let port = undefined;
    export let showMenu = false;

    let menuEl;
    const dispatch = createEventDispatcher();
    function onPageClick(e) {
        if (!showMenu) return;
        if (e.target === menuEl || menuEl.contains(e.target)) return;
        dispatch("clickoutside");
    }

    $: (() => {
        if (!showMenu || !menuEl) return;
        const rect = menuEl.getBoundingClientRect();
        x = Math.min(window.innerWidth - rect.width, x);
        if (y > window.innerHeight - rect.height) y -= rect.height;
    })(x, y);

    let menuOptions = [];
    $: ((port) => {
        if (port == null) {
            return;
        }
        const options = [];
        const viewItem = port.info.contextValue;
        if (viewItem.includes("host") && viewItem.includes("tunneled")) {
            options.push("tunnelNetwork");
        }
        if (viewItem.includes("network") && viewItem.includes("tunneled")) {
            options.push("tunnelHost");
        }
        options.length > 0 && options.push(null);
        if (viewItem.includes("private")) {
            options.push("makePublic");
        }
        if (viewItem.includes("public")) {
            options.push("makePrivate");
        }
        if (viewItem.includes("exposed") || viewItem.includes("tunneled")) {
            options.push("preview");
            options.push("openBrowser");
        }
        if (viewItem.includes("failed")) {
            options.length > 0 && options.push(null);
            options.push("retryAutoExpose");
        }
        menuOptions = options.map((e) => {
            if (e == null) {
                return { type: "divider" };
            }
            // TODO(hw): How to align to package.nls.json with code?
            return { command: e, label: e, desc: "" };
        });
    })(port);

    function selectCommand(command) {
        dispatch("command", { command, port });
    }
</script>

<main>
    {#if showMenu}
        <div class="menu" bind:this={menuEl} style="top: {y}px; left: {x}px;">
            {#each menuOptions as menu}
                {#if menu.type === "divider"}
                    <div class="divider" />
                {:else}
                    <div
                        class="opt"
                        on:click={() => selectCommand(menu.command)}
                    >
                        {menu.label}
                        <span>{menu.desc}</span>
                    </div>
                {/if}
            {/each}
        </div>
    {/if}
</main>

<svelte:window on:click={onPageClick} />

<style>
    .menu {
        padding: 4px 0;
        position: fixed;
        display: grid;
        width: 230px;
        border: 1px solid var(--vscode-menu-selectionBorder);
        background-color: var(--vscode-menu-background);
        z-index: 1000;
        box-shadow: 0 10px 15px -3px var(--vscode-widget-shadow), 0 4px 6px -4px var(--vscode-widget-shadow);
    }
    .opt {
        cursor: pointer;
        padding: 6px 16px;
        position: relative;
    }
    .opt > span {
        float: right;
    }
    .divider {
        margin: 4px 8px;
        border-bottom: 1px solid var(--vscode-textSeparator-foreground);
    }
    .opt:hover {
        background-color: var(--vscode-list-activeSelectionBackground);
    }
</style>
