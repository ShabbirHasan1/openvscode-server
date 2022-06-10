/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Gitpod. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/// <reference path='../../../../src/vscode-dts/vscode.d.ts'/>
/// <reference path='../../../../src/vscode-dts/vscode.proposed.resolvers.d.ts'/>

import * as workspaceInstance from '@gitpod/gitpod-protocol/lib/workspace-instance';
import { GitpodExtensionContext } from 'gitpod-shared';
import { PortsStatus, ExposedPortInfo, PortsStatusResponse, PortAutoExposure, PortVisibility } from '@gitpod/supervisor-api-grpc/lib/status_pb';
import { TunnelVisiblity, TunnelPortRequest } from '@gitpod/supervisor-api-grpc/lib/port_pb';
import { URL } from 'url';
import * as util from 'util';
import * as vscode from 'vscode';

export type IconStatus = 'Served' | 'NotServed' | 'Detecting' | 'ExposureFailed';

export interface PortInfo {
	label: string;
	tooltip: string;
	description: string;
	iconStatus: IconStatus;
	contextValue: string;
	localUrl: string;
	iconPath?: vscode.ThemeIcon;
}

export interface ExposedPort extends PortsStatus.AsObject {
	exposed: ExposedPortInfo.AsObject;
}
export function isExposedPort(port: PortsStatus.AsObject | undefined): port is ExposedPort {
	return !!port?.exposed;
}
export interface ExposedServedPort extends ExposedPort {
	served: true;
}
export function isExposedServedPort(port: PortsStatus.AsObject | undefined): port is ExposedServedPort {
	return isExposedPort(port) && !!port.served;
}
export interface ExposedServedGitpodWorkspacePort extends GitpodWorkspacePort {
	status: ExposedServedPort;
}
export function isExposedServedGitpodWorkspacePort(port: GitpodWorkspacePort | undefined): port is ExposedServedGitpodWorkspacePort {
	return port instanceof GitpodWorkspacePort && isExposedServedPort(port.status);
}

export class GitpodWorkspacePort {
	public info: PortInfo;
	public status: PortsStatus.AsObject;
	constructor(
		readonly portNumber: number,
		private readonly context: GitpodExtensionContext,
		private portStatus: PortsStatus,
		private tunnel?: vscode.TunnelDescription,
	) {
		this.status = portStatus.toObject();
		this.portStatus = portStatus;
		this.tunnel = tunnel;
		this.info = this.parsePortInfo(portStatus, tunnel);
	}

	update(portStatus: PortsStatus, tunnel?: vscode.TunnelDescription) {
		this.status = portStatus.toObject();
		this.portStatus = portStatus;
		this.tunnel = tunnel;
		this.info = this.parsePortInfo(portStatus, tunnel);
	}

	private parsePortInfo(portStatus: PortsStatus, tunnel?: vscode.TunnelDescription) {
		const currentStatus = portStatus.toObject();
		const { name, localPort, description, exposed, served } = currentStatus;
		// const prevStatus = port.status;
		const port: PortInfo = {
			label: '',
			tooltip: '',
			description: '',
			contextValue: '',
			iconStatus: 'NotServed',
			localUrl: 'http://localhost:' + localPort,
		};
		port.label = name ? `${name}: ${localPort}` : `${localPort}`;
		if (description) {
			port.tooltip = name ? `${name} - ${description}` : description;
		}

		if (this.remotePort && this.remotePort !== localPort) {
			port.label += ':' + this.remotePort;
		}

		const accessible = exposed || tunnel;

		// We use .public here because https://github.com/gitpod-io/openvscode-server/pull/360#discussion_r882953586
		const isPortTunnelPublic = !!tunnel?.public;
		if (!served) {
			port.description = 'not served';
			port.iconPath = new vscode.ThemeIcon('circle-outline');
			port.iconStatus = 'NotServed';
		} else if (!accessible) {
			if (portStatus.getAutoExposure() === PortAutoExposure.FAILED) {
				port.description = 'failed to expose';
				port.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
				port.iconStatus = 'ExposureFailed';
			} else {
				port.description = 'detecting...';
				port.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('editorWarning.foreground'));
				port.iconStatus = 'Detecting';
			}
		} else {
			port.description = 'open';
			if (tunnel) {
				port.description += ` on ${isPortTunnelPublic ? 'all interfaces' : 'localhost'}`;
			}
			if (exposed) {
				port.description += ` ${exposed.visibility === PortVisibility.PUBLIC ? '(public)' : '(private)'}`;
			}
			port.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('ports.iconRunningProcessForeground'));
			port.iconStatus = 'Served';
		}

		port.contextValue = 'port';
		if (served) {
			port.contextValue = 'served-' + port.contextValue;
		}
		if (exposed) {
			port.contextValue = 'exposed-' + port.contextValue;
			port.contextValue = (exposed.visibility === PortVisibility.PUBLIC ? 'public-' : 'private-') + port.contextValue;
		}
		if (tunnel) {
			port.contextValue = (isPortTunnelPublic ? 'network-' : 'host-') + port.contextValue;
		}
		if (!accessible && portStatus.getAutoExposure() === PortAutoExposure.FAILED) {
			port.contextValue = 'failed-' + port.contextValue;
		}
		return port;
	}

	toSvelteObject() {
		return {
			info: this.info,
			status: {
				...this.status,
				remotePort: this.remotePort,
			},
		};
	}

	openExternal() {
		// TODO(hw): Why we use `localUrl` before, it's always localhost:xxx for me. Maybe it's because I am debuging?
		return vscode.env.openExternal(vscode.Uri.parse(this.status.exposed?.url ?? this.info.localUrl));
	}

	get externalUrl(): string {
		if (this.tunnel) {
			const localAddress = typeof this.tunnel.localAddress === 'string' ? this.tunnel.localAddress : this.tunnel.localAddress.host + ':' + this.tunnel.localAddress.port;
			return localAddress.startsWith('http') ? localAddress : `http://${localAddress}`;
		}
		return this.portStatus.getExposed()?.getUrl() || this.info.localUrl;
	}

	get remotePort(): number | undefined {
		if (this.tunnel) {
			if (typeof this.tunnel.localAddress === 'string') {
				try {
					return Number(new URL(this.tunnel.localAddress).port);
				} catch {
					return undefined;
				}
			}
			return this.tunnel.localAddress.port;
		}
		return undefined;
	}
	async setPortVisibility(visibility: workspaceInstance.PortVisibility): Promise<void> {
		if (this.portStatus) {
			await this.context.gitpod.server.openPort(this.context.info.getWorkspaceId(), {
				port: this.portStatus.getLocalPort(),
				visibility
			});
		}
	}
	async setTunnelVisibility(visibility: TunnelVisiblity): Promise<void> {
		const request = new TunnelPortRequest();
		request.setPort(this.portNumber);
		request.setTargetPort(this.portNumber);
		request.setVisibility(visibility);
		await util.promisify(this.context.supervisor.port.tunnel.bind(this.context.supervisor.port, request, this.context.supervisor.metadata, {
			deadline: Date.now() + this.context.supervisor.deadlines.normal
		}))();
	}
}

export const PortCommands = <const>['tunnelNetwork', 'tunnelHost', 'makePublic', 'makePrivate', 'preview', 'openBrowser', 'retryAutoExpose', 'urlCopy'];

export type PortCommand = typeof PortCommands[number];

export class GitpodPortViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'gitpod.portView';

	public _view?: vscode.WebviewView;

	readonly portMap = new Map<number, GitpodWorkspacePort>();

	private readonly onDidExposeServedPortEmitter = new vscode.EventEmitter<ExposedServedGitpodWorkspacePort>();
	readonly onDidExposeServedPort = this.onDidExposeServedPortEmitter.event;


	private readonly onDidChangePortsEmitter = new vscode.EventEmitter<Map<number, GitpodWorkspacePort>>();
	readonly onDidChangePorts = this.onDidChangePortsEmitter.event;

	constructor(private readonly context: GitpodExtensionContext) { }

	// @ts-ignore
	resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext<unknown>, token: vscode.CancellationToken): void | Thenable<void> {
		this._view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		};
		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
		webviewView.onDidChangeVisibility(() => {
			if (!webviewView.visible) {
				return;
			}
			this.updateHtml();
		});
		this.onHtmlCommand();
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'ports/bundle.js'));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'ports/bundle.css'));
		const nonce = getNonce();
		return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta http-equiv="X-UA-Compatible" content="IE=edge" />
                <meta
		        http-equiv="Content-Security-Policy"
		        content="default-src 'none'; img-src data: ${webview.cspSource}; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';"
		        />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />

                <link href="${styleUri}" rel="stylesheet" />
                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                </script>
                <title>Gitpod Port View</title>
            </head>
            <body></body>
            <script nonce="${nonce}" src="${scriptUri}"></script>
            </html>`;
	}

	readonly tunnels = new Map<number, vscode.TunnelDescription>();
	updateTunnels(tunnels: vscode.TunnelDescription[]): void {
		this.tunnels.clear();
		for (const tunnel of tunnels) {
			this.tunnels.set(tunnel.remoteAddress.port, tunnel);
		}
		this.update();
	}

	private portStatus: PortsStatusResponse | undefined;
	updatePortsStatus(portsStatus: PortsStatusResponse): void {
		this.portStatus = portsStatus;
		this.update();
	}

	private updating = false;
	private update(): void {
		if (this.updating) { return; }
		this.updating = true;
		try {
			if (!this.portStatus) { return; }
			this.portStatus.getPortsList().forEach(e => {
				const localPort = e.getLocalPort();
				const gitpodPort = this.portMap.get(localPort);
				const tunnel = this.tunnels.get(localPort);
				if (!gitpodPort) {
					this.portMap.set(localPort, new GitpodWorkspacePort(localPort, this.context, e, tunnel));
					return;
				}
				const prevStatus = gitpodPort.status;
				gitpodPort.update(e, tunnel);
				if (isExposedServedGitpodWorkspacePort(gitpodPort) && !isExposedServedPort(prevStatus)) {
					this.onDidExposeServedPortEmitter.fire(gitpodPort);
				}
			});
			this.onDidChangePortsEmitter.fire(this.portMap);
			this.updateHtml();
		} finally {
			this.updating = false;
		}
	}

	private updateHtml(): void {
		const ports = Array.from(this.portMap.values()).map(e => e.toSvelteObject());
		this._view?.webview.postMessage({ command: 'updatePorts', ports });
	}

	private onHtmlCommand() {
		this._view?.webview.onDidReceiveMessage(async (message: { command: PortCommand; port: { info: PortInfo; status: PortsStatus.AsObject } }) => {
			const port = this.portMap.get(message.port.status.localPort);
			if (!port) { return; }
			if (message.command === 'urlCopy' && port.status.exposed) {
				await vscode.env.clipboard.writeText(port.status.exposed.url);
				return;
			}
			vscode.commands.executeCommand('gitpod.ports.' + message.command, { port });
		});
	}
}

export function getNonce() {
	let text = '';
	const possible =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
