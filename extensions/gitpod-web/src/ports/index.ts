/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Gitpod. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/// <reference path='../../../../src/vscode-dts/vscode.d.ts'/>
/// <reference path='../../../../src/vscode-dts/vscode.proposed.resolvers.d.ts'/>

import * as grpc from '@grpc/grpc-js';
import { PortsStatusRequest, PortsStatusResponse, PortVisibility, OnPortExposedAction } from '@gitpod/supervisor-api-grpc/lib/status_pb';
import { TunnelVisiblity, TunnelPortRequest, RetryAutoExposeRequest, CloseTunnelRequest } from '@gitpod/supervisor-api-grpc/lib/port_pb';
import { ExposePortRequest } from '@gitpod/supervisor-api-grpc/lib/control_pb';
import { GitpodExtensionContext } from 'gitpod-shared';
import * as util from 'util';
import * as vscode from 'vscode';
import { GitpodPortViewProvider, GitpodWorkspacePort, isExposedServedGitpodWorkspacePort } from './portWebview';
import { GitpodWorkspaceTreeDataProvider } from './portTreeView';

interface PortItem { port: GitpodWorkspacePort }

export function registerPorts(context: GitpodExtensionContext): void {
	const portMap = new Map<number, GitpodWorkspacePort>();
	const tunnelMap = new Map<number, vscode.TunnelDescription>();

	// register tree view
	const gitpodWorkspaceTreeDataProvider = new GitpodWorkspaceTreeDataProvider(context);
	const treeView = vscode.window.createTreeView('gitpod.workspace', { treeDataProvider: gitpodWorkspaceTreeDataProvider });
	context.subscriptions.push(treeView);

	// register webview
	const portViewProvider = new GitpodPortViewProvider(context);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider(GitpodPortViewProvider.viewType, portViewProvider));

	function observePortsStatus(): vscode.Disposable {
		let run = true;
		let stopUpdates: Function | undefined;
		(async () => {
			while (run) {
				try {
					const req = new PortsStatusRequest();
					req.setObserve(true);
					const evts = context.supervisor.status.portsStatus(req, context.supervisor.metadata);
					stopUpdates = evts.cancel.bind(evts);

					await new Promise((resolve, reject) => {
						evts.on('end', resolve);
						evts.on('error', reject);
						evts.on('data', (update: PortsStatusResponse) => {
							portViewProvider.updatePortsStatus(update);
							gitpodWorkspaceTreeDataProvider.updatePortsStatus(update);
							portMap.clear();
							update.getPortsList().forEach(e => {
								const portNumber = e.getLocalPort();
								portMap.set(portNumber, new GitpodWorkspacePort(portNumber, context, e, tunnelMap.get(portNumber)));
							});
						});
					});
				} catch (err) {
					if (!('code' in err && err.code === grpc.status.CANCELLED)) {
						context.logger.error('cannot maintain connection to supervisor', err);
						console.error('cannot maintain connection to supervisor', err);
					}
				} finally {
					stopUpdates = undefined;
				}
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
		})();
		return new vscode.Disposable(() => {
			run = false;
			if (stopUpdates) {
				stopUpdates();
			}
		});
	}
	context.subscriptions.push(observePortsStatus());
	context.subscriptions.push(vscode.commands.registerCommand('gitpod.resolveExternalPort', (portNumber: number) => {
		// eslint-disable-next-line no-async-promise-executor
		return new Promise<string>(async (resolve, reject) => {
			try {
				const tryResolve = () => {
					const port = portMap.get(portNumber);
					const exposed = port?.status?.exposed;
					if (exposed) {
						resolve(exposed.url);
						return true;
					}
					return false;
				};
				if (!tryResolve()) {
					const listenerWebview = portViewProvider.onDidChangePorts(element => {
						if (element === portViewProvider.portMap && tryResolve()) {
							listenerWebview.dispose();
						}
					});
					const listener = gitpodWorkspaceTreeDataProvider.onDidChangeTreeData(element => {
						if (element === gitpodWorkspaceTreeDataProvider.ports && tryResolve()) {
							listener.dispose();
						}
					});
					const request = new ExposePortRequest();
					request.setPort(portNumber);
					await util.promisify(context.supervisor.control.exposePort.bind(context.supervisor.control, request, context.supervisor.metadata, {
						deadline: Date.now() + context.supervisor.deadlines.normal
					}))();
				}
			} catch (e) {
				reject(e);
			}
		});
	}));
	context.subscriptions.push(vscode.commands.registerCommand('gitpod.ports.makePrivate', (port: PortItem) => {
		context.fireAnalyticsEvent({
			eventName: 'vscode_execute_command_gitpod_ports',
			properties: { action: 'private' }
		});
		return port.port.setPortVisibility('private');
	}));
	context.subscriptions.push(vscode.commands.registerCommand('gitpod.ports.makePublic', (port: PortItem) => {
		context.fireAnalyticsEvent({
			eventName: 'vscode_execute_command_gitpod_ports',
			properties: { action: 'public' }
		});
		return port.port.setPortVisibility('public');
	}));
	context.subscriptions.push(vscode.commands.registerCommand('gitpod.ports.tunnelNetwork', (port: PortItem) => {
		port.port.setTunnelVisibility(TunnelVisiblity.NETWORK);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('gitpod.ports.tunnelHost', async (port: PortItem) =>
		port.port.setTunnelVisibility(TunnelVisiblity.HOST)
	));
	context.subscriptions.push(vscode.commands.registerCommand('gitpod.ports.preview', (port: PortItem) => {
		context.fireAnalyticsEvent({
			eventName: 'vscode_execute_command_gitpod_ports',
			properties: { action: 'preview' }
		});
		return openPreview(port.port);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('gitpod.ports.openBrowser', (port: PortItem) => {
		context.fireAnalyticsEvent({
			eventName: 'vscode_execute_command_gitpod_ports',
			properties: { action: 'openBrowser' }
		});
		return port.port.openExternal();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('gitpod.ports.retryAutoExpose', async (port: PortItem) => {
		const request = new RetryAutoExposeRequest();
		request.setPort(port.port.portNumber);
		await util.promisify(context.supervisor.port.retryAutoExpose.bind(context.supervisor.port, request, context.supervisor.metadata, {
			deadline: Date.now() + context.supervisor.deadlines.normal
		}))();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('gitpod.openBrowser', (url: string) => {
		// TODO(hw): Open DEPRECATION doc traking?
		// context.fireAnalyticsEvent({
		// 	eventName: 'vscode_execute_command_gitpod_ports',
		// 	properties: { action: 'openBrowser' }
		// });
		return vscode.env.openExternal(vscode.Uri.parse(url));

	}));

	const portsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	context.subscriptions.push(portsStatusBarItem);
	function updateStatusBar(): void {
		const exposedPorts: number[] = [];
		for (const port of portMap.values()) {
			if (isExposedServedGitpodWorkspacePort(port)) {
				exposedPorts.push(port.status.localPort);
			}
		}
		let text: string;
		let tooltip = 'Click to open "Ports View"';
		if (exposedPorts.length) {
			text = 'Ports:';
			tooltip += '\n\nPorts';
			text += ` ${exposedPorts.join(', ')}`;
			tooltip += `\nPublic: ${exposedPorts.join(', ')}`;
		} else {
			text = '$(circle-slash) No open ports';
		}

		portsStatusBarItem.text = text;
		portsStatusBarItem.tooltip = tooltip;
		portsStatusBarItem.command = 'gitpod.ports.reveal';
		portsStatusBarItem.show();
	}
	updateStatusBar();
	context.subscriptions.push(portViewProvider.onDidChangePorts(() => updateStatusBar()));
	context.subscriptions.push(vscode.commands.registerCommand('gitpod.ports.reveal', () => {
		treeView.reveal(gitpodWorkspaceTreeDataProvider.ports, {
			focus: true,
			expand: true
		});
	}));

	const currentNotifications = new Set<number>();
	async function showOpenServiceNotification(port: GitpodWorkspacePort, offerMakePublic = false): Promise<void> {
		const localPort = port.portNumber;
		if (currentNotifications.has(localPort)) {
			return;
		}

		const makePublic = 'Make Public';
		const openAction = 'Open Preview';
		const openExternalAction = 'Open Browser';
		const actions = offerMakePublic ? [makePublic, openAction, openExternalAction] : [openAction, openExternalAction];

		currentNotifications.add(localPort);
		const result = await vscode.window.showInformationMessage('A service is available on port ' + localPort, ...actions);
		currentNotifications.delete(localPort);

		if (result === makePublic) {
			await port.setPortVisibility('public');
		} else if (result === openAction) {
			await openPreview(port);
		} else if (result === openExternalAction) {
			await port.openExternal();
		}
	}
	async function openPreview(port: GitpodWorkspacePort): Promise<void> {
		await previewUrl(port.externalUrl.toString());
	}
	async function previewUrl(url: string): Promise<void> {
		await vscode.commands.executeCommand('simpleBrowser.api.open', url, {
			viewColumn: vscode.ViewColumn.Beside,
			preserveFocus: true
		});
	}
	context.subscriptions.push(portViewProvider.onDidExposeServedPort(port => {
		if (port.status.exposed.onExposed === OnPortExposedAction.IGNORE) {
			return;
		}

		if (port.status.exposed.onExposed === OnPortExposedAction.OPEN_BROWSER) {
			port.openExternal();
			return;
		}

		if (port.status.exposed.onExposed === OnPortExposedAction.OPEN_PREVIEW) {
			openPreview(port);
			return;
		}

		if (port.status.exposed.onExposed === OnPortExposedAction.NOTIFY) {
			showOpenServiceNotification(port);
			return;
		}

		if (port.status.exposed.onExposed === OnPortExposedAction.NOTIFY_PRIVATE) {
			showOpenServiceNotification(port, port.status.exposed.visibility !== PortVisibility.PUBLIC);
			return;
		}
	}));


	let updateTunnelsTokenSource: vscode.CancellationTokenSource | undefined;
	async function updateTunnels(): Promise<void> {
		if (updateTunnelsTokenSource) {
			updateTunnelsTokenSource.cancel();
		}
		updateTunnelsTokenSource = new vscode.CancellationTokenSource();
		const token = updateTunnelsTokenSource.token;
		// not vscode.workspace.tunnels because of https://github.com/microsoft/vscode/issues/124334
		const currentTunnels = (await vscode.commands.executeCommand('gitpod.getTunnels')) as vscode.TunnelDescription[];
		if (token.isCancellationRequested) {
			return;
		}
		tunnelMap.clear();
		currentTunnels.forEach(tunnel => {
			tunnelMap.set(tunnel.remoteAddress.port, tunnel);
		});
		portViewProvider.updateTunnels(currentTunnels);
		gitpodWorkspaceTreeDataProvider.updateTunnels(currentTunnels);
	}
	updateTunnels();
	context.subscriptions.push(vscode.workspace.onDidChangeTunnels(() => updateTunnels()));
	context.subscriptions.push(vscode.commands.registerCommand('gitpod.vscode.workspace.openTunnel', (tunnelOptions: vscode.TunnelOptions) => {
		return vscode.workspace.openTunnel(tunnelOptions);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('gitpod.api.openTunnel', async (tunnelOptions: vscode.TunnelOptions, _tunnelCreationOptions: vscode.TunnelCreationOptions) => {
		const request = new TunnelPortRequest();
		request.setPort(tunnelOptions.remoteAddress.port);
		request.setTargetPort(tunnelOptions.localAddressPort || tunnelOptions.remoteAddress.port);
		request.setVisibility(!!tunnelOptions?.public ? TunnelVisiblity.NETWORK : TunnelVisiblity.HOST);
		await util.promisify(context.supervisor.port.tunnel.bind(context.supervisor.port, request, context.supervisor.metadata, {
			deadline: Date.now() + context.supervisor.deadlines.normal
		}))();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('gitpod.api.closeTunnel', async (port: number) => {
		const request = new CloseTunnelRequest();
		request.setPort(port);
		await util.promisify(context.supervisor.port.closeTunnel.bind(context.supervisor.port, request, context.supervisor.metadata, {
			deadline: Date.now() + context.supervisor.deadlines.normal
		}))();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('gitpod.dev.enableForwardedPortsView', () =>
		vscode.commands.executeCommand('setContext', 'forwardedPortsViewEnabled', true)
	));
	context.subscriptions.push(vscode.commands.registerCommand('gitpod.dev.connectLocalApp', async () => {
		const apiPortInput = await vscode.window.showInputBox({
			title: 'Connect to Local App',
			prompt: 'Enter Local App API port',
			value: '63100',
			validateInput: value => {
				const port = Number(value);
				if (port <= 0) {
					return 'port should be greater than 0';
				}
				if (port >= 65535) {
					return 'port should be less than 65535';
				}
				return undefined;
			}
		});
		if (apiPortInput) {
			const apiPort = Number(apiPortInput);
			vscode.commands.executeCommand('gitpod.api.connectLocalApp', apiPort);
		}
	}));
}
