/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Gitpod. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/// <reference path='../../../../src/vscode-dts/vscode.d.ts'/>
/// <reference path='../../../../src/vscode-dts/vscode.proposed.resolvers.d.ts'/>

import { GitpodExtensionContext } from 'gitpod-shared';
import { PortsStatusResponse } from '@gitpod/supervisor-api-grpc/lib/status_pb';
import * as vscode from 'vscode';
import { GitpodWorkspacePort } from './portWebview';

export class PortTreeItem extends vscode.TreeItem {
	constructor(
		public port: GitpodWorkspacePort,
	) {
		super('' + port.portNumber);
	}
}

class PortsTreeItem extends vscode.TreeItem {
	readonly ports = new Map<number, PortTreeItem>();
}

type GitpodWorkspaceElement = PortsTreeItem | PortTreeItem;

export class GitpodWorkspaceTreeDataProvider implements vscode.TreeDataProvider<GitpodWorkspaceElement> {

	readonly ports = new PortsTreeItem('Ports', vscode.TreeItemCollapsibleState.Expanded);
	readonly warning = new PortsTreeItem('This Remote Exploror is DEPRECATION', vscode.TreeItemCollapsibleState.None);

	protected readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<GitpodWorkspaceElement | undefined>();
	readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

	// private readonly onDidExposeServedPortEmitter = new vscode.EventEmitter<ExposedServedGitpodWorkspacePort>();
	// readonly onDidExposeServedPort = this.onDidExposeServedPortEmitter.event;

	constructor(private readonly context: GitpodExtensionContext) {
		this.warning.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
		// TODO(hw): Use link of real doc
		// TODO(hw): Focus on new ports view
		this.warning.command = {
			title: '',
			command: 'gitpod.openBrowser',
			arguments: ['https://www.gitpod.io/docs'],
		};
	}

	getTreeItem(element: GitpodWorkspaceElement): vscode.TreeItem { return element; }

	getChildren(element?: GitpodWorkspaceElement): vscode.ProviderResult<GitpodWorkspaceElement[]> {
		if (!element) {
			return [this.warning, this.ports];
		}
		if (element === this.ports) {
			return [...this.ports.ports.values()];
		}
		return [];
	}

	getParent(element: GitpodWorkspaceElement): GitpodWorkspaceElement | undefined {
		if (element instanceof PortTreeItem) {
			return this.ports;
		}
		return undefined;
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
		if (this.updating) {
			return;
		}
		this.updating = true;
		try {
			if (!this.portStatus) {
				return;
			}
			const toClean = new Set<number>(this.ports.ports.keys());
			const portsList = this.portStatus.getPortsList();
			for (const portStatus of portsList) {
				const currentStatus = portStatus.toObject();
				toClean?.delete(currentStatus.localPort);
				const port = this.ports.ports.get(currentStatus.localPort) || new PortTreeItem(new GitpodWorkspacePort(currentStatus.localPort, this.context, portStatus));
				// const prevStatus = port.port.status;
				this.ports.ports.set(currentStatus.localPort, port);

				port.port.update(portStatus, this.tunnels.get(currentStatus.localPort));

				port.label = port.port.info.label;
				port.tooltip = port.port.info.tooltip;
				port.description = port.port.info.description;
				port.iconPath = port.port.info.iconPath;
				port.contextValue = port.port.info.contextValue;

				// if (isExposedServedGitpodWorkspacePort(port.port) && !isExposedServedPort(prevStatus)) {
				// 	this.onDidExposeServedPortEmitter.fire(port.port);
				// }
			}
			for (const port of toClean) {
				this.ports.ports.delete(port);
			}
			this.onDidChangeTreeDataEmitter.fire(this.ports);
		} finally {
			this.updating = false;
		}
	}
}
