<script>
    import ContextMenu from "./ContextMenu.svelte";
    import PortInfo from "./PortInfo.svelte";
    import PortStatus from "./PortStatus.svelte";
    import PortLocalAddress from "./PortLocalAddress.svelte";
    export let ports = [];
    let menuData = {
        x: 0,
        y: 0,
        showMenu: false,
        port: undefined,
    };

    async function onRightClick(event, port) {
        if (menuData.showMenu) {
            menuData.showMenu = false;
            await new Promise((res) => setTimeout(res, 100));
        }
        const { x, y } = event;
        menuData.x = x;
        menuData.y = y;
        menuData.port = port;
        menuData.showMenu = true;
    }

    function closeMenu() {
        menuData.showMenu = false;
    }

    let currentSelectPort = undefined;
    function selectRow(event, port, index) {
        currentSelectPort =
            currentSelectPort?.status.localPort === port.status.localPort
                ? undefined
                : port;
    }

    function menuCommand(event) {
        const { command, port } = event.detail;
        vscode.postMessage({
            command,
            port,
        });
        closeMenu();
    }

    let tableHovered = false;

    setTimeout(() => {
        makeTableResizable();
    }, 2000);

    let tableEl = null;
    let isResizable = false;
    let draging = false;
    function makeTableResizable() {
        if (isResizable || !tableEl) {
            return;
        }
        isResizable = true;
        var thElm;
        var startOffset;
        tableEl.querySelectorAll("th").forEach((th) => {
            const tmp = th.querySelectorAll(".grip");
            if (tmp.length !== 1) {
                return;
            }
            const grip = tmp[0];
            grip.addEventListener("mousedown", function (e) {
                thElm = th;
                startOffset = th.offsetWidth - e.x;
                draging = true;
            });

            th.appendChild(grip);
        });

        document.addEventListener("mousemove", function (e) {
            if (thElm) {
                thElm.style.width = startOffset + e.x + "px";
            }
        });

        document.addEventListener("mouseup", function () {
            draging = false;
            thElm = undefined;
        });
    }
</script>

<main>
    <ContextMenu
        {...menuData}
        on:clickoutside={closeMenu}
        on:command={menuCommand}
    />
    <table
        bind:this={tableEl}
        class:table-resizing={draging}
        class:table-hover={tableHovered}
        on:mouseenter={() => (tableHovered = true)}
        on:mouseleave={() => (tableHovered = false)}
    >
        <tr>
            <th width="40px" />
            <th style="min-width: 180px" width="180px"
                >Port
                <div class="grip" class:grip-drag={draging} />
            </th>
            <th style="min-width: 180px"
                >Local Address
                <div class="grip" class:grip-drag={draging} /></th
            >
            <th style="min-width: 180px" width="180px"
                >Description
                <div class="grip" class:grip-drag={draging} /></th
            >
            <th style="min-width: 120px" width="180px"
                >State
                <div class="grip" class:grip-drag={draging} /></th
            >
        </tr>
        {#each ports as port, i (port.status.localPort)}
            <tr
                class="tr-data"
                class:tr-select={currentSelectPort &&
                    currentSelectPort.status.localPort ===
                        port.status.localPort}
                on:click={(e) => selectRow(e, port)}
                on:contextmenu|preventDefault={(event) =>
                    onRightClick(event, port)}
            >
                <td
                    class:served={port.status.served}
                    style="text-align: center"
                >
                    <PortStatus status={port.info.iconStatus} />
                </td>
                <!-- Port (port info) -->
                <td>
                    <PortInfo {port} />
                </td>
                <!-- Local Address -->
                <td>
                    {#if (port.status.exposed?.url.length ?? 0) > 0}
                        <PortLocalAddress
                            on:hoverCommand={menuCommand}
                            {port}
                        />
                    {/if}
                </td>
                <!-- description -->
                <td>{port.status.description}</td>
                <!-- state -->
                <td>{port.info.description}</td>
            </tr>
        {/each}
    </table>
</main>

<style>
    table {
        width: 100%;
        height: 100%;
        border-collapse: collapse;
        font-size: 13px;
        border-spacing: 0;
        user-select: none;
        table-layout: fixed;
        min-width: 180px !important;
    }
    tr {
        height: 22px;
        line-height: 22px;
    }
    td,
    th {
        text-align: left;
        padding: 0 8px;
        box-sizing: border-box;
        border-width: 0px 1px 0px 1px;
        border-collapse: collapse;
        border-style: solid;
        border-color: transparent;
    }
    th {
        border-width: 0;
        font-weight: 700;
        position: relative;
        word-break: keep-all;
    }
    td {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    ::-webkit-resizer {
        background-color: transparent;
    }

    .table-hover td {
        border-color: var(--vscode-scrollbarSlider-background) !important;
    }

    .tr-data:nth-child(odd) {
        background-color: var(--vscode-tree-tableOddRowsBackground);
    }
    .tr-data:hover {
        background-color: var(--vscode-list-hoverBackground);
    }
    .tr-select {
        background-color: var(
            --vscode-list-activeSelectionBackground
        ) !important;
    }
    .grip {
        top: 0;
        right: -10px;
        bottom: 0;
        width: 20px;
        position: absolute;
        cursor: col-resize;
        text-align: center;
    }
    .grip::before {
        content: " ";
        height: 100%;
        display: inline-block;
        width: 2px;
    }
    .grip:hover::before {
        background-color: var(--vscode-list-activeSelectionBackground);
    }
    .grip-drag::before {
        width: 4px;
        background-color: var(--vscode-list-activeSelectionBackground);
    }
    .table-resizing td {
        border-width: 0px 4px 0px 4px;
        border-color: var(--vscode-list-activeSelectionBackground) !important;
    }
</style>
