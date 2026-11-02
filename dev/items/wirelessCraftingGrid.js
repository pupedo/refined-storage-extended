IDRegistry.genItemID(RSE_ITEMS.wcg.id);
var wirelessCraftingGridItemCreationResult = Item.createItem(RSE_ITEMS.wcg.id, RSE_ITEMS.wcg.name, {
	name: RSE_ITEMS.wcg.texture
}, {
	stack: 1,
	isTech: true
});
RSE.itemCreated[RSE_ITEMS.wcg.id] = !!wirelessCraftingGridItemCreationResult;
RSE.itemReady[RSE_ITEMS.wcg.id] = !!wirelessCraftingGridItemCreationResult;

var RSEChargeRegistry = null;
var RSEItemName = null;

function RSE_clearOtherWirelessSessions(api, playerUid) {
	var session = api && api.wireless && api.wireless.getSession ? api.wireless.getSession(playerUid) : null;
	if (!session || !session.tile || !session.tile.data) return;
	var data = session.tile.data;
	if (data.wirelessPlayers) delete data.wirelessPlayers[playerUid];
	if (data.wirelessMonitorPlayers) delete data.wirelessMonitorPlayers[playerUid];
}

var RSE_WCG = {
	RS: null,
	throttle: {},
	open: function (playerUid) {
		if (!this.RS || !this.RS.wireless) return;
		var existingSession = this.RS.wireless.getSession(playerUid);
		var otherSessionMap = existingSession ? 'wirelessMonitorPlayers' : 'wirelessPlayers';
		this.RS.wireless.open({
			playerUid: playerUid,
			itemId: ItemID[RSE_ITEMS.wcg.id],
			config: Config.wirelessCraftingGrid,
			screen: 'craftingGrid',
			sessionMap: 'wirelessCraftingGridPlayers',
			otherSessionMap: otherSessionMap,
			throttle: this.throttle,
			noBindMsg: 'Wireless Crafting Grid is not bound to a network.',
			noRangeMsg: 'There is no Wireless Transmitter in range.',
			noTransmitterMsg: Config.wirelessCraftingGrid.noTransmitterMsg || 'There is no Wireless Transmitter in the network.',
			transmitterUnloadedMsg: Config.wirelessCraftingGrid.transmitterUnloadedMsg || 'The Wireless Transmitter is not loaded.',
			noEnergyMsg: 'Wireless Crafting Grid is out of energy.'
		});
		var session = this.RS.wireless.getSession(playerUid);
		if (session && session.screen == 'craftingGrid') {
			RSE_clearOtherWirelessSessions(this.RS, playerUid);
		}
	}
};

Callback.addCallback("LevelLeft", function () {
	RSE_WCG.throttle = {};
});

Item.registerNameOverrideFunction(ItemID.RSE_wireless_crafting_grid, function (item, name) {
	if (!item.extra) return name;
	if (RSEItemName) {
		return name + "\n§7" + RSEItemName.getItemStorageText(item);
	}
	return name + "\n§7Energy: " + item.extra.getInt('energy', 0) + '/' + Config.wirelessCraftingGrid.capacity;
});

Item.registerIconOverrideFunction(ItemID.RSE_wireless_crafting_grid, function (item, isModUi) {
	if (item.extra && item.extra.getInt('controllerX', -1) != -1) {
		return { name: 'wireless_crafting_grid_active', data: 0 };
	}
	return { name: 'wireless_crafting_grid_inactive', data: 0 };
});

Callback.addCallback("PostLoaded", function () {
	if (!RSE.itemCreated[RSE_ITEMS.wcg.id]) return;
	var api = ModAPI.requireAPI("ICore");
	if (api && api.ChargeRegistry) {
		RSEChargeRegistry = api.ChargeRegistry;
		RSEItemName = api.ItemName;
		RSEChargeRegistry.registerItem(ItemID.RSE_wireless_crafting_grid, "Eu", Config.wirelessCraftingGrid.capacity, 128, 1, false, false);
		Item.addToCreative(ItemID.RSE_wireless_crafting_grid, 1, 27, new ItemExtraData().putInt('energy', 0));
	} else {
		Item.addToCreative(ItemID.RSE_wireless_crafting_grid, 1);
	}
});

ModAPI.addAPICallback("RefinedStorageAPI", function (rsApi) {
	if (!rsApi || !rsApi.wireless) {
		RSE.log("wireless crafting grid skipped: RefinedStorageAPI unavailable");
		return;
	}
	if (!RSE.apiAtLeast(rsApi, 2, 0)) {
		RSE.log("wireless crafting grid skipped: RefinedStorageAPI 2.0 required");
		return;
	}
	RSE_WCG.RS = rsApi;
	rsApi.on("wirelessGridAction", function (data) {
		if (!data || !data.playerUid) return;
		if (data.source == 'block') return;
		var session = rsApi.wireless.getSession(data.playerUid);
		if (!session || session.screen != 'craftingGrid') return;
		if (session.netId != data.netId) return;
		var client = Network.getClientForPlayer(data.playerUid);
		if (!client || !session.tile.container.getNetworkEntity().getClients().contains(client)) return;
		var usage = data.kind == 'autocraft'
			? Config.wirelessCraftingGrid.autocraftUsage
			: Config.wirelessCraftingGrid.craftUsage;
		if (!usage) return;
		rsApi.wireless.drain(session.tile, data.playerUid, usage, ItemID.RSE_wireless_crafting_grid,
			Config.wirelessCraftingGrid.capacity, 'wirelessCraftingGridPlayers',
			'Wireless Crafting Grid is out of energy.');
	});
	RSE.logDev("wireless crafting grid registered");
});

Callback.addCallback("ItemUseServer", function (coords, item, block, playerUid) {
	if (item.id != ItemID.RSE_wireless_crafting_grid) return;
	if (!RSE_WCG.RS || !RSE_WCG.RS.wireless) return;
	RSE_WCG.RS.wireless.bind(ItemID.RSE_wireless_crafting_grid, Config.wirelessCraftingGrid.capacity, coords, playerUid, BlockSource.getDefaultForActor(playerUid));
});

function RSE_requestOpenWCG(player) {
	if (LowLevelUtils.getCurrentThreadType() == "SERVER") {
		RSE_WCG.open(player);
	} else if (LowLevelUtils.getCurrentThreadType() == "CLIENT") {
		Network.sendToServer("rseWirelessCraftingGridOpen", {});
	}
}

Item.registerNoTargetUseFunction(RSE_ITEMS.wcg.id, function (item, player) {
	RSE_requestOpenWCG(player);
});

Item.setMaxUseDuration(ItemID.RSE_wireless_crafting_grid, 1);
Item.registerUsingCompleteFunction(ItemID.RSE_wireless_crafting_grid, function (item, player) {
	RSE_requestOpenWCG(player);
});

Callback.addCallback("PlayerAttack", function (attackerUid, victimUid) {
	if (victimUid) return;
	if (Entity.getCarriedItem(attackerUid).id == ItemID.RSE_wireless_crafting_grid) RSE_WCG.open(attackerUid);
});

Network.addServerPacket("rseWirelessCraftingGridOpen", function (client, data) {
	RSE_WCG.open(client.getPlayerUid());
});
