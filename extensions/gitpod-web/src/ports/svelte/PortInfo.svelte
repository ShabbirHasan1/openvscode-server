<script>
    export let port = {
        info: { label: "8080", tooltip: "" },
        status: { localPort: 8080, remotePort: 8081, name: "abc" },
    };

    let info = "";
    $: ((port) => {
        const showName = (port.status.name?.length ?? 0) > 0;
        const showPortDetail =
            port.status.remotePort != null &&
            port.info.localPort !== port.status.remotePort;

        info = port.status.name ?? port.status.localPort.toString();

        if (showPortDetail) {
            info +=
                info === port.status.name
                    ? ` (${port.status.localPort}:${port.status.remotePort})`
                    : ` :${port.status.remotePort}`;
        } else {
            info +=
                info === port.status.name ? ` (${port.status.localPort})` : "";
        }
    })(port);
</script>

<main>
    <span title={port.info.tooltip}>{info}</span>
</main>

<style>
    span {
        display: inline-block;
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1;
    }
</style>
