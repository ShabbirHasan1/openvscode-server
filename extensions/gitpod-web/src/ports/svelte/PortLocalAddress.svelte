<script>
    import { createEventDispatcher } from "svelte";
    import HoverOptions from "./HoverOptions.svelte";

    export let port = {
        status: {
            localPort: 5877,
            served: false,
            exposed: {
                visibility: 0,
                url: "https://5877-gitpodio-openvscodeserv-tayof6nxey1.ws-us47.gitpod.io",
                onExposed: 4,
            },
            autoExposure: 0,
            tunneled: {
                targetPort: 5877,
                visibility: 1,
                clientsMap: [],
            },
            description: "",
            name: "Hello World",
        },
    };

    const hoverOpts = [
        { icon: "copy", command: "urlCopy", title: "Copy Url" },
        { icon: "earth", command: "openBrowser", title: "Open in Browser" },
        { icon: "preview", command: "preview", title: "Open in Preview" },
    ];
    const dispatch = createEventDispatcher();
    function onHoverCommand(event) {
        const { command } = event.detail;
        dispatch("hoverCommand", { command, port });
    }
</script>

<HoverOptions options={hoverOpts} on:command={onHoverCommand}>
    <a href={port.status.exposed.url}>{port.status.exposed.url}</a>
</HoverOptions>

<style>
    a {
        color: var(--vscode-foreground);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: inline-block;
    }
    a:focus {
        outline: none;
    }
</style>
