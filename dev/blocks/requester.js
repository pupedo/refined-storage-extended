IDRegistry.genBlockID("RSE_requester");
Block.createBlock("RSE_requester", [
	{ name: "Requester", texture: [["requester_disconnected", 0]], inCreative: true }
]);
Block.setupAsRedstoneReceiver("RSE_requester", true);

function getRequesterModel(active) {
	return BlockRenderer.createTexturedBlock(active ? [["requester_connected", 0]] : [["requester_disconnected", 0]]);
}

function RSE_requesterHasActiveTask(api, netId, requestedUids) {
	if (!requestedUids || !requestedUids.length) return false;
	if (!api || !api.networks || typeof api.networks.getTasks != 'function') return false;
	var tasks = api.networks.getTasks(netId) || [];
	for (var i = 0; i < tasks.length; i++) {
		var task = tasks[i];
		if (!task || task.cancelled) continue;
		for (var u = 0; u < requestedUids.length; u++) {
			if (task.requested === requestedUids[u]) return true;
		}
	}
	return false;
}

BlockRenderer.enableCoordMapping(BlockID.RSE_requester, -1, new ICRender.Model(getRequesterModel(false)));

var requesterSlotY = (UI.getScreenHeight() - 80) / 2 - 30;
var elementsGUI_requester = {};
(function initRequesterElements() {
	var slotY = requesterSlotY;
	elementsGUI_requester["slot_filter0"] = {
		type: "slot",
		num: 0,
		name: "slot_filter0",
		x: 365,
		y: slotY,
		size: 60
	};
	elementsGUI_requester["amount_frame"] = {
		type: "frame",
		x: 445,
		y: slotY,
		width: 260,
		height: 70,
		z: 1,
		bitmap: "UIC_slider4",
		scale: 1,
		clicker: {
			onClick: function (itemContainerUiHandler, itemContainer, element) {
				UI.getContext().runOnUiThread(new java.lang.Runnable({
					run: function () {
						var editText = new android.widget.EditText(UI.getContext());
						new android.app.AlertDialog.Builder(UI.getContext())
							.setTitle(Translation.translate("Item amount"))
							.setView(editText)
							.setPositiveButton("OK", {
								onClick: function () {
									var dialogWindow = itemContainerUiHandler.getWindow();
									if (!dialogWindow || !dialogWindow.isOpened()) return;
									var amountValue = parseInt(editText.getText() + "", 10);
									if (isNaN(amountValue) || amountValue < 0) amountValue = 0;
									itemContainer.sendEvent("setAmount", { amount: amountValue });
								}
							}).show();
					}
				}));
			}
		}
	};
	elementsGUI_requester["amount_text"] = {
		type: "text",
		x: 575,
		y: slotY + 2,
		text: "0",
		font: { size: 40, color: android.graphics.Color.WHITE, alignment: 1 },
		z: 100
	};
	elementsGUI_requester["save_amount"] = {
		type: "button",
		x: 715,
		y: slotY + 15,
		width: 80,
		height: 40,
		scale: 1,
		bitmap: "frame[name=UIC_empty_button size=80,40]",
		bitmap2: "frame[name=UIC_empty_button_pressed size=80,40]",
		clicker: {
			onClick: function (itemContainerUiHandler, itemContainer, element) {
				itemContainer.sendEvent("saveAmount", {});
			},
			onLongClick: function (itemContainerUiHandler, itemContainer, element) {}
		}
	};
	elementsGUI_requester["save_amount_text"] = {
		type: "text",
		x: 755,
		y: slotY + 12,
		text: "Save",
		font: { size: 16, color: android.graphics.Color.DKGRAY, alignment: 1 },
		z: 100
	};
	elementsGUI_requester["amount_minus_64"] = {
		type: "button",
		x: 625,
		y: slotY + 80,
		width: 80,
		height: 40,
		scale: 1,
		bitmap: "frame[name=UIC_empty_button size=80,40]",
		bitmap2: "frame[name=UIC_empty_button_pressed size=80,40]",
		clicker: {
			onClick: function (itemContainerUiHandler, itemContainer, element) {
				itemContainer.sendEvent("adjustAmount", { delta: -64 });
			},
			onLongClick: function (itemContainerUiHandler, itemContainer, element) {}
		}
	};
	elementsGUI_requester["amount_minus_64_text"] = {
		type: "text",
		x: 665,
		y: slotY + 77,
		text: "-64",
		font: { size: 24, color: android.graphics.Color.WHITE, alignment: 1, shadow: 0.5 },
		z: 100
	};
	elementsGUI_requester["amount_minus_10"] = {
		type: "button",
		x: 535,
		y: slotY + 80,
		width: 80,
		height: 40,
		scale: 1,
		bitmap: "frame[name=UIC_empty_button size=80,40]",
		bitmap2: "frame[name=UIC_empty_button_pressed size=80,40]",
		clicker: {
			onClick: function (itemContainerUiHandler, itemContainer, element) {
				itemContainer.sendEvent("adjustAmount", { delta: -10 });
			},
			onLongClick: function (itemContainerUiHandler, itemContainer, element) {}
		}
	};
	elementsGUI_requester["amount_minus_10_text"] = {
		type: "text",
		x: 575,
		y: slotY + 77,
		text: "-10",
		font: { size: 24, color: android.graphics.Color.WHITE, alignment: 1, shadow: 0.5 },
		z: 100
	};
	elementsGUI_requester["amount_minus_1"] = {
		type: "button",
		x: 445,
		y: slotY + 80,
		width: 80,
		height: 40,
		scale: 1,
		bitmap: "frame[name=UIC_empty_button size=80,40]",
		bitmap2: "frame[name=UIC_empty_button_pressed size=80,40]",
		clicker: {
			onClick: function (itemContainerUiHandler, itemContainer, element) {
				itemContainer.sendEvent("adjustAmount", { delta: -1 });
			},
			onLongClick: function (itemContainerUiHandler, itemContainer, element) {}
		}
	};
	elementsGUI_requester["amount_minus_1_text"] = {
		type: "text",
		x: 485,
		y: slotY + 77,
		text: "-1",
		font: { size: 24, color: android.graphics.Color.WHITE, alignment: 1, shadow: 0.5 },
		z: 100
	};
	elementsGUI_requester["amount_plus_1"] = {
		type: "button",
		x: 445,
		y: slotY - 50,
		width: 80,
		height: 40,
		scale: 1,
		bitmap: "frame[name=UIC_empty_button size=80,40]",
		bitmap2: "frame[name=UIC_empty_button_pressed size=80,40]",
		clicker: {
			onClick: function (itemContainerUiHandler, itemContainer, element) {
				itemContainer.sendEvent("adjustAmount", { delta: 1 });
			},
			onLongClick: function (itemContainerUiHandler, itemContainer, element) {}
		}
	};
	elementsGUI_requester["amount_plus_1_text"] = {
		type: "text",
		x: 485,
		y: slotY - 53,
		text: "+1",
		font: { size: 24, color: android.graphics.Color.WHITE, alignment: 1, shadow: 0.5 },
		z: 100
	};
	elementsGUI_requester["amount_plus_10"] = {
		type: "button",
		x: 535,
		y: slotY - 50,
		width: 80,
		height: 40,
		scale: 1,
		bitmap: "frame[name=UIC_empty_button size=80,40]",
		bitmap2: "frame[name=UIC_empty_button_pressed size=80,40]",
		clicker: {
			onClick: function (itemContainerUiHandler, itemContainer, element) {
				itemContainer.sendEvent("adjustAmount", { delta: 10 });
			},
			onLongClick: function (itemContainerUiHandler, itemContainer, element) {}
		}
	};
	elementsGUI_requester["amount_plus_10_text"] = {
		type: "text",
		x: 575,
		y: slotY - 53,
		text: "+10",
		font: { size: 24, color: android.graphics.Color.WHITE, alignment: 1, shadow: 0.5 },
		z: 100
	};
	elementsGUI_requester["amount_plus_64"] = {
		type: "button",
		x: 625,
		y: slotY - 50,
		width: 80,
		height: 40,
		scale: 1,
		bitmap: "frame[name=UIC_empty_button size=80,40]",
		bitmap2: "frame[name=UIC_empty_button_pressed size=80,40]",
		clicker: {
			onClick: function (itemContainerUiHandler, itemContainer, element) {
				itemContainer.sendEvent("adjustAmount", { delta: 64 });
			},
			onLongClick: function (itemContainerUiHandler, itemContainer, element) {}
		}
	};
	elementsGUI_requester["amount_plus_64_text"] = {
		type: "text",
		x: 665,
		y: slotY - 53,
		text: "+64",
		font: { size: 24, color: android.graphics.Color.WHITE, alignment: 1, shadow: 0.5 },
		z: 100
	};
	elementsGUI_requester["redstone_button"] = {
		type: "button",
		x: 255,
		y: slotY - 60,
		bitmap: "UIC_empty_button",
		bitmap2: "UIC_empty_button_pressed",
		scale: 2,
		clicker: {
			onClick: function (itemContainerUiHandler, itemContainer, element) {
				itemContainer.sendEvent("updateRedstoneMode", {});
			},
			onLongClick: function (itemContainerUiHandler, itemContainer, element) {}
		}
	};
	elementsGUI_requester["image_redstone"] = {
		type: "image",
		x: 255,
		y: slotY - 60,
		z: 100,
		bitmap: "UIC_redstone_gui_0",
		scale: 2.5
	};
	elementsGUI_requester["status_text"] = {
		type: "text",
		x: 255,
		y: slotY + 70,
		text: "",
		font: { size: 16, color: android.graphics.Color.DKGRAY }
	};
})();

function layoutRequesterElements(content) {
	if (!content || !content.elements) return;
	var slotY = (UI.getScreenHeight() - 80) / 2 - 30;
	var filterSlotElement = content.elements["slot_filter0"];
	if (filterSlotElement) {
		filterSlotElement.x = 365;
		filterSlotElement.y = slotY;
	}
	var amountFrameElement = content.elements["amount_frame"];
	if (amountFrameElement) {
		amountFrameElement.x = 445;
		amountFrameElement.y = slotY;
		amountFrameElement.width = 260;
		amountFrameElement.height = 70;
	}
	var amountTextElement = content.elements["amount_text"];
	if (amountTextElement) {
		amountTextElement.x = 575;
		amountTextElement.y = slotY + 2;
		amountTextElement.font.size = 40;
	}
	var saveAmountButtonElement = content.elements["save_amount"];
	if (saveAmountButtonElement) {
		saveAmountButtonElement.x = 715;
		saveAmountButtonElement.y = slotY + 15;
		saveAmountButtonElement.width = 80;
		saveAmountButtonElement.height = 40;
	}
	var saveAmountTextElement = content.elements["save_amount_text"];
	if (saveAmountTextElement) {
		saveAmountTextElement.x = 755;
		saveAmountTextElement.y = slotY + 12;
		saveAmountTextElement.font.size = 16;
	}
	var amountButtons = [
		{ buttonName: "amount_minus_1", textName: "amount_minus_1_text", x: 445, yOffset: 80 },
		{ buttonName: "amount_minus_10", textName: "amount_minus_10_text", x: 535, yOffset: 80 },
		{ buttonName: "amount_minus_64", textName: "amount_minus_64_text", x: 625, yOffset: 80 },
		{ buttonName: "amount_plus_1", textName: "amount_plus_1_text", x: 445, yOffset: -50 },
		{ buttonName: "amount_plus_10", textName: "amount_plus_10_text", x: 535, yOffset: -50 },
		{ buttonName: "amount_plus_64", textName: "amount_plus_64_text", x: 625, yOffset: -50 }
	];
	for (var i = 0; i < amountButtons.length; i++) {
		var amountButtonConfig = amountButtons[i];
		var amountButtonElement = content.elements[amountButtonConfig.buttonName];
		if (amountButtonElement) {
			amountButtonElement.x = amountButtonConfig.x;
			amountButtonElement.y = slotY + amountButtonConfig.yOffset;
			amountButtonElement.width = 80;
			amountButtonElement.height = 40;
			amountButtonElement.scale = 1;
		}
		var amountButtonTextElement = content.elements[amountButtonConfig.textName];
		if (amountButtonTextElement) {
			amountButtonTextElement.x = amountButtonConfig.x + 40;
			amountButtonTextElement.y = slotY + amountButtonConfig.yOffset - 3;
			amountButtonTextElement.font.size = 24;
		}
	}
	var redstoneButtonElement = content.elements["redstone_button"];
	if (redstoneButtonElement) {
		redstoneButtonElement.x = 255;
		redstoneButtonElement.y = slotY - 60;
	}
	var redstoneImageElement = content.elements["image_redstone"];
	if (redstoneImageElement) {
		redstoneImageElement.x = 255;
		redstoneImageElement.y = slotY - 60;
	}
	var statusTextElement = content.elements["status_text"];
	if (statusTextElement) {
		statusTextElement.x = 255;
		statusTextElement.y = slotY + 70;
	}
}

var requesterGUI = new UI.StandartWindow({
	standart: {
		header: { text: { text: Translation.translate("Requester") } },
		inventory: { padding: 20, width: 300 / 4 * 3 },
		background: { standart: true }
	},
	drawing: [],
	elements: elementsGUI_requester
});

Callback.addCallback("PostLoaded", function () {
	ModAPI.addAPICallback("RefinedStorageAPI", function (api) {
		if (!api || !api.blocks || !api.networks) {
			RSE.log("requester skipped: RefinedStorageAPI unavailable");
			return;
		}
		if (!RSE.apiAtLeast(api, 2, 0)) {
			RSE.log("requester skipped: RefinedStorageAPI 2.0 required");
			return;
		}
		api.energy.set(BlockID.RSE_requester, Config.requester.energy || 10);
		api.blocks.create(BlockID.RSE_requester, {
			useNetworkItemContainer: true,
			defaultValues: {
				NETWORK_ID: 'f',
				LAST_NETWORK_ID: 'f',
				redstone_mode: 0,
				redstone_power: false,
				amount: 0,
				pendingAmount: 0,
				missing: false,
				crafting: false,
				lastCheck: 0
			},
			click: function (id, count, data, coords, player, extra) {
				if (Entity.getSneaking(player)) return false;
				var client = Network.getClientForPlayer(player);
				if (!client || this.container.getNetworkEntity().getClients().contains(client)) return true;
				this.container.openFor(client, "main");
				this.refreshGui(true, client);
				return true;
			},
			getScreenByName: function (screenName) {
				return requesterGUI;
			},
			pre_init: function () {
				var currentAmount = parseInt(this.data.amount, 10) || 0;
				if (currentAmount <= 0 && this.data.amounts) {
					for (var i = 0; i < this.data.amounts.length; i++) {
						var legacyAmount = parseInt(this.data.amounts[i], 10) || 0;
						if (legacyAmount > currentAmount) currentAmount = legacyAmount;
					}
					this.data.amount = currentAmount;
				}
				this.data.pendingAmount = this.data.amount || 0;
				if (typeof api.on === 'function' && !this.requesterEventUnsubscribers) {
					var requesterTile = this;
					var resetRequesterLastCheck = function (event) {
						if (event && event.netId === requesterTile.data.NETWORK_ID) requesterTile.data.lastCheck = 0;
					};
					this.requesterEventUnsubscribers = [
						api.on("storageUpdated", resetRequesterLastCheck),
						api.on("itemInserted", resetRequesterLastCheck),
						api.on("itemExtracted", resetRequesterLastCheck)
					];
				}
			},
			pre_destroy: function () {
				var unsubscribers = this.requesterEventUnsubscribers;
				if (!unsubscribers) return;
				for (var i = 0; i < unsubscribers.length; i++) {
					if (typeof unsubscribers[i] === 'function') {
						try { unsubscribers[i](); } catch (e) {}
					}
				}
				this.requesterEventUnsubscribers = null;
			},
			clearStatus: function () {
				if (!this.data.missing && !this.data.crafting) return;
				this.data.missing = false;
				this.data.crafting = false;
				this.refreshGui();
			},
			tick: function () {
				if (this.data.NETWORK_ID == 'f') {
					this.clearStatus();
					return;
				}
				var now = World.getThreadTime();
				if (now < this.data.lastCheck) this.data.lastCheck = now;
				if (now - this.data.lastCheck < (Config.requester.interval || 70)) return;
				this.data.lastCheck = now;
				if (!this.isWorkAllowed()) {
					this.clearStatus();
					return;
				}
				var netId = this.data.NETWORK_ID;
				var amount = parseInt(this.data.amount, 10) || 0;
				if (amount <= 0) {
					this.clearStatus();
					return;
				}
				var item = this.container.getSlot('slot_filter0');
				if (!item || item.id == 0) {
					if (this.data.missing || this.data.crafting) {
						this.data.missing = false;
						this.data.crafting = false;
						this.refreshGui();
					}
					return;
				}
				try {
					var requestedUids = null;
					if (item.data != -1) {
						requestedUids = [
							getItemUid({ id: item.id, data: item.data || 0, extra: null }),
							item.id + ':' + (item.data || 0) + ':'
						];
					}
					var crafting = RSE_requesterHasActiveTask(api, netId, requestedUids);
					var missing = false;
					if (crafting) {
						if (!this.data.crafting || this.data.missing) {
							this.data.crafting = true;
							this.data.missing = false;
							this.refreshGui();
						}
						return;
					}
					var maxCraft = Math.max(1, Config.requester.maxCraftAmount || 1000);
					var refreshMode = Config.requester.refreshMode || 'poll';
					if (refreshMode !== 'event') {
						RSE_refreshNetItems(api, netId, now);
					}
					var netItems = api.networks.getItems(netId) || [];
					if (refreshMode === 'event' && netItems.length === 0 && api.networks.getStored && api.networks.getStored(netId) > 0) {
						RSE_refreshNetItems(api, netId, now);
						netItems = api.networks.getItems(netId) || [];
					}
					var have = 0;
					for (var i = 0; i < netItems.length; i++) {
						var entry = netItems[i];
						if (entry && entry.id === item.id && (entry.data || 0) === (item.data || 0)) have += entry.count || 0;
					}
					var callerKey = 'RSE_requester:' + this.dimension + ':' + cts(this);
					var probe = api.networks.keepStock(netId, { id: item.id, data: item.data || 0 }, 0, callerKey);
					var coreHave = probe && typeof probe.have === 'number' ? probe.have : have;
					var minimum = Math.min(amount, coreHave + maxCraft);
					var result = api.networks.keepStock(netId, { id: item.id, data: item.data || 0 }, minimum, callerKey);
					var status = result && result.status;
					crafting = status === 'ok' || status === 'deduped';
					missing = status === 'failed' || status === 'throttled';
					if (crafting != this.data.crafting || missing != this.data.missing) {
						this.data.crafting = crafting;
						this.data.missing = missing;
						this.refreshGui();
					}
				} catch (e) {
					RSE.log("requester tick error: " + e);
					return;
				}
			},
			refreshGui: function (first, client) {
				if (first) this.data.pendingAmount = this.data.amount || 0;
				var _data = {
					name: this.networkData.getName() + '',
					isActive: this.data.isActive,
					NETWORK_ID: this.data.NETWORK_ID,
					redstone_mode: this.data.redstone_mode,
					amount: this.data.amount || 0,
					pendingAmount: this.data.pendingAmount || 0,
					missing: !!this.data.missing,
					crafting: !!this.data.crafting
				};
				if (client) this.container.sendEvent(client, "openGui", _data);
				else this.container.sendEvent("openGui", _data);
			},
			refreshModel: function () {
				if (!this.networkEntity) return;
				this.sendPacket("refreshModel", {
					isActive: this.data.isActive,
					coords: { x: this.x, y: this.y, z: this.z }
				});
			},
			containerEvents: {
				setAmount: function (eventData, connectedClient) {
					var amount = parseInt(eventData.amount, 10);
					if (isNaN(amount) || amount < 0) return;
					this.data.pendingAmount = amount;
					this.refreshGui();
				},
				adjustAmount: function (eventData, connectedClient) {
					var delta = parseInt(eventData.delta, 10);
					if (isNaN(delta)) return;
					var pendingAmount = parseInt(this.data.pendingAmount, 10);
					if (isNaN(pendingAmount)) pendingAmount = parseInt(this.data.amount, 10) || 0;
					var amount = pendingAmount + delta;
					if (amount < 0) amount = 0;
					this.data.pendingAmount = amount;
					this.refreshGui();
				},
				saveAmount: function (eventData, connectedClient) {
					var amount = parseInt(this.data.pendingAmount, 10);
					if (isNaN(amount) || amount < 0) amount = 0;
					this.data.amount = amount;
					this.data.pendingAmount = amount;
					this.refreshGui();
				}
			},
			client: {
				refreshModel: function () {
					var render = new ICRender.Model(getRequesterModel(this.networkData.getBoolean('isActive')));
					BlockRenderer.mapAtCoords(this.x, this.y, this.z, render);
				},
				events: {
					refreshModel: function (eventData) {
						var render = new ICRender.Model(getRequesterModel(eventData.isActive));
						BlockRenderer.mapAtCoords(eventData.coords.x, eventData.coords.y, eventData.coords.z, render);
					}
				},
				containerEvents: {
					openGui: function (container, window, content, eventData) {
						if (!content || !window || !window.isOpened()) return;
						layoutRequesterElements(content);
						var amountTextElement = content.elements["amount_text"];
						if (amountTextElement) {
							amountTextElement.text = String(
								eventData.pendingAmount !== undefined ? eventData.pendingAmount : (eventData.amount || 0)
							);
						}
						var redstoneImageElement = content.elements["image_redstone"];
						if (redstoneImageElement) {
							var redstoneMode = parseInt(eventData.redstone_mode, 10);
							if (isNaN(redstoneMode)) redstoneMode = 0;
							redstoneMode = Math.max(0, Math.min(2, redstoneMode));
							redstoneImageElement.bitmap = "UIC_redstone_gui_" + redstoneMode;
						}
						var statusTextElement = content.elements["status_text"];
						if (statusTextElement) {
							if (eventData.missing) {
								statusTextElement.text = Translation.translate("Missing ingredients");
								statusTextElement.font.color = android.graphics.Color.RED;
							} else if (eventData.crafting) {
								statusTextElement.text = Translation.translate("Crafting");
								statusTextElement.font.color = android.graphics.Color.YELLOW;
							} else {
								statusTextElement.text = "";
								statusTextElement.font.color = android.graphics.Color.DKGRAY;
							}
						}
						window.getWindow('main').forceRefresh();
					}
				}
			}
		});
		RSE.logDev("requester tile registered");
	});
});
