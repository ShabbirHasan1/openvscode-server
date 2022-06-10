<script>
    import { createEventDispatcher } from "svelte";

    const iconMap = {
        copy: '<path d="M502.6 70.63l-61.25-61.25C435.4 3.371 427.2 0 418.7 0H255.1c-35.35 0-64 28.66-64 64l.0195 256C192 355.4 220.7 384 256 384h192c35.2 0 64-28.8 64-64V93.25C512 84.77 508.6 76.63 502.6 70.63zM464 320c0 8.836-7.164 16-16 16H255.1c-8.838 0-16-7.164-16-16L239.1 64.13c0-8.836 7.164-16 16-16h128L384 96c0 17.67 14.33 32 32 32h47.1V320zM272 448c0 8.836-7.164 16-16 16H63.1c-8.838 0-16-7.164-16-16L47.98 192.1c0-8.836 7.164-16 16-16H160V128H63.99c-35.35 0-64 28.65-64 64l.0098 256C.002 483.3 28.66 512 64 512h192c35.2 0 64-28.8 64-64v-32h-47.1L272 448z"/>',
        earth: '<path d="M352 256C352 278.2 350.8 299.6 348.7 320H163.3C161.2 299.6 159.1 278.2 159.1 256C159.1 233.8 161.2 212.4 163.3 192H348.7C350.8 212.4 352 233.8 352 256zM503.9 192C509.2 212.5 512 233.9 512 256C512 278.1 509.2 299.5 503.9 320H380.8C382.9 299.4 384 277.1 384 256C384 234 382.9 212.6 380.8 192H503.9zM493.4 160H376.7C366.7 96.14 346.9 42.62 321.4 8.442C399.8 29.09 463.4 85.94 493.4 160zM344.3 160H167.7C173.8 123.6 183.2 91.38 194.7 65.35C205.2 41.74 216.9 24.61 228.2 13.81C239.4 3.178 248.7 0 256 0C263.3 0 272.6 3.178 283.8 13.81C295.1 24.61 306.8 41.74 317.3 65.35C328.8 91.38 338.2 123.6 344.3 160H344.3zM18.61 160C48.59 85.94 112.2 29.09 190.6 8.442C165.1 42.62 145.3 96.14 135.3 160H18.61zM131.2 192C129.1 212.6 127.1 234 127.1 256C127.1 277.1 129.1 299.4 131.2 320H8.065C2.8 299.5 0 278.1 0 256C0 233.9 2.8 212.5 8.065 192H131.2zM194.7 446.6C183.2 420.6 173.8 388.4 167.7 352H344.3C338.2 388.4 328.8 420.6 317.3 446.6C306.8 470.3 295.1 487.4 283.8 498.2C272.6 508.8 263.3 512 255.1 512C248.7 512 239.4 508.8 228.2 498.2C216.9 487.4 205.2 470.3 194.7 446.6H194.7zM190.6 503.6C112.2 482.9 48.59 426.1 18.61 352H135.3C145.3 415.9 165.1 469.4 190.6 503.6V503.6zM321.4 503.6C346.9 469.4 366.7 415.9 376.7 352H493.4C463.4 426.1 399.8 482.9 321.4 503.6V503.6z"/>',
        preview:
            '<path d="M0 96C0 60.65 28.65 32 64 32H448C483.3 32 512 60.65 512 96V416C512 451.3 483.3 480 448 480H64C28.65 480 0 451.3 0 416V96zM64 416H224V160H64V416zM448 160H288V416H448V160z"/>',
    };
    export let options = [{ icon: "copy", command: "copy", title: "Copy Url" }];

    const dispatch = createEventDispatcher();
    function clickOption(command) {
        dispatch("command", { command });
    }
</script>

<main>
    <div class="container">
        <div class="slot">
            <slot />
        </div>
        <span class="hide">
            {#each options as opt}
                {#if iconMap[opt.icon] != null}
                    <span
                        title={opt.title}
                        class="svg-container"
                        on:click={(e) => clickOption(opt.command)}
                    >
                        <svg
                            class="svg"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 512 512"
                        >
                            {@html iconMap[opt.icon]}
                        </svg>
                    </span>
                {/if}
            {/each}
            <svg class="svg" style="display: none;" />
        </span>
    </div>
</main>

<style>
    .hide {
        display: none;
        flex: none;
        padding-left: 4px;
        box-sizing: border-box;
        align-content: center;
    }

    .hide > span {
        margin-left: 4px;
    }

    .slot {
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: inline-flex;
        align-content: center;
    }

    .container {
        position: relative;
        display: flex;
        justify-content: space-between;
    }

    .hide:hover,
    .container:hover > .hide {
        display: inline-flex;
    }
    .svg-container {
        display: inline-block;
        width: 12px;
        height: 12px;
    }
    .svg {
        flex: none;
        cursor: pointer;
        display: inline-block;
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        fill: var(--vscode-foreground);
    }
</style>
