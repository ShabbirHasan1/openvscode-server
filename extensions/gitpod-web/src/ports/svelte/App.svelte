<script>
    import PortTable from "./PortTable.svelte";
    let ports = [];
    window.addEventListener("message", (event) => {
        if (event.data.command === "updatePorts") {
            ports = event.data.ports.sort(
                (a, b) => a.status.localPort - b.status.localPort
            );
        }
    });
</script>

<main>
    <PortTable {ports} />
</main>

<style></style>
